/* BALL 4 · CALL IT: THE MATCHDAY QUIZ (_plans/games-round.md round 1; _plans/call-it/03-game-design.md §5).

   Six multiple-choice questions about the clubs on this round's card, as a warm-up: one Easy, three Normal, two Hard.
   Loaded by pl.js the first time Call It's front or your calls is drawn, after the screens; a phone without this file
   simply has no quiz, and everything else in Call It works as it did.

   THE SAME SIX FOR EVERYONE IN THE ROUND, so mates can compare. Nothing here is random: a club, a match and a question
   each get a rank from the round's name (series:season:seq) and their own id, the same on every phone, whatever order
   the server listed the matches in and whatever order the decks arrived in. Adding a question to a deck can only change
   a round's six if the new one ranks first. Every match on the round counts (a postponed one too, so a match moved on
   Saturday doesn't change the six of the mate who played on Friday).

   ONE CLUB A QUESTION, ONE MATCH BEFORE ITS OPPONENT (qzOrder), from assets/q/club-<slug>.json. A card with few or no
   club views (Ligue 1, a Champions League round with clubs from elsewhere) reaches six with the competition's own deck
   (QZ_DECK, the fixture's comp); then a second question from a club; then the tier next door. If six still can't be
   found the quiz isn't offered that round. A file that can't load means no quiz either, never a different six and
   never an error: the card just doesn't appear, and a later draw tries again.

   NEVER TABLE POINTS, AND NOTHING LOCKS BEHIND IT. This file doesn't talk to the server at all: no pl_quiz_played, the
   armband stays free (armband_needs_quiz stays off). Comparing scores in a league's table is a later step.

   ONE PLAY PER ROUND. ball4-pl-quiz is {card id: {s: "10110", t: started, d: finished}}, one mark per question, written
   as the answer is tapped, so leaving half-way carries on where you were and a wrong answer can't be taken back. It
   follows you (assets/sync/sync.js: the first finished result stands) and goes with the account on sign-out
   (FYC_STASH_KEYS).

   Copy rule (06-ux.md): no gambling words, on screen or in a question: QZ_WORDS leaves those rows out of the deal. */

const QZ_KEY = "ball4-pl-quiz", QZ_CAP = 300, QZ_N = 6;
const QZ_SLOTS = ["easy", "normal", "normal", "normal", "hard", "hard"];
const QZ_NEAR = { easy: ["normal"], normal: ["easy", "hard"], hard: ["extreme", "normal"] };
const QZ_TIER = { easy: "Easy", normal: "Normal", hard: "Hard", extreme: "Hard" };
/* a competition's own deck, assets/q/<id>.json */
const QZ_DECK = { "fb.DED": "eredivisie", "fb.PL": "premier", "fb.CL": "ucl", "fb.PD": "laliga", "fb.SA": "seriea", "fb.BL1": "bundesliga",
  "fb.FL1": "ligue1", "fb.NL2": "eerste", "fb.BE1": "belgian", "fb.ELC": "championship", "fb.PPL": "primeira", "fb.SPL": "scotland",
  "fb.TSL": "superlig", "fb.EL": "uel", "fb.ECL": "uecl", "fb.SSL": "swiss", "fb.AUT": "austria", "fb.DEN": "denmark" };
/* the names a fixture can carry that neither of the bank's names nor its slug reach (the feed's, or assets/pl/teams.json's
   short one), clubNorm'd. _tests/pl-quiz-test.js holds this against every team name in the repo */
const QZ_ALIAS = { manunited: "manchester-united", mancity: "manchester-city", leeds: "leeds-united", coventry: "coventry-city",
  bayern: "bayern-munchen", dortmund: "borussia-dortmund", leverkusen: "bayer-leverkusen", fsvmainz05: "mainz-05", sparta: "sparta-rotterdam",
  deportivo: "deportivo-la-coruna", heartofmidlothian: "hearts", sttruiden: "sint-truidense", skbeveren: "beveren",
  unionstgilloise: "union-saint-gilloise", clubbruggekv: "club-brugge" };
const QZ_WORDS = /\b(bet|bets|betting|bookmakers?|bookies?|gambl\w*|tip|tips|odds|stake|stakes|banker|punt|punter|accumulator|wager\w*)\b/i;

var QZ = { names: null, decks: {}, offers: {} };

