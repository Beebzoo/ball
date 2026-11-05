/* BALL 4 · FANBASE BATTLE: the page (_plans/games-round.md, round 4). A public table of Club Expert passes, club against club.

   Fans of a club push it up by passing that club's Expert test. The numbers are the server's, every one: supabase/migrations/
   020_fanbase.sql keeps a total per club from the ball4-expert saves, and fanbase_table hands out totals only. Nothing here is
   counted on the phone and nothing is made up: an empty table says it's empty and offers the first pass. Loaded by index.html
   (fanNeed) on the first open, after expert.js, whose patches and rules it uses; the door, the last good copy and the shelf's
   line are in index.html, next to Club Expert's. A plain script with plain globals, like expert.js. Expert's rules stay Expert's.

   THE SHAPE
     - FAN is the page: scope (week | all), land (null or one of Club Expert's eight), state (wait | ok | soon | off), data (the
       last answer), copy (true when data is an old one because the server can't be reached) and at (when it was read).
     - fanRows, fanLine, fanPlace, fanShareText and fanReset are plain functions of the table, so _tests/fanbase-test.js can run them.
     - Level clubs share a place. The order among them is all-time passes, then fans, then the slug, and that's only an order.
     - ball4-fanbase (fanbaseCache in the door): {t, sig, d}, the last good answer, three minutes before a page open asks again. It
       stays on the phone (assets/sync/sync.js, SYNC_NEVER) and holds nothing of the player's. sig is how many passes this phone had
       when it was read: a new pass reads again, after sending it up, so a player who just passed sees it land.
     - The page is honest about all of its bad days. No function on the server yet: state soon, "The table opens soon". No server
       and no copy: state off. No server with a copy: the copy, labelled. None of them is an error, and none reaches the rest of the app.
     - Club Expert stops at the medal, so a fan has three passes to give a club, ever. What the card offers follows from that: today's
       test, or tomorrow's, or (the medal won) bringing in another fan. A guest plays the same tests; their passes wait on the
       phone and reach the table, dates and all, when the club is founded (the sync, then the server's trigger). */

const FAN_TTL = 180000, FAN_ASK_MS = 9000, FAN_FLUSH_MS = 4000;
const FAN_TITLE = "Fanbase Battle", FAN_MIN_FANS = 3;     // a passes-a-fan figure from one or two fans says nothing

let FAN = { scope: "week", land: null, state: "wait", data: null, copy: false, at: 0, busy: false };

