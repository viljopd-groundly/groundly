# Bygger src/clubs_europe.js och src/geo_europe.js: högstaligorna i de europeiska länder som saknades
# (Albanien … Wales, plus hela ligan i Azerbajdzjan, Slovakien och Ukraina där bara enstaka klubbar fanns).
# Indata: tools/teams_world3.json (workflowen "Hämta lag", okt 2026). Kör: python3 scripts/build-europe.py
# Arena, kapacitet och grundår kommer från API-Football; namn, städer och koordinater är handskrivna nedan.
import json, os, re, unicodedata, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(os.path.join(ROOT, "tools", "teams_world3.json"), encoding="utf8"))
# Oceanien (Nya Zeeland och Fiji; övriga OFC-länders ligor finns inte i API-Football)
W["countries"] += json.load(open(os.path.join(ROOT, "tools", "teams_world4.json"), encoding="utf8"))["countries"]

# API-land + liga -> (vårt land, vårt liganamn, id-prefix). Liganamnen måste vara unika i appen.
LEAGUES = {
 ("Albania", "Superliga"): ("Albanien", "Kategoria Superiore", "al"),
 ("Andorra", "1a Divisió"): ("Andorra", "Primera Divisió (Andorra)", "ad"),
 ("Armenia", "Premier League"): ("Armenien", "Premier League (Armenien)", "am"),
 ("Azerbaijan", "Premyer Liqa"): ("Azerbajdzjan", "Premjer Liqa", "az"),
 ("Belarus", "Premier League"): ("Belarus", "Premier League (Belarus)", "by"),
 ("Bosnia", "Premijer Liga"): ("Bosnien och Hercegovina", "Premijer liga (Bosnien)", "ba"),
 ("Bulgaria", "First League"): ("Bulgarien", "Parva liga", "bg"),
 ("Cyprus", "1. Division"): ("Cypern", "First Division (Cypern)", "cy"),
 ("Estonia", "Meistriliiga"): ("Estland", "Meistriliiga", "ee"),
 ("Faroe-Islands", "Meistaradeildin"): ("Färöarna", "Betri deildin", "fo"),
 ("Georgia", "Erovnuli Liga"): ("Georgien", "Erovnuli Liga", "ge"),
 ("Gibraltar", "Premier Division"): ("Gibraltar", "Gibraltar Football League", "gi"),
 ("Israel", "Ligat Ha'al"): ("Israel", "Ligat HaAl", "il"),
 ("Kazakhstan", "Premier League"): ("Kazakstan", "Premier League (Kazakstan)", "kz"),
 ("Kosovo", "Superliga"): ("Kosovo", "Superliga (Kosovo)", "xk"),
 ("Latvia", "Virsliga"): ("Lettland", "Virslīga", "lv"),
 ("Lithuania", "A Lyga"): ("Litauen", "A lyga", "lt"),
 ("Luxembourg", "National Division"): ("Luxemburg", "BGL Ligue", "lu"),
 ("Malta", "Premier League"): ("Malta", "Premier League (Malta)", "mt"),
 ("Moldova", "Super Liga"): ("Moldavien", "Super Liga (Moldavien)", "md"),
 ("Montenegro", "First League"): ("Montenegro", "Prva liga (Montenegro)", "me"),
 ("Macedonia", "First League"): ("Nordmakedonien", "Prva liga (Nordmakedonien)", "mk"),
 ("Northern-Ireland", "Premiership"): ("Nordirland", "NIFL Premiership", "nir"),
 ("Romania", "Liga I"): ("Rumänien", "Liga I", "ro"),
 ("Russia", "Premier League"): ("Ryssland", "Premjer-liga (Ryssland)", "ru"),
 ("San-Marino", "Campionato"): ("San Marino", "Campionato Sammarinese", "sm"),
 ("Slovakia", "Super Liga"): ("Slovakien", "Niké liga", "sk"),
 ("Slovenia", "1. SNL"): ("Slovenien", "PrvaLiga (Slovenien)", "si"),
 ("Ukraine", "Premier League"): ("Ukraina", "Premjer-liha", "ua"),
 ("Wales", "Premier League"): ("Wales", "Cymru Premier", "wal"),
 ("New-Zealand", "National League - National"): ("Nya Zeeland", "National League (Nya Zeeland)", "nz"),
 ("Fiji", "National Football League"): ("Fiji", "National Football League (Fiji)", "fj"),
}
# klubbar som redan finns i appen (API-id -> vårt id); de får bara kopplingen till API-laget
EXISTING = {656: "slo", 550: "sha", 13976: "sbh"}

