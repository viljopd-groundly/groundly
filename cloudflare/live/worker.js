// Groundly – liveresultat.
// Liten mellanhand på Cloudflare: frågar API-Football efter ALLA pågående matcher (ett anrop) högst en gång per
// minut och delar ut svaret till alla användare. API-nyckeln ligger bara här som hemlighet (API_FOOTBALL_KEY),
// aldrig i appen. Svar: {t: tid, m: [[fixture, hemmalag-id, bortalag-id, mål hemma, mål borta, status, minut, tillägg]]}
const API = "https://v3.football.api-sports.io/fixtures?live=all";
const CACHE_S = 60;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (body, extra = {}) => new Response(body, { headers: { ...cors, "Content-Type": "application/json; charset=utf-8", ...extra } });

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (url.pathname !== "/live") return new Response("Groundly live", { headers: cors });
    const cache = caches.default, key = new Request("https://groundly-live.cache/live");
    const hit = await cache.match(key);
    if (hit) return json(await hit.text(), { "Cache-Control": "public, max-age=30", "X-Cache": "HIT" });
    let body, ttl = CACHE_S;
    try {
      const r = await fetch(API, { headers: { "x-apisports-key": env.API_FOOTBALL_KEY } });
      const j = await r.json();
      const err = j && j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors).length);
      if (!r.ok || err) throw new Error("api " + r.status);
      body = JSON.stringify({ t: Date.now(), m: (j.response || []).map(f => [f.fixture.id, f.teams.home.id, f.teams.away.id, f.goals.home, f.goals.away, f.fixture.status.short, f.fixture.status.elapsed, f.fixture.status.extra || 0]) });
    } catch (e) {
      body = JSON.stringify({ t: Date.now(), m: [], fel: true }); ttl = 30; // försök igen om en halv minut
    }
    ctx.waitUntil(cache.put(key, new Response(body, { headers: { "Cache-Control": `public, max-age=${ttl}` } })));
    return json(body, { "Cache-Control": "public, max-age=30", "X-Cache": "MISS" });
  },
};
