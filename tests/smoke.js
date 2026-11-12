// Röktest före varje publicering: öppnar appen i en mobil webbläsare och klickar igenom det viktigaste.
// Körs i GitHub Actions (deploy.yml) efter bygget – misslyckas något stoppas publiceringen.
// Lokalt: node scripts/build-web.js && node tests/smoke.js
let pw; try { pw = require("playwright"); } catch (e) { pw = require("/opt/node-tools/node_modules/playwright"); }
const { chromium, devices } = pw;
const start = require("./server.js");
const URL = "http://localhost:" + (+process.env.PORT || 8099) + "/";
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok, info }); console.log((ok ? "✓ " : "✗ ") + name + (info ? " – " + info : "")); };

async function page(b, { lang = "sv", look = "", user = true, fs: data = null, home = "Jönköping" } = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"] });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());            // inga externa anrop i testet
  await ctx.addInitScript(([lang, look, user, data, home]) => {
    window.GROUNDLY_FIREBASE_BASE = "/fb"; localStorage.setItem("fk-lang", lang); if (look) localStorage.setItem("fk-look", look); if (home) localStorage.setItem("fk-home", home);
    if (user && !localStorage.getItem("fake-auth")) localStorage.setItem("fake-auth", JSON.stringify({ uid: "uidT", displayName: "Testa", email: "t@example.com" }));
    if (!localStorage.getItem("fake-fs")) localStorage.setItem("fake-fs", JSON.stringify(data || { "users/uidT/data/logg": { attended: [], since: "2025-01-01", wishMatches: [], wishClubs: [] } }));
  }, [lang, look, user, data, home]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => typeof dbState !== "undefined" && dbState === "ready", null, { timeout: 30000 });
  if (user) await p.waitForFunction(() => myState === "ready", null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  return { p, ctx, errs };
}

(async () => {
  const srv = await start(); const b = await chromium.launch();
  try {
    // 1. Alla vyer öppnas utan fel, på svenska och engelska, i alla utseenden
    for (const [lang, look] of [["sv", ""], ["en", "modern"], ["sv", "ticket"], ["sv", "kit"], ["sv", "atlas"]]) {
      const { p, ctx, errs } = await page(b, { lang, look });
      for (const m of ["hem", "matcher", "klubbar", "landslag", "arenor", "tabell", "tips", "quiz", "resa", "flode", "reportage", "forum", "mine", "profil"]) { await p.evaluate(m => setMode(m), m); await p.waitForTimeout(150); }
      const raw = await p.evaluate(() => document.body.innerText.includes("${$t"));
      check(`vyer ${lang}${look ? " / " + look : ""}`, !errs.length && !raw, errs.slice(0, 2).join(" | ") || (raw ? "obehandlad text" : ""));
      await ctx.close();
    }
    // 2. Planera resa: sök, spara, välj matcher, biljett, checklista, flera städer, ihopfällt kort
    {
      const { p, ctx, errs } = await page(b);
      const city = await p.evaluate(() => { const now = Date.now(); const m = MATCHES.find(x => x.kickoff && mTs(x) > now + 3 * 864e5 && x.city && GEO[x.city] && String(x.tier) === "1"); return m && m.city; });
      const d = await p.evaluate(() => { const t = today(); return [addDays(t, 3), addDays(t, 12)]; });
      await p.evaluate(() => goTop("resa"));
      await p.fill("#rCity", city); await p.fill("#rFrom", d[0]); await p.fill("#rTo", d[1]); await p.click("#resaForm button[type=submit]"); await p.waitForTimeout(400);
      const n = await p.evaluate(() => document.querySelectorAll("#resaList .mrow").length);
      check("resa: sök visar matcher", n > 0, city + ", " + n + " matcher");
      await p.evaluate(() => document.querySelector("[data-tripsave]").click()); await p.waitForTimeout(300);
      check("resa: spara", await p.evaluate(() => myTrips().length === 1));
      await p.evaluate(() => { document.querySelectorAll("#resaList [data-wishm]")[0].click(); }); await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector("#resaList [data-tixm]"); b && b.click(); }); await p.waitForTimeout(300);
      check("resa: Vill gå + Har biljett", await p.evaluate(() => MY.wishMatches.length === 1 && MY.wishMatches[0].tix === true));
      await p.evaluate(() => { RESA = { ...RESA, city: "" }; renderResa(); });
      const card = await p.evaluate(() => { const t = document.querySelector(".trip"); return t && !t.classList.contains("closed") && !!t.querySelector(".tripcheck"); });
      check("resa: kort med Att boka", card);
      await p.evaluate(() => document.querySelector("[data-tripbk$=':h']").click()); await p.waitForTimeout(200);
      check("resa: bocka hotell", await p.evaluate(() => myTrips()[0].bk && myTrips()[0].bk.h === true));
      await p.evaluate(() => document.querySelector("[data-tripx]").click()); await p.waitForTimeout(200);
      check("resa: fäll ihop", await p.evaluate(() => !!document.querySelector(".trip.closed")));
      await p.evaluate(() => document.querySelector("[data-tripx]").click()); await p.evaluate(() => document.querySelector("[data-tripmenu]").click()); await p.waitForTimeout(150);
      await p.evaluate(() => document.querySelector(".tripmenu [data-tripadd]").click()); await p.waitForTimeout(300);
      const c2 = await p.evaluate(c => { const m = MATCHES.find(x => x.kickoff && x.city && x.city !== c && GEO[x.city]); return m && m.city; }, city);
      await p.fill("#rCity", c2); await p.click("#resaForm button[type=submit]"); await p.waitForTimeout(300);
      await p.evaluate(() => document.querySelector("[data-legadd]").click()); await p.waitForTimeout(300);
      check("resa: lägg till stad", await p.evaluate(() => (myTrips()[0].legs || []).length === 2));
      await p.evaluate(() => document.querySelector("[data-tripask]").click()); await p.waitForTimeout(400);
      check("resa: Fråga i forumet + tillbaka", await p.evaluate(() => mode === "forum" && !!document.getElementById("fTitle").value && !document.getElementById("backPill").hidden));
      await p.click("#backPill"); await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector("[data-wdel]"); b && b.click(); }); await p.waitForTimeout(150);
      await p.evaluate(() => { const b = document.querySelector("[data-wdelok]"); b && b.click(); }); await p.waitForTimeout(300);
      check("resa: ta bort match med bekräftelse", await p.evaluate(() => mode === "resa" && MY.wishMatches.length === 0));
      await p.evaluate(() => { const t = document.querySelector(".trip"); if (t.classList.contains("closed")) t.querySelector("[data-tripx]").click(); }); await p.waitForTimeout(150);
      await p.evaluate(() => { if (!document.querySelector(".tripmenu")) document.querySelector("[data-tripmenu]").click(); }); await p.waitForTimeout(150);
      await p.evaluate(() => document.querySelector(".tripmenu [data-tripdel]").click()); await p.waitForTimeout(150);
      const asked = await p.evaluate(() => !!document.querySelector(".tripdelask") && myTrips().length === 1);
      await p.evaluate(() => document.querySelector("[data-tripdelok]").click()); await p.waitForTimeout(200);
      check("resa: ta bort resa frågar först", asked && await p.evaluate(() => myTrips().length === 0));
      await p.evaluate(() => { RESA_TAB = "top"; renderResa(); }); await p.waitForTimeout(300);
      check("topplistan visar städer", await p.evaluate(() => document.querySelectorAll(".toprow").length >= 3));
      check("resa: inga sidfel", !errs.length, errs.slice(0, 2).join(" | "));
      await ctx.close();
    }
    // 3. Logga match, tidsändring, kalenderval, statistikkö
    {
      const { p, ctx, errs } = await page(b);
      const ok = await p.evaluate(() => { const m = MATCHES.find(x => x.kickoff && mTs(x) > Date.now() + 2 * 864e5 && x.home && x.away); const w = { ...slim(m), kickoff: new Date(Date.parse(m.kickoff) - 3 * 36e5).toISOString() }; mutate(d => { d.wishMatches = [w]; }); return !!m; });
      await p.waitForTimeout(300); await p.evaluate(() => goTop("hem")); await p.waitForTimeout(300);
      check("varning för ny matchtid", ok && await p.evaluate(() => !!document.querySelector(".moved [data-wmok]")));
      await p.evaluate(() => document.querySelector(".moved [data-wmok]").click()); await p.waitForTimeout(300);
      check("ny tid kan kvitteras", await p.evaluate(() => wishMoves().length === 0));
      await p.evaluate(() => { const m = MATCHES.find(x => x.score && x.home && x.away); mutate(d => { d.attended = [...d.attended, attendFromMatch(m)]; }); });
      await p.waitForTimeout(300);
      check("logga match", await p.evaluate(() => MY.attended.length === 1));
      await p.evaluate(() => { const m = MATCHES.find(x => x.kickoff && mTs(x) > Date.now()); document.body.insertAdjacentHTML("beforeend", calBtn(m, "btn", "Kal")); document.querySelector("[data-cal]:last-of-type").click(); });
      await p.waitForTimeout(200);
      check("kalender öppnar val (ingen direktnedladdning)", await p.evaluate(() => document.querySelectorAll("#calOv .calopt").length === 3));
      check("anonym statistik finns", await p.evaluate(() => typeof track === "function" && USAGE_KEYS.size > 50));
      check("logga/kalender: inga sidfel", !errs.length, errs.slice(0, 2).join(" | "));
      await ctx.close();
    }
    // 4. Utloggad besökare
    {
      const { p, ctx, errs } = await page(b, { user: false });
      for (const m of ["hem", "matcher", "resa", "forum", "mine"]) { await p.evaluate(m => setMode(m), m); await p.waitForTimeout(150); }
      check("utloggad: alla vyer", !errs.length, errs.slice(0, 2).join(" | "));
      await ctx.close();
    }
  } catch (e) { check("testet kraschade", false, e.message.split("\n")[0]); }
  await b.close(); srv.close();
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length} av ${results.length} gick igenom.`);
  if (process.env.GITHUB_STEP_SUMMARY) require("fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Röktest\n${results.map(r => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.info ? " – " + r.info : ""}`).join("\n")}\n`);
  process.exit(bad.length ? 1 : 0);
})();
