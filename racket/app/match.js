/* Match point: a quiz-driven tennis match against a computer opponent or a friend (pass the
   phone). app/score.js keeps the real score: 15-30-40, deuce and advantage, games, a tiebreak.

   Against the computer it is played in 3D with Hang Time (app/3d/, loaded when a match starts): the
   ball hangs while you answer, and the answer is where you run. Big points are Live Balls.
   A friend, or a phone that can't run 3D, gets the flat court: each point is a rally, the answers
   set the quality of the serve, the return and the rally (app/rally.js decides the point) and
   app/court.js plays it out. Big points get pressure questions: less time and a heartbeat.
   This file owns the score, the banners and the report on both courts. */
(function(R){
  const T = R.T, RA = R.rally, SC = R.score;
  const QT = { serve: 12, return: 8, rally: 9 }; // seconds per question; 3 less on a big point
  const FORMATS = [
    { id: "tb", n: ["Tiebreak", "Tiebreak"], d: ["First to 7. About 2 minutes.", "Eerste tot 7. Ongeveer 2 minuten."], d3: ["First to 7. Live Balls from 5 points on.", "Eerste tot 7. Live balls vanaf 5 punten."] },
    { id: "short", n: ["Short set", "Korte set"], d: ["First to 4 games. About 6 minutes.", "Eerste tot 4 games. Ongeveer 6 minuten."], d3: ["First to 4 games.", "Eerste tot 4 games."] },
    { id: "set", n: ["Full set", "Hele set"], d: ["First to 6 games. About 10 minutes.", "Eerste tot 6 games. Ongeveer 10 minuten."], d3: ["First to 6 games.", "Eerste tot 6 games."] }
  ];
  const SURF_SAY = { hard: ["Balanced. Now and then a rally question.", "In balans. Af en toe een rallyvraag."], clay: ["Long rallies: often a second question per point.", "Lange rally’s: vaak een tweede vraag per punt."], grass: ["Short points. The serve rules.", "Korte punten. De opslag regeert."] };
  const SURF_3D = { hard: ["Balanced: normal time on the clock.", "In balans: de normale tijd op de klok."], clay: ["More time on the clock, and Live Balls last longer.", "Meer tijd op de klok, en Live balls duren langer."], grass: ["Less time on the clock, and Live Balls start heavier.", "Minder tijd op de klok, en Live balls beginnen zwaarder."] };
  const COL = { captain: "#e0782e", moonball: "#8a63ff", wall: "#c53a2f", lefty: "#17a2b8", cannon: "#e04848", fox: "#f39222", engine: "#55606e", storm: "#9b3fb5", ice: "#4fb3e8", closer: "#1d2533" };
  const PCOL = ["#ff6b4a", "#2fc56f", "#9a6bff"];
  const PREF = "racket.match";
  let pref;
  try { pref = Object.assign({ mode: "cpu", opp: "fox", friend: null, surf: "hard", fmt: "short", view: "3d" }, JSON.parse(localStorage.getItem(PREF) || "{}")); } catch(e){ pref = { view: "3d", mode: "cpu", opp: "fox", friend: null, surf: "hard", fmt: "short" }; }
  const savePref = () => { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch(e){} };
  const esc = s => R.esc(s);

  /* 3D is about 1 MB, so nobody pays for it until they walk on court */
  const CAN3D = (() => { try { const c = document.createElement("canvas"), g = c.getContext("webgl2") || c.getContext("webgl"), e = g && g.getExtension("WEBGL_lose_context"); if(e) e.loseContext(); return !!g; } catch(e){ return false; } })();
  let load3d = null;
  R.load3d = () => load3d || (load3d = (async () => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "app/3d/hang3d.css"; document.head.appendChild(css);
    for(const f of ["three.min", "motion", "stage", "players", "flight", "court3d", "athlete", "hang", "match3d"])
      await new Promise((res, no) => { const s = document.createElement("script"); s.src = "app/3d/" + f + ".js"; s.onload = res; s.onerror = no; document.head.appendChild(s); });
    return R.m3d;
  })().catch(e => { load3d = null; throw e; }));
  const HOW3 = [[["Answer", "Antwoord"], ["The ball hangs while you answer, and your answer is where you run. Right gets you there, close is a lunge, wrong is the wrong way.", "De bal hangt terwijl je antwoordt, en je antwoord is waar je heen rent. Goed en je bent er, bijna is een uitval, fout is de verkeerde kant."]],
    [["Timing", "Timing"], ["Tap when the ring meets the circle. On your serve: pick a target and time the toss.", "Tik als de ring de cirkel raakt. Bij je opslag: kies een doel en time de toss."]],
    [["Big points", "Grote punten"], ["Break, set and match point are Live Balls: every shot is a question, and a right answer sends a heavier ball.", "Break-, set- en matchpoint zijn Live balls: elke slag is een vraag, en een goed antwoord geeft een zwaardere bal."]]];
  const HOW2 = [[["Serve", "Opslag"], ["Pick Easy, Medium or Hard per game. Hard and right is an ace chance; wrong risks a double fault.", "Kies per game Makkelijk, Gemiddeld of Moeilijk. Moeilijk en goed is kans op een ace; fout riskeert een dubbele fout."]],
    [["Return", "Return"], ["A quick question. Fast and right is a winner down the line.", "Een snelle vraag. Snel en goed is een winner langs de lijn."]],
    [["Big points", "Grote punten"], ["Break, set and match point: less time, more nerves.", "Break-, set- en matchpoint: minder tijd, meer zenuwen."]]];
  const CREDIT = () => T("3D strokes adapted from ", "3D-slagen bewerkt uit ") + '<a href="https://github.com/jdpulgarin/Tennis-MoCap" target="_blank" rel="noopener">Tennis-MoCap</a>' +
    T(" (J.D. Pulgarin-Giraldo and others), ", " (J.D. Pulgarin-Giraldo e.a.), ") + '<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>' +
    T(". We cut the strokes and moved them onto our own player. The changed clips carry the same licence.", ". We knipten de slagen en zetten ze op onze eigen speler. De bewerkte clips hebben dezelfde licentie.");

  R.match = function(el){
    let alive = true, court = null, flat = false;
    const timers = new Set();
    const later = (f, ms) => { const t = setTimeout(() => { timers.delete(t); if(alive) f(); }, ms); timers.add(t); return t; };
    const wait = ms => new Promise(res => later(res, ms));
    const me = R.store.me;

    /* a friend needs the phone passed, which the 3D court doesn't do yet */
    const want3d = () => CAN3D && pref.mode === "cpu" && pref.view !== "flat" && !flat;

    /* ---------- setup ---------- */
    function setup(){
      R.paint(pref.surf);
      const others = R.store.players.map((p, i) => i).filter(i => i !== me);
      if(!others.length) pref.mode = "cpu";
      if(!others.includes(pref.friend)) pref.friend = others[0];
      const beaten = new Set(R.store.log.filter(m => m.a === me && typeof m.b === "string" && m.w === 0).map(m => m.b.slice(4)));
      const oppCard = o => '<button class="opp' + (o.id === pref.opp ? " on" : "") + '" data-o="' + o.id + '" style="--oc:' + COL[o.id] + '"><span class="o-top">' + R.flag(o.flag) + '<span class="o-lv">' + "●".repeat(o.lvl + 1) + "<i>" + "●".repeat(4 - o.lvl) + "</i></span></span>" +
        "<b>" + esc(o.name) + "</b><em>“" + esc(R.L(o.nick)) + "”</em><small>" + esc(R.L(o.style)) + "</small>" + (beaten.has(o.id) ? '<span class="o-won">' + T("Beaten", "Verslagen") + "</span>" : "") + "</button>";
      el.innerHTML = '<div class="g-top"><a class="back" href="#play">‹ Menu</a><b>Match point</b><span></span></div>' +
        '<div class="g-body"><h1 class="g-h">Match<br>point</h1>' +
        '<div class="how" id="how"></div>' +
        '<h2 class="sub-h">' + T("Opponent", "Tegenstander") + '</h2><div class="seg" id="mode"><button data-v="cpu"' + (pref.mode === "cpu" ? ' class="on"' : "") + ">" + T("Computer", "Computer") + '</button><button data-v="friend"' + (pref.mode === "friend" ? ' class="on"' : "") + ">" + T("A friend", "Een vriend") + "</button></div>" +
        '<div id="pick"></div>' +
        '<h2 class="sub-h">' + T("Surface", "Ondergrond") + '</h2><div class="seg" id="surf">' + ["hard", "clay", "grass"].map(c => '<button data-v="' + c + '"' + (c === pref.surf ? ' class="on"' : "") + '><i class="sw ' + c + '"></i>' + R.L(RA.SURF[c].name) + "</button>").join("") + '</div><p class="hint" id="surfsay"></p>' +
        '<h2 class="sub-h">' + T("Format", "Lengte") + '</h2><div class="seg" id="fmt">' + FORMATS.map(f => '<button data-v="' + f.id + '"' + (f.id === pref.fmt ? ' class="on"' : "") + ">" + R.L(f.n) + "</button>").join("") + '</div><p class="hint" id="fmtsay"></p>' +
        '<div id="viewrow"><h2 class="sub-h">' + T("Court", "Baan") + '</h2><div class="seg" id="view"><button data-v="3d"' + (pref.view !== "flat" ? ' class="on"' : "") + '>3D</button><button data-v="flat"' + (pref.view === "flat" ? ' class="on"' : "") + ">" + T("Flat, for older phones", "Plat, voor oudere telefoons") + "</button></div></div>" +
        '<p class="count" id="cnt"></p><button class="go shine" id="go">' + T("Walk on court", "De baan op") + '</button><p class="hint m-credit">' + CREDIT() + "</p></div>";
      const pick = () => {
        const box = el.querySelector("#pick");
        if(pref.mode === "cpu"){
          box.innerHTML = RA.LEVELS.map((lv, i) => '<p class="lvh">' + esc(R.L(lv)) + '</p><div class="opps">' + RA.OPP.filter(o => o.lvl === i).map(oppCard).join("") + "</div>").join("");
          box.querySelectorAll(".opp").forEach(b => b.onclick = () => { pref.opp = b.dataset.o; savePref(); box.querySelectorAll(".opp").forEach(x => x.classList.toggle("on", x === b)); R.sfx.pock(0.7); });
        } else if(!others.length){
          /* nobody else on this phone yet: their name is all it takes */
          box.innerHTML = '<div id="fr"></div><p class="hint">' + T("Two players, one phone: each of you answers your own serve and return.", "Twee spelers, één telefoon: ieder beantwoordt zijn eigen opslag en return.") + "</p>";
          R.addForm(box.querySelector("#fr"), T("Your friend’s name", "Naam van je vriend"), i => { pref.friend = i; savePref(); setup(); });
        } else {
          box.innerHTML = '<div class="players fr">' + others.map(i => '<button data-i="' + i + '"' + (i === pref.friend ? ' class="on"' : "") + ">" + R.av(i) + "<b>" + esc(R.store.players[i]) + "</b><span>" + (i === pref.friend ? T("plays", "speelt") : T("pick", "kies")) + "</span></button>").join("") + "</div>" +
            '<p class="hint">' + T("Pass the phone: each of you answers your own serve and return. Sit side by side.", "Telefoon doorgeven: ieder beantwoordt zijn eigen opslag en return. Ga naast elkaar zitten.") + "</p>";
          box.querySelectorAll(".players button").forEach(b => b.onclick = () => { pref.friend = +b.dataset.i; savePref(); pick(); });
        }
      };
      const says = () => {
        const three = want3d(), F = FORMATS.find(f => f.id === pref.fmt);
        el.querySelector("#surfsay").textContent = R.L(three ? SURF_3D[pref.surf] : SURF_SAY[pref.surf]);
        el.querySelector("#fmtsay").textContent = R.L(three ? F.d3 : F.d);
        el.querySelector("#how").innerHTML = (three ? HOW3 : HOW2).map(h => "<div><b>" + esc(R.L(h[0])) + "</b><span>" + esc(R.L(h[1])) + "</span></div>").join("");
        el.querySelector("#viewrow").hidden = pref.mode !== "cpu" || !CAN3D;
      };
      [["#mode", "mode"], ["#surf", "surf"], ["#fmt", "fmt"], ["#view", "view"]].forEach(([id, k]) => el.querySelectorAll(id + " button").forEach(b => b.onclick = () => {
        pref[k] = b.dataset.v; savePref(); el.querySelectorAll(id + " button").forEach(x => x.classList.toggle("on", x === b));
        if(k === "mode"){ pick(); gate(); } if(k === "surf"){ R.paint(pref.surf); R.sfx.bounce(pref.surf); } says();
      }));
      pick(); says();
      const go = el.querySelector("#go");
      /* no match against nobody: "A friend" waits for a second player */
      const gate = () => { go.disabled = (pref.mode === "friend" && !others.length) || !R.qs.count("all", "mix"); };
      go.disabled = true;
      el.querySelector("#cnt").textContent = T("Loading the questions…", "Vragen laden…");
      R.qs.load().then(() => { if(!alive) return; gate(); el.querySelector("#cnt").textContent = ""; })
        .catch(() => { if(alive) el.querySelector("#cnt").textContent = T("The questions won’t load. Try again in a moment.", "De vragen laden niet. Probeer het zo nog eens."); });
      go.onclick = () => { R.sfx.unlock(); walkOn(); };
      R.fx.stagger(el.querySelector(".g-body"), ".g-h, .how, .sub-h, .seg, #pick, .hint, .go", 0);
    }

    /* ---------- the players ---------- */
    let P, s, st, fmt, surf, asked = [];
    function makePlayers(){
      const a = { human: true, idx: me, name: R.store.players[me], col: PCOL[me % 3], hand: "R", tier: null, tierKey: null, run: 0 };
      let b;
      if(pref.mode === "cpu"){ const o = RA.opp(pref.opp); b = { human: false, o, name: o.name, nick: R.L(o.nick), flag: o.flag, col: COL[o.id], hand: o.hand, run: 0 }; }
      else b = { human: true, idx: pref.friend, name: R.store.players[pref.friend], col: PCOL[pref.friend % 3], hand: "R", tier: null, tierKey: null, run: 0 };
      P = [a, b]; asked = [];
      st = P.map(() => ({ pts: 0, srv: 0, srvWon: 0, first: 0, firstIn: 0, aces: 0, dfs: 0, win: 0, ue: 0, bpF: 0, bpS: 0, bpC: 0, bpW: 0, q: 0, qr: 0, fast: 0, long: 0 }));
    }
    const badge = i => P[i].human ? R.av(P[i].idx) : '<i class="av cpu">' + R.flag(P[i].flag) + "</i>";
    const first = n => esc(String(n).split(" ")[0]);

    /* ---------- walk-on and coin toss ---------- */
    function walkOn(){
      makePlayers();
      surf = pref.surf; fmt = pref.fmt; flat = false;
      if(want3d()) R.load3d().catch(() => {});
      const toss = Math.random() < 0.5 ? 0 : 1;
      el.innerHTML = '<div class="walk"><p class="lbl">' + esc(R.L(RA.SURF[surf].name)) + " · " + esc(R.L(FORMATS.find(f => f.id === fmt).n)) + "</p>" +
        '<div class="w-p w0">' + badge(0) + "<b>" + esc(P[0].name) + "</b>" + (P[0].human ? "" : "<em>" + esc(P[0].nick) + "</em>") + "</div>" +
        '<p class="w-vs">vs</p>' +
        '<div class="w-p w1">' + badge(1) + "<b>" + esc(P[1].name) + "</b>" + (P[1].human ? "" : "<em>“" + esc(P[1].nick) + "”</em><small>" + esc(R.L(RA.LEVELS[P[1].o.lvl])) + "</small>") + "</div>" +
        '<div class="w-toss"><span class="coin" id="coin"><i>' + first(P[0].name).charAt(0) + "</i><i>" + first(P[1].name).charAt(0) + '</i></span><p id="tossay">' + T("The coin toss…", "De toss…") + "</p></div>" +
        '<button class="go" id="play" hidden>' + T("Play", "Spelen") + "</button></div>";
      R.sfx.applause(0.7);
      const coin = el.querySelector("#coin");
      coin.style.setProperty("--end", toss ? "1980deg" : "1800deg");
      later(() => {
        coin.classList.add("flip");
        later(() => {
          el.querySelector("#tossay").innerHTML = "<b>" + esc(P[toss].name) + "</b>" + T(" wins the toss and serves first.", " wint de toss en slaat eerst op.");
          R.sfx.tick(); el.querySelector("#play").hidden = false;
        }, 1500);
      }, 500);
      el.querySelector("#play").onclick = () => start(toss);
    }

    /* ---------- the match screen ---------- */
    const $ = sel => el.querySelector(sel);
    function screen(three){
      const top = '<div class="g-top"><button class="back" id="stop">‹ Stop</button><b>' + esc(R.L(RA.SURF[surf].name)) + " · " + esc(R.L(FORMATS.find(f => f.id === fmt).n)) + "</b><span></span></div>" +
        '<div class="sbug" id="sbug"></div>', low = '<div class="m-status" id="mst"></div><div class="sheet" id="sheet" hidden></div><div class="m-ban" id="ban"></div>';
      el.innerHTML = three ? '<div class="m3d"><div class="c3d" id="court"><div class="m3d-wait" id="m3w">' + T("Setting up the court…", "De baan wordt klaargezet…") + "</div></div>" + top + low + "</div>" : top + '<div class="c-host" id="court"></div>' + low;
      /* Stop asks first (a match can't be resumed): a second tap within three seconds leaves.
         Bound here because the screen is built again when a match falls back to the flat court */
      const stopB = $("#stop");
      let sure = 0;
      stopB.onclick = () => {
        if(sure) return R.go("#play");
        stopB.textContent = T("Sure? Tap again", "Zeker? Tik nog eens"); stopB.classList.add("sure"); R.fx.buzz(10);
        sure = later(() => { sure = 0; stopB.textContent = "‹ Stop"; stopB.classList.remove("sure"); }, 3000);
      };
    }
    async function start(server){
      s = SC.create(fmt, server);
      R.paint(surf);
      court = null;
      if(want3d()){
        screen(true);
        try {
          const m = await R.load3d(); if(!alive) return;
          court = await m.mount($("#court"), { surf, players: P, onAsk: (q, g, secs) => {
            R.fb.note(q, g, secs * 1000); asked.push({ q, g });
            const S = st[0]; S.q++; if(g === 0){ S.qr++; if(!S.fast || secs < S.fast) S.fast = secs; }
          } });
          if(!alive){ if(court) court.stop(); return; }
          const w = $("#m3w"); if(w) w.remove();
        } catch(e){ court = null; }
      }
      if(!court){ flat = true; screen(false); court = R.court.mount($("#court"), { surf, players: P }); }
      drawScore();
      R.sfx.call("Quiet, please. " + P[server].name + " to serve. Play.");
      later(loop, 1400);
    }
    /* the phone took the graphics away and didn't give them back: same score, on the flat court */
    function toFlat(){
      court.stop(); flat = true; screen(false);
      court = R.court.mount($("#court"), { surf, players: P });
      drawScore();
    }
    function drawScore(ev){
      const lab = SC.labels(s), sets = s.sets;
      $("#sbug").innerHTML = [0, 1].map(i => '<div class="sb-row' + (s.done == null && s.server === i ? " srv" : "") + (s.done === i ? " won" : "") + '"><i class="sb-ball"></i>' + badge(i) + '<b class="sb-nm">' + esc(P[i].name) + "</b>" +
        sets.map(x => '<span class="sb-set' + (x.g[i] > x.g[1 - i] ? " w" : "") + '">' + (s.f.tbOnly ? x.tb[i] : x.g[i]) + (x.tb && !s.f.tbOnly ? "<sup>" + x.tb[i] + "</sup>" : "") + "</span>").join("") +
        (s.done == null && !s.f.tbOnly ? '<span class="sb-g">' + s.games[i] + "</span>" : "") +
        (s.done == null ? '<span class="sb-p' + (lab[i] === "AD" ? " ad" : "") + '">' + lab[i] + "</span>" : "") + "</div>").join("") +
        (s.tb && !s.f.tbOnly && s.done == null ? '<span class="sb-tb">Tiebreak</span>' : "");
      if(ev && ev.game != null) R.fx.bump($("#sbug .sb-row:nth-child(" + (ev.game + 1) + ") .sb-g"));
      else if(ev) R.fx.bump($("#sbug .sb-row:nth-child(" + (ev.w + 1) + ") .sb-p"));
    }
    function status(text, cls){ const m = $("#mst"); if(!m) return; m.className = "m-status " + (cls || ""); m.innerHTML = text; }
    function banner(big, small, cls, ms){
      const b = $("#ban"); if(!b) return;
      b.className = "m-ban"; void b.offsetWidth; b.className = "m-ban show " + (cls || "");
      b.innerHTML = "<b>" + big + "</b>" + (small ? "<span>" + small + "</span>" : "");
      later(() => { if(b.isConnected) b.className = "m-ban"; }, ms || 1500);
    }
    const STAKE = { break: ["Break point", "Breakpoint"], set: ["Set point", "Setpoint"], match: ["Match point", "Matchpoint"] };

    /* ---------- the questions ---------- */
    function pickTier(p){
      return new Promise(res => {
        const sh = $("#sheet"), S = RA.SURF[surf], ret = P[1 - p].human ? 0 : P[1 - p].o.ret;
        const pct = x => Math.round(x * 100) + "%";
        sh.hidden = false; sh.className = "sheet tiers-sheet";
        sh.innerHTML = (pref.mode === "friend" ? '<p class="pass">' + T("Phone to ", "Telefoon naar ") + "<b>" + esc(P[p].name) + "</b></p>" : "") +
          '<p class="lbl">' + esc(P[p].name) + T(", your service game. Pick your question:", ", jouw servicegame. Kies je vraag:") + '</p><div class="tiers">' +
          ["easy", "medium", "hard"].map(t => { const X = RA.SERVE[t]; return '<button class="tier t-' + t + (P[p].tier === t ? " last" : "") + '" data-t="' + t + '"><b>' + R.L(X.name) + "</b><small>" + R.L(X.say) + "</small>" +
            '<span class="tt"><em>' + T("Ace", "Ace") + " " + pct(X.ace * S.ace * (1 - RA.clamp(ret, -0.5, 0.6) * 0.5)) + "</em><em>" + T("DF risk", "DF-risico") + " " + pct(X.df) + "</em></span></button>"; }).join("") + "</div>" +
          '<p class="hint">' + T("Ace: chance when you answer right. DF risk: the double fault chance when you answer wrong.", "Ace: de kans als je goed antwoordt. DF-risico: de kans op een dubbele fout als je fout antwoordt.") + "</p>";
        sh.querySelectorAll(".tier").forEach(b => b.onclick = () => { P[p].tier = b.dataset.t; R.sfx.tick(); sh.hidden = true; res(); });
      });
    }
    let stake = null;
    function ask(p, kind, info){
      return new Promise(res => {
        const tier = kind === "serve" ? P[p].tier : "mix";
        const q = R.qs.pick("all", tier, 1)[0] || R.qs.pick("all", "mix", 1)[0];
        const time = QT[kind] - (stake ? 3 : 0);
        const sh = $("#sheet");
        const head = kind === "serve" ? T("Serve", "Opslag") + " · " + R.L(RA.SERVE[tier].name) : kind === "return" ? T("Return · be quick", "Return · snel") : info.attack ? T("Rally · finish it", "Rally · maak het af") : T("Rally · defend", "Rally · verdedig");
        sh.hidden = false; sh.className = "sheet k-" + kind + (stake ? " pressure" : "") + " p" + p;
        sh.innerHTML = '<div class="clock"><i id="qbar"></i></div>' +
          '<p class="lbl"><span class="who">' + badge(p) + esc(P[p].name) + "</span>" + head + (stake ? '<span class="pq">' + R.L(STAKE[stake.kind]) + "</span>" : "") + "</p>" +
          '<p class="q">' + esc(q.q) + '</p><div class="answers">' + q.opts.map((o, k) => '<button data-k="' + k + '"><i>' + "ABCD"[k] + "</i><span>" + esc(o) + "</span></button>").join("") + '</div><p class="verdict-h" id="vh"></p>';
        R.fx.stagger(sh.querySelector(".answers"), null, 0);
        const bar = sh.querySelector("#qbar"), t0 = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => { if(!bar.dataset.done){ bar.style.transition = "transform " + time + "s linear"; bar.style.transform = "scaleX(0)"; } }));
        let done = false;
        const tm = later(() => answer(-1), time * 1000);
        if(stake) R.sfx.heart();
        const answer = k => {
          if(done) return; done = true; clearTimeout(tm); timers.delete(tm);
          const now = getComputedStyle(bar).transform; bar.dataset.done = "1"; bar.style.transition = "none"; bar.style.transform = now;
          const secs = (performance.now() - t0) / 1000, pick = k >= 0 ? q.opts[k] : null, g = R.qs.grade(q, pick), fast = g === 0 && secs < RA.FAST;
          R.fb.note(q, g, secs * 1000); asked.push({ q, g });
          const S = st[p]; S.q++; if(g === 0){ S.qr++; if(!S.fast || secs < S.fast) S.fast = secs; }
          sh.querySelectorAll(".answers button").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.a) b.classList.add("right"); else if(j === k) b.classList.add("wrong", "g" + g); });
          $("#vh").innerHTML = "<b class=\"g" + g + "\">" + say(kind, g, fast, k < 0, info) + "</b>" + (g ? "<span>" + T("It was: ", "Het was: ") + esc(q.a) + "</span>" : "");
          if(g === 0){ R.sfx.good(); R.fx.buzz(10); } else { R.sfx.bad(); R.fx.buzz([30, 40, 30]); }
          later(() => { sh.hidden = true; res({ g, fast }); }, g === 0 ? 850 : 1700);
        };
        sh.querySelectorAll(".answers button").forEach(b => b.onclick = () => answer(+b.dataset.k));
      });
    }
    function say(kind, g, fast, late, info){
      if(late) return kind === "return" ? T("Too late: return error?", "Te laat: returnfout?") : kind === "serve" ? T("Too late: fault.", "Te laat: fout.") : T("Too late: into the net.", "Te laat: in het net.");
      if(kind === "serve") return [T("Right! A big first serve.", "Goed! Een harde eerste opslag."), T("Close: a soft first serve.", "Bijna: een zachte eerste opslag."), T("Off: fault. Safe second serve.", "Ernaast: fout. Veilige tweede opslag."), T("Wrong: fault… second serve.", "Fout: fout… tweede opslag.")][g];
      if(kind === "return") return [fast ? T("Fast and right: down the line!", "Snel en goed: langs de lijn!") : T("Right: a deep return.", "Goed: een diepe return."), T("Close: you block it back.", "Bijna: je blokt hem terug."), T("Off: a weak return.", "Ernaast: een zwakke return."), T("Wrong: return error?", "Fout: returnfout?")][g];
      return [info.attack ? T("Right: you go for it!", "Goed: je gaat ervoor!") : T("Right: you scramble it back!", "Goed: je haalt hem nog terug!"), T("Close: you keep it in.", "Bijna: je houdt hem in het veld."), T("Off: a short ball…", "Ernaast: een korte bal…"), T("Wrong: into the net.", "Fout: in het net.")][g];
    }

    /* ---------- the point loop ---------- */
    async function loop(){
      while(alive && s.done == null){
        const server = s.server, side = (s.pts[0] + s.pts[1]) % 2 === 0 ? "deuce" : "ad";
        stake = SC.stake(s);
        const bp = SC.breakPoint(s);
        court.ready(server, side);
        if(stake){
          status('<span class="pq">' + R.L(STAKE[stake.kind]) + "</span> " + esc(P[stake.p].name), "big");
          R.sfx.call(stake.kind === "match" ? "Match point." : stake.kind === "set" ? "Set point." : "Break point.");
          R.sfx.heart();
        } else status(esc(P[server].name) + T(" to serve", " slaat op") + (s.tb ? " · tiebreak" : ""));
        const tierKey = s.tb ? "tb" + s.sets.length : s.sets.length + ":" + (s.games[0] + s.games[1]);
        if(!court.point && P[server].human && P[server].tierKey !== tierKey){ await pickTier(server); P[server].tierKey = tierKey; }
        await wait(stake ? 700 : 350);
        if(!alive) return;
        let res;
        if(court.point){
          /* in a tiebreak the Live Balls start at 5, not just on the last point */
          const live = !!stake || (s.tb && Math.max(s.pts[0], s.pts[1]) >= 5) || R.m3d.hooks.allLive, lab = SC.labels(s);
          status("");
          res = await court.point({ server, side, live, score: (s.tb ? "" : s.games[0] + "–" + s.games[1] + " · ") + lab.filter(Boolean).join("–") });
          if(!alive || !res) return;
          if(res.lost){ toFlat(); continue; }
        } else {
          res = await RA.playPoint({ surf, server, stake: stake && stake.kind, players: P }, ask, Math.random);
          if(!alive) return;
          status(stake ? '<span class="pq">' + R.L(STAKE[stake.kind]) + "</span>" : "");
          await court.play(Object.assign({}, res, { side, slow: !!(stake && stake.kind === "match") }));
          if(!alive) return;
        }
        tally(res, bp);
        const ev = SC.point(s, res.w);
        P[res.w].run++; P[1 - res.w].run = 0;
        drawScore(ev);
        await react(res, ev);
      }
    }
    function tally(r, bp){
      const sv = r.server, rt = 1 - sv;
      st[r.w].pts++; st[sv].srv++; if(r.w === sv) st[sv].srvWon++;
      st[sv].first++; if(r.first) st[sv].firstIn++;
      if(r.end === "ace") st[sv].aces++;
      if(r.end === "df") st[sv].dfs++;
      if(r.end === "winner" || r.end === "retW") st[r.w].win++;
      if(r.end === "ue" || r.end === "retE") st[r.by].ue++;
      if(bp){ st[sv].bpF++; st[rt].bpC++; if(r.w === sv) st[sv].bpS++; else st[rt].bpW++; }
      st[0].long = st[1].long = Math.max(st[0].long, r.shots || 0);
    }
    const WHAT = { ace: ["Ace", "Ace"], df: ["Double fault", "Dubbele fout"], winner: ["Winner", "Winner"], retW: ["Return winner", "Returnwinner"], retE: ["Return error", "Returnfout"], ue: ["Unforced error", "Onnodige fout"], forced: ["Forced error", "Afgedwongen fout"], unret: ["Service winner", "Servicewinner"] };
    async function react(r, ev){
      const name = i => P[i].name, c = SC.call(s, ev, name);
      const human = P[r.w].human, mine = pref.mode === "friend" || r.w === 0;
      const how = R.L(WHAT[r.end] || ["", ""]) + (r.shots > 4 ? " · " + r.shots + T(" shots", " slagen") : "");
      status("<b>" + esc(R.store.lang === "nl" ? c.nl : c.en) + "</b><small>" + esc(how) + "</small>", ev.game != null ? "game" : "");
      const big = r.end === "ace" || r.end === "winner" || r.end === "retW";
      if(mine && big){ R.sfx.applause(r.shots > 8 ? 1.3 : 0.9); court.cheer(r.shots > 8 ? 2 : 1); }
      else if(!mine && (r.end === "ue" || r.end === "df" || r.end === "retE")) R.sfx.aww();
      else if(r.shots > 8) R.sfx.applause(1.1);
      else R.sfx.applause(0.45);
      if(ev.match != null) return end(ev.match);
      if(ev.game != null){
        later(() => R.sfx.call(c.en), 300);
        if(ev.set != null) banner(T("Set", "Set"), esc(name(ev.set)), "set", 1800);
        else if(ev.brk){ banner("Break!", esc(name(ev.game)), human || pref.mode === "friend" ? "good" : "bad", 1500); court.cheer(2); }
        else banner("Game", esc(name(ev.game)), "", 1100);
        if(ev.tbStart) later(() => banner("Tiebreak", T("First to 7", "Eerste tot 7"), "set", 1500), 1300);
        await wait(ev.tbStart ? 2900 : 1700);
      } else {
        later(() => R.sfx.call(c.say || c.en), 250);
        await wait(1100);
      }
    }

    /* ---------- the end ---------- */
    function end(w){
      const line = SC.line(s, w), won = w === 0;
      /* one log entry per match; a friend is side b of it */
      R.store.addMatch({ a: P[0].idx, b: P[1].human ? P[1].idx : "cpu:" + P[1].o.id, w, line, surf, fmt, aces: st[0].aces, qr: st[0].qr, q: st[0].q });
      $("#sheet").hidden = true;
      banner(T("Game, set and match", "Game, set en match"), esc(P[w].name), "set", 2600);
      R.sfx.applause(1.4); court.cheer(2);
      later(() => R.sfx.call("Game, set and match, " + P[w].name + ". " + line.replace(/–/g, " ").replace(/\(|\)/g, "")), 400);
      if(won || pref.mode === "friend") later(() => R.fx.party(), 600);
      later(() => {
        const three = !!court.point, fps = three ? court.fps() : null;
        court.stop();
        const row = (lbl, a, b, hi) => '<tr><td' + (hi === 0 ? ' class="hi"' : "") + ">" + a + "</td><th>" + lbl + "</th><td" + (hi === 1 ? ' class="hi"' : "") + ">" + b + "</td></tr>";
        const cmp = (a, b, more) => a === b ? -1 : (more ? a > b : a < b) ? 0 : 1;
        const pc = (a, b) => b ? Math.round(a / b * 100) + "%" : "–";
        const fs = x => x ? x.toFixed(1) + " s" : "–";
        const S0 = st[0], S1 = st[1];
        el.innerHTML = '<div class="g-top"><a class="back" href="#play">‹ Menu</a><b>' + T("Match report", "Wedstrijdverslag") + "</b><span></span></div>" +
          '<div class="g-body end m-end"><p class="lbl">' + esc(R.L(RA.SURF[surf].name)) + " · " + esc(R.L(FORMATS.find(f => f.id === fmt).n)) + "</p>" +
          '<div class="m-win">' + badge(w) + "<b>" + esc(P[w].name) + "</b><span>" + T("wins", "wint") + "</span></div>" +
          '<p class="m-line">' + esc(line) + "</p>" +
          '<p class="verdict">' + (pref.mode === "friend" ? T("What a match.", "Wat een partij.") : won ? (P[1].o.lvl >= 3 ? T("You beat a giant.", "Je versloeg een reus.") : T("Match won.", "Partij gewonnen.")) : T("So close. Rematch?", "Zo dichtbij. Revanche?")) + "</p>" +
          '<table class="mst"><thead><tr><th>' + badge(0) + esc(first(P[0].name)) + "</th><th></th><th>" + esc(first(P[1].name)) + badge(1) + "</th></tr></thead><tbody>" +
          row(T("Points won", "Punten gewonnen"), S0.pts, S1.pts, cmp(S0.pts, S1.pts, true)) +
          row(T("Aces", "Aces"), S0.aces, S1.aces, cmp(S0.aces, S1.aces, true)) +
          row(T("Double faults", "Dubbele fouten"), S0.dfs, S1.dfs, cmp(S0.dfs, S1.dfs, false)) +
          row(T("Winners", "Winners"), S0.win, S1.win, cmp(S0.win, S1.win, true)) +
          row(T("Unforced errors", "Onnodige fouten"), S0.ue, S1.ue, cmp(S0.ue, S1.ue, false)) +
          (three ? "" : row(T("1st serve in", "1e opslag in"), pc(S0.firstIn, S0.first), pc(S1.firstIn, S1.first), -1)) +
          row(T("Won on serve", "Gewonnen op opslag"), pc(S0.srvWon, S0.srv), pc(S1.srvWon, S1.srv), -1) +
          (fmt === "tb" ? "" : row(T("Break points saved", "Breakpoints weggewerkt"), S0.bpS + "/" + S0.bpF, S1.bpS + "/" + S1.bpF, -1) +
          row(T("Break points won", "Breakpoints benut"), S0.bpW + "/" + S0.bpC, S1.bpW + "/" + S1.bpC, -1)) +
          (P[1].human ? row(T("Questions right", "Vragen goed"), S0.qr + "/" + S0.q, S1.qr + "/" + S1.q, -1) + row(T("Fastest answer", "Snelste antwoord"), fs(S0.fast), fs(S1.fast), -1)
            : row(T("Questions right", "Vragen goed"), S0.qr + "/" + S0.q, "", -1) + row(T("Fastest answer", "Snelste antwoord"), fs(S0.fast), "", -1)) +
          "</tbody></table>" +
          '<p class="note">' + T("Longest rally: ", "Langste rally: ") + S0.long + T(" shots.", " slagen.") + (fps && R.FEEDBACK ? " " + T("The court ran at ", "De baan draaide op ") + fps + " fps." : "") + "</p>" +
          '<details class="m-qs"><summary>' + T("Questions in this match", "Vragen in deze partij") + " (" + asked.length + ')</summary><div class="review">' +
            asked.map(x => '<div class="' + (x.g ? "no" : "ok") + '"><span>' + esc(x.q.q) + "</span><b>" + esc(x.q.a) + "</b>" + R.fb.flag(x.q) + "</div>").join("") + "</div></details>" +
          '<div class="row"><button class="go" id="again">' + T("Rematch", "Revanche") + '</button><a class="go ghost" href="#play">Menu</a></div></div>';
        el.querySelector("#again").onclick = () => walkOn();
        R.fx.stagger(el.querySelector(".g-body"), ".m-win, .m-line, .verdict, .mst tr, .note, .m-qs, .row", 0);
      }, 3200);
    }

    setup();
    return () => { alive = false; timers.forEach(clearTimeout); timers.clear(); if(court) court.stop(); if(R.m3d) R.m3d.release(); R.sfx.hush(); };
  };
})(window.RACKET);
