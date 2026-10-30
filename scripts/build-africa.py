# Bygger src/clubs_africa.js och src/geo_africa.js: de afrikanska högstaligor som är fullständiga i API-Football
# (pågående säsong med tabell, oktober 2026). Ofullständiga ligor (Benin, Kongo-Brazzaville, Eswatini, Gabon, Gambia,
# Guinea, Libyen, Mali, Mauritius, Namibia, Somalia, Sudan, Togo) och länder som saknas i API:t är inte med.
# Indata: tools/teams_world5.json. Kör: python3 scripts/build-africa.py
import json, os, re, unicodedata, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(os.path.join(ROOT, "tools", "teams_world5.json"), encoding="utf8"))

LEAGUES = {
 ("Algeria", "Ligue 1"): ("Algeriet", "Ligue 1 (Algeriet)", "dz"),
 ("Angola", "Girabola"): ("Angola", "Girabola", "ao"),
 ("Botswana", "Premier League"): ("Botswana", "Premier League (Botswana)", "bw"),
 ("Burkina-Faso", "Ligue 1"): ("Burkina Faso", "Ligue 1 (Burkina Faso)", "bf"),
 ("Burundi", "Ligue A"): ("Burundi", "Ligue A (Burundi)", "bi"),
 ("Cameroon", "Elite One"): ("Kamerun", "Elite One", "cm"),
 ("Congo-DR", "Ligue 1"): ("DR Kongo", "Linafoot", "cd"),
 ("Ethiopia", "Premier League"): ("Etiopien", "Premier League (Etiopien)", "et"),
 ("Ghana", "Premier League"): ("Ghana", "Premier League (Ghana)", "gh"),
 ("Ivory-Coast", "Ligue 1"): ("Elfenbenskusten", "Ligue 1 (Elfenbenskusten)", "ci"),
 ("Kenya", "FKF Premier League"): ("Kenya", "FKF Premier League", "ke"),
 ("Lesotho", "Premier League"): ("Lesotho", "Premier League (Lesotho)", "ls"),
 ("Liberia", "LFA First Division"): ("Liberia", "LFA First Division", "lr"),
 ("Malawi", "Super League"): ("Malawi", "Super League (Malawi)", "mw"),
 ("Mauritania", "Premier League"): ("Mauretanien", "Super D1 (Mauretanien)", "mr"),
 ("Nigeria", "NPFL"): ("Nigeria", "NPFL", "ng"),
 ("Rwanda", "National Soccer League"): ("Rwanda", "Rwanda Premier League", "rw"),
 ("Senegal", "Ligue 1"): ("Senegal", "Ligue 1 (Senegal)", "sn"),
 ("Tanzania", "Ligi kuu Bara"): ("Tanzania", "Ligi Kuu Bara", "tz"),
 ("Tunisia", "Ligue 1"): ("Tunisien", "Ligue 1 (Tunisien)", "tn"),
 ("Uganda", "Premier League"): ("Uganda", "Premier League (Uganda)", "ug"),
 ("Zambia", "Super League"): ("Zambia", "Super League (Zambia)", "zm"),
 ("Zimbabwe", "Premier Soccer League"): ("Zimbabwe", "Premier Soccer League (Zimbabwe)", "zw"),
}

