// Groundly – webbversionens runtime.
// Ersätter claude.ai:s window.claude.use("db"|"user"|"assets"|"downloads"|"sample")
// med Firebase (Auth + Firestore + Storage), så att appens kod kan vara oförändrad.
// Läsning av gemensamt innehåll fungerar utan inloggning; skrivning kräver konto.
import CONFIG from "./firebase-config.js";
// texter översätts med appens $t (nycklarna är den svenska texten)
const $t = (s, v) => (typeof window.$t === "function" ? window.$t(s, v) : s);
const LANGC = window.LANG || "sv";
const LOC = { sv: "sv_SE", nb: "nb_NO", da: "da_DK", fi: "fi_FI", is: "is_IS", de: "de_DE", en: "en_GB", es: "es_ES", fr: "fr_FR", it: "it_IT", nl: "nl_NL", pl: "pl_PL", pt: "pt_BR" };

const FB = (window.GROUNDLY_FIREBASE_BASE || "https://www.gstatic.com/firebasejs/10.14.1").replace(/\/$/, "");
const NONE = { use: async () => null };
const done = rt => { try { window.__groundlyReady(rt); } catch (e) {} };

// ---------- hjälpare ----------
const err = (code, msg) => Object.assign(new Error(msg || code), { code });
const mapErr = e => {
  const c = (e && e.code) || "";
  if (/permission-denied|unauthenticated|unauthorized/.test(c)) return err("invalid_argument", $t("Saknar behörighet"));
  if (/resource-exhausted|invalid-argument|quota-exceeded/.test(c)) return err("quota_exceeded", $t("För stort"));
  return err(c || "unknown", e && e.message);
};
const hex32 = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
// Artifaktens privata sökväg data/users/{uid}/logg blir users/{uid}/data/logg i Firestore.
const mapPath = p => {
  const m = /^data\/users\/([^/]+)\/(.+)$/.exec(p);
  return m ? `users/${m[1]}/data/${m[2]}` : p;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function boot() {
  if (!CONFIG || !CONFIG.apiKey || /DIN_|YOUR_/.test(CONFIG.apiKey)) { console.warn("[groundly] firebase-config.js saknas – kör utan konton"); done(NONE); return; }
  let app, A, F, S = null;
  try {
    [app, A, F] = await Promise.all([
      import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`)]);
    if (CONFIG.storageBucket && CONFIG.photos !== false) { try { S = await import(`${FB}/firebase-storage.js`); } catch (e) { S = null; } }
  } catch (e) { console.warn("[groundly] kunde inte ladda Firebase", e); done(NONE); return; }

  const fbApp = app.initializeApp(CONFIG);
  const auth = A.getAuth(fbApp);
  try { auth.languageCode = LANGC; } catch (e) {}
  // lokal cache i webbläsaren: sparad data visas direkt vid återbesök, ändringar hämtas sedan
  let fs;
  try { fs = F.initializeFirestore(fbApp, { ignoreUndefinedProperties: true, localCache: F.persistentLocalCache && F.persistentMultipleTabManager ? F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) : undefined }); }
  catch (e) { try { fs = F.initializeFirestore(fbApp, { ignoreUndefinedProperties: true }); } catch (e2) { fs = F.getFirestore(fbApp); } }
  const st = S ? S.getStorage(fbApp) : null;

  // vänta på första inloggningsbeskedet
  let user = await new Promise(res => { const off = A.onAuthStateChanged(auth, u => { off(); res(u); }); });
  try { await A.getRedirectResult(auth); } catch (e) {}
  let first = true;
  A.onAuthStateChanged(auth, u => {
    if (first) { first = false; return; }
    const was = user ? user.uid : null, now = u ? u.uid : null; user = u;
    if (was !== now) location.reload(); // appen läser identiteten en gång vid start
  });

  // ---------- profil (visningsnamn) ----------
  const profRef = uid => F.doc(fs, "profiles", uid);
  async function ensureProfile(u, wanted) {
    if (!u) return;
    try {
      const s = await F.getDoc(profRef(u.uid));
      const name = (wanted || (s.exists() && s.data().name) || (u.displayName || "").split(" ")[0] || "Supporter").slice(0, 40);
      if (!s.exists() || wanted) await F.setDoc(profRef(u.uid), { name, at: new Date().toISOString() }, { merge: true });
    } catch (e) { console.warn("[groundly] profil", e); }
  }
  if (user) ensureProfile(user);

  let adminCache = null;
  async function isAdmin() {
    if (!user) return false;
    if (adminCache !== null) return adminCache;
    try { const s = await F.getDoc(F.doc(fs, "config", "admins")); adminCache = !!(s.exists() && (s.data().uids || []).includes(user.uid)); }
    catch (e) { adminCache = false; }
    return adminCache;
  }

  // ---------- db ----------
  const LAZY = { forum: ["forum", "tips", "profil", "hem"], pubs: ["klubbar", "arenor", "landslag", "matcher", "tips"], tipnotes: ["tips", "mine"], fixes: ["mine"], comments: ["reportage"] };
  // _u = senast ändrad (servertid). Används för att bara hämta det som ändrats sedan cachen byggdes.
  // Fältet syns aldrig för appen; _gone markerar ett raderat konto tills cachen byggts om.
  const CAN_DELTA = !!(F.query && F.where && F.serverTimestamp && F.Timestamp);
  const clean = d => { if (!d || typeof d !== "object") return d; if (!("_u" in d) && !("_gone" in d)) return d; const x = { ...d }; delete x._u; delete x._gone; return x; };
  const stamp = data => CAN_DELTA && data && typeof data === "object" ? { ...data, _u: F.serverTimestamp() } : data;
  const docSnap = s => { const raw = s.exists() ? s.data() : undefined; const gone = !!(raw && raw._gone); return { id: s.id, exists: s.exists() && !gone, data: () => gone ? undefined : clean(raw) }; };
  // ---------- cache + ändringar ----------
  // Ett jobb (privata repot) bygger varannan timme en kopia av de gemensamma samlingarna i meta/cache (+ meta/cache-<namn>-<n>).
  // Appen läser kopian (1–3 dokument) och lyssnar sedan bara på dokument som ändrats efter att den byggdes,
  // i stället för att läsa alla dokument i varje samling vid varje start.
  let idxP = null;
  const cacheIndex = () => idxP || (idxP = (async () => {
    if (!CAN_DELTA || window.GROUNDLY_NOCACHE) return null;
    try { const s = await F.getDoc(F.doc(fs, "meta", "cache")); return s.exists() ? s.data() : null; } catch (e) { return null; }
  })());
  async function cacheBase(name) {
    const idx = await cacheIndex(); const e = idx && idx.c && idx.c[name];
    if (!e || !e.at) return null;
    try {
      let j = e.j;
      if (!j && e.parts > 0) { const ps = await Promise.all(Array.from({ length: e.parts }, (_, i) => F.getDoc(F.doc(fs, "meta", `cache-${name}-${i}`)))); if (ps.some(p => !p.exists())) return null; j = ps.map(p => p.data().j || "").join(""); }
      return { at: e.at, docs: JSON.parse(j || "{}") };
    } catch (e2) { return null; }
  }
  function cached(name, ref, next, onErr, full) {
    let off = null, dead = false;
    (async () => {
      const base = await cacheBase(name);
      if (dead) return;
      if (!base) { off = full(); return; }
      const emit = delta => { const m = { ...base.docs }; for (const [id, d] of Object.entries(delta)) { if (d && d._gone) delete m[id]; else m[id] = clean(d); }
        const docs = Object.entries(m).map(([id, d]) => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(d)) })); next({ size: docs.length, empty: !docs.length, docs }); };
      emit({});
      const q = F.query(ref, F.where("_u", ">", F.Timestamp.fromMillis(Date.parse(base.at))));
      off = F.onSnapshot(q, s => { const delta = {}; s.docs.forEach(d => { delta[d.id] = d.data(); }); emit(delta); },
        () => { if (!dead) { try { off && off(); } catch (e) {} off = full(); } });
    })();
    return () => { dead = true; if (off) off(); };
  }

  const db = {
    doc(path) {
      const ref = F.doc(fs, mapPath(path));
      return {
        id: ref.id,
        async set(data) { try { await F.setDoc(ref, stamp(data)); } catch (e) { throw mapErr(e); } },
        async update(data) { try { await F.updateDoc(ref, stamp(data)); } catch (e) { throw mapErr(e); } },
        // gemensamma dokument tas inte bort direkt utan töms och märks, så att cachade kopior också försvinner
        async delete() { try { if (CAN_DELTA && !/^(users|mod|meta|config)\//.test(ref.path)) await F.setDoc(ref, { _gone: true, _u: F.serverTimestamp() }); else await F.deleteDoc(ref); } catch (e) { throw mapErr(e); } },
        async get() { try { return docSnap(await F.getDoc(ref)); } catch (e) { throw mapErr(e); } },
        onSnapshot(next, onErr) { return F.onSnapshot(ref, s => next(docSnap(s)), e => onErr && onErr(mapErr(e))); }
      };
    },
    collection(name) {
      const ref = F.collection(fs, mapPath(name));
      const wrap = s => { const docs = s.docs.filter(d => { const x = d.data(); return !(x && x._gone); }).map(d => ({ id: d.id, exists: true, data: () => clean(d.data()) })); return { size: docs.length, empty: !docs.length, docs }; };
      return {
        async get() { try { return wrap(await F.getDocs(ref)); } catch (e) { throw mapErr(e); } },
        onSnapshot(next, onErr) {
          const full = () => F.onSnapshot(ref, s => next(wrap(s)), e => onErr && onErr(mapErr(e)));
          const sub = () => cached(name, ref, next, onErr, full);
          // samlingar som bara behövs i vissa vyer hämtas först när man öppnar vyn (sparar läsningar). Forumet behövs på Hem (rutan Community), så det hämtas direkt.
          const need = LAZY[name];
          if (!need || need.includes(window.__gmode)) return sub();
          let off = null, dead = false;
          const go = () => { if (!off && !dead) { off = sub(); window.removeEventListener("gmode", h); } };
          const h = ev => { if (need.includes(ev.detail)) go(); };
          window.addEventListener("gmode", h);
          // hämtas ändå i bakgrunden en stund efter start, så att vyn är klar när man öppnar den
          setTimeout(() => (window.requestIdleCallback || (f => f()))(go), 6000);
          return () => { dead = true; window.removeEventListener("gmode", h); if (off) off(); };
        }
      };
    }
  };

  // ---------- user ----------
  const NAMES = {}, PROFS = {};
  const userNs = {
    async id() { return user ? user.uid : null; },
    async canEdit() { return isAdmin(); },
    async setName(n) { const v = String(n || "").trim().slice(0, 40); if (!user || !v) throw err("invalid_argument"); await F.setDoc(profRef(user.uid), { name: v, at: new Date().toISOString() }, { merge: true }); NAMES[user.uid] = v; return v; },
    // favoritlag och land (flagga) visas vid ens namn; namnet måste redan finnas (reglerna kräver det)
    async setProfile(p) { if (!user) throw err("invalid_argument"); const ok = v => typeof v === "string" && /^[\w-]{1,24}$/.test(v) ? v : null;
      const name = NAMES[user.uid] || (await (async () => { try { const s = await F.getDoc(profRef(user.uid)); return s.exists() ? s.data().name : ""; } catch (e) { return ""; } })()) || (user.displayName || "").split(" ")[0] || "Supporter";
      const ini = p && typeof p.ini === "string" && /^[\p{L}\p{N}]{1,3}$/u.test(p.ini) ? p.ini : null;
      await F.setDoc(profRef(user.uid), { name: String(name).slice(0, 40), fav: ok(p && p.fav), cc: ok(p && p.cc), ini }, { merge: true }); PROFS[user.uid] = { fav: ok(p && p.fav), cc: ok(p && p.cc), ini }; },
    async profiles(ids) {
      const out = {};
      await Promise.all([...new Set(ids)].slice(0, 200).map(async id => {
        if (!(id in NAMES)) { try { const s = await F.getDoc(profRef(id)); const d = s.exists() ? s.data() : {}; NAMES[id] = String(d.name || ""); PROFS[id] = { fav: typeof d.fav === "string" ? d.fav : null, cc: typeof d.cc === "string" ? d.cc : null, ini: typeof d.ini === "string" ? d.ini.slice(0, 3) : null }; } catch (e) { NAMES[id] = ""; PROFS[id] = {}; } }
        out[id] = { name: NAMES[id], ...(PROFS[id] || {}) };
      }));
      return out;
    }
  };

  // ---------- assets (bilder i Firebase Storage) ----------
  const bucket = CONFIG.storageBucket;
  window.GROUNDLY_BLOB = id => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/photos%2F${id}?alt=media`;
  const assets = st ? {
    async upload(blob, opt) {
      if (!user) throw err("invalid_argument");
      const type = (opt && opt.type) || blob.type || "";
      if (!/^image\/(jpeg|png|webp)$/.test(type)) throw err("unsupported_type");
      if (blob.size > 8 * 1024 * 1024) throw err("too_large");
      const id = hex32();
      try { await S.uploadBytes(S.ref(st, `photos/${id}`), blob, { contentType: type, customMetadata: { owner: user.uid } }); }
      catch (e) { const c = e && e.code || ""; throw /quota|retry-limit/.test(c) ? err("quota_or_state") : /unauthorized/.test(c) ? err("too_large") : mapErr(e); }
      return { id, url: window.GROUNDLY_BLOB(id) };
    },
    async delete(id) { if (!/^[0-9a-f]{32}$/.test(id)) return; try { await S.deleteObject(S.ref(st, `photos/${id}`)); } catch (e) {} },
    url: id => window.GROUNDLY_BLOB(id)
  } : null;

  // ---------- downloads ----------
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : /\.csv$/.test(filename) ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename || "groundly"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }
  };

  // ---------- AI (valfritt, via egen server) ----------
  let sample = null;
  if (CONFIG.aiEndpoint) {
    const call = async (messages, opts = {}) => {
      if (!user) throw err("not_granted");
      const token = await user.getIdToken();
      const r = await fetch(CONFIG.aiEndpoint, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ messages: typeof messages === "string" ? [{ role: "user", content: messages }] : messages, tier: opts.modelTier || "quick", tools: opts.tools || null }), signal: opts.signal });
      if (r.status === 429) throw err("rate_limited");
      if (!r.ok) throw err("sampling_disabled");
      return r.json();
    };
    sample = async (m, o) => { const d = await call(m, o); if (o && o.onText) o.onText({ text: d.text }); return d; };
    sample.json = async (m, o) => { const d = await call(m, { ...o, json: true }); try { return d.json !== undefined ? d.json : JSON.parse(d.text); } catch (e) { throw err("invalid_json"); } };
    sample.limits = async () => ({ tools: true });
  }

  // ---------- konto-UI ----------
  installAccountUi({ A, F, fs, auth, getUser: () => user, ensureProfile, isAdmin, profileName: async () => user ? (await userNs.profiles([user.uid]))[user.uid].name : "" });

  const caps = { db, user: userNs, assets, downloads, sample };
  done({ use: async n => (n in caps ? caps[n] : null) });
}

