/* BALL 4 · SEASON MODE: the game (_plans/games-round.md, round 3). A whole league season with your club, a matchday at a time.

   Six divisions in three countries: Eredivisie and Eerste Divisie, Bundesliga and 2. Bundesliga, Pro League and Challenger Pro
   League. Pick one and a club. A matchday is three multiple-choice questions, fifteen seconds each: a right answer is a goal, a
   wrong one gives the other side a chance. Everybody else plays too, and the table is a true table of the lot. Bottom two go down,
   top two of the division below come up, and the next season carries on with the same club. Loaded by index.html (ssnNeed) on the
   first open; the door, the store's load and save and the shelf's line are there, next to Transfer Trail's. A plain script with
   plain globals, like trail.js. Every question earns XP as elsewhere; no Daily link.

   THE SHAPE
     - assets/season/leagues.json: the real 2025/26 tables, read against the app's pools. A side's record there sets its power
       (ssnPower). A side that changed division carries the record of the division it left, so a side coming down is strong in its
       new division and a side coming up is weak in its new one. Reserve sides carry of: their first team.
     - ball4-season (seasonStore, always read fresh): {v, run, done}. done is every finished season, and follows the account as a
       union (assets/sync/sync.js), so a finished season can't be lost on another phone. run is the one season under way:
       {id, seed, land, club, lvl, y, div, top, low, res, live, used}. top and low are who is in the two divisions this season.
     - res is the whole of what you did: one digit a match, the three thirds as bits (1 the first answer right, 2 the second, 4 the
       third). Everything else comes back from {seed, res}: the fixtures, the other results, your opponents' goals, the table. So a
       season is small and two phones draw the same table.
     - Each match has its own generator, seeded by the round and the home side, so the other results don't depend on the order
       anything was worked out in, and an answer can't change a match you aren't in.
     - THE MATCH IN THREE THIRDS. Each answer is one third of the match. Right is your goal, and they get little; wrong and they
       get a chance. Their goals are a Poisson draw per third on a number fixed before you answer (ssnTheirs), so a better answer
       can never get a worse result, and the score moves in front of you as you play. They can score at most once in a third you
       answered right, so three right can't lose. The numbers are in SSN_TUNE, tuned by the Monte Carlo in _tests/season-test.js.
     - live is the matchday under way, saved as each question goes up (open: 1), so leaving on a question you didn't like costs
       that third: it is a miss when you come back. used is every question asked in this run, on the same beat.
     - SN is the question on the screen and SND the last full time; neither is saved.
     - Reserve sides aren't on the picker (they can't go up, which is half the game). They play, finish where they finish, and
       the two promotion places go past them. A reserve side sits out while its first team is in the same division, which is the
       real rule. The table is only ever the sides that are playing.
     - The rules are plain functions (ssnFixtures, ssnTable, ssnMoves, ssnDeal…), so _tests/season-test.js can run them. */

const SSN_Q = 3, SSN_SECS = 15, SSN_FIRST = 2026, SSN_RIGHT_MS = 900, SSN_WRONG_MS = 1900;
const SSN_LEVELS = [["easy", "Easy", ["easy", "normal"], "Easy and Normal questions"], ["normal", "Normal", ["normal", "hard"], "Normal and Hard questions"], ["hard", "Hard", ["hard", "extreme", "ball"], "Hard, Extreme and Ball"]];
/* base and home: goals a side expects against its equal, and what home is worth, in the matches you aren't in.
   k: how fast a gap in power turns into goals. free: their chance in a third you answered right. miss: what a wrong answer adds.
   you: what your home ground takes off them. edge: k for your matches. */
const SSN_TUNE = { base: 1.32, home: 1.13, k: .024, free: .46, miss: .72, you: 1.14, edge: .028 };

let SSN_DATA = null, SSN_T = {}, SSN_BUSY = 0, SSN_TRIES = 0, SN = null, SND = null, SSN_TIMER = null, SSN_PICK = { div: null, club: null };
const SSN_CTX = new Map(), SSN_ROWS = new Map();

