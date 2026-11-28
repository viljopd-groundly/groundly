// Ligamästare ur arkivet: när en högstaserie är färdigspelad räknar vi fram tabellen ur resultaten
// och lägger titeln till klubbens meriter (build-web.js). Meriterna i src/clubs.js är handskrivna
// till och med säsongen 2025/26 (kalenderårsserier 2025) – allt därefter läggs till här.
//
// Bara enkla serieformat räknas: alla lag möter alla lika många gånger och alla matcher är spelade.
// Slutspel, delade serier (t.ex. Skottland, Belgien), konferenser (MLS) och ofullständigt arkiv
// faller bort automatiskt. Lika poäng i toppen hoppas också över (tiebreak skiljer mellan ligor).
const fs = require("fs"), path = require("path");

function seasonChampion(d) {
  const T = d.t || [], M = d.m || [];
  const games = new Array(T.length).fill(0);
  M.forEach(m => { games[m[0]]++; games[m[1]]++; });
  const max = Math.max(0, ...games);
  if (max < 4) return { skip: "för få matcher" };
  // kärnlagen: de som spelat (nästan) hela serien – kvallag och liknande med ett par matcher räknas bort
  const core = new Set(games.map((g, i) => g >= 0.8 * max ? i : -1).filter(i => i >= 0));
  const n = core.size;
  if (n < 4) return { skip: "för få lag" };
  const pair = new Map(), pts = new Map(), gd = new Map();
  for (const i of core) { pts.set(i, 0); gd.set(i, 0); }
  for (const m of M) {
    const [h, a, , , gh, ga] = m;
    if (!core.has(h) || !core.has(a)) continue;
    const played = Number.isFinite(gh) && Number.isFinite(ga) && gh !== "" && ga !== "";
    if (!played) return { skip: "inte färdigspelad" };
    const k = h < a ? h + "|" + a : a + "|" + h;
    pair.set(k, (pair.get(k) || 0) + 1);
    pts.set(h, pts.get(h) + (gh > ga ? 3 : gh === ga ? 1 : 0));
    pts.set(a, pts.get(a) + (ga > gh ? 3 : gh === ga ? 1 : 0));
    gd.set(h, gd.get(h) + gh - ga); gd.set(a, gd.get(a) + ga - gh);
  }
  if (pair.size !== n * (n - 1) / 2) return { skip: "alla lag har inte mött varandra" };
  const ks = new Set(pair.values());
  if (ks.size !== 1) return { skip: "ojämnt antal möten (slutspel eller delad serie)" };
  // enkel serie (alla möts en gång) är oftast bara första fasen före ett mästerskapsspel
  if ([...ks][0] < 2) return { skip: "bara en omgång – troligen första fasen" };
  const table = [...core].sort((x, y) => pts.get(y) - pts.get(x) || gd.get(y) - gd.get(x));
  if (pts.get(table[0]) === pts.get(table[1])) return { skip: "lika poäng i toppen" };
  const id = T[table[0]] && T[table[0]][1];
  if (!id) return { skip: "mästaren saknar klubb-id" };
  return { id, name: T[table[0]][0], pts: pts.get(table[0]) };
}

// Länder där ligamästaren avgörs av en vanlig dubbelserie. Utanför listan (t.ex. Latinamerikas
// apertura/clausura eller ligor med slutspel) blir tabellettan ofta inte mästare.
const OK_CC = new Set(("al ad am at az by be ba bg hr cy cz dk en ee fo fi fr ge de gi gr hu is il it kz xk lv li lt lu mt md me nl mk nir no pl pt ie ro ru sm sco rs sk si es se ch tr ua wal " +
  "br jp kr cn sa ir qa ae uz cl ma dz tn za").split(" "));

