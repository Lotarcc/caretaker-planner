"""Cheapest-recipe planner for every human the run needs (research tool).

Builds one integer program over all planned humans that shares the memory
supply and already-owned food, then minimises crafting cost.

    pip install pulp==2.9.0
    python3 docs/research/human_plan.py [--no-inventory] [--json out.json]

Rules (see 2026-10-17-human-plan.md for sources):
- effective(raw) = raw            if raw <= 200
                 = 200 + round((raw - 200) ** 0.6) otherwise
- "Greater" is treated as strict: effective >= requirement + 1.
- Baselines Weight 20 / Height 30 / Life_Expectancy 10 apply as
  max(requirement, baseline), matching the community calculator.
- Pod capacity: sum(item_weight * qty) <= 100.
- A recipe may also match lower tiers of the target's own category (they
  always do, and the higher tier wins), but every other profession must
  fail at least one of its requirements, as in the community calculator.
- Exclusions keep a profession strictly below a threshold, so recipes
  hold whether the game compares with > or >=.
- Where our data and the community CSV disagree, the target uses the
  higher requirement and the exclusion uses the lower one.
"""
import argparse
import json
from pathlib import Path

import pulp

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "source"
HERE = Path(__file__).resolve().parent

PHYS = ["Strength", "Height", "Weight", "Intellect", "Life_Expectancy"]
MENT = ["Logic", "Focus", "Discipline", "Creativity", "Communication",
        "Empathy", "Leadership", "Wisdom", "Patience", "Adaptability"]
STATS = PHYS + MENT
BASELINE = {"Weight": 20, "Height": 30, "Life_Expectancy": 10}
POD_CAPACITY = 100.0

# Crafting cost per nutrient unit, by how hard the source is to farm.
NUTRIENT_COST = {
    "Protein": 1, "Fat": 1, "Carbohydrate": 1,              # seaweed / basic
    "Calcium": 3, "VitaminD": 3, "Omega3": 3,               # slime / crawlers
    "Bioregulator": 15, "Nanite_Nutrient": 15, "Mitochondrial_Amplifier": 15,  # Bio Flesh
}
# Cost of consuming one memory, and of a memory that must still be found.
MEMORY_COST = 1.0
MEMORY_COST_RARE = {"Ash Notebook": 5.0, "Oath Token": 5.0, "Porcine Vocal Interface": 3.0}
MISSING_MEMORY_COST = 40.0

# Community calculator (NCFFCN/The_Last_Caretaker_Human_Calculator, Data/Human.csv)
# values that differ from data/source/HumanType.json.
COMMUNITY_OVERRIDES = {
    "Quantum Engineer": {"Strength": 181, "Discipline": 61},
    "Teacher": {"Patience": 15},
    "Existential Chancellor": {"Weight": 48},
    "Logistics High Command": {"Discipline": 82},
    "Quantum Physicist": {"Intellect": 221},
}

COMMITTEES = {
    "Deck Operations": ["Maintenance Engineer", "Basic Supplier", "Nutrient Handler", "Door Jammer"],
    "Habitat Care": ["Room Supervisor", "Health Assistant", "Teacher", "Lab Technician"],
    "Transit & Distribution": ["Systems Engineer", "Distributor", "Growth Specialist", "Guard"],
    "Power & Security": ["Energy Engineer", "Resource Director", "Station Quartermaster", "Station Protector"],
    "Cognitive Resilience": ["Theoretical Scientist", "Neuro Specialist", "Professor", "Star Analyzer"],
    "Culture & Memory": ["Visual Technician", "Sculptor", "Cultural Archivist", "Manual Holder"],
    "Governance & Logistics": ["Settlement Governor", "Logistics High Command", "Biosphere Director", "Guardian of Humanity"],
    "Deep Systems": ["Quantum Engineer", "Quantum Physicist", "Neural Architect", "Sustenance Architect"],
    "Meaning & Frontier": ["Existential Expressionist", "Frontier Explorer", "Mission Seeker", "Colonel of Humanity"],
    "Field Continuance": ["Field Research Scientist", "Existential Chancellor", "Station Roamer", "Doctor"],
}


