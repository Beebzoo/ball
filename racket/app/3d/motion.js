/* BALL 4: THE MOTION LAYER for the 3D match (the pitch, P3D, and the shot, G3D).
   Plain script, no modules, no three.js needed except for apply() on a rig.

   WHAT LIVES HERE: how a footballer MOVES. The run (stride length and cadence
   from his real speed, so the boots do not skate; arm swing, lean that grows
   with speed, the bob of the flight phase, shoulders turning against the hips),
   the jockey and the backpedal of a man defending, how a man stands about (five
   ways of standing, picked off his name, so nobody is a clone), the pass (plant
   foot, back-lift, contact, follow-through: a ground ball, a lofted ball, a
   driven one), the first touch (inside foot for a ball on the floor, the thigh
   for a high one), the celebrations (the knee slide, the aeroplane, the jump and
   the fist, the team-mates' leap and hug, the clap) and the other side's
   (hands on the head, hands on the knees, the keeper down). Plus the ball's
   flight and roll, and a critically damped spring for the cameras.

   WHAT DOES NOT: what a man LOOKS like. The rig is somebody else's (G3D's
   player() today; a skinned rig later). This file only ever writes rotations
   onto NAMED JOINTS, through apply(), so a new rig only has to say which of its
   bones is which.

   A POSE IS A PLAIN OBJECT OF CHANNELS, radians, missing = 0:
     hL hR    hip flexion, the thigh forward (+) or back (-)
     lzL lzR  hip abduction, the leg out to his side (+)
     kL kR    knee flexion, the shin back (+)
     aL aR    ankle, toes up (+)                     (only if the rig has feet)
     sL sR    shoulder flexion, the arm forward (+)
     zL zR    shoulder abduction, the arm out to his side and up (+; 2.6 is overhead)
     eL eR    elbow flexion (+)
     lean     the trunk forward (+) from the hips
     twist    the trunk turned to his left (+)
     roll     the trunk bent towards his right (+)
     look     the head turned to his left (+)
     nod      the head down (+)
     tilt     the whole body rolled at the hips (+ towards his right)
     hipYaw   the pelvis turned to his left (+)
     air      metres added to the hip height (a jump +, a crouch or a slide -)
   The side letters are HIS left and right. He faces +z in his own space.

   THE JOINT MAP (apply): channel -> joint . axis (sign)
     thigh_L.x = -hL   thigh_L.z = +lzL   shin_L.x = +kL   foot_L.x = +aL
     thigh_R.x = -hR   thigh_R.z = -lzR   shin_R.x = +kR   foot_R.x = +aR
     upperarm_L.x = -sL  upperarm_L.z = +zL  forearm_L.x = -eL
     upperarm_R.x = -sR  upperarm_R.z = -zR  forearm_R.x = -eR
     spine.x = lean  spine.y = twist  spine.z = -roll
     head.y = look   head.x = nod
     hips.z = tilt   hips.y = hipYaw   hips.position.y = leg height + air
   (Euler XYZ, the joint's rest rotation is identity in the legacy rig.) A rig
   with other rest rotations hands a quaternion in joint.userData.rest and the
   channel rotation is applied on top of it. A rig names its joints with
   rig.joint(name) -> Object3D; without it the legacy fields are used (legs[0]
   is HIS LEFT leg, at +x, and so on). */
