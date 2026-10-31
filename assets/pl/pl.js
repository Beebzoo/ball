/* BALL 4 · CALL IT: the prediction league's screens.
   _plans/call-it.md (§13, stage 4); the look is _plans/call-it/06-ux.md and its mock-up.

   Loaded by index.html (plNeed) the first time the League tab's Predictions
   segment opens, behind PL_ON, after assets/pl/pl-scoring.js; the styles are
   assets/pl/pl.css, the teams' patches assets/pl/teams.json. A plain script
   with plain globals like the rest of the app, so the screens' onclick=""
   reach them; everything here is cl / CL.

   THE SERVER IS 009_call_it.sql's PLAYER API AND NOTHING ELSE: pl_my_cards,
   pl_card, pl_save_calls, pl_my_leagues, pl_league_table, pl_card_board,
   pl_create_league, pl_league_preview, pl_join, pl_leave. Every write answers
   {ok, code}. The server's clock and kick-off decide what is still open; this
   file only greys a match out early, it never decides.

   A CALL IS KEPT ON THE PHONE FIRST (ball4-pl-pend) and sent a moment later,
   so closing the app never loses one; until the server has it the screen says
   "not sent yet". A call the server turns down because its match has kicked
   off is dropped, and the player is told.

   THE SCREENS are LEAGUE_VIEW.cl.s: home (the Predictions segment), card (call
   the matches), calls (your calls and lock in), new, invite, join, table and
   reveal (the calls are in). Copy rule (06-ux.md): no gambling words, ever. */

var CL = { cards: null, card: {}, leagues: null, table: {}, board: {}, teams: null, skew: 0, err: null,
  loading: false, at: 0, i: {}, idWait: 0, asked: {}, mc: {}, mcErr: null };
const CL_PEND = "ball4-pl-pend", CL_SEEN = "ball4-pl-seen";
const CL_QUICK = [[1, 0], [2, 0], [2, 1], [3, 1], [1, 1], [0, 0], [2, 2], [0, 1], [1, 2], [0, 2]];
/* the series a new league can play (013_more_competitions.sql); the Card of the week only once there is one */
const CL_SERIES = [
  { id: "week", name: "Card of the week", sub: "BALL's ten best: Eredivisie and Premier League" },
  { id: "DED", name: "Eredivisie", sub: "every round" },
  { id: "PL", name: "Premier League", sub: "every round" },
  { id: "CL", name: "Champions League", sub: "the league stage" },
  { id: "PD", name: "LaLiga", sub: "every round" },
  { id: "SA", name: "Serie A", sub: "every round" },
  { id: "BL1", name: "Bundesliga", sub: "every round" },
  { id: "FL1", name: "Ligue 1", sub: "every round" },
  { id: "NL2", name: "Eerste Divisie", sub: "every round" },
  { id: "BE1", name: "Belgian Pro League", sub: "every round" } ];