# Raw points above 200 needed for each effective point above 200
# (community calculator's RAW_TO_EFF table; near round(n ** 0.6)).
RAW_ABOVE_CAP = {1: 1, 2: 2, 3: 5, 4: 9, 5: 13, 6: 19, 7: 23, 8: 29, 9: 36, 10: 43,
                 11: 51, 12: 59, 13: 68, 14: 77, 15: 87, 16: 97, 17: 107, 18: 118,
                 19: 130, 20: 142, 21: 154, 22: 167, 23: 180, 24: 193, 25: 206}


def min_raw_for_effective(e):
    """Smallest raw value whose effective value is >= e."""
    if e <= 200:
        return max(0, e)
    y = e - 200
    if y in RAW_ABOVE_CAP:
        return 200 + RAW_ABOVE_CAP[y]
    n = 206
    while round(n ** 0.6) < y:
        n += 1
    return 200 + n


def max_raw_at_most(e):
    """Largest raw value whose effective value is <= e."""
    return min_raw_for_effective(e + 1) - 1


def load():
    foods = json.load(open(SRC / "Food.json"))
    mems = json.load(open(SRC / "Memory.json"))
    profs = json.load(open(SRC / "HumanType.json"))

    items = []
    for f in foods:
        cost = sum(NUTRIENT_COST[n] * (f.get(n) or 0) for n in NUTRIENT_COST)
        items.append({"name": f["name"], "kind": "food", "weight": f["item_weight"],
                      "stats": {k: f.get(k) or 0 for k in PHYS}, "cost": cost,
                      "nutrients": {n: f.get(n) or 0 for n in NUTRIENT_COST if f.get(n)},
                      "aliases": [a.strip() for a in (f.get("internal_name") or "").split(",") if a.strip()]})
    for m in mems:
        stats = {k: m.get(k) or 0 for k in MENT}
        if not any(stats.values()):
            continue
        items.append({"name": m["name"], "kind": "memory", "weight": m["item_weight"],
                      "stats": stats, "cost": MEMORY_COST_RARE.get(m["name"], MEMORY_COST),
                      "aliases": [a.strip() for a in (m.get("internal_name") or "").split(",") if a.strip()]})

    reqs = {}
    for p in profs:
        name = p["profession"]
        r = {k: p.get(k) or 0 for k in STATS if (p.get(k) or 0) > 0}
        for k, b in BASELINE.items():
            r[k] = max(r.get(k, 0), b)
        hi, lo = dict(r), dict(r)
        for k, v in COMMUNITY_OVERRIDES.get(name, {}).items():
            v = max(v, BASELINE.get(k, 0))
            hi[k], lo[k] = max(r[k], v), min(r[k], v)
        reqs[name] = {"tier": int(p["tier"]), "category": p["category"], "target": hi, "exclude": lo}
    return items, reqs


NUTRIENT_ITEM = {
    "Protein": "DA_Material_Food_Protein", "Fat": "DA_Material_Food_Fat",
    "Carbohydrate": "DA_Material_Food_Carbohydrate", "Calcium": "DA_Material_Food_Calcium",
    "VitaminD": "DA_Material_Food_Vitamind", "Omega3": "DA_Material_Food_Omega-3",
    "Bioregulator": "DA_Material_Food_Bioregulator", "Nanite_Nutrient": "DA_Material_Food_Nanite_Nutrient",
    "Mitochondrial_Amplifier": "DA_Material_Food_MitochondrialAmplifier",
}


def load_supply(items, path):
    """Item supply by name, plus nutrient stock under "nutrient:<name>"."""
    raw = json.load(open(path))["items"]
    supply = {}
    for it in items:
        supply[it["name"]] = sum(raw.get(a, 0) for a in it["aliases"])
    for n, asset in NUTRIENT_ITEM.items():
        supply["nutrient:" + n] = raw.get(asset, 0)
    return supply


