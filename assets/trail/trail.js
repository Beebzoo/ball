/* BALL 4 · TRANSFER TRAIL: the game (_plans/games-round.md, round 2). Follow a player's career move by move, one wrong step ends it.

   A player is named and you stand at his first club. "Where did he go next?", four clubs. Right and you move along the route, wrong
   and the run ends on the real rest of his career. Finish a career and a new man comes. The score is the moves you got right in
   the run. Three levels by fame, picked before a run. No clock: this one is for knowing, not for speed. Loaded by index.html
   (trlNeed) on the first open; the door, the store's load and save and the shelf's line are there, next to Club Expert's. A plain
   script with plain globals, like expert.js.

   THE SHAPE
     - assets/trail/ comes from _tools/build-trail.js: who's in it, the walk, and the three wrong clubs of every step, so a right
       answer can never be marked wrong and everyone gets the same options. The order is dealt here.
     - ball4-trail (trailStore, always read fresh): {v, best: {level: n}, runs: {level: n}, seen: {level: [Wikidata numbers]}}. best and
       runs follow the account (assets/sync/sync.js); seen is long and only a preference: it stays on the phone.
     - The rules are plain functions of the store and the rows (trlDeal, trlOptions, trlRecord…), so _tests/trail-test.js can run them.
     - TR is the run under way and TRD the last result; neither is saved. A reload is a run abandoned: the men it met are on seen,
       since they went on as they came up.
     - Steps are the permanent moves. A loan is never a step: it shows on the trail as a marked note before the question it comes
       ahead of, so nobody thinks it was missed.
     - The look is Career Path's route language: white roundels with a gold ring, our own patches, a solid gold line behind you and
       dashes ahead, and routeHTML itself on the cards that show a whole career. */

const TRL_LEVELS = [["easy", "Easy", "Household names"], ["normal", "Normal", "You’ll know most of them"], ["hard", "Hard", "The small print of football"]];
const TRL_TIER = { easy: "easy", normal: "normal", hard: "hard" };   // what a right answer is worth to progress
const TRL_RIGHT_MS = 620, TRL_WRONG_MS = 1700, TRL_RECENT = 40, TRL_STRIP_W = 330;

let TR = null, TRD = null, TRL_TIMER = null, TRL_BUSY = null;
const TRL_DATA = { clubs: null, rows: {} };

