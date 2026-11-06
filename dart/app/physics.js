/* Snooker physics for Frame: a 12 ft table seen from above, in millimetres. x runs across
   (0 = left cushion … W), y along the table (0 = top cushion at the black end … L = baulk
   cushion), so on a phone the baulk end is at the bottom, where the player stands.
   Balls roll in straight lines and slow down (rolling friction plus a little drag), bounce off
   each other (equal masses, nearly elastic) and off the cushion noses, and drop once they pass
   a pocket mouth. Each pocket has two round knuckles (the jaws), so a ball that is off line
   rattles out. Collisions are found by their exact time inside a step, so thin cuts come out
   right. Everything is deterministic: the same shot from the same position always gives the
   same result, which lets the computer try shots in advance and lets the tests check them.
   Spin: the cue ball carries follow (+) or screw (-). It wears off over the distance to the
   first contact and takes effect just after it (the cue ball follows through or comes back). */
(function(D){
  const W = 1778, L = 3569, R = 26.25, BAULK = L - 737, DR = 292, CX = W / 2;
  /* pockets: corner cushions stop C mm from the corner, middle ones H mm each side of the
     middle; the knuckles (radius RK) sit just outside the cushion line so a ball running along
     the cushion still drops. A ball is potted DROP mm past the line through the knuckles. */
  const C = 74, H = 62, RK = 8, DROP = 4;
  const SPOT = { yellow: [CX + DR, BAULK], green: [CX - DR, BAULK], brown: [CX, BAULK], blue: [CX, L / 2], pink: [CX, L / 4], black: [CX, 324] };
  const COLOURS = ["yellow", "green", "brown", "blue", "pink", "black"];
  /* friction (mm/s² and 1/s), restitution, spin */
  const ROLL = 150, DRAG = 0.25, STOP = 4, E_BALL = 0.94, E_CUSH = 0.76, T_CUSH = 0.96, SPIN_FADE = 1600, SPIN_K = 0.75, NAT = 0.1, SPIN_TAKE = 0.1;
  const VMAX = 4300, VMIN = 250;

  const s2 = Math.SQRT1_2;
  const POCKETS = [];
  [[0, 0], [W, 0], [0, L], [W, L]].forEach(([sx, sy]) => {
    const dx = sx ? -1 : 1, dy = sy ? -1 : 1, n = [dx * s2, dy * s2], k = [[sx + dx * C, sy - dy * RK], [sx - dx * RK, sy + dy * C]];
    const m = [(k[0][0] + k[1][0]) / 2, (k[0][1] + k[1][1]) / 2];
    POCKETS.push({ corner: true, at: [sx, sy], n, k, off: n[0] * k[0][0] + n[1] * k[0][1], aim: [m[0] - n[0] * 6, m[1] - n[1] * 6] });
  });
  [0, W].forEach(sx => {
    const dx = sx ? -1 : 1, n = [dx, 0], k = [[sx - dx * RK, L / 2 - H], [sx - dx * RK, L / 2 + H]];
    POCKETS.push({ corner: false, at: [sx, L / 2], n, k, off: dx * (sx - dx * RK), aim: [sx - dx * 14, L / 2] });
  });
  /* order: top-left, top-right, bottom-left, bottom-right, middle-left, middle-right */
  const KNUCKLES = [].concat(...POCKETS.map(p => p.k));
  /* the cushion noses as limits for a ball centre: n·p >= d while the other axis is in [lo, hi] */
  const WALLS = [
    { n: [0, 1], d: R, ax: 0, lo: C, hi: W - C }, { n: [0, -1], d: -(L - R), ax: 0, lo: C, hi: W - C },
    { n: [1, 0], d: R, ax: 1, lo: C, hi: L / 2 - H }, { n: [1, 0], d: R, ax: 1, lo: L / 2 + H, hi: L - C },
    { n: [-1, 0], d: -(W - R), ax: 1, lo: C, hi: L / 2 - H }, { n: [-1, 0], d: -(W - R), ax: 1, lo: L / 2 + H, hi: L - C }
  ];

  const kind = id => id === "cue" ? "cue" : /^r\d/.test(id) ? "red" : id;

  /* ---------- the world ---------- */
  /* reds: 6 or 15, in the triangle behind the pink; the colours on their spots; the cue ball in the D */
  function rack(reds, cue){
    const balls = [{ id: "cue", x: cue ? cue[0] : CX - DR * 0.55, y: cue ? cue[1] : BAULK + 90, vx: 0, vy: 0, on: true }];
    COLOURS.forEach(c => balls.push({ id: c, x: SPOT[c][0], y: SPOT[c][1], vx: 0, vy: 0, on: true }));
    const apex = SPOT.pink[1] - 2 * R - 1, dy = 2 * R * Math.sin(Math.PI / 3) + 0.2;
    let n = 0;
    for(let row = 0; n < reds; row++) for(let k = 0; k <= row && n < reds; k++)
      balls.push({ id: "r" + n++, x: CX + (k - row / 2) * (2 * R + 0.2), y: apex - row * dy, vx: 0, vy: 0, on: true });
    return world(balls);
  }
  const world = balls => ({ balls, time: 0, first: null, ev: [], cushFirst: false });
  const clone = w => ({ balls: w.balls.map(b => Object.assign({}, b)), time: 0, first: null, ev: [], cushFirst: false });
  const ball = (w, id) => w.balls.find(b => b.id === id);
  const moving = b => b.on && (b.vx || b.vy || b.sv);
  const still = w => !w.balls.some(moving);

  /* strike the cue ball: angle a (radians, table axes), speed v (mm/s), spin s (-1 screw … +1 follow) */
  function strike(w, a, v, s){
    const c = ball(w, "cue");
    c.vx = Math.cos(a) * v; c.vy = Math.sin(a) * v; c.spin = s || 0; c.travel = 0; c.sv = null;
    w.first = null; w.ev = []; w.cushFirst = false; w.time = 0;
  }

  /* ---------- time of impact ---------- */
  /* earliest t in [0, max] at which |p + v t| = dist while closing in; Infinity if never */
  function toi(px, py, vx, vy, dist, max){
    const pv = px * vx + py * vy;
    if(pv >= 0) return Infinity;
    const vv = vx * vx + vy * vy, pp = px * px + py * py - dist * dist;
    if(pp <= 0) return 0;
    const disc = pv * pv - vv * pp;
    if(disc < 0) return Infinity;
    const t = (-pv - Math.sqrt(disc)) / vv;
    return t >= 0 && t <= max ? t : Infinity;
  }
  function nextEvent(w, max){
    const B = w.balls;
    let best = null, bt = max;
    for(let i = 0; i < B.length; i++){
      const a = B[i]; if(!a.on) continue;
      const am = a.vx || a.vy;
      if(am){
        for(const wl of WALLS){
          const vn = wl.n[0] * a.vx + wl.n[1] * a.vy; if(vn >= 0) continue;
          const dist = wl.n[0] * a.x + wl.n[1] * a.y - wl.d;
          const t = dist <= 0 ? (dist > -R ? 0 : Infinity) : dist / -vn;
          if(t >= bt) continue;
          const u = wl.ax ? a.y + a.vy * t : a.x + a.vx * t;
          if(u < wl.lo || u > wl.hi) continue;
          bt = t; best = { k: "wall", a: i, n: wl.n };
        }
        for(const kn of KNUCKLES){
          const t = toi(a.x - kn[0], a.y - kn[1], a.vx, a.vy, R + RK, bt);
          if(t < bt){ bt = t; best = { k: "knuckle", a: i, c: kn }; }
        }
      }
      for(let j = i + 1; j < B.length; j++){
        const b = B[j]; if(!b.on || !(am || b.vx || b.vy)) continue;
        const t = toi(b.x - a.x, b.y - a.y, b.vx - a.vx, b.vy - a.vy, 2 * R, bt);
        if(t < bt){ bt = t; best = { k: "ball", a: i, b: j }; }
      }
    }
    if(best) best.t = bt;
    return best;
  }

  /* ---------- resolving ---------- */
  function bounce(w, a, nx, ny, kind){
    const vn = a.vx * nx + a.vy * ny; if(vn >= 0) return;
    const tx = -ny, ty = nx, vt = a.vx * tx + a.vy * ty;
    a.vx = -vn * E_CUSH * nx + vt * T_CUSH * tx; a.vy = -vn * E_CUSH * ny + vt * T_CUSH * ty;
    if(a.id === "cue" && !w.first){ w.cushFirst = true; a.spin = 0; }
    w.ev.push({ t: w.time, k: kind, a: a.id, s: -vn });
  }
  function collide(w, a, b){
    let nx = b.x - a.x, ny = b.y - a.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny, rel = va - vb;
    if(rel <= 0) return;
    const cue = a.id === "cue" ? a : b.id === "cue" ? b : null, other = cue === a ? b : a;
    const firstHit = cue && !w.first;
    const pre = firstHit ? [cue.vx, cue.vy] : null;
    const j = rel * (1 + E_BALL) / 2;
    a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
    if(firstHit){
      w.first = other.id;
      /* the spin left after the run to the object ball, then it takes along the old direction */
      const fade = Math.exp(-(cue.travel || 0) / SPIN_FADE), se = (cue.spin || 0) * fade + NAT * (1 - fade);
      const sp = Math.hypot(pre[0], pre[1]) || 1, push = se * SPIN_K * j;
      cue.sv = [pre[0] / sp * push, pre[1] / sp * push];
      cue.spin = 0;
    }
    w.ev.push({ t: w.time, k: "ball", a: a.id, b: b.id, s: rel });
  }
  function advance(w, t){
    if(t <= 0) return;
    for(const b of w.balls) if(b.on && (b.vx || b.vy)){
      b.x += b.vx * t; b.y += b.vy * t;
      if(b.id === "cue" && !w.first) b.travel = (b.travel || 0) + Math.hypot(b.vx, b.vy) * t;
    }
  }
  /* which pocket a ball has dropped into (or -1) */
  function inPocket(b){
    for(let i = 0; i < POCKETS.length; i++){
      const p = POCKETS[i];
      if(p.n[0] * b.x + p.n[1] * b.y < p.off - DROP){
        /* only inside the mouth's own corner/side of the table */
        if(p.corner ? Math.abs(b.x - p.at[0]) < C + 30 && Math.abs(b.y - p.at[1]) < C + 30 : Math.abs(b.y - p.at[1]) < H + 20) return i;
      }
    }
    if(b.x < -60 || b.x > W + 60 || b.y < -60 || b.y > L + 60){
      let k = 0, best = Infinity;
      POCKETS.forEach((p, i) => { const d = Math.hypot(b.x - p.at[0], b.y - p.at[1]); if(d < best){ best = d; k = i; } });
      return k;
    }
    return -1;
  }
  function drops(w){
    for(const b of w.balls){
      if(!b.on) continue;
      const p = inPocket(b);
      if(p >= 0){ b.on = false; b.vx = b.vy = 0; b.sv = null; b.pocket = p; w.ev.push({ t: w.time, k: "pot", a: b.id, p, s: 0 }); }
    }
  }
  function friction(w, dt){
    for(const b of w.balls){
      if(!b.on) continue;
      if(b.sv){
        const f = 1 - Math.exp(-dt / SPIN_TAKE);
        b.vx += b.sv[0] * f; b.vy += b.sv[1] * f; b.sv[0] -= b.sv[0] * f; b.sv[1] -= b.sv[1] * f;
        if(Math.abs(b.sv[0]) + Math.abs(b.sv[1]) < 2) b.sv = null;
      }
      if(!b.vx && !b.vy) continue;
      const s = Math.hypot(b.vx, b.vy), ns = s - (ROLL + DRAG * s) * dt;
      if(ns <= STOP && !b.sv){ b.vx = b.vy = 0; continue; }
      const k = Math.max(0, ns) / s; b.vx *= k; b.vy *= k;
    }
  }
  /* move the world on by dt seconds */
  function step(w, dt){
    let left = dt, guard = 0;
    while(left > 1e-9 && guard++ < 200){
      const ev = nextEvent(w, left), t = ev ? ev.t : left;
      advance(w, t); w.time += t; left -= t;
      drops(w);
      if(!ev) break;
      const a = w.balls[ev.a];
      if(!a.on) continue;
      if(ev.k === "ball"){ const b = w.balls[ev.b]; if(b.on) collide(w, a, b); }
      else if(ev.k === "wall") bounce(w, a, ev.n[0], ev.n[1], "cush");
      else { let nx = a.x - ev.c[0], ny = a.y - ev.c[1]; const d = Math.hypot(nx, ny) || 1; bounce(w, a, nx / d, ny / d, "jaw"); }
    }
    friction(w, dt);
  }
  const DT = 1 / 120;
  /* play the shot out. opts.frames: record every ball's position at 60 fps for the animation.
     Returns { first, potted: [ids in order], cueIn, cush (cushions hit after the first contact), ev, frames, time } */
  function run(w, opts){
    opts = opts || {};
    const frames = opts.frames ? [] : null, max = opts.max || 30;
    let n = 0;
    if(frames) frames.push(snap(w));
    while(!still(w) && n * DT < max){
      step(w, DT); n++;
      if(frames && n % 2 === 0) frames.push(snap(w));
    }
    if(frames) frames.push(snap(w));
    const pots = w.ev.filter(e => e.k === "pot");
    return { first: w.first, potted: pots.map(e => e.a), pockets: pots.map(e => e.p), cueIn: pots.some(e => e.a === "cue"), ev: w.ev, frames, time: w.time, cushFirst: w.cushFirst };
  }
  const snap = w => w.balls.map(b => b.on ? [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10] : null);

  /* ---------- placing balls ---------- */
  const free = (w, x, y, except) => w.balls.every(b => !b.on || b.id === except || Math.hypot(b.x - x, b.y - y) >= 2 * R + 0.5);
  const inD = (x, y) => y >= BAULK && Math.hypot(x - CX, y - BAULK) <= DR;
  /* a potted colour goes back: its own spot, else the highest free spot, else as near as
     possible to its own spot towards the top cushion (then towards the baulk) */
  function respot(w, id){
    const b = ball(w, id); if(!b) return;
    b.vx = b.vy = 0; b.sv = null;
    const put = (x, y) => { b.x = x; b.y = y; b.on = true; delete b.pocket; return true; };
    if(free(w, SPOT[id][0], SPOT[id][1], id)) return put(SPOT[id][0], SPOT[id][1]);
    for(const c of COLOURS.slice().reverse()) if(free(w, SPOT[c][0], SPOT[c][1], id)) return put(SPOT[c][0], SPOT[c][1]);
    const [x, y0] = SPOT[id];
    for(let d = 1; y0 - d >= R; d++) if(free(w, x, y0 - d, id)) return put(x, y0 - d);
    for(let d = 1; y0 + d <= L - R; d++) if(free(w, x, y0 + d, id)) return put(x, y0 + d);
  }

  /* ---------- aiming helpers ---------- */
  /* the first ball the cue ball meets along angle a: { id, t (distance), gx, gy (the ghost
     cue ball at contact), ox, oy (where the object ball goes, unit) } or the cushion point */
  function aimLine(w, a, from){
    const c = from || ball(w, "cue"), dx = Math.cos(a), dy = Math.sin(a);
    let best = null, bt = Infinity;
    for(const b of w.balls){
      if(!b.on || b.id === "cue" || b === c) continue;
      const t = toi(c.x - b.x, c.y - b.y, dx, dy, 2 * R, 1e5);
      if(t < bt){ bt = t; best = b; }
    }
    if(best){
      const gx = c.x + dx * bt, gy = c.y + dy * bt, nx = (best.x - gx) / (2 * R), ny = (best.y - gy) / (2 * R);
      const dot = dx * nx + dy * ny;
      return { id: best.id, t: bt, gx, gy, ox: nx, oy: ny, cx: dx - dot * nx, cy: dy - dot * ny, cut: Math.acos(Math.max(-1, Math.min(1, dot))) };
    }
    /* no ball: to the cushion */
    let t = Infinity;
    if(dx > 0) t = Math.min(t, (W - R - c.x) / dx); if(dx < 0) t = Math.min(t, (R - c.x) / dx);
    if(dy > 0) t = Math.min(t, (L - R - c.y) / dy); if(dy < 0) t = Math.min(t, (R - c.y) / dy);
    return { id: null, t, gx: c.x + dx * t, gy: c.y + dy * t };
  }
  /* is the straight path of a ball centre from p to q clear of every other ball (2R)? */
  function clear(w, p, q, skip){
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    return w.balls.every(b => {
      if(!b.on || skip.includes(b.id)) return true;
      const t = (b.x - p[0]) * ux + (b.y - p[1]) * uy;
      if(t < 0 || t > len) return Math.hypot(b.x - q[0], b.y - q[1]) >= 2 * R && Math.hypot(b.x - p[0], b.y - p[1]) >= 2 * R;
      return Math.abs((b.x - p[0]) * uy - (b.y - p[1]) * ux) >= 2 * R;
    });
  }
  /* distance a ball rolls from speed v, and the speed needed to roll d (the friction model) */
  function rollDist(v){
    const k = ROLL / DRAG, t = Math.log((v + k) / k) / DRAG;
    return (v + k) * (1 - Math.exp(-DRAG * t)) / DRAG - k * t;
  }
  function speedFor(d){
    let lo = 0, hi = 9000;
    for(let i = 0; i < 40; i++){ const m = (lo + hi) / 2; if(rollDist(m) < d) lo = m; else hi = m; }
    return hi;
  }
  /* speed left after rolling d from v */
  function speedAfter(v, d){
    const total = rollDist(v); if(d >= total) return 0;
    let lo = 0, hi = v;
    for(let i = 0; i < 40; i++){ const m = (lo + hi) / 2; if(rollDist(m) < total - d) lo = m; else hi = m; }
    return hi;
  }
  /* the power slider (0..1) to and from a cue ball speed: finer at the soft end */
  const powerToSpeed = p => VMIN + (VMAX - VMIN) * Math.pow(Math.max(0, Math.min(1, p)), 1.7);
  const speedToPower = v => Math.pow(Math.max(0, Math.min(1, (v - VMIN) / (VMAX - VMIN))), 1 / 1.7);

  D.phys = { W, L, R, BAULK, DR, CX, C, H, RK, SPOT, COLOURS, POCKETS, KNUCKLES, WALLS, VMAX, VMIN, DT,
    kind, rack, world, clone, ball, still, strike, step, run, free, inD, respot, aimLine, clear,
    rollDist, speedFor, speedAfter, powerToSpeed, speedToPower, inPocket };
})(window.DART);
