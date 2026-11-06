/* Frame: a quiz-driven frame of snooker, the table's answer to the 501 Match.
   Before every shot you pick a question (Easy / Medium / Hard); the answer sets the cue arm
   for that shot (cue.js): right = a steady cue, close or off = a wobble, wrong = miscue risk,
   a Hard one right = an Ice cue. Then: touch the table to aim (the cue ball points at your
   finger), fine-tune with the dial, pick screw / stun / follow, and hold the cue strip at the
   bottom: how far along sets the power, and the aim sways and breathes like the darts hand.
   Let go when the ring around the cue ball tightens to gold for a PERFECT strike.
   Six reds (5–8 minutes) or fifteen. Against a computer character (cue.js OPP) or a friend
   on the same phone. The referee calls the break, fouls and re-spotted balls (D.caller).
   Nerves on the last pink and black (a right answer calms them), In the zone in a long break,
   the maximum and century chase. Stats go to D.progress.recordFrame. */
(function(D){
  const T = D.T, L = a => T(a[0], a[1]), esc = s => D.esc ? D.esc(s) : String(s);
  const call = (o, fn, a) => { try { const x = D[o]; if(x && typeof x[fn] === "function") return x[fn](...a); } catch(e){ console.warn(o, fn, e); } };
  const sfx = (fn, ...a) => call("sfx", fn, a);
  const buzz = p => call("fx", "buzz", [p]);
  const calm = () => !!call("fx", "calm", []);
  const P = D.phys, Rl = D.rules, Q = D.cue, TB = D.table;
  const deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180;

  const PKEY = "dart.framePref";
  const pref = (() => {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; } catch(e){}
    p = Object.assign({ vs: "cpu", opp: "agnes", friend: -1, reds: 6, best: 1, tier: "pick", clock: 15, last: {} }, p);
    if(!Q.OPP.some(o => o.id === p.opp)) p.opp = "agnes";
    if(![6, 15].includes(p.reds)) p.reds = 6;
    if(![1, 3].includes(p.best)) p.best = 1;
    if(!["pick", "easy", "medium", "hard"].includes(p.tier)) p.tier = "pick";
    if(![15, 8].includes(p.clock)) p.clock = 15;
    if(!p.last || typeof p.last !== "object") p.last = {};
    return p;
  })();
  const savePref = () => { try { localStorage.setItem(PKEY, JSON.stringify(pref)); } catch(e){} };
  const TIER = {
    easy: { n: ["Easy", "Makkelijk"], say: ["right = slight wobble", "goed = licht wiebelend"] },
    medium: { n: ["Medium", "Gemiddeld"], say: ["right = steady cue", "goed = vaste keu"] },
    hard: { n: ["Hard", "Moeilijk"], say: ["right = ice · wrong = miscue risk", "goed = ijs · fout = miscue-kans"] }
  };
  const SPIN = [{ v: -0.8, n: ["Screw", "Trekstoot"], y: 6 }, { v: 0, n: ["Stun", "Stopstoot"], y: 0 }, { v: 0.7, n: ["Follow", "Doorloper"], y: -6 }];
  const ON_N = { red: ["a red", "een rode"], colour: ["a colour", "een kleur"], yellow: ["the yellow", "geel"], green: ["the green", "groen"], brown: ["the brown", "bruin"], blue: ["the blue", "blauw"], pink: ["the pink", "roze"], black: ["the black", "zwart"] };
  const PK_N = [["top left", "linksboven"], ["top right", "rechtsboven"], ["bottom left", "linksonder"], ["bottom right", "rechtsonder"], ["left middle", "middenzak links"], ["right middle", "middenzak rechts"]];
  const blank = () => ({ pots: 0, att: 0, saf: 0, safOk: 0, fouls: 0, hb: 0, b20: 0, b50: 0, cent: 0, max: 0, clr: 0, q: [0, 0], pq: [0, 0], perf: 0, ice: 0, pk: [0, 0, 0, 0, 0, 0], lp: 0, pts: 0, rbw: 0, comeback: 0, frames: 0, played: 0 });

  D.frame = function(el){
    let alive = true, raf = 0, unbind = null;
    const timers = new Set();
    const later = (f, ms) => { const t = setTimeout(() => { timers.delete(t); if(alive) f(); }, ms); timers.add(t); return t; };

    /* ---------- setup ---------- */
    function setup(){
      const Pl = D.store.players, me = D.store.me;
      if(pref.friend < 0 || pref.friend === me || !Pl[pref.friend]) pref.friend = Pl.findIndex((p, i) => i !== me);
      if(Pl.length < 2) pref.vs = "cpu";
      el.innerHTML = '<div class="g-top"><a class="back" href="#spelen-tafel">‹ Menu</a><b>Frame</b><span></span></div>' +
        '<div class="g-body fr-setup"><h1 class="g-h">Frame</h1><p class="lead">' + T("Every shot starts with a question you pick: <b>Easy, Medium or Hard</b>. The answer sets your cue arm (a Hard one right = an ice cue, wrong = miscue risk). Touch the table to aim, then hold the cue strip: the aim sways. Let go when the ring turns gold for a <b>PERFECT</b> strike.",
          "Elke stoot begint met een vraag die je kiest: <b>makkelijk, gemiddeld of moeilijk</b>. Het antwoord bepaalt je keu-arm (een moeilijke goed = een ijskoude keu, fout = kans op een miscue). Raak de tafel aan om te mikken en houd de keu-strip vast: het mikpunt wiebelt. Laat los als de ring goud wordt: <b>PERFECT</b>.") + "</p>" +
        '<h2 class="sub-h">' + T("Against", "Tegen") + '</h2><div class="chips" id="vs"><button data-v="cpu">' + T("A player<small>10 characters</small>", "Een speler<small>10 tegenstanders</small>") + '</button><button data-v="friend">' + T("A friend<small>pass the phone</small>", "Een vriend<small>telefoon doorgeven</small>") + "</button></div>" +
        '<div id="vsx"></div>' +
        '<h2 class="sub-h">' + T("Reds", "Rode ballen") + '</h2><div class="chips" id="reds"><button data-v="6">' + T("Six reds<small>5–8 minutes · max 75</small>", "Zes rode<small>5–8 minuten · max 75</small>") + '</button><button data-v="15">' + T("Fifteen reds<small>the full frame · 147</small>", "Vijftien rode<small>het echte frame · 147</small>") + "</button></div>" +
        '<h2 class="sub-h">' + T("Length", "Lengte") + '</h2><div class="chips" id="best"><button data-v="1">' + T("One frame", "Eén frame") + '</button><button data-v="3">Best of 3<small>' + T("first to 2", "eerst naar 2") + "</small></button></div>" +
        '<h2 class="sub-h">' + T("Questions", "Vragen") + '</h2><div class="chips" id="tier"><button data-v="pick">' + T("Pick each shot", "Kies per stoot") + "<small>" + T("Easy · Medium · Hard", "makkelijk · gemiddeld · moeilijk") + "</small></button>" +
          ["easy", "medium", "hard"].map(t => '<button data-v="' + t + '">' + L(TIER[t].n) + "<small>" + L(TIER[t].say) + "</small></button>").join("") + "</div>" +
        '<h2 class="sub-h">' + T("Question clock", "Vraagklok") + '</h2><div class="chips" id="clock"><button data-v="15">15 s</button><button data-v="8">8 s<small>' + T("quick fire", "snelvuur") + "</small></button></div>" +
        '<button class="go" id="go">' + T("Break off", "Afstoten") + '</button><p class="count" id="ld"></p></div>';
      if(Pl.length < 2) el.querySelector('#vs button[data-v="friend"]').remove();
      const mark = () => {
        [["vs", pref.vs], ["reds", pref.reds], ["best", pref.best], ["tier", pref.tier], ["clock", pref.clock]].forEach(([id, v]) =>
          el.querySelectorAll("#" + id + " button").forEach(b => b.classList.toggle("on", b.dataset.v === String(v))));
        const x = el.querySelector("#vsx");
        if(pref.vs === "cpu"){
          x.innerHTML = '<h2 class="sub-h">' + T("Opponent", "Tegenstander") + '</h2><div class="opps" id="opp">' + Q.LEVELS.map((lv, i) =>
            '<p class="opp-lv">' + L(lv) + '</p><div class="opp-g">' + Q.OPP.filter(o => o.lvl === i).map(o =>
              '<button data-v="' + o.id + '" class="opp' + (o.id === pref.opp ? " on" : "") + '"><span class="o-n"><b>' + esc(L(o.nick)) + "</b><i>" + o.flag + "</i></span>" +
              "<small>" + esc(o.name) + "</small><em>" + esc(L(o.tell)) + "</em></button>").join("") + "</div>").join("") + "</div>";
          x.querySelectorAll("#opp button").forEach(b => b.onclick = () => { pref.opp = b.dataset.v; sfx("tick"); mark(); });
        } else {
          x.innerHTML = '<h2 class="sub-h">' + T("Who?", "Wie?") + "</h2>" + '<div class="chips" id="fr">' + Pl.map((p, i) => i === me ? "" : '<button data-v="' + i + '"' + (i === pref.friend ? ' class="on"' : "") + ">" + esc(p) + "</button>").join("") + "</div>";
          x.querySelectorAll("#fr button").forEach(b => b.onclick = () => { pref.friend = +b.dataset.v; mark(); });
        }
      };
      [["vs", "vs", String], ["reds", "reds", Number], ["best", "best", Number], ["tier", "tier", String], ["clock", "clock", Number]].forEach(([id, k, f]) =>
        el.querySelectorAll("#" + id + " button").forEach(b => b.onclick = () => { pref[k] = f(b.dataset.v); mark(); }));
      mark();
      D.fx.stagger(el.querySelector(".g-body"), null, 0);
      const go = el.querySelector("#go");
      go.onclick = () => {
        savePref();
        go.disabled = true; el.querySelector("#ld").textContent = T("Loading questions…", "Vragen laden…");
        if(unbind){ unbind(); unbind = null; }
        D.qs.load().then(() => { if(alive) unbind = start(); }).catch(() => { go.disabled = false; el.querySelector("#ld").textContent = T("The questions won’t load. Try again in a moment.", "De vragen laden niet. Probeer het zo nog eens."); });
      };
    }

    /* ---------- the match ---------- */
    function start(){
      const Pl = D.store.players, me = D.store.me, OP = pref.vs === "cpu" ? Q.opp(pref.opp) : null;
      const pl = [
        { name: Pl[me], idx: me, cpu: false, s: blank(), frames: 0, tier: pref.last[me] || "medium" },
        OP ? { name: L(OP.nick), full: OP.name, idx: -1, cpu: true, prof: OP, s: blank(), frames: 0 }
           : { name: Pl[pref.friend], idx: pref.friend, cpu: false, s: blank(), frames: 0, tier: pref.last[pref.friend] || "medium" }
      ];
      const need = Math.ceil(pref.best / 2), QTIME = pref.clock, REDS = pref.reds;
      let world, st, frameNo = 0, phase = "idle", inHand = true, aim = -Math.PI / 2, spin = 1, grade = 0, mom = 0, nerves = 0, ph = 0;
      let potsInBreak = 0, chase = false, pressure = false, lastShooter = -1, safePending = [false, false], needSnk = [false, false];
      let draw = null, roll = null, shownAim = aim, stick = { on: false, pull: 0, a: aim, fade: 1 }, tq = null, startPos = null;

      el.innerHTML = '<div class="fr">' +
        '<div class="fr-hud"><a class="back fr-back" href="#spelen-tafel" aria-label="Stop">‹</a>' +
          [0, 1].map(i => '<div class="fr-p p' + i + '" id="p' + i + '"><span class="fr-nm">' + (pl[i].cpu ? '<i class="av cpu">' + esc(OP.flag.slice(0, 2)) + "</i>" : D.av(pl[i].idx)) + "<b>" + esc(pl[i].name) + '</b></span><b class="chalk fr-sc" id="sc' + i + '">0</b><small class="fr-brk" id="bk' + i + '"></small><span class="fr-fw" id="fw' + i + '"></span></div>').join("") +
          '<div class="fr-mid"><span class="fr-on" id="on"></span><span class="fr-rem" id="rem"></span><span class="fr-flag" id="flag"></span></div>' +
        "</div>" +
        '<div class="fr-stage" id="stage"><div class="fr-tw" id="tw"></div><div class="fr-loupe" id="lp" hidden></div><div class="fr-chy" id="chy"></div><div class="fr-pop" id="pop"></div></div>' +
        '<div class="fr-ctl" id="ctl">' +
          '<div class="fr-row"><span class="handtag fr-tag" id="tag"></span><span class="fr-zone" id="zone"></span>' +
            '<div class="fr-spin" id="spin" role="radiogroup" aria-label="' + T("Spin", "Effect") + '">' + SPIN.map((s, i) => '<button data-i="' + i + '" role="radio" title="' + L(s.n) + '"><svg viewBox="-12 -12 24 24"><circle r="10.5"/><circle class="tip" cy="' + s.y + '" r="2.6"/></svg><small>' + L(s.n) + "</small></button>").join("") + "</div></div>" +
          '<div class="fr-row fr-fine"><button class="fr-nudge" data-d="-1" aria-label="' + T("Aim left", "Mik links") + '">‹</button><div class="fr-dial" id="dial"><i></i><span>' + T("fine aim", "fijn mikken") + '</span></div><button class="fr-nudge" data-d="1" aria-label="' + T("Aim right", "Mik rechts") + '">›</button></div>' +
          '<div class="fr-cue" id="cue"><i class="fr-pw" id="pw"></i><i class="fr-last" id="lastpw"></i><span id="cuel">' + T("Hold here: further = harder · let go to strike", "Houd vast: verder = harder · loslaten = stoten") + "</span></div>" +
          '<p class="fr-hint" id="hint"></p><button class="fr-concede" id="concede" hidden>' + T("Concede the frame", "Frame opgeven") + "</button>" +
        "</div><div class=\"sheet\" id=\"sheet\" hidden></div></div>";
      const $ = s => el.querySelector(s);
      let svg, lsvg;

      /* ---------- the table on screen ---------- */
      function newFrame(){
        world = P.rack(REDS);
        st = Rl.create(REDS, frameNo % 2);
        frameNo++;
        inHand = true; potsInBreak = 0; chase = false; mom = 0; nerves = 0; safePending = [false, false]; needSnk = [false, false];
        $("#tw").innerHTML = TB.svg({ cls: "fr-table", balls: world.balls });
        $("#lp").innerHTML = TB.svg({ cls: "fr-ltable", balls: world.balls, lamp: false, mini: true });
        svg = $("#tw svg"); lsvg = $("#lp svg");
        svg.querySelector(".fx").innerHTML = '<g class="stick"><polygon class="shaft"/><polygon class="ferrule"/></g><circle class="ring" r="40"/>';
        bindTable(); size(); hud();
        placeDefault();
        call("caller", "line", [T("Frame " + frameNo + ". " + pl[st.turn].name + " to break off.", "Frame " + frameNo + ". " + pl[st.turn].name + " to break off."), { pri: 2, rate: 0.95, pitch: 0.95, key: "frame" }]);
        say(T("Frame ", "Frame ") + frameNo + " · " + esc(pl[st.turn].name) + T(" breaks off", " stoot af"), 2200);
        later(turn, 900);
      }
      function size(){
        const stage = $("#stage"), ctl = $("#ctl"); if(!svg) return;
        const top = stage.getBoundingClientRect().top + window.scrollY;
        const avH = Math.max(320, window.innerHeight - top - ctl.offsetHeight - 14), avW = stage.clientWidth;
        const ar = TB.VB[2] / TB.VB[3];
        let h = avH, w = h * ar; if(w > avW){ w = avW; h = w / ar; }
        svg.style.width = w + "px"; svg.style.height = h + "px";
      }
      const onResize = () => size();
      window.addEventListener("resize", onResize);
      const ballEl = id => svg.querySelector('.bl[data-id="' + id + '"]');
      function drawBalls(pos){
        world.balls.forEach((b, i) => {
          const p = pos ? pos[i] : (b.on ? [b.x, b.y] : null);
          TB.put(svg, b.id, p ? p[0] : null, p ? p[1] : null);
          TB.put(lsvg, b.id, p ? p[0] : null, p ? p[1] : null);
        });
      }
      function placeDefault(){
        const c = P.ball(world, "cue");
        if(!c.on || !P.inD(c.x, c.y) || !P.free(world, c.x, c.y, "cue")){
          for(const f of [0.45, 0.25, 0.65, 0.1, 0.85]){ const x = P.CX - P.DR * f, y = P.BAULK + 40; if(P.free(world, x, y, "cue")){ Object.assign(c, { x, y, on: true, vx: 0, vy: 0 }); break; } }
        }
        c.on = true;
        drawBalls();
      }
      /* ---------- the HUD ---------- */
      function hud(){
        [0, 1].forEach(i => {
          $("#p" + i).classList.toggle("on", st.turn === i && !st.over);
          $("#sc" + i).textContent = st.score[i];
          $("#bk" + i).textContent = st.turn === i && st.brk ? T("Break ", "Break ") + st.brk : st.hb[i] ? T("High ", "Hoogste ") + st.hb[i] : "";
          $("#fw" + i).innerHTML = pref.best > 1 ? Array.from({ length: need }, (_, k) => "<i" + (k < pl[i].frames ? ' class="w"' : "") + "></i>").join("") : "";
        });
        const o = Rl.on(st);
        $("#on").innerHTML = st.over ? "" : T("On ", "Op ") + (o === "colour" ? '<span class="cols">' + P.COLOURS.map(c => TB.chip(c)).join("") + "</span>" : TB.chip(o === "red" ? "r0" : o)) + "<b>" + L(ON_N[o]) + "</b>";
        $("#rem").textContent = (st.redsLeft ? T("Reds ", "Rood ") + st.redsLeft + " · " : "") + Rl.remaining(st) + T(" left", " over");
        const i = st.turn, snk = !st.over && Rl.needsSnookers(st, i), fb = !st.over && !snk && Rl.frameBall(st);
        $("#flag").className = "fr-flag" + (snk ? " snk" : fb ? " fb" : chase && st.brk >= 8 ? " max" : "");
        $("#flag").textContent = snk ? T("Snookers required", "Snookers nodig") : fb ? T("Frame ball", "Frame ball") :
          chase && st.brk >= (REDS === 6 ? 24 : 40) ? (REDS === 6 ? T("Maximum on: 75", "Maximum mogelijk: 75") : T("147 on", "147 mogelijk")) :
          REDS === 15 && st.brk >= 60 && st.brk < 100 && st.brk + Rl.remaining(st) >= 100 ? T("Century on", "Century mogelijk") : "";
        const human = !pl[i].cpu && !st.over;
        $("#concede").hidden = !(human && snk && phase !== "roll");
      }
      let chyT = 0;
      function say(html, ms, cls){
        const c = $("#chy"); c.innerHTML = html; c.className = "fr-chy show" + (cls ? " " + cls : "");
        clearTimeout(chyT); chyT = setTimeout(() => { if(alive) c.className = "fr-chy"; }, ms || 1800);
      }
      function pop(text, cls){
        const p = $("#pop"); p.innerHTML = text; p.className = "fr-pop"; void p.offsetWidth; p.className = "fr-pop show" + (cls ? " " + cls : "");
      }
      const ref = (text, o) => call("caller", "line", [text, Object.assign({ pri: 0, rate: 0.95, pitch: 0.98 }, o || {})]);
      const words = n => call("caller", "words", [n]) || String(n);

      /* ---------- the turn ---------- */
      function turn(){
        if(!alive || st.over) return;
        const i = st.turn, p = pl[i];
        hud();
        if(p.cpu) return cpuTurn();
        const other = pl[1 - i];
        if(!other.cpu && lastShooter !== -1 && lastShooter !== i){ lastShooter = i; return passPhone(p); }
        lastShooter = i;
        choose(p);
      }
      function passPhone(p){
        phase = "pass";
        const sh = $("#sheet"); sh.hidden = false; sh.className = "sheet pass";
        sh.innerHTML = '<p class="lbl">' + T("Pass the phone", "Telefoon doorgeven") + '</p><p class="pass-n">' + esc(p.name) + '</p><p class="lead">' + T("to the table · on ", "aan tafel · op ") + L(ON_N[Rl.on(st)]) + '</p><button class="go" id="ok">' + T("I’m at the table", "Ik sta aan tafel") + "</button>";
        sh.querySelector("#ok").onclick = () => { sfx("tick"); choose(p); };
      }
      function isPressure(){
        const o = Rl.on(st), i = st.turn;
        const live = Math.abs(Rl.behind(st, i)) <= Rl.remaining(st);
        return st.rb || (live && (o === "pink" || o === "black") && st.phase === "seq") || (Rl.frameBall(st) && live) || (chase && st.brk >= (REDS === 6 ? 40 : 100));
      }
      function choose(p){
        pressure = isPressure();
        if(pref.tier !== "pick") return ask(pref.tier);
        phase = "choose";
        const sh = $("#sheet"); sh.hidden = false; sh.className = "sheet choose" + (pressure ? " pressure" : "");
        sh.innerHTML = '<p class="lbl">' + esc(p.name) + T(", pick your question · on ", ", kies je vraag · op ") + L(ON_N[Rl.on(st)]) + "</p>" +
          (pressure ? '<div class="pq"><span>' + T("Pressure", "Druk") + "</span><em>" + (st.rb ? T("Re-spotted black", "Herplaatste zwarte") : chase ? T("The maximum is on", "Het maximum is mogelijk") : T("The frame is on this", "Hier draait het frame om")) + "</em></div>" : "") +
          '<div class="tiers">' + ["easy", "medium", "hard"].map(t => '<button data-t="' + t + '" class="tier t-' + t + (t === p.tier ? " last" : "") + '"><b>' + L(TIER[t].n) + "</b><small>" + L(TIER[t].say) + "</small></button>").join("") + "</div>";
        sh.querySelectorAll(".tiers button").forEach(b => b.onclick = () => { const t = b.dataset.t; p.tier = t; pref.last[p.idx] = t; savePref(); sfx("tick"); ask(t); });
      }
      function ask(tier){
        const i = st.turn, p = pl[i];
        let q = D.qs.pick("alles", tier, 1, "snooker")[0] || D.qs.pick("alles", "mix", 1, "snooker")[0];
        if(!q){ grade = 0; return aimPhase(); }
        phase = "question";
        if(pressure) p.s.pq[1]++;
        const sh = $("#sheet"); sh.hidden = false; sh.className = "sheet" + (pressure ? " pressure" : "");
        sh.innerHTML = '<div class="clock"><i id="qbar"></i></div>' +
          '<p class="lbl"><i class="tb t-' + tier + '">' + L(TIER[tier].n) + "</i>" + esc(p.name) + (pressure ? T(" · pressure: a right answer calms the nerves", " · druk: goed antwoord kalmeert de zenuwen") : T(" · on ", " · op ") + L(ON_N[Rl.on(st)])) + '</p><p class="q">' + esc(q.q) + '</p><div class="answers">' +
          q.opts.map((o, k) => '<button data-k="' + k + '"><i>' + "ABCD"[k] + "</i><span>" + esc(o) + "</span></button>").join("") + '</div><div class="verdict-h" id="vh"></div>';
        const bar = $("#qbar");
        requestAnimationFrame(() => requestAnimationFrame(() => { if(!bar.dataset.done){ bar.style.transition = "transform " + QTIME + "s linear"; bar.style.transform = "scaleX(0)"; } }));
        let done = false;
        const tm = later(() => answer(-1), QTIME * 1000);
        const answer = k => {
          if(done) return; done = true; clearTimeout(tm); timers.delete(tm);
          const now = getComputedStyle(bar).transform; bar.dataset.done = "1"; bar.style.transition = "none"; bar.style.transform = now;
          const pick = k >= 0 ? q.opts[k] : null;
          const ans = pick === q.a ? 0 : pick == null ? 3 : Math.min(3, 1 + Math.max(0, q.o.indexOf(pick)));
          grade = D.hand.gradeFor(tier, ans);
          bar.parentNode.classList.add(ans === 0 ? "ok" : "no");
          p.s.q[1]++; if(ans === 0){ p.s.q[0]++; if(pressure) p.s.pq[0]++; }
          if(grade === 4) p.s.ice++;
          nerves = pressure && ans !== 0 ? (st.rb || Rl.on(st) === "black" ? 2 : 1) : 0;
          if(ans === 3) mom = 0; else if(ans > 0) mom = Math.max(0, mom - 1);
          sh.querySelectorAll(".answers button").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.a) b.classList.add("right"); else if(j === k) b.classList.add("wrong", "g" + Math.min(3, ans)); });
          const A = Q.ARM[grade];
          const why = tier === "hard" && ans > 0 ? T("A hard one missed: miscue risk.", "Een moeilijke gemist: kans op een miscue.") : tier === "easy" && ans === 0 ? T("Right, but an easy one: a slight wobble.", "Goed, maar een makkelijke: licht wiebelend.") : L(A.say);
          $("#vh").innerHTML = '<b class="h' + grade + '">' + L(A.name) + "</b><span>" + (pick == null ? T("Too late. ", "Te laat. ") : "") + why + (pressure && ans === 0 ? T(" Nerves under control.", " Zenuwen onder controle.") : nerves ? T(" The nerves are there…", " De zenuwen gieren…") : "") + (ans ? T(" It was: ", " Goed was: ") + esc(q.a) + "." : "") + "</span>";
          if(ans === 0){ sfx("good"); buzz(10); } else { sfx("bad"); buzz([30, 40, 30]); }
          later(aimPhase, ans === 0 ? 1100 : 1700);
        };
        sh.querySelectorAll(".answers button").forEach(b => b.onclick = () => answer(+b.dataset.k));
      }
      function aimPhase(){
        if(st.over || phase === "over" || phase === "end") return;
        $("#sheet").hidden = true;
        phase = inHand ? "place" : "aim"; ph = Math.random() * 6.28;
        /* start aimed full at the nearest ball on */
        const c = P.ball(world, "cue"), on = Q.onBalls(world, st).map(b => ({ b, d: Math.hypot(b.x - c.x, b.y - c.y) })).sort((x, y) => x.d - y.d)[0];
        if(on) aim = Math.atan2(on.b.y - c.y, on.b.x - c.x);
        tag(); spinUi(); stick.on = true; stick.fade = 1; stick.pull = 30;
        if(pressure){ svg.classList.add("hush"); say(T("The crowd falls silent", "Het publiek valt stil"), 1800, "quiet"); }
        aimHint();
        guide();
      }
      function aimHint(){
        $("#hint").textContent = phase === "place" ? T("Ball in hand: drag the cue ball in the D, or touch the table to aim.", "Bal in hand: sleep de witte in de D, of raak de tafel aan om te mikken.") : T("Touch the table to aim · the dial for the last bit", "Raak de tafel aan om te mikken · de draaiknop voor het laatste stukje");
      }
      function tag(){
        const t = $("#tag"), A = Q.ARM[grade];
        t.className = "handtag fr-tag show h" + grade; t.textContent = L(A.name);
        $("#zone").innerHTML = (mom ? '<span class="zp">' + "●".repeat(mom) + "</span>" + (mom >= 3 ? T("In the zone", "In de zone") : "") : "") + (nerves ? '<span class="nv">' + T("Nerves", "Zenuwen") + "</span>" : "");
      }
      function spinUi(){ $("#spin").querySelectorAll("button").forEach((b, i) => { b.classList.toggle("on", i === spin); b.setAttribute("aria-checked", i === spin); }); }

      /* ---------- aiming ---------- */
      function toTable(e){
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const m = svg.getScreenCTM(); if(!m) return null;
        const r = pt.matrixTransform(m.inverse()); return [r.x, r.y];
      }
      let dragKind = null;
      function bindTable(){
        svg.addEventListener("pointerdown", e => {
          if(phase === "roll" && roll){ roll.skip = true; return; }
          if(phase !== "aim" && phase !== "place") return;
          const p = toTable(e); if(!p) return;
          const c = P.ball(world, "cue");
          dragKind = phase === "place" && Math.hypot(p[0] - c.x, p[1] - c.y) < 6 * P.R ? "place" : "aim";
          svg.setPointerCapture(e.pointerId); move(p);
        });
        svg.addEventListener("pointermove", e => { if(dragKind){ const p = toTable(e); if(p) move(p); } });
        const up = () => { if(!dragKind) return; dragKind = null; $("#lp").hidden = true; };
        svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
      }
      function move(p){
        const c = P.ball(world, "cue");
        if(dragKind === "place"){
          let [x, y] = p;
          if(y < P.BAULK) y = P.BAULK;
          const d = Math.hypot(x - P.CX, y - P.BAULK); if(d > P.DR - 0.5){ x = P.CX + (x - P.CX) * (P.DR - 0.5) / d; y = P.BAULK + (y - P.BAULK) * (P.DR - 0.5) / d; }
          if(P.free(world, x, y, "cue")){ c.x = x; c.y = y; drawBalls(); }
        } else {
          if(Math.hypot(p[0] - c.x, p[1] - c.y) < 1) return;
          aim = Math.atan2(p[1] - c.y, p[0] - c.x);
          if(phase === "place"){ phase = "aim"; aimHint(); }
          $("#lp").hidden = false;
        }
        guide();
      }
      /* the guide: cue path, ghost ball, the object ball's path (gold when it's going in), the cue ball's path off it */
      function goesIn(x, y, ux, uy, skip){
        for(let i = 0; i < P.POCKETS.length; i++){
          const pk = P.POCKETS[i], dx = pk.aim[0] - x, dy = pk.aim[1] - y, along = dx * ux + dy * uy; if(along <= 0) continue;
          const off = Math.abs(dx * uy - dy * ux), cosA = -(ux * pk.n[0] + uy * pk.n[1]);
          const allow = pk.corner ? 24 * (0.5 + 0.5 * Math.min(1, Math.max(0, (cosA - 0.55) / 0.45))) : 28 * Math.max(0, cosA) * Math.max(0, cosA);
          if(off < allow + 3 && cosA > (pk.corner ? 0.5 : 0.55) && P.clear(world, [x, y], [x + ux * along, y + uy * along], [skip])) return i;
        }
        return -1;
      }
      function guide(a){
        if(a == null) a = aim;
        shownAim = a;
        const c = P.ball(world, "cue"), g = P.aimLine(world, a);
        let h = '<line class="g-cue" x1="' + c.x.toFixed(1) + '" y1="' + c.y.toFixed(1) + '" x2="' + g.gx.toFixed(1) + '" y2="' + g.gy.toFixed(1) + '" vector-effect="non-scaling-stroke"/>';
        if(g.id){
          const b = P.ball(world, g.id), legal = Rl.legalFirst(Rl.on(st), Rl.kind(g.id));
          const wo = P.world([{ id: "x", x: b.x, y: b.y, vx: 0, vy: 0, on: true }].concat(world.balls.filter(z => z.on && z.id !== g.id && z.id !== "cue").map(z => Object.assign({}, z))));
          const ob = P.aimLine(wo, Math.atan2(g.oy, g.ox), P.ball(wo, "x")), len = Math.min(ob.t + (ob.id ? P.R : 0), 2600);
          const pk = legal ? goesIn(b.x, b.y, g.ox, g.oy, g.id) : -1;
          h += '<circle class="g-ghost' + (legal ? "" : " bad") + '" cx="' + g.gx.toFixed(1) + '" cy="' + g.gy.toFixed(1) + '" r="' + P.R + '" vector-effect="non-scaling-stroke"/>' +
            '<line class="g-obj' + (pk >= 0 ? " in" : "") + (legal ? "" : " bad") + '" x1="' + b.x.toFixed(1) + '" y1="' + b.y.toFixed(1) + '" x2="' + (b.x + g.ox * len).toFixed(1) + '" y2="' + (b.y + g.oy * len).toFixed(1) + '" vector-effect="non-scaling-stroke"/>';
          const tl = Math.hypot(g.cx, g.cy) * 420;
          if(tl > 20) h += '<line class="g-tan" x1="' + g.gx.toFixed(1) + '" y1="' + g.gy.toFixed(1) + '" x2="' + (g.gx + g.cx / Math.hypot(g.cx, g.cy) * tl).toFixed(1) + '" y2="' + (g.gy + g.cy / Math.hypot(g.cx, g.cy) * tl).toFixed(1) + '" vector-effect="non-scaling-stroke"/>';
          lsvg.setAttribute("viewBox", (g.gx - 170) + " " + (g.gy - 170) + " 340 340");
          $("#lp").classList.toggle("right", g.gx < P.W / 2);
        } else lsvg.setAttribute("viewBox", (g.gx - 170) + " " + (g.gy - 170) + " 340 340");
        svg.querySelector(".guide").innerHTML = h; lsvg.querySelector(".guide").innerHTML = h;
      }
      function drawStick(){
        const s = svg.querySelector(".stick"); if(!s) return;
        if(!stick.on){ s.style.opacity = 0; return; }
        const c = P.ball(world, "cue"), a = stick.a, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        const d0 = P.R + 8 + stick.pull, d1 = d0 + 1450, w0 = 5.5, w1 = 15;
        const pt = (d, w) => (c.x - ux * d + nx * w).toFixed(1) + "," + (c.y - uy * d + ny * w).toFixed(1);
        s.querySelector(".shaft").setAttribute("points", [pt(d0 + 18, w0), pt(d1, w1), pt(d1, -w1), pt(d0 + 18, -w0)].join(" "));
        s.querySelector(".ferrule").setAttribute("points", [pt(d0, w0), pt(d0 + 18, w0), pt(d0 + 18, -w0), pt(d0, -w0)].join(" "));
        s.style.opacity = stick.fade;
      }

      /* the fine dial and the nudges */
      const dial = $("#dial");
      let dx0 = null;
      dial.addEventListener("pointerdown", e => { if(phase !== "aim" && phase !== "place") return; if(phase === "place") phase = "aim"; dx0 = e.clientX; dial.setPointerCapture(e.pointerId); $("#lp").hidden = false; });
      dial.addEventListener("pointermove", e => {
        if(dx0 == null) return;
        const d = e.clientX - dx0; dx0 = e.clientX; aim += rad(d * 0.012); guide();
        dial.style.setProperty("--off", ((parseFloat(dial.style.getPropertyValue("--off")) || 0) + d) + "px");
      });
      const dialUp = () => { dx0 = null; later(() => { if(!dragKind && phase !== "draw") $("#lp").hidden = true; }, 700); };
      dial.addEventListener("pointerup", dialUp); dial.addEventListener("pointercancel", dialUp);
      let nudgeT = 0;
      el.querySelectorAll(".fr-nudge").forEach(b => {
        const go = () => { if(phase !== "aim" && phase !== "place") return; if(phase === "place") phase = "aim"; aim += rad(+b.dataset.d * 0.025); guide(); $("#lp").hidden = false; };
        b.addEventListener("pointerdown", e => { e.preventDefault(); go(); clearInterval(nudgeT); let n = 0; nudgeT = setInterval(() => { if(++n > 4) go(); }, 70); });
        const stop = () => { clearInterval(nudgeT); later(() => { if(!dragKind && phase !== "draw") $("#lp").hidden = true; }, 900); };
        b.addEventListener("pointerup", stop); b.addEventListener("pointerleave", stop); b.addEventListener("pointercancel", stop);
      });
      $("#spin").querySelectorAll("button").forEach(b => b.onclick = () => { spin = +b.dataset.i; spinUi(); sfx("tick"); });
      $("#concede").onclick = () => {
        const sh = $("#sheet"); sh.hidden = false; sh.className = "sheet pass";
        sh.innerHTML = '<p class="lbl">' + T("Snookers required", "Snookers nodig") + '</p><p class="lead">' + T("You need more than is left on the table. Play on for snookers, or shake hands?", "Je hebt meer nodig dan er nog op tafel ligt. Doorspelen voor snookers, of handen schudden?") + '</p><div class="row"><button class="go ghost" id="on">' + T("Play on", "Doorspelen") + '</button><button class="go" id="give">' + T("Concede", "Opgeven") + "</button></div>";
        sh.querySelector("#on").onclick = () => { sh.hidden = true; };
        sh.querySelector("#give").onclick = () => { sh.hidden = true; Rl.concede(st, st.turn); say(esc(pl[st.turn].name) + T(" concedes", " geeft op"), 2000); frameOver(); };
      };

      /* ---------- the cue strip: hold = draw back (power), let go = strike ---------- */
      const cueEl = $("#cue");
      const powerAt = e => { const r = cueEl.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left - 8) / (r.width - 16))); };
      cueEl.addEventListener("pointerdown", e => {
        if(phase !== "aim" && phase !== "place") return;
        phase = "draw"; cueEl.setPointerCapture(e.pointerId);
        draw = { t0: performance.now(), last: performance.now(), x: e.clientX, power: powerAt(e) };
        cueEl.classList.add("on"); $("#lp").hidden = false; setPower(draw.power);
      });
      cueEl.addEventListener("pointermove", e => {
        if(phase !== "draw" || !draw) return;
        if(Math.abs(e.clientX - draw.x) > 3){ draw.last = performance.now(); draw.x = e.clientX; }
        draw.power = powerAt(e); setPower(draw.power);
      });
      cueEl.addEventListener("pointerup", e => { if(phase === "draw") release(); });
      cueEl.addEventListener("pointercancel", () => { if(phase === "draw"){ phase = "aim"; draw = null; cueEl.classList.remove("on"); setPower(0); } });
      function setPower(p){
        $("#pw").style.transform = "scaleX(" + p.toFixed(3) + ")";
        $("#cuel").textContent = p < 0.04 ? T("Slide right for power · back to the left to cancel", "Schuif naar rechts voor kracht · terug naar links = annuleren") : Math.round(p * 100) + "%";
        stick.pull = 30 + p * 260;
      }
      function breathNow(){
        if(!draw) return { amp: 1, win: 0, tired: 1, base: 1 };
        const now = performance.now();
        return D.hand.breath({ b: (now - draw.t0) / 1000, rest: (now - draw.last) / 1000 }, grade, { mom, nerves });
      }
      function release(){
        const br = breathNow(), power = draw.power;
        cueEl.classList.remove("on");
        if(power < 0.04){ phase = "aim"; draw = null; setPower(0); $("#lp").hidden = true; guide(); return; }
        $("#lastpw").style.left = (power * 100).toFixed(1) + "%";
        const i = st.turn, p = pl[i], s = performance.now() / 1000;
        const v = P.powerToSpeed(power);
        const sh = Q.strike(grade, aim, v, s, ph, br, { mom, nerves });
        if(br.win === 2) p.s.perf++;
        if(br.win){ sfx("clean", br.win); pop(br.win === 2 ? "PERFECT" : "GOOD", br.win === 2 ? "perf" : "good"); }
        if(sh.miscue){ say(T("Miscue!", "Miscue!"), 1500, "bad"); sfx("tink", 0.6); }
        /* what was the player trying: a pot (the object line goes into a pocket) or a safety */
        const g = P.aimLine(world, aim), legal = g.id && Rl.legalFirst(Rl.on(st), Rl.kind(g.id));
        const pk = legal ? goesIn(P.ball(world, g.id).x, P.ball(world, g.id).y, g.ox, g.oy, g.id) : -1;
        draw = null; $("#lp").hidden = true;
        shoot(sh.a, sh.v, SPIN[spin].v, { attempt: pk >= 0, target: g.id });
      }

      /* ---------- the computer ---------- */
      function cpuTurn(){
        phase = "cpu"; const i = st.turn, p = pl[i], prof = p.prof;
        $("#hint").textContent = T(p.name + " is at the table…", p.name + " staat aan tafel…");
        $("#tag").className = "handtag fr-tag"; $("#zone").innerHTML = "";
        stick.on = false; svg.querySelector(".guide").innerHTML = "";
        if(Q.concede(st, i, prof)){
          later(() => { Rl.concede(st, i); say(esc(p.name) + T(" concedes", " geeft op"), 2200); ref(T(p.full + " concedes the frame.", p.full + " concedes the frame."), { pri: 1 }); frameOver(); }, 1100);
          return;
        }
        if(inHand) later(() => { Q.place(world, st, prof); drawBalls(); }, 300);
        later(() => {
          const ctx = { pots: potsInBreak, pressure: isPressure() };
          const plan = Q.plan(world, st, prof, ctx);
          /* the cue lines up and draws back */
          const from = stick.on ? stick.a : plan.a + 0.3;
          stick.on = true; stick.fade = 1; stick.pull = 30;
          const t0 = performance.now(), dur = calm() ? 0 : 650;
          const swing = () => {
            if(!alive) return;
            const k = dur ? Math.min(1, (performance.now() - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
            stick.a = from + (plan.a - from) * e; stick.pull = 30 + (k >= 1 ? 0 : 0);
            if(k < 1) requestAnimationFrame(swing);
            else later(() => {
              const pw = P.speedToPower(plan.v);
              const back = performance.now();
              const pull = () => { if(!alive) return; const k2 = Math.min(1, (performance.now() - back) / 380); stick.pull = 30 + pw * 260 * k2; if(k2 < 1) requestAnimationFrame(pull); else later(go, 140); };
              pull();
            }, 250);
          };
          const go = () => {
            const sh = Q.shoot(plan, prof, world, st, ctx);
            if(plan.kind === "pot") p.s.att++; else p.s.saf++;
            shoot(sh.a, sh.v, sh.s, { attempt: plan.kind === "pot", target: plan.b, cpu: true });
          };
          swing();
        }, (inHand ? 600 : 0) + Math.min(1600, prof.tempo));
      }

      /* ---------- the shot rolls ---------- */
      function shoot(a, v, s, info){
        phase = "roll"; svg.classList.remove("hush");
        $("#hint").textContent = ""; $("#concede").hidden = true;
        startPos = {}; world.balls.forEach(b => { if(b.on) startPos[b.id] = [b.x, b.y]; });
        stick.a = a;
        const human = !pl[st.turn].cpu;
        if(human){ if(info.attempt) pl[st.turn].s.att++; else pl[st.turn].s.saf++; }
        /* the cue goes through */
        const pull0 = stick.pull, t0 = performance.now();
        const thrust = () => { if(!alive) return; const k = Math.min(1, (performance.now() - t0) / 90); stick.pull = pull0 + (-6 - pull0) * k; if(k < 1) requestAnimationFrame(thrust); };
        thrust();
        sfx("tip", Math.min(1, v / 3000));
        P.strike(world, a, v, s);
        const r = P.run(world, { frames: true });
        svg.querySelector(".guide").innerHTML = ""; lsvg.querySelector(".guide").innerHTML = "";
        roll = { r, t0: performance.now() + 60, speed: 1.15, ev: 0, info };
      }
      function rollFrame(now){
        const R0 = roll, r = R0.r, el2 = R0.skip ? r.time + 1 : Math.max(0, (now - R0.t0) / 1000) * R0.speed;
        const k = Math.min(r.frames.length - 1, Math.floor(el2 * 60));
        drawBalls(r.frames[k]);
        while(R0.ev < r.ev.length && r.ev[R0.ev].t <= el2){
          const e = r.ev[R0.ev++];
          if(R0.skip && e.k !== "pot") continue;
          if(e.k === "ball") sfx("click", Math.min(1, e.s / 2600));
          else if(e.k === "cush" || e.k === "jaw") sfx("cush", Math.min(1, e.s / 2600), e.k === "jaw");
          else if(e.k === "pot"){ sfx("pocket"); if(e.a !== "cue") buzz(12); }
        }
        if(stick.fade > 0 && now - R0.t0 > 200){ stick.fade = Math.max(0, stick.fade - 0.06); if(!stick.fade) stick.on = false; }
        if(k >= r.frames.length - 1 && R0.ev >= r.ev.length){ roll = null; drawBalls(); settle(r, R0.info); }
      }

      /* ---------- the referee decides ---------- */
      function settle(r, info){
        const i = st.turn, p = pl[i], o0 = Rl.on(st), wasChase = chase;
        if(!st.brk && st.phase === "red" && st.redsLeft === st.reds) chase = true;
        const o = Rl.apply(st, r);
        const s = p.s;
        /* safety success: the other player's shot after your safety */
        if(safePending[1 - i]){ safePending[1 - i] = false; if(!o.pts || o.foul) pl[1 - i].s.safOk++; }
        if(o.foul){
          s.fouls++;
          ref(T("Foul. " + words(o.pen) + ".", "Foul. " + words(o.pen) + "."), { pri: 1, key: "foul", dedup: 500 });
          say(T("Foul · ", "Foul · ") + o.pen + T(" to ", " voor ") + esc(pl[1 - i].name), 2200, "bad");
          sfx("bad"); buzz([30, 40, 30]);
        } else if(o.pts){
          s.pots++;
          r.pockets.forEach((pk, j) => { if(r.potted[j] !== "cue") s.pk[pk]++; });
          const id = o.potted[0], sp = startPos[id];
          if(sp){ const pk = P.POCKETS[r.pockets[r.potted.indexOf(id)]]; if(pk){ const d = Math.round(Math.hypot(pk.aim[0] - sp[0], pk.aim[1] - sp[1])); if(d > s.lp) s.lp = d; } }
          potsInBreak++;
          mom = Math.min(3, mom + 1);
          if(o0 === "colour" && o.potted[0] !== "black") chase = false;
          ref(cap(words(st.brk)) + ".", { pri: 0, key: "brk", dedup: 300 });
          pop(st.brk, "brk");
          if(st.brk >= 50 && st.brk - o.pts < 50) say(T("Half-century!", "Halve century!"), 1800);
          if(st.brk >= 100 && st.brk - o.pts < 100){ say(T("Century!", "Century!"), 2400, "big"); ref("A century!", { pri: 2 }); call("fx", "sparks", [$("#sc" + i)]); sfx("clap", 1.4); }
          else if(o.pts >= 6 || st.brk >= 30) sfx("clap", 0.35);
        } else {
          if(!info.attempt){ safePending[i] = true; }
          if(info.attempt && !o.pts) say(T("Missed", "Gemist"), 1100, "dim");
        }
        if(o.turnOver){
          const b = o.brkEnded;
          if(b >= 20) s.b20++; if(b >= 50) s.b50++; if(b >= 100) s.cent++;
          if(b >= 20 && !o.over){ say(esc(p.name) + T(": break of ", ": break van ") + b, 2000); sfx("clap", Math.min(1.2, b / 50)); }
          potsInBreak = 0; mom = 0; chase = false;
        }
        if(s.hb < st.hb[i]) s.hb = st.hb[i];
        if(st.brk > s.hb) s.hb = st.brk;
        /* back on the table: re-spotted colours, and the cue ball in hand after an in-off */
        o.respot.forEach(id => { P.respot(world, id); const e = ballEl(id); if(e){ e.classList.remove("respot"); void e.getBoundingClientRect(); e.classList.add("respot"); } });
        if(o.rb){ say(T("Re-spotted black", "Herplaatste zwarte"), 2600, "big"); ref("Re-spotted black.", { pri: 2 }); }
        inHand = o.inHand;
        if(inHand){ const c = P.ball(world, "cue"); c.on = true; c.vx = c.vy = 0; placeDefault(); }
        drawBalls();
        if(!pl[i].cpu) needSnk[i] = needSnk[i] || Rl.needsSnookers(st, i);
        if(!pl[1 - i].cpu) needSnk[1 - i] = needSnk[1 - i] || Rl.needsSnookers(st, 1 - i);
        /* the maximum: every red with the black, then all the colours, in one visit */
        if(o.over && wasChase && st.score[i] === st.reds * 8 + 27 && st.hb[i] === st.reds * 8 + 27){ s.max++; say(T("A MAXIMUM!", "EEN MAXIMUM!"), 3200, "big"); ref(st.reds === 15 ? "A maximum! One hundred and forty-seven!" : "A six-red maximum! Seventy-five!", { pri: 2 }); call("fx", "party", []); }
        hud();
        if(o.over || st.over) return later(frameOver, 900);
        if(o.turnOver){ nerves = 0; later(turn, o.foul ? 1300 : 900); }
        else later(turn, 600);
      }
      const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

      /* ---------- the end of a frame, and of the match ---------- */
      function frameOver(){
        phase = "over";
        const w = st.winner, p = pl[w];
        p.frames++;
        [0, 1].forEach(i => {
          const s = pl[i].s; s.played++; s.pts += st.score[i]; if(st.hb[i] > s.hb) s.hb = st.hb[i];
          if(i === w){ s.frames++; if(st.rb) s.rbw++; if(needSnk[i]) s.comeback++; }
        });
        /* cleared the colours: the yellow to the black in the winning visit */
        hud();
        const done = p.frames >= need;
        ref(done && pref.best > 1 ? "Frame and match, " + (p.cpu ? p.prof.name : p.name) + "." : "Frame to " + (p.cpu ? p.prof.name : p.name) + ".", { pri: 2, rate: 0.92 });
        sfx("clap", 1.3);
        const sh = $("#sheet"); sh.hidden = false; sh.className = "sheet fr-end";
        sh.innerHTML = '<p class="lbl">' + T("Frame ", "Frame ") + frameNo + (st.conceded != null ? T(" · conceded", " · opgegeven") : "") + '</p><p class="pass-n">' + esc(p.name) + '</p><p class="fr-fs"><b>' + st.score[0] + "</b><span>–</span><b>" + st.score[1] + "</b></p>" +
          (pref.best > 1 ? '<p class="lead">' + T("Frames ", "Frames ") + pl[0].frames + "–" + pl[1].frames + "</p>" : "") +
          '<button class="go" id="nx">' + (done ? T("The result", "De uitslag") : T("Next frame", "Volgend frame")) + "</button>";
        if(!p.cpu){ call("fx", "sparks", [sh.querySelector(".pass-n")]); }
        sh.querySelector("#nx").onclick = () => { sh.hidden = true; if(done) end(w); else newFrame(); };
      }
      function end(w){
        phase = "end"; alive2 = false;
        const res = record(w);
        el.innerHTML = '<div class="g-top"><a class="back" href="#spelen-tafel">‹ Menu</a><b>' + T("Result", "Uitslag") + '</b><span></span></div>' +
          '<div class="g-body end fr-res"><p class="lbl">' + (pref.best > 1 ? "Best of " + pref.best : T("One frame", "Eén frame")) + " · " + (REDS === 6 ? T("six reds", "zes rode") : T("fifteen reds", "vijftien rode")) + '</p>' +
          '<p class="pass-n">' + esc(pl[w].name) + '</p><p class="verdict">' + (pl[w].cpu ? T("wins. Back to the practice table?", "wint. Terug naar de oefentafel?") : T("wins. Shake hands at the table.", "wint. Handen schudden aan tafel.")) + "</p>" +
          '<table class="fr-st"><thead><tr><th></th><th>' + esc(pl[0].name) + "</th><th>" + esc(pl[1].name) + "</th></tr></thead><tbody>" +
            [[T("Frames", "Frames"), i => pl[i].frames], [T("Points", "Punten"), i => pl[i].s.pts], [T("Highest break", "Hoogste break"), i => pl[i].s.hb],
             [T("Pots", "Gepot"), i => pl[i].s.att ? pl[i].s.pots + "/" + pl[i].s.att : pl[i].s.pots], [T("Safeties that held", "Geslaagde safety’s"), i => pl[i].s.saf ? pl[i].s.safOk + "/" + pl[i].s.saf : "–"],
             [T("Fouls", "Fouten"), i => pl[i].s.fouls], [T("Questions right", "Vragen goed"), i => pl[i].cpu ? "–" : pl[i].s.q[0] + "/" + pl[i].s.q[1]]]
              .map(([n, f]) => "<tr><th>" + n + "</th><td>" + f(0) + "</td><td>" + f(1) + "</td></tr>").join("") + "</tbody></table>" +
          '<div id="prog"></div><div class="row"><button class="go" id="again">' + T("Again", "Nog een keer") + '</button><a class="go ghost" href="#spelen-tafel">Menu</a></div></div>';
        el.querySelector("#again").onclick = () => setup();
        call("progress", "render", [el.querySelector("#prog"), res]);
        D.fx.stagger(el.querySelector(".g-body"), ".verdict, .fr-st, #prog, .row", 1);
        if(!pl[w].cpu) setTimeout(() => alive && D.fx.party(), 500);
      }
      function record(w){
        const m = { mode: "frame", reds: REDS, best: pref.best, when: Date.now(), opponent: OP ? { id: OP.id, name: OP.name, lvl: OP.lvl } : null,
          players: pl.map((p, i) => Object.assign({ idx: p.idx, name: p.name, cpu: p.cpu, won: i === w, frames: p.frames }, p.s)) };
        [0, 1].forEach(i => { if(!pl[i].cpu) D.store.result("frame" + REDS + "hb", pl[i].s.hb, pl[i].idx); });
        return call("progress", "recordFrame", [m]) || null;
      }

      /* ---------- the motion loop: the sway while drawing back, the ring, the stick, the roll ---------- */
      let alive2 = true;
      function loop(now){
        if(!alive || !alive2) return;
        raf = requestAnimationFrame(loop);
        if(roll) rollFrame(now);
        if(phase === "draw" && draw){
          const br = breathNow(), s = now / 1000;
          const sw = Q.sway(grade, s, ph, br.amp, { mom, nerves });
          guide(aim + rad(sw)); stick.a = aim + rad(sw);
          const ring = svg.querySelector(".ring"), c = P.ball(world, "cue");
          ring.setAttribute("cx", c.x); ring.setAttribute("cy", c.y); ring.setAttribute("r", (P.R + 12 + br.amp * 34).toFixed(1));
          ring.setAttribute("class", "ring show" + (br.win === 2 ? " perfect" : br.win ? " good" : "") + (br.tired > 1.05 ? " tired" : ""));
        } else {
          const ring = svg && svg.querySelector(".ring"); if(ring) ring.setAttribute("class", "ring");
          if(phase === "aim" || phase === "place") stick.a = aim;
        }
        drawStick();
      }

      /* for _tests/shoot.js only: set up a position (window.CHALK_TEST must exist) */
      if(window.CHALK_TEST) window.CHALK_TEST.frame = { st: () => st, world: () => world, aim: a => { aim = a; guide(); }, cue: g => { grade = g; tag(); }, redraw: () => { drawBalls(); hud(); } };
      newFrame();
      raf = requestAnimationFrame(loop);
      return () => { window.removeEventListener("resize", onResize); };
    }

    setup();
    return () => { alive = false; timers.forEach(clearTimeout); cancelAnimationFrame(raf); if(unbind) unbind(); call("caller", "stop", []); };
  };
})(window.DART);
