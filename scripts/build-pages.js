// Enkla, statiska sidor som Google kan hitta: en per klubb, arena, serie och land + sitemap.xml.
// Byggs vid varje publicering (efter nattens data), så kommande matcher och tabeller är färska.
//   site/klubb/<namn>/   site/arena/<namn>/   site/serie/<namn>/   site/land/<namn>/   site/klubbar/
// Sidorna är på svenska och länkar in i appen (?klubb=<id>), som tar över för planering och loggning.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), SITE = path.join(ROOT, "site");
const CFG = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "config", "site.json"), "utf8")); } catch (e) { return {}; } })();
const BASE = String(process.env.SITE_URL || CFG.url || "https://viljopd-groundly.github.io/groundly/").replace(/\/?$/, "/");
const { calFile } = require("./build-cal.js");
const DIRS = ["klubb", "arena", "serie", "land", "klubbar", "p"];
for (const d of DIRS) fs.rmSync(path.join(SITE, d), { recursive: true, force: true });

// ---------- data ----------
const rows = require(path.join(ROOT, "src", "clubs.js"));
const C = {};
for (const r of rows) {
  if (/^nt-/.test(r[0]) || r[6] === "Landslag" || r[7] == null) continue; // landslag har egna vyer i appen
  C[r[0]] = { id: r[0], n: r[1], country: r[3], city: r[4], f: r[5], l: r[6], t: r[7], s: r[8], cap: r[9], nick: r[10] };
}
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(SITE, "data", f), "utf8")); } catch (e) { return null; } };
const fx = (read("fixtures-next.json") || {}).rows || [];
const past = (read("fixtures-past.json") || {}).rows || [];
const ST = (read("standings.json") || {}).leagues || {};
const now = Date.now();
const upcoming = fx.filter(r => r[2] ? Date.parse(r[2]) > now - 2 * 36e5 : r[3] >= new Date().toISOString().slice(0, 10)).sort((a, b) => String(a[2] || a[3]).localeCompare(String(b[2] || b[3])));
const played = past.filter(r => r[4]).sort((a, b) => String(b[2] || b[3]).localeCompare(String(a[2] || a[3])));
const byTeam = {}, lastByTeam = {};
for (const r of upcoming) for (const id of [r[0], r[1]]) if (C[id]) (byTeam[id] = byTeam[id] || []).push(r);
for (const r of played) for (const id of [r[0], r[1]]) if (C[id]) { const a = (lastByTeam[id] = lastByTeam[id] || []); if (a.length < 5) a.push(r); }
const logos = new Set((() => { try { return fs.readdirSync(path.join(SITE, "logos", "c")).filter(f => f.endsWith(".png")).map(f => f.slice(0, -4)); } catch (e) { return []; } })());

// ---------- hjälp ----------
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MAPCH = { "ø": "o", "æ": "ae", "å": "a", "ß": "ss", "ł": "l", "đ": "d", "ı": "i", "œ": "oe", "þ": "th", "ð": "d" };
const slug = s => String(s || "").toLowerCase().replace(/[øæåßłđıœþð]/g, c => MAPCH[c]).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const uniq = () => { const used = new Set(); return (base, alt) => { let s = slug(base); if (used.has(s) && alt) s = slug(base + " " + alt); let k = s, i = 2; while (used.has(k)) k = s + "-" + i++; used.add(k); return k; }; };
const fmtKo = r => {
  if (!r[2]) return new Date(r[3] + "T12:00:00Z").toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const d = new Date(r[2]);
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Stockholm" }) + " " + d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" });
};
const tierTxt = t => t === 1 ? "högsta serien" : t ? `nivå ${t}` : "";
const nf = n => Number(n).toLocaleString("sv-SE");

