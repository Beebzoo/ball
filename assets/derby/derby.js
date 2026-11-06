/* BALL 4 · DERBY DUEL: the game (_plans/games-round.md, round 3). Two friends, one phone, each answering questions about the OTHER's club.

   Two names, two clubs, then ten questions in turns, five each, multiple choice, twelve seconds. Player one answers on player two's club
   and the other way round: the joke is that you must know your rival. Both climb the same way: easy, normal, normal, hard, hard. A cover
   stands between every two turns, so nobody sees the next question. Level after ten is sudden death, one question each, up to three
   pairs, and then the draw stands. No XP, nothing on the Daily or Call It. Loaded by index.html (dbyNeed) on the first open; the door, the
   store's load and save and the shelf's line are there, above b6MoreSheet. A plain script with plain globals, like expert.js.

   THE SHAPE
     - The clubs are BANK_CLUBS' quizzes at DBY_BAR, the questions their own decks (DECKS["club-<slug>-mc"], needQuiz), the rivals a hand
       map (DBY_DERBIES). All 107 quizzes clear the bar; _tests/derby-test.js deals every one of them from its real deck, tier by tier.
     - ball4-derby (derbyStore, always read fresh): {v, pairs: {key: {a, b, ca, cb, wa, wb, d, t}}, last: {n: [2 names], c: [2 slugs]},
       seen: {key: [ids]}}. A pair is two names and two clubs, whoever started and whichever way round they sit (dbyPairKey). seen is one list
       for the pair, not one per club: a Klassieker question can sit in both clubs' decks, and it must not come back from the other side.
     - SYNCED, seen excepted (assets/sync/sync.js, on the sign-out list too). "Sanne leads 3–1" is exactly what you would miss on a new
       phone and it is about fifty bytes a pair; seen is long and only a preference, so it stays on the phone, like Trail's and Expert's.
     - The rules are plain functions of the store and the decks (dbyDeal, dbyEnd, dbyBook…), so _tests/derby-test.js can run them.
     - DBY is the duel under way, DBR the last result, DBS the set-up on screen; none is saved. A reload is a duel abandoned: it counts for
       nobody, and the questions it showed are on seen, since they went on as they came up.
     - The clock is the app's (startTimer) and only runs once the phone has been handed over and the question is up.
     - A question never answers itself: rows whose right answer is the club on the label are left out (dbyGives), since the label names
       the club. Sudden death's questions are dealt with the rest, so the same-answer rule holds to the very end.
     - Patches are generated (crestURL, Crests.patch), never a crest. No progAnswer: two friends on one phone are not the owner's record. */

const DBY_SECS = 12, DBY_EACH = 5, DBY_TEN = 10, DBY_SUDDEN = 3, DBY_KEEP = 60;
const DBY_BAR = { hp: 20, en: 12 };   // four duels of the climb's easy and normal, four of its hard with a full sudden death's worth left over
/* the climb, then what sudden death draws on */
const DBY_STEPS = ["easy", "normal", "normal", "hard", "hard", "hard", "hard", "hard"];
/* a thin club: the nearest tier. Softer first for easy and normal; above first for hard, so the end of the climb stays the hardest part */
const DBY_NEAR = {
  easy: ["easy", "normal", "hard", "extreme", "ball"],
  normal: ["normal", "easy", "hard", "extreme", "ball"],
  hard: ["hard", "extreme", "normal", "ball", "easy"] };
const DBY_TIER = { easy: "Easy", normal: "Normal", hard: "Hard", extreme: "Extreme", ball: "Ball" };
const DBY_LANDS = [["nl", "Netherlands"], ["be", "Belgium"], ["en", "England"], ["de", "Germany"], ["es", "Spain"], ["it", "Italy"], ["pt", "Portugal"], ["sc", "Scotland"]];
/* the identity file's spelling → the bank's, for the three that differ */
const DBY_ALIAS = { "excelsior-rotterdam": "excelsior", "oud-heverlee-leuven": "oh-leuven", "raal-la-louviere": "la-louviere" };
const DBY_IDENT = { excelsior: "excelsior-rotterdam", "oh-leuven": "oud-heverlee-leuven", "la-louviere": "raal-la-louviere", "roda-jc": "roda-jc-kerkrade" };

/* THE REAL ONES, a club's main rival first. Only pairs that are both in the game (derby-test.js). The Dutch and Belgian rows are from
   Wikipedia's lists of derbies in the two countries (5 Nov 2026). The third column is what the fixture is called, where it is called
   something; two rivalries are plain rivalries and have no name. */