def solve(humans, items, reqs, supply, time_limit=600):
    prob = pulp.LpProblem("humans", pulp.LpMinimize)
    big_m = {k: POD_CAPACITY * max(it["stats"].get(k, 0) / it["weight"] for it in items) for k in STATS}
    x = {}
    for h, (label, target) in enumerate(humans):
        for i, it in enumerate(items):
            x[h, i] = pulp.LpVariable(f"x_{h}_{i}", lowBound=0, cat=pulp.LpInteger)
        tot = {k: pulp.lpSum(x[h, i] * it["stats"].get(k, 0) for i, it in enumerate(items)) for k in STATS}
        prob += pulp.lpSum(x[h, i] * it["weight"] for i, it in enumerate(items)) <= POD_CAPACITY
        for k, v in reqs[target]["target"].items():
            prob += tot[k] >= min_raw_for_effective(v + 1)
        for other, r in reqs.items():
            if other == target or (r["category"] == reqs[target]["category"] and r["tier"] < reqs[target]["tier"]):
                continue
            ys = []
            for k, v in r["exclude"].items():
                cap = max_raw_at_most(v - 1)  # strictly below, safe under > or >=
                y = pulp.LpVariable(f"y_{h}_{other.replace(' ', '_')}_{k}", cat=pulp.LpBinary)
                prob += tot[k] <= cap + big_m[k] * (1 - y)
                ys.append(y)
            prob += pulp.lpSum(ys) >= 1

    crafted, missing, short, cost_terms = {}, {}, {}, []
    stock = {n: supply.get("nutrient:" + n, 0) for n in NUTRIENT_COST} if supply is not None else None
    for i, it in enumerate(items):
        used = pulp.lpSum(x[h, i] for h in range(len(humans)))
        have = supply.get(it["name"], 0) if supply is not None else None
        if it["kind"] == "food":
            crafted[i] = pulp.LpVariable(f"craft_{i}", lowBound=0, cat=pulp.LpInteger)
            prob += crafted[i] >= used - (have or 0)
            if stock is None:
                cost_terms.append(it["cost"] * crafted[i])
            cost_terms.append(0.01 * used)  # prefer fewer items when free
        else:
            cost_terms.append(it["cost"] * used)
            if have is not None:
                missing[i] = pulp.LpVariable(f"miss_{i}", lowBound=0, cat=pulp.LpInteger)
                prob += used <= have + missing[i]
                cost_terms.append(MISSING_MEMORY_COST * missing[i])
    if stock is not None:
        # Nutrients already in stock are nearly free; only the shortfall costs full price.
        for n, w in NUTRIENT_COST.items():
            need = pulp.lpSum(crafted[i] * items[i]["nutrients"].get(n, 0) for i in crafted)
            short[n] = pulp.LpVariable(f"short_{n}", lowBound=0)
            prob += short[n] >= need - stock[n]
            cost_terms.append(w * short[n])
            cost_terms.append(0.05 * w * need)
    prob += pulp.lpSum(cost_terms)
    prob.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=time_limit, gapRel=0.0))
    status = pulp.LpStatus[prob.status]

    plans = []
    for h, (label, target) in enumerate(humans):
        q = {items[i]["name"]: int(round(x[h, i].value())) for i in range(len(items)) if (x[h, i].value() or 0) > 0.5}
        stats = {k: sum(q.get(it["name"], 0) * it["stats"].get(k, 0) for it in items) for k in STATS}
        plans.append({"label": label, "profession": target, "tier": reqs[target]["tier"],
                      "items": q, "stats": stats,
                      "pod_kg": round(sum(q.get(it["name"], 0) * it["weight"] for it in items), 2)})
    totals = {
        "status": status,
        "objective": pulp.value(prob.objective),
        "food_used": {items[i]["name"]: int(round(sum(x[h, i].value() for h in range(len(humans)))))
                      for i, it in enumerate(items) if it["kind"] == "food"},
        "food_to_craft": {items[i]["name"]: int(round(v.value())) for i, v in crafted.items() if v.value() > 0.5},
        "memories_used": {items[i]["name"]: int(round(sum(x[h, i].value() for h in range(len(humans)))))
                          for i, it in enumerate(items) if it["kind"] == "memory"},
        "memories_to_find": {items[i]["name"]: int(round(v.value())) for i, v in missing.items() if v.value() > 0.5},
    }
    totals["food_used"] = {k: v for k, v in totals["food_used"].items() if v}
    totals["memories_used"] = {k: v for k, v in totals["memories_used"].items() if v}
    nutrients = {}
    food_by_name = {it["name"]: it for it in items if it["kind"] == "food"}
    for name, n in totals["food_to_craft"].items():
        for nut, v in food_by_name[name]["nutrients"].items():
            nutrients[nut] = nutrients.get(nut, 0) + v * n
    totals["nutrients_to_craft"] = nutrients
    if stock is not None:
        totals["nutrient_stock"] = stock
        totals["nutrients_to_gather"] = {n: max(0, nutrients.get(n, 0) - stock[n])
                                         for n in NUTRIENT_COST if nutrients.get(n, 0) > stock[n]}
    return plans, totals


