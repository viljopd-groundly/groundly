// Hämtar damserier och damlag från API-Football (körs i GitHub Actions, se .github/workflows/women.yml).
// Skriver tools/women_raw.json: serier per land med lag, arena, stad och kapacitet. Nyckeln skrivs aldrig ut.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const KEY = (process.env.API_FOOTBALL_KEY || "").trim();
if (!KEY) { console.error("API_FOOTBALL_KEY saknas"); process.exit(1); }
const BASE = "https://v3.football.api-sports.io";
let calls = 0;
const sleep = ms => execSync(`sleep ${ms / 1000}`);
function get(q) {
  for (let i = 0; i < 4; i++) {
    calls++;
    let j;
    try { j = JSON.parse(execSync(`curl -sS -m 60 -H "x-apisports-key: ${KEY}" "${BASE}/${q}"`, { encoding: "utf8", maxBuffer: 64 << 20 })); }
    catch (e) { sleep(5000); continue; }
    const errs = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors));
    if (errs && errs.length) { if (!Array.isArray(j.errors) && j.errors.rateLimit) { sleep(61000); continue; } throw new Error(JSON.stringify(j.errors)); }
    sleep(250); return j.response || [];
  }
  throw new Error("svarar inte: " + q);
}
const COUNTRIES = ["Sweden", "Norway", "Denmark", "Finland", "Iceland", "England", "Spain", "Germany", "Italy", "France"];
const WOMEN = /women|woman|femen|f[ée]minine|frauen|dam|kvinde|kvenna|naisten|kansallinen|toppserien|wsl|liga f\b|premi[eè]re ligue|seconde ligue|elitettan|girls/i;
const out = { fetched: new Date().toISOString(), countries: {} };
for (const c of COUNTRIES) {
  const ls = get(`leagues?country=${encodeURIComponent(c)}`).filter(x => WOMEN.test(x.league.name) && x.league.type === "League");
  out.countries[c] = [];
  for (const x of ls) {
    const cur = (x.seasons || []).find(s => s.current) || (x.seasons || []).slice(-1)[0];
    const L = { id: x.league.id, name: x.league.name, season: cur && cur.year, start: cur && cur.start, end: cur && cur.end, teams: [] };
    try {
      L.teams = get(`teams?league=${L.id}&season=${L.season}`).map(t => ({
        id: t.team.id, name: t.team.name, code: t.team.code, founded: t.team.founded, logo: t.team.logo,
        venue: t.venue && { name: t.venue.name, city: t.venue.city, address: t.venue.address, capacity: t.venue.capacity, surface: t.venue.surface }
      }));
    } catch (e) { L.error = String(e.message).slice(0, 200); }
    out.countries[c].push(L);
  }
}
out.calls = calls;
fs.writeFileSync(path.join(__dirname, "..", "tools", "women_raw.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.countries).map(([c, ls]) => [c, ls.map(l => `${l.name} (${l.id}, ${l.season}): ${l.teams.length} lag`)])), null, 1));
console.log("anrop", calls);
