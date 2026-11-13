// Kopierar webbappen (../site) till www/ för app-skalet.
// Kalenderflöden och arkiv (stora, och hämtas ändå från webben) tas inte med.
// Matchdata följer med som reserv men hämtas i första hand färskt från webbplatsen (se app-shim.js).
const fs = require("fs"), path = require("path");
const SRC = path.join(__dirname, "..", "..", "site"), OUT = path.join(__dirname, "..", "www");
const SKIP = new Set(["cal", "archive", "flytt.html", "sw.js"]);
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true, filter: s => !SKIP.has(path.relative(SRC, s).split(path.sep)[0]) });
fs.copyFileSync(path.join(__dirname, "app-shim.js"), path.join(OUT, "js", "app-shim.js"));
const idx = path.join(OUT, "index.html");
let html = fs.readFileSync(idx, "utf8");
// shimmet måste köras före allt annat
html = html.replace(/<head>/i, '<head><script src="js/app-shim.js"></script>');
fs.writeFileSync(idx, html);
const kb = d => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? kb(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`www/ klar: ${(kb(OUT) / 1048576).toFixed(1)} MB`);
