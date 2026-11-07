// Groundly service worker: gör appen snabb vid återbesök och användbar utan täckning.
//  - sidan (index.html): nätet först (max 4 s), annars sparad kopia
//  - appens filer och data (js, data/*.json, archive/*.json, ikoner): sparad kopia direkt, uppdateras i bakgrunden
//  - Firebase-biblioteken och typsnitt (versionerade): sparad kopia, hämtas bara en gång
//  - allt annat (inloggning, databasen, API:er): går direkt till nätet, sparas aldrig
const V = "groundly-v3";
const SHELL = ["./", "index.html", "js/runtime.js", "js/firebase-config.js", "manifest.webmanifest", "icon-192.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

const put = (req, res) => { if (res && res.ok && (res.type === "basic" || res.type === "cors")) { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); } return res; };
const fromCache = req => caches.match(req);

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  // sidan: nätet först
  if (req.mode === "navigate") {
    e.respondWith(Promise.race([
      fetch(req, { cache: "no-cache" }).then(r => put(new Request("index.html"), r)),
      new Promise((_, rej) => setTimeout(rej, 4000))
    ]).catch(() => fromCache("index.html").then(r => r || fetch(req))));
    return;
  }
  // versionerade bibliotek och typsnitt: sparad kopia
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/") || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    e.respondWith(fromCache(req).then(r => r || fetch(req).then(x => put(req, x))));
    return;
  }
  // arkivets innehållsförteckning: nätet först, så att nya serier syns direkt
  if (same && url.pathname.endsWith("/archive/index.json")) {
    e.respondWith(fetch(req).then(x => put(req, x)).catch(() => fromCache(req)));
    return;
  }
  // egna filer och data: sparad kopia direkt + uppdatera i bakgrunden
  if (same && /\.(js|json|png|webmanifest|svg)$/.test(url.pathname) && !url.pathname.endsWith("/sw.js")) {
    e.respondWith(fromCache(req).then(hit => {
      const net = fetch(req).then(x => put(req, x)).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    }));
  }
});

// påminnelser (webbpush från tools/push.js): datan innehåller titel, text och vart notisen leder
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { data: { body: e.data && e.data.text() } }; }
  const x = d.data || {}, n = d.notification || {};
  const title = x.title || n.title || "Groundly";
  e.waitUntil(self.registration.showNotification(title, { body: x.body || n.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: x.tag || undefined, data: { url: x.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { for (const c of cs) { if (c.url.startsWith(self.registration.scope) && "focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } } return self.clients.openWindow(url); }));
});
