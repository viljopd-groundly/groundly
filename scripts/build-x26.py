# Bygger src/clubs_x26.js: andraligor (Turkiet, Österrike, Schweiz, Tjeckien, Grekland), England nivå 7,
# Danmark 2. division, Spanien Segunda Federación, Italien Serie D och damserierna NWSL och Vrouwen Eredivisie.
# Indata: tools/teams_world.json och tools/teams_world9.json (workflowen "Hämta lag", nov 2026).
# Namn, arena, kapacitet, grundår, stad och koordinater kommer från API-Football och OpenStreetMap.
# Kör: python3 scripts/build-x26.py  (skriver även lag-id till tools/extra_ids.json och tools/women_ids.json
# och serierna till tools/x26_leagues.json, som nattkörningen läser)
import json, os, re, unicodedata, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = lambda f: os.path.join(ROOT, "tools", f)
W = []
for f in ["teams_world.json", "teams_world9.json", "teams_world10.json", "teams_world11.json", "teams_world12.json", "teams_world13.json", "teams_world14.json"]:
    if os.path.exists(T(f)): W += json.load(open(T(f), encoding="utf8"))["countries"]

# (API-land, API-serie) -> (vårt land, vårt serienamn, nivå, id-prefix, kod, regex, dam)
LEAGUES = {
 ("Turkey", "1. Lig"): ("Turkiet", "1. Lig", 2, "tr2", "tr.2", r"^1\. lig$", False),
 ("Austria", "2. Liga"): ("Österrike", "2. Liga (Österrike)", 2, "at2", "at.2", r"^2\. liga$", False),
 ("Switzerland", "Challenge League"): ("Schweiz", "Challenge League", 2, "ch2", "ch.2", r"^challenge league$", False),
 ("Czech-Republic", "FNL"): ("Tjeckien", "Chance Národní liga", 2, "cz2", "cz.2", r"^fnl$", False),
 ("Greece", "Super League 2"): ("Grekland", "Super League 2", 2, "gr2", "gr.2", r"^super league 2$", False),
 ("England", "Non League Premier - Isthmian"): ("England", "Isthmian League Premier", 7, "en7", "en.7i", r"^non league premier - isthmian$", False),
 ("England", "Non League Premier - Northern"): ("England", "Northern Premier League", 7, "en7", "en.7n", r"^non league premier - northern$", False),
 ("England", "Non League Premier - Southern South"): ("England", "Southern League Premier South", 7, "en7", "en.7s", r"^non league premier - southern south$", False),
 ("England", "Non League Premier - Southern Central"): ("England", "Southern League Premier Central", 7, "en7", "en.7c", r"^non league premier - southern central$", False),
 ("Denmark", "2. Division"): ("Danmark", "2. division (Danmark)", 3, "dk3", "dk.3", r"^2\. division$", False),
 ("Poland", "II Liga - East"): ("Polen", "II liga", 3, "pl3", "pl.3", r"^ii liga - east$", False),
 ("Turkey", "2. Lig"): ("Turkiet", "2. Lig", 3, "tr3", "tr.3", r"^2\. lig$", False),
 ("Latvia", "1. Liga"): ("Lettland", "1. līga", 2, "lv2", "lv.2", r"^1\. liga$", False),
 ("Estonia", "Esiliiga A"): ("Estland", "Esiliiga", 2, "ee2", "ee.2", r"^esiliiga a$", False),
 ("Lithuania", "1 Lyga"): ("Litauen", "Pirma lyga", 2, "lt2", "lt.2", r"^1 lyga$", False),
 ("Poland", "Ekstraliga Women"): ("Polen", "Ekstraliga (damer)", 1, "plw", "pl.w1", r"^ekstraliga women$", True),
 ("Portugal", "1a Divisão - Women"): ("Portugal", "Liga BPI", 1, "ptw", "pt.w1", r"^1a divis[aã]o - women$", True),
 ("USA", "USL Championship"): ("USA", "USL Championship", 2, "us2", "us.2", r"^usl championship$", False),
 ("Argentina", "Primera Nacional"): ("Argentina", "Primera Nacional", 2, "ar2", "ar.2", r"^primera nacional$", False),
 ("Japan", "J3 League"): ("Japan", "J3 League", 3, "jp3", "jp.3", r"^j3 league$", False),
 ("Brazil", "Serie C"): ("Brasilien", "Série C (Brasilien)", 3, "br3", "br.3", r"^serie c$", False),
 ("Belgium", "First Amateur Division"): ("Belgien", "First Amateur Division", 3, "be3", "be.3", r"^first amateur division$", False),
 ("Switzerland", "1. Liga Promotion"): ("Schweiz", "Promotion League", 3, "ch3", "ch.3", r"^1\. liga promotion$", False),
 ("Japan", "WE League"): ("Japan", "WE League", 1, "jpw", "jp.w1", r"^we league$", True),
 ("Brazil", "Brasileiro Women"): ("Brasilien", "Brasileirão Feminino", 1, "brw", "br.w1", r"^brasileiro women$", True),
 ("Belgium", "Super League Women"): ("Belgien", "Super League (damer, Belgien)", 1, "bew", "be.w1", r"^super league women$", True),
 ("Switzerland", "AXA Women’s Super League"): ("Schweiz", "Women's Super League (Schweiz)", 1, "chw", "ch.w1", r"^axa women.s super league$", True),
 ("Austria", "Frauenliga"): ("Österrike", "Frauenliga (Österrike)", 1, "atw", "at.w1", r"^frauenliga$", True),
 ("USA", "NWSL Women"): ("USA", "NWSL", 1, "usw", "us.w1", r"^nwsl women$", True),
 ("Netherlands", "Eredivisie Women"): ("Nederländerna", "Vrouwen Eredivisie", 1, "nlw", "nl.w1", r"^eredivisie women$", True),
}
for g in range(1, 6):
    LEAGUES[("Spain", f"Segunda División RFEF - Group {g}")] = ("Spanien", f"Segunda Federación Grupo {g}", 4, "es4", f"es.4{'abcde'[g-1]}", rf"^segunda divisi[oó]n rfef - group {g}$", False)
