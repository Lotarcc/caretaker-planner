import fs from 'fs'; import {decompressUnsafe} from 'ooz-wasm'; import zlib from 'zlib';
const d=fs.readFileSync(process.argv[2]); const dv=new DataView(d.buffer,d.byteOffset); let p=0; const parts=[]; let t=Date.now();
while(p<d.length){ const bs=Number(dv.getBigUint64(p+8,true)); const c=d[p+16]; const us=Number(dv.getBigUint64(p+25,true)); p+=33;
 const nb=Math.ceil(us/bs); const bl=[]; for(let i=0;i<nb;i++){bl.push([Number(dv.getBigUint64(p,true)),Number(dv.getBigUint64(p+8,true))]);p+=16}
 for(const [bc,bu] of bl){const blk=d.subarray(p,p+bc);p+=bc; parts.push(c===3?zlib.inflateSync(blk):c===2?Buffer.from(decompressUnsafe(blk,bu)):(()=>{throw Error('comp '+c)})())}}
const out=Buffer.concat(parts); fs.writeFileSync(process.argv[3],out); console.log('ok',out.length,'ms',Date.now()-t, out.subarray(0,8).toString('latin1'));