/* ---------- the pure part: names, ranks, the six ---------- */
function qzRank(s){
  let h = 2166136261;
  for(let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return seeded(h)();
}
const qzRanked = (seed, list, id) => list.map(x => [qzRank(seed + "|" + id(x)), id(x), x]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)).map(x => x[2]);
/* assets/q/clubs.json's clubs, by every name each of them goes by */
function qzNames(list){
  const o = {};
  (list || []).forEach(c => [c.s, c.n, c.t].forEach(x => { const k = clubNorm(x); if(k) o[k] = c; }));
  return o;
}
/* a fixture's team {key, name} → its row in clubs.json, or null. Names only: teams.json's slug is a colour, not a club
   (Jong PSV and FC Eindhoven both wear PSV's) */
function qzClubOf(names, t, short){
  for(const x of [t && t.name, short]){
    const k = clubNorm(x), c = names[k] || names[clubNorm(QZ_ALIAS[k])];
    if(k && c) return c;
  }
  return null;
}
const qzShort = t => ((typeof CL !== "undefined" && CL.teams) || {})[t && t.key] || {};
/* the card's clubs in the round's order: one from each match first, then their opponents. A club with no questions
   (Frosinone) isn't one, and a club on the card twice (a league's own week) counts once */
function qzOrder(seed, names, fixtures){
  const pairs = {};
  (fixtures || []).forEach(f => {
    const P = [f.home, f.away].map(t => { const c = qzClubOf(names, t, qzShort(t).n); return c && (c.hp + c.en) > 0 ? { c, team: t } : null; }).filter(Boolean);
    if(P.length) pairs[P.map(x => x.c.s).sort().join("+")] = P;
  });
  const first = [], then = [];
  qzRanked(seed, Object.keys(pairs), x => x).forEach(id => {
    const P = qzRanked(seed, pairs[id], x => x.c.s);
    first.push(P[0]); if(P[1]) then.push(P[1]);
  });
  const seen = {};
  return first.concat(then).filter(x => seen[x.c.s] ? false : (seen[x.c.s] = true));
}
/* a row the quiz may ask: four answers, the right one among them once, not a word of gambling */
function qzOk(r){
  return !!r && !!r.q && !!r.a && Array.isArray(r.o) && r.o.length === 4 && r.k >= 0 && r.k < 4 && r.o[r.k] === r.a && new Set(r.o).size === 4 &&
    !QZ_WORDS.test([r.q, r.a, r.sub].concat(r.o).join(" "));
}
/* THE DEAL. clubs and comps are [{from, team|comp, deck: its id, mc: {tier: rows}, names}], clubs in qzOrder's order. Fills the
   slots one source at a time, in the order that keeps the quiz about this card. With comps left out (null) it stops
   after the first pass, so a caller can see if the clubs it has so far are enough. Six rows, or null. */
function qzPick(seed, clubs, comps){
  const six = QZ_SLOTS.map(() => null), asked = new Set(), said = new Set(), used = new Set();
  const take = (i, src, tier) => {
    for(const r of qzRanked(seed + ":" + src.deck + ":" + tier, ((src.mc || {})[tier] || []).filter(qzOk), x => x.id || x.q)){
      if(asked.has(r.id) || asked.has(clubNorm(r.q)) || said.has(clubNorm(r.a))) continue;
      if((src.names || []).some(n => clubNorm(r.a).includes(n))) continue;      /* the card says the club: not when the club is the answer */
      asked.add(r.id); asked.add(clubNorm(r.q)); said.add(clubNorm(r.a)); used.add(src.deck);
      six[i] = Object.assign({ tier, from: src.from, team: src.team || null, comp: src.comp || null, deck: src.deck }, r);
      return true;
    }
    return false;
  };
  const fill = (srcs, tiersOf) => six.forEach((x, i) => {
    if(x) return;
    for(const tier of tiersOf(QZ_SLOTS[i])) for(const s of srcs()) if(take(i, s, tier)) return;
  });
  const fresh = () => clubs.filter(c => !used.has(c.deck));
  fill(fresh, t => [t]);                                     /* one question a club */
  if(six.every(Boolean)) return six;
  if(!comps) return null;
  fill(() => comps, t => [t]);                               /* the competition's own deck */
  fill(() => clubs, t => [t]);                               /* a second one from a club */
  fill(() => clubs.concat(comps), t => QZ_NEAR[t]);          /* the tier next door */
  return six.every(Boolean) ? six : null;
}
/* the competitions on the card, the one with the most matches first */
function qzComps(fixtures){
  const n = {};
  (fixtures || []).forEach(f => { if(QZ_DECK[f.comp]) n[f.comp] = (n[f.comp] || 0) + 1; });
  return Object.keys(n).sort((a, b) => n[b] - n[a] || (a < b ? -1 : 1));
}

