// Groundly – webbversionens runtime.
// Ersätter claude.ai:s window.claude.use("db"|"user"|"assets"|"downloads"|"sample")
// med Firebase (Auth + Firestore + Storage), så att appens kod kan vara oförändrad.
// Läsning av gemensamt innehåll fungerar utan inloggning; skrivning kräver konto.
import CONFIG from "./firebase-config.js";

const FB = (window.GROUNDLY_FIREBASE_BASE || "https://www.gstatic.com/firebasejs/10.14.1").replace(/\/$/, "");
const NONE = { use: async () => null };
const done = rt => { try { window.__groundlyReady(rt); } catch (e) {} };

// ---------- hjälpare ----------
const err = (code, msg) => Object.assign(new Error(msg || code), { code });
const mapErr = e => {
  const c = (e && e.code) || "";
  if (/permission-denied|unauthenticated|unauthorized/.test(c)) return err("invalid_argument", "Saknar behörighet");
  if (/resource-exhausted|invalid-argument|quota-exceeded/.test(c)) return err("quota_exceeded", "För stort");
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
  try { auth.languageCode = "sv"; } catch (e) {}
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
      if (!s.exists() || wanted) await F.setDoc(profRef(u.uid), { name, at: new Date().toISOString() });
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
  const LAZY = { forum: ["forum", "tips"], pubs: ["klubbar", "arenor", "landslag", "matcher", "tips"], tipnotes: ["tips", "mine"], fixes: ["mine"], comments: ["reportage"] };
  const docSnap = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
  const db = {
    doc(path) {
      const ref = F.doc(fs, mapPath(path));
      return {
        id: ref.id,
        async set(data) { try { await F.setDoc(ref, data); } catch (e) { throw mapErr(e); } },
        async update(data) { try { await F.updateDoc(ref, data); } catch (e) { throw mapErr(e); } },
        async delete() { try { await F.deleteDoc(ref); } catch (e) { throw mapErr(e); } },
        async get() { try { return docSnap(await F.getDoc(ref)); } catch (e) { throw mapErr(e); } },
        onSnapshot(next, onErr) { return F.onSnapshot(ref, s => next(docSnap(s)), e => onErr && onErr(mapErr(e))); }
      };
    },
    collection(name) {
      const ref = F.collection(fs, mapPath(name));
      const wrap = s => ({ size: s.size, empty: s.empty, docs: s.docs.map(d => ({ id: d.id, exists: true, data: () => d.data() })) });
      return {
        async get() { try { return wrap(await F.getDocs(ref)); } catch (e) { throw mapErr(e); } },
        onSnapshot(next, onErr) {
          const sub = () => F.onSnapshot(ref, s => next(wrap(s)), e => onErr && onErr(mapErr(e)));
          // samlingar som bara behövs i vissa vyer hämtas först när man öppnar vyn (sparar läsningar)
          const need = LAZY[name];
          if (!need || need.includes(window.__gmode)) return sub();
          let off = null, dead = false;
          const h = ev => { if (!off && !dead && need.includes(ev.detail)) { off = sub(); window.removeEventListener("gmode", h); } };
          window.addEventListener("gmode", h);
          return () => { dead = true; window.removeEventListener("gmode", h); if (off) off(); };
        }
      };
    }
  };

  // ---------- user ----------
  const NAMES = {};
  const userNs = {
    async id() { return user ? user.uid : null; },
    async canEdit() { return isAdmin(); },
    async profiles(ids) {
      const out = {};
      await Promise.all([...new Set(ids)].slice(0, 200).map(async id => {
        if (!(id in NAMES)) { try { const s = await F.getDoc(profRef(id)); NAMES[id] = s.exists() ? String(s.data().name || "") : ""; } catch (e) { NAMES[id] = ""; } }
        out[id] = { name: NAMES[id] };
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
  installAccountUi({ A, auth, getUser: () => user, ensureProfile, isAdmin, profileName: async () => user ? (await userNs.profiles([user.uid]))[user.uid].name : "" });

  const caps = { db, user: userNs, assets, downloads, sample };
  done({ use: async n => (n in caps ? caps[n] : null) });
}

// ================= inloggning =================
const SHIELD = `<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5z" fill="currentColor"/></svg>`;
function installAccountUi({ A, auth, getUser, ensureProfile, profileName, isAdmin }) {
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
  .gacc-btn .dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--accent,#1d6b3b);color:#fff;font-size:12px}
  .gdlg{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(0,0,0,.45);padding:16px}
  .gdlg[hidden]{display:none}
  .gdlg-card{width:min(420px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--surface,#fff);color:var(--fg,#111);border-radius:16px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font:15px/1.45 var(--f-body,system-ui)}
  .gdlg-card h2{margin:0 0 4px;font-size:20px}
  .gdlg-card p{margin:0 0 14px;color:var(--muted,#555)}
  .gdlg-card label{display:block;font-weight:600;font-size:13px;margin:10px 0 4px}
  .gdlg-card input{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit}
  .gdlg-card .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  .gdlg-card .row .btn{flex:1}
  .gdlg-card .or{display:flex;align-items:center;gap:10px;margin:16px 0 4px;color:var(--muted,#666);font-size:13px}
  .gdlg-card .or:before,.gdlg-card .or:after{content:"";flex:1;height:1px;background:var(--line,#ddd)}
  .gdlg-card .msg{min-height:1.2em;margin-top:10px;font-size:14px}
  .gdlg-card .msg.err{color:#b3261e}
  .gdlg-card .link{all:unset;cursor:pointer;color:var(--accent,#1d6b3b);font-weight:600;font-size:14px}
  .gdlg-card .x{float:right}`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
  const dlg = document.createElement("div"); dlg.className = "gdlg"; dlg.hidden = true; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true");
  document.body.appendChild(dlg);
  const close = () => { dlg.hidden = true; dlg.innerHTML = ""; };
  dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !dlg.hidden) close(); });

  const MSG = {
    "auth/invalid-credential": "Fel e-post eller lösenord.", "auth/wrong-password": "Fel e-post eller lösenord.", "auth/user-not-found": "Fel e-post eller lösenord.",
    "auth/email-already-in-use": "Det finns redan ett konto med den e-postadressen. Logga in i stället.", "auth/weak-password": "Lösenordet måste ha minst 6 tecken.",
    "auth/invalid-email": "E-postadressen ser inte rätt ut.", "auth/too-many-requests": "För många försök. Vänta en stund och försök igen.",
    "auth/popup-closed-by-user": "Inloggningen avbröts.", "auth/network-request-failed": "Ingen anslutning. Kontrollera nätet."
  };
  const say = (t, bad) => { const m = dlg.querySelector(".msg"); if (m) { m.textContent = t; m.className = "msg" + (bad ? " err" : ""); } };

  function openLogin(view = "in") {
    const up = view === "up";
    dlg.innerHTML = `<div class="gdlg-card"><button class="btn small x" data-gx>Stäng</button>
      <h2>${up ? "Skapa konto" : "Logga in"}</h2><p>Med ett konto kan du logga matcher, skriva i forumet, betygsätta arenor och tipsa om pubar.</p>
      <button class="btn primary" data-ggoogle style="width:100%">Fortsätt med Google</button>
      <div class="or">eller med e-post</div>
      <form data-gform>
        ${up ? `<label for="gName">Visningsnamn</label><input id="gName" maxlength="40" autocomplete="nickname" required>` : ""}
        <label for="gMail">E-post</label><input id="gMail" type="email" autocomplete="email" required>
        <label for="gPw">Lösenord</label><input id="gPw" type="password" minlength="6" autocomplete="${up ? "new-password" : "current-password"}" required>
        <div class="row"><button class="btn primary" type="submit">${up ? "Skapa konto" : "Logga in"}</button></div>
      </form>
      <div class="msg" aria-live="polite"></div>
      <div class="row" style="justify-content:space-between">
        <button class="link" data-gswap>${up ? "Har du konto? Logga in" : "Nytt här? Skapa konto"}</button>
        ${up ? "" : `<button class="link" data-greset>Glömt lösenordet?</button>`}
      </div></div>`;
    dlg.hidden = false;
    dlg.querySelector("[data-gx]").onclick = close;
    dlg.querySelector("[data-gswap]").onclick = () => openLogin(up ? "in" : "up");
    const r = dlg.querySelector("[data-greset]");
    if (r) r.onclick = async () => {
      const mail = dlg.querySelector("#gMail").value.trim(); if (!mail) { say("Skriv din e-postadress först.", true); return; }
      try { await A.sendPasswordResetEmail(auth, mail); say("Om adressen finns får du ett mejl med en länk för att välja nytt lösenord."); } catch (e) { say(MSG[e.code] || "Det gick inte att skicka mejlet.", true); }
    };
    dlg.querySelector("[data-ggoogle]").onclick = async () => {
      const p = new A.GoogleAuthProvider();
      try { await A.signInWithPopup(auth, p); }
      catch (e) {
        if (/popup-blocked|operation-not-supported/.test(e.code || "")) { try { await A.signInWithRedirect(auth, p); return; } catch (e2) { e = e2; } }
        say(MSG[e.code] || "Inloggningen misslyckades.", true);
      }
    };
    dlg.querySelector("[data-gform]").onsubmit = async ev => {
      ev.preventDefault();
      const mail = dlg.querySelector("#gMail").value.trim(), pw = dlg.querySelector("#gPw").value;
      say(up ? "Skapar konto…" : "Loggar in…");
      try {
        if (up) {
          const name = dlg.querySelector("#gName").value.trim().slice(0, 40);
          const c = await A.createUserWithEmailAndPassword(auth, mail, pw);
          try { await A.updateProfile(c.user, { displayName: name }); } catch (e) {}
          await ensureProfile(c.user, name);
          try { await A.sendEmailVerification(c.user); } catch (e) {}
        } else await A.signInWithEmailAndPassword(auth, mail, pw);
      } catch (e) { say(MSG[e.code] || "Det gick inte. Försök igen.", true); }
    };
    setTimeout(() => { const f = dlg.querySelector(up ? "#gName" : "#gMail"); if (f) f.focus(); }, 30);
  }

  async function openAccount() {
    const u = getUser(); const name = await profileName(); const mod = await isAdmin();
    dlg.innerHTML = `<div class="gdlg-card"><button class="btn small x" data-gx>Stäng</button>
      <h2>Ditt konto</h2><p>Inloggad som ${esc(u.email || "Google-konto")}.</p>
      ${mod ? `<div class="role">${SHIELD} Moderator – du kan dölja inlägg och reportage, sköta rättelser och läsa feedback</div>` : ""}
      <form data-gname><label for="gNm">Visningsnamn (syns i forum och topplistor)</label><input id="gNm" maxlength="40" value="${esc(name)}" required>
      <div class="row"><button class="btn" type="submit">Spara namn</button></div></form>
      <div class="msg" aria-live="polite"></div>
      <div class="row"><button class="btn" data-gout>Logga ut</button></div></div>`;
    dlg.hidden = false;
    dlg.querySelector("[data-gx]").onclick = close;
    dlg.querySelector("[data-gout]").onclick = () => A.signOut(auth);
    dlg.querySelector("[data-gname]").onsubmit = async ev => {
      ev.preventDefault(); const v = dlg.querySelector("#gNm").value.trim(); if (!v) return;
      await ensureProfile(u, v); say("Namnet är sparat. Det syns efter omladdning."); setTimeout(() => location.reload(), 900);
    };
  }

  // kontoknapp i toppfältet
  const btn = document.createElement("div"); btn.className = "gacc";
  const u = getUser();
  btn.innerHTML = u ? `<button class="gacc-btn" data-gacct aria-label="Ditt konto"><span class="dot">${esc(((u.displayName || u.email || "?")[0] || "?").toUpperCase())}</span></button>`
    : `<button class="gacc-btn" data-glogin aria-label="Logga in" title="Logga in"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="gl">Logga in</span></button>`;
  if (u) isAdmin().then(m => { if (m) { const b = btn.querySelector(".gacc-btn"); if (b) { b.insertAdjacentHTML("beforeend", `<span class="mod" title="Moderator">${SHIELD}</span>`); b.setAttribute("aria-label", "Ditt konto (moderator)"); } } });
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
