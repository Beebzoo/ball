/* Match point in 3D: Hang Time. app/match.js keeps the score, picks the big points and writes the report, and asks this
   court to play one point at a time, as it asks app/court.js on the flat court. Rules: app/3d/hang.js, _plans/match-3d.md.

   One rally, no cuts. A shot leaves the racket on a real flight towards the middle of the court, and past the net time
   slows to a crawl: that is the hang. The ball stays on that line while you answer, because a ball drifting towards the
   right spot would give the answer away; the spots are shuffled for the same reason. Your tap re-aims it, with no corner
   in the path, so it bounces on the right answer. The tap also sets your feet: right gets you there, close is a lunge,
   wrong is the wrong way. Then the racket really has to meet it. */
(function(R){
  const T = R.T, V = R.v3, A = R.ath, FL = R.fl, H = R.hang, M = window.BallMotion;
  const HEAT_T = [1.2, 1.02, 0.84], RPM = [2300, 2500, 3200], TIERS = ["easy", "medium", "hard"];
  const LEVEL = [["Easy", "Makkelijk"], ["Medium", "Gemiddeld"], ["Hard", "Moeilijk"]];
  const BASE = V.BASE, DEEP = 13.9; // how far behind the baseline they'll let it go
  /* where the four answers are on the court: bounce spots, near to far. Left and right match the screen */
  const RALLY = [[-2.6, 6.2], [2.6, 6.2], [-2.8, 9.6], [2.8, 9.6]];
  const CHIP = [[25.5, 83.5], [74.5, 83.5], [25.5, 92.5], [74.5, 92.5]]; // and on the screen, percent: the thumb zone
  /* each opponent's own look: skin, hair, hair style, beard. All fictional. BALL's arrays, by index */
  const SKINS = ["#f2d0b4", "#e6bb96", "#d6a47b", "#c18a60", "#a87350", "#8e5c3c", "#75482e", "#5f3a25"], HAIRS = ["#14100c", "#22170f", "#33231a", "#4d3422", "#6e4b2c", "#94693c", "#b98b52", "#d2b277", "#7a2f1b"];
  const FACE = { captain: [1, 3, 0, 1], moonball: [1, 4, 4, 0], wall: [3, 0, 2, 2], lefty: [0, 7, 4, 0], cannon: [0, 5, 3, 0], fox: [2, 1, 4, 0], engine: [1, 4, 0, 0], storm: [6, 0, 4, 0], ice: [0, 4, 4, 0], closer: [2, 0, 3, 0] };
  const WOMEN = { moonball: 1, lefty: 1, fox: 1, storm: 1, ice: 1 };
  const SHOE = ["#eceee9", "#1b1c1f"];
  const rnd = Math.random, esc = s => R.esc(s), clamp = (t, a, b) => t < a ? a : t > b ? b : t;
  let run = 0, me = null, cpu = null, opp = null, NAME = "", SURF = "hard", host = null, hud = null, onAsk = null, setupP = null, shots = 0, gaveUp = null, giveUp = null;
  const hooks = { bot: null, tap: null, onHit: null, allLive: false };
  const $ = s => hud && hud.querySelector(s), later = ms => V.real(ms);

  /* ---------- the HUD ---------- */
  function msg(text, cls, sub){ const m = $("#c3-msg"); if(!m) return; m.className = "show " + (cls || ""); m.innerHTML = esc(text) + (sub ? "<small>" + esc(sub) + "</small>" : ""); }
  const clearMsg = () => { const m = $("#c3-msg"); if(m) m.className = ""; };
  const ui = html => { const u = $("#c3-ui"); if(u) u.innerHTML = html; };
  const asking = on => { if(host && host.parentNode) host.parentNode.classList.toggle("ask", on); };
  function head(label, tier, live, score){
    $("#c3-lab").innerHTML = (live ? '<span class="live">' + esc(T("Live ball", "Live ball")) + "</span> · " : "") + esc(label) + (tier != null ? ' <span class="lv t' + tier + '">' + esc(R.L(LEVEL[tier])) + "</span>" : "");
    $("#c3-sc").textContent = score || "";
  }
  /* real seconds on the render clock */
  function ticker(ms, f, r0){
    return new Promise(res => {
      let t = 0; const off = V.onTick((gdt, dt) => {
        if(r0 !== run){ off(); return res(false); }
        t += dt * 1000; const u = Math.min(1, t / ms); if(f(u) === false){ off(); return res(false); }
        if(u >= 1){ off(); res(true); }
      });
    });
  }

  /* ---------- the clock follows the words ---------- */
  const words = q => String(q.q).trim().split(/\s+/).length;
  const clockFor = (q, k) => Math.max(6, Math.min(12, words(q) / 3.5 + 3)) * (k || 1) * H.SURF[SURF].clock;
  function question(tier, deck){ return R.qs.pick(deck || "all", TIERS[tier], 1)[0] || R.qs.pick("all", "mix", 1)[0]; }

  /* ---------- shots ---------- */
  const other = a => a === me ? cpu : me;
  function whenZ(P, z){ const q = [0, 0, 0], s = Math.sign(P.v0[2]); for(let t = 0; t < P.len; t += 1 / 120){ P.at(t, q); if((q[2] - z) * s >= 0) return t; } return P.len; }
  const untilZ = (P, z) => V.until(V.ball.t0 + whenZ(P, z));
  /* how a player meets a ball: which stroke, when, and where the feet must be for the strings to be on it */
  function plan(a, P, target){
    let best = null; const t0 = V.ball.t0;
    for(const k of ["fh1", "fh2", "bh"]){
      const c = A.CLIPS[k], tt = P.meet(c.spot[1], DEEP), q = P.at(tt, [0, 0, 0]), yaw = Math.atan2(target[0] - q[0], target[1] - q[2]), low = A.low(c, c.spot[1] - q[1]), feet = A.feet(c, q, yaw, low.spot);
      const d = Math.hypot(feet[0] - a.x, feet[1] - a.z) + (k === "bh" ? 0.5 : 0) + Math.abs(c.spot[1] - q[1]) * 2;
      if(!best || d < best.d) best = { c, t: t0 + tt, p: q, yaw, feet, d, grip: low.grip };
    }
    return best;
  }
  function commit(a, pl, arrive){
    a.go(pl.feet[0], pl.feet[1], V.gt, Math.max(V.gt + 0.08, pl.t - (arrive == null ? 0.1 : arrive)));
    a.swing(pl.c, pl.t, pl.yaw, V.gt, pl.grip);
  }
  function fx(P, heat){
    const t0 = V.gt, r0 = run;
    if(P.bounces) P.bounces.slice(0, 2).forEach((b, i) => V.until(t0 + b.t).then(ok => { if(ok && r0 === run && V.ball.path === P){ R.sfx.bounce(SURF); if(!i) V.mark(b.x, b.z, heat || 0); } }));
  }
  function strike(a, land, o){
    if(hooks.onHit) hooks.onHit(a === me ? "me" : "cpu", V.ball.p.slice(), a.spotNow(), o, V.gt);
    const from = o.pl ? o.pl.p.slice() : V.ball.p.slice(), P = FL.timed(Object.assign({ from, land, T: 1.0, rpm: 2300, surf: SURF }, o), o.clear == null ? 0.1 : o.clear);
    V.follow(P, o.pl ? o.pl.t : V.gt, o.heat || 0); fx(P, o.heat); shots++;
    R.sfx.pock(0.9 + (o.heat || 0) * 0.25); V.shake(0.012 + (o.heat || 0) * 0.018);
    return P;
  }
  /* a spot on the far side of the hitter */
  const spot = (a, x, z) => [x, -a.side * z];
  const rallySpot = a => spot(a, (rnd() < 0.5 ? -1 : 1) * (1 + rnd() * 2.3), 7.4 + rnd() * 2.6);
  const home = a => [clamp(a.x * 0.35, -1.4, 1.4), a.side * (BASE + 0.5)];
  function recover(a, t){ const h = home(a); a.go(h[0], h[1], V.gt + 0.5, Math.max(V.gt + 0.9, t - 0.35)); }

  /* the serve: the clip, the toss off the left hand, the contact overhead */
  async function serveMotion(a, target, r0){
    const c = A.CLIPS.sv1, tc = V.gt + c.at, yaw0 = Math.atan2(target[0] - a.x, target[1] - a.z), s = Math.sin(yaw0), co = Math.cos(yaw0), v = new window.THREE.Vector3();
    a.swing(c, tc, yaw0, V.gt);
    const p = [a.x + (c.spot[0] * co + c.spot[2] * s), c.spot[1], a.z + (-c.spot[0] * s + c.spot[2] * co)];
    V.hold(out => { a.left(v); out[0] = v.x; out[1] = v.y - 0.03; out[2] = v.z; });
    await V.until(tc - 0.8); if(r0 !== run) return null;
    V.follow(FL.toss(V.ball.p.slice(), p, 0.8), V.gt, 0);
    return { t: tc, c, p };
  }

  /* ---------- the hang ---------- */
  function crawl(P, C){
    const v = P.vel(V.gt - V.ball.t0, [0, 0, 0]), s = Math.max(4, Math.hypot(v[0], v[1], v[2]));
    V.slow((1 / s) / C, 240);
  }
  function hang(q, o){
    const r0 = run, C = clockFor(q, o.k), t0 = V.now(), tier = TIERS.indexOf(q.tier);
    $("#c3-q").textContent = q.q; $("#c3-clk").style.opacity = 1; head(o.label, tier, o.live, o.score); clearMsg(); asking(true);
    if(o.live) R.sfx.heart();
    R.sfx.whoosh(true);
    if(o.path) crawl(o.path, C); else V.slow(0.012, 240);
    V.cam(o.cam || "hang", 2.6);
    V.spots(o.spots);
    ui(q.opts.map((a, i) => '<button class="spot" data-i="' + i + '" style="left:' + CHIP[i][0] + "%;top:" + CHIP[i][1] + "%;animation-delay:" + (60 + i * 40) + 'ms">' + esc(a) + "</button>").join(""));
    return new Promise(res => {
      let done = false;
      const finish = k => {
        if(done) return; done = true;
        const secs = (V.now() - t0) / 1000, pick = k >= 0 ? q.opts[k] : null, g = R.qs.grade(q, pick), fast = g === 0 && secs < C * 0.55, rush = g >= 2 && secs < C * 0.35;
        const c = $("#c3-clk"); if(c) c.style.opacity = 0;
        asking(false);
        if(onAsk) onAsk(q, g, secs);
        res({ k, g, fast, rush, secs, q, right: q.opts.indexOf(q.a), heat: o.heat });
      };
      hud.querySelectorAll(".spot").forEach(b => b.onclick = () => finish(+b.dataset.i));
      const bar = $("#c3-bar");
      ticker(C * 1000, u => { if(done) return false; if(bar) bar.style.transform = "scaleX(" + (1 - u) + ")"; }, r0).then(ok => { if(ok) finish(-1); else if(r0 !== run) res(null); });
      if(hooks.bot) hooks.bot(q, b => { const e = hud && hud.querySelector('.spot[data-i="' + b + '"]'); if(e) e.click(); });
    });
  }
  function colour(a){
    hud.querySelectorAll(".spot").forEach((s, i) => { s.disabled = true; if(i === a.right) s.classList.add("right"); else if(i === a.k) s.classList.add("wrong", "g" + a.g); else s.classList.add("fade"); });
  }
  /* time snaps back and the ball turns for the right answer. Returns the path */
  function turn(land, heat, rpm){
    const t = V.gt - V.ball.t0, vel = V.ball.path.vel(t, [0, 0, 0]), from = V.ball.p.slice(), vh = Math.max(13, Math.hypot(vel[0], vel[2])), d = Math.hypot(land[0] - from[0], land[1] - from[2]);
    const P = FL.reaim({ from, land, T: clamp(d / vh * 1.03, 0.2, 1), rpm: rpm == null ? 2300 : rpm, surf: SURF }, vel);
    V.follow(P, V.gt, heat); fx(P, heat);
    return P;
  }

  /* the timing ring closes on the ball as it reaches the racket. win: half the window, ms */
  function contact(tc, win){
    const r0 = run, D = 0.3, SLOW = 0.42, ring = $("#c3-ring"), goal = $("#c3-goal"), hint = $("#c3-hint");
    let tapReal = null, tcReal = null, armed = false;
    const onTap = e => { if(armed && tapReal == null && !(e.target.closest && e.target.closest("button"))) tapReal = V.now(); };
    host.addEventListener("pointerdown", onTap);
    const quit = v => { host.removeEventListener("pointerdown", onTap); return v; };
    return new Promise(async res => {
      await V.until(tc - D); if(r0 !== run) return res(quit(null));
      V.slow(SLOW, 90); armed = true;
      ring.style.opacity = 1; goal.style.opacity = 1;
      hint.textContent = T("Tap when the ring meets the circle", "Tik als de ring de cirkel raakt");
      const off = V.onTick(() => {
        const [x, y] = V.project(V.ball.p[0], V.ball.p[1], V.ball.p[2]), r = 0.39 + clamp((tc - V.gt) / D, -0.2, 1) * 0.61, px = x / 100 * host.clientWidth, py = y / 100 * host.clientHeight;
        ring.style.transform = "translate(" + px + "px," + py + "px) scale(" + r + ")"; goal.style.transform = "translate(" + px + "px," + py + "px)";
      });
      if(hooks.tap) hooks.tap(tc, SLOW, () => { tapReal = V.now(); });
      await V.until(tc); tcReal = V.now();
      if(r0 !== run){ off(); return res(quit(null)); }
      /* the hit-stop: the contact holds for a moment, long enough to be late */
      if(tapReal == null){ V.slow(0.03, 30); await ticker(win + 40, () => tapReal == null && r0 === run ? undefined : false, r0); }
      off(); quit();
      if(r0 !== run) return res(null);
      ring.style.opacity = 0; goal.style.opacity = 0; hint.textContent = "";
      const dms = tapReal == null ? null : Math.round(tapReal - tcReal), hit = dms != null && Math.abs(dms) <= win;
      V.slow(1, 110);
      res(hit);
    });
  }

  const words2 = { reach: [["You got there", "Je was er"], ["Early, and set", "Vroeg en klaar"]], lunge: ["At full stretch", "Op volle lengte"], way: ["Wrong way", "Verkeerde kant"], rush: ["Ran early, and the wrong way", "Te vroeg, en de verkeerde kant op"], late: ["Too late", "Te laat"], scramble: ["Scrambled back", "Teruggekrabbeld"] };
  function after1(a, lost){
    if(a.k < 0) return msg(R.L(words2.late), "bad", T("It was: ", "Het was: ") + a.q.a);
    if(a.g === 0) return msg(R.L(words2.reach[a.fast ? 1 : 0]), "good");
    if(a.g === 1) return msg(R.L(words2.lunge));
    return msg(R.L(a.rush ? words2.rush : lost ? words2.way : words2.scramble), "bad", T("It was: ", "Het was: ") + a.q.a);
  }
  function react(w){ const a = w === 0 ? me : cpu, b = other(a); V.slow(1, 120); a.act(t => M.fistPump(t, 3), V.gt); b.act(t => M.handsOnHead(t, 5), V.gt + 0.2); }
  const done = (o, w, end, by) => { clearMsg(); return { w, server: o.server, by: by == null ? 1 - w : by, end, shots, first: true }; };

  /* You run. Sets your feet off the answer. Returns the plan, or null if you never get to it */
  async function runFor(a, lost, P, spots, target, r0){
    const wrong = a.k >= 0 && a.g >= 2 ? spots[a.k] : null;
    if(lost){
      if(wrong) me.go(wrong[0] * 0.8, Math.max(wrong[1], 8.5), V.gt, V.gt + 0.75);
      return null;
    }
    const pl = plan(me, P, target);
    if(a.g <= 1) commit(me, pl, a.fast ? 0.3 : a.g === 0 ? 0.16 : 0.02); // right: there early and set; close: at full stretch
    else {
      /* off, or wrong but saved: a few steps the wrong way, then back */
      me.go(wrong[0] * 0.55 + me.x * 0.45, me.z, V.gt, V.gt + 0.2);
      await V.until(V.gt + 0.2); if(run !== r0) return null;
      commit(me, pl, 0);
    }
    return pl;
  }

  /* a few real shots to end a point. a is at contact now; the n-th shot after this one is the last */
  async function exchange(a, n, how, heat, r0, pl0){
    let at = pl0;
    for(let i = 0; ; i++){
      if(r0 !== run) return;
      const last = i === n, b = other(a);
      if(last && how === "error") return miss(a, r0);
      const land = last ? spot(a, (rnd() < 0.5 ? -1 : 1) * (2.6 + rnd() * 1.1), 8.6 + rnd() * 2.2) : rallySpot(a);
      const P = strike(a, land, { T: last ? 0.78 + rnd() * 0.12 : 0.92 + rnd() * 0.28, rpm: last ? 1500 : 2300, heat: i ? 0 : heat, pl: at });
      if(last){
        /* a winner: the other one runs and doesn't get there */
        const q = P.at(P.meet(0.9), [0, 0, 0]), tEnd = V.gt + P.tLand + 0.5;
        b.go(b.x + (q[0] - b.x) * 0.62, b.z, V.gt + 0.12, tEnd);
        await V.until(V.gt + Math.min(P.len, P.tLand + 0.9));
        return;
      }
      const target = rallySpot(b), pl = plan(b, P, target);
      commit(b, pl, 0.14); recover(a, pl.t + 1.2);
      await V.until(pl.t); if(r0 !== run) return;
      a = b; at = pl;
    }
  }
  /* the last shot goes wrong: into the net, or long, or wide */
  async function miss(a, r0, netOnly){
    const r = netOnly ? 0 : rnd();
    if(r < 0.5){
      const x = a.x * 0.4 + (rnd() - 0.5) * 3, y = 0.45 + rnd() * 0.4;
      const P = FL.shot({ from: V.ball.p.slice(), land: [x, 0], y, T: 0.5 + rnd() * 0.08, rpm: 1400, surf: SURF, stop: true });
      V.follow(P, V.gt, 0); R.sfx.pock(0.8); shots++;
      await V.until(V.gt + P.tSeg); if(r0 !== run) return;
      V.ripple(x, y, 0.18); R.sfx.net();
      const Q = FL.shot({ from: V.ball.p.slice(), land: [x, a.side * 0.32], T: Math.sqrt(2 * y / 9.81) + 0.02, rpm: 0, surf: SURF, tail: 1.2 });
      V.follow(Q, V.gt, 0); fx(Q, 0);
      await V.until(V.gt + Q.len * 0.7);
      return;
    }
    const land = r < 0.8 ? spot(a, (rnd() - 0.5) * 5, BASE + 0.5 + rnd() * 1.1) : spot(a, (rnd() < 0.5 ? -1 : 1) * (4.6 + rnd() * 0.7), 8.5);
    const P = strike(a, land, { T: 0.92, rpm: 1700, heat: 0 });
    await V.until(V.gt + P.tLand + 0.7);
  }

  /* ---------- between points ---------- */
  /* the deuce side: the server stands to the right of the mark, and serves across */
  function setup(server, side){
    clearMsg(); ui(""); $("#c3-q").textContent = ""; $("#c3-clk").style.opacity = 0; head("", null, false, ""); hud.classList.remove("liveon", "hush"); V.mood(0); V.spots(null); asking(false);
    const sx = side === "deuce" ? 1 : -1; // on your side your right is +x
    if(server === 0){ me.place(sx * 0.9, BASE + 0.25, Math.PI); cpu.place(-sx * 2.4, -(BASE + 0.6), 0); }
    else { cpu.place(-sx * 0.9, -(BASE + 0.25), 0); me.place(sx * 2.4, BASE + 0.6, Math.PI); }
    V.hide(); V.slow(1, 1);
    V.snap(server === 0 ? "serve" : "tv"); V.cam(server === 0 ? "serve" : "tv", 3);
  }
  /* a cut to the next point. The players are in place before match.js says who's to serve */
  function ready(server, side){
    const d = $("#c3-dip"), first = !me.placed;
    me.placed = true;
    if(first){ setup(server, side); setupP = Promise.resolve(); return; }
    if(d) d.classList.add("on");
    setupP = later(170).then(ok => { if(!ok || !hud) return; setup(server, side); if(d) d.classList.remove("on"); });
  }
  /* your serve: pick a target */
  const TG = [["Body", "Lichaam"], ["Corner", "Hoek"], ["Line", "Lijn"]];
  const TGT_UI = [[19.5, 37], [50, 37], [80.5, 37]];
  function target(o){
    head(T("Your serve", "Jouw opslag"), null, o.live, o.score); $("#c3-q").textContent = o.prompt; asking(true);
    ui(o.items.map((it, i) => '<button class="tgt" data-i="' + i + '" style="left:' + TGT_UI[i][0] + "%;top:" + TGT_UI[i][1] + '%"><b>' + esc(R.L(TG[i])) + "</b><small>" + esc(it) + "</small></button>").join(""));
    return new Promise(res => { hud.querySelectorAll(".tgt").forEach(b => b.onclick = () => { R.sfx.tick(); ui(""); asking(false); res(+b.dataset.i); }); if(hooks.bot) V.real(600).then(ok => { const e = ok && hud && hud.querySelector('.tgt[data-i="' + Math.floor(rnd() * 3) + '"]'); if(e) e.click(); }); });
  }
  /* into the far box, and where the four answers sit in yours. sx: which side is deuce */
  const farBox = (sx, t) => [[-sx * 1.9, -5.0], [-sx * 3.55, -5.5], [-sx * 0.42, -5.5]][t];
  const nearBox = sx => [[sx * 1, 3.9], [sx * 3.2, 3.9], [sx * 0.9, 5.6], [sx * 3.3, 5.6]].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const sideX = side => side === "deuce" ? 1 : -1;

  /* ---------- a quiet point ---------- */
  async function quiet(o){
    const r0 = run, server = o.server, sx = sideX(o.side); let th = 1, heat = H.heat(opp, rnd), spots = RALLY, P;
    shots = 0;
    if(server === 0){
      const tgt = await target({ score: o.score, prompt: T("Pick a target, then time the toss.", "Kies een doel en time de toss."), items: [T("safe", "veilig"), T("solid", "stevig"), T("risky", "riskant")] });
      if(r0 !== run) return null;
      const box = farBox(sx, tgt), m = await serveMotion(me, box, r0); if(!m) return null;
      const hit = await contact(m.t, [240, 160, 95][tgt]); if(hit == null) return null;
      th = hit ? tgt : 0; heat = Math.max(th, 1);
      V.cam("tv", 3); $("#c3-q").textContent = "";
      const S = strike(me, box, { T: 0.56 - th * 0.03, rpm: 900, heat, clear: 0.04 });
      if(th === 2 && rnd() < 0.15){
        cpu.go(cpu.x + (box[0] - cpu.x) * 0.5, cpu.z, V.gt, V.gt + 0.7); msg("Ace!", "good"); react(0); await later(1000);
        return done(o, 0, "ace");
      }
      const ret = [0, 7.6 + rnd()], pl = plan(cpu, S, ret);
      commit(cpu, pl, 0.1); recover(me, pl.t + 1);
      await V.until(pl.t); if(r0 !== run) return null;
      P = strike(cpu, ret, { T: HEAT_T[heat], rpm: RPM[heat], heat, pl });
    } else {
      const ret = [sx * 2, 4.9], sv = H.cpuServe(opp, SURF, rnd);
      await later(350); if(r0 !== run) return null;
      const m = await serveMotion(cpu, ret, r0); if(!m) return null;
      await V.until(m.t); if(r0 !== run) return null;
      if(sv === "df"){ await miss(cpu, r0, true); if(r0 !== run) return null; msg(T("Double fault", "Dubbele fout"), "good"); react(0); await later(700); return done(o, 0, "df"); }
      if(sv === "ace"){
        const wide = [sx * 3.7, 5.8], S = strike(cpu, wide, { T: 0.5, rpm: 900, heat: 2, clear: 0.04 });
        me.go(me.x + (wide[0] - me.x) * 0.45, me.z, V.gt + 0.1, V.gt + 0.7);
        await V.until(V.gt + S.tLand + 0.5); if(r0 !== run) return null;
        msg("Ace", "bad"); react(1); await later(700); return done(o, 1, "ace");
      }
      P = strike(cpu, ret, { T: 0.56 + (2 - heat) * 0.05, rpm: 900, heat, clear: 0.04 });
      spots = nearBox(sx);
    }
    await untilZ(P, -2.4); if(r0 !== run) return null;
    const a = await hang(question(heat), { kind: server === 0 ? "third" : "return", label: server === 0 ? T("Your shot", "Jouw slag") : T("Return", "Return"), heat, score: o.score, path: P, spots });
    if(a == null || r0 !== run) return null;
    const lost = H.lost(a, rnd);
    after1(a, lost); if(a.g <= 1) R.sfx.good(); else R.sfx.bad();
    colour(a); V.spots(spots.map((s, i) => i === a.right ? [s[0], s[1], "#2fc56f"] : i === a.k ? [s[0], s[1], "#e85a5a"] : null));
    V.slow(0.66, 170); V.cam("tv", 2.6); R.sfx.whoosh();
    const Q = turn(spots[a.right], heat), pl = await runFor(a, lost, Q, spots, rallySpot(me), r0);
    if(r0 !== run) return null;
    await later(a.g <= 1 ? 420 : 650); ui(""); V.spots(null); if(a.g <= 1) clearMsg();
    if(!pl){
      V.slow(1, 200); await V.until(V.gt + Math.min(Q.len - (V.gt - V.ball.t0), Q.tLand + 0.8)); if(r0 !== run) return null;
      clearMsg(); react(1); await later(500); return done(o, 1, "winner");
    }
    const tapped = await contact(pl.t, a.fast ? 260 : a.g === 0 ? 170 : a.g === 1 ? 100 : 80);
    if(tapped == null) return null;
    clearMsg(); $("#c3-q").textContent = ""; head(R.L(LEVEL[heat]) + T(" ball", " bal"), null, false, o.score);
    msg(tapped ? T("Clean", "Zuiver") : T("Mistimed", "Mis getimed"), tapped ? "good" : "bad");
    const win = rnd() < H.edge(a, server === 0, th, tapped, opp, SURF, rnd) ? 0 : 1, how = rnd() < 0.6 ? "winner" : "error";
    const lastHitter = how === "winner" ? win : 1 - win, n = (lastHitter === 0 ? 0 : 1) + 2 * Math.floor(rnd() * 2);
    later(420).then(() => { if(r0 === run) clearMsg(); });
    await exchange(me, n, how, heat, r0, pl);
    if(r0 !== run) return null;
    react(win); await later(500);
    return how === "winner" ? done(o, win, "winner") : done(o, win, "ue", 1 - win);
  }

  /* ---------- the Live Ball: every shot a question, no dice ---------- */
  let liveScore = "";
  /* the other side answers while the ball hangs there */
  async function cpuThink(t, label, P){
    const r0 = run;
    $("#c3-q").textContent = ""; head(label, t, true, liveScore); ui(""); msg(NAME + T(" is thinking…", " denkt na…"));
    if(P) crawl(P, 2.2);
    V.cam("tv", 2.2);
    await later(1100 + rnd() * 900); clearMsg();
    if(r0 !== run) return null;
    return H.cpuGrade(opp, t, true, rnd);
  }
  /* your question on a Live Ball; returns the answer. The ball turns after it */
  async function liveAsk(tier, label, k, heat, deck, P, spots){
    const r0 = run, q = question(tier, deck);
    const a = await hang(q, { kind: label, label, heat, score: liveScore, live: true, k, path: P, spots, cam: P ? "hang" : "serve" });
    if(a == null || r0 !== run) return null;
    after1(a, a.g >= 2); if(a.g <= 1) R.sfx.good(); else R.sfx.bad();
    colour(a); V.slow(0.66, 170); R.sfx.whoosh();
    return a;
  }
  const ends = async (o, w, text, end, wait) => { react(w); msg(text, w === 0 ? "good" : "bad"); await later(wait || 900); clearMsg(); return done(o, w, end || "winner"); };

  /* the defender d got it back: the ball turns for that spot, d runs and is at contact when this returns */
  async function meet(d, land, heat, r0, next){
    const Q = turn(land, heat), pl = plan(d, Q, next);
    V.slow(0.7, 170); // whoever answered, the ball has turned and time comes back
    commit(d, pl, 0.12);
    if(d === me) V.cam("tv", 2.4);
    await V.until(pl.t); if(r0 !== run) return null;
    return pl;
  }
  async function livePoint(o){
    const r0 = run, server = o.server, sx = sideX(o.side); liveScore = o.score; shots = 0;
    hud.classList.add("liveon", "hush"); V.mood(1); msg(T("Quiet, please", "Stilte, alstublieft")); R.sfx.heart(); await later(900); clearMsg();
    if(r0 !== run) return null;
    const decks = R.qs.shuffle(R.qs.decks);
    let W = 1, hit = server, P = null;
    if(server === 0){
      const t = await target({ score: o.score, live: true, prompt: T("Pick a target: its level and topic come with it.", "Kies een doel: niveau en onderwerp horen erbij."), items: [0, 1, 2].map(i => R.L(LEVEL[i]) + " · " + R.qs.name(decks[i])) });
      if(r0 !== run) return null;
      /* the toss goes up and hangs at the top while you answer */
      const box = farBox(sx, t), m = await serveMotion(me, box, r0); if(!m) return null;
      await V.until(V.gt + 0.42); if(r0 !== run) return null;
      const a = await liveAsk(t, T("Your serve", "Jouw opslag"), 1, t, decks[t], null, null); if(a == null) return null;
      const g = a.g; ui(""); V.slow(1, 200);
      if(g === 0) W = t; else if(g === 1) W = 0;
      else if(rnd() < 0.08){ await V.until(m.t); if(r0 !== run) return null; await miss(me, r0, true); if(r0 !== run) return null; return ends(o, 1, T("Double fault", "Dubbele fout"), "df"); }
      else W = 0;
      await V.until(m.t); if(r0 !== run) return null;
      clearMsg(); V.cam("tv", 3);
      P = strike(me, box, { T: 0.58 - W * 0.04, rpm: 900, heat: W, clear: 0.04 });
      if(g === 0 && t === 2 && rnd() < 0.2){ cpu.go(cpu.x + (box[0] - cpu.x) * 0.5, cpu.z, V.gt, V.gt + 0.7); await later(700); if(r0 !== run) return null; return ends(o, 0, "Ace!", "ace"); }
      hit = 0;
    } else {
      W = H.heat(opp, rnd); hit = 1;
      await later(300); if(r0 !== run) return null;
      const ret = [sx * 2, 4.9], m = await serveMotion(cpu, ret, r0); if(!m) return null;
      await V.until(m.t); if(r0 !== run) return null;
      P = strike(cpu, ret, { T: 0.56 + (2 - W) * 0.05, rpm: 900, heat: W, clear: 0.04 });
    }
    W = Math.min(2, W + H.SURF[SURF].start);
    let serveBall = true;
    for(let i = 0; i < 12; i++){
      if(r0 !== run) return null;
      const d = 1 - hit, D = d === 0 ? me : cpu, Hit = other(D), zHang = D.side > 0 ? -2.4 : 2.4;
      if(W === 2){
        /* a Hard one landed: the hitter comes in, and the defender picks */
        msg(hit === 0 ? T("You charge the net", "Je stormt naar het net") : NAME + T(" charges the net", " stormt naar het net"), hit === 0 ? "good" : "bad");
        Hit.go(clamp(Hit.x * 0.3, -1.2, 1.2), Hit.side * 3.5, V.gt + 0.1, V.gt + 1.05);
        await untilZ(P, zHang); if(r0 !== run) return null;
        clearMsg();
        return netBall(o, D, Hit, P, r0);
      }
      await untilZ(P, zHang); if(r0 !== run) return null;
      const near = serveBall && d === 0 ? nearBox(sx) : RALLY, far = [rnd() < 0.5 ? -3 : 3, -(7.6 + rnd() * 2)], back = [(rnd() - 0.5) * 2, D.side * -(7.2 + rnd() * 1.6)];
      serveBall = false;
      let g, a = null;
      if(d === 0){ a = await liveAsk(W, T("Your shot", "Jouw slag"), 1, W, null, P, near); if(a == null) return null; g = a.g; }
      else { g = await cpuThink(W, NAME, P); if(g == null) return null; }
      if(g >= 2){
        const land = d === 0 ? near[a.right] : far, Q = turn(land, W);
        if(d === 0){ ui(""); V.spots(null); }
        V.slow(0.8, 160);
        D.go(D.x + (land[0] > D.x ? -1.2 : 1.2), D.z, V.gt, V.gt + 0.6);
        await V.until(V.gt + Q.tLand + 0.5); if(r0 !== run) return null;
        return ends(o, hit, hit === 0 ? NAME + T(" can’t get it back", " haalt hem niet") : T("You can’t get it back", "Die haal je niet meer"));
      }
      const land = d === 0 ? near[a.right] : far;
      if(d === 0) later(650).then(() => { if(r0 === run){ ui(""); V.spots(null); clearMsg(); } });
      if(g === 0) W = H.heavier(W, SURF, rnd);
      const pl = await meet(D, land, W, r0, back); if(pl == null) return null;
      V.slow(1, 90);
      P = strike(D, back, { T: HEAT_T[W], rpm: RPM[W], heat: W, pl });
      recover(Hit, V.gt + 1.6);
      hit = d;
    }
    return ends(o, rnd() < 0.5 ? 0 : 1, T("A long one", "Een lange"));
  }
  /* D defends, N is at the net */
  async function netBall(o, D, N, P, r0){
    const land = [rnd() < 0.5 ? -2 : 2, D.side * 8.4];
    const finish = async (Q, text, w) => { const beaten = w === 0 ? cpu : me; beaten.go(beaten.x + 1, beaten.z, V.gt + 0.1, V.gt + 0.8); await V.until(V.gt + Math.min(Q.len * 0.6, Q.tLand + 0.5)); return r0 === run ? ends(o, w, text) : null; };
    /* N puts it away: the weak ball comes to the racket, forehand or backhand by where it's coming from */
    const volley = async () => {
      const fore = (V.ball.p[0] - N.x) * N.side > 0, c = A.CLIPS[fore ? "vf" : "vb"], open = spot(N, D.x > 0 ? -3 : 3, 7.5), yaw = Math.atan2(open[0] - N.x, open[1] - N.z);
      const s = Math.sin(yaw), co = Math.cos(yaw), p = [N.x + (c.spot[0] * co + c.spot[2] * s), c.spot[1], N.z + (-c.spot[0] * s + c.spot[2] * co)];
      const Q = FL.shot({ from: V.ball.p.slice(), land: [p[0], p[2]], y: p[1], T: 0.62, rpm: 1500, surf: SURF, stop: true });
      V.follow(Q, V.gt, 1); R.sfx.pock(0.9); shots++;
      N.swing(c, V.gt + Q.tSeg, yaw, V.gt);
      await V.until(V.gt + Q.tSeg); if(r0 !== run) return null;
      V.slow(1, 60);
      return strike(N, open, { T: 0.62, rpm: 1200, heat: 2, clear: 0.02 });
    };
    /* N smashes a lob that fell short */
    const smash = async () => {
      const c = A.CLIPS.sm, Q = FL.shot({ from: V.ball.p.slice(), land: [N.x, N.side * 5.2], T: 1.5, rpm: 900, surf: SURF });
      V.follow(Q, V.gt, 0); fx(Q, 0); R.sfx.pock(0.7); shots++;
      const tt = Q.meetAir(c.spot[1]), q = Q.at(tt, [0, 0, 0]), open = spot(N, D.x > 0 ? -3.2 : 3.2, 9), yaw = Math.atan2(open[0] - q[0], open[1] - q[2]), feet = A.feet(c, q, yaw), t = V.gt + tt;
      N.go(feet[0], feet[1], V.gt + 0.1, t - 0.2); N.swing(c, t, yaw, V.gt);
      await V.until(t); if(r0 !== run) return null;
      return strike(N, open, { T: 0.4, rpm: 800, heat: 2, clear: 0.02 });
    };
    /* D gets to the ball, ready to send it */
    const dReach = async at => { const pl = await meet(D, at || land, 2, r0, spot(D, 0, 9)); if(pl == null) return null; V.slow(1, 90); return pl; };
    const pass = pl => strike(D, spot(D, (N.x >= 0 ? -1 : 1) * 3.7, 9.6), { T: 0.8, rpm: 1700, heat: 2, clear: 0.03, pl });
    const hide = () => later(600).then(() => { if(r0 === run){ ui(""); V.spots(null); clearMsg(); } });

    if(D === me){
      head(NAME + T(" is at the net", " staat aan het net"), null, true, liveScore); $("#c3-q").textContent = T("Pass or lob?", "Passeren of lobben?"); asking(true);
      crawl(P, 6); V.cam("hang", 2.4);
      ui('<button class="spot" data-c="p" style="left:25.5%;top:88%">' + T("Pass", "Passeer") + "<small>" + T("Hard, short clock", "Moeilijk, korte klok") + '</small></button><button class="spot" data-c="l" style="left:74.5%;top:88%">' + T("Lob", "Lob") + "<small>" + esc(T("Easy, then " + NAME + " answers Hard", "Makkelijk, dan " + NAME + " Moeilijk")) + "</small></button>");
      const c = await new Promise(res => { hud.querySelectorAll("[data-c]").forEach(b => b.onclick = () => res(b.dataset.c)); if(hooks.bot) V.real(500).then(() => res(rnd() < 0.5 ? "p" : "l")); });
      if(r0 !== run) return null;
      ui(""); asking(false);
      if(c === "p"){
        const a = await liveAsk(2, T("The pass", "De passing"), 0.75, 2, null, P, RALLY); if(a == null) return null;
        hide();
        const pl = await dReach(RALLY[a.right]); if(pl == null) return null;
        if(a.g === 0) return finish(pass(pl), T("Passed!", "Gepasseerd!"), 0);
        const Q = await volley(); if(Q == null) return null;
        return finish(Q, T("Volleyed away", "Weggevolleyd"), 1);
      }
      const a = await liveAsk(0, T("The lob", "De lob"), 1, 0, null, P, RALLY); if(a == null) return null;
      hide();
      if((await dReach(RALLY[a.right])) == null) return null;
      if(a.g !== 0){ const Q = await smash(); if(Q == null) return null; return finish(Q, T("Lob falls short: smashed", "Lob te kort: gesmasht"), 1); }
      return lobOver(o, me, cpu, r0);
    }
    /* you're at the net: the other side picks */
    const lob = rnd() < 0.45;
    if(!lob){
      const g = await cpuThink(2, NAME + T("’s pass", " passeert"), P); if(g == null) return null;
      const pl = await dReach(); if(pl == null) return null;
      if(g === 0) return finish(pass(pl), NAME + T(" passes you", " passeert je"), 1);
      const Q = await volley(); if(Q == null) return null;
      return finish(Q, T("You put it away", "Je volleyt hem weg"), 0);
    }
    const g = await cpuThink(0, NAME + T("’s lob", " lobt"), P); if(g == null) return null;
    if((await dReach()) == null) return null;
    if(g !== 0){ const Q = await smash(); if(Q == null) return null; return finish(Q, T("Short lob: smash", "Korte lob: smash"), 0); }
    return lobOver(o, cpu, me, r0);
  }
  /* a good lob: over the net player, who turns and runs. The answer decides who gets there */
  async function lobOver(o, D, N, r0){
    const land = [N.x * 0.4, N.side * 10.4], Q = strike(D, land, { T: 1.75, rpm: 900, heat: 0 });
    V.spots(null);
    const c = A.CLIPS.fh1, t = Q.meet(c.spot[1]), q = Q.at(t, [0, 0, 0]);
    N.go(q[0] + 0.5, N.side * (BASE + 0.3), V.gt + 0.15, V.gt + t + 0.05);
    await V.until(V.gt + 0.95); if(r0 !== run) return null;
    if(N === me){
      msg(NAME + T(" lobs you: run!", " lobt je: rennen!"), "bad"); await later(500); clearMsg();
      const a = await liveAsk(2, T("Turn and run", "Draai je om"), 0.8, 2, null, Q, null); if(a == null) return null;
      ui(""); V.slow(1, 170);
      await V.until(V.gt + 0.7); if(r0 !== run) return null;
      return ends(o, a.g === 0 ? 0 : 1, a.g === 0 ? T("You got back!", "Je haalde hem!") : T("It drops in behind you", "Hij valt achter je"));
    }
    const h = await cpuThink(2, NAME + T(" turns and runs", " draait zich om"), Q); if(h == null) return null;
    V.slow(1, 170); await V.until(V.gt + 0.7); if(r0 !== run) return null;
    return ends(o, h === 0 ? 1 : 0, h === 0 ? NAME + T(" gets there", " haalt hem") : T("It drops in!", "Hij valt erin!"));
  }

  /* ---------- the court, as app/match.js sees it ---------- */
  function dress(P){
    if(me){ me.free(); cpu.free(); }
    opp = P[1].o; NAME = String(P[1].name).split(" ")[0];
    const f = FACE[opp.id], woman = !!WOMEN[opp.id], base = V.players.looksOf(opp.name, {});
    me = A.make(V, { shirt: "#f2f3ef", shorts: "#1b2a4a", socks: "#f2f3ef", side: 1, seed: 11, frame: P[0].col, looks: { boot: SHOE } });
    cpu = A.make(V, { shirt: P[1].col, shorts: woman ? P[1].col : "#20242c", socks: "#f2f3ef", side: -1, seed: 29, frame: "#e8ebe6", slim: woman ? HAIRS[f[1]] : null,
      looks: Object.assign(base, { skin: SKINS[f[0]], skinI: f[0], hair: HAIRS[f[1]], style: f[2], beard: f[3], boot: SHOE }) });
    me.gripReady.copy(A.gripReady); cpu.gripReady.copy(A.gripReady);
    V.focus = () => me.x; V.deep = () => Math.max(0, me.z - BASE - 0.4);
  }
  async function mount(el, o){
    const r0 = ++run; host = el; SURF = o.surf; onAsk = o.onAsk;
    if(!V.init(el, o.surf)) throw new Error("no WebGL");
    await A.load("app/3d/clips.json");
    if(r0 !== run) return null;
    A.calibrate(V); dress(o.players);
    hud = document.createElement("div"); hud.className = "c3d-hud";
    hud.innerHTML = '<div id="c3-vig"></div><i id="c3-ring"></i><i id="c3-goal"></i><div id="c3-card"><div id="c3-head"><span id="c3-lab"></span><b id="c3-sc"></b></div><p id="c3-q"></p><div id="c3-clk"><i id="c3-bar"></i></div></div><div id="c3-ui"></div><div id="c3-msg"></div><div id="c3-hint"></div><div id="c3-dip"></div>';
    el.appendChild(hud);
    const offTick = V.onTick(gdt => { me.update(V.gt, gdt); cpu.update(V.gt, gdt); });
    /* off the screen, no work: BALL hides this frame with display:none, which doesn't change document.hidden */
    const sync = () => V.pause("hide", !!(document.hidden || R.hidden));
    const onMsg = e => { if(e.data && e.data.ball) sync(); };
    window.addEventListener("message", onMsg); document.addEventListener("visibilitychange", sync);
    /* a phone can take the graphics away. Back within a moment: carry on. If not, match.js moves to the flat court */
    let lostT = 0;
    gaveUp = new Promise(res => { giveUp = res; });
    V.onLost = gone => { clearTimeout(lostT); if(gone) lostT = setTimeout(() => { if(giveUp) giveUp({ lost: true }); }, 2500); };
    V.frames.n = 0; V.frames.ms = 0; V.frames.slow = 0;
    V.start();
    sync();
    let stopped = false;
    return {
      /* match.js's calls: ready() between points, point() plays one and says how it ended */
      ready, cheer(){},
      point: p => { const r1 = run, play = setupP.then(() => r1 !== run ? null : (p.live ? livePoint : quiet)(p)); return Promise.race([play, gaveUp]); },
      fps: () => V.frames.n ? Math.round(1000 / (V.frames.ms / V.frames.n)) : null,
      stop(){
        if(stopped) return; stopped = true;
        run++; V.clear(); V.stop(); offTick(); clearTimeout(lostT); V.onLost = null;
        window.removeEventListener("message", onMsg); document.removeEventListener("visibilitychange", sync);
        if(hud){ hud.remove(); hud = null; }
        V.pause("hide", false);
      }
    };
  }
  R.m3d = { mount, hooks, release: () => { run++; V.release(); me = cpu = null; }, get me(){ return me; }, get cpu(){ return cpu; } };
})(window.RACKET);
