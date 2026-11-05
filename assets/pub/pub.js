/* BALL 4 · PUB NIGHT: the game (_plans/games-round.md, round 3). The phone is the quizmaster's card.

   The host reads a question out, gives the room as long as the room needs, taps Show answer, reads the answer and the fact that comes
   with it, and with teams on taps who got it. Everyone else plays with a pen and a beer mat, or just shouts. Rounds have themes; between
   rounds the room swaps papers. No clock unless the host asks for one, no XP, no gate. Loaded by index.html (pubNeed) on the
   first open; the door, the store's load and save and the shelf's line are there. A plain script with plain globals, like trail.js.

   THE SHAPE
     - assets/pub/rounds.json comes from _tools/build-pub.js: only rows with a fact, only rows that work read aloud, grouped into themes.
       A row is [id, q, a, fact, tier 0-4, source or -1]; a theme's rows are places in the list.
     - ball4-pub (pubStore, always read fresh): {v, night, used: [row ids, oldest first], last: [theme ids], names, cfg}. It stays on this phone
       (SYNC_NEVER says why).
     - PB is the night and it is saved on every step, so a reload or a call coming in loses nothing. It carries its own copy of the rows, so a new
       pack can't move a question from under a night in progress. PUB_VIEW (setup | resume | break | play | final) goes with it.
     - The rules are plain functions of the pack, the store and the night (pbChoose, pbDealRound, pbBuild, pbBoard...), so _tests/pub-test.js
       can run them.
     - A question goes on the used list when its answer is shown, not when it is dealt: a night given up in round one spends only what was read.
     - The look is a big dark card on the paper, so the type holds up at arm's length in a dim pub. A game under way stays Classic (themeInScope). */

const PB_ROUNDS = [3, 4, 5, 6], PB_PER = [5, 8, 10], PB_TEAMS = [2, 3, 4, 5, 6, 7, 8];
const PB_LEVELS = [["regulars", "Regulars", "Something for everyone at the table."], ["mixed", "Mixed", "Every round starts kind and ends hard."], ["anoraks", "Anoraks", "For the ones who bring their own reference books."]];
/* the tier of each question of a round, 0 Easy to 4 BALL, and the tiers a level may use */
const PB_PLAN = { regulars: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1], mixed: [0, 1, 2, 1, 3, 2, 0, 4, 1, 2], anoraks: [2, 3, 4, 2, 3, 4, 2, 3, 4, 2] };
const PB_KEEP = { regulars: [0, 1], mixed: [0, 1, 2, 3, 4], anoraks: [2, 3, 4] };
const PB_USED_CAP = 1500;   // a thousand and a half questions: about a year of weekly nights
const PB_NAMES = ["The Offside Trap", "Real Ale Madrid", "Pint Germain", "Bier Leverkusen", "Schalke and Awe", "Expected Ales", "Aston Vanilla", "Inter Milanese"];
const PB_GROUPS = [["leagues", "Leagues"], ["cups", "Cups and tournaments"], ["topics", "Topics"], ["decades", "Decades"]];
const PB_CLOCK_S = 30;
const PB_KEEP_FINAL_MS = 12 * 36e5;   // the podium outlives a reload, not the week

let PB = null, PBS = null, PBK = null, PBK_BUSY = false, PB_TICK = null, PB_LEFT = 0, PB_POP = -1, PB_AGAIN = false, PB_TAP = 0, PB_SETTLE = 350;

