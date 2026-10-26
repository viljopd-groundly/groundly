// Bygger webbversionen: src/template.html + datafilerna i src/ → site/index.html
// Kör: node scripts/build-web.js
// Skriver även site/data/flags.json och site/data/maps.json (statiska).
// site/data/fixtures.json och archive/ skrivs av nattjobbet, inte här.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), SRC = path.join(ROOT, "src"), SITE = path.join(ROOT, "site");
const R = f => require(path.join(SRC, f));

const maps = R("maps.js");
// webbplatser: klubbarnas egna + damlag utan egen sida får moderklubbens + landslag/U21 får förbundets
function webAll() {
  const W = Object.assign({}, R("web.js"));
  const par = R("clubs_women.js").parents;
  for (const [w, p] of Object.entries(par)) if (!W[w] && W[p]) W[w] = W[p];
  for (const r of R("clubs.js")) if (r[6] === "U21-landslag" && !W[r[0]]) { const a = "nt-" + r[0].replace(/^u21-/, ""); if (W[a]) W[r[0]] = W[a]; }
  return W;
}
let html = fs.readFileSync(path.join(SRC, "template.html"), "utf8")
  .replace("/*CLUBS*/[]", JSON.stringify(R("clubs.js")))
  .replace("/*GEO*/{}", JSON.stringify(R("geo.js")))
  .replace("/*TIPS*/{derbies:[],cult:[]}", JSON.stringify(R("tips.js")))
  .replace("/*MAPS*/{}", JSON.stringify(Object.fromEntries(Object.entries(maps).map(([k, v]) => [k, { lon0: v.lon0, lon1: v.lon1, lat0: v.lat0, lat1: v.lat1, w: v.w, h: v.h, pts: v.pts }]))))
  .replace("/*PUBSEED*/[]", JSON.stringify(R("pubseed.js")))
  .replace("/*COLORS*/{}", JSON.stringify(R("colors.js")))
  .replace("/*CUPS*/[]", JSON.stringify(R("cups.js")))
  .replace("/*SEASONS*/{}", JSON.stringify(R("seasons.js")))
  .replace("/*WEB*/{}", JSON.stringify(webAll()))
  .replace("/*WLEAGUES*/[]", JSON.stringify(R("clubs_women.js").leagues));

// ---- AI på/av: på bara om firebase-config.js har en aiEndpoint ----
const cfg = fs.readFileSync(path.join(SITE, "js", "firebase-config.js"), "utf8");
const aiOn = /aiEndpoint\s*:\s*"[^"\s]+"/.test(cfg);