/* ---------- the table ---------- */
const fanPlural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
/* the clubs the app knows with a pass in this view, most first. place is shared by level clubs, and joint says so */
function fanRows(clubs, scope, land){
  const key = scope === "all" ? "all" : "week";
  const rows = (clubs || []).map(c => { const r = bankClub(c.slug); return r ? { slug: c.slug, cc: r[2], n: +c[key] || 0, week: +c.week || 0, all: +c.all || 0, medals: +c.medals || 0, fans: +c.fans || 0 } : null; })
    .filter(c => c && c.n > 0 && (!land || c.cc === land))
    .sort((a, b) => b.n - a.n || b.all - a.all || b.fans - a.fans || (a.slug < b.slug ? -1 : 1));
  rows.forEach((r, i) => {
    r.place = i && rows[i - 1].n === r.n ? rows[i - 1].place : i + 1;
    r.joint = (i > 0 && rows[i - 1].n === r.n) || (i + 1 < rows.length && rows[i + 1].n === r.n);
  });
  return rows;
}
const fanPlaceWord = me => me.joint ? (me.place === 1 ? "joint top" : "joint " + ordinal(me.place)) : me.place === 1 ? "top" : ordinal(me.place);
/* "Ajax are 3rd. 4 passes behind PSV." */
function fanLine(rows, slug, scope){
  const name = expLook(slug).name, me = rows.find(r => r.slug === slug), when = scope === "all" ? "" : " this week";
  if(!rows.length) return (scope === "all" ? "Nobody has passed yet. " : "Nobody has passed this week. ") + "One pass and " + name + " are top.";
  if(!me) return name + " aren’t on the board" + (scope === "all" ? " yet" : when) + ". One pass gets them on it.";
  const level = rows.filter(r => r.place === me.place && r.slug !== slug), above = rows.filter(r => r.place < me.place).pop();
  const gap = above ? fanPlural(above.n - me.n, "pass", "passes") + " behind " + expLook(above.slug).name : "";
  const who = level.length ? expLook(level[0].slug).name + (level.length > 1 ? " and " + fanPlural(level.length - 1, "other") : "") : "";
  if(me.place === 1){
    if(level.length) return name + " are joint top with " + who + ".";
    return rows.length > 1 ? name + " are top. " + fanPlural(me.n - rows[1].n, "pass", "passes") + " clear of " + expLook(rows[1].slug).name + "."
      : name + " are top, and nobody else is on the board.";
  }
  return level.length ? name + " are joint " + ordinal(me.place) + " with " + who + ". " + gap + "." : name + " are " + ordinal(me.place) + ". " + gap + ".";
}
/* the line to send: "BALL · Fanbase Battle: Ajax are 3rd this week" */
function fanShareText(rows, slug, scope){
  const name = expLook(slug).name, me = rows.find(r => r.slug === slug), when = scope === "all" ? " of all time" : " this week";
  return "BALL · " + FAN_TITLE + ": " + name + (me ? " are " + fanPlaceWord(me) + when : " need a pass" + when) + "\nballquiz.app";
}
/* when the week turns over: Monday 00:00 UTC, the day after the server's Sunday */
function fanReset(now){
  const t = now || Date.now(), end = Date.parse(fanbaseWeek(t) + "T00:00:00Z") + 7 * 864e5, h = Math.ceil((end - t) / 36e5), d = Math.floor((end - t) / 864e5);
  return "Resets Monday 00:00 UTC, " + (d >= 2 ? "in " + d + " days" : h >= 2 ? "in " + h + " hours" : "within the hour");
}

/* ---------- reading it ---------- */
/* how many passes this phone holds: a new one means the table we have is behind it */
function fanSig(){ let n = 0; try{ for(const c of Object.values(expertStore().clubs || {})) n += Object.keys((c && c.days) || {}).length; }catch(e){} return n; }
const fanMissing = r => { const e = (r && r.error) || {}; return (r && r.status === 404) || e.code === "PGRST202" || e.code === "42883" || /could not find the function|does not exist/i.test(String(e.message || "")); };
const fanLimit = (p, ms) => Promise.race([p, new Promise((ok, no) => setTimeout(() => no(new Error("slow")), ms))]);
/* a pass just made is on its way up (the sync waits up to 30 seconds): send it now, so the table about to be read has it */
async function fanFlush(){ try{ if(typeof syncRun === "function" && typeof syncPush === "function") await fanLimit(syncRun(() => syncPush()), FAN_FLUSH_MS); }catch(e){} }
function fanTake(d, sig){
  FAN.data = d; FAN.copy = false; FAN.state = "ok"; FAN.at = Date.now();
  try{ localStorage.setItem(FAN_KEY, JSON.stringify({ t: FAN.at, sig, d })); }catch(e){}
}
async function fanLoad(force){
  if(FAN.busy) return;
  const C = fanbaseCache(), sig = fanSig(), before = FAN.state + (FAN.copy ? "c" : "") + JSON.stringify(FAN.data);
  if(C && (!FAN.data || C.t > FAN.at)){ FAN.data = C.d; FAN.at = C.t; FAN.state = "ok"; }
  if(!force && C && Date.now() - C.t < FAN_TTL && C.sig === sig && C.d.week === fanbaseWeek()){ FAN.copy = false; return; }
  if(!FAN.data) FAN.state = "wait";
  FAN.busy = true;
  let r = null;
  try{
    if(C && C.sig !== sig) await fanFlush();
    const c = sbClient();
    if(c) r = await fanLimit(c.rpc("fanbase_table", {}), FAN_ASK_MS);
  }catch(e){ r = null; }
  FAN.busy = false;
  if(r && !r.error && r.data && r.data.ok && Array.isArray(r.data.clubs)) fanTake(r.data, sig);
  else if(fanMissing(r)){ FAN.state = "soon"; FAN.data = null; FAN.copy = false; }
  else if(FAN.data){ FAN.state = "ok"; FAN.copy = true; }
  else FAN.state = "off";
  if(FAN_VIEW && before !== FAN.state + (FAN.copy ? "c" : "") + JSON.stringify(FAN.data)) render();
}