// ---------- adresser ----------
const clubSlug = {}, arenaSlug = {}, leagueSlug = {}, countrySlug = {};
{ const u = uniq(); Object.values(C).sort((a, b) => (a.t || 9) - (b.t || 9)).forEach(c => clubSlug[c.id] = u(c.n, c.city)); }
const arenas = {}; // nyckel: arena|stad
for (const c of Object.values(C)) if (c.s) { const k = slug(c.s) + "|" + slug(c.city); (arenas[k] = arenas[k] || { s: c.s, city: c.city, country: c.country, cap: c.cap, clubs: [] }).clubs.push(c); if (c.cap > (arenas[k].cap || 0)) arenas[k].cap = c.cap; }
{ const u = uniq(); Object.entries(arenas).sort((a, b) => (b[1].cap || 0) - (a[1].cap || 0)).forEach(([k, a]) => { arenaSlug[k] = u(a.s, a.city); a.slug = arenaSlug[k]; }); }
const arenaOf = c => c.s ? arenas[slug(c.s) + "|" + slug(c.city)] : null;
const leagues = {};
for (const c of Object.values(C)) if (c.l) { const k = c.l; (leagues[k] = leagues[k] || { l: c.l, t: c.t, countries: {}, clubs: [] }).clubs.push(c); leagues[k].countries[c.country] = (leagues[k].countries[c.country] || 0) + 1; }
for (const L of Object.values(leagues)) L.country = Object.entries(L.countries).sort((a, b) => b[1] - a[1])[0][0];
{ const u = uniq(); Object.values(leagues).sort((a, b) => (a.t || 9) - (b.t || 9)).forEach(L => { L.slug = u(L.l, L.country); leagueSlug[L.l] = L.slug; }); }
const countries = {};
for (const c of Object.values(C)) (countries[c.country] = countries[c.country] || { n: c.country, clubs: 0, leagues: new Set() }).clubs++, countries[c.country].leagues.add(c.l);
{ const u = uniq(); Object.values(countries).forEach(k => { k.slug = u(k.n); countrySlug[k.n] = k.slug; }); }

