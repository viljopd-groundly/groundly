# Bygger src/clubs_world.js, src/geo_world.js och lag-id i tools/extra_ids.json för ligorna utanför Europa/USA.
# Indata: tools/teams_world.json (hämtas med workflowen "Hämta lag", input jobs).
# Kör: python3 scripts/build-world.py
# Arena, kapacitet och grundår kommer från API-Football. Namn, städer, smeknamn och rättelser nedan är handskrivna.
import json, os, re, math
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(os.path.join(ROOT, "tools", "teams_world.json"), encoding="utf8"))

# API-land + API-liga -> (vårt land, vårt liganamn, nivå, id-prefix)
LEAGUES = {
 ("Argentina", "Liga Profesional Argentina"): ("Argentina", "Liga Profesional", 1, "ar"),
 ("Brazil", "Serie A"): ("Brasilien", "Série A (Brasilien)", 1, "br"),
 ("Brazil", "Serie B"): ("Brasilien", "Série B (Brasilien)", 2, "br"),
 ("Uruguay", "Primera División"): ("Uruguay", "Primera División (Uruguay)", 1, "uy"),
 ("Chile", "Primera División"): ("Chile", "Primera División (Chile)", 1, "cl"),
 ("Colombia", "Primera A"): ("Colombia", "Primera A (Colombia)", 1, "co"),
 ("Japan", "J1 League"): ("Japan", "J1 League", 1, "jp"),
 ("Japan", "J2 League"): ("Japan", "J2 League", 2, "jp"),
 ("South-Korea", "K League 1"): ("Sydkorea", "K League 1", 1, "kr"),
 ("Saudi-Arabia", "Pro League"): ("Saudiarabien", "Saudi Pro League", 1, "sa"),
 ("Australia", "A-League"): ("Australien", "A-League", 1, "au"),
 ("Egypt", "Premier League"): ("Egypten", "Egyptian Premier League", 1, "eg"),
 ("Morocco", "Botola Pro"): ("Marocko", "Botola Pro", 1, "ma"),
 ("South-Africa", "Premier Soccer League"): ("Sydafrika", "Premiership (Sydafrika)", 1, "za"),
}

# Klubbar som redan finns i appen: API-id -> vårt id (raden i clubs.js uppdateras inte, bara kopplingen och serien)
EXISTING = {451: "boc", 435: "riv", 127: "fla", 121: "pal", 131: "cor", 128: "sfc", 2932: "hil", 2939: "nas"}