for i, g in enumerate("ABCDEFGHI"):
    LEAGUES[("Italy", f"Serie D - Girone {g}")] = ("Italien", f"Serie D Girone {g}", 4, "it4", f"it.4{g.lower()}", rf"^serie d - girone {g.lower()}$", False)

# snyggare namn där API:t saknar å/ø/æ eller förkortar
NAME_FIX = {"Nykobing FC": "Nykøbing FC", "Naestved": "Næstved BK", "Roskilde": "FC Roskilde", "Skive": "Skive IK", "Brabrand": "Brabrand IF",
            "HIK": "Hellerup IK", "Middelfart": "Middelfart BK", "Neptūną Klaipėda": "Neptūnas Klaipėda", "Kahramanmaraş İstiklal Spor": "Kahramanmaraş İstiklal Spor",
            "Pogon Szczecin": "Pogoń Szczecin", "Rekord Bielsko-Biala": "Rekord Bielsko-Biała", "Slask Wroclaw": "Śląsk Wrocław", "UJ Krakow": "AZS UJ Kraków",
            "Lech Poznan": "Lech Poznań", "Legia": "Legia Warszawa", "Sleza Wroclaw": "Ślęza Wrocław", "Akademia Piłkarska LG": "AP LG Gdańsk",
            "Sporting Braga": "SC Braga", "Standard Liege": "Standard Liège", "RAAL La Louviere": "RAAL La Louvière", "Ferroviaria": "Ferroviária", "Gremio": "Grêmio",
            "America Mineiro": "América Mineiro", "Internacional RS": "Internacional", "Vitória BA": "Vitória", "Atletico DE Rafaela": "Atlético de Rafaela", "Colon Santa Fe": "Colón",
            "Atletico Mitre": "Atlético Mitre", "Defensores De Belgrano": "Defensores de Belgrano", "Deportivo Maipu": "Deportivo Maipú", "Racing Cordoba": "Racing de Córdoba",
            "San Martin S.J.": "San Martín de San Juan", "San Martin Tucuman": "San Martín de Tucumán", "Tristan Suarez": "Tristán Suárez", "Inter De Limeira": "Inter de Limeira",
            "Deportivo Moron": "Deportivo Morón", "Atletico Mineiro": "Atlético Mineiro", "Vitoria Guimaraes": "Vitória Guimarães", "Porto": "FC Porto", "SL Benfica": "Benfica"}
