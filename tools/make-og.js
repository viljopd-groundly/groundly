// Ritar förhandsbilden som visas när någon delar en länk till Groundly (site/og.png, 1200×630).
// Kör lokalt när utseendet ändrats: node tools/make-og.js  (kräver playwright)
const path = require("path"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch (e) { pw = require("/opt/node-tools/node_modules/playwright"); }
const ROOT = path.resolve(__dirname, "..");
const b64 = f => fs.readFileSync(path.join(ROOT, f)).toString("base64");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:BS;src:url(data:font/woff;base64,${b64("site/fonts/BigShoulders.woff")}) format("woff");font-weight:100 900}
@font-face{font-family:PS;src:url(data:font/woff;base64,${b64("site/fonts/PublicSans.woff")}) format("woff");font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#0b1224;font-family:PS,sans-serif;color:#e8edf5;position:relative}
.lines{position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.025) 0 2px,transparent 2px 26px)}
.pitch{position:absolute;right:-120px;top:70px;width:620px;height:490px;border:3px solid rgba(111,208,140,.16);border-radius:18px}
.pitch:before{content:"";position:absolute;left:50%;top:0;bottom:0;border-left:3px solid rgba(111,208,140,.16)}
.pitch:after{content:"";position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;border:3px solid rgba(111,208,140,.16);border-radius:50%}
.bar{position:absolute;left:0;right:0;top:0;height:10px;background:#6FD08C}
.wrap{position:absolute;left:84px;top:118px;right:84px}
.brand{display:flex;align-items:center;gap:30px}
.brand img{width:132px;height:132px;border-radius:28px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.wm{font-family:BS;font-weight:800;font-size:150px;line-height:.9;letter-spacing:1px;text-transform:uppercase}
.wm span{color:#6FD08C}
h1{font-weight:700;font-size:46px;margin-top:40px;line-height:1.15;max-width:900px}
.chips{display:flex;gap:14px;margin-top:34px}
.chips b{font-weight:600;font-size:26px;padding:10px 22px;border-radius:99px;border:2px solid rgba(111,208,140,.45);color:#cfeedd;background:rgba(111,208,140,.08)}
.foot{position:absolute;left:84px;bottom:46px;font-size:24px;color:#8f9bb3}
</style></head><body><div class="lines"></div><div class="pitch"></div><div class="bar"></div>
<div class="wrap"><div class="brand"><img src="data:image/png;base64,${b64("site/icon-512.png")}"><div class="wm"><span>Ground</span>ly</div></div>
<h1>Planera fotbollsresor och logga matcherna du sett</h1>
<div class="chips"><b>Matcher i 175 länder</b><b>Resor</b><b>Arenor</b><b>Tabeller</b></div></div>
<div class="foot">${process.env.OG_URL || "viljopd-groundly.github.io/groundly"}</div></body></html>`;
(async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ROOT, "site", "og.png") }); await b.close();
  console.log("site/og.png klar");
})();