# API-id -> [namn, stad (där arenan ligger), smeknamn, extra söknamn, rättelser {arena, cap, f, land}]
T = {
 # ---- Argentina
 434: ["Gimnasia y Esgrima La Plata", "La Plata", "El Lobo", "gimnasia la plata", {}],
 436: ["Racing Club", "Avellaneda", "La Academia", "racing avellaneda", {"arena": "Estadio Presidente Perón (El Cilindro)"}],
 437: ["Rosario Central", "Rosario", "Los Canallas", "", {}],
 438: ["Vélez Sarsfield", "Buenos Aires", "El Fortín", "velez", {}],
 440: ["Belgrano", "Córdoba (Argentina)", "El Pirata", "belgrano cordoba", {"arena": "Estadio Julio César Villagra (El Gigante de Alberdi)"}],
 441: ["Unión de Santa Fe", "Santa Fe (Argentina)", "El Tatengue", "union santa fe", {}],
 442: ["Defensa y Justicia", "Florencio Varela", "El Halcón", "", {}],
 445: ["Huracán", "Buenos Aires", "El Globo", "huracan", {}],
 446: ["Lanús", "Lanús", "El Granate", "lanus", {}],
 449: ["Banfield", "Banfield", "El Taladro", "", {}],
 450: ["Estudiantes de La Plata", "La Plata", "El Pincha", "estudiantes la plata", {"arena": "Estadio Jorge Luis Hirschi (UNO)"}],
 452: ["Tigre", "Victoria (Argentina)", "El Matador", "ca tigre", {}],
 453: ["Independiente", "Avellaneda", "El Rojo", "independiente avellaneda", {}],
 455: ["Atlético Tucumán", "San Miguel de Tucumán", "El Decano", "atletico tucuman", {}],
 456: ["Talleres", "Córdoba (Argentina)", "La T", "talleres cordoba", {}],
 457: ["Newell's Old Boys", "Rosario", "La Lepra", "newells", {}],
 458: ["Argentinos Juniors", "Buenos Aires", "El Bicho", "argentinos jrs", {}],
 460: ["San Lorenzo", "Buenos Aires", "El Ciclón", "san lorenzo de almagro", {"arena": "Estadio Pedro Bidegain (Nuevo Gasómetro)"}],
 463: ["Aldosivi", "Mar del Plata", "El Tiburón", "", {}],
 473: ["Independiente Rivadavia", "Mendoza", "La Lepra mendocina", "independ rivadavia", {}],
 474: ["Sarmiento", "Junín", "El Verde", "sarmiento junin", {}],
 476: ["Deportivo Riestra", "Buenos Aires", "Malevo", "riestra", {}],
 478: ["Instituto", "Córdoba (Argentina)", "La Gloria", "instituto cordoba", {"arena": "Estadio Juan Domingo Perón (Monumental de Alta Córdoba)"}],
 1064: ["Platense", "Vicente López", "El Calamar", "", {}],
 1065: ["Central Córdoba", "Santiago del Estero", "El Ferroviario", "central cordoba de santiago", {}],
 1066: ["Gimnasia y Esgrima de Mendoza", "Mendoza", "El Lobo mendocino", "gimnasia mendoza", {}],
 2424: ["Estudiantes de Río Cuarto", "Río Cuarto", "El León del Imperio", "estudiantes rio cuarto", {}],
 2432: ["Barracas Central", "Buenos Aires", "El Guapo", "", {}],
 # ---- Brasilien
 118: ["Bahia", "Salvador", "Tricolor de Aço", "ec bahia", {}],
 119: ["Internacional", "Porto Alegre", "Colorado", "sc internacional inter porto alegre", {"arena": "Estádio Beira-Rio"}],
 120: ["Botafogo", "Rio de Janeiro", "O Glorioso", "botafogo rj", {}],
 124: ["Fluminense", "Rio de Janeiro", "Tricolor", "fluminense fc", {"arena": "Maracanã"}],
 126: ["São Paulo", "São Paulo", "Tricolor Paulista", "sao paulo fc spfc", {"arena": "Morumbis"}],
 130: ["Grêmio", "Porto Alegre", "Imortal Tricolor", "gremio", {"arena": "Arena do Grêmio"}],
 132: ["Chapecoense", "Chapecó", "Verdão do Oeste", "chapecoense sc", {}],
 133: ["Vasco da Gama", "Rio de Janeiro", "Gigante da Colina", "vasco", {"arena": "São Januário"}],
 134: ["Athletico Paranaense", "Curitiba", "Furacão", "atletico paranaense athletico pr", {"arena": "Ligga Arena (Arena da Baixada)"}],
 135: ["Cruzeiro", "Belo Horizonte", "Raposa", "cruzeiro ec", {"arena": "Mineirão"}],
 136: ["Vitória", "Salvador", "Leão da Barra", "ec vitoria", {"arena": "Barradão"}],
 147: ["Coritiba", "Curitiba", "Coxa", "coritiba fc", {"arena": "Couto Pereira"}],
 794: ["Red Bull Bragantino", "Bragança Paulista", "Massa Bruta", "rb bragantino", {}],
 1062: ["Atlético Mineiro", "Belo Horizonte", "Galo", "atletico mg atletico mineiro", {}],
 1198: ["Remo", "Belém", "Leão Azul", "clube do remo", {"arena": "Mangueirão"}],
 7848: ["Mirassol", "Mirassol", "Leão", "", {}],
 123: ["Sport Recife", "Recife", "Leão da Ilha", "sport club do recife", {}],
 125: ["América Mineiro", "Belo Horizonte", "Coelho", "america mg", {"arena": "Estádio Independência"}],
 129: ["Ceará", "Fortaleza", "Vozão", "ceara sc", {"arena": "Castelão"}],
 139: ["Ponte Preta", "Campinas", "Macaca", "", {}],
 140: ["Criciúma", "Criciúma", "Tigre", "criciuma", {}],
 142: ["Vila Nova", "Goiânia", "Tigrão", "vila nova goiania", {}],
 144: ["Atlético Goianiense", "Goiânia", "Dragão", "atletico goianiense", {}],
 145: ["Avaí", "Florianópolis", "Leão da Ilha", "avai", {"arena": "Ressacada"}],
 146: ["CRB", "Maceió", "Galo da Praia", "clube de regatas brasil", {}],
 148: ["Londrina", "Londrina", "Tubarão", "", {"arena": "Estádio do Café"}],
 151: ["Goiás", "Goiânia", "Verdão", "goias", {"arena": "Estádio da Serrinha"}],
 152: ["Juventude", "Caxias do Sul", "Papo", "", {}],
 154: ["Fortaleza", "Fortaleza", "Leão do Pici", "fortaleza ec", {"arena": "Castelão"}],
 755: ["Náutico", "Recife", "Timbu", "nautico recife", {"arena": "Estádio dos Aflitos"}],
 1193: ["Cuiabá", "Cuiabá", "Dourado", "cuiaba", {}],
 1223: ["Operário Ferroviário", "Ponta Grossa", "Fantasma", "operario pr", {}],
 2618: ["Botafogo-SP", "Ribeirão Preto", "Pantera", "botafogo sp", {}],
 7834: ["Novorizontino", "Novo Horizonte", "Tigre do Vale", "gremio novorizontino", {}],
 7865: ["São Bernardo", "São Bernardo do Campo", "Tigre do ABC", "sao bernardo", {}],
 13975: ["Athletic Club", "São João del-Rei", "Esquadrão de Aço", "athletic club mg", {}],
 # ---- Uruguay
 2348: ["Peñarol", "Montevideo", "Los Carboneros", "penarol", {}],
 2350: ["Defensor Sporting", "Montevideo", "El Violeta", "", {}],
 2352: ["Danubio", "Montevideo", "La Franja", "", {}],
 2353: ["Juventud de Las Piedras", "Las Piedras", "", "juventud", {}],
 2356: ["Nacional", "Montevideo", "Los Tricolores", "club nacional de football", {}],
 2358: ["Liverpool Montevideo", "Montevideo", "Los Negriazules", "liverpool fc montevideo", {}],
 2359: ["Racing Montevideo", "Montevideo", "La Academia", "racing club de montevideo", {}],
 2360: ["Montevideo Wanderers", "Montevideo", "Los Bohemios", "wanderers", {}],
 2361: ["Boston River", "Florida (Uruguay)", "", "", {}],
 2362: ["Cerro", "Montevideo", "Villeros", "ca cerro", {}],
 2363: ["Progreso", "Montevideo", "Los Gauchos del Pantanoso", "ca progreso", {}],
 2365: ["Montevideo City Torque", "Montevideo", "", "atletico torque city torque", {}],
 2368: ["Central Español", "Montevideo", "Los Palermitanos", "central espanol", {}],
 2369: ["Cerro Largo", "Melo", "Los Arachanes", "", {}],
 2370: ["Deportivo Maldonado", "Maldonado", "El Depor", "", {"arena": "Estadio Domingo Burgueño Miguel (Campus de Maldonado)"}],
 2378: ["Albion", "Montevideo", "", "albion fc", {}],
 # ---- Chile
 2315: ["Colo-Colo", "Santiago", "El Cacique", "colo colo", {}],
 2318: ["Palestino", "Santiago", "Los Árabes", "", {}],
 2320: ["O'Higgins", "Rancagua", "El Capo de Provincia", "ohiggins", {}],
 2323: ["Universidad de Chile", "Santiago", "La U", "u de chile", {"arena": "Estadio Nacional"}],
 2324: ["Universidad de Concepción", "Concepción (Chile)", "El Campanil", "u de concepcion", {}],
 2325: ["Everton de Viña del Mar", "Viña del Mar", "Los Ruleteros", "everton vina", {}],
 2326: ["Unión La Calera", "La Calera", "Los Cementeros", "union la calera", {}],
 2328: ["Huachipato", "Talcahuano", "Los Acereros", "", {}],
 2329: ["Audax Italiano", "Santiago", "Los Itálicos", "a italiano", {}],
 2330: ["Coquimbo Unido", "Coquimbo", "Los Piratas", "", {}],
 2331: ["Cobresal", "El Salvador (Chile)", "Los Mineros", "", {}],
 2337: ["Ñublense", "Chillán", "Los Diablos Rojos", "nublense", {}],
 2341: ["Deportes La Serena", "La Serena", "Los Papayeros", "d la serena", {}],
 2994: ["Universidad Católica", "Santiago", "Los Cruzados", "u catolica uc", {"arena": "Claro Arena", "cap": None}],
 5635: ["Deportes Concepción", "Concepción (Chile)", "Los Lilas", "concepcion", {}],
 16730: ["Deportes Limache", "Limache", "", "", {}],
 # ---- Colombia
 1125: ["Millonarios", "Bogotá", "El Embajador", "", {"arena": "Estadio El Campín"}],
 1126: ["Deportivo Pasto", "Pasto", "El Volcán", "", {}],
 1127: ["Deportivo Cali", "Palmira", "Los Azucareros", "", {}],
 1128: ["Independiente Medellín", "Medellín", "El Poderoso", "dim medellin", {}],
 1131: ["Atlético Bucaramanga", "Bucaramanga", "Los Leopardos", "bucaramanga", {}],
 1132: ["Boyacá Chicó", "Tunja", "Ajedrezados", "chico", {}],
 1133: ["Jaguares de Córdoba", "Montería", "Los Felinos", "jaguares", {}],
 1134: ["Internacional de Bogotá", "Bogotá", "", "la equidad", {}],
 1135: ["Junior", "Barranquilla", "Los Tiburones", "junior barranquilla atletico junior", {}],
 1136: ["Once Caldas", "Manizales", "El Blanco Blanco", "", {}],
 1137: ["Atlético Nacional", "Medellín", "El Verde", "atletico nacional", {}],
 1138: ["América de Cali", "Cali", "Los Diablos Rojos", "america cali", {}],
 1139: ["Santa Fe", "Bogotá", "El León", "independiente santa fe", {"arena": "Estadio El Campín"}],
 1141: ["Alianza FC", "Valledupar", "", "alianza valledupar", {"arena": "Estadio Armando Maestre Pavajeau", "cap": None}],
 1142: ["Deportes Tolima", "Ibagué", "El Vinotinto y Oro", "tolima", {}],
 1144: ["Águilas Doradas", "Rionegro", "", "aguilas doradas", {}],
 1147: ["Fortaleza CEIF", "Cota", "", "fortaleza fc", {}],
 1462: ["Deportivo Pereira", "Pereira", "El Matecaña", "pereira", {}],
 1464: ["Llaneros", "Villavicencio", "", "", {}],
 1470: ["Cúcuta Deportivo", "Cúcuta", "El Motilón", "cucuta", {}],
 # ---- Japan, J1
 281: ["Kashiwa Reysol", "Kashiwa", "", "", {}],
 282: ["Sanfrecce Hiroshima", "Hiroshima", "", "", {}],
 283: ["Shimizu S-Pulse", "Shizuoka", "", "shimizu s pulse", {}],
 285: ["V-Varen Nagasaki", "Nagasaki", "", "v varen", {"arena": "Peace Stadium"}],
 287: ["Urawa Red Diamonds", "Saitama", "Reds", "urawa reds urawa", {}],
 288: ["Nagoya Grampus", "Toyota", "", "", {}],
 289: ["Vissel Kobe", "Kobe", "", "", {}],
 290: ["Kashima Antlers", "Kashima", "", "kashima", {}],
 291: ["Cerezo Osaka", "Osaka", "", "", {}],
 292: ["FC Tokyo", "Chōfu", "", "fc tokyo tokyo", {}],
 293: ["Gamba Osaka", "Suita", "", "", {}],
 294: ["Kawasaki Frontale", "Kawasaki", "", "", {"arena": "Todoroki Stadium"}],
 296: ["Yokohama F. Marinos", "Yokohama", "", "yokohama marinos", {}],
 301: ["JEF United Chiba", "Chiba", "", "jef united", {}],
 302: ["Kyoto Sanga", "Kameoka", "", "", {}],
 303: ["Machida Zelvia", "Machida", "", "fc machida zelvia", {}],
 305: ["Mito HollyHock", "Mito", "", "mito hollyhock", {}],
 306: ["Tokyo Verdy", "Chōfu", "", "verdy tokyo", {}],
 310: ["Fagiano Okayama", "Okayama", "", "", {}],
 316: ["Avispa Fukuoka", "Fukuoka", "", "", {}],
 # ---- Japan, J2
 279: ["Hokkaido Consadole Sapporo", "Sapporo", "", "consadole sapporo", {"arena": "Sapporo Dome"}],
 280: ["Júbilo Iwata", "Iwata", "", "jubilo iwata", {}],
 284: ["Shonan Bellmare", "Hiratsuka", "", "", {}],
 286: ["Vegalta Sendai", "Sendai", "", "", {}],
 295: ["Sagan Tosu", "Tosu", "", "", {}],
 298: ["Oita Trinita", "Oita", "", "", {}],
 299: ["Tokushima Vortis", "Naruto", "", "", {}],
 307: ["Yokohama FC", "Yokohama", "", "", {}],
 308: ["Ventforet Kofu", "Kofu", "", "", {}],
 311: ["Albirex Niigata", "Niigata", "", "", {}],
 312: ["Montedio Yamagata", "Tendō", "", "", {}],
 313: ["Omiya Ardija", "Saitama", "", "rb omiya ardija", {}],
 4315: ["Blaublitz Akita", "Akita", "", "", {}],
 4317: ["Fujieda MYFC", "Fujieda", "", "", {}],
 4322: ["Kataller Toyama", "Toyama", "", "", {}],
 4326: ["Vanraure Hachinohe", "Hachinohe", "", "", {}],
 7127: ["Iwaki FC", "Iwaki", "", "iwaki", {}],
 7145: ["Tochigi City", "Tochigi", "", "", {}],
 10075: ["FC Imabari", "Imabari", "", "imabari", {}],
 10409: ["Tegevajaro Miyazaki", "Shintomi", "", "", {}],
 # ---- Sydkorea
 2745: ["Bucheon FC 1995", "Bucheon", "", "bucheon", {}],
 2746: ["Gangwon FC", "Gangneung", "", "gangwon", {}],
 2748: ["FC Anyang", "Anyang", "", "anyang", {}],
 2750: ["Daejeon Hana Citizen", "Daejeon", "", "daejeon citizen", {}],
 2759: ["Gwangju FC", "Gwangju", "", "gwangju", {}],
 2761: ["Jeju SK", "Seogwipo", "", "jeju united", {}],
 2762: ["Jeonbuk Hyundai Motors", "Jeonju", "", "jeonbuk motors jeonbuk", {}],
 2763: ["Incheon United", "Incheon", "", "", {}],
 2764: ["Pohang Steelers", "Pohang", "", "", {}],
 2766: ["FC Seoul", "Seoul", "", "seoul", {}],
 2767: ["Ulsan HD", "Ulsan", "", "ulsan hyundai", {}],
 2768: ["Gimcheon Sangmu", "Gimcheon", "", "gimcheon sangmu fc", {}],
 # ---- Saudiarabien
 2928: ["Al-Khaleej", "Dammam", "", "al khaleej saihat", {}],
 2929: ["Al-Ahli", "Jeddah", "", "al ahli jeddah", {}],
 2930: ["Al-Faisaly", "Al Majma'ah", "", "al faisaly", {}],
 2931: ["Al-Fateh", "Al-Ahsa", "", "al fateh", {}],
 2933: ["Al-Qadsiah", "Khobar", "", "al qadisiyah al qadsiah", {}],
 2934: ["Al-Ettifaq", "Dammam", "", "al ettifaq", {}],
 2936: ["Al-Taawoun", "Buraidah", "", "al taawon al taawoun", {}],
 2938: ["Al-Ittihad", "Jeddah", "", "al ittihad jeddah", {}],
 2940: ["Al-Shabab", "Riyadh", "", "al shabab", {}],
 2944: ["Al-Fayha", "Al Majma'ah", "", "al fayha", {}],
 2945: ["Al-Hazem", "Ar Rass", "", "al hazm al hazem", {}],
 2951: ["Abha", "Abha", "", "abha club", {}],
 10509: ["Al-Kholood", "Ar Rass", "", "al kholood", {}],
 10511: ["Al-Riyadh", "Riyadh", "", "al riyadh", {}],
 10513: ["NEOM SC", "Tabuk", "", "neom", {}],
 26738: ["Al-Diriyah", "Riyadh", "", "al diriyah", {"arena": "", "cap": None}],
 # ---- Australien och Nya Zeeland
 939: ["Western Sydney Wanderers", "Sydney", "The Wanderers", "wsw", {}],
 940: ["Perth Glory", "Perth (Australien)", "The Glory", "", {}],
 941: ["Central Coast Mariners", "Gosford", "The Mariners", "", {}],
 942: ["Wellington Phoenix", "Wellington", "The Nix", "", {"land": "Nya Zeeland"}],
 943: ["Sydney FC", "Sydney", "The Sky Blues", "sydney", {}],
 944: ["Melbourne Victory", "Melbourne", "", "", {}],
 945: ["Melbourne City", "Melbourne", "", "", {}],
 946: ["Newcastle Jets", "Newcastle (Australien)", "The Jets", "", {}],
 947: ["Brisbane Roar", "Brisbane", "The Roar", "", {}],
 948: ["Adelaide United", "Adelaide", "The Reds", "", {}],
 15550: ["Macarthur FC", "Campbelltown", "The Bulls", "macarthur", {}],
 24608: ["Auckland FC", "Auckland", "The Black Knights", "auckland", {"land": "Nya Zeeland", "f": 2024}],
 # ---- Egypten
 1031: ["Al-Masry", "Port Said", "", "al masry", {"arena": "Port Said Stadium", "cap": None}],
 1036: ["Pyramids FC", "Kairo", "", "pyramids", {}],
 1037: ["ENPPI", "Kairo", "", "enppi", {}],
 1039: ["Tala'ea El Gaish", "Kairo", "", "el geish talaea el gaish", {}],
 1040: ["Zamalek", "Kairo", "Den vita riddaren", "zamalek sc", {}],
 1041: ["Petrojet", "Kairo", "", "", {}],
 1044: ["Smouha", "Alexandria", "", "smouha sc", {}],
 1046: ["Wadi Degla", "Kairo", "", "", {}],
 1572: ["Al-Ittihad Alexandria", "Alexandria", "", "al ittihad alexandria", {}],
 1574: ["El Gouna", "El Gouna", "", "el gouna fc", {}],
 1575: ["Arab Contractors", "Kairo", "", "el mokawloon al mokawloon", {}],
 1577: ["Al Ahly", "Kairo", "Röda djävlarna", "al ahly sc", {"arena": "Kairos internationella stadion", "cap": 74100}],
 7520: ["Misr Lel Makkasa", "Kairo", "", "masr", {}],
 13819: ["Ghazl El Mahalla", "El-Mahalla El-Kubra", "", "ghazl el mehalla", {}],
 13822: ["El Qanah", "Ismailia", "", "olympic el qanah", {}],
 14651: ["Ceramica Cleopatra", "Kairo", "", "", {}],
 15570: ["National Bank of Egypt", "Kairo", "", "nbe", {}],
 15731: ["Abu Qir Fertilizers", "Alexandria", "", "abu qair semad", {}],
 16431: ["Future FC", "Kairo", "", "", {}],
 18021: ["Petrol Asyut", "Asyut", "", "asyut petrol", {}],
 # ---- Marocko
 962: ["RS Berkane", "Berkane", "", "renaissance berkane", {}],
 964: ["Difaâ El Jadida", "El Jadida", "", "difaa el jadida", {}],
 965: ["Moghreb Tétouan", "Tétouan", "", "moghreb tetouan", {}],
 968: ["Wydad Casablanca", "Casablanca", "", "wydad ac", {}],
 969: ["AS FAR", "Rabat", "", "far rabat", {}],
 971: ["Kawkab Marrakech", "Marrakech", "", "", {}],
 973: ["Hassania Agadir", "Agadir", "", "", {}],
 974: ["Ittihad Tanger", "Tanger", "", "ir tanger", {}],
 976: ["Raja Casablanca", "Casablanca", "", "raja ca", {}],
 977: ["FUS Rabat", "Rabat", "", "fath union sport", {}],
 3449: ["Renaissance Zemamra", "Zemamra", "", "cr khemis zemamra", {}],
 3453: ["Maghreb Fès", "Fès", "", "maghreb fes mas fes", {}],
 3458: ["Widad Témara", "Témara", "", "widad temara", {}],
 14806: ["Union Touarga", "Rabat", "", "uts rabat", {}],
 18753: ["Amal Tiznit", "Tiznit", "", "", {"arena": "", "cap": None}],
 22218: ["CODM Meknès", "Meknès", "", "codm meknes", {}],
 # ---- Sydafrika
 2669: ["AmaZulu", "Durban", "Usuthu", "amazulu", {}],
 2682: ["Marumo Gallants", "Bloemfontein", "", "", {}],
 2690: ["Golden Arrows", "Hammarsdale", "Abafana Bes'thende", "lamontville golden arrows", {}],
 2691: ["Kaizer Chiefs", "Johannesburg", "Amakhosi", "", {"arena": "FNB Stadium"}],
 2693: ["Polokwane City", "Polokwane", "", "", {"arena": "Old Peter Mokaba Stadium"}],
 2698: ["Chippa United", "East London", "Chilli Boys", "", {}],
 2699: ["Mamelodi Sundowns", "Pretoria", "Masandawana", "sundowns", {}],
 2700: ["Orlando Pirates", "Johannesburg", "The Buccaneers", "", {}],
 4905: ["Stellenbosch FC", "Stellenbosch", "", "stellenbosch", {}],
 8074: ["TS Galaxy", "Mbombela", "", "", {}],
 10567: ["Richards Bay", "Durban", "", "richards bay fc", {}],
 15537: ["Sekhukhune United", "Polokwane", "", "", {}],
 22234: ["Milford FC", "Durban", "", "milford", {}],
 24757: ["Durban City", "Durban", "", "", {"arena": "", "cap": None}],
 24759: ["Kruger United", "Mbombela", "", "", {}],
 26299: ["Siwelele", "Bloemfontein", "", "siwelele fc", {"arena": "", "cap": None}],
}

