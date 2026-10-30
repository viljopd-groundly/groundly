# Bygger src/clubs_asia.js och src/geo_asia.js: Asiens högstaligor som är fullständiga i API-Football
# (pågående säsong med tabell och matchhändelser, oktober 2026). Japan, Sydkorea och Saudiarabien fanns redan.
# Ofullständiga och inte med: Macao, Maldiverna, Nepal, Pakistan, Palestina, Filippinerna, Turkmenistan och Jemen.
# Saknas i API:et: Afghanistan, Brunei (DPMM spelar i Malaysia), Guam, Nordkorea, Sri Lanka och Östtimor.
# Indata: tools/teams_world7.json. Kör: python3 scripts/build-asia.py
import json, os, re, unicodedata, subprocess, math
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(os.path.join(ROOT, "tools", "teams_world7.json"), encoding="utf8"))

LEAGUES = {
 ("Bahrain", "Premier League"): ("Bahrain", "Bahraini Premier League", "bh"),
 ("Bangladesh", "Premier League"): ("Bangladesh", "Bangladesh Premier League", "bd"),
 ("Bhutan", "Premier League"): ("Bhutan", "Bhutan Premier League", "bt"),
 ("Cambodia", "C-League"): ("Kambodja", "Cambodian Premier League", "kh"),
 ("China", "Super League"): ("Kina", "Chinese Super League", "cn"),
 ("Chinese-Taipei", "Taiwan Football Premier League"): ("Taiwan", "Taiwan Football Premier League", "tw"),
 ("Hong-Kong", "Premier League"): ("Hongkong", "Hong Kong Premier League", "hk"),
 ("India", "Indian Super League"): ("Indien", "Indian Super League", "in"),
 ("Indonesia", "Liga 1"): ("Indonesien", "Super League (Indonesien)", "id"),
 ("Iran", "Persian Gulf Pro League"): ("Iran", "Persian Gulf Pro League", "ir"),
 ("Iraq", "Iraqi League"): ("Irak", "Iraq Stars League", "iq"),
 ("Jordan", "League"): ("Jordanien", "Jordanian Pro League", "jo"),
 ("Kuwait", "Premier League"): ("Kuwait", "Kuwait Premier League", "kw"),
 ("Kyrgyzstan", "Premier League"): ("Kirgizistan", "Kyrgyz Premier League", "kg"),
 ("Laos", "Lao League"): ("Laos", "Lao League 1", "la"),
 ("Lebanon", "Premier League"): ("Libanon", "Lebanese Premier League", "lb"),
 ("Malaysia", "Super League"): ("Malaysia", "Malaysia Super League", "my"),
 ("Mongolia", "Premier League"): ("Mongoliet", "Mongolian Premier League", "mn"),
 ("Myanmar", "National League"): ("Myanmar", "Myanmar National League", "mm"),
 ("Oman", "Professional League"): ("Oman", "Oman Professional League", "om"),
 ("Qatar", "Stars League"): ("Qatar", "Qatar Stars League", "qa"),
 ("Singapore", "Premier League"): ("Singapore", "Singapore Premier League", "sg"),
 ("Syria", "Premier League"): ("Syrien", "Syrian Premier League", "sy"),
 ("Tajikistan", "Vysshaya Liga"): ("Tadzjikistan", "Tajikistan Higher League", "tj"),
 ("Thailand", "Thai League 1"): ("Thailand", "Thai League 1", "th"),
 ("United-Arab-Emirates", "Pro League"): ("Förenade Arabemiraten", "UAE Pro League", "ae"),
 ("Uzbekistan", "Super League"): ("Uzbekistan", "Uzbekistan Super League", "uz"),
 ("Vietnam", "V.League 1"): ("Vietnam", "V.League 1", "vn"),
}
CITYMAP = {
 "al-Manāma (Manama)": "Manama", "Hamad Town": "Hamad Town", "Comilla": "Dhaka", "Krong Doun Kaev": "Takéo", "Krong Preah Sihanouk": "Sihanoukville",
 "Beijing": "Peking", "Ji'nan": "Jinan", "Gaoxiong": "Kaohsiung", "Hong Kong": "Hongkong", "North District": "Hongkong", "Kowloon": "Hongkong",
 "Bangalore": "Bengaluru", "Lompoe": "Makassar", "Kepanjen": "Malang", "Ahwaz": "Ahvaz", "Bandar-e-Anzalī": "Bandar Anzali", "Ghaemshahr": "Qaem Shahr",
 "Baghdād": "Bagdad", "Baghdad": "Bagdad", "al-Baṣra (Basra)": "Basra", "Ba'quba": "Baqubah", "Ar Ramādī (Ramadi)": "Ramadi", "Dohuk": "Duhok",
 "Al Ramtha": "Ar Ramtha", "As-Salt": "As-Salt", "Madīnat al-Kuwayt (Kuwait City)": "Kuwait City", "Ardiyah": "Ardiya",
 "Bishkek": "Bisjkek", "Bayrūt (Beirut)": "Beirut", "Tarabulus": "Tripoli (Libanon)", "Aabbasiyyeh": "Abbasiyeh",
 "Iskandar Puteri (Nusajaya)": "Johor Bahru", "Pulau Pinang": "George Town (Malaysia)", "Ulan Bator (Ulaanbaatar)": "Ulan Bator", "Ulaanbaatar": "Ulan Bator",
 "Masqaṭ (Muscat)": "Muskat", "Al-Buraimi": "Al Buraimi", "ad-Dōha (Doha)": "Doha", "Ar-Rayyan": "Al Rayyan", "Al-Wakra": "Al Wakrah", "Al-Khor": "Al Khor",
 "Damascus": "Damaskus", "Ḥimṣ (Homs)": "Homs", "Dushanbe": "Dusjanbe", "Kurgan-Tyube": "Bokhtar", "Kulyab": "Kulob", "Parkhar": "Farkhor", "Ghafurov": "Ghafurov",
 "Al-'Ayn (Al Ain)": "Al Ain", "Dubayy (Dubai)": "Dubai", "Madinat Zaid": "Madinat Zayed", "Tashkent": "Tasjkent", "Samarqand": "Samarkand", "Bukhara": "Buchara",
 "Đà Nẵng (Da Nang)": "Da Nang", "Hà Nội (Hanoi)": "Hanoi", "Thành phố Hồ Chí Minh (Ho Chi Minh City)": "Ho Chi Minh-staden", "Plei Cu (Pleiku)": "Pleiku",
 "Hai Phong": "Haiphong", "Nam Dinh": "Nam Định", "Teheran": "Teheran", "Fuladshahr": "Isfahan",
}
FIX = {
 # Bahrain: nästan alla spelar på nationalarenan i Riffa, men klubbarna hör hemma i sina städer
 5479: ["Al-Najma", "Manama"], 5482: ["Riffa", "Riffa"], 5483: ["Al-Hidd", "Hidd"], 5485: ["East Riffa", "Riffa"], 5486: ["Malkiya", "Malkiya"],
 5487: ["Manama Club", "Manama"], 5488: ["Al-Muharraq", "Muharraq"], 5580: ["Al-Ahli (Bahrain)", "Manama"], 10234: ["Al-Ittifaq Maqaba", "Hamad Town"],
 10238: ["Sitra", "Sitra"], 17666: ["Al-Khalidiya", "Manama"], 20386: ["A'ali", "A'ali"],
 # Bangladesh: Dhakaklubbar som spelar på arenor runt om i landet
 5009: ["Abahani Dhaka", "Dhaka"], 5011: ["Arambagh KS", "Dhaka"], 5013: ["Brothers Union", "Dhaka"], 5014: ["Mohammedan SC", "Dhaka"],
 5017: ["Rahmatganj MFS", "Dhaka"], 10106: ["Bangladesh Police", "Dhaka"], 25415: ["Dhaka Wanderers", "Dhaka"], 25416: ["Fakirerpool YMC", "Dhaka"],
 26882: ["PWD SC", "Dhaka"], 28428: ["Chattogram", "Chattogram"], 28429: ["City Club", "Dhaka"],
 5433: ["Bhutan U19", "Thimphu"], 19007: ["Ugyen Academy", "Punakha"], 21277: ["Tsirang", "Damphu"], 27725: ["Drukpa", "Thimphu"],
 26303: ["Kompong Dewa", "Phnom Penh"],
 # Kina: API:et har gamla klubbnamn
 836: ["Shanghai Port", "Shanghai"], 837: ["Tianjin Jinmen Tiger", "Tianjin"], 840: ["Henan FC", "Zhengzhou"], 844: ["Shandong Taishan", "Jinan"],
 1431: ["Qingdao Hainiu", "Qingdao"], 5648: ["Chengdu Rongcheng", "Chengdu"], 5684: ["Liaoning Tieren", "Shenyang", None],
 5686: ["Shenzhen Peng City", "Shenzhen", None], 17265: ["Qingdao West Coast", "Qingdao"], 21262: ["Chongqing Tonglianglong", "Chongqing"],
 21263: ["Dalian Yingbo", "Dalian"], 830: ["Beijing Guoan", "Peking"],
 9427: ["Taipower", "Kaohsiung"], 12542: ["Taichung Futuro", "Taichung"], 18841: ["AC Taipei", "Taipei"], 26332: ["Taichung Rock", "Taichung"], 28419: ["Kaohsiung FC", "Kaohsiung"],
 4457: ["Tai Po", "Hongkong"],
 3466: ["Punjab FC", "New Delhi"], 15516: ["Mohun Bagan SG", "Kolkata"], 21137: ["East Bengal", "Kolkata", "Vivekananda Yuba Bharati Krirangan Stadium"],
 22595: ["Inter Kashi", "Varanasi"], 26963: ["SC Delhi", "New Delhi"], 3462: ["Churchill Brothers", "Margao"],
 2442: ["Borneo FC", "Samarinda"], 2445: ["Persib Bandung", "Bandung"], 2443: ["Bhayangkara Presisi", "Bandar Lampung"], 2444: ["Madura United", "Pamekasan"], 3882: ["PSS Sleman", "Sleman"],
 4244: ["Persita Tangerang", "Tangerang", "Indomilk Arena"], 10134: ["Persija Jakarta", "Jakarta"], 17902: ["Dewa United", "Tangerang"],
 22409: ["Java United", "Semarang"], 24993: ["Isen Mulang Kalteng", "Palangka Raya"], 26645: ["Garudayaksa", "Bekasi"],
 2717: ["Malavan", "Bandar Anzali"], 2738: ["Zob Ahan", "Isfahan"], 20299: ["Chadormalu", "Ardakan"],
 11074: ["Naft Maysan", "Amarah"], 25062: ["Newroz", "Sulaymaniyah"], 26598: ["Mosul FC", "Mosul"], 26600: ["Al-Gharraf", "Nasiriyah"],
 28222: ["Al-Jolan", "Fallujah"], 28223: ["Ghaz Al-Shamal", "Kirkuk"], 28571: ["Al-Shorta", "Bagdad"],
 4532: ["Al-Hussein", "Irbid"], 17472: ["Al-Arabi (Jordanien)", "Irbid"], 22188: ["Doqarah", "Irbid"],
 18731: ["Talant", "Bisjkek"], 21168: ["OshMU-Aldiyer", "Osh"], 25764: ["Asiagoal", "Bisjkek"], 25765: ["Bars", "Bisjkek"],
 25766: ["Bishkek City", "Bisjkek"], 25767: ["Özgön", "Özgön"], 27432: ["Asia Talas", "Talas"], 27550: ["Toktogul", "Toktogul"], 12240: ["Neftchi Kochkor-Ata", "Kochkor-Ata"],
 14094: ["Ezra", "Vientiane"], 14096: ["Viengchanh", "Vientiane"], 26367: ["Salavan United", "Salavan"], 26368: ["Savannakhet", "Savannakhet"], 28451: ["Oudomxay", "Muang Xay"],
 4568: ["Al-Akhaa Al-Ahli", "Aley"], 4577: ["Tadamon Sour", "Tyros"], 22812: ["Riyadi Abbasiyeh", "Abbasiyeh"], 26399: ["Jwaya", "Jwaya"],
 2523: ["Johor Darul Ta'zim", "Johor Bahru"], 4202: ["DPMM", "Bandar Seri Begawan"], 10430: ["Immigration FC", "George Town (Malaysia)"], 27373: ["Kelantan Red Warrior", "Kota Bharu"],
 2505: ["Sabah FC", "Kota Kinabalu"], 2517: ["Kuala Lumpur City", "Kuala Lumpur"], 10108: ["Kuching City", "Kuching"],
 18104: ["Khovd", "Khovd"], 26667: ["Ulaangom City", "Ulaangom"], 26669: ["Khovd Western", "Khovd"], 28430: ["Amtat", "Ulan Bator"],
 12526: ["ISPE", "Yangon"], 12528: ["Sagaing United", "Monywa"], 12532: ["Dagon", "Yangon"], 19048: ["Myawady", "Naypyidaw"], 24091: ["Thitsar Arman", "Yangon"], 28338: ["Yangon Royals", "Yangon"],
 5335: ["Saham", "Saham"], 7505: ["Bahla", "Bahla"], 7506: ["Fanja", "Fanja"], 11384: ["Al-Musannah", "Al-Musannah"], 15962: ["Samail", "Samail"],
 2893: ["Al-Shahania", "Al-Shahaniya"], 2916: ["Al-Shamal", "Madinat ash Shamal"], 7527: ["Lusail SC", "Lusail"],
 4200: ["Albirex Niigata (S)", "Singapore"], 4204: ["Lion City Sailors", "Singapore"],
 27269: ["Al-Ahli Damaskus", "Damaskus"], 28525: ["Qamishli", "Qamishli"], 9114: ["Al-Futowa", "Deir ez-Zor"],
 12264: ["Istaravshan", "Istaravshan"], 27266: ["Sardor Tursunzoda", "Tursunzoda"],
 2770: ["Bangkok United", "Pathum Thani"], 15282: ["Rasi Salai United", "Sisaket"],
 2869: ["Hatta", "Hatta"], 2873: ["Al-Dhafra", "Madinat Zayed"],
 4213: ["Mash'al", "Muborak"],
 9167: ["Phù Đổng Ninh Bình", "Ninh Bình"], 26601: ["Bắc Ninh", "Bắc Ninh"], 16400: ["Công An Hà Nội", "Hanoi"],
}
LAND = {4202: "Brunei"}
GEO = {
 "Riffa": [26.13, 50.56], "Hidd": [26.25, 50.65], "Malkiya": [26.10, 50.49], "Muharraq": [26.26, 50.61], "Hamad Town": [26.12, 50.51], "Sitra": [26.15, 50.62], "A'ali": [26.15, 50.53],
 "Chattogram": [22.36, 91.78], "Paro": [27.43, 89.42], "Punakha": [27.59, 89.86], "Damphu": [27.02, 90.12],
 "Siem Reap": [13.36, 103.86], "Takéo": [10.99, 104.79], "Svay Rieng": [11.09, 105.80], "Sihanoukville": [10.63, 103.50],
 "Shanghai": [31.23, 121.47], "Tianjin": [39.13, 117.20], "Zhengzhou": [34.75, 113.63], "Jinan": [36.65, 117.12], "Hangzhou": [30.27, 120.16], "Qingdao": [36.07, 120.38],
 "Chengdu": [30.57, 104.07], "Shenyang": [41.81, 123.43], "Shenzhen": [22.54, 114.06], "Wuhan": [30.59, 114.31], "Chongqing": [29.56, 106.55], "Dalian": [38.91, 121.61], "Yuxi": [24.35, 102.54],
 "Tainan": [22.99, 120.21], "Kaohsiung": [22.63, 120.30], "Taichung": [24.15, 120.67],
 "Margao": [15.28, 73.96], "New Delhi": [28.61, 77.21], "Bengaluru": [12.97, 77.59], "Chennai": [13.08, 80.27], "Kochi": [9.93, 76.27], "Mumbai": [19.08, 72.88],
 "Guwahati": [26.14, 91.74], "Bhubaneswar": [20.30, 85.82], "Kolkata": [22.57, 88.36], "Varanasi": [25.32, 82.97],
 "Malang": [-7.98, 112.63], "Makassar": [-5.15, 119.43], "Samarinda": [-0.50, 117.15], "Bandar Lampung": [-5.40, 105.27], "Pamekasan": [-7.16, 113.48], "Bandung": [-6.92, 107.61],
 "Surabaya": [-7.26, 112.75], "Gianyar": [-8.54, 115.33], "Sleman": [-7.72, 110.36], "Yogyakarta": [-7.80, 110.36], "Kediri": [-7.82, 112.01], "Tangerang": [-6.18, 106.63],
 "Jepara": [-6.59, 110.67], "Semarang": [-6.97, 110.42], "Palangka Raya": [-2.21, 113.92], "Bekasi": [-6.24, 106.99],
 "Arak": [34.09, 49.69], "Shiraz": [29.59, 52.58], "Sirjan": [29.45, 55.68], "Khorramabad": [33.49, 48.36], "Bandar Anzali": [37.47, 49.46], "Qaem Shahr": [36.46, 52.86],
 "Ahvaz": [31.32, 48.67], "Tabriz": [38.08, 46.29], "Isfahan": [32.65, 51.67], "Abadan": [30.34, 48.30], "Shahrbabak": [30.12, 55.12], "Qazvin": [36.27, 50.00], "Ardakan": [32.31, 54.02],
 "Bagdad": [33.31, 44.37], "Erbil": [36.19, 44.01], "Amarah": [31.84, 47.14], "Zakho": [37.14, 42.68], "Duhok": [36.87, 42.99], "Karbala": [32.62, 44.02], "Baqubah": [33.75, 44.64],
 "Ramadi": [33.42, 43.30], "Sulaymaniyah": [35.56, 45.44], "Mosul": [36.34, 43.13], "Nasiriyah": [31.04, 46.26], "Fallujah": [33.35, 43.78], "Kirkuk": [35.47, 44.39],
 "Irbid": [32.56, 35.85], "Ar Ramtha": [32.56, 36.01], "As-Salt": [32.04, 35.73],
 "Kuwait City": [29.38, 47.99], "Al Ahmadi": [29.08, 48.08], "Al Jahra": [29.34, 47.66], "Ardiya": [29.29, 47.90], "Abu Halifa": [29.13, 48.12],
 "Osh": [40.53, 72.80], "Kant": [42.89, 74.85], "Kara-Balta": [42.81, 73.85], "Kochkor-Ata": [41.03, 72.48], "Jalal-Abad": [40.93, 73.00], "Özgön": [40.77, 73.30], "Talas": [42.52, 72.24], "Toktogul": [41.87, 72.94],
 "Pakse": [15.12, 105.80], "Luang Prabang": [19.89, 102.13], "Luang Namtha": [20.95, 101.40], "Salavan": [15.72, 106.42], "Savannakhet": [16.57, 104.75], "Muang Xay": [20.69, 101.98],
 "Aley": [33.81, 35.60], "Tyros": [33.27, 35.20], "Tripoli (Libanon)": [34.44, 35.83], "Abbasiyeh": [33.29, 35.27], "Jwaya": [33.24, 35.33],
 "Seremban": [2.73, 101.94], "George Town (Malaysia)": [5.41, 100.33], "Kota Kinabalu": [5.98, 116.07], "Kuala Lumpur": [3.14, 101.69], "Kuala Terengganu": [5.33, 103.14], "Johor Bahru": [1.49, 103.74],
 "Petaling Jaya": [3.11, 101.61], "Bandar Seri Begawan": [4.90, 114.94], "Kuching": [1.55, 110.36], "Melaka": [2.19, 102.25], "Kota Bharu": [6.13, 102.24],
 "Ulan Bator": [47.92, 106.92], "Khovd": [48.01, 91.64], "Ulaangom": [49.98, 92.07],
 "Taunggyi": [20.79, 97.04], "Mandalay": [21.98, 96.08], "Pathein": [16.78, 94.73], "Bago": [17.34, 96.48], "Monywa": [22.11, 95.14], "Naypyidaw": [19.76, 96.08],
 "Salalah": [17.02, 54.09], "Al Buraimi": [24.25, 55.79], "Seeb": [23.67, 58.19], "Saham": [24.17, 56.89], "Sohar": [24.35, 56.71], "Sur": [22.57, 59.53],
 "Bahla": [22.97, 57.30], "Fanja": [23.47, 58.11], "Al-Musannah": [23.79, 57.63], "Samail": [23.30, 57.98], "Ibri": [23.23, 56.51],
 "Al-Shahaniya": [25.37, 51.21], "Al Rayyan": [25.29, 51.42], "Al Wakrah": [25.17, 51.60], "Madinat ash Shamal": [26.13, 51.21], "Lusail": [25.42, 51.49],
 "Aleppo": [36.20, 37.13], "Homs": [34.73, 36.71], "Hama": [35.13, 36.75], "Deir ez-Zor": [35.34, 40.14], "Latakia": [35.52, 35.78], "Qamishli": [37.05, 41.23],
 "Khujand": [40.28, 69.62], "Farkhor": [37.49, 69.40], "Istaravshan": [39.91, 69.00], "Bokhtar": [37.84, 68.78], "Tursunzoda": [38.51, 68.23], "Ghafurov": [40.22, 69.73], "Kulob": [37.91, 69.78],
 "Pathum Thani": [14.02, 100.53], "Chiang Rai": [19.91, 99.84], "Chonburi": [13.36, 100.98], "Ratchaburi": [13.53, 99.81], "Buriram": [14.99, 103.10], "Sukhothai": [17.01, 99.82],
 "Prachuap Khiri Khan": [11.81, 99.80], "Rayong": [12.68, 101.28], "Ayutthaya": [14.35, 100.57], "Lamphun": [18.58, 99.01], "Pattani": [6.87, 101.25], "Uthai Thani": [15.38, 100.02], "Sisaket": [15.12, 104.32],
 "Al Ain": [24.21, 55.74], "Hatta": [24.80, 56.12], "Dubai": [25.20, 55.27], "Abu Dhabi": [24.45, 54.38], "Madinat Zayed": [23.68, 53.70], "Sharjah": [25.35, 55.42],
 "Kalba": [25.05, 56.35], "Ajman": [25.41, 55.45], "Khor Fakkan": [25.34, 56.35],
 "Andijan": [40.78, 72.34], "Buchara": [39.77, 64.42], "Kokand": [40.53, 70.94], "Muborak": [39.26, 65.15], "Qarshi": [38.86, 65.80], "Namangan": [41.00, 71.67],
 "Fergana": [40.39, 71.78], "Almalyk": [40.85, 69.60], "Navoiy": [40.10, 65.37], "Jizzax": [40.12, 67.84], "Samarkand": [39.65, 66.96], "Termiz": [37.22, 67.28], "Urgench": [41.55, 60.63],
 "Da Nang": [16.05, 108.20], "Haiphong": [20.84, 106.69], "Ho Chi Minh-staden": [10.78, 106.70], "Pleiku": [13.98, 108.00], "Nam Định": [20.42, 106.17], "Vinh": [18.68, 105.68],
 "Thanh Hóa": [19.81, 105.78], "Bình Phước": [11.54, 106.89], "Ninh Bình": [20.25, 105.97], "Hà Tĩnh": [18.34, 105.91], "Bắc Ninh": [21.19, 106.08],
}

