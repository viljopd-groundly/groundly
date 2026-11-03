// Hämtar serier och lag (med arena) från API-Football. Körs i Actions (.github/workflows/fetch-teams.yml).
// Indata: COUNTRY (t.ex. "Sweden") och MATCH (regex på serienamn). Skriver tools/teams_raw.json.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const KEY = (process.env.API_FOOTBALL_KEY || "").trim(); if (!KEY) { console.error("nyckel saknas"); process.exit(1); }
const sleep = ms => execSync(`sleep ${ms / 1000}`);
function get(q) { for (let i = 0; i < 4; i++) { let j; try { j = JSON.parse(execSync(`curl -sS -m 60 -H "x-apisports-key: ${KEY}" "https://v3.football.api-sports.io/${q}"`, { encoding: "utf8", maxBuffer: 64 << 20 })); } catch (e) { sleep(5000); continue; }
  const errs = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors)); if (errs && errs.length) { if (!Array.isArray(j.errors) && j.errors.rateLimit) { sleep(61000); continue; } throw new Error(JSON.stringify(j.errors)); } sleep(250); return j.response || []; } throw new Error("svarar inte"); }
// koordinater via OpenStreetMap (Nominatim): högst ett anrop per sekund, med en tydlig avsändare
const GEOC = {};
function geocode(q) { if (q in GEOC) return GEOC[q]; let r = null;
  try { const j = JSON.parse(execSync(`curl -sS -m 30 -H "User-Agent: groundly-bot (github.com/viljopd-groundly/groundly)" "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}"`, { encoding: "utf8" })); if (j && j[0]) r = [+(+j[0].lat).toFixed(4), +(+j[0].lon).toFixed(4)]; } catch (e) {}
  sleep(1100); GEOC[q] = r; return r; }
// Flera länder på en gång: JOBS="Argentina=^liga profesional;Brazil=^serie (a|b)$" skriver tools/teams_world.json
const jobs = (process.env.JOBS || "").split(";").map(x => x.trim()).filter(Boolean).map(x => { const i = x.indexOf("="); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; });
if (jobs.length) { const res = []; for (const [c, m] of jobs) { try { res.push(fetchCountry(c, new RegExp(m, "i"), true)); } catch (e) { res.push({ country: c, error: String(e.message).slice(0, 200) }); } }
  fs.writeFileSync(path.join(__dirname, "..", "tools", "teams_world.json"), JSON.stringify({ fetched: new Date().toISOString(), countries: res }, null, 1));
  console.log(res.map(r => `${r.country}: ${(r.leagues || []).map(l => `${l.name} ${l.teams.length}`).join(", ") || r.error}`).join("\n")); process.exit(0); }
const country = process.env.COUNTRY || "Sweden", re = new RegExp(process.env.MATCH || ".", "i");
const out = fetchCountry(country, re);
function fetchCountry(country, re, leaguesOnly) {
const all = get(`leagues?country=${encodeURIComponent(country)}`);
const out = { country, fetched: new Date().toISOString(), all: all.map(x => `${x.league.id} | ${x.league.name} | ${x.league.type}`), leagues: [] };
for (const x of all.filter(x => re.test(x.league.name) && (!leaguesOnly || x.league.type === "League"))) {
  const cur = (x.seasons || []).find(s => s.current) || (x.seasons || []).slice(-1)[0];
  const L = { id: x.league.id, name: x.league.name, season: cur && cur.year, seasons: (x.seasons || []).map(s => [s.year, s.start, s.end, !!(s.coverage && s.coverage.standings), !!(s.coverage && s.coverage.fixtures && s.coverage.fixtures.events)]), teams: [] };
  try { L.teams = get(`teams?league=${L.id}&season=${L.season}`).map(t => ({ id: t.team.id, name: t.team.name, founded: t.team.founded, venue: t.venue && { name: t.venue.name, city: t.venue.city, capacity: t.venue.capacity, surface: t.venue.surface } })); } catch (e) { L.error = String(e.message).slice(0, 200); }
  // flera länder (JOBS): räkna seriematcher per lag (1 anrop per serie) och hämta koordinater för arenan
  if (leaguesOnly && L.teams.length) {
    try { const fx = get(`fixtures?league=${L.id}&season=${L.season}`); const n = {}; fx.forEach(f => { [f.teams.home.id, f.teams.away.id].forEach(id => n[id] = (n[id] || 0) + 1); }); L.fixtures = fx.length; L.teams.forEach(t => t.matches = n[t.id] || 0); } catch (e) { L.fxError = String(e.message).slice(0, 200); }
    L.teams.forEach(t => { if (!t.venue || !t.venue.city) return; t.ll = geocode([t.venue.name, t.venue.city, country].filter(Boolean).join(", ")) || geocode(`${t.venue.city}, ${country}`); });
  }
  out.leagues.push(L);
}
return out; }
fs.writeFileSync(path.join(__dirname, "..", "tools", "teams_raw.json"), JSON.stringify(out, null, 1));
console.log(out.leagues.map(l => `${l.name}: ${l.teams.length}`).join(", "));
