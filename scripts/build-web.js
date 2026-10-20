// Bygger webbversionen: src/template.html + datafilerna i src/ → site/index.html
// Kör: node scripts/build-web.js
// Skriver även site/data/flags.json och site/data/maps.json (statiska).
// site/data/fixtures.json och archive/ skrivs av nattjobbet, inte här.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), SRC = path.join(ROOT, "src"), SITE = path.join(ROOT, "site");
const R = f => require(path.join(SRC, f));

const maps = R("maps.js");
let html = fs.readFileSync(path.join(SRC, "template.html"), "utf8")
  .replace("/*CLUBS*/[]", JSON.stringify(R("clubs.js")))
  .replace("/*GEO*/{}", JSON.stringify(R("geo.js")))
  .replace("/*TIPS*/{derbies:[],cult:[]}", JSON.stringify(R("tips.js")))
  .replace("/*MAPS*/{}", JSON.stringify(Object.fromEntries(Object.entries(maps).map(([k, v]) => [k, { lon0: v.lon0, lon1: v.lon1, lat0: v.lat0, lat1: v.lat1, w: v.w, h: v.h, pts: v.pts }]))))
  .replace("/*PUBSEED*/[]", JSON.stringify(R("pubseed.js")))
  .replace("/*COLORS*/{}", JSON.stringify(R("colors.js")))
  .replace("/*CUPS*/[]", JSON.stringify(R("cups.js")))
  .replace("/*SEASONS*/{}", JSON.stringify(R("seasons.js")))
  .replace("/*WEB*/{}", JSON.stringify(R("web.js")));

// ---- AI på/av: på bara om firebase-config.js har en aiEndpoint ----
const cfg = fs.readFileSync(path.join(SITE, "js", "firebase-config.js"), "utf8");
const aiOn = /aiEndpoint\s*:\s*"[^"\s]+"/.test(cfg);

// ---- ändringar för webben (varje rad måste träffa, annars stoppas bygget) ----
const LOGIN = `<button class="btn primary" data-glogin>Logga in eller skapa konto</button>`;
const swaps = [
  ["const AI_ON=true;", `const AI_ON=${aiOn};`],
  [`blobUrl=id=>"/_blob/"+id`, `blobUrl=id=>(window.GROUNDLY_BLOB||(i=>"/_blob/"+i))(id)`],
  [`<b>Matchschemat kan inte visas här.</b><div>Öppna sidan inloggad på claude.ai för att se matcher. Klubbsöket fungerar ändå.</div>`,
   `<b>Matchschemat kunde inte hämtas.</b><div>Kontrollera anslutningen och ladda om sidan. Klubbsöket fungerar ändå.</div>`],
  [`<b>Forumet kan inte visas här.</b><div>Öppna sidan inloggad på claude.ai för att läsa och skriva.</div>`,
   `<b>Forumet kunde inte hämtas.</b><div>Kontrollera anslutningen och ladda om sidan.</div>`],
  [`<b>Reportagen kan inte visas här.</b><div>Öppna sidan inloggad på claude.ai för att läsa och skriva.</div>`,
   `<b>Reportagen kunde inte hämtas.</b><div>Kontrollera anslutningen och ladda om sidan.</div>`],
  [`Du kan läsa forumet. För att skriva behöver ägaren bjuda in dig till sidan med redigeringsrätt.</span>`,
   `Du kan läsa forumet. Logga in för att skriva.</span><button class="btn small primary" data-glogin>Logga in</button>`],
  [`"Logga in på claude.ai för att spara."`, `"Logga in för att spara."`],
  [`<b>Logga in för att spara.</b><div>Dina matcher och klubbar sparas på ditt claude.ai-konto, så du behöver öppna sidan inloggad.</div>`,
   `<b>Logga in för att spara.</b><div>Dina matcher och klubbar sparas på ditt Groundly-konto. Har du loggat matcher i den gamla versionen av appen på claude.ai: spara en säkerhetskopia där och välj sedan Läs in säkerhetskopia här efter inloggning.</div><div style="margin-top:10px">${LOGIN}</div>`],
  [`Betygen kan inte visas här. Öppna sidan inloggad på claude.ai.`, `Betygen kunde inte hämtas.`],
  [`"Logga in på claude.ai för att skicka."`, `"Logga in för att skicka."`],
  [`sparas i ditt claude.ai-konto, i en del av appen som bara du kan läsa. Inte heller den som gjort appen kan se den.`,
   `sparas på ditt Groundly-konto (lagras hos Google Firebase). Andra användare kan inte se dem.`],
  [`följer med ditt claude.ai-konto.`, `följer med ditt Groundly-konto.`],
  [`Be ägaren bjuda in dig så att du kan använda sidan.`, `Logga in och försök igen.`],
  [`I Claude-appen på mobilen öppnar Spara bild delningsmenyn, så du kan skicka bilden direkt till Instagram eller andra appar.`,
   `Bilden laddas ner som en fil. På mobilen kan du också hålla fingret på bilden för att dela den.`]
];
for (const [a, b] of swaps) {
  if (!html.includes(a)) throw new Error("Hittar inte texten att byta:\n  " + a.slice(0, 120));
  html = html.split(a).join(b);
}

// ---- dokumenthuvud + runtime (claude.ai lade till skelettet automatiskt) ----
const head = `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Groundly – planera och logga dina fotbollsresor. Matcher, arenor, serietabeller, forum och reportage.">
<meta name="theme-color" content="#1d6b3b">
<script>
// Appens kod frågar window.claude.use(...) direkt vid start; runtime.js (Firebase) svarar när den är klar.
(function(){var ready,p=new Promise(function(r){ready=r});window.__groundlyReady=ready;
setTimeout(function(){ready({use:function(){return Promise.resolve(null)}})},15000);
window.claude={use:function(n){return p.then(function(rt){return rt.use(n)})}};})();
</script>
<script type="module" src="js/runtime.js"></script>
`;
html = head + html.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "") + "\n</html>\n";

fs.mkdirSync(path.join(SITE, "data"), { recursive: true });
fs.writeFileSync(path.join(SITE, "index.html"), html);
fs.writeFileSync(path.join(SITE, "data", "flags.json"), JSON.stringify(R("flags.js")));
fs.writeFileSync(path.join(SITE, "data", "maps.json"), JSON.stringify(Object.fromEntries(Object.entries(maps).map(([k, v]) => [k, { path: v.path, path2: v.path2 || null }]))));
fs.writeFileSync(path.join(SITE, ".nojekyll"), "");

// syntaxkontroll av appens skript
const js = html.split("<script>")[2].split("</script>")[0];
new Function(js);
console.log(`site/index.html ${html.length} byte, AI ${aiOn ? "på" : "av"}, skript ok`);