/* ---------- the phone ---------- */
const qzAll = () => { try{ return JSON.parse(localStorage.getItem(QZ_KEY)) || {}; }catch(e){ return {}; } };
function qzPut(id, e){
  const a = qzAll();
  a[id] = e;
  const ks = Object.keys(a).sort((x, y) => x - y);
  ks.slice(0, Math.max(0, ks.length - QZ_CAP)).forEach(k => { delete a[k]; });
  try{ localStorage.setItem(QZ_KEY, JSON.stringify(a)); }catch(e2){}
}
const qzMine = id => qzAll()[id] || null;
const qzDone = e => !!e && !!e.d;
const qzMarks = e => String((e && e.s) || "");
const qzScore = e => qzMarks(e).replace(/[^1]/g, "").length;

/* ---------- the decks ---------- */
const qzJSON = f => fetch(f).then(r => r.ok ? r.json() : null).catch(() => null);
function qzDeck(id){
  if(QZ.decks[id]) return Promise.resolve(QZ.decks[id]);
  return qzJSON("assets/q/" + id + ".json").then(b => {
    if(!b) return null;
    return (QZ.decks[id] = bankDecks(b).mc);
  });
}
const qzSeed = k => clStr(k.card.series) + ":" + clStr(k.card.season) + ":" + clStr(k.card.seq);
const qzCompName = id => { const C = (typeof CL_COMPS !== "undefined" ? CL_COMPS : []).find(x => x.id === id); return C ? C.name : ""; };
/* six rows and what the card says, or null when six can't be found. undefined: a file didn't load, nothing is known */
async function qzBuild(k){
  if(!Object.keys(CL.teams || {}).length) return undefined;  /* the names on the card aren't all here: a phone without them would deal another six */
  if(!QZ.names){
    const j = await qzJSON("assets/q/clubs.json");
    if(!j || !Array.isArray(j.clubs)) return undefined;
    QZ.names = qzNames(j.clubs);
  }
  const seed = qzSeed(k), F = k.fixtures || [], order = qzOrder(seed, QZ.names, F), clubs = [];
  let six = null;
  for(let n = 0; n < order.length && !six; ){
    const more = order.slice(n, n += QZ_N), got = await Promise.all(more.map(x => qzDeck("club-" + x.c.s)));
    if(got.some(d => !d)) return undefined;
    more.forEach((x, i) => clubs.push({ from: x.c.n, team: x.team, deck: "club-" + x.c.s, mc: got[i], names: [clubNorm(x.c.n), clubNorm(x.c.t)] }));
    six = qzPick(seed, clubs, null);
  }
  if(!six){
    const ids = qzComps(F), got = await Promise.all(ids.map(c => qzDeck(QZ_DECK[c])));
    if(got.some(d => !d)) return undefined;
    six = qzPick(seed, clubs, ids.map((c, i) => ({ from: qzCompName(c), comp: c, deck: QZ_DECK[c], mc: got[i] })));
  }
  return six ? { six, say: qzSay(six, k) } : null;
}
/* what the card calls it: the clubs when they are all clubs, the competition when none of them are */
function qzSay(six, k){
  const week = (k.fixtures || []).every(f => [5, 6, 0, 1].includes(new Date(f.ko).getDay())) ? "this weekend's" : "this round's";
  const clubs = six.filter(x => x.team).length;
  if(clubs === QZ_N) return QZ_N + " questions on " + week + " clubs";
  const comps = qzComps(k.fixtures);
  if(!clubs && comps.length === 1 && qzCompName(comps[0])) return QZ_N + " questions on " + qzCompName(comps[0]);
  return QZ_N + " questions on " + week + " football";
}
/* the offer for a card: here once it is known, asked for quietly once a minute until then */
function clQzOffer(id){
  const k = CL.card[id];
  if(!k || !CL.teams) return null;                           /* teams.json draws again when it lands */
  const key = qzSeed(k);
  if(!(key in QZ.offers) && clOnce("qz:" + key, 60000)) qzMake(k, key);
  return QZ.offers[key] || null;
}
async function qzMake(k, key){
  let o;
  try{ o = await qzBuild(k); }catch(e){ o = undefined; }
  if(o === undefined) return null;
  QZ.offers[key] = o;
  clStripSave();
  clRedraw();
  return o;
}