/* ---------- the rules ---------- */
const trlBest = (s, level) => ((s.best || {})[level]) | 0;
const trlRuns = (s, level) => ((s.runs || {})[level]) | 0;
/* a row of the pack, read: the stops with their clubs, the walk (which stops are permanent) and the options of each step */
function trlMan(r, clubs){
  const club = i => ({ slug: clubs[i][0], name: clubs[i][1], cc: clubs[i][2] });
  const stops = r[4].map(s => Object.assign(club(s[0]), { from: s[1], to: s[2] || null, loan: !!s[3] }));
  return { q: r[0], n: r[1], born: r[2], nat: r[3], stops, walk: stops.map((s, i) => s.loan ? -1 : i).filter(i => i >= 0), wrong: r[5].map(t => t.map(club)) };
}
/* a man you haven't met. When the level runs out, anyone but the last TRL_RECENT you met */
function trlDeal(rows, s, level, rnd){
  rnd = rnd || Math.random;
  const seen = new Set((s.seen || {})[level] || []);
  let free = rows.filter(r => !seen.has(r[0]));
  if(!free.length){
    const list = (s.seen || {})[level] || [], keep = new Set(list.slice(-Math.min(TRL_RECENT, Math.floor(rows.length / 2))));
    free = rows.filter(r => !keep.has(r[0]));
    if(!free.length) free = rows;
  }
  return free[Math.floor(rnd() * free.length)];
}
/* on the seen list as he comes up, so an abandoned run counts as met */
function trlMark(s, level, q, cap){
  s.seen = s.seen || {};
  const list = (s.seen[level] || []).filter(x => x !== q);
  list.push(q);
  s.seen[level] = cap ? list.slice(Math.max(0, list.length - cap)) : list;
}
/* the four clubs of step k: the next permanent stop and its three wrong ones, in an order of the run's own */
function trlOptions(M, k, rnd){
  rnd = rnd || Math.random;
  const out = [Object.assign({ right: true }, M.stops[M.walk[k + 1]])].concat(M.wrong[k].map(c => Object.assign({ right: false }, c)));
  for(let i = out.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
/* the loans between where he stands and his next permanent club: notes on the way, never a step */
function trlPassing(M, k){
  const from = M.walk[k], to = k + 1 < M.walk.length ? M.walk[k + 1] : M.stops.length;
  return M.stops.slice(from + 1, to);
}
/* a run over. A new best is a new best only above what's there, and the first run counts as one only if it scored */
function trlRecord(s, level, right){
  s.best = s.best || {}; s.runs = s.runs || {};
  const before = s.best[level] | 0, best = right > before;
  if(best) s.best[level] = right;
  s.runs[level] = (s.runs[level] | 0) + 1;
  return { best, before };
}

/* ---------- the pack ---------- */
function trlLoad(level){
  const get = u => fetch(u).then(r => { if(!r.ok) throw new Error(u); return r.json(); });
  return Promise.all([TRL_DATA.clubs ? TRL_DATA.clubs : get("assets/trail/clubs.json"), TRL_DATA.rows[level] ? TRL_DATA.rows[level] : get("assets/trail/" + level + ".json")])
    .then(([c, r]) => { TRL_DATA.clubs = c; TRL_DATA.rows[level] = r; });
}

/* ---------- the pieces ---------- */
const trlLevelName = l => (TRL_LEVELS.find(x => x[0] === l) || [])[1] || "";
const trlYears = s => s.from + (s.to && s.to !== s.from ? "–" + String(s.to).slice(-2) : !s.to ? "–" : "");
function trlPatch(slug, w){
  const dpr = (typeof devicePixelRatio === "number" && devicePixelRatio) || 1, u = crestURL(slug, "patch", Math.round(w * Math.min(dpr, 3)));
  return u ? '<img src="' + u + '" width="' + w + '" alt="">' : shieldSVG(slug);
}
const trlFlag = cc => cc ? '<img class="trlflag" src="' + ccFlag(cc) + '" alt="" onerror="this.remove()">' : "";
/* THE TRAIL: where he's been, on the gold line; where he stands, bigger; the loans on the way, smaller and dashed; a question mark;
   then a dot for every stop still to come. Too long for the phone, the oldest slide off to the left: you're looking ahead. */
function trlStrip(M, k, fresh){
  const at = M.walk[k], next = k + 1 < M.walk.length ? M.walk[k + 1] : M.stops.length;
  let h = "";
  M.stops.slice(0, next).forEach((s, i) => {
    const now = i === at;
    h += '<span class="trlst' + (s.loan ? " loan" : "") + (now ? " now" : "") + (now && fresh ? " fresh" : "") + '" title="' + esc(s.name) + (s.loan ? ", on loan" : "") + '">' + trlPatch(s.slug, now ? 44 : 24) + '</span>';
  });
  const left = Math.min(8, Math.max(0, M.walk.length - k - 2)), wide = next * 39 + 100 + left * 13 > TRL_STRIP_W;
  return '<div class="trlstrip' + (wide ? " far" : "") + '" aria-hidden="true"><div class="trlrun">' + h + (k + 1 < M.walk.length ? '<span class="trlst next">?</span>' : "") + Array.from({ length: left }, () => '<i></i>').join("") + '</div></div>';
}
/* a loan on the way, in words. Without this line a man who was at Vitesse would look like he was skipped */
function trlPassNote(M, k){
  const list = trlPassing(M, k);
  if(!list.length) return "";
  return '<div class="trlnote"><b>On loan first</b>' + list.map(s => '<span>' + esc(s.name + " " + trlYears(s)) + '</span>').join(", ") + '</div>';
}

/* ---------- the picker ---------- */
function trlPickHTML(){
  const s = trailStore(), any = TRL_LEVELS.some(l => trlBest(s, l[0]));
  const card = l => { const best = trlBest(s, l[0]), runs = trlRuns(s, l[0]);
    return '<button class="trllvl ' + l[0] + '" onclick="trlStart(\'' + l[0] + '\')"' + (TRL_BUSY === l[0] ? " disabled" : "") + '><span class="m"><b>' + l[1] + '</b><small>' + esc(TRL_BUSY === l[0] ? "One moment…" : l[2]) + '</small></span>' +
      '<span class="r"><b>' + (runs ? best : "–") + '</b><small>Best</small></span></button>'; };
  return b4Page({ title: "Transfer Trail", ctx: any ? "Your best runs" : "Pick a level", back: "trlBack()", cls: "trlpage trl-pick", body:
    '<p class="trllead">Follow a player’s career, move by move. Where did he go next? One wrong step ends the run.</p>' + TRL_LEVELS.map(card).join("") });
}

/* ---------- the run ---------- */
function trlRunHTML(){
  const M = TR.M, k = TR.k, shown = TR.shown, here = M.stops[M.walk[k]], nextYear = M.stops[M.walk[k + 1]].from;
  const opt = (o, i) => '<button class="h2opt trlopt' + (shown ? (o.right ? " right" : i === TR.pick ? " wrong" : " dim") : "") + '"' + (shown ? " disabled" : "") + ' onclick="trlAnswer(' + i + ')">' +
    '<span class="p">' + trlPatch(o.slug, 34) + '</span><span class="n">' + esc(o.name) + '</span></button>';
  return b4Page({ title: "Transfer Trail", ctx: trlLevelName(TR.level) + " · " + TR.right + (TR.right === 1 ? " move" : " moves"), back: "trlAskLeave()", leave: "trlAskLeave()", cls: "trlpage trl-run", body:
    '<span hidden data-trk="' + trlKey() + '"></span>' +
    '<div class="trlmid"><div class="trlman"><small>Born ' + M.born + trlFlag(M.nat) + '</small><b>' + esc(M.n) + '</b></div>' +
    trlStrip(M, k, TR.fresh) +
    '<div class="trlhere"><small>He’s at</small><b>' + esc(here.name) + '</b><em>' + trlYears(here) + '</em>' + trlFlag(here.cc) + '</div>' +
    trlPassNote(M, k) + '</div>' +
    '<div class="trlq"><b>Where did he go next?</b><small>' + nextYear + '</small></div>' +
    '<div class="trlopts">' + TR.opts.map(opt).join("") + '</div>' +
    '<div class="trlsay" role="status">' + esc(TR.say || "") + '</div>' });
}
const trlKey = () => TR.M.q + "-" + TR.k + (TR.shown ? "s" : "q");
function trlAnswer(i){
  if(!TR || TR.shown || TR.whole) return;
  audio();
  const o = TR.opts[i], ok = !!o.right;
  TR.shown = true; TR.pick = i;
  if(ok) TR.right++;
  try{ progAnswer({ ok, tier: TRL_TIER[TR.level], topic: "career" }); }catch(e){}
  try{ if(ok) fb.correct(null); else fb.wrong(null); }catch(e){}
  TR.say = ok ? "Right. " + TR.right + (TR.right === 1 ? " move." : " moves.") : "He went to " + TR.opts.find(x => x.right).name + ".";
  try{ a11ySay(TR.say); }catch(e){}
  render();
  trlTimer(ok ? trlAdvance : trlFinish, ok ? TRL_RIGHT_MS : TRL_WRONG_MS);
}
function trlTimer(f, ms){ clearTimeout(TRL_TIMER); const run = TR; TRL_TIMER = setTimeout(() => { if(TR === run && run) f(); }, ms); }
/* on to the next stop, or that's the whole career */
function trlAdvance(){
  if(!TR || !TR.shown) return;
  clearTimeout(TRL_TIMER);
  TR.k++; TR.shown = false; TR.pick = null; TR.say = ""; TR.fresh = true;
  if(TR.k >= TR.M.walk.length - 1){
    TR.whole = true; TR.careers++;
    TRL_VIEW = "whole"; render();
    try{ window.scrollTo(0, 0); celebrate(2, { type: "trailWhole" }); }catch(e){}
    return;
  }
  TR.opts = trlOptions(TR.M, TR.k);
  render();
}
/* THE WHOLE CAREER, seen through: a breath, the road you walked, and the next man at your thumb */
function trlWholeHTML(){
  const M = TR.M;
  return b4Page({ title: "Transfer Trail", ctx: trlLevelName(TR.level) + " · " + TR.right + (TR.right === 1 ? " move" : " moves"), back: "trlAskLeave()", leave: "trlAskLeave()", cls: "trlpage trl-whole", body:
    b4Q("Whole career", esc(M.n) + ", every move right.") + trlRoute(M, null) + b4Btn("Next player", "trlNextMan()", "gold") });
}
const trlRoute = (M, fresh) => routeHTML({ n: M.n, c: M.stops.map(s => s.slug), l: M.stops.map((s, i) => s.loan ? i : -1).filter(i => i >= 0) },
  { revealAll: true, fresh, names: Object.fromEntries(M.stops.map(s => [s.slug, s.name])) });
function trlNextMan(){
  if(!TR) return;
  audio();
  trlMeet();
  TRL_VIEW = "run"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
/* the next man: from the pack, past the seen list, on it at once */
function trlMeet(){
  const s = trailStore(), rows = TRL_DATA.rows[TR.level], r = trlDeal(rows, s, TR.level);
  trlMark(s, TR.level, r[0], rows.length); trailSave(s);
  const M = trlMan(r, TRL_DATA.clubs);
  Object.assign(TR, { M, k: 0, shown: false, pick: null, say: "", fresh: false, whole: false, opts: trlOptions(M, 0) });
}
/* a level picked: the pack first, then the run */
function trlStart(level){
  audio();
  if(TRL_BUSY) return;
  if(!TRL_DATA.clubs || !TRL_DATA.rows[level]){
    TRL_BUSY = level; render();
    return trlLoad(level).then(() => { TRL_BUSY = null; if(TRL_VIEW === "pick") trlStart(level); },
      () => { TRL_BUSY = null; render(); toast("That didn’t load. Try again in a moment.", true); });
  }
  try{ wakeLock(); }catch(e){}
  TR = { level, right: 0, careers: 0 };
  TRD = null;
  trlMeet();
  TRL_VIEW = "run"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function trlFinish(){
  if(!TR) return;
  clearTimeout(TRL_TIMER);
  const { level, right, careers, M, k } = TR, s = trailStore(), R = trlRecord(s, level, right);
  trailSave(s);
  try{ progSave(progLoad()); }catch(e){}
  try{ tlmEvent("trail_done", { level, right, careers }); }catch(e){}
  TRD = { level, right, careers, M, fell: TR.whole ? null : M.walk[k + 1], best: R.best, before: R.before };
  TR = null; TRL_VIEW = "done";
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  if(R.best && right >= 5) try{ celebrate(3, { type: "trailBest", n: 60 }); ching(); }catch(e){}
}
function trlAskLeave(){
  audio();
  if(TR && TR.shown) return;   // the answer is landing: a moment, and it's the next question or the end card
  sheet('<h2>End the run?</h2><p>' + (TR && TR.right ? "Your " + TR.right + (TR.right === 1 ? " move counts." : " moves count.") : "Nothing on the board yet.") + '</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep going</button><button class="b4btn quiet" onclick="trlLeave()">End it</button>');
}
function trlLeave(){ audio(); closeSheet(); if(TR){ TR.whole = true; trlFinish(); } }

/* ---------- the end card ---------- */
function trlDoneHTML(){
  const D = TRD, s = trailStore(), best = trlBest(s, D.level), lvl = trlLevelName(D.level);
  const sub = D.fell == null ? "You stopped there." : "He went to " + D.M.stops[D.fell].name + ".";
  return b4Page({ title: "Transfer Trail", ctx: lvl, back: "trlBack()", cls: "trlpage trl-done", body:
    '<div class="trlscore"><span><b>' + D.right + '</b>' + (D.right === 1 ? "move" : "moves") + '</span><span><b>' + D.careers + '</b>' + (D.careers === 1 ? "whole career" : "whole careers") + '</span><span class="g"><b>' + best + '</b>' + (D.best ? "new best" : "best") + '</span></div>' +
    b4Q(esc(D.M.n), esc(sub)) + trlRoute(D.M, D.fell) +
    b4Btn("Go again", "trlStart('" + D.level + "')", "gold") + b4Btn("Share", "trlShare()", "dark") + b4Btn("Change level", "trlBack()", "quiet") });
}

/* ---------- the share ---------- */
function trlShareText(D){
  return "BALL · Transfer Trail, " + trlLevelName(D.level) + "\n" + D.right + (D.right === 1 ? " move" : " moves") + " right" + (D.careers ? ", " + D.careers + (D.careers === 1 ? " whole career" : " whole careers") : "") +
    "\nOne wrong step and the run is over. How far can you follow?\nballquiz.app";
}
function trlShare(){
  audio();
  if(!TRD) return;
  try{ tlmEvent("share", { what: "trail" }); }catch(e){}
  const text = trlShareText(TRD);
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}

/* ---------- getting about ---------- */
function trlClose(){
  clearTimeout(TRL_TIMER);
  TRL_VIEW = null; TR = null; TRD = null;
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function trlBack(){
  audio();
  if(TRL_VIEW === "done"){ TRD = null; TRL_VIEW = "pick"; render(); return; }
  trlClose();
}

/* ---------- the screen ---------- */
function trlRender(st){
  /* something landing while a question is up calls render(): the question stays where it is */
  if(TRL_VIEW === "run" && TR && TR.opts){ try{ if(st.querySelector("[data-trk='" + trlKey() + "']")){ b6Paper(true); return; } }catch(e){} }
  if((TRL_VIEW === "run" || TRL_VIEW === "whole") && !TR) TRL_VIEW = "pick";
  if(TRL_VIEW === "done" && !TRD) TRL_VIEW = "pick";
  st.innerHTML = TRL_VIEW === "run" ? trlRunHTML() : TRL_VIEW === "whole" ? trlWholeHTML() : TRL_VIEW === "done" ? trlDoneHTML() : trlPickHTML();
  if(TR) TR.fresh = false;
}
