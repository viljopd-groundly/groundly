// Bygger site/archive/index.json från filerna i site/archive/<kod>/<säsong>.json.
// Körs i slutet av nattjobbet (och kan köras för hand): node tools/archive-index.js [site-mapp]
// Varje rad: [kod, liganamn, säsongsnyckel, säsongsetikett, antal matcher]. Nyaste säsongen först per kod,
// så att appen visar ligans nuvarande namn (t.ex. Championship, inte First Division).
const fs = require("fs"), path = require("path");
function buildIndex(site) {
  const A = path.join(site, "archive"), rows = [];
  for (const code of fs.readdirSync(A).sort()) {
    const dir = path.join(A, code);
    if (!fs.statSync(dir).isDirectory()) continue;
    const seasons = fs.readdirSync(dir).filter(f => /^\d{4}(-\d{2})?\.json$/.test(f)).map(f => f.slice(0, -5)).sort().reverse();
    for (const s of seasons) {
      let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, s + ".json"), "utf8")); } catch (e) { continue; }
      if (!j || !Array.isArray(j.m) || !j.m.length) continue;
      rows.push([code, j.l || code, s, s.includes("-") ? s.replace("-", "/") : s, j.m.length]);
    }
  }
  fs.writeFileSync(path.join(A, "index.json"), JSON.stringify(rows));
  return rows;
}
if (require.main === module) {
  const site = path.resolve(process.argv[2] || path.join(__dirname, "..", "site"));
  const rows = buildIndex(site);
  console.log(`archive/index.json: ${rows.length} säsonger i ${new Set(rows.map(r => r[0])).size} serier`);
}
module.exports = { buildIndex };
