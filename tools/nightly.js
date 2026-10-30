// Groundly: nattlig uppdatering av säsongsdata från openfootball (CC0).
// Körs i en tom mapp: node nightly.js <mapp med clubs.json, overrides.json, ftxt.js> <utmapp>
// Klonar openfootball-repona, läser innevarande säsong och skriver
//   <utmapp>/data/fixtures.json            (matchschemat som appen läser)
//   <utmapp>/archive/<liga>/<säsong>.json   (innevarande säsong i arkivet)
const fs=require("fs"),path=require("path"),{execSync}=require("child_process");
const TOOLS=path.resolve(process.argv[2]||__dirname),OUT=path.resolve(process.argv[3]||"out"),WORK=path.resolve("of_src");
const {parse}=require(path.join(TOOLS,"ftxt.js"));
// API:t skickar ibland namn dubbelkodade ("Ã\x96stman"); rättas när svaret läses in
const FIXR=require(path.join(TOOLS,"fixtext.js")).fixReplacer;
const clubs=JSON.parse(fs.readFileSync(path.join(TOOLS,"clubs.json"),"utf8"));const OVR=JSON.parse(fs.readFileSync(path.join(TOOLS,"overrides.json"),"utf8"));
fs.mkdirSync(WORK,{recursive:true});
for(const r of ["england","deutschland","espana","italy","europe","football.json"]){const d=path.join(WORK,r);
  if(fs.existsSync(d))execSync(`git -C ${d} pull -q --depth 1`,{stdio:"inherit"});else execSync(`git clone -q --depth 1 https://github.com/openfootball/${r}.git ${d}`,{stdio:"inherit"});}
// innevarande säsong: från juli räknas nästa säsong
const now=new Date();const y=now.getUTCFullYear(),m=now.getUTCMonth()+1;const sy=m>=7?y:y-1;const SEASON=`${sy}-${String((sy+1)%100).padStart(2,"0")}`;
const STOP=new Set("fc cf sc sv vfl vfb tsg fk ac as bc kv sk afc club clube de ssc rb ev cd ud rc rcd ca sd calcio us ss acf ogc losc sbv bvo sad fsv bsc spvgg tsv sg vv cfc if ik bk ff fk il aif ifk sk fotboll fotball 1 1893 1899 1900 1901 1903 1904 1905 1906 1907 1909 1910 1913 1917 1919 1846 1848 04 05 07 08 09 29 96 98 63 65 and the of".split(" "));
const norm=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/å/gi,"a").toLowerCase().replace(/\(.*?\)/g,"").replace(/&/g," ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w&&!STOP.has(w)).join(" ");
const idx=clubs.map(c=>({c,keys:[...new Set([norm(c[1]),...String(c[2]||"").split(/\s{2,}|,/).map(norm)])].filter(Boolean)}));
const byId=Object.fromEntries(clubs.map(c=>[c[0],c]));
function find(raw,country){const name=raw.replace(/\s*\([A-Z]{3}\)\s*$/,"").replace(/\s*\[[^\]]*\]\s*/g," ").trim();
  if(OVR[name]!==undefined)return OVR[name]?byId[OVR[name]]||null:null;if(/\bII$/.test(name)){const par=find(name.replace(/\s*\bII$/,""),country);return par&&byId[par[0]+"2"]||null;}if(/\bII\b|\bU2[13]\b| B$/.test(name))return null;
  const n=norm(name);if(!n)return null;const pool=idx.filter(x=>x.c[3]===country||(country==="England"&&x.c[3]==="Wales")||(country==="Frankrike"&&x.c[3]==="Monaco"));
  let hit=pool.filter(x=>x.keys.includes(n));if(hit.length===1)return hit[0].c;
  const nt=n.split(" ");hit=pool.filter(x=>x.keys.some(k=>{const kt=k.split(" ");return kt.length&&(kt.every(t=>nt.includes(t))||nt.every(t=>kt.includes(t)))&&k.length>=5;}));
  return hit.length===1?hit[0].c:null;}
function iso(date,time,zone){const[yy,mo,d]=date.split("-").map(Number);const lastSun=mm=>{const t=new Date(Date.UTC(yy,mm,0));return t.getUTCDate()-t.getUTCDay();};
  const dst=(mo>3&&mo<10)||(mo===3&&d>=lastSun(3))||(mo===10&&d<lastSun(10));const base=zone==="UK"?0:1;const[h,mi]=time.split(":").map(Number);return new Date(Date.UTC(yy,mo-1,d,h-base-(dst?1:0),mi)).toISOString();}
const sf=(rel)=>path.join(WORK,rel.replace("{S}",SEASON));
// [kod, liganamn, land, nivå, tidszon, txt-fil, football.json-fil]
const L=[["en.1","Premier League","England",1,"UK","england/{S}/1-premierleague.txt","football.json/{S}/en.1.json"],
 ["en.2","Championship","England",2,"UK","england/{S}/2-championship.txt","football.json/{S}/en.2.json"],
 ["es.1","La Liga","Spanien",1,"CE","espana/{S}/1-liga.txt","football.json/{S}/es.1.json"],
 ["it.1","Serie A","Italien",1,"CE","italy/{S}/1-seriea.txt","football.json/{S}/it.1.json"],
 ["de.1","Bundesliga","Tyskland",1,"CE",`deutschland/openliga/{S}_de.1.txt`,"football.json/{S}/de.1.json"],
 ["de.2","2. Bundesliga","Tyskland",2,"CE",`deutschland/openliga/{S}_de.2.txt`,null],
 ["de.3","3. Liga","Tyskland",3,"CE",`deutschland/openliga/{S}_de.3.txt`,null],
 ["de.cup","DFB-Pokal","Tyskland","CUP","CE",`deutschland/openliga/{S}_de.cup.txt`,null],
 ["fr.1","Ligue 1","Frankrike",1,"CE","europe/france/{S}_fr1.txt","football.json/{S}/fr.1.json"],
 ["nl.1","Eredivisie","Nederländerna",1,"CE","europe/netherlands/{S}_nl1.txt","football.json/{S}/nl.1.json"],
 ["pt.1","Primeira Liga","Portugal",1,"UK","europe/portugal/{S}_pt1.txt","football.json/{S}/pt.1.json"],
 ["sco.1","Scottish Premiership","Skottland",1,"UK","europe/scotland/{S}_sco1.txt",null]];