/* ---------- on the front and under your calls ---------- */
function clQzCard(id){
  const k = CL.card[id];
  if(!k) return "";
  const e = qzMine(id);
  if(qzDone(e)) return clQzPlayed(id, e);
  if(!clF(id).some(clOpen)) return "";                       /* a warm-up with nothing left to warm up for */
  const o = clQzOffer(id);
  if(!o) return "";
  const left = QZ_N - qzMarks(e).length;
  return '<button class="cl-qz" onclick="clQzOpen(' + id + ')"><span class="cl-qzi">' + ico("ball") + '</span>' +
    '<span class="m"><small class="cl-kick">Matchday Quiz</small><b>' + clE(e ? "Carry on: " + left + (left === 1 ? " question" : " questions") + " left" : o.say) + '</b>' +
    '<small>A warm-up, the same six for all your mates.</small></span><span class="chev">›</span></button>';
}
function clQzPlayed(id, e){
  return '<button class="cl-qz done" onclick="clQzOpen(' + id + ')"><span class="cl-qzn" aria-hidden="true"><b>' + qzScore(e) + '</b><small>OF ' + QZ_N + '</small></span>' +
    '<span class="m"><small class="cl-kick">Matchday Quiz</small><b>' + clE(qzLine(qzScore(e))) + '</b>' + clQzPips(e) + '</span><span class="chev">›</span></button>';
}
/* for the home's Match Centre card (the strip, clStripSave): the line it may show, without loading any of this */
function clQzStrip(c){
  if(!c) return null;
  const e = qzMine(c.card);
  if(qzDone(e)) return { id: c.card, n: qzScore(e) };
  const o = c.open > 0 ? clQzOffer(c.card) : null;
  return o ? { id: c.card, say: o.say } : null;
}
/* a pip a question: gold right, plain wrong, and a ring on the one you're on */
function clQzPips(e, on){
  const m = qzMarks(e), right = qzScore(e);
  return '<span class="cl-qzp" role="img" aria-label="' + right + ' right of ' + m.length + ' answered">' +
    QZ_SLOTS.map((x, i) => '<i class="' + (m[i] === "1" ? "on" : m[i] === "0" ? "off" : i === on ? "cur" : "") + '"></i>').join("") + '</span>';
}