// { klubb-id: [{ year, league, season }] } för högstaserier från och med startåret
function champions(siteDir, fromYear = 2026, log = null) {
  const out = {}, dir = path.join(siteDir, "archive");
  // officiell tabell (bara pågående/senaste säsong) – säger den något annat än vår uträkning hoppar vi över
  let ST = {};
  try { ST = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "standings.json"), "utf8")).leagues || {}; } catch (e) {}
  let codes = [];
  try { codes = fs.readdirSync(dir); } catch (e) { return out; }
  for (const code of codes) {
    let files = [];
    try { files = fs.readdirSync(path.join(dir, code)).filter(f => f.endsWith(".json")); } catch (e) { continue; }
    for (const f of files) {
      const y0 = +f.slice(0, 4);
      if (!(y0 >= fromYear)) continue;
      let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, code, f), "utf8")); } catch (e) { continue; }
      if (String(d.tier) !== "1") continue;
      if (!OK_CC.has(code.split(".")[0])) continue;
      const r = seasonChampion(d);
      const st = ST[d.l];
      if (r.id && st && String(st.season) === String(y0) && st.groups && st.groups.length === 1) {
        const top = st.groups[0].rows.find(x => +x[2] === 1);
        if (top && top[0] && top[0] !== r.id) { r.skip = `officiella tabellen har ${top[1]} etta`; delete r.id; }
      }
      // höst–vår-säsonger skrivs med slutåret, som brukligt för ligatitlar (2026/27 → 2027)
      const year = /\d{4}-\d{2}/.test(f) ? y0 + 1 : y0;
      if (log) log(`${d.l} ${d.s}: ${r.id ? r.name + " (" + r.pts + " p)" : "– " + r.skip}`);
      if (r.id) (out[r.id] = out[r.id] || []).push({ year, league: d.l, season: d.s });
    }
  }
  for (const k in out) out[k].sort((a, b) => a.year - b.year);
  return out;
}

// Rader om ligaguld känns igen på orden – cuper och internationella titlar lämnas orörda
const LEAGUE_RX = /(ligatitl|ligatitel|SM-guld|mästerskap|mästare)/i;
const NOT_LEAGUE_RX = /(cup|Cup|Pokal|Copa|Coupe|Coppa|Champions|Libertadores|afrikanska|asiatiska|Afrikanska|Asiatiska|Interkontinentala|VM|EM|OS|Europa|Klubb)/;

// Lägger nya titlar till en klubbs meritlista (h). Returnerar en ny lista.
// hasKey(mall) säger om en textmall finns översatt (t.ex. "{0} ligatitlar (senast {1})") –
// nya formuleringar används bara om de går att översätta, annars blir det enklare text.
function applyTitles(h, titles, country, hasKey = () => true) {
  h = Array.isArray(h) ? h.slice() : [];
  const years = titles.map(t => t.year).filter((y, i, a) => a.indexOf(y) === i);
  const isLeague = x => LEAGUE_RX.test(x) && !NOT_LEAGUE_RX.test(x);
  // redan med (t.ex. om meriterna har uppdaterats för hand)
  const yNew = years.filter(y => !h.some(x => isLeague(x) && new RegExp("\\b" + y + "\\b").test(x)));
  if (!yNew.length) return h;
  const last = yNew[yNew.length - 1], k = yNew.length;
  const sv = country === "Sverige";
  const fresh = (word, n) => n === 1 ? (sv ? `SM-guld ${last}` : `Ligatitel ${last}`) : `${n} ${word} (senast ${last})`;
  const withLatest = (n, word) => hasKey(`{0} ${word} (senast {1})`) ? `${n} ${word} (senast ${last})` : `${n} ${word}`;
  const i = h.findIndex(isLeague);
  if (i < 0) { h.unshift(fresh(sv ? "SM-guld" : "ligatitlar", k)); return h; }
  let x = h[i], m;
  if ((m = x.match(/^(\d+) (.+?) \((?:senast \d{4}|[\d, ]+)\)$/))) x = withLatest(+m[1] + k, m[2]);
  else if ((m = x.match(/^(\d+) (.+)$/))) x = withLatest(+m[1] + k, m[2]);
  else if ((m = x.match(/^(Ligatitel|SM-guld|Finsk mästare) (\d{4})$/))) {
    const word = m[1] === "SM-guld" ? "SM-guld" : m[1] === "Finsk mästare" ? "finska mästerskap" : "ligatitlar";
    x = withLatest(1 + k, word);
  }
  else if (/\(senast \d{4}\)/.test(x)) x = x.replace(/\(senast \d{4}\)/, `(senast ${last})`);
  else { h.unshift(fresh(sv ? "SM-guld" : "ligatitlar", k)); return h; }
  h[i] = x;
  return h;
}

module.exports = { champions, applyTitles, seasonChampion };