// ---- ändringar för webben (varje rad måste träffa, annars stoppas bygget) ----
const LOGIN = `<button class="btn primary" data-glogin>Logga in eller skapa konto</button>`;
const swaps = [
  ["const AI_ON=true;", `const AI_ON=${aiOn};`],
  // matchschemat från claude.ai-databasen ligger som fil i stället (sparar läsningar i Firestore)
  [`if(!db){dbFailed=true;DBM=[];remergeMatches();return;}
  db.collection("matches").onSnapshot(snap=>{DBM=snap.docs.map(d=>({...d.data(),_id:d.id})).filter(m=>m&&m.homeName&&m.city);remergeMatches();},
    ()=>{dbFailed=true;DBM=[];remergeMatches();});
  db.doc("meta/info").onSnapshot(s=>{META=s.exists?s.data():null;render();},()=>{});})();`,
   `fetch("data/dbmatches.json").then(r=>r.json()).then(j=>{DBM=(j.docs||[]).map(d=>({...d.data,_id:d.id})).filter(m=>m&&m.homeName&&m.city);META={updated:j.updated||null,count:DBM.length};remergeMatches();render();}).catch(()=>{dbFailed=true;DBM=[];remergeMatches();});})();`],
  [`blobUrl=id=>"/_blob/"+id`, `blobUrl=id=>(window.GROUNDLY_BLOB||(i=>"/_blob/"+i))(id)`],
  [`<b>Matchschemat kan inte visas här.</b><div>Öppna sidan inloggad på claude.ai för att se matcher. Klubbsöket fungerar ändå.</div>`,
   `<b>Matchschemat kunde inte hämtas.</b><div>Kontrollera anslutningen och ladda om sidan. Klubbsöket fungerar ändå.</div>`],
  [`<b>Forumet kan inte visas här.</b><div>Öppna sidan inloggad på claude.ai för att läsa och skriva.</div>`,
   `<b>Forumet kunde inte hämtas.</b><div>Kontrollera anslutningen och ladda om sidan.</div>`],
  [`<b>Reportagen kan inte visas här.</b><div>Öppna sidan inloggad på claude.ai för att läsa och skriva.</div>`,
   `<b>Reportagen kunde inte hämtas.</b><div>Kontrollera anslutningen och ladda om sidan.</div>`],
  [`Du kan läsa forumet. För att skriva behöver ägaren bjuda in dig till sidan med redigeringsrätt.</span>`,
   `Du kan läsa forumet. Logga in för att skriva.</span><button class="btn small primary" data-glogin>Logga in</button>`],
  [`Du kan läsa reportagen. För att skriva behöver ägaren bjuda in dig till sidan.</span>`,
   `Du kan läsa reportagen. Logga in för att skriva och kommentera.</span><button class="btn small primary" data-glogin>Logga in</button>`],
  [`"Logga in på claude.ai för att spara."`, `"Logga in för att spara."`],
  [`<b>Logga in för att spara.</b><div>Dina matcher och klubbar sparas på ditt claude.ai-konto, så du behöver öppna sidan inloggad.</div>`,
   `<b>Logga in för att spara.</b><div>Dina matcher och klubbar sparas på ditt Groundly-konto. Har du loggat matcher i den gamla versionen av appen på claude.ai: spara en säkerhetskopia där och välj sedan Läs in säkerhetskopia här efter inloggning.</div><div style="margin-top:10px">${LOGIN}</div>`],
  [`Betygen kan inte visas här. Öppna sidan inloggad på claude.ai.`, `Betygen kunde inte hämtas.`],
  [`"Logga in på claude.ai för att skicka."`, `"Logga in för att skicka."`],
  [`följer med ditt claude.ai-konto.`, `följer med ditt Groundly-konto.`],
  [`Be ägaren bjuda in dig så att du kan använda sidan.`, `Logga in och försök igen.`],
  [`I Claude-appen på mobilen öppnar Spara bild delningsmenyn, så du kan skicka bilden direkt till Instagram eller andra appar.`,
   `Bilden laddas ner som en fil. På mobilen kan du också hålla fingret på bilden för att dela den.`]
];
// texter i HTML-mallar ligger inlindade i $t("…") (översättning) – prova även den formen
const wrapT = x => (">" + x).replace(/>([^<>]*[A-Za-zÅÄÖåäö][^<>]*)</g, (m, txt) => { const k = txt.trim(); if (txt.includes("${")) return m; const pre = txt.match(/^\s*/)[0], post = txt.match(/\s*$/)[0]; return ">" + pre + "${$t(" + JSON.stringify(k) + ")}" + post + "<"; }).slice(1);
for (let [a, b] of swaps) {
  if (!html.includes(a) && html.includes(wrapT(a))) { a = wrapT(a); b = wrapT(b); }
  if (!html.includes(a)) throw new Error("Hittar inte texten att byta:\n  " + a.slice(0, 120));
  html = html.split(a).join(b);
}

