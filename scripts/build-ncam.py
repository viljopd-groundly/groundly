# Bygger src/clubs_ncam.js och src/geo_ncam.js: Nord- och Centralamerikas högstaligor som är fullständiga i API-Football
# (pågående säsong med tabell och matchhändelser, oktober 2026): Kanada (CPL), Costa Rica, Honduras, El Salvador, Panama,
# Nicaragua, Jamaica och Trinidad och Tobago. Guatemala, Dominikanska republiken, Barbados m.fl. är ofullständiga och inte med.
# Indata: tools/teams_world6.json. Kör: python3 scripts/build-ncam.py
import json, os, re, unicodedata, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(os.path.join(ROOT, "tools", "teams_world6.json"), encoding="utf8"))

LEAGUES = {
 ("Canada", "Canadian Premier League"): ("Kanada", "Canadian Premier League", "ca"),
 ("Costa-Rica", "Primera División"): ("Costa Rica", "Primera División (Costa Rica)", "cr"),
 ("Honduras", "Liga Nacional"): ("Honduras", "Liga Nacional (Honduras)", "hn"),
 ("El-Salvador", "Primera Division"): ("El Salvador", "Primera División (El Salvador)", "sv"),
 ("Panama", "Liga Panameña de Fútbol"): ("Panama", "Liga Panameña de Fútbol", "pa"),
 ("Nicaragua", "Primera Division"): ("Nicaragua", "Primera División (Nicaragua)", "ni"),
 ("Jamaica", "Premier League"): ("Jamaica", "Jamaica Premier League", "jm"),
 ("Trinidad-And-Tobago", "Pro League"): ("Trinidad och Tobago", "TT Premier League", "tt"),
}
CITYMAP = {"La Paz": "La Paz (Honduras)", "Calgary, Alberta": "Calgary", "Halifax, Nova Scotia": "Halifax (Kanada)", "Victoria, British Columbia": "Victoria (Kanada)", "Toronto, Ontario": "Toronto",
 "Ottawa, Ontario": "Ottawa", "Langley, British Columbia": "Langley", "San Juan de Tíbás (San José)": "San José", "San Isidro de El General": "Pérez Zeledón",
 "San Antonio de Belén": "Belén", "Ciudad de Panamá": "Panama City", "Chitre": "Chitré", "Saint Ann&apos;s Bay": "Saint Ann's Bay",
 "Couva, San Fernando": "Couva", "Marabella, San Fernando": "San Fernando", "Malabar, Arima": "Arima"}
