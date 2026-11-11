// Groundly: skickar påminnelser (webbpush) via Firebase Cloud Messaging. Körs varje timme i GitHub Actions i det privata repot groundly-backup (.github/workflows/push.yml).
// Kräver hemligheten FIREBASE_SA (tjänstekontots JSON). Saknas den avslutas skriptet utan att göra något.
// Läser users/{uid}/data/push (token, val, tidszon, språk, vad som redan skickats) och users/{uid}/data/logg (Vill gå och loggade matcher).
//   wish7: matchen i Vill gå är om en vecka          wish1: matchen är i morgon (skickas från kl 17)
//   nt:    matchen i Vill gå har fått ny avsparkstid i schemat (eller fått en tid, om bara datumet var känt)
//   log:   morgonen efter en match i Vill gå som inte loggats (från kl 9)
// Spärrar: bara mellan 08 och 21 lokal tid, högst tre notiser per användare och sju dagar, varje notis bara en gång.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const SA = (() => { try { return JSON.parse(process.env.FIREBASE_SA || ""); } catch (e) { return null; } })();
if (!SA || !SA.private_key) { console.log("FIREBASE_SA saknas – inga påminnelser skickas."); process.exit(0); }
const DRY = process.env.PUSH_DRY === "1";
const PROJECT = SA.project_id;
const ROOT = path.resolve(__dirname, "..");
const LOC = { sv: "sv-SE", nb: "nb-NO", da: "da-DK", fi: "fi-FI", is: "is-IS", de: "de-DE", en: "en-GB", es: "es-ES", fr: "fr-FR", it: "it-IT", nl: "nl-NL", pl: "pl-PL", pt: "pt-BR" };
const I18N = {}; const tr = (lang, s, v) => { if (!(lang in I18N)) { try { I18N[lang] = lang === "sv" ? {} : JSON.parse(fs.readFileSync(path.join(ROOT, "src", "i18n", lang + ".json"), "utf8")); } catch (e) { I18N[lang] = {}; } }
  const r = I18N[lang][s] || s; return v ? r.replace(/\{(\d)\}/g, (m, k) => v[k] != null ? v[k] : m) : r; };
// klubbnamn på användarens språk (samma regler som i appen, förenklat: de översatta namnen ligger i i18n-filerna)
const clubs = {}; try { require(path.join(ROOT, "src", "clubs.js")).forEach(r => { clubs[r[0]] = r[1]; }); } catch (e) {}
// aktuellt schema (samma fil som appen läser): hemma|borta -> [{ko, comp}]
const FX = new Map(); try { (JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "fixtures-next.json"), "utf8")).rows || []).forEach(r => { if (!r[2]) return; const k = r[0] + "|" + r[1]; if (!FX.has(k)) FX.set(k, []); FX.get(k).push({ ko: r[2], comp: r[5] }); }); } catch (e) {}
const fxNow = w => { if (!w.home || !w.away) return null; const t0 = Date.parse(w.kickoff || (w.dateFrom ? w.dateFrom + "T12:00:00Z" : "")); if (!t0) return null;
  const c = (FX.get(w.home + "|" + w.away) || []).filter(x => (!w.comp || !x.comp || x.comp === w.comp) && Math.abs(Date.parse(x.ko) - t0) < 10 * 864e5); return c.length === 1 ? c[0].ko : null; };
const team = (lang, id, name) => { const n = (id && clubs[id]) || name || ""; return tr(lang, n); };

async function token() {
  const now = Math.floor(Date.now() / 1000), b = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b({ alg: "RS256", typ: "JWT" }), body = b({ iss: SA.client_email, scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = crypto.createSign("RSA-SHA256").update(head + "." + body).sign(SA.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json(); if (!j.access_token) throw new Error("ingen åtkomsttoken: " + JSON.stringify(j).slice(0, 200)); return j.access_token;
}
// Firestore REST: typade värden <-> vanliga objekt
const dec = v => v == null ? null : "stringValue" in v ? v.stringValue : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue : "booleanValue" in v ? v.booleanValue : "nullValue" in v ? null
  : "timestampValue" in v ? v.timestampValue : "arrayValue" in v ? (v.arrayValue.values || []).map(dec) : "mapValue" in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : null;
const enc = x => x === null || x === undefined ? { nullValue: null } : typeof x === "boolean" ? { booleanValue: x } : typeof x === "number" ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x })
  : typeof x === "string" ? { stringValue: x } : Array.isArray(x) ? { arrayValue: { values: x.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, enc(v)])) } };