# arenastad i API:t -> stad vi visar (förorter till huvudstaden visas som huvudstaden)
CITYMAP = {"Algiers": "Alger", "Douera": "Alger", "Ben Aknoun": "Alger", "Bir El Djir": "Oran", "Bechar": "Béchar", "Tizi-Ouzou": "Tizi Ouzou",
 "Nazreth": "Adama", "Addis Ababa": "Addis Abeba", "Wolaita Sodo": "Sodo", "Radès": "Tunis", "Le Bardo": "Tunis", "La Marsa": "Tunis", "Banzart": "Bizerte",
 "Safāqis": "Sfax", "Sousse (Sūsah)": "Sousse", "Ben Gardane": "Ben Guerdane", "Métlaoui": "Metlaoui", "Mbagala": "Dar es Salaam", "Kitende": "Kampala",
 "Najjembe": "Lugazi", "Deni Biram Ndao": "Dakar", "Murang&apos;a": "Murang'a", "Mohale&apos;s Hoek": "Mohale's Hoek", "Mwumba": "Ngozi", "Buganda": "Cibitoke",
 "Omdurman (Umm Durman)": "Kigali", "Omdurman": "Kigali", "Gikongoro": "Nyamagabe", "Gisenyi": "Rubavu", "Byumba": "Gicumbi", "Butare": "Huye"}

