// Groundly – liveresultat.
// Liten mellanhand på Cloudflare: frågar API-Football efter ALLA pågående matcher (ett anrop) högst en gång per
// minut och delar ut svaret till alla användare. API-nyckeln ligger bara här som hemlighet (API_FOOTBALL_KEY),
// aldrig i appen. Svar: {t: tid, m: [[fixture, hemmalag-id, bortalag-id, mål hemma, mål borta, status, minut, tillägg, händelser]],
// d: [[fixture, hemmalag-id, bortalag-id, mål hemma, mål borta]] (dagens färdigspelade)}
const API = "https://v3.football.api-sports.io/fixtures?live=all";
const CACHE_S = 60;
let MEM = null, GOOD = null, DAY = null;
// dagens färdigspelade matcher (en hämtning var tionde minut), så att resultat finns kvar även när de lämnat livelistan
async function dayDone(key0) {
  if (DAY && Date.now() - DAY.at < 10 * 60e3) return DAY.list;
  try {
    const d = new Date().toISOString().slice(0, 10);
    const r = await fetch("https://v3.football.api-sports.io/fixtures?date=" + d, { headers: { "x-apisports-key": key0 } });
    const j = await r.json();
    if (j.errors && Object.keys(j.errors).length) throw new Error("api");
    const list = (j.response || []).filter(f => /^(FT|AET|PEN)$/.test(f.fixture.status.short)).map(f => [f.fixture.id, f.teams.home.id, f.teams.away.id, f.goals.home, f.goals.away]);
    DAY = { at: Date.now(), list };
  } catch (e) { if (!DAY) DAY = { at: Date.now() - 8 * 60e3, list: [] }; else DAY.at = Date.now() - 8 * 60e3; } // nytt försök om två minuter
  return DAY.list;
}
// mål och röda kort: [minut, tillägg, lag-id, spelare, typ] där typ är G (mål), P (straff), O (självmål), R (rött kort)
const evs = f => (Array.isArray(f.events) ? f.events : []).map(e => {
  const d = String(e.detail || ""), t = e.type === "Goal" ? (/Own/i.test(d) ? "O" : /Penalty/i.test(d) && !/Missed/i.test(d) ? "P" : /Missed/i.test(d) ? "" : "G") : e.type === "Card" && /Red/i.test(d) ? "R" : "";
  return t ? [e.time && e.time.elapsed, (e.time && e.time.extra) || 0, e.team && e.team.id, (e.player && e.player.name) || "", t] : null;
}).filter(Boolean);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (body, extra = {}) => new Response(body, { headers: { ...cors, "Content-Type": "application/json; charset=utf-8", ...extra } });