/* ---------- the rules ---------- */
const pbNorm = a => String(a).toLowerCase().replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9à-ÿ]+/g, " ").trim();
function pbShuffle(a, rnd){
  rnd = rnd || Math.random;
  const o = a.slice();
  for(let i = o.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
/* a theme by id: one of the pack's, the Surprise round (the whole pack), or a club's ("club:ajax") */
function pbTheme(pack, id, clubName){
  if(/^club:/.test(id)){
    const k = id.slice(5), list = pack.clubs[k] || [];
    return { id, name: clubName || k, line: "No conferring with the home end.", rows: list.map(i => pack.rows[i]) };
  }
  const t = pack.themes.find(x => x.id === id);
  if(!t) return null;
  return { id, name: t.name, line: t.line, tag: t.tag, rows: t.all ? pack.rows : t.rows.map(i => pack.rows[i]) };
}
/* the themes of a night: what the host picked in the order they were picked, the rest a surprise, walking the groups so a night
   is never four decades. Last night's themes wait a night while there are others. All surprises, four rounds or more: the last is the Surprise round */
function pbChoose(themes, n, picked, last, rnd){
  rnd = rnd || Math.random;
  const out = (picked || []).slice(0, n), open = themes.filter(t => !t.all), before = last || [];
  const finale = !out.length && n >= 4 && themes.some(t => t.all);
  const want = finale ? n - 1 : n, groups = pbShuffle(PB_GROUPS.map(g => g[0]), rnd);
  for(let g = 0; out.length < want; g++){
    const free = t => !out.includes(t.id), fresh = t => free(t) && !before.includes(t.id);
    let pool = open.filter(t => t.g === groups[g % groups.length] && fresh(t));
    if(!pool.length) pool = open.filter(fresh);
    if(!pool.length) pool = open.filter(free);
    if(!pool.length) break;
    out.push(pool[Math.floor(rnd() * pool.length)].id);
  }
  if(finale) out.push(themes.find(t => t.all).id);
  return out;
}
/* A ROUND, DEALT. Each question has a tier to find. Best is a row nobody here has heard, at that tier or near it, with an answer not in the
   round yet and, in a theme that mixes sources, no more than a third of the round from one league. When a theme runs out it gives up
   the tidiness first, then reaches for the questions used longest ago, and only then steps outside the level. Hardest last. */
function pbDealRound(rows, plan, level, ctx, tag, rnd){
  rnd = rnd || Math.random;
  const keep = PB_KEEP[level], out = [], ans = new Set(), srcs = {}, cap = tag ? Math.ceil(plan.length / Math.min(3, new Set(rows.map(r => r[5])).size)) : Infinity;
  const near = t => [0, 1, 2, 3, 4].sort((a, b) => Math.abs(a - t) - Math.abs(b - t) || a - b);
  const tidy = r => !ans.has(pbNorm(r[2])) && (srcs[r[5]] | 0) < cap;
  const usedAt = r => ctx.used.has(r[0]) ? ctx.used.get(r[0]) : -1;
  const PASSES = [[1, 1, 1], [1, 0, 1], [0, 1, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]];   // fresh, tidy, inside the level
  for(const t of plan){
    let row = null;
    for(const [fresh, neat, inside] of PASSES){
      for(const k of near(t)){
        if(inside && !keep.includes(k)) continue;
        const c = rows.filter(r => r[4] === k && !ctx.night.has(r[0]) && !(fresh && ctx.used.has(r[0])) && (!neat || tidy(r)));
        if(!c.length) continue;
        row = fresh ? c[Math.floor(rnd() * c.length)] : c.reduce((a, b) => usedAt(b) < usedAt(a) ? b : a);
        break;
      }
      if(row) break;
    }
    if(!row) break;
    ctx.night.add(row[0]); ans.add(pbNorm(row[2])); srcs[row[5]] = (srcs[row[5]] | 0) + 1;
    out.push(row);
  }
  return out.sort((a, b) => a[4] - b[4]);
}
/* a night from the host's choices. cfg: {rounds, per, level, pick, themes, paper, n, names} */
function pbBuild(pack, cfg, store, rnd, clubName){
  rnd = rnd || Math.random;
  const ids = pbChoose(pack.themes, cfg.rounds, cfg.pick ? cfg.themes : [], store.last, rnd);
  const ctx = { night: new Set(), used: new Map((store.used || []).map((id, i) => [id, i])) };
  const plan = PB_PLAN[cfg.level].slice(0, cfg.per);
  const rounds = ids.map(id => {
    const T = pbTheme(pack, id, clubName);
    const rows = pbDealRound(T.rows, plan, cfg.level, ctx, T.tag, rnd);
    return { t: id, name: T.name, line: T.line, rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4], T.tag && r[5] >= 0 ? pack.src[r[5]] : ""]) };
  });
  const teams = cfg.paper ? [] : Array.from({ length: cfg.n }, (_, i) => ({ n: pbTeamName(cfg.names, i), j: -1 }));
  return { rounds, paper: !!cfg.paper, level: cfg.level, teams, got: rounds.map(R => R.rows.map(() => 0)), r: 0, q: 0, shown: false, asked: false, view: "break", at: Date.now() };
}
const pbTeamName = (names, i) => String((names || [])[i] || "").trim() || PB_NAMES[i % PB_NAMES.length];
/* on the used list as its answer is shown, newest last, capped */
function pbUse(s, id, cap){
  const list = (s.used || []).filter(x => x !== id);
  list.push(id);
  s.used = list.slice(Math.max(0, list.length - (cap || PB_USED_CAP)));
}
/* a tap on a team: got it, or a mis-tap taken back */
function pbToggle(N, r, q, t){ N.got[r][q] ^= (1 << t); return !!(N.got[r][q] & (1 << t)); }
/* a team's joker: on this round, off again, or already spent on an earlier one */
function pbJokerSet(N, r, t){
  const T = N.teams[t];
  if(T.j >= 0 && T.j < r) return false;
  T.j = T.j === r ? -1 : r;
  return T.j === r;
}
const pbRoundPts = (N, r, t) => N.got[r].filter(m => m & (1 << t)).length * (N.teams[t].j === r ? 2 : 1);
/* the table after `upto` rounds. The most a team can have counts its own joker, so "of 40" never reads 44 of 40 */
function pbBoard(N, upto){
  const n = upto == null ? N.rounds.length : upto;
  const rows = N.teams.map((T, t) => {
    let pts = 0, max = 0;
    for(let r = 0; r < n; r++){ pts += pbRoundPts(N, r, t); max += N.rounds[r].rows.length * (T.j === r ? 2 : 1); }
    return { t, n: T.n, pts, max, j: T.j };
  }).sort((a, b) => b.pts - a.pts || a.t - b.t);
  rows.forEach((x, i) => { x.rank = i && rows[i - 1].pts === x.pts ? rows[i - 1].rank : i + 1; });
  return rows;
}
const pbQuestions = N => N.rounds.reduce((a, R) => a + R.rows.length, 0);
const pbMinutes = (rounds, per) => Math.round((rounds * per * 1.25 + rounds * 2) / 5) * 5;
const pbPlural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
/* the night, cut where it stands: an early finish still has a winner */
function pbCut(N){
  const asked = N.view === "play" ? N.q + (N.shown ? 1 : 0) : 0, n = N.r + (asked ? 1 : 0);
  N.rounds = N.rounds.slice(0, n); N.got = N.got.slice(0, n);
  if(asked){ N.rounds[n - 1] = Object.assign({}, N.rounds[n - 1], { rows: N.rounds[n - 1].rows.slice(0, asked) }); N.got[n - 1] = N.got[n - 1].slice(0, asked); }
  N.r = n; N.q = 0; N.shown = false;
  return n;
}
function pbShareText(N){
  const list = names => names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  let line;
  if(N.paper || !N.teams.length) line = pbPlural(N.rounds.length, "round") + ", " + pbPlural(pbQuestions(N), "question") + ", one quizmaster";
  else {
    const B = pbBoard(N), top = B.filter(x => x.rank === 1);
    line = top.length > 1 ? list(top.map(x => x.n)) + " tied on " + top[0].pts : top[0].n + " won with " + top[0].pts + " of " + top[0].max;
  }
  return "BALL · Pub Night: " + line + "\nYou read, they shout. Who’s hosting next week?\nballquiz.app";
}

