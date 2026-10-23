// Bygger site/archive/index.json från filerna i site/archive/<kod>/<säsong>.json.
// Körs i slutet av nattjobbet (och kan köras för hand): node tools/archive-index.js [site-mapp]
// Varje rad: [kod, liganamn, säsongsnyckel, säsongsetikett, antal matcher]. Nyaste säsongen först per kod,
// så att appen visar ligans nuvarande namn (t.ex. Championship, inte First Division).
const fs = require("fs"), path = require("path");
function buildIndex(site) {
  const A = path.join(site, "archive"), rows = [], teams = {};
  for (const code of fs.readdirSync(A).sort()) {
    const dir = path.join(A, code);
    if (!fs.statSync(dir).isDirectory()) continue;
    const seasons = fs.readdirSync(dir).filter(f => /^\d{4}(-\d{2})?\.json$/.test(f)).map(f => f.slice(0, -5)).sort().reverse();
    for (const s of seasons) {
      let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, s + ".json"), "utf8")); } catch (e) { continue; }
      if (!j || !Array.isArray(j.m) || !j.m.length) continue;
      rows.push([code, j.l || code, s, s.includes("-") ? s.replace("-", "/") : s, j.m.length]);
      // lag-id -> säsonger där laget finns (för "Sök lag" i arkivet)
      for (const t of j.t || []) if (t && t[1]) (teams[t[1]] = teams[t[1]] || []).push(code + "/" + s);
    }
  }
  fs.writeFileSync(path.join(A, "index.json"), JSON.stringify(rows));
  for (const k in teams) teams[k] = [...new Set(teams[k])].sort((a, b) => b.split("/")[1].localeCompare(a.split("/")[1]));
  fs.writeFileSync(path.join(A, "teams.json"), JSON.stringify(teams));
  return rows;
}
if (require.main === module) {
  const site = path.resolve(process.argv[2] || path.join(__dirname, "..", "site"));
  const rows = buildIndex(site);
  console.log(`archive/index.json: ${rows.length} säsonger i ${new Set(rows.map(r => r[0])).size} serier`);
}
module.exports = { buildIndex };
