# Bygger src/clubs_sam.js och src/geo_sam.js: Sydamerikas högstaligor som saknades (Peru, Ecuador, Paraguay, Bolivia, Venezuela).
# Alla fem är fullständiga i API-Football (pågående säsong med tabell och matchhändelser, oktober 2026).
# Paraguay spelar Apertura och Clausura som två serier i API:et; klubbarna tas från Clausura.
# Indata: tools/teams_world8.json. Kör: python3 scripts/build-sam.py
import json, os, re, unicodedata, subprocess, math
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(os.path.join(ROOT, "tools", "teams_world8.json"), encoding="utf8"))

LEAGUES = {
 ("Peru", "Primera División"): ("Peru", "Liga 1 (Peru)", "pe"),
 ("Ecuador", "Liga Pro"): ("Ecuador", "LigaPro (Ecuador)", "ec"),
 ("Paraguay", "Division Profesional - Clausura"): ("Paraguay", "Primera División (Paraguay)", "py"),
 ("Bolivia", "Primera División"): ("Bolivia", "División Profesional (Bolivia)", "bo"),
 ("Venezuela", "Primera División"): ("Venezuela", "Liga FUTVE", "ve"),
}
CITYMAP = {"Cuenca": "Cuenca (Ecuador)", "Valencia": "Valencia (Venezuela)", "Mérida": "Mérida (Venezuela)", "Acarigua-Araure": "Acarigua", "San Lorenzo": "San Lorenzo (Paraguay)"}
FIX = {
 2560: ["Alianza Atlético", "Sullana"], 2564: ["Atlético Grau", "Sullana"], 2572: ["Los Chankas", "Andahuaylas"], 10013: ["Cusco FC", "Cusco"],
 10492: ["ADT", "Tarma", None], 20960: ["Deportivo Garcilaso", "Cusco"], 22479: ["Juan Pablo II College", "Chongoyape"], 2554: ["Melgar", "Arequipa"],
 1149: ["Delfín", "Manta"], 1151: ["Técnico Universitario", "Ambato"], 1155: ["Macará", "Ambato"], 1157: ["Universidad Católica (Ecuador)", "Quito"],
 1158: ["LDU Quito", "Quito"], 1159: ["Guayaquil City", "Guayaquil"], 1162: ["Mushuc Runa", "Ambato"], 1980: ["Manta FC", "Manta"], 1992: ["Orense", "Machala"],
 18762: ["Libertad FC (Loja)", "Loja"], 19034: ["Leones del Norte", "Ibarra"], 1148: ["Emelec", "Guayaquil"], 1152: ["Barcelona SC", "Guayaquil"],
 1174: ["Guaraní", "Asunción"], 1175: ["Nacional (Paraguay)", "Asunción"], 1176: ["Cerro Porteño", "Asunción"], 1179: ["Libertad", "Asunción"],
 1183: ["Sportivo Luqueño", "Luque"], 1185: ["Rubio Ñu", "Asunción"], 1187: ["Sportivo Trinidense", "Asunción"], 2125: ["Sportivo San Lorenzo", "San Lorenzo (Paraguay)"],
 2140: ["2 de Mayo", "Pedro Juan Caballero"], 10476: ["Deportivo Recoleta", "Asunción"],
 17743: ["Academia del Balompié Boliviano", "La Paz"], 17760: ["San Antonio Bulo Bulo", "Bulo Bulo"], 17762: ["Universitario de Vinto", "Vinto"],
 20252: ["Real Oruro", "Oruro"], 22266: ["Gualberto Villarroel San José", "Oruro"],
 2807: ["Deportivo Táchira", "San Cristóbal (Venezuela)"], 2811: ["Monagas SC", "Maturín"], 2813: ["Deportivo La Guaira", "Caracas"], 2815: ["Trujillanos", "Valera"],
 2818: ["Estudiantes de Mérida", "Mérida (Venezuela)"], 2825: ["Metropolitanos", "Caracas"], 2827: ["Academia Puerto Cabello", "Puerto Cabello"],
 16847: ["Rayo Zuliano", "Maracaibo"], 18806: ["Anzoátegui FC", "Puerto La Cruz"], 2814: ["Portuguesa", "Acarigua"], 2808: ["Caracas FC", "Caracas"], 2810: ["Carabobo", "Valencia (Venezuela)"],
}
LAND = {}
GEO = {
 "Cajamarca": [-7.16, -78.51], "Callao": [-12.06, -77.12], "Arequipa": [-16.41, -71.54], "Huancayo": [-12.07, -75.21], "Cutervo": [-6.38, -78.82], "Sullana": [-4.90, -80.69],
 "Cusco": [-13.53, -71.97], "Andahuaylas": [-13.66, -73.39], "Tarma": [-11.42, -75.69], "Chongoyape": [-6.64, -79.39], "Moquegua": [-17.19, -70.94],
 "Guayaquil": [-2.19, -79.89], "Manta": [-0.95, -80.73], "Ambato": [-1.25, -78.62], "Cuenca (Ecuador)": [-2.90, -79.00], "Machala": [-3.26, -79.96], "Loja": [-3.99, -79.20], "Ibarra": [0.35, -78.12],
 "Luque": [-25.27, -57.49], "San Lorenzo (Paraguay)": [-25.34, -57.51], "Pedro Juan Caballero": [-22.55, -55.73],
 "Cochabamba": [-17.39, -66.16], "El Alto": [-16.50, -68.19], "Santa Cruz de la Sierra": [-17.78, -63.18], "Montero": [-17.34, -63.25], "Potosí": [-19.58, -65.75],
 "Sucre": [-19.04, -65.26], "Tarija": [-21.53, -64.73], "Bulo Bulo": [-17.26, -64.37], "Vinto": [-17.40, -66.31], "Oruro": [-17.97, -67.11],
 "Barinas": [8.62, -70.21], "San Cristóbal (Venezuela)": [7.77, -72.22], "Valencia (Venezuela)": [10.16, -68.00], "Maturín": [9.75, -63.18], "Acarigua": [9.56, -69.20],
 "Valera": [9.32, -70.60], "Mérida (Venezuela)": [8.59, -71.14], "Puerto Cabello": [10.47, -68.01], "Maracaibo": [10.65, -71.64], "Puerto La Cruz": [10.21, -64.63],
}

