/* BALL 4 · CALL IT: the prediction league's screens.
   _plans/call-it.md (§13, stage 4); the look is _plans/call-it/06-ux.md and its mock-up.

   Loaded by index.html (plNeed) the first time the League tab's Predictions
   segment opens, behind PL_ON, after assets/pl/pl-scoring.js; the styles are
   assets/pl/pl.css, the teams' patches assets/pl/teams.json. A plain script
   with plain globals like the rest of the app, so the screens' onclick=""
   reach them; everything here is cl / CL.

   THE SERVER IS 009_call_it.sql's PLAYER API AND NOTHING ELSE: pl_my_cards,
   pl_card, pl_save_calls, pl_my_leagues, pl_league_table, pl_card_board,
   pl_create_league, pl_league_preview, pl_join, pl_leave; and 018's for a
   league that chooses its own matches: pl_create_league with a filter,
   pl_custom_preview, pl_league_filter. Every write answers {ok, code}. The
   server's clock and kick-off decide what is still open; this file only greys
   a match out early, it never decides.

   A CALL IS KEPT ON THE PHONE FIRST (ball4-pl-pend) and sent a moment later,
   so closing the app never loses one; until the server has it the screen says
   "not sent yet". A call the server turns down because its match has kicked
   off is dropped, and the player is told.

   THE SCREENS are LEAGUE_VIEW.cl.s: home (the Predictions segment), card (call
   the matches), calls (your calls and lock in), new, invite, join, table,
   reveal (the calls are in) and quiz (the Matchday Quiz, assets/pl/pl-quiz.js).
   Copy rule (06-ux.md): no gambling words, ever. */

var CL = { cards: null, card: {}, leagues: null, table: {}, board: {}, teams: null, skew: 0, err: null,
  loading: false, at: 0, i: {}, idWait: 0, asked: {}, mc: {}, mcErr: null, sup: {} };
/* BALL Supporter (_plans/supporter.md; the door is in index.html): the organiser's league of 200, the mark on the table */
const clSup = () => typeof SUP_SHOW !== "undefined" && SUP_SHOW;
const clSupporter = () => typeof isSupporter === "function" && isSupporter();
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
/* on one of the Match Centre's own segments (Matches, Tables, Call It: pl.js draws them; Quiz week is index.html's) */
const CL_SEGS = ["matches", "tables", "callit"];
const clOn = () => typeof LEAGUE_VIEW !== "undefined" && !!LEAGUE_VIEW && CL_SEGS.includes(LEAGUE_VIEW.seg);
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
function clRedraw(){ if(clOn() && !/^(new|join|matches)$/.test(clV().s)) render(); }
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
/* send what is waiting. A change made while a save is on its way stays for the next one. The server takes 30 calls a
   save (pl_save_calls), and a league's own card holds up to 40 (018), so a long queue goes in parts of 30, the
   armband with the first; a part that doesn't get through keeps itself and the rest for the next try. */
const CL_SAVE_MAX = 30;
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
      for(let at = 0; at < Math.max(1, calls.length); at += CL_SAVE_MAX){
        const part = calls.slice(at, at + CL_SAVE_MAX), arm = at === 0 ? c.a || null : null;
        const partC = { c: {}, a: arm };
        part.forEach(x => { partC.c[x.f] = [x.h, x.a]; });
        let d;
        try{
          const r = await sb.rpc("pl_save_calls", { p_card: +id, p_calls: part, p_armband: arm });
          if(r.error){ all = false; break; }
          d = r.data || {};
        }catch(e){ all = false; break; }
        if(d.server_now) CL.skew = d.server_now - Date.now();
        if(!d.ok){
          all = false;
          if(d.code === "found_club") clFoundClub();            // kept: they go once the club is founded
          else if(d.code === "not_found" || d.code === "bad") clPendDrop(id, c);
          break;                                                 // slow_down, not_signed_in: kept for later
        }
        const k = CL.card[id], late = (d.locked || []).map(Number);
        if(k){
          k.mine = k.mine || {}; k.mine.calls = k.mine.calls || {};
          part.forEach(x => { if(!late.includes(x.f)) k.mine.calls[x.f] = [x.h, x.a]; });
          if(arm){
            if(d.armband === "on") k.mine.armband = arm.f;
            else if(d.armband === "off") k.mine.armband = null;
          }
        }
        if(late.length) clLate(id, late);
        if(arm && d.armband && d.armband !== "on" && d.armband !== "off") clArmSaid(d.armband);
        clPendDrop(id, partC);
      }
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
    /* and the way into my league (the one calling this round, else my first), so Today's three's share can
       carry it without loading Call It (threeJoinLine in index.html) */
    const lg = (CL.leagues || []).find(l => l.series === c.series) || CL.leagues[0];
    localStorage.setItem("ball4-pl-strip", JSON.stringify({ at: Date.now(), label: c.label, matches: c.matches | 0, called: c.called | 0, open: c.open | 0, lock: c.next_lock || null,
      lg: lg && lg.code ? { code: lg.code, name: lg.name } : null, qz: typeof clQzStrip === "function" ? clQzStrip(c) : null }));
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
  if(clSup() && CL.table[league]){
    try{ const d = await clRpc("pl_league_supporters", { p_league: league }); if(d.ok){ const m = {}; (d.users || []).forEach(u => { m[u] = 1; }); CL.sup[league] = m; } }catch(e){}
  }
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
  clFilledGo();
  const v = clV();
  const page = { card: clCardPage, calls: clCallsPage, new: clNewPage, invite: clInvitePage, join: clJoinPage,
    table: clTablePage, reveal: clRevealPage, comp: clCompPage, club: clClubPage, match: clMatchPage, matches: clMatchesPage, quiz: x => clQzPage(x) }[v.s];
  st.innerHTML = page ? page(v) : mcHub();
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
/* THE MATCH CENTRE'S HEAD (MC v3, the hub stream): the band, "Match Centre", the four segments, and on Matches and
   Tables the pinned competitions as chips (mchChipsHTML, at the end of this file) */
function clHub(body){
  const seg = typeof LEAGUE_VIEW !== "undefined" && LEAGUE_VIEW ? LEAGUE_VIEW.seg : "callit";
  return '<div class="b6 step lgpage clhub mchub mcseg-' + clE(seg) + '"><div class="b6band"></div><div class="b6body">' +
    '<div class="lghead"><h1 class="lgh1">Match Centre</h1></div><span class="lgsub">Your leagues, your mates\' calls, every table.</span>' +
    lgSegHTML() + (seg === "matches" || seg === "tables" ? mchChipsHTML() : "") + body + '</div></div>';
}
function clHome(){
  const why = clBlocked();
  if(why === "connecting") return clHub('<div class="lgskel"></div>');
  if(why === "offline") return clHub('<div class="lgempty"><b>Predictions need the internet</b><span>The rounds and the tables live on the server, so they are not available right now.</span></div>');
  if(why === "signedout") return clHub(fycTrial() ? fycCardHTML("league") : acctSaveHTML(false));
  if(why === "guest") return clHub(clGuestHTML());
  if(!CL.cards){
    if(!CL.loading && !CL.err) clLoad();
    return clHub(CL.err ? '<div class="lgempty"><b>' + clE(CL.err) + '</b><span>Check the connection and try again.</span><button class="b4btn dark" onclick="clLoad(true)">Try again</button></div>' : '<div class="lgskel"></div>');
  }
  if(Date.now() - CL.at > 60000 && !CL.loading) clLoad();
  const t = clTop();
  return clHub(clRevealBanner() + clNextCard() + (t ? clQzHTML(t.card) : "") + clOtherCards() + clLeaguesHTML());
}
/* THE MATCHDAY QUIZ (assets/pl/pl-quiz.js): the warm-up under a round. It comes after the screens, the first time a
   round is drawn; a phone without that file simply has no quiz */