const DBY_DERBIES = [
  ["ajax", "feyenoord", "De Klassieker"],
  ["ajax", "psv", "De Topper"],
  ["feyenoord", "sparta-rotterdam", "The Rotterdam derby"],
  ["feyenoord", "excelsior", "The Rotterdam derby"],
  ["sparta-rotterdam", "excelsior", "The Rotterdam derby"],
  ["ajax", "az-alkmaar", "The North Holland derby"],
  ["az-alkmaar", "telstar", "The North Holland derby"],
  ["feyenoord", "ado-den-haag", "The South Holland derby"],
  ["fc-groningen", "sc-heerenveen", "The Derby of the North"],
  ["sc-heerenveen", "sc-cambuur", "The Frisian derby"],
  ["go-ahead-eagles", "pec-zwolle", "The IJssel derby"],
  ["twente", "go-ahead-eagles", "The Derby of the East"],
  ["anderlecht", "club-brugge", "The Topper"],
  ["anderlecht", "standard-liege", "The Clasico"],
  ["anderlecht", "union-saint-gilloise", "The Brussels derby"],
  ["club-brugge", "cercle-brugge", "The Bruges derby"],
  ["club-brugge", "gent", "The Battle of Flanders"],
  ["standard-liege", "charleroi", "The Walloon derby"],
  ["charleroi", "la-louviere", "The Hainaut derby"],
  ["genk", "sint-truidense", "The Limburg derby"],
  ["zulte-waregem", "kortrijk", "The South West Flanders derby"],
  ["mechelen", "oh-leuven", "The Dijle derby"],
  ["arsenal", "tottenham", "The North London derby"],
  ["liverpool", "everton", "The Merseyside derby"],
  ["manchester-united", "manchester-city", "The Manchester derby"],
  ["manchester-united", "liverpool", "The North West derby"],
  ["manchester-united", "leeds-united", "The Roses rivalry"],
  ["newcastle", "sunderland", "The Tyne-Wear derby"],
  ["chelsea", "fulham", "The West London derby"],
  ["crystal-palace", "brighton", "The M23 derby"],
  ["leeds-united", "hull-city", "The Yorkshire derby"],
  ["borussia-dortmund", "schalke-04", "The Revierderby"],
  ["bayern-munchen", "borussia-dortmund", "Der Klassiker"],
  ["bayern-munchen", "vfb-stuttgart", "The Südderby"],
  ["hamburger-sv", "werder-bremen", "The Nordderby"],
  ["koln", "borussia-monchengladbach", "The Rhine derby"],
  ["koln", "bayer-leverkusen", "The Rhine derby"],
  ["eintracht-frankfurt", "mainz-05", "The Rhine-Main derby"],
  ["real-madrid", "barcelona", "El Clásico"],
  ["real-madrid", "atletico-madrid", "The Madrid derby"],
  ["barcelona", "espanyol", "The Barcelona derby"],
  ["sevilla", "real-betis", "The Seville derby"],
  ["athletic-club", "real-sociedad", "The Basque derby"],
  ["valencia", "villarreal", "The Valencian derby"],
  ["celta", "deportivo-la-coruna", "The Galician derby"],
  ["inter", "milan", "The Derby della Madonnina"],
  ["inter", "juventus", "The Derby d’Italia"],
  ["roma", "lazio", "The Derby della Capitale"],
  ["juventus", "torino", "The Derby della Mole"],
  ["napoli", "roma", "The Derby del Sole"],
  ["fiorentina", "bologna", "The Derby dell’Appennino"],
  ["benfica", "sporting-cp", "The Lisbon derby"],
  ["benfica", "fc-porto", "O Clássico"],
  ["fc-porto", "sporting-cp", "O Clássico"],
  ["sc-braga", "vitoria-de-guimaraes", "The Minho derby"],
  ["celtic", "rangers", "The Old Firm"],
  ["hearts", "hibernian", "The Edinburgh derby"],
  ["aberdeen", "rangers"],
  ["fiorentina", "juventus"] ];

/* the patter. {to} and {from} on the cover, {other} and {club} on a reveal, W, L and their clubs at the end */
const DBY_PASS = ["{from}, look away. {to}, this one’s on {club}.", "{from}, no hints. {to}, this one’s on {club}.", "{from}, no faces. {to}, this one’s on {club}.", "{from}, hands off. {to}, twelve seconds on {club}."];
const DBY_RIGHT = ["Right. Know your enemy.", "Right. {other} did not enjoy that.", "Right. How do you even know that?", "Right. Suspiciously well read on {club}."];
const DBY_WRONG = ["No. {other} is already smiling.", "No. {other} will be bringing that one up.", "No. A little respect for {club}, please.", "No. {other} has questions."];
const DBY_LATE = ["Out of time. {other} counted it down.", "Twelve seconds and nothing. {other} will take that."];
const DBY_TEASE = {
  sudden: ["It took sudden death. {L}, this one comes up at weddings.", "Sudden death, and {L} blinked first. That’s the story now, for ever."],
  nil: ["Nil. {L}, {WC} is a real club. You could look it up.", "Not one right on {WC}. {L}, have you met football?"],
  full: ["Five of five on {LC}. {W}, is there something you want to tell {L}?", "Five of five on {LC}. {W} may need to explain that at home."],
  poor: ["{W} wins with {wn}. Nobody here should be giving lectures.", "{wn} is enough, apparently. Neither of you comes out of this well."],
  close: ["One question in it. {L} will be blaming the clock for weeks.", "One in it, and {L} already has a theory about the last question."],
  clear: ["{W} knows {LC} better than {L} knows {WC}. Frame that.", "{W} knows {LC} better than {L} knows {WC}, and that’s now in writing."],
  rout: ["{L}, that wasn’t a duel. That was a lesson in {WC}.", "A hiding. {L} may want to sit with the away fans for a while."],
  draw: ["Level after ten, level after sudden death. The draw stands, and so does the argument.", "Three pairs of sudden death and nobody blinked. Same again next week."] };

let DBY = null, DBR = null, DBS = null, DBY_SIDE = 0;