# API-id -> namn, stad (där laget spelar), [arena, kapacitet] om API:t har fel
N = {
 # Albanien
 605: ["Skënderbeu Korçë", "Korçë"], 694: ["KF Tirana", "Tirana"], 708: ["Partizani Tirana", "Tirana"], 2256: ["KF Laçi", "Laç"],
 3320: ["Teuta Durrës", "Durrës"], 3326: ["Dinamo Tirana", "Elbasan"], 3327: ["Egnatia Rrogozhinë", "Rrogozhinë"], 3339: ["Vllaznia Shkodër", "Shkodër"],
 3340: ["KF Vora", "Vorë"], 20406: ["AF Elbasani", "Elbasan"],
 # Andorra
 591: ["FC Santa Coloma", "Santa Coloma"], 3342: ["Inter Club d'Escaldes", "Santa Coloma"], 3344: ["FC Ordino", "Santa Coloma"],
 3345: ["Atlètic Club d'Escaldes", "Sant Julià de Lòria"], 3346: ["Carroi", "Sant Julià de Lòria"], 3352: ["Penya Encarnada", "Santa Coloma"],
 3353: ["UE Rangers", "Sant Julià de Lòria"], 3354: ["Sporting Escaldes", "Ordino"], 19195: ["Esperança d'Andorra", "Andorra la Vella"], 27343: ["Casa de Portugal", "Andorra la Vella"],
 # Armenien
 582: ["Alashkert", "Jerevan"], 688: ["Gandzasar Kapan", "Kapan"], 709: ["Pyunik", "Jerevan"], 2276: ["Urartu", "Jerevan"], 3682: ["Ararat Jerevan", "Jerevan"],
 3683: ["Ararat-Armenia", "Jerevan"], 3684: ["FC Noah", "Armavir"], 3686: ["Shirak Gyumri", "Gyumri"], 6279: ["BKMA Jerevan", "Jerevan"], 6286: ["FC Van", "Charentsavan"],
 20087: ["Syunik", "Kapan"], 26198: ["Sardarapat", "Armavir"],
 # Azerbajdzjan
 556: ["Qarabağ", "Baku"], 627: ["Qəbələ", "Qabala"], 648: ["Zirə", "Zira"], 666: ["Şamaxı", "Baku"], 2270: ["Neftçi Baku", "Baku"], 5490: ["Kəpəz", "Ganja"],
 5499: ["Turan Tovuz", "Tovuz"], 5503: ["Sumqayıt", "Sumgait"], 5570: ["İmişli", "Saatlı"], 11238: ["Araz-Naxçıvan", "Nachitjevan"], 25318: ["Safa Baku", "Baku"],
 # Belarus
 380: ["FK Minsk", "Minsk"], 382: ["Vitebsk", "Vitebsk"], 384: ["Dnepr Mogilev", "Mogiljov"], 385: ["Torpedo Zjodino", "Zjodino"], 386: ["Dinamo Brest", "Brest"],
 387: ["Neman Grodno", "Grodno"], 388: ["BATE Borisov", "Borisov"], 389: ["FK Gomel", "Gomel"], 391: ["Isloch Minsk", "Molodetjno"], 394: ["Dinamo Minsk", "Minsk"],
 750: ["Naftan Novopolotsk", "Novopolotsk"], 751: ["Slavia Mozyr", "Mozyr"], 3383: ["Baranovitji", "Baranovitji"], 3384: ["Belshina Bobrujsk", "Bobrujsk"],
 7808: ["ML Vitebsk", "Rogatjov"], 9419: ["Arsenal Dzerzjinsk", "Dzerzjinsk"],
 # Bosnien
 588: ["Zrinjski Mostar", "Mostar"], 642: ["Široki Brijeg", "Široki Brijeg"], 654: ["Željezničar", "Sarajevo"], 679: ["FK Sarajevo", "Sarajevo"],
 3359: ["Radnik Bijeljina", "Bijeljina"], 3363: ["Čelik Zenica", "Zenica"], 3364: ["Borac Banja Luka", "Banja Luka"], 3381: ["Velež Mostar", "Mostar"],
 8504: ["Sloga Doboj", "Doboj"], 21736: ["BSK Banja Luka", "Banja Luka"],
 # Bulgarien
 566: ["Ludogorets", "Razgrad"], 634: ["Botev Plovdiv", "Plovdiv"], 646: ["Levski Sofia", "Sofia"], 683: ["Dunav Ruse", "Ruse"], 851: ["Tjerno More Varna", "Varna"],
 853: ["CSKA Sofia", "Sofia"], 854: ["Slavia Sofia", "Sofia"], 856: ["Septemvri Sofia", "Sofia"], 858: ["Lokomotiv Plovdiv", "Plovdiv"], 859: ["Botev Vratsa", "Vratsa"],
 1416: ["Lokomotiv Sofia", "Sofia"], 1426: ["CSKA 1948", "Sofia"], 1430: ["Arda Kardzjali", "Kardzjali"], 4660: ["Spartak Varna", "Varna"],
 # Cypern
 602: ["Apollon Limassol", "Limassol"], 614: ["AEK Larnaca", "Larnaca"], 2247: ["APOEL", "Nicosia"], 2269: ["Anorthosis Famagusta", "Larnaca"], 3396: ["AEL Limassol", "Limassol"],
 3401: ["Nea Salamis", "Larnaca"], 3402: ["Omonia Nicosia", "Nicosia"], 3403: ["Pafos FC", "Paphos"], 3408: ["Aris Limassol", "Limassol"], 3413: ["Karmiotissa", "Limassol"],
 3415: ["Olympiakos Nicosia", "Nicosia"], 3416: ["Omonia Aradippou", "Aradippou"], 3424: ["Krasava Ypsonas", "Ypsonas"], 14126: ["Omonia 29is Maiou", "Nicosia"],
 # Estland
 662: ["Nõmme Kalju", "Tallinn"], 687: ["Flora Tallinn", "Tallinn"], 2273: ["Levadia Tallinn", "Tallinn"], 2274: ["Narva Trans", "Narva"], 3525: ["Vaprus Pärnu", "Pärnu"],
 3526: ["FC Kuressaare", "Kuressaare"], 3528: ["Paide Linnameeskond", "Paide"], 3530: ["Tartu Tammeka", "Tartu"], 10059: ["Nõmme United", "Tallinn"], 18657: ["Laagri", "Tallinn"],
 # Färöarna
 580: ["Víkingur Gøta", "Gøta"], 678: ["B36 Tórshavn", "Tórshavn"], 682: ["NSÍ Runavík", "Runavík"], 701: ["KÍ Klaksvík", "Klaksvík"], 4133: ["HB Tórshavn", "Tórshavn"],
 4174: ["07 Vestur", "Sørvágur"], 4177: ["EB/Streymur", "Streymnes"], 4184: ["AB Argir", "Argir"], 4186: ["B68 Toftir", "Toftir"], 4191: ["Skála ÍF", "Skáli"],
 # Georgien
 685: ["Torpedo Kutaisi", "Kutaisi"], 705: ["Dinamo Batumi", "Kobuleti"], 2262: ["Dinamo Tbilisi", "Tbilisi"], 3499: ["Dila Gori", "Gori"], 3501: ["Rustavi", "Rustavi"],
 3502: ["Iberia 1999", "Tbilisi"], 3505: ["Gagra", "Tbilisi"], 10017: ["Samgurali", "Martvili"], 13847: ["Meshakhte Tkibuli", "Tkibuli"], 14864: ["Spaeri", "Tbilisi"],
 # Gibraltar (nästan alla spelar på Victoria Stadium)
 667: ["Lincoln Red Imps", "Gibraltar"], 698: ["St Joseph's", "Gibraltar"], 10125: ["Europa FC", "Gibraltar"], 16130: ["College 1975", "Gibraltar"], 16131: ["Europa Point", "Gibraltar"],
 16132: ["Glacis United", "Gibraltar"], 16133: ["Lions Gibraltar", "Gibraltar"], 16134: ["Lynx", "Gibraltar"], 16135: ["Magpies", "Gibraltar"], 16137: ["Mons Calpe", "Gibraltar"],
 16790: ["Hound Dogs", "Gibraltar", "Victoria Stadium", 5000],
 # Israel
 563: ["Hapoel Beer Sheva", "Beersheba"], 604: ["Maccabi Tel Aviv", "Tel Aviv"], 657: ["Beitar Jerusalem", "Jerusalem"], 2253: ["Hapoel Haifa", "Haifa"], 4195: ["Maccabi Haifa", "Haifa"],
 4481: ["Bnei Sakhnin", "Sakhnin"], 4486: ["Hapoel Katamon Jerusalem", "Jerusalem"], 4488: ["Hapoel Petah Tikva", "Petah Tikva"], 4489: ["Hapoel Ramat Gan", "Ramat Gan"],
 4495: ["Maccabi Petah Tikva", "Petah Tikva"], 4501: ["Hapoel Tel Aviv", "Tel Aviv"], 4505: ["Maccabi Netanya", "Netanya"], 4510: ["Ironi Kiryat Shmona", "Kiryat Shmona"], 6181: ["Ironi Tiberias", "Tiberias"],
 # Kazakstan
 562: ["FK Astana", "Astana", "Astana Arena", 30000], 664: ["Kairat Almaty", "Almaty"], 692: ["Ordabasy", "Sjymkent"], 2259: ["Tobol Kostanaj", "Kostanaj"],
 4544: ["Altaj Semej", "Semej"], 4552: ["Kaspij Aktau", "Aktau"], 4554: ["Kyzyl-Zhar", "Petropavl"], 4558: ["Okzhetpes", "Kokshetau"], 4560: ["Zhetysu", "Taldykorgan"],
 4562: ["Kaisar", "Kyzylorda"], 4563: ["Aktobe", "Aktobe"], 4564: ["Atyrau", "Atyrau"], 4565: ["Irtysh Pavlodar", "Pavlodar"], 16611: ["Zhenis", "Karaganda"],
 21010: ["Ulytau", "Zjezkazgan"], 21011: ["Elimai Semej", "Semej"],
 # Kosovo
 680: ["Prishtina", "Pristina"], 4132: ["Feronikeli", "Drenas"], 12733: ["Ballkani", "Suhareka"], 12772: ["Gjilani", "Gjilan"], 14281: ["Drita", "Gjilan"],
 14392: ["Drenica", "Skenderaj"], 14393: ["Dukagjini", "Klina"], 14395: ["Llapi", "Podujeva"], 14396: ["Vushtrria", "Pristina"], 15576: ["Malisheva", "Malisheva"],
 # Lettland
 661: ["FK Liepāja", "Liepāja"], 4135: ["Auda", "Riga"], 4138: ["Grobiņa", "Grobiņa"], 4143: ["Super Nova", "Jūrmala"], 4144: ["Tukums 2000", "Tukums"],
 4149: ["BFC Daugavpils", "Daugavpils"], 4160: ["RFS", "Riga"], 10124: ["Riga FC", "Riga"], 18834: ["FS Jelgava", "Jelgava"], 18936: ["Ogre United", "Ogre"],
 # Litauen
 586: ["Žalgiris Vilnius", "Vilnius", "LFF stadionas", 5067], 612: ["Sūduva Marijampolė", "Marijampolė"], 638: ["FK Trakai", "Vilnius"], 3858: ["Banga Gargždai", "Gargždai"],
 3860: ["Džiugas Telšiai", "Telšiai"], 3861: ["Hegelmann", "Kaunas"], 3870: ["FA Šiauliai", "Šiauliai"], 3872: ["Kauno Žalgiris", "Kaunas"], 3874: ["FK Panevėžys", "Panevėžys"],
 18878: ["TransINVEST", "Širvintos"],
 # Luxemburg
 578: ["F91 Dudelange", "Dudelange"], 658: ["Progrès Niederkorn", "Niederkorn"], 684: ["FC Differdange 03", "Differdange"], 2030: ["Racing FC Union", "Luxemburg"],
 2033: ["US Rumelange", "Rumelange"], 2034: ["Jeunesse Esch", "Esch-sur-Alzette"], 2035: ["UN Käerjeng 97", "Bascharage"], 2036: ["UNA Strassen", "Strassen"],
 2037: ["US Mondorf-les-Bains", "Mondorf-les-Bains"], 2038: ["Victoria Rosport", "Rosport"], 2040: ["US Hostert", "Hostert"], 2042: ["Etzella Ettelbruck", "Ettelbruck"],
 11906: ["FC Wiltz 71", "Wiltz"], 11907: ["Swift Hesperange", "Hesperange"], 15847: ["Atert Bissen", "Bissen"], 15900: ["Résidence Walferdange", "Walferdange"],
 # Malta
 659: ["Valletta FC", "Ta' Qali"], 696: ["Balzan", "Ħamrun"], 2264: ["Gżira United", "Ta' Qali"], 2277: ["Birkirkara", "Birkirkara"], 3884: ["Hibernians", "Paola"],
 4622: ["Żabbar St. Patrick", "Żabbar"], 4625: ["Floriana", "Floriana"], 4626: ["Ħamrun Spartans", "Ħamrun"], 4627: ["Mosta", "Mosta"], 4628: ["Sliema Wanderers", "Paola"],
 14507: ["Marsaxlokk", "Marsaxlokk"], 16533: ["Birżebbuġa St. Peter's", "Ta' Qali"],
 # Moldavien
 568: ["Sheriff Tiraspol", "Tiraspol"], 691: ["Milsami Orhei", "Orhei"], 2271: ["Petrocub Hîncești", "Hîncești"], 4633: ["Zimbru Chișinău", "Chișinău"],
 5375: ["Dacia Buiucani", "Chișinău"], 5379: ["Sireți", "Sireți"], 14008: ["CSF Bălți", "Bălți"], 26115: ["Politehnica UTM", "Chișinău"],
 # Montenegro
 579: ["Budućnost Podgorica", "Podgorica"], 673: ["Sutjeska Nikšić", "Nikšić"], 3740: ["Mornar Bar", "Bar"], 3741: ["OFK Petrovac", "Petrovac"], 3742: ["Arsenal Tivat", "Tivat"],
 3744: ["Bokelj Kotor", "Kotor"], 3745: ["Dečić Tuzi", "Tuzi"], 3748: ["Jezero Plav", "Plav"], 3751: ["Otrant-Olympic", "Ulcinj"], 16749: ["Mladost DG", "Podgorica"],
 # Nordmakedonien
 574: ["Vardar Skopje", "Skopje"], 609: ["Shkëndija", "Tetovo"], 4331: ["Sileks Kratovo", "Kratovo"], 4332: ["FK Skopje", "Skopje"], 4333: ["Bregalnica Štip", "Štip"],
 4346: ["Struga", "Struga"], 4348: ["Tikveš Kavadarci", "Kavadarci"], 19753: ["Arsimi", "Tetovo"], 22153: ["Bashkimi Kumanovo", "Kumanovo"], 24781: ["Shkëndija Haraçinë", "Skopje"],
 # Nordirland
 583: ["Linfield", "Belfast"], 668: ["Ballymena United", "Ballymena"], 669: ["Coleraine", "Coleraine"], 697: ["Crusaders", "Belfast"], 2266: ["Cliftonville", "Belfast"],
 5348: ["Portadown", "Portadown"], 5350: ["Carrick Rangers", "Carrickfergus"], 5351: ["Dungannon Swifts", "Dungannon"], 5352: ["Glentoran", "Belfast"], 5354: ["Larne", "Larne"],
 11112: ["Bangor", "Bangor (Nordirland)"], 11114: ["Limavady United", "Limavady"],
 # Rumänien
 559: ["FCSB", "Bukarest"], 632: ["Universitatea Craiova", "Craiova"], 635: ["Dinamo București", "Bukarest"], 2246: ["CFR Cluj", "Cluj-Napoca"], 2578: ["FC Voluntari", "Voluntari"],
 2581: ["FC Botoșani", "Botoșani"], 2585: ["Sepsi OSK", "Sfântu Gheorghe"], 2589: ["UTA Arad", "Arad"], 2592: ["FC Argeș", "Mioveni"], 2596: ["Farul Constanța", "Ovidiu"],
 2598: ["Petrolul Ploiești", "Ploiești"], 2599: ["Universitatea Cluj", "Cluj-Napoca"], 6230: ["Csíkszereda", "Miercurea Ciuc"], 6231: ["Rapid București", "Bukarest"],
 6886: ["Oțelul Galați", "Galați"], 20034: ["Corvinul Hunedoara", "Hunedoara"],
 # Ryssland
 555: ["CSKA Moskva", "Moskva"], 558: ["Spartak Moskva", "Moskva"], 596: ["Zenit", "Sankt Petersburg"], 597: ["Lokomotiv Moskva", "Moskva"], 621: ["FK Krasnodar", "Krasnodar"],
 779: ["FK Rostov", "Rostov-na-Donu"], 1079: ["Krylja Sovetov", "Samara"], 1080: ["FK Orenburg", "Orenburg"], 1083: ["Rubin Kazan", "Kazan"], 1085: ["Achmat Groznyj", "Groznyj"],
 1088: ["Dynamo Moskva", "Moskva"], 1993: ["Fakel Voronezj", "Voronezj"], 2006: ["Baltika Kaliningrad", "Kaliningrad"], 6786: ["Akron Toljatti", "Samara"],
 6813: ["Dinamo Machatjkala", "Kaspijsk"], 6822: ["Rodina Moskva", "Moskva"],
 # San Marino
 672: ["SS Folgore/Falciano", "Falciano"], 700: ["SP Tre Penne", "San Marino"], 2249: ["SP La Fiorita", "Montegiardino"], 2260: ["SP Tre Fiori", "Fiorentino"], 5297: ["SP Cailungo", "Borgo Maggiore"],
 5298: ["SS Cosmos", "Serravalle"], 5299: ["SC Domagnano", "Domagnano"], 5300: ["SC Faetano", "Faetano"], 5301: ["SS Fiorentino", "Fiorentino"], 5302: ["SS Juvenes/Dogana", "Serravalle"],
 5303: ["AC Libertas", "Borgo Maggiore"], 5305: ["SS Murata", "San Marino"], 5306: ["SS Pennarossa", "Chiesanuova"], 5307: ["SS San Giovanni", "Borgo Maggiore"], 5308: ["SS Virtus", "Acquaviva"],
 22179: ["San Marino Academy", "Serravalle", "San Marino Stadium", 6664],
 # Slovakien
 655: ["AS Trenčín", "Trenčín"], 1120: ["Spartak Trnava", "Trnava"], 2257: ["DAC Dunajská Streda", "Dunajská Streda"], 3548: ["Železiarne Podbrezová", "Podbrezová"],
 3549: ["MFK Ružomberok", "Ružomberok"], 3552: ["Zemplín Michalovce", "Michalovce"], 3554: ["MŠK Žilina", "Žilina"], 10533: ["Dukla Banská Bystrica", "Banská Bystrica"],
 10534: ["FK Košice", "Košice"], 10535: ["KFC Komárno", "Zlaté Moravce"], 10542: ["MFK Skalica", "Skalica"],
 # Slovenien
 552: ["NK Maribor", "Maribor"], 677: ["Olimpija Ljubljana", "Ljubljana"], 4197: ["NŠ Mura", "Murska Sobota"], 4358: ["NK Aluminij", "Kidričevo"], 4359: ["NK Bravo", "Ljubljana"],
 4360: ["NK Celje", "Celje"], 4374: ["FC Koper", "Koper"], 4376: ["Nafta 1903", "Lendava"], 4378: ["NK Radomlje", "Domžale"], 12744: ["Brinje Grosuplje", "Grosuplje"],
 # Ukraina
 572: ["Dynamo Kyiv", "Kyiv"], 599: ["Zorja Luhansk", "Kyiv"], 3615: ["Tjornomorets Odesa", "Odesa"], 3617: ["Karpaty Lviv", "Lviv"], 3627: ["Kolos Kovalivka", "Kovalivka"],
 3628: ["Metalist 1925 Charkiv", "Charkiv"], 3630: ["Obolon Kyiv", "Kyiv"], 6486: ["Bukovyna Tjernivtsi", "Tjernivtsi"], 6489: ["Kryvbas Kryvyj Rih", "Kryvyj Rih"],
 6496: ["Polissja Zjytomyr", "Zjytomyr"], 6501: ["Veres Rivne", "Lutsk"], 14434: ["Epitsentr Kamjanets-Podilskyj", "Ternopil"], 17161: ["LNZ Tjerkasy", "Tjerkasy"],
 17162: ["Livyj Bereh Kyiv", "Kyiv"], 21953: ["Kudrivka", "Kyiv"],
 # Wales
 353: ["Cardiff Met", "Cardiff"], 354: ["The New Saints", "Oswestry"], 356: ["Caernarfon Town", "Caernarfon"], 357: ["Connah's Quay Nomads", "Flint"], 361: ["Barry Town United", "Barry"],
 362: ["Llandudno", "Llandudno"], 2188: ["Ammanford", "Ammanford"], 2191: ["Penybont", "Bridgend"], 2194: ["Haverfordwest County", "Haverfordwest"],
 2201: ["Briton Ferry Llansawel", "Briton Ferry"], 2202: ["Cambrian & Clydach", "Clydach Vale"], 4909: ["Airbus UK Broughton", "Broughton"], 5611: ["Colwyn Bay", "Colwyn Bay"],
 5614: ["Flint Town United", "Flint"], 6459: ["Holywell Town", "Holywell"], 6479: ["Trefelin", "Cwmafan"],
 # Nya Zeeland
 2535: ["Wellington Phoenix Reserves", "Lower Hutt"], 2537: ["Auckland City", "Auckland"], 13977: ["Eastern Suburbs", "Auckland"], 20642: ["Napier City Rovers", "Napier"],
 20646: ["Wellington Olympic", "Wellington"], 20649: ["Auckland United", "Auckland"], 20650: ["Birkenhead United", "Auckland"], 20651: ["Cashmere Technical", "Christchurch"],
 20662: ["Ferrymead Bays", "Christchurch"], 20672: ["Miramar Rangers", "Wellington"], 26722: ["Auckland FC Reserves", "Auckland"],
 # Fiji
 4382: ["Ba FC", "Ba"], 4383: ["Labasa FC", "Labasa"], 4384: ["Lautoka FC", "Lautoka"], 4385: ["Nadi FC", "Nadi"], 4386: ["Nasinu FC", "Suva"], 4387: ["Rewa FC", "Nausori"],
 4388: ["Suva FC", "Suva"], 4389: ["Tavua FC", "Tavua"], 4392: ["Nadroga FC", "Sigatoka"], 10078: ["Navua FC", "Navua"],
}

