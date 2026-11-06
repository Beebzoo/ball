/* 501 Match: a real leg on the board. Before each visit you pick a question (Easy / Medium /
   Hard); the answer sets your hand for all three darts (see hand.js). Touch the board where
   you want to throw; a loupe above the finger shows the spot, sliding fine-tunes it (finger
   at 0.4 speed, mouse 1:1). The hand breathes: a ring around the crosshair swells and
   settles, and tightens to gold at each still point. Let go then = PERFECT / GOOD release;
   miss it and the tag says EARLY or LATE. Each dart finds its own first still point. The ring
   is the real spread of the dart. A PERFECT shakes off the yips for the rest of the visit.
   Or tap an Aim chip, then hold anywhere and let go. Darts already in the bed block and
   deflect. Against a computer character (hand.js OPP) or a friend on the same phone.
   Hooks (all guarded): D.arena (mount/event/unmount), D.caller (walk-on, every visit,
   requires, moments, stop), D.progress (record + render on the end screen), D.fx (buzz).
   D.match(el, mode) runs the same throw for a mode (the daily, daily.js): no setup, no walk-on,
   no opponent. mode.pref is its fixed setup, mode.head() the top line, mode.tier() and
   mode.question() the visit's question, mode.visit(p, how, darts) reports each visit and says
   whether another one follows, mode.end(p) takes over from the result screen. */
