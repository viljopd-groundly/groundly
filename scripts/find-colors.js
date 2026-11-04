// Letar klubbfärger på Wikipedia för klubbar som saknar färger (tools/colors_query.json -> tools/colors_found.json).
// Körs i Actions (.github/workflows/find-colors.yml). Läser matchtröjans färger ur faktarutan (body1 = tröja, shorts1 = byxor).
// Sidan måste ha en matchställsruta och dela ett tydligt ord med klubbens namn, annars hoppas klubben över.
const fs = require("fs"), path = require("path");
const Q = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tools", "colors_query.json"), "utf8"));
const LANG = { Sverige: "sv", Norge: "no", Danmark: "da", Finland: "fi", Island: "is", Tyskland: "de", Österrike: "de", Schweiz: "de", Spanien: "es", Mexiko: "es", Argentina: "es", Chile: "es", Colombia: "es", Peru: "es", Uruguay: "es", Paraguay: "es", Bolivia: "es", Ecuador: "es", Venezuela: "es",
  Italien: "it", Frankrike: "fr", Belgien: "fr", Nederländerna: "nl", Portugal: "pt", Brasilien: "pt", Polen: "pl", Tjeckien: "cs", Kroatien: "hr", Serbien: "sr", Turkiet: "tr", Grekland: "el", Ryssland: "ru", Ukraina: "uk", Ungern: "hu", Rumänien: "ro" };
const UA = { "User-Agent": "groundly-bot/1.0 (github.com/viljopd-groundly/groundly)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(lang, params) { const u = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ format: "json", formatversion: "2", ...params });
  for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: UA }); if (r.status === 429) { await sleep(5000); continue; } return await r.json(); } catch (e) { await sleep(2000); } } return null; }
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
const STOP = new Set("fc if ik bk ff fk sk aif ifk cf cd ud sd ac as us ss afc club sport sporting calcio football futbol fotboll fotball real atletico deportivo united city town the de la del di do da 1 2 ii u23 b dam".split(" "));
const toks = s => norm(s).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
const hex = (w, k) => { const m = w.match(new RegExp("\\|\\s*" + k + "\\s*=\\s*#?([0-9A-Fa-f]{6})\\b")); return m ? "#" + m[1].toLowerCase() : null; };
async function look(lang, name, city) {
  const s = await api(lang, { action: "query", list: "search", srsearch: name, srlimit: "4" }); const hits = (s && s.query && s.query.search || []).map(x => x.title);
  const want = toks(name);
  for (const t of hits) {
    const tt = toks(t); if (!want.some(w => tt.includes(w))) continue;
    const p = await api(lang, { action: "parse", page: t, prop: "wikitext", redirects: "1" }); const w = p && p.parse && p.parse.wikitext; if (!w) continue;
    const b = hex(w, "body1"), sh = hex(w, "shorts1"), so = hex(w, "socks1"); if (!b) continue;
    if (city && !norm(w).includes(norm(city).trim().split(" ")[0]) && !tt.some(x => norm(city).includes(x))) continue;
    return { c1: b, c2: sh, c3: so, title: t, lang };
  }
  return null; }
(async () => {
  const out = {}; let n = 0;
  for (const [id, name, country, city] of Q) {
    const L = LANG[country]; let r = null;
    try { if (L) r = await look(L, name, city); if (!r) r = await look("en", name, city); } catch (e) {}
    if (r) out[id] = r; if (++n % 100 === 0) console.log(n, Object.keys(out).length);
    await sleep(150);
  }
  fs.writeFileSync(path.join(__dirname, "..", "tools", "colors_found.json"), JSON.stringify(out, null, 0).replace(/},"/g, '},\n"'));
  console.log(`klart: ${Object.keys(out).length} av ${Q.length}`);
})();