/* ---------- small things ---------- */
const clV = () => (typeof LEAGUE_VIEW !== "undefined" && LEAGUE_VIEW && LEAGUE_VIEW.cl) || { s: "home" };
const clOn = () => typeof LEAGUE_VIEW !== "undefined" && !!LEAGUE_VIEW && LEAGUE_VIEW.seg === "pl";
const clNow = () => Date.now() + CL.skew;
const clStr = v => String(v == null ? "" : v);
const clE = v => esc(clStr(v));
const clPad = n => String(n).padStart(2, "0");
const CL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const clDay = ms => { const d = new Date(ms); return CL_DAYS[d.getDay()] + " " + clPad(d.getHours()) + ":" + clPad(d.getMinutes()); };
const clTime = ms => { const d = new Date(ms); return clPad(d.getHours()) + ":" + clPad(d.getMinutes()); };
const clOpen = f => !!f && !!f.open && f.ko > clNow();
const clCode = c => clStr(c).slice(0, 3) + " " + clStr(c).slice(3);
/* a load a screen asks for while it draws: once in a while, never in a loop when the server is away */
function clOnce(key, ms){ const t = CL.asked[key] || 0; if(Date.now() - t < (ms || 30000)) return false; CL.asked[key] = Date.now(); return true; }
/* draw again when an answer arrives in the background, but never under someone typing a name or a code */
function clRedraw(){ if(clOn() && !/^(new|join)$/.test(clV().s)) render(); }
/* a club's colour for a bar or a stripe: its first kit colour, or the second when the first is white */
function clKit(T){
  const o = T.own || {}, c1 = clStr(o.c1 || "#2a4a36").toLowerCase();
  return /^#(f[a-f0-9]){3}$/.test(c1) ? (o.c2 || "#2a4a36") : c1;
}
/* the ink that reads on a colour: dark on a light kit (Fortuna's yellow), white on the rest */
function clInk(c){
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(clStr(c));
  if(!m) return "#fff";
  return (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 1000 > 150 ? "#0b2416" : "#fff";
}
const clReduced = () => { try{ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; } };
/* the card's matches that count (a match moved out of the card's days doesn't) */
const clF = id => ((CL.card[id] && CL.card[id].fixtures) || []).filter(f => f.in !== false);
/* how long until ms: [the figure, its label]. "3h 05m", never "3:05 hrs left", which reads as a time of day
   (_plans/look-and-feel.md §3, the countdown: a kicker label over a 900i tabular figure) */
function clLeft(ms){
  const s = Math.max(0, Math.floor((ms - clNow()) / 1000));
  if(s >= 48 * 3600) return [Math.floor(s / 86400) + " days", "Kick-off in"];
  if(s >= 3600) return [Math.floor(s / 3600) + "h " + clPad(Math.floor(s % 3600 / 60)) + "m", "Kick-off in"];
  return [Math.max(1, Math.ceil(s / 60)) + " min", "Kick-off in"];
}

async function clRpc(fn, args){
  const sb = sbClient(); if(!sb) throw new Error("no server");
  const r = await sb.rpc(fn, args || {});
  if(r.error) throw r.error;
  const d = r.data || {};
  if(d.server_now) CL.skew = d.server_now - Date.now();
  return d;
}

/* ---------- the clubs: BALL's own patch for every team, never a real crest ---------- */
function clTeamsLoad(){
  if(CL.teams || CL.teamsAsked) return;
  CL.teamsAsked = true;
  try{ fetch("assets/pl/teams.json").then(r => r.json()).then(j => { CL.teams = (j && j.teams) || {}; clRedraw(); }).catch(() => { CL.teams = {}; }); }
  catch(e){ CL.teams = {}; }
}
/* a server team {key: "af:209", name} → its name on the cards, its code and its identity */
function clTeam(t){
  const e = (CL.teams || {})[t && t.key] || null;
  const name = clStr((e && e.n) || (t && t.name) || "?");
  const own = e && e.s ? clubOf(e.s) : e && e.c ? e.c : null;
  const code = clStr((own && own.code) || name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase());
  return { name, code, slug: e && e.s ? e.s : null, own, key: clStr(t && t.key) };
}
function clPatch(t, px){
  const T = clTeam(t);
  /* a club from clubs-identity.json waits for that file (it comes with the app); one of
     teams.json's own, or a team nobody mapped, is drawn from what is here */
  const ident = T.own || (T.slug ? null : { name: T.name, code: T.code, c1: "#5a6470", c2: "#ffffff", p: "plain" });
  const u = ident ? crestURL(T.slug || "pl|" + T.key, "patch", Math.round(px * 3), ident) : null;
  if(u) return '<img class="cl-patch" src="' + u + '" alt="" style="width:' + px + 'px">';
  if(T.slug && !T.own) clIdWait();
  const c = ident || { c1: "#2a4a36", c2: "#F8F1DD" };
  return '<span class="cl-patch cl-nop" style="width:' + px + 'px;height:' + Math.round(px * 1.15) + 'px;background:' + c.c1 + ';color:' + c.c2 +
    ';font-size:' + Math.round(px * .3) + 'px">' + clE(T.code) + '</span>';
}
/* clubs-identity.json arrives with the app; draw again once it is here (a few tries, no more) */
function clIdWait(){
  if(CL.idWait > 8 || CL.idWaitT) return;
  CL.idWait++;
  CL.idWaitT = setTimeout(() => { CL.idWaitT = null; if(typeof CLUBID !== "undefined" && CLUBID) clRedraw(); else clIdWait(); }, 700);
}
/* a member's club (Found your club), or their initials on a plain shield */
function clCrest(r, px){
  if(r && r.club){ try{ return clubCrestSVG(r.club, px, { mini: true }); }catch(e){} }
  const n = clStr(r && r.display_name).replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";
  return '<span class="cl-init" style="width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * .4) + 'px">' + clE(n) + '</span>';
}

/* ---------- the calls, on the phone first ---------- */
const clPend = () => { try{ return JSON.parse(localStorage.getItem(CL_PEND)) || {}; }catch(e){ return {}; } };
const clPendPut = p => { try{ localStorage.setItem(CL_PEND, JSON.stringify(p)); }catch(e){} };
/* my calls on a card as the screen shows them: the server's, with what hasn't gone yet on top */
function clMine(id){
  const k = CL.card[id], m = (k && k.mine) || {}, p = clPend()[id] || {};
  const calls = Object.assign({}, m.calls || {}, p.c || {});
  return { calls, arm: p.a ? p.a.f : (m.armband == null ? null : m.armband), wait: Object.keys(p.c || {}).length + (p.a ? 1 : 0),
    points: m.points || {}, total: m.total || null };
}
function clPut(id, fid, h, a){
  const p = clPend(), c = p[id] || (p[id] = {});
  c.c = c.c || {}; c.c[fid] = [h, a];
  clPendPut(p); clFlushSoon();
}
let clFlushT = null, clFlushing = false;
function clFlushSoon(ms){ clearTimeout(clFlushT); clFlushT = setTimeout(() => { clFlush(); }, ms == null ? 600 : ms); }
/* send what is waiting. A change made while a save is on its way stays for the next one. */
async function clFlush(){
  if(clFlushing){ clFlushSoon(800); return false; }
  const sb = sbClient(); if(!sb) return false;
  clFlushing = true;
  let all = true;
  try{
    const sent = clPend();
    for(const id of Object.keys(sent)){
      const c = sent[id], calls = Object.keys(c.c || {}).map(f => ({ f: +f, h: c.c[f][0], a: c.c[f][1] }));
      if(!calls.length && !c.a){ clPendDrop(id, c); continue; }
      let d;
      try{
        const r = await sb.rpc("pl_save_calls", { p_card: +id, p_calls: calls, p_armband: c.a || null });
        if(r.error){ all = false; continue; }
        d = r.data || {};
      }catch(e){ all = false; continue; }
      if(d.server_now) CL.skew = d.server_now - Date.now();
      if(!d.ok){
        all = false;
        if(d.code === "found_club") clFoundClub();            // kept: they go once the club is founded
        else if(d.code === "not_found" || d.code === "bad") clPendDrop(id, c);
        continue;                                              // slow_down, not_signed_in: kept for later
      }
      const k = CL.card[id], late = (d.locked || []).map(Number);
      if(k){
        k.mine = k.mine || {}; k.mine.calls = k.mine.calls || {};
        calls.forEach(x => { if(!late.includes(x.f)) k.mine.calls[x.f] = [x.h, x.a]; });
        if(c.a){
          if(d.armband === "on") k.mine.armband = c.a.f;
          else if(d.armband === "off") k.mine.armband = null;
        }
      }
      if(late.length) clLate(id, late);
      if(c.a && d.armband && d.armband !== "on" && d.armband !== "off") clArmSaid(d.armband);
      clPendDrop(id, c);
    }
  }finally{ clFlushing = false; }
  clRedraw();
  return all;
}
function clPendDrop(id, sentC){
  const p = clPend(), c = p[id];
  if(!c) return;
  Object.keys(sentC.c || {}).forEach(f => { const now = c.c && c.c[f], was = sentC.c[f]; if(now && now[0] === was[0] && now[1] === was[1]) delete c.c[f]; });
  if(sentC.a && c.a && c.a.f === sentC.a.f) delete c.a;
  if(!Object.keys(c.c || {}).length && !c.a) delete p[id];
  clPendPut(p);
}
function clLate(id, late){
  const F = (CL.card[id] && CL.card[id].fixtures) || [];
  const f = F.find(x => late.includes(+x.id));
  if(late.length === 1 && f) toast("Too late for " + clTeam(f.home).name + " v " + clTeam(f.away).name + ": it has kicked off.", true);
  else toast("Too late for " + late.length + " matches: they have kicked off.", true);
  late.forEach(fid => { const x = F.find(y => +y.id === fid); if(x) x.open = false; });
}
function clArmSaid(code){
  toast(({ played: "The armband stays where it is: that match has kicked off.",
           locked: "Too late for the armband there: that match has kicked off.",
           needs_quiz: "Play the Matchday Quiz first to unlock the armband." })[code] || "The armband didn't move.", true);
}
let clClubAsked = 0;
function clFoundClub(){
  if(Date.now() - clClubAsked < 60000) return;
  clClubAsked = Date.now();
  sheet('<h2>Found your club to keep calling</h2><p class="pgsheetp">Guests call three rounds. Found your club (it takes a minute) and ' +
    'your calls go in the table, with your crest next to them. What you called is kept on this phone until then.</p>' +
    '<button class="bigbtn" onclick="closeSheet();openFyc()">Found your club</button><button class="acnot" onclick="closeSheet()">Later</button>');
}

/* ---------- loading ---------- */
/* WHAT THE HOME SAYS ABOUT CALL IT (house style v2, board G), kept on the phone so the home can say it without
   loading Call It: the round in play, how many calls are left and when the next one locks */
function clStripSave(){
  try{
    const c = (CL.leagues || []).length ? clTop() : null;
    if(!c){ localStorage.removeItem("ball4-pl-strip"); return; }
    localStorage.setItem("ball4-pl-strip", JSON.stringify({ at: Date.now(), label: c.label, matches: c.matches | 0, called: c.called | 0, open: c.open | 0, lock: c.next_lock || null }));
  }catch(e){}
}
async function clLoad(force){
  clTeamsLoad();
  if(CL.loading) return;
  if(!force && CL.cards && Date.now() - CL.at < 30000) return;
  CL.loading = true; CL.err = null;
  try{
    const [a, b] = await Promise.all([clRpc("pl_my_cards"), clRpc("pl_my_leagues")]);
    if(!a.ok || !b.ok) throw new Error("not ok");
    CL.cards = a.cards || []; CL.leagues = b.leagues || []; CL.at = Date.now();
    clStripSave();
    const top = clTop();
    if(top){
      await clLoadCard(top.card, true);
      const lg = CL.leagues.find(l => l.series === top.series);
      if(lg) await clLoadBoard(lg.id, top.card, true);
    }
  }catch(e){ CL.err = "Not available right now."; }
  CL.loading = false;
  clFlush();
  clRedraw();
}
async function clLoadCard(id, quiet){
  try{ const d = await clRpc("pl_card", { p_card: +id }); if(d.ok) CL.card[id] = d; else if(!quiet) CL.err = "That round isn't there any more."; }
  catch(e){ if(!quiet) CL.err = "Not available right now."; }
  if(!quiet) clRedraw();
}
async function clLoadBoard(league, card, quiet){
  try{ const d = await clRpc("pl_card_board", { p_league: league, p_card: +card }); if(d.ok) CL.board[league + ":" + card] = d; }catch(e){}
  if(!quiet) clRedraw();
}
async function clLoadTable(league){
  try{ const d = await clRpc("pl_league_table", { p_league: league }); if(d.ok) CL.table[league] = d; else CL.err = "You're not in that league any more."; }
  catch(e){ CL.err = "Not available right now."; }
  clRedraw();
}
/* the card to call next: the one whose next kick-off comes first, else the first one */
function clTop(){
  const c = (CL.cards || []).slice();
  const open = c.filter(x => x.open > 0 && x.next_lock).sort((a, b) => a.next_lock - b.next_lock);
  return open[0] || c[0] || null;
}

/* ---------- moving about ---------- */
function clGo(s, o){
  audio();
  if(!LEAGUE_VIEW) return;
  LEAGUE_VIEW.cl = Object.assign({ s }, o || {});
  CL.err = null;
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function clBack(){
  audio();
  const v = clV();
  LEAGUE_VIEW.cl = v.from || null;
  CL.err = null;
  render();
}
function clHomeGo(){ audio(); LEAGUE_VIEW.cl = null; render(); clLoad(true); }
function clOpenCard(id){ clGo("card", { card: id, from: null }); if(!CL.card[id]) clLoadCard(id); }

/* ---------- the screens ---------- */
function clRender(st){
  b6Paper(true);
  clTeamsLoad();
  const v = clV();
  const page = { card: clCardPage, calls: clCallsPage, new: clNewPage, invite: clInvitePage, join: clJoinPage,
    table: clTablePage, reveal: clRevealPage, comp: clCompPage, club: clClubPage, match: clMatchPage }[v.s];
  st.innerHTML = page ? page(v) : clHome();
  clTickOn();
}

/* why Call It can't be played right now, or "". A GUEST HAS NO ACCOUNT YET: Found your club's trial keeps a
   guest's games on the phone and makes no server account (acctBoot), so the fast lane starts one with a tap
   (clGuestStart), and Found your club later links that same account, calls and all. */
function clBlocked(){
  const a = acct();
  if(typeof ACCT !== "undefined" && !ACCT.ready) return "connecting";
  if(a.signedIn) return a.server ? "" : "offline";
  if(typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return a.signedOut ? "signedout" : "guest";
}
function clGuestHTML(){
  const code = clStr(acctLocal().join);
  return '<div class="b4card dark cl-next cl-guest"><span class="cl-kick">Call It · the prediction league</span><h2>Call the scores</h2>' +
    '<p class="cl-when">' + (code ? "You've been invited to a league (code " + clE(clCode(code)) + "). Start calling and you're in."
      : "Ten matches every weekend from the Eredivisie and the Premier League. Call the scores, beat your mates, climb the table.") + '</p>' +
    b4Btn(CL.starting ? "Starting…" : "Start calling ›", "clGuestStart()") +
    (code ? "" : b4Btn("Join with a code", "clGuestStart('join')", "dark")) +
    '<p class="cl-guestnote">You play as a guest for three rounds, no email needed. Found your club any time and your calls come with you.</p></div>';
}
/* the fast lane's first tap: a guest account (anonymous, no email), the way Found your club makes one */
async function clGuestStart(next){
  audio();
  if(CL.starting) return;
  const c = sbClient();
  if(!c || !c.auth) return toast("Not available right now. Check the connection and try again.", true);
  CL.starting = true; render();
  try{
    if(!acct().signedIn){
      const r = await c.auth.signInAnonymously();
      if(r.error) throw r.error;
      ACCT.session = r.data ? r.data.session : null;
    }
    const p = await c.rpc("ensure_profile");
    if(p.error || !p.data || !p.data.ok) throw p.error || new Error("no profile");
    ACCT.server = true; acctTake(p.data.profile);
  }catch(e){ CL.starting = false; render(); return toast("Couldn't start right now. Check the connection and try again.", true); }
  CL.starting = false; CL.cards = null; CL.at = 0;
  if(acctLocal().join){ acctJoinPending(); return; }   // came by an invite: its league opens
  if(next === "join") return clGo("join");
  render();
}
function clHub(body){
  return '<div class="b6 step lgpage clhub"><div class="b6band"></div><div class="b6body">' +
    '<div class="lghead"><h1 class="lgh1">League</h1></div><span class="lgsub">Call the scores. Beat your mates. All season.</span>' +
    lgSegHTML() + body + '</div></div>';
}
function clHome(){
  const why = clBlocked();
  if(why === "connecting") return clHub('<div class="lgskel"></div>');
  if(why === "offline") return clHub('<div class="lgempty"><b>Predictions need the internet</b><span>The rounds and the tables live on the server, so they are not available right now.</span></div>');
  if(why === "signedout") return clHub(fycTrial() ? fycCardHTML("league") : acctSaveHTML(false));
  if(why === "guest") return clHub(clGuestHTML() + clMcEntryHTML());
  if(!CL.cards){
    if(!CL.loading && !CL.err) clLoad();
    return clHub(CL.err ? '<div class="lgempty"><b>' + clE(CL.err) + '</b><span>Check the connection and try again.</span><button class="b4btn dark" onclick="clLoad(true)">Try again</button></div>' : '<div class="lgskel"></div>');
  }
  if(Date.now() - CL.at > 60000 && !CL.loading) clLoad();
  return clHub(clRevealBanner() + clNextCard() + clOtherCards() + clLeaguesHTML() + clMcEntryHTML());
}
/* the big card: the round with the next kick-off */
function clNextCard(){
  const t = clTop();
  if(!t) return '<div class="b4card dark cl-next cl-none"><span class="cl-kick">No round to call right now</span>' +
    '<p class="cl-when">The next round opens as soon as its matches are set. Start a league with your mates in the meantime.</p></div>';
  const k = CL.card[t.card], F = k ? clF(t.card) : [], mine = clMine(t.card);
  const called = k ? F.filter(f => mine.calls[f.id]).length : t.called, n = k ? F.length : t.matches;
  const open = k ? F.filter(clOpen).length : t.open;
  const first = k ? F.filter(clOpen).map(f => f.ko).sort((a, b) => a - b)[0] : t.next_lock;
  const left = first ? clLeft(first) : null, all = called >= n && n > 0;
  const armF = mine.arm != null && k ? F.find(f => String(f.id) === String(mine.arm)) : null;
  /* a pip per match, gold once called; the armband's match is ringed, called or not */
  const pips = '<div class="cl-pips" aria-hidden="true">' + (k ? F : Array.from({ length: n }, (x, j) => ({ id: "x" + j }))).map((f, j) =>
    '<span class="' + [(k ? mine.calls[f.id] : j < called) ? "on" : "", armF && f.id === armF.id ? "pa" : ""].filter(Boolean).join(" ") + '"></span>').join("") + '</div>';
  const board = clBoardFor(t);
  return '<div class="b4card dark cl-next">' +
    '<div class="cl-top"><div><span class="cl-kick">' + clE(t.label) + ' · ' + clE(t.series_name) + '</span>' +
    '<h2>' + (open ? (all ? "All called" : "Call it") : "Locked") + '</h2>' +
    '<p class="cl-when">' + (first ? (all ? "See you at " : "First kick-off ") + clDay(first) : "Every match has kicked off") + '</p></div>' +
    (left && open ? '<div class="cl-cd"><small>' + left[1] + '</small><b data-cl-until="' + first + '">' + left[0] + '</b></div>' : "") + '</div>' +
    pips + '<div class="cl-prog"><span><b>' + called + ' of ' + n + '</b> called</span>' +
    (armF ? '<span>Armband on ' + clE(clTeam(armF.home).name) + ' – ' + clE(clTeam(armF.away).name) + '</span>' : "") + '</div>' +
    (mine.wait ? '<p class="cl-wait">Not sent yet: ' + mine.wait + ' change' + (mine.wait === 1 ? "" : "s") + '. They go as soon as BALL reaches the server.</p>' : "") +
    board +
    (open ? b4Btn(all ? "Check your calls ›" : "Call " + clE(t.label) + " ›", all ? "clGo('calls',{card:" + t.card + "})" : "clOpenCard(" + t.card + ")") :
      b4Btn("See the round ›", "clOpenCard(" + t.card + ")", "dark")) + '</div>';
}
/* who in your league has called (never what), from the board */
function clBoardFor(t){
  const lg = (CL.leagues || []).find(l => l.series === t.series), b = lg && CL.board[lg.id + ":" + t.card];
  if(!b || !b.members || b.members.length < 2) return "";
  const n = clF(t.card).length || t.matches || 1, mates = b.members.filter(m => !m.me);
  const done = mates.filter(m => m.called >= n), not = mates.filter(m => !m.called);
  const crests = mates.slice(0, 6).map(m => '<span class="' + (m.called >= n ? "done" : m.called ? "some" : "wait") + '">' + clCrest(m, 30) + '</span>').join("");
  const say = done.length === mates.length ? "Everyone in " + clE(lg.name) + " has called."
    : '<b>' + done.length + ' mate' + (done.length === 1 ? " is" : "s are") + ' done.</b>' +
      (not.length ? ' ' + not.slice(0, 2).map(m => clE(m.display_name)).join(" and ") + (not.length > 2 ? " and " + (not.length - 2) + " more" : "") + (not.length === 1 ? " hasn't" : " haven't") + ' started.' : "");
  return '<div class="cl-crew"><div class="cl-cs">' + crests + '</div><small>' + say + '</small></div>';
}
function clOtherCards(){
  const t = clTop(), rest = (CL.cards || []).filter(c => !t || c.card !== t.card);
  if(!rest.length) return "";
  return rest.map(c => {
    const toCall = c.open > 0 ? Math.max(0, Math.min(c.open, c.matches - c.called)) : 0;
    return '<button class="cl-lrow" onclick="clOpenCard(' + c.card + ')"><span class="cl-pos cl-dark"><b>' + c.called + '</b><small>OF ' + c.matches + '</small></span>' +
      '<span class="m"><b>' + clE(c.series_name) + '</b><small>' + clE(c.label) + (c.next_lock ? ' · locks ' + clDay(c.next_lock) : ' · locked') + '</small></span>' +
      '<span class="st">' + (toCall ? '<span class="cl-tag red">' + toCall + ' to call</span>' : '<span class="cl-tag ghost">' + (c.open ? "Done" : "Locked") + '</span>') + '</span><span class="chev">›</span></button>';
  }).join("");
}
function clLeaguesHTML(){
  const L = CL.leagues || [];
  const btns = '<div class="cl-two">' + b4Btn("New league", "clNew()", "dark") + b4Btn("Join with code", "clGo('join')", "dark") + '</div>';
  if(!L.length) return b4Sec("Your leagues") +
    '<div class="b4card cream cl-empty"><b>Call the scores with your mates</b><span>A league is your group: everyone calls the same round, ' +
    'and the table moves after every match. Start one and share the code, or join theirs.</span></div>' + btns;
  return b4Sec("Your leagues") + L.map(l => {
    const c = (CL.cards || []).find(x => x.series === l.series);
    const toCall = c && c.open > 0 ? Math.max(0, Math.min(c.open, c.matches - c.called)) : 0;
    const pos = l.pos ? ordinal(l.pos) : "–", m = pos.match(/^(\d+)(\D*)$/);
    return '<button class="cl-lrow" onclick="clGo(\'table\',{league:\'' + l.id + '\'})"><span class="cl-pos"><b>' + (m ? m[1] + '<sup>' + m[2] + '</sup>' : pos) + '</b><small>OF ' + l.members + '</small></span>' +
      '<span class="m"><b>' + clE(l.name) + '</b><small>' + clE(l.series_name) + ' · ' + (l.pts || 0) + ' pts</small></span>' +
      '<span class="st">' + (toCall ? '<span class="cl-tag red">' + toCall + ' to call</span>' : c && c.called ? '<span class="cl-tag ghost">Done</span>' : "") + '</span><span class="chev">›</span></button>';
  }).join("") + btns;
}

/* ---------- the call flow ---------- */
function clFirstOpen(F, mine){
  const j = F.findIndex(f => clOpen(f) && !mine.calls[f.id]);
  if(j >= 0) return j;
  const o = F.findIndex(clOpen);
  return o >= 0 ? o : 0;
}
function clCardPage(v){
  const id = v.card, k = CL.card[id];
  if(!k){
    if(!CL.err && clOnce("card:" + id, 10000)) clLoadCard(id);
    return b4Page({ title: "Call it", ctx: CL.err || "Loading the round…", back: "clBack()", cls: "clpage", body: CL.err ? "" : '<div class="lgskel"></div>' });
  }
  const F = clF(id), n = F.length, mine = clMine(id);
  if(!n) return b4Page({ title: k.card.label, ctx: k.card.series_name, back: "clBack()", cls: "clpage",
    body: '<div class="lgempty"><b>No matches on this round yet</b><span>They are added as soon as the fixtures are set.</span></div>' });
  let i = CL.i[id];
  if(i == null || i >= n) i = CL.i[id] = clFirstOpen(F, mine);
  const f = F[i], called = F.filter(x => mine.calls[x.id]).length;
  const jump = '<div class="cl-jump" role="group" aria-label="Matches">' + F.map((x, j) =>
    '<button class="' + [mine.calls[x.id] ? "done" : "", j === i ? "cur" : "", String(mine.arm) === String(x.id) ? "ab" : "", clOpen(x) ? "" : "lk"].filter(Boolean).join(" ") +
    '" onclick="clAt(' + j + ')" aria-label="Match ' + (j + 1) + (mine.calls[x.id] ? ", called" : "") + '">' + (j + 1) + '</button>').join("") + '</div>';
  return b4Page({ title: k.card.label, ctx: clStr(k.card.series_name) + " · " + called + " of " + n + " called", back: "clBack()", cls: "clpage",
    body: jump + clMatchHTML(k, f, i, n, mine) + (clOpen(f) ? clQuickHTML(f, mine, k) : clDoneHTML(k, f, mine)) });
}
function clRead(H, A, c){
  if(!c) return "No call yet. Tap a score below, or set the numbers.";
  const s = '<b>' + c[0] + ' – ' + c[1] + '</b>';
  return c[0] > c[1] ? clE(H) + ' win it, ' + s : c[0] < c[1] ? clE(A) + ' win it, ' + s : 'A draw, ' + s;
}
function clMatchHTML(k, f, i, n, mine){
  const H = clTeam(f.home), A = clTeam(f.away), c = mine.calls[f.id], open = clOpen(f);
  const tag = f.top ? '<span class="cl-tag gold">Top match</span>' : String(mine.arm) === String(f.id) ? '<span class="cl-tag gold">Armband ×2</span>' : "";
  const head = '<div class="cl-meta"><span>' + clDay(f.ko).toUpperCase() + ' · Match ' + (i + 1) + ' of ' + n + '</span>' + tag + '</div>' +
    '<div class="cl-vs"><div class="cl-side">' + clPatch(f.home, 56) + '<b>' + clE(H.name) + '</b>' + clMcSide(f.comp, f.home) + '</div><span class="cl-vsx">vs</span>' +
    '<div class="cl-side">' + clPatch(f.away, 56) + '<b>' + clE(A.name) + '</b>' + clMcSide(f.comp, f.away) + '</div></div>';
  if(!open){
    const p = mine.points[f.id], ft = f.ft;
    return '<div class="b4card dark cl-pick cl-lock">' + head +
      '<div class="cl-locked">' + (f.status === "postponed" ? "Postponed · your call waits for the new date" : f.status === "void" ? "Void · no points for anyone" :
        ft ? (f.status === "finished" || f.status === "awarded" ? "Full time " : "Now ") + ft[0] + " – " + ft[1] + (f.min && f.status !== "finished" ? " · " + f.min + "'" : "")
           : "Locked · kicked off " + clTime(f.ko)) + '</div>' +
      '<div class="cl-mycall">' + (c ? 'Your call <b>' + c[0] + ' – ' + c[1] + '</b>' : 'No call') + (p ? ' · <b>' + (p[0] > 0 ? "+" : "") + p[0] + '</b> pts' : "") + '</div></div>';
  }
  const w = c || null, dig = (side, val) => {
    const x = val == null ? null : val;
    return '<div class="cl-wheel"><button onclick="clBump(\'' + side + '\',1)" aria-label="' + clE(side === "h" ? H.name : A.name) + ' goals: ' + (x == null ? "none" : x) + ', more">▲</button>' +
      '<div class="cl-digit' + (x == null ? " unset" : "") + '"' + (x == null ? "" : ' data-p="' + (x + 1) + '" data-n="' + (x > 0 ? x - 1 : "") + '"') + '><b>' + (x == null ? "–" : x) + '</b></div>' +
      '<button onclick="clBump(\'' + side + '\',-1)" aria-label="' + clE(side === "h" ? H.name : A.name) + ' goals, fewer">▼</button></div>';
  };
  return '<div class="b4card dark cl-pick">' + head +
    '<div class="cl-wheels">' + dig("h", w ? w[0] : null) + '<span class="cl-dash">–</span>' + dig("a", w ? w[1] : null) + '</div>' +
    '<div class="cl-read" aria-live="polite">' + clRead(H.name, A.name, w) + '</div></div>';
}
function clQuickHTML(f, mine, k){
  const c = mine.calls[f.id], armOn = !!(k.rules && k.rules.armband), here = String(mine.arm) === String(f.id);
  const armF = !here && mine.arm != null ? (k.fixtures || []).find(x => String(x.id) === String(mine.arm)) : null;
  const grid = '<div class="cl-qlab"><span>Quick call · tap and it moves on</span></div><div class="cl-qgrid">' + CL_QUICK.map(q =>
    '<button class="' + (c && c[0] === q[0] && c[1] === q[1] ? "sel" : "") + '" onclick="clQuick(' + q[0] + ',' + q[1] + ')">' + q[0] + '–' + q[1] + '</button>').join("") + '</div>';
  const pill = c ? b4Btn("Call it " + c[0] + "–" + c[1] + " ›", "clNext()") : b4Btn("Next match ›", "clNext()", "dark");
  const arm = armOn ? '<button class="cl-arm' + (here ? " on" : "") + '" onclick="clArm()" aria-pressed="' + here + '" aria-label="Armband, doubles this match"><span class="cl-c">C</span><small>×' + k.rules.armband + '</small></button>' : "";
  const note = !armOn ? "" : '<p class="cl-armnote">' + (here ? "<b>Armband</b> on this match: its points count double. Tap C to take it off."
    : armF ? "<b>Armband:</b> on " + clE(clTeam(armF.home).name) + " – " + clE(clTeam(armF.away).name) + "." + (clOpen(armF) ? " Tap C to move it here." : " That match has kicked off, so it stays.")
    : "<b>Armband:</b> one match per round counts double. Tap C to put it here.") + '</p>';
  return grid + '<div class="cl-act">' + arm + pill + '</div>' + note + clWaitNote(mine);
}
function clDoneHTML(k, f, mine){
  const lg = (CL.leagues || []).find(l => l.series === k.card.series);
  return (lg ? b4Btn("See what your league called ›", "clReveal('" + lg.id + "'," + k.card.id + "," + f.id + ")") : "") +
    '<div class="cl-two">' + b4Btn("‹ Match", "clStep(-1)", "dark") + b4Btn("Match ›", "clStep(1)", "dark") + '</div>' + clWaitNote(mine);
}
function clWaitNote(mine){
  return mine.wait ? '<p class="cl-wait">Saved on this phone, not sent yet. It goes as soon as BALL reaches the server.</p>' : "";
}
function clAt(j){ audio(); const id = clV().card; CL.i[id] = j; render(); }
function clStep(d){ audio(); const id = clV().card, n = clF(id).length; CL.i[id] = Math.max(0, Math.min(n - 1, (CL.i[id] || 0) + d)); render(); }
function clCur(){ const id = clV().card, F = clF(id), f = F[CL.i[id] || 0]; return { id, F, f }; }
function clBump(side, d){
  audio();
  const { id, f } = clCur();
  if(!clOpen(f)) return;
  const c = (clMine(id).calls[f.id] || [0, 0]).slice(), j = side === "h" ? 0 : 1;
  c[j] = Math.max(0, Math.min(20, c[j] + d));
  clPut(id, f.id, c[0], c[1]);
  render();
}
let clNextT = null;
function clQuick(h, a){
  audio(); try{ buzz(12); }catch(e){}
  const { id, f } = clCur(), i = CL.i[id] || 0;
  if(!clOpen(f)) return;
  clPut(id, f.id, h, a);
  render();
  clearTimeout(clNextT);
  clNextT = setTimeout(() => { const v = clV(); if(v.s === "card" && v.card === id && (CL.i[id] || 0) === i) clNext(true); }, 260);
}
/* on to the next open match without a call (round the end too), and to your calls when there is none */
function clNext(quiet){
  if(!quiet) audio();
  const { id, F } = clCur(), mine = clMine(id), i = CL.i[id] || 0;
  let j = F.findIndex((x, n) => n > i && clOpen(x) && !mine.calls[x.id]);
  if(j < 0) j = F.findIndex(x => clOpen(x) && !mine.calls[x.id]);
  if(j < 0 || j === i){ LEAGUE_VIEW.cl = { s: "calls", card: id, from: clV() }; render(); try{ window.scrollTo(0, 0); }catch(e){} return; }
  CL.i[id] = j; render();
}
function clArm(){
  audio();
  const { id, f } = clCur(), k = CL.card[id];
  if(!clOpen(f) || !(k.rules && k.rules.armband)) return;
  const mine = clMine(id), cur = mine.arm != null ? (k.fixtures || []).find(x => String(x.id) === String(mine.arm)) : null;
  if(cur && String(cur.id) !== String(f.id) && !clOpen(cur)) return clArmSaid("played");
  const p = clPend(), c = p[id] || (p[id] = {});
  c.a = { f: String(mine.arm) === String(f.id) ? null : f.id };
  clPendPut(p); clFlushSoon();
  try{ buzz(12); }catch(e){}
  render();
}

/* ---------- your calls, and lock in ---------- */
function clCallsPage(v){
  const id = v.card, k = CL.card[id];
  if(!k){
    if(!CL.err && clOnce("card:" + id, 10000)) clLoadCard(id);
    return b4Page({ title: "Your calls", ctx: CL.err || "Loading…", back: "clBack()", cls: "clpage", body: CL.err ? "" : '<div class="lgskel"></div>' });
  }
  const F = clF(id), mine = clMine(id), called = F.filter(f => mine.calls[f.id]).length, open = F.filter(clOpen).length;
  const rows = F.map((f, j) => {
    const c = mine.calls[f.id], arm = String(mine.arm) === String(f.id), H = clTeam(f.home), A = clTeam(f.away);
    return '<button class="cl-srow' + (arm ? " armd" : "") + (clOpen(f) ? "" : " lk") + '" onclick="clEdit(' + j + ')">' +
      '<span class="t">' + CL_DAYS[new Date(f.ko).getDay()] + '<br>' + clTime(f.ko) + '</span>' +
      '<span class="h">' + clPatch(f.home, 22) + '<span>' + clE(H.name) + '</span></span>' +
      '<span class="sc' + (c ? "" : " none") + '">' + (c ? c[0] + "–" + c[1] : "–") + '</span>' +
      '<span class="a"><span>' + clE(A.name) + '</span>' + clPatch(f.away, 22) + '</span>' +
      (arm ? '<span class="cl-c sm">C</span>' : '<span></span>') + '</button>';
  }).join("");
  const lg = (CL.leagues || []).find(l => l.series === k.card.series), b = lg && CL.board[lg.id + ":" + id];
  if(lg && !b && clOnce("board:" + lg.id + ":" + id)) clLoadBoard(lg.id, id);
  const who = b && b.members && b.members.length > 1 ? b4Sec("Who's in · " + lg.name) + '<div class="cl-who">' + b.members.map(m =>
      '<span class="' + (m.called ? "" : "wait") + '">' + clCrest(m, 22) + clE(m.me ? "You" : m.display_name) + (m.called ? "" : " · 0 of " + F.length) + '</span>').join("") + '</div>' +
      (b.members.some(m => !m.called && !m.me) ? '<button class="b4btn quiet" onclick="clNudge(\'' + lg.id + '\',' + id + ')">Nudge the ones who haven\'t</button>' : "") : "";
  return b4Page({ title: "Your calls", ctx: clStr(k.card.label) + " · " + called + " of " + F.length + " called", back: "clBack()", cls: "clpage",
    body: '<div class="cl-stampwrap" id="clstampwrap"><div class="b4card dark cl-slip">' + rows + '</div></div>' +
      '<p class="cl-sum">Tap a match to change it. Each match locks at its own kick-off.</p>' + clWaitNote(mine) +
      (open ? b4Btn("Lock in " + clE(k.card.label), "clLockIn()") : "") + who });
}
/* from your calls to one match; ‹ comes back to your calls */
function clEdit(j){ audio(); const v = clV(); CL.i[v.card] = j; LEAGUE_VIEW.cl = { s: "card", card: v.card, from: v }; render(); }
async function clLockIn(){
  audio();
  const id = clV().card, k = CL.card[id];
  clearTimeout(clFlushT);
  const sent = await clFlush();
  if(!sent && clMine(id).wait){ toast("Saved on this phone. They go as soon as BALL reaches the server."); return; }
  try{ buzz([20, 40, 30]); }catch(e){}
  clStamp(clStr(k && k.card.label), () => { if(clOn()) clHomeGo(); });
}
/* CALLED: the gold plate slams over the calls, then back to the league */
function clStamp(label, then){
  let el = null;
  try{
    el = document.createElement("div");
    el.className = "cl-stamp" + (clReduced() ? " calm" : "");
    el.innerHTML = '<b>Called<small>' + clE(label) + '</small></b>';
    document.body.appendChild(el);
  }catch(e){}
  setTimeout(() => { try{ if(el && el.remove) el.remove(); }catch(e){} then && then(); }, clReduced() ? 500 : 1300);
}
function clNudge(league, card){
  audio();
  const L = (CL.leagues || []).find(l => l.id === league), k = CL.card[card];
  const first = k ? clF(card).filter(clOpen).map(f => f.ko).sort((a, b) => a - b)[0] : null;
  const text = clStr(k && k.card.label) + (first ? " locks " + clDay(first) : "") + ". Your calls, " + clStr(L && L.name) + "! " + acctRedirect() + "?join=" + clStr(L && L.code);
  clShareText(text);
}

/* ---------- a new league ---------- */
/* leagues need a name the others can see and the 16+ answer; a guest gives both here (the fast lane) */
function clNeedName(){
  const a = acct();
  if(!a.username){ acctUsernameSheet(true); return false; }
  if(!a.asked16){ acctAgeSheet(); return false; }
  if(!a.ageOk){ toast("Leagues are for players aged 16 and over.", true); return false; }
  return true;
}
function clNew(){ if(!clNeedName()) return; clGo("new", { series: clSeriesDefault() }); }
function clSeriesDefault(){
  const own = (CL.cards || []).find(c => c.series === "week");
  return own ? "week" : "DED";
}
/* the name box starts with your own league's name; your club's, when you have one, is among the chips */
function clNameSug(){
  const a = acct(), u = a.username ? a.username.replace(/_/g, " ") : "";
  let club = "";
  try{ club = clStr(ACCT.profile && ACCT.profile.club && ACCT.profile.club.name).trim(); }catch(e){}
  return [u ? u.charAt(0).toUpperCase() + u.slice(1) + "'s League" : "The Prediction League"]
    .concat(club ? [(club + " & Friends").slice(0, 30)] : [], ["Thursday Night Legends", "The Office", "Sunday League Lot"]);
}
function clNewPage(v){
  const sug = clNameSug(), weekOn = (CL.cards || []).some(c => c.series === "week");
  const series = CL_SERIES.filter(s => s.id !== "week" || weekOn);
  return b4Page({ title: "New league", ctx: "Predictions", back: "clBack()", cls: "clpage", body:
    b4Q("Name your league") +
    '<input id="clname" class="cl-input" maxlength="30" autocomplete="off" value="' + clE(v.name != null ? v.name : sug[0]) + '" aria-label="League name">' +
    '<div class="cl-chips">' + sug.slice(1).map(s => '<button onclick="clNameUse(this)">' + clE(s) + '</button>').join("") + '</div>' +
    b4Q("Which football?") +
    '<div class="cl-series">' + series.map(s => '<button class="' + (v.series === s.id ? "on" : "") + '" aria-pressed="' + (v.series === s.id) + '" onclick="clSeries(\'' + s.id + '\')"><b>' + clE(s.name) + '</b><small>' + clE(s.sub) + '</small></button>').join("") + '</div>' +
    '<p class="cl-rules"><b>The rules:</b> the right result 2 points, the right goal difference 1 more, the exact score 2 more (5 in all). ' +
    'The right winner that fewer than 1 in 5 of BALL called: 1 more. Your armband doubles one match a round.</p>' +
    b4Btn("Create the league", "clCreate()") });
}
function clNameUse(b){ audio(); const el = document.getElementById("clname"); if(el && b) el.value = b.textContent; }
function clSeries(id){ audio(); const v = clV(), el = document.getElementById("clname"); v.series = id; if(el) v.name = el.value; render(); }
async function clCreate(){
  audio();
  if(!clNeedName()) return;
  const v = clV(), el = document.getElementById("clname"), name = clStr(el ? el.value : v.name).trim();
  if(name.length < 2) return toast("Give the league a name.", true);
  try{
    const d = await clRpc("pl_create_league", { p_name: name, p_series: v.series || "DED" });
    if(!d.ok) return toast(({ bad_name: "A name of 2 to 30 letters, please.", under_16: "Leagues are for players aged 16 and over.",
      no_username: "Pick a username first.", too_many: "You're in 20 leagues already.", slow_down: "That's a lot of new leagues. Try again tomorrow.",
      not_found: "That football isn't on right now." })[d.code] || "Couldn't create it right now.", true);
    CL.leagues = null; CL.cards = null;
    LEAGUE_VIEW.cl = { s: "invite", league: d.id, code: d.code, name: d.name, fresh: true, from: null };
    render(); clLoad(true);
  }catch(e){ toast("Couldn't create it right now.", true); }
}

/* ---------- invite ---------- */
function clInvitePage(v){
  const L = (CL.leagues || []).find(l => l.id === v.league) || {}, t = CL.table[v.league];
  const seats = t ? t.rows.length : L.members || 1, max = (t && t.league.max_members) || 50;
  return b4Page({ title: "Invite", ctx: v.name || L.name || "Your league", back: v.fresh ? "clHomeGo()" : "clBack()", cls: "clpage", body:
    (v.fresh ? '<p class="cl-lead">' + clE(v.name) + ' is ready. Now the fun part: get your mates in.</p>' : "") +
    '<div class="lgcode cl-code"><span><small>League code</small><b>' + clE(clCode(v.code)) + '</b></span><button class="cl-copy" onclick="clCopy()">Copy</button></div>' +
    b4Btn("Share the invite", "clInvite()") +
    '<p class="cl-sum">Your mates tap the link, call the round straight away (as a guest if they like), and they are in the table.</p>' +
    b4Sec("Seats · " + seats + " of " + max) +
    (v.fresh ? b4Btn("Call the round ›", "clHomeGo()", "dark") : "") });
}
function clInviteText(v){
  return "Join my prediction league " + clStr(v.name) + " on BALL: call the scores every round. " + acctRedirect() + "?join=" + clStr(v.code);
}
function clShareText(text){
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Paste it in your group."), () => toast(text)); }catch(e){ toast(text); }
}
function clInvite(){ audio(); const v = clV(); clShareText(clInviteText({ name: v.name || ((CL.leagues || []).find(l => l.id === v.league) || {}).name, code: v.code })); }
function clCopy(){ audio(); const v = clV(); try{ navigator.clipboard.writeText(v.code).then(() => toast("Code copied: " + clCode(v.code)), () => toast(clCode(v.code))); }catch(e){ toast(clCode(v.code)); } }

/* ---------- join ---------- */
function clJoinPage(v){
  const p = v.preview;
  if(!p) return b4Page({ title: "Join a league", ctx: "Predictions", back: "clBack()", cls: "clpage", body:
    b4Q("The league code", "6 letters and numbers, from the invite") +
    '<div class="lgjoin cl-join"><input id="clcode" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="K7Q 2PM" aria-label="League code" value="' + clE(v.code || "") + '">' +
    '<button class="acsmall" onclick="clLook()">Look</button></div>' + (v.err ? '<p class="cl-err">' + clE(v.err) + '</p>' : "") });
  const top = (p.top || []).map(r => '<span>' + clCrest(r, 26) + '<b>' + clE(r.display_name) + '</b><small>' + ordinal(r.pos) + '</small></span>').join("");
  return b4Page({ title: "You're invited", ctx: p.series_name, back: "clBack()", cls: "clpage", body:
    '<div class="b4card dark cl-invited"><span class="cl-kick">Prediction league · ' + clE(p.series_name) + '</span><h2>' + clE(p.name) + '</h2>' +
    '<p class="cl-when">' + p.members + ' player' + (p.members === 1 ? "" : "s") + (p.card ? ' · ' + clE(p.card.label) + (p.card.next_lock ? ' locks ' + clDay(p.card.next_lock) : "") : "") + '</p>' +
    (top ? '<div class="cl-who dark">' + top + '</div>' : "") + '</div>' +
    (p.full ? '<div class="lgempty"><b>This league is full</b><span>Ask whoever sent the code to make room, or start your own.</span></div>' + b4Btn("Start your own", "clNew()", "dark")
      : b4Btn("Join the league", "clJoin()") + '<p class="cl-sum">You call every round: the score of each match. The right result is 2 points, the exact score 5.</p>') });
}
async function clLook(code){
  audio();
  const v = clV(), el = document.getElementById("clcode");
  code = leagueCodeFrom(clStr(code != null ? code : el ? el.value : "").replace(/\s+/g, ""));
  if(!code){ v.err = "League codes are 6 letters and numbers."; return render(); }
  v.code = code; v.err = null;
  try{
    const d = await clRpc("pl_league_preview", { p_code: code });
    if(d.ok){ v.preview = d; return render(); }
    if(d.code === "not_found"){
      /* one code, one group: it may be a quiz league's code */
      if(!leagueBlocked()){ LEAGUE_VIEW.seg = "quiz"; LEAGUE_VIEW.cl = null; render(); return leagueJoin(code); }
      v.err = "No prediction league with that code. A quiz league's code works once you have founded your club.";
    } else v.err = d.code === "slow_down" ? "Too many looks for now. Try again in a while." : "Couldn't look that up right now.";
  }catch(e){ v.err = "Couldn't look that up right now."; }
  render();
}
async function clJoin(){
  audio();
  if(!clNeedName()) return;
  const v = clV();
  try{
    const d = await clRpc("pl_join", { p_code: v.code });
    if(!d.ok) return toast(({ not_found: "No league with that code.", full: "That league is full.", too_many: "You're in 20 leagues already.",
      under_16: "Leagues are for players aged 16 and over.", no_username: "Pick a username first.", slow_down: "Too many tries for now. Try again in a while." })[d.code] || "Couldn't join right now.", true);
    try{ acctLocalSet({ join: null }); }catch(e){}
    toast(d.already ? "You're already in " + d.name + "." : "You're in " + d.name + "." + (d.base ? " You start level with last place: " + d.base + " pts." : ""));
    CL.leagues = null; CL.cards = null;
    LEAGUE_VIEW.cl = { s: "table", league: d.id, from: null };
    render(); clLoad(true);
  }catch(e){ toast("Couldn't join right now.", true); }
}
/* a ?join= code that arrived with the link: a prediction league's opens its invite, anything else goes to the quiz leagues */
async function clJoinPending(code){
  if(!code || !acct().signedIn) return false;
  try{
    const d = await clRpc("pl_league_preview", { p_code: code });
    if(d.ok){
      try{ acctLocalSet({ join: null }); }catch(e){}
      if(!LEAGUE_VIEW) openLeague();
      LEAGUE_VIEW.seg = "pl";
      LEAGUE_VIEW.cl = { s: "join", code, preview: d, from: null };
      render();
      return true;
    }
  }catch(e){ return false; }
  /* a quiz league's code: join it, or (a guest) show the Quiz week, which says it joins once the club is founded */
  if(!leagueBlocked()) leagueJoin(code);
  else if(LEAGUE_VIEW && LEAGUE_VIEW.seg === "pl"){ LEAGUE_VIEW.seg = "quiz"; LEAGUE_VIEW.cl = null; render(); }
  return false;
}

/* ---------- the table ---------- */
function clTablePage(v){
  const t = CL.table[v.league];
  if(!t){ if(!CL.err && clOnce("table:" + v.league, 10000)) clLoadTable(v.league); return b4Page({ title: "League", ctx: CL.err || "Loading the table…", back: "clBack()", cls: "clpage", body: CL.err ? "" : '<div class="lgskel"></div>' }); }
  const L = t.league, rows = t.rows || [], tied = {};
  rows.forEach(r => { tied[r.pos] = (tied[r.pos] || 0) + 1; });
  const crown = n => n ? '<span class="cl-crown" title="Round wins">' + CL_CROWN + (n > 1 ? '<small>' + n + '</small>' : "") + '</span>' : "";
  const mv = r => r.prev == null ? '<i class="eq">·</i>' : r.prev > r.pos ? '<i class="up">▲' + (r.prev - r.pos) + '</i>' : r.prev < r.pos ? '<i class="dn">▼' + (r.pos - r.prev) + '</i>' : '<i class="eq">=</i>';
  const body = '<div class="b4card cream cl-table">' + '<div class="cl-trow hd"><span>#</span><span></span><span>Club</span><span>Last</span><span>Pts</span></div>' +
    rows.map(r => '<div class="cl-trow' + (r.me ? " me" : "") + '"><span class="pos">' + (tied[r.pos] > 1 ? '<span class="tie">=</span>' : "") + r.pos + mv(r) + '</span>' + clCrest(r, 28) +
      '<span class="nm"><b><span class="t">' + clE(r.display_name) + '</span>' + crown(r.crowns) + '</b><small>' + (r.me ? "you" : r.from_seq > L.from_seq && r.base ? "joined later, started on " + r.base : r.exact ? r.exact + " exact" : "") + '</small></span>' +
      '<span class="last">' + (r.last == null ? "–" : "+" + r.last) + '</span><span class="pts">' + r.pts + '</span></div>').join("") + '</div>';
  const solo = rows.length < 2 ? '<div class="lgempty"><b>Just you so far</b><span>Share the code and the table fills up. Everyone calls the same rounds.</span></div>' : "";
  const series = ((CL.leagues || []).find(l => l.id === L.id) || {}).series_name;
  return b4Page({ title: "The table", ctx: L.name, back: "clBack()", cls: "clpage",
    body: '<p class="cl-sum cl-tsub">' + (series ? clE(series) + ' · ' : "") + rows.length + ' player' + (rows.length === 1 ? "" : "s") + ' · code ' + clE(clCode(L.code)) + '</p>' + solo + body + '<p class="cl-sum">Points: the right result 2, the goal difference 1 more, the exact score 2 more. Level on points: more exact scores, then more right results.</p>' +
      b4Btn("Invite your mates", "clInviteFrom('" + L.id + "')", "dark") +
      '<button class="b4btn quiet" onclick="clLeaveAsk(\'' + L.id + '\')">Leave this league</button>' });
}
function clInviteFrom(id){ const t = CL.table[id]; if(t) clGo("invite", { league: id, code: t.league.code, name: t.league.name, from: clV() }); }
const CL_CROWN = '<svg viewBox="0 0 24 18" width="16" height="12" aria-hidden="true"><path d="M2 16h20l-2-11-5 5-3-8-3 8-5-5z" fill="#e9b84c" stroke="#7a5a10" stroke-width="1.4" stroke-linejoin="round"/></svg>';
function clLeaveAsk(id){
  audio();
  const t = CL.table[id], name = t ? t.league.name : "this league";
  sheet('<h2>Leave ' + clE(name) + '?</h2><p class="pgsheetp">Your calls stay yours, but you drop out of this table. You can join again with the code; you would start level with last place.</p>' +
    '<button class="bigbtn" onclick="clLeave(\'' + id + '\')">Leave the league</button><button class="acnot" onclick="closeSheet()">Stay</button>');
}
async function clLeave(id){
  audio(); closeSheet();
  try{
    const d = await clRpc("pl_leave", { p_league: id });
    if(!d.ok) return toast("Couldn't leave right now.", true);
    delete CL.table[id]; CL.leagues = null; CL.cards = null;
    toast("You left the league.");
    clHomeGo();
  }catch(e){ toast("Couldn't leave right now.", true); }
}

/* ---------- the calls are in ---------- */
const clSeen = () => { try{ return JSON.parse(localStorage.getItem(CL_SEEN)) || {}; }catch(e){ return {}; } };
function clSeenPut(fid){ try{ const s = clSeen(); s[fid] = 1; const k = Object.keys(s); if(k.length > 400) k.slice(0, k.length - 400).forEach(x => delete s[x]); localStorage.setItem(CL_SEEN, JSON.stringify(s)); }catch(e){} }
/* on the league's front: the newest match that kicked off since you last looked */
function clRevealBanner(){
  const t = clTop(), lg = t && (CL.leagues || []).find(l => l.series === t.series), b = lg && CL.board[lg.id + ":" + t.card];
  if(!b) return "";
  const seen = clSeen(), f = (b.fixtures || []).filter(x => !x.open && x.league && x.league.n && !seen[x.id]).sort((x, y) => y.ko - x.ko)[0];
  const full = f && (clF(t.card).find(x => +x.id === +f.id) || null);
  if(!f || !full) return "";
  return '<button class="cl-banner" onclick="clReveal(\'' + lg.id + '\',' + t.card + ',' + f.id + ')"><span class="cl-kick">The calls are in · ' + clE(lg.name) + '</span>' +
    '<b>' + clE(clTeam(full.home).name) + ' v ' + clE(clTeam(full.away).name) + '</b><small>See what everyone called ›</small></button>';
}
function clReveal(league, card, fid){
  clGo("reveal", { league, card, fid, from: clV() });
  clSeenPut(fid);
  if(!CL.board[league + ":" + card] || Date.now() - (CL.board[league + ":" + card].at || 0) > 30000) clLoadBoard(league, card);
  if(!CL.card[card]) clLoadCard(card, true);
}
function clRevealPage(v){
  const b = CL.board[v.league + ":" + v.card], k = CL.card[v.card];
  const fx = k && (k.fixtures || []).find(x => +x.id === +v.fid), bf = b && (b.fixtures || []).find(x => +x.id === +v.fid);
  if(!b || !fx) return b4Page({ title: "The calls are in", ctx: "Loading…", back: "clBack()", cls: "clpage clmoment", body: '<div class="lgskel"></div>' });
  const H = clTeam(fx.home), A = clTeam(fx.away), ft = bf && bf.ft, st = (bf && bf.status) || fx.status;
  const hc = clKit(H), ac = clKit(A);
  const side = (T, t, c) => ({ name: T.name, short: T.code, flag: clPatchURL(t), color: c });
  const label = st === "finished" || st === "awarded" ? "Full time" : st === "paused" ? "Half time" : st === "live" ? "Live" + (bf && bf.min ? " " + bf.min + "'" : "")
    : st === "postponed" ? "Postponed" : st === "void" ? "Void" : "Kick-off " + clTime(fx.ko);
  const score = b4Score({ home: side(H, fx.home, hc), away: side(A, fx.away, ac), score: ft ? [ft[0], ft[1]] : ["", ""], label });
  const ms = (b.members || []).slice().sort((x, y) => (y.me ? 1 : 0) - (x.me ? 1 : 0));
  const cards = ms.map((m, j) => {
    const c = m.calls && m.calls[v.fid], arm = String(m.armband) === String(v.fid);
    return '<div class="cl-flip' + (clReduced() ? " open" : "") + (m.me ? " me" : "") + '" style="animation-delay:' + (.35 + j * .38).toFixed(2) + 's">' +
      '<div class="cl-face">' + clCrest(m, 30) + '<b>' + (c ? c[0] + "–" + c[1] : "–") + (arm ? '<span class="cl-c sm">C</span>' : "") + '</b><small>' + clE(m.me ? "You" : m.display_name) + '</small></div></div>';
  }).join("");
  const sp = bf && bf.league, tot = sp ? Math.max(1, sp.n) : 1;
  const split = sp && sp.n ? '<div class="cl-split" role="img" aria-label="' + sp.h + ' for ' + clE(H.name) + ', ' + sp.d + ' for a draw, ' + sp.a + ' for ' + clE(A.name) + '">' +
    (sp.h ? '<span style="flex:' + sp.h + ';background:' + hc + ';color:' + clInk(hc) + '">' + sp.h + '</span>' : "") + (sp.d ? '<span class="d" style="flex:' + sp.d + '">' + sp.d + '</span>' : "") +
    (sp.a ? '<span style="flex:' + sp.a + ';background:' + ac + ';color:' + clInk(ac) + '">' + sp.a + '</span>' : "") + '</div>' +
    '<div class="cl-splitlab"><span>' + clE(H.name) + '</span><span>Draw</span><span>' + clE(A.name) + '</span></div>' : "";
  const lines = clBanter(ms, v.fid, H.name, A.name, tot);
  return b4Page({ title: "The calls are in", ctx: clDay(fx.ko) + " · " + clStr(((CL.leagues || []).find(l => l.id === v.league) || {}).name), back: "clBack()", cls: "clpage clmoment",
    body: score + '<div class="cl-flips">' + cards + '</div>' + split + (lines.length ? '<div class="cl-banter">' + lines.map(l => '<p>' + l + '</p>').join("") + '</div>' : "") +
      b4Btn("Back to the round ›", "clBack()") });
}
function clPatchURL(t){
  const T = clTeam(t), ident = T.own || (T.slug ? null : { name: T.name, code: T.code, c1: "#5a6470", c2: "#ffffff", p: "plain" });
  return ident ? crestURL(T.slug || "pl|" + T.key, "patch", 66, ident) : null;
}
/* at most three lines about the calls, the most telling first; never about anything but the calls */
function clBanter(ms, fid, Hn, An, n){
  const who = m => m.me ? "You" : clE(m.display_name), out = [];
  const has = ms.filter(m => m.calls && m.calls[fid]), res = c => c[0] > c[1] ? "h" : c[0] < c[1] ? "a" : "d";
  const by = { h: [], d: [], a: [] };
  has.forEach(m => by[res(m.calls[fid])].push(m));
  const name = { h: clE(Hn), d: "a draw", a: clE(An) };
  ["h", "d", "a"].forEach(r => { if(by[r].length === has.length && has.length >= 3) out.push("All " + has.length + " say " + name[r] + ". Someone's going to look clever."); });
  ["h", "d", "a"].forEach(r => { if(by[r].length === 1 && has.length >= 3) out.push(who(by[r][0]) + (by[r][0].me ? " are" : " is") + " the only one backing " + name[r] + "."); });
  const big = has.find(m => { const c = m.calls[fid]; return c[0] + c[1] >= 5 || Math.abs(c[0] - c[1]) >= 3; });
  if(big){ const c = big.calls[fid]; out.push(who(big) + " goes big: " + c[0] + "–" + c[1] + "."); }
  const arm = ms.filter(m => String(m.armband) === String(fid));
  if(arm.length) out.push(arm.slice(0, 2).map(who).join(" and ") + (arm.length > 2 ? " and " + (arm.length - 2) + " more" : "") + " put the armband on it.");
  const miss = ms.filter(m => !(m.calls && m.calls[fid]));
  if(miss.length && miss.length < ms.length) out.push(miss.slice(0, 2).map(who).join(" and ") + (miss.length > 2 ? " and others" : "") + " forgot this one.");
  return out.slice(0, 3);
}

/* ---------- THE MATCH CENTRE: the tables, the matches, a club ----------
   _plans/ideas-later.md, "Match centre", piece 3: "this weekend and the tables", handy while you make your
   calls (Martijn asked for it on 30 Oct). The fixtures are public (pl_fixtures can be read without an
   account), so a guest can browse too. The table is worked out here from the season's results: 3 for a win,
   1 for a draw; level on points, then goal difference, then goals scored. A match under way says LIVE and
   its minute, never its running score (the plan: not a live-score app; for English football the live data
   is somebody else's); the score is shown at full time. */
/* the competitions the sync follows (013_more_competitions.sql), in the order the front lists them */
const CL_COMPS = [{ id: "fb.DED", name: "Eredivisie" }, { id: "fb.PL", name: "Premier League" }, { id: "fb.CL", name: "Champions League" },
  { id: "fb.PD", name: "LaLiga" }, { id: "fb.SA", name: "Serie A" }, { id: "fb.BL1", name: "Bundesliga" }, { id: "fb.FL1", name: "Ligue 1" },
  { id: "fb.NL2", name: "Eerste Divisie" }, { id: "fb.BE1", name: "Belgian Pro League" }];
const CL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CL_DAYNAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const clPlayed = x => (x.st === "finished" || x.st === "awarded") && !!x.ft;
const clPts = n => n + (n === 1 ? " pt" : " pts");
/* a competition's matches this season, from the fixtures the sync keeps */
async function clMcLoad(comp){
  const sb = sbClient();
  if(!sb || !sb.from) throw new Error("no server");
  const r = await sb.from("pl_fixtures").select("id,season,matchday,stage,kickoff_at,status,home_key,home_name,away_key,away_name,ft_home,ft_away,minute").eq("competition_id", comp);
  if(r.error) throw r.error;
  const all = r.data || [], season = all.map(x => x.season).sort().pop();
  const rows = all.filter(x => x.season === season).map(x => ({ id: x.id, md: x.matchday, stg: x.stage, ko: Date.parse(x.kickoff_at), st: x.status,
    h: { key: x.home_key, name: x.home_name }, a: { key: x.away_key, name: x.away_name },
    ft: x.ft_home != null && x.ft_away != null ? [x.ft_home, x.ft_away] : null, min: x.minute })).sort((p, q) => p.ko - q.ko || p.id - q.id);
  CL.mc[comp] = { rows, season, at: Date.now(), table: clMcTable(rows) };
  return CL.mc[comp];
}
/* the data if it is here (and fresh enough); else asks for it, once in a while, and draws again when it lands */
function clMcNeed(comp){
  const m = CL.mc[comp];
  if((!m || Date.now() - m.at > 5 * 60e3) && clOnce("mc:" + comp, m ? 60000 : 15000))
    clMcLoad(comp).then(() => { CL.mcErr = null; clRedraw(); }, () => { if(!CL.mc[comp]){ CL.mcErr = "Not available right now."; clRedraw(); } });
  return m || null;
}
/* the table: every club with a matchday fixture, played or not. Only matchdays count, so the Champions League's
   table is its league stage (its qualifiers and knockouts have no matchday), and a league's play-offs stay out */
function clMcTable(rows){
  const t = {}, league = rows.filter(x => x.md != null);
  const team = s => t[s.key] || (t[s.key] = { key: s.key, name: s.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });
  league.forEach(x => { team(x.h); team(x.a); });
  league.filter(clPlayed).forEach(x => {
    const H = team(x.h), A = team(x.a), g1 = x.ft[0], g2 = x.ft[1];
    H.p++; A.p++; H.gf += g1; H.ga += g2; A.gf += g2; A.ga += g1;
    const res = g1 > g2 ? ["W", "L"] : g1 < g2 ? ["L", "W"] : ["D", "D"];
    [[H, res[0]], [A, res[1]]].forEach(([T, r]) => { T.form.push(r); if(r === "W"){ T.w++; T.pts += 3; } else if(r === "D"){ T.d++; T.pts++; } else T.l++; });
  });
  const list = Object.values(t).sort((p, q) => q.pts - p.pts || (q.gf - q.ga) - (p.gf - p.ga) || q.gf - p.gf || clTeam(p).name.localeCompare(clTeam(q).name));
  list.forEach((T, i) => { const b = list[i - 1]; T.pos = b && b.pts === T.pts && b.gf - b.ga === T.gf - T.ga && b.gf === T.gf ? b.pos : i + 1; T.form = T.form.slice(-5); });
  return list;
}
/* A ROUND: a matchday where there is one, else the round's own name (a cup's qualifying rounds and knockouts) */
const clRk = x => x.md != null ? "md:" + x.md : "st:" + clStr(x.stg || "Other matches");
const clRkLabel = k => k == null ? "Matches" : /^md:/.test(k) ? "Matchday " + k.slice(3) : k.slice(3);
/* the rounds in the order they are played: by each one's middle kick-off, so a match moved weeks away can't move its round */
function clMcRounds(rows){
  const by = {};
  rows.forEach(x => { const k = clRk(x); (by[k] = by[k] || []).push(x.ko); });
  const mid = k => { const a = by[k].slice().sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
  return Object.keys(by).sort((a, b) => mid(a) - mid(b) || a.localeCompare(b));
}
/* the round on now or next: the one of the first match still to be played (a postponed one doesn't count) */
function clMcNowRound(rows){
  const now = clNow(), next = rows.find(x => !clPlayed(x) && !/^(postponed|cancelled)$/.test(x.st) && x.ko > now - 4 * 3600e3);
  if(next) return clRk(next);
  const rs = clMcRounds(rows);
  return rs.length ? rs[rs.length - 1] : null;
}
/* a round's name, short, for a club's list of matches */
const clStageShort = s => clStr(s).replace(/Knockout Round Play-offs/i, "KO play-off").replace(/(\w+) Qualifying Round/i, "Qual. $1")
  .replace(/^Round of (\d+)$/i, "Last $1").replace(/Quarter-finals?/i, "QF").replace(/Semi-finals?/i, "SF");
function clMcScore(x){
  if(clPlayed(x)) return '<b>' + x.ft[0] + ' – ' + x.ft[1] + '</b><small>' + (x.st === "awarded" ? "Awarded" : "FT") + '</small>';
  if(x.st === "live") return '<b class="live">Live</b><small>' + (x.min ? x.min + "'" : "") + '</small>';
  if(x.st === "paused") return '<b class="live">Live</b><small>HT</small>';
  if(x.st === "postponed") return '<b>Off</b><small>Postponed</small>';
  if(x.st === "cancelled" || x.st === "suspended") return '<b>–</b><small>' + (x.st === "cancelled" ? "Cancelled" : "Suspended") + '</small>';
  return '<b>' + clTime(x.ko) + '</b><small>' + CL_DAYS[new Date(x.ko).getDay()] + '</small>';
}
const clMcDate = ms => { const d = new Date(ms); return CL_DAYNAMES[d.getDay()] + " " + d.getDate() + " " + CL_MONTHS[d.getMonth()]; };
const clMcForm = f => '<span class="cl-form" aria-label="Form: ' + f.join(" ") + '">' + f.map(r => '<i class="' + r.toLowerCase() + '">' + r + '</i>').join("") + '</span>';
const clMcPos = T => T ? ordinal(T.pos) + " · " + clPts(T.pts) : "";
/* under a team on the calling card: where it stands and its last five, once its competition's table is here */
function clMcSide(comp, t){
  const m = comp ? clMcNeed(comp) : null, T = m && m.table.find(x => x.key === (t && t.key));
  return T && T.p ? '<small>' + clMcPos(T) + '</small>' + (T.form.length ? clMcForm(T.form) : "") : "";
}
/* the front's way in: the tables and the matches of the leagues BALL follows */
const CL_TABLE_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h16M4 20h16M8 3v19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function clMcEntryHTML(){
  return b4Sec("Tables and matches") + '<div class="cl-comps">' + CL_COMPS.map(C => {
    const m = CL.mc[C.id], top = m && m.table[0] && m.table[0].p ? m.table[0] : null;
    return '<button class="cl-comp" onclick="clGo(\'comp\',{comp:\'' + C.id + '\'})"><span class="cl-mcico">' + CL_TABLE_SVG + '</span>' +
      '<span class="m"><b>' + clE(C.name) + '</b><small>' + (top ? clE(clTeam(top).name) + " top · " + clPts(top.pts) : "Table and matches") + '</small></span></button>';
  }).join("") + '</div>';
}
function clMcTab(t){ audio(); const v = clV(); v.tab = t; render(); }
/* ‹ › through the rounds (the name says matchday: most of them are) */
function clMcMd(d){
  audio();
  const v = clV(), m = CL.mc[v.comp];
  if(!m) return;
  const rs = clMcRounds(m.rows), cur = v.rk != null ? v.rk : clMcNowRound(m.rows), i = rs.indexOf(cur);
  v.rk = rs[Math.max(0, Math.min(rs.length - 1, i + d))];
  render();
}
function clClubGo(comp, key){ clGo("club", { comp, team: key, from: clV() }); }
function clMatchGo(comp, fid){ clGo("match", { comp, fid, from: clV() }); }
/* THE MATCH PAGE comes with its own files (assets/pl/mc.js, mc-stats.js and mc.css) the first time a match is
   opened, not at app start (_plans/match-centre.md §3.5); till then the page is a skeleton */
let MC_LOAD = 0;
function mcNeed(){
  if(MC_LOAD) return;
  MC_LOAD = 1;
  try{
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "assets/pl/mc.css"; document.head.appendChild(css);
    const add = (src, next) => { const s = document.createElement("script"); s.src = src; s.onload = next; s.onerror = () => { MC_LOAD = 0; }; document.head.appendChild(s); };
    add("assets/pl/mc-stats.js", () => add("assets/pl/mc.js", () => clRedraw()));
  }catch(e){ MC_LOAD = 0; }
}
function clMatchPage(v){
  if(typeof mcMatchPage === "function") return mcMatchPage(v);
  mcNeed();
  return b4Page({ title: "Match", ctx: "Loading…", back: "clBack()", cls: "clpage mcpage", body: '<div class="lgskel"></div>' });
}
/* the page class for a title: a long name gets the smaller title (pl.css) */
const clTitleCls = t => "clpage" + (clStr(t).length > 16 ? " cl-long" : "");
function clCompPage(v){
  const C = CL_COMPS.find(c => c.id === v.comp) || CL_COMPS[0], m = clMcNeed(C.id), tab = v.tab || "table";
  const seg = '<div class="lgseg lgseg2 cl-mcseg" role="group" aria-label="' + clE(C.name) + '">' + [["table", "Table"], ["matches", "Matches"]].map(t =>
    '<button aria-pressed="' + (tab === t[0]) + '" onclick="clMcTab(\'' + t[0] + '\')">' + t[1] + '</button>').join("") + '</div>';
  if(!m) return b4Page({ title: C.name, ctx: CL.mcErr || "Loading…", back: "clBack()", cls: clTitleCls(C.name), body: seg + (CL.mcErr ? "" : '<div class="lgskel"></div>') });
  const rk = v.rk != null ? v.rk : clMcNowRound(m.rows);
  return b4Page({ title: C.name, ctx: (tab === "matches" ? clRkLabel(rk) : C.id === "fb.CL" ? "The league stage" : "The table") + " · " + clStr(m.season), back: "clBack()", cls: clTitleCls(C.name),
    body: seg + (tab === "matches" ? clMcMatchesHTML(C, m, rk) : clMcTableHTML(C, m)) });
}
function clMcTableHTML(C, m){
  const T = m.table;
  if(!T.length) return '<div class="lgempty"><b>No matches yet</b><span>The table fills in as soon as the season\'s fixtures are in.</span></div>';
  return '<div class="b4card cream cl-mctable"><div class="cl-mrow hd"><span>#</span><span></span><span>Club</span><span>P</span><span>GD</span><span>Pts</span></div>' +
    T.map(t => { const gd = t.gf - t.ga;
      return '<button class="cl-mrow" onclick="clClubGo(\'' + C.id + '\',\'' + clE(t.key) + '\')"><span class="pos">' + t.pos + '</span>' + clPatch({ key: t.key, name: t.name }, 22) +
        '<span class="nm"><b>' + clE(clTeam(t).name) + '</b>' + (t.form.length ? clMcForm(t.form) : "") + '</span><span>' + t.p + '</span><span>' + (gd > 0 ? "+" : "") + gd + '</span><span class="pts">' + t.pts + '</span></button>';
    }).join("") + '</div><p class="cl-sum">3 points for a win, 1 for a draw. Level on points: goal difference, then goals scored. Tap a club for its matches.</p>';
}
function clMcMatchesHTML(C, m, rk){
  const rs = clMcRounds(m.rows), i = rs.indexOf(rk), games = m.rows.filter(x => clRk(x) === rk);
  const nav = '<div class="cl-mdnav"><button onclick="clMcMd(-1)" aria-label="Round before"' + (i <= 0 ? " disabled" : "") + '>‹</button><b>' + clE(clRkLabel(rk)) + '</b>' +
    '<button onclick="clMcMd(1)" aria-label="Round after"' + (i < 0 || i >= rs.length - 1 ? " disabled" : "") + '>›</button></div>';
  let day = "";
  return nav + games.map(x => {
    const d = clMcDate(x.ko), head = d !== day ? (day = d, b4Sec(d)) : "";
    return head + clMcMatchHTML(C, x);
  }).join("") + (games.length ? "" : '<div class="lgempty"><b>No matches here yet</b><span>The fixtures come in as soon as they are set.</span></div>');
}
function clMcMatchHTML(C, x){
  return '<div class="cl-mm' + (clPlayed(x) ? " done" : "") + '"><button class="h" onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.h.key) + '\')"><span>' + clE(clTeam(x.h).name) + '</span>' + clPatch(x.h, 24) + '</button>' +
    '<button class="sc mcgo" onclick="clMatchGo(\'' + C.id + '\',\'' + clE(x.id) + '\')" aria-label="The match: ' + clE(clTeam(x.h).name) + ' v ' + clE(clTeam(x.a).name) + '">' + clMcScore(x) + '</button>' +
    '<button class="a" onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.a.key) + '\')">' + clPatch(x.a, 24) + '<span>' + clE(clTeam(x.a).name) + '</span></button></div>';
}
function clClubPage(v){
  const C = CL_COMPS.find(c => c.id === v.comp) || CL_COMPS[0], m = clMcNeed(C.id);
  if(!m) return b4Page({ title: "Club", ctx: CL.mcErr || "Loading…", back: "clBack()", cls: "clpage", body: CL.mcErr ? "" : '<div class="lgskel"></div>' });
  /* a club out in the qualifiers is in no table: its name comes from its matches */
  const T = m.table.find(t => t.key === v.team), games = m.rows.filter(x => x.h.key === v.team || x.a.key === v.team);
  const name = clTeam(T || (games[0] ? (games[0].h.key === v.team ? games[0].h : games[0].a) : { key: v.team })).name;
  const played = games.filter(clPlayed).reverse(), next = games.filter(x => !clPlayed(x) && x.st !== "cancelled");
  const res = x => { const home = x.h.key === v.team, f = home ? x.ft[0] : x.ft[1], a = home ? x.ft[1] : x.ft[0]; return f > a ? "w" : f < a ? "l" : "d"; };
  const row = (x, done) => {
    const home = x.h.key === v.team, opp = home ? x.a : x.h, d = new Date(x.ko);
    return '<button class="cl-crow" onclick="clMatchGo(\'' + C.id + '\',\'' + clE(x.id) + '\')"><span class="t">' + (x.md != null ? "MD " + x.md : clE(clStageShort(x.stg))) + '<br>' + CL_DAYS[d.getDay()] + " " + d.getDate() + " " + CL_MONTHS[d.getMonth()] + '</span>' +
      '<span class="o clublink" onclick="event.stopPropagation();clClubGo(\'' + C.id + '\',\'' + clE(opp.key) + '\')">' + clPatch(opp, 22) + '<span>' + (home ? "v " : "at ") + clE(clTeam(opp).name) + '</span></span>' +
      (done ? '<span class="r ' + res(x) + '">' + (home ? x.ft[0] + "–" + x.ft[1] : x.ft[1] + "–" + x.ft[0]) + '</span>' : '<span class="r up">' + clMcScore(x) + '</span>') + '</button>';
  };
  const head = '<div class="b4card dark cl-clubhead">' + clPatch({ key: v.team, name }, 60) + '<div><span class="cl-kick">' + clE(C.name) + '</span><h2>' + clE(name) + '</h2>' +
    (T ? '<p class="cl-when">' + clMcPos(T) + ' · ' + T.w + ' won, ' + T.d + ' drawn, ' + T.l + ' lost</p>' + (T.form.length ? clMcForm(T.form) : "") : "") + '</div></div>';
  return b4Page({ title: name, ctx: C.name + (T ? " · " + ordinal(T.pos) : ""), back: "clBack()", cls: clTitleCls(name),
    body: head + (next.length ? b4Sec("Next") + next.slice(0, 5).map(x => row(x, false)).join("") : "") +
      (played.length ? b4Sec("Results") + played.map(x => row(x, true)).join("") : "") +
      (next.length > 5 ? b4Sec("Later") + next.slice(5).map(x => row(x, false)).join("") : "") +
      '<p class="cl-sum">Tap a match for its preview or result, or a club for its page.</p>' });
}

/* ---------- the clock on the front: the countdown keeps counting ---------- */
let clTickI = null;
function clTickOn(){
  if(clTickI) return;
  try{
    clTickI = setInterval(() => {
      if(!clOn()){ clearInterval(clTickI); clTickI = null; return; }
      try{ document.querySelectorAll("[data-cl-until]").forEach(el => { el.textContent = clLeft(+el.getAttribute("data-cl-until"))[0]; }); }catch(e){}
    }, 20000);
  }catch(e){}
}