(async () => {
  const tok = await token(); const H = { authorization: "Bearer " + tok, "content-type": "application/json" };
  const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  // alla push-dokument (samlingsgruppen "data", dokument-id "push"), sedan respektive logg
  const q = await fetch(DB + ":runQuery", { method: "POST", headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "data", allDescendants: true }] } }) });// utan filter: ett filter på samlingsgruppen skulle kräva ett eget index
  const rows = (await q.json()).filter(x => x.document && /\/data\/push$/.test(x.document.name));
  const stat = { users: rows.length, sent: 0, removedTokens: 0, skipped: {} }; const skip = k => stat.skipped[k] = (stat.skipped[k] || 0) + 1;
  for (const r of rows) {
    const name = r.document.name, uid = name.split("/users/")[1].split("/")[0];
    const P = Object.fromEntries(Object.entries(r.document.fields || {}).map(([k, v]) => [k, dec(v)]));
    if (!P.on) { skip("avstängd"); continue; }
    const tokens = (P.tokens || []).filter(t => t && t.t); if (!tokens.length) { skip("utan token"); continue; }
    const lang = LOC[P.lang] ? P.lang : "sv", tz = P.tz || "Europe/Stockholm", pr = Object.assign({ wish: true, log: true }, P.prefs || {});
    const hour = +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date());
    if (hour < 8 || hour >= 21) { skip("natt"); continue; }
    const sent = P.sent || {}; const now = Date.now();
    for (const k of Object.keys(sent)) if (now - Date.parse(sent[k]) > 60 * 864e5) delete sent[k];
    let week = Object.values(sent).filter(t => now - Date.parse(t) < 7 * 864e5).length; if (week >= 3) { skip("veckotak"); continue; }
    const lr = await fetch(`${DB}/users/${uid}/data/logg`, { headers: H }); if (!lr.ok) { skip("ingen logg"); continue; }
    const L = Object.fromEntries(Object.entries((await lr.json()).fields || {}).map(([k, v]) => [k, dec(v)]));
    const wish = (L.wishMatches || []).filter(w => w && w.id && (w.kickoff || w.dateFrom)), att = new Set((L.attended || []).map(a => a && a.mid).filter(Boolean));
    const fmt = d => new Intl.DateTimeFormat(LOC[lang], { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
    const tm = d => new Intl.DateTimeFormat(LOC[lang], { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
    const out = [];
    for (const w of wish) {
      const nk = fxNow(w), old = w.kickoff ? Date.parse(w.kickoff) : null;
      const moved = nk && Date.parse(nk) > now && !att.has(w.id) && (old ? Math.abs(Date.parse(nk) - old) >= 5 * 6e4 : Date.parse(nk) - now < 30 * 864e5);
      if (!w.kickoff && !nk) continue;
      const ko = nk ? Date.parse(nk) : old, h = team(lang, w.home, w.homeName), a = team(lang, w.away, w.awayName), where = [w.venue, w.city && tr(lang, w.city)].filter(Boolean).join(", ");
      if (moved && pr.wish !== false && !sent["nt:" + w.id + ":" + nk])
        out.unshift(old ? { key: "nt:" + w.id + ":" + nk, title: tr(lang, "Ny tid: {0} – {1}", [h, a]), body: tr(lang, "Matchen är flyttad till {0}. Tidigare {1}.", [fmt(ko), fmt(old)]), url: "./?go=mine" }
          : { key: "nt:" + w.id + ":" + nk, title: tr(lang, "Avsparkstiden är klar: {0} – {1}", [h, a]), body: tr(lang, "Matchen spelas {0}.", [[fmt(ko), where].filter(Boolean).join(", ")]), url: "./?go=mine" });
      if (pr.wish !== false && ko - now > 6 * 864e5 && ko - now <= 7 * 864e5 && !sent["w7:" + w.id])
        out.push({ key: "w7:" + w.id, title: tr(lang, "{0} – {1} om en vecka", [h, a]), body: tr(lang, "Matchen ligger i Vill gå. {0}.", [[fmt(ko), where].filter(Boolean).join(", ")]), url: "./?go=mine" });
      if (pr.wish !== false && ko - now > 6 * 36e5 && ko - now <= 36 * 36e5 && hour >= 17 && !sent["w1:" + w.id])
        out.push({ key: "w1:" + w.id, title: tr(lang, "I morgon: {0} – {1}", [h, a]), body: tr(lang, "Avspark {0}{1}. Trevlig match!", [tm(ko), where ? " · " + where : ""]), url: "./?go=mine" });
      if (pr.log !== false && now - ko > 3 * 36e5 && now - ko <= 40 * 36e5 && hour >= 9 && !att.has(w.id) && !sent["lg:" + w.id])
        out.push({ key: "lg:" + w.id, title: tr(lang, "Var du på {0} – {1}?", [h, a]), body: tr(lang, "Logga matchen, så växer din statistik."), url: "./?go=hem" });
    }
    let dirty = false; const bad = new Set();
    for (const n of out) {
      if (week >= 3) break;
      let ok = false;
      for (const t of tokens) {
        if (bad.has(t.t)) continue;
        if (DRY) { console.log("[torrkörning]", uid.slice(0, 6), n.title, "|", n.body); ok = true; continue; }
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method: "POST", headers: H,
          body: JSON.stringify({ message: { token: t.t, webpush: { headers: { TTL: "86400", Urgency: "normal" }, data: { title: n.title, body: n.body, url: n.url, tag: n.key }, fcm_options: { link: n.url } } } }) });
        if (res.ok) ok = true; else { const j = await res.json().catch(() => ({})); const st = j.error && j.error.status; if (res.status === 404 || st === "NOT_FOUND" || st === "UNREGISTERED" || (st === "INVALID_ARGUMENT" && /token/i.test(JSON.stringify(j)))) bad.add(t.t); }
      }
      if (ok) { sent[n.key] = new Date().toISOString(); week++; stat.sent++; dirty = true; }
    }
    if (bad.size) { stat.removedTokens += bad.size; dirty = true; }
    if (dirty && !DRY) {
      const keep = tokens.filter(t => !bad.has(t.t));
      await fetch(`${name.replace(/^projects\/[^/]+\/databases\/\(default\)\/documents/, DB)}?updateMask.fieldPaths=sent&updateMask.fieldPaths=tokens&updateMask.fieldPaths=on`, { method: "PATCH", headers: H,
        body: JSON.stringify({ fields: { sent: enc(sent), tokens: enc(keep), on: enc(keep.length > 0) } }) });
    }
  }
  console.log(JSON.stringify(stat));
})().catch(e => { console.error("push:", e.message); process.exit(1); });
