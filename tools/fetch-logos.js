// Hämtar klubbmärken från API-Football (gratis, räknas inte mot kvoten) till site/logos/c/<vårt id>.png.
// Bara nya märken hämtas; misslyckade sparas i tools/logo_bad.json och hoppas över i 30 dagar.
// Kör: node tools/fetch-logos.js   (LOGO_MAX begränsar antalet per körning, standard 4000)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), DIR = path.join(ROOT, "site", "logos", "c");
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, "logo_ids.json"), "utf8"));
const BADF = path.join(__dirname, "logo_bad.json"); let bad = {}; try { bad = JSON.parse(fs.readFileSync(BADF, "utf8")); } catch (e) {}
const MAX = +(process.env.LOGO_MAX || 4000), now = Date.now();
fs.mkdirSync(DIR, { recursive: true });
let got = 0, fail = 0, tried = 0;
for (const [id, aid] of Object.entries(ids)) {
  if (!/^[\p{L}\p{N}_-]+$/u.test(id)) continue;
  const f = path.join(DIR, id + ".png");
  if (fs.existsSync(f)) continue;
  if (bad[id] && now - bad[id] < 30 * 864e5) continue;
  if (tried >= MAX) break; tried++;
  try {
    const buf = execFileSync("curl", ["-sSfL", "-m", "30", `https://media.api-sports.io/football/teams/${aid}.png`], { maxBuffer: 8 << 20 });
    if (buf.length > 200 && buf[0] === 0x89 && buf[1] === 0x50) { fs.writeFileSync(f, buf); got++; delete bad[id]; }
    else { bad[id] = now; fail++; }
  } catch (e) { bad[id] = now; fail++; }
  execFileSync("sleep", ["0.05"]);
}
fs.writeFileSync(BADF, JSON.stringify(bad));
console.log(JSON.stringify({ klubbmärken: { hämtade: got, misslyckade: fail, totalt: fs.readdirSync(DIR).length } }));