const rows=[],stat={};
for(const[code,lname,country,tier,zone,txt,fj] of L){const seen=new Set();let ms=[];
  if(fs.existsSync(sf(txt)))ms=parse(fs.readFileSync(sf(txt),"utf8")).map(x=>({...x,src:"txt"}));
  if(fj&&fs.existsSync(sf(fj))){const j=JSON.parse(fs.readFileSync(sf(fj),"utf8"));(j.matches||[]).forEach(x=>ms.push({date:x.date,time:x.time||"",round:x.round||"",t1:x.team1,t2:x.team2,ft:x.score&&x.score.ft||null,pen:"",src:"json"}));}
  if(!ms.length)continue;
  const teams=[],tix={};const T=nm=>{if(nm in tix)return tix[nm];const c=find(nm,country);tix[nm]=teams.length;teams.push(c?[nm,c[0]]:[nm]);return tix[nm];};
  const arc=[];let n=0;
  for(const x of ms){const H=find(x.t1,country),A=find(x.t2,country);const k=(H?H[0]:x.t1)+"|"+(A?A[0]:x.t2);if(seen.has(k))continue;seen.add(k);
    arc.push([T(x.t1),T(x.t2),x.date,x.time,x.ft?x.ft[0]:null,x.ft?x.ft[1]:null,x.pen||"",tier==="CUP"?x.round:""]);
    if(H&&A){rows.push([H[0],A[0],x.time?iso(x.date,x.time,zone):null,x.date,x.ft?`${x.ft[0]}–${x.ft[1]}`:"",lname,String(tier)]);n++;}}
  fs.mkdirSync(path.join(OUT,"archive",code),{recursive:true});
  fs.writeFileSync(path.join(OUT,"archive",code,SEASON+".json"),JSON.stringify({l:lname,s:SEASON.replace("-","/"),c:country,tier,t:teams,m:arc}));
  stat[lname]=n;}
