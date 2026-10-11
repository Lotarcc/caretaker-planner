// Minimal GVAS (Unreal SaveGame) reader for UE 5.4+ saves, which use "complete type name" property tags.
//
// A property tag is:
//   FString name ("None" ends a property list)
//   type name: FString name, int32 paramCount, then paramCount nested type names (recursive)
//   int32 size, u8 flags, [int32 arrayIndex if 0x01], [FGuid if 0x02], [extensions if 0x04]
// followed by `size` bytes of value.
//
// The reader produces plain objects: a property list becomes `{ name: value }`, repeated names become arrays.
// Unknown or native structs are kept as `{ $native: '<StructName>', bytes }` so parsing never stalls.

export const TAG_ARRAY_INDEX = 0x01;
export const TAG_PROPERTY_GUID = 0x02;
export const TAG_EXTENSIONS = 0x04;
export const TAG_BINARY_OR_NATIVE = 0x08;
export const TAG_BOOL_TRUE = 0x10;

const EXT_OVERRIDABLE_INFO = 0x02;

// Structs serialized natively (not as tagged property lists), with their fixed sizes in UE5 (doubles for LWC).
const NATIVE_STRUCTS = {
  Guid: 16,
  DateTime: 8,
  Timespan: 8,
  Vector: 24,
  Vector2D: 16,
  Vector4: 32,
  Rotator: 24,
  Quat: 32,
  LinearColor: 16,
  Color: 4,
  IntPoint: 8,
  IntVector: 12,
  Box: 49,
  Box2D: 33,
  FrameNumber: 4,
};

function big(v) {
  return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
}

export class Reader {
  constructor(buf, offset = 0, end = buf.length) {
    this.buf = buf;
    this.pos = offset;
    this.end = end;
  }