FIX = {
 27461: ["Supra du Québec", "Laval (Kanada)"], 28005: ["Atlético Independiente", "Siguatepeque"], 28541: ["Estrella Roja", "Tegucigalpa"],
 26154: ["Inter FA", "San Salvador"], 28018: ["Atlético Balboa", "La Unión"], 28019: ["Inca", "San Salvador"],
 15620: ["Veraguas United", "Santiago de Veraguas"], 20788: ["UMECIT", "Panama City"], 27364: ["Unión Coclé", "Penonomé"],
 28416: ["Tru-Juice", "Kingston"], 20974: ["Prison Service", "Port of Spain"], 25276: ["Phoenix", "Port of Spain"], 12560: ["Athletic Club", "Arima"],
 2047: ["Sporting FC", "San José"], 819: ["Pérez Zeledón", "Pérez Zeledón"], 2885: ["Tauro FC", "Panama City"], 2882: ["CD Árabe Unido", "Colón"],
 1058: ["Real España", "San Pedro Sula"], 1059: ["Lobos UPNFM", "Choluteca"], 4304: ["Isidro Metapán", "Metapán"],
}
LAND = {}
GEO = {
 "Calgary": [51.05, -114.07], "Halifax (Kanada)": [44.65, -63.58], "Victoria (Kanada)": [48.43, -123.37], "Toronto": [43.65, -79.38], "Hamilton": [43.26, -79.87],
 "Ottawa": [45.42, -75.70], "Langley": [49.10, -122.66], "Laval (Kanada)": [45.61, -73.71],
 "Heredia": [10.00, -84.12], "San José": [9.93, -84.08], "Pérez Zeledón": [9.37, -83.70], "Cartago": [9.86, -83.92], "Alajuela": [10.02, -84.21], "Ciudad Quesada": [10.32, -84.43],
 "Puntarenas": [9.98, -84.84], "Belén": [9.98, -84.18], "Pital": [10.45, -84.27],
 "San Pedro Sula": [15.50, -88.03], "Tegucigalpa": [14.07, -87.19], "Juticalpa": [14.66, -86.22], "Puerto Cortés": [15.85, -87.94], "Choluteca": [13.30, -87.19],
 "Choloma": [15.61, -87.95], "La Paz (Honduras)": [14.32, -87.68], "Siguatepeque": [14.60, -87.83],
 "San Salvador": [13.69, -89.22], "Santa Ana": [13.99, -89.56], "Usulután": [13.35, -88.44], "Metapán": [14.33, -89.45], "Santa Rosa de Lima": [13.62, -87.89],
 "San Miguel": [13.48, -88.18], "Zacatecoluca": [13.51, -88.87], "San Francisco Gotera": [13.70, -88.10], "Chapeltique": [13.64, -88.26], "La Unión": [13.34, -87.84],
 "Panama City": [8.98, -79.52], "Colón": [9.36, -79.90], "La Chorrera": [8.88, -79.78], "San Miguelito": [9.03, -79.50], "Chitré": [7.96, -80.43],
 "Santiago de Veraguas": [8.10, -80.98], "Penonomé": [8.52, -80.36],
 "Diriamba": [11.86, -86.24], "Managua": [12.11, -86.24], "Estelí": [13.09, -86.35], "Jalapa": [13.92, -86.12], "Matagalpa": [12.93, -85.92], "El Limón Dos": [11.40, -85.98], "San Marcos": [11.91, -86.20],
 "Kingston": [17.97, -76.79], "Saint Ann's Bay": [18.43, -77.20], "May Pen": [17.97, -77.24], "Montego Bay": [18.47, -77.92], "Treasure Beach": [17.89, -77.76],
 "Couva": [10.42, -61.41], "San Fernando": [10.28, -61.46], "Arima": [10.64, -61.28], "Port of Spain": [10.65, -61.51], "Point Fortin": [10.18, -61.68],
}

def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|fk|sc|ac|afc|club|de|du|des|la|le|the|united|city|town|sport|sports)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)[:12] or "x"
def ascii_low(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())).strip()

have_geo = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./src/geo.js')))"], cwd=ROOT, capture_output=True, text=True).stdout)
existing_ids = set(json.loads(subprocess.run(["node", "-e", "let own=new Set();try{own=new Set(require('./src/clubs_ncam.js').map(c=>c[0]))}catch(e){};console.log(JSON.stringify(require('./src/clubs.js').map(c=>c[0]).filter(id=>!own.has(id))))"], cwd=ROOT, capture_output=True, text=True).stdout))

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

out = ["// Nord- och Centralamerikas högstaligor som är fullständiga i API-Football 2026 (se scripts/build-ncam.py). Samma format som clubs.js.", "module.exports=["]
last = None
for r in rows:
    if r[6] != last: out.append(f"// ---- {r[3]}, {r[6]}"); last = r[6]
    out.append(json.dumps(r, ensure_ascii=False) + ",")
out.append("];")
open(os.path.join(ROOT, "src", "clubs_ncam.js"), "w", encoding="utf8").write("\n".join(out) + "\n")
used_cities = {r[4] for r in rows}
open(os.path.join(ROOT, "src", "geo_ncam.js"), "w", encoding="utf8").write("// koordinater för städerna i clubs_ncam.js\nmodule.exports=" + json.dumps({k: v for k, v in GEO.items() if k in used_cities}, ensure_ascii=False) + ";\n")
p = os.path.join(ROOT, "tools", "extra_ids.json"); E = json.load(open(p, encoding="utf8")); E["teams"].update(extra)
open(p, "w", encoding="utf8").write(json.dumps(E, ensure_ascii=False))
print(len(rows), "nya klubbar,", len(extra), "lag-id kopplade")