/* ---------- the go ---------- */
/* ‹ goes back where you came from. Nothing to open (the decks didn't load): nothing happens and nothing is said */
async function clQzOpen(id){
  audio();
  const from = clV();
  if(!CL.card[id]) await clLoadCard(id, true);
  const k = CL.card[id];
  if(!k) return;
  if(!qzDone(qzMine(id))){
    const key = qzSeed(k);
    if(!(key in QZ.offers)) await qzMake(k, key);
    if(!QZ.offers[key]) return;
  }
  clGo("quiz", { card: id, from: from.s === "home" ? null : from });
}
function clQzPage(v){
  const id = v.card, k = CL.card[id], e = qzMine(id);
  const ctx = k ? clStr(k.card.label) + " · " + clSeriesName(k.card.series, k.card.series_name) : "";
  const page = body => b4Page({ title: "Matchday Quiz", ctx, back: "clBack()", cls: "clpage cl-qzpage", body });
  if(!k) return page('<div class="lgskel"></div>');
  if(qzDone(e) && !v.shown) return page(clQzResult(id, k, e));
  const o = QZ.offers[qzSeed(k)];
  if(!o) return page('<div class="lgskel"></div>');
  const i = v.shown ? v.shown.i : qzMarks(e).length;
  return page(clQzQuestion(o.six[i], i, v.shown, e));
}
function clQzQuestion(Q, i, shown, e){
  const opts = Q.o.map((x, j) => '<button class="h2opt' + (!shown ? "" : j === Q.k ? " right" : j === shown.o ? " wrong" : " dim") + '"' +
    (shown ? " disabled" : ' onclick="clQzPick(' + j + ')"') + '><span class="k">' + "ABCD"[j] + '</span><span class="t">' + clE(x) + '</span></button>').join("");
  const mark = Q.team ? clPatch(Q.team, 22) : Q.comp ? clBadge(Q.comp, 22) : "";
  const fresh = QZ.drawn !== Q.id; QZ.drawn = Q.id;
  return '<div class="b4card dark cl-qzq' + (fresh ? " in" : "") + '"><div class="cl-qzh">' + clQzPips(e, i) + '<small>Question ' + (i + 1) + ' of ' + QZ_N + '</small></div>' +
    '<div class="cl-qzfrom">' + mark + '<span>' + clE(Q.from) + '</span><small>' + clE(QZ_TIER[Q.tier] || "") + '</small></div><p class="cl-qzt">' + clE(Q.q) + '</p><div class="h2mc">' + opts + '</div>' +
    (shown ? '<p class="cl-qzsay"><b>' + (shown.o === Q.k ? "Right." : "Unlucky.") + '</b>' + (Q.sub ? " " + clE(Q.sub) : "") + '</p>' : "") + '</div>' +
    (shown ? b4Btn(i < QZ_N - 1 ? "Next question ›" : "See your score ›", "clQzNext()") + clQzReportHTML(Q) : "");
}
/* the answer goes on the phone before anything else, so one play is one play */
function clQzPick(j){
  const v = clV(), id = v.card, k = CL.card[id], o = k && QZ.offers[qzSeed(k)], e = qzMine(id) || { s: "", t: Date.now() };
  if(v.s !== "quiz" || v.shown || !o || qzDone(e)) return;
  const i = qzMarks(e).length, Q = o.six[i];
  if(!Q) return;
  audio();
  const right = j === Q.k;
  e.s = qzMarks(e) + (right ? "1" : "0");
  if(e.s.length >= QZ_N) e.d = Date.now();
  qzPut(id, e);
  v.shown = { i, o: j };
  try{ if(right) fb.correct(); else fb.wrong(); }catch(x){}
  if(qzDone(e)) clStripSave();
  render();
}
function clQzNext(){
  audio();
  const v = clV();
  v.shown = null;
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function clQzReportHTML(Q){
  const key = qKey({ q: Q.q });
  return '<div class="qrep">' + (qrepDone(key) ? '<span>Reported. Thanks, every report gets read.</span>' : '<button onclick="clQzReport()">Something wrong with this question?</button>') + '</div>';
}
function clQzReport(){
  const v = clV(), k = CL.card[v.card], o = k && QZ.offers[qzSeed(k)], Q = o && v.shown && o.six[v.shown.i];
  if(!Q) return;
  QREP_NOW = { k: qKey({ q: Q.q }), q: Q.q, a: Q.a, deck: Q.deck, tier: Q.tier };
  qrepSheet();
}

/* ---------- the result ---------- */
const QZ_LINES = ["None of the six. Good thing it never counts in the table.", "One of six. The legs are still heavy.", "Two of six. Still stretching.",
  "Three of six. Halfway warm.", "Four of six. Warmed up nicely.", "Five of six. Very sharp.", "All six. Your mates have work to do."];
const qzLine = n => QZ_LINES[n] || QZ_LINES[0];
function clQzResult(id, k, e){
  const n = qzScore(e), open = clF(id).some(clOpen), mine = clMine(id), toCall = clF(id).filter(f => clOpen(f) && !mine.calls[f.id]).length;
  return '<div class="b4card dark cl-qzres"><span class="cl-kick">Your score</span><div class="cl-qzbig"><b>' + n + '</b><span>of ' + QZ_N + '</span></div>' +
    '<p class="cl-when">' + clE(qzLine(n)) + '</p>' + clQzPips(e) + '</div>' +
    '<p class="cl-sum">The same six for everyone this round, so ask your mates what they got. It never counts in the table.</p>' +
    b4Btn(ico("share") + " Share your score", "clQzShare(" + id + ")") +
    (open && toCall ? b4Btn("Call " + clE(k.card.label) + " ›", "clOpenCard(" + id + ")", "dark") : b4Btn("Back to Call It", "clHomeGo()", "dark"));
}
/* the words, with the way in on the end as every share has: your league's, else the site */
function clQzShareText(id){
  const k = CL.card[id], e = qzMine(id);
  const L = (CL.leagues || []).find(l => l.series === (k && k.card.series)) || null, lg = clShareLeague(L && L.id);
  return "Matchday Quiz, " + clStr(k && k.card.label) + " · " + (k ? clSeriesName(k.card.series, k.card.series_name) : "") + ": " + qzScore(e) + " of " + QZ_N + " on BALL.\n" +
    "The same six for everyone. Can you beat it?\n" + (lg ? clJoinLine(L && L.id) : "Play along: " + clSiteShort());
}
function clQzShare(id){ audio(); clTlm("pl-quiz"); return clShareText(clQzShareText(id)); }