  ensure(n) {
    if (this.pos + n > this.end) throw new RangeError(`Read past end at ${this.pos} (+${n}, end ${this.end})`);
  }
  u8() { this.ensure(1); return this.buf[this.pos++]; }
  u16() { this.ensure(2); const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  i32() { this.ensure(4); const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  u32() { this.ensure(4); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  // 64-bit integers come back as numbers when exact, otherwise as decimal strings (e.g. persistent actor ids).
  i64() { this.ensure(8); const v = this.buf.readBigInt64LE(this.pos); this.pos += 8; return big(v); }
  u64() { this.ensure(8); const v = this.buf.readBigUInt64LE(this.pos); this.pos += 8; return big(v); }
  f32() { this.ensure(4); const v = this.buf.readFloatLE(this.pos); this.pos += 4; return v; }
  f64() { this.ensure(8); const v = this.buf.readDoubleLE(this.pos); this.pos += 8; return v; }
  bytes(n) { this.ensure(n); const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  guid() { return this.bytes(16).toString('hex'); }

  fstring() {
    const len = this.i32();
    if (len === 0) return '';
    if (len > 0) {
      if (len > 1 << 20) throw new RangeError(`Implausible string length ${len} at ${this.pos - 4}`);
      const s = this.bytes(len);
      return s.toString('latin1', 0, len - 1);
    }
    const n = -len;
    if (n > 1 << 20) throw new RangeError(`Implausible string length ${len} at ${this.pos - 4}`);
    const s = this.bytes(n * 2);
    return s.toString('utf16le', 0, (n - 1) * 2);
  }
}

export function readHeader(r) {
  const magic = r.bytes(4).toString('latin1');
  if (magic !== 'GVAS') throw new Error('Not a GVAS file');
  const saveGameVersion = r.i32();
  const ue4Version = r.i32();
  const ue5Version = saveGameVersion >= 3 ? r.i32() : 0;
  const engine = { major: r.u16(), minor: r.u16(), patch: r.u16(), changelist: r.u32(), branch: r.fstring() };
  const customFormatVersion = r.i32();
  const count = r.i32();
  const customVersions = [];
  for (let i = 0; i < count; i++) customVersions.push({ guid: r.guid(), version: r.i32() });
  const saveClass = r.fstring();
  // Save game version 3 appends a one-byte flag after the class name.
  if (saveGameVersion >= 3) r.u8();
  return { saveGameVersion, ue4Version, ue5Version, engine, customFormatVersion, customVersions, saveClass };
}

export function readTypeName(r) {
  const name = r.fstring();
  const n = r.i32();
  if (n < 0 || n > 16) throw new RangeError(`Bad type param count ${n} at ${r.pos - 4}`);
  const params = [];
  for (let i = 0; i < n; i++) params.push(readTypeName(r));
  return { name, params };
}

export function typeToString(t) {
  return t.params.length ? `${t.name}(${t.params.map(typeToString).join(',')})` : t.name;
}

export function readTag(r) {
  const name = r.fstring();
  if (name === 'None') return null;
  const type = readTypeName(r);
  const size = r.i32();
  const flags = r.u8();
  let arrayIndex = 0;
  if (flags & TAG_ARRAY_INDEX) arrayIndex = r.i32();
  if (flags & TAG_PROPERTY_GUID) r.bytes(16);
  if (flags & TAG_EXTENSIONS) {
    const ext = r.u8();
    if (ext & EXT_OVERRIDABLE_INFO) { r.u8(); r.u8(); }
  }
  return { name, type, size, flags, arrayIndex };
}

/** Reads a tagged property list until "None". */
export function readProperties(r, end = r.end) {
  const out = {};
  while (r.pos < end) {
    const tag = readTag(r);
    if (!tag) break;
    const valueEnd = r.pos + tag.size;
    let value;
    try {
      value = readValue(r, tag.type, tag.size, tag.flags);
    } catch (err) {
      if (!(err instanceof RangeError) && !(err instanceof ParseError)) throw err;
      value = { $raw: typeToString(tag.type), bytes: r.buf.subarray(valueEnd - tag.size, valueEnd) };
    }
    // Values must consume exactly `size` bytes (bools carry their value in the flags and have size 0).
    if (r.pos !== valueEnd) {
      value = { $raw: typeToString(tag.type), bytes: r.buf.subarray(valueEnd - tag.size, valueEnd), parsed: value };
      r.pos = valueEnd;
    }
    addProp(out, tag.name, value);
  }
  return out;
}

function addProp(obj, name, value) {
  if (!(name in obj)) obj[name] = value;
  else if (Array.isArray(obj[name]) && obj[name].$repeated) obj[name].push(value);
  else { const arr = [obj[name], value]; arr.$repeated = true; obj[name] = arr; }
}

export class ParseError extends Error {}

function readValue(r, type, size, flags) {
  switch (type.name) {
    case 'BoolProperty': return (flags & TAG_BOOL_TRUE) !== 0;
    case 'StructProperty': return readStruct(r, structName(type), size, (flags & TAG_BINARY_OR_NATIVE) !== 0);
    case 'ArrayProperty': return readArray(r, type.params[0], size);
    case 'SetProperty': return readSet(r, type.params[0], size);
    case 'MapProperty': return readMap(r, type.params[0], type.params[1], size);
    case 'OptionalProperty': return readOptional(r, type.params[0], size);
    default: return readScalar(r, type, size);
  }
}

function structName(type) {
  return type.params[0]?.name ?? 'Unknown';
}

function readScalar(r, type, size) {
  switch (type.name) {
    case 'IntProperty': return r.i32();
    case 'UInt32Property': return r.u32();
    case 'Int64Property': return r.i64();
    case 'UInt64Property': return r.u64();
    case 'Int16Property': { const v = r.buf.readInt16LE(r.pos); r.pos += 2; return v; }
    case 'UInt16Property': { const v = r.buf.readUInt16LE(r.pos); r.pos += 2; return v; }
    case 'Int8Property': { const v = r.buf.readInt8(r.pos); r.pos += 1; return v; }
    case 'FloatProperty': return r.f32();
    case 'DoubleProperty': return r.f64();
    case 'StrProperty':
    case 'NameProperty':
    case 'SoftClassPathProperty':
    case 'ClassProperty':
      return r.fstring();
    case 'ObjectProperty':
    case 'WeakObjectProperty':
    case 'LazyObjectProperty':
      return r.fstring();
    case 'SoftObjectProperty':
    case 'SoftClassProperty': {
      const start = r.pos;
      const v = { path: r.fstring(), sub: r.fstring() };
      if (size !== undefined && r.pos - start !== size) r.pos = start + size;
      return v;
    }
    case 'EnumProperty': return r.fstring();
    case 'ByteProperty':
      // A ByteProperty with an enum parameter stores the enum value name; plain bytes are one byte.
      if (size === 1 || (size === undefined && !type.params.length)) return r.u8();
      if (type.params.length && type.params[0].name !== 'None') return r.fstring();
      return r.u8();
    case 'TextProperty': return readText(r, size);
    default:
      if (size === undefined) throw new ParseError(`Cannot read ${type.name} without a size`);
      return { $raw: type.name, bytes: r.bytes(size) };
  }
}

function readText(r, size) {
  const start = r.pos;
  const flags = r.u32();
  const historyType = r.buf.readInt8(r.pos); r.pos += 1;
  let value = null;
  if (historyType === -1) {
    const hasCulture = r.u32();
    if (hasCulture) value = r.fstring();
  } else if (historyType === 0) {
    const namespace = r.fstring(); const key = r.fstring(); value = r.fstring();
    void namespace; void key;
  } else if (historyType === 11) {
    // StringTableEntry
    const table = r.fstring(); const key = r.fstring();
    value = `${table}:${key}`;
  } else if (size !== undefined) {
    r.pos = start + size;
    return { $text: 'unparsed' };
  } else {
    throw new ParseError(`Unsupported text history ${historyType}`);
  }
  return { $text: value, flags };
}

function readStruct(r, name, size, native) {
  if (name in NATIVE_STRUCTS) return readNativeStruct(r, name);
  if (native && size !== undefined) return { $native: name, bytes: r.bytes(size) };
  const end = size === undefined ? r.end : r.pos + size;
  const props = readProperties(r, end);
  props.$struct = name;
  return props;
}

function readNativeStruct(r, name) {
  switch (name) {
    case 'Guid': return r.guid();
    case 'DateTime': case 'Timespan': return r.i64();
    case 'Vector': return { x: r.f64(), y: r.f64(), z: r.f64() };
    case 'Rotator': return { pitch: r.f64(), yaw: r.f64(), roll: r.f64() };
    case 'Quat': return { x: r.f64(), y: r.f64(), z: r.f64(), w: r.f64() };
    case 'Vector2D': return { x: r.f64(), y: r.f64() };
    case 'LinearColor': return { r: r.f32(), g: r.f32(), b: r.f32(), a: r.f32() };
    case 'IntPoint': return { x: r.i32(), y: r.i32() };
    case 'IntVector': return { x: r.i32(), y: r.i32(), z: r.i32() };
    case 'FrameNumber': return r.i32();
    default: return { $native: name, bytes: r.bytes(NATIVE_STRUCTS[name]) };
  }
}

function elementReader(r, type) {
  if (type.name === 'StructProperty') {
    const name = structName(type);
    return () => readStruct(r, name, undefined, false);
  }
  if (type.name === 'BoolProperty') return () => r.u8() !== 0;
  if (type.name === 'ByteProperty' && (!type.params.length || type.params[0].name === 'None')) return () => r.u8();
  if (type.name === 'ByteProperty') return () => r.fstring();
  return () => readScalar(r, type, undefined);
}

function readArray(r, inner, size) {
  const end = r.pos + size;
  const count = r.i32();
  if (inner.name === 'ByteProperty' && (!inner.params.length || inner.params[0].name === 'None')) {
    return { $bytes: r.bytes(count) };
  }
  if (inner.name === 'StructProperty') {
    const name = structName(inner);
    // Native structs of unknown size: split the payload evenly.
    if (!(name in NATIVE_STRUCTS) && count > 0 && !looksTagged(r, end)) {
      const each = (end - r.pos) / count;
      const out = [];
      for (let i = 0; i < count; i++) out.push({ $native: name, bytes: r.bytes(each) });
      return out;
    }
  }
  const read = elementReader(r, inner);
  const out = new Array(count);
  for (let i = 0; i < count; i++) out[i] = read();
  return out;
}

function readOptional(r, inner, size) {
  const end = r.pos + size;
  const isSet = r.u32() !== 0;
  if (!isSet) { r.pos = end; return null; }
  if (inner.name === 'StructProperty') return readStruct(r, structName(inner), end - r.pos, false);
  return elementReader(r, inner)();
}

function readSet(r, inner, size) {
  const removed = r.i32();
  for (let i = 0; i < removed; i++) elementReader(r, inner)();
  const count = r.i32();
  const read = elementReader(r, inner);
  const out = new Array(count);
  for (let i = 0; i < count; i++) out[i] = read();
  void size;
  return out;
}

function readMap(r, keyType, valueType, size) {
  const end = r.pos + size;
  const removed = r.i32();
  const readKey = elementReader(r, keyType);
  for (let i = 0; i < removed; i++) readKey();
  const count = r.i32();
  const readVal = elementReader(r, valueType);
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const key = readKey();
    const value = readVal();
    out[i] = { key, value };
  }
  if (r.pos > end) throw new ParseError('Map overran its size');
  return { $map: true, entries: out };
}

/** Heuristic: does a tagged property name start here? */
function looksTagged(r, end) {
  if (r.pos + 4 > end) return false;
  const len = r.buf.readInt32LE(r.pos);
  if (len < 2 || len > 256 || r.pos + 4 + len > end) return false;
  const s = r.buf.subarray(r.pos + 4, r.pos + 4 + len - 1);
  return r.buf[r.pos + 3 + len] === 0 && /^[A-Za-z_][A-Za-z0-9_ ]*$/.test(s.toString('latin1'));
}

/** Parses a whole GVAS buffer into { header, properties }. */
export function parseGvas(buf) {
  const r = new Reader(buf);
  const header = readHeader(r);
  const properties = readProperties(r);
  return { header, properties };
}

/**
 * Parses a byte blob that holds a nested property stream (e.g. an actor's `ByteData`).
 * Layout: u8 0, tagged properties ending in "None", then trailing padding. Returns null if it is not one.
 */
export function tryParseNested(bytes) {
  if (bytes.length < 10 || bytes[0] !== 0) return null;
  const r = new Reader(bytes, 1);
  if (!looksTagged(r, bytes.length)) return null;
  try {
    const props = readProperties(r);
    return props;
  } catch {
    return null;
  }
}
