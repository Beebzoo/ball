/* A tennis player: BALL's skinned man, a racket built in code, real strokes, our own footwork.

   Three layers, each one over the last, every frame:
     the feet     BALL's gait while he runs, a ready stance while he waits (motion.js)
     the stroke   a motion-capture clip (clips.json): the upper body takes it first, the legs last, so a run
                  flows into a swing
     the hands    the left hand is pulled onto the racket's throat by two-bone IK

   THE CONTACT: every clip knows where its sweet spot is at contact, relative to his feet. So we can work
   backwards: the ball will be HERE at THIS time, so his feet must be THERE and the clip must start THEN. The
   strings really meet the ball, and the physics stay real. The clips are test material: see _plans/match-3d.md. */
(function(R){
  const T3 = window.THREE, M = window.BallMotion;
  const clamp = (t, a, b) => t < a ? a : t > b ? b : t, mix = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const NB = 15, LOWER = [0, 3, 4, 5, 6, 7, 8]; // hips and legs come in last
  const isLow = new Array(NB).fill(false); LOWER.forEach(i => { isLow[i] = true; });
  const SPOT = 0.47; // the sweet spot, metres along the shaft from the hand
  const CLIPS = {};
  const A = R.ath = { CLIPS, SPOT };

  A.load = async url => {
    if(CLIPS.fh1) return;
    const d = await (await fetch(url)).json(), hz = d.hz;
    for(const k in d.clips){
      const c = d.clips[k], n = c.root.length, q = new Float32Array(n * NB * 4), root = new Float32Array(n * 3);
      d.bones.forEach((b, i) => { c.q[b].forEach((v, f) => { let sg = 1; if(f){ const p = (f - 1) * NB * 4 + i * 4; if(q[p] * v[0] + q[p + 1] * v[1] + q[p + 2] * v[2] + q[p + 3] * v[3] < 0) sg = -1; } const o = f * NB * 4 + i * 4; for(let j = 0; j < 4; j++) q[o + j] = sg * v[j] / 1e4; }); });
      const at = c.root[c.at];
      c.root.forEach((v, f) => { root[f * 3] = (v[0] - at[0]) / 1e4; root[f * 3 + 1] = v[1] / 1e4; root[f * 3 + 2] = (v[2] - at[2]) / 1e4; });
      CLIPS[k] = { key: k, n, hz, q, root, at: c.at / hz, len: (n - 1) / hz, spot: null, grip: null };
    }
  };
  const _q0 = new T3.Quaternion(), _q1 = new T3.Quaternion();
  function sampleBone(c, f, b, out){
    const cl = clamp(f, 0, c.n - 1.001), i = cl | 0, a = cl - i, o0 = i * NB * 4 + b * 4, o1 = o0 + NB * 4, q = c.q, ia = 1 - a;
    out.set(q[o0] * ia + q[o1] * a, q[o0 + 1] * ia + q[o1 + 1] * a, q[o0 + 2] * ia + q[o1 + 2] * a, q[o0 + 3] * ia + q[o1 + 3] * a).normalize();
  }
  function sampleRoot(c, f, out){
    const cl = clamp(f, 0, c.n - 1.001), i = cl | 0, a = cl - i, r = c.root, o = i * 3;
    out[0] = r[o] + (r[o + 3] - r[o]) * a; out[1] = r[o + 1] + (r[o + 4] - r[o + 1]) * a; out[2] = r[o + 2] + (r[o + 5] - r[o + 2]) * a;
  }

  /* ---------- the racket, in code. +y along the shaft, the hand at the origin, +z out of the strings ---------- */
  function stringTex(){
    const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
    g.clearRect(0, 0, S, S); g.strokeStyle = "rgba(235,238,225,.95)"; g.lineWidth = 2.1;
    for(let i = 5; i < S; i += 12.6){ g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
    const t = new T3.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  let STR = null;
  function racket(colour){
    const G = new T3.Group(), frame = new T3.MeshStandardMaterial({ color: new T3.Color(colour).convertSRGBToLinear(), roughness: 0.32, metalness: 0.55 }), dark = new T3.MeshStandardMaterial({ color: 0x15171b, roughness: 0.62 });
    const hy = 0.47, bar = (a, b, r, m) => { const d = new T3.Vector3().subVectors(b, a), me = new T3.Mesh(new T3.CylinderGeometry(r, r, d.length(), 8), m); me.position.copy(a).addScaledVector(d, 0.5); me.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), d.normalize()); me.castShadow = true; G.add(me); return me; };
    const ring = new T3.Mesh(new T3.TorusGeometry(0.128, 0.0088, 8, 44), frame); ring.scale.set(1, 1.28, 1.5); ring.position.y = hy; ring.castShadow = true; G.add(ring);
    STR = STR || stringTex();
    const st = new T3.Mesh(new T3.CircleGeometry(0.126, 32), new T3.MeshBasicMaterial({ map: STR, transparent: true, side: T3.DoubleSide, depthWrite: false, alphaTest: 0.05 })); st.scale.set(1, 1.28, 1); st.position.y = hy; G.add(st);
    const y0 = hy - 0.164, th = 0.2;
    bar(new T3.Vector3(-0.078, y0 + 0.03, 0), new T3.Vector3(-0.012, th - 0.07, 0), 0.0085, frame); bar(new T3.Vector3(0.078, y0 + 0.03, 0), new T3.Vector3(0.012, th - 0.07, 0), 0.0085, frame);
    bar(new T3.Vector3(-0.07, y0 + 0.02, 0), new T3.Vector3(0.07, y0 + 0.02, 0), 0.006, frame);
    bar(new T3.Vector3(0, th - 0.09, 0), new T3.Vector3(0, -0.015, 0), 0.0125, frame);
    bar(new T3.Vector3(0, 0.03, 0), new T3.Vector3(0, -0.12, 0), 0.0165, dark);
    const cap = new T3.Mesh(new T3.CylinderGeometry(0.019, 0.019, 0.012, 10), dark); cap.position.y = -0.125; G.add(cap);
    return G;
  }

  /* ---------- the ready stance ---------- */
  function ready(t){
    const b = Math.sin(t * 7.5) * 0.012, sway = Math.sin(t * 3.2) * 0.02;
    return { hL: 0.42 + b, hR: 0.42 - b, kL: 0.78 + b, kR: 0.78 - b, lzL: 0.27, lzR: 0.27, aL: 0.14, aR: 0.14, sL: 0.72, sR: 0.42, zL: -0.05, zR: 0.22, eL: 1.32, eR: 1.3, lean: 0.34, twist: sway, nod: -0.22, air: -0.03 + b * 0.5 };
  }

  /* two-bone IK for the left arm. Bones are read through their world matrices, so this runs last */
  const _a = new T3.Vector3(), _b = new T3.Vector3(), _c = new T3.Vector3(), _t = new T3.Vector3(), _e = new T3.Vector3(), _d = new T3.Vector3(), _u = new T3.Vector3();
  const _wq = new T3.Quaternion(), _pq = new T3.Quaternion(), _dq = new T3.Quaternion(), _lq = new T3.Quaternion();
  function aim(bone, from, to, w){
    /* turn the bone so that "from" (world) points at "to" (world) */
    _dq.setFromUnitVectors(from, to);
    bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
    _lq.copy(_pq).invert().multiply(_dq).multiply(_wq);
    bone.quaternion.slerp(_lq, w);
    bone.updateMatrixWorld(true);
  }
  function leftOnRacket(a, w){
    if(w < 0.01) return;
    const U = a.rig.arms[0], F = a.rig.elbows[0], H = a.rig.hands[0], LA = 0.28, LB = 0.31;
    a.rig.root.updateMatrixWorld(true);
    a.throat.getWorldPosition(_t);
    U.getWorldPosition(_a); F.getWorldPosition(_b); H.getWorldPosition(_c);
    _d.subVectors(_t, _a); const D = clamp(_d.length(), 0.08, LA + LB - 0.005); _d.normalize();
    /* the elbow bends out and down */
    a.rig.torso.getWorldQuaternion(_wq); _u.set(0.75, -0.75, -0.2).applyQuaternion(_wq).normalize();
    const cosA = clamp((D * D + LA * LA - LB * LB) / (2 * D * LA), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    _u.addScaledVector(_d, -_u.dot(_d)).normalize();
    _e.copy(_a).addScaledVector(_d, cosA * LA).addScaledVector(_u, sinA * LA);
    const cur = new T3.Vector3().subVectors(_b, _a).normalize(), want = new T3.Vector3().subVectors(_e, _a).normalize();
    aim(U, cur, want, w);
    F.getWorldPosition(_b); H.getWorldPosition(_c);
    const cur2 = new T3.Vector3().subVectors(_c, _b).normalize(), want2 = new T3.Vector3().subVectors(_t, _b).normalize();
    aim(F, cur2, want2, w);
  }

  /* ---------- one player ---------- */
  A.make = (view, o) => {
    const a0 = {};
    const rig = view.players.player({ shirt: o.shirt, shorts: o.shorts, socks: o.socks, looks: o.looks }, view.scene);
    /* BALL's rig is a man. Until there's a woman's body: narrower shoulders, and hair to the shoulders on her head
       bone, which shows from the front, the only way the far player is ever seen */
    if(o.slim){
      rig.arms[0].position.x = 0.166; rig.arms[1].position.x = -0.166;
      const hair = new T3.Mesh(new T3.SphereGeometry(0.118, 12, 10), new T3.MeshStandardMaterial({ color: new T3.Color(o.slim).convertSRGBToLinear(), roughness: 0.55 }));
      hair.scale.set(1.04, 1.5, 0.92); hair.position.set(0, 0.03, -0.05); hair.castShadow = true; rig.head.add(hair); a0.tail = hair;
    }
    const hold = new T3.Group(), rk = racket(o.frame || "#c8323c"), throat = new T3.Object3D();
    hold.position.set(0, -0.075, 0.012); hold.add(rk); rk.add(throat); throat.position.y = 0.2;
    rig.hands[1].add(hold);
    const a = {
      rig, hold, racket: rk, throat, S: M.state(o.seed || 7), side: o.side, // side: 1 near (+z), -1 far
      x: 0, z: 0, yaw: o.side > 0 ? Math.PI : 0, move: null, yawW: null, slots: [],
      grip: new T3.Quaternion(), gripReady: new T3.Quaternion(), pose: null
    };
    a.home = () => (a.side > 0 ? Math.PI : 0);
    a.place = (x, z, yaw) => { a.x = x; a.z = z; a.yaw = yaw == null ? a.home() : yaw; a.move = null; a.S.px = null; a.S.sp = 0; a.yawW = null; a.slots.length = 0; a.pose = null; };
    /* run to (x, z), arriving at game time t1 */
    a.go = (x, z, t0, t1) => { a.move = { x0: a.x, z0: a.z, x1: x, z1: z, t0, t1 }; };
    /* swing clip c so that its contact falls at game time tc, hitting along yaw. now: the game clock */
    a.swing = (c, tc, yaw, now, grip) => { a.slots.push({ c, t0: tc - c.at, tc, yaw, start: Math.max(now, tc - c.at), on: false, grip: grip || c.grip }); };
    /* a pose instead of the feet layer (his reaction after a point): f(t) gives the channels */
    a.act = (f, t0) => { a.pose = f ? { f, t0 } : null; };
    const rt = [0, 0, 0];
    a.update = (gt, dt) => {
      const m = a.move;
      if(m && gt >= m.t0){
        const u = clamp((gt - m.t0) / Math.max(0.01, m.t1 - m.t0), 0, 1), e = u * u * u * (u * (6 * u - 15) + 10);
        a.x = mix(m.x0, m.x1, e); a.z = mix(m.z0, m.z1, e);
        if(u >= 1) a.move = null;
      }
      /* facing: into the run when he's really running, at the net when he's not, along the shot in a swing */
      const S = a.S, slots = a.slots;
      M.track(S, a.x, a.z, a.yaw, dt);
      for(const sl of slots) if(!sl.on && gt >= sl.start){ sl.on = true; a.yawW = { y0: a.yaw, y1: sl.yaw, t0: gt, t1: Math.max(gt + 0.06, sl.tc - 0.3) }; }
      if(a.yawW){ const w = a.yawW, u = clamp((gt - w.t0) / (w.t1 - w.t0), 0, 1), e = u * u * (3 - 2 * u); a.yaw = w.y0 + M.wrap(w.y1 - w.y0) * e; if(!slots.length && u >= 1) a.yawW = null; }
      else {
        const want = S.sp > 2.6 ? Math.atan2(S.vx, S.vz) : a.home(), k = 1 - Math.exp(-dt * (S.sp > 2.6 ? 9 : 5));
        a.yaw += M.wrap(want - a.yaw) * k;
      }
      if(dt > 0) M.stride(S, dt, 1);
      const moving = S.sp > 0.7, P = a.pose ? a.pose.f(gt - a.pose.t0) : moving ? M.moving(S) : ready(gt);
      const out = M.drive(S, P, a.pose ? "act" : moving ? "run" : "ready", dt, 0.16);
      M.apply(rig, Object.assign({}, out));
      rig.hips.position.x = 0; rig.hips.position.z = 0;
      /* the strokes, oldest first: the upper body takes one early, the legs late, so a run flows into it */
      let wU = 0, two = 0;
      a.grip.copy(a.gripReady);
      for(const sl of slots){
        const c = sl.c, t = gt - sl.t0, f = t * c.hz; if(!sl.on) continue;
        const u = sst(0, 0.2, gt - sl.start) * (1 - sst(c.len - 0.34, c.len - 0.02, t));
        const l = sst(c.at - 0.42, c.at - 0.12, t) * (1 - sst(c.len - 0.3, c.len - 0.02, t));
        for(let b = 0; b < NB; b++){ const w = isLow[b] ? l : u; if(w <= 0) continue; sampleBone(c, f, b, _q0); rig.bones[b].quaternion.slerp(_q0, w); }
        sampleRoot(c, f, rt);
        const h = rig.hips; h.position.x = rt[0] * l; h.position.y = mix(h.position.y, rt[1], l); h.position.z = rt[2] * l;
        a.grip.slerp(sl.grip, u);
        wU = Math.max(wU, u);
        if(c.two != null) two = Math.max(two, u * (1 - sst(c.at + 0.14, c.at + 0.34, t)));
      }
      while(slots.length && gt - slots[0].t0 >= slots[0].c.len){ slots.shift(); if(!slots.length) a.yawW = null; }
      hold.quaternion.copy(a.grip);
      rig.root.position.set(a.x, 0, a.z); rig.root.rotation.y = a.yaw;
      /* the left hand: on the throat at rest and in a two-hander, free on a forehand, a serve, a smash, and in a run */
      leftOnRacket(a, Math.max(two, (1 - wU) * (1 - sst(0.7, 2.4, S.sp))) * (a.pose ? 0 : 1));
    };
    a.left = v => rig.hands[0].getWorldPosition(v);
    a.free = () => {
      for(const m of [rk, a0.tail]) if(m) m.traverse(x => { if(x.geometry) x.geometry.dispose(); if(x.material && x.material.map !== STR) x.material.dispose(); });
      view.players.freeRig(rig, view.scene);
    };
    /* the sweet spot in the world, right now */
    const spotM = new T3.Object3D(); spotM.position.y = SPOT; rk.add(spotM);
    a.spotNow = () => { rig.root.updateMatrixWorld(true); const v = new T3.Vector3(); spotM.getWorldPosition(v); return [v.x, v.y, v.z]; };
    return a;
  };

  /* Each clip's grip and sweet spot, worked out once on a spare rig: at contact the racket has to lie like this,
     with the strings square to +z, the way the clip swings */
  const AIM = {
    fh1: [[-0.86, -0.22, 0.46], true], fh2: [[-0.86, -0.22, 0.46], true], bh: [[0.84, -0.2, 0.5], false],
    sv1: [[-0.14, 0.97, 0.2], true], sv2: [[-0.14, 0.97, 0.2], true], sm: [[-0.14, 0.97, 0.2], true],
    vf: [[-0.72, 0.4, 0.56], true], vb: [[0.72, 0.42, 0.55], true]
  };
  A.calibrate = view => {
    if(A.gripReady) return;
    const a = A.make(view, { shirt: "#ffffff", shorts: "#223355", socks: "#ffffff", side: -1 });
    a.place(0, 0, 0);
    const rig = a.rig, m = new T3.Matrix4(), x = new T3.Vector3(), y = new T3.Vector3(), z = new T3.Vector3(), hq = new T3.Quaternion(), dq = new T3.Quaternion(), P = new T3.Vector3();
    /* the ready stance sets the grip he holds it with between shots */
    M.apply(rig, ready(0)); rig.root.updateMatrixWorld(true);
    rig.hands[1].getWorldQuaternion(hq);
    y.set(0.5, 0.42, 0.76).normalize(); z.set(0.1, 0.8, -0.6); x.crossVectors(y, z).normalize(); z.crossVectors(x, y).normalize();
    m.makeBasis(x, y, z); dq.setFromRotationMatrix(m); A.gripReady = hq.clone().invert().multiply(dq);
    for(const k in CLIPS){
      const c = CLIPS[k], f = c.at * c.hz, aim = AIM[k] || AIM.fh1;
      for(let b = 0; b < NB; b++){ sampleBone(c, f, b, _q1); rig.bones[b].quaternion.copy(_q1); }
      const pz = [0, 0, 0]; sampleRoot(c, f, pz); rig.hips.position.set(pz[0], pz[1], pz[2]);
      rig.root.updateMatrixWorld(true);
      rig.hands[1].getWorldQuaternion(hq);
      /* racket: y along aim, z (the strings) as close as can be to the way he's hitting, closed a touch */
      y.set(aim[0][0], aim[0][1], aim[0][2]).normalize(); z.set(0, -0.08, 1); z.addScaledVector(y, -z.dot(y)).normalize(); x.crossVectors(y, z).normalize();
      m.makeBasis(x, y, z); dq.setFromRotationMatrix(m);
      c.grip = hq.clone().invert().multiply(dq);
      a.hold.quaternion.copy(c.grip); rig.root.updateMatrixWorld(true);
      a.hold.getWorldPosition(P); c.hand = P.clone(); c.hq = hq.clone(); P.addScaledVector(y, SPOT);
      c.spot = [P.x, P.y, P.z];
      c.two = k === "bh" ? 1 : null;
    }
    a.free();
  };
  /* A ball dy below the clip's own contact height (or above it, dy < 0). He doesn't reach it with a bigger bounce:
     like a real player he drops the racket head to it, from the hand. Returns the grip and sweet spot for that */
  const _s0 = new T3.Vector3(), _s1 = new T3.Vector3();
  A.low = (c, dy) => {
    if(Math.abs(dy) < 0.02) return { grip: c.grip, spot: c.spot };
    const H = c.hand, S = c.spot, d = Math.max(-0.25, Math.min(0.42, dy));
    _s0.set(S[0] - H.x, S[1] - H.y, S[2] - H.z); const L = _s0.length(); _s0.normalize();
    _s1.set(S[0] - H.x, S[1] - d - H.y, S[2] - H.z).normalize();
    const q = new T3.Quaternion().setFromUnitVectors(_s0, _s1);
    return { grip: c.hq.clone().invert().multiply(q).multiply(c.hq).multiply(c.grip), spot: [H.x + _s1.x * L, H.y + _s1.y * L, H.z + _s1.z * L] };
  };
  /* his feet for a ball met at (x, y, z) with clip c, hitting along yaw */
  A.feet = (c, p, yaw, spot) => { const s = Math.sin(yaw), co = Math.cos(yaw), S = spot || c.spot, sx = S[0], sz = S[2]; return [p[0] - (sx * co + sz * s), p[2] - (-sx * s + sz * co)]; };
})(window.RACKET);