// ---- API-Football (valfritt): körs bara om API_FOOTBALL_KEY är satt ----
// Hämtar matcher och resultat för alla serier och cuper nedan, officiella tabeller, skytte-, assist- och kortligor,
// spelarstatistik per klubb och målskyttar i spelade matcher. Allt skrivs till out/data/*.json.
// [vårt liganamn, vårt land (för namnmatchning), API-land, nivå, arkivkod, regex mot API:ets liganamn]
const API=[
 ["Premier League","England","England",1,"en.1",/^premier league$/],["Championship","England","England",2,"en.2",/^championship$/],
 ["League One","England","England",3,"en.3",/^league one$/],["League Two","England","England",4,"en.4",/^league two$/],["National League","England","England",5,"en.5",/^national league$/],
 ["National League North","England","England",6,"en.6n",/^national league\W+north$/],["National League South","England","England",6,"en.6s",/^national league\W+south$/],
 ["FA-cupen","England","England","CUP","en.fa",/^fa cup$/],["Ligacupen","England","England","CUP","en.lc",/^(league cup|efl cup|carabao cup)$/],["EFL Trophy","England","England","CUP","en.trophy",/^(efl trophy|football league trophy)$/],
 ["La Liga","Spanien","Spain",1,"es.1",/^la liga$/],["Segunda División","Spanien","Spain",2,"es.2",/^segunda divisi(o|ó)n$/],["Copa del Rey","Spanien","Spain","CUP","es.cup",/^copa del rey$/],
 ["Serie A","Italien","Italy",1,"it.1",/^serie a$/],["Serie B","Italien","Italy",2,"it.2",/^serie b$/],["Coppa Italia","Italien","Italy","CUP","it.cup",/^coppa italia$/],
 ["Bundesliga","Tyskland","Germany",1,"de.1",/^bundesliga$/],["2. Bundesliga","Tyskland","Germany",2,"de.2",/^2\. bundesliga$/],["3. Liga","Tyskland","Germany",3,"de.3",/^3\. liga$/],
 ["Regionalliga Nord","Tyskland","Germany",4,"de.4n",/^regionalliga\W+nord$/],["Regionalliga Nordost","Tyskland","Germany",4,"de.4no",/^regionalliga\W+nordost$/],["Regionalliga West","Tyskland","Germany",4,"de.4w",/^regionalliga\W+west$/],
 ["Regionalliga Südwest","Tyskland","Germany",4,"de.4sw",/^regionalliga\W+s(u|ü)d\W*west$/],["Regionalliga Bayern","Tyskland","Germany",4,"de.4b",/^regionalliga\W+bayern$/],["DFB-Pokal","Tyskland","Germany","CUP","de.cup",/^dfb pokal$/],
 ["Ligue 1","Frankrike","France",1,"fr.1",/^ligue 1$/],["Ligue 2","Frankrike","France",2,"fr.2",/^ligue 2$/],["Coupe de France","Frankrike","France","CUP","fr.cup",/^coupe de france$/],
 ["Eredivisie","Nederländerna","Netherlands",1,"nl.1",/^eredivisie$/],["Eerste Divisie","Nederländerna","Netherlands",2,"nl.2",/^eerste divisie$/],["KNVB-bekern","Nederländerna","Netherlands","CUP","nl.cup",/^knvb beker$/],
 ["Primeira Liga","Portugal","Portugal",1,"pt.1",/^(primeira liga|liga portugal)$/],["Liga Portugal 2","Portugal","Portugal",2,"pt.2",/^(segunda liga|liga portugal 2)$/],["Taça de Portugal","Portugal","Portugal","CUP","pt.cup",/^ta(c|ç)a de portugal$/],
 ["Scottish Premiership","Skottland","Scotland",1,"sco.1",/^premiership$/],["Scottish Championship","Skottland","Scotland",2,"sco.2",/^championship$/],["Skotska cupen","Skottland","Scotland","CUP","sco.cup",/^(fa cup|scottish cup)$/],
 ["Pro League","Belgien","Belgium",1,"be.1",/^(jupiler )?pro league$/],["Challenger Pro League","Belgien","Belgium",2,"be.2",/^challenger pro league$/],["Belgiska cupen","Belgien","Belgium","CUP","be.cup",/^(cup|croky cup|beker van belgie)$/],
 ["Allsvenskan","Sverige","Sweden",1,"se.1",/^allsvenskan$/],["Superettan","Sverige","Sweden",2,"se.2",/^superettan$/],["Svenska cupen","Sverige","Sweden","CUP","se.cup",/^svenska cupen$/],["Kval till Ettan","Sverige","Sweden","CUP","se.3q",/^ettan - relegation round$/],["Ettan Norra","Sverige","Sweden",3,"se.3n",/^ettan - norra$/],["Ettan Södra","Sverige","Sweden",3,"se.3s",/^ettan - s[öo]dra$/],
 ["Eliteserien","Norge","Norway",1,"no.1",/^eliteserien$/],["OBOS-ligaen","Norge","Norway",2,"no.2",/^(1\. division|obos-ligaen)$/],["NM-cupen","Norge","Norway","CUP","no.cup",/^nm cupen$/],
 ["Superligaen","Danmark","Denmark",1,"dk.1",/^superliga$/],["1. division (Danmark)","Danmark","Denmark",2,"dk.2",/^1\. division$/],["DBU Pokalen","Danmark","Denmark","CUP","dk.cup",/^dbu pokalen$/],
 ["Veikkausliiga","Finland","Finland",1,"fi.1",/^veikkausliiga$/],["Ykkösliiga","Finland","Finland",2,"fi.2",/^(ykk(o|ö)sliiga|ykk(o|ö)nen)$/],
 ["Besta deild","Island","Iceland",1,"is.1",/^(besta deild|(u|ú)rvalsdeild)$/],["Lengjudeild","Island","Iceland",2,"is.2",/^(lengjudeild|1\. deild)$/],
 ["Ekstraklasa","Polen","Poland",1,"pl.1",/^ekstraklasa$/],["I liga","Polen","Poland",2,"pl.2",/^i liga$/],
 ["MLS","USA","USA",1,"us.1",/^major league soccer$/],
 ["Liga Profesional","Argentina","Argentina",1,"ar.1",/^liga profesional argentina$/],["Série A (Brasilien)","Brasilien","Brazil",1,"br.1",/^serie a$/],["Série B (Brasilien)","Brasilien","Brazil",2,"br.2",/^serie b$/],
 ["Primera División (Uruguay)","Uruguay","Uruguay",1,"uy.1",/^primera divisi(o|ó)n$/],["Primera División (Chile)","Chile","Chile",1,"cl.1",/^primera divisi(o|ó)n$/],["Primera A (Colombia)","Colombia","Colombia",1,"co.1",/^primera a$/],
 ["J1 League","Japan","Japan",1,"jp.1",/^j1 league$/],["J2 League","Japan","Japan",2,"jp.2",/^j2 league$/],["K League 1","Sydkorea","South-Korea",1,"kr.1",/^k league 1$/],
 ["Saudi Pro League","Saudiarabien","Saudi-Arabia",1,"sa.1",/^pro league$/],["A-League","Australien","Australia",1,"au.1",/^a-league$/],
 ["Egyptian Premier League","Egypten","Egypt",1,"eg.1",/^premier league$/],["Botola Pro","Marocko","Morocco",1,"ma.1",/^botola pro$/],["Premiership (Sydafrika)","Sydafrika","South-Africa",1,"za.1",/^premier soccer league$/],
 ["Bundesliga (Österrike)","Österrike","Austria",1,"at.1",/^bundesliga$/],["Super League (Schweiz)","Schweiz","Switzerland",1,"ch.1",/^super league$/],["Chance Liga","Tjeckien","Czech-Republic",1,"cz.1",/^(czech liga|chance liga)$/],
 ["Süper Lig","Turkiet","Turkey",1,"tr.1",/^s(u|ü)per lig$/],["Super League (Grekland)","Grekland","Greece",1,"gr.1",/^super league 1$/],["HNL","Kroatien","Croatia",1,"hr.1",/^hnl$/],
 ["Superliga (Serbien)","Serbien","Serbia",1,"rs.1",/^super liga$/],["NB I","Ungern","Hungary",1,"hu.1",/^nb i$/],["Premier Division (Irland)","Irland","Ireland",1,"ie.1",/^premier division$/],
 ["Liga MX","Mexiko","Mexico",1,"mx.1",/^liga mx$/],
 ["Kategoria Superiore","Albanien","Albania",1,"al.1",/^superliga$/],["Primera Divisió (Andorra)","Andorra","Andorra",1,"ad.1",/^1a divisi/],["Premier League (Armenien)","Armenien","Armenia",1,"am.1",/^premier league$/],
 ["Premjer Liqa","Azerbajdzjan","Azerbaijan",1,"az.1",/^premyer liqa$/],["Premier League (Belarus)","Belarus","Belarus",1,"by.1",/^premier league$/],["Premijer liga (Bosnien)","Bosnien och Hercegovina","Bosnia",1,"ba.1",/^premijer liga$/],
 ["Parva liga","Bulgarien","Bulgaria",1,"bg.1",/^first league$/],["First Division (Cypern)","Cypern","Cyprus",1,"cy.1",/^1\. division$/],["Meistriliiga","Estland","Estonia",1,"ee.1",/^meistriliiga$/],
 ["Betri deildin","Färöarna","Faroe-Islands",1,"fo.1",/^meistaradeildin$/],["Erovnuli Liga","Georgien","Georgia",1,"ge.1",/^erovnuli liga$/],["Gibraltar Football League","Gibraltar","Gibraltar",1,"gi.1",/^premier division$/],
 ["Ligat HaAl","Israel","Israel",1,"il.1",/^ligat ha'?al$/],["Premier League (Kazakstan)","Kazakstan","Kazakhstan",1,"kz.1",/^premier league$/],["Superliga (Kosovo)","Kosovo","Kosovo",1,"xk.1",/^superliga$/],
 ["Virslīga","Lettland","Latvia",1,"lv.1",/^virsliga$/],["A lyga","Litauen","Lithuania",1,"lt.1",/^a lyga$/],["BGL Ligue","Luxemburg","Luxembourg",1,"lu.1",/^national division$/],
 ["Premier League (Malta)","Malta","Malta",1,"mt.1",/^premier league$/],["Super Liga (Moldavien)","Moldavien","Moldova",1,"md.1",/^super liga$/],["Prva liga (Montenegro)","Montenegro","Montenegro",1,"me.1",/^first league$/],
 ["Prva liga (Nordmakedonien)","Nordmakedonien","Macedonia",1,"mk.1",/^first league$/],["NIFL Premiership","Nordirland","Northern-Ireland",1,"nir.1",/^premiership$/],["Liga I","Rumänien","Romania",1,"ro.1",/^liga i$/],
 ["Premjer-liga (Ryssland)","Ryssland","Russia",1,"ru.1",/^premier league$/],["Campionato Sammarinese","San Marino","San-Marino",1,"sm.1",/^campionato/],["Niké liga","Slovakien","Slovakia",1,"sk.1",/^super liga$/],
 ["PrvaLiga (Slovenien)","Slovenien","Slovenia",1,"si.1",/^1\. snl$/],["Premjer-liha","Ukraina","Ukraine",1,"ua.1",/^premier league$/],["Cymru Premier","Wales","Wales",1,"wal.1",/^premier league$/],
 ["National League (Nya Zeeland)","Nya Zeeland","New-Zealand",1,"nz.1",/^national league - national$/],["National Football League (Fiji)","Fiji","Fiji",1,"fj.1",/^national football league$/],
 ["Ligue 1 (Algeriet)","Algeriet","Algeria",1,"dz.1",/^ligue 1$/],["Girabola","Angola","Angola",1,"ao.1",/^girabola$/],["Premier League (Botswana)","Botswana","Botswana",1,"bw.1",/^premier league$/],
 ["Ligue 1 (Burkina Faso)","Burkina Faso","Burkina-Faso",1,"bf.1",/^ligue 1$/],["Ligue A (Burundi)","Burundi","Burundi",1,"bi.1",/^ligue a$/],["Elite One","Kamerun","Cameroon",1,"cm.1",/^elite one$/],
 ["Linafoot","DR Kongo","Congo-DR",1,"cd.1",/^ligue 1$/],["Premier League (Etiopien)","Etiopien","Ethiopia",1,"et.1",/^premier league$/],["Premier League (Ghana)","Ghana","Ghana",1,"gh.1",/^premier league$/],
 ["Ligue 1 (Elfenbenskusten)","Elfenbenskusten","Ivory-Coast",1,"ci.1",/^ligue 1$/],["FKF Premier League","Kenya","Kenya",1,"ke.1",/^fkf premier league$/],["Premier League (Lesotho)","Lesotho","Lesotho",1,"ls.1",/^premier league$/],
 ["LFA First Division","Liberia","Liberia",1,"lr.1",/^lfa first division$/],["Super League (Malawi)","Malawi","Malawi",1,"mw.1",/^super league$/],["Super D1 (Mauretanien)","Mauretanien","Mauritania",1,"mr.1",/^premier league$/],
 ["NPFL","Nigeria","Nigeria",1,"ng.1",/^npfl$/],["Rwanda Premier League","Rwanda","Rwanda",1,"rw.1",/^national soccer league$/],["Ligue 1 (Senegal)","Senegal","Senegal",1,"sn.1",/^ligue 1$/],
 ["Ligi Kuu Bara","Tanzania","Tanzania",1,"tz.1",/^ligi kuu bara$/],["Ligue 1 (Tunisien)","Tunisien","Tunisia",1,"tn.1",/^ligue 1$/],["Premier League (Uganda)","Uganda","Uganda",1,"ug.1",/^premier league$/],
 ["Super League (Zambia)","Zambia","Zambia",1,"zm.1",/^super league$/],["Premier Soccer League (Zimbabwe)","Zimbabwe","Zimbabwe",1,"zw.1",/^premier soccer league$/],
 ["Canadian Premier League","Kanada","Canada",1,"ca.1",/^canadian premier league$/],["Primera División (Costa Rica)","Costa Rica","Costa-Rica",1,"cr.1",/^primera divisi.n$/],
 ["Liga Nacional (Honduras)","Honduras","Honduras",1,"hn.1",/^liga nacional$/],["Primera División (El Salvador)","El Salvador","El-Salvador",1,"sv.1",/^primera division$/],
 ["Liga Panameña de Fútbol","Panama","Panama",1,"pa.1",/^liga paname/],["Primera División (Nicaragua)","Nicaragua","Nicaragua",1,"ni.1",/^primera division$/],
 ["Jamaica Premier League","Jamaica","Jamaica",1,"jm.1",/^premier league$/],["TT Premier League","Trinidad och Tobago","Trinidad-And-Tobago",1,"tt.1",/^pro league$/],
 ["Bahraini Premier League","Bahrain","Bahrain",1,"bh.1",/^premier league$/],["Bangladesh Premier League","Bangladesh","Bangladesh",1,"bd.1",/^premier league$/],["Bhutan Premier League","Bhutan","Bhutan",1,"bt.1",/^premier league$/],
 ["Cambodian Premier League","Kambodja","Cambodia",1,"kh.1",/^c-league$/],["Chinese Super League","Kina","China",1,"cn.1",/^super league$/],["Taiwan Football Premier League","Taiwan","Chinese-Taipei",1,"tw.1",/^taiwan football premier league$/],
 ["Hong Kong Premier League","Hongkong","Hong-Kong",1,"hk.1",/^premier league$/],["Indian Super League","Indien","India",1,"in.1",/^indian super league$/],["Super League (Indonesien)","Indonesien","Indonesia",1,"id.1",/^liga 1$/],
 ["Persian Gulf Pro League","Iran","Iran",1,"ir.1",/^persian gulf pro league$/],["Iraq Stars League","Irak","Iraq",1,"iq.1",/^iraqi league$/],["Jordanian Pro League","Jordanien","Jordan",1,"jo.1",/^league$/],
 ["Kuwait Premier League","Kuwait","Kuwait",1,"kw.1",/^premier league$/],["Kyrgyz Premier League","Kirgizistan","Kyrgyzstan",1,"kg.1",/^premier league$/],["Lao League 1","Laos","Laos",1,"la.1",/^lao league$/],
 ["Lebanese Premier League","Libanon","Lebanon",1,"lb.1",/^premier league$/],["Malaysia Super League","Malaysia","Malaysia",1,"my.1",/^super league$/],["Mongolian Premier League","Mongoliet","Mongolia",1,"mn.1",/^premier league$/],
 ["Myanmar National League","Myanmar","Myanmar",1,"mm.1",/^national league$/],["Oman Professional League","Oman","Oman",1,"om.1",/^professional league$/],["Qatar Stars League","Qatar","Qatar",1,"qa.1",/^stars league$/],
 ["Singapore Premier League","Singapore","Singapore",1,"sg.1",/^premier league$/],["Syrian Premier League","Syrien","Syria",1,"sy.1",/^premier league$/],["Tajikistan Higher League","Tadzjikistan","Tajikistan",1,"tj.1",/^vysshaya liga$/],
 ["Thai League 1","Thailand","Thailand",1,"th.1",/^thai league 1$/],["UAE Pro League","Förenade Arabemiraten","United-Arab-Emirates",1,"ae.1",/^pro league$/],["Uzbekistan Super League","Uzbekistan","Uzbekistan",1,"uz.1",/^super league$/],
 ["V.League 1","Vietnam","Vietnam",1,"vn.1",/^v.league 1$/],
 ["Champions League","*","World","CUP","uefa.cl",/^uefa champions league$/],["Europa League","*","World","CUP","uefa.el",/^uefa europa league$/],["Conference League","*","World","CUP","uefa.ecl",/^uefa (europa )?conference league$/]];
// damserier: lag-id från API-Football -> vårt id (se scripts/build-women.py)
let WOMEN={teams:{},leagues:[]};try{WOMEN=JSON.parse(fs.readFileSync(path.join(TOOLS,"women_ids.json"),"utf8"));}catch(e){}
for(const l of WOMEN.leagues)API.push([l[0],l[1],l[2],l[3],l[4],new RegExp(l[5],"i"),true]);
// landskamper (herr): API-lagnamn på engelska matchas mot landslagens söknamn (tools/nationals.json)
let NATS=[];try{NATS=JSON.parse(fs.readFileSync(path.join(TOOLS,"nationals.json"),"utf8"));}catch(e){}
const nn=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const NATALIAS={"usa":"usa","united states":"usa","korea republic":"south korea","korea dpr":"north korea","czech republic":"czechia","turkiye":"turkey","ivory coast":"cote d ivoire","cape verde islands":"cape verde","china pr":"china","ir iran":"iran","bosnia and herzegovina":"bosnia","congo dr":"dr congo"};
const natFind=name=>{if(/\sW$|\bU\d\d\b/.test(name||""))return null;let n=nn(name);n=NATALIAS[n]||n;const r=NATS.find(([id,h])=>(nn(h)+" ").startsWith(n+" "))||NATS.find(([id,h])=>(" "+nn(h)+" ").includes(" "+n+" "));return r?r[0]:null;};
// damlandslag: "Sweden W" -> wnt-se (bara de som finns i appen)
let NATW=new Set();try{NATW=new Set(JSON.parse(fs.readFileSync(path.join(TOOLS,"nationals_w.json"),"utf8")));}catch(e){}
const natFindW=name=>{if(!/\sW$/.test(name||"")||/\bU\d\d\b/.test(name))return null;const id=natFind(String(name).replace(/\s+W$/,""));return id&&NATW.has("w"+id)?"w"+id:null;};
if(NATW.size)API.push(["Damlandskamper","*","World","CUP","int.wfr",/^friendlies women$/,true,"w"],["VM-kval dam","*","World","CUP","wc.wq",/^world cup - women - qualification europe$/,true,"w"],["Nations League dam","*","World","CUP","uefa.wnl",/^uefa nations league - women$/,true,"w"]);
if(NATS.length)API.push(["Nations League","*","World","CUP","uefa.nl",/^uefa nations league$/,false,true],["VM-kval","*","World","CUP","wc.q",/^world cup - qualification europe$/,false,true],["EM-kval","*","World","CUP","ec.q",/^euro championship - qualification$/,false,true],["Landskamper","*","World","CUP","int.fr",/^friendlies$/,false,true]);
const apiStat={};const extra={standings:{},players:{},squads:{},events:{}};
if(process.env.API_FOOTBALL_KEY){const KEY=process.env.API_FOOTBALL_KEY.trim();const BASE=(process.env.API_FOOTBALL_BASE||"https://v3.football.api-sports.io").replace(/\/$/,"");
  const local=/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE);let calls=0,gap=220;
  // anropstak per natt (API_CAP, standard 6500), räknat på det som redan använts i dag. Trupper hoppas över först, sedan spelarlistor.
  const CAP=+(process.env.API_CAP||6500);let budget=CAP;const left=()=>budget-calls;const sleep=ms=>{try{execSync(`sleep ${ms/1000}`);}catch(e){}};
  const raw=q=>{if(left()<=50)throw new Error("anropstaket nått");for(let i=0;i<4;i++){calls++;let out;try{out=execSync(`curl -sS -m 60 ${local?"--noproxy '*'":""} -H "x-apisports-key: ${KEY}" "${BASE}/${q}"`,{encoding:"utf8",maxBuffer:256<<20});}catch(e){sleep(5000);continue;}
      let j;try{j=JSON.parse(out,FIXR);}catch(e){sleep(5000);continue;}
      const errs=j.errors&&(Array.isArray(j.errors)?j.errors:Object.values(j.errors));
      if(errs&&errs.length){const msg=JSON.stringify(j.errors);if(!Array.isArray(j.errors)&&j.errors.rateLimit){gap=Math.max(gap,6500);sleep(61000);continue;}throw new Error(msg);}
      if(!local)sleep(gap);return j;}throw new Error("API-Football svarar inte: "+q);};
  const get=q=>raw(q).response||[];
  const findAny=(nm,country)=>country==="*"?(find(nm,"England")||find(nm,"Spanien")||find(nm,"Italien")||find(nm,"Tyskland")||find(nm,"Frankrike")||find(nm,"Nederländerna")||find(nm,"Portugal")||find(nm,"Skottland")||find(nm,"Belgien")||find(nm,"Sverige")||find(nm,"Norge")||find(nm,"Danmark")||find(nm,"Polen")||findOther(nm)):find(nm,country);
  function findOther(nm){const seen=new Set(["England","Spanien","Italien","Tyskland","Frankrike","Nederländerna","Portugal","Skottland","Belgien","Sverige","Norge","Danmark","Polen"]);for(const c of new Set(clubs.map(x=>x[3]))){if(seen.has(c))continue;const r=find(nm,c);if(r)return r;}return null;}
  let EXTRA={teams:{}};try{EXTRA=JSON.parse(fs.readFileSync(path.join(TOOLS,"extra_ids.json"),"utf8"));}catch(e){}
  const teamMap=Object.assign({},WOMEN.teams,EXTRA.teams);// API-lag-id -> vårt id
  const tid=(t,country)=>{if(!t)return null;if(t.id in teamMap)return teamMap[t.id];if(/\sW$/.test(t.name||"")){teamMap[t.id]=null;return null;}const c=findAny(t.name,country);teamMap[t.id]=c?c[0]:null;return teamMap[t.id];};
  const unmatched={};
  try{
    // 0) vilken plan har kontot (visas i sammanfattningen, aldrig nyckeln)
    try{const st=raw("status").response||{};apiStat.plan=st.subscription&&st.subscription.plan;apiStat.anropIdag=st.requests&&`${st.requests.current}/${st.requests.limit_day}`;if(st.requests)budget=Math.min(CAP,+st.requests.limit_day||CAP)-(+st.requests.current||0);apiStat.anropstak=`${CAP} (kvar vid start: ${budget})`;}catch(e){apiStat.plan="okänd";}
    if(apiStat.plan==="Free")throw new Error("Gratisplanen ger inte innevarande säsong – uppgradera till Pro på dashboard.api-football.com. Hoppar över API-Football.");
    // 1) vilka serier finns, och vilken säsong pågår
    const lg={};for(const ac of [...new Set(API.map(x=>x[2]))]){for(const x of get(`leagues?country=${encodeURIComponent(ac)}`)){const cur=(x.seasons||[]).find(s=>s.current)||(x.seasons||[]).slice(-1)[0];
      lg[ac+"|"+String(x.league.name).toLowerCase().replace(/\s+/g," ").trim()]={id:x.league.id,season:cur&&cur.year,start:cur&&cur.start,end:cur&&cur.end,cov:cur&&cur.coverage||{},seasons:(x.seasons||[]).map(z=>[z.year,z.start,z.end])};}}
    // 1b) äldre säsonger till arkivet (BACKFILL="se.1:2010-2025,se.3n:2016-2025"); befintliga filer skrivs inte över
    // "!kod:år" skriver över en befintlig fil (t.ex. en säsong som sparades innan den var färdigspelad)
    const runBackfill=(specs,out)=>{
      for(const spec0 of specs){const force=spec0.startsWith("!");const spec=spec0.replace(/^!/,"");const[code,range]=spec.split(":");const[a,b]=(range||"").split("-").map(Number);
        const ent=API.find(x=>x[4]===code);if(!ent||!a){out[spec0]="okänd";continue;}const[lname,country,ac,tier,,re,isW,isN]=ent;
        const key=Object.keys(lg).find(k=>k.startsWith(ac+"|")&&re.test(k.split("|")[1]));if(!key){out[spec0]="saknas i API";continue;}
        const cross=String(lg[key].start||"").slice(0,4)!==String(lg[key].end||"").slice(0,4);// höst–vår-serie: filen heter 2016-17
        const got=[];for(let yr=a;yr<=(b||a);yr++){const sy=(lg[key].seasons||[]).find(z=>+z[0]===yr);const cr=sy?String(sy[1]||"").slice(0,4)!==String(sy[2]||"").slice(0,4):cross;// t.ex. Japan bytte från kalenderår till höst–vår
          const SKb=cr?`${yr}-${String((yr+1)%100).padStart(2,"0")}`:String(yr);const f=path.join(OUT,"archive",code,SKb+".json");if(!force&&fs.existsSync(f)){got.push(SKb+" fanns");continue;}
          let fx;try{fx=get(`fixtures?league=${lg[key].id}&season=${yr}&timezone=UTC`);}catch(e){got.push(yr+" fel");continue;}if(!fx.length){got.push(yr+" tom");continue;}
          const teams=[],tix={};const T=(nm,tm)=>{if(nm in tix)return tix[nm];const pre=tm&&teamMap[tm.id];const c=pre?[pre]:isW||isN?null:findAny(nm,country);tix[nm]=teams.length;teams.push(c?[nm,c[0]]:[nm]);return tix[nm];};
          const arc=[];for(const x of fx){const st=x.fixture.status&&x.fixture.status.short;if(["PST","CANC","ABD","AWD","WO"].includes(st))continue;const fin=["FT","AET","PEN"].includes(st);const d=x.fixture.date;
            const pen=x.score&&x.score.penalty&&x.score.penalty.home!=null?`${x.score.penalty.home}-${x.score.penalty.away}`:"";
            arc.push([T(x.teams.home.name,x.teams.home),T(x.teams.away.name,x.teams.away),d.slice(0,10),/T00:00:00/.test(d)?"":d.slice(11,16),fin?x.goals.home:null,fin?x.goals.away:null,pen,tier==="CUP"?(x.league.round||""):""]);}
          arc.sort((p,q)=>(p[2]+p[3]).localeCompare(q[2]+q[3]));
          fs.mkdirSync(path.join(OUT,"archive",code),{recursive:true});fs.writeFileSync(f,JSON.stringify({l:lname,s:SKb.replace("-","/"),c:country,tier,t:teams,m:arc}));got.push(SKb+": "+arc.length);}
        out[spec0]=got.join(", ");}};
    if(process.env.BACKFILL){apiStat.backfill={};runBackfill(process.env.BACKFILL.split(",").map(x=>x.trim()).filter(Boolean),apiStat.backfill);}
    // 1c) förra säsongen sparades medan den pågick – hämta om den om resultat saknas (en gång, när säsongen är slut)
    {const todo=[];const today=new Date().toISOString().slice(0,10);
      for(const ent of API){const code=ent[4];const key=Object.keys(lg).find(k=>k.startsWith(ent[2]+"|")&&ent[5].test(k.split("|")[1]));if(!key||!lg[key].season)continue;
        const yr=+lg[key].season-1;const dir=path.join(OUT,"archive",code);if(!fs.existsSync(dir))continue;
        for(const fn of [yr+".json",`${yr}-${String((yr+1)%100).padStart(2,"0")}.json`]){const f=path.join(dir,fn);if(!fs.existsSync(f))continue;
          try{const j=JSON.parse(fs.readFileSync(f,"utf8"));const past=j.m.filter(m=>m[2]<today).length,res=j.m.filter(m=>m[4]!=null).length;if(past&&res<past*0.95)todo.push(`!${code}:${yr}`);}catch(e){}}}
      if(todo.length){apiStat.omhämtat={};runBackfill(todo.slice(0,60),apiStat.omhämtat);}}
    const done=[];// [lname, apiLeagueId, season, country, tier]
    // 2) matcher och resultat
    const now=Date.now();const finished=[];
    for(const[lname,country,ac,tier,code,re,isW,isN] of API){const key=Object.keys(lg).find(k=>k.startsWith(ac+"|")&&re.test(k.split("|")[1]));if(!key){apiStat[lname]="saknas i API";continue;}
      const L=lg[key];let fx;try{fx=get(`fixtures?league=${L.id}&season=${L.season}&timezone=UTC`);}catch(e){apiStat[lname]=String(e.message).slice(0,120);continue;}
      if(!fx.length){apiStat[lname]=0;continue;}
      for(let i=rows.length-1;i>=0;i--)if(rows[i][5]===lname)rows.splice(i,1);// API ersätter openfootball för samma serie
      const teams=[],tix={};const T=(nm,tm)=>{if(nm in tix)return tix[nm];const pre=tm&&teamMap[tm.id];const wid=pre||(isN==="w"?natFindW(nm):isW?tid(tm,country):isN?natFind(nm):null);const c=pre||isW||isN?(wid?[wid]:null):findAny(nm,country);tix[nm]=teams.length;teams.push(c?[nm,c[0]]:[nm]);return tix[nm];};const arc=[];let n=0;const have=new Set();
      for(const f of fx){const st=f.fixture.status&&f.fixture.status.short;if(["PST","CANC","ABD","AWD","WO"].includes(st))continue;
        const hn=f.teams.home.name,an=f.teams.away.name,iso8=f.fixture.date,date=iso8.slice(0,10);const fin=["FT","AET","PEN"].includes(st);const gh=fin?f.goals.home:null,ga=fin?f.goals.away:null;const tbd=st==="TBD"||/T00:00:00/.test(iso8);
        const pen=f.score&&f.score.penalty&&f.score.penalty.home!=null?`${f.score.penalty.home}-${f.score.penalty.away}`:"";
        arc.push([T(hn,f.teams.home),T(an,f.teams.away),date,tbd?"":iso8.slice(11,16),gh,ga,pen,tier==="CUP"?(f.league.round||""):""]);
        const NF=isN==="w"?natFindW:natFind;const H=isN?NF(hn):tid(f.teams.home,country),A=isN?NF(an):tid(f.teams.away,country);if(isN&&(!H||!A))continue;if(!H){unmatched[hn]=(unmatched[hn]||0)+1;}if(!A){unmatched[an]=(unmatched[an]||0)+1;}if(!H||!A)continue;
        const k=H+"|"+A+"|"+date;if(have.has(k))continue;have.add(k);
        rows.push([H,A,tbd?null:new Date(iso8).toISOString(),date,fin?`${gh}–${ga}`:"",lname,String(tier)]);n++;
        if(fin)finished.push({id:f.fixture.id,key:k,date,home:f.teams.home.id});}
      // säsongsnyckel efter API:ets säsong: kalenderårsserier (Allsvenskan m.fl.) blir "2026", höst–vår blir "2026-27"
      const y0=String(L.start||"").slice(0,4)||String(L.season),y1=String(L.end||"").slice(0,4)||y0;const SK=y0===y1?y0:`${y0}-${String((+y0+1)%100).padStart(2,"0")}`;
      fs.mkdirSync(path.join(OUT,"archive",code),{recursive:true});
      fs.writeFileSync(path.join(OUT,"archive",code,SK+".json"),JSON.stringify({l:lname,s:SK.replace("-","/"),c:country==="*"?"Europa":country,tier,t:teams,m:arc}));
      stat[lname]=n;apiStat[lname]=n;if(!isN)done.push([lname,L.id,L.season,country,tier,L.cov]);}
    // 3) officiella tabeller
    for(const[lname,lid,season,country,tier] of done){if(tier==="CUP")continue;try{const r=get(`standings?league=${lid}&season=${season}`);const groups=(r[0]&&r[0].league&&r[0].league.standings)||[];
      extra.standings[lname]={season,groups:groups.map(g=>({name:(g[0]&&g[0].group)||"",rows:g.map(x=>[tid(x.team,country),x.team.name,x.rank,x.all.played,x.all.win,x.all.draw,x.all.lose,x.all.goals.for,x.all.goals.against,x.points,x.form||"",x.description||""])}))};}catch(e){apiStat["tabell "+lname]=String(e.message).slice(0,80);}}
    // 4) skytte-, assist- och kortligor
    const tops=[["goals","players/topscorers",s=>s.goals.total],["assists","players/topassists",s=>s.goals.assists],["yellow","players/topyellowcards",s=>s.cards.yellow],["red","players/topredcards",s=>s.cards.red]];
    // bara serier där API:et har spelarstatistik, och bara spelare från seriens egna lag (API:et blandar ibland in andra serier)
    for(const[lname,lid,season,country,tier,cov] of done){if(tier==="CUP")continue;if(left()<600){apiStat.spelarligor_tak="hoppade över resten (anropstak)";break;}if(cov&&cov.top_scorers===false){apiStat["spelarligor "+lname]="saknas i API";continue;}
      const own=new Set(rows.filter(r=>r[5]===lname).flatMap(r=>[r[0],r[1]]));const o={};
      for(const[k,ep,val] of tops){try{o[k]=get(`${ep}?league=${lid}&season=${season}`).map(x=>{const s=(x.statistics||[]).find(z=>z.league&&z.league.id===lid)||(x.statistics||[])[0]||{};return[x.player.name,tid(s.team,country)||((s.team&&s.team.name)||""),val(s)||0,(s.games&&s.games.appearences)||0];}).filter(r=>!own.size||own.has(r[1])).slice(0,20);}catch(e){o[k]=[];}}
      // rimlighetskontroll: API:et har för vissa serier (t.ex. Superettan) bara statistik från en del av matcherna.
      // Är skytteligan orimligt låg i förhållande till antal spelade omgångar visas inga spelarligor alls för serien.
      const st=extra.standings[lname];const rounds=st?Math.max(0,...st.groups.flatMap(g=>g.rows.map(r=>+r[3]||0))):0;
      const topG=(o.goals&&o.goals[0]&&o.goals[0][2])||0,topA=(o.assists&&o.assists[0]&&o.assists[0][2])||0;
      if(rounds>=8&&(topG<rounds*0.3||topA<rounds*0.12)){apiStat["spelarligor "+lname]=`ofullständig i API (${topG} mål/${topA} assist efter ${rounds} omg.)`;continue;}
      if(Object.values(o).some(v=>v.length>=5))extra.players[lname]=o;else apiStat["spelarligor "+lname]="för lite data";}
    // 5) spelarstatistik per klubb (alla tävlingar, summerat)
    const teamIds=Object.entries(teamMap).filter(([a,b])=>b);const sq=done.filter(d=>d[4]!=="CUP"&&!(d[5]&&d[5].players===false));const seasonOf={};
    for(const[lname,lid,season] of sq)for(const r of rows.filter(r=>r[5]===lname)){seasonOf[r[0]]=seasonOf[r[0]]||season;seasonOf[r[1]]=seasonOf[r[1]]||season;}
    // Avstängt som standard: trupperna visas inte i appen och kostade flest anrop. Slå på med API_SQUADS=1.
    if(process.env.API_SQUADS!=="1")apiStat.trupper="hämtas inte (API_SQUADS av)";else
    for(const[apiId,our] of teamIds){if(left()<300){apiStat.trupper_tak="hoppade över resten (anropstak)";break;}const season=seasonOf[our];if(!season||extra.squads[our])continue;const ps={};
      try{let page=1,total=1;do{const j=raw(`players?team=${apiId}&season=${season}&page=${page}`);total=(j.paging&&j.paging.total)||1;
        for(const x of j.response||[]){const p=x.player;const acc=ps[p.id]||(ps[p.id]=[p.name,"",p.age||null,0,0,0,0,0,0]);
          for(const s of x.statistics||[]){if(s.team&&String(s.team.id)!==String(apiId))continue;const g=s.games||{};if(!acc[1]&&g.position)acc[1]=g.position;
            acc[3]+=g.appearences||0;acc[4]+=g.minutes||0;acc[5]+=(s.goals&&s.goals.total)||0;acc[6]+=(s.goals&&s.goals.assists)||0;acc[7]+=(s.cards&&s.cards.yellow)||0;acc[8]+=((s.cards&&s.cards.red)||0)+((s.cards&&s.cards.yellowred)||0);}}
        page++;}while(page<=Math.min(total,4));
        const pl=Object.values(ps).filter(p=>p[3]>0||p[4]>0).sort((a,b)=>b[4]-a[4]);if(pl.length>=8)extra.squads[our]={season,players:pl};}catch(e){apiStat.trupp_fel=(apiStat.trupp_fel||0)+1;}}
    // 6) målskyttar och utvisningar: nya matcher sedan förra körningen (alla vid första körningen)
    let prev={};try{prev=JSON.parse(fs.readFileSync(path.join(TOOLS,"prev_events.json"),"utf8"),FIXR).m||{};}catch(e){}
    // assistlämnare sparas i en egen fil (tools/ev_assist.json) så att events.json som appen laddar inte blir större
    let AS={};try{AS=JSON.parse(fs.readFileSync(path.join(TOOLS,"ev_assist.json"),"utf8"),FIXR);}catch(e){}
    const recent=Date.now()-5*864e5;const need=finished.filter(f=>!prev[f.key]||!(f.key in AS)||Date.parse(f.date)>=recent);Object.assign(extra.events,prev);
    for(let i=0;i<need.length;i+=20){const chunk=need.slice(i,i+20);let r;try{r=get(`fixtures?ids=${chunk.map(f=>f.id).join("-")}`);}catch(e){apiStat.händelser_fel=String(e.message).slice(0,80);break;}
      for(const f of r){const me=chunk.find(c=>c.id===f.fixture.id);if(!me)continue;const homeId=f.teams.home.id;
        AS[me.key]=(f.events||[]).filter(e=>e.type==="Goal"&&!/missed|own/i.test(e.detail||"")&&e.assist&&e.assist.name).map(e=>[e.assist.name,e.team&&e.team.id===homeId?"h":"a"]);
        extra.events[me.key]=(f.events||[]).filter(e=>e.type==="Goal"&&!/missed/i.test(e.detail||"")||(e.type==="Card"&&/red/i.test(e.detail||""))).map(e=>[(e.time.elapsed||0)+(e.time.extra?"+"+e.time.extra:""),e.type==="Card"?"R":/own/i.test(e.detail||"")?"OG":/penalty/i.test(e.detail||"")?"P":"G",e.player&&e.player.name||"",e.team&&e.team.id===homeId?"h":"a"]);}}
    try{fs.writeFileSync(path.join(TOOLS,"ev_assist.json"),JSON.stringify(AS));}catch(e){}
    // 7) egna skytte- och assistligor uträknade från målskyttarna i varje match. Används när API:ets färdiga lista
    //    är ofullständig (lägre topp än vad matcherna visar) eller saknas helt. Gula/röda kort tas från API:et.
    {const own={};const LT=new Map();
      for(const r of rows){if(!r[4])continue;const L=r[5];if(!LT.has(L))LT.set(L,{fin:0,ev:0,as:0,g:{},a:{},gp:{}});const o=LT.get(L);o.fin++;const k=r[0]+"|"+r[1]+"|"+r[3];const ev=extra.events[k];
        o.gp[r[0]]=(o.gp[r[0]]||0)+1;o.gp[r[1]]=(o.gp[r[1]]||0)+1;
        if(ev){o.ev++;for(const x of ev){if((x[1]==="G"||x[1]==="P")&&x[2]){const t=x[3]==="h"?r[0]:r[1];const id=x[2]+"|"+t;o.g[id]=(o.g[id]||0)+1;}}}
        if(AS[k]){o.as++;for(const[nm,side] of AS[k]){const t=side==="h"?r[0]:r[1];const id=nm+"|"+t;o.a[id]=(o.a[id]||0)+1;}}}
      const top=(m,gp)=>Object.entries(m).sort((x,y)=>y[1]-x[1]).slice(0,20).map(([id,n])=>{const[nm,t]=id.split("|");return[nm,t,n,0];});
      const choice={};
      for(const[lname,,,,tier] of done){if(tier==="CUP")continue;const o=LT.get(lname);if(!o||o.fin<10)continue;const P=extra.players[lname]||{};
        const evOk=o.ev>=o.fin*0.9,asOk=o.as>=o.fin*0.9;const ownG=top(o.g,o.gp),ownA=top(o.a,o.gp);
        const apiG=(P.goals&&P.goals[0]&&P.goals[0][2])||0,apiA=(P.assists&&P.assists[0]&&P.assists[0][2])||0;
        const useG=evOk&&ownG.length&&(ownG[0][2]>apiG),useA=asOk&&ownA.length&&(ownA[0][2]>apiA);
        if(useG||useA){extra.players[lname]={...P,...(useG?{goals:ownG}:{}),...(useA?{assists:ownA}:{}),own:[useG?"goals":null,useA?"assists":null].filter(Boolean)};choice[lname]=`egen ${useG?"skytteliga ("+ownG[0][2]+" vs API "+apiG+")":""}${useA?" assist ("+ownA[0][2]+" vs API "+apiA+")":""}`;}}
      apiStat.egnaSpelarligor=choice;}
    apiStat.anrop=calls;apiStat.okändaLag=Object.entries(unmatched).sort((a,b)=>b[1]-a[1]).slice(0,25).map(x=>x[0]);
  }catch(e){apiStat.fel=String(e.message).slice(0,200);apiStat.anrop=calls;}
}else apiStat.info="API_FOOTBALL_KEY saknas, hoppar över API-Football";
if(Object.keys(extra.standings).length||Object.keys(extra.players).length||Object.keys(extra.squads).length||Object.keys(extra.events).length){fs.mkdirSync(path.join(OUT,"data"),{recursive:true});const up=new Date().toISOString();
  fs.writeFileSync(path.join(OUT,"data","standings.json"),JSON.stringify({updated:up,leagues:extra.standings}));
  fs.writeFileSync(path.join(OUT,"data","players.json"),JSON.stringify({updated:up,leagues:extra.players}));
if(Object.keys(extra.squads).length)fs.writeFileSync(path.join(OUT,"data","squads.json"),JSON.stringify({updated:up,clubs:extra.squads}));
  fs.writeFileSync(path.join(OUT,"data","events.json"),JSON.stringify({updated:up,m:extra.events}));}
fs.mkdirSync(path.join(OUT,"data"),{recursive:true});
fs.writeFileSync(path.join(OUT,"data","fixtures.json"),JSON.stringify({updated:new Date().toISOString(),season:SEASON,source:process.env.API_FOOTBALL_KEY?"openfootball (CC0) och API-Football":"openfootball (CC0)",rows}));
try{apiStat.fixtures_delning=require(path.join(TOOLS,"split-fixtures.js")).splitFixtures(OUT);}catch(e){apiStat.fixtures_delning_fel=String(e.message).slice(0,120);}
try{const{buildIndex}=require(path.join(TOOLS,"archive-index.js"));apiStat.arkivsäsonger=buildIndex(OUT).length;}catch(e){apiStat.arkivindex_fel=String(e.message).slice(0,120);}
console.log(JSON.stringify({season:SEASON,matches:rows.length,played:rows.filter(r=>r[4]).length,perLeague:stat,apiFootball:apiStat}));