def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|fk|sc|ac|afc|club|de|du|des|la|le|the|united|city|town|sport|sports)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)[:12] or "x"
def ascii_low(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())).strip()

have_geo = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./src/geo.js')))"], cwd=ROOT, capture_output=True, text=True).stdout)
existing_ids = set(json.loads(subprocess.run(["node", "-e", "let own=new Set();try{own=new Set(require('./src/clubs_sam.js').map(c=>c[0]))}catch(e){};console.log(JSON.stringify(require('./src/clubs.js').map(c=>c[0]).filter(id=>!own.has(id))))"], cwd=ROOT, capture_output=True, text=True).stdout))

own_geo = {}
try: own_geo = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./src/geo_sam.js')))"], cwd=ROOT, capture_output=True, text=True).stdout)
except Exception: pass
clash = [k for k, v in GEO.items() if k in have_geo and k not in own_geo and math.dist(v, have_geo[k]) > 0.5]
if clash: raise SystemExit("samma stadsnamn finns redan på annan plats: " + ", ".join(clash))
rows, extra, used, nogeo = [], {}, set(), set()
for c in W["countries"]:
    for L in c.get("leagues", []):
        land0, lname, cc = LEAGUES[(c["country"], L["name"])]
        for t in L["teams"]:
            v = t.get("venue") or {}
            fx = FIX.get(t["id"])
            name = fx[0] if fx else t["name"]
            raw = (v.get("city") or "").replace("&apos;", "'")
            city = fx[1] if fx else CITYMAP.get(v.get("city"), CITYMAP.get(raw, raw))
            arena = (v.get("name") or "").replace("&apos;", "'") or None
            if fx and len(fx) > 2: arena = fx[2]
            elif fx and not v.get("name"): arena = None
            cap = v.get("capacity") if arena else None
            founded = t.get("founded") or None
            land = LAND.get(t["id"], land0)
            cid = cc + "-" + slug(name)
            while cid in used or cid in existing_ids: cid += "x"
            used.add(cid); extra[str(t["id"])] = cid
            alias = " ".join(dict.fromkeys(x for x in [ascii_low(name), ascii_low(t["name"])] if x))
            rows.append([cid, name, alias, land, city, founded, lname, 1, arena, cap, "", [], 1])
            if not city or (city not in GEO and city not in have_geo): nogeo.add(f"{city} ({name})")
if nogeo: raise SystemExit("koordinater saknas: " + ", ".join(sorted(nogeo)))

out = ["// Sydamerikas högstaligor som saknades, fullständiga i API-Football 2026 (se scripts/build-sam.py). Samma format som clubs.js.", "module.exports=["]
last = None
for r in rows:
    if r[6] != last: out.append(f"// ---- {r[3]}, {r[6]}"); last = r[6]
    out.append(json.dumps(r, ensure_ascii=False) + ",")
out.append("];")
open(os.path.join(ROOT, "src", "clubs_sam.js"), "w", encoding="utf8").write("\n".join(out) + "\n")
used_cities = {r[4] for r in rows}
open(os.path.join(ROOT, "src", "geo_sam.js"), "w", encoding="utf8").write("// koordinater för städerna i clubs_sam.js\nmodule.exports=" + json.dumps({k: v for k, v in GEO.items() if k in used_cities}, ensure_ascii=False) + ";\n")
p = os.path.join(ROOT, "tools", "extra_ids.json"); E = json.load(open(p, encoding="utf8")); E["teams"].update(extra)
open(p, "w", encoding="utf8").write(json.dumps(E, ensure_ascii=False))
print(len(rows), "nya klubbar,", len(extra), "lag-id kopplade")