// ---- nattuppdateringen: Cloudflare startar den på utsatt tid (GitHubs egen schemaläggare kan dröja i timmar) ----
const GH = "https://api.github.com/repos/viljopd-groundly/groundly/actions";
const SITE = "https://viljopd-groundly.github.io/groundly/";
async function nightly(env, dry) {
  const tok = String(env.GH_DISPATCH_TOKEN || "").trim();
  if (!tok) return { gjort: false, orsak: "GH_DISPATCH_TOKEN saknas" };
  const h = { Authorization: "Bearer " + tok, Accept: "application/vnd.github+json", "User-Agent": "groundly-live", "X-GitHub-Api-Version": "2022-11-28" };
  const today = new Date().toISOString().slice(0, 10);
  let upd = "";
  try { upd = String((await (await fetch(SITE + "data/standings.json?t=" + Date.now(), { cf: { cacheTtl: 0 } })).json()).updated || ""); } catch (e) {}
  if (upd.slice(0, 10) === today) return { gjort: false, orsak: "redan uppdaterad " + upd };
  const rr = await fetch(GH + "/workflows/deploy.yml/runs?per_page=10", { headers: h });
  if (!rr.ok) return { gjort: false, orsak: "GitHub svarade " + rr.status };
  const runs = (await rr.json()).workflow_runs || [];
  const busy = runs.find(r => /queued|in_progress|waiting|pending/.test(r.status) && /schedule|workflow_dispatch/.test(r.event));
  if (busy) return { gjort: false, orsak: "en körning pågår redan (" + busy.event + ")" };
  if (dry) return { gjort: false, orsak: "provkörning: skulle ha startat (senast uppdaterad " + (upd || "okänt") + ")" };
  const d = await fetch(GH + "/workflows/deploy.yml/dispatches", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ ref: "main", inputs: { nightly: true } }) });
  return { gjort: d.status === 204, orsak: d.status === 204 ? "startad" : "GitHub svarade " + d.status };
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(nightly(env, false)); },
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const key0 = String(env.API_FOOTBALL_KEY || "").trim();
    // förbrukning i dag (räknas inte som anrop hos API-Football); bara siffror, inga kontouppgifter
    if (url.pathname === "/status") {
      try { const rs = await fetch("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": key0 } }); const j = await rs.json(); const hd = { perMin: rs.headers.get("x-ratelimit-limit"), kvarMin: rs.headers.get("x-ratelimit-remaining"), perDag: rs.headers.get("x-ratelimit-requests-limit"), kvarDag: rs.headers.get("x-ratelimit-requests-remaining") };
        const q = (j.response && j.response.requests) || {}; return json(JSON.stringify({ idag: q.current, max: q.limit_day, plan: j.response && j.response.subscription && j.response.subscription.plan, ...hd, fel: j.errors && Object.keys(j.errors).length ? Object.values(j.errors).map(v => String(v).slice(0, 120)) : undefined }));
      } catch (e) { return json(JSON.stringify({ fel: String(e.message || e).slice(0, 80) })); }
    }
    if (url.pathname === "/natt") return json(JSON.stringify(await nightly(env, true))); // bara provkörning, startar inget
    if (url.pathname !== "/live") return new Response("Groundly live", { headers: cors });
    // workers.dev har ingen delad cache, så svaret sparas också i minnet (en hämtning per minut och server)
    if (MEM && Date.now() - MEM.at < MEM.ttl * 1000) return json(MEM.body, { "Cache-Control": "public, max-age=30", "X-Cache": "MEM" });
    const cache = caches.default, key = new Request("https://groundly-live.cache/live");
    const hit = await cache.match(key);
    if (hit) return json(await hit.text(), { "Cache-Control": "public, max-age=30", "X-Cache": "HIT" });
    let body, ttl = CACHE_S;
    try {
      // API-Football spärrar ibland tillfälligt ("rateLimit") trots att vi har kvot kvar; då försöker vi igen några gånger
      let r, j, err, tries = 0;
      for (;;) {
        tries++;
        r = await fetch(API, { headers: { "x-apisports-key": key0 } });
        j = await r.json().catch(() => ({}));
        err = j && j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors).length);
        const limited = r.status === 429 || (err && j.errors.rateLimit);
        if (!limited || tries >= 4) break;
        await new Promise(res => setTimeout(res, 1200 * tries));
      }
      if (!r.ok || err) throw new Error("api " + r.status + " " + (err ? Object.entries(j.errors).map(([k, v]) => k + ": " + String(v).slice(0, 90)).join("; ") : "") + " (" + tries + " försök)");
      const done = await dayDone(key0);
      body = JSON.stringify({ t: Date.now(), f: tries, d: done, m: (j.response || []).map(f => [f.fixture.id, f.teams.home.id, f.teams.away.id, f.goals.home, f.goals.away, f.fixture.status.short, f.fixture.status.elapsed, f.fixture.status.extra || 0, evs(f)]) });
      GOOD = { at: Date.now(), body };
    } catch (e) {
      // vid fel (t.ex. tillfällig spärr per minut): visa senaste lyckade svaret om det är färskt
      body = GOOD && Date.now() - GOOD.at < 5 * 60e3 ? GOOD.body : JSON.stringify({ t: Date.now(), m: [], fel: true, orsak: String(e.message || e).slice(0, 200) }); ttl = 30; // försök igen om en halv minut
    }
    MEM = { at: Date.now(), ttl, body };
    ctx.waitUntil(cache.put(key, new Response(body, { headers: { "Cache-Control": `public, max-age=${ttl}` } })));
    return json(body, { "Cache-Control": "public, max-age=30", "X-Cache": "MISS" });
  },
};