// telefonens språk väljs automatiskt först när översättningarna är klara; tills dess bara via Inställningar eller ?lang=
const AUTO_LANG = false;
const I18NV = require("crypto").createHash("md5").update(fs.readdirSync(path.join(SRC, "i18n")).sort().map(f => fs.readFileSync(path.join(SRC, "i18n", f), "utf8")).join("|")).digest("hex").slice(0, 8);
// ---- dokumenthuvud + runtime (claude.ai lade till skelettet automatiskt) ----
const head = `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Groundly – planera och logga dina fotbollsresor. Matcher, arenor, serietabeller, forum och reportage.">
<meta name="theme-color" content="#1d6b3b">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Groundly">
<meta property="og:locale" content="sv_SE">
<meta property="og:title" content="Groundly – planera och logga dina fotbollsresor">
<meta property="og:description" content="Matcher, arenor, serietabeller, forum och reportage – för dig som åker på fotboll.">
<meta property="og:url" content="https://viljopd-groundly.github.io/groundly/">
<meta property="og:image" content="https://viljopd-groundly.github.io/groundly/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Groundly – planera och logga dina fotbollsresor">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://viljopd-groundly.github.io/groundly/">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Groundly">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<script>
// språk: ?lang=xx, sparat val (fk-lang) eller telefonens språk; okänt språk ger engelska. Översättningen laddas före appen.
(function(){var ok={sv:1,en:1,nb:1,da:1,fi:1,is:1},L=null;
try{var q=new URLSearchParams(location.search).get("lang");if(q==="no"||q==="nn")q="nb";if(q&&ok[q]){localStorage.setItem("fk-lang",q);}var st=localStorage.getItem("fk-lang");if(st&&ok[st])L=st;}catch(e){}
if(!L&&${AUTO_LANG}){var ls=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||"sv"];for(var i=0;i<ls.length&&!L;i++){var c=String(ls[i]||"").toLowerCase().split("-")[0];if(c==="no"||c==="nn")c="nb";if(ok[c])L=c;}if(!L)L="en";}if(!L)L="sv";
window.LANG=L;document.documentElement.lang=L;if(L!=="sv")document.write('<script src="i18n/'+L+'.js?v=${I18NV}"><\\/script>');})();
</script>
<script>
// Appens kod frågar window.claude.use(...) direkt vid start; runtime.js (Firebase) svarar när den är klar.
(function(){var ready,p=new Promise(function(r){ready=r});window.__groundlyReady=ready;
setTimeout(function(){ready({use:function(){return Promise.resolve(null)}})},15000);
window.claude={use:function(n){return p.then(function(rt){return rt.use(n)})}};})();
</script>
<script type="module" src="js/runtime.js?v=${require("crypto").createHash("md5").update(fs.readFileSync(path.join(SITE, "js", "runtime.js"))).digest("hex").slice(0, 8)}"></script>
<script>if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})});</script>
`;
html = head + html.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "") + "\n</html>\n";

fs.mkdirSync(path.join(SITE, "data"), { recursive: true });
// översättningar: src/i18n/<språk>.json -> site/i18n/<språk>.js
fs.mkdirSync(path.join(SITE, "i18n"), { recursive: true });
for (const f of fs.readdirSync(path.join(SRC, "i18n")).filter(f => /^[a-z]{2}\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(path.join(SRC, "i18n", f), "utf8"));
  fs.writeFileSync(path.join(SITE, "i18n", f.replace(/json$/, "js")), "window.I18N=" + JSON.stringify(d) + ";\n");
}
fs.writeFileSync(path.join(SITE, "index.html"), html);
fs.writeFileSync(path.join(SITE, "data", "flags.json"), JSON.stringify(R("flags.js")));
fs.writeFileSync(path.join(SITE, "data", "maps.json"), JSON.stringify(Object.fromEntries(Object.entries(maps).map(([k, v]) => [k, { path: v.path, path2: v.path2 || null }]))));
fs.writeFileSync(path.join(SITE, ".nojekyll"), "");

// syntaxkontroll av appens skript
const js = html.split("<script>").slice(1).map(x => x.split("</script>")[0]).sort((a, b) => b.length - a.length)[0]; // appens stora skript
new Function(js);
console.log(`site/index.html ${html.length} byte, AI ${aiOn ? "på" : "av"}, skript ok`);