def effective(raw):
    if raw <= 200:
        return raw
    n = raw - 200
    return 200 + max([y for y, need in RAW_ABOVE_CAP.items() if n >= need] or [0]) if n < 206 else 200 + round(n ** 0.6)


def check(plan, reqs):
    """Re-verify a recipe: target met strictly under the high values, and no
    disallowed profession met even non-strictly under the low values."""
    target = plan["profession"]
    eff = {k: effective(v) for k, v in plan["stats"].items()}
    ok = all(eff[k] > v for k, v in reqs[target]["target"].items())
    t = reqs[target]
    clashes = [p for p, r in reqs.items()
               if p != target and not (r["category"] == t["category"] and r["tier"] < t["tier"])
               and all(eff[k] >= v for k, v in r["exclude"].items())]
    return ok, clashes


def recipe_cost(plan, items):
    """Nutrient cost if every food in the recipe had to be crafted."""
    by = {it["name"]: it for it in items}
    return sum(by[n]["cost"] * q for n, q in plan["items"].items() if by[n]["kind"] == "food")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-inventory", action="store_true", help="ignore the save; craft all food, unlimited memories")
    ap.add_argument("--inventory", default=str(HERE / "inventory-beta-update6.json"))
    ap.add_argument("--omega", default=None, help="profession for the Platform Omega human (default: cheapest)")
    ap.add_argument("--json", default=None)
    ap.add_argument("--time-limit", type=int, default=600)
    a = ap.parse_args()

    items, reqs = load()
    supply = None if a.no_inventory else load_supply(items, a.inventory)

    # Standalone cost of every profession (all food crafted, unlimited memories).
    standalone = {}
    for p in reqs:
        plans, _ = solve([(p, p)], items, reqs, None, a.time_limit)
        standalone[p] = recipe_cost(plans[0], items)
    omega = a.omega or min(standalone, key=standalone.get)

    humans = [(f"{c}: {p}", p) for c, ps in COMMITTEES.items() for p in ps]
    humans.append(("Platform Omega (Project Jonah)", omega))
    plans, totals = solve(humans, items, reqs, supply, a.time_limit)
    for pl in plans:
        pl["craft_cost_if_all_crafted"] = recipe_cost(pl, items)

    out = {"standalone_cost": standalone, "omega_profession": omega, "plans": plans, "totals": totals}
    if a.json:
        json.dump(out, open(a.json, "w"), indent=1)
    print("status", totals["status"], "objective", round(totals["objective"], 2))
    for pl in plans:
        print(f"{pl['label']:55s} cost {pl['craft_cost_if_all_crafted']:6.0f}  {pl['pod_kg']:5.1f}kg  {pl['items']}")
    for k in ("food_used", "food_to_craft", "nutrients_to_craft", "nutrient_stock", "nutrients_to_gather",
              "memories_used", "memories_to_find"):
        print(k, totals.get(k))


if __name__ == "__main__":
    main()