def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|fk|sc|ac|afc|club|de|du|des|la|le|the|united|city|town|sport|sports)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)[:12] or "x"
def ascii_low(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())).strip()

have_geo = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./src/geo.js')))"], cwd=ROOT, capture_output=True, text=True).stdout)
existing_ids = set(json.loads(subprocess.run(["node", "-e", "let own=new Set();try{own=new Set(require('./src/clubs_asia.js').map(c=>c[0]))}catch(e){};console.log(JSON.stringify(require('./src/clubs.js').map(c=>c[0]).filter(id=>!own.has(id))))"], cwd=ROOT, capture_output=True, text=True).stdout))

own_geo = {}
try: own_geo = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./src/geo_asia.js')))"], cwd=ROOT, capture_output=True, text=True).stdout)
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

out = ["// Asiens högstaligor som är fullständiga i API-Football 2026 (se scripts/build-asia.py). Samma format som clubs.js.", "module.exports=["]
last = None
for r in rows:
    if r[6] != last: out.append(f"// ---- {r[3]}, {r[6]}"); last = r[6]
    out.append(json.dumps(r, ensure_ascii=False) + ",")
out.append("];")
open(os.path.join(ROOT, "src", "clubs_asia.js"), "w", encoding="utf8").write("\n".join(out) + "\n")
used_cities = {r[4] for r in rows}
open(os.path.join(ROOT, "src", "geo_asia.js"), "w", encoding="utf8").write("// koordinater för städerna i clubs_asia.js\nmodule.exports=" + json.dumps({k: v for k, v in GEO.items() if k in used_cities}, ensure_ascii=False) + ";\n")
p = os.path.join(ROOT, "tools", "extra_ids.json"); E = json.load(open(p, encoding="utf8")); E["teams"].update(extra)
open(p, "w", encoding="utf8").write(json.dumps(E, ensure_ascii=False))
print(len(rows), "nya klubbar,", len(extra), "lag-id kopplade")
