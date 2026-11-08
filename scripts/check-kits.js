// Engångskoll: läser matchställets färger (body1/shorts1/socks1) och färgraden ur faktarutan på svenska Wikipedia.
const T = process.argv.slice(2).join(" ").split("|").map(s => s.trim()).filter(Boolean);
const UA = { "User-Agent": "groundly-bot/1.0 (github.com/viljopd-groundly/groundly)" };
(async () => { for (const t of T) {
  for (const lang of ["sv", "en"]) {
    await new Promise(r => setTimeout(r, 800)); const u = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ action: "parse", page: t, prop: "wikitext", redirects: "1", format: "json", formatversion: "2" });
    try { const j = await (await fetch(u, { headers: UA })).json(); const w = j.parse && j.parse.wikitext; if (!w) { console.log(`## ${t} [${lang}] SAKNAS`); continue; }
      const lines = w.split("\n").filter(l => /^\s*\|\s*(färger|klubbfärger|colou?rs|body1|shorts1|socks1|pattern_b1|leftarm1|rightarm1|smeknamn)\s*=/i.test(l)).map(l => l.trim().slice(0, 160));
      console.log(`## ${t} [${lang}] -> ${j.parse.title}\n` + lines.join("\n")); if (lines.length) break;
    } catch (e) { console.log(`## ${t} [${lang}] FEL ${e.message}`); }
  } await new Promise(r => setTimeout(r, 2500)); } })();