(function(root){
'use strict';
const PI = Math.PI, TAU = PI*2;
const lerp = (a, b, t) => a + (b - a)*t, clamp = (t, a = 0, b = 1) => t < a ? a : t > b ? b : t;
const ease = t => t*t*(3 - 2*t), sst = (a, b, x) => ease(clamp((x - a)/(b - a)));
const frac = x => x - Math.floor(x), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const bump = (x, a, b) => x <= a || x >= b ? 0 : Math.sin(PI*(x - a)/(b - a));   /* 0 -> 1 -> 0 between a and b */
function seedOf(str){ let h = 2166136261 >>> 0; for(const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; }

/* ============================ THE JOINTS ============================ */
const JOINTS = ["hips", "spine", "head", "thigh_L", "thigh_R", "shin_L", "shin_R", "foot_L", "foot_R",
                "upperarm_L", "upperarm_R", "forearm_L", "forearm_R"];
function legacyJoint(r, n){
  switch(n){
    case "hips": return r.hips; case "spine": return r.torso; case "head": return r.head;
    case "thigh_L": return r.legs && r.legs[0]; case "thigh_R": return r.legs && r.legs[1];
    case "shin_L": return r.knees && r.knees[0]; case "shin_R": return r.knees && r.knees[1];
    case "foot_L": return r.feet && r.feet[0]; case "foot_R": return r.feet && r.feet[1];
    case "upperarm_L": return r.arms && r.arms[0]; case "upperarm_R": return r.arms && r.arms[1];
    case "forearm_L": return r.elbows && r.elbows[0]; case "forearm_R": return r.elbows && r.elbows[1];
  }
  return null;
}
let _q = null, _e = null;
function rot(j, x, y, z){
  if(!j) return;
  const rest = j.userData && j.userData.rest;
  if(rest && root.THREE){
    _e = _e || new root.THREE.Euler(); _q = _q || new root.THREE.Quaternion();
    _e.set(x, y, z); _q.setFromEuler(_e); j.quaternion.copy(rest).multiply(_q);
  } else j.rotation.set(x, y, z);
}
/* the hips' height off the leg angles: thigh, shin and the foot under it (legacy
   numbers, in the rig's own units; a rig can hand its own as rig.legLen) */
const LEG = [.43, .42, .06];
function legHeight(r, p){
  const L = r.legLen || LEG, g = k => p[k] || 0;
  const v = (h, k) => L[0]*Math.cos(h) + L[1]*Math.cos(h - k) + L[2];
  return Math.max(v(g("hL"), g("kL")) - .02*Math.abs(g("lzL")), v(g("hR"), g("kR")) - .02*Math.abs(g("lzR")));
}
function apply(r, p){
  const J = r.joint ? n => r.joint(n) : n => legacyJoint(r, n), g = k => p[k] || 0;
  rot(J("thigh_L"), -g("hL"), 0, g("lzL")); rot(J("thigh_R"), -g("hR"), 0, -g("lzR"));
  rot(J("shin_L"), g("kL"), 0, 0); rot(J("shin_R"), g("kR"), 0, 0);
  /* the ankles only when a pose says so: otherwise the rig's own sync() lays a
     planted foot flat (the skinned rig, assets/ball3d/players.js) */
  for(const s of ["L", "R"]){ const k = "a" + s; if(Math.abs(p[k] || 0) < 1e-3) delete p[k]; else rot(J("foot_" + s), p[k], 0, 0); }
  rot(J("upperarm_L"), -g("sL"), 0, g("zL")); rot(J("upperarm_R"), -g("sR"), 0, -g("zR"));
  rot(J("forearm_L"), -g("eL"), 0, 0); rot(J("forearm_R"), -g("eR"), 0, 0);
  rot(J("spine"), g("lean"), g("twist"), -g("roll"));
  rot(J("head"), g("nod"), g("look"), 0);
  const hips = J("hips");
  if(hips){ rot(hips, 0, g("hipYaw"), g("tilt")); if(r.hipsHeight !== false) hips.position.y = legHeight(r, p) + g("air"); }
  if(typeof r.sync === "function") r.sync(p);
}

/* ============================ POSES ============================ */
/* THE RUN. sp in metres a second (the match's own, before the rig is scaled).
   o.side: how much of it is sideways (-1 his left .. 1 his right), o.back: how
   much backwards, o.acc: pushing off (0..1), o.bank: leaning into a turn. */
function gait(ph, sp, o){
  o = o || {};
  const run = sst(2.1, 4.6, sp), k = clamp(sp/8.5), side = clamp(o.side || 0, -1, 1), back = clamp(o.back || 0), acc = clamp(o.acc || 0);
  const sh = Math.abs(side), fwd = 1 - Math.max(sh*.85, back*.45);
  const s = Math.sin(ph), c = Math.cos(ph);
  const amp = lerp(.3, .5 + .32*k, run)*fwd*(1 - .35*back);
  const kn = (p) => lerp(.1, .18, run) + lerp(.85, 1.55 + .45*k, run)*(1 - .45*back)*Math.pow(Math.max(0, Math.cos(p + .55)), 1.5) + .12*run*Math.max(0, Math.sin(p - PI/2));
  const arm = lerp(.32, .72 + .2*k, run)*(1 - .4*sh);
  const P = {
    hL: .07*run + amp*s, hR: .07*run - amp*s,
    kL: kn(ph), kR: kn(ph + PI),
    sL: .08*run - arm*s, sR: .08*run + arm*s,
    zL: lerp(.1, .17, run) + .25*sh, zR: lerp(.1, .17, run) + .25*sh,
    eL: lerp(.38, 1.45, run) + .18*run*Math.max(0, -s), eR: lerp(.38, 1.45, run) + .18*run*Math.max(0, s),
    lean: lerp(.04, .1 + .16*k, run)*(1 - .8*back) + .2*acc - .05*back,
    twist: -lerp(.05, .13, run)*s*fwd, hipYaw: lerp(.04, .1, run)*s*fwd,
    roll: .025*s, tilt: .035*s + (o.bank || 0),
    air: lerp(.006*Math.abs(Math.cos(2*ph)), .05*k*Math.abs(c), run) - .02*sh,
  };
  P.look = -P.twist*.85; P.nod = .05*run;
  /* the shuffle: the legs open and close instead of swinging through */
  if(sh > .05){
    const a = .3*sh*(.7 + .3*run);
    P.lzL = a*Math.max(0, side < 0 ? s : -s) + .08*sh; P.lzR = a*Math.max(0, side < 0 ? -s : s) + .08*sh;
    P.kL += .35*sh; P.kR += .35*sh; P.hL += .25*sh; P.hR += .25*sh; P.lean += .12*sh; P.air -= .03*sh;
  }
  return P;
}
/* how far one cycle (two steps) carries him, for a given speed: the swing of the
   thighs times his leg length, so the stride never skates. lenScale is the rig's
   size (1.45 on the pitch). */
function cycleLen(sp, lenScale){
  const run = sst(2.1, 4.6, sp), k = clamp(sp/8.5), amp = lerp(.3, .5 + .32*k, run);
  return Math.max(.9, 4*.86*(lenScale || 1)*Math.sin(amp)*(1 + .35*run));
}

/* STANDING ABOUT. Five ways to stand, off his name, so nobody is a clone:
   0 hands on hips, 1 on his toes, 2 hands together, 3 shaking a leg out now and
   then, 4 the organiser who points. The weight goes foot to foot, he breathes,
   the head follows things. o.keeper: the keeper's crouch when o.alert. */
function idle(t, seed, o){
  o = o || {};
  const st = o.style != null ? o.style : seed % 5, k = (seed >>> 5) % 1000/1000, sd = (seed % 997)/97;
  const P = { hL: .05, hR: -.03, kL: .12, kR: .12, zL: .14, zR: .14, sL: .02, sR: .02, eL: .3, eR: .3, lean: .05 };
  P.lean += .018*Math.sin(t*1.5 + sd);                                  /* a breath */
  const sw = Math.sin(t*(.45 + .2*k) + sd)*Math.sin(t*.19 + sd*2);       /* the weight, foot to foot */
  P.tilt = .045*sw; P.kL += .1*Math.max(0, sw); P.kR += .1*Math.max(0, -sw); P.hL += .05*Math.max(0, sw); P.hR += .05*Math.max(0, -sw);
  P.look = .42*Math.sin(t*.31 + sd*5)*Math.sin(t*.12 + sd*2) + .1*Math.sin(t*.8 + sd);
  P.nod = .04*Math.sin(t*.27 + sd*4);
  if(o.keeper){
    const al = clamp(o.alert == null ? 0 : o.alert);
    if(al > 0){
      const sway = Math.sin(t*1.7 + sd);
      Object.assign(P, { hL: lerp(P.hL, .5, al), hR: lerp(P.hR, .5, al), kL: lerp(P.kL, 1, al), kR: lerp(P.kR, 1, al), lzL: .16*al, lzR: .16*al,
        lean: lerp(P.lean, .32, al), sL: .45*al, sR: .45*al, zL: lerp(.14, .5, al), zR: lerp(.14, .5, al), eL: lerp(.3, .75, al), eR: lerp(.3, .75, al),
        air: .012*al*Math.max(0, Math.sin(t*5 + sd)) - .02*al, tilt: .04*sway*al, nod: -.1*al });
    } else if(frac(t*.11 + k) < .12){
      /* clapping his gloves together, gee-ing them up */
      const c = .5 + .5*Math.sin(t*15);
      Object.assign(P, { sL: 1.0, sR: 1.0, zL: .05 + .25*c, zR: .05 + .25*c, eL: 1.3, eR: 1.3 });
    }
    return P;
  }
  if(st === 0){ Object.assign(P, { zL: .62, zR: .62, sL: -.4, sR: -.4, eL: 1.95, eR: 1.95 }); }
  else if(st === 1){ P.air = .03*Math.max(0, Math.sin(t*6.5 + sd)); P.kL += .1; P.kR += .1; P.eL = .5 + .2*Math.sin(t*6.5 + sd); P.eR = P.eL; }
  else if(st === 2){ Object.assign(P, { sL: .55, sR: .55, zL: -.12, zR: -.12, eL: 1.55, eR: 1.55 }); }
  else if(st === 3){
    const r = frac(t*.21 + k);
    if(r < .14){ const q = bump(r, 0, .14); P.hR = .45*q; P.kR = .35 + .6*q + .18*Math.sin(t*34)*q; P.tilt -= .06*q; P.zL = .3*q + .14; }
  } else {
    const r = frac(t*.15 + k);
    if(r < .12){ const q = bump(r, 0, .12); P.sR = 1.45*q; P.eR = .1 + .2*(1 - q); P.zR = .14 + .15*q; P.twist = .25*q; P.look = .3*q; }
  }
  return P;
}
/* the man on the ball, waiting: the sole goes over the top of it now and then.
   Returns the pose and how far the ball has been rolled (metres, forward). */
function holdBall(t, seed){
  const P = idle(t, seed, { style: 1 }), sd = (seed % 997)/97;
  P.air = 0;
  const r = frac(t*.32 + sd*.1);
  let roll = 0;
  if(r < .3){ const q = bump(r, 0, .3); P.hR = .3*q; P.kR = .2 + .55*q; P.aR = .3*q; P.lean += .06*q; P.nod = .35*q; roll = .16*Math.sin(PI*r/.3*2)*q; }
  else { P.nod = .15; P.look *= .5; }
  return { pose: P, roll };
}
/* SHIELDING IT: the man on the ball as the clock runs and somebody closes him
   down. Knees bent, weight low over the ball, the shoulder turned into him and
   the arm on his side out to hold him off. a (0..1) is how much; side is where
   the man coming is, 1 his left, -1 his right. */
function shield(t, seed, a, side){
  const P = idle(t, seed, { style: 1 }), k = clamp(a), L = side < 0 ? "R" : "L", sd = (seed % 997)/97;
  const mix = (key, v) => { P[key] = lerp(P[key] || 0, v, k); };
  mix("z" + L, 1.05); mix("s" + L, .35); mix("e" + L, .5);
  mix("lean", .22 + .03*Math.sin(t*2.6 + sd)); mix("kL", .34); mix("kR", .36); mix("hL", .26); mix("hR", .24);
  mix("twist", -.3*(side < 0 ? -1 : 1)); mix("nod", .2); P.air = 0;
  return P;
}
/* DEFENDING: side on, low, on his toes, arms out a little */
function jockey(t, seed, o){
  o = o || {};
  const sd = (seed % 997)/97, b = Math.sin(t*6 + sd), d = clamp(o.depth == null ? 1 : o.depth);
  return { hL: .42*d + .05, hR: .38*d + .05, kL: .9*d + .12, kR: .85*d + .12, lzL: .14*d, lzR: .14*d, lean: .3*d + .05,
           sL: .2, sR: .25, zL: .35*d + .14, zR: .38*d + .14, eL: .55, eR: .6, air: .012*Math.max(0, b) - .03*d, tilt: .03*b, nod: -.05 };
}

/* THE PASS, s seconds since he started it. The boot meets the ball at C, which
   is when the flight leaves. kind: "ground" (inside of the foot, along the
   floor), "lofted" (under it, leaning back, the leg high through), "driven"
   (laces, over it, low and flat), "cross" (lofted, the hips open). Right foot. */
const PASS = {
  ground: { back: -.55, thru: .62, knee: 1.25, lean: .18, lz: .42, arm: .85, fin: .2 },
  lofted: { back: -.95, thru: 1.3, knee: 1.65, lean: -.14, lz: .12, arm: 1.3, fin: -.05 },
  driven: { back: -.9, thru: .9, knee: 1.9, lean: .3, lz: .14, arm: 1.05, fin: .25 },
  cross:  { back: -1.0, thru: 1.2, knee: 1.75, lean: -.1, lz: .2, arm: 1.4, fin: -.02 },
};
const PASS_C = .18, PASS_LEN = .78;
function pass(s, kind){
  const K = PASS[kind] || PASS.ground, C = PASS_C;
  const P = { zL: .14, zR: .14, eL: .4, eR: .4 };
  if(s < C){
    /* the last stride in and the plant: the left foot beside the ball, the right leg back */
    const a = ease(clamp(s/C));
    Object.assign(P, { hR: lerp(.1, K.back, a), kR: lerp(.3, K.knee, a), hL: lerp(.05, .28, a), kL: lerp(.2, .42, a),
      zL: lerp(.14, K.arm, a), sL: .15*a, zR: lerp(.14, .45, a), sR: lerp(0, .45, a), eL: .35, eR: .7,
      lean: lerp(.08, K.lean + .12, a), twist: .32*a, hipYaw: .2*a, tilt: -.07*a, roll: -.05*a, air: -.05*a, nod: .35*a });
  } else if(s < C + .12){
    /* contact and the swing through: the knee snaps straight as the boot goes through the ball */
    const b = ease((s - C)/.12);
    Object.assign(P, { hR: lerp(K.back, K.thru, b), kR: lerp(K.knee, .12, Math.min(1, b*1.5)), lzR: K.lz*Math.sin(b*PI*.9), aR: -.4*b,
      hL: .28, kL: .42, zL: K.arm, sL: .15, zR: .45, sR: lerp(.45, -.25, b), eR: .7,
      lean: lerp(K.lean + .12, K.lean, b), twist: lerp(.32, -.18, b), hipYaw: lerp(.2, -.15, b), tilt: -.07, roll: -.05, air: lerp(-.05, .02, b), nod: lerp(.35, .2, b) });
  } else {
    /* the follow-through, held, then back on both feet */
    const f = ease(clamp((s - C - .12)/.2)), r = sst(C + .3, PASS_LEN, s);
    Object.assign(P, { hR: lerp(lerp(K.thru, K.thru*.7, f), .05, r), kR: lerp(.15, .3, f), lzR: K.lz*.3*(1 - r), aR: -.3*(1 - r),
      hL: lerp(.28, .05, r), kL: lerp(.42, .15, r), zL: lerp(K.arm, .14, r), sL: .15*(1 - r), zR: lerp(.45, .14, r), sR: lerp(-.25, 0, r), eR: lerp(.7, .4, r),
      lean: lerp(K.lean, .06, r) + (kind === "lofted" || kind === "cross" ? -.06*f*(1 - r) : 0), twist: lerp(-.18, 0, r), hipYaw: lerp(-.15, 0, r),
      tilt: lerp(-.07, 0, r), roll: lerp(-.05, 0, r), air: .02*(1 - r), nod: lerp(kind === "ground" ? .2 : -.15, .05, r) });
  }
  return P;
}

/* THE FIRST TOUCH, q 0..1 over RECV_LEN, the ball arriving at RECV_AT. Ground:
   the inside of the right foot out to meet it and drawn back to kill it. High:
   the thigh up under it, then down. */
const RECV_LEN = .62, RECV_AT = .38;
function receive(q, kind){
  const hi = kind === "lofted" || kind === "cross";
  const up = sst(0, RECV_AT, q), give = sst(RECV_AT - .05, RECV_AT + .25, q), done = sst(.7, 1, q);
  const P = { zL: .14 + .3*up*(1 - done), zR: .14 + .2*up*(1 - done), eL: .45, eR: .45, sL: .15*up, lean: .12 + .06*up*(1 - done),
              hL: .1 + .12*up*(1 - done), kL: .25 + .25*up*(1 - done), nod: .3*up*(1 - done) + .05 };
  if(hi){
    P.hR = (1.05*up - .55*give)*(1 - done) + .05; P.kR = (1.35*up - .5*give)*(1 - done) + .2; P.lean = .02 - .08*up*(1 - give);
    P.zL += .3*up*(1 - done); P.zR += .35*up*(1 - done); P.nod = .45*up*(1 - done);
  } else {
    P.hR = (.42*up - .5*give)*(1 - done) + .05; P.kR = (.4*up - .15*give)*(1 - done) + .2; P.lzR = .5*up*(1 - done); P.aR = .2*up*(1 - done);
    P.tilt = -.06*up*(1 - done); P.hipYaw = -.15*up*(1 - done);
  }
  return P;
}

/* ---------- the tackle ---------- */
const slide = s => ({ hL: 1.2, kL: .3, hR: .2, kR: .9, zL: .9, zR: .4, eL: .3, eR: .3, lean: -.35, tilt: 1.15*s, air: -.42, aL: .4 });
const brace = { zL: .9, zR: .9, sL: .4, sR: .4, eL: .6, eR: .6, lean: -.25, hL: .2, kL: .3, hR: -.1, kR: .2, nod: -.1 };
const felled = s => ({ hL: .6, kL: .8, hR: .2, kR: .4, zL: 1.4, zR: 1.2, lean: -.4, tilt: 1.45*s, air: -.55 });

/* ---------- the goal: the scorer ---------- */
/* on his knees, sliding, the back arched, the arms out and up to them */
function kneeSlide(t, seed){
  const sd = (seed % 997)/97, a = sst(0, .25, t);
  return { hL: lerp(.4, .12, a), hR: lerp(.4, .08, a), kL: lerp(.8, 1.62, a), kR: lerp(.8, 1.62, a), aL: -.5*a, aR: -.5*a,
           lean: lerp(.1, -.48, a), zL: lerp(.6, 1.65, a), zR: lerp(.6, 1.65, a), sL: -.25*a, sR: -.25*a, eL: .15, eR: .15,
           nod: lerp(0, -.45, a) + .05*Math.sin(t*3 + sd), roll: .04*Math.sin(t*2 + sd), air: 0 };
}
/* the aeroplane: running with the arms out, banking */
function aeroplane(ph, sp, bank){
  const P = gait(ph, sp, { bank: bank*.6 });
  Object.assign(P, { zL: 1.5 + .1*bank, zR: 1.5 - .1*bank, sL: -.1, sR: -.1, eL: .1, eR: .1, twist: 0, roll: bank*.5, look: 0 });
  return P;
}
/* the leap and the fist: up off both feet, the right fist punching the air */
function fistPump(t, seed){
  const sd = (seed % 997)/97, j = Math.max(0, Math.sin(t*4.6 + sd)), pump = .5 + .5*Math.sin(t*9.2 + sd);
  return { hL: .25 + .5*j, hR: .3 + .55*j, kL: .4 + .9*j, kR: .45 + .95*j, zR: 2.65, sR: .2, eR: .3 + .9*pump, zL: .5, sL: .6, eL: 1.7,
           lean: -.12 - .08*j, air: .32*j, nod: -.25, look: .1*Math.sin(t*2) };
}
/* the finger to the sky, walking, then both arms out to the crowd */
function toTheCrowd(t, seed){
  const sd = (seed % 997)/97, a = sst(.2, .6, t);
  const pulse = .5 + .5*Math.sin(t*3.2 + sd);
  return { hL: .05, hR: -.03, kL: .12, kR: .12, zL: lerp(2.6, 2.05 + .12*pulse, a), zR: lerp(.3, 2.05 + .12*pulse, a), sL: .25, sR: lerp(.1, .25, a), eL: lerp(.15, .45, a), eR: lerp(.2, .45, a),
           lean: -.2, nod: -.35 + .05*Math.sin(t*2 + sd), twist: .08*Math.sin(t*1.3 + sd), air: .02*pulse*a };
}
/* ---------- the goal: everybody else ---------- */
/* arriving team-mates: up in the air with both arms, round him */
function leap(t, seed){
  const sd = (seed % 997)/97, j = Math.max(0, Math.sin(t*5.2 + sd));
  return { hL: .2 + .45*j, hR: .2 + .5*j, kL: .35 + .8*j, kR: .35 + .85*j, zL: 2.5 + .2*j, zR: 2.45 + .2*j, eL: .3, eR: .35, sL: .1, sR: .1,
           lean: -.1, air: .26*j, nod: -.2 };
}
/* the arms round him */
function hug(t, seed){
  const sd = (seed % 997)/97, sway = Math.sin(t*4 + sd);
  return { hL: .15, hR: .15, kL: .3, kR: .3, sL: 1.35, sR: 1.35, zL: .45, zR: .45, eL: 1.0, eR: 1.0, lean: .2, tilt: .05*sway, twist: .1*sway, nod: .15, air: .03*Math.max(0, sway) };
}
function clap(t, seed){
  const sd = (seed % 997)/97, c = .5 + .5*Math.sin(t*15 + sd);
  return { hL: .05, hR: -.02, kL: .14, kR: .14, sL: .95, sR: .95, zL: .02 + .28*c, zR: .02 + .28*c, eL: 1.45, eR: 1.45, lean: .02, nod: -.05 };
}
/* the other side */
function handsOnHead(t, seed){
  const sd = (seed % 997)/97;
  return { hL: .04, hR: -.02, kL: .12, kR: .14, zL: 2.25, zR: 2.25, sL: .75, sR: .75, eL: 2.25, eR: 2.25, lean: -.06, nod: -.25 + .1*Math.sin(t*.9 + sd), look: .2*Math.sin(t*.5 + sd), tilt: .03*Math.sin(t*.6 + sd) };
}
function handsOnKnees(t, seed){
  const sd = (seed % 997)/97, br = .025*Math.sin(t*2.4 + sd);
  return { hL: .5, hR: .48, kL: .62, kR: .6, lean: .72 + br, sL: .95, sR: .95, zL: .22, zR: .22, eL: .15, eR: .15, nod: .25, air: -.04 };
}
function crouch(t, seed){
  const sd = (seed % 997)/97;
  return { hL: 1.4, hR: 1.35, kL: 2.3, kR: 2.25, lean: .45, sL: .55, sR: .6, zL: .2, zR: .2, eL: 1.5, eR: 1.4, nod: .55 + .05*Math.sin(t + sd), air: -.03 };
}
/* sat on the grass: the hips come down to the seat of his shorts, hands behind him */
const sit = { hL: 1.45, kL: .55, hR: 1.4, kR: .8, zL: .35, zR: .35, sL: -.55, sR: -.55, eL: .2, eR: .2, lean: -.3, air: -.2, nod: .2 };
/* the beaten keeper, flat on his back, then up on his elbows */
function keeperDown(t){
  const a = sst(.6, 1.4, t);
  return { hL: 1.5, kL: lerp(.2, .9, a), hR: 1.5, kR: lerp(.35, 1.1, a), zL: .5, zR: .5, sL: lerp(-.3, -.8, a), sR: lerp(-.3, -.8, a), eL: lerp(.3, 1.2, a), eR: lerp(.3, 1.2, a),
           lean: lerp(-1.1, -.55, a), air: -.5, nod: lerp(-.2, .3, a) };
}

/* ============================ BLENDING ============================
   Each man keeps one of these. drive() hands it the pose he should be in and a
   tag for what he is doing; when the tag changes, the pose he was actually in a
   moment ago is held and faded into the new one, so nothing ever snaps. A
   steady motion (a run getting faster) is not a change of tag and is not
   smoothed at all, so the stride never lags its feet. */
function state(seed){ return { seed: seed >>> 0, ph: (seed % 628)/100, tag: "", from: null, fade: 1, fadeD: .2, out: {}, vx: 0, vz: 0, sp: 0, px: null, pz: null, yawRate: 0, lastYaw: null }; }
function drive(S, P, tag, dt, dur){
  if(tag !== S.tag){
    S.from = Object.assign({}, S.out); S.fade = 0; S.fadeD = dur == null ? .2 : dur; S.tag = tag;
  }
  S.fade += dt;
  const out = S.out;
  if(S.from && S.fade < S.fadeD){
    const k = ease(S.fade/S.fadeD), F = S.from;
    for(const key in out) if(!(key in P) && !(key in F)) out[key] = 0;
    for(const key in F) out[key] = lerp(F[key], P[key] || 0, k);
    for(const key in P) if(!(key in F)) out[key] = (P[key] || 0)*k;
  } else {
    S.from = null;
    for(const key in out) if(!(key in P)) out[key] = 0;
    for(const key in P) out[key] = P[key];
  }
  return out;
}
/* where he is now: his real velocity (smoothed), speed, and how much of it is
   sideways or backwards relative to the way he faces */
function track(S, x, z, yaw, dt){
  if(S.px == null || dt <= 0){ S.px = x; S.pz = z; S.lastYaw = yaw; return S; }
  const vx = (x - S.px)/dt, vz = (z - S.pz)/dt, k = 1 - Math.exp(-dt*14);
  S.vx += (vx - S.vx)*k; S.vz += (vz - S.vz)*k; S.px = x; S.pz = z;
  S.sp = Math.hypot(S.vx, S.vz);
  const yr = S.lastYaw == null ? 0 : wrap(yaw - S.lastYaw)/dt; S.lastYaw = yaw;
  S.yawRate += (yr - S.yawRate)*(1 - Math.exp(-dt*8));
  /* his own frame: forward is +z turned by yaw */
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const f = S.vx*fx + S.vz*fz, r = S.vx*fz - S.vz*fx;      /* r: towards his left */
  S.fwd = S.sp > .05 ? f/S.sp : 1; S.side = S.sp > .05 ? -r/S.sp : 0;
  return S;
}
/* the stride clock: one full cycle per cycleLen metres; backwards it runs back */
function stride(S, dt, lenScale){
  const L = cycleLen(S.sp, lenScale);
  S.ph += dt*TAU*S.sp/L*(S.fwd < -.3 ? -1 : 1);
  return S.ph;
}
/* the run as he is actually moving: forwards, sideways or back, banking in a turn */
function moving(S, o){
  o = o || {};
  const side = Math.abs(S.side || 0) > .45 && S.sp < 4.5 ? S.side : 0, back = S.fwd < -.3 && S.sp < 5 ? clamp(-S.fwd) : 0;
  const bank = clamp(S.yawRate*S.sp*.012, -.16, .16);
  return gait(S.ph, S.sp*(o.k || 1), { side, back, acc: o.acc || 0, bank: -bank });
}

/* ============================ THE BALL ============================ */
/* how far along its line a pass is, q 0..1 of its time: a ball on the floor
   comes off the boot quick and dies on the grass; one in the air keeps going */
function flightE(q, kind){
  if(kind === "ground") return 1 - Math.pow(1 - q, 2.1);
  if(kind === "driven") return 1 - Math.pow(1 - q, 1.35);
  return 1 - Math.pow(1 - q, 1.12);
}
/* its height: a ground ball skims, a driven one is low and flat, a lofted ball
   comes down short of him and takes one bounce up into his stride */
const LAND = .82;
function flightY(q, kind, h){
  if(kind === "ground") return .015*Math.sin(q*PI*3)*(1 - q);
  if(kind === "driven") return h*4*q*(1 - q);
  if(q < LAND){ const s = q/LAND; return h*4*s*(1 - s); }
  const s = (q - LAND)/(1 - LAND), hb = Math.min(.95, .1*h + .15);
  return hb*4*s*(1 - s);
}
/* rolling it: a turn about the horizontal axis square to where it went, by the
   distance over its radius. Needs three.js; one quaternion reused. */
let _bq = null, _ba = null;
function roll(mesh, dx, dz, r, extra){
  const T = root.THREE; if(!T || !mesh) return;
  const d = Math.hypot(dx, dz); if(d < 1e-5 && !extra) return;
  _bq = _bq || new T.Quaternion(); _ba = _ba || new T.Vector3();
  if(d >= 1e-5){ _ba.set(dz/d, 0, -dx/d); _bq.setFromAxisAngle(_ba, d/r*(extra || 1)); mesh.quaternion.premultiply(_bq); }
}

/* ============================ THE CAMERA ============================
   A critically damped spring per axis: it starts and stops smoothly, never
   overshoots, and a target that jumps (the ball struck) is followed with no
   jolt. f is how lively it is (about the number of times a second it would
   settle). */
function spring(s, target, dt, f){
  if(!s.p){ s.p = target.slice(); s.v = target.map(() => 0); return s.p; }
  const w = TAU*f, e = Math.exp(-w*dt);
  for(let i = 0; i < target.length; i++){
    const x = s.p[i] - target[i], v = s.v[i], tmp = (v + w*x)*dt;
    s.p[i] = target[i] + (x + tmp)*e; s.v[i] = (v - w*tmp)*e;
  }
  return s.p;
}
function snap(s, target){ s.p = target.slice(); s.v = target.map(() => 0); return s.p; }

root.BallMotion = {
  JOINTS, apply, legHeight, seedOf, lerp, clamp, ease, sst, wrap, bump,
  gait, cycleLen, idle, holdBall, shield, jockey, pass, PASS_C, PASS_LEN, receive, RECV_LEN, RECV_AT,
  slide, brace, felled, kneeSlide, aeroplane, fistPump, toTheCrowd, leap, hug, clap, handsOnHead, handsOnKnees, crouch, sit, keeperDown,
  state, drive, track, stride, moving,
  flightE, flightY, roll, LAND, spring, snap,
};
})(typeof window !== "undefined" ? window : globalThis);