(function(D){
  const T = D.T, L = a => T(a[0], a[1]), esc = s => D.esc ? D.esc(s) : String(s);
  const call = (o, fn, a) => { try { const x = D[o]; if(x && typeof x[fn] === "function") return x[fn](...a); } catch(e){ console.warn(o, fn, e); } };
  const arena = (fn, ...a) => call("arena", fn, a);
  const caller = (fn, ...a) => call("caller", fn, a);
  const buzz = p => call("fx", "buzz", [p]);
  const calm = () => !!call("fx", "calm", []);
  const r1 = v => Math.round(v * 10) / 10;

  /* the setup is remembered on this device; a friend match keeps its own length (fbest, one leg by default) */
  const PKEY = "dart.matchPref";
  const readPref = () => {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; } catch(e){}
    p = Object.assign({ vs: "cpu", opp: "molenaar", friend: -1, best: 3, fbest: 1, start: 501, tier: "pick", clock: 15, hcap: "auto", last: {} }, p);
    if(!D.hand.OPP.some(o => o.id === p.opp)) p.opp = "molenaar";
    if(![1, 3, 5].includes(p.best)) p.best = 3;
    if(![1, 3, 5].includes(p.fbest)) p.fbest = 1;
    if(![301, 501].includes(p.start)) p.start = 501;
    if(!["pick", "easy", "medium", "hard"].includes(p.tier)) p.tier = "pick";
    if(![15, 8].includes(p.clock)) p.clock = 15;
    if(!["auto", "off"].includes(p.hcap)) p.hcap = "auto";
    if(!p.last || typeof p.last !== "object") p.last = {};
    return p;
  };
  let pref = readPref();
  const savePref = () => { try { localStorage.setItem(PKEY, JSON.stringify(pref)); } catch(e){} };
  /* a player's first match: short, and one they can win (hand-sim section 6) */
  const FIRST = { vs: "cpu", opp: "landlord", best: 1, start: 301 };
  const played = i => { const d = call("progress", "data", [i]); return d ? d.tot.n : 1; };
  const bestOf = () => pref.vs === "friend" ? pref.fbest : pref.best;
  const hasFriend = () => { const P = D.store.players; return pref.friend >= 0 && pref.friend !== D.store.me && !!P[pref.friend]; };
  /* who starts on what: [you, the other]. Against a friend the auto handicap lowers the weaker one's score */
  const startsOf = () => {
    if(pref.vs !== "friend" || pref.hcap !== "auto" || !hasFriend()) return [pref.start, pref.start];
    return D.hand.handicap(call("progress", "form", [D.store.me]) || 60, call("progress", "form", [pref.friend]) || 60, pref.start);
  };
  const TIER = {
    easy: { n: ["Easy", "Makkelijk"], say: ["right = slight tremble", "goed = licht trillend"] },
    medium: { n: ["Medium", "Gemiddeld"], say: ["right = steady hand", "goed = vaste hand"] },
    hard: { n: ["Hard", "Moeilijk"], say: ["right = ice · wrong = yips", "goed = ijs · fout = bibberen"] }
  };

  /* Home's Quick match card: the first match, or your last settings */
  const lenOf = b => b === 1 ? T("One leg", "Eén leg") : "Best of " + b;
  function quickCard(){
    pref = readPref();
    const first = !played(D.store.me);
    if(first) Object.assign(pref, FIRST);
    if(!hasFriend()) pref.vs = "cpu";
    const v = esc(pref.vs === "friend" ? D.store.players[pref.friend] : L(D.hand.opp(pref.opp).nick));
    return { first, text: first ? T("One leg of 301 against " + v + ". About two minutes.", "Eén leg 301 tegen " + v + ". Zo’n twee minuten.")
      : lenOf(bestOf()) + " · " + pref.start + " · " + v };
  }

  /* how: "quick" (Home's card), or a mode: another game on the real throw (app/daily.js) */
  D.match = function(el, how){
    const mode = how && how.pref ? how : null;
    let alive = true, raf = 0;
    const timers = new Set();
    const later = (f, ms) => { const t = setTimeout(() => { timers.delete(t); if(alive) f(); }, ms); timers.add(t); return t; };
    const stopAll = () => { timers.forEach(clearTimeout); timers.clear(); cancelAnimationFrame(raf); };
    let stopChase = () => {};
    /* fresh from the device each time; someone who has never played starts on the short first match */
    pref = mode ? mode.pref : readPref();
    if(!mode && !played(D.store.me)) Object.assign(pref, FIRST);

    /* ---------- setup: one line per choice, Game on always in sight (match.css) ---------- */
    function setup(){
      const H = D.hand;
      let picking = false;
      const chip = (v, txt) => '<button data-v="' + v + '">' + txt + "</button>";
      const line = (label, id, chips, cls) => '<div class="ms-row' + (cls ? " " + cls : "") + '"><span>' + label + '</span><div class="chips" id="' + id + '">' + chips + "</div></div>";
      el.innerHTML = '<div class="g-top"><a class="back" href="#spelen">‹ Menu</a><b>501 Match</b><span></span></div>' +
        '<div class="g-body ms"><p class="lead">' + T("Right answer, steady hand. Let go on the gold ring.", "Goed antwoord, vaste hand. Laat los op de gouden ring.") + "</p>" +
        line(T("Against", "Tegen"), "vs", chip("cpu", T("A pro", "Een prof")) + chip("friend", T("A friend", "Een vriend"))) +
        '<div id="vsx"></div>' +
        line(T("Length", "Lengte"), "best", [1, 3, 5].map(b => chip(b, lenOf(b))).join("")) +
        line("Start", "start", chip(501, "501") + chip(301, "301")) +
        line(T("Questions", "Vragen"), "tier", chip("pick", T("Pick", "Kies")) + H.TIERS.map(t => chip(t, L(TIER[t].n))).join(""), "wide") +
        line(T("Clock", "Klok"), "clock", chip(15, "15 s") + chip(8, "8 s")) +
        '<div class="ms-go"><button class="go" id="go">Game on</button><p class="count" id="ld"></p></div></div>';
      const go = el.querySelector("#go"), ld = el.querySelector("#ld");
      const mark = () => {
        /* the players are read here, not once: a second player can join on this screen */
        const P = D.store.players, me = D.store.me;
        if(!hasFriend()) pref.friend = P.findIndex((p, i) => i !== me);
        [["vs", pref.vs], ["best", bestOf()], ["start", pref.start], ["tier", pref.tier], ["clock", pref.clock]].forEach(([id, v]) =>
          el.querySelectorAll("#" + id + " button").forEach(b => b.classList.toggle("on", b.dataset.v === String(v))));
        const x = el.querySelector("#vsx");
        if(pref.vs === "cpu"){
          const o = H.opp(pref.opp);
          x.innerHTML = '<div class="ms-row"><span>' + T("Who?", "Wie?") + '</span><button class="ms-opp' + (picking ? " open" : "") + '" id="oppb" aria-expanded="' + picking + '"><b>' + esc(L(o.nick)) + "</b><small>" + T("avg ~", "gem ~") + o.avg + "</small><i>›</i></button></div>" +
            (!picking ? "" : '<div class="opps" id="opp">' + H.LEVELS.map((lv, i) =>
            '<p class="opp-lv">' + L(lv) + '</p><div class="opp-g">' + H.OPP.filter(o => o.lvl === i).map(o =>
              '<button data-v="' + o.id + '" class="opp' + (o.id === pref.opp ? " on" : "") + '"><span class="o-n"><b>' + esc(L(o.nick)) + "</b><i>" + o.flag + "</i></span>" +
              "<small>" + esc(o.name) + " · " + T("avg ~", "gem ~") + o.avg + "</small><em>" + esc(L(o.tell)) + "</em></button>").join("") + "</div>").join("") + "</div>");
          x.querySelector("#oppb").onclick = () => { picking = !picking; D.sfx.tick(); mark(); };
          x.querySelectorAll("#opp button").forEach(b => b.onclick = () => { pref.opp = b.dataset.v; picking = false; D.sfx.tick(); mark(); });
        } else if(P.length < 2){
          /* nobody else on this phone yet: their name is all it takes */
          x.innerHTML = '<div class="ms-row"><span>' + T("Who?", "Wie?") + '</span><div id="fr"></div></div>';
          D.addForm(x.querySelector("#fr"), T("Your friend’s name", "Naam van je vriend"), i => { pref.friend = i; setup(); });
        } else {
          const [sa, sb] = startsOf(), low = sa < sb ? P[me] : sb < sa ? P[pref.friend] : null;
          x.innerHTML = line(T("Who?", "Wie?"), "fr", P.map((p, i) => i === me ? "" : '<button data-v="' + i + '"' + (i === pref.friend ? ' class="on"' : "") + ">" + esc(p) + "</button>").join("")) +
            (!hasFriend() ? "" : line(T("Handicap", "Handicap"), "hc", chip("auto", T("Auto", "Auto")) + chip("off", T("Off", "Uit"))) +
              (pref.hcap === "auto" ? '<p class="ms-note">' + (low ? esc(low) + T(" starts on <b>", " begint op <b>") + Math.min(sa, sb) + "</b>" : T("Level: you both start on <b>", "Gelijk: jullie beginnen allebei op <b>") + sa + "</b>") + "</p>" : ""));
          x.querySelectorAll("#fr button").forEach(b => b.onclick = () => { pref.friend = +b.dataset.v; mark(); });
          x.querySelectorAll("#hc button").forEach(b => { b.classList.toggle("on", b.dataset.v === pref.hcap); b.onclick = () => { pref.hcap = b.dataset.v; mark(); }; });
        }
        const stuck = pref.vs === "friend" && !hasFriend();
        go.disabled = stuck; ld.textContent = stuck ? T("Add a second player first.", "Voeg eerst een tweede speler toe.") : "";
      };
      el.querySelectorAll("#vs button").forEach(b => b.onclick = () => { pref.vs = b.dataset.v; mark(); });
      el.querySelectorAll("#best button").forEach(b => b.onclick = () => { if(pref.vs === "friend") pref.fbest = +b.dataset.v; else pref.best = +b.dataset.v; mark(); });
      el.querySelectorAll("#start button").forEach(b => b.onclick = () => { pref.start = +b.dataset.v; mark(); });
      el.querySelectorAll("#tier button").forEach(b => b.onclick = () => { pref.tier = b.dataset.v; mark(); });
      el.querySelectorAll("#clock button").forEach(b => b.onclick = () => { pref.clock = +b.dataset.v; mark(); });
      mark();
      go.onclick = () => {
        savePref();
        go.disabled = true; ld.textContent = T("Loading questions…", "Vragen laden…");
        D.qs.load().then(() => alive && start()).catch(() => { go.disabled = false; ld.textContent = T("The questions won’t load. Try again in a moment.", "De vragen laden niet. Probeer het zo nog eens."); });
      };
    }
    /* Quick match (Home): no setup, straight to the walk-on. The full setup stays behind the 501 Match card */
    function quick(){
      if(!hasFriend()) pref.vs = "cpu";
      savePref();
      el.innerHTML = '<div class="g-top"><a class="back" href="#spelen">‹ Menu</a><b>501 Match</b><span></span></div><p class="loading">' + T("Loading questions…", "Vragen laden…") + "</p>";
      D.qs.load().then(() => alive && start()).catch(() => { if(alive){ setup(); el.querySelector("#ld").textContent = T("The questions won’t load. Try again in a moment.", "De vragen laden niet. Probeer het zo nog eens."); } });
    }

    /* ---------- the match ---------- */
    function start(){
      stopAll(); stopChase();
      const H = D.hand, me = D.store.me, PL = D.store.players, OP = pref.vs === "cpu" ? H.opp(pref.opp) : null, QTIME = pref.clock, BEST = bestOf(), ST = startsOf();
      /* the very first match against the computer opens with one guided dart */
      const coach = !!OP && !played(me);
      const mk = (name, idx, cpu, st) => ({ name, idx, cpu, start: st, left: st, legs: 0, darts: 0, legDarts: 0, scored: 0, n180: 0, n140: 0, hiCo: 0, atD: 0, bo: 0,
        qRight: 0, qAll: 0, pq: 0, pqRight: 0, last: null, mom: 0, missD: 0, perfect: 0, good: 0, robin: 0, offDart: 0, hits: [], legWon: [], checkouts: [], busts: 0, pv: 0, dDone: 0, tier: pref.last[idx] || "medium", form: null, nine: false, right: false });
      const pl = [mk(PL[me], me, false, ST[0]), OP ? mk(OP.name, -1, true, pref.start) : mk(PL[pref.friend], pref.friend, false, ST[1])];
      if(mode) pl.length = 1;
      const need = Math.ceil(BEST / 2);
      let leg = 1, starter = 0, turn = 0, phase = "idle", free = null, handOver = false, grade = 0, ph = 0, visit = [], visitStart = 0, visitPts = [], visitClean = 0, visitPerf = 0,
        aim = D.board.target({ m: 3, n: 20 }), hold = null, locked = null, t0 = performance.now(), chase = null;

      arena("unmount");
      el.innerHTML = '<div class="g-top"><button class="back" id="stop">‹ Stop</button><b id="legx"></b><span></span></div>' +
        '<div class="g-body m">' +
        '<div class="sb" id="sb">' + pl.map((p, i) => '<div class="sbp" data-i="' + i + '"><i class="dot"></i><b class="nm">' + esc(p.name) + (p.cpu ? "<small>" + OP.flag + "</small>" : "") + '</b><span class="lg"></span><span class="chalk lf"></span><span class="sbx"></span></div>').join("") + "</div>" +
        '<div class="m-board" id="mb">' + D.board.svg({ cls: "big" }) + '<div class="handtag" id="ht"></div><div class="m-chy" id="chy"></div><div class="m-coach" id="coach" hidden></div>' +
        '<div class="loupe" id="lp" hidden>' + D.board.svg({ cls: "lp" }) + '<span class="lp-l" id="lpl"></span></div></div>' +
        '<div class="m-info"><div class="m-fin" id="fin"></div><div class="slots" id="slots"></div><div class="aimchips" id="ac"></div><p class="m-hint" id="hint"></p></div>' +
        '<div class="sheet" id="sheet" hidden></div><div class="banner" id="ban" hidden></div></div><div class="visit" id="vis"></div>';
      const $ = s => el.querySelector(s), svg = el.querySelector(".m-board .board"), NS = "http://www.w3.org/2000/svg";
      const lp = $("#lp"), lsvg = lp.querySelector(".board"), lpl = $("#lpl"), mb = $("#mb");
      if(call("timing", "on", [])) mb.insertAdjacentHTML("beforeend", '<div class="m-timing" id="tm">' + esc(D.timing.line()) + "</div>");
      /* Stop asks first (a match can't be resumed): a second tap within three seconds leaves */
      const stopB = $("#stop");
      let sure = 0;
      stopB.onclick = () => {
        if(sure) return D.go("#spelen");
        stopB.textContent = mode && mode.sure ? mode.sure() : T("Sure? Tap again", "Zeker? Tik nog eens"); stopB.classList.add("sure"); buzz(10);
        sure = later(() => { sure = 0; stopB.textContent = "‹ Stop"; stopB.classList.remove("sure"); }, 3000);
      };
      arena("mount", el.querySelector(".g-body.m"));
      /* the crosshair: anchor (where you aim), cross (aim + wobble) and the breathing ring */
      const mkAim = (r, w) => { const g = document.createElementNS(NS, "g"); g.setAttribute("class", "aim"); g.style.display = "none";
        g.innerHTML = '<circle class="anchor" r="' + w * 1.6 + '"/><g class="cross"><circle r="' + r + '" stroke-width="' + w + '"/><circle r="' + w + '" class="c0"/>' +
          ["-1.7,-0.5", "0.5,1.7"].map(v => { const [a, b] = v.split(",").map(Number); return '<line x1="' + a * r + '" x2="' + b * r + '" stroke-width="' + w + '"/><line y1="' + a * r + '" y2="' + b * r + '" stroke-width="' + w + '"/>'; }).join("") +
          '<circle class="breath" r="' + r * 2 + '" stroke-width="' + w * 0.9 + '"/></g>';
        return g; };
      const aimG = mkAim(10, 1.6), aimL = mkAim(3.4, 0.45);
      svg.appendChild(aimG); lsvg.appendChild(aimL);
      const parts = g => ({ g, cross: g.querySelector(".cross"), anchor: g.querySelector(".anchor"), ring: g.querySelector(".breath") });
      const AG = parts(aimG), AL = parts(aimL);

      const avg = p => p.darts ? (p.scored / p.darts * 3) : 0;
      const onFinish = left => left <= 170 && D.co.possible(left);
      const atDouble = left => (left <= 40 && left % 2 === 0) || left === 50;
      const lab = d => d.bo ? T("Bounce-out", "Eruit") : d.robin ? "Robin Hood" : D.co.label(d);
      /* momentum and nerves for the hand right now */
      const stOf = p => ({ mom: p.mom, nerves: atDouble(p.left) ? Math.min(3, p.missD) : 0 });
      function board(){
        $("#legx").textContent = mode ? mode.head() : "Leg " + leg + (BEST > 1 ? " · best of " + BEST : "");
        pl.forEach((p, i) => {
          const row = el.querySelector('.sbp[data-i="' + i + '"]');
          row.classList.toggle("on", i === turn);
          row.classList.toggle("fire", p.mom >= 3);
          row.querySelector(".lg").textContent = BEST > 1 ? p.legs : "";
          row.querySelector(".lf").textContent = p.left;
          const r = p.left <= 170 && D.co.route(p.left);
          row.querySelector(".sbx").innerHTML = (r ? "<em>" + r.map(D.co.label).join(" ") + "</em>" : "") +
            (p.mom ? '<i class="mpips" title="' + T("In the zone", "In de zone") + '">' + "<b></b>".repeat(p.mom) + "</i>" : "") +
            '<span class="ag">' + T("avg ", "gem ") + (p.dDone ? (p.scored / p.dDone * 3).toFixed(1) : "–") + "</span>" +
            (p.last != null ? '<b class="last">' + T("last ", "vorige ") + p.last + "</b>" : "");
        });
        $("#slots").innerHTML = [0, 1, 2].map(i => '<span class="' + (visit[i] ? "used" + (visit[i].bo || visit[i].robin ? " bo" : "") : "") + '">' + (visit[i] ? lab(visit[i]) : "") + "</span>").join("");
      }
      /* "on a finish": the route big above the slots, the next dart's bed glowing on the board */
      function finish(){
        const p = pl[turn], k = 3 - visit.length, r = onFinish(p.left) && D.co.route(p.left), fin = $("#fin");
        svg.querySelectorAll(".bed.tgt").forEach(x => x.remove());
        if(!r || r.length > k || phase === "after"){ fin.innerHTML = ""; fin.className = "m-fin"; return; }
        fin.className = "m-fin show";
        fin.innerHTML = '<span class="lbl">' + T("On a finish · ", "Op een finish · ") + p.left + "</span><div>" + r.map((d, i) => '<b class="' + (i === 0 ? "now" : "") + '">' + D.co.label(d) + "</b>").join("<i>›</i>") + "</div>";
        if(!p.cpu) D.board.light(svg, r[0], "tgt", 0);
      }
      const same = (a, b) => a && b && a.m === b.m && a.n === b.n;
      /* the first dart of a finish that fits the darts left */
      function finNow(p){ const r = D.co.route(p.left); return r && r.length <= 3 - visit.length ? r[0] : null; }
      function aimOpts(p){
        const f = finNow(p), opts = f ? [f] : [];
        [{ m: 3, n: 20 }, { m: 3, n: 19 }, { m: 2, n: 25 }].forEach(d => { if(!opts.some(o => same(o, d))) opts.push(d); });
        return opts.slice(0, 4);
      }
      /* a chip stays on through the visit, back on its bed after any slide, until a finish asks
         for another dart, it would bust, or it isn't one of the chips any more */
      function keepAim(p){
        if(!locked) return;
        const f = finNow(p);
        if(f ? !same(f, locked) : D.co.val(locked) > p.left - 2 || !aimOpts(p).some(d => same(d, locked))) locked = null;
        else aim = D.board.target(locked).slice();
      }
      function chips(){
        const p = pl[turn], fin = finNow(p), opts = aimOpts(p);
        $("#ac").innerHTML = "<span>" + T("Aim", "Mik op") + "</span>" + opts.map((d, i) => '<button data-i="' + i + '" class="' + (i === 0 && fin ? "fin" : "") + (same(locked, d) ? " on" : "") + '">' + D.co.label(d) + "</button>").join("");
        $("#ac").querySelectorAll("button").forEach(b => b.onclick = () => {
          const d = opts[+b.dataset.i];
          locked = same(locked, d) ? null : d;
          if(locked) aim = D.board.target(locked).slice();
          D.sfx.tick(); chips(); hint();
        });
      }
      function hint(){
        $("#hint").textContent = locked ? T("Aiming at " + D.co.label(locked) + ": hold anywhere, let go when the ring tightens to gold. Tap it again to aim freely.", "Je mikt op " + D.co.label(locked) + ": houd je vinger op het bord, laat los als de ring goud wordt. Tik nog eens om vrij te mikken.")
          : T("Touch where you want to throw, slide to fine-tune. Let go when the ring tightens to gold.", "Raak aan waar je wilt gooien, schuif om bij te stellen. Laat los als de ring goud wordt.");
      }
      /* the hand tag above the board: the hand, plus nerves or on fire. up: a PERFECT just shook off the yips */
      function tag(up){
        const p = pl[turn], st = stOf(p), ht = $("#ht");
        if(p.cpu){ ht.className = "handtag"; return; }
        ht.innerHTML = esc(L(H.HANDS[grade].name)) + (up ? ' <span class="up">' + T("Yips gone", "Bibbers weg") + "</span>" : "") + (st.nerves ? ' <span class="nv">' + T("Nerves ×", "Zenuwen ×") + st.nerves + "</span>" : "") + (p.mom >= 3 ? ' <span class="fi">' + T("On fire", "Lekker bezig") + "</span>" : "");
        ht.className = "handtag show h" + grade;
      }

      /* ---------- the crosshair: aim + the wobble of your hand + the breathing ring ---------- */
      const LW = 62, CALM = calm();
      let lastWin = 0, lastRel = null;
      function loop(){
        raf = requestAnimationFrame(loop);
        if(phase !== "throw"){ aimG.style.display = "none"; if(!lp.hidden) lp.hidden = true; return; }
        aimG.style.display = "";
        const now = performance.now(), s = (now - t0) / 1000, p = pl[turn], st = stOf(p);
        let hs = null;
        if(hold){
          if(now - hold.moved > 120) hold.rest += Math.min(0.1, (now - hold.tick) / 1000);
          hold.tick = now;
          hs = { b: (now - hold.t0) / 1000, rest: hold.rest, first: hold.first };
        }
        const br = H.breath(hs, grade, st), w = H.wobble(aim, s, grade, ph, hs, st), blk = H.blocked(aim, visitPts);
        const at = "translate(" + aim[0].toFixed(2) + " " + aim[1].toFixed(2) + ")", ct = "translate(" + (aim[0] + w[0]).toFixed(2) + " " + (aim[1] + w[1]).toFixed(2) + ")";
        const h = H.mods(grade, st), ring = hs ? H.ring(grade, st, CALM ? { win: 1, base: h.minE, tired: 1 } : br) : 0;
        const cls = "aim" + (hold ? " hold" : "") + (hs ? " breathe" : "") + (br.win === 2 ? " win2" : br.win ? " win1" : "") + (br.tired > 1.04 ? " tired" : "") + (blk ? " blocked" : "") + (st.nerves ? " nerves" : "") + (p.mom >= 3 ? " fire" : "");
        [AG, AL].forEach((A, i) => {
          if(i === 1 && !hold){ A.g.style.display = "none"; return; }
          A.g.style.display = "";
          A.anchor.setAttribute("transform", at); A.cross.setAttribute("transform", ct);
          if(A.g.getAttribute("class") !== cls) A.g.setAttribute("class", cls);
          if(hs) A.ring.setAttribute("r", (i ? Math.min(ring, LW / 2 - 2) : ring).toFixed(2));
          /* no motion (reduced-motion setting): the ring fades in towards the still point instead */
          if(hs && CALM) A.ring.style.opacity = (1 - 0.8 * (br.base - h.minE) / (1 - h.minE)).toFixed(2);
        });
        if(hold){
          lsvg.setAttribute("viewBox", (aim[0] - LW / 2).toFixed(2) + " " + (aim[1] - LW / 2).toFixed(2) + " " + LW + " " + LW);
          const d = D.board.hit(aim[0], aim[1]);
          lpl.textContent = (d.n === 0 ? T("Off the board", "Naast het bord") : D.co.label(d)) + (blk ? T(" · blocked", " · bezet") : "");
          lpl.classList.toggle("blk", blk);
          if(br.win && !lastWin){ buzz(6); call("sfx", "ready", []); }
        }
        lastWin = hold ? br.win : 0;
      }
      const unit = () => 480 / svg.getBoundingClientRect().width;
      const clampAim = a => { const r = Math.hypot(a[0], a[1]); return r > 226 ? [a[0] * 226 / r, a[1] * 226 / r] : a; };
      /* the loupe sits above the finger, or beside it near the top of the screen */
      function placeLoupe(cx, cy){
        const box = mb.getBoundingClientRect(), S = lp.offsetWidth || 136, gap = 112, vw = document.documentElement.clientWidth;
        let x = cx, y = cy - gap;
        if(y - S / 2 < 6){ y = Math.max(cy, 6 + S / 2); x = cx + (cx < vw / 2 ? gap : -gap); }
        x = Math.max(S / 2 + 4, Math.min(vw - S / 2 - 4, x));
        lp.style.left = (x - box.left - S / 2) + "px"; lp.style.top = (y - box.top - S / 2) + "px";
      }
      /* when the finger really moved: the event's own clock, as the handler can run 100 ms late
         (a browser on another clock falls back to now) */
      const evT = e => { const now = performance.now(), t = e.timeStamp; return t > 0 && t <= now && now - t < 2000 ? t : now; };
      mb.addEventListener("contextmenu", e => e.preventDefault());
      mb.addEventListener("pointerdown", e => {
        if(phase !== "throw" || hold) return;
        e.preventDefault(); try { mb.setPointerCapture(e.pointerId); } catch(x){}
        const mouse = e.pointerType === "mouse", now = performance.now();
        if(!locked) aim = clampAim(D.board.toMM(svg, e.clientX, e.clientY));
        hold = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, a: aim.slice(), id: e.pointerId, gain: mouse ? (locked ? 0.5 : 1) : 0.4, hist: [], t0: evT(e), first: free ? H.K.FIRST : H.firstStill(grade, stOf(pl[turn])), moved: now, tick: now, rest: 0 };
        hold.hist.push([now, e.clientX, e.clientY, aim[0], aim[1]]);
        lsvg.querySelector(".darts").innerHTML = svg.querySelector(".darts").innerHTML;
        lp.hidden = false; placeLoupe(e.clientX, e.clientY);
        arena("event", "hold", { on: true });
      });
      mb.addEventListener("pointermove", e => {
        if(!hold || e.pointerId !== hold.id) return;
        const u = unit() * hold.gain;
        aim = clampAim([hold.a[0] + (e.clientX - hold.x) * u, hold.a[1] + (e.clientY - hold.y) * u]);
        const now = performance.now();
        /* sliding (fine-tuning in the loupe) doesn't tire the arm */
        if(Math.hypot(e.clientX - hold.lx, e.clientY - hold.ly) > 1.5){ hold.moved = now; hold.lx = e.clientX; hold.ly = e.clientY; }
        hold.hist.push([now, e.clientX, e.clientY, aim[0], aim[1]]);
        while(hold.hist.length > 2 && hold.hist[1][0] < now - 400) hold.hist.shift();
        placeLoupe(e.clientX, e.clientY);
      });
      const up = e => {
        if(!hold || e.pointerId !== hold.id) return;
        /* a quick flick up at the end throws a bit harder, but never moves the aim */
        const now = performance.now(), h = hold.hist;
        let base = h[0];
        for(const x of h){ if(x[0] <= now - 150) base = x; }
        const rise = base[2] - e.clientY, flick = rise > 30 && Math.abs(e.clientX - base[1]) < rise && now - base[0] < 450;
        if(flick) aim = [base[3], base[4]];
        const at = evT(e), hs = { b: Math.max(0, at - hold.t0) / 1000, rest: hold.rest, first: hold.first };
        hold = null; lp.hidden = true; arena("event", "hold", { on: false });
        if(phase === "throw") human(flick, hs, at);
      };
      mb.addEventListener("pointerup", up);
      mb.addEventListener("pointercancel", () => { hold = null; lp.hidden = true; arena("event", "hold", { on: false }); });

      /* the ring as it stood at the release stays a moment and the dart lands in it, so a good throw
         that misses shows as one */
      let spot = null;
      function showRing(r){
        if(spot) spot.remove();
        const g = spot = document.createElementNS(NS, "g");
        g.setAttribute("class", "spot s" + r.clean);
        g.setAttribute("transform", "translate(" + r.at[0].toFixed(2) + " " + r.at[1].toFixed(2) + ")");
        g.innerHTML = '<circle r="' + r.ring.toFixed(2) + '"/>';
        svg.appendChild(g);
        setTimeout(() => g.remove(), 1300);
      }

      /* ---------- the big moments: the 180 chase and the match dart ---------- */
      const chy = $("#chy");
      let heart = 0;
      stopChase = () => { if(heart){ clearInterval(heart); heart = 0; } if(pl[turn].nine && phase !== "after"){ chy.textContent = T("Nine-dart watch", "Negendarter in zicht"); chy.className = "m-chy show nine"; } else chy.className = "m-chy"; mb.classList.remove("zoom"); chase = null; };
      function startChase(kind, n){
        if(chase) return;
        const p = pl[turn];
        chase = { kind, n, name: p.name };
        chy.textContent = kind === "max" ? T("For the maximum", "Voor de 180") : T("Match dart", "Matchpijl");
        chy.className = "m-chy show " + kind;
        arena("event", kind === "max" ? "chase" : "matchdart", { name: p.name });
        if(kind === "match") caller("moment", "matchdart", { name: p.name, cpu: p.cpu, left: p.left });
        D.sfx.heart(); heart = setInterval(() => { if(alive) D.sfx.heart(); }, 750);
      }
      /* before a dart: is this the third dart after two T20s (T19 T19 can't be a maximum), or a match dart? */
      function chaseCheck(){
        const p = pl[turn];
        if(chase) return;
        if(visit.length === 2 && visit.every(d => d.m === 3 && d.n === 20)) startChase("max", 20);
        else if(atDouble(p.left) && p.legs + 1 >= need && D.co.route(p.left).length === 1) startChase("match");
      }
      /* the slow-motion zoom on the bed, only after the release */
      function zoomTo(n){
        if(calm()) return;
        const [x, y] = D.board.target({ m: 3, n });
        svg.style.transformOrigin = ((x + 240) / 480 * 100).toFixed(1) + "% " + ((y + 240) / 480 * 100).toFixed(1) + "%";
        mb.classList.remove("unzoom"); mb.classList.add("zoom");
      }
      function unzoom(ms){ later(() => { mb.classList.add("unzoom"); mb.classList.remove("zoom"); later(() => mb.classList.remove("unzoom"), 400); }, ms); }

      /* ---------- one dart ---------- */
      function shake(){ svg.classList.remove("shake"); void svg.getBoundingClientRect(); svg.classList.add("shake"); later(() => svg.classList.remove("shake"), 260); }
      function pop(pt, d, x, c){
        const e = document.createElement("div"), v = D.co.val(d), off = c && c.host != null;
        e.className = "m-pop" + (d.robin ? " robin" : d.bo ? " bo" : d.n === 0 ? " miss" : d.m === 3 || (d.n === 25 && d.m === 2) ? " big" : "");
        e.style.left = Math.max(12, Math.min(88, (pt[0] + 240) / 480 * 100)) + "%"; e.style.top = ((pt[1] + 240) / 480 * 100) + "%";
        e.innerHTML = (d.robin ? "<b>Robin Hood!</b><span>" + T("in the back of the dart", "in de achterkant van de pijl") + "</span>"
          : d.bo ? "<b>" + (off ? T("Off a dart!", "Op een pijl!") : T("Bounce-out!", "Eruit gestuiterd!")) + "</b>"
          : "<b>" + D.co.label(d) + "</b>" + (d.m > 1 || d.n === 25 ? "<span>" + v + "</span>" : "") + (off ? '<span class="dfl">' + T("off a dart", "via een pijl") + "</span>" : "")) +
          (x.off == null ? "" : '<i class="tag t' + x.clean + '">' + (x.clean === 2 ? "PERFECT" : x.clean ? "GOOD" : x.off < 0 ? T("EARLY", "TE VROEG") : T("LATE", "TE LAAT")) + "</i>") +
          (x.clean === 2 && x.want && !d.robin && !d.bo && !same(d, x.want) ? '<span class="unl">' + T("Unlucky", "Pech") + "</span>" : "");
        mb.appendChild(e);
        setTimeout(() => e.remove(), 1100);
      }
      /* throw: the dart flies in (raw = where it went, c = after any dart in the bed), then lands */
      function throwDart(p, raw, c, ms, x, next){
        const dbl = atDouble(p.left);
        if(dbl) p.atD++;
        svg.querySelectorAll(".bed.tgt").forEach(e => e.remove());
        D.sfx.whoosh(x.slow);
        const host = c.robin ? visitPts[c.host] : null;
        const fin = c.bo || c.robin ? { m: 1, n: 0 } : D.board.hit(c.pt[0], c.pt[1]);
        const stop = !c.bo && !c.robin && (fin.m === 3 || fin.n === 25) && !calm() ? 70 : 0;
        const opts = { ms, slow: x.slow, bounce: c.bo, deflect: !c.bo && !c.robin && c.defl ? c.pt : null, robin: host && host.el && host.el._pos, stop };
        if(x.slow && chase && chase.kind === "max") zoomTo(chase.n);
        const at = opts.deflect || c.bo ? raw : c.pt;
        let dartEl = null;
        dartEl = D.board.throwAt(svg, at[0], at[1], visit.length + 1, opts, () => { if(alive) next(land(p, c, fin, x, dbl, dartEl, stop)); });
      }
      function land(p, c, fin, x, dbl, dartEl, stop){
        const d = c.bo ? { m: 1, n: 0, bo: true } : c.robin ? { m: 1, n: 0, robin: true } : fin;
        visit.push(d); p.darts++; p.legDarts++;
        if(c.bo) p.bo++;
        if(c.host != null && !c.robin) p.offDart++;
        if(c.robin) p.robin++;
        if(!c.bo) visitPts.push({ pt: c.pt, robin: !!c.robin, el: dartEl });
        p.hits.push([r1(c.pt[0]), r1(c.pt[1]), c.bo ? "BO" : c.robin ? "RH" : D.co.label(d)]);
        const kind = d.n === 0 ? "miss" : d.n === 25 ? "bull" : d.m === 3 ? "treble" : d.m === 2 ? "double" : "single";
        if(c.bo){ D.sfx.tink(c.host != null ? 0.7 : 1); buzz([10, 30, 10, 30, 10]); caller("moment", "bounce", { name: p.name, cpu: p.cpu }); }
        else if(c.robin){ D.sfx.tink(0.8); D.sfx.thud("single"); buzz([20, 40, 20]); caller("moment", "robin", { name: p.name, cpu: p.cpu }); arena("event", "robin", { name: p.name }); }
        else {
          D.sfx.thud(kind);
          if(kind !== "double" && kind !== "miss" && D.board.wire(c.pt[0], c.pt[1]) < 1.2) D.sfx.tink(0.2);
          buzz(kind === "treble" || kind === "bull" ? 18 : kind === "double" ? [12, 40, 12] : kind === "single" ? 8 : 0);
          D.board.light(svg, d, "flash", 750);
        }
        const show = () => { if(!alive) return; if(!c.bo && !c.robin && !(chase && x.slow)) shake(); pop(c.pt, d, x, c); };
        if(stop) later(show, stop); else show();
        arena("event", "dart", { label: lab(d), score: D.co.val(d) });
        const st = D.co.play(visitStart, visit);
        if(st.state !== "bust") p.left = st.state === "out" ? 0 : st.left;
        /* nerves: every dart at a double that doesn't win the leg */
        if(!p.cpu && dbl && st.state !== "out") p.missD = Math.min(3, p.missD + 1);
        board();
        if(st.state === "out") return endVisit(p, "out");
        if(st.state === "bust") return endVisit(p, "bust");
        if(visit.length === 3) return endVisit(p, "done");
        if(chase && x.slow){ stopChase(); }
        return null;
      }
      /* a dart that doesn't count (the guided throw, the bull-up): the real hand and release, a
         steady hand, no question, nothing in the stats. after(release, bed) runs when it has landed */
      function freeDart(after){
        grade = 0; ph = Math.random() * 6.28; t0 = performance.now();
        free = after; phase = "throw"; $("#ac").innerHTML = ""; tag();
      }
      function looseDart(flick, hs, at){
        const p = pl[turn], after = free;
        free = null; phase = "flying"; locked = null;
        const r = H.release(aim, (at - t0) / 1000, grade, ph, hs, stOf(p)), d = D.board.hit(r.pt[0], r.pt[1]);
        showRing(r);
        if(r.clean === 2){ D.sfx.clean(2); buzz([8, 30, 8]); } else if(r.clean === 1){ D.sfx.clean(1); buzz(8); }
        D.sfx.whoosh();
        D.board.throwAt(svg, r.pt[0], r.pt[1], turn + 1, { ms: flick ? 170 : 230 }, () => {
          if(!alive) return;
          D.sfx.thud(d.n === 0 ? "miss" : d.n === 25 ? "bull" : d.m === 3 ? "treble" : d.m === 2 ? "double" : "single");
          shake(); pop(r.pt, d, r); after(r, d);
        });
      }
      function human(flick, hs, at){
        if(free) return looseDart(flick, hs, at);
        const p = pl[turn], s = (at - t0) / 1000, st = stOf(p);
        phase = "flying"; $("#ac").querySelectorAll("button").forEach(b => b.disabled = true);
        const r = H.release(aim, s, grade, ph, hs, st), up = r.clean === 2 && H.steady(grade) !== grade, want = D.board.hit(aim[0], aim[1]);
        showRing(r);
        lastRel = { clean: r.clean, off: r.off, lag: performance.now() - at, b: hs.b, first: hs.first };
        call("timing", "add", [r.off, lastRel.lag, r.clean, grade]); if($("#tm")) $("#tm").textContent = D.timing.line();
        if(r.clean === 2){ p.perfect++; D.sfx.clean(2); buzz([8, 30, 8]); } else if(r.clean === 1){ p.good++; D.sfx.clean(1); buzz(8); }
        if(r.clean) visitClean++; if(r.clean === 2) visitPerf++;
        const bo = H.bounce(r.pt, grade), c = bo ? { pt: r.pt, bo: true } : H.collide(r.pt, visitPts);
        const slow = !!chase, ms = chase ? (chase.kind === "max" ? (calm() ? 300 : 650) : 400) : flick ? 170 : 230;
        if(heart){ clearInterval(heart); heart = 0; }
        throwDart(p, r.pt, c, ms, { clean: r.clean, off: r.off, slow, want }, res => {
          if(res === null) later(() => { phase = "throw"; if(up) grade = H.steady(grade); keepAim(p); chips(); hint(); finish(); tag(up); chaseCheck(); }, 380);
        });
      }

      /* ---------- before the first visit ---------- */
      /* a player's first match: one guided throw, no question, then the match */
      function warmUp(){
        const co = $("#coach"), T20 = { m: 3, n: 20 };
        const say = (lbl, txt) => { co.hidden = false; co.innerHTML = "<small>" + lbl + "</small><b>" + txt + "</b>"; };
        const held = () => say(T("Practice dart", "Oefenpijl"), T("Watch the ring. Let go when it turns gold.", "Let op de ring. Laat los als hij goud wordt."));
        visit = []; D.board.clear(svg); board();
        arena("event", "turn", { name: pl[0].name, cpu: false });
        D.board.light(svg, T20, "tgt", 0);
        say(T("Practice dart · it doesn’t count", "Oefenpijl · telt niet mee"), T("Touch the board and keep your finger down.", "Raak het bord aan en houd je vinger erop."));
        mb.addEventListener("pointerdown", held, { once: true });
        freeDart(r => {
          co.hidden = true; svg.querySelectorAll(".bed.tgt").forEach(x => x.remove());
          later(() => {
            const sh = $("#sheet"); sh.hidden = false; sh.className = "sheet choose pass";
            sh.innerHTML = '<p class="lbl">' + T("Practice dart", "Oefenpijl") + '</p><p class="pass-n">' + (r.clean === 2 ? T("Perfect", "Perfect") : r.clean ? T("Good", "Good") : T("Nearly", "Bijna")) + '</p><p class="lead">' +
              (r.clean ? "" : T("Let go while the ring is gold. ", "Laat los terwijl de ring goud is. ")) + T("In the match every visit starts with a question: a right answer steadies your hand, a wrong one shakes it.", "In de match begint elke beurt met een vraag: goed maakt je hand vast, fout laat hem trillen.") +
              '</p><div class="row"><button class="go ghost" id="wa">' + T("Once more", "Nog een keer") + '</button><button class="go" id="wg">Game on</button></div>';
            $("#wa").onclick = () => { sh.hidden = true; warmUp(); };
            $("#wg").onclick = () => { sh.hidden = true; beginVisit(); };
          }, 900);
        });
      }
      /* a friend match: one dart each at the bull, the closest throws first. The first dart stays
         in the board, so the second thrower sees what to beat */
      function bullUp(){
        const dist = [];
        const one = i => {
          turn = i; visit = []; board();
          arena("event", "turn", { name: pl[i].name, cpu: false });
          chy.textContent = T("Bull-up · ", "Bull-up · ") + pl[i].name; chy.className = "m-chy show";
          locked = { m: 2, n: 25 }; aim = D.board.target(locked).slice();
          $("#hint").textContent = T("Closest to the bull throws first. Hold anywhere, let go when the ring turns gold.", "Wie het dichtst bij de bull zit, begint. Houd je vinger op het bord, laat los als de ring goud wordt.");
          freeDart(r => {
            dist[i] = Math.max(0.1, r1(Math.hypot(r.pt[0], r.pt[1])));
            chy.className = "m-chy"; $("#hint").textContent = "";
            later(() => dist[1] ? decide() : pass(1), 1100);
          });
        };
        const pass = i => {
          const sh = $("#sheet"); phase = "pass"; sh.hidden = false; sh.className = "sheet choose pass";
          sh.innerHTML = '<p class="lbl">' + T("Pass the phone", "Telefoon doorgeven") + '</p><p class="pass-n">' + esc(pl[i].name) + '</p><p class="lead">' + (dist[0] ? T("to throw for the bull. Beat <b>", "gooit om de bull. Versla <b>") + dist[0] + " mm</b>" : T("Dead level: throw again", "Precies gelijk: nog een keer")) + '</p><button class="go" id="ok">' + T("I’m ready", "Ik sta klaar") + "</button>";
          $("#ok").onclick = () => { sh.hidden = true; one(i); };
        };
        const decide = () => {
          /* dead level: throw again */
          if(dist[0] === dist[1]){ D.board.clear(svg); dist.length = 0; return pass(0); }
          const w = dist[0] < dist[1] ? 0 : 1, b = $("#ban");
          phase = "pass"; b.hidden = false;
          b.innerHTML = '<p class="lbl">' + T("Bull-up", "Bull-up") + '</p><p class="pass-n">' + esc(pl[w].name) + '</p><p class="lead">' + T("throws first · <b>", "gooit eerst · <b>") + dist[w] + " mm</b> v " + dist[1 - w] + ' mm</p><button class="go" id="nl">Game on</button>';
          $("#nl").onclick = () => {
            b.hidden = true; starter = turn = w; handOver = w === 0;
            caller("walkon", pl[w].name, { best: BEST, start: pref.start, opp: pl[1 - w].name });
            beginVisit();
          };
        };
        D.board.clear(svg); one(0);
      }

      /* ---------- visits ---------- */
      function beginVisit(){
        const p = pl[turn];
        visit = []; visitStart = p.left; visitPts = []; visitClean = 0; visitPerf = 0; locked = null; stopChase(); D.board.clear(svg); board();
        $("#ac").innerHTML = ""; $("#ht").className = "handtag"; $("#fin").innerHTML = ""; $("#fin").className = "m-fin";
        arena("event", "turn", { name: p.name, cpu: p.cpu });
        if(onFinish(p.left)) caller("require", p.name, p.left);
        /* after two 180s: the nine-dart watch for the whole third visit */
        if(p.nine){ chy.textContent = T("Nine-dart watch", "Negendarter in zicht"); chy.className = "m-chy show nine"; arena("event", "nine", { name: p.name }); }
        if(p.cpu){
          phase = "cpu"; $("#hint").textContent = T(L(OP.nick) + " is throwing…", L(OP.nick) + " gooit…");
          if(!p.form) p.form = H.oppLeg(OP);
          const form = H.oppVisit(OP, p.form);
          finish();
          const one = () => {
            const k = 3 - visit.length, t = H.cpuAim(p.left, k, OP), other = pl[1 - turn];
            const pressure = onFinish(other.left) || (atDouble(p.left) && p.legs + 1 >= need);
            const go = () => {
              const r = H.cpuThrow(t, OP, { form, inBoard: visitPts, pressure }), slow = !!chase;
              if(heart){ clearInterval(heart); heart = 0; }
              throwDart(p, r.raw, r, slow ? (chase.kind === "max" && !calm() ? 650 : 400) : 260, { slow }, res => { if(res === null) later(one, OP.tempo); });
            };
            chaseCheck();
            if(chase) later(go, 1100); else go();
          };
          later(one, 800);
          return;
        }
        if(mode) return ask(mode.tier());
        const other = pl[1 - turn], pass = !other.cpu && (handOver || pl.some(x => x.darts > 0));
        handOver = false;
        choose(p, pass);
      }
      /* pick the question tier (one tap), with the pass-the-phone sheet in a friend match */
      function choose(p, pass){
        if(pref.tier !== "pick" && !pass) return ask(pref.tier);
        phase = pass ? "pass" : "choose";
        $("#hint").textContent = "";
        const sh = $("#sheet"), pressure = onFinish(p.left), r = pressure && D.co.route(p.left);
        sh.hidden = false; sh.className = "sheet choose" + (pass ? " pass" : "") + (pressure ? " pressure" : "");
        sh.innerHTML = (pass ? '<p class="lbl">' + T("Pass the phone", "Telefoon doorgeven") + '</p><p class="pass-n">' + esc(p.name) + '</p><p class="lead">' + T("to the oche, needs <b>", "aan de oche, nog <b>") + p.left + "</b></p>"
            : '<p class="lbl">' + esc(p.name) + T(", pick your question · needs ", ", kies je vraag · nog ") + p.left + "</p>") +
          (pressure ? '<div class="pq"><span>' + T("On a finish", "Op een finish") + "</span><b>" + p.left + "</b><em>" + r.map(D.co.label).join(" › ") + "</em></div>" : "") +
          (pref.tier === "pick" ? (pass ? '<p class="lbl tq">' + T("Pick your question", "Kies je vraag") + "</p>" : "") + '<div class="tiers">' + H.TIERS.map(t => '<button data-t="' + t + '" class="tier t-' + t + (t === p.tier ? " last" : "") + '"><b>' + L(TIER[t].n) + "</b><small>" + L(TIER[t].say) + "</small></button>").join("") + "</div>"
            : '<button class="go" id="ok">' + T("I’m ready", "Ik sta klaar") + "</button>");
        sh.querySelectorAll(".tiers button").forEach(b => b.onclick = () => {
          const t = b.dataset.t; p.tier = t; pref.last[p.idx] = t; savePref(); D.sfx.tick(); ask(t);
        });
        const ok = sh.querySelector("#ok"); if(ok) ok.onclick = () => ask(pref.tier);
      }
      function ask(tier){
        const p = pl[turn], pressure = onFinish(p.left), r = pressure && D.co.route(p.left);
        let q = mode ? mode.question() : D.qs.pick("alles", tier, 1, "darts")[0];
        if(!q) q = D.qs.pick("alles", "mix", 1, "darts")[0];
        phase = "question";
        $("#hint").textContent = "";
        if(pressure) p.pq++;
        const sh = $("#sheet");
        sh.hidden = false; sh.className = "sheet" + (pressure ? " pressure" : "");
        sh.innerHTML = '<div class="clock"><i id="qbar"></i></div>' +
          (pressure ? '<div class="pq"><span>' + T("Pressure question", "Drukvraag") + "</span><b>" + p.left + "</b><em>" + r.map(D.co.label).join(" › ") + "</em></div>" : "") +
          '<p class="lbl"><i class="tb t-' + tier + '">' + L(TIER[tier].n) + "</i>" + esc(p.name) + (pressure ? T(", on a finish", ", op een finish") + (p.missD ? T(": a right answer calms the nerves", ": goed antwoord kalmeert de zenuwen") : "") : T(" · needs ", " · nog ") + p.left) + '</p><p class="q">' + esc(q.q) + '</p><div class="answers">' +
          q.opts.map((o, k) => '<button data-k="' + k + '"><i>' + "ABCD"[k] + "</i><span>" + esc(o) + "</span></button>").join("") + '</div><div class="verdict-h" id="vh"></div>';
        const bar = $("#qbar");
        requestAnimationFrame(() => requestAnimationFrame(() => { if(!bar.dataset.done){ bar.style.transition = "transform " + QTIME + "s linear"; bar.style.transform = "scaleX(0)"; } }));
        let done = false;
        const tm = later(() => answer(-1), QTIME * 1000);
        const answer = k => {
          if(done) return; done = true; clearTimeout(tm); timers.delete(tm);
          /* freeze the clock where it is: read the running value before stopping the transition */
          const now = getComputedStyle(bar).transform;
          bar.dataset.done = "1"; bar.style.transition = "none"; bar.style.transform = now;
          const pick = k >= 0 ? q.opts[k] : null;
          const ans = pick === q.a ? 0 : pick == null ? 3 : Math.min(3, 1 + Math.max(0, q.o.indexOf(pick)));
          grade = H.gradeFor(tier, ans);
          bar.parentNode.classList.add(ans === 0 ? "ok" : "no");
          p.qAll++; p.right = ans === 0;
          const calmed = pressure && ans === 0 && p.missD > 0;
          if(ans === 0){ p.qRight++; if(pressure){ p.pqRight++; p.missD = 0; } }
          /* momentum: a close or off answer costs a pip, a wrong or late one wipes it */
          if(ans === 3) p.mom = 0; else if(ans > 0) p.mom = Math.max(0, p.mom - 1);
          sh.querySelectorAll(".answers button").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.a) b.classList.add("right"); else if(j === k) b.classList.add("wrong", "g" + Math.min(3, ans)); });
          const Hd = H.HANDS[grade];
          const say = tier === "hard" && ans > 0 ? T("A hard one missed: the yips.", "Een moeilijke gemist: bibberen.") : tier === "easy" && ans === 0 ? T("Right, but an easy one: a slight tremble.", "Goed, maar een makkelijke: licht trillend.") : L(Hd.say);
          $("#vh").innerHTML = '<b class="h' + grade + '">' + L(Hd.name) + "</b><span>" + (pick == null ? T("Too late. ", "Te laat. ") : "") + say + (grade === 3 ? T(" A PERFECT shakes it off.", " Een PERFECT schudt het af.") : "") + (calmed ? T(" The nerves are gone.", " De zenuwen zijn weg.") : "") + (ans ? T(" It was: ", " Goed was: ") + esc(q.a) + "." : "") + "</span>";
          if(ans === 0){ D.sfx.good(); buzz(10); } else { D.sfx.bad(); buzz([30, 40, 30]); }
          later(() => throwPhase(), ans === 0 ? 1100 : 1700);
        };
        sh.querySelectorAll(".answers button").forEach(b => b.onclick = () => answer(+b.dataset.k));
      }
      function throwPhase(){
        $("#sheet").hidden = true;
        ph = Math.random() * 6.28; t0 = performance.now();
        phase = "throw"; tag(); chips(); hint(); finish(); chaseCheck();
      }
      function endVisit(p, how){
        phase = "after"; $("#ac").innerHTML = ""; finish();
        /* no stale texts under the stings */
        $("#hint").textContent = ""; $("#ht").className = "handtag";
        const wasChase = chase && chase.kind === "max";
        if(heart){ clearInterval(heart); heart = 0; }
        chy.className = "m-chy";
        const total = how === "bust" ? 0 : visitStart - p.left;
        if(how === "bust") p.left = visitStart;
        p.scored += total; p.dDone += visit.length; p.last = how === "bust" ? 0 : total;
        if(total === 180) p.n180++; else if(total >= 140) p.n140++;
        /* momentum: a right answer plus two clean releases is a pip; three = on fire */
        if(!p.cpu && p.right && visit.length && visitPerf === visit.length) p.pv++;
        if(!p.cpu && p.right && visitClean >= 2){
          const was = p.mom; p.mom = Math.min(3, p.mom + 1);
          if(p.mom === 3 && was < 3) arena("event", "fire", { name: p.name });
        }
        board();
        arena("event", "visit", { total, name: p.name });
        caller("visit", p.name, total, { cpu: p.cpu, bust: how === "bust", left: p.left });
        /* the visit total, over the lower part of the board (not over the treble you threw at) */
        const v = $("#vis"), br = svg.getBoundingClientRect();
        if(br.height) v.style.top = Math.round(br.top + br.height * 0.74) + "px";
        v.className = "visit show" + (total === 180 ? " max" : how === "bust" ? " bust" : "");
        v.innerHTML = how === "bust" ? "<b>Bust</b>" : "<b>" + total + "</b>" + (total === 180 ? "<span>One hundred and eighty!</span>" : how === "out" ? "<span>Game shot!</span>" : "");
        later(() => { v.className = "visit"; }, 1300);
        if(wasChase){ if(total === 180) unzoom(900); else { D.sfx.aww(); arena("event", "aww", { name: p.name }); unzoom(150); } }
        chase = null;
        if(total === 180){ caller("moment", "180", { name: p.name, cpu: p.cpu }); arena("event", "180", { name: p.name }); buzz([30, 60, 30, 60, 120]); }
        else if(how === "bust"){ p.busts++; caller("moment", "bust", { name: p.name, cpu: p.cpu }); arena("event", "bust", { name: p.name }); buzz(80); }
        /* two 180s to open a 501 leg: the nine-dart watch */
        if(p.start === 501 && how === "done" && p.legDarts === 6 && p.left === 141){ p.nine = true; caller("moment", "nine", { name: p.name, cpu: p.cpu }); }
        else if(p.legDarts > 6) p.nine = false;
        const more = !mode || mode.visit(p, how, visit.length);
        if(how === "out"){
          const match = p.legs + 1 >= need;
          p.hiCo = Math.max(p.hiCo, visitStart); p.legs++;
          p.legWon.push(p.legDarts); p.checkouts.push([visitStart, D.co.label(visit[visit.length - 1])]);
          caller("moment", "gameshot", { name: p.name, score: visitStart, leg, match });
          if(p.start === 501 && p.legDarts === 9) caller("moment", "ninedarter", { name: p.name, cpu: p.cpu });
          buzz([20, 40, 20, 40, 200]);
          arena("event", "checkout", { score: visitStart, name: p.name });
          if(!mode) arena("event", "leg", { name: p.name, legs: [pl[0].legs, pl[1].legs] });
          return later(() => legOver(p), 1500);
        }
        if(!more) return later(() => end(p), 1500);
        later(() => { turn = mode ? 0 : 1 - turn; beginVisit(); }, p.cpu ? 1500 : 1700);
      }
      function legOver(w){
        if(w.legs >= need) return end(w);
        const ban = $("#ban"); ban.hidden = false;
        ban.innerHTML = '<p class="lbl">Leg ' + leg + '</p><p class="pass-n">' + esc(w.name) + '</p><p class="lead">' + T("checks out. Legs <b>", "gooit hem uit. Stand <b>") + pl[0].legs + "–" + pl[1].legs + '</b></p><button class="go" id="nl">' + T("Next leg", "Volgende leg") + "</button>";
        $("#nl").onclick = () => {
          ban.hidden = true; leg++; starter = 1 - starter; turn = starter;
          pl.forEach(p => { p.left = p.start; p.last = null; p.legDarts = 0; p.missD = 0; p.mom = 0; p.form = null; p.nine = false; });
          beginVisit();
        };
      }
      function end(w){
        stopAll(); stopChase(); phase = "over";
        if(mode){ arena("unmount"); return mode.end(w); }
        arena("event", "match", { name: w.name }); arena("unmount");
        const human = pl.filter(p => !p.cpu), pbs = [];
        human.forEach(p => {
          if(p.darts < 9) return;
          const old = D.store.rec(p.idx, "m501"), v = r1(avg(p));
          if(D.store.result("m501", v, p.idx)) pbs.push({ name: p.name, old: old && old.best, v });
        });
        const res = call("progress", "record", [{ mode: "501", start: pref.start, best: BEST, opponent: OP ? { id: OP.id, name: OP.name, nick: OP.nick[0], level: ["easy", "medium", "hard", "expert", "expert"][OP.lvl] } : null, when: Date.now(),
          players: pl.map(p => ({ idx: p.idx, name: p.name, cpu: p.cpu, start: p.start, won: p === w, legs: p.legs, darts: p.darts, scored: p.scored, avg: r1(avg(p)), n180: p.n180, n140: p.n140, hiCo: p.hiCo,
            coHits: p.legs, coDarts: p.atD, qRight: p.qRight, qAll: p.qAll, pressRight: p.pqRight, pressAll: p.pq, perfect: p.pv, perfectReleases: p.perfect, good: p.good, hits: p.hits,
            legDarts: p.legWon, checkouts: p.checkouts, robin: p.robin, busts: p.busts, bounce: p.bo, offDart: p.offDart })) }]);
        const won = !w.cpu && w.idx === D.store.me;
        const row = (l, f) => "<tr><th>" + l + "</th>" + pl.map(p => "<td>" + f(p) + "</td>").join("") + "</tr>";
        el.innerHTML = '<div class="g-top"><a class="back" href="#spelen">‹ Menu</a><b>' + T("Result", "Uitslag") + '</b><span></span></div>' +
          '<div class="g-body end m-end"><p class="lbl">' + lenOf(BEST) + " · " + pref.start + (OP ? " · " + esc(L(OP.nick)) : "") + '</p>' +
          '<p class="verdict">' + esc(w.name) + (w.cpu ? T(" wins. Rematch?", " wint. Revanche?") : T(" wins!", " wint!")) + '</p><p class="chalk huge">' + pl[0].legs + "–" + pl[1].legs + "</p>" +
          pbs.map(b => '<div class="m-pb"><span>' + T("New personal best", "Nieuw persoonlijk record") + "</span><b>" + esc(b.name) + "</b><em>" + (b.old ? b.old.toFixed(1) + " → " : "") + b.v.toFixed(1) + "</em></div>").join("") +
          '<div class="prog-slot"></div>' +
          '<div class="row m-act"><button class="go" id="again">' + T("Rematch", "Revanche") + '</button><a class="go ghost" href="#spelen">Menu</a></div>' +
          '<div class="chalkboard"><table class="st"><thead><tr><th></th>' + pl.map(p => "<th>" + esc(p.name) + "</th>").join("") + "</tr></thead><tbody>" +
          (pl[0].start !== pl[1].start ? row(T("Started on", "Begon op"), p => p.start) : "") +
          row(T("Average", "Gemiddelde"), p => p.darts ? avg(p).toFixed(1) : "–") + row(T("Darts", "Pijlen"), p => p.darts) + row("180s", p => p.n180) + row("140+", p => p.n140) + row(T("Highest checkout", "Hoogste finish"), p => p.hiCo || "–") +
          row(T("Checkout %<small>legs / darts at a double</small>", "Finish %<small>legs / pijlen op een dubbel</small>"), p => p.atD ? Math.round(p.legs / p.atD * 100) + "%<small> " + p.legs + "/" + p.atD + "</small>" : "–") +
          row(T("Questions right", "Vragen goed"), p => p.cpu ? "–" : p.qRight + "/" + p.qAll) +
          (human.some(p => p.pq) ? row(T("Pressure questions", "Drukvragen"), p => p.cpu ? "–" : p.pqRight + "/" + p.pq) : "") +
          row(T("Clean releases<small>PERFECT / GOOD</small>", "Schone worpen<small>PERFECT / GOOD</small>"), p => p.cpu ? "–" : p.perfect + "<small> / " + p.good + "</small>") +
          (pl.some(p => p.offDart) ? row(T("Off a dart", "Via een pijl"), p => p.offDart) : "") +
          (pl.some(p => p.robin) ? row("Robin Hoods", p => p.robin) : "") +
          (pl.some(p => p.bo) ? row(T("Bounce-outs", "Uitstuiteraars"), p => p.bo) : "") +
          "</tbody></table></div></div>";
        /* the XP bar fills once the "wins the match" sting has cleared, not under it */
        call("progress", "render", [el.querySelector(".prog-slot"), res, 2600]);
        el.querySelector("#again").onclick = start;
        if(pbs.length){ D.sfx.good(); setTimeout(() => alive && call("fx", "party", []), 600); }
        else if(won) D.sfx.good();
      }

      /* for tests and tuning: a read-only peek at the throw */
      D.matchDbg = { get phase(){ return phase; }, get grade(){ return grade; }, get turn(){ return turn; }, get free(){ return !!free; }, get best(){ return BEST; }, get hold(){ return hold && { t0: hold.t0, id: hold.id, first: hold.first }; }, get lastRelease(){ return lastRel; },
        get hand(){ return H.mods(grade, stOf(pl[turn])); }, get st(){ return stOf(pl[turn]); }, get chase(){ return chase && chase.kind; },
        get players(){ return pl.map(p => ({ name: p.name, start: p.start, darts: p.darts, left: p.left, mom: p.mom, missD: p.missD, perfect: p.perfect, good: p.good, tier: p.tier })); },
        get visitPts(){ return visitPts.map(v => v.pt); }, get aim(){ return aim.slice(); } };

      /* a mode goes straight to the first visit */
      if(mode){ board(); cancelAnimationFrame(raf); loop(); return beginVisit(); }
      /* walk-on, then the first visit */
      const ban = $("#ban"); ban.hidden = false; ban.className = "banner walk";
      const low = pl[0].start < pl[1].start ? pl[0] : pl[1].start < pl[0].start ? pl[1] : null;
      ban.innerHTML = '<p class="lbl">' + (BEST > 1 ? "Best of " + BEST + " legs" : T("One leg", "Eén leg")) + " · " + pref.start + '</p><p class="pass-n">' + esc(pl[0].name) + '</p><p class="vs">vs</p><p class="pass-n">' + esc(pl[1].name) + "</p>" +
        (OP ? '<p class="w-nick">“' + esc(L(OP.nick)) + "” · " + OP.flag + " · " + T("avg ~", "gem ~") + OP.avg + '</p><p class="w-tell">' + esc(L(OP.tell)) + "</p>" : "") +
        (low ? '<p class="w-tell">' + esc(low.name) + T(" starts on ", " begint op ") + low.start + "</p>" : "") +
        '<button class="go" id="gl">Game on</button>';
      arena("event", "walkon", { a: pl[0].name, b: pl[1].name, nick: OP ? L(OP.nick) : "" });
      /* against a friend the bull-up decides who throws first, so the caller waits for it */
      const walkOn = () => { if(OP) caller("walkon", pl[0].name, { best: BEST, start: pref.start, opp: OP.nick[0] }); };
      walkOn();
      /* the caller's voice: off for a new player, one tap here turns it on and you hear it at once */
      const vo = document.createElement("button"), hears = () => D.store.sound && D.store.voice;
      const voMark = () => { vo.className = "w-voice" + (hears() ? " on" : ""); vo.setAttribute("aria-pressed", String(!!hears())); vo.textContent = hears() ? T("Caller’s voice: on", "Stem van de caller: aan") : T("Caller’s voice: off", "Stem van de caller: uit"); };
      vo.onclick = () => {
        const v = !hears();
        D.store.setVoice(v); if(v) D.store.setSound(true);
        voMark(); D.sfx.tick();
        if(v){ D.caller.unlock(); walkOn(); } else caller("stop");
      };
      voMark(); $("#gl").before(vo);
      board(); cancelAnimationFrame(raf); loop();
      $("#gl").onclick = () => { ban.hidden = true; ban.className = "banner"; if(!OP) bullUp(); else if(coach) warmUp(); else beginVisit(); };
    }

    if(mode) start(); else if(how === "quick") quick(); else setup();
    return () => { alive = false; stopAll(); stopChase(); caller("stop"); arena("unmount"); };
  };
  D.match.quick = quickCard;
})(window.DART);