/* ---------- the rules ---------- */
const dbyReady = c => !!c && c[3] >= CLUB_QUIZ_MIN && c[4] >= DBY_BAR.hp && c[5] >= DBY_BAR.en;
const dbyClubs = () => BANK_CLUBS.filter(dbyReady);
const dbyFold = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const dbySame = n => String(n).trim().toLowerCase();                  // a name, any alphabet
/* "FC Porto" and "Porto" are one answer */
const dbyAns = r => { const t = String(r.o[r.k]); return dbyFold(t).replace(/^(the|fc|sc|ac|as|afc|cf|rc|ssc|sv|vfb) /, "").replace(/ (fc|cf|afc)$/, "") || t; };
const dbyId = r => r.id || r.q;
const dbyHas = (hay, word) => (" " + hay + " ").includes(" " + word + " ");
/* every way the app spells a club: the bank's, the identity file's name and its code ("Jong PSV" for PSV Eindhoven, "Deportivo La Coruna") */
const dbyCalled = slug => { const c = clubOf(DBY_IDENT[slug] || slug) || {}; return [(bankClub(slug) || [])[1] || slug, c.name, c.code].filter(Boolean); };
/* THE LABEL NAMES THE CLUB, so a row answers itself when its right answer says that club and no wrong option says it the same way:
   "Which Bruges club scored 96 league goals?", "Jong PSV" against a wrong "Eindhoven", "In which city do PSV play?" with PSV Eindhoven
   on the label. "3-1 to Ajax" against "2-0 to Ajax" is a real question. */