# koordinater för städerna ovan (arenans ort)
GEO = {
 "La Plata": [-34.921, -57.955], "Avellaneda": [-34.663, -58.365], "Rosario": [-32.947, -60.639], "Córdoba (Argentina)": [-31.420, -64.188],
 "Santa Fe (Argentina)": [-31.633, -60.700], "Florencio Varela": [-34.807, -58.276], "Lanús": [-34.700, -58.392], "Banfield": [-34.744, -58.398],
 "Victoria (Argentina)": [-34.452, -58.546], "San Miguel de Tucumán": [-26.808, -65.217], "Mar del Plata": [-38.005, -57.543], "Mendoza": [-32.890, -68.844],
 "Junín": [-34.585, -60.946], "Vicente López": [-34.527, -58.475], "Santiago del Estero": [-27.784, -64.264], "Río Cuarto": [-33.123, -64.349],
 "Salvador": [-12.978, -38.502], "Porto Alegre": [-30.035, -51.218], "Chapecó": [-27.101, -52.616], "Curitiba": [-25.429, -49.271],
 "Belo Horizonte": [-19.917, -43.935], "Bragança Paulista": [-22.952, -46.542], "Belém": [-1.456, -48.490], "Mirassol": [-20.817, -49.521],
 "Recife": [-8.048, -34.877], "Fortaleza": [-3.732, -38.527], "Campinas": [-22.906, -47.061], "Criciúma": [-28.678, -49.370],
 "Goiânia": [-16.686, -49.265], "Florianópolis": [-27.595, -48.548], "Maceió": [-9.665, -35.735], "Londrina": [-23.304, -51.169],
 "Caxias do Sul": [-29.168, -51.179], "Cuiabá": [-15.601, -56.097], "Ponta Grossa": [-25.095, -50.162], "Ribeirão Preto": [-21.178, -47.810],
 "Novo Horizonte": [-21.468, -49.221], "São Bernardo do Campo": [-23.694, -46.565], "São João del-Rei": [-21.136, -44.262],
 "Las Piedras": [-34.726, -56.220], "Florida (Uruguay)": [-34.099, -56.214], "Melo": [-32.370, -54.168], "Maldonado": [-34.900, -54.950],
 "Rancagua": [-34.170, -70.741], "Concepción (Chile)": [-36.827, -73.050], "Viña del Mar": [-33.025, -71.552], "La Calera": [-32.788, -71.189],
 "Talcahuano": [-36.725, -73.117], "Coquimbo": [-29.953, -71.339], "El Salvador (Chile)": [-26.246, -69.623], "Chillán": [-36.607, -72.103],
 "La Serena": [-29.904, -71.249], "Limache": [-33.017, -71.267],
 "Bogotá": [4.711, -74.072], "Pasto": [1.214, -77.281], "Palmira": [3.539, -76.303], "Medellín": [6.244, -75.581], "Bucaramanga": [7.119, -73.123],
 "Tunja": [5.535, -73.368], "Montería": [8.748, -75.881], "Manizales": [5.067, -75.517], "Cali": [3.452, -76.532], "Valledupar": [10.464, -73.253],
 "Ibagué": [4.438, -75.232], "Rionegro": [6.155, -75.374], "Cota": [4.810, -74.103], "Pereira": [4.814, -75.694], "Villavicencio": [4.142, -73.627],
 "Cúcuta": [7.894, -72.508],
 "Kashiwa": [35.868, 139.976], "Hiroshima": [34.385, 132.455], "Shizuoka": [34.976, 138.383], "Nagasaki": [32.750, 129.878], "Saitama": [35.861, 139.646],
 "Toyota": [35.083, 137.156], "Kobe": [34.690, 135.196], "Kashima": [35.966, 140.645], "Osaka": [34.694, 135.502], "Chōfu": [35.652, 139.541],
 "Suita": [34.759, 135.517], "Kawasaki": [35.531, 139.703], "Yokohama": [35.444, 139.638], "Chiba": [35.607, 140.106], "Kameoka": [35.013, 135.573],
 "Machida": [35.546, 139.439], "Mito": [36.366, 140.471], "Okayama": [34.655, 133.919], "Fukuoka": [33.590, 130.402], "Sapporo": [43.062, 141.354],
 "Iwata": [34.718, 137.851], "Hiratsuka": [35.336, 139.350], "Sendai": [38.268, 140.870], "Tosu": [33.378, 130.506], "Oita": [33.240, 131.613],
 "Naruto": [34.172, 134.609], "Kofu": [35.662, 138.568], "Niigata": [37.916, 139.036], "Tendō": [38.362, 140.378], "Akita": [39.720, 140.103],
 "Fujieda": [34.867, 138.258], "Toyama": [36.696, 137.214], "Hachinohe": [40.512, 141.488], "Iwaki": [37.051, 140.888], "Tochigi": [36.382, 139.734],
 "Imabari": [34.066, 132.998], "Shintomi": [32.069, 131.488],
 "Bucheon": [37.503, 126.766], "Gangneung": [37.752, 128.876], "Anyang": [37.394, 126.957], "Daejeon": [36.351, 127.385], "Gwangju": [35.160, 126.851],
 "Seogwipo": [33.254, 126.560], "Jeonju": [35.824, 127.148], "Incheon": [37.456, 126.705], "Pohang": [36.019, 129.343], "Ulsan": [35.539, 129.311],
 "Gimcheon": [36.140, 128.114],
 "Dammam": [26.421, 50.089], "Jeddah": [21.486, 39.193], "Al Majma'ah": [25.904, 45.346], "Al-Ahsa": [25.383, 49.587], "Khobar": [26.279, 50.208],
 "Buraidah": [26.326, 43.975], "Ar Rass": [25.869, 43.497], "Abha": [18.216, 42.505], "Tabuk": [28.383, 36.567],
 "Perth (Australien)": [-31.950, 115.860], "Gosford": [-33.425, 151.342], "Wellington": [-41.287, 174.776], "Melbourne": [-37.814, 144.963],
 "Newcastle (Australien)": [-32.928, 151.782], "Brisbane": [-27.470, 153.026], "Adelaide": [-34.929, 138.601], "Campbelltown": [-34.065, 150.814],
 "Port Said": [31.265, 32.302], "Kairo": [30.044, 31.236], "Alexandria": [31.200, 29.919], "El Gouna": [27.395, 33.678], "El-Mahalla El-Kubra": [30.976, 31.166],
 "Ismailia": [30.597, 32.272], "Asyut": [27.181, 31.183],
 "Berkane": [34.920, -2.320], "El Jadida": [33.254, -8.507], "Tétouan": [35.570, -5.368], "Casablanca": [33.573, -7.590], "Marrakech": [31.629, -7.981],
 "Agadir": [30.427, -9.598], "Tanger": [35.759, -5.834], "Zemamra": [32.630, -8.700], "Fès": [34.033, -5.000], "Témara": [33.928, -6.907],
 "Tiznit": [29.698, -9.731], "Meknès": [33.895, -5.555],
 "Durban": [-29.858, 31.022], "Bloemfontein": [-29.085, 26.159], "Hammarsdale": [-29.794, 30.660], "Polokwane": [-23.904, 29.469],
 "East London": [-33.015, 27.912], "Pretoria": [-25.747, 28.229], "Stellenbosch": [-33.932, 18.861], "Mbombela": [-25.475, 30.970],
}

