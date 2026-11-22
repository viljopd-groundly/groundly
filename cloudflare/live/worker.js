// Groundly – liveresultat.
// Liten mellanhand på Cloudflare: frågar API-Football efter ALLA pågående matcher (ett anrop) högst en gång per
// minut och delar ut svaret till alla användare. API-nyckeln ligger bara här som hemlighet (API_FOOTBALL_KEY),
// aldrig i appen. Svar: {t: tid, m: [[fixture, hemmalag-id, bortalag-id, mål hemma, mål borta, status, minut, tillägg, händelser]]}
const API = "https://v3.football.api-sports.io/fixtures?live=all";
const CACHE_S = 60;
let MEM = null;
// mål och röda kort: [minut, tillägg, lag-id, spelare, typ] där typ är G (mål), P (straff), O (självmål), R (rött kort)
const evs = f => (Array.isArray(f.events) ? f.events : []).map(e => {
  const d = String(e.detail || ""), t = e.type === "Goal" ? (/Own/i.test(d) ? "O" : /Penalty/i.test(d) && !/Missed/i.test(d) ? "P" : /Missed/i.test(d) ? "" : "G") : e.type === "Card" && /Red/i.test(d) ? "R" : "";
  return t ? [e.time && e.time.elapsed, (e.time && e.time.extra) || 0, e.team && e.team.id, (e.player && e.player.name) || "", t] : null;
}).filter(Boolean);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (body, extra = {}) => new Response(body, { headers: { ...cors, "Content-Type": "application/json; charset=utf-8", ...extra } });

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const key0 = String(env.API_FOOTBALL_KEY || "").trim();
    // förbrukning i dag (räknas inte som anrop hos API-Football); bara siffror, inga kontouppgifter
    if (url.pathname === "/status") {
      try { const j = await (await fetch("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": key0 } })).json();
        const q = (j.response && j.response.requests) || {}; return json(JSON.stringify({ idag: q.current, max: q.limit_day, fel: j.errors && Object.keys(j.errors).length ? Object.keys(j.errors) : undefined }));
      } catch (e) { return json(JSON.stringify({ fel: String(e.message || e).slice(0, 80) })); }
    }
    if (url.pathname !== "/live") return new Response("Groundly live", { headers: cors });
    // workers.dev har ingen delad cache, så svaret sparas också i minnet (en hämtning per minut och server)
    if (MEM && Date.now() - MEM.at < MEM.ttl * 1000) return json(MEM.body, { "Cache-Control": "public, max-age=30", "X-Cache": "MEM" });
    const cache = caches.default, key = new Request("https://groundly-live.cache/live");
    const hit = await cache.match(key);
    if (hit) return json(await hit.text(), { "Cache-Control": "public, max-age=30", "X-Cache": "HIT" });
    let body, ttl = CACHE_S;
    try {
      const r = await fetch(API, { headers: { "x-apisports-key": key0 } });
      const j = await r.json();
      const err = j && j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors).length);
      if (!r.ok || err) throw new Error("api " + r.status + " " + (err ? Object.keys(j.errors).join(",") : ""));
      body = JSON.stringify({ t: Date.now(), m: (j.response || []).map(f => [f.fixture.id, f.teams.home.id, f.teams.away.id, f.goals.home, f.goals.away, f.fixture.status.short, f.fixture.status.elapsed, f.fixture.status.extra || 0, evs(f)]) });
    } catch (e) {
      body = JSON.stringify({ t: Date.now(), m: [], fel: true, orsak: String(e.message || e).slice(0, 80) }); ttl = 30; // försök igen om en halv minut
    }
    MEM = { at: Date.now(), ttl, body };
    ctx.waitUntil(cache.put(key, new Response(body, { headers: { "Cache-Control": `public, max-age=${ttl}` } })));
    return json(body, { "Cache-Control": "public, max-age=30", "X-Cache": "MISS" });
  },
};