# API-id -> [namn, stad] där API:t saknar arena eller har fel stad/namn (övriga får API:ts namn och arenastad)
FIX = {
 10777: ["MB Rouisset", "Alger"], 20699: ["JS El Biar", "Alger"], 10780: ["Olympique Akbou", "Akbou"], 10715: ["CR Témouchent", "Aïn Témouchent"], 10752: ["USM Khenchela", "Khenchela"],
 17987: ["CD Lunda-Sul", "Saurimo"], 22359: ["São Salvador", "M'banza-Kongo"], 28229: ["FC Luanda", "Luanda"], 4921: ["Bravos do Maquis", "Saurimo"],
 28287: ["Enesia", "Gaborone"], 28296: ["Tonota", "Tonota"], 26633: ["CFFEB", "Ouagadougou"], 28437: ["FocuSport", "Ouagadougou"], 28438: ["Maya", "Ouagadougou"],
 28129: ["Young Star", "Bujumbura"], 28130: ["Panthère Noire", "Bujumbura"], 28131: ["Never Give Up Academy", "Bujumbura"],
 5409: ["PWD Bamenda", "Bamenda"], 20799: ["Aigle Royal du Moungo", "Nkongsamba"], 20800: ["Victoria United", "Limbe"], 25430: ["Union Abong-Mbang", "Abong-Mbang"], 28568: ["Gazelle", "Garoua"],
 10007: ["AS Rangers", "Kinshasa"], 21622: ["Tanganyika", "Kalemie"], 24105: ["Anges Verts", "Kinshasa"], 24107: ["Malole", "Kananga"], 24108: ["New Jack", "Kinshasa"],
 26885: ["FC MK", "Kinshasa"], 26886: ["CS Manika", "Kolwezi"], 26887: ["AS New Soger", "Kinshasa"], 27053: ["Saint-Luc", "Kananga"], 27229: ["FC Renaissance du Congo", "Kinshasa"],
 28512: ["Butras", "Kinshasa"], 28513: ["Novakin", "Kinshasa"], 8077: ["Étoile du Congo", "Brazzaville"],
 26880: ["Sheger Ketema", "Addis Abeba"], 26881: ["Negelle Arsi", "Negele Arsi"], 28446: ["Halaba Ketema", "Halaba"], 28447: ["Gamo Chencha", "Chencha"], 20030: ["Ethiopian Medhin", "Addis Abeba"],
 21093: ["Swedru All Blacks", "Agona Swedru"], 26805: ["Port City", "Takoradi"], 4450: ["Dreams FC", "Dawu"],
 # Elfenbenskusten: API:t anger Abidjan för alla; de som inte är från Abidjan får sin egen stad (och ingen arena)
 4516: ["Bouaké FC", "Bouaké", None], 4521: ["FC San-Pédro", "San-Pédro", None], 18179: ["Korhogo", "Korhogo", None], 22583: ["Mouna", "Akoupé", None],
 25587: ["ISCA", "Abidjan"], 26340: ["ES Agboville", "Agboville"], 26341: ["US Tchologo", "Ferkessédougou"], 28441: ["Adiaké", "Adiaké"], 28442: ["Yamoussoukro", "Yamoussoukro"],
 2485: ["Kenya Police", "Nairobi"], 24667: ["3K FC", "Nairobi"],
 25066: ["Mzamane", "Maseru"], 26611: ["Members", "Maseru"], 28600: ["Villa", "Maseru"],
 26907: ["Wologizi", "Monrovia"], 26908: ["Borough", "Monrovia"], 26909: ["Downtown", "Monrovia"], 26910: ["Gardnersville", "Monrovia"], 28535: ["Golden Dream", "Monrovia"], 28536: ["District 17", "Monrovia"],
 18747: ["Dedza Dynamos", "Dedza"], 23427: ["Creck", "Lilongwe"], 25893: ["Ekhaya", "Blantyre"], 27655: ["Masters FC", "Lilongwe"], 27656: ["Mitundu Baptist", "Lilongwe"],
 21987: ["Pompiers", "Nouakchott"], 24798: ["N'Zidane", "Nouakchott"], 26812: ["Nouakchott Académie", "Nouakchott"],
 20809: ["Doma United", "Gombe"], 22585: ["Sporting Lagos", "Lagos"], 24512: ["Ikorodu City", "Ikorodu"], 26400: ["Barau FC", "Kano"], 26401: ["Kun Khalifat FC", "Owerri"],
 28168: ["Inter Lagos", "Lagos"], 28169: ["Ranchers Bees", "Kaduna"],
 5237: ["Al Hilal Omdurman", "Kigali"], 5239: ["Al Merreikh", "Kigali"], 15560: ["Gorilla FC", "Kigali"], 18056: ["Etoile de l'Est", "Ngoma"],
 25067: ["AJEL", "Rufisque"], 25068: ["HLM", "Dakar"], 25070: ["Wally Daan", "Thiès"], 28349: ["Essamaye", "Ziguinchor"],
 24707: ["Pamba Jiji", "Mwanza"], 6432: ["Simba SC", "Dar es Salaam"], 5370: ["Young Africans (Yanga)", "Dar es Salaam"], 8057: ["Azam FC", "Dar es Salaam"],
 8572: ["Simba Kolwezi", "Kolwezi"], 17923: ["Vitesse FC Bobo", "Bobo-Dioulasso"], 5322: ["Police FC (Rwanda)", "Kigali"], 12461: ["Police FC (Uganda)", "Kampala"],
 16175: ["ASC Police", "Nouakchott"], 16164: ["ASC Armée", "Nouakchott"], 4520: ["SOA", "Abidjan"], 6437: ["AS Vita Club", "Kinshasa"], 4513: ["Stade d'Abidjan", "Abidjan"], 12190: ["JKT Tanzania", "Dar es Salaam"],
 20297: ["Blacks Power", "Kampala"], 26700: ["Entebbe UPPC", "Entebbe"], 28318: ["Ntugasaze", "Kampala"], 28319: ["Kataka", "Mbale"], 28320: ["Kigezi HomeBoyz", "Kabale"],
 21876: ["Trident", "Lusaka"], 28278: ["Chirundu United", "Chirundu"], 28279: ["Makeni All Stars", "Lusaka"],
 5217: ["Bulawayo Chiefs", "Bulawayo"], 5223: ["Herentals", "Harare"], 5227: ["Manica Diamonds", "Mutare"], 5231: ["TelOne", "Gweru"], 25734: ["MWOS", "Harare"],
 25735: ["Scotland Mabvuku", "Harare"], 27273: ["Agama", "Harare"], 27274: ["Hardrock", "Harare"], 27275: ["Hunters", "Harare"],
}
# lag vars hemland skiljer sig från ligans
LAND = {5237: "Sudan", 5239: "Sudan", 8077: "Kongo-Brazzaville"}