def slug(s):
    import unicodedata
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|sc|cf|ca|cd|club|de|del|la|el|al|united|city)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s[:10] or "x"

def ascii_low(s):
    import unicodedata
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())).strip()

rows, ids, extra, used = [], {}, {}, set()
for c in W["countries"]:
    for L in c.get("leagues", []):
        land0, lname, tier, cc = LEAGUES[(c["country"], L["name"])]
        for t in L["teams"]:
            if t["id"] in EXISTING:
                extra[str(t["id"])] = EXISTING[t["id"]]; continue
            name, city, nick, al, fix = T[t["id"]]
            v = t.get("venue") or {}
            arena = fix.get("arena", (v.get("name") or "").replace("&apos;", "'"))
            cap = fix["cap"] if "cap" in fix else v.get("capacity")
            founded = fix.get("f", t.get("founded"))
            land = fix.get("land", land0)
            cid = cc + "-" + slug(name)
            while cid in used: cid += "x"
            used.add(cid); extra[str(t["id"])] = cid
            alias = " ".join(dict.fromkeys(x for x in [ascii_low(name), ascii_low(t["name"]), al] if x and x != name.lower()))
            rows.append([cid, name, alias, land, city, founded, lname, tier, arena, cap, nick, [], 1])
            assert city in GEO or city in ("Buenos Aires", "Rio de Janeiro", "São Paulo", "Santos", "Montevideo", "Santiago", "Barranquilla", "Seoul", "Riyadh", "Sydney", "Auckland", "Rabat", "Johannesburg"), city

# rader
out = ["// Ligor i Sydamerika, Asien, Oceanien och Afrika 2026 (lag, arenor och kapacitet från API-Football okt 2026, se scripts/build-world.py). Samma format som clubs.js.", "module.exports=["]
last = None
for r in rows:
    if r[6] != last: out.append(f"// ---- {r[3]}, {r[6]}"); last = r[6]
    out.append(json.dumps(r, ensure_ascii=False) + ",")
out.append("];")
open(os.path.join(ROOT, "src", "clubs_world.js"), "w", encoding="utf8").write("\n".join(out) + "\n")
open(os.path.join(ROOT, "src", "geo_world.js"), "w", encoding="utf8").write("// koordinater för städerna i clubs_world.js\nmodule.exports=" + json.dumps(GEO, ensure_ascii=False) + ";\n")
p = os.path.join(ROOT, "tools", "extra_ids.json"); E = json.load(open(p, encoding="utf8")); E["teams"].update(extra)
open(p, "w", encoding="utf8").write(json.dumps(E, ensure_ascii=False))
print(len(rows), "nya klubbar,", len(extra), "lag-id kopplade")