let CL_QZ = 0;
function clQzHTML(id){
  if(typeof clQzCard === "function") return clQzCard(id);
  if(!CL_QZ){
    CL_QZ = 1;
    try{ const s = document.createElement("script"); s.src = "assets/pl/pl-quiz.js"; s.onload = () => { clStripSave(); clRedraw(); }; s.onerror = () => { CL_QZ = 0; }; document.head.appendChild(s); }
    catch(e){ CL_QZ = 0; }
  }
  return "";
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
  const pips = '<div class="cl-pips' + (n > 20 ? " many" : "") + '" aria-hidden="true">' + (k ? F : Array.from({ length: n }, (x, j) => ({ id: "x" + j }))).map((f, j) =>
    '<span class="' + [(k ? mine.calls[f.id] : j < called) ? "on" : "", armF && f.id === armF.id ? "pa" : ""].filter(Boolean).join(" ") + '"></span>').join("") + '</div>';
  const board = clBoardFor(t);
  return '<div class="b4card dark cl-next">' +
    '<div class="cl-top"><div><span class="cl-kick">' + clE(t.label) + ' · ' + clE(clSeriesName(t.series, t.series_name)) + '</span>' +
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
      '<span class="m"><b>' + clE(clSeriesName(c.series, c.series_name)) + '</b><small>' + clE(c.label) + (c.next_lock ? ' · locks ' + clDay(c.next_lock) : ' · locked') + '</small></span>' +
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
  if(!n) return b4Page({ title: k.card.label, ctx: clSeriesName(k.card.series, k.card.series_name), back: "clBack()", cls: "clpage",
    body: '<div class="lgempty"><b>No matches on this round yet</b><span>They are added as soon as the fixtures are set.</span></div>' });
  let i = CL.i[id];
  if(i == null || i >= n) i = CL.i[id] = clFirstOpen(F, mine);
  const f = F[i], called = F.filter(x => mine.calls[x.id]).length;
  /* a big card (a league's own: up to 40) puts the day in front of each day's first number */
  const byDay = n > 12, dayOf = x => new Date(x.ko).toDateString();
  const jump = '<div class="cl-jump' + (byDay ? " days" : "") + '" role="group" aria-label="Matches">' + F.map((x, j) =>
    (byDay && (j === 0 || dayOf(F[j - 1]) !== dayOf(x)) ? '<span class="cl-jday" aria-hidden="true">' + CL_DAYS[new Date(x.ko).getDay()] + '</span>' : "") +
    '<button class="' + [mine.calls[x.id] ? "done" : "", j === i ? "cur" : "", String(mine.arm) === String(x.id) ? "ab" : "", clOpen(x) ? "" : "lk"].filter(Boolean).join(" ") +
    '" onclick="clAt(' + j + ')" aria-label="Match ' + (j + 1) + (mine.calls[x.id] ? ", called" : "") + '">' + (j + 1) + '</button>').join("") + '</div>';
  return b4Page({ title: k.card.label, ctx: clSeriesName(k.card.series, k.card.series_name) + " · " + called + " of " + n + " called", back: "clBack()", cls: "clpage",
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
  return grid + '<div class="cl-act">' + arm + pill + '</div>' + note + clWaitNote(mine) + clCardShareBtn(k);
}
/* the card as a picture for the group, with the way in */
const clCardShareBtn = k => '<button class="b4btn quiet cl-sharecard" onclick="clCardShare(' + k.card.id + ')">Share the card</button>';
function clDoneHTML(k, f, mine){
  const lg = (CL.leagues || []).find(l => l.series === k.card.series);
  return (lg ? b4Btn("See what your league called ›", "clReveal('" + lg.id + "'," + k.card.id + "," + f.id + ")") : "") +
    '<div class="cl-two">' + b4Btn("‹ Match", "clStep(-1)", "dark") + b4Btn("Match ›", "clStep(1)", "dark") + '</div>' + clWaitNote(mine) + clCardShareBtn(k);
}
function clWaitNote(mine){
  return mine.wait ? '<p class="cl-wait">Saved on this phone, not sent yet. It goes as soon as BALL reaches the server.</p>' : "";
}
/* a league's own card holds the week's earliest 40 (018); the rest are said, not hidden */
const clMoreNote = k => k && k.card && k.card.more > 0
  ? '<p class="cl-sum cl-moreline">And ' + (k.card.more | 0) + ' more this week: a card holds the first ' + CL_CARD_MAX + '.</p>' : "";
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
  /* a big card (a league's own: up to 40) under a heading a day, so forty rows read as a week */
  const byDay = F.length > 12, dayOf = f => new Date(f.ko).toDateString();
  const rows = F.map((f, j) => {
    const c = mine.calls[f.id], arm = String(mine.arm) === String(f.id), H = clTeam(f.home), A = clTeam(f.away);
    const day = byDay && (j === 0 || dayOf(F[j - 1]) !== dayOf(f)) ? '<div class="cl-sday">' + clE(clMcDate(f.ko)) + '</div>' : "";
    return day + '<button class="cl-srow' + (arm ? " armd" : "") + (clOpen(f) ? "" : " lk") + '" onclick="clEdit(' + j + ')">' +
      '<span class="t">' + (byDay ? "" : CL_DAYS[new Date(f.ko).getDay()] + '<br>') + clTime(f.ko) + '</span>' +
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
    body: '<div class="cl-stampwrap" id="clstampwrap"><div class="b4card dark cl-slip' + (byDay ? " days" : "") + '">' + rows + '</div></div>' +
      '<p class="cl-sum">Tap a match to change it. Each match locks at its own kick-off.</p>' + clMoreNote(k) + clWaitNote(mine) +
      (open ? b4Btn("Lock in " + clE(k.card.label), "clLockIn()") : "") + clQzHTML(id) + who });
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
  try{ pushHook("lockin"); }catch(e){}      /* the one-time reminders ask, after the first lock-in (assets/push/push.js) */
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
/* the nudge: the round, when it locks, and the card as a picture with the way in (so the ones who aren't in yet can join) */
async function clNudge(league, card){
  audio(); clTlm("pl-nudge");
  const L = (CL.leagues || []).find(l => l.id === league) || (CL.table[league] && CL.table[league].league), k = card != null ? CL.card[card] : null;
  const first = k ? clF(card).filter(clOpen).map(f => f.ko).sort((a, b) => a - b)[0] : null;
  const text = (k ? clStr(k.card.label) + (first ? " locks " + clDay(first) : "") + ". " : "") + "Your calls, " + clStr(L && L.name) + "!\n" + clJoinLine(league);
  const blob = k ? await clCardImage(card, league) : null;
  return blob ? clSharePNG(blob, "ball-call-it-" + clFile(k.card.label) + ".png", text) : clShareText(text);
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
function clNew(){ if(!clNeedName()) return; clGo("new", { pick: "week", comps: [], teams: [] }); }
/* A LEAGUE FILLED IN BEFOREHAND, from outside Call It (the Euregio Zone's Limburg League): the page opens with the name and the clubs set, and the
   player only taps Start. It waits on LEAGUE_VIEW, so it's gone with the visit, and clFilledGo opens it the moment every rule a new league has is
   met: a guest starts calling first, no username or no 16+ answer gets its sheet, an under-16 gets the same no as New league gives. o: {name,
   teams, names, back}; back is what the page's ‹ does instead of going to Call It's home */
function clNewFilled(o){
  LEAGUE_VIEW.fill = o;
  if(!clBlocked()) clNeedName();
  render();
}
function clFilledGo(){
  const f = LEAGUE_VIEW && LEAGUE_VIEW.fill, a = acct();
  if(!f || clV().s !== "home" || clBlocked() || !a.username || !a.asked16 || !a.ageOk) return;
  LEAGUE_VIEW.fill = null;
  LEAGUE_VIEW.cl = { s: "new", pick: "clubs", comps: [], teams: f.teams.slice(), names: f.names, name: f.name, back: f.back };
  try{ window.scrollTo(0, 0); }catch(e){}
}
/* the name box starts with your own league's name; your club's, when you have one, is among the chips */
function clNameSug(){
  const a = acct(), u = a.username ? a.username.replace(/_/g, " ") : "";
  let club = "";
  try{ club = clStr(ACCT.profile && ACCT.profile.club && ACCT.profile.club.name).trim(); }catch(e){}
  return [u ? u.charAt(0).toUpperCase() + u.slice(1) + "'s League" : "The Prediction League"]
    .concat(club ? [(club + " & Friends").slice(0, 30)] : [], ["Thursday Night Legends", "The Office", "Sunday League Lot"]);
}
/* WHAT WILL YOU CALL? (Martijn, 2 Nov 2026: "When you create a league you can choose which matches you predict, if you
   want to predict the matches of only certain teams or full leagues"; _plans/leagues-signup-sync.md §1). Three ways:
   - the Card of the week (the default): BALL's ten a week, the 'week' series, as before;
   - whole competitions: the eighteen as medal chips, grouped like the hub's Edit sheet. One alone is that
     competition's preset (the old call, which a server without 018 takes too); two or more make the league's own
     series (018_custom_leagues.sql: a card a week, Monday to Sunday, up to 40 matches);
   - your clubs: 1 to 12, found in teams.json, every match they play in any competition BALL carries, cups included.
   Competitions and clubs combine: a club outside the ticked competitions adds its own matches. Under the choice, the
   one line the league will be known by ("Every Eredivisie match, plus Ajax in every competition") and about how many
   matches a week: pl_custom_preview, asked 400 ms after the last change; with the server away, counted from the
   fixtures the match centre has loaded; else nothing. The same picker changes a league's matches (its organiser,
   pl_league_filter, from next week's card on: clMatchesPage). The state is the view's: pick, comps, teams, q, also. */
const CL_MAX_CLUBS = 12, CL_CARD_MAX = 40;
const CL_FIND_SVG = '<svg class="cl-findic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="20.5" y2="20.5"/></svg>';
const CL_CODES = { bad_name: "A name of 2 to 30 letters, please.", under_16: "Leagues are for players aged 16 and over.",
  no_username: "Pick a username first.", too_many: "You're in 20 leagues already.", slow_down: "That's a lot of new leagues. Try again tomorrow.",
  not_found: "That football isn't on right now.", empty_filter: "Tick a competition or find a club first.",
  too_many_clubs: "Twelve clubs is the most a league follows.", too_many_comps: "That's more competitions than BALL carries.",
  unknown_comp: "One of those competitions isn't on right now.", unknown_club: "One of those clubs has no matches on BALL right now.",
  bad_filter: "Couldn't read those matches. Try again.", not_owner: "Only the league's organiser can change its matches.",
  started: "This league is under way on its football. Start a new league to call other matches." };
const clIco = n => typeof ico === "function" ? ico(n) : "";
/* the server's answer when it hasn't the function yet (018 not run): PostgREST's "no such function" */
const clNoFn = e => !!e && (e.code === "PGRST202" || /could not find the function/i.test(clStr(e.message)));
/* the picker's state from what a page was opened with (an old { series } still reads: "week", or a preset's id) */
function clPickFrom(v){
  if(!v.pick){
    const s = clStr(v.series || "week");
    v.pick = s === "week" ? "week" : "comps";
    if(s !== "week" && !v.comps) v.comps = mchComp("fb." + s) ? ["fb." + s] : [];
  }
  v.comps = (v.comps || []).filter(id => !!mchComp(id));
  v.teams = (v.teams || []).slice(0, CL_MAX_CLUBS);
  return v;
}
/* what the picker means: null for the Card of the week, else {comps (in the hub's order), teams (in the order picked)} */
function clFilterOf(v){
  if(v.pick === "week") return null;
  return { comps: CL_COMPS.map(C => C.id).filter(id => (v.comps || []).includes(id)), teams: (v.teams || []).slice() };
}
const clFKey = f => f ? f.comps.join(",") + "|" + f.teams.join(",") : "week";
/* what goes to the server: the Card of the week and one competition alone go by the series' name (the two-argument call
   every server takes); anything else is a filter */
function clPlanOf(v){
  const f = clFilterOf(v);
  if(!f) return { series: "week" };
  if(!f.comps.length && !f.teams.length) return { empty: true };
  if(f.comps.length === 1 && !f.teams.length) return { series: f.comps[0].slice(3), filter: f };
  return { filter: f };
}

/* WHAT A LEAGUE CALLS, in one line: "The Card of the week", "Every Eredivisie and Premier League match", "Ajax, Feyenoord
   and PSV · every competition", "Every Eredivisie match, plus Ajax in every competition". o is a league as pl_my_leagues,
   pl_league_table and pl_league_preview answer it ({series, series_name, kind, filter}), or {filter} from the picker. A
   server without 018 says no filter: a preset is then read from its series' name, the Card of the week from 'week' */
const clAnd = a => a.length < 2 ? clStr(a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const clTeamName = (key, names) => clTeam({ key, name: (names && names[key]) || key }).name;
function clFollowText(o){
  o = o || {};
  const s = clStr(o.series), f = o.filter || (s && s !== "week" && mchComp("fb." + s) ? { comps: ["fb." + s], teams: [] } : null);
  if(!f) return !s || s === "week" ? "The Card of the week" : clStr(o.series_name);
  const comps = (f.comps || []).filter(id => !!mchComp(id)), tn = (f.teams || []).map(k => clTeamName(k, f.names));
  const every = comps.length > 3 ? "Every match in " + comps.length + " competitions" : "Every " + clAnd(comps.map(id => mchComp(id).name)) + " match";
  const clubs = tn.length > 3 ? tn.slice(0, 3).join(", ") + " and " + (tn.length - 3) + " more" : clAnd(tn);
  if(!tn.length) return comps.length ? every : clStr(o.series_name);
  if(!comps.length) return clubs + " · every competition";
  return every + ", plus " + clubs + " in every competition";
}
/* a league's own answers, together: the table's (the freshest), else my leagues' */
function clLeagueFollow(id){
  const t = CL.table[id], L = (t && t.league) || {}, l = (CL.leagues || []).find(x => x.id === id) || {};
  return { series: L.series || l.series, series_name: L.series_name || l.series_name, kind: L.kind || l.kind, filter: L.filter || l.filter || null };
}
/* a league's own card goes by its league's name ("Ajax Away Days"); its series' own name is the filter, long */
function clSeriesName(series, name){
  if(/^c-/.test(clStr(series))){ const l = (CL.leagues || []).find(x => x.series === series); if(l && l.name) return clStr(l.name); }
  return clStr(name);
}
const clKindOf = o => o.kind || (o.series === "week" ? "editorial" : /^c-/.test(clStr(o.series)) ? "custom" : "preset");
/* the line under a league's name: what it calls */
function clCallsLineHTML(o, change){
  return '<div class="cl-leaguecalls"><span class="cl-kick">Calls</span><b>' + clE(clFollowText(o)) + '</b>' +
    (change ? '<button class="cl-change" onclick="' + change + '">Change the matches</button>' : "") + '</div>';
}

/* ---- the three ways, and the panels under them ---- */
function clPickerHTML(v, o){
  o = o || {};
  const opt = (id, ic, title, sub) => '<button class="cl-opt' + (v.pick === id ? " on" : "") + '" aria-pressed="' + (v.pick === id) + '" onclick="clPick(\'' + id + '\')">' +
    '<span class="cl-optic" aria-hidden="true">' + ic + '</span><span class="m"><b>' + title + '</b><small>' + sub + '</small></span>' +
    '<span class="cl-optck" aria-hidden="true">' + (v.pick === id ? clIco("check") : "") + '</span></button>';
  const fan = typeof compFan === "function" ? compFan(["ere", "premier", "ucl"]) : "";
  let html = '<div class="cl-opts">';
  if(!o.noWeek) html += opt("week", clIco("star"), "The Card of the week", "Ten big matches each week, Eredivisie and Premier League");
  html += opt("comps", fan || clIco("trophy"), "Whole competitions", "Every match of the ones you tick: a league, a cup, or a few");
  if(v.pick === "comps") html += clCompsHTML(v) + (v.teams.length || v.also ? clClubsHTML(v) : '<button class="cl-also" onclick="clAlso()">+ Add clubs as well</button>');
  html += opt("clubs", clIco("shield"), "Your clubs", "Up to twelve clubs, every match they play, cups included");
  if(v.pick === "clubs") html += clClubsHTML(v) + (v.comps.length || v.also ? clCompsHTML(v) : '<button class="cl-also" onclick="clAlso()">+ Add whole competitions as well</button>');
  return html + '</div>';
}
function clCompsHTML(v){
  return '<div class="cl-pane cl-cpane"><span class="cl-panelab">Tick the competitions</span>' + MCH_GROUPS.map(g =>
    '<div class="cl-cgroup"><small>' + clE(g[1]) + '</small><div class="cl-cchips">' + CL_COMPS.filter(C => C.group === g[0]).map(C => {
      const on = v.comps.includes(C.id);
      return '<button class="cl-cchip' + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="clComp(\'' + C.id + '\')" title="' + clE(C.name) + '">' +
        clBadge(C.id, 28) + '<span>' + clE(C.nick || C.name) + '</span>' + (on ? '<i aria-hidden="true">' + clIco("check") + '</i>' : "") + '</button>';
    }).join("") + '</div></div>').join("") + '</div>';
}
function clClubsHTML(v){
  const full = v.teams.length >= CL_MAX_CLUBS;
  const chips = v.teams.length ? '<div class="cl-tchips">' + v.teams.map(k => {
    const T = clTeam({ key: k, name: (v.names || {})[k] || k });
    return '<button class="cl-tchip" onclick="clTeamDrop(\'' + clE(k) + '\')" aria-label="Take ' + clE(T.name) + ' off">' + clPatch({ key: k, name: T.name }, 20) +
      '<span>' + clE(T.name) + '</span>' + clIco("close") + '</button>';
  }).join("") + '</div>' : "";
  return '<div class="cl-pane cl-tpane"><span class="cl-panelab">' + (v.teams.length ? v.teams.length + " of " + CL_MAX_CLUBS + " clubs" : "Find your clubs") + '</span>' + chips +
    (full ? '<p class="cl-sum">Twelve clubs is the most a league follows. Take one off to add another.</p>'
      : '<div class="cl-search">' + CL_FIND_SVG + '<input id="clteamq" class="cl-input" maxlength="30" autocomplete="off" spellcheck="false" placeholder="Ajax, Celtic, Napoli…" aria-label="Find a club" value="' +
        clE(v.q || "") + '" oninput="clTeamFind(this.value)"></div><div id="clteamres" class="cl-tres" aria-live="polite">' + clTeamResultsHTML(v) + '</div>') + '</div>';
}
/* the search: every club in teams.json, by its short name or its full one, the start of a name first, then by how big
   its competition is (the hub's order), at most eight */
function clTeamHits(q, have){
  const T = CL.teams || {}, n = mchNorm(q), rank = id => { const i = CL_COMPS.findIndex(C => C.id === id); return i < 0 ? 99 : i; };
  if(n.length < 2) return [];
  const hits = [];
  Object.keys(T).forEach(k => {
    if(have.includes(k)) return;
    const e = T[k]; let own = null;
    try{ own = e.s ? clubOf(e.s) : e.c; }catch(x){ own = e.c || null; }
    const names = [e.n, own && own.name].filter(Boolean).map(mchNorm);
    const at = names.some(x => x.startsWith(n)) ? 0 : names.some(x => x.includes(n)) ? 1 : -1;
    if(at >= 0) hits.push({ k, at, r: rank(e.l), n: clStr(e.n) });
  });
  return hits.sort((a, b) => a.at - b.at || a.r - b.r || a.n.localeCompare(b.n)).slice(0, 8).map(h => h.k);
}
function clTeamResultsHTML(v){
  if(!clStr(v.q).trim()) return "";
  if(!CL.teams){ clTeamsLoad(); return '<p class="cl-sum">Getting the clubs…</p>'; }
  const hits = clTeamHits(v.q, v.teams);
  if(!hits.length) return mchNorm(v.q).length < 2 ? "" : '<p class="cl-sum">No club by that name in the competitions BALL carries.</p>';
  return hits.map(k => {
    const e = CL.teams[k], C = e.l ? mchComp(e.l) : null, T = clTeam({ key: k, name: e.n });
    return '<button class="cl-tpick" onclick="clTeamAdd(\'' + k + '\')" aria-label="Add ' + clE(T.name) + '">' + clPatch({ key: k, name: e.n }, 26) +
      '<span class="m"><b>' + clE(T.name) + '</b><small>' + clE(C ? C.name : "") + '</small></span><span class="cl-tadd" aria-hidden="true">+</span></button>';
  }).join("");
}
/* the one line under the choice, and how many matches a week */
function clPlanHTML(v){
  const f = clFilterOf(v), empty = !!f && !f.comps.length && !f.teams.length;
  return '<div class="b4card dark cl-plan"><span class="cl-kick">Your league calls</span><b id="clfollow">' +
    clE(empty ? "Nothing yet: tick a competition or find a club" : clFollowText(f ? { filter: f } : { series: "week" })) + '</b>' +
    '<small id="clprev" class="cl-prev">' + clE(empty ? "" : clPreviewLine(v)) + '</small></div>';
}
function clPreviewLine(v){
  const f = clFilterOf(v);
  if(!f) return "Ten matches a week, picked by BALL";
  if(!f.comps.length && !f.teams.length) return "";
  const P = (CL.prev || {})[clFKey(f)], weeks = P ? P.weeks : clPreviewLocal(f);
  return weeks ? clPreviewSay(weeks) : "";
}
/* [{n} × 3]: this week (what is left of it) and the next two. The two whole weeks say "about"; this week only when
   they have nothing. A card holds 40 */
function clPreviewSay(weeks){
  const n = weeks.map(w => Math.max(0, (w && w.n) | 0));
  if(!n.some(Boolean)) return "No matches in the next three weeks yet: they come on as soon as they are set";
  if(n.some(x => x > CL_CARD_MAX)) return "About " + CL_CARD_MAX + " matches a week: the most a card holds, the earliest first";
  let avg = Math.round(n.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, n.length - 1));
  if(!avg) avg = n[0];
  return "About " + avg + (avg === 1 ? " match" : " matches") + " a week";
}
/* with the server away: the match centre's fixtures, when every competition the filter needs is here (a club's own
   competition stands for its matches, teams.json's l), weeks from this Monday on the phone's clock; else nothing */
function clPreviewLocal(f){
  const T = CL.teams || {}, need = f.comps.concat(f.teams.map(k => (T[k] && T[k].l) || null));
  if(!need.length || need.some(id => !id || !CL.mc[id])) return null;
  const d = new Date(clNow()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  const mon = d.getTime(), now = clNow(), seen = {}, out = [{ n: 0 }, { n: 0 }, { n: 0 }];
  Object.keys(CL.mc).forEach(id => ((CL.mc[id] && CL.mc[id].rows) || []).forEach(x => {
    if(seen[x.id] || clPlayed(x) || !/^(scheduled|tbd)$/.test(x.st) || x.ko <= now) return;
    if(!(f.comps.includes(id) || f.teams.includes(x.h.key) || f.teams.includes(x.a.key))) return;
    const w = Math.floor((x.ko - mon) / (7 * 864e5));
    if(w >= 0 && w < 3){ out[w].n++; seen[x.id] = 1; }
  }));
  return out;
}
let clPrevT = null;
function clPreviewSoon(){ clearTimeout(clPrevT); clPrevT = setTimeout(clPreviewAsk, 400); }
async function clPreviewAsk(){
  const v = clV();
  if(!/^(new|matches)$/.test(v.s)) return;
  const f = clFilterOf(v);
  if(!f || (!f.comps.length && !f.teams.length)) return;
  const key = clFKey(f), P = CL.prev || (CL.prev = {});
  if(!(P[key] && Date.now() - P[key].at < 10 * 60e3)){
    try{ const d = await clRpc("pl_custom_preview", { p_filter: f }); if(d.ok) P[key] = { at: Date.now(), weeks: d.weeks || [] }; }catch(e){}
  }
  const now = clV(), el = document.getElementById("clprev");
  if(el && now === v && clFKey(clFilterOf(now)) === key) el.innerHTML = clE(clPreviewLine(now));
}
/* ---- what a tap does: the name typed so far is kept, the page drawn again, the line asked for again ---- */
function clPickKeep(){ const v = clV(), el = document.getElementById("clname"); if(el) v.name = el.value; return v; }
function clPick(id){ audio(); const v = clPickKeep(); v.pick = id; v.also = false; render(); clPreviewSoon(); }
function clComp(id){
  audio(); try{ buzz(8); }catch(e){}
  const v = clPickKeep(), i = v.comps.indexOf(id);
  if(i >= 0) v.comps.splice(i, 1); else v.comps.push(id);
  render(); clPreviewSoon();
}
function clAlso(){ audio(); const v = clPickKeep(); v.also = true; render(); }
function clTeamFind(q){ const v = clV(); v.q = clStr(q); const el = document.getElementById("clteamres"); if(el) el.innerHTML = clTeamResultsHTML(v); }
function clTeamAdd(k){
  audio();
  const v = clPickKeep();
  if(v.teams.length >= CL_MAX_CLUBS) return toast("Twelve clubs is the most a league follows.", true);
  if(!v.teams.includes(k)) v.teams.push(k);
  v.q = "";
  render(); clPreviewSoon();
  /* back in the search, for the next club */
  if(v.teams.length < CL_MAX_CLUBS) setTimeout(() => { try{ const el = document.getElementById("clteamq"); if(el && el.focus) el.focus(); }catch(e){} }, 0);
}
function clTeamDrop(k){ audio(); const v = clPickKeep(); v.teams = v.teams.filter(x => x !== k); render(); clPreviewSoon(); }
/* the old way in, by a series' name ("week" or a preset's id), as the picker had it before */
function clSeries(id){
  audio();
  const v = clPickKeep();
  if(id === "week") v.pick = "week";
  else { v.pick = "comps"; v.comps = mchComp("fb." + id) ? ["fb." + id] : []; v.teams = []; }
  render();
}

function clNewPage(v){
  clPickFrom(v);
  const sug = clNameSug();
  if(v.pick !== "week") clPreviewSoon();
  return b4Page({ title: "New league", ctx: "Call It", back: v.back || "clBack()", cls: "clpage", body:
    b4Q("Name your league") +
    '<input id="clname" class="cl-input" maxlength="30" autocomplete="off" value="' + clE(v.name != null ? v.name : sug[0]) + '" aria-label="League name">' +
    '<div class="cl-chips">' + sug.slice(1).map(s => '<button onclick="clNameUse(this)">' + clE(s) + '</button>').join("") + '</div>' +
    b4Q("What will you call?") + clPickerHTML(v) + clPlanHTML(v) +
    '<p class="cl-rules"><b>The rules:</b> the right result 2 points, the right goal difference 1 more, the exact score 2 more (5 in all). ' +
    'The right winner that fewer than 1 in 5 of BALL called: 1 more. Your armband doubles one match a round.</p>' +
    (clSup() ? '<p class="cl-sum">' + (clSupporter() ? "Your leagues take up to 200 players: you're a Supporter." : "Up to 50 players. A BALL Supporter's league takes 200.") + '</p>' : "") +
    b4Btn("Start the league", "clCreate()") });
}
function clNameUse(b){ audio(); const el = document.getElementById("clname"); if(el && b) el.value = b.textContent; }
async function clCreate(){
  audio();
  if(!clNeedName()) return;
  const v = clPickKeep(), name = clStr(v.name).trim(), plan = clPlanOf(clPickFrom(v));
  if(name.length < 2) return toast("Give the league a name.", true);
  if(plan.empty) return toast(CL_CODES.empty_filter, true);
  if(CL.creating) return;
  CL.creating = true;
  try{
    const d = await clRpc("pl_create_league", plan.series ? { p_name: name, p_series: plan.series } : { p_name: name, p_filter: plan.filter });
    if(!d.ok) return toast(CL_CODES[d.code] || "Couldn't create it right now.", true);
    CL.leagues = null; CL.cards = null;
    LEAGUE_VIEW.cl = { s: "invite", league: d.id, code: d.code, name: d.name, fresh: true, from: null,
      follow: { series: d.series || plan.series, series_name: d.series_name, kind: d.kind, filter: d.filter || plan.filter || null } };
    render(); clLoad(true);
  }catch(e){
    toast(clNoFn(e) ? "Choosing your own matches isn't on the server yet: pick the Card of the week or one competition." : "Couldn't create it right now.", true);
  }finally{ CL.creating = false; }
}

/* ---------- the organiser changes the matches (pl_league_filter) ----------
   A league of its own matches changes from next week's card on (the week under way keeps its card, and a match
   someone has called stays on it); a league on the Card of the week or a preset can move until its first card is
   under way. So the organiser sees "Change the matches" on the table while there is something to change. */
function clCanChange(id){
  const t = CL.table[id];
  return !!t && clOwner(id) && (clKindOf(clLeagueFollow(id)) === "custom" || t.last_seq == null);
}
function clMatchesGo(id){
  audio();
  const t = CL.table[id];
  if(!t) return;
  const o = clLeagueFollow(id), kind = clKindOf(o), f = o.filter, v = { league: id, kind, started: t.last_seq != null, from: clV(), comps: [], teams: [] };
  if(kind === "custom" && f){ v.comps = (f.comps || []).slice(); v.teams = (f.teams || []).slice(); v.names = f.names || {}; v.pick = v.comps.length || !v.teams.length ? "comps" : "clubs"; }
  else if(o.series === "week" || !o.series) v.pick = "week";
  else { v.pick = "comps"; v.comps = mchComp("fb." + o.series) ? ["fb." + o.series] : []; }
  v.was = clFKey(clFilterOf(v));
  LEAGUE_VIEW.cl = Object.assign({ s: "matches" }, v); CL.err = null;
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function clMatchesPage(v){
  clPickFrom(v);
  const t = CL.table[v.league], custom = v.kind === "custom";
  if(v.pick !== "week") clPreviewSoon();
  return b4Page({ title: "The matches", ctx: t ? t.league.name : "Your league", back: "clBack()", cls: "clpage", body:
    b4Q("What will your league call?") + clPickerHTML(v, { noWeek: custom && v.started }) + clPlanHTML(v) +
    '<p class="cl-sum cl-fromnote"><b>' + (custom ? "From next week's card on." : "From the next card on.") + '</b> ' +
    (custom ? "This week's card keeps its matches, and a match someone has called stays on its card." : "Nobody has played a card yet, so the league starts on its new matches.") + '</p>' +
    b4Btn("Save the matches", "clMatchesSave()") });
}
async function clMatchesSave(){
  audio();
  const v = clV(), plan = clPlanOf(v), f = clFilterOf(v);
  if(plan.empty) return toast(CL_CODES.empty_filter, true);
  if(clFKey(f) === v.was) return clBack();
  try{
    const d = await clRpc("pl_league_filter", { p_league: v.league, p_filter: f || { series: "week" } });
    if(!d.ok) return toast(d.code === "slow_down" ? "That's a lot of changes for now. Try again in a while." : CL_CODES[d.code] || "Couldn't save it right now.", true);
    delete CL.table[v.league]; CL.leagues = null; CL.cards = null;
    toast(d.kind === "custom" && d.from ? "Saved. " + d.from + " calls the new matches." : "Saved. The league calls its new matches.");
    LEAGUE_VIEW.cl = Object.assign({}, v.from || { s: "table", league: v.league }); CL.err = null;
    /* the table again at once (its own once-in-a-while guard would wait ten seconds) */
    CL.asked["table:" + v.league] = Date.now();
    render(); clLoadTable(v.league); clLoad(true);
  }catch(e){ toast(clNoFn(e) ? "Changing the matches isn't on the server yet." : "Couldn't save it right now.", true); }
}

/* ---------- invite ---------- */
function clInvitePage(v){
  const L = (CL.leagues || []).find(l => l.id === v.league) || {}, t = CL.table[v.league];
  const seats = t ? t.rows.length : L.members || 1, max = (t && t.league.max_members) || 50;
  const follow = v.follow || (L.series || t ? clLeagueFollow(v.league) : null);
  return b4Page({ title: "Invite", ctx: v.name || L.name || "Your league", back: v.fresh ? "clHomeGo()" : "clBack()", cls: "clpage", body:
    (v.fresh ? '<p class="cl-lead">' + clE(v.name) + ' is ready. Now the fun part: get your mates in.</p>' : "") +
    (follow ? clCallsLineHTML(follow) : "") +
    '<div class="lgcode cl-code"><span><small>League code</small><b>' + clE(clCode(v.code)) + '</b></span><button class="cl-copy" onclick="clCopy()">Copy</button></div>' +
    b4Btn("Share the invite", "clInvite()") +
    (clLeagueCard(v.league) ? b4Btn("Share the card", "clCardShare(" + clLeagueCard(v.league).card + ",'" + clE(v.league) + "')", "dark") : "") +
    '<p class="cl-sum">Your mates tap the link, call the round straight away (as a guest if they like), and they are in the table.</p>' +
    b4Sec("Seats · " + seats + " of " + max) +
    (seats >= max && clSup() && !clSupporter() ? '<button class="b4btn quiet" onclick="supGate(\'league\')">Room for more?</button>' : "") +
    (v.fresh ? b4Btn("Call the round ›", "clHomeGo()", "dark") : "") });
}
function clInviteText(v){
  return "Call the scores every round on BALL, in my league " + clStr(v.name) + ".\n" + "Join my league " + clStr(v.name) + ": " + clJoinURL(v.code);
}
function clShareText(text, said){
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast(said || "Copied. Paste it in your group."), () => toast(text)); }catch(e){ toast(text); }
}
function clInvite(){ audio(); const v = clV(); clShareText(clInviteText({ name: v.name || ((CL.leagues || []).find(l => l.id === v.league) || {}).name, code: v.code })); }
function clCopy(){ audio(); const v = clV(); try{ navigator.clipboard.writeText(v.code).then(() => toast("Code copied: " + clCode(v.code)), () => toast(clCode(v.code))); }catch(e){ toast(clCode(v.code)); } }

/* ---------- join ---------- */
function clJoinPage(v){
  const p = v.preview;
  if(!p) return b4Page({ title: "Join a league", ctx: "Predictions", back: v.back || "clBack()", cls: "clpage", body:
    b4Q("The league code", "6 letters and numbers, from the invite") +
    '<div class="lgjoin cl-join"><input id="clcode" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="K7Q 2PM" aria-label="League code" value="' + clE(v.code || "") + '">' +
    '<button class="acsmall" onclick="clLook()">Look</button></div>' + (v.err ? '<p class="cl-err">' + clE(v.err) + '</p>' : "") });
  const top = (p.top || []).map(r => '<span>' + clCrest(r, 26) + '<b>' + clE(r.display_name) + '</b><small>' + ordinal(r.pos) + '</small></span>').join("");
  const facts = '<div class="cl-facts"><span><small>Football</small><b>' + clE(p.series_name) + '</b></span><span><small>Players</small><b>' + (p.members | 0) + '</b></span>' +
    '<span><small>' + (p.card ? "Next up" : "Rounds") + '</small><b>' + (p.card ? clE(p.card.label) : "Every one") + '</b></span></div>';
  return b4Page({ title: "You're invited", ctx: p.series_name, back: "clBack()", cls: "clpage", body:
    '<div class="b4card dark cl-invited"><span class="cl-kick">Prediction league · ' + clE(p.series_name) + '</span><h2>' + clE(p.name) + '</h2>' +
    '<p class="cl-callsline"><small>Calls</small> ' + clE(clFollowText(p)) + '</p>' +
    '<p class="cl-when">' + p.members + ' player' + (p.members === 1 ? "" : "s") + (p.card ? ' · ' + clE(p.card.label) + (p.card.next_lock ? ' locks ' + clDay(p.card.next_lock) : "") : "") + '</p>' +
    facts + (top ? '<div class="cl-who dark">' + top + '</div>' : "") + '</div>' +
    (p.full ? '<div class="lgempty"><b>This league is full</b><span>Ask whoever sent the code to make room, or start your own.' + (clSup() ? " A BALL Supporter's league takes 200: tell whoever runs it." : "") + '</span></div>' + b4Btn("Start your own", "clNew()", "dark")
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
      if(!LEAGUE_VIEW) openLeague("callit");
      LEAGUE_VIEW.seg = "callit";
      LEAGUE_VIEW.cl = { s: "join", code, preview: d, from: null };
      render();
      return true;
    }
  }catch(e){ return false; }
  /* a quiz league's code: join it, or (a guest) show the Quiz week, which says it joins once the club is founded */
  if(!leagueBlocked()) leagueJoin(code);
  else if(LEAGUE_VIEW && clOn()){ LEAGUE_VIEW.seg = "quiz"; LEAGUE_VIEW.cl = null; render(); }
  return false;
}

/* ---------- the table ---------- */
function clTablePage(v){
  const t = CL.table[v.league];
  if(!t){ if(!CL.err && clOnce("table:" + v.league, 10000)) clLoadTable(v.league); return b4Page({ title: "League", ctx: CL.err || "Loading the table…", back: "clBack()", cls: "clpage", body: CL.err ? "" : '<div class="lgskel"></div>' }); }
  const L = t.league, rows = t.rows || [], tied = {};
  rows.forEach(r => { tied[r.pos] = (tied[r.pos] || 0) + 1; });
  const crown = n => n ? '<span class="cl-crown" title="Round wins">' + CL_CROWN + (n > 1 ? '<small>' + n + '</small>' : "") + '</span>' : "";
  const mv = r => r.prev == null ? '<i class="eq">·</i>' : r.prev > r.pos ? '<i class="up" role="img" aria-label="up ' + (r.prev - r.pos) + '">▲' + (r.prev - r.pos) + '</i>' : r.prev < r.pos ? '<i class="dn" role="img" aria-label="down ' + (r.pos - r.prev) + '">▼' + (r.pos - r.prev) + '</i>' : '<i class="eq">=</i>';
  const body = '<div class="b4card cream cl-table">' + '<div class="cl-trow hd"><span>#</span><span></span><span>Club</span><span>Last</span><span>Pts</span></div>' +
    rows.map(r => '<div class="cl-trow' + (r.me ? " me" : "") + '"><span class="pos">' + (tied[r.pos] > 1 ? '<span class="tie">=</span>' : "") + r.pos + mv(r) + '</span>' + clCrest(r, 28) +
      '<span class="nm"><b><span class="t">' + clE(r.display_name) + '</span>' + (CL.sup[L.id] && CL.sup[L.id][r.user_id] ? supMark() : "") + crown(r.crowns) + '</b><small>' + (r.me ? "you" : r.from_seq > L.from_seq && r.base ? "joined later, started on " + r.base : r.exact ? r.exact + " exact" : "") + '</small></span>' +
      '<span class="last">' + (r.last == null ? "–" : "+" + r.last) + '</span><span class="pts">' + r.pts + '</span></div>').join("") + '</div>';
  const solo = rows.length < 2 ? '<div class="lgempty"><b>Just you so far</b><span>Share the code and the table fills up. Everyone calls the same rounds.</span></div>' : "";
  return b4Page({ title: "The table", ctx: L.name, back: "clBack()", cls: "clpage",
    body: clCallsLineHTML(clLeagueFollow(L.id), clCanChange(L.id) ? "clMatchesGo('" + L.id + "')" : null) +
      '<p class="cl-sum cl-tsub">' + rows.length + ' player' + (rows.length === 1 ? "" : "s") + ' · code ' + clE(clCode(L.code)) + '</p>' + solo + body + '<p class="cl-sum">Points: the right result 2, the goal difference 1 more, the exact score 2 more. Level on points: more exact scores, then more right results.</p>' +
      clTableTools(L) +
      '<button class="b4btn quiet" onclick="clLeaveAsk(\'' + L.id + '\')">Leave this league</button>' });
}
/* under the table: the organiser nudges the league, shares the table and copies the invite link; the rest share the
   table and invite a friend. One gold pill: the table as a picture, the one thing everyone wants to post */
function clTableTools(L){
  const owner = clOwner(L.id), k = clLeagueCard(L.id), card = k && k.open > 0 ? k.card : null;
  return b4Btn("Share the table", "clTableShare('" + L.id + "')") +
    (owner
      ? '<div class="cl-two">' + (card != null ? b4Btn("Nudge the league", "clNudge('" + L.id + "'," + card + ")", "dark") : b4Btn("Invite a friend", "clInviteFrom('" + L.id + "')", "dark")) +
        b4Btn("Copy the invite link", "clCopyLink('" + L.id + "')", "dark") + '</div>'
      : b4Btn("Invite a friend", "clInviteFrom('" + L.id + "')", "dark"));
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
    '<b>' + clE(clTeam(full.home).name) + ' v ' + clE(clTeam(full.away).name) + '</b><small>See what everyone called ›</small></button>' +
    /* the round is scored to the end: the table as a picture for the group */
    (clCardDone(t.card) ? '<button class="b4btn quiet cl-sharetable" onclick="clTableShare(\'' + lg.id + '\')">Share the table</button>' : "");
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
      b4Btn("Back to the round ›", "clBack()") +
      '<button class="b4btn quiet" onclick="clRevealShare(\'' + v.league + '\',' + v.card + ',' + v.fid + ')">Share this</button>' });
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
/* the competitions the sync follows (013_more_competitions.sql, and 017's nine more: _plans/match-centre-v3.md §3), in
   the order Tables' "All competitions" lists them. short: the plan's code; nick: the chip's name (the medal says the
   rest); group: where the Edit sheet puts it; cc: its country, for the pins a new phone starts with (mchPinsDefault);
   cup: a European cup, whose table is its league stage. A competition the server doesn't have yet (017 not run) has no
   fixtures, and the hub says "The fixtures arrive with the next sync.", never an error. */
const CL_COMPS = [
  { id: "fb.DED", name: "Eredivisie", short: "ERE", nick: "Eredivisie", group: "Netherlands", cc: "nl" },
  { id: "fb.PL", name: "Premier League", short: "EPL", nick: "Premier League", group: "Big five", cc: "gb" },
  { id: "fb.CL", name: "Champions League", short: "UCL", nick: "Champions", group: "Europe", cc: "eu", cup: true },
  { id: "fb.PD", name: "LaLiga", short: "LIG", nick: "LaLiga", group: "Big five", cc: "es" },
  { id: "fb.SA", name: "Serie A", short: "SEA", nick: "Serie A", group: "Big five", cc: "it" },
  { id: "fb.BL1", name: "Bundesliga", short: "BUN", nick: "Bundesliga", group: "Big five", cc: "de" },
  { id: "fb.FL1", name: "Ligue 1", short: "LI1", nick: "Ligue 1", group: "Big five", cc: "fr" },
  { id: "fb.NL2", name: "Eerste Divisie", short: "EED", nick: "Eerste Divisie", group: "Netherlands", cc: "nl" },
  { id: "fb.BE1", name: "Belgian Pro League", short: "BPL", nick: "Pro League", group: "More", cc: "be" },
  { id: "fb.ELC", name: "Championship", short: "CHA", nick: "Championship", group: "More", cc: "gb" },
  { id: "fb.PPL", name: "Primeira Liga", short: "PPL", nick: "Primeira", group: "More", cc: "pt" },
  { id: "fb.SPL", name: "Scottish Premiership", short: "SPL", nick: "Scotland", group: "More", cc: "sct" },
  { id: "fb.TSL", name: "Süper Lig", short: "TSL", nick: "Süper Lig", group: "More", cc: "tr" },
  { id: "fb.EL", name: "Europa League", short: "UEL", nick: "Europa", group: "Europe", cc: "eu", cup: true },
  { id: "fb.ECL", name: "Conference League", short: "UCO", nick: "Conference", group: "Europe", cc: "eu", cup: true },
  { id: "fb.SSL", name: "Swiss Super League", short: "SSL", nick: "Swiss", group: "More", cc: "ch" },
  { id: "fb.AUT", name: "Austrian Bundesliga", short: "AUT", nick: "Austria", group: "More", cc: "at" },
  { id: "fb.DEN", name: "Danish Superliga", short: "DEN", nick: "Denmark", group: "More", cc: "dk" } ];
const CL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CL_DAYNAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const clPlayed = x => (x.st === "finished" || x.st === "awarded") && !!x.ft;
const clPts = n => n + (n === 1 ? " pt" : " pts");
/* a competition's matches this season, from the fixtures the sync keeps */
async function clMcLoad(comp){
  const sb = sbClient();
  if(!sb || !sb.from) throw new Error("no server");
  const r = await sb.from("pl_fixtures").select("id,season,matchday,stage,kickoff_at,status,home_key,home_name,away_key,away_name,ft_home,ft_away,minute,ending,final_home,final_away").eq("competition_id", comp);
  if(r.error) throw r.error;
  const all = r.data || [], season = all.map(x => x.season).sort().pop();
  const rows = all.filter(x => x.season === season).map(x => ({ id: x.id, md: x.matchday, stg: x.stage, ko: Date.parse(x.kickoff_at), st: x.status,
    h: { key: x.home_key, name: x.home_name }, a: { key: x.away_key, name: x.away_name },
    ft: x.ft_home != null && x.ft_away != null ? [x.ft_home, x.ft_away] : null, min: x.minute,
    end: x.ending || null, fin: x.final_home != null && x.final_away != null ? [x.final_home, x.final_away] : null })).sort((p, q) => p.ko - q.ko || p.id - q.id);
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
/* BALL's own medal for each competition (compBadge in index.html, _brand/competitions), by its quiz key (Martijn, 31 Oct:
   "put the logos we made for the leagues here and on top of the page") */
const CL_BADGE = { "fb.DED": "ere", "fb.PL": "premier", "fb.CL": "ucl", "fb.PD": "laliga", "fb.SA": "seriea", "fb.BL1": "bundesliga",
  "fb.FL1": "ligue1", "fb.NL2": "eerste", "fb.BE1": "belgian",
  /* 017's nine: their medals are already in assets/badges (the Europa and Conference League go by their cup keys) */
  "fb.ELC": "champ", "fb.PPL": "primeira", "fb.SPL": "scotland", "fb.TSL": "superlig", "fb.EL": "uel", "fb.ECL": "uecl",
  "fb.SSL": "swiss", "fb.AUT": "austria", "fb.DEN": "denmark" };
const clBadge = (id, px) => typeof compBadge === "function" && CL_BADGE[id] ? compBadge(CL_BADGE[id], px) : "";
/* Tables' "All competitions" (MC v3: it moved here from the Call It front), denser: three to a row on a wider phone */
function clMcEntryHTML(){
  return b4Sec("All competitions") + '<div class="cl-comps mch-all">' + CL_COMPS.map(C => {
    const m = CL.mc[C.id], top = m && m.table[0] && m.table[0].p ? m.table[0] : null, b = clBadge(C.id, 40);
    return '<button class="cl-comp" onclick="clGo(\'comp\',{comp:\'' + C.id + '\'})"><span class="cl-mcico' + (b ? " badge" : "") + '">' + (b || CL_TABLE_SVG) + '</span>' +
      '<span class="m"><b>' + clE(C.name) + '</b><small>' + (top ? clE(clTeam(top).name) + " · " + clPts(top.pts) : mcPinned(C.id) ? "Pinned" : "Table and matches") + '</small></span></button>';
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
/* MC v3: the charts (assets/pl/mc-charts.js and .css, _plans/match-centre-v3.md §2) come with it, after mc-stats.js
   (they use MCStats.tableAt). A chart file that isn't there is harmless: mc.js loads all the same, and every page
   asks typeof mcCharts first */
let MC_LOAD = 0, MC_CSS = 0;
function mcNeed(){
  if(MC_LOAD) return;
  MC_LOAD = 1;
  try{
    if(!MC_CSS){
      MC_CSS = 1;
      ["assets/pl/mc.css", "assets/pl/mc-charts.css"].forEach(href => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); });
    }
    const add = (src, next, soft) => { const s = document.createElement("script"); s.src = src; s.onload = next; s.onerror = soft ? next : () => { MC_LOAD = 0; }; document.head.appendChild(s); };
    add("assets/pl/mc-stats.js", () => add("assets/pl/mc-charts.js", () => add("assets/pl/mc.js", () => clRedraw()), true));
  }catch(e){ MC_LOAD = 0; }
}
function clMatchPage(v){
  if(typeof mcMatchPage === "function") return mcMatchPage(v);
  mcNeed();
  return b4Page({ title: "Match", ctx: "Loading…", back: "clBack()", cls: "clpage mcpage", body: '<div class="lgskel"></div>' });
}
/* the page class for a title: a long name gets the smaller title (pl.css) */
const clTitleCls = t => "clpage" + (clStr(t).length > 16 ? " cl-long" : "");
/* ---------- MC v3: THE COMPETITION PAGE AND THE CLUB PAGE (_plans/match-centre-v3.md §1.1 items 6–7, the pages stream) ----------
   Sofascore's density in BALL's materials: the table with its zones, the matches with a Results · Fixtures filter, the
   leaders and the stats, and a club page with a Follow button, its season in figures and its players. The leaders,
   the stats and the club page's middle are in assets/pl/mc.js, which comes with the match page's files (mcNeed) the
   first time one of these pages opens. Two other streams' work is used here and guarded everywhere, so these pages
   work, plainer, without it: the hub's pins and followed club (mcPins, mcPinned, mcPinToggle, mcFollow, mcFollowSet,
   mcFollowClear) and the charts (window.mcCharts, assets/pl/mc-charts.js; each returns an SVG string or ""). */

/* THE ZONES (plan §3): where a place in the table leads, one entry per competition. A range is [from, to] or [one];
   n is the table's size. In a league a zone in the bottom half moves with a table of another size (a data hole, a
   league that changed size), so the relegation places stay the last ones; a cup's league stage has fixed bands.
   Lines, not promises: the foot of the table says so. */
const CL_ZONE_LAB = { cl: "Champions League", clq: "Champions League qualifying", eu: "Europe", ecl: "Conference League", up: "Promotion",
  l16: "Last 16", po: "Play-off", ko: "Knockout play-off", down: "Relegation", out: "Out" };
const CL_ZONE_ORDER = ["cl", "l16", "up", "clq", "eu", "ecl", "po", "ko", "down", "out"];
const CL_ZONES = {
  "fb.DED": { n: 18, cl: [1], clq: [2], eu: [3, 4], po: [16], down: [17, 18] },
  "fb.PL": { n: 20, cl: [1, 5], eu: [6], down: [18, 20] },
  "fb.CL": { n: 36, cup: true, l16: [1, 8], ko: [9, 24], out: [25, 36] },
  "fb.PD": { n: 20, cl: [1, 5], eu: [6], down: [18, 20] },
  "fb.SA": { n: 20, cl: [1, 4], eu: [5, 6], down: [18, 20] },
  "fb.BL1": { n: 18, cl: [1, 4], eu: [5, 6], po: [16], down: [17, 18] },
  "fb.FL1": { n: 18, cl: [1, 4], eu: [5, 6], po: [16], down: [17, 18] },
  "fb.NL2": { n: 20, up: [1, 2], po: [3, 8] },
  /* the plan's "1–6 play-off round, 16 down" was a sixteen-club league; the feed has eighteen in 2026-27: the last goes */
  "fb.BE1": { n: 18, po: [1, 6], down: [18], lab: { po: "Title play-offs" } },
  "fb.ELC": { n: 24, up: [1, 2], po: [3, 6], down: [22, 24] },
  "fb.PPL": { n: 18, cl: [1, 2], clq: [3], eu: [4, 5], po: [16], down: [17, 18] },
  "fb.SPL": { n: 12, cl: [1], clq: [2], eu: [3, 4], po: [11], down: [12] },
  "fb.TSL": { n: 18, cl: [1, 2], eu: [3, 4], down: [16, 18] },
  "fb.EL": { n: 36, cup: true, l16: [1, 8], ko: [9, 24], out: [25, 36] },
  "fb.ECL": { n: 36, cup: true, l16: [1, 8], ko: [9, 24], out: [25, 36] },
  "fb.SSL": { n: 12, cl: [1], eu: [2, 3], po: [11], down: [12] },
  "fb.AUT": { n: 12, cl: [1], eu: [2, 3], down: [12] },
  "fb.DEN": { n: 12, cl: [1], eu: [2, 3], down: [11, 12] } };
const clCupStage = id => !!(CL_ZONES[id] && CL_ZONES[id].cup);
/* the zone of a place in a competition's table: {k, label}, or null. size: the table's own length, when known */
function clZoneOf(comp, pos, size){
  const Z = CL_ZONES[comp];
  if(!Z || !(pos > 0)) return null;
  const sh = !Z.cup && size > 0 && Z.n ? size - Z.n : 0;
  for(const k of CL_ZONE_ORDER){
    const r = Z[k];
    if(!r) continue;
    const d = r[0] > Z.n / 2 ? sh : 0;
    if(pos >= r[0] + d && pos <= (r.length > 1 ? r[1] : r[0]) + d) return { k, label: (Z.lab && Z.lab[k]) || CL_ZONE_LAB[k] };
  }
  return null;
}

/* the charts stream's module, when it is here (it hangs itself on window); a chart that throws is no chart */
const clCharts = () => { try{ return (typeof window !== "undefined" && window.mcCharts) || (typeof mcCharts !== "undefined" ? mcCharts : null) || null; }catch(e){ return null; } };
function clChart(fn, ...a){
  const c = clCharts();
  if(!c || typeof c[fn] !== "function") return "";
  try{ return clStr(c[fn](...a)); }catch(e){ return ""; }
}
const clWide = () => { try{ return window.innerWidth >= 400; }catch(e){ return false; } };
/* the followed club (the hub's mcFollow(): {comp, key, name}), wherever it plays: PSV followed from the Eredivisie are
   gold in the Champions League's table too */
function clFollowed(){ try{ const f = typeof mcFollow === "function" ? mcFollow() : null; return f && f.key ? clStr(f.key) : ""; }catch(e){ return ""; } }
const clFollowing = key => !!key && clFollowed() === clStr(key);
function clFollowKey(m){
  const k = clFollowed();
  return k && m && (m.table.some(t => t.key === k) || m.rows.some(x => x.h.key === k || x.a.key === k)) ? k : null;
}
/* a goal difference with its sign, the minus a real one */
const clGD = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
/* the last five as small dots, newest on the right: a win filled green, a draw light, a defeat a ring (never red) */
const clDots = f => '<span class="cl-dots" role="img" aria-label="Form: ' + f.join(" ") + '">' + f.map(r => '<i class="' + r.toLowerCase() + '"></i>').join("") + '</span>';
/* the small tabs under a page's tabs (All · Results · Fixtures, Goals · Assists · Cards) */
const clSubTabs = (items, cur, fn, label) => '<div class="cl-sub" role="group" aria-label="' + clE(label) + '">' + items.map(t =>
  '<button aria-pressed="' + (cur === t[0]) + '" onclick="' + fn + '(\'' + t[0] + '\')">' + t[1] + '</button>').join("") + '</div>';

/* PIN a competition to the Match Centre (the hub keeps the pins). The icon set has no pin yet: this one is drawn the
   set's way (24 grid, 2 px, round caps, currentColor) until it has one */
const CL_PIN_SVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M8.5 3h7"/><path d="M10 3v6l-3.5 4h11L14 9V3"/><line x1="12" y1="13" x2="12" y2="21"/></svg>';
const clPinIco = () => typeof IPATHS !== "undefined" && IPATHS.pin ? ico("pin") : CL_PIN_SVG;
const clPinned = id => { try{ return typeof mcPinned === "function" && !!mcPinned(id); }catch(e){ return false; } };
function clPinHTML(id){
  if(typeof mcPinToggle !== "function") return "";
  const on = clPinned(id);
  return '<button class="cl-pin' + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="clPinToggle(\'' + id + '\')">' + clPinIco() + '<span>' + (on ? "Pinned" : "Pin") + '</span></button>';
}
function clPinToggle(id){ audio(); try{ mcPinToggle(id); }catch(e){} render(); }
/* FOLLOW a club (the hub keeps it): its matches lead the Match Centre, its rows are gold */
function clFollowHTML(comp, key){
  if(typeof mcFollowSet !== "function") return "";
  const on = clFollowing(key);
  return '<button class="cl-follow' + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="clFollowToggle(\'' + comp + '\',\'' + clE(key) + '\')">' +
    ico(on ? "check" : "star") + '<span>' + (on ? "Following" : "Follow") + '</span></button>';
}
function clFollowToggle(comp, key){
  audio();
  if(clFollowing(key)){ try{ if(typeof mcFollowClear === "function") mcFollowClear(); }catch(e){} return render(); }
  const m = CL.mc[comp], T = m && m.table.find(t => t.key === key), g = m && m.rows.find(x => x.h.key === key || x.a.key === key);
  const name = clTeam(T || (g ? (g.h.key === key ? g.h : g.a) : { key })).name;
  try{ mcFollowSet(comp, key, name); }catch(e){}
  toast("Following " + name + ". Their matches come first.");
  render();
}

/* THE PAGE: the medal and the pin, then Table · Matches · Leaders · Stats */
const CL_COMP_TABS = [["table", "Table"], ["matches", "Matches"], ["leaders", "Leaders"], ["stats", "Stats"]];
function clCompPage(v){
  const C = CL_COMPS.find(c => c.id === v.comp) || CL_COMPS[0], m = clMcNeed(C.id), tab = CL_COMP_TABS.some(t => t[0] === v.tab) ? v.tab : "table";
  mcNeed();
  /* the competition's medal on top, the full one with its ring, the pin beside it, then the switch */
  const medal = clBadge(C.id, 104), pin = clPinHTML(C.id);
  const seg = (medal || pin ? '<div class="cl-compmedal' + (pin ? " pin" : "") + '">' + medal + pin + '</div>' : "") +
    '<div class="lgseg lgseg2 cl-mcseg cl-tabs" role="group" aria-label="' + clE(C.name) + '">' + CL_COMP_TABS.map(t =>
    '<button aria-pressed="' + (tab === t[0]) + '" onclick="clMcTab(\'' + t[0] + '\')">' + t[1] + '</button>').join("") + '</div>';
  if(!m) return b4Page({ title: C.name, ctx: CL.mcErr || "Loading…", back: "clBack()", cls: clTitleCls(C.name) + " cl-v3", body: seg + (CL.mcErr ? "" : '<div class="lgskel"></div>') });
  const rk = clMcCur(m, v), skel = '<div class="lgskel"></div>';
  const ctx = tab === "matches" ? clRkLabel(rk) : tab === "leaders" ? "Leaders" : tab === "stats" ? "Stats" : clCupStage(C.id) ? "The league stage" : "The table";
  const body = tab === "matches" ? clMcMatchesHTML(C, m, rk)
    : tab === "leaders" ? (typeof mcLeadersHTML === "function" ? mcLeadersHTML(C, m, v) : skel)
    : tab === "stats" ? (typeof mcStatsTabHTML === "function" ? mcStatsTabHTML(C, m, v) : skel) : clMcTableHTML(C, m);
  return b4Page({ title: C.name, ctx: ctx + " · " + clStr(m.season), back: "clBack()", cls: clTitleCls(C.name) + " cl-v3", body: seg + body });
}
/* THE TABLE: 44 px rows, the zone as a 3 px bar on the left (gold at the top, green for Europe, sage for a play-off,
   the ink at 40% for the drop; never red), P W D L, GD with its sign, the points in 900 italic, the last five as dots,
   and beside them, on a screen of 400 px or more, each club's season as a sparkline (the charts stream's). The
   followed club's row is gold. Under it the zones' key and what they are worth. A zone goes by the row, not the shared
   place: before a ball is kicked every club is 1st, and only one row is */
function clMcTableHTML(C, m){
  const T = m.table;
  if(!T.length) return '<div class="lgempty"><b>No matches yet</b><span>The table fills in as soon as the season\'s fixtures are in.</span></div>';
  const fk = clFollowKey(m), cup = clCupStage(C.id), spark = clWide() && clCharts() ? k => clChart("sparkline", m, k) : () => "";
  const seen = {};
  let last = null;
  const rows = T.map((t, i) => {
    const z = clZoneOf(C.id, i + 1, T.length), zk = z ? z.k : "", name = clTeam(t).name, sp = spark(t.key), brk = last !== null && zk !== last;
    if(z) seen[zk] = z.label;
    last = zk;
    return '<button class="cl-zrow' + (zk ? " z-" + zk : "") + (brk ? " zb" : "") + (t.key === fk ? " fol" : "") + '" onclick="clClubGo(\'' + C.id + '\',\'' + clE(t.key) + '\')" aria-label="' +
      clE(name) + ', ' + ordinal(t.pos) + ', ' + clPts(t.pts) + (z ? ", " + clE(z.label) : "") + (t.key === fk ? ", the club you follow" : "") + '">' +
      '<span class="pos">' + t.pos + '</span>' + clPatch({ key: t.key, name: t.name }, 22) +
      '<span class="nm"><b>' + clE(name) + '</b>' + (t.form.length || sp ? '<span class="sub">' + (t.form.length ? clDots(t.form) : "") + (sp ? '<span class="cl-spark">' + sp + '</span>' : "") + '</span>' : "") + '</span>' +
      '<span>' + t.p + '</span><span>' + t.w + '</span><span>' + t.d + '</span><span>' + t.l + '</span><span class="gd">' + clGD(t.gf - t.ga) + '</span><span class="pts">' + t.pts + '</span></button>';
  }).join("");
  const key = CL_ZONE_ORDER.filter(k => seen[k]).map(k => '<span><i class="z-' + k + '"></i>' + clE(seen[k]) + '</span>').join("");
  return '<div class="b4card cream cl-ztable"><div class="cl-zrow hd" aria-hidden="true"><span>#</span><span></span><span>Club</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>Pts</span></div>' +
    rows + '</div>' + (key ? '<div class="cl-zkey">' + key + '</div>' : "") +
    '<p class="cl-sum">' + (cup ? "The top eight go straight to the last 16; 9th to 24th play off for the other eight places." : "Zones are a guide: cup winners and coefficients can change who goes where.") +
    ' 3 points for a win, 1 for a draw; level on points, goal difference, then goals scored. Tap a club for its page.</p>';
}
/* THE MATCHES: the rounds as before (‹ Matchday 12 ›), and a filter: All, Results (the rounds with a result, the
   latest first on show) or Fixtures (the rounds with a match to play, the one on now first) */
const clMcKeep = (x, mf) => mf === "res" ? clPlayed(x) : mf === "fix" ? !clPlayed(x) && x.st !== "cancelled" : true;
function clMcRoundsFor(rows, mf){
  const rs = clMcRounds(rows);
  return mf === "res" || mf === "fix" ? rs.filter(k => rows.some(x => clRk(x) === k && clMcKeep(x, mf))) : rs;
}
function clMcCur(m, v){
  const mf = v.mf || "all";
  if(mf === "all") return v.rk != null ? v.rk : clMcNowRound(m.rows);
  const rs = clMcRoundsFor(m.rows, mf);
  if(v.rk != null && rs.includes(v.rk)) return v.rk;
  if(mf === "res") return rs.length ? rs[rs.length - 1] : null;
  const now = clMcNowRound(m.rows), soon = clNow() - 4 * 3600e3;
  return rs.includes(now) ? now : rs.find(k => m.rows.some(x => clRk(x) === k && clMcKeep(x, "fix") && x.ko > soon)) || (rs.length ? rs[rs.length - 1] : null);
}
function clMcMf(f){ audio(); const v = clV(); v.mf = /^(res|fix)$/.test(f) ? f : "all"; v.rk = null; render(); }
function clMcGo(d){
  const v = clV(), m = CL.mc[v.comp];
  if(!m) return;
  if(!v.mf || v.mf === "all") return clMcMd(d);
  audio();
  const rs = clMcRoundsFor(m.rows, v.mf), i = rs.indexOf(clMcCur(m, v));
  if(i < 0) return;
  v.rk = rs[Math.max(0, Math.min(rs.length - 1, i + d))];
  render();
}
function clMcMatchesHTML(C, m, rk){
  const mf = clV().mf || "all", fk = clFollowKey(m), rs = clMcRoundsFor(m.rows, mf), i = rs.indexOf(rk);
  const games = rk == null ? [] : m.rows.filter(x => clRk(x) === rk && clMcKeep(x, mf));
  const nav = '<div class="cl-mdnav"><button onclick="clMcGo(-1)" aria-label="Round before"' + (i <= 0 ? " disabled" : "") + '>‹</button><b>' + clE(clRkLabel(rk)) + '</b>' +
    '<button onclick="clMcGo(1)" aria-label="Round after"' + (i < 0 || i >= rs.length - 1 ? " disabled" : "") + '>›</button></div>';
  const none = mf === "res" ? ["No results yet", "The scores come in at full time."] : mf === "fix" ? ["No matches left to play", "The season's fixtures are all played."]
    : ["No matches here yet", "The fixtures come in as soon as they are set."];
  let day = "";
  return clSubTabs([["all", "All"], ["res", "Results"], ["fix", "Fixtures"]], mf, "clMcMf", "Which matches") + nav + games.map(x => {
    const d = clMcDate(x.ko), head = d !== day ? (day = d, b4Sec(d)) : "";
    return head + clMcMatchHTML(C, x, fk);
  }).join("") + (games.length ? "" : '<div class="lgempty"><b>' + none[0] + '</b><span>' + none[1] + '</span></div>');
}
/* a match: the names to their clubs, the score (or the time) to the match page; the followed club's match gold-edged */
function clMcMatchHTML(C, x, fk){
  return '<div class="cl-mm' + (clPlayed(x) ? " done" : "") + (fk && (x.h.key === fk || x.a.key === fk) ? " fol" : "") + '"><button class="h" onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.h.key) + '\')"><span>' + clE(clTeam(x.h).name) + '</span>' + clPatch(x.h, 22) + '</button>' +
    '<button class="sc mcgo" onclick="clMatchGo(\'' + C.id + '\',\'' + clE(x.id) + '\')" aria-label="The match: ' + clE(clTeam(x.h).name) + ' v ' + clE(clTeam(x.a).name) + '">' + clMcScore(x) + '</button>' +
    '<button class="a" onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.a.key) + '\')">' + clPatch(x.a, 22) + '<span>' + clE(clTeam(x.a).name) + '</span></button></div>';
}
/* THE CLUB PAGE: the dark head with Follow and the strip (position, points, goal difference, form), then from mc.js
   its position this season, this season against the league, its scorers and its absentees, then the next match with
   its story line, the results and the rest */
/* the club page shows five results and five fixtures; the rest come with a tap */
function clClubAll(k){ audio(); const v = clV(); if(v) v[k] = true; render(); }
function clClubPage(v){
  const C = CL_COMPS.find(c => c.id === v.comp) || CL_COMPS[0], m = clMcNeed(C.id);
  mcNeed();
  if(!m) return b4Page({ title: "Club", ctx: CL.mcErr || "Loading…", back: "clBack()", cls: "clpage cl-v3", body: CL.mcErr ? "" : '<div class="lgskel"></div>' });
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
  const strip = T && T.p ? '<div class="cl-strip">' + [["Position", ordinal(T.pos)], ["Points", T.pts], ["Goal diff.", clGD(T.gf - T.ga)]].map(c =>
    '<span><small>' + c[0] + '</small><b>' + c[1] + '</b></span>').join("") + '<span><small>Form</small>' + (T.form.length ? clDots(T.form) : "<b>–</b>") + '</span></div>' : "";
  const head = '<div class="b4card dark cl-clubhead"><div class="cl-chtop">' + clPatch({ key: v.team, name }, 60) + '<div class="cl-chname"><span class="cl-kick">' + clE(C.name) + '</span><h2>' + clE(name) + '</h2>' +
    (T && T.p ? '<p class="cl-when">' + T.p + ' played · ' + T.w + ' won, ' + T.d + ' drawn, ' + T.l + ' lost</p>' : "") + '</div>' + clFollowHTML(C.id, v.team) + '</div>' + strip + '</div>';
  const more = typeof mcClubMoreHTML === "function" ? mcClubMoreHTML(C, m, v.team, name, next) : '<div class="lgskel cl-skel-s"></div>';
  const story = next.length && typeof mcClubStoryHTML === "function" ? mcClubStoryHTML(C, m, next[0]) : "";
  return b4Page({ title: name, ctx: C.name + (T ? " · " + ordinal(T.pos) : ""), back: "clBack()", cls: clTitleCls(name) + " cl-v3",
    body: head + more + (next.length ? b4Sec("Next") + row(next[0], false) + story + next.slice(1, 5).map(x => row(x, false)).join("") : "") +
      (played.length ? b4Sec("Results") + (v.allRes ? played : played.slice(0, 5)).map(x => row(x, true)).join("") +
        (!v.allRes && played.length > 5 ? '<button class="cl-more" onclick="clClubAll(\'allRes\')">All ' + played.length + ' results ›</button>' : "") : "") +
      (next.length > 5 ? b4Sec("Later") + (v.allFix ? next.slice(5) : next.slice(5, 10)).map(x => row(x, false)).join("") +
        (!v.allFix && next.length > 10 ? '<button class="cl-more" onclick="clClubAll(\'allFix\')">All ' + (next.length - 5) + ' fixtures ›</button>' : "") : "") +
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

/* ---------- SHARING: the join line, the card picture, the standings picture ----------
   _plans/go-to-market.md, the share stream (2 Nov 2026). Kicktipp grew because organisers bring their
   group, so every share carries the way in: "Join my league <name>: <site>?join=CODE". The pictures
   are drawn on a canvas in the house style (cream paper, the grass band, a slanted gold bar, the clubs
   as their colours in two blocks, never a crest), 1080 x 1350 so WhatsApp shows them whole. The phone's
   share sheet gets the PNG with the words when it takes files; otherwise the PNG is saved and the
   words copied. Glory only, never a gambling word (pl-share-test.js). */
const CL_C = { paper: "#efe4c8", cream: "#F8F1DD", grass: "#123D24", deep: "#0a1f13", card: "#14422A", edge: "#0b2416",
  gold: "#e9b84c", gold1: "#f3cd6b", gold2: "#f6d57c", goldDeep: "#c99a2e", goldSh: "#7a5a10", goldInk: "#241B08",
  dim: "#4f6b56", sage: "#8FB79E", red: "#b8261c", up: "#2f8f52", white: "#ffffff" };
const CL_W = 1080, CL_H = 1350;
/* the site the links point at: where the app runs, without index.html (the fallback is the published site) */
function clSite(){ let u = null; try{ u = acctRedirect(); }catch(e){} u = clStr(u) || "https://ballquiz.app/"; return u.replace(/index\.html$/, ""); }
const clSiteShort = () => clSite().replace(/^https?:\/\//, "").replace(/\/$/, "");
const clJoinURL = code => clSite() + "?join=" + clStr(code);
/* the league a share speaks for: the one asked for, else the first of mine; from the strip the phone keeps when
   the leagues aren't loaded yet (clStripSave) */
function clShareLeague(id){
  const L = CL.leagues || [];
  const l = (id && L.find(x => x.id === id)) || null;
  if(l) return { id: l.id, name: l.name, code: l.code, series: l.series };
  const t = id && CL.table[id];
  if(t && t.league) return { id, name: t.league.name, code: t.league.code, series: t.league.series };
  if(L[0]) return { id: L[0].id, name: L[0].name, code: L[0].code, series: L[0].series };
  try{ const s = JSON.parse(localStorage.getItem("ball4-pl-strip") || "null"); if(s && s.lg && s.lg.code) return { name: s.lg.name, code: s.lg.code }; }catch(e){}
  return null;
}
/* THE JOIN LINE: on the end of every share */
function clJoinLine(id){
  const l = clShareLeague(id);
  return l ? "Join my league " + clStr(l.name) + ": " + clJoinURL(l.code) : "Play along: " + clSite();
}
/* ---- the canvas ---- */
const clFont = (w, px, italic, lora) => (italic ? "italic " : "") + w + " " + px + "px " + (lora ? "'Lora', Georgia, serif" : "'Barlow Semi Condensed', sans-serif");
function clCanvas(){
  try{ const c = document.createElement("canvas"); c.width = CL_W; c.height = CL_H; const x = c.getContext("2d"); return x ? { c, x } : null; }catch(e){ return null; }
}
/* a canvas doesn't wait for a @font-face: ask for the three faces the pictures use, a moment at most */
async function clFontsReady(){
  try{
    if(typeof document === "undefined" || !document.fonts) return;
    const want = ["italic 900 40px 'Barlow Semi Condensed'", "700 30px 'Barlow Semi Condensed'", "italic 400 30px 'Lora'"];
    const load = document.fonts.load ? Promise.all(want.map(f => document.fonts.load(f))) : document.fonts.ready;
    await Promise.race([load, new Promise(r => setTimeout(r, 1500))]);
  }catch(e){}
}
const clBlob = c => new Promise(r => { try{ c.toBlob(b => r(b || null), "image/png"); }catch(e){ r(null); } });
/* text that fits: the size comes down until it does */
function clFitText(x, text, maxW, w, px, italic, lora, min){
  let size = px;
  for(; size > (min || 18); size -= 2){ x.font = clFont(w, size, italic, lora); if(x.measureText(text).width <= maxW) break; }
  x.font = clFont(w, size, italic, lora);
  return size;
}
/* letter-spaced caps, drawn a letter at a time (letterSpacing isn't everywhere yet) */
function clSpaced(x, text, cx, y, gap, align){
  const t = clStr(text).toUpperCase(), ws = [...t].map(ch => x.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + gap * (t.length - 1);
  let at = align === "left" ? cx : align === "right" ? cx - total : cx - total / 2;
  const keep = x.textAlign; x.textAlign = "left";
  [...t].forEach((ch, i) => { x.fillText(ch, at, y); at += ws[i] + gap; });
  x.textAlign = keep;
}
function clRound(x, l, t, w, h, r){
  x.beginPath(); x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r); x.lineTo(l + w, t + h - r);
  x.quadraticCurveTo(l + w, t + h, l + w - r, t + h); x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r); x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t); x.closePath();
}
/* the paper with its faint 115-degree stripes, and the grass band with a slanted foot: the house's top band */
function clPaper(x, bandH){
  x.fillStyle = CL_C.paper; x.fillRect(0, 0, CL_W, CL_H);
  x.save(); x.globalAlpha = .05; x.fillStyle = CL_C.grass;
  for(let i = -CL_H; i < CL_W + CL_H; i += 34){ x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 10, 0); x.lineTo(i + 10 - CL_H * .47, CL_H); x.lineTo(i - CL_H * .47, CL_H); x.closePath(); x.fill(); }
  x.restore();
  x.save();
  x.beginPath(); x.moveTo(0, 0); x.lineTo(CL_W, 0); x.lineTo(CL_W, bandH); x.lineTo(0, bandH - 46); x.closePath(); x.clip();
  const g = x.createLinearGradient(0, 0, 0, bandH); g.addColorStop(0, CL_C.deep); g.addColorStop(1, CL_C.grass);
  x.fillStyle = g; x.fillRect(0, 0, CL_W, bandH);
  x.globalAlpha = .07; x.fillStyle = CL_C.white;                                   /* the mowing stripes */
  for(let i = -bandH; i < CL_W + bandH; i += 180){ x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 90, 0); x.lineTo(i + 90 - bandH * .6, bandH); x.lineTo(i - bandH * .6, bandH); x.closePath(); x.fill(); }
  x.globalAlpha = .45; const d = x.createLinearGradient(0, 0, 0, bandH * .6); d.addColorStop(0, CL_C.deep); d.addColorStop(1, "rgba(10,31,19,0)");
  x.fillStyle = d; x.fillRect(0, 0, CL_W, bandH);
  x.restore();
}
/* the slanted gold bar with letter-spaced caps in it */
function clGoldBar(x, cx, y, text, h){
  x.font = clFont(700, Math.round(h * .5), false);
  const w = x.measureText(clStr(text).toUpperCase()).width + Math.round(h * .5) * .12 * text.length + h * 1.3, l = cx - w / 2, k = h * .25;
  x.fillStyle = CL_C.gold; x.beginPath(); x.moveTo(l + k, y); x.lineTo(l + w, y); x.lineTo(l + w - k, y + h); x.lineTo(l, y + h); x.closePath(); x.fill();
  x.fillStyle = CL_C.goldInk; x.textBaseline = "middle";
  clSpaced(x, text, cx, y + h / 2 + 1, Math.round(h * .5) * .12, "center");
  x.textBaseline = "alphabetic";
}
/* the band's head: BALL . CALL IT over the title */
function clBandHead(x, kicker, title, titleMax){
  x.textAlign = "center"; x.fillStyle = CL_C.gold1; x.font = clFont(700, 30, false);
  clSpaced(x, kicker, CL_W / 2, 96, 8, "center");
  x.fillStyle = CL_C.cream; x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 0; x.shadowOffsetY = 6;
  clFitText(x, title, CL_W - 120, 900, titleMax || 112, true, false, 48);
  x.fillText(title, CL_W / 2, 214);
  x.shadowColor = "transparent"; x.shadowOffsetY = 0;
}
/* a club as its colours: two blocks, the first kit colour and the second (cream on sage for a club BALL has no colours for) */
function clColourBlock(x, t, l, top, w, h){
  const T = clTeam(t), o = T.own || null, c1 = clStr(o && o.c1) || CL_C.sage, c2 = clStr(o && o.c2) || CL_C.cream;
  x.save(); clRound(x, l, top, w, h, 7); x.clip();
  x.fillStyle = c1; x.fillRect(l, top, w, h);
  x.fillStyle = c2; x.fillRect(l + w * .62, top, w * .38, h);
  x.restore();
  x.strokeStyle = "rgba(11,36,22,.35)"; x.lineWidth = 2; clRound(x, l, top, w, h, 7); x.stroke();
}
/* the foot: the gold slab with the way in */
function clJoinSlab(x, top, league){
  const l = clShareLeague(league && league.id), h = 150, pad = 60;
  x.fillStyle = CL_C.goldSh; clRound(x, pad, top + 8, CL_W - pad * 2, h, 18); x.fill();
  const g = x.createLinearGradient(0, top, 0, top + h); g.addColorStop(0, CL_C.gold2); g.addColorStop(1, CL_C.goldDeep);
  x.fillStyle = g; clRound(x, pad, top, CL_W - pad * 2, h, 18); x.fill();
  x.fillStyle = CL_C.goldInk; x.textAlign = "center";
  if(l){
    x.font = clFont(700, 28, false); clSpaced(x, "Join my league · " + l.name, CL_W / 2, top + 52, 3, "center");
    clFitText(x, clSiteShort() + "?join=" + l.code, CL_W - pad * 2 - 60, 900, 54, true, false, 30);
    x.fillText(clSiteShort() + "?join=" + l.code, CL_W / 2, top + 112);
  } else {
    x.font = clFont(700, 28, false); clSpaced(x, "Play along", CL_W / 2, top + 52, 4, "center");
    clFitText(x, clSiteShort(), CL_W - pad * 2 - 60, 900, 54, true, false, 30);
    x.fillText(clSiteShort(), CL_W / 2, top + 112);
  }
  return top + h;
}
/* THE CARD PICTURE: the round's matches, the kick-offs, the way in */
function clCardCanvas(cardId, leagueId){
  const k = CL.card[cardId], cv = clCanvas();
  if(!k || !cv) return null;
  const { c, x } = cv, F = clF(cardId), lg = clShareLeague(leagueId), bandH = 330;
  clPaper(x, bandH);
  clBandHead(x, "BALL · Call It", clStr(k.card.label), 118);
  clGoldBar(x, CL_W / 2, 248, clSeriesName(k.card.series, k.card.series_name), 46);
  /* the matches: a row each, the kick-off on the left; up to 18 (the Champions League's league stage). A league's own card
     holds up to 40 (and its week may have had more than 40: k.card.more): the picture says "and N more" under the rows,
     on a line of its own that the rows leave room for */
  const rows = F.slice(0, 18), extra = F.length - rows.length + Math.max(0, (k.card && k.card.more) | 0);
  const top0 = bandH + 40, footTop = CL_H - 60 - 150 - 30, avail = footTop - top0 - 70 - (extra ? 30 : 0);
  const rh = Math.min(84, Math.floor(avail / Math.max(1, rows.length))), fsMax = Math.max(22, Math.min(40, Math.round(rh * .46)));
  /* the grid: the kick-off | the home side, right-aligned to its colours | v | the away side's colours, its name */
  const bw = Math.round(rh * .5), bh = Math.round(rh * .62), hx = 470, ax = CL_W - 470, nameW = hx - bw - 14 - 196;
  /* one size for every name on the card, the one the longest name fits at */
  const names = rows.flatMap(f => [clTeam(f.home).name, clTeam(f.away).name]);
  const fs = names.reduce((m, nm) => Math.min(m, clFitText(x, nm, nameW, 900, fsMax, true, false, 18)), fsMax);
  x.textBaseline = "middle";
  rows.forEach((f, i) => {
    const y = top0 + i * rh + rh / 2, H = clTeam(f.home), A = clTeam(f.away);
    if(i % 2 === 0){ x.fillStyle = "rgba(18,61,36,.05)"; x.fillRect(50, y - rh / 2, CL_W - 100, rh); }
    x.textAlign = "left"; x.fillStyle = CL_C.dim; x.font = clFont(700, Math.round(fsMax * .6), false);
    const done = !!f.ft && (f.status === "finished" || f.status === "awarded");
    x.fillText((done ? "FT" : clDay(f.ko)).toUpperCase(), 64, y);
    clColourBlock(x, f.home, hx - bw, y - bh / 2, bw, bh);
    clColourBlock(x, f.away, ax, y - bh / 2, bw, bh);
    x.fillStyle = CL_C.edge; x.font = clFont(900, fs, true, false);
    x.textAlign = "right"; x.fillText(H.name, hx - bw - 14, y);
    x.textAlign = "left"; x.fillText(A.name, ax + bw + 14, y);
    x.textAlign = "center";
    const mid = done ? f.ft[0] + " – " + f.ft[1] : "v";
    x.fillStyle = done ? CL_C.edge : CL_C.dim; x.font = clFont(done ? 900 : 600, done ? fs : Math.round(fsMax * .8), done, false);
    x.fillText(mid, CL_W / 2, y);
    if(f.top){
      const th = Math.max(16, Math.round(rh * .2));
      x.fillStyle = CL_C.gold; clRound(x, CL_W / 2 - 54, y + rh * .22, 108, th, 4); x.fill();
      x.fillStyle = CL_C.goldInk; x.font = clFont(700, Math.max(11, Math.round(rh * .14)), false); clSpaced(x, "Top match", CL_W / 2, y + rh * .22 + th / 2 + 1, 1.5, "center");
    }
  });
  if(extra){ x.fillStyle = CL_C.dim; x.textAlign = "center"; x.font = clFont(700, 26, false); x.fillText("and " + extra + " more", CL_W / 2, top0 + rows.length * rh + 26); }
  x.textBaseline = "alphabetic";
  x.fillStyle = CL_C.dim; x.textAlign = "center"; x.font = clFont(400, 30, true, true);
  x.fillText("Call the scores. Beat your mates. All season.", CL_W / 2, Math.min(footTop - 24, top0 + rows.length * rh + (extra ? 80 : 54)));
  clJoinSlab(x, footTop + 10, lg);
  return c;
}
/* the label of the card a league's table was last scored on: the card itself when it is here, else from its number */
function clSeqLabel(series, seq){
  if(seq == null) return "";
  const c = (CL.cards || []).find(k => k.series === series && k.seq === seq);
  if(c) return clStr(c.label);
  const k = Object.values(CL.card || {}).find(d => d && d.card && d.card.series === series && d.card.seq === seq);
  if(k) return clStr(k.card.label);
  /* a league's own cards are numbered by their year and week (018: 202645 is Week 45) */
  return series === "week" ? "round " + seq : /^c-/.test(clStr(series)) ? "Week " + (seq % 100) : "Matchday " + seq;
}
/* a mover's triangle, drawn (never a glyph in a picture) */
function clTri(x, cx, cy, s, up, col){
  x.fillStyle = col; x.beginPath();
  if(up){ x.moveTo(cx, cy - s); x.lineTo(cx + s, cy + s * .8); x.lineTo(cx - s, cy + s * .8); }
  else { x.moveTo(cx, cy + s); x.lineTo(cx + s, cy - s * .8); x.lineTo(cx - s, cy - s * .8); }
  x.closePath(); x.fill();
}
/* THE STANDINGS PICTURE: the league after the card just scored, the top ten (and you), the movers, the way in */
function clTableCanvas(leagueId){
  const t = CL.table[leagueId], cv = clCanvas();
  if(!t || !cv) return null;
  const { c, x } = cv, L = t.league, rows = (t.rows || []).slice(), lg = clShareLeague(leagueId), bandH = 330;
  const mine = (CL.leagues || []).find(l => l.id === leagueId), ser = CL_SERIES.find(s => s.id === L.series);
  const seriesName = clStr((mine && mine.series_name) || (ser && ser.name) || L.series);
  const after = clSeqLabel(L.series, t.last_seq);
  clPaper(x, bandH);
  clBandHead(x, "BALL · Call It", clStr(L.name), 104);
  clGoldBar(x, CL_W / 2, 248, seriesName + (after ? " · after " + after : ""), 46);
  const me = rows.find(r => r.me), top = rows.slice(0, 10), extra = me && !top.includes(me) ? [me] : [];
  const top0 = bandH + 44, footTop = CL_H - 60 - 150 - 30, n = top.length + extra.length + (extra.length ? .5 : 0);
  const rh = Math.min(74, Math.floor((footTop - top0 - 60) / Math.max(1, n)));
  x.textBaseline = "middle";
  const draw = (r, i, y) => {
    if(r.me){ x.fillStyle = "rgba(233,184,76,.28)"; clRound(x, 50, y - rh / 2 + 2, CL_W - 100, rh - 4, 12); x.fill(); }
    else if(i % 2 === 0){ x.fillStyle = "rgba(18,61,36,.05)"; x.fillRect(50, y - rh / 2, CL_W - 100, rh); }
    x.fillStyle = CL_C.edge; x.textAlign = "right"; x.font = clFont(900, Math.round(rh * .5), true); x.fillText(String(r.pos), 128, y);
    if(r.prev != null && r.prev !== r.pos) clTri(x, 164, y, 11, r.prev > r.pos, r.prev > r.pos ? CL_C.up : CL_C.dim);   // down in the dim ink: red is never for losing ground
    else { x.fillStyle = CL_C.dim; x.textAlign = "center"; x.font = clFont(700, 20, false); x.fillText(r.prev == null ? "·" : "=", 164, y); }
    const nm = clStr(r.display_name) + (r.me ? "  (you)" : "");
    x.fillStyle = CL_C.edge; x.textAlign = "left"; clFitText(x, nm, CL_W - 200 - 330, 900, Math.round(rh * .5), true, false, 22);
    x.fillText(nm, 200, y);
    x.textAlign = "right"; x.fillStyle = CL_C.dim; x.font = clFont(700, Math.round(rh * .34), false); x.fillText(r.last == null ? "" : "+" + r.last, CL_W - 190, y);
    x.fillStyle = CL_C.edge; x.font = clFont(900, Math.round(rh * .56), true); x.fillText(String(r.pts), CL_W - 64, y);
  };
  x.fillStyle = CL_C.dim; x.textAlign = "right"; x.font = clFont(700, 20, false);
  clSpaced(x, "Last", CL_W - 190, top0 - 14, 2, "right"); clSpaced(x, "Pts", CL_W - 64, top0 - 14, 2, "right");
  top.forEach((r, i) => draw(r, i, top0 + 10 + i * rh + rh / 2));
  if(extra.length){
    const gy = top0 + 10 + top.length * rh + rh * .25;
    x.fillStyle = CL_C.dim; [-24, 0, 24].forEach(d => { x.beginPath(); x.arc(CL_W / 2 + d, gy, 3.5, 0, Math.PI * 2); x.fill(); });
    draw(me, top.length, top0 + 10 + (top.length + .5) * rh + rh / 2);
  }
  x.textBaseline = "alphabetic";
  const line = rows.length < 2 ? "Just one so far. The table fills up as your mates join." :
    me && me.pos === 1 ? "Top of the table. Someone come and take it." : me && me.prev != null && me.prev > me.pos ? "Up " + (me.prev - me.pos) + " this round." : rows.length + " players. Every match moves it.";
  x.fillStyle = CL_C.dim; x.textAlign = "center"; x.font = clFont(400, 30, true, true);
  x.fillText(line, CL_W / 2, Math.min(footTop - 24, top0 + 10 + (top.length + (extra.length ? 1.5 : 0)) * rh + 56));
  clJoinSlab(x, footTop + 10, lg);
  return c;
}
async function clCardImage(cardId, leagueId){ await clFontsReady(); const c = clCardCanvas(cardId, leagueId); return c ? clBlob(c) : null; }
async function clTableImage(leagueId){ await clFontsReady(); const c = clTableCanvas(leagueId); return c ? clBlob(c) : null; }
/* ---- the words that go with a picture ---- */
function clCardText(cardId, leagueId){
  const k = CL.card[cardId], F = k ? clF(cardId) : [], first = F.filter(clOpen).map(f => f.ko).sort((a, b) => a - b)[0];
  return clStr(k && k.card.label) + " · " + (k ? clSeriesName(k.card.series, k.card.series_name) : "") + ": call the scores on BALL." + (first ? " First kick-off " + clDay(first) + "." : "") + "\n" + clJoinLine(leagueId);
}
function clTableText(leagueId){
  const t = CL.table[leagueId], rows = t ? (t.rows || []) : [], me = rows.find(r => r.me), after = t ? clSeqLabel(t.league.series, t.last_seq) : "";
  const top = rows.slice(0, 3).map(r => r.pos + ". " + clStr(r.display_name) + " " + r.pts).join(", ");
  return clStr(t && t.league.name) + (after ? " after " + after : "") + (top ? ": " + top : "") + (me && me.pos > 3 ? ". Me: " + ordinal(me.pos) + " on " + me.pts : "") + ".\n" + clJoinLine(leagueId);
}
function clRevealText(league, card, fid){
  const k = CL.card[card], b = CL.board[league + ":" + card], fx = k && (k.fixtures || []).find(x => +x.id === +fid), bf = b && (b.fixtures || []).find(x => +x.id === +fid);
  const lgName = clStr(((CL.leagues || []).find(l => l.id === league) || {}).name), ft = bf && bf.ft;
  if(!fx) return "The calls are in on BALL.\n" + clJoinLine(league);
  const H = clTeam(fx.home).name, A = clTeam(fx.away).name, ms = (b && b.members) || [], has = ms.filter(m => m.calls && m.calls[fid]);
  const res = c => c[0] > c[1] ? "h" : c[0] < c[1] ? "a" : "d";
  const right = ft ? has.filter(m => res(m.calls[fid]) === res(ft)).length : 0, exact = ft ? has.filter(m => m.calls[fid][0] === ft[0] && m.calls[fid][1] === ft[1]).length : 0;
  const mine = ms.find(m => m.me), my = mine && mine.calls && mine.calls[fid];
  return "The calls are in · " + H + " v " + A + (ft ? " " + ft[0] + "–" + ft[1] : "") + (lgName ? " · " + lgName : "") + "." +
    (ft && has.length ? " " + right + " of " + has.length + " called the result" + (exact ? ", " + exact + " the exact score" : "") + "." : "") +
    (my ? " Mine: " + my[0] + "–" + my[1] + "." : "") + "\n" + clJoinLine(league);
}
/* ---- sharing a picture: the sheet when it takes files, else the PNG is saved and the words copied ---- */
function clSharePNG(blob, name, text){
  try{
    if(blob && typeof File === "function" && navigator.canShare){
      const file = new File([blob], name, { type: "image/png" });
      if(navigator.canShare({ files: [file] })) return navigator.share({ files: [file], text }).catch(() => {});
    }
  }catch(e){}
  if(blob) clDownload(blob, name);
  return clShareText(text, blob ? "Picture saved and the words copied. Paste them in your group." : null);
}
function clDownload(blob, name){
  try{
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { try{ a.remove(); URL.revokeObjectURL(u); }catch(e){} }, 2000);
  }catch(e){}
}
const clTlm = what => { try{ if(typeof tlmEvent === "function") tlmEvent("share", { what }); }catch(e){} };
const clFile = s => clStr(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ball";
async function clCardShare(cardId, leagueId){
  audio(); clTlm("pl-card");
  const k = CL.card[cardId];
  if(!k){ toast("The round is still loading. Try again in a moment.", true); return; }
  const text = clCardText(cardId, leagueId), blob = await clCardImage(cardId, leagueId);
  return clSharePNG(blob, "ball-call-it-" + clFile(k.card.label) + ".png", text);
}
async function clTableShare(leagueId){
  audio(); clTlm("pl-table");
  const t = CL.table[leagueId];
  if(!t){ clLoadTable(leagueId); toast("The table is still loading. Try again in a moment.", true); return; }
  const text = clTableText(leagueId), blob = await clTableImage(leagueId);
  return clSharePNG(blob, "ball-" + clFile(t.league.name) + "-table.png", text);
}
function clRevealShare(league, card, fid){ audio(); clTlm("pl-reveal"); return clShareText(clRevealText(league, card, fid)); }
/* the organiser's copy of the invite link */
function clCopyLink(leagueId){
  audio();
  const l = clShareLeague(leagueId);
  if(!l) return;
  const u = clJoinURL(l.code);
  try{ navigator.clipboard.writeText(u).then(() => toast("Invite link copied: " + u), () => toast(u)); }catch(e){ toast(u); }
}
/* am I this league's organiser (its creator, or whoever took over) */
function clOwner(leagueId){
  const t = CL.table[leagueId], l = (CL.leagues || []).find(x => x.id === leagueId);
  let me = null; try{ me = acct().id; }catch(e){}
  return !!((t && t.league && me && t.league.owner === me) || (l && l.role === "owner"));
}
/* the card a league is calling now: the one of its series with the next kick-off */
function clLeagueCard(leagueId){
  const l = (CL.leagues || []).find(x => x.id === leagueId), t = CL.table[leagueId], series = (l && l.series) || (t && t.league.series);
  const cs = (CL.cards || []).filter(c => c.series === series).sort((a, b) => (a.next_lock || Infinity) - (b.next_lock || Infinity));
  return cs[0] || null;
}
/* a card scored to the end: nothing open, something finished */
function clCardDone(cardId){
  const F = clF(cardId);
  return F.length > 0 && !F.some(clOpen) && F.some(f => f.status === "finished" || f.status === "awarded");
}

/* ---------- MC v3: THE HUB (_plans/match-centre-v3.md §1.1 items 1-5, the hub stream, 2 Nov 2026) ----------
   Martijn: "much more like a Sofascore type of league tracking app ... and an option to pin leagues you are more
   interested in". The tab is the Match Centre: Matches · Tables · Call It · Quiz week (lgSegHTML in index.html).
   - Matches and Tables show the PINNED competitions (chips under the switch: one tap shows only that one, a second
     tap all of them again), read with the match centre's own loader (clMcLoad: one public read of pl_fixtures per
     competition, kept five minutes), at most once per competition each time the tab is opened (mchNeed).
   - Pins and the followed club live on the phone: ball4-mc-pins (ids, in the player's order; a new phone starts with
     its own league when BALL carries it, the Premier League and the Champions League) and ball4-mc-club
     ({comp, key, name}; null once unfollowed). The followed club's match leads Matches with a gold edge, and its row
     joins its competition's top five on Tables.
   - The home's Match Centre card (b6McCard in index.html) reads ball4-mc-strip, which this file keeps (mchStripSave),
     so the home never loads Call It.
   THE CONTRACT for the pages stream (called behind typeof guards): mcPins(), mcPinned(id), mcPinToggle(id),
   mcFollow(), mcFollowSet(comp, key, name), mcFollowClear(). */
const MC_PINS = "ball4-mc-pins", MC_CLUB = "ball4-mc-club", MC_STRIP = "ball4-mc-strip";
/* the plan's decision 3 is Martijn's (§5): until he says otherwise, the followed club starts as Found your club's
   favourite, when it is in a table the hub has loaded and nothing else there fits */
const MC_FOLLOW_FROM_FAV = true;
/* the Edit sheet's groups: [CL_COMPS' group, its heading] */
const MCH_GROUPS = [["Netherlands", "Netherlands"], ["Big five", "Europe's big five"], ["Europe", "Europe"], ["More", "More"]];
/* a new phone's first pin is its own league, when BALL carries it. The country the way index.html's firstSides finds
   it (LANG_CC): every language the phone prefers, its region first ("nl-BE" is Belgium), else the language's own
   country ("nl" is the Netherlands); English alone says nothing about where */
const MCH_LANG_CC = { nl: "nl", de: "de", fr: "fr", es: "es", it: "it", pt: "pt", da: "dk", tr: "tr" };
const MCH_LOCAL = { nl: "fb.DED", be: "fb.BE1", gb: "fb.PL", es: "fb.PD", it: "fb.SA", de: "fb.BL1", fr: "fb.FL1", pt: "fb.PPL",
  tr: "fb.TSL", ch: "fb.SSL", at: "fb.AUT", dk: "fb.DEN" };
const mchComp = id => CL_COMPS.find(c => c.id === id) || null;
const mchGet = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const mchPut = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
const mchFeel = () => { try{ if(typeof haptic === "function") haptic("select"); }catch(e){} };
/* this visit's own state: the chip that filters (f), the day on Matches (d, 0 is today) and the competitions read
   since the tab opened (read). openLeague makes a new LEAGUE_VIEW, so each visit starts on today, all pins */
function mchV(){
  if(typeof LEAGUE_VIEW === "undefined" || !LEAGUE_VIEW) return null;
  return LEAGUE_VIEW.hub || (LEAGUE_VIEW.hub = { f: null, d: 0, read: {} });
}
/* after a pin or a follow: the page again, and the Edit sheet when it is open (in place, so it doesn't pop in again) */
function mchRedraw(){
  try{
    const o = typeof $ === "function" ? $("#overlay") : null;
    if(o && o.classList && o.classList.contains("show") && /mch-editsheet/.test(o.innerHTML || "")){
      const sh = o.querySelector ? o.querySelector(".sheet") : null;
      if(sh) sh.innerHTML = mchEditHTML(); else sheet(mchEditHTML());
    }
  }catch(e){}
  clRedraw();
}

/* ---- the pins ---- */
function mchPinsDefault(){
  let langs = [];
  try{ langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).map(String); }catch(e){}
  let local = null;
  for(const l of langs){
    const [lang, reg] = l.toLowerCase().split("-");
    local = MCH_LOCAL[reg] || MCH_LOCAL[MCH_LANG_CC[lang]] || null;
    if(local) break;
  }
  return [local, "fb.PL", "fb.CL"].filter((x, i, a) => x && a.indexOf(x) === i);
}
function mcPins(){
  const raw = mchGet(MC_PINS);
  if(raw != null){
    try{ const a = JSON.parse(raw); if(Array.isArray(a)) return a.filter((id, i) => !!mchComp(id) && a.indexOf(id) === i); }catch(e){}
  }
  return mchPinsDefault();
}
function mcPinned(id){ return mcPins().includes(id); }
/* pin or unpin; a new pin goes on the end. True when it is pinned now */
function mcPinToggle(id){
  if(!mchComp(id)) return false;
  mchFeel();
  const a = mcPins(), i = a.indexOf(id);
  if(i >= 0) a.splice(i, 1); else a.push(id);
  mchPut(MC_PINS, JSON.stringify(a));
  const H = mchV();
  if(H && H.f === id && i >= 0) H.f = null;
  mchRedraw();
  return i < 0;
}
function mchPinUp(id){
  const a = mcPins(), i = a.indexOf(id);
  if(i <= 0) return;
  mchFeel();
  a.splice(i - 1, 0, a.splice(i, 1)[0]);
  mchPut(MC_PINS, JSON.stringify(a));
  mchRedraw();
}

/* ---- the followed club ---- */
function mcFollow(){
  const raw = mchGet(MC_CLUB);
  if(raw != null){
    try{ const o = JSON.parse(raw); return o && o.comp && o.key ? { comp: clStr(o.comp), key: clStr(o.key), name: clStr(o.name) } : null; }catch(e){ return null; }
  }
  return MC_FOLLOW_FROM_FAV ? mchFollowFav() : null;
}
function mcFollowSet(comp, key, name){
  if(!comp || !key) return;
  mchFeel();
  mchPut(MC_CLUB, JSON.stringify({ comp: clStr(comp), key: clStr(key), name: clStr(name || clTeam({ key, name }).name) }));
  mchStripSave(true); mchRedraw();
}
function mcFollowClear(){ mchPut(MC_CLUB, "null"); mchStripSave(true); mchRedraw(); }
/* Found your club's favourite (fav.club, a clubs-identity slug) in a league table the hub has loaded: by BALL's own
   identity (teams.json's s) or by name. A reserve side (Jong Ajax) never stands in for its club, and two clubs that
   both fit mean none */
const mchNorm = s => clStr(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\b(fc|afc|cf|sc|ac|as|sv|bv|ssc|rc|cd|fk|sk)\b/g, " ").replace(/[^a-z0-9]+/g, "");
const MCH_RESERVE = /^jong |\b(ii|b|u2[13]|reserves)$/i;
function mchFollowFav(){
  let slug = null;
  try{ const f = acctLocal().fav; slug = f && f.club; }catch(e){}
  if(!slug){ try{ const m = mine(); slug = m && m.fav && m.fav.club; }catch(e){} }
  if(!slug) return null;
  let own = null; try{ own = clubOf(slug); }catch(e){}
  const want = mchNorm(own && own.name ? own.name : clStr(slug).replace(/-/g, " ")), hits = {};
  CL_COMPS.filter(C => !C.cup).forEach(C => {
    const m = CL.mc[C.id];
    ((m && m.table) || []).forEach(t => {
      const T = clTeam(t), byName = !!want && (mchNorm(T.name) === want || mchNorm(t.name) === want);
      const bySlug = T.slug === slug && !MCH_RESERVE.test(T.name) && !MCH_RESERVE.test(clStr(t.name));
      if(byName || bySlug) (hits[t.key] = hits[t.key] || []).push({ comp: C.id, key: clStr(t.key), name: T.name });
    });
  });
  const keys = Object.keys(hits);
  return keys.length === 1 && hits[keys[0]].length === 1 ? Object.assign({ fav: true }, hits[keys[0]][0]) : null;
}

/* ---- the fixtures: the match centre's loader, once per competition per visit ---- */
function mchNeed(id){
  const H = mchV(), m = CL.mc[id], busy = CL.mcBusy || (CL.mcBusy = {}), err = CL.mcHubErr || (CL.mcHubErr = {});
  if(m && Date.now() - m.at < 5 * 60e3) return m;
  if(!H || H.read[id] || busy[id]) return m || null;
  if(!sbClient()){
    /* the server's script comes deferred: look again in a moment, a few times, then say so */
    CL.mcSbN = (CL.mcSbN || 0) + 1;
    if(CL.mcSbN > 12){ err[id] = 1; return m || null; }
    if(!CL.mcSbT) CL.mcSbT = setTimeout(() => { CL.mcSbT = 0; clRedraw(); }, 900);
    return m || null;
  }
  H.read[id] = 1; busy[id] = 1; err[id] = 0; CL.asked["mc:" + id] = Date.now();
  clMcLoad(id).then(() => { busy[id] = 0; mchLanded(); }, () => { busy[id] = 0; err[id] = 1; mchLanded(); });
  return m || null;
}
function mchLanded(){ mchStripSave(true); clRedraw(); }
function mchRetry(){ audio(); const H = mchV(); if(H) H.read = {}; CL.mcHubErr = {}; CL.mcSbN = 0; render(); }

/* ---- what the home's Match Centre card says (ball4-mc-strip) ----
   {at, next: [{comp, id, h: {key, name, s, code, c1, c2}, a, ko, ft, st}], club}: the followed club's next two and
   its last, the next four of the pinned competitions and their three latest results. The home picks two lines when
   it draws (b6McLines), so a strip written on Friday still reads right on Saturday */
function mchStripSave(force){
  try{
    if(!force && Date.now() - (CL.mcStripAt || 0) < 60000) return;
    const F = mcFollow(), ids = mcPins().slice(), now = clNow(), all = [];
    if(F && !ids.includes(F.comp)) ids.push(F.comp);
    ids.forEach(id => { const m = CL.mc[id]; if(m) m.rows.forEach(x => all.push([id, x])); });
    if(!all.length) return;
    CL.mcStripAt = Date.now();
    const side = t => { const T = clTeam(t), o = T.own || {}; return { key: T.key, name: T.name, s: T.slug || null, code: T.code, c1: o.c1 || null, c2: o.c2 || null }; };
    const pack = e => ({ comp: e[0], id: e[1].id, h: side(e[1].h), a: side(e[1].a), ko: e[1].ko, ft: clPlayed(e[1]) ? e[1].ft : null, st: e[1].st });
    const ahead = all.filter(e => !clPlayed(e[1]) && !/^(postponed|cancelled|suspended)$/.test(e[1].st) && e[1].ko > now - 2 * 3600e3).sort((p, q) => p[1].ko - q[1].ko);
    const done = all.filter(e => clPlayed(e[1])).sort((p, q) => q[1].ko - p[1].ko);
    const its = e => mchIsMine(F, e[0], e[1]), pick = [], add = e => { if(e && !pick.includes(e)) pick.push(e); };
    ahead.filter(its).slice(0, 2).forEach(add); add(done.find(its));
    ahead.slice(0, 4).forEach(add); done.slice(0, 3).forEach(add);
    /* THE ONE MATCH the home's card leads with (Martijn, 3 Nov 2026: "more enticing, higher level, and more focused"):
       the followed club's (its result for a day after full time, else its next within a week), else the Card of the
       week's top match, else the biggest still to play in the pinned competitions within three days, by the
       competition's weight and how high both sides stand. With it: why it was picked, its medal, the player's call */
    const W = { "fb.CL": 30, "fb.PL": 22, "fb.PD": 21, "fb.SA": 20, "fb.BL1": 20, "fb.FL1": 18, "fb.EL": 18, "fb.DED": 17, "fb.ECL": 12 };
    const tbl = id => (CL.mc[id] && CL.mc[id].table) || [], pos = (id, key) => { const t = tbl(id).find(r => r.key === key); return t ? t.pos : null; };
    const weight = e => { const n = tbl(e[0]).length || 20, ph = pos(e[0], e[1].h.key), pa = pos(e[0], e[1].a.key);
      return (W[e[0]] || 8) + (ph && pa ? 20 * (2 * n - ph - pa) / (2 * n) : 6); };
    const cards = Object.values(CL.card || {}).filter(d => d && d.card && Array.isArray(d.fixtures));
    const callOf = fid => { for(const d of cards){ const c = d.mine && d.mine.calls && d.mine.calls[String(fid)]; if(c) return c; } return null; };
    const onCard = fid => cards.some(d => d.card.status !== "done" && d.fixtures.some(f => String(f.id) === String(fid) && f.open));
    let hero = null, why = "big";
    const last = done.find(e => its(e) && now - e[1].ko < 30 * 3600e3), next = ahead.find(e => its(e) && e[1].ko < now + 7 * 864e5);
    if(last || next){ hero = last || next; why = "club"; }
    if(!hero) for(const d of cards){
      const f = d.card.series === "week" ? d.fixtures.find(x => x.top && x.open) : null, e = f ? all.find(a => String(a[1].id) === String(f.id)) : null;
      if(e){ hero = e; why = "top"; break; }
    }
    if(!hero){
      const soon = ahead.filter(e => e[1].ko < now + 3 * 864e5).sort((p, q) => weight(q) - weight(p));
      if(soon[0]){ hero = soon[0]; const ph = pos(hero[0], hero[1].h.key), pa = pos(hero[0], hero[1].a.key); why = ph && pa && ph <= 3 && pa <= 3 ? "table" : "big"; }
    }
    const H = hero ? Object.assign(pack(hero), { why, cn: mchComp(hero[0]).name, b: CL_BADGE[hero[0]] || null, club: why === "club" && F ? F.name : null,
      call: callOf(hero[1].id), callable: onCard(hero[1].id), min: hero[1].min || null }) : null;
    /* and the rest of that competition's matches the same day, for the card's rail you swipe (Martijn, 3 Nov 2026:
       "you could scroll to see the other Champions League games of the day on the main page already") */
    const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
    const day = hero ? all.filter(e => e !== hero && e[0] === hero[0] && sameDay(e[1].ko, hero[1].ko) && !/^(postponed|cancelled|suspended)$/.test(e[1].st))
      .sort((p, q) => p[1].ko - q[1].ko).slice(0, 9).map(e => Object.assign(pack(e), { cn: H.cn, b: H.b, min: e[1].min || null })) : [];
    localStorage.setItem(MC_STRIP, JSON.stringify({ at: Date.now(), next: pick.map(pack), hero: H, day, club: F ? { comp: F.comp, key: F.key, name: F.name } : null }));
  }catch(e){}
}

/* ---- the hub: Matches and Tables here, Call It is clHome ---- */
function mcHub(){
  const seg = typeof LEAGUE_VIEW !== "undefined" && LEAGUE_VIEW ? LEAGUE_VIEW.seg : "callit";
  if(seg !== "matches" && seg !== "tables") return clHome();
  /* Call It's rounds, quietly, so the home's line and the next visit's segment know them (no screen waits on it) */
  try{ if(!clBlocked() && !CL.cards && !CL.loading && !CL.err) clLoad(); }catch(e){}
  return clHub(seg === "tables" ? mchTables() : mchMatches());
}
const mchShown = () => { const H = mchV(), p = mcPins(); return H && H.f && p.includes(H.f) ? [H.f] : p; };
const mchIsMine = (F, id, x) => !!F && F.comp === id && !!x && (x.h.key === F.key || x.a.key === F.key);
function mchNoPins(){
  return '<div class="lgempty mch-none"><b>Nothing pinned yet</b><span>Pin the competitions you follow and their matches and tables come here, in your order.</span>' +
    '<button class="b4btn dark" onclick="mchEdit()">Pin competitions</button></div>';
}
const mchOffline = () => '<div class="lgempty mch-none"><b>Not available right now</b><span>The matches and the tables live on the server. Check the connection and try again.</span>' +
  '<button class="b4btn dark" onclick="mchRetry()">Try again</button></div>';
/* under the list: a pinned competition the server has no fixtures for yet (017 not run), or one that didn't load */
function mchNotes(none, failed){
  return none.map(id => '<p class="mch-note">' + clBadge(id, 22) + '<span><b>' + clE(mchComp(id).name) + '</b> The fixtures arrive with the next sync.</span></p>').join("") +
    (failed.length ? '<p class="mch-note"><span><b>' + failed.map(id => clE(mchComp(id).name)).join(", ") + '</b> Not available right now.</span>' +
      '<button class="mch-retry" onclick="mchRetry()">Try again</button></p>' : "");
}

/* ---- Matches: a day at a time, a section per competition in pin order ---- */
const MCH_DAY = 864e5;
function mchDay0(off){ const d = new Date(clNow()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (off | 0)); return d.getTime(); }
function mchDayOf(ms){ const d = new Date(ms); d.setHours(0, 0, 0, 0); return Math.round((d.getTime() - mchDay0(0)) / MCH_DAY); }
const mchDate = off => { const d = new Date(mchDay0(off)); return CL_DAYS[d.getDay()] + " " + d.getDate() + " " + CL_MONTHS[d.getMonth()]; };
const mchDayLabel = off => off === 0 ? "Today" : off === 1 ? "Tomorrow" : off === -1 ? "Yesterday" : mchDate(off);
function mchDayGo(d, rel){ audio(); mchFeel(); const H = mchV(); if(!H) return; H.d = Math.max(-60, Math.min(180, rel ? H.d + d : d)); render(); }
function mchDaysHTML(H){
  const lab = mchDayLabel(H.d);
  return '<div class="mch-days" role="group" aria-label="Day">' +
    '<button class="mch-dstep" onclick="mchDayGo(-1,1)" aria-label="Day before">‹</button>' +
    (H.d ? '<button class="mch-dayl" onclick="mchDayGo(0)" aria-label="' + clE(lab) + ', back to today"><b>' + clE(lab) + '</b><small>' + (Math.abs(H.d) > 1 ? "Back to today" : clE(mchDate(H.d))) + '</small></button>'
      : '<span class="mch-dayl"><b>Today</b><small>' + clE(mchDate(0)) + '</small></span>') +
    '<button class="mch-dstep" onclick="mchDayGo(1,1)" aria-label="Day after">›</button></div>';
}
/* the middle of a row: the kick-off, or the score at full time, its state underneath (FT, HT, Live, Off). A match
   under way says Live and its minute, never its running score (the match centre's rule since 30 Oct) */
function mchCell(x){
  if(clPlayed(x)) return '<b>' + x.ft[0] + '–' + x.ft[1] + '</b><small>' + (x.st === "awarded" ? "Awd" : "FT") + '</small>';
  if(x.st === "live") return '<b class="live">Live</b><small>' + (x.min ? x.min + "'" : "") + '</small>';
  if(x.st === "paused") return '<b class="live">Live</b><small>HT</small>';
  if(x.st === "postponed") return '<b>Off</b><small>Postponed</small>';
  if(x.st === "cancelled" || x.st === "suspended") return '<b>–</b><small>' + (x.st === "cancelled" ? "Cancelled" : "Suspended") + '</small>';
  return '<b>' + clTime(x.ko) + '</b>';
}
function mchRowHTML(id, x, F){
  const H = clTeam(x.h), A = clTeam(x.a), mine = mchIsMine(F, id, x), done = clPlayed(x);
  const w = done ? (x.ft[0] > x.ft[1] ? " wh" : x.ft[0] < x.ft[1] ? " wa" : "") : "";
  const say = H.name + " v " + A.name + (done ? ", full time " + x.ft[0] + "–" + x.ft[1] : x.st === "live" || x.st === "paused" ? ", live"
    : x.st === "postponed" ? ", postponed" : ", " + clTime(x.ko)) + (mine ? ", your club" : "");
  return '<button class="mch-row' + (mine ? " mine" : "") + (done ? " done" : "") + w + '" onclick="clMatchGo(\'' + id + '\',\'' + clE(x.id) + '\')" aria-label="' + clE(say) + '">' +
    '<span class="h"><span class="n">' + clE(H.name) + '</span>' + clPatch(x.h, 24) + '</span>' +
    '<span class="c">' + mchCell(x) + '</span>' +
    '<span class="a">' + clPatch(x.a, 24) + '<span class="n">' + clE(A.name) + '</span></span></button>';
}
function mchSecHTML(id, games, F){
  const C = mchComp(id);
  return '<section class="mch-sec"><button class="mch-kick" onclick="clGo(\'comp\',{comp:\'' + id + '\'})">' + clBadge(id, 24) + '<b>' + clE(C.name) + '</b>' +
    '<span class="mch-n">' + games.length + (games.length === 1 ? " match" : " matches") + '</span><span class="chev" aria-hidden="true">›</span></button>' +
    '<div class="mch-list">' + games.map(x => mchRowHTML(id, x, F)).join("") + '</div></section>';
}
function mchEmptyDay(H, have){
  const from = mchDay0(H.d + 1);
  const next = have.reduce((b, e) => { const x = e[1].rows.find(r => r.ko >= from && r.st !== "cancelled"); return x && (b == null || x.ko < b) ? x.ko : b; }, null);
  const when = H.d === 0 ? "today" : H.d === 1 ? "tomorrow" : H.d === -1 ? "yesterday" : "on " + mchDate(H.d);
  return '<div class="lgempty mch-none mch-off"><b>A day off</b><span>No matches in your pinned leagues ' + when + '.</span>' +
    (next != null ? '<button class="b4btn dark" onclick="mchDayGo(' + mchDayOf(next) + ')">Next match day ›</button>' : "") + '</div>';
}
function mchMatches(){
  const H = mchV(), ids = mchShown(), F = mcFollow(), err = CL.mcHubErr || {};
  if(!ids.length) return mchNoPins();
  const got = ids.map(id => [id, mchNeed(id)]), have = got.filter(e => e[1]);
  const nav = mchDaysHTML(H);
  if(!have.length) return nav + (got.every(e => err[e[0]]) ? mchOffline() : '<div class="lgskel mch-skel"></div>');
  if(have.length === got.length) mchStripSave();
  const from = mchDay0(H.d), to = mchDay0(H.d + 1);
  let secs = have.map(e => ({ id: e[0], games: e[1].rows.filter(x => x.ko >= from && x.ko < to)
    .sort((p, q) => (mchIsMine(F, e[0], q) - mchIsMine(F, e[0], p)) || p.ko - q.ko || p.id - q.id) }));
  /* the followed club's competition leads the day when it plays */
  const its = secs.find(s => s.games.some(x => mchIsMine(F, s.id, x)));
  if(its) secs = [its].concat(secs.filter(s => s !== its));
  const shown = secs.filter(s => s.games.length), waiting = got.some(e => !e[1] && !err[e[0]]);
  const none = have.filter(e => !e[1].rows.length).map(e => e[0]), failed = got.filter(e => !e[1] && err[e[0]]).map(e => e[0]);
  return nav + (shown.length ? shown.map(s => mchSecHTML(s.id, s.games, F)).join("") : waiting ? "" : mchEmptyDay(H, have)) +
    (waiting ? '<div class="lgskel mch-skel sm"></div>' : "") + mchNotes(none, failed);
}

/* ---- Tables: a compact card per pinned competition, then all of them ---- */
/* the last five as dots: won, drawn, and lost as an open ring (red is for live, never for losing) */
const mchForm = f => '<span class="mch-form" role="img" aria-label="Form: ' + f.join(" ") + '">' + f.map(r => '<i class="' + r.toLowerCase() + '"></i>').join("") + '</span>';
function mchTRow(id, m, t, F, spark){
  const gd = t.gf - t.ga, mine = !!F && F.comp === id && F.key === t.key;
  let sp = "";
  if(spark){ try{ sp = clStr(mcCharts.sparkline(m, t.key)); }catch(e){ sp = ""; } }
  return '<button class="mch-trow' + (mine ? " mine" : "") + '" onclick="clClubGo(\'' + id + '\',\'' + clE(t.key) + '\')">' +
    '<span class="pos">' + t.pos + '</span>' + clPatch({ key: t.key, name: t.name }, 22) +
    '<span class="nm"><b>' + clE(clTeam(t).name) + '</b>' + (t.form.length ? mchForm(t.form) : "") + '</span>' +
    (spark ? '<span class="sp" aria-hidden="true">' + sp + '</span>' : "") +
    '<span>' + t.p + '</span><span>' + (gd > 0 ? "+" : "") + gd + '</span><span class="pts">' + t.pts + '</span></button>';
}
function mchTableCard(id, m, F){
  const C = mchComp(id), err = (CL.mcHubErr || {})[id];
  const spark = !!m && typeof mcCharts !== "undefined" && !!mcCharts && typeof mcCharts.sparkline === "function";
  const sub = m && m.rows.length ? (C.cup ? "League stage" : clRkLabel(clMcNowRound(m.rows))) : "";
  /* the head is green, and a tap folds the table away or opens it again (Martijn, 3 Nov 2026), kept on the phone */
  const fold = mchFolded(id);
  const head = '<div class="mch-thead"><button class="mch-tfold" onclick="mchFold(\'' + id + '\')" aria-expanded="' + !fold + '">' + clBadge(id, 28) +
      '<span class="mch-tn"><b>' + clE(C.name) + '</b>' + (sub ? '<small>' + clE(sub) + '</small>' : "") + '</span>' +
      '<span class="mch-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span></button>' +
    '<button class="mch-full" onclick="clGo(\'comp\',{comp:\'' + id + '\'})">Full table ›</button></div>';
  let body;
  if(!m) body = err ? '<p class="mch-tempty">Not available right now. <button class="mch-retry" onclick="mchRetry()">Try again</button></p>' : '<div class="lgskel mch-skel sm"></div>';
  else if(!m.table.length) body = '<p class="mch-tempty">' + (m.rows.length ? "The table starts with the league stage." : "The fixtures arrive with the next sync.") + '</p>';
  else {
    const T = m.table, top = T.slice(0, 5), me = F && F.comp === id ? T.find(t => t.key === F.key) : null;
    body = '<div class="mch-trow hd" aria-hidden="true"><span>#</span><span></span><span>Club</span>' + (spark ? '<span></span>' : "") + '<span>P</span><span>GD</span><span>Pts</span></div>' +
      top.map(t => mchTRow(id, m, t, F, spark)).join("") +
      (me && !top.includes(me) ? '<div class="mch-gap" aria-hidden="true">···</div>' + mchTRow(id, m, me, F, spark) : "");
  }
  return '<section class="mch-tcard' + (spark ? " spark" : "") + (fold ? " folded" : "") + '">' + head + (fold ? "" : body) + '</section>';
}
/* which tables are folded, on this phone (ball4-mc-fold: an array of competition ids) */
const MC_FOLD = "ball4-mc-fold";
function mchFolded(id){ try{ return (JSON.parse(localStorage.getItem(MC_FOLD) || "[]") || []).includes(id); }catch(e){ return false; } }
function mchFold(id){
  audio();
  try{ let a = JSON.parse(localStorage.getItem(MC_FOLD) || "[]"); if(!Array.isArray(a)) a = []; a = a.includes(id) ? a.filter(x => x !== id) : a.concat(id); localStorage.setItem(MC_FOLD, JSON.stringify(a)); }catch(e){}
  render();
}
function mchTables(){
  const ids = mchShown(), F = mcFollow();
  if(typeof mcCharts === "undefined") mcNeed();         // the sparklines come with the match page's files (mc-charts.js)
  return (ids.length ? ids.map(id => mchTableCard(id, mchNeed(id), F)).join("") : mchNoPins()) + clMcEntryHTML();
}

/* ---- the chips and the Edit sheet ---- */
function mchChipsHTML(){
  const H = mchV(), pins = mcPins();
  return '<div class="mch-chips" role="group" aria-label="Pinned competitions">' + pins.map(id => {
    const C = mchComp(id), on = !!H && H.f === id;
    return '<button class="mch-chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" onclick="mchChip(\'' + id + '\')" title="' + clE(C.name) + '">' +
      clBadge(id, 28) + '<span>' + clE(C.nick || C.name) + '</span></button>';
  }).join("") + '<button class="mch-chip mch-editchip" onclick="mchEdit()" aria-label="Edit the pinned competitions">' + (typeof ico === "function" ? ico("pencil") : "") + '<span>Edit</span></button></div>';
}
function mchChip(id){ audio(); mchFeel(); const H = mchV(); if(!H) return; H.f = H.f === id ? null : id; render(); }
function mchEdit(){ audio(); sheet(mchEditHTML()); }
function mchEditDone(){ audio(); closeSheet(); }
function mchEditHTML(){
  const pins = mcPins(), tick = typeof ico === "function" ? ico("check") : "";
  const row = (C, order) => {
    const on = pins.includes(C.id), i = pins.indexOf(C.id);
    return '<div class="mch-erow' + (on ? " on" : "") + '"><button class="mch-pin" onclick="mcPinToggle(\'' + C.id + '\')" aria-pressed="' + on + '">' + clBadge(C.id, 28) +
      '<b>' + clE(C.name) + '</b><span class="mch-tick" aria-hidden="true">' + (on ? tick : "") + '</span></button>' +
      (order ? '<button class="mch-up" onclick="mchPinUp(\'' + C.id + '\')" aria-label="Move ' + clE(C.name) + ' up"' + (i === 0 ? " disabled" : "") + '>▲</button>' : "") + '</div>';
  };
  return '<div class="mch-editsheet"><h2>Your competitions</h2><p>Pin the ones you follow. They lead Matches and Tables, in this order.</p>' +
    (pins.length ? b4Sec("Pinned, in order") + pins.map(id => row(mchComp(id), true)).join("") : "") +
    MCH_GROUPS.map(g => b4Sec(g[1]) + CL_COMPS.filter(C => C.group === g[0]).map(C => row(C, false)).join("")).join("") +
    '<button class="b4btn gold" onclick="mchEditDone()">Done</button></div>';
}