// ---------- sidmall ----------
const page = (dir, title, desc, body, { ld = null, crumbs = [] } = {}) => {
  const depth = dir.split("/").filter(Boolean).length, up = "../".repeat(depth), url = BASE + dir + (dir ? "/" : "");
  const cr = crumbs.length ? `<nav class="crumbs" aria-label="Brödsmulor"><a href="${up}klubbar/">Klubbar</a>${crumbs.map(([t, h]) => ` › ${h ? `<a href="${up}${h}">${esc(t)}</a>` : esc(t)}`).join("")}</nav>` : "";
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Groundly"><meta property="og:locale" content="sv_SE">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${BASE}og.png?v=2"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b1224"><link rel="icon" href="${up}icon-192.png"><link rel="stylesheet" href="${up}p/style.css">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : ""}</head><body>
<header class="top"><a class="brand" href="${up}"><img src="${up}icon-192.png" width="32" height="32" alt=""><span><b>Ground</b>ly</span></a><a class="btn" href="${up}">Öppna appen</a></header>
<main>${cr}${body}</main>
<footer><p><a href="${up}">Groundly</a> – planera fotbollsresor och logga matcherna du sett. Matchtider visas i svensk tid och kan ändras; kontrollera alltid hos klubben.</p>
<p>Klubbmärken tillhör respektive klubb och visas bara för att identifiera lagen. Groundly har ingen koppling till klubbar, ligor eller förbund.</p></footer>
<script>/* kom besökaren via en märkt länk (?src=club m.fl.) följer märkningen med in i appen, så att statistiken ser varifrån */(function(){var s=new URLSearchParams(location.search).get("src");if(!s||!/^[a-z]{1,12}$/.test(s))return;document.querySelectorAll('a[href*="?klubb="]').forEach(function(a){a.href+="&src="+s;});})();</script></body></html>`;
};
const out = [];
const write = (dir, html, prio = 0.5) => { const d = path.join(SITE, dir); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "index.html"), html); out.push([dir + "/", prio]); };
const crestImg = (id, up, sz = 28) => logos.has(id) ? `<img class="crest" src="${up}logos/c/${encodeURIComponent(id)}.png" width="${sz}" height="${sz}" alt="" loading="lazy">` : `<span class="crest ini" style="width:${sz}px;height:${sz}px">${esc((C[id] ? C[id].n : "?").replace(/[^A-Za-zÅÄÖåäö0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase())}</span>`;
const clubLink = (id, up) => C[id] ? `<a href="${up}klubb/${clubSlug[id]}/">${esc(C[id].n)}</a>` : esc(id);
const matchList = (list, up, me) => `<ul class="ml">${list.map(r => {
  const home = r[0] === me, opp = home ? r[1] : r[0], o = C[opp];
  return `<li><span class="when">${esc(fmtKo(r))}</span><span class="who">${me ? `${crestImg(opp, up, 22)}<span>${home ? "" : "@ "}${o ? clubLink(opp, up) : esc(opp)}</span>` : `${crestImg(r[0], up, 22)}${clubLink(r[0], up)} – ${crestImg(r[1], up, 22)}${clubLink(r[1], up)}`}</span><span class="meta">${esc(r[5] || "")}${r[4] ? " · " + esc(r[4]) : ""}</span></li>`;
}).join("")}</ul>`;
const resList = (list, up, me) => `<ul class="ml">${list.map(r => { const [gh, ga] = String(r[4]).split(/[–-]/).map(Number); const home = r[0] === me, opp = home ? r[1] : r[0]; const my = home ? gh : ga, th = home ? ga : gh; const res = my > th ? "V" : my < th ? "F" : "O";
  return `<li><span class="when">${esc(new Date((r[3] || "") + "T12:00:00Z").toLocaleDateString("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" }))}</span><span class="who">${crestImg(opp, up, 22)}<span>${home ? "" : "@ "}${clubLink(opp, up)}</span></span><span class="res r${res}">${esc(r[4])}</span></li>`; }).join("")}</ul>`;
const table = (lname, up) => { const s = ST[lname]; if (!s || !s.groups || !s.groups.length) return ""; return s.groups.slice(0, 3).map(g => `<h2>Tabell${s.groups.length > 1 && g.name ? " – " + esc(g.name) : ""} ${s.season ? `<small>${esc(s.season)}</small>` : ""}</h2><table class="tbl"><thead><tr><th>#</th><th class="l">Lag</th><th>M</th><th>+/-</th><th>P</th></tr></thead><tbody>${g.rows.map(x => `<tr><td>${x[2]}</td><td class="l">${C[x[0]] ? crestImg(x[0], up, 18) + clubLink(x[0], up) : esc(x[1])}</td><td>${x[3]}</td><td>${x[7] - x[8] > 0 ? "+" : ""}${x[7] - x[8]}</td><td><b>${x[9]}</b></td></tr>`).join("")}</tbody></table>`).join(""); };

// ---------- klubbsidor ----------
for (const c of Object.values(C)) {
  const dir = "klubb/" + clubSlug[c.id], up = "../../", a = arenaOf(c), L = leagues[c.l];
  const next = (byTeam[c.id] || []).slice(0, 8), home = (byTeam[c.id] || []).find(r => r[0] === c.id), last = lastByTeam[c.id] || [];
  const desc = `${c.n} från ${c.city || c.country}${c.s ? ` spelar på ${c.s}` : ""}${c.l ? ` (${c.l})` : ""}.${home ? ` Nästa hemmamatch: ${fmtKo(home)} mot ${(C[home[1]] || {}).n || home[1]}.` : ""} Se arenan, kommande matcher och planera din fotbollsresa.`;
  const facts = [["Land", countries[c.country] ? `<a href="${up}land/${countrySlug[c.country]}/">${esc(c.country)}</a>` : esc(c.country)], ["Stad", esc(c.city)], ["Serie", L ? `<a href="${up}serie/${L.slug}/">${esc(c.l)}</a>${c.t ? ` <span class="meta">(${tierTxt(c.t)})</span>` : ""}` : esc(c.l)],
    ["Arena", a ? `<a href="${up}arena/${a.slug}/">${esc(c.s)}</a>` : esc(c.s)], ["Publikkapacitet", c.cap ? nf(c.cap) : ""], ["Grundad", c.f || ""], ["Smeknamn", esc(c.nick || "")]].filter(x => x[1]);
  const body = `<section class="hero">${crestImg(c.id, up, 64)}<div><h1>${esc(c.n)}</h1><p class="sub">${esc([c.city, c.country].filter(Boolean).join(", "))}${c.l ? " · " + esc(c.l) : ""}</p></div></section>
<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
<p class="cta"><a class="btn big" href="${up}?klubb=${encodeURIComponent(c.id)}">Planera en resa till ${esc(c.n)}</a>${byTeam[c.id] ? ` <a class="btn ghost" href="webcal://${BASE.replace(/^https?:\/\//, "")}cal/${calFile(c.id)}">Matcherna i din kalender</a>` : ""}</p>
${next.length ? `<h2>Kommande matcher</h2>${matchList(next, up, c.id)}` : `<p class="meta">Inga kommande matcher i schemat just nu.</p>`}
${last.length ? `<h2>Senaste resultat</h2>${resList(last, up, c.id)}` : ""}
${c.l && ST[c.l] ? table(c.l, up) : ""}`;
  const ld = { "@context": "https://schema.org", "@type": "SportsTeam", name: c.n, sport: "Soccer", url: BASE + dir + "/", ...(c.f ? { foundingDate: String(c.f) } : {}), ...(logos.has(c.id) ? { logo: BASE + "logos/c/" + encodeURIComponent(c.id) + ".png" } : {}),
    ...(c.s ? { location: { "@type": "StadiumOrArena", name: c.s, address: { "@type": "PostalAddress", addressLocality: c.city, addressCountry: c.country }, ...(c.cap ? { maximumAttendeeCapacity: c.cap } : {}) } } : {}),
    ...(c.l ? { memberOf: { "@type": "SportsOrganization", name: c.l } } : {}) };
  write(dir, page(dir, `${c.n} – arena, matcher och resa | Groundly`, desc, body, { ld, crumbs: [[c.country, countries[c.country] ? `land/${countrySlug[c.country]}/` : ""], ...(L ? [[c.l, `serie/${L.slug}/`]] : []), [c.n]] }), c.t === 1 ? 0.8 : c.t === 2 ? 0.7 : 0.6);
}
// ---------- arenasidor ----------
for (const a of Object.values(arenas)) {
  const dir = "arena/" + a.slug, up = "../../", ids = new Set(a.clubs.map(c => c.id));
  const next = upcoming.filter(r => ids.has(r[0])).slice(0, 10);
  const desc = `${a.s} i ${a.city || a.country}${a.cap ? ` tar ${nf(a.cap)} åskådare` : ""}. Hemmaarena för ${a.clubs.map(c => c.n).join(" och ")}.${next.length ? ` Nästa match: ${fmtKo(next[0])}, ${(C[next[0][0]] || {}).n} mot ${(C[next[0][1]] || {}).n || next[0][1]}.` : ""}`;
  const body = `<section class="hero"><div class="pin">⌖</div><div><h1>${esc(a.s)}</h1><p class="sub">${esc([a.city, a.country].filter(Boolean).join(", "))}${a.cap ? " · " + nf(a.cap) + " platser" : ""}</p></div></section>
<h2>Hemmalag</h2><ul class="clubs">${a.clubs.map(c => `<li>${crestImg(c.id, up, 28)}<a href="${up}klubb/${clubSlug[c.id]}/">${esc(c.n)}</a> <span class="meta">${esc(c.l || "")}</span></li>`).join("")}</ul>
<p class="cta"><a class="btn big" href="${up}?klubb=${encodeURIComponent(a.clubs[0].id)}">Planera en resa hit</a></p>
${next.length ? `<h2>Kommande matcher på ${esc(a.s)}</h2>${matchList(next, up, null)}` : `<p class="meta">Inga kommande matcher i schemat just nu.</p>`}`;
  const ld = { "@context": "https://schema.org", "@type": "StadiumOrArena", name: a.s, url: BASE + dir + "/", address: { "@type": "PostalAddress", addressLocality: a.city, addressCountry: a.country }, ...(a.cap ? { maximumAttendeeCapacity: a.cap } : {}) };
  write(dir, page(dir, `${a.s}, ${a.city || a.country} – matcher och resa | Groundly`, desc, body, { ld, crumbs: [[a.country, countries[a.country] ? `land/${countrySlug[a.country]}/` : ""], [a.s]] }), (a.cap || 0) > 20000 ? 0.7 : 0.5);
}
// ---------- seriesidor ----------
for (const L of Object.values(leagues)) {
  const dir = "serie/" + L.slug, up = "../../", ids = new Set(L.clubs.map(c => c.id));
  const next = upcoming.filter(r => r[5] === L.l || (ids.has(r[0]) && ids.has(r[1]))).slice(0, 12);
  const desc = `${L.l} – ${L.country}${L.t ? `, ${tierTxt(L.t)}` : ""}. ${L.clubs.length} lag${ST[L.l] ? ", tabell" : ""} och kommande matcher. Planera din fotbollsresa med Groundly.`;
  const body = `<section class="hero"><div class="pin">🏆</div><div><h1>${esc(L.l)}</h1><p class="sub">${esc(L.country)}${L.t ? " · " + tierTxt(L.t) : ""} · ${L.clubs.length} lag</p></div></section>
${table(L.l, up)}
${next.length ? `<h2>Kommande matcher</h2>${matchList(next, up, null)}` : ""}
<h2>Lagen</h2><ul class="clubs">${L.clubs.sort((a, b) => a.n.localeCompare(b.n, "sv")).map(c => `<li>${crestImg(c.id, up, 24)}<a href="${up}klubb/${clubSlug[c.id]}/">${esc(c.n)}</a> <span class="meta">${esc(c.city || "")}</span></li>`).join("")}</ul>`;
  write(dir, page(dir, `${L.l} – tabell, lag och matcher | Groundly`, desc, body, { crumbs: [[L.country, countries[L.country] ? `land/${countrySlug[L.country]}/` : ""], [L.l]] }), L.t === 1 ? 0.8 : 0.6);
}
// ---------- landsidor + översikt ----------
for (const k of Object.values(countries)) {
  const dir = "land/" + k.slug, up = "../../";
  const ls = [...k.leagues].filter(Boolean).map(l => leagues[l]).filter(L => L && L.country === k.n).sort((a, b) => (a.t || 9) - (b.t || 9) || a.l.localeCompare(b.l, "sv"));
  const ar = Object.values(arenas).filter(a => a.country === k.n).sort((a, b) => (b.cap || 0) - (a.cap || 0)).slice(0, 12);
  const body = `<section class="hero"><div class="pin">⚽</div><div><h1>Fotboll i ${esc(k.n)}</h1><p class="sub">${k.clubs} klubbar · ${ls.length} serier</p></div></section>
<h2>Serier</h2><ul class="clubs">${ls.map(L => `<li><a href="${up}serie/${L.slug}/">${esc(L.l)}</a> <span class="meta">${tierTxt(L.t)} · ${L.clubs.length} lag</span></li>`).join("")}</ul>
${ar.length ? `<h2>Största arenorna</h2><ul class="clubs">${ar.map(a => `<li><a href="${up}arena/${a.slug}/">${esc(a.s)}</a> <span class="meta">${esc(a.city || "")}${a.cap ? " · " + nf(a.cap) : ""}</span></li>`).join("")}</ul>` : ""}`;
  write(dir, page(dir, `Fotboll i ${k.n} – serier, klubbar och arenor | Groundly`, `Alla serier, klubbar och arenor i ${k.n} på Groundly: tabeller, kommande matcher och resväg för din fotbollsresa.`, body, { crumbs: [[k.n]] }), 0.6);
}
{
  const up = "../", list = Object.values(countries).sort((a, b) => b.clubs - a.clubs);
  write("klubbar", page("klubbar", "Klubbar, arenor och serier i hela världen | Groundly", `${nf(Object.keys(C).length)} klubbar och ${nf(Object.keys(arenas).length)} arenor i ${list.length} länder – med kommande matcher, tabeller och resväg.`,
    `<h1>Klubbar och arenor</h1><p class="sub">${nf(Object.keys(C).length)} klubbar · ${nf(Object.keys(arenas).length)} arenor · ${list.length} länder</p><ul class="clubs cols">${list.map(k => `<li><a href="${up}land/${k.slug}/">${esc(k.n)}</a> <span class="meta">${k.clubs}</span></li>`).join("")}</ul>`), 0.9);
}
// ---------- stil, sitemap, robots ----------
fs.mkdirSync(path.join(SITE, "p"), { recursive: true });
fs.writeFileSync(path.join(SITE, "p", "style.css"), `@font-face{font-family:BS;src:url(../fonts/BigShoulders.woff) format("woff");font-display:swap}
@font-face{font-family:PS;src:url(../fonts/PublicSans.woff) format("woff");font-display:swap}
:root{--bg:#0b1224;--surface:#152038;--line:#26324d;--fg:#e8edf5;--muted:#8f9bb3;--accent:#6FD08C}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 PS,system-ui,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.top{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:rgba(11,18,36,.92);backdrop-filter:blur(8px);border-bottom:2px solid #1f6a3e;z-index:2}
.brand{display:flex;align-items:center;gap:10px;color:var(--fg);font:800 26px BS,sans-serif;text-transform:uppercase;letter-spacing:.5px}.brand img{border-radius:8px}.brand b{color:var(--accent)}
.btn{display:inline-block;padding:9px 16px;border-radius:99px;background:var(--accent);color:#0b1a12;font-weight:700}.btn:hover{text-decoration:none;filter:brightness(1.08)}
.btn.big{padding:13px 22px;font-size:17px}.btn.ghost{background:transparent;color:var(--fg);border:1.5px solid var(--line)}
main{max-width:860px;margin:0 auto;padding:18px 16px 40px}
.crumbs{font-size:14px;color:var(--muted);margin-bottom:14px}
.hero{display:flex;align-items:center;gap:18px;margin:6px 0 18px}.hero h1{font:800 46px/1 BS,sans-serif;text-transform:uppercase;margin:0}.sub{color:var(--muted);margin:6px 0 0}
.pin{width:64px;height:64px;border-radius:16px;background:var(--surface);display:grid;place-items:center;font-size:30px;color:var(--accent);flex:none}
h1{font:800 40px/1.05 BS,sans-serif;text-transform:uppercase}h2{font:800 26px BS,sans-serif;text-transform:uppercase;margin:30px 0 10px}h2 small{color:var(--muted);font:500 14px PS,sans-serif;text-transform:none}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0}.facts div{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}.facts dt{color:var(--muted);font-size:13px}.facts dd{margin:2px 0 0;font-weight:600}
.cta{margin:22px 0;display:flex;gap:10px;flex-wrap:wrap}
.ml,.clubs{list-style:none;padding:0;margin:0;display:grid;gap:6px}.ml li{display:grid;grid-template-columns:130px 1fr auto;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:9px 12px}
.when{color:var(--muted);font-size:14px}.who{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-weight:600}.who a{color:var(--fg)}.meta{color:var(--muted);font-size:13px}
.res{font-weight:800;padding:2px 9px;border-radius:8px}.rV{background:#1f6a3e}.rF{background:#6a1f2a}.rO{background:#3a4560}
.clubs li{display:flex;align-items:center;gap:9px;padding:6px 2px;border-bottom:1px solid var(--line)}.clubs a{font-weight:600}.cols{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));column-gap:20px}
.crest{object-fit:contain;flex:none}.ini{display:inline-grid;place-items:center;border-radius:50%;background:#26324d;color:var(--fg);font-size:10px;font-weight:700}
.tbl{width:100%;border-collapse:collapse;font-size:15px}.tbl th,.tbl td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:center}.tbl .l{text-align:left}.tbl td.l{display:flex;align-items:center;gap:7px}.tbl td.l a{color:var(--fg)}.tbl th{color:var(--muted);font-weight:600}
footer{max-width:860px;margin:0 auto;padding:20px 16px 40px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}
@media(max-width:560px){.hero h1{font-size:36px}.ml li{grid-template-columns:1fr auto}.ml .when{grid-column:1/-1}}
`);
const today = new Date().toISOString().slice(0, 10);
const urls = [["", 1.0], ...out];
fs.writeFileSync(path.join(SITE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, p]) => `<url><loc>${esc(BASE + u.split("/").map(encodeURIComponent).join("/"))}</loc><lastmod>${today}</lastmod><priority>${p.toFixed(1)}</priority></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(SITE, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
console.log(`sidor: ${Object.keys(C).length} klubbar, ${Object.keys(arenas).length} arenor, ${Object.keys(leagues).length} serier, ${Object.keys(countries).length} länder (${out.length} sidor i sitemap.xml)`);
