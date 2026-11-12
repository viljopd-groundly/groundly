// Liten testserver: serverar site/ och en låtsas-Firebase (tests/fb) så att appen kan köras utan riktiga konton.
const http = require("http"), fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "site"), PORT = +process.env.PORT || 8099;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
module.exports = () => new Promise(res => {
  const srv = http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split("?")[0]);
    if (u === "/js/firebase-config.js") { s.writeHead(200, { "content-type": "text/javascript" }); return s.end('export default {apiKey:"fake",authDomain:"x",projectId:"groundly-test",storageBucket:"groundly-test.appspot.com",appId:"1"}'); }
    const f = u.startsWith("/fb/") ? path.join(__dirname, u) : path.join(SITE, u === "/" ? "index.html" : u);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end("nf"); } s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(d); });
  }).listen(PORT, () => res(srv));
});
if (require.main === module) module.exports().then(() => console.log("http://localhost:" + PORT));
