// Samlar alla texter som ska översättas och visar vad som saknas per språk.
// Kör efter build-web.js:  node scripts/i18n-extract.js            (sammanställning)
//                          node scripts/i18n-extract.js en > x.json  (saknade nycklar för ett språk som JSON)
// Nycklarna är den svenska texten. Källor:
//   - $t("…") och $tn(n,"…","…") i appens skript
//   - fast text och attribut (placeholder, aria-label, title, alt) i sidans HTML utanför skript
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "site", "index.html"), "utf8");
const keys = new Set();
// skript
const STR = /"((?:[^"\\\n]|\\.)*)"/y;
const grab = (src, i) => { STR.lastIndex = i; const m = STR.exec(src); return m ? { v: JSON.parse('"' + m[1] + '"'), end: STR.lastIndex } : null; };
for (const re of [/\$t\(\s*/g, /\$tn\([^,]+,\s*/g]) {
  let m; while ((m = re.exec(html))) {
    let p = m.index + m[0].length; const a = grab(html, p); if (!a) continue; keys.add(a.v);
    if (m[0].startsWith("$tn")) { const rest = html.slice(a.end).match(/^\s*,\s*/); if (rest) { const b = grab(html, a.end + rest[0].length); if (b) keys.add(b.v); } }
  }
}
// fast HTML (utan skript och stil)
const body = html.replace(/<head[\s\S]*?<\/head>/, "").replace(/<title[\s\S]*?<\/title>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const ent = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
for (const m of body.matchAll(/>([^<>]+)</g)) { const k = ent(m[1]).trim(); if (/[A-Za-zÅÄÖåäö]{2,}/.test(k)) keys.add(k); }
for (const m of body.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"]*)"/g)) { const k = ent(m[1]).trim(); if (/[A-Za-zÅÄÖåäö]{2,}/.test(k)) keys.add(k); }
// nycklar som bara används dynamiskt (land- och stadsnamn ur datan)
try { for (const k of JSON.parse(fs.readFileSync(path.join(ROOT, "src", "i18n", "_dyn.json"), "utf8"))) keys.add(k); } catch (e) {}
const all = [...keys].sort((a, b) => a.localeCompare(b, "sv"));
fs.writeFileSync(path.join(ROOT, "src", "i18n", "_keys.json"), JSON.stringify(all, null, 0).replace(/","/g, '",\n"'));
const langs = fs.readdirSync(path.join(ROOT, "src", "i18n")).filter(f => /^[a-z]{2}\.json$/.test(f)).map(f => f.slice(0, 2));
const want = process.argv[2];
if (want) { const d = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "i18n", want + ".json"), "utf8")); const miss = {}; all.filter(k => !(k in d)).forEach(k => miss[k] = ""); process.stdout.write(JSON.stringify(miss, null, 1)); }
else {
  console.log(`${all.length} texter att översätta`);
  for (const l of langs) { const d = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "i18n", l + ".json"), "utf8")); const have = all.filter(k => d[k]).length; const unused = Object.keys(d).filter(k => !keys.has(k)).length; console.log(`  ${l}: ${have}/${all.length} klara${unused ? `, ${unused} oanvända` : ""}`); }
}