/* ---------- your club ---------- */
/* your favourite when it's at the bar; otherwise the club you've given most passes */
function fanClub(){
  const f = expFav(); if(f) return f;
  const s = expertStore(); let best = null, n = 0;
  for(const k of Object.keys(s.clubs || {})){ const p = expPasses(expClubOf(s, k)); if(bankClub(k) && p > n){ best = k; n = p; } }
  return best;
}
const fanGuest = () => { try{ return fycTrial(); }catch(e){ return false; } };
function fanGuestHTML(){
  if(!fanGuest()) return "";
  const n = fanSig();
  return '<div class="fanguest"><p>Passes count for the table once you’ve founded your club.' + (n ? " Your " + (n === 1 ? "pass is" : n + " are") + " safe on this phone until then." : "") + '</p>' + b4Btn("Found your club", "openFyc()", "quiet") + '</div>';
}
/* what you can do for your club today: Club Expert's own state, since a test can't be taken twice in a day or after the medal */
function fanDoHTML(slug){
  const name = expLook(slug).name, st = expState(expClubOf(expertStore(), slug), dayKey());
  if(st === "open") return b4Btn("Pass a test for " + esc(name), "fanTest('" + slug + "')", "gold");
  const say = st === "medal" ? "You’ve got the medal, so all three of your passes are in. Now it takes another fan." : "You’ve passed for " + esc(name) + " today. Your next one opens tomorrow.";
  return '<p class="fansay">' + say + '</p>' + b4Btn("Bring another fan", "fanShare()", "gold") + b4Btn("Pass for another club", "fanTest()", "dark");
}
function fanMineHTML(rows){
  const slug = fanClub();
  if(!slug) return '<div class="fanme"><div class="fanmeh"><div class="fanmen"><small>Your club</small><b>Pick one</b></div></div><p class="fanline">Every pass pushes a club up this table. Which one’s yours?</p>' + b4Btn("Pick a club", "fanTest()", "gold") + '</div>';
  const me = rows.find(r => r.slug === slug), L = expLook(slug);
  return '<div class="fanme"><div class="fanmeh">' + expPatch(slug, 46) + '<div class="fanmen"><small>Your club</small><b>' + esc(L.name) + '</b></div>' +
    (me ? '<div class="fanmep"><b>' + (me.place === 1 ? "Top" : ordinal(me.place)) + '</b><small>' + (me.joint ? "joint" : FAN.scope === "all" ? "all time" : "this week") + '</small></div>' : "") + '</div>' +
    '<p class="fanline">' + esc(fanLine(rows, slug, FAN.scope)) + '</p>' + fanDoHTML(slug) +
    (me && expState(expClubOf(expertStore(), slug), dayKey()) === "open" ? b4Btn("Share where they stand", "fanShare()", "quiet") : "") + '</div>';
}