/* ---------- the numbers ---------- */
function ssnHash(str){ let h = 0x811c9dc5; str = String(str); for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function ssnRng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* a Poisson draw by its inverse, so the same u with a bigger number can never give fewer goals */
function ssnPoisson(l, u){ let k = 0, p = Math.exp(-l), c = p; while(u > c && k < 9){ k++; p *= l / k; c += p; } return k; }

/* ---------- the sides ---------- */
/* one scale for the whole country. A top-flight side's points per game puts it between 50 and about 90, a second-tier side's
   between 35 and 60, so the bottom of the one meets the top of the other, as it does */
function ssnPower(r){
  const ppg = (r.pts + (r.ded || 0)) / r.p;
  return r.tier === 1 ? 50 + 20 * (ppg - .56) : r.tier === 2 ? 24 + 15 * ppg : 14 + 12 * ppg;
}
function ssnUse(d){
  SSN_DATA = d; SSN_T = {};
  for(const D of Object.values(d.divisions)){
    const t = SSN_T[D.land] = SSN_T[D.land] || {};
    for(const r of D.sides) t[r.n] = Object.assign({}, r, { pool: D.pool, pow: ssnPower(r) });
  }
  return d;
}
function ssnLoad(){
  if(SSN_BUSY) return;
  SSN_BUSY = 1;
  fetch("assets/season/leagues.json").then(r => { if(!r.ok) throw new Error("leagues"); return r.json(); })
    .then(d => { ssnUse(d); SSN_BUSY = 0; if(SSN_VIEW) render(); }, () => { SSN_BUSY = 0; toast("That didn’t load. Try again in a moment.", true); });
}
const ssnTeam = (land, n) => (SSN_T[land] || {})[n] || { n, s: null, pow: 45 };   // a side a later pool has dropped still plays its season out
const ssnDiv = k => SSN_DATA.divisions[k];
const ssnLand = run => SSN_DATA.lands[run.land];
const ssnIsTop = run => ssnLand(run).top === run.div;
const ssnListOf = (run, div) => ssnLand(run).top === div ? run.top : run.low;
/* who is playing: a reserve side sits out while its first team is in the division */
const ssnPlaying = (land, list) => list.filter(n => { const o = ssnTeam(land, n).of; return !o || !list.includes(o); });
const ssnYear = y => y + "/" + String((y + 1) % 100).padStart(2, "0");
const ssnOrd = n => { const t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"); };

/* ---------- the fixtures ---------- */
/* THE ROUND ROBIN, by the circle: one side stands still, the rest turn. An odd division has a bye, which is the null. The return
   round is the first one mirrored, so everybody has met everybody home and away */
function ssnFixtures(sides, seed){
  const rnd = ssnRng(seed), list = sides.slice();
  for(let i = list.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  if(list.length % 2) list.push(null);
  const n = list.length, half = [];
  let ring = list.slice(1);
  for(let r = 0; r < n - 1; r++){
    const a = [list[0]].concat(ring), round = [];
    for(let i = 0; i < n / 2; i++){
      const x = a[i], y = a[n - 1 - i];
      if(x === null || y === null) continue;
      /* a side moves one place along the ring each round, so home by the place's parity gives everybody turn and turn about */
      round.push((i === 0 ? r % 2 === 0 : i % 2 === 0) ? [x, y] : [y, x]);
    }
    half.push(round);
    ring = [ring[ring.length - 1]].concat(ring.slice(0, -1));
  }
  return half.concat(half.map(rd => rd.map(m => [m[1], m[0]])));
}
/* A SEASON OF ONE DIVISION, worked out from the seed: the sides, this season's form (a side is a few points up or down on last
   season's table, so no two seasons are the same), the fixtures and which of them are yours. Kept while the same run asks again */
function ssnCtx(run, div){
  div = div || run.div;
  const list = ssnListOf(run, div), club = div === run.div ? run.club : null, key = [run.seed, run.y, div, club, list.join()].join("|");
  if(SSN_CTX.has(key)) return SSN_CTX.get(key);
  const sides = ssnPlaying(run.land, list), seed = ssnHash(run.seed + ":" + run.y + ":" + div), pow = {};
  for(const n of sides){ const r = ssnRng(ssnHash(run.seed + ":" + run.y + ":" + n)); pow[n] = ssnTeam(run.land, n).pow + (r() + r() - 1) * 6; }
  const rounds = ssnFixtures(sides, seed), mine = [], at = {};
  rounds.forEach((rd, i) => rd.forEach(m => { if(m[0] === club || m[1] === club){ at[i] = mine.length; mine.push({ round: i, home: m[0] === club, opp: m[0] === club ? m[1] : m[0] }); } }));
  const ctx = { div, land: run.land, club, seed, sides, pow, rounds, mine, at, memo: {} };
  if(SSN_CTX.size > 12) SSN_CTX.clear();
  SSN_CTX.set(key, ctx);
  return ctx;
}

/* ---------- a match ---------- */
/* a match you aren't in: two Poisson draws, the gap in power and the home ground */
function ssnAiScore(ctx, r, m){
  const k = r + ":" + m[0];
  if(ctx.memo[k]) return ctx.memo[k];
  const T = SSN_TUNE, d = ctx.pow[m[0]] - ctx.pow[m[1]], rnd = ssnRng(ssnHash(ctx.seed + ":" + r + ":" + m[0]));
  return ctx.memo[k] = [ssnPoisson(T.base * T.home * Math.exp(T.k * d), rnd()), ssnPoisson(T.base / T.home * Math.exp(-T.k * d), rnd())];
}
/* THEIR GOALS IN ONE THIRD OF YOUR MATCH. u is the third's own draw, fixed before you answer; your answer only sets the number it
   is read against, so a right answer never leaves you worse off than a wrong one would have */
function ssnTheirs(ctx, m, i, right){
  const T = SSN_TUNE, u = ssnRng(ssnHash(ctx.seed + ":" + m.round + ":" + i + ":them"))();
  const l = (right ? T.free : T.free + T.miss) * Math.exp(T.edge * (ctx.pow[m.opp] - ctx.pow[ctx.club])) * (m.home ? 1 / T.you : T.you);
  return Math.min(right ? 1 : 2, ssnPoisson(l, u));
}
const ssnBit = (pat, i) => !!(pat & (1 << i));
const ssnRights = pat => ssnBit(pat, 0) + ssnBit(pat, 1) + ssnBit(pat, 2);
function ssnYours(ctx, m, pat){
  let gf = 0, ga = 0;
  for(let i = 0; i < SSN_Q; i++){ const ok = ssnBit(pat, i); if(ok) gf++; ga += ssnTheirs(ctx, m, i, ok); }
  return { gf, ga };
}
/* the match as it reads: every goal with its minute and, once the squads are in, who got it */
function ssnScorer(side, u){
  try{
    const xi = ((TEAMS[side.pool] || {})[side.n] || {}).xi;
    if(!xi || !xi.length) return "";
    const w = p => p.pos === "FW" ? 6 : p.pos === "MF" ? 3 : p.pos === "DF" ? 1 : 0;
    let left = u * xi.reduce((a, p) => a + w(p), 0);
    for(const p of xi){ left -= w(p); if(left < 0) return String(p.n).split("|")[0]; }
  }catch(e){}
  return "";
}
function ssnEvents(ctx, m, pat, upto){
  const out = [];
  for(let i = 0; i < (upto == null ? SSN_Q : upto); i++){
    const ok = ssnBit(pat, i), rnd = ssnRng(ssnHash(ctx.seed + ":" + m.round + ":" + i + ":when")), min = () => i * 30 + 1 + Math.floor(rnd() * 30);
    if(ok) out.push({ min: min(), you: true, third: i, who: ssnScorer(ssnTeam(ctx.land, ctx.club), rnd()) });
    for(let g = ssnTheirs(ctx, m, i, ok); g > 0; g--) out.push({ min: min(), you: false, third: i, who: ssnScorer(ssnTeam(ctx.land, m.opp), rnd()) });
  }
  return out.sort((a, b) => a.min - b.min);
}

/* ---------- the table ---------- */
/* the rounds that are over: everything before your next match, byes and all */
const ssnRoundsDone = (ctx, res) => !ctx.club ? ctx.rounds.length : res.length >= ctx.mine.length ? ctx.rounds.length : ctx.mine[res.length].round;
/* points, goal difference, goals scored, then the alphabet, so two phones can't disagree */
function ssnTable(ctx, res, upto){
  res = res || "";
  const t = {}, end = upto == null ? ssnRoundsDone(ctx, res) : upto;
  for(const n of ctx.sides) t[n] = { n, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  const put = (a, f, g) => { const x = t[a]; x.p++; x.gf += f; x.ga += g; if(f > g){ x.w++; x.pts += 3; } else if(f === g){ x.d++; x.pts++; } else x.l++; };
  for(let r = 0; r < end; r++) for(const m of ctx.rounds[r]){
    let f, g;
    if(ctx.club && (m[0] === ctx.club || m[1] === ctx.club)){
      const k = ctx.at[r];
      if(k >= res.length) continue;
      const y = ssnYours(ctx, ctx.mine[k], +res[k]);
      f = ctx.mine[k].home ? y.gf : y.ga; g = ctx.mine[k].home ? y.ga : y.gf;
    } else [f, g] = ssnAiScore(ctx, r, m);
    put(m[0], f, g); put(m[1], g, f);
  }
  return Object.values(t).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || (a.n < b.n ? -1 : 1));
}
const ssnRank = (t, club) => t.findIndex(r => r.n === club) + 1;

/* ---------- the end of a season ---------- */
const ssnOver = run => run.res.length >= ssnCtx(run).mine.length;
/* BOTTOM TWO GO DOWN, TOP TWO OF THE DIVISION BELOW COME UP. The other division's table comes from the seed too, so the right sides
   swap. The promotion places go past a reserve side */
function ssnMoves(run){
  const L = ssnLand(run), tt = ssnTable(ssnCtx(run, L.top), run.div === L.top ? run.res : ""), tl = ssnTable(ssnCtx(run, L.low), run.div === L.low ? run.res : "");
  return { tt, tl, down: tt.slice(-2).map(r => r.n), up: ssnCanRise(run.land, tl).slice(0, 2).map(r => r.n) };
}
const ssnCanRise = (land, rows) => rows.filter(r => !ssnTeam(land, r.n).of);
function ssnNextLists(run, M){
  M = M || ssnMoves(run);
  const top = run.top.filter(n => !M.down.includes(n)).concat(M.up), low = run.low.filter(n => !M.up.includes(n)).concat(M.down), L = ssnLand(run);
  return { top, low, div: top.includes(run.club) ? L.top : L.low };
}
function ssnRecord(run){
  const t = ssnTable(ssnCtx(run), run.res), i = t.findIndex(r => r.n === run.club), me = t[i], M = ssnMoves(run);
  return { id: run.id + ":" + run.y, run: run.id, y: run.y, club: run.club, land: run.land, div: run.div, pos: i + 1, of: t.length, p: me.p, w: me.w, d: me.d, l: me.l, gf: me.gf, ga: me.ga, pts: me.pts,
    lvl: run.lvl, mv: M.up.includes(run.club) ? "up" : M.down.includes(run.club) ? "down" : "", t: Date.now() };
}
/* a finished season goes in the book once, whichever way the phone got here. A league title goes on the Locker's shelf */
function ssnFile(s){
  const run = s.run, id = run.id + ":" + run.y;
  s.done = s.done || [];
  let rec = s.done.find(d => d.id === id);
  if(rec) return rec;
  rec = ssnRecord(run); s.done.push(rec);
  if(rec.pos === 1) try{ progTrophy("season", rec.div, ssnDiv(rec.div).name + " champions", "gold", true); }catch(e){}
  try{ tlmEvent("season_done", { div: rec.div, pos: rec.pos, pts: rec.pts, lvl: rec.lvl }); }catch(e){}
  return rec;
}
const ssnNewRun = (div, club, lvl, seed, id) => { const D = ssnDiv(div), L = SSN_DATA.lands[D.land], names = k => ssnDiv(k).sides.map(r => r.n);
  return { id: id || Date.now(), seed: seed == null ? Math.floor(Math.random() * 4294967296) : seed, land: D.land, club, lvl, y: SSN_FIRST, div, top: names(L.top), low: names(L.low), res: "", live: null, used: [] }; };

/* ---------- the questions ---------- */
const ssnId = r => r.id || r.q;
/* a level of one deck, end to end, with four options. Kept per deck object, so a re-tier that lands later is seen */
function ssnRowsOf(quiz, lvl){
  const deck = DECKS[quiz + "-mc"], k = quiz + "|" + lvl, c = SSN_ROWS.get(k);
  if(c && c.deck === deck) return c.rows;
  const tiers = (SSN_LEVELS.find(l => l[0] === lvl) || SSN_LEVELS[1])[2], rows = [];
  for(const t of tiers) for(const r of (deck && deck[t]) || []) if(Array.isArray(r.o) && r.o.length === 4 && r.k != null) rows.push(r);
  if(deck) SSN_ROWS.set(k, { deck, rows });
  return rows;
}
/* the division's own deck first, then the country's other one: a thin division tops up from its top flight, and the top flight
   gets the second tier's questions when it has been through its own */
function ssnDecks(run){
  const L = ssnLand(run), other = run.div === L.top ? L.low : L.top;
  return [run.div, other].map(d => ssnRowsOf(ssnDiv(d).quiz, run.lvl));
}
/* NEXT QUESTION. want: a club the question should be about (your opponent, your club), when one is left. Then anything left in the
   decks, in order. Never a question this run has asked, and never two with the same answer in a matchday, since one gives the other away.
   own: look for want in the first deck only. A top flight has plenty of its own and only goes next door when it has run out */
function ssnDeal(decks, used, want, taken, rnd, own){
  rnd = rnd || Math.random;
  const seen = new Set(used), answers = new Set((taken || []).map(a => String(a).toLowerCase()));
  const free = rows => rows.filter(r => !seen.has(ssnId(r)) && !answers.has(String(r.a).toLowerCase()));
  const pick = list => list[Math.floor(rnd() * list.length)];
  if(want) for(const rows of own ? decks.slice(0, 1) : decks){ const t = free(rows).filter(r => r.club === want); if(t.length) return pick(t); }
  for(const rows of decks){ const f = free(rows); if(f.length) return pick(f); }
  return null;
}
/* the three slots of a matchday: one about them, one about you, one open. A reserve side's questions are its first team's, so those aren't "about" it */
function ssnWant(ctx, m, i){
  const side = n => { const t = ssnTeam(ctx.land, n); return t.of ? null : t.s; };
  return i === 0 ? side(m.opp) : i === 1 ? side(ctx.club) : null;
}
const ssnDecksIn = run => { const L = ssnLand(run); return [L.top, L.low].every(d => DECKS[ssnDiv(d).quiz + "-mc"]); };
function ssnAskDecks(run){
  const L = ssnLand(run);
  for(const d of [L.top, L.low]){ needQuiz(ssnDiv(d).quiz); needPool(ssnDiv(d).pool); }
}

/* ---------- the pieces ---------- */
const SSN_BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
/* the table has twenty of these: what isn't drawn yet is filled in a slice per frame, so the page comes up at once */
function ssnPatch(slug, w){
  const px = w <= 20 ? 60 : w <= 40 ? 120 : w * 3, ready = !slug || crestCache.has(slug + "|patch|" + px), url = ready && slug ? crestURL(slug, "patch", px) : null;
  return '<img class="snp" width="' + w + '" height="' + Math.round(w * 7 / 6) + '" alt="" src="' + (url || SSN_BLANK) + '"' + (ready ? "" : ' data-snp="' + slug + '" data-px="' + px + '"') + '>';
}
function ssnFill(){
  let list; try{ list = [...document.querySelectorAll("img[data-snp]")]; }catch(e){ return; }
  const step = () => {
    const end = performance.now() + 9;
    while(list.length && performance.now() < end){ const im = list.shift(), u = crestURL(im.getAttribute("data-snp"), "patch", +im.getAttribute("data-px")); if(u) im.src = u; im.removeAttribute("data-snp"); }
    if(list.length) requestAnimationFrame(step);
  };
  step();
}
const ssnPatchOf = (land, n, w) => ssnPatch(ssnTeam(land, n).s, w);
const ssnFlag = (land, n) => { const s = ssnTeam(land, n).s; return s ? crestURL(s, "patch", 120) : null; };
const ssnCode = (land, n) => { const t = ssnTeam(land, n); return ((TEAMS[t.pool] || {})[n] || {}).abbr || (clubOf(t.s) || {}).code || n.slice(0, 3).toUpperCase(); };
const ssnPt = n => n + (n === 1 ? " pt" : " pts");
const ssnDivName = k => ssnDiv(k).short || ssnDiv(k).name;
const ssnColor = (land, n) => { const c = clubOf(ssnTeam(land, n).s) || {}; return (c.c1 === "#ffffff" ? c.c2 : c.c1) || "#123D24"; };
const ssnRule = run => { const L = ssnLand(run), top = ssnDiv(L.top).name, low = ssnDiv(L.low).name;
  return ssnIsTop(run) ? "Bottom two go down. Top two of the " + low + " come up." : "Top two go up to the " + top + ". Bottom two of the " + top + " come down." + (ssnDiv(run.div).sides.some(r => r.of) ? " Reserve sides can’t go up." : ""); };
/* a result, from your side: W, D or L */
const ssnWDL = y => y.gf > y.ga ? "w" : y.gf < y.ga ? "l" : "d";
function ssnForm(ctx, res, n){
  const out = [];
  for(let k = Math.max(0, res.length - (n || 5)); k < res.length; k++){ const y = ssnYours(ctx, ctx.mine[k], +res[k]), r = ssnWDL(y); out.push('<i class="' + r + '">' + r.toUpperCase() + '</i>'); }
  return '<span class="snform">' + out.join("") + '</span>';
}
const ssnScoreLine = (ctx, m, y) => { const h = m.home ? ctx.club : m.opp, a = m.home ? m.opp : ctx.club; return esc(h) + " " + (m.home ? y.gf : y.ga) + "–" + (m.home ? y.ga : y.gf) + " " + esc(a); };
/* THE TABLE: the house's dark card. Gold is you, the zones are a line down the left */
function ssnTableHTML(ctx, rows, run, o){
  o = o || {};
  const top = ssnIsTop(run), ups = new Set(ssnCanRise(ctx.land, rows).slice(0, 2).map(r => r.n)), n = rows.length;
  const zone = (r, i) => !rows[0].p ? "" : top ? (i === 0 ? " ch" : i >= n - 2 ? " dn" : "") : (ups.has(r.n) ? " up" : "");
  const shown = o.around != null ? rows.map((r, i) => [r, i]).filter(x => Math.abs(x[1] - Math.max(2, Math.min(n - 3, o.around))) <= 2) : rows.map((r, i) => [r, i]);
  const gd = r => { const v = r.gf - r.ga; return (v > 0 ? "+" : "") + v; };
  return '<div class="b4table sntable"><table><tr><th>#</th><th class="c">Club</th><th>P</th><th class="wdl">W</th><th class="wdl">D</th><th class="wdl">L</th><th>GD</th><th>Pts</th></tr>' +
    shown.map(([r, i]) => '<tr class="' + (zone(r, i) + (r.n === ctx.club ? " me" : "")).trim() + '"><td>' + (i + 1) + '</td><td class="c"><span class="nm">' + ssnPatchOf(ctx.land, r.n, 18) + '<em>' + esc(r.n) + '</em></span></td><td>' + r.p + '</td><td class="wdl">' + r.w + '</td><td class="wdl">' + r.d + '</td><td class="wdl">' + r.l + '</td><td>' + gd(r) + '</td><td><b>' + r.pts + '</b></td></tr>').join("") +
    '</table></div>';
}
function ssnBoard(ctx, m, gf, ga, pop){
  const h = m.home ? ctx.club : m.opp, a = m.home ? m.opp : ctx.club, gh = m.home ? gf : ga, ga2 = m.home ? ga : gf, you = m.home ? 0 : 1;
  const side = (n, me) => '<div class="snb-t' + (me ? " me" : "") + '">' + ssnPatchOf(ctx.land, n, 40) + '<b>' + esc(n) + '</b></div>';
  const num = (v, p) => '<b class="' + (p ? "pop" : "") + '">' + v + '</b>';
  return '<div class="snboard" role="img" aria-label="' + esc(h) + " " + gh + ", " + esc(a) + " " + ga2 + '">' + side(h, you === 0) + '<div class="snb-s">' + num(gh, pop === (you === 0 ? "you" : "them") || pop === "both") + '<i>–</i>' + num(ga2, pop === (you === 1 ? "you" : "them") || pop === "both") + '</div>' + side(a, you === 1) + '</div>';
}

/* ---------- the picker ---------- */
function ssnFav(){
  let f = null;
  try{ f = (acctLocal().fav || {}).club; }catch(e){}
  if(!f) try{ f = (mine().fav || {}).club; }catch(e){}
  if(!f) return null;
  for(const k of Object.keys(SSN_DATA.divisions)){ const D = ssnDiv(k), r = D.sides.find(x => x.s === f && !x.of); if(r) return { div: k, n: r.n, s: r.s }; }
  return null;
}
/* the sides on offer, the strongest first, your club before them all */
function ssnPickable(div){
  const D = ssnDiv(div), fav = ssnFav(), land = D.land;
  return D.sides.filter(r => !r.of).map(r => ssnTeam(land, r.n)).sort((a, b) => ((b.n === (fav && fav.n)) - (a.n === (fav && fav.n))) || b.pow - a.pow || a.pos - b.pos);
}
function ssnPickHTML(){
  const fav = ssnFav(), lands = Object.keys(SSN_DATA.lands).sort((a, b) => ((fav && ssnDiv(fav.div).land === b) ? 1 : 0) - ((fav && ssnDiv(fav.div).land === a) ? 1 : 0));
  const tile = k => { const D = ssnDiv(k); return '<button class="snlg" onclick="ssnPickDiv(\'' + k + '\')">' + compBadge(D.quiz, 46) + '<span><b>' + esc(D.name) + '</b><small>' + D.sides.length + ' clubs</small></span></button>'; };
  const hero = fav ? '<button class="snhero" onclick="ssnPickFav()">' + ssnPatch(fav.s, 58) + '<span><small>Your club</small><b>' + esc(fav.n) + '</b><em>' + esc(ssnDiv(fav.div).name) + '</em></span><i aria-hidden="true">›</i></button>' : "";
  return b4Page({ title: "Season", ctx: "Pick your league", back: "ssnBack()", cls: "snpage sn-pick", body:
    '<p class="snlead">A whole season with your club. The real table, promotion and relegation, three questions a matchday.</p>' + hero +
    lands.map(l => { const L = SSN_DATA.lands[l]; return '<div class="b6hdr snh">' + esc(L.name) + '</div><div class="snlgs">' + tile(L.top) + tile(L.low) + '</div>'; }).join("") });
}
function ssnClubHTML(){
  const D = ssnDiv(SSN_PICK.div), fav = ssnFav(), res = D.sides.filter(r => r.of);
  const was = r => r.in === SSN_PICK.div ? ssnOrd(r.pos) + " in " + SSN_DATA.table : r.tier === 1 ? "Came down" : "Came up";
  const tile = (r, i) => '<button class="sntile' + (fav && fav.n === r.n ? " fav" : "") + '" onclick="ssnPickClub(' + i + ')">' + ssnPatch(r.s, 34) + '<span><b>' + esc(r.n) + '</b><small>' + esc(was(r)) + '</small></span></button>';
  return b4Page({ title: "Season", ctx: ssnDivName(SSN_PICK.div) + " · pick your club", back: "ssnBack()", cls: "snpage sn-club", body:
    '<div class="sngrid">' + ssnPickable(SSN_PICK.div).map(tile).join("") + '</div>' +
    (res.length ? '<p class="snsmall">Reserve sides play but can’t go up, so they aren’t on the list.</p>' : "") });
}
function ssnLevelHTML(){
  const D = ssnDiv(SSN_PICK.div), r = ssnTeam(D.land, SSN_PICK.club), n = ssnPlaying(D.land, D.sides.map(x => x.n)).length, rounds = n % 2 ? n * 2 : (n - 1) * 2;
  const card = l => '<button class="snlvl" onclick="ssnStart(\'' + l[0] + '\')"><b>' + l[1] + '</b><small>' + esc(l[3]) + '</small></button>';
  return b4Page({ title: "Season", ctx: r.n, back: "ssnBack()", cls: "snpage sn-level", body:
    '<div class="snwho">' + ssnPatch(r.s, 62) + '<b>' + esc(r.n) + '</b><small>' + esc(D.name) + ' ' + ssnYear(SSN_FIRST) + '</small></div>' +
    '<div class="snrec three"><span><b>' + rounds + '</b>matchdays</span><span><b>' + SSN_Q + '</b>questions each</span><span><b>' + SSN_SECS + '</b>seconds each</span></div>' +
    '<p class="snlead">How hard should the questions be? It stays that way for the whole run.</p>' + SSN_LEVELS.map(card).join("") });
}

/* ---------- the hub ---------- */
function ssnHubHTML(){
  const s = seasonStore(), run = s.run, ctx = ssnCtx(run), res = run.res, k = res.length, m = ctx.mine[k], D = ssnDiv(run.div), t = ssnTable(ctx, res), last = k ? ctx.mine[k - 1] : null;
  const ready = ssnDecksIn(run), md = m.round + 1, live = run.live;
  const label = live ? "Carry on matchday " + md : "Play matchday " + md;
  const now = live ? ssnYoursSoFar(ctx, m, live) : null, you = ssnRank(t, run.club);
  const fix = '<div class="snnext"><div class="snnk"><span>Matchday ' + md + ' of ' + ctx.rounds.length + '</span><span>' + (m.home ? "Home" : "Away") + '</span></div>' +
    '<div class="snnm"><span class="me">' + ssnPatchOf(ctx.land, run.club, 52) + '<b>' + esc(run.club) + '</b></span><em>' + (now ? now.gf + "–" + now.ga : "v") + '</em><span>' + ssnPatchOf(ctx.land, m.opp, 52) + '<b>' + esc(m.opp) + '</b></span></div>' +
    '<div class="snnf">' + (k ? '<span class="snlast">' + ssnScoreLine(ctx, last, ssnYours(ctx, last, +res[k - 1])) + '</span>' + ssnForm(ctx, res) : '<span class="snlast">First match of the season. Three right can’t lose.</span>') + '</div></div>';
  return b4Page({ title: run.club, ctx: ssnDivName(run.div) + " " + ssnYear(run.y) + (k ? " · " + ssnOrd(you) : ""), back: "ssnClose()", cls: "snpage sn-hub", body:
    fix + (ready ? b4Btn(label, "ssnPlay()", "gold") : '<button class="b4btn gold" disabled>Loading the questions…</button>') +
    '<div class="b6hdr snh">' + (k ? "The table" : "Everybody starts on nothing") + '</div>' + ssnTableHTML(ctx, t, run) + ssnKey(run) +
    b4Btn("Your seasons", "ssnBook()", "dark") + b4Btn("Start over with another club", "ssnAskOver()", "quiet") });
}
const ssnKey = run => '<p class="snsmall key">' + esc(ssnRule(run)) + '</p>';
/* how a matchday you left stands */
function ssnYoursSoFar(ctx, m, live){
  let gf = 0, ga = 0;
  for(let i = 0; i < live.k; i++){ const ok = ssnBit(live.p, i); if(ok) gf++; ga += ssnTheirs(ctx, m, i, ok); }
  return { gf, ga };
}
function ssnAskOver(){
  audio();
  const s = seasonStore(), run = s.run;
  sheet('<h2>Start over?</h2><p>' + esc(run.club) + '’s ' + ssnYear(run.y) + ' season stops here and can’t be picked up again. Finished seasons stay in your history.</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep this season</button><button class="b4btn quiet" onclick="ssnOverGo()">Start over</button>');
}
function ssnOverGo(){ audio(); closeSheet(); SSN_PICK = { div: null, club: null }; SSN_VIEW = "pick"; render(); ssnTop(); }

/* ---------- the matchday ---------- */
function ssnPlay(){
  audio();
  const s = seasonStore(), run = s.run;
  if(!run || !SSN_DATA) return;
  if(!ssnDecksIn(run)){ ssnAskDecks(run); return toast("Those questions are still loading, give it a second", true); }
  const ctx = ssnCtx(run), m = ctx.mine[run.res.length];
  if(!m) return render();
  run.live = run.live || { k: 0, p: 0, open: 0, asked: [] };
  /* you left on a question: that third is a miss */
  if(run.live.open){ run.live.k++; run.live.open = 0; }
  try{ wakeLock(); }catch(e){}
  SN = { ctx, m, y: run.y, q: null, shown: false, pick: null, say: "", pop: null, left: SSN_SECS };
  seasonSave(s);
  SSN_VIEW = "play";
  if(run.live.k >= SSN_Q) return ssnWhistle();
  ssnAsk();
}
/* the next third: a question dealt and on the save before you see it */
function ssnAsk(){
  const s = seasonStore(), run = s.run, ctx = SN.ctx, i = run.live.k, decks = ssnDecks(run), want = ssnWant(ctx, SN.m, i);
  const top = ssnIsTop(run);
  let Q = ssnDeal(decks, run.used, want, run.live.asked, null, top);
  if(!Q){ run.used = []; Q = ssnDeal(decks, run.used, want, run.live.asked, null, top) || ssnDeal(decks, run.used, null, []); }   // the decks have run out: round again
  if(!Q) return toast("We’re short of questions here. Try another level.", true);
  run.used.push(ssnId(Q)); run.live.asked.push(Q.a); run.live.open = 1;
  seasonSave(s);
  const y = ssnYoursSoFar(ctx, SN.m, run.live);
  Object.assign(SN, { q: Q, i, shown: false, pick: null, say: "", pop: null, left: SSN_SECS, gf: y.gf, ga: y.ga, pat: run.live.p, about: Q.club && Q.club === want ? (i === 0 ? SN.m.opp : run.club) : null });
  render();
  ssnTop();
  startTimer(SSN_SECS, ssnTimeUp, "season:" + run.y + ":" + SN.m.round + ":" + i);
}
const ssnPlayKey = () => SN.m.round + "-" + SN.i + (SN.shown ? "s" : "q");
function ssnPlayHTML(){
  const ctx = SN.ctx, m = SN.m, Q = SN.q, shown = SN.shown, D = ssnDiv(ctx.div);
  const pip = i => { const done = i < SN.i + (shown ? 1 : 0); return '<i class="' + (done ? (ssnBit(SN.pat, i) ? "hit" : "miss") : i === SN.i ? "cur" : "") + '"></i>'; };
  const opts = Q.o.map((t, i) => '<button class="h2opt' + (shown ? (i === Q.k ? " right" : i === SN.pick ? " wrong" : " dim") : "") + '"' + (shown ? " disabled" : "") + ' onclick="ssnAnswer(' + i + ')"><span class="k">' + "ABCD"[i] + '</span>' + esc(String(t)) + '</button>').join("");
  return b4Page({ title: "Matchday " + (m.round + 1), ctx: ssnDivName(ctx.div) + " " + ssnYear(SN.y), back: "ssnAskLeave()", leave: "ssnAskLeave()", cls: "snpage sn-play", body:
    '<span hidden data-snk="' + ssnPlayKey() + '"></span>' + ssnBoard(ctx, m, SN.gf, SN.ga, SN.pop) +
    '<div class="snbar"><div class="snpips" role="img" aria-label="Question ' + (SN.i + 1) + ' of ' + SSN_Q + '">' + [0, 1, 2].map(pip).join("") + '</div>' +
      (shown ? '<div class="clock snclock snstop"><div class="bar"><i style="width:' + Math.round(100 * Math.max(0, SN.left) / SSN_SECS) + '%"></i></div><div class="digits">' + Math.max(0, SN.left).toFixed(1) + '</div></div>'
        : '<div class="clock snclock" id="clock" role="timer"><div class="bar"><i style="width:100%"></i></div><div class="digits">' + SSN_SECS + '.0</div></div>') + '</div>' +
    '<div class="qcard snq' + (shown ? "" : " qin") + '"><div class="snabout">' + (SN.about ? "About " + esc(SN.about) : "Question " + (SN.i + 1) + " of " + SSN_Q) + '</div><div class="qtext">' + esc(String(Q.q)) + '</div><div class="snopts">' + opts + '</div></div>' +
    '<div class="snsay" role="status">' + esc(SN.say) + '</div>' });
}
function ssnAnswer(i){
  if(!SN || SN.shown) return;
  audio();
  SN.left = Math.max(0, (T.deadline - performance.now()) / 1000);
  stopTimer();
  ssnReveal(i);
}
function ssnTimeUp(){ if(!SN || SN.shown) return; SN.left = 0; stopTimer(); ssnReveal(-1); }
/* what the third did to the score, in a line */
function ssnSayThird(ok, timeUp, them, opp, ev){
  const you = ev.find(e => e.you);
  if(ok) return (you && you.who ? "Goal! " + you.who + ", " + you.min + "’." : "Goal!") + (them ? " And " + opp + " hit straight back." : "");
  const miss = timeUp ? "Out of time." : "Wide.";
  return miss + (them > 1 ? " " + opp + " score twice." : them ? " " + opp + " score at the other end." : " " + opp + " can’t punish it.");
}
function ssnReveal(i){
  const s = seasonStore(), run = s.run, Q = SN.q, ok = i === Q.k, third = SN.i, ctx = SN.ctx, m = SN.m;
  if(ok) run.live.p |= 1 << third;
  run.live.k = third + 1; run.live.open = 0;
  seasonSave(s);
  const them = ssnTheirs(ctx, m, third, ok);
  SN.shown = true; SN.pick = i; SN.pat = run.live.p;
  if(ok) SN.gf++;
  SN.ga += them;
  /* the rows carry no tier here, so the XP follows the level chosen for the run */
  try{ progAnswer({ ok, tier: run.lvl === "hard" || run.lvl === "easy" ? run.lvl : "normal", topic: topicKey(ssnDiv(run.div).quiz) || "general" }); }catch(e){}
  SN.pop = ok ? (them ? "both" : "you") : them ? "them" : null;
  SN.say = ssnSayThird(ok, i < 0, them, m.opp, ssnEvents(ctx, m, run.live.p, third + 1).filter(e => e.third === third));
  try{ if(ok) fb.correct(null); else if(i >= 0) fb.wrong(null); else fb.run = 0; }catch(e){}
  try{ a11ySay(SN.say); }catch(e){}
  render();
  clearTimeout(SSN_TIMER);
  SSN_TIMER = setTimeout(ssnAdvance, ok ? SSN_RIGHT_MS : SSN_WRONG_MS);
}
function ssnAdvance(){
  clearTimeout(SSN_TIMER);
  if(!SN || !SN.shown) return;
  const run = seasonStore().run;
  if(run.live.k >= SSN_Q) return ssnWhistle();
  ssnAsk();
}
function ssnAskLeave(){
  audio();
  if(SN && SN.shown) return;   // the answer is landing: a moment, and it's the next question or full time
  sheet('<h2>Leave the match?</h2><p>The question on the screen counts as a miss. The rest of the matchday waits for you.</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep playing</button><button class="b4btn quiet" onclick="ssnLeave()">Leave</button>');
}
function ssnLeave(){ audio(); stopTimer(); closeSheet(); SN = null; SSN_VIEW = "hub"; render(); ssnTop(); }

/* ---------- full time ---------- */
function ssnWhistle(){
  clearTimeout(SSN_TIMER); stopTimer();
  try{ progSave(progLoad()); }catch(e){}
  const s = seasonStore(), run = s.run, ctx = ssnCtx(run), k = run.res.length, m = ctx.mine[k], pat = run.live.p;
  const before = k ? ssnRank(ssnTable(ctx, run.res), run.club) : 0;
  run.res += String(pat); run.live = null;
  const over = ssnOver(run), rec = over ? ssnFile(s) : null;
  seasonSave(s);
  /* the table straight after this round, whatever comes next */
  const after = ssnRank(ssnTable(ctx, run.res, m.round + 1), run.club), y = ssnYours(ctx, m, pat);
  SND = { k, m, pat, y, before, after, over, rec, gap: ssnGap(ctx, k) };
  SN = null; SSN_VIEW = "full";
  render();
  ssnTop();
  if(y.gf > y.ga) try{ if(ssnRights(pat) === SSN_Q) ching(); haptic("goal"); }catch(e){}
}
/* the rounds you sit out after this match, in a division with a bye */
const ssnGap = (ctx, k) => { const n = ctx.mine[k + 1]; return n ? n.round - ctx.mine[k].round - 1 : ctx.rounds.length - 1 - ctx.mine[k].round; };
function ssnVerdict(y, r, opp){
  if(r === SSN_Q) return y.gf > y.ga ? "All three right. Nobody beats that." : "All three right, and " + opp + " still got a point. They are that good.";
  if(y.gf > y.ga) return r === 1 ? "One right, one goal, and it held." : "Two right, and that was enough.";
  if(y.gf === y.ga) return r ? "A point. One more right and it was three." : "Nothing right and you still got a point. Take it.";
  return r ? (SSN_Q - r === 1 ? "One wrong answer was all " + opp + " needed." : (SSN_Q - r) + " wrong answers gave " + opp + " the game.") : "Nothing right, and " + opp + " made you pay.";
}
function ssnFullHTML(){
  const D = SND, run = seasonStore().run, ctx = ssnCtx(run), m = D.m, y = D.y, h = m.home ? ctx.club : m.opp, a = m.home ? m.opp : ctx.club;
  const score = b4Score({ home: { name: h, short: ssnCode(ctx.land, h), color: ssnColor(ctx.land, h), flag: ssnFlag(ctx.land, h) }, away: { name: a, short: ssnCode(ctx.land, a), color: ssnColor(ctx.land, a), flag: ssnFlag(ctx.land, a) }, score: [m.home ? y.gf : y.ga, m.home ? y.ga : y.gf], label: "Full time · matchday " + (m.round + 1) });
  const ev = ssnEvents(ctx, m, D.pat), n = run.res.length, next = ctx.mine[n];
  const line = e => '<span class="' + (e.you ? "you" : "") + '"><b>' + e.min + '’</b>' + esc(e.who || (e.you ? ctx.club : m.opp)) + '</span>';
  const others = ctx.rounds[m.round].filter(x => x[0] !== ctx.club && x[1] !== ctx.club);
  const res = x => { const g = ssnAiScore(ctx, m.round, x); return '<div class="snr"><span>' + esc(x[0]) + '</span><b>' + g[0] + '–' + g[1] + '</b><span>' + esc(x[1]) + '</span></div>'; };
  const t = ssnTable(ctx, run.res, m.round + 1), moved = D.before ? D.before - D.after : 0;
  const mv = !D.before || !moved ? "" : '<em class="' + (moved > 0 ? "up" : "dn") + '">' + (moved > 0 ? "Up " : "Down ") + Math.abs(moved) + '</em>';
  const gold = D.over ? b4Btn("See the final table", "ssnEnd()", "gold") : b4Btn("Play matchday " + (next.round + 1), "ssnPlay()", "gold");
  return b4Page({ title: "Matchday " + (m.round + 1), ctx: ssnDivName(ctx.div) + " " + ssnYear(run.y), back: "ssnBackFull()", score, cls: "snpage sn-full", body:
    '<p class="snverdict">' + esc(ssnVerdict(y, ssnRights(D.pat), m.opp)) + '</p>' +
    (ev.length ? '<div class="sngoals">' + ev.map(line).join("") + '</div>' : "") + gold +
    (D.gap > 0 && !D.over ? '<p class="snsmall">You sit out matchday ' + (m.round + 2) + (D.gap > 1 ? " and the next" : "") + '. Your division has an odd number of sides.</p>' : "") +
    '<div class="snwhere"><b>' + ssnOrd(D.after) + '</b>' + mv + '<span>' + ssnPt(ssnPts(t, ctx.club)) + '</span></div>' + ssnTableHTML(ctx, t, run, { around: D.after - 1 }) +
    (others.length ? '<div class="b6hdr snh">The rest of the round</div><div class="snrs">' + others.map(res).join("") + '</div>' : "") +
    (D.over ? "" : b4Btn("The whole table", "ssnBackFull()", "dark")) });
}
const ssnPts = (t, n) => (t.find(r => r.n === n) || {}).pts | 0;
function ssnBackFull(){ if(SND && SND.over) return ssnEnd(); audio(); SND = null; SSN_VIEW = "hub"; render(); ssnTop(); }

/* ---------- the end of the season ---------- */
function ssnEnd(){
  audio();
  const s = seasonStore(), run = s.run;
  if(!run || !ssnOver(run)) return;
  const rec = ssnFile(s); seasonSave(s);
  SND = null; SSN_VIEW = "end"; render(); ssnTop();
  ssnMoment(rec);
}
const ssnKind = rec => rec.pos === 1 ? "title" : rec.mv === "up" ? "up" : rec.mv === "down" ? "down" : "";
/* the words of a season's end, for the page and the moment */
function ssnWords(rec){
  const D = ssnDiv(rec.div), K = ssnKind(rec), T = SSN_DATA.lands[rec.land], other = rec.div === T.top ? ssnDiv(T.low).name : ssnDiv(T.top).name;
  if(K === "title" && rec.mv === "up") return [D.name + " champions", "Champions, and up to the " + other + "."];
  if(K === "title") return [D.name + " champions", "Nobody finished above " + rec.club + "."];
  if(K === "up") return ["Promoted", ssnOrd(rec.pos) + " in the " + D.name + ". " + rec.club + " are going up to the " + other + "."];
  if(K === "down") return ["Relegated", ssnOrd(rec.pos) + " in the " + D.name + ". " + rec.club + " are going down to the " + other + "."];
  return ["Season over", ssnOrd(rec.pos) + " in the " + D.name + ". Same division next year."];
}
function ssnEndHTML(){
  const s = seasonStore(), run = s.run, ctx = ssnCtx(run), M = ssnMoves(run), rec = s.done.find(d => d.id === run.id + ":" + run.y), t = ssnTable(ctx, run.res), W = ssnWords(rec), next = ssnYear(run.y + 1);
  const score = b4Score({ home: { name: run.club, color: ssnColor(ctx.land, run.club), flag: ssnFlag(ctx.land, run.club) }, score: ssnOrd(rec.pos), label: ssnDivName(run.div) + " " + ssnYear(run.y) });
  const rec5 = [[rec.pts, "pts"], [rec.w, "won"], [rec.d, "drawn"], [rec.l, "lost"], [rec.gf + "–" + rec.ga, "goals"]];
  return b4Page({ title: "Final table", ctx: run.club + " " + ssnYear(run.y), back: "ssnClose()", score, cls: "snpage sn-end", body:
    b4Q(esc(W[0]), esc(W[1])) + '<div class="snrec">' + rec5.map(x => '<span><b>' + x[0] + '</b>' + x[1] + '</span>').join("") + '</div>' +
    b4Btn("Start " + next, "ssnNext()", "gold") + b4Btn("Share", "ssnShare()", "dark") +
    '<div class="snswap"><p><b>Going up</b>' + esc(M.up.join(", ")) + '</p><p><b>Going down</b>' + esc(M.down.join(", ")) + '</p></div>' + ssnKey(run) + ssnTableHTML(ctx, t, run) +
    b4Btn("Your seasons", "ssnBook()", "quiet") });
}
/* THE MOMENT: a title, going up, going down. In front of everything, and the final table stays behind it */
function ssnMoment(rec){
  const K = ssnKind(rec);
  if(!K) return;
  try{
    const W = ssnWords(rec), t = ssnTeam(rec.land, rec.club), o = document.createElement("div");
    o.className = "pgmoment snmoment " + (K === "title" ? "title" : K === "up" ? "promo" : "down");
    o.innerHTML = '<div class="pgm-in"><div class="snstrike">' + (K === "down" ? "" : '<i class="snrays" aria-hidden="true"></i>') + ssnPatch(t.s, 120) + '</div><span class="pgm-k">' + esc(rec.club) + ' ' + ssnYear(rec.y) + '</span><h2>' + esc(W[0]) + '</h2><p>' + esc(W[1]) + ' ' + rec.pts + (rec.pts === 1 ? " point" : " points") + '.</p>' +
      (K === "down" ? "" : '<button class="b6cta" onclick="ssnShare()">Share</button>') + '<button class="' + (K === "down" ? "b6cta" : "b6dark") + '" onclick="ssnMomentClose(this)">See the table</button></div>';
    document.body.appendChild(o);
    ssnFill();
    requestAnimationFrame(() => o.classList.add("on"));
    if(K === "title"){ celebrate(4, { type: "seasonTitle", n: 170 }); slamfx(); haptic("goal"); }
    else if(K === "up"){ celebrate(3, { type: "seasonUp", n: 90 }); ching(); }
  }catch(e){}
}
function ssnMomentClose(btn){ audio(); const o = btn.closest(".pgmoment"); if(o){ o.classList.remove("on"); setTimeout(() => o.remove(), 260); } }
/* THE NEXT SEASON: the same club, in the new division if it moved, and the sides swapped */
function ssnNext(){
  audio();
  const s = seasonStore(), run = s.run;
  if(!run || !ssnOver(run)) return;
  ssnFile(s);
  const N = ssnNextLists(run);
  Object.assign(run, { top: N.top, low: N.low, div: N.div, y: run.y + 1, res: "", live: null });
  seasonSave(s);
  ssnClearMoments();
  SND = null; SSN_VIEW = "hub"; render(); ssnTop();
}
const ssnClearMoments = () => { try{ document.querySelectorAll(".snmoment").forEach(e => e.remove()); }catch(e){} };

/* ---------- your seasons ---------- */
function ssnBook(){ audio(); SSN_VIEW = "book"; render(); ssnTop(); }
function ssnBookHTML(){
  const s = seasonStore(), list = (s.done || []).slice().sort((a, b) => (b.t || 0) - (a.t || 0)), titles = list.filter(d => d.pos === 1).length, ups = list.filter(d => d.mv === "up").length;
  const row = d => '<button class="snbook' + (d.pos === 1 ? " won" : "") + '" onclick="ssnShare(\'' + d.id + '\')" aria-label="Share ' + esc(ssnShareText(d).split("\n")[0]) + '">' + ssnPatchOf(d.land, d.club, 30) +
    '<span class="m"><b>' + esc(d.club) + '</b><small>' + esc(ssnDiv(d.div).name) + ' ' + ssnYear(d.y) + '</small></span><span class="r"><b>' + ssnOrd(d.pos) + '</b><small>' + ssnPt(d.pts) + (d.mv === "up" ? " · up" : d.mv === "down" ? " · down" : "") + '</small></span></button>';
  return b4Page({ title: "Your seasons", ctx: list.length ? list.length + (list.length === 1 ? " season" : " seasons") : "None yet", back: "ssnBack()", cls: "snpage sn-book", body:
    (list.length ? '<div class="snrec three"><span><b>' + list.length + '</b>' + (list.length === 1 ? "season" : "seasons") + '</span><span class="g"><b>' + titles + '</b>' + (titles === 1 ? "title" : "titles") + '</span><span><b>' + ups + '</b>' + (ups === 1 ? "promotion" : "promotions") + '</span></div>' + list.map(row).join("")
      : '<p class="snlead">Finish a season and it goes in here, with every title you win.</p>') });
}

/* ---------- the share ---------- */
function ssnShareText(d){
  return "BALL · Season: " + d.club + " finished " + ssnOrd(d.pos) + " in the " + ssnDiv(d.div).name + " " + ssnYear(d.y) + ", " + ssnPt(d.pts) + (d.pos === 1 ? ". Champions." : d.mv === "up" ? ". Promoted." : d.mv === "down" ? ". Relegated." : "") + "\nballquiz.app";
}
function ssnShare(id){
  audio();
  const s = seasonStore(), d = id ? (s.done || []).find(x => x.id === id) : (s.done || []).slice().sort((a, b) => (b.t || 0) - (a.t || 0))[0];
  if(!d) return;
  try{ tlmEvent("share", { what: "season" }); }catch(e){}
  const text = ssnShareText(d);
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}

/* ---------- getting about ---------- */
function ssnTop(){ try{ window.scrollTo(0, 0); }catch(e){} }
function ssnPickDiv(k){ audio(); try{ haptic("select"); }catch(e){} SSN_PICK = { div: k, club: null }; SSN_VIEW = "club"; render(); ssnTop(); }
function ssnPickClub(i){ audio(); try{ haptic("select"); }catch(e){} SSN_PICK.club = ssnPickable(SSN_PICK.div)[i].n; SSN_VIEW = "level"; render(); ssnTop(); }
function ssnPickFav(){ const f = ssnFav(); if(!f) return; audio(); SSN_PICK = { div: f.div, club: f.n }; SSN_VIEW = "level"; render(); ssnTop(); }
/* a season starts: on the save at once, and the only way a run is replaced */
function ssnStart(lvl){
  audio();
  if(!SSN_PICK.div || !SSN_PICK.club) return;
  const s = seasonStore();
  s.run = ssnNewRun(SSN_PICK.div, SSN_PICK.club, lvl);
  seasonSave(s);
  ssnAskDecks(s.run);
  SSN_PICK = { div: null, club: null }; SND = null; SSN_VIEW = "hub";
  render(); ssnTop();
}
function ssnClose(){
  clearTimeout(SSN_TIMER); stopTimer(); ssnClearMoments();
  SSN_VIEW = null; SN = null; SND = null;
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function ssnBack(){
  audio();
  const run = seasonStore().run;
  if(SSN_VIEW === "level"){ SSN_VIEW = SSN_PICK.div ? "club" : "pick"; render(); return; }
  if(SSN_VIEW === "club"){ SSN_VIEW = "pick"; render(); try{ feelScrollBack("season:pick"); }catch(e){} return; }
  if((SSN_VIEW === "pick" || SSN_VIEW === "book") && run){ SSN_VIEW = "hub"; render(); return; }
  ssnClose();
}

/* ---------- the screen ---------- */
function ssnRender(st){
  /* a deck landing while a question is up calls render(): the question stays where it is, focus and clock with it */
  if(SSN_VIEW === "play" && SN && SN.q){ try{ if(st.querySelector("[data-snk='" + ssnPlayKey() + "']")){ b6Paper(true); return; } }catch(e){} }
  if(!SSN_DATA){ ssnLoad(); st.innerHTML = b4Page({ title: "Season", ctx: "One moment", back: "ssnClose()", cls: "snpage" }); return; }
  const run = seasonStore().run;
  if(run) ssnAskDecks(run);
  if(SSN_VIEW === "play" && !(SN && SN.q)) SSN_VIEW = "hub";
  if(SSN_VIEW === "full" && !SND) SSN_VIEW = "hub";
  if(SSN_VIEW === "hub" && !run) SSN_VIEW = "pick";
  if(SSN_VIEW === "hub" && ssnOver(run)) SSN_VIEW = "end";
  if(SSN_VIEW === "end" && !(run && ssnOver(run))) SSN_VIEW = run ? "hub" : "pick";
  if(SSN_VIEW === "club" && !SSN_PICK.div) SSN_VIEW = "pick";
  if(SSN_VIEW === "level" && !SSN_PICK.club) SSN_VIEW = "pick";
  /* a season that finished on another phone: it goes in the book before the page reads it */
  if(SSN_VIEW === "end"){ const s = seasonStore(), n = (s.done || []).length; ssnFile(s); if(s.done.length !== n) seasonSave(s); }
  st.innerHTML = SSN_VIEW === "play" ? ssnPlayHTML() : SSN_VIEW === "full" ? ssnFullHTML() : SSN_VIEW === "end" ? ssnEndHTML() : SSN_VIEW === "hub" ? ssnHubHTML() : SSN_VIEW === "book" ? ssnBookHTML()
    : SSN_VIEW === "club" ? ssnClubHTML() : SSN_VIEW === "level" ? ssnLevelHTML() : ssnPickHTML();
  ssnFill();
  if(!CLUBID) setTimeout(() => { if(SSN_VIEW && SSN_VIEW !== "play") render(); }, 600);
  if(SSN_VIEW === "hub" && !ssnDecksIn(run) && SSN_TRIES < 30){ SSN_TRIES++; setTimeout(() => { if(SSN_VIEW === "hub") render(); }, 700); }
}