/* ---------- the pack ---------- */
function pbLoad(){
  if(PBK) return Promise.resolve(PBK);
  return fetch("assets/pub/rounds.json").then(r => { if(!r.ok) throw new Error("pack"); return r.json(); }).then(j => { PBK = j; return j; });
}
/* the favourite club's round, if the pack has one */
function pbClub(){
  try{
    let k = null;
    try{ k = (acctLocal().fav || {}).club; }catch(e){}
    if(!k) k = (mine().fav || {}).club;
    if(!k || !PBK || !PBK.clubs[k]) return null;
    return { id: "club:" + k, name: listsClubName(k) };
  }catch(e){ return null; }
}

/* ---------- the way in ---------- */
function pbEnter(){
  const s = pubStore(), N = s.night;
  PB = null;
  if(N && N.view === "final" && !(Date.now() - (+N.at || 0) < PB_KEEP_FINAL_MS)){ s.night = null; pubSave(s); }
  else if(N && N.view === "final"){ PB = N; PUB_VIEW = "final"; }
  else if(N){ PUB_VIEW = "resume"; }
  if(!PB && PUB_VIEW !== "resume") pbSetupOpen(s);
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function pbSetupOpen(s){
  const c = (s || pubStore()).cfg || {}, names = (s || pubStore()).names;
  PBS = { rounds: PB_ROUNDS.includes(c.rounds) ? c.rounds : 4, per: PB_PER.includes(c.per) ? c.per : 8, level: PB_PLAN[c.level] ? c.level : "mixed", paper: c.paper !== false,
    n: PB_TEAMS.includes(c.n) ? c.n : 4, pick: false, themes: [], names: Array.isArray(names) ? names.slice(0, 8) : [] };
  PUB_VIEW = "setup";
}

/* ---------- the set-up ---------- */
function pbSet(k, v){
  audio();
  PBS[k] = v;
  if(k === "rounds" && PBS.themes.length > v) PBS.themes = PBS.themes.slice(0, v);
  render();
}
function pbName(i, v){ if(PBS){ PBS.names[i] = String(v || "").slice(0, 22); } }
function pbPick(id){
  audio();
  const t = PBS.themes, at = t.indexOf(id);
  if(at >= 0) t.splice(at, 1);
  else if(t.length >= PBS.rounds) return toast(pbPlural(PBS.rounds, "round") + ", so that many themes. Take one off first.");
  else t.push(id);
  render();
}
const pbSeg = (label, vals, cur, key, text) => b4Sec(label) + '<div class="b6seg pbseg" role="group" aria-label="' + esc(label) + '">' +
  vals.map(v => '<button aria-pressed="' + (v === cur) + '" onclick="pbSet(\'' + key + '\',' + (typeof v === "string" ? "'" + v + "'" : v) + ')">' + (text ? text(v) : v) + '</button>').join("") + '</div>';
function pbThemesHTML(){
  const c = PBS, chip = t => { const at = c.themes.indexOf(t.id) + 1;
    return '<button class="pbth' + (at ? " on" : "") + '" aria-pressed="' + !!at + '" onclick="pbPick(\'' + t.id + '\')">' + (at ? '<i>' + at + '</i>' : "") + esc(t.name) + '</button>'; };
  const mine = pbClub();
  return (mine ? '<div class="pbgroup"><small>Your club</small><div class="pbths">' + chip(mine) + '</div></div>' : "") +
    PB_GROUPS.map(g => '<div class="pbgroup"><small>' + esc(g[1]) + '</small><div class="pbths">' + PBK.themes.filter(t => t.g === g[0]).map(chip).join("") + '</div></div>').join("");
}
function pbSetupHTML(){
  const c = PBS, head = { title: "Pub Night", ctx: "Set the night up", back: "pbClose()", cls: "pbpage pb-setup" };
  if(!PBK) return b4Page(Object.assign(head, { ctx: "One moment" }));
  const left = c.rounds - c.themes.length;
  const pickHint = !c.pick ? (c.rounds >= 4 ? "A new mix every night, and the last round is the Surprise round." : "A new mix every night.")
    : !c.themes.length ? "Tap them in the order you want them." : left ? (left === 1 ? "One more to pick, or we’ll pick it for you." : left + " more to pick, or we’ll pick them for you.") : "That’s your night.";
  const names = Array.from({ length: c.n }, (_, i) => '<input class="partyname pbname" maxlength="22" placeholder="' + esc(PB_NAMES[i]) + '" aria-label="Team ' + (i + 1) + '" value="' + esc(String(c.names[i] || "")) + '" oninput="pbName(' + i + ',this.value)">').join("");
  return b4Page(Object.assign(head, { body:
    '<p class="pblead">You read, they shout. The phone is your card; everyone else needs a pen and a beer mat.</p>' +
    pbSeg("Rounds", PB_ROUNDS, c.rounds, "rounds") + pbSeg("Questions a round", PB_PER, c.per, "per") +
    pbSeg("How hard", PB_LEVELS.map(l => l[0]), c.level, "level", v => PB_LEVELS.find(l => l[0] === v)[1]) +
    '<p class="pbhint">' + esc(PB_LEVELS.find(l => l[0] === c.level)[2]) + '</p>' +
    b4Sec("Themes") + '<div class="b6seg pbseg" role="group" aria-label="Themes"><button aria-pressed="' + !c.pick + '" onclick="pbSet(\'pick\',false)">Surprise me</button><button aria-pressed="' + c.pick + '" onclick="pbSet(\'pick\',true)">We’ll pick</button></div>' +
    '<p class="pbhint">' + esc(pickHint) + '</p>' + (c.pick ? pbThemesHTML() : "") +
    b4Sec("Teams") + '<div class="b6seg pbseg pbsmall" role="group" aria-label="Teams"><button aria-pressed="' + c.paper + '" onclick="pbSet(\'paper\',true)">We’ll score on paper</button><button aria-pressed="' + !c.paper + '" onclick="pbSet(\'paper\',false)">Keep score here</button></div>' +
    (c.paper ? '<p class="pbhint">No scoring screens. You read, the beer mats do the rest.</p>'
      : '<div class="b6seg pbseg" role="group" aria-label="How many teams">' + PB_TEAMS.map(n => '<button aria-pressed="' + (n === c.n) + '" onclick="pbSet(\'n\',' + n + ')">' + n + '</button>').join("") + '</div><div class="partynames pbnames">' + names + '</div>') +
    '<p class="pbsum">' + pbPlural(c.rounds, "round") + ', ' + (c.rounds * c.per) + ' questions, about ' + pbMinutes(c.rounds, c.per) + ' minutes.</p>' +
    b4Btn("Start the night", "pbStart()", "gold") }));
}
function pbStart(){
  audio();
  if(!PBK || !PBS) return;
  const c = PBS, s = pubStore(), mine = pbClub();
  PB = pbBuild(PBK, c, s, null, mine ? mine.name : null);
  s.cfg = { rounds: c.rounds, per: c.per, level: c.level, paper: c.paper, n: c.n };
  s.names = c.names.map(n => String(n || "").trim());
  s.last = PB.rounds.map(R => R.t);
  s.night = PB;
  pubSave(s);
  pbScreenOn();
  pbTo("break");
}

/* ---------- carrying on ---------- */
function pbWhere(N){
  if(N.r >= N.rounds.length) return "All the rounds are done";
  return "Round " + (N.r + 1) + " of " + N.rounds.length + (N.view === "play" ? ", question " + (N.q + 1) : "");
}
function pbResumeHTML(){
  const N = pubStore().night;
  if(!N){ pbSetupOpen(); return pbSetupHTML(); }
  const B = N.teams.length ? pbBoard(N, Math.min(N.r, N.rounds.length)) : [], lead = B.length && B[0].pts ? B.filter(x => x.rank === 1) : [];
  const sub = pbWhere(N) + (lead.length === 1 ? ". " + lead[0].n + " lead on " + lead[0].pts + "." : ".");
  return b4Page({ title: "Pub Night", ctx: "Your night’s still going", back: "pbClose()", cls: "pbpage pb-resume", body:
    b4Q("Carry on where you left off?", esc(sub)) + '<div class="pbbreak"><small>' + esc(N.r < N.rounds.length ? "Up next" : "Last orders") + '</small><b>' + esc(N.r < N.rounds.length ? N.rounds[N.r].name : "The final scores") + '</b></div>' +
    b4Btn("Carry on", "pbCarryOn()", "gold") + b4Btn("Start a new night", "pbAskNew()", "quiet") });
}
function pbCarryOn(){
  audio();
  const N = pubStore().night;
  if(!N) return;
  PB = N;
  pbScreenOn();
  pbTo(N.view === "play" ? "play" : "break");
}
function pbAskNew(){
  audio();
  sheet('<h2>Start a new night?</h2><p>The one you left off goes in the bin.</p><button class="b4btn gold" onclick="closeSheet()">Keep it</button><button class="b4btn quiet pbonsheet" onclick="pbBinIt()">Start a new one</button>');
}
function pbBinIt(){
  audio(); closeSheet();
  pbForget();
  pbSetupOpen();
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function pbForget(){ const s = pubStore(); s.night = null; pubSave(s); PB = null; }

/* ---------- getting about ---------- */
function pbKeep(){ if(!PB) return; const s = pubStore(); s.night = PB; pubSave(s); }
function pbTo(view){
  pbClockStop();
  PB_POP = -1; PB_AGAIN = false;
  PUB_VIEW = view;
  if(PB){ PB.view = view; PB.at = Date.now(); pbKeep(); }
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function pbScreenOn(){ try{ wakeLock(); }catch(e){} }
/* the phone drops the screen lock when a call takes over */
try{ document.addEventListener("visibilitychange", () => { if(!document.hidden && PUB_VIEW === "play") pbScreenOn(); }); }catch(e){}
function pbClose(){
  pbClockStop();
  PUB_VIEW = null; PB = null; PBS = null;
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
/* ‹ undoes one step, always: a host always mis-taps */
function pbBack(){
  audio();
  const N = PB;
  if(!N) return pbClose();
  pbClockStop();
  if(N.view === "final") return pbTo("break");
  if(N.view === "break"){
    if(N.r > 0){ N.r--; N.q = N.rounds[N.r].rows.length - 1; N.shown = true; return pbTo("play"); }
    if(N.asked) return pbAskLeave();
    pbForget();
    if(!PBS) pbSetupOpen();
    PUB_VIEW = "setup"; render();
    return;
  }
  PB_POP = -1;
  if(N.shown){ N.shown = false; pbKeep(); return render(); }
  if(N.q > 0){ N.q--; N.shown = true; pbKeep(); return render(); }
  pbTo("break");
}
function pbAskLeave(){
  audio();
  sheet('<h2>Stop for now?</h2><p>Your place is kept. Open Pub Night and carry on.</p><button class="b4btn gold" onclick="closeSheet()">Keep going</button><button class="b4btn dark" onclick="pbStop()">Stop for now</button><button class="b4btn quiet pbonsheet" onclick="pbEndNight()">End the night</button>');
}
function pbStop(){ audio(); closeSheet(); pbKeep(); pbClose(); }
function pbEndNight(){
  audio(); closeSheet();
  if(!PB) return;
  if(!pbCut(PB)){ pbForget(); return pbClose(); }
  pbFinal();
}

/* ---------- the break: the round ahead, and from round two the swap ---------- */
function pbJoker(t){
  audio();
  if(PB && pbJokerSet(PB, PB.r, t)) try{ haptic("select"); }catch(e){}
  PB_POP = t;
  pbKeep(); render();
}
function pbJokersHTML(N){
  const btn = (T, t) => { const spent = T.j >= 0 && T.j < N.r, on = T.j === N.r;
    return '<button class="pbteam' + (on ? " on" : "") + (t === PB_POP ? " pop" : "") + '" aria-pressed="' + on + '"' + (spent ? " disabled" : "") + ' onclick="pbJoker(' + t + ')"><span>' + esc(T.n) + '</span><i>' + (spent ? "Played" : on ? "Doubled" : "Joker") + '</i></button>'; };
  return b4Sec("Joker on this round?") + '<div class="pbwho">' + N.teams.map(btn).join("") + '</div><p class="pbhint">One each, one round, double points.</p>';
}
const pbAnswersHTML = R => '<details class="pbagain"' + (PB_AGAIN ? " open" : "") + ' ontoggle="PB_AGAIN=this.open"><summary>All the answers again</summary><ol>' +
  R.rows.map(r => '<li><span>' + esc(r[1]) + '</span><b>' + esc(r[2]) + '</b></li>').join("") + '</ol></details>';
function pbScoresHTML(N){
  const r = N.r - 1, B = pbBoard(N, N.r);
  return b4Table(["", "Team", "Round", "Total"], B.map(x => ({ cells: [x.rank, esc(x.n) + (x.j === r ? '<i class="pbj" title="Joker">J</i>' : ""), pbRoundPts(N, r, x.t), '<b>' + x.pts + '</b>'] })));
}
function pbBreakHTML(){
  const N = PB, done = N.r >= N.rounds.length, R = N.rounds[N.r], prev = N.rounds[N.r - 1], scoring = !N.paper && N.teams.length;
  const cta = done ? (scoring ? "The final scores" : "That’s the night") : "Start round " + (N.r + 1);
  return b4Page({ title: "Pub Night", ctx: done ? "End of the night" : "Round " + (N.r + 1) + " of " + N.rounds.length, back: "pbBack()", leave: "pbAskLeave()", cls: "pbpage pb-break", body:
    (prev ? '<div class="pbswap"><b>Swap papers</b><small>That’s ' + esc(prev.name.replace(/^The /, "the ")) + ' done. Mark each other’s.</small></div>' + pbAnswersHTML(prev) + (scoring ? pbScoresHTML(N) : "") : "") +
    (R ? '<div class="pbbreak"><small>Round ' + (N.r + 1) + ', ' + pbPlural(R.rows.length, "question") + '</small><b>' + esc(R.name) + '</b><em>' + esc(R.line) + '</em></div>' : "") +
    (!prev ? '<p class="pblead">Phones away, pens out. No conferring with other tables.</p>' : "") +
    (R && scoring ? pbJokersHTML(N) : "") +
    b4Btn(cta, "pbBreakGo()", "gold") });
}
function pbBreakGo(){
  audio();
  const N = PB;
  if(!N) return;
  if(N.r >= N.rounds.length) return pbFinal();
  N.q = 0; N.shown = false;
  pbScreenOn();
  pbTo("play");
}

/* ---------- a question ---------- */
const pbTrk = () => "pb-" + PB.r + "-" + PB.q + (PB.shown ? "s" + PB.got[PB.r][PB.q] : "q");
const pbFit = (t, a, b) => t.length <= a ? " big" : t.length > b ? " long" : "";
function pbPlayHTML(){
  const N = PB, R = N.rounds[N.r], row = R.rows[N.q], last = N.q + 1 >= R.rows.length, scoring = !N.paper && N.teams.length;
  const tag = row[5] ? '<span class="pbtag">' + esc(row[5]) + '</span>' : "";
  const who = (T, t) => { const on = !!(N.got[N.r][N.q] & (1 << t));
    return '<button class="pbteam' + (on ? " on" : "") + (t === PB_POP ? " pop" : "") + '" aria-pressed="' + on + '" onclick="pbGot(' + t + ')"><span>' + esc(T.n) + '</span><i>' + (on ? "Got it" : "") + '</i></button>'; };
  const card = !N.shown
    ? '<div class="pbcard ask">' + tag + '<div class="pbq' + pbFit(row[1], 62, 92) + '">' + esc(row[1]) + '</div></div><div id="pbclock" class="pbclock" hidden></div>' +
      '<div class="pbacts">' + b4Btn("Show answer", "pbShow()", "gold") + '<button id="pbclockgo" class="pbquiet" onclick="pbClock()">Give them ' + PB_CLOCK_S + ' seconds</button></div>'
    : '<div class="pbcard said"><div class="pbq small">' + esc(row[1]) + '</div><div class="pba' + pbFit(row[2], 18, 34) + '">' + esc(row[2]) + '</div><div class="pbfact">' + esc(row[3]) + '</div></div>' +
      '<div class="pbacts">' + (scoring ? '<div class="pbwho' + (N.teams.length > 4 ? " tight" : "") + '" role="group" aria-label="Who got it">' + N.teams.map(who).join("") + '</div>' : "") +
      b4Btn(last ? "End of the round" : "Next question", "pbNext()", "gold") + '</div>';
  return b4Page({ title: R.name, ctx: "Round " + (N.r + 1) + " of " + N.rounds.length + " · Question " + (N.q + 1) + " of " + R.rows.length, back: "pbBack()", leave: "pbAskLeave()", cls: "pbpage pb-play" + (N.shown ? " shown" : "") + (PB_POP >= 0 ? " still" : ""), body:
    '<span hidden data-trk="' + pbTrk() + '"></span>' + card });
}
/* Show answer and Next sit in the same place, so a double tap on one mustn't also press the other */
function pbSettled(){ const now = Date.now(); if(now - PB_TAP < PB_SETTLE) return false; PB_TAP = now; return true; }
function pbShow(){
  audio();
  const N = PB;
  if(!N || N.shown || !pbSettled()) return;
  pbClockStop();
  N.shown = true; N.asked = true; PB_POP = -1;
  const row = N.rounds[N.r].rows[N.q], s = pubStore();
  pbUse(s, row[0]); s.night = N; pubSave(s);
  try{ haptic("select"); a11ySay(row[2] + ". " + row[3]); }catch(e){}
  render();
}
function pbGot(t){
  audio();
  if(!PB || !PB.shown) return;
  if(pbToggle(PB, PB.r, PB.q, t)) try{ haptic("select"); }catch(e){}
  PB_POP = t;
  pbKeep(); render();
}
function pbNext(){
  audio();
  const N = PB;
  if(!N || !N.shown || !pbSettled()) return;
  PB_POP = -1;
  if(N.q + 1 < N.rounds[N.r].rows.length){ N.q++; N.shown = false; pbKeep(); render(); try{ window.scrollTo(0, 0); }catch(e){} return; }
  N.r++; N.q = 0; N.shown = false;
  pbTo("break");
}
/* the clock, only when asked: thirty seconds, a tap stops it, nobody waits for it */
function pbClockStop(){ clearInterval(PB_TICK); PB_TICK = null; PB_LEFT = 0; }
function pbClockDraw(){
  try{
    const el = document.getElementById("pbclock");
    if(!el) return;
    el.hidden = !PB_TICK && PB_LEFT <= 0 && !el.dataset.done;
    el.innerHTML = PB_LEFT > 0 ? '<b>' + PB_LEFT + '</b><i style="--left:' + (PB_LEFT / PB_CLOCK_S) + '"></i>' : '<b>Time</b>';
    const go = document.getElementById("pbclockgo");
    if(go) go.textContent = PB_TICK ? "Stop the clock" : "Give them " + PB_CLOCK_S + " seconds";
  }catch(e){}
}
function pbClock(){
  audio();
  if(PB_TICK){ pbClockStop(); try{ const el = document.getElementById("pbclock"); if(el) el.hidden = true; document.getElementById("pbclockgo").textContent = "Give them " + PB_CLOCK_S + " seconds"; }catch(e){} return; }
  PB_LEFT = PB_CLOCK_S;
  pbClockDraw();
  PB_TICK = setInterval(() => {
    PB_LEFT--;
    if(PB_LEFT <= 0){ clearInterval(PB_TICK); PB_TICK = null; try{ document.getElementById("pbclock").dataset.done = "1"; whistlefx(1); haptic("wrong"); }catch(e){} }
    pbClockDraw();
  }, 1000);
}

/* ---------- the end ---------- */
function pbFinal(){
  PB.r = PB.rounds.length;
  pbTo("final");
  if(!PB.paper && PB.teams.length) try{ celebrate(3, { type: "pubWin", n: 80 }); ching(); }catch(e){}
}
function pbPodiumHTML(B){
  const step = x => x ? '<div class="pbstep s' + Math.min(x.rank, 3) + '"><span class="n">' + esc(x.n) + '</span><span class="p">' + x.pts + '</span><div class="blk">' + x.rank + '</div></div>' : "";
  return '<div class="pbpodium' + (B.length < 3 ? " two" : "") + '" aria-hidden="true">' + step(B[1]) + step(B[0]) + step(B[2]) + '</div>';
}
function pbFinalHTML(){
  const N = PB, head = { title: "Pub Night", ctx: "Full time", back: "pbBack()", cls: "pbpage pb-final" };
  const btns = b4Btn("Share", "pbShare()", "gold") + b4Btn("Another night", "pbAnother()", "dark") + b4Btn("Done", "pbDone()", "quiet");
  if(N.paper || !N.teams.length) return b4Page(Object.assign(head, { body:
    b4Q("That’s the night.", esc(pbPlural(N.rounds.length, "round") + " and " + pbPlural(pbQuestions(N), "question") + ". Add up the beer mats, and may the best table win.")) + btns }));
  const B = pbBoard(N), top = B.filter(x => x.rank === 1), one = top.length === 1;
  return b4Page(Object.assign(head, { body:
    b4Q(one ? esc(top[0].n) : "A tie at the top", one ? "won with " + top[0].pts + " of " + top[0].max : esc(top.map(x => x.n).join(" and ")) + ", on " + top[0].pts) +
    pbPodiumHTML(B) +
    b4Table(["", "Team", "Score"], B.map(x => ({ cells: [x.rank, esc(x.n) + (x.j >= 0 ? '<i class="pbj" title="Joker played">J</i>' : ""), '<b>' + x.pts + '</b> of ' + x.max] }))) + btns }));
}
function pbShare(){
  audio();
  if(!PB) return;
  try{ tlmEvent("share", { what: "pub" }); }catch(e){}
  const text = pbShareText(PB);
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}
function pbAnother(){ audio(); pbForget(); pbSetupOpen(); render(); try{ window.scrollTo(0, 0); }catch(e){} }
function pbDone(){ audio(); pbForget(); pbClose(); }

/* ---------- the screen ---------- */
function pbRender(st){
  try{ b6Tabs(null); }catch(e){}
  if(PUB_VIEW === "setup" && !PBS) pbSetupOpen();
  if(PUB_VIEW === "setup" && !PBK && !PBK_BUSY){
    PBK_BUSY = true;
    pbLoad().then(() => { PBK_BUSY = false; if(PUB_VIEW === "setup") render(); },
      () => { PBK_BUSY = false; if(PUB_VIEW === "setup"){ pbClose(); toast("That didn’t load. Try again in a moment.", true); } });
  }
  if(["break", "play", "final"].includes(PUB_VIEW) && !PB) PUB_VIEW = "setup";
  /* something landing while a question is up calls render(): the question stays where it is, and so does the clock */
  if(PUB_VIEW === "play" && PB){ try{ if(st.querySelector("[data-trk='" + pbTrk() + "']")){ b6Paper(true); return; } }catch(e){} }
  st.innerHTML = PUB_VIEW === "play" ? pbPlayHTML() : PUB_VIEW === "break" ? pbBreakHTML() : PUB_VIEW === "final" ? pbFinalHTML() : PUB_VIEW === "resume" ? pbResumeHTML() : pbSetupHTML();
}