// ================= inloggning =================
const SHIELD = `<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5z" fill="currentColor"/></svg>`;
function installAccountUi({ A, F, fs, auth, getUser, ensureProfile, profileName, isAdmin }) {
  const css = `
  .topbar{grid-template-columns:auto 1fr auto auto}
  .gacc{position:relative;justify-self:end}
  .gacc-btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:18px;font:600 13px var(--f-body,system-ui);background:var(--soft,#eee);color:var(--fg,#111)}
  .gacc-btn{white-space:nowrap}
  .gacc-btn svg{flex:none}
  @media (max-width:480px){.topbar .tbtitle{display:none}.gacc-btn .gl{display:none}.gacc-btn[data-glogin]{width:36px;padding:0;justify-content:center}}
  .gacc-btn .mod{position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;border-radius:50%;background:#c58b00;color:#fff;display:grid;place-items:center;border:2px solid var(--surface,#fff)}
  .gacc-btn{position:relative}
  .gdlg-card .role{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:13px;padding:4px 10px;border-radius:999px;background:#fff3cc;color:#6b4b00;margin:0 0 12px}
  .gacc-btn .dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--accent,#1d6b3b);color:var(--chalk,#fff);font-size:12px}
  .gdlg{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(0,0,0,.45);padding:16px}
  .gdlg[hidden]{display:none}
  .gdlg-card{width:min(420px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--surface,#fff);color:var(--fg,#111);border-radius:16px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font:15px/1.45 var(--f-body,system-ui)}
  .gdlg-card h2{margin:0 0 4px;font-size:20px}
  .gdlg-card p{margin:0 0 14px;color:var(--muted,#555)}
  .gdlg-card label{display:block;font-weight:600;font-size:13px;margin:10px 0 4px}
  .gdlg-card input{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit}
  .gdlg-card .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  .gdlg-card .row .btn{flex:1}
  .gdlg-card .terms{font-size:12.5px;line-height:1.4;margin:10px 0 0}.gdlg-card .terms .link,.gdlg-card label.chk .link{font-size:inherit;padding:0;display:inline}
  .gdlg-card label.chk{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:13px;line-height:1.4;margin:12px 0 2px}.gdlg-card label.chk input{width:auto;margin-top:2px;flex:none}
  .gdlg-card .or{display:flex;align-items:center;gap:10px;margin:16px 0 4px;color:var(--muted,#666);font-size:13px}
  .gdlg-card .or:before,.gdlg-card .or:after{content:"";flex:1;height:1px;background:var(--line,#ddd)}
  .gdlg-card .msg{min-height:1.2em;margin-top:10px;font-size:14px}
  .gdlg-card .msg.err{color:#b3261e}
  .gdlg-card .link{all:unset;cursor:pointer;color:var(--accent,#1d6b3b);font-weight:600;font-size:14px}
  .gdlg-card .x{float:right}
  .gdlg-card .gdel{margin-top:18px;padding-top:12px;border-top:1px solid var(--line,#ddd)}.gdlg-card .gdel .link{color:#b3261e}
  .gdlg-card .btn.danger{background:#b3261e;border-color:#b3261e;color:#fff}.gdlg-card .btn.danger:disabled{opacity:.45}`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
  const dlg = document.createElement("div"); dlg.className = "gdlg"; dlg.hidden = true; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true");
  document.body.appendChild(dlg);
  const close = () => { dlg.hidden = true; dlg.innerHTML = ""; };
  dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !dlg.hidden) close(); });

  const MSG = {
    "auth/invalid-credential": $t("Fel e-post eller lösenord."), "auth/wrong-password": $t("Fel e-post eller lösenord."), "auth/user-not-found": $t("Fel e-post eller lösenord."),
    "auth/email-already-in-use": $t("Det finns redan ett konto med den e-postadressen. Logga in i stället."), "auth/weak-password": $t("Lösenordet måste ha minst 6 tecken."),
    "auth/invalid-email": $t("E-postadressen ser inte rätt ut."), "auth/too-many-requests": $t("För många försök. Vänta en stund och försök igen."),
    "auth/popup-closed-by-user": $t("Inloggningen avbröts."), "auth/network-request-failed": $t("Ingen anslutning. Kontrollera nätet.")
  };
  const say = (t, bad) => { const m = dlg.querySelector(".msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " err" : ""); } };

  function openLogin(view = "in") {
    const up = view === "up";
    dlg.innerHTML = `<div class="gdlg-card"><button class="btn small x" data-gx>${$t("Stäng")}</button>
      <h2>${up ? $t("Skapa konto") : $t("Logga in")}</h2><p>${$t("Med ett konto kan du logga matcher, skriva i forumet, betygsätta arenor och tipsa om pubar.")}</p>
      <button class="btn primary" data-ggoogle style="width:100%">${$t("Fortsätt med Google")}</button>
      ${CONFIG.apple ? `<button class="btn" data-gapple style="width:100%;margin-top:8px;background:#000;border-color:#000;color:#fff"><svg width="15" height="18" viewBox="0 0 15 18" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path fill="currentColor" d="M12.4 9.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8C3 4.4 1.6 5.3.8 6.7c-1.7 2.9-.4 7.1 1.2 9.4.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.6-3.9zM10.2 2.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z"/></svg>${$t("Fortsätt med Apple")}</button>` : ""}
      <p class="terms">${$t("Genom att fortsätta godkänner du {0}. Kränkande innehåll tolereras inte.", [`<button class="link" type="button" data-privacy="1" data-terms="1">${$t("villkoren och reglerna för innehåll")}</button>`])}</p>
      <div class="or">${$t("eller med e-post")}</div>
      <form data-gform>
        ${up ? `<label for="gName">${$t("Visningsnamn")}</label><input id="gName" maxlength="40" autocomplete="nickname" required>` : ""}
        <label for="gMail">${$t("E-post")}</label><input id="gMail" type="email" autocomplete="email" required>
        <label for="gPw">${$t("Lösenord")}</label><input id="gPw" type="password" minlength="6" autocomplete="${up ? "new-password" : "current-password"}" required>
        ${up ? `<label class="chk"><input type="checkbox" id="gTerms" required> <span>${$t("Jag godkänner {0} och förstår att kränkande innehåll inte tolereras.", [`<button class="link" type="button" data-privacy="1" data-terms="1">${$t("villkoren och reglerna för innehåll")}</button>`])}</span></label>` : ""}
        <div class="row"><button class="btn primary" type="submit">${up ? $t("Skapa konto") : $t("Logga in")}</button></div>
      </form>
      <div class="msg" aria-live="polite"></div>
      <div class="row" style="justify-content:space-between">
        <button class="link" data-gswap>${up ? $t("Har du konto? Logga in") : $t("Nytt här? Skapa konto")}</button>
        ${up ? "" : `<button class="link" data-greset>${$t("Glömt lösenordet?")}</button>`}
      </div></div>`;
    dlg.hidden = false;
    dlg.querySelector("[data-gx]").onclick = close;
    dlg.querySelector("[data-gswap]").onclick = () => openLogin(up ? "in" : "up");
    const r = dlg.querySelector("[data-greset]");
    if (r) r.onclick = async () => {
      const mail = dlg.querySelector("#gMail").value.trim(); if (!mail) { say($t("Skriv din e-postadress först."), true); return; }
      try { await A.sendPasswordResetEmail(auth, mail); say($t("Om adressen finns får du ett mejl med en länk för att välja nytt lösenord.")); } catch (e) { say(MSG[e.code] || $t("Det gick inte att skicka mejlet."), true); }
    };
    dlg.querySelector("[data-ggoogle]").onclick = async () => {
      const p = new A.GoogleAuthProvider();
      try { await A.signInWithPopup(auth, p); }
      catch (e) {
        if (/popup-blocked|operation-not-supported/.test(e.code || "")) { try { await A.signInWithRedirect(auth, p); return; } catch (e2) { e = e2; } }
        say(MSG[e.code] || $t("Inloggningen misslyckades."), true);
      }
    };
    // Logga in med Apple (krävs av App Store när Google finns). Slås på med apple: true i firebase-config.js
    const ap = dlg.querySelector("[data-gapple]");
    if (ap) ap.onclick = async () => {
      const p = new A.OAuthProvider("apple.com"); p.addScope("email"); p.addScope("name");
      try { auth.languageCode = LANGC; p.setCustomParameters({ locale: LOC[LANGC] || "sv_SE" }); } catch (e) {}
      try { const r = await A.signInWithPopup(auth, p); if (r && r.user) await ensureProfile(r.user, r.user.displayName || ""); }
      catch (e) {
        if (/popup-blocked|operation-not-supported/.test(e.code || "")) { try { await A.signInWithRedirect(auth, p); return; } catch (e2) { e = e2; } }
        say(MSG[e.code] || $t("Inloggningen misslyckades."), true);
      }
    };
    dlg.querySelector("[data-gform]").onsubmit = async ev => {
      ev.preventDefault();
      const mail = dlg.querySelector("#gMail").value.trim(), pw = dlg.querySelector("#gPw").value;
      say(up ? $t("Skapar konto…") : $t("Loggar in…"));
      try {
        if (up) {
          const name = dlg.querySelector("#gName").value.trim().slice(0, 40);
          const c = await A.createUserWithEmailAndPassword(auth, mail, pw);
          try { await A.updateProfile(c.user, { displayName: name }); } catch (e) {}
          await ensureProfile(c.user, name);
          try { await A.sendEmailVerification(c.user); } catch (e) {}
        } else await A.signInWithEmailAndPassword(auth, mail, pw);
      } catch (e) { say(MSG[e.code] || $t("Det gick inte. Försök igen."), true); }
    };
    setTimeout(() => { const f = dlg.querySelector(up ? "#gName" : "#gMail"); if (f) f.focus(); }, 30);
  }

  async function openAccount() {
    const u = getUser(); const name = await profileName(); const mod = await isAdmin();
    dlg.innerHTML = `<div class="gdlg-card"><button class="btn small x" data-gx>${$t("Stäng")}</button>
      <h2>${$t("Ditt konto")}</h2><p>${$t("Inloggad som {0}.", [esc(u.email || $t("Google- eller Apple-konto"))])}</p>
      ${mod ? `<div class="role">${SHIELD} ${$t("Moderator – du kan dölja inlägg och matchberättelser, sköta rättelser och läsa feedback")}</div>` : ""}
      <form data-gname><label for="gNm">${$t("Visningsnamn (syns i forum och topplistor)")}</label><input id="gNm" maxlength="40" value="${esc(name)}" required>
      <div class="row"><button class="btn" type="submit">${$t("Spara namn")}</button></div></form>
       ${mod ? `<div class="row"><button class="btn" data-gmod>${SHIELD} ${$t("Rättelser och feedback")}</button></div>` : ""}
      <div class="msg" aria-live="polite"></div>
      <div class="row"><button class="btn" data-gout>${$t("Logga ut")}</button></div>
      <div class="gdel"><button class="link" data-gdel>${$t("Radera mitt konto")}</button></div></div>`;
    dlg.hidden = false;
    dlg.querySelector("[data-gx]").onclick = close;
    const gm = dlg.querySelector("[data-gmod]"); if (gm) gm.onclick = () => { close(); if (window.groundlyOpenMod) window.groundlyOpenMod(); };
    dlg.querySelector("[data-gout]").onclick = () => A.signOut(auth);
    dlg.querySelector("[data-gdel]").onclick = () => confirmDelete(u);
    dlg.querySelector("[data-gname]").onsubmit = async ev => {
      ev.preventDefault(); const v = dlg.querySelector("#gNm").value.trim(); if (!v) return;
      await ensureProfile(u, v); say($t("Namnet är sparat. Det syns efter omladdning.")); setTimeout(() => location.reload(), 900);
    };
  }

  // radera kontot: allt användaren sparat eller skrivit, sedan själva kontot
  const OWN = ["forum", "ratings", "pubs", "quiz", "reports", "likes", "stats", "hype", "votes", "tipnotes", "fixes", "public", "cheers", "comments", "legends", "legvotes", "trsug", "trvote", "feedback", "profiles"];
  function confirmDelete(u) {
    const DELW = $t("RADERA");
    dlg.innerHTML = `<div class="gdlg-card"><h2>${$t("Radera mitt konto?")}</h2>
      <p>${$t("Det här tar bort ditt konto och allt du har sparat eller skrivit: dina loggade matcher, favoriter, foruminlägg, matchberättelser, kommentarer, legender, betyg och topplisteplatser.")} <b>${$t("Det går inte att ångra.")}</b></p>
      <p>${$t("Vill du behålla dina matcher, spara först en säkerhetskopia under Min fotboll → Matcher, längst ner.")}</p>
      <label for="gDelOk">${$t("Skriv {0} för att bekräfta", [`<b>${esc(DELW)}</b>`])}</label><input id="gDelOk" autocomplete="off">
      <div class="msg" aria-live="polite"></div>
      <div class="row"><button class="btn" data-gx>${$t("Avbryt")}</button><button class="btn danger" data-gdelgo disabled>${$t("Radera kontot")}</button></div></div>`;
    const inp = dlg.querySelector("#gDelOk"), go = dlg.querySelector("[data-gdelgo]");
    dlg.querySelector("[data-gx]").onclick = () => openAccount();
    inp.oninput = () => { go.disabled = inp.value.trim().toUpperCase() !== DELW.toUpperCase(); };
    go.onclick = async () => {
      go.disabled = true; say($t("Raderar…"));
      try {
        // Firebase kräver en färsk inloggning för att ta bort ett konto – be om den först, innan något raderas
        const cu = auth.currentUser; if (!cu) throw new Error("utloggad");
        const fresh = Date.now() - Date.parse(cu.metadata.lastSignInTime || 0) < 4 * 60 * 1000;
        if (!fresh) {
          const google = (cu.providerData || []).some(p => p.providerId === "google.com");
          const apple = (cu.providerData || []).some(p => p.providerId === "apple.com");
          if (google) await A.reauthenticateWithPopup(cu, new A.GoogleAuthProvider());
          else if (apple) await A.reauthenticateWithPopup(cu, new A.OAuthProvider("apple.com"));
          else { const pw = window.prompt($t("Skriv ditt lösenord för att bekräfta")); if (!pw) { say($t("Avbrutet."), true); go.disabled = false; return; }
            await A.reauthenticateWithCredential(cu, A.EmailAuthProvider.credential(cu.email, pw)); }
        }
        const uid = cu.uid;
        // först ett "borttaget"-märke (syns i cachens ändringar), sedan raderas dokumentet helt
        for (const c of OWN) { try { if (F.serverTimestamp && c !== "profiles" && c !== "feedback") await F.setDoc(F.doc(fs, c, uid), { _gone: true, _u: F.serverTimestamp() }); else await F.deleteDoc(F.doc(fs, c, uid)); } catch (e) { try { await F.deleteDoc(F.doc(fs, c, uid)); } catch (e2) {} } }
        try { await F.deleteDoc(F.doc(fs, "users", uid, "data", "logg")); } catch (e) {}
        await A.deleteUser(cu);
        try { localStorage.removeItem("fk-pending-logg"); } catch (e) {}
        say($t("Ditt konto är raderat."));
        setTimeout(() => location.reload(), 1200);
      } catch (e) { say(e && e.code === "auth/popup-closed-by-user" ? $t("Avbrutet.") : $t("Det gick inte att radera kontot. Logga ut och in igen och försök på nytt."), true); go.disabled = false; }
    };
    setTimeout(() => inp.focus(), 30);
  }

  // kontoknapp i toppfältet
  const btn = document.createElement("div"); btn.className = "gacc";
  const u = getUser();
  btn.innerHTML = u ? `<button class="gacc-btn" data-gacct aria-label="${esc($t("Ditt konto"))}"><span class="dot">${esc(((u.displayName || u.email || "?")[0] || "?").toUpperCase())}</span></button>`
    : `<button class="gacc-btn" data-glogin aria-label="${esc($t("Logga in"))}" title="${esc($t("Logga in"))}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="gl">${esc($t("Logga in"))}</span></button>`;
  if (u) isAdmin().then(m => { if (m) { const b = btn.querySelector(".gacc-btn"); if (b) { b.insertAdjacentHTML("beforeend", `<span class="mod" title="Moderator">${SHIELD}</span>`); b.setAttribute("aria-label", $t("Ditt konto (moderator)")); } } });
  const place = () => { const tb = document.querySelector(".topbar"); const th = document.getElementById("themeBtn"); if (tb && th) tb.insertBefore(btn, th); else if (tb) tb.appendChild(btn); else document.body.prepend(btn); };
  place();

  // all inloggning i appen (även knappar som appen själv ritar) går via data-glogin
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-glogin],[data-gacct]"); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    if (t.hasAttribute("data-gacct")) openAccount(); else openLogin(t.dataset.glogin === "up" ? "up" : "in");
  }, true);
  window.groundlyLogin = openLogin;
}

boot().catch(e => { console.error("[groundly]", e); done(NONE); });
