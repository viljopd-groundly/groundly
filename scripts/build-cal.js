// Kalenderflöden per lag: site/cal/<lag>.ics med kommande matcher (och de senaste två veckornas).
// Prenumereras med webcal:// i Apple- och Outlook-kalendern eller via Google Kalender; uppdateras vid varje bygge.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), SITE = path.join(ROOT, "site"), OUT = path.join(SITE, "cal");
const BASE = "https://viljopd-groundly.github.io/groundly/";
const calFile = id => String(id).replace(/[^a-z0-9-]/g, c => "_" + c.codePointAt(0).toString(16)) + ".ics";
module.exports = { calFile };
if (require.main !== module) return;
const clubs = require(path.join(ROOT, "src", "clubs.js")); const C = {}; clubs.forEach(r => { C[r[0]] = { n: r[1], city: r[4], s: r[8] }; });
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(SITE, "data", f), "utf8")); } catch (e) { return null; } };
const ms = [];
for (const f of ["fixtures-next.json", "fixtures.json"]) { const d = read(f); (d && d.rows || []).forEach(r => ms.push({ id: `${r[3]}-${r[0]}-${r[1]}`, home: r[0], away: r[1], ko: r[2], date: r[3], comp: r[5] })); }
const db = read("dbmatches.json"); (db && db.docs || []).forEach(x => { const m = x.data || {}; if (m.home || m.away) ms.push({ id: x.id, home: m.home, away: m.away, hn: m.homeName, an: m.awayName, ko: m.kickoff, date: m.kickoff ? m.kickoff.slice(0, 10) : m.dateFrom, comp: m.comp, venue: m.venue, city: m.city }); });
const from = Date.now() - 14 * 864e5, seen = new Set(), by = {};
for (const m of ms) { const t = Date.parse(m.ko || m.date); if (!(t >= from) || seen.has(m.id)) continue; seen.add(m.id); [m.home, m.away].forEach(id => { if (id && C[id]) (by[id] = by[id] || []).push(m); }); }
const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, x => "\\" + x).replace(/\n/g, "\\n");
const fold = l => { const o = []; let s = l; while (Buffer.byteLength(s) > 74) { let i = 74; while (Buffer.byteLength(s.slice(0, i)) > 74) i--; o.push(s.slice(0, i)); s = " " + s.slice(i); } o.push(s); return o.join("\r\n"); };
const ut = d => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const stamp = ut(Date.now());
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [id, list] of Object.entries(by)) {
  const c = C[id]; const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Groundly//Matcher//SV", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(c.n + " · Groundly")}`, "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H"];
  for (const m of list.sort((a, b) => String(a.ko || a.date).localeCompare(String(b.ko || b.date)))) {
    const hn = (C[m.home] && C[m.home].n) || m.hn || m.home, an = (C[m.away] && C[m.away].n) || m.an || m.away;
    const venue = m.venue || (C[m.home] && C[m.home].s) || "", city = m.city || (C[m.home] && C[m.home].city) || "";
    L.push("BEGIN:VEVENT", `UID:${esc(m.id)}@groundly`, `DTSTAMP:${stamp}`);
    if (m.ko) { L.push(`DTSTART:${ut(m.ko)}`, `DTEND:${ut(Date.parse(m.ko) + 2 * 36e5)}`); }
    else { const d = String(m.date).replace(/-/g, ""); const nx = new Date(Date.parse(m.date) + 864e5).toISOString().slice(0, 10).replace(/-/g, ""); L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${nx}`); }
    L.push(fold(`SUMMARY:${esc(hn + " – " + an)}`), fold(`LOCATION:${esc([venue, city].filter(Boolean).join(", "))}`), fold(`DESCRIPTION:${esc((m.comp || "") + "\nGroundly: " + BASE)}`), `URL:${BASE}`, "END:VEVENT");
  }
  L.push("END:VCALENDAR"); fs.writeFileSync(path.join(OUT, calFile(id)), L.join("\r\n") + "\r\n"); n++;
}
console.log(`site/cal: ${n} kalenderflöden`);