GEO = {
 "Alger": [36.75, 3.06], "Sétif": [36.19, 5.41], "Oran": [35.70, -0.63], "Biskra": [34.85, 5.73], "Constantine": [36.37, 6.61], "Béchar": [31.62, -2.22], "Tizi Ouzou": [36.71, 4.05],
 "Chlef": [36.17, 1.33], "Aïn Témouchent": [35.30, -1.14], "Khenchela": [35.44, 7.14], "Akbou": [36.46, 4.53], "Béjaïa": [36.75, 5.06],
 "Luanda": [-8.84, 13.23], "Benguela": [-12.58, 13.41], "Lobito": [-12.36, 13.54], "Lubango": [-14.92, 13.49], "Saurimo": [-9.66, 20.39], "Calulo": [-9.99, 14.90], "Dundo": [-7.38, 20.83],
 "Cabinda": [-5.55, 12.20], "Caála": [-12.85, 15.56], "M'banza-Kongo": [-6.27, 14.24],
 "Gaborone": [-24.65, 25.91], "Lobatse": [-25.22, 25.68], "Jwaneng": [-24.60, 24.73], "Orapa": [-21.31, 25.38], "Otse": [-25.02, 25.74], "Francistown": [-21.17, 27.51],
 "Selebi-Phikwe": [-22.00, 27.83], "Serowe": [-22.39, 26.71], "Sowa": [-20.56, 26.22], "Tonota": [-21.44, 27.47],
 "Ouagadougou": [12.37, -1.52], "Bobo-Dioulasso": [11.18, -4.30], "Manga": [11.66, -1.07], "Banfora": [10.63, -4.76],
 "Bujumbura": [-3.38, 29.36], "Makamba": [-4.13, 29.80], "Muyinga": [-2.85, 30.34], "Ngozi": [-2.91, 29.83], "Cibitoke": [-2.89, 29.12], "Gitega": [-3.43, 29.93],
 "Yaoundé": [3.87, 11.52], "Garoua": [9.30, 13.40], "Mélong": [5.12, 9.96], "Bafang": [5.16, 10.18], "Dschang": [5.45, 10.05], "Bangangté": [5.14, 10.52], "Douala": [4.05, 9.70],
 "Bamenda": [5.96, 10.15], "Nkongsamba": [4.95, 9.94], "Limbe": [4.02, 9.20], "Abong-Mbang": [3.98, 13.18],
 "Lubumbashi": [-11.66, 27.48], "Kinshasa": [-4.32, 15.31], "Kindu": [-2.95, 25.92], "Brazzaville": [-4.27, 15.28], "Mbuji-Mayi": [-6.14, 23.60], "Kolwezi": [-10.71, 25.47],
 "Goma": [-1.68, 29.22], "Bukavu": [-2.51, 28.86], "Kalemie": [-5.95, 29.19], "Kananga": [-5.90, 22.42],
 "Adama": [8.54, 39.27], "Hawassa": [7.06, 38.48], "Bahir Dar": [11.59, 37.39], "Addis Abeba": [9.03, 38.74], "Gondar": [12.60, 37.47], "Yirgalem": [6.75, 38.41], "Sodo": [6.86, 37.76],
 "Adigrat": [14.28, 39.46], "Hosaena": [7.55, 37.86], "Negele Arsi": [7.35, 38.67], "Halaba": [7.31, 38.10], "Chencha": [6.25, 37.57],
 "Accra": [5.60, -0.19], "Kumasi": [6.69, -1.62], "Obuasi": [6.20, -1.66], "Dormaa Ahenkro": [7.29, -2.88], "Bechem": [7.09, -2.03], "Berekum": [7.45, -2.58], "Nalerigu": [10.53, -0.37],
 "Tarkwa": [5.30, -1.99], "Kpandu": [7.00, 0.29], "Bibiani": [6.46, -2.32], "Samreboi": [5.57, -2.58], "Debibi": [6.95, -2.60], "Nzema Anyinase": [4.95, -2.20], "Tema": [5.67, 0.02],
 "Wenchi": [7.74, -2.10], "Agona Swedru": [5.53, -0.70], "Takoradi": [4.90, -1.76], "Dawu": [5.97, -0.14],
 "Abidjan": [5.36, -4.01], "Bouaké": [7.69, -5.03], "San-Pédro": [4.75, -6.64], "Korhogo": [9.46, -5.63], "Akoupé": [6.38, -3.89], "Agboville": [5.93, -4.22], "Ferkessédougou": [9.59, -5.20],
 "Adiaké": [5.29, -3.30], "Yamoussoukro": [6.82, -5.28],
 "Thika": [-1.03, 37.07], "Mombasa": [-4.04, 39.67], "Kakamega": [0.28, 34.75], "Nairobi": [-1.29, 36.82], "Nakuru": [-0.30, 36.07], "Machakos": [-1.52, 37.26], "Bomet": [-0.78, 35.34],
 "Awendo": [-0.91, 34.53], "Migori": [-1.06, 34.47], "Murang'a": [-0.72, 37.15], "Homa Bay": [-0.53, 34.46],
 "Maseru": [-29.31, 27.48], "Mohale's Hoek": [-30.15, 27.48], "Butha-Buthe": [-28.77, 28.25], "Morija": [-29.63, 27.51], "Maputsoe": [-28.89, 27.90], "Teyateyaneng": [-29.15, 27.75], "Nyakosoba": [-29.43, 27.70],
 "Monrovia": [6.30, -10.80], "Gbarnga": [7.00, -9.47], "Kakata": [6.53, -10.35],
 "Blantyre": [-15.79, 35.01], "Lilongwe": [-13.96, 33.79], "Mzuzu": [-11.47, 34.02], "Dedza": [-14.38, 34.33], "Karonga": [-9.93, 33.93], "Zomba": [-15.39, 35.32], "Nkhotakota": [-12.93, 34.30],
 "Nouadhibou": [20.94, -17.04], "Nouakchott": [18.09, -15.98], "Kaédi": [16.15, -13.50], "Zouérate": [22.73, -12.47],
 "Umuahia": [5.53, 7.49], "Benin City": [6.34, 5.63], "Awka": [6.21, 7.07], "Aba": [5.11, 7.37], "Kano": [12.00, 8.52], "Katsina": [12.99, 7.60], "Ilorin": [8.50, 4.55], "Jos": [9.90, 8.86],
 "Lokoja": [7.80, 6.74], "Port Harcourt": [4.82, 7.03], "Ibadan": [7.38, 3.95], "Warri": [5.52, 5.75], "Gombe": [10.29, 11.17], "Lagos": [6.52, 3.38], "Ikorodu": [6.62, 3.51], "Owerri": [5.48, 7.03], "Kaduna": [10.52, 7.44],
 "Kigali": [-1.95, 30.06], "Nyamagabe": [-2.48, 29.52], "Nyamata": [-2.15, 30.09], "Rubavu": [-1.68, 29.26], "Gicumbi": [-1.58, 30.07], "Huye": [-2.60, 29.74], "Musanze": [-1.50, 29.63], "Nyagatare": [-1.30, 30.33], "Ngoma": [-2.16, 30.53],
 "Ziguinchor": [12.57, -16.27], "Dakar": [14.69, -17.45], "Saint-Louis": [16.03, -16.49], "Pikine": [14.76, -17.39], "Mbour": [14.42, -16.96], "Guédiawaye": [14.78, -17.39], "Saly": [14.45, -17.01],
 "Rufisque": [14.72, -17.27], "Thiès": [14.79, -16.93],
 "Dar es Salaam": [-6.79, 39.21], "Tanga": [-5.07, 39.10], "Karatu": [-3.34, 35.67], "Bukoba": [-1.33, 31.81], "Mbeya": [-8.90, 33.46], "Ruangwa": [-10.07, 38.93], "Morogoro": [-6.82, 37.66],
 "Dodoma": [-6.16, 35.75], "Geita": [-2.87, 32.23], "Singida": [-4.82, 34.75], "Tabora": [-5.02, 32.80], "Kigoma": [-4.88, 29.63], "Mwanza": [-2.52, 32.90],
 "Tunis": [36.81, 10.18], "Bizerte": [37.27, 9.87], "Sfax": [34.74, 10.76], "Metlaoui": [34.32, 8.40], "Ben Guerdane": [33.14, 11.22], "Zarzis": [33.50, 11.11], "Sousse": [35.83, 10.64],
 "Monastir": [35.78, 10.83], "Hammam-Lif": [36.73, 10.34], "Hammam-Sousse": [35.86, 10.60], "Béja": [36.73, 9.18], "Sakiet Eddaïer": [34.80, 10.78],
 "Kampala": [0.35, 32.58], "Lugazi": [0.37, 32.94], "Mbarara": [-0.61, 30.65], "Bombo": [0.58, 32.54], "Butema": [1.43, 31.35], "Entebbe": [0.06, 32.46], "Mbale": [1.08, 34.18], "Kabale": [-1.25, 29.99],
 "Lusaka": [-15.39, 28.32], "Choma": [-16.81, 26.99], "Kabwe": [-14.45, 28.45], "Mazabuka": [-15.86, 27.75], "Mufulira": [-12.55, 28.24], "Kitwe": [-12.80, 28.21], "Ndola": [-12.97, 28.64],
 "Chingola": [-12.53, 27.85], "Chililabombwe": [-12.37, 27.83], "Lumwana": [-12.25, 25.86], "Luanshya": [-13.14, 28.42], "Chirundu": [-16.03, 28.85],
 "Harare": [-17.83, 31.05], "Bulawayo": [-20.15, 28.58], "Kariba": [-16.52, 28.80], "Ngezi": [-18.66, 30.33], "Zvishavane": [-20.33, 30.03], "Triangle": [-21.03, 31.45], "Shamva": [-17.31, 31.57],
 "Mutare": [-18.97, 32.67], "Gweru": [-19.45, 29.82],
}

