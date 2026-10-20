// Letar officiella webbplatser i Wikidata (P856) för klubbar och landslag som saknar en.
// Körs i GitHub Actions (öppet nät): node scripts/find-web.js  -> tools/web_found.json (granskas innan den används)
const fs = require("fs"), path = require("path");
const Q = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tools", "web_query.json"), "utf8"));
const UA = { "User-Agent": "GroundlyBot/1.0 (https://github.com/viljopd-groundly/groundly)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function J(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: UA }); if (r.ok) return r.json(); } catch (e) {} await sleep(1500); } return null; }
const sparql = q => J("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q));
const host = u => String(u || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
(async () => {
  const out = { nat: {}, club: {} };
  // 1) herrlandslag: alla landslagsobjekt med webbplats, landets svenska namn
  const nat = await sparql(`SELECT ?t ?tl ?cl ?site WHERE { ?t wdt:P31 wd:Q6979593; wdt:P17 ?c; wdt:P856 ?site.
    ?t rdfs:label ?tl FILTER(lang(?tl)="en") ?c rdfs:label ?cl FILTER(lang(?cl)="sv") }`);
  for (const b of (nat && nat.results.bindings) || []) {
    const tl = b.tl.value;
    if (/women|female|under|U-?\d|olympic|futsal|beach|amputee|b team|\bB\b|students|universiade|military|deaf|cerebral|youth|junior|legends|old/i.test(tl)) continue;
    (out.nat[b.cl.value] = out.nat[b.cl.value] || []).push({ label: tl, site: host(b.site.value) });
  }
  // 2) klubbar: sök på namnet, kräv fotbollsklubb (eller damlag) med webbplats
  const CLUBTYPES = new Set(["Q476028", "Q103229495", "Q15944511", "Q2140665", "Q17156793", "Q113487669", "Q20639856"]);
  for (const x of Q.filter(x => x.kind !== "nat")) {
    const names = [x.name.replace(/\s*\(dam\)/, ""), x.name.replace(/\s*\(dam\)/, "") + (x.kind === "women" ? " women" : "")];
    let hit = null;
    for (const nm of [...new Set(names)]) {
      for (const lang of ["en", "sv", "de"]) {
        const s = await J(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&limit=7&language=${lang}&search=${encodeURIComponent(nm)}`);
        const ids = ((s && s.search) || []).map(e => e.id);
        if (!ids.length) continue;
        const e = await J(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels|descriptions&languages=en&ids=${ids.join("|")}`);
        for (const id of ids) {
          const ent = e && e.entities && e.entities[id]; if (!ent) continue;
          const cl = ent.claims || {};
          const types = (cl.P31 || []).map(c => c.mainsnak.datavalue && c.mainsnak.datavalue.value.id);
          const site = (cl.P856 || []).map(c => c.mainsnak.datavalue && c.mainsnak.datavalue.value).find(Boolean);
          const desc = (ent.descriptions && ent.descriptions.en && ent.descriptions.en.value) || "";
          const isClub = types.some(t => CLUBTYPES.has(t)) || /football|soccer/i.test(desc);
          if (isClub && site) { hit = { qid: id, label: ent.labels.en && ent.labels.en.value, desc, site: host(site) }; break; }
        }
        if (hit) break;
        await sleep(200);
      }
      if (hit) break;
    }
    if (hit) out.club[x.id] = { ...hit, ours: x.name, country: x.country, league: x.league };
    await sleep(150);
  }
  fs.writeFileSync(path.join(__dirname, "..", "tools", "web_found.json"), JSON.stringify(out, null, 1));
  console.log("landslag:", Object.keys(out.nat).length, "klubbar:", Object.keys(out.club).length, "av", Q.filter(x => x.kind !== "nat").length);
})();