# grundår där API:t saknar uppgift (bara säkra uppgifter)
FOUNDED = {20642: 1973, 20646: 1953, 20650: 1960, 20651: 1912, 20662: 1970, 20672: 1907, 6231: 1923, 634: 1912, 2585: 2011, 648: 2014, 5490: 1959, 3499: 1949, 3501: 1948, 10017: 1945, 698: 1912, 10125: 1925, 16130: 1975, 16132: 1965,
 16133: 1966, 16134: 2007, 16137: 2013, 4510: 2000, 4552: 1962, 4562: 1968, 4132: 1974, 12733: 1947, 4135: 1967, 2271: 1994, 3744: 1922, 6786: 2018, 6822: 2015,
 5298: 1979, 5299: 1966, 5300: 1962, 5301: 1974, 5305: 1966, 5306: 1968, 5307: 1948, 5308: 1964, 3627: 2012, 6496: 2016, 17161: 2005, 17162: 2017, 6459: 1893, 4378: 1972, 6230: 2015}

# koordinater (lat, lon) för städerna ovan som inte redan finns i geo-filerna
GEO = {
 "Korçë": [40.62, 20.78], "Laç": [41.64, 19.71], "Durrës": [41.32, 19.45], "Elbasan": [41.11, 20.08], "Rrogozhinë": [41.08, 19.67], "Shkodër": [42.07, 19.51], "Vorë": [41.39, 19.66], "Tirana": [41.33, 19.82],
 "Santa Coloma": [42.49, 1.50], "Sant Julià de Lòria": [42.46, 1.49], "Ordino": [42.56, 1.53], "Andorra la Vella": [42.51, 1.52],
 "Jerevan": [40.18, 44.51], "Kapan": [39.21, 46.41], "Armavir": [40.15, 44.04], "Gyumri": [40.79, 43.85], "Charentsavan": [40.40, 44.64],
 "Baku": [40.41, 49.87], "Qabala": [40.98, 47.85], "Zira": [40.36, 50.29], "Ganja": [40.68, 46.36], "Tovuz": [40.99, 45.63], "Sumgait": [40.59, 49.67], "Saatlı": [39.93, 48.37], "Nachitjevan": [39.21, 45.41],
 "Minsk": [53.90, 27.56], "Vitebsk": [55.19, 30.20], "Mogiljov": [53.90, 30.33], "Zjodino": [54.10, 28.33], "Brest": [52.10, 23.69], "Grodno": [53.68, 23.83], "Borisov": [54.23, 28.50],
 "Gomel": [52.43, 30.99], "Molodetjno": [54.31, 26.85], "Novopolotsk": [55.53, 28.60], "Mozyr": [52.05, 29.25], "Baranovitji": [53.13, 26.01], "Bobrujsk": [53.14, 29.22], "Rogatjov": [53.09, 30.05], "Dzerzjinsk": [53.68, 27.14],
 "Mostar": [43.34, 17.81], "Široki Brijeg": [43.38, 17.59], "Sarajevo": [43.86, 18.41], "Bijeljina": [44.76, 19.21], "Zenica": [44.20, 17.91], "Banja Luka": [44.77, 17.19], "Doboj": [44.73, 18.09],
 "Razgrad": [43.53, 26.52], "Plovdiv": [42.14, 24.75], "Sofia": [42.70, 23.32], "Ruse": [43.85, 25.97], "Varna": [43.21, 27.91], "Vratsa": [43.21, 23.56], "Kardzjali": [41.65, 25.37],
 "Limassol": [34.68, 33.04], "Larnaca": [34.92, 33.62], "Nicosia": [35.17, 33.36], "Paphos": [34.77, 32.42], "Aradippou": [34.95, 33.59], "Ypsonas": [34.69, 32.96],
 "Tallinn": [59.44, 24.75], "Narva": [59.38, 28.19], "Pärnu": [58.39, 24.50], "Kuressaare": [58.25, 22.48], "Paide": [58.89, 25.56], "Tartu": [58.38, 26.72],
 "Gøta": [62.20, -6.74], "Tórshavn": [62.01, -6.77], "Runavík": [62.11, -6.72], "Klaksvík": [62.23, -6.59], "Sørvágur": [62.07, -7.31], "Streymnes": [62.19, -7.02], "Argir": [61.99, -6.77], "Toftir": [62.09, -6.73], "Skáli": [62.15, -6.78],
 "Kutaisi": [42.27, 42.70], "Kobuleti": [41.82, 41.78], "Tbilisi": [41.72, 44.79], "Gori": [41.98, 44.11], "Rustavi": [41.55, 45.01], "Martvili": [42.41, 42.38], "Tkibuli": [42.35, 42.99],
 "Gibraltar": [36.14, -5.35],
 "Beersheba": [31.25, 34.79], "Tel Aviv": [32.08, 34.78], "Jerusalem": [31.77, 35.21], "Haifa": [32.79, 34.99], "Sakhnin": [32.86, 35.30], "Petah Tikva": [32.09, 34.88], "Ramat Gan": [32.08, 34.81],
 "Netanya": [32.32, 34.85], "Kiryat Shmona": [33.21, 35.57], "Tiberias": [32.79, 35.53],
 "Astana": [51.13, 71.43], "Almaty": [43.24, 76.89], "Sjymkent": [42.32, 69.59], "Kostanaj": [53.21, 63.62], "Semej": [50.41, 80.23], "Aktau": [43.65, 51.17], "Petropavl": [54.87, 69.14],
 "Kokshetau": [53.28, 69.39], "Taldykorgan": [45.02, 78.37], "Kyzylorda": [44.85, 65.51], "Aktobe": [50.28, 57.17], "Atyrau": [47.09, 51.92], "Pavlodar": [52.29, 76.97], "Karaganda": [49.80, 73.10], "Zjezkazgan": [47.78, 67.71],
 "Pristina": [42.66, 21.17], "Drenas": [42.63, 20.89], "Suhareka": [42.36, 20.83], "Gjilan": [42.46, 21.47], "Skenderaj": [42.75, 20.79], "Klina": [42.62, 20.58], "Podujeva": [42.91, 21.19], "Malisheva": [42.48, 20.75],
 "Riga": [56.95, 24.11], "Liepāja": [56.51, 21.01], "Grobiņa": [56.54, 21.17], "Jūrmala": [56.97, 23.77], "Tukums": [56.97, 23.16], "Daugavpils": [55.87, 26.53], "Jelgava": [56.65, 23.72], "Ogre": [56.82, 24.60],
 "Vilnius": [54.69, 25.28], "Kaunas": [54.90, 23.90], "Marijampolė": [54.56, 23.35], "Gargždai": [55.71, 21.40], "Telšiai": [55.98, 22.25], "Šiauliai": [55.93, 23.31], "Panevėžys": [55.73, 24.36], "Širvintos": [55.04, 24.96],
 "Luxemburg": [49.61, 6.13], "Dudelange": [49.48, 6.09], "Niederkorn": [49.54, 5.89], "Differdange": [49.52, 5.89], "Rumelange": [49.46, 6.03], "Esch-sur-Alzette": [49.50, 5.98], "Bascharage": [49.57, 5.91],
 "Strassen": [49.62, 6.07], "Mondorf-les-Bains": [49.50, 6.28], "Rosport": [49.81, 6.50], "Hostert": [49.66, 6.23], "Ettelbruck": [49.85, 6.10], "Wiltz": [49.97, 5.93], "Hesperange": [49.57, 6.15], "Bissen": [49.79, 6.07], "Walferdange": [49.66, 6.13],
 "Ta' Qali": [35.89, 14.42], "Ħamrun": [35.88, 14.48], "Birkirkara": [35.90, 14.46], "Paola": [35.87, 14.51], "Żabbar": [35.87, 14.54], "Floriana": [35.89, 14.51], "Mosta": [35.91, 14.43], "Marsaxlokk": [35.84, 14.54],
 "Chișinău": [47.01, 28.86], "Tiraspol": [46.84, 29.63], "Orhei": [47.38, 28.82], "Hîncești": [46.83, 28.59], "Sireți": [47.15, 28.68], "Bălți": [47.76, 27.93],
 "Podgorica": [42.44, 19.26], "Nikšić": [42.77, 18.94], "Bar": [42.10, 19.10], "Petrovac": [42.21, 18.94], "Tivat": [42.43, 18.70], "Kotor": [42.42, 18.77], "Tuzi": [42.37, 19.33], "Plav": [42.60, 19.94], "Ulcinj": [41.93, 19.21],
 "Skopje": [42.00, 21.43], "Tetovo": [42.01, 20.97], "Kratovo": [42.08, 22.18], "Štip": [41.74, 22.19], "Struga": [41.18, 20.68], "Kavadarci": [41.43, 22.01], "Kumanovo": [42.13, 21.71],
 "Belfast": [54.60, -5.93], "Ballymena": [54.86, -6.28], "Coleraine": [55.13, -6.67], "Portadown": [54.42, -6.44], "Carrickfergus": [54.72, -5.81], "Dungannon": [54.50, -6.77], "Larne": [54.85, -5.82],
 "Bangor (Nordirland)": [54.66, -5.67], "Limavady": [55.05, -6.95],
 "Bukarest": [44.43, 26.10], "Craiova": [44.32, 23.80], "Cluj-Napoca": [46.77, 23.59], "Voluntari": [44.49, 26.18], "Botoșani": [47.75, 26.67], "Sfântu Gheorghe": [45.86, 25.79], "Arad": [46.18, 21.31],
 "Mioveni": [44.96, 24.94], "Ovidiu": [44.26, 28.56], "Ploiești": [44.94, 26.03], "Miercurea Ciuc": [46.36, 25.80], "Galați": [45.44, 28.05], "Hunedoara": [45.75, 22.90],
 "Moskva": [55.76, 37.62], "Sankt Petersburg": [59.93, 30.36], "Krasnodar": [45.04, 38.98], "Rostov-na-Donu": [47.24, 39.71], "Samara": [53.20, 50.15], "Orenburg": [51.77, 55.10], "Kazan": [55.79, 49.12],
 "Groznyj": [43.32, 45.69], "Voronezj": [51.67, 39.18], "Kaliningrad": [54.71, 20.51], "Kaspijsk": [42.88, 47.64],
 "Falciano": [43.95, 12.48], "San Marino": [43.94, 12.45], "Montegiardino": [43.91, 12.48], "Fiorentino": [43.91, 12.46], "Borgo Maggiore": [43.94, 12.45], "Serravalle": [43.97, 12.48],
 "Domagnano": [43.95, 12.47], "Faetano": [43.93, 12.50], "Chiesanuova": [43.92, 12.42], "Acquaviva": [43.95, 12.42],
 "Bratislava": [48.15, 17.11], "Trenčín": [48.89, 18.04], "Trnava": [48.38, 17.59], "Dunajská Streda": [47.99, 17.62], "Podbrezová": [48.82, 19.52], "Ružomberok": [49.08, 19.30], "Michalovce": [48.75, 21.92],
 "Žilina": [49.22, 18.74], "Banská Bystrica": [48.74, 19.15], "Košice": [48.72, 21.26], "Zlaté Moravce": [48.38, 18.40], "Skalica": [48.85, 17.23],
 "Ljubljana": [46.06, 14.51], "Maribor": [46.56, 15.65], "Murska Sobota": [46.66, 16.17], "Kidričevo": [46.40, 15.79], "Celje": [46.24, 15.27], "Koper": [45.55, 13.73], "Lendava": [46.56, 16.45], "Domžale": [46.14, 14.59], "Grosuplje": [45.96, 14.66],
 "Kyiv": [50.45, 30.52], "Lviv": [49.84, 24.03], "Odesa": [46.48, 30.72], "Kovalivka": [50.17, 30.52], "Charkiv": [49.99, 36.23], "Tjernivtsi": [48.29, 25.94], "Kryvyj Rih": [47.91, 33.39], "Zjytomyr": [50.25, 28.66],
 "Lutsk": [50.75, 25.33], "Ternopil": [49.55, 25.59], "Tjerkasy": [49.44, 32.06],
 "Cardiff": [51.48, -3.18], "Oswestry": [52.86, -3.05], "Caernarfon": [53.14, -4.27], "Flint": [53.24, -3.13], "Barry": [51.40, -3.27], "Llandudno": [53.32, -3.83], "Ammanford": [51.79, -3.99], "Bridgend": [51.50, -3.58],
 "Lower Hutt": [-41.21, 174.90], "Auckland": [-36.85, 174.76], "Napier": [-39.49, 176.91], "Wellington": [-41.29, 174.78], "Christchurch": [-43.53, 172.64],
 "Ba": [-17.53, 177.68], "Labasa": [-16.43, 179.38], "Lautoka": [-17.62, 177.45], "Nadi": [-17.80, 177.42], "Suva": [-18.14, 178.44], "Nausori": [-18.03, 178.53], "Tavua": [-17.44, 177.86], "Sigatoka": [-18.14, 177.51], "Navua": [-18.22, 178.17],
 "Haverfordwest": [51.80, -4.97], "Briton Ferry": [51.63, -3.82], "Clydach Vale": [51.62, -3.47], "Broughton": [53.17, -2.99], "Colwyn Bay": [53.29, -3.73], "Holywell": [53.27, -3.22], "Cwmafan": [51.61, -3.77],
}