/* ---------- the page ---------- */
function fanSegHTML(){
  return '<div class="lgseg lgseg2 fanseg" role="group" aria-label="Which table">' + [["week", "This week"], ["all", "All time"]].map(t =>
    '<button aria-pressed="' + (FAN.scope === t[0]) + '" onclick="fanScope(\'' + t[0] + '\')">' + t[1] + '</button>').join("") + '</div>';
}
function fanLandsHTML(){
  const chip = (k, label, art) => '<button aria-pressed="' + (FAN.land === k) + '" onclick="fanLand(' + (k ? "'" + k + "'" : "null") + ')">' + (art || "") + '<span>' + esc(label) + '</span></button>';
  return '<div class="fanlands" role="group" aria-label="Filter by league">' + chip(null, "All") + EXP_LANDS.map(([k, name]) => chip(k, name, compBadge(CLUB_LEAGUE[k], 22))).join("") + '</div>';
}
function fanRowHTML(r, mine, scope){
  const name = expLook(r.slug).name, medals = r.medals ? " · " + fanPlural(r.medals, "medal") : "", each = scope === "all" && r.fans >= FAN_MIN_FANS ? " · " + (r.all / r.fans).toFixed(1) + " a fan" : "";
  return '<li class="fanli' + (mine ? " me" : "") + '"><button class="fanrow" onclick="fanTest(\'' + r.slug + '\')" aria-label="' + esc(name + ", " + (r.n ? "place " + r.place + ", " + fanPlural(r.n, "pass", "passes") : "no passes yet") + ", " + fanPlural(r.fans, "fan") + ". Take the test") + '">' +
    '<span class="fanpos">' + (r.n ? (r.joint ? "=" : "") + r.place : "–") + '</span>' + expPatch(r.slug, 28) +
    '<span class="fannm"><b>' + esc(name) + '</b><small>' + fanPlural(r.fans, "fan") + medals + each + '</small></span><span class="fann">' + r.n + '</span></button></li>';
}
function fanTableHTML(rows, scope){
  const slug = fanClub(), landOk = slug && (!FAN.land || bankClub(slug)[2] === FAN.land), off = landOk && rows.length && !rows.some(r => r.slug === slug);
  const zero = off ? fanRowHTML({ slug, n: 0, fans: fanZeroFans(slug), medals: 0, all: 0 }, true, scope) : "";
  return '<ol class="fantable"><li class="fanhd" aria-hidden="true"><span>#</span><span>Club</span><span>Passes</span></li>' + rows.map(r => fanRowHTML(r, r.slug === slug, scope)).join("") + zero + '</ol>';
}
/* your club's row when it has no pass in this view: its fans are still its fans (this week's empty, all time isn't) */
function fanZeroFans(slug){ const c = ((FAN.data && FAN.data.clubs) || []).find(x => x.slug === slug); return c ? +c.fans || 0 : 0; }
/* every club at the bar with nothing yet in this view: real clubs, real zeros, and a tap goes to the test */
function fanWallHTML(rows, overall){
  const on = new Set(rows.map(r => r.slug)), slug = fanClub(), pinned = rows.length && slug && !on.has(slug);
  const list = BANK_CLUBS.filter(r => clubExpertReady(r) && !on.has(r[0]) && (!FAN.land || r[2] === FAN.land) && !(pinned && r[0] === slug)).map(r => r[0]);
  if(!list.length) return "";
  return '<div class="b6hdr fanh">' + (overall ? "Still to get off the mark" : "No pass yet") + '<span>' + list.length + '</span></div><div class="fanwall">' +
    list.map(k => '<button onclick="fanTest(\'' + k + '\')" aria-label="' + esc(expLook(k).name + ", no passes yet. Take the test") + '">' + expPatch(k, 32) + '</button>').join("") + '</div>';
}
function fanEmptyHTML(){
  const scope = FAN.scope, land = FAN.land && EXP_LANDS.find(l => l[0] === FAN.land)[1];
  const who = land ? "No club from " + land + " has a pass" : "Nobody has passed";
  return '<p class="fanempty"><b>' + esc(who) + (scope === "all" ? " yet" : " this week") + '.</b>The first pass puts its club top' + (land ? " of " + esc(land) : "") + ', with its name on the table for everyone to see.</p>';
}
const fanHowHTML = () => '<div class="fanhow"><p><b>A pass</b> is a Club Expert test passed: one a club a day, three from each fan, because the third earns the medal.</p><p><b>A fan</b> is an account with at least one pass for that club. No names here, only totals.</p><p><b>Big clubs start ahead</b>, they have more fans. On All time, “a fan” shows how far a club’s fans go.</p></div>';
function fanCopyHTML(){
  if(!FAN.copy) return "";
  let at = ""; try{ at = new Date(FAN.at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }catch(e){}
  return '<p class="fancopy">Last good copy' + (at ? ", " + esc(at) : "") + '. It’ll bring itself up to date when you’re back online.</p>';
}
const fanBare = (title, sub) => '<div class="fanbare"><b>' + title + '</b><p>' + sub + '</p></div>' + (fanClub() ? b4Btn("Pass a test for " + esc(expLook(fanClub()).name), "fanTest('" + fanClub() + "')", "gold") : b4Btn("Pick a club", "fanTest()", "gold")) + fanGuestHTML();
function fanRender(st){
  let body, ctx = "Club against club";
  if(FAN.state === "soon") body = fanBare("The table opens soon", "Clubs will meet here, ranked by their fans’ Club Expert passes. Every pass you make now will be on it from day one.");
  else if(FAN.state === "off") body = fanBare("The table needs a connection", "It lives on the server. Your passes are safe, and it’ll be here when you’re back online.");
  else if(!FAN.data) body = '<p class="fancopy">Reading the table…</p>';
  else {
    const all = fanRows(FAN.data.clubs, FAN.scope), rows = FAN.land ? fanRows(FAN.data.clubs, FAN.scope, FAN.land) : all;
    ctx = FAN.scope === "all" ? "All time" : "Week of " + fanWeekLabel(FAN.data.week);
    body = fanCopyHTML() + fanMineHTML(all) + fanGuestHTML() + fanSegHTML() +
      '<p class="fanreset">' + esc(FAN.scope === "all" ? "Every pass since Club Expert began" : FAN.data.week === fanbaseWeek() ? fanReset() : "A new week has started since this was read") + '</p>' + fanLandsHTML() +
      (rows.length ? fanTableHTML(rows, FAN.scope) : fanEmptyHTML()) + fanWallHTML(rows, !!rows.length) + fanHowHTML();
  }
  st.innerHTML = b4Page({ title: FAN_TITLE, ctx, back: "fanBack()", cls: "fanpage", body });
  expFill();
  fanChipInView();
  if(!CLUBID) setTimeout(() => { if(FAN_VIEW) render(); }, 600);
}
/* the leagues run off the side of a phone, and the page was just redrawn: the one you chose stays where you can see it */
function fanChipInView(){
  try{ const on = FAN.land && document.querySelector(".fanlands [aria-pressed='true']");
    if(on && on.parentNode) on.parentNode.scrollLeft = on.offsetLeft - (on.parentNode.clientWidth - on.offsetWidth) / 2; }catch(e){}
}
const fanWeekLabel = w => { try{ return new Date(w + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); }catch(e){ return w; } };

/* ---------- getting about ---------- */
function fanOpened(){ fanLoad(); }
function fanScope(s){ audio(); try{ haptic("select"); }catch(e){} FAN.scope = s === "all" ? "all" : "week"; render(); }
function fanLand(k){ audio(); try{ haptic("select"); }catch(e){} FAN.land = k || null; render(); }
/* into Club Expert: a club's page, or the picker with none. Back from there comes back here (expClose, expBack) */
function fanTest(slug){
  audio();
  expertSeen();
  b4Explain("expert", () => {
    FAN_VIEW = null; EXP_FROM = "fanbase"; EXP_VIEW = "pick"; ME_VIEW = null; LOCKER_VIEW = null; closeSheet();
    if(slug) return expPick(slug);
    render();
    try{ window.scrollTo(0, 0); }catch(e){}
  });
}
function fanBack(){
  audio();
  const from = FAN_FROM;
  FAN_VIEW = null; FAN_FROM = null;
  if(from){ EXP_FROM = "home"; EXP_VIEW = "pick"; return expPick(from); }
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function fanShare(){
  audio();
  try{ tlmEvent("share", { what: "fanbase" }); }catch(e){}
  const slug = fanClub();
  const text = slug ? fanShareText(fanRows((FAN.data || {}).clubs, FAN.scope), slug, FAN.scope) : "BALL · " + FAN_TITLE + "\nballquiz.app";
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}