def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|fk|sc|ac|afc|club|de|du|des|la|le|the|united|city|town|sport|sports)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)[:12] or "x"
def ascii_low(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())).strip()

have_geo = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./src/geo.js')))"], cwd=ROOT, capture_output=True, text=True).stdout)
existing_ids = set(json.loads(subprocess.run(["node", "-e", "let own=new Set();try{own=new Set(require('./src/clubs_africa.js').map(c=>c[0]))}catch(e){};console.log(JSON.stringify(require('./src/clubs.js').map(c=>c[0]).filter(id=>!own.has(id))))"], cwd=ROOT, capture_output=True, text=True).stdout))

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

out = ["// Afrikas högstaligor som är fullständiga i API-Football 2026/27 (se scripts/build-africa.py). Samma format som clubs.js.", "module.exports=["]
last = None
for r in rows:
    if r[6] != last: out.append(f"// ---- {r[3]}, {r[6]}"); last = r[6]
    out.append(json.dumps(r, ensure_ascii=False) + ",")
out.append("];")
open(os.path.join(ROOT, "src", "clubs_africa.js"), "w", encoding="utf8").write("\n".join(out) + "\n")
used_cities = {r[4] for r in rows}
open(os.path.join(ROOT, "src", "geo_africa.js"), "w", encoding="utf8").write("// koordinater för städerna i clubs_africa.js\nmodule.exports=" + json.dumps({k: v for k, v in GEO.items() if k in used_cities}, ensure_ascii=False) + ";\n")
p = os.path.join(ROOT, "tools", "extra_ids.json"); E = json.load(open(p, encoding="utf8")); E["teams"].update(extra)
open(p, "w", encoding="utf8").write(json.dumps(E, ensure_ascii=False))
print(len(rows), "nya klubbar,", len(extra), "lag-id kopplade")