def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|fk|sc|ss|sp|nk|kf|ac|afc|club|de|the|united|city|town)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)[:12] or "x"
def ascii_low(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())).strip()
def clean_arena(s):
    return (s or "").replace("&apos;", "'").strip() or None

# befintliga stadskoordinater (så att samma stad inte läggs in två gånger)
have_geo = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./src/geo.js')))"], cwd=ROOT, capture_output=True, text=True).stdout)
existing_ids = set(json.loads(subprocess.run(["node", "-e", "const own=new Set(require('./src/clubs_europe.js').map(c=>c[0]));console.log(JSON.stringify(require('./src/clubs.js').map(c=>c[0]).filter(id=>!own.has(id))))"], cwd=ROOT, capture_output=True, text=True).stdout))

rows, extra, used, missing = [], {}, set(), []
for c in W["countries"]:
    for L in c.get("leagues", []):
        key = (c["country"], L["name"])
        if key not in LEAGUES: raise SystemExit(f"okänd liga {key}")
        land, lname, cc = LEAGUES[key]
        for t in L["teams"]:
            if t["id"] in EXISTING: extra[str(t["id"])] = EXISTING[t["id"]]; continue
            if t["id"] not in N: missing.append(f'{t["id"]} {t["name"]}'); continue
            nm = N[t["id"]]; name, city = nm[0], nm[1]
            v = t.get("venue") or {}
            arena = nm[2] if len(nm) > 2 else clean_arena(v.get("name"))
            cap = nm[3] if len(nm) > 3 else v.get("capacity")
            founded = t.get("founded") or FOUNDED.get(t["id"]) or None
            if founded == 0: founded = None
            cid = cc + "-" + slug(name)
            while cid in used or cid in existing_ids: cid += "x"
            used.add(cid); extra[str(t["id"])] = cid
            alias = " ".join(dict.fromkeys(x for x in [ascii_low(name), ascii_low(t["name"])] if x))
            rows.append([cid, name, alias, land, city, founded, lname, 1, arena, cap, "", [], 1])
            if city not in GEO and city not in have_geo: raise SystemExit(f"koordinater saknas för {city}")
