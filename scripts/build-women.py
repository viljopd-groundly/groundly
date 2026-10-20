# Bygger src/clubs_women.js och tools/women_ids.json från scripts/women_map.py + tools/women_raw.json.
# Kör: python3 scripts/build-women.py (kräver /tmp/.../clubs.json-dumpen, se nedan)
import json, sys, subprocess, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from women_map import T, LEAGUES
dump = json.loads(subprocess.check_output(["node", "-e",
  'process.stdout.write(JSON.stringify({clubs:require("./src/clubs.js"),geo:require("./src/geo.js"),colors:require("./src/colors.js")}))'], cwd=ROOT))
WIDS = {v[0] for v in T.values()}
C = {r[0]: r for r in dump["clubs"] if r[0] not in WIDS}; G = dump["geo"]; COL = dump["colors"]
raw = json.load(open(os.path.join(ROOT, "tools", "women_raw.json")))
EXTRA_GEO = json.load(open(os.path.join(ROOT, "scripts", "women_geo.json")))
team_league = {}; api_team = {}
for ls in raw["countries"].values():
    for L in ls:
        if L["id"] in LEAGUES:
            for t in L["teams"]: team_league[t["id"]] = L["id"]; api_team[t["id"]] = t
rows, geo, colors, ids = [], {}, {}, {}
for aid, (cid, name, parent, city, stadium, cap, col) in T.items():
    lname, country, tier, code, ac, rx = LEAGUES[team_league[aid]]
    P = C.get(parent) if parent else None
    nm = name or (P[1] + " (dam)")
    f = api_team[aid].get("founded")
    founded = f if isinstance(f, int) and f > 1850 else None
    hay = " ".join(x for x in [nm.lower(), (P[1].lower() if P else ""), "dam damlag women", city.lower()] if x)
    rows.append([cid, nm, hay, country, city, founded, lname, tier, stadium, cap, None, [], 1])
    if city not in G: geo[city] = EXTRA_GEO[city]
    if col: colors[cid] = col
    elif P and COL.get(parent): colors[cid] = COL[parent]
    ids[aid] = cid
out = "// Damlag i högsta och näst högsta serien (Norden + England, Spanien, Tyskland, Italien, Frankrike).\n"
out += "// Genereras av scripts/build-women.py från scripts/women_map.py och tools/women_raw.json (API-Football, okt 2026).\n"
out += "module.exports=" + json.dumps(rows, ensure_ascii=False) + ";\n"
out += "module.exports.geo=" + json.dumps(geo, ensure_ascii=False) + ";\n"
out += "module.exports.colors=" + json.dumps(colors, ensure_ascii=False) + ";\n"
out += "module.exports.leagues=" + json.dumps([v[0] for v in LEAGUES.values()], ensure_ascii=False) + ";\n"
open(os.path.join(ROOT, "src", "clubs_women.js"), "w").write(out)
json.dump({"teams": {str(k): v for k, v in ids.items()},
           "leagues": [[v[0], v[1], v[4], v[2], v[3], v[5]] for v in LEAGUES.values()]},
          open(os.path.join(ROOT, "tools", "women_ids.json"), "w"), ensure_ascii=False)
print(len(rows), "damlag,", len(geo), "nya orter,", len(colors), "färger")
