/* The ball's flight: drag, spin, a bounce per surface, and a solver that lands a shot on a chosen spot at a
   chosen time. Plain script, no three.js, so `node _tests/flight-test.js` can check it.
   Court: metres, y up, x across, z along, the net at z 0, you at +z. From _plans/match-3d/ball-physics-prototype.mjs.

   A path is solved whole before the ball leaves the racket: where it lands, when it can be hit, how high it
   clears the net. That is what lets the quiz pick the shot while the physics still look real. */
(function(root){
  const MASS = 0.0577, RAD = 0.0335, AREA = Math.PI * RAD * RAD, RHO = 1.2, G = 9.81, INERTIA = 0.55 * MASS * RAD * RAD;
  const K = 0.5 * RHO * AREA / MASS, CD = 0.55, HZ = 120;
  const Cl = S => Math.min(0.35, 0.06 + 0.45 * S); // through Cross & Lindsey's range
  const SURF = { hard: { e: 0.75, mu: 0.6, ex: 0.15 }, clay: { e: 0.85, mu: 0.85, ex: 0.15 }, grass: { e: 0.68, mu: 0.5, ex: 0.15 } };

  function accel(v, w, a){
    const s = Math.hypot(v[0], v[1], v[2]) || 1e-9, wm = Math.hypot(w[0], w[1], w[2]), cl = wm > 0 ? Cl(RAD * wm / s) : 0;
    const cx = w[1] * v[2] - w[2] * v[1], cy = w[2] * v[0] - w[0] * v[2], cz = w[0] * v[1] - w[1] * v[0], cm = Math.hypot(cx, cy, cz) || 1e-9, m = K * cl * s * s / cm;
    a[0] = -K * CD * s * v[0] + m * cx; a[1] = -G - K * CD * s * v[1] + m * cy; a[2] = -K * CD * s * v[2] + m * cz;
  }
  const a1 = [0, 0, 0], a2 = [0, 0, 0], vm = [0, 0, 0];
  function step(p, v, w, h){
    accel(v, w, a1);
    for(let j = 0; j < 3; j++) vm[j] = v[j] + a1[j] * h / 2;
    accel(vm, w, a2);
    for(let j = 0; j < 3; j++){ p[j] += vm[j] * h; v[j] += a2[j] * h; }
  }
  function fly(p0, v0, w, T){
    const n = Math.max(1, Math.round(T * 240)), h = T / n, p = p0.slice(), v = v0.slice();
    for(let i = 0; i < n; i++) step(p, v, w, h);
    return { p, v };
  }
  function solve3(m, b){
    const [[e, f, g], [h, i, j], [k, l, n]] = m, D = e * (i * n - j * l) - f * (h * n - j * k) + g * (h * l - i * k);
    return [(b[0] * (i * n - j * l) - f * (b[1] * n - j * b[2]) + g * (b[1] * l - i * b[2])) / D,
      (e * (b[1] * n - j * b[2]) - b[0] * (h * n - j * k) + g * (h * b[2] - b[1] * k)) / D,
      (e * (i * b[2] - b[1] * l) - f * (h * b[2] - b[1] * k) + b[0] * (h * l - i * k)) / D];
  }
  /* the launch that puts the ball at p1 after T seconds: Newton from the drag-free parabola */
  function solve(p0, p1, T, w){
    let v = [(p1[0] - p0[0]) / T, (p1[1] - p0[1]) / T + 0.5 * G * T, (p1[2] - p0[2]) / T];
    for(let it = 0; it < 12; it++){
      const f = fly(p0, v, w, T).p, r = [f[0] - p1[0], f[1] - p1[1], f[2] - p1[2]];
      if(Math.hypot(r[0], r[1], r[2]) < 0.002) break;
      const J = [[], [], []], e = 0.01;
      for(let c = 0; c < 3; c++){ const u = v.slice(); u[c] += e; const g = fly(p0, u, w, T).p; for(let k = 0; k < 3; k++) J[k][c] = (g[k] - f[k]) / e; }
      const d = solve3(J, r); v = [v[0] - d[0], v[1] - d[1], v[2] - d[2]];
    }
    return v;
  }
  /* slide, or grip if friction can stop the slip */
  function bounce(v, w, s){
    const Jn = MASS * (1 + s.e) * Math.abs(v[1]), ux = v[0] + RAD * w[2], uz = v[2] - RAD * w[0], u = Math.hypot(ux, uz) || 1e-9;
    const Jt = Math.min(s.mu * Jn, (1 + s.ex) * MASS * u / (1 + MASS * RAD * RAD / INERTIA)), jx = -Jt * ux / u, jz = -Jt * uz / u;
    return { v: [v[0] + jx / MASS, -s.e * v[1], v[2] + jz / MASS], w: [w[0] - RAD * jz / INERTIA, w[1], w[2] + RAD * jx / INERTIA] };
  }
  /* topspin (+rpm) turns the top of the ball the way it's flying */
  function spinAxis(dx, dz, rpm){ const l = Math.hypot(dx, dz) || 1, r = rpm * 2 * Math.PI / 60; return [r * dz / l, 0, -r * dx / l]; }

  /* A whole shot. from: [x,y,z]; land: [x,z]; T: seconds to the bounce; rpm; surf. With y, the ball is at that
     height over the spot after T seconds instead, and flies on (a ball met in the air, or sent into the net).
     stop: the path ends there. Otherwise it runs on through more bounces until it stops at the fence or dies. */
  function shot(o){
    const from = o.from, surf = SURF[o.surf || "hard"], dx = o.land[0] - from[0], dz = o.land[1] - from[2], rpm = o.rpm == null ? 2200 : o.rpm, w0 = spinAxis(dx, dz, rpm);
    let w = w0;
    const air = o.y != null, land = [o.land[0], air ? o.y : RAD, o.land[1]], v0 = solve(from, land, o.T, w), dt = 1 / HZ, n0 = Math.max(1, Math.round(o.T * HZ)), h = o.T / n0;
    const pts = [from[0], from[1], from[2]], p = from.slice(), v = v0.slice();
    let netY = null, netT = null, pz = p[2];
    for(let i = 1; i <= n0; i++){
      for(let j = 0; j < 4; j++) step(p, v, w, h / 4);
      if(netY == null && Math.sign(pz) !== Math.sign(p[2])){ netY = p[1]; netT = i * h; }
      pz = p[2]; pts.push(p[0], p[1], p[2]);
    }
    const bounces = [], tSeg = n0 * h; let tLand = tSeg, vLand = v.slice(), apex = 0, tApex = tSeg, t = tSeg, b;
    if(!air){ p[1] = RAD; bounces.push({ t: tSeg, x: p[0], z: p[2] }); b = bounce(v, w, surf); v[0] = b.v[0]; v[1] = b.v[1]; v[2] = b.v[2]; w = b.w; }
    const max = o.stop ? 0 : (o.tail == null ? 3 : o.tail) * HZ;
    for(let k = 0; k < max; k++){
      for(let j = 0; j < 4; j++) step(p, v, w, dt / 4);
      t += dt;
      if(netY == null && Math.sign(pz) !== Math.sign(p[2])){ netY = p[1]; netT = t; }
      pz = p[2];
      if(bounces.length === 1 && p[1] > apex){ apex = p[1]; tApex = t; }
      if(p[1] < RAD){
        p[1] = RAD;
        if(Math.abs(v[1]) < 0.5){ v[1] = 0; w = [0, 0, 0]; v[0] *= 0.992; v[2] *= 0.992; if(Math.hypot(v[0], v[2]) < 0.2){ pts.push(p[0], p[1], p[2]); break; } }
        else {
          if(!bounces.length){ tLand = t; vLand = v.slice(); tApex = t; }
          b = bounce(v, w, surf); v[0] = b.v[0]; v[1] = b.v[1]; v[2] = b.v[2]; w = b.w; bounces.push({ t, x: p[0], z: p[2] });
        }
      }
      if(Math.abs(p[2]) > (o.fence || 19) || Math.abs(p[0]) > 9.4){ pts.push(p[0], p[1], p[2]); break; }
      pts.push(p[0], p[1], p[2]);
    }
    return make(pts, h, dt, n0, { from, v0, w0, tLand, tSeg, vLand, vEnd: v.slice(), netY, netT, bounces, apex, tApex, rpm });
  }
  /* the samples: h apart up to the bounce, dt after it */
  function make(pts, h, dt, n0, extra){
    const P = Object.assign({ pts: new Float32Array(pts), n: pts.length / 3, h, dt, n0, len: extra.tSeg + (pts.length / 3 - 1 - n0) * dt, kick: null }, extra);
    /* position at time t. A kick is the velocity the ball had before a re-aim, faded out over a few hundredths,
       so the turn has no corner in it */
    P.at = (t, out) => {
      const f = t <= P.tSeg ? t / h : n0 + (t - P.tSeg) / dt, cl = Math.max(0, Math.min(P.n - 1.0001, f)), i = cl | 0, a = cl - i, s = P.pts;
      out[0] = s[i * 3] + (s[i * 3 + 3] - s[i * 3]) * a; out[1] = s[i * 3 + 1] + (s[i * 3 + 4] - s[i * 3 + 1]) * a; out[2] = s[i * 3 + 2] + (s[i * 3 + 5] - s[i * 3 + 2]) * a;
      if(P.kick && t > 0){ const e = t * Math.exp(-t / 0.05); out[0] += P.kick[0] * e; out[1] += P.kick[1] * e; out[2] += P.kick[2] * e; }
      return out;
    };
    P.vel = (t, out) => { const a = P.at(t - 0.004, [0, 0, 0]), b = P.at(t + 0.004, [0, 0, 0]); out[0] = (b[0] - a[0]) / 0.008; out[1] = (b[1] - a[1]) / 0.008; out[2] = (b[2] - a[2]) / 0.008; return out; };
    /* when to meet it at height y after its first bounce: on the way down, like a player with time, unless
       that is further than deep past the baseline: then he steps in and takes it on the rise */
    P.meet = (y, deep) => {
      if(P.apex <= y) return P.tApex;
      const q = [0, 0, 0], d = deep || 99; let tt = P.tApex;
      while(tt < P.len){ P.at(tt, q); if(q[1] <= y) break; tt += 1 / 240; }
      if(Math.abs(q[2]) <= d) return tt;
      tt = P.tLand + 1 / 240;
      while(tt < P.tApex){ P.at(tt, q); if(q[1] >= y) return tt; tt += 1 / 240; }
      return P.tApex;
    };
    /* when the ball, still in the air, comes down through height y before its first bounce */
    P.meetAir = y => {
      const q = [0, 0, 0]; let tt = 0, top = 0;
      while(tt < P.tLand){ P.at(tt, q); if(q[1] > top) top = q[1]; else if(q[1] <= y) return tt; tt += 1 / 240; }
      return P.tLand;
    };
    return P;
  }
  /* a shot from where the ball is now, without a corner in its path */
  function reaim(o, v){
    const P = shot(o);
    P.kick = [v[0] - P.v0[0], v[1] - P.v0[1], v[2] - P.v0[2]];
    return P;
  }
  /* the longest flight still clearing the net by `clear` metres at the lowest T that does */
  function timed(o, clear){
    let best = null;
    for(let T = o.T; T < o.T + 1; T += 0.04){ const P = shot(Object.assign({}, o, { T })); best = P; if(P.netY == null || P.netY > 1.0 + (clear || 0.15)) break; }
    return best;
  }
  /* the toss: straight up off the hand and down to the contact point, T seconds later */
  function toss(from, to, T){
    const vy = (to[1] - from[1] + 0.5 * G * T * T) / T;
    const at = (t, out) => { const u = Math.min(t, T * 1.6); out[0] = from[0] + (to[0] - from[0]) * u / T; out[1] = Math.max(RAD, from[1] + vy * u - 0.5 * G * u * u); out[2] = from[2] + (to[2] - from[2]) * u / T; return out; };
    return { at, vel: (t, out) => { out[0] = (to[0] - from[0]) / T; out[1] = vy - G * t; out[2] = (to[2] - from[2]) / T; return out; }, rpm: 60, len: T * 1.6, apex: from[1] + vy * vy / (2 * G), tApex: vy / G };
  }
  const api = { shot, reaim, timed, toss, solve, fly, bounce, spinAxis, SURF, RAD, HZ };
  if(typeof module !== "undefined") module.exports = api;
  if(root.RACKET) root.RACKET.fl = api;
})(typeof window !== "undefined" ? window : globalThis);