if missing: raise SystemExit("lag utan namn: " + ", ".join(missing))

out = ["// Högstaligorna i Europas övriga länder 2026/27 (lag, arenor och kapacitet från API-Football okt 2026, se scripts/build-europe.py). Samma format som clubs.js.", "module.exports=["]
last = None
for r in rows:
    if r[6] != last: out.append(f"// ---- {r[3]}, {r[6]}"); last = r[6]
    out.append(json.dumps(r, ensure_ascii=False) + ",")
out.append("];")
open(os.path.join(ROOT, "src", "clubs_europe.js"), "w", encoding="utf8").write("\n".join(out) + "\n")
geo = {k: v for k, v in GEO.items() if k not in have_geo or k in {r[4] for r in rows}}
open(os.path.join(ROOT, "src", "geo_europe.js"), "w", encoding="utf8").write("// koordinater för städerna i clubs_europe.js\nmodule.exports=" + json.dumps(geo, ensure_ascii=False) + ";\n")
p = os.path.join(ROOT, "tools", "extra_ids.json"); E = json.load(open(p, encoding="utf8")); E["teams"].update(extra)
open(p, "w", encoding="utf8").write(json.dumps(E, ensure_ascii=False))
print(len(rows), "nya klubbar,", len(extra), "lag-id kopplade")