DAM_SUFFIX = {"Polen", "Portugal", "Japan", "Brasilien", "Belgien", "Schweiz", "Österrike"}  # damlag i dessa länder får "(dam)" så de skiljs från herrlaget
def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()).strip()
def slug(s):
    s = re.sub(r"\b(fc|fk|sc|ss|sp|cd|cf|ud|ad|sd|ac|afc|club|de|the|united|city|town|w)\b", " ", norm(s))
    return re.sub(r"[^a-z0-9]+", "", s)[:12] or "x"

# töm den egna filen först, så att klubbar och orter från en tidigare körning inte räknas som redan befintliga
open(os.path.join(ROOT, "src", "clubs_x26.js"), "w", encoding="utf8").write("module.exports=[];module.exports.geo={};module.exports.wleagues=[];\n")
dump = json.loads(subprocess.run(["node", "-e", "const own=new Set((()=>{try{return require('./src/clubs_x26.js').map(c=>c[0])}catch(e){return[]}})());process.stdout.write(JSON.stringify({clubs:require('./src/clubs.js').filter(c=>!own.has(c[0])),geo:require('./src/geo.js')}))"], cwd=ROOT, capture_output=True, text=True).stdout)
CL = dump["clubs"]; HAVE_GEO = dump["geo"]
ids_all = {c[0] for c in CL}
geo_by_norm = {norm(k): k for k in HAVE_GEO}
by_name = {}
WL = set(json.loads(subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(require('./src/clubs_women.js').leagues))"], cwd=ROOT, capture_output=True, text=True).stdout or "[]"))
for c in CL:
    if c[6] not in WL: by_name.setdefault((c[3], norm(c[1])), c)  # damlag får inte matcha herrlag med samma namn
E = json.load(open(T("extra_ids.json"), encoding="utf8")); WI = json.load(open(T("women_ids.json"), encoding="utf8"))
LOGO = json.load(open(T("logo_ids.json"), encoding="utf8")) if os.path.exists(T("logo_ids.json")) else {}
known = {}  # API-id -> vårt id
for k, v in list(E["teams"].items()) + list(WI["teams"].items()):
    if v: known[int(k)] = v
for ours, aid in LOGO.items(): known.setdefault(int(aid), ours)

# handskrivna rättelser: stad för lag utan arena i API:t, och koordinater som OpenStreetMap inte hittade
CITY_FIX = {"Biellese": "Biella", "Celle Varazze": "Celle Ligure", "Valenzana": "Valenza", "Lascaris": "Pianezza", "Millesimo": "Millesimo", "Leon Monza e Brianza": "Vimercate", "Milan II": "Solbiate Arno", "Rovato Vertovese": "Rovato", "Nibbiano & Valtidone": "Nibbiano", "Pavonese": "Pavone del Mella", "FC Obermais": "Merano", "Altavilla": "Altavilla Vicentina", "Conegliano": "Conegliano", "Sandona": "San Donà di Piave", "Schio": "Schio", "Oltrepò": "Broni", "Pavia": "Pavia", "Coriano": "Coriano", "Solbiatese": "Solbiate Arno", "Rondinella": "Florens", "Angelana": "Santa Maria degli Angeli", "Lanciano FC": "Lanciano", "Montecchio Gallo": "Vallefoglia", "Pietralunga": "Pietralunga", "Santegidiese": "Sant'Egidio alla Vibrata", "Atletico Lodigiani": "Rom", "Monastir": "Monastir", "Aranova": "Fiumicino", "Certosa V. Campagnano": "Campagnano di Roma", "Ossese": "Ossi", "Venafro": "Venafro", "Ebolitana": "Eboli", "Real Forio 2014": "Forio", "AC Palermo": "Palermo", "Calcio Avola": "Avola", "Digiesse PraiaTortora": "Praia a Mare", "Modica": "Modica",
            "Iğdır FK": "Iğdır", "WSPG Wels": "Wels", "Asteras Tripolis II": "Tripoli", "Pyrgos 1968": "Pyrgos", "Boston Legacy": "Boston",
            "Denver Summit": "Denver", "Sporting JAX": "Jacksonville", "Brooklyn": "New York",
            "Standard Liège II": "Liège", "Cercle Brugge II": "Brygge", "RWDM": "Bryssel", "Union Saint-Gilloise II": "Bryssel", "Tienen": "Tienen", "Roeselare Daisel": "Roeselare",
            "Ferroviária (dam)": "Araraquara", "Internacional (dam)": "Porto Alegre", "Vitória (dam)": "Salvador", "Mixto (dam)": "Cuiabá",
            "Elfen Saitama (dam)": "Saitama", "INAC Kobe Leonessa (dam)": "Kobe", "Nojima Stella (dam)": "Sagamihara", "Omiya Ardija Ventus (dam)": "Saitama",
            "Tokyo Verdy Beleza (dam)": "Tokyo", "Parceiro Nagano (dam)": "Nagano", "Servette Chênois (dam)": "Genève", "Aarau (dam)": "Aarau",
            "Yverdon (dam)": "Yverdon-les-Bains", "Rapperswil Jona (dam)": "Rapperswil-Jona", "Südburgenland (dam)": "Güssing",
            "Colón": "Santa Fe (Argentina)", "Racing de Córdoba": "Córdoba (Argentina)",
            "All Boys": "Buenos Aires", "Ferro Carril Oeste": "Buenos Aires", "Nueva Chicago": "Buenos Aires", "Defensores de Belgrano": "Buenos Aires", "Atlanta": "Buenos Aires", "Riga Mariners": "Riga", "Super Nova 2": "Riga", "Hegelmann II": "Kaunas", "Transinvest 2": "Vilnius",
            "Nõmme United II": "Tallinn", "Adana 01 FK": "Adana", "İskenderunspor": "İskenderun", "Kauno Žalgiris II": "Kaunas",
            "Lech Poznań (dam)": "Poznań", "Legia Warszawa (dam)": "Warszawa", "Ślęza Wrocław (dam)": "Wrocław", "Racing Power (dam)": "Seixal",
            "Rio Ave (dam)": "Vila do Conde", "Vitória Guimarães (dam)": "Guimarães", "FC Porto (dam)": "Porto", "Fremad Amager": "Köpenhamn", "B 93": "Köpenhamn", "VSK Århus": "Aarhus", "Brabrand IF": "Aarhus", "Hellerup IK": "Hellerup", "Heerenveen (dam)": "Heerenveen", "Utrecht (dam)": "Utrecht"}
GEO_FIX = {"Rapperswil-Jona": [47.23, 8.82], "Güssing": [47.06, 16.32], "Tienen": [50.81, 4.94], "Roeselare": [50.95, 3.12], "Santiago del Estero": [-27.79, -64.26], "Jacksonville": [30.33, -81.66], "İskenderun": [36.59, 36.17], "Adana": [37.0, 35.32], "Frederiksberg": [55.68, 12.53], "Hellerup": [55.73, 12.57], "Biella": [45.57, 8.05], "Celle Ligure": [44.34, 8.55], "Valenza": [45.01, 8.64], "Pianezza": [45.1, 7.55], "Millesimo": [44.37, 8.2], "Vimercate": [45.61, 9.37], "Solbiate Arno": [45.72, 8.81], "Rovato": [45.56, 9.99], "Nibbiano": [44.9, 9.33], "Pavone del Mella": [45.3, 10.21], "Merano": [46.67, 11.16], "Altavilla Vicentina": [45.51, 11.47], "Conegliano": [45.89, 12.3], "San Donà di Piave": [45.63, 12.57], "Schio": [45.71, 11.36], "Broni": [45.06, 9.26], "Pavia": [45.19, 9.16], "Coriano": [43.96, 12.6], "Santa Maria degli Angeli": [43.06, 12.58], "Lanciano": [42.23, 14.39], "Vallefoglia": [43.83, 12.8], "Pietralunga": [43.44, 12.43], "Sant'Egidio alla Vibrata": [42.83, 13.72], "Monastir": [39.38, 9.05], "Fiumicino": [41.77, 12.24], "Campagnano di Roma": [42.14, 12.38], "Ossi": [40.68, 8.59], "Venafro": [41.48, 14.04], "Eboli": [40.62, 15.06], "Forio": [40.74, 13.86], "Avola": [36.91, 15.14], "Praia a Mare": [39.9, 15.78], "Modica": [36.86, 14.76],
           "Iğdır": [39.92, 44.04], "Wels": [48.16, 14.03], "Tripoli": [37.51, 22.37], "Pyrgos": [37.68, 21.44], "Boston": [42.36, -71.06], "Denver": [39.74, -104.99],
           "Heerenveen": [52.96, 5.92], "Utrecht": [52.09, 5.12], "Gleisdorf": [47.10, 15.71], "Welling": [51.46, 0.11], "Ashton-under-Lyne": [53.49, -2.10],
           "Workington": [54.64, -3.55], "Sandhurst": [51.35, -0.80], "Hanworth": [51.44, -0.39], "Bishop's Stortford": [51.87, 0.16], "Cardington": [52.11, -0.42],
           "Trezzo sull'Adda": [45.61, 9.52], "Villa D'Almè": [45.75, 9.62], "Fiorenzuola d'Arda": [44.93, 9.91], "Palazzolo sull'Oglio": [45.60, 9.89], "Sant'Angelo Lodigiano": [45.24, 9.41]}
def city_of(v):
    c = ((v or {}).get("city") or "").replace("&apos;", "'")
    c = re.split(r"[,(]", c)[0].strip()
    return c

rows, geo, men_ids, w_ids, leagues, used, skipped = [], {}, {}, {}, [], set(), []
for c in W:
    for L in c.get("leagues", []):
        key = (c["country"], L["name"])
        if key not in LEAGUES: continue
        land, lname, tier, pre, code, rx, women = LEAGUES[key]
        leagues.append([lname, land, c["country"], tier, code, rx, women])
        for t in L["teams"]:
            aid = t["id"]
            if aid in known and known[aid] in ids_all:
                (w_ids if women else men_ids)[str(aid)] = known[aid]; continue
            raw = t["name"]
            name = re.sub(r"\s+W$", "", raw).strip()
            name = NAME_FIX.get(name.strip(), name.strip())
            if t.get("matches") is not None and t["matches"] < 5: skipped.append(f"{name} har dragit sig ur"); continue
            if women and land in DAM_SUFFIX: name += " (dam)"
            if women and land == "Nederländerna": name = name.split("/")[0] + " (dam)"
            ex = by_name.get((land, norm(name)))
            if ex and not women:
                men_ids[str(aid)] = ex[0]; continue
            v = t.get("venue") or {}
            city = city_of(v); arena = (v.get("name") or "").replace("&apos;", "'").strip() or None; cap = v.get("capacity") or None
            if name in CITY_FIX: city = CITY_FIX[name]
            if women and not city:
                base = norm(re.sub(r"\s*\(dam\)$", "", name).split("/")[0])
                P = by_name.get((land, base))
                if not P:  # "Genk" -> KRC Genk: herrlag i samma land där damlagets namn ingår som hela ord
                    cand = [c for c in CL if c[3] == land and c[6] not in WL and (" " + base + " ") in (" " + norm(c[1]) + " " + (c[2] or "") + " ")]
                    cand.sort(key=lambda c: (c[7] if isinstance(c[7], int) else 9, len(c[1])))
                    P = cand[0] if cand else None
                if P: city, arena, cap = P[4], P[8], P[9]
            if city:
                g = geo_by_norm.get(norm(city))
                if g: city = g
                elif city in GEO_FIX: geo[city] = GEO_FIX[city]
                elif t.get("ll"): geo[city] = [round(t["ll"][0], 3), round(t["ll"][1], 3)]
                elif city not in geo: skipped.append(f"{name} ({city}) utan koordinater")
            founded = t.get("founded") if isinstance(t.get("founded"), int) and t.get("founded") > 1850 else None
            cid = pre + "-" + slug(name)
            while cid in used or cid in ids_all: cid += "x"
            used.add(cid)
            alias = " ".join(dict.fromkeys(x for x in [norm(name), norm(raw), ("dam damlag women" if women else ""), norm(city)] if x))
            rows.append([cid, name, alias, land, city or None, founded, lname, tier, arena, cap, "", [], 1])
            (w_ids if women else men_ids)[str(aid)] = cid

# serier som API:et har som EN serie men som spelas i grupper: lagen delas efter gruppen i API:ets tabell
# (site/data/standings.json från nattkörningen), och nattkörningen sätter matchernas serie efter lagens grupp
# "*" = lagen som inte finns i någon av API:ets grupptabeller (Belgiens flamländska grupp saknar tabell i API:et)
SPLIT = {"2. Lig": [("White Group", "2. Lig Vita gruppen"), ("Red Group", "2. Lig Röda gruppen")],
         "First Amateur Division": [("National Division 1", "Division 1 ACFF"), ("*", "1e Afdeling VV")]}
split_maps = {}
try:
    ST = json.load(open(os.path.join(ROOT, "site", "data", "standings.json"), encoding="utf8"))["leagues"]
except Exception:
    ST = {}
for lname, parts in SPLIT.items():
    m = {}
    for g in (ST.get(lname) or {}).get("groups", []):
        for key, new in parts:
            if key != "*" and key.lower() in (g.get("name") or "").lower():
                for r in g["rows"]:
                    if r[0]: m[r[0]] = new
    rest = [new for key, new in parts if key == "*"]
    if m and rest:
        for r in rows:
            if r[6] == lname and r[0] not in m: m[r[0]] = rest[0]
    if m:
        split_maps[lname] = m
        for r in rows:
            if r[6] == lname and r[0] in m: r[6] = m[r[0]]
        miss = [r[1] for r in rows if r[6] == lname]
        if miss: skipped.append(f"{lname}: utan grupp {miss}")
    else:
        skipped.append(f"{lname}: ingen grupptabell hittad – serien delas inte")
rows.sort(key=lambda r: (r[3], r[7] if isinstance(r[7], int) else 9, r[6]))
out = ["// Andraligor, Baltikum, Polen/Turkiet/Danmark nivå 3, damserier i Polen och Portugal, England nivå 7, Segunda Federación, Serie D och damserierna NWSL och Vrouwen Eredivisie (API-Football nov 2026, se scripts/build-x26.py).", "module.exports=["]
last = None
for r in rows:
    if r[6] != last: out.append(f"// ---- {r[3]}, {r[6]}"); last = r[6]
    out.append(json.dumps(r, ensure_ascii=False) + ",")
out.append("];")
out.append("module.exports.geo=" + json.dumps(geo, ensure_ascii=False) + ";")
out.append("module.exports.wleagues=" + json.dumps(sorted({l[0] for l in leagues if l[6]}), ensure_ascii=False) + ";")
open(os.path.join(ROOT, "src", "clubs_x26.js"), "w", encoding="utf8").write("\n".join(out) + "\n")
E["teams"].update(men_ids); open(T("extra_ids.json"), "w", encoding="utf8").write(json.dumps(E, ensure_ascii=False))
WI["teams"].update(w_ids)
have_wl = {l[0] for l in WI["leagues"]}
for l in leagues:
    if l[6] and l[0] not in have_wl: WI["leagues"].append([l[0], l[1], l[2], l[3], l[4], l[5]])
json.dump(WI, open(T("women_ids.json"), "w"), ensure_ascii=False)
json.dump([l[:6] + ([split_maps[l[0]]] if l[0] in split_maps else []) for l in leagues if not l[6]], open(T("x26_leagues.json"), "w", encoding="utf8"), ensure_ascii=False)
print(len(rows), "nya klubbar,", len(men_ids) + len(w_ids), "lag-id kopplade,", len(geo), "nya orter,", len(leagues), "serier")
for s in skipped: print("  OBS", s)