function dbyGives(r, names){
  const says = (t, w) => { const a = dbyFold(t); return !!a && (dbyHas(a, w) || dbyHas(w, a)); };
  return [].concat(names).map(dbyFold).some(w => says(r.o[r.k], w) && !r.o.some((t, i) => i !== r.k && says(t, w)));
}
/* what a club can be asked: complete rows that don't answer themselves, shuffled; what this pair has met goes last, the longest ago first */
function dbyPools(side, rnd){
  const seen = side.seen || [], names = dbyCalled(side.slug), fresh = {}, again = {};
  for(const t of Object.keys(DBY_TIER)){
    const rows = ((side.deck && side.deck[t]) || []).filter(r => Array.isArray(r.o) && r.o.length >= 4 && r.k != null && !dbyGives(r, names));
    for(let i = rows.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    fresh[t] = rows.filter(r => !seen.includes(dbyId(r)));
    again[t] = rows.filter(r => seen.includes(dbyId(r))).sort((a, b) => seen.indexOf(dbyId(a)) - seen.indexOf(dbyId(b)));
  }
  return { fresh, again };
}
/* one question for a step: a row this pair hasn't met, whatever tier that takes, before a row it has */
function dbyTake(pool, tier, answers){
  for(const list of [pool.fresh, pool.again]) for(const t of DBY_NEAR[tier]){
    const i = list[t].findIndex(r => !answers.has(dbyAns(r)));
    if(i < 0) continue;
    const r = list[t].splice(i, 1)[0];
    answers.add(dbyAns(r));
    return Object.assign({}, r, { tier: t, want: tier });
  }
  return null;
}
/* THE WHOLE DUEL, ONCE. sides[p] = {slug, deck, seen}: the club player p answers on, so sides[0] is the second player's club. Eight rows
   each, five and sudden death's three, turn about so neither club picks first, and no answer twice across the two. Null when a club can't. */
function dbyDeal(sides, rnd){
  rnd = rnd || Math.random;
  const pools = sides.map(s => dbyPools(s, rnd)), answers = new Set(), rows = [[], []];
  for(const tier of DBY_STEPS) for(const p of [0, 1]){
    const r = dbyTake(pools[p], tier, answers);
    if(!r) return null;
    rows[p].push(r);
  }
  return rows;
}
/* who answers turn i, and on what. Turn i is the starter's when i is even */
const dbyWho = (first, i) => (first + i) % 2;
const dbyScore = (picks, first) => { const s = [0, 0]; picks.forEach((ok, i) => { if(ok) s[dbyWho(first, i)]++; }); return s; };
/* null: play on. Otherwise {w: 0, 1, or null for a draw}. Ten played and level is sudden death: only a finished pair can end it */
function dbyEnd(picks, first){
  const n = picks.length;
  if(n < DBY_TEN || n % 2) return null;
  const s = dbyScore(picks, first);
  if(s[0] !== s[1]) return { w: s[0] > s[1] ? 0 : 1 };
  return n >= DBY_TEN + DBY_SUDDEN * 2 ? { w: null } : null;
}

/* ---------- the record ---------- */
const dbySeat = (name, club) => dbySame(name) + "|" + club;
const dbyPairKey = (names, clubs) => [dbySeat(names[0], clubs[0]), dbySeat(names[1], clubs[1])].sort().join("~");
/* the pair's record the way round these two are sitting, or null */
function dbyRec(s, names, clubs){
  const r = (s.pairs || {})[dbyPairKey(names, clubs)];
  if(!r) return null;
  const same = dbySeat(names[0], clubs[0]) === dbySeat(r.a, r.ca);
  return { w: same ? [r.wa | 0, r.wb | 0] : [r.wb | 0, r.wa | 0], d: r.d | 0 };
}
/* a finished duel. The newest DBY_KEEP pairs stay, each with what it has seen */
function dbyBook(s, names, clubs, w, day){
  s.pairs = s.pairs || {};
  const key = dbyPairKey(names, clubs), a = dbySeat(names[0], clubs[0]) < dbySeat(names[1], clubs[1]) ? 0 : 1, b = 1 - a, old = s.pairs[key] || {};
  const r = s.pairs[key] = { a: names[a], b: names[b], ca: clubs[a], cb: clubs[b], wa: old.wa | 0, wb: old.wb | 0, d: old.d | 0, t: day };
  if(w == null) r.d++; else if(w === a) r.wa++; else r.wb++;
  const keys = Object.keys(s.pairs).sort((x, y) => (s.pairs[y].t | 0) - (s.pairs[x].t | 0));
  for(const k of keys.slice(DBY_KEEP)) if(k !== key){ delete s.pairs[k]; if(s.seen) delete s.seen[k]; }
  return r;
}
/* "Sanne leads 3–1", "All square at 2–2", or nothing for two strangers */
function dbyLead(s, names, clubs){
  const R = dbyRec(s, names, clubs);
  if(!R) return "";
  const [a, b] = R.w, d = R.d ? R.d + (R.d === 1 ? " draw" : " draws") : "";
  if(a === b) return a ? "All square at " + a + "–" + b + (d ? ", " + d : "") : d;
  return (a > b ? names[0] + " leads " + a + "–" + b : names[1] + " leads " + b + "–" + a) + (d ? ", " + d : "");
}
/* on the list as it comes up, so an abandoned duel counts as met */
function dbyMark(s, key, id){
  s.seen = s.seen || {};
  s.seen[key] = (s.seen[key] || []).filter(x => x !== id).concat([id]);
}
const dbySeen = (s, key) => (s.seen || {})[key] || [];

/* ---------- the rivals ---------- */
const dbyRivals = slug => DBY_DERBIES.filter(d => d[0] === slug || d[1] === slug).map(d => d[0] === slug ? d[1] : d[0]).filter(k => dbyReady(bankClub(k)));
const dbyDerby = (a, b) => (DBY_DERBIES.find(d => (d[0] === a && d[1] === b) || (d[0] === b && d[1] === a)) || [])[2] || null;
/* your club, where it maps to one of ours */
function dbyFav(){
  let f = null;
  try{ f = (acctLocal().fav || {}).club; }catch(e){}
  if(!f) try{ f = (mine().fav || {}).club; }catch(e){}
  f = DBY_ALIAS[f] || f;
  return f && dbyReady(bankClub(f)) ? f : null;
}

/* ---------- a club's look ---------- */
function dbyLook(slug){
  const r = bankClub(slug), name = r ? r[1] : slug;
  return Object.assign({ code: name.slice(0, 3).toUpperCase(), c1: "#123D24", c2: "#F8F1DD", p: "plain" }, clubOf(DBY_IDENT[slug] || slug) || {}, { name });
}
const dbyPatchURL = (slug, px) => crestURL(DBY_IDENT[slug] || slug, "patch", px, dbyLook(slug));
const DBY_BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
/* the picker has a hundred of these: what isn't drawn yet is filled in a slice per frame, as in Club Expert's */
function dbyPatch(slug, w){
  const px = w <= 40 ? 96 : w * 3, ready = crestCache.has((DBY_IDENT[slug] || slug) + "|patch|" + px);
  return '<img class="dbypatch" width="' + w + '" height="' + Math.round(w * 7 / 6) + '" alt="" src="' + (ready ? dbyPatchURL(slug, px) : DBY_BLANK) + '"' + (ready ? "" : ' data-dbp="' + slug + '" data-px="' + px + '"') + '>';
}
function dbyFill(){
  let list; try{ list = [...document.querySelectorAll("img[data-dbp]")]; }catch(e){ return; }
  const step = () => {
    const end = performance.now() + 9;
    while(list.length && performance.now() < end){ const im = list.shift(), u = dbyPatchURL(im.getAttribute("data-dbp"), +im.getAttribute("data-px")); if(u) im.src = u; im.removeAttribute("data-dbp"); }
    if(list.length) requestAnimationFrame(step);
  };
  step();
}
const dbyColor = L => L.c1 === "#ffffff" ? L.c2 : L.c1;
const dbySay = (t, o) => t.replace(/\{(\w+)\}/g, (m, k) => o[k]);

/* ---------- the set-up ---------- */
function dbyDeck(slug){ return DECKS["club-" + slug + "-mc"] || null; }
/* again: a tap on Kick off after a failed fetch (a pub with no signal) asks once more */
function dbyFetch(slug, again){
  const id = "club-" + slug, r = QUIZZES[id];
  if(again && r && !dbyDeck(slug)) r._asked = false;
  needQuiz(id);
}
function dbyInit(){
  const s = derbyStore(), names = partyNames(), L = s.last;
  let clubs = [dbyFav(), null];
  if(L && Array.isArray(L.n) && Array.isArray(L.c)){
    const here = names.slice(0, 2).map(dbySame), then = L.n.map(dbySame);
    if(here[0] === then[0] && here[1] === then[1]) clubs = L.c.slice(0, 2);
    else if(here[0] === then[1] && here[1] === then[0]) clubs = [L.c[1], L.c[0]];
  }
  clubs = clubs.map(c => c && dbyReady(bankClub(c)) ? c : null);
  if(clubs[0] === clubs[1]) clubs[1] = null;
  DBS = { clubs };
  clubs.forEach(c => { if(c) dbyFetch(c); });
}
function dbySideHTML(i, name){
  const slug = DBS.clubs[i], L = slug ? dbyLook(slug) : null, raw = (partyRaw().names || [])[i];
  return '<div class="dbyside"><button class="dbyclub' + (slug ? "" : " none") + '" onclick="dbyOpenPick(' + i + ')" aria-label="' + esc((slug ? "Change club, now " + L.name : "Pick a club") + ", " + name) + '">' +
    (slug ? dbyPatch(slug, 70) : '<span class="dbyempty" aria-hidden="true">?</span>') + '<b>' + esc(slug ? L.name : "Pick a club") + '</b>' + (slug ? '<small>Change</small>' : "") + '</button>' +
    '<input class="dbyname" maxlength="16" placeholder="Player ' + (i + 1) + '" aria-label="Player ' + (i + 1) + '" value="' + esc(String(raw || "")) + '" oninput="dbyName(' + i + ',this.value)"></div>';
}
/* the side still empty, and the real rivals of the club next to it: the suggestion comes first, the whole list is a tap further */
function dbyChipsHTML(){
  const c = DBS.clubs, i = c[0] && !c[1] ? 1 : c[1] && !c[0] ? 0 : -1;
  if(i < 0) return "";
  const from = c[1 - i], list = dbyRivals(from).slice(0, 3);
  if(!list.length) return "";
  return '<div class="dbyriv"><small>' + esc(dbyLook(from).name) + '’s rivals</small><div class="dbychips">' +
    list.map(k => '<button class="dbychip" onclick="dbySet(' + i + ",'" + k + '\')">' + dbyPatch(k, 26) + '<b>' + esc(dbyLook(k).name) + '</b></button>').join("") + '</div></div>';
}
const dbyRecLine = () => { const c = DBS.clubs; return c[0] && c[1] ? dbyLead(derbyStore(), partyNames().slice(0, 2), c) : ""; };
function dbySetupHTML(){
  const names = partyNames(), c = DBS.clubs, both = c[0] && c[1], title = both ? dbyDerby(c[0], c[1]) : null;
  return b4Page({ title: "Derby Duel", ctx: "Two friends, one phone", back: "dbyBack()", cls: "dbypage dby-setup", body:
    '<p class="dbylead">Five questions each, all on the other one’s club. You’d better know your rival.</p>' +
    '<div class="dbyface">' + dbySideHTML(0, names[0]) + '<span class="dbyvs" aria-hidden="true">v</span>' + dbySideHTML(1, names[1]) + '</div>' +
    dbyChipsHTML() + (title ? '<div class="dbytitle">' + esc(title) + '</div>' : "") +
    '<div class="dbyrec" id="dbyrec">' + esc(dbyRecLine()) + '</div>' +
    (both ? b4Btn("Kick off", "dbyKick()", "gold") : '<button class="b4btn gold" disabled>Pick two clubs</button>') });
}
/* a name changes nothing on the page but the record's line: a redraw here would throw the tap on Kick off away */
function dbyName(i, v){
  setPartyName(i, v);
  try{ const el = document.getElementById("dbyrec"); if(el && DBS) el.textContent = dbyRecLine(); }catch(e){}
}

/* ---------- the picker ---------- */
function dbyPicker(side, clubs){
  const other = clubs[1 - side], rows = dbyClubs().filter(r => r[0] !== other), fav = dbyFav();
  const derby = other ? dbyRivals(other) : [], mine = fav && fav !== other && !derby.includes(fav) ? fav : null;
  const cc = other ? bankClub(other)[2] : fav ? bankClub(fav)[2] : null;
  const lands = DBY_LANDS.slice().sort((a, b) => (b[0] === cc) - (a[0] === cc))
    .map(([k, name]) => [k, name, rows.filter(r => r[2] === k && !derby.includes(r[0]) && r[0] !== mine).map(r => r[0])]).filter(l => l[2].length);
  return { derby, mine, lands };
}
function dbyTile(slug, side){
  const L = dbyLook(slug), on = DBS.clubs[side] === slug;
  return '<button class="dbytile' + (on ? " on" : "") + '" onclick="dbySet(' + side + ",'" + slug + '\')" aria-pressed="' + on + '">' + dbyPatch(slug, 36) + '<b>' + esc(L.name) + '</b></button>';
}
function dbyPickHTML(){
  const i = DBY_SIDE, P = dbyPicker(i, DBS.clubs), other = DBS.clubs[1 - i], names = partyNames();
  const grid = list => '<div class="dbygrid">' + list.map(k => dbyTile(k, i)).join("") + '</div>';
  const league = k => { try{ return compBadge(CLUB_LEAGUE[k], 26) || ""; }catch(e){ return ""; } };
  return b4Page({ title: names[i] + "’s club", ctx: "Pick a club", back: "dbyBack()", cls: "dbypage dby-pick", body:
    (P.derby.length ? '<div class="b6hdr dbyh">' + esc(dbyLook(other).name) + '’s rivals</div>' + grid(P.derby) : "") +
    (P.mine ? '<div class="b6hdr dbyh">Your club</div>' + grid([P.mine]) : "") +
    P.lands.map(([k, name, list]) => '<div class="b6hdr dbyh">' + league(k) + esc(name) + '<span>' + list.length + '</span></div>' + grid(list)).join("") });
}

/* ---------- the duel ---------- */
const dbyAt = D => dbyWho(D.first, D.i);
const dbyQ = D => D.rows[dbyAt(D)][Math.floor(D.i / 2)];
const dbyCtx = D => D.i < DBY_TEN ? "Question " + (D.i + 1) + " of " + DBY_TEN : "Sudden death · " + (Math.floor((D.i - DBY_TEN) / 2) + 1) + " of " + DBY_SUDDEN;
/* the small score: a name, five pips (more in sudden death), and the number between them */
function dbyStrip(D, on){
  const s = dbyScore(D.picks, D.first), turn = D.cover || !D.shown;
  const pips = p => {
    const own = D.picks.filter((_, i) => dbyWho(D.first, i) === p), n = Math.max(DBY_EACH, own.length + (turn && dbyAt(D) === p ? 1 : 0));
    return '<span class="dbypips">' + Array.from({ length: n }, (_, i) => '<i class="' + (i < own.length ? (own[i] ? "hit" : "miss") : i === own.length && turn && dbyAt(D) === p ? "cur" : "") + '"></i>').join("") + '</span>'; };
  const side = p => '<div class="dbypl' + (p === on ? " on" : "") + '"><b>' + esc(D.names[p]) + '</b>' + pips(p) + '</div>';
  return '<div class="dbystrip" role="img" aria-label="' + esc(D.names[0] + " " + s[0] + ", " + D.names[1] + " " + s[1]) + '">' + side(0) + '<div class="dbysc"><b>' + s[0] + '</b><s></s><b>' + s[1] + '</b></div>' + side(1) + '</div>';
}
/* what the cover says. In sudden death the second of a pair knows what the first did */
function dbyCoverLine(D){
  const p = dbyAt(D), to = D.names[p], from = D.names[1 - p], club = dbyLook(D.clubs[1 - p]).name, s = dbyScore(D.picks, D.first);
  if(D.i === 0) return to + " starts, on " + club + ". Twelve seconds a question. " + from + ", you can’t help. You wouldn’t anyway.";
  if(D.i >= DBY_TEN){
    if(D.i % 2 === 0) return "Level at " + s[0] + "–" + s[1] + ". One question each, on your rival’s club. One right and one wrong ends it.";
    return D.picks[D.i - 1] ? from + " got it. " + to + ", get this or it’s over." : from + " missed. " + to + ", get this and it’s yours.";
  }
  const line = dbySay(DBY_PASS[D.i % DBY_PASS.length], { to, from, club });
  return D.i === DBY_TEN - 1 ? "Last one. " + line : line;
}
function dbyCoverHTML(){
  const D = DBY, p = dbyAt(D), slug = D.clubs[1 - p], Q = dbyQ(D), L = dbyLook(slug);
  return b4Page({ title: "Derby Duel", ctx: dbyCtx(D), back: "dbyAskLeave()", leave: "dbyAskLeave()", cls: "dbypage dby-cover", body:
    dbyStrip(D, p) + '<div class="dbycover">' + b4Q("Give the phone to " + esc(D.names[p]), esc(dbyCoverLine(D))) +
    '<div class="dbyart">' + dbyPatch(slug, 110) + '<b>' + esc(L.name) + '</b><i class="dbytier ' + Q.tier + '">' + DBY_TIER[Q.tier] + '</i></div>' +
    b4Btn("I’m " + esc(D.names[p]) + " · show my question", "dbyUncover()", "gold") + '</div>' });
}
const dbyQKey = D => D.i + (D.shown ? "s" : "q");
function dbyQHTML(){
  const D = DBY, p = dbyAt(D), Q = dbyQ(D), L = dbyLook(D.clubs[1 - p]), shown = D.shown;
  const opts = Q.o.map((t, i) => '<button class="h2opt' + (shown ? (i === Q.k ? " right" : i === D.pick ? " wrong" : " dim") : "") + '"' + (shown ? " disabled" : "") + ' onclick="dbyAnswer(' + i + ')"><span class="k">' + "ABCD"[i] + '</span>' + esc(String(t)) + '</button>').join("");
  const clock = shown ? '<div class="clock dbyclock dbystop"><div class="bar"><i style="width:' + Math.round(100 * Math.max(0, D.left) / DBY_SECS) + '%"></i></div><div class="digits">' + Math.max(0, D.left).toFixed(1) + '</div></div>'
    : '<div class="clock dbyclock" id="clock" role="timer"><div class="bar"><i style="width:100%"></i></div><div class="digits">' + DBY_SECS + '.0</div></div>';
  return b4Page({ title: D.names[p], ctx: dbyCtx(D), back: "dbyAskLeave()", leave: "dbyAskLeave()", cls: "dbypage dby-q", body:
    '<span hidden data-dbk="' + dbyQKey(D) + '"></span>' + dbyStrip(D, p) + clock +
    '<div class="qcard dbyq' + (shown ? "" : " qin") + '"><div class="dbyon">' + dbyPatch(D.clubs[1 - p], 30) + '<span><small>On</small><b>' + esc(L.name) + '</b></span><i class="dbytier ' + Q.tier + '">' + DBY_TIER[Q.tier] + '</i></div>' +
      '<div class="qtext">' + esc(String(Q.q)) + '</div><div class="dbyopts">' + opts + '</div><div class="dbysay" role="status">' + esc(D.say || "") + '</div></div>' +
    (shown ? '<div class="dbynext">' + b4Btn(dbyNextLabel(D), "dbyNext()", "gold") + '</div>' : '<div class="dbynext off" aria-hidden="true"></div>') });
}
/* after this answer: the end, sudden death, or the phone goes across */
function dbyNextLabel(D){
  if(dbyEnd(D.picks, D.first)) return "See who won";
  if(D.i === DBY_TEN - 1) return "Sudden death";
  return "Done · pass to " + esc(D.names[1 - dbyAt(D)]);
}
function dbyUncover(){
  if(!DBY || !DBY.cover) return;
  audio();
  const D = DBY, Q = dbyQ(D), s = derbyStore();
  D.cover = false; D.shown = false; D.pick = null; D.say = ""; D.left = DBY_SECS;
  dbyMark(s, D.key, dbyId(Q)); derbySave(s);
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  startTimer(DBY_SECS, dbyTimeUp, "derby:" + D.i);
}
function dbyAnswer(i){
  if(!DBY || DBY.cover || DBY.shown) return;
  audio();
  DBY.left = Math.max(0, (T.deadline - performance.now()) / 1000);
  stopTimer();
  dbyReveal(i);
}
function dbyTimeUp(){ if(!DBY || DBY.cover || DBY.shown) return; DBY.left = 0; stopTimer(); dbyReveal(-1); }
function dbyReveal(i){
  const D = DBY, Q = dbyQ(D), ok = i === Q.k, p = dbyAt(D), o = { other: D.names[1 - p], club: dbyLook(D.clubs[1 - p]).name };
  D.shown = true; D.pick = i; D.picks.push(ok);
  try{ if(ok) fb.correct(null, 1); else if(i >= 0) fb.wrong(null); else fb.run = 0; }catch(e){}
  const list = ok ? DBY_RIGHT : i < 0 ? DBY_LATE : DBY_WRONG;
  D.say = dbySay(list[(D.spin + D.i) % list.length], o);
  try{ a11ySay(D.say); }catch(e){}
  render();
}
function dbyNext(){
  const D = DBY;
  if(!D || !D.shown) return;
  audio();
  if(dbyEnd(D.picks, D.first)) return dbyFinish();
  D.i++; D.cover = true; D.shown = false; D.pick = null; D.say = "";
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function dbyFinish(){
  const D = DBY, R = dbyEnd(D.picks, D.first), score = dbyScore(D.picks, D.first), s = derbyStore(), sudden = D.picks.length > DBY_TEN;
  dbyBook(s, D.names, D.clubs, R.w, dayKey());
  derbySave(s);
  try{ tlmEvent("derby_done", { sudden: sudden ? 1 : 0, draw: R.w == null ? 1 : 0, margin: Math.abs(score[0] - score[1]) }); }catch(e){}
  DBR = { names: D.names, clubs: D.clubs, first: D.first, picks: D.picks, score, w: R.w, sudden, spin: D.spin, lead: dbyLead(s, D.names, D.clubs), meets: (r => r.w[0] + r.w[1] + r.d)(dbyRec(s, D.names, D.clubs)) };
  DBY = null; DBY_VIEW = "done";
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  if(R.w != null) try{ celebrate(3, { type: "derbyWin", n: 60 }); ching(); }catch(e){}
}
function dbyAskLeave(){
  audio();
  sheet('<h2>Leave the duel?</h2><p>It won’t count, and nobody has to know who was losing.</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep going</button><button class="b4btn quiet" onclick="dbyLeave()">Leave</button>');
}
function dbyLeave(){ audio(); stopTimer(); DBY = null; DBY_VIEW = "setup"; closeSheet(); render(); }
/* the line under a revealed question reports this question, not whatever Matchday has parked */
function dbyQrep(){
  const D = DBY;
  if(!D || D.cover || !D.shown) return null;
  const Q = dbyQ(D), anchor = document.querySelector("#stage .dbynext");
  return Q && anchor ? { q: Q.q, a: Q.o[Q.k], deck: "club-" + D.clubs[1 - dbyAt(D)], tier: Q.tier, anchor } : null;
}

/* ---------- the end ---------- */
function dbyTease(D){
  if(D.w == null) return DBY_TEASE.draw[D.spin % DBY_TEASE.draw.length];
  const w = D.w, l = 1 - w, wn = D.score[w], ln = D.score[l], gap = wn - ln;
  const kind = D.sudden ? "sudden" : !ln ? "nil" : wn === DBY_EACH ? "full" : wn <= 2 ? "poor" : gap === 1 ? "close" : gap >= 3 ? "rout" : "clear", list = DBY_TEASE[kind];
  return dbySay(list[D.spin % list.length], { W: D.names[w], L: D.names[l], WC: dbyLook(D.clubs[w]).name, LC: dbyLook(D.clubs[l]).name, wn });
}
function dbyHead(D){
  if(D.w == null) return "All square";
  const t = dbyDerby(D.clubs[0], D.clubs[1]);
  return esc(D.names[D.w]) + " wins " + esc(t ? t.replace(/^The /, "the ") : "the duel");
}
function dbyRows(D){
  const row = p => { const own = D.picks.filter((_, i) => dbyWho(D.first, i) === p);
    return '<div class="dbyrow">' + dbyPatch(D.clubs[p], 30) + '<b>' + esc(D.names[p]) + '</b><span class="dbypips">' + own.map(ok => '<i class="' + (ok ? "hit" : "miss") + '"></i>').join("") + '</span></div>'; };
  return '<div class="dbyrows" role="img" aria-label="' + esc(D.names[0] + " " + D.score[0] + ", " + D.names[1] + " " + D.score[1]) + '">' + row(0) + row(1) + '</div>';
}
function dbyDoneHTML(){
  const D = DBR, next = 1 - D.first, side = p => { const L = dbyLook(D.clubs[p]); return { name: D.names[p], color: dbyColor(L), flag: dbyPatchURL(D.clubs[p], 120) }; };
  const score = b4Score({ home: side(0), away: side(1), score: D.score, label: D.sudden ? "After sudden death" : "Full time" });
  return b4Page({ title: "Derby Duel", ctx: dbyLook(D.clubs[0]).name + " v " + dbyLook(D.clubs[1]).name, back: "dbyBack()", score, cls: "dbypage dby-done", body:
    b4Q(dbyHead(D), esc(dbyTease(D))) + dbyRows(D) + (D.lead ? '<div class="dbyrec big">' + esc(D.lead) + '</div>' : "") +
    b4Btn("Rematch · " + esc(D.names[next]) + " starts", "dbyRematch()", "gold") + b4Btn("Share", "dbyShare()", "dark") + b4Btn("New duel", "dbyBack()", "quiet") });
}
function dbyShareText(D){
  const who = p => D.names[p] + " (" + dbyLook(D.clubs[p]).name + ")";
  const line = D.w == null ? who(0) + " and " + who(1) + " drew " + D.score[0] + "–" + D.score[1]
    : who(D.w) + " beat " + who(1 - D.w) + " " + D.score[D.w] + "–" + D.score[1 - D.w] + (D.sudden ? " after sudden death" : "");
  return "BALL · Derby Duel: " + line + (D.meets > 1 && D.lead ? "\n" + D.lead : "") + "\nballquiz.app";
}
function dbyShare(){
  audio();
  if(!DBR) return;
  try{ tlmEvent("share", { what: "derby" }); }catch(e){}
  const text = dbyShareText(DBR);
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}

/* ---------- getting about ---------- */
function dbyStart(names, clubs, first){
  const decks = clubs.map(dbyDeck);
  if(!decks[0] || !decks[1]){ clubs.forEach(c => dbyFetch(c, true)); return toast("Those questions are still loading, give it a second", true); }
  const s = derbyStore(), key = dbyPairKey(names, clubs), seen = dbySeen(s, key);
  const rows = dbyDeal([0, 1].map(p => ({ slug: clubs[1 - p], deck: decks[1 - p], seen })));
  if(!rows) return toast("We’re short of questions for those two clubs. Try another pair.", true);
  s.last = { n: names.slice(), c: clubs.slice() }; derbySave(s);
  try{ wakeLock(); }catch(e){}
  DBY = { names, clubs, first, key, rows, i: 0, picks: [], cover: true, shown: false, pick: null, say: "", left: DBY_SECS, spin: Math.floor(Math.random() * 1e6) };
  DBR = null; DBY_VIEW = "duel";
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function dbyKick(){
  audio();
  const clubs = DBS.clubs.slice(), names = partyNames().slice(0, 2);
  if(!clubs[0] || !clubs[1]) return toast("Pick two clubs first", true);
  if(clubs[0] === clubs[1]) return toast("One club each. That’s the whole point.", true);
  if(dbySame(names[0]) === dbySame(names[1])) return toast("Two different names, or nobody will know who won", true);
  dbyStart(names, clubs, 0);
}
function dbyRematch(){ audio(); if(DBR) dbyStart(DBR.names, DBR.clubs, 1 - DBR.first); }
function dbyOpenPick(i){ audio(); try{ haptic("select"); }catch(e){} DBY_SIDE = i; DBY_VIEW = "pick"; render(); try{ window.scrollTo(0, 0); }catch(e){} }
function dbySet(i, slug){
  audio();
  if(!dbyReady(bankClub(slug))) return;
  if(slug === DBS.clubs[1 - i]) return toast("One club each. That’s the whole point.", true);
  try{ haptic("select"); }catch(e){}
  try{ document.activeElement.blur(); }catch(e){}   // a name still being typed would hold the redraw back (dbyRender)
  DBS.clubs[i] = slug; dbyFetch(slug);
  DBY_VIEW = "setup"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function dbyClose(){
  stopTimer();
  DBY_VIEW = null; DBY = null; DBR = null; DBS = null;
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function dbyBack(){
  audio();
  if(DBY_VIEW === "pick" || DBY_VIEW === "done"){ DBR = null; DBY_VIEW = "setup"; render(); try{ window.scrollTo(0, 0); }catch(e){} return; }
  dbyClose();
}

/* ---------- the screen ---------- */
function dbyRender(st){
  /* a deck landing calls render(): a question stays where it is, focus and clock with it; so does a name being typed */
  if(DBY_VIEW === "duel" && DBY && !DBY.cover){ try{ if(st.querySelector("[data-dbk='" + dbyQKey(DBY) + "']")){ b6Paper(true); return; } }catch(e){} }
  if(DBY_VIEW === "setup" && DBS){ try{ const a = document.activeElement; if(a && a.classList && a.classList.contains("dbyname") && st.querySelector(".dby-setup")){ b6Paper(true); return; } }catch(e){} }
  if(DBY_VIEW === "duel" && !DBY) DBY_VIEW = "setup";
  if(DBY_VIEW === "done" && !DBR) DBY_VIEW = "setup";
  if(!DBS) dbyInit();
  st.innerHTML = DBY_VIEW === "duel" ? (DBY.cover ? dbyCoverHTML() : dbyQHTML()) : DBY_VIEW === "done" ? dbyDoneHTML() : DBY_VIEW === "pick" ? dbyPickHTML() : dbySetupHTML();
  dbyFill();
  if(!CLUBID && (DBY_VIEW === "pick" || DBY_VIEW === "setup")) setTimeout(() => { if(DBY_VIEW === "pick" || DBY_VIEW === "setup") render(); }, 600);
}
