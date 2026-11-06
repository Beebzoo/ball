/* DART shell: the router, the three tabs (Play, Scores, Me), the rooms and shared helpers. Snooker and the poule are parked (D.SNOOKER, D.POULE, store.js).
   First open: one screen that asks your name (hello), then Play.
   Rooms: the oche (darts) and the table (snooker). At first open each player picks a sport
   (darts, snooker or both, D.store.sport); Play opens in that player's room, the other room
   is one tap away (#spelen-oche, #spelen-tafel).
   Routes: #spelen  #quiz  #checkout  #match  #daily  (darts)  #squiz  #frame  (snooker)  #poule
           #stand  #ik  #stats(-player index(-sport))
   Every text goes through T(english, dutch); the language is set on Me (default English). */
(function(D){
  const app = document.getElementById("app"), tabs = document.getElementById("tabs");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  D.esc = esc;
  const T = D.T, fx = D.fx;
  /* a whole address, not a bare #: a bare one is read against whichever page is running the script */
  const stay = h => location.replace(location.href.split("#")[0] + h);
  D.go = h => { if(location.hash === h) route(); else if(D.EMBED) stay(h); else location.hash = h; };
  /* In BALL's frame the hash adds no history: the phone's back belongs to BALL and goes straight back to it. */
  if(D.EMBED) document.addEventListener("click", e => {
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if(a){ e.preventDefault(); stay(a.getAttribute("href")); }
  }, true);
  /* out of sight it stays loaded, so a leg isn't lost, and it stays quiet */
  window.addEventListener("message", e => {
    if(e.origin !== location.origin || !e.data || !e.data.ball) return;
    D.hidden = e.data.ball === "hide";
    if(D.hidden) D.caller.stop();
    D.sfx.sight();
  });
  const toBall = e => { if(D.EMBED){ e.preventDefault(); parent.postMessage({ to: "ball" }, location.origin); } };

  /* a player's round badge: the first letter in their colour */
  D.av = i => '<i class="av p' + (i % 3) + '">' + esc((D.store.players[i] || "?").trim().charAt(0).toUpperCase() || "?") + "</i>";

  /* the wordmark and the way back to BALL */
  const brand = () => '<a class="mark" href="#spelen"><b>DART</b><i></i></a><a class="toball" href="https://ballquiz.app/" aria-label="' + T("Switch to BALL", "Naar BALL") + '">' + ICON.ball + "<span>BALL</span></a>";
  /* the top bar of a tab: wordmark and who is playing */
  D.top = () => '<header class="top">' + brand() +
    '<a class="who" href="#ik"><span><small>' + (D.store.room === "tafel" ? T("At the table", "Aan tafel") : T("At the oche", "Aan de oche")) + "</small><b>" + esc(D.store.name) + "</b></span>" + D.av(D.store.me) + "</a></header>";

  const seed = () => { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); };
  /* "Break of the day": a clearance, the same for everyone today: a few reds left, the colours
     on their spots. Returns { balls (positions), order (ids to pot), total } */
  function breakOfDay(){
    const P = D.phys, rnd = D.cue.rng(seed() * 7 + 3), reds = 1 + Math.floor(rnd() * 4);
    const w = P.rack(0), balls = w.balls.filter(b => b.id !== "cue");
    for(let k = 0; k < reds; k++){
      for(let tries = 0; tries < 200; tries++){
        const x = 120 + rnd() * (P.W - 240), y = 200 + rnd() * (P.BAULK - 400);
        if(balls.every(b => Math.hypot(b.x - x, b.y - y) > 4 * P.R)){ balls.push({ id: "r" + k, x, y, on: true }); break; }
      }
    }
    const cue = { id: "cue", x: P.CX - 60 + rnd() * 120, y: P.BAULK + 120, on: true };
    const order = []; for(let k = 0; k < reds; k++) order.push("r" + k, "black");
    order.push(...P.COLOURS);
    return { balls: [cue].concat(balls), order, total: reds * 8 + 27, reds };
  }
  function greet(){
    const h = new Date().getHours();
    return h < 6 ? T("Still up", "Nog wakker") : h < 12 ? T("Good morning", "Goedemorgen") : h < 18 ? T("Good afternoon", "Goedemiddag") : T("Good evening", "Goedenavond");
  }

  const ICON = {
    quiz: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7.5A3.5 3.5 0 0 1 9.5 4h13A3.5 3.5 0 0 1 26 7.5v10a3.5 3.5 0 0 1-3.5 3.5H15l-6 5v-5h0.5A3.5 3.5 0 0 1 6 17.5z"/><path d="M13.2 10.2a3 3 0 1 1 4.1 2.8c-.8.4-1.3 1-1.3 1.8v.4"/><circle cx="16" cy="18" r=".6" fill="currentColor"/></svg>',
    match: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="19" r="9"/><circle cx="13" cy="19" r="4.5"/><circle cx="13" cy="19" r=".8" fill="currentColor"/><path d="M13 19 26 6"/><path d="M22 5.5 26 6l.5 4"/><path d="M23.5 4 28 3.5 27.5 8"/></svg>',
    co: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="22" height="24" rx="4"/><path d="M10 10h12"/><circle cx="11" cy="16" r=".9" fill="currentColor"/><circle cx="16" cy="16" r=".9" fill="currentColor"/><circle cx="21" cy="16" r=".9" fill="currentColor"/><circle cx="11" cy="21" r=".9" fill="currentColor"/><circle cx="16" cy="21" r=".9" fill="currentColor"/><path d="M19.5 21h3"/></svg>',
    frame: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="7"/><circle cx="17.6" cy="17.6" r="1.6" fill="currentColor" stroke="none"/><path d="M3 5l10.5 10.5"/><path d="M12 14l2 2"/></svg>',
    squiz: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7.5A3.5 3.5 0 0 1 9.5 4h13A3.5 3.5 0 0 1 26 7.5v10a3.5 3.5 0 0 1-3.5 3.5H15l-6 5v-5h0.5A3.5 3.5 0 0 1 6 17.5z"/><circle cx="16" cy="12.5" r="4.2"/><circle cx="14.8" cy="11.3" r="1" fill="currentColor" stroke="none"/></svg>',
    poule: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h6v6H4M4 20h6v6H4M10 9h4v14h-4M14 16h5"/><path d="M19 11h9v10h-9z"/><path d="M23.5 14v4"/></svg>',
    quick: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3 7 18h8l-2 11 12-16h-9z"/></svg>',
    dart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="14" r="7"/><circle cx="10" cy="14" r="3"/><path d="M10 14 21 3M18 2.5 21 3l.5 3"/></svg>',
    ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="9.5" r="1.8" fill="currentColor" stroke="none"/></svg>',
    both: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="12" r="5.5"/><circle cx="8" cy="12" r="2"/><circle cx="17.5" cy="12" r="4.5"/><circle cx="16" cy="10.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
    play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg>'
  };
  /* the best score on a mode card */
  function best(key, unit){
    const r = D.store.rec(D.store.me, key);
    return r && r.plays ? '<small class="mr">' + T("Best ", "Record ") + r.best + (unit || "") + "</small>" : '<small class="mr new">' + T("Not played yet", "Nog niet gespeeld") + "</small>";
  }
  const mode = (cls, href, icon, name, txt, rec) => '<a class="mode ' + cls + '" href="' + href + '"><span class="mi">' + icon + "</span><b>" + name + '</b><span class="md">' + txt + "</span>" + rec + "<i>" + ICON.play + "</i></a>";

  /* ---------- first open: your name, asked once (BALL's is filled in when DART runs in its frame) ---------- */
  function hello(el){
    const ph = T("Your name", "Je naam");
    el.innerHTML = '<header class="top">' + brand() + '</header><section class="welcome"><h1>' + T("What’s your name?", "Hoe heet je?") + '</h1><p class="tag">' + T("The caller says it when you’re up. It stays on this phone, and you can change it on Me.", "De caller noemt je naam als je aan de beurt bent. Hij blijft op deze telefoon, en je past hem aan op Ik.") + "</p></section>" +
      '<form class="hello"><input id="nm" maxlength="14" value="' + esc(D.store.ballName) + '" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off" autocapitalize="words"><button class="go">Game on</button></form>';
    fx.stagger(el, ".welcome, .hello", 0);
    /* left empty it stays "Player": asked once, never again */
    el.querySelector(".hello").onsubmit = e => {
      e.preventDefault();
      D.store.rename(0, el.querySelector("#nm").value.trim() || T("Player", "Speler"));
      D.sfx.good(); fx.buzz(10); route();
    };
  }
  /* add a friend on this phone: a name field and a button (Me, and the setup of a match). done(index) once they're in */
  D.addForm = (box, ph, done) => {
    box.innerHTML = '<form class="addp"><input maxlength="14" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" autocomplete="off" autocapitalize="words"><button>' + T("Add", "Toevoegen") + "</button></form>";
    const inp = box.querySelector("input");
    box.querySelector("form").onsubmit = e => {
      e.preventDefault();
      const i = D.store.addPlayer(inp.value);
      if(i < 0) return inp.focus();
      D.sfx.good(); fx.buzz(10); done(i);
    };
  };

  /* ---------- Play: pick your sport (first open), then the room ---------- */
  function pickSport(el){
    el.innerHTML = D.top() + '<section class="welcome"><p class="hi">' + greet() + ", " + esc(D.store.name) + '</p><h1>' + T("Welcome to the bar.", "Welkom in de kroeg.") + '</h1><p class="tag">' + T("Two rooms: the oche for darts, the table for snooker. Which one is yours?", "Twee zalen: de oche voor darts, de tafel voor snooker. Welke is van jou?") + "</p></section>" +
      '<div class="sports">' +
        [["darts", ICON.dart, T("Darts", "Darts"), T("The oche: the 501 Match, checkouts and the darts quiz", "De oche: de 501 Match, uitgooien en de dartsquiz")],
         ["snooker", ICON.ball, T("Snooker", "Snooker"), T("The table: Frame and the snooker quiz", "De tafel: Frame en de snookerquiz")],
         ["both", ICON.both, T("Both", "Allebei"), T("Both rooms. You can walk across any time", "Allebei de zalen. Je loopt altijd even over")]]
          .map(([v, ic, n, d]) => '<button class="sport s-' + v + '" data-v="' + v + '"><i>' + ic + "</i><b>" + n + "</b><span>" + d + "</span></button>").join("") +
      '</div><p class="note">' + T("Remembered for ", "Onthouden voor ") + esc(D.store.name) + T(". Change it any time on Me.", ". Altijd aan te passen op Ik.") + "</p>";
    fx.stagger(el, ".welcome, .sports > button, .note", 0);
    el.querySelectorAll(".sports button").forEach(b => b.onclick = () => {
      D.store.setSport(b.dataset.v); D.sfx.good(); fx.buzz(10);
      D.go("#spelen-" + D.store.room);
    });
  }
  function spelen(el){
    if(!D.store.sport) return pickSport(el);
    const want = location.hash.split("-")[1];
    if(want === "oche" || want === "tafel") D.store.setRoom(want);
    const room = D.store.room;
    document.body.classList.toggle("room-tafel", room === "tafel");
    const doors = !D.SNOOKER ? "" : '<div class="rooms" role="tablist" aria-label="' + T("Rooms", "Zalen") + '">' +
      '<a href="#spelen-oche" class="room r-oche' + (room === "oche" ? " on" : "") + '" role="tab" aria-selected="' + (room === "oche") + '"><i>' + ICON.dart + "</i><span><b>" + T("The oche", "De oche") + "</b><small>Darts</small></span></a>" +
      '<a href="#spelen-tafel" class="room r-tafel' + (room === "tafel" ? " on" : "") + '" role="tab" aria-selected="' + (room === "tafel") + '"><i>' + ICON.ball + "</i><span><b>" + T("The table", "De tafel") + "</b><small>Snooker</small></span></a></div>";
    const poule = !D.POULE ? "" : '<a class="poule-card" href="#poule"><span class="mi">' + ICON.poule + "</span><b>" + T("World Championship predictor", "WK-poule") + "</b><span>" + T("Pick the winners, round by round", "Voorspel de winnaars, ronde na ronde") + "</span><i>›</i></a>";
    return room === "tafel" ? tafel(el, doors, poule) : oche(el, doors, poule);
  }
  function oche(el, doors, poule){
    const q = D.match.quick();
    el.innerHTML = D.top() + doors +
      D.daily.card() +
      '<section class="hero"><div class="hero-board">' + D.board.svg({ cls: "spin" }) + '</div>' +
      '<p class="hi">' + greet() + ", " + esc(D.store.name) + '</p><h1>Game on.</h1><p class="tag">' + T("The oche. Pick a game.", "De oche. Kies een spel.") + "</p></section>" +
      '<div class="modes">' +
        mode("m-quick", "#match-quick", ICON.quick, T("Quick match", "Snelle match"), q.text, '<small class="mr">' + (q.first ? T("Start here", "Begin hier") : T("Your last settings", "Je laatste keuze")) + "</small>") +
        mode("m-quiz", "#quiz", ICON.quiz, "Quiz", T("Ten questions, the faster you answer the more you score. Can you hit 180?", "Tien vragen, snel antwoorden is meer punten. Haal je de 180?"), best("quiz")) +
        mode("m-match", "#match", ICON.match, "501 Match", T("A real leg. A right answer gives a steady hand, a wrong one pulls into the 1.", "Een echte leg. Goed antwoord is een vaste hand, fout trekt naar de 1."), best("m501", T(" avg", " gem."))) +
        mode("m-co", "#checkout", ICON.co, "Checkout", T("Check out the score on a double. Ten in a row or against the clock.", "Gooi de score uit, op een dubbel. Tien stuks of tegen de klok."), best("co10")) +
      "</div>" +
      poule;
    fx.stagger(el.querySelector(".modes"), null, 3);
    fx.stagger(el, ".rooms, .cod, .poule-card", 1);
    const timers = [];
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    /* the hero board settles, then one dart goes into the treble 20 */
    const hb = el.querySelector(".hero-board .board");
    later(() => D.board.mark(hb, { m: 3, n: 20 }, 1), fx.calm() ? 0 : 1250);
    return () => timers.forEach(clearTimeout);
  }
  function tafel(el, doors, poule){
    const bd = breakOfDay(), TB = D.table, P = D.phys;
    const hb = Math.max((D.store.rec(D.store.me, "frame6hb") || {}).best || 0, (D.store.rec(D.store.me, "frame15hb") || {}).best || 0);
    el.innerHTML = D.top() + doors +
      '<section class="hero hero-t"><div class="lampshade" aria-hidden="true"><i></i></div><div class="hero-table">' + TB.svg({ cls: "spin-t", balls: P.rack(15).balls, mini: true }) + "</div>" +
      '<p class="hi">' + greet() + ", " + esc(D.store.name) + '</p><h1>' + T("Frame on.", "Frame on.") + '</h1><p class="tag">' + T("The table. Chalk your cue.", "De tafel. Krijt je keu.") + "</p></section>" +
      '<div class="modes">' +
        mode("m-frame", "#frame", ICON.frame, "Frame", T("A frame of snooker. Every shot starts with a question: right is a steady cue, wrong a miscue risk.", "Een frame snooker. Elke stoot begint met een vraag: goed is een vaste keu, fout kans op een miscue."),
          hb ? '<small class="mr">' + T("High break ", "Hoogste break ") + hb + "</small>" : '<small class="mr new">' + T("Not played yet", "Nog niet gespeeld") + "</small>") +
        mode("m-squiz", "#squiz", ICON.squiz, T("Snooker quiz", "Snookerquiz"), T("Ten questions. Every right answer pots a red and a colour: quick is the black.", "Tien vragen. Elk goed antwoord pot een rode en een kleur: snel is de zwarte."), best("squiz")) +
      "</div>" +
      '<button class="cod bod" id="bod"><span class="bod-table">' + TB.svg({ cls: "bod-svg", balls: bd.balls, mini: true, lamp: false }) + '</span><span class="cod-txt"><span class="lbl">' + T("Break of the day", "Break van de dag") + "</span>" +
        '<span class="cod-r bod-r" hidden>' + bd.order.map((id, i) => '<em style="--i:' + i + '">' + TB.chip(id) + "</em>").join("") + '</span><span class="cod-t">' + T(bd.reds + (bd.reds === 1 ? " red" : " reds") + " left. Tap to clear the table", bd.reds + (bd.reds === 1 ? " rode" : " rode") + " over. Tik om de tafel leeg te spelen") + '</span></span><b class="chalk">' + bd.total + "</b></button>" +
      poule;
    fx.stagger(el.querySelector(".modes"), null, 3);
    fx.stagger(el, ".rooms, .bod, .poule-card", 1);
    const timers = [];
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    /* tap: the balls go down one by one, the break counts up to the clearance */
    el.querySelector("#bod").onclick = e => {
      const b = e.currentTarget; if(b.classList.contains("open")) return;
      b.classList.add("open"); b.querySelector(".bod-r").hidden = false; b.querySelector(".cod-t").hidden = true;
      const sv = b.querySelector(".bod-svg"), num = b.querySelector(".chalk");
      let brk = 0; num.textContent = 0;
      bd.order.forEach((id, i) => later(() => {
        const g = sv.querySelector('.bl[data-id="' + id + '"]');
        if(id === "black" && i < bd.order.length - 1){ if(g){ g.classList.remove("down"); void g.getBoundingClientRect(); g.classList.add("down"); } }
        else if(g) g.classList.add("down", "gone");
        D.sfx.pot(); fx.buzz(6);
        const from = brk; brk += D.rules.value(id);
        fx.count(num, brk, { from, dur: 240 }); fx.bump(num);
        if(i === bd.order.length - 1) later(() => {
          num.classList.add("out"); fx.bump(num); fx.sparks(num, ["#fff3c4", "#f2f2f2", "#ffc94a"]); D.sfx.clap(0.8);
          b.querySelector(".cod-txt").insertAdjacentHTML("beforeend", '<span class="cod-gs">' + T("Clearance!", "Tafel leeg!") + "</span>");
        }, 520);
      }, fx.calm() ? 0 : i * 300 + 120));
    };
    return () => timers.forEach(clearTimeout);
  }

  /* head-to-head cards between the friends on this phone (from the match log) */
  function rivals(sport){
    const P = D.store.players, out = [];
    for(let a = 0; a < P.length; a++) for(let b = a + 1; b < P.length; b++){
      let list, wins, foot;
      if(sport === "snooker"){
        list = D.progress.snooker(a).log.filter(e => e.o === "p" + b);
      } else list = D.progress.h2h(a, b).list;
      wins = list.filter(e => e.w).length;
      const n = list.length, last = list[n - 1], score = e => sport === "snooker" ? e.f : e.l;
      const side = (i, w, lead) => '<span class="pg-rv-p' + (lead ? " lead" : "") + '">' + D.av(i) + "<b>" + esc(P[i]) + '</b><small>' + T("LV ", "LV ") + D.progress.info(i).lv + '</small><em data-count="' + w + '">' + w + "</em></span>";
      if(!n) foot = sport === "snooker" ? T("No frame yet. Pick “A friend” in Frame.", "Nog geen frame. Kies “Een vriend” in Frame.") : T("No match yet. Pick “A friend” in the 501 Match.", "Nog geen match. Kies “Een vriend” in de 501 Match.");
      else {
        const lw = last.w ? a : b, sc = score(last);
        let k = 0; for(let j = n - 1; j >= 0 && !!list[j].w === !!last.w; j--) k++;
        foot = esc(P[lw]) + T(" won the last one ", " won de laatste met ") + (last.w ? sc[0] + "–" + sc[1] : sc[1] + "–" + sc[0]) + " · " + D.progress.ago(last.t) +
          (k >= 2 ? "<br><b>" + esc(P[lw]) + T(" has won " + k + " in a row", " won er " + k + " op rij") + "</b>" : "");
      }
      const form = list.slice(-5).map(e => '<i class="p' + ((e.w ? a : b) % 3) + '" title="' + esc(P[e.w ? a : b]) + '"></i>').join("");
      out.push('<a class="pg-riv" href="#stats-' + a + "-" + sport + '"><div class="pg-rv-top">' + side(a, wins, wins > n - wins) + '<span class="pg-rv-vs">v</span>' + side(b, n - wins, n - wins > wins) + "</div>" +
        (form ? '<div class="pg-form"><span>' + T("Form", "Vorm") + "</span>" + form + "</div>" : "") + '<p class="pg-rv-f">' + foot + "</p></a>");
    }
    return out.join("");
  }

  /* Scores: one chalkboard per room, the room you're in first */
  function stand(el){
    const P = D.store.players, me = D.store.me, room = D.store.room, many = P.length > 1;
    const board = (title, cols, note) => {
      const top = k => Math.max(0, ...P.map((p, i) => val(i, k)));
      const rows = P.map((p, i) => {
        const lv = D.progress.info(i);
        return '<tr' + (i === me ? ' class="me"' : "") + '><th><a class="pl" href="#stats-' + i + '">' + D.av(i) + "<span>" + esc(p) + '<small class="pg-lvs"><em>' + T("LV ", "LV ") + lv.lv + "</em>" + esc(lv.title) + "</small></span></a></th>" +
          cols.map(([k]) => { const v = val(i, k); return '<td' + (v && v === top(k) ? ' class="top1"' : "") + ">" + (v ? '<span data-count="' + v + '"' + (v % 1 ? ' data-dec="1"' : "") + ">" + v + "</span>" : "–") + "</td>"; }).join("") + "</tr>";
      }).join("");
      return '<h2 class="sub-h">' + title + '</h2><div class="chalkboard"><table class="st"><thead><tr><th></th>' + cols.map(c => "<th>" + c[1] + "</th>").join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div><p class=\"note\">" + note + "</p>";
    };
    const val = (i, k) => k === "fhb" ? Math.max((D.store.rec(i, "frame6hb") || {}).best || 0, (D.store.rec(i, "frame15hb") || {}).best || 0) : ((D.store.rec(i, k) || {}).best || 0);
    const darts = board(T("The oche · darts", "De oche · darts"), [["m501", T("501 avg", "501 gem.")], ["quiz", "Quiz"], ["co10", "Checkout"], ["coklok", T("Clock", "Klok")]],
      T("501 avg: your best three-dart average in a match (at least nine darts). Quiz: max 1800 (ten times 180). Checkout: ten scores, max 30. Clock: as many points as you get in 60 seconds.",
        "501 gem.: je beste driepijlsgemiddelde in een match (minstens negen pijlen). Quiz: max 1800 (tien keer 180). Checkout: tien stuks, max 30. Klok: zoveel punten als je haalt in 60 seconden."));
    const snooker = board(T("The table · snooker", "De tafel · snooker"), [["fhb", T("High break", "Hoogste break")], ["squiz", "Quiz"], ["squizbrk", T("Quiz break", "Quizbreak")]],
      T("High break: your best break in Frame. Quiz: max 80 (ten reds and blacks). Quiz break: the most points in a row.", "Hoogste break: je beste break in Frame. Quiz: max 80 (tien keer rood-zwart). Quizbreak: de meeste punten op rij."));
    const sport = room === "tafel" ? "snooker" : "darts";
    const decks = D.qs.decks(sport);
    const mine = decks.map(d => { const r = D.store.rec(me, (sport === "snooker" ? "squiz:" : "quiz:") + d); return '<div><span>' + D.qs.name(d) + "</span><b" + (r ? ' data-count="' + r.best + '">' + r.best : ">–") + '</b><i style="--p:' + (r ? Math.min(1, r.best / (sport === "snooker" ? 80 : 1800)).toFixed(3) : 0) + '"></i></div>'; }).join("");
    el.innerHTML = D.top() + '<h1 class="pt">' + T("Scores", "Stand") + '</h1>' +
      '<p class="lead">' + (many ? T('Best scores on this phone. Pick who is playing on <a href="#ik">Me</a>.', 'Beste scores op deze telefoon. Kies op <a href="#ik">Ik</a> wie er speelt.') : T("Your best scores on this phone.", "Je beste scores op deze telefoon.")) + '</p>' +
      (!D.SNOOKER ? darts : sport === "snooker" ? snooker + darts : darts + snooker) +
      (many ? '<h2 class="sub-h">' + T("Rivals", "Rivalen") + (sport === "snooker" ? " · snooker" : " · darts") + '</h2><div class="pg-rivals">' + rivals(sport) + "</div>" : "") +
      '<a class="pg-statlink" href="#stats-' + me + "-" + sport + '"><span>' + T("Stats, trophies and more", "Statistieken, bekers en meer") + "</span><i>›</i></a>" +
      (decks.length ? '<h2 class="sub-h">' + esc(D.store.name) + T(", quiz by topic", ", quiz per onderwerp") + '</h2><div class="decks-best">' + mine + "</div>" : "");
    fx.stagger(el, ".chalkboard, .note, .sub-h, .pg-riv, .pg-statlink", 1);
    el.querySelectorAll(".st tbody").forEach(tb => fx.stagger(tb, null, 2));
    fx.stagger(el.querySelector(".decks-best"), null, 6);
    fx.counts(el, { delay: 250 });
    if(!decks.length) D.qs.load().then(() => { if(location.hash.slice(1).split("-")[0] === "stand") stand(el); }).catch(() => {});
  }

  function ik(el){
    const P = D.store.players, lang = D.store.lang, sp = D.store.sport, many = P.length > 1;
    const lv = D.progress.info(D.store.me);
    el.innerHTML = D.top() + '<h1 class="pt">' + T("Me", "Ik") + '</h1>' +
      '<a class="pg-mecard" href="#stats-' + D.store.me + '"><span class="pg-lv"><small>LV</small><b>' + lv.lv + '</b></span><span class="pg-who"><b>' + esc(lv.title) + '</b><span class="pg-bar"><i style="width:' + (lv.frac * 100).toFixed(1) + '%"></i></span><small>' + lv.xp + " XP · " + T("stats and trophies", "statistieken en bekers") + '</small></span><i class="pg-go">›</i></a>' +
      (!many ? "" : '<h2 class="sub-h">' + T("Who’s playing?", "Wie speelt er?") + '</h2><div class="players">' +
      P.map((p, i) => '<button data-i="' + i + '"' + (i === D.store.me ? ' class="on"' : "") + ">" + D.av(i) + "<b>" + esc(p) + "</b><span>" + (i === D.store.me ? T("playing", "speelt") : T("pick", "kies")) + "</span></button>").join("") +
      "</div>") + (!D.SNOOKER ? "" : '<h2 class="sub-h">' + T("Your game", "Jouw spel") + '</h2><div class="chips sp3" id="sport">' +
        [["darts", "Darts"], ["snooker", "Snooker"], ["both", T("Both", "Allebei")]].map(([v, n]) => '<button data-v="' + v + '"' + (sp === v ? ' class="on"' : "") + ">" + n + "</button>").join("") + "</div>") +
      (D.store.langFromBall ? "" : '<h2 class="sub-h">' + T("Language", "Taal") + '</h2><div class="chips seg' + (lang === "nl" ? " r" : "") + '" id="lang"><button data-v="en"' + (lang === "en" ? ' class="on"' : "") + '>English</button><button data-v="nl"' + (lang === "nl" ? ' class="on"' : "") + '>Nederlands</button></div>') +
      '<h2 class="sub-h">' + (many ? T("Names", "Namen") : T("Your name", "Je naam")) + '</h2><div class="names">' +
      P.map((p, i) => '<label>' + D.av(i) + '<input data-i="' + i + '" value="' + esc(p) + '" maxlength="14" aria-label="' + T("Name player ", "Naam speler ") + (i + 1) + '"></label>').join("") +
      '</div>' + (P.length < D.store.MAX ? '<div id="addp"></div>' : "") + '<h2 class="sub-h">' + T("Settings", "Instellingen") + '</h2><label class="toggle"><input type="checkbox" id="snd"' + (D.store.sound ? " checked" : "") + '><span>' + T("Sound and caller", "Geluid en caller") + '</span></label>' +
      '<label class="toggle"><input type="checkbox" id="vc"' + (D.store.voice ? " checked" : "") + '><span>' + T("The caller speaks out loud", "De caller spreekt hardop") + '</span></label>' +
      '<button class="pg-test" id="ctest"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5"/><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5V15"/></svg>' + T("Test the caller", "Test de caller") + '<small>' + T("English, like on TV", "Engels, zoals op tv") + "</small></button>" +
      '<p class="note dim">DART</p>';
    fx.stagger(el, ".pg-mecard, .players > button, .sub-h, #sport, #lang, .names, .toggle, .pg-test", 1);
    const again = () => { ik(el); el.querySelectorAll(".rise").forEach(x => x.classList.remove("rise")); };
    const add = el.querySelector("#addp");
    if(add) D.addForm(add, many ? T("Add another player", "Nog een speler toevoegen") : T("Add a friend", "Voeg een vriend toe"), again);
    el.querySelectorAll(".players button").forEach(b => b.onclick = () => { D.store.setMe(+b.dataset.i); D.sfx.thud(); fx.buzz(10); again(); });
    el.querySelectorAll("#sport button").forEach(b => b.onclick = () => { D.store.setSport(b.dataset.v); D.sfx.tick(); again(); });
    el.querySelectorAll("#lang button").forEach(b => b.onclick = () => {
      if(b.dataset.v === D.store.lang) return;
      D.store.setLang(b.dataset.v); D.sfx.tick(); el.querySelector("#lang").classList.toggle("r", b.dataset.v === "nl");
      setTimeout(() => { labels(); again(); }, fx.calm() ? 0 : 260);
    });
    el.querySelectorAll(".names input").forEach(inp => inp.onchange = () => { D.store.rename(+inp.dataset.i, inp.value); again(); });
    el.querySelector("#snd").onchange = e => { D.store.setSound(e.target.checked); if(e.target.checked){ D.sfx.good(); fx.buzz(10); } else D.caller.stop(); };
    /* the voice needs the sound on: asking for it turns both on */
    const voiceOn = () => {
      if(!D.store.sound){ D.store.setSound(true); el.querySelector("#snd").checked = true; }
      D.store.setVoice(true); el.querySelector("#vc").checked = true; D.caller.unlock();
    };
    el.querySelector("#vc").onchange = e => { if(e.target.checked){ voiceOn(); D.caller.line("Game on!", { pri: 2, rate: 0.9, pitch: 0.88 }); } else { D.store.setVoice(false); D.caller.stop(); } };
    el.querySelector("#ctest").onclick = () => {
      voiceOn();
      D.sfx.unlock(); D.caller.test(); fx.buzz(10);
    };
  }

  /* the tab bar's words and the page language */
  function labels(){
    const L = { spelen: T("Play", "Spelen"), stand: T("Scores", "Stand"), ik: T("Me", "Ik") };
    tabs.querySelectorAll("a").forEach(a => a.querySelector("span").textContent = L[a.dataset.tab]);
    document.documentElement.lang = D.store.lang;
  }

  const arg = () => location.hash.split("-");
  const SCREENS = { spelen, stand, ik, stats: el => D.progress.page(el, arg()[1], arg()[2]), quiz: el => D.quiz(el, "darts"), squiz: el => D.quiz(el, "snooker"),
    checkout: el => D.checkout(el), match: el => D.match(el, arg()[1]), frame: el => D.frame(el), poule: el => D.poule(el, arg()[1]) };
  if(!D.SNOOKER){ delete SCREENS.squiz; delete SCREENS.frame; }
  if(!D.POULE) delete SCREENS.poule;
  const DEPTH = { spelen: 0, stand: 1, ik: 2, stats: 2.5, quiz: 3, squiz: 3, checkout: 3, match: 3, frame: 3, poule: 3 };
  const GAMES = { quiz: "oche", checkout: "oche", match: "oche", squiz: "tafel", frame: "tafel" };
  SCREENS.daily = el => D.daily.screen(el); DEPTH.daily = 3; GAMES.daily = "oche";
  let cleanup = null, last = null;
  function route(){
    const raw = location.hash.slice(1).split("-")[0] || "spelen", name = D.store.needsName ? "hello" : SCREENS[raw] ? raw : "spelen", fn = name === "hello" ? hello : SCREENS[name];
    if(cleanup){ try { cleanup(); } catch(e){} cleanup = null; }
    const game = !!GAMES[name] || name === "hello";
    document.body.classList.toggle("in-game", game);
    document.body.classList.toggle("in-frame", name === "frame");
    document.body.classList.toggle("in-match", name === "match");
    if(GAMES[name]) D.store.setRoom(GAMES[name]);
    document.body.classList.toggle("room-tafel", D.store.room === "tafel");
    /* the stats page lives under the Scores tab, the poule under Play */
    const tab = name === "stats" ? "stand" : name === "poule" ? "spelen" : name;
    tabs.querySelectorAll("a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
    const ti = { spelen: 0, stand: 1, ik: 2 }[tab];
    if(ti != null) tabs.style.setProperty("--t", ti);
    const dir = last == null || last === name ? "n" : DEPTH[name] > DEPTH[last] ? "f" : DEPTH[name] < DEPTH[last] ? "b" : "n";
    app.className = "screen s-" + name;
    app.innerHTML = "";
    void app.offsetWidth;
    app.classList.add("enter-" + dir);
    last = name;
    cleanup = fn(app) || null;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  app.addEventListener("click", e => { if(e.target.closest && e.target.closest(".toball")) toBall(e); });
  labels();
  route();
})(window.DART);
