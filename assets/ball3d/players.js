/* BALL 4: THE FOOTBALLERS OF THE 3D SCENES (three.js r128, plain script, no modules).
   Loaded from index.html; used by G3D (the shot) and P3D (the pitch) through
   G3D.core(): window.BALL3D.players(THREE, W) is called once, by G3D.world().

   ONE SKINNED MESH PER MAN, ONE DRAW CALL. Shirt, shorts, legs, socks over shin
   pads, boots with studs, arms, hands (or keeper's gloves and long sleeves),
   neck, a sculpted head, ears, six hair styles and the contact shadow under him
   are one geometry, shared by everybody. The parts a man does not wear (the
   other hair styles, gloves on an outfield man) are collapsed in the vertex
   shader by a per-vertex variant id, so it stays one geometry and one draw.
   Two levels of detail: "hi" (about 17k triangles) for the shot and close
   cameras, "lo" (about 4k) for the far men on the pitch.

   ============================== THE RIG (for motion) ==============================
   Same contract as the old jointed rig, so pose(f, p) in index.html drives it
   unchanged: player() returns
     { root, hips, torso, head, legs: [L, R], knees: [L, R], arms: [L, R],
       elbows: [L, R], feet: [L, R], hands: [L, R], own, mesh, bones, sync(p) }
   and every one of hips/torso/head/legs/knees/arms/elbows/feet/hands is a
   THREE.Bone in an ordinary scene-graph hierarchy under root, so setting
   .rotation/.position on them works exactly as on the old Groups.

   Man space: metres, y up, he FACES +z, his LEFT is +x. Index 0 = LEFT.
   Bone          parent   offset from parent (bind)   what pose() writes
   hips          root     (0, .91, 0)                 position.y (from hL/kL/hR/kR + air), rotation.z = tilt
   torso         hips     (0, .06, 0)                 rotation.x = lean (+ forward), rotation.y = twist
   head          torso    (0, .65, 0)  skull base     rotation.y = look   (rotation.x nods, free)
   thighL/R      hips     (+-.095, -.05, 0) hip joint rotation.x = -h (h + = leg forward), rotation.z = +-lz
   kneeL/R       thigh    (0, -.43, 0)                rotation.x = k (k + = shin back)
   footL/R       knee     (0, -.42, 0)  ankle         rotation.x: p.aL/aR if given, else levelled by sync()
   armL/R        torso    (+-.185, .52, 0) shoulder   rotation.x = -s (s + = arm forward), rotation.z = +-z (out)
   elbowL/R      arm      (0, -.28, 0)                rotation.x = -e (e + = forearm forward/up)
   handL/R       elbow    (0, -.255, 0) wrist         free (identity)
   ground        root     (0, 0, 0)                   the contact shadow; placed under the hips every frame
   Leg lengths .43/.42 and the ankle .06 off the grass are what pose()'s hip
   height formula assumes; keep them. Bind pose: everything 0 except the arms,
   which are bound 0.2 rad out (an A), so zL = zR = .2 is the undeformed arm.
   f.sync(p) is called at the end of pose(): it levels a planted foot, which is
   all the rig adds on its own.
   ================================================================================ */
(function(){
'use strict';
const B3 = window.BALL3D = window.BALL3D || {};

B3.players = function(T3, W){
const V = (x = 0, y = 0, z = 0) => new T3.Vector3(x, y, z);
const PI = Math.PI, TAU = PI*2;
const clamp = (t, a = 0, b = 1) => t < a ? a : t > b ? b : t;
const lerp = (a, b, t) => a + (b - a)*t;
const ease = t => t*t*(3 - 2*t);
const sst = (a, b, x) => ease(clamp((x - a)/(b - a)));
const gs = (x, w) => Math.exp(-(x/w)*(x/w));
const sgp = (c, e) => Math.sign(c)*Math.pow(Math.abs(c), e);
function seedOf(str){ let h = 2166136261 >>> 0; for(const ch of String(str)){ h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; } return h; }
function rng(seed){ let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0)/4294967296); }

/* ===================================== BONES ===================================== */
const BDEF = [
  ['hips', -1, [0, .91, 0]], ['torso', 0, [0, .06, 0]], ['head', 1, [0, .65, 0]],
  ['thighL', 0, [.095, -.05, 0]], ['kneeL', 3, [0, -.43, 0]], ['footL', 4, [0, -.42, 0]],
  ['thighR', 0, [-.095, -.05, 0]], ['kneeR', 6, [0, -.43, 0]], ['footR', 7, [0, -.42, 0]],
  ['armL', 1, [.185, .52, 0]], ['elbowL', 9, [0, -.28, 0]], ['handL', 10, [0, -.255, 0]],
  ['armR', 1, [-.185, .52, 0]], ['elbowR', 12, [0, -.28, 0]], ['handR', 13, [0, -.255, 0]],
  ['ground', -1, [0, 0, 0]]
];
const B = {}; BDEF.forEach((d, i) => { B[d[0]] = i; });
const NB = BDEF.length, ARM_BIND = .2;
function makeBones(){
  const bones = BDEF.map(d => { const b = new T3.Bone(); b.name = d[0]; b.position.set(...d[2]); return b; });
  BDEF.forEach((d, i) => { if(d[1] >= 0) bones[d[1]].add(bones[i]); });
  return bones;
}
/* the bind matrices, in man space */
const MB = (() => {
  const root = new T3.Group(), bones = makeBones();
  root.add(bones[B.hips]); root.add(bones[B.ground]);
  bones[B.armL].rotation.z = ARM_BIND; bones[B.armR].rotation.z = -ARM_BIND;
  root.updateMatrixWorld(true);
  return bones.map(b => b.matrixWorld.clone());
})();
const INV = MB.map(m => m.clone().invert());

/* ===================================== THE ATLAS =====================================
   One team map per kit (1024, sRGB), painted from the kit's colours; a man map
   per man (his number and name, his face, his hair, his boots), laid over the
   team map in the shader through boxes; and two maps shared by everybody: NRM
   (normal + roughness in alpha) and MSK (r skin tint, g cloth sheen, b knit kind,
   a ambient occlusion). Rectangles in team-map pixels, x right, y down. */
const ATL = 1024;
const L = {
  torso: [0, 0, 1024, 448], sleeve: [0, 448, 512, 128], lsleeve: [512, 448, 256, 128], sw: [768, 448, 256, 128],
  pelvis: [0, 576, 512, 128], short: [512, 576, 512, 128],
  sock: [0, 704, 384, 192], legSkin: [384, 704, 256, 192], armSkin: [640, 704, 192, 192], glove: [832, 704, 192, 192],
  boot: [0, 896, 256, 128], face: [256, 896, 256, 128], hair: [512, 896, 128, 128], scalp: [640, 896, 128, 128],
  blob: [880, 900, 136, 120]
};
/* swatches, 32 px, 8 x 4 in L.sw */
const SW = { collar: 0, skin: 1, stud: 2, sole: 3, white: 4, black: 5, trim: 6, latex: 7, band: 8, kit: 9, lace: 10 };
const swPx = i => [L.sw[0] + (i % 8)*32, L.sw[1] + Math.floor(i/8)*32];
const rect = r => (u, v) => [(r[0] + 1 + clamp(u)*(r[2] - 2))/ATL, 1 - (r[1] + 1 + (1 - clamp(v))*(r[3] - 2))/ATL];
const swUV = i => { const [x, y] = swPx(i); return [(x + 16)/ATL, 1 - (y + 16)/ATL]; };
/* a swatch with a little spread of uv over it: a normal map needs uv that changes across a surface
   (with one uv for a whole part its tangent frame is 0/0 and some GPUs draw black) */
const swR = i => { const [x, y] = swPx(i); return (u, v) => [(x + 5 + clamp(u)*22)/ATL, 1 - (y + 5 + (1 - clamp(v))*22)/ATL]; };
const R = {}; for(const k of Object.keys(L)) R[k] = rect(L[k]);

/* body landmarks, man space (y) */
const HEM = .885, NECK = 1.567;
/* the shirt, ring by ring: half width a, front f, back b (from cz), superellipse n */
const TORSO = [
  { y: .885, a: .196, f: .148, b: .152, n: 2.1 },
  { y: .93, a: .186, f: .138, b: .142, n: 2.1 },
  { y: 1.0, a: .176, f: .13, b: .134, n: 2.15 },
  { y: 1.08, a: .166, f: .124, b: .122, n: 2.2 },
  { y: 1.16, a: .171, f: .132, b: .122, n: 2.25 },
  { y: 1.25, a: .181, f: .142, b: .126, n: 2.3 },
  { y: 1.33, a: .188, f: .144, b: .128, n: 2.4 },
  { y: 1.40, a: .196, f: .136, b: .128, n: 2.7 },
  { y: 1.45, a: .21, f: .12, b: .12, n: 3.3 },
  { y: 1.49, a: .212, f: .1, b: .106, n: 4 },
  { y: 1.516, a: .18, f: .088, b: .094, n: 3.4 },
  { y: 1.538, a: .12, f: .075, b: .078, n: 2.5 },
  { y: 1.556, a: .08, f: .064, b: .066, n: 2.1 },
  { y: NECK, a: .064, f: .058, b: .06, n: 2 }
];
/* where the number and the name sit on the shirt (cm of cloth from the hem is v) */
const SH_V = y => (y - HEM)/(NECK - HEM);

/* ===================================== GEOMETRY ===================================== */
function Acc(){ return { p: [], n: [], uv: [], si: [], sw: [], va: [], ib: [], iv: [], vr: 0 }; }
function normW(Wt){
  const w = Wt.filter(x => x[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  let t = 0; for(const x of w) t += x[1];
  const o = w.map(x => [x[0], x[1]/(t || 1)]); while(o.length < 4) o.push([0, 0]);
  return o;
}
function vert(A, p, n, uv, Wt){
  A.p.push(p.x, p.y, p.z); A.n.push(n.x, n.y, n.z); A.uv.push(uv[0], uv[1]); A.va.push(A.vr);
  const w = normW(Wt); for(let k = 0; k < 4; k++){ A.si.push(w[k][0]); A.sw.push(w[k][1]); }
  return A.p.length/3 - 1;
}
/* a loft: rings [{ y, rx, rz | f + b, cx, cz, n }] in a local frame (y along it, z his front),
   carried into man space by o.M. o.seg round, o.th0 where u = 0 (th = 0 is +z), o.arc part of
   the way round, o.shape(lx, ly, lz, th, i, fu) -> [x, z] or [x, z, y], o.uv(fu, i, ring, fa),
   o.w(lx, ly, lz, i, fu) -> [[bone, weight]..]. */
function tube(A, rings, o){
  const seg = o.seg, nr = rings.length, Mx = o.M, part = o.arc || 1, closed = part >= 1;
  const pts = [], loc = [], fa = [];
  for(let i = 0; i < nr; i++){
    const r = rings[i], e = 2/(r.n || 2), row = [], lrow = [], arc = [0];
    for(let j = 0; j <= seg; j++){
      const th = o.th0 + (j/seg)*TAU*part, s = Math.sin(th), c = Math.cos(th);
      const zr = r.f != null ? (c > 0 ? r.f : r.b) : r.rz;
      let lx = (r.cx || 0) + (r.rx != null ? r.rx : r.a)*sgp(s, e), lz = (r.cz || 0) + zr*sgp(c, e), ly = r.y;
      if(o.shape){ const q = o.shape(lx, r.y, lz, th, i, j/seg); lx = q[0]; lz = q[1]; if(q.length > 2) ly = q[2]; }
      const lp = V(lx, ly, lz); lrow.push(lp); row.push(lp.clone().applyMatrix4(Mx));
      if(j) arc.push(arc[j - 1] + Math.hypot(lx - lrow[j - 1].x, lz - lrow[j - 1].z));
    }
    const tot = arc[seg] || 1; fa.push(arc.map(a => a/tot)); pts.push(row); loc.push(lrow);
  }
  /* rings going down their axis turn the surface inside out: flip it back */
  const desc = rings[nr - 1].y < rings[0].y;
  const flip = (Mx.determinant() < 0) !== desc, idx = [], nrm = [];
  const tA = V(), tB = V(), nn = V();
  for(let i = 0; i < nr; i++){
    const row = [], nrow = [];
    for(let j = 0; j <= seg; j++){
      const jm = closed ? (j === 0 ? seg - 1 : j - 1) : Math.max(0, j - 1), jp = closed ? (j === seg ? 1 : j + 1) : Math.min(seg, j + 1);
      tA.subVectors(pts[i][jp], pts[i][jm]);
      tB.subVectors(pts[Math.min(nr - 1, i + 1)][j], pts[Math.max(0, i - 1)][j]);
      nn.crossVectors(tA, tB); if(flip) nn.negate();
      if(nn.lengthSq() < 1e-14) nn.set(0, 1, 0); nn.normalize();
      const l = loc[i][j], fu = j/seg;
      row.push(vert(A, pts[i][j], nn, o.uv(fu, i, rings[i], fa[i][j]), o.w(l.x, l.y, l.z, i, fu))); nrow.push(nn.clone());
    }
    idx.push(row); nrm.push(nrow);
  }
  const out = o.grp ? A.iv : A.ib;
  for(let i = 0; i < nr - 1; i++) for(let j = 0; j < seg; j++){
    const a = idx[i][j], b = idx[i][j + 1], c = idx[i + 1][j + 1], d = idx[i + 1][j];
    if(flip) out.push(a, c, b, a, d, c); else out.push(a, b, c, a, c, d);
  }
  const cap = (i, dir) => {
    const r = rings[i], cen = V(r.cx || 0, r.y, r.cz || 0).applyMatrix4(Mx), ax = V(0, dir, 0).transformDirection(Mx);
    const c0 = vert(A, cen, ax, o.uv(.5, i, r, .5), o.w(r.cx || 0, r.y, r.cz || 0, i, .5));
    const ring = []; for(let j = 0; j <= seg; j++){ const l = loc[i][j]; ring.push(vert(A, pts[i][j], ax, o.uv(j/seg, i, r, fa[i][j]), o.w(l.x, l.y, l.z, i, j/seg))); }
    for(let j = 0; j < seg; j++){
      const n2 = V().subVectors(pts[i][j], cen).cross(V().subVectors(pts[i][j + 1], cen));
      if(n2.dot(ax) >= 0) out.push(c0, ring[j], ring[j + 1]); else out.push(c0, ring[j + 1], ring[j]);
    }
  };
  if(o.cap0) cap(0, desc ? 1 : -1); if(o.cap1) cap(nr - 1, desc ? -1 : 1);
  return { pts, nrm };
}
/* a rigid part: any geometry, by Ml then Mb into man space */
function part(A, geo, Mb, Ml, uvf, Wt, grp){
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv0 = geo.attributes.uv;
  const Mx = new T3.Matrix4().multiplyMatrices(Mb, Ml), Nm = new T3.Matrix3().getNormalMatrix(Mx), flip = Mx.determinant() < 0;
  const base = [], p = V(), n = V();
  for(let k = 0; k < pos.count; k++){
    p.fromBufferAttribute(pos, k).applyMatrix4(Mx); n.fromBufferAttribute(nor, k).applyMatrix3(Nm).normalize();
    const uv = typeof uvf === 'function' ? uvf(uv0 ? uv0.getX(k) : 0, uv0 ? uv0.getY(k) : 0) : uvf;
    base.push(vert(A, p, n, uv, typeof Wt === 'function' ? Wt(p) : Wt));
  }
  const out = grp ? A.iv : A.ib;
  const tri = (a, b, c) => flip ? out.push(base[a], base[c], base[b]) : out.push(base[a], base[b], base[c]);
  if(geo.index){ const ix = geo.index.array; for(let k = 0; k < ix.length; k += 3) tri(ix[k], ix[k + 1], ix[k + 2]); }
  else for(let k = 0; k < pos.count; k += 3) tri(k, k + 1, k + 2);
  geo.dispose();
}
/* a rounded box (superellipsoid), half sizes */
function blob(hx, hy, hz, n = 3, ws = 12, hs = 8){
  const g = new T3.SphereGeometry(1, ws, hs), p = g.attributes.position, e = 2/n;
  for(let k = 0; k < p.count; k++){
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    p.setXYZ(k, sgp(x, e)*hx, sgp(y, e)*hy, sgp(z, e)*hz);
  }
  g.computeVertexNormals(); return g;
}
const mat4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new T3.Matrix4().compose(V(x, y, z), new T3.Quaternion().setFromEuler(new T3.Euler(rx, ry, rz)), V(sx, sy, sz));
/* Catmull-Rom through a column of rings, k steps per span */
function spline(ctrl, k){
  if(k <= 1) return ctrl.map(r => Object.assign({}, r));
  const out = [], n = ctrl.length;
  for(let i = 0; i < n - 1; i++) for(let s = 0; s < (i === n - 2 ? k + 1 : k); s++){
    const t = s/k, p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)], r = {};
    for(const key of Object.keys(p1)){ const a = p0[key], b = p1[key], c = p2[key], d = p3[key]; r[key] = .5*(2*b + (-a + c)*t + (2*a - 5*b + 4*c - d)*t*t + (-a + 3*b - 3*c + d)*t*t*t); }
    out.push(r);
  }
  return out;
}
const fold = x => Math.abs(Math.sin(x));
const pushOut = (lx, lz, cx, cz, d) => { const dx = lx - cx, dz = lz - cz, r = Math.hypot(dx, dz) || 1; return [lx + dx/r*d, lz + dz/r*d]; };

/* the head, ring by ring, in head-bone space (the face looks +z) */
const HEAD = [
  { y: -.034, a: .018, b: .022, cz: .05 }, { y: -.027, a: .037, b: .041, cz: .049 }, { y: -.01, a: .055, b: .058, cz: .042 },
  { y: .012, a: .066, b: .077, cz: .031 }, { y: .04, a: .072, b: .092, cz: .021 }, { y: .072, a: .076, b: .099, cz: .016 },
  { y: .105, a: .077, b: .102, cz: .015 }, { y: .14, a: .073, b: .098, cz: .016 }, { y: .175, a: .06, b: .083, cz: .016 },
  { y: .2, a: .035, b: .054, cz: .016 }, { y: .21, a: .004, b: .006, cz: .016 }
];
const HY0 = -.034, HY1 = .21, HN = 2.15;
const headDense = spline(HEAD, 6);
function headAt(y){
  let i = 0; while(i < headDense.length - 2 && headDense[i + 1].y < y) i++;
  const a = headDense[i], b = headDense[i + 1], t = clamp((y - a.y)/((b.y - a.y) || 1));
  return { a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t), cz: lerp(a.cz, b.cz, t) };
}
/* the hairline: high over the forehead, over the ears, low at the nape */
const hairY = th => { const c = Math.cos(th); return .1 + .052*c - .06*Math.max(0, -c)*Math.max(0, -c); };
/* the face, sculpted: nose, brow, eye sockets, cheekbones, lips, chin (z out is +) */
function faceZ(ly, da){
  const g = gs; let dz = 0;
  dz += .019*g(da, .13)*g(ly - .05, .02) + .008*g(da, .1)*g(ly - .075, .018);
  dz -= .002*g(da, .05)*g(ly - .04, .01);
  dz += .007*g(da, .55)*g(ly - .097, .011);
  dz -= .006*(g(da - .4, .16) + g(da + .4, .16))*g(ly - .078, .012);
  dz += .004*(g(da - .62, .2) + g(da + .62, .2))*g(ly - .055, .02);
  dz += .003*g(da, .2)*g(ly - .019, .005) + .0025*g(da, .18)*g(ly - .009, .005);
  dz += .006*g(da, .3)*g(ly + .02, .012);
  return dz;
}
/* hair styles: 0 crop, 1 shaved (none), 2 textured, 3 quiff, 4 long, 5 afro */
const STYLES = 6;
function hairT(style, th, y, n){
  const c = Math.cos(th), front = Math.max(0, c), top = sst(.12, .2, y);
  if(style === 0) return .004 + .002*top;
  if(style === 2) return .006 + .004*n + .003*top;
  if(style === 3) return .005 + .02*front*top + .004*top + .0015*n;
  if(style === 4) return .012 + .004*top + .003*n;
  if(style === 5) return .024 + .008*top + .006*n;
  return 0;
}
function hairLine(style, th){
  const c = Math.cos(th);
  if(style === 4) return hairY(th) - .045*Math.max(0, -c) - .03*(1 - Math.abs(c));
  if(style === 5) return hairY(th) - .006;
  return hairY(th);
}

let GEO = null;
function buildAll(){
  if(GEO) return GEO;
  const t0 = performance.now();
  GEO = { hi: build(1), lo: build(.45), far: build(0) };
  GEO.ms = Math.round(performance.now() - t0);
  return GEO;
}
/* lod 1: everything; .45: the pitch's near men; 0: far men (no ears, no studs, one blob a hand) */
function build(lod){
  const A = Acc(), hi = lod >= 1, far = lod <= 0;
  const S = hi ? 1 : far ? .28 : .42, seg = n => Math.max(far ? 5 : 6, Math.round(n*S)), sk = k => hi ? k : 1;
  const I4 = new T3.Matrix4();
  const W1 = b => [[b, 1]];

  /* ---------------- the shirt ---------------- */
  const tr = spline(TORSO, sk(3));
  /* u round by arc length, 0 at his right side, .25 his chest, .5 his left side, .75 his back */
  const shirtShape = (lx, ly, lz, th, i) => {
    const u = ((th + PI/2)/TAU % 1 + 1) % 1;
    const side = Math.min(Math.abs(u), Math.abs(u - .5), Math.abs(u - 1));
    let d = 0, y = ly;
    /* creases round the waist where it blouses over the shorts */
    const wv = (ly - .9)/.034*PI + 1.6*Math.sin(u*TAU*3 + .7) + .7*Math.sin(u*TAU*7 + 2.1);
    d += .0065*sst(.89, .93, ly)*sst(1.1, 1.0, ly)*(fold(wv) - .3);
    /* long drapes off the chest, gathers under the arms */
    const dr = u*TAU*5 + 1.1*Math.sin(ly*9 + u*21) + .6*Math.sin(u*TAU*11);
    d += .004*sst(1.02, 1.14, ly)*sst(1.38, 1.26, ly)*(.4 + .6*clamp(side/.1))*(fold(dr) - .35);
    d += .006*gs(side, .045)*sst(1.24, 1.36, ly)*sst(1.47, 1.42, ly)*(fold(ly*95 + u*40) - .4);
    /* the hem: out a little, never quite level */
    const hm = sst(.93, .885, ly); d += .008*hm;
    y += hm*(.006*Math.sin(u*TAU*3 + 1.3) + .003*Math.sin(u*TAU*7 + .4));
    const q = pushOut(lx, lz, 0, 0, d);
    return [q[0], q[1], y];
  };
  tube(A, tr, { seg: seg(56), M: I4, th0: -PI/2, shape: shirtShape,
    uv: (fu, i, r, fa) => R.torso(fa, SH_V(r.y)),
    w: (x, y, z) => {
      const t = sst(.96, 1.08, y), Wt = [[B.hips, 1 - t], [B.torso, t]];
      /* the hem over the thighs: a knee coming up lifts the front of the shirt */
      const f = sst(.95, .885, y)*(.15 + .3*clamp(z/.12));
      if(f > 0){ for(const w of Wt) w[1] *= 1 - f; Wt.push([x > 0 ? B.thighL : B.thighR, f]); }
      return Wt;
    } });
  /* the collar: a ribbed band round the neck */
  tube(A, [{ y: 1.553, rx: .074, rz: .068, cz: .004 }, { y: 1.566, rx: .072, rz: .066, cz: .004 }, { y: 1.578, rx: .066, rz: .061, cz: .003 }, { y: 1.582, rx: .06, rz: .056, cz: .002 }, { y: 1.576, rx: .056, rz: .052, cz: .002 }],
    { seg: seg(32), M: I4, th0: 0, uv: (fu, i) => swR(SW.collar)(fu, i/4), w: () => W1(B.torso) });

  /* ---------------- the neck ---------------- */
  tube(A, [{ y: 1.50, rx: .06, rz: .057, cz: -.004 }, { y: 1.56, rx: .057, rz: .054, cz: -.004 }, { y: 1.61, rx: .055, rz: .054, cz: -.002 }, { y: 1.655, rx: .056, rz: .056, cz: .004 }],
    { seg: seg(16), M: I4, th0: 0, uv: (fu, i) => swR(SW.skin)(fu, i/3), w: (x, y) => { const t = sst(1.57, 1.64, y); return [[B.torso, 1 - t], [B.head, t]]; } });

  /* ---------------- the head ---------------- */
  const Mh = MB[B.head], hr = spline(HEAD, sk(3)).map(r => ({ y: r.y, rx: r.a, rz: r.b, cz: r.cz, n: HN }));
  for(const front of [true, false]){
    tube(A, hr, { seg: front ? seg(26) : seg(16), arc: .5, M: Mh, th0: front ? -PI/2 : PI/2,
      shape: (lx, ly, lz, th) => {
        if(!front) return [lx, lz];
        const da = Math.atan2(Math.sin(th), Math.cos(th)), fr = Math.max(0, Math.cos(th));
        return [lx*(1 - .07*fr), lz + faceZ(ly, da)];
      },
      uv: (fu, i, r) => front ? R.face(fu, (r.y - HY0)/(HY1 - HY0)) : R.scalp(fu, (r.y - HY0)/(HY1 - HY0)),
      w: () => W1(B.head) });
  }
  /* ears */
  if(!far) for(const s of [-1, 1]){
    part(A, blob(.011, .029, .019, 2.4, hi ? 10 : 6, hi ? 8 : 5), Mh, mat4(s*.074, .066, -.006, 0, -s*.25, s*.12), swR(SW.skin), W1(B.head));
    if(hi) part(A, blob(.006, .018, .01, 2, 6, 5), Mh, mat4(s*.081, .066, -.004, 0, -s*.25, s*.12), swR(SW.skin), W1(B.head));
  }
  /* the hair, one shell per style (the man's own is kept by the vertex shader) */
  for(let st = 0; st < STYLES; st++){
    if(st === 1) continue;
    A.vr = 10 + st;
    const nr = hi ? 9 : far ? 2 : 4, nu = seg(36), rn = rng(77 + st);
    const bump = [...Array(64)].map(() => rn());
    const noise = (th, y) => { const a = ((th/TAU + 1)*16) % 16, b = (y*60) % 4; const i = (Math.floor(a) + 16*Math.floor(b)) & 63; return bump[i]*.6 + bump[(i + 17) & 63]*.4; };
    const pts = [], lr = [];
    for(let i = 0; i <= nr; i++){
      const v = i/nr, row = [];
      for(let j = 0; j <= nu; j++){
        const th = (j/nu)*TAU, hl = hairLine(st, th) - .004 + (st === 5 ? .3 : 1)*(.004*Math.sin(th*7 + st) + .003*Math.sin(th*13 + 2*st));
        const y = lerp(hl, HY1, Math.pow(v, .85));
        const h = headAt(Math.min(y, HY1 - .002)), e = 2/HN;
        let x = h.a*sgp(Math.sin(th), e), z = h.cz + h.b*sgp(Math.cos(th), e);
        if(Math.cos(th) > 0 && y < .13) z += faceZ(y, Math.atan2(Math.sin(th), Math.cos(th)))*.6;
        /* out along the skull's own normal (from the middle of the head), so a thick style is a dome, not a hat */
        const t = hairT(st, th, y, st >= 2 ? noise(th, y) : 0)*Math.sqrt(sst(0, .32, v)) + .0012;
        const cy = .085, cz0 = .016;
        if(i === nr){ row.push(V(0, HY1 + t, cz0)); continue; }
        const dx = x, dy = y - cy, dz = z - cz0, dl = Math.hypot(dx, dy, dz) || 1;
        row.push(V(x + dx/dl*t, y + dy/dl*t, z + dz/dl*t));
      }
      pts.push(row); lr.push(v);
    }
    const idx = [];
    for(let i = 0; i <= nr; i++){
      const row = [];
      for(let j = 0; j <= nu; j++){
        const p = pts[i][j].clone().applyMatrix4(Mh);
        const pc = V(0, .07, .016).applyMatrix4(Mh), n = p.clone().sub(pc).normalize();
        row.push(vert(A, p, n, R.hair(j/nu, .55 + .45*lr[i]), W1(B.head)));
      }
      idx.push(row);
    }
    for(let i = 0; i < nr; i++) for(let j = 0; j < nu; j++){ const a = idx[i][j], b = idx[i][j + 1], c = idx[i + 1][j + 1], d = idx[i + 1][j]; A.ib.push(a, b, c, a, c, d); }
    /* the rolled edge of the hair at its hairline, so the shell has thickness */
    if(st >= 4){
      const er = [];
      for(let j = 0; j <= nu; j++){
        const th = (j/nu)*TAU, hl = hairLine(st, th) - .004 + (st === 5 ? .3 : 1)*(.004*Math.sin(th*7 + st) + .003*Math.sin(th*13 + 2*st)), h = headAt(hl), e = 2/HN;
        let x = h.a*sgp(Math.sin(th), e), z = h.cz + h.b*sgp(Math.cos(th), e);
        if(Math.cos(th) > 0 && hl < .13) z += faceZ(hl, Math.atan2(Math.sin(th), Math.cos(th)))*.6;
        const p = V(x, hl - .001, z).applyMatrix4(Mh);
        er.push(vert(A, p, V(x, -.4, z - h.cz).normalize().transformDirection(Mh), R.hair(j/nu, .5), W1(B.head)));
      }
      for(let j = 0; j < nu; j++){ const a = er[j], b = er[j + 1], c = idx[0][j + 1], d = idx[0][j]; A.ib.push(a, b, c, a, c, d); }
    }
  }
  A.vr = 0;

  /* ---------------- arms: sleeve, skin, hand (or gloves and long sleeves) ---------------- */
  for(let i = 0; i < 2; i++){
    const s = i ? -1 : 1, ba = i ? B.armR : B.armL, be = i ? B.elbowR : B.elbowL, bh = i ? B.handR : B.handL, Ma = MB[ba];
    /* the sleeve over the deltoid: its cap reaches into the shoulder */
    const sl = spline([
      { y: .024, r: .02 }, { y: .014, r: .045 }, { y: -.006, r: .057 }, { y: -.035, r: .061 }, { y: -.075, r: .06 },
      { y: -.115, r: .058 }, { y: -.148, r: .058 }, { y: -.157, r: .055 }
    ], sk(2)).map(r => ({ y: r.y, rx: r.r*.94, rz: r.r*1.02, cx: s*.004 }));
    tube(A, sl, { seg: seg(22), M: Ma, th0: s > 0 ? -PI/2 : PI/2, cap0: true,
      shape: (lx, ly, lz, th) => { const d = .003*sst(.0, -.06, ly)*sst(-.16, -.1, ly)*(fold(ly*80 + Math.sin(th*2)*1.5) - .4); return pushOut(lx, lz, 0, 0, d); },
      uv: (fu, k, r) => R.sleeve(fu, .03 + .97*clamp((.024 - r.y)/.181)),
      w: (x, y) => { const t = sst(.03, -.05, y); return [[B.torso, (1 - t)*.85], [ba, t + (1 - t)*.15]]; } });
    /* the arm: biceps, elbow, forearm, wrist */
    const ar = spline([
      { y: -.1, r: .052, f: .054 }, { y: -.17, r: .05, f: .055 }, { y: -.24, r: .043, f: .046 }, { y: -.28, r: .039, f: .04 },
      { y: -.32, r: .043, f: .044 }, { y: -.38, r: .041, f: .04 }, { y: -.45, r: .033, f: .032 }, { y: -.515, r: .027, f: .025 }, { y: -.54, r: .028, f: .026 }
    ], sk(2)).map(r => ({ y: r.y, rx: r.r*.92, f: r.f, b: r.f, cx: 0 }));
    tube(A, ar, { seg: seg(16), M: Ma, th0: 0,
      uv: (fu, k, r) => R.armSkin(fu, clamp((-.1 - r.y)/.44)),
      w: (x, y) => { const t = sst(-.25, -.31, y), h = sst(-.52, -.545, y); return [[ba, 1 - t], [be, t*(1 - h)], [bh, t*h]]; } });
    /* the hand, relaxed: a palm, curled fingers, a thumb (outfield men) */
    A.vr = 1;
    const Mw = new T3.Matrix4().multiplyMatrices(Ma, mat4(0, -.535, 0));
    part(A, blob(.019, .045, .04, 2.8, hi ? 10 : 6, hi ? 8 : 5), Mw, mat4(0, -.045, .002), swR(SW.skin), W1(bh));
    if(!far){
      part(A, blob(.016, .036, .037, 2.5, hi ? 10 : 6, hi ? 8 : 5), Mw, mat4(-s*.012, -.094, .004, 0, 0, s*.45), swR(SW.skin), W1(bh));
      part(A, blob(.011, .027, .012, 2.2, hi ? 8 : 5, hi ? 6 : 4), Mw, mat4(-s*.012, -.05, .036, -.15, 0, s*.3), swR(SW.skin), W1(bh));
    }
    /* the keeper's gloves: a padded fist with fingers, the cuff and its strap */
    A.vr = 2;
    part(A, blob(.026, .058, .052, 2.8, hi ? 12 : 6, hi ? 8 : 5), Mw, mat4(-s*.004, -.055, .004), (u, v) => R.glove(u*.5, .3 + .4*v), W1(bh));
    if(!far){
      part(A, blob(.022, .05, .05, 2.6, hi ? 12 : 6, hi ? 8 : 5), Mw, mat4(-s*.01, -.125, .012, .25, 0, 0), (u, v) => R.glove(.5 + u*.5, .3 + .4*v), W1(bh));
      part(A, blob(.018, .036, .017, 2.4, hi ? 8 : 5, hi ? 6 : 4), Mw, mat4(-s*.022, -.05, .056, -.35, 0, -s*.35), (u, v) => R.glove(u*.5, .3 + .4*v), W1(bh));
    }
    tube(A, [{ y: .02, rx: .036, rz: .04 }, { y: -.005, rx: .042, rz: .046 }, { y: -.04, rx: .038, rz: .044 }],
      { seg: seg(16), M: Mw, th0: 0, uv: (fu, k) => R.glove(fu, k/2*.25), w: () => W1(bh), cap1: false });
    /* and his long sleeves, over the forearm to the glove */
    tube(A, spline([{ y: -.15, r: .058 }, { y: -.24, r: .05 }, { y: -.29, r: .047 }, { y: -.34, r: .048 }, { y: -.44, r: .042 }, { y: -.51, r: .035 }], sk(2)).map(r => ({ y: r.y, rx: r.r*.94, rz: r.r })),
      { seg: seg(16), M: Ma, th0: 0, shape: (lx, ly, lz, th) => pushOut(lx, lz, 0, 0, .003*sst(-.25, -.3, ly)*sst(-.36, -.31, ly)*(fold(ly*120 + th) - .3)),
        uv: (fu, k, r) => R.lsleeve(fu, clamp((-.15 - r.y)/.36)),
        w: (x, y) => { const t = sst(-.25, -.31, y); return [[ba, 1 - t], [be, t]]; } });
    A.vr = 0;
  }

  /* ---------------- shorts ---------------- */
  const pel = spline([
    { y: 1.0, a: .158, f: .11, b: .116 }, { y: .96, a: .168, f: .117, b: .125 }, { y: .93, a: .174, f: .121, b: .13 },
    { y: .885, a: .182, f: .122, b: .136 }, { y: .85, a: .184, f: .114, b: .134 }, { y: .82, a: .17, f: .1, b: .12 }, { y: .8, a: .12, f: .07, b: .08 }, { y: .79, a: .04, f: .03, b: .03 }
  ], sk(2)).map(r => ({ y: r.y, a: r.a, f: r.f, b: r.b, n: r.y < .9 ? 2.8 : 2.4 }));
  tube(A, pel.reverse(), { seg: seg(40), M: I4, th0: -PI/2,
    uv: (fu, i, r, fa) => R.pelvis(fa, clamp((r.y - .79)/.21)),
    w: (x, y) => { const l = .45*sst(.86, .79, y)*clamp(Math.abs(x)/.07); return [[B.hips, 1 - l], [x > 0 ? B.thighL : B.thighR, l]]; } });
  for(let i = 0; i < 2; i++){
    const s = i ? -1 : 1, bt = i ? B.thighR : B.thighL, Mt = MB[bt];
    const lg = spline([{ y: .015, r: .094 }, { y: -.03, r: .104 }, { y: -.09, r: .106 }, { y: -.15, r: .102 }, { y: -.195, r: .099 }, { y: -.205, r: .096 }], sk(2));
    tube(A, lg.map(r => ({ y: r.y, rx: r.r*.98, rz: r.r*1.04, cx: s*.01, cz: -.006, n: 2.2 })), { seg: seg(26), M: Mt, th0: s > 0 ? PI/2 : -PI/2,
      shape: (lx, ly, lz, th) => pushOut(lx, lz, s*.01, -.006, .004*sst(-.06, -.17, ly)*(fold(th*3 + ly*30) - .4) + .004*sst(-.17, -.2, ly)),
      uv: (fu, k, r) => R.short(fu, clamp((r.y + .205)/.22)),
      w: (x, y) => { const t = sst(.04, -.12, y); return [[B.hips, 1 - t], [bt, t]]; } });
  }

  /* ---------------- legs: thigh, knee, calf; the sock over the shin pad ---------------- */
  for(let i = 0; i < 2; i++){
    const s = i ? -1 : 1, bt = i ? B.thighR : B.thighL, bk = i ? B.kneeR : B.kneeL, bf = i ? B.footR : B.footL, Mt = MB[bt];
    /* local y from the hip joint: knee at -.43, ankle at -.85 */
    const thigh = spline([
      { y: -.06, w: .084, f: .086, b: .092, cx: s*.006 }, { y: -.14, w: .08, f: .084, b: .084, cx: s*.004 }, { y: -.24, w: .073, f: .078, b: .07, cx: 0 },
      { y: -.32, w: .064, f: .07, b: .058, cx: -s*.004 }, { y: -.38, w: .055, f: .064, b: .05, cx: -s*.003 }, { y: -.42, w: .05, f: .06, b: .048, cx: 0 },
      { y: -.445, w: .048, f: .056, b: .048, cx: 0 }, { y: -.465, w: .05, f: .05, b: .052, cx: 0 }
    ], sk(2)).map(r => ({ y: r.y, rx: r.w, f: r.f, b: r.b, cx: r.cx }));
    tube(A, thigh, { seg: seg(20), M: Mt, th0: 0,
      shape: (lx, ly, lz, th) => {
        /* the kneecap and the vastus over it */
        const c = Math.cos(th); let d = .006*gs(ly + .425, .018)*Math.max(0, c)*Math.max(0, c);
        d += .004*gs(ly + .37, .03)*gs(Math.atan2(Math.sin(th), c) + s*.9, .5);
        return pushOut(lx, lz, 0, 0, d);
      },
      uv: (fu, k, r) => R.legSkin(fu, clamp((-.06 - r.y)/.4)),
      w: (x, y) => { const t = sst(-.4, -.46, y); return [[bt, 1 - t], [bk, t]]; } });
    /* the sock: rolled over at the top, the shin pad's flat face and edges under it, the calf, taped ankle */
    const sock = spline([
      { y: -.462, w: .053, f: .056, b: .056 }, { y: -.472, w: .057, f: .061, b: .061 }, { y: -.5, w: .056, f: .066, b: .062 },
      { y: -.54, w: .055, f: .07, b: .066 }, { y: -.6, w: .054, f: .07, b: .068 }, { y: -.66, w: .049, f: .067, b: .058 },
      { y: -.72, w: .042, f: .061, b: .046 }, { y: -.765, w: .036, f: .04, b: .04 }, { y: -.8, w: .034, f: .036, b: .038 },
      { y: -.84, w: .035, f: .038, b: .042 }, { y: -.87, w: .033, f: .036, b: .04 }
    ], sk(2)).map(r => ({ y: r.y, rx: r.w, f: r.f, b: r.b, n: 2.2 }));
    tube(A, sock, { seg: seg(20), M: Mt, th0: 0,
      shape: (lx, ly, lz, th) => {
        const c = Math.cos(th), pad = sst(-.49, -.51, ly)*sst(-.76, -.73, ly);
        /* the pad's flat face: the front pressed flatter, its edges stand a touch proud */
        const ed = gs(Math.abs(Math.atan2(Math.sin(th), c)) - .75, .12);
        let z = lz; if(c > .3) z -= .006*pad*(c - .3);
        const q = pushOut(lx, z, 0, 0, .0025*pad*ed + .003*gs(ly + .472, .006));
        return q;
      },
      uv: (fu, k, r) => R.sock(fu, clamp((-.462 - r.y)/.408)),
      w: (x, y) => { const t = sst(-.44, -.5, y), f = sst(-.82, -.86, y); return [[bt, 1 - t], [bk, t*(1 - f)], [bf, t*f]]; } });
  }

  /* ---------------- boots: upper, sole, studs ---------------- */
  for(let i = 0; i < 2; i++){
    const bf = i ? B.footR : B.footL, Mf = MB[bf], s = i ? -1 : 1;
    /* rings along the foot (local z heel -> toe), each a cross-section: half width, top, bottom (y from the ankle) */
    const BOOT = spline([
      { z: -.08, w: .018, t: -.005, bo: -.046 }, { z: -.072, w: .032, t: .032, bo: -.053 }, { z: -.05, w: .039, t: .05, bo: -.056 },
      { z: -.02, w: .041, t: .056, bo: -.056 }, { z: .02, w: .042, t: .05, bo: -.056 }, { z: .06, w: .044, t: .03, bo: -.056 },
      { z: .1, w: .046, t: .012, bo: -.056 }, { z: .14, w: .045, t: -.004, bo: -.056 }, { z: .175, w: .039, t: -.016, bo: -.055 },
      { z: .2, w: .029, t: -.026, bo: -.053 }, { z: .214, w: .017, t: -.034, bo: -.05 }, { z: .22, w: .005, t: -.042, bo: -.047 }
    ], sk(2));
    /* the ring's frame: x across, y along the foot (his z), z up (his y); u = 0 under the sole, .5 over the laces */
    const Mz = new T3.Matrix4().multiplyMatrices(Mf, new T3.Matrix4().set(1, 0, 0, s*.002, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    tube(A, BOOT.map(r => ({ y: r.z, rx: r.w, f: (r.t - r.bo)/2, b: (r.t - r.bo)/2, cz: (r.t + r.bo)/2, n: 3 })),
      { seg: seg(28), M: Mz, th0: PI, cap0: true, cap1: true,
        uv: (fu, k, r) => R.boot(fu, clamp((r.y + .078)/.297)),
        w: () => W1(bf) });
    if(hi){
      /* studs: six round ones, two at the heel, four under the ball of the foot */
      for(const [x, z] of [[.025, -.052], [-.025, -.052], [.032, .06], [-.03, .072], [.03, .14], [-.026, .155], [0, .185]])
        part(A, new T3.CylinderGeometry(.006, .009, .016, 8), Mf, mat4(x, -.062, z), swR(SW.stud), W1(bf));
    }
  }

  /* ---------------- the contact shadow, on the grass (see-through, drawn last) ---------------- */
  part(A, new T3.PlaneGeometry(1, 1.2), MB[B.ground], mat4(0, 0, 0, -PI/2), (u, v) => R.blob(.12 + .76*u, .12 + .76*v), W1(B.ground), 1);
  return finish(A);
}
/* a man's own geometry: the shared attributes, an index of only the triangles he wears (the GPU
   then never touches the other hair styles or the keeper's gloves) */
const VAR = new Map();
function variant(lod, gk, style){
  const key = lod + '|' + (gk ? 1 : 0) + '|' + style;
  if(VAR.has(key)) return VAR.get(key);
  const base = GEO[lod], va = base.attributes.aVar.array, ix = base.index.array, out = [];
  const keep = i => { const a = va[i]; return a < .5 || (a < 1.5 ? !gk : a < 2.5 ? gk : Math.abs(a - 10 - style) < .5); };
  for(let k = 0; k < ix.length; k += 3) if(keep(ix[k]) && keep(ix[k + 1]) && keep(ix[k + 2])) out.push(ix[k], ix[k + 1], ix[k + 2]);
  const g = new T3.BufferGeometry();
  for(const n of Object.keys(base.attributes)) g.setAttribute(n, base.attributes[n]);
  g.setIndex(out); g.boundingSphere = base.boundingSphere; g.boundingBox = base.boundingBox;
  VAR.set(key, g);
  return g;
}
function finish(A){
  const g = new T3.BufferGeometry();
  g.setAttribute('position', new T3.Float32BufferAttribute(A.p, 3));
  g.setAttribute('normal', new T3.Float32BufferAttribute(A.n, 3));
  g.setAttribute('uv', new T3.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('skinIndex', new T3.Uint16BufferAttribute(A.si, 4));
  g.setAttribute('skinWeight', new T3.Float32BufferAttribute(A.sw, 4));
  g.setAttribute('aVar', new T3.Float32BufferAttribute(A.va, 1));
  g.setIndex(A.ib.concat(A.iv));
  g.boundingSphere = new T3.Sphere(V(0, .95, 0), 1.45);
  g.boundingBox = new T3.Box3(V(-1.2, -.2, -1.2), V(1.2, 2.4, 1.2));
  return g;
}

/* ===================================== COLOUR HELPERS ===================================== */
const hexStr = c => typeof c === 'number' ? '#' + ('000000' + (c >>> 0).toString(16)).slice(-6) : (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#888888');
const rgbOf = hex => { const n = parseInt(hexStr(hex).slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const lum = hex => { const [r, g, b] = rgbOf(hex); return (.299*r + .587*g + .114*b)/255; };
const shade = (hex, k) => { const c = rgbOf(hex).map(v => Math.round(clamp(k > 0 ? v + (255 - v)*k : v*(1 + k), 0, 255))); return 'rgb(' + c.join(',') + ')'; };
const mix = (h1, h2, t) => { const a = rgbOf(h1), b = rgbOf(h2); return '#' + a.map((v, i) => ('0' + Math.round(lerp(v, b[i], t)).toString(16)).slice(-2)).join(''); };
const gap = (a, b) => { const A = rgbOf(a), Bc = rgbOf(b); return Math.hypot(A[0] - Bc[0], A[1] - Bc[1], A[2] - Bc[2]); };
const FONT = "'Barlow Semi Condensed', 'Arial Narrow', system-ui, sans-serif";
function canvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function colourTex(c){ const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; t.anisotropy = Math.min(8, W.renderer.capabilities.getMaxAnisotropy()); return t; }
function noiseDots(g, x0, y0, w, h, n, a, r){ g.save(); g.globalAlpha = a; for(let k = 0; k < n; k++){ g.fillStyle = r() < .5 ? '#000' : '#fff'; g.fillRect(x0 + r()*w, y0 + r()*h, 1.4, 1.4); } g.restore(); }

/* ===================================== THE SHARED MAPS =====================================
   NRM: the cloth's seams, stitching, folds and creases, the shin pads, the boots' stitching;
   alpha is roughness. MSK: r skin (tinted per man), g cloth sheen, b knit (.33 jersey, .66 mesh,
   1 rib), a occlusion. Height fields drawn in grey, slopes taken region by region. */
let GLOBAL = null;
function globalMaps(){
  if(GLOBAL) return GLOBAL;
  const t0 = performance.now(), N = ATL;
  const cv = canvas(N, N), g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N);
  const grey = v => 'rgb(' + v + ',' + v + ',' + v + ')';
  const path = (pts) => { g.beginPath(); pts.forEach((p, k) => g[k ? 'lineTo' : 'moveTo'](p[0], p[1])); };
  const seam = (pts, k = 1) => { g.setLineDash([]); g.lineCap = 'round'; g.lineJoin = 'round'; path(pts); g.strokeStyle = grey(128 + Math.round(20*k)); g.lineWidth = 5; g.stroke(); g.strokeStyle = grey(128 - Math.round(46*k)); g.lineWidth = 1.6; g.stroke(); };
  const stitch = (pts, k = 1) => { g.lineCap = 'butt'; g.setLineDash([2.4, 1.6]); path(pts); g.strokeStyle = grey(128 - Math.round(38*k)); g.lineWidth = 1.1; g.stroke(); g.setLineDash([]); };
  const P = (r, u, v) => [r[0] + u*r[2], r[1] + (1 - v)*r[3]];
  const T = L.torso;
  /* the shirt: side seams, raglan seams from the collar to the armpits, hem stitching, collar seam */
  for(const u of [0, .5, 1]) seam([P(T, u, 0), P(T, u, .83)], .9);
  for(const [uc, us] of [[.25, 0], [.25, .5], [.75, .5], [.75, 1]]){
    const pts = []; for(let k = 0; k <= 16; k++){ const s = k/16; pts.push(P(T, lerp(uc + (us > uc ? .085 : -.085), us, Math.pow(s, .8)), lerp(.985, .82, s))); }
    seam(pts, .8);
  }
  stitch([P(T, 0, .016), P(T, 1, .016)]); stitch([P(T, 0, .03), P(T, 1, .03)]);
  g.fillStyle = grey(108); g.fillRect(T[0], P(T, 0, .975)[1], T[2], 2);
  /* sleeves: underarm seam, hem stitching */
  { const r = L.sleeve; seam([P(r, .5, 0), P(r, .5, 1)], .7); stitch([P(r, 0, .9), P(r, 1, .9)]); stitch([P(r, 0, .95), P(r, 1, .95)]); }
  { const r = L.lsleeve; seam([P(r, .5, 0), P(r, .5, 1)], .7); g.fillStyle = grey(150); g.fillRect(r[0], P(r, 0, 1)[1], r[2], .07*r[3]); }
  /* shorts: side seams, waistband, hem stitching */
  { const r = L.pelvis; for(const u of [0, .5, 1]) seam([P(r, u, 0), P(r, u, 1)], .8); g.fillStyle = grey(150); g.fillRect(r[0], P(r, 0, 1)[1], r[2], .12*r[3]); g.fillStyle = grey(96); g.fillRect(r[0], P(r, 0, .88)[1], r[2], 1.6); }
  { const r = L.short; seam([P(r, 0, 0), P(r, 0, 1)], .8); seam([P(r, 1, 0), P(r, 1, 1)], .8); stitch([P(r, 0, .05), P(r, 1, .05)]); }
  /* socks: the rib of the turned-over top, the shin pad's outline under the cloth */
  { const r = L.sock; g.fillStyle = grey(150); for(let x = r[0]; x < r[0] + r[2]; x += 3) g.fillRect(x, P(r, 0, .085)[1], 1.4, .085*r[3]);
    g.fillStyle = grey(100); g.fillRect(r[0], P(r, 0, .09)[1], r[2], 2);
    for(const u0 of [0, 1]){ const d = u0 ? -1 : 1; g.strokeStyle = grey(150); g.lineWidth = 3; g.beginPath(); g.moveTo(...P(r, u0 + d*.13, .12)); g.lineTo(...P(r, u0 + d*.13, .7)); g.stroke(); }
    g.strokeStyle = grey(146); g.lineWidth = 3; g.beginPath(); g.moveTo(...P(r, 0, .7)); g.lineTo(...P(r, .13, .7)); g.moveTo(...P(r, .87, .7)); g.lineTo(...P(r, 1, .7)); g.stroke(); }
  /* gloves: finger grooves, the strap's edges */
  { const r = L.glove; for(let k = 1; k < 8; k++){ g.strokeStyle = grey(96); g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(r, k/8, .35)); g.lineTo(...P(r, k/8, .98)); g.stroke(); }
    g.fillStyle = grey(165); g.fillRect(r[0], P(r, 0, .26)[1], r[2], 3); g.fillRect(r[0], P(r, 0, .06)[1], r[2], 3); }
  /* boots: the stitched edge round the sole, the toe's stitching, the heel counter */
  { const r = L.boot; stitch([P(r, .13, 0), P(r, .13, 1)], 1.2); stitch([P(r, .87, 0), P(r, .87, 1)], 1.2);
    seam([P(r, .1, 0), P(r, .1, 1)], 1.3); seam([P(r, .9, 0), P(r, .9, 1)], 1.3);
    stitch([P(r, .25, .82), P(r, .75, .82)]); seam([P(r, .2, .18), P(r, .8, .18)], .9); }
  { const nr0 = rng(55); for(const rc of [L.hair, L.scalp]){ g.save(); g.beginPath(); g.rect(...rc); g.clip();
      for(let k = 0; k < 900; k++){ const x = rc[0] + nr0()*rc[2], y = rc[1] + nr0()*rc[3], l = 6 + nr0()*16; g.strokeStyle = grey(nr0() < .5 ? 114 : 142); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (nr0() - .5)*3, y + l); g.stroke(); } g.globalAlpha = 1; g.restore(); } }
  const line = g.getImageData(0, 0, N, N).data;

  /* the cloth's folds, at half size */
  const M2 = N/2, HF = new Float32Array(M2*M2), AO = new Float32Array(M2*M2).fill(1);
  const nr = rng(1234), NG = new Float32Array(64*64); for(let k = 0; k < NG.length; k++) NG[k] = nr();
  const nz = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy), a = xi & 63, b = (xi + 1) & 63, c = (yi & 63)*64, d = ((yi + 1) & 63)*64;
    return (NG[c + a]*(1 - u) + NG[c + b]*u)*(1 - v) + (NG[d + a]*(1 - u) + NG[d + b]*u)*v; };
  const fbm = (x, y) => nz(x, y)*.65 + nz(x*2.1 + 5.2, y*2.1 + 1.3)*.35;
  const field = (r, fn) => { const x0 = r[0] >> 1, y0 = r[1] >> 1, w = r[2] >> 1, h = r[3] >> 1;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const o = fn((x + .5)/w, 1 - (y + .5)/h); HF[(y0 + y)*M2 + x0 + x] = o[0]; if(o.length > 1) AO[(y0 + y)*M2 + x0 + x] = o[1]; } };
  field(L.torso, (u, v) => {
    const side = Math.min(u, Math.abs(u - .5), 1 - u);
    let h = 0, ao = 1;
    /* rolls round the waist */
    const wv = v*34 + 1.3*Math.sin(u*TAU*3 + .7) + .7*Math.sin(u*TAU*7 + 2.1) + 2.2*fbm(u*9, v*6);
    h += 2.2*(.3 + fbm(u*6 + 3.1, v*4))*sst(.32, .08, v)*(fold(wv*.5) - .55);
    /* drape from the chest, fans under the arms */
    const dr = u*TAU*8 + 1.4*Math.sin(v*7 + u*20) + 1.6*fbm(u*16, v*3);
    h += 1.6*sst(.3, .5, v)*sst(.8, .62, v)*(.35 + .65*Math.min(1, side/.1))*(fold(dr*.5) - .55);
    for(const us of [0, .5, 1]){ const du = (u - us)*24, dv = (v - .8)*14, r = Math.hypot(du, dv);
      if(r < 4){ h += 2.4*Math.exp(-r*r/1.4)*(fold(Math.atan2(dv, du)*4.5) - .5); ao *= 1 - .35*Math.exp(-r*r/1.2); } }
    ao *= .86 + .14*sst(0, .06, v);
    return [h, ao];
  });
  field(L.sleeve, (u, v) => { const e = Math.exp(-Math.pow((u - .5)*4, 2)); return [1.8*e*sst(.2, .6, v)*(fold(v*22 + 2*fbm(u*6, v*3)) - .5), 1 - .3*e*sst(.0, .4, v)*sst(.9, .5, v)]; });
  field(L.lsleeve, (u, v) => [1.6*sst(.15, .3, v)*sst(.6, .4, v)*(fold(v*30 + 2*fbm(u*7, v*3)) - .5) + .9*sst(.75, 1, v)*(fold(v*60) - .5), .9 + .1*sst(0, .2, v)]);
  field(L.pelvis, (u, v) => { const cr = Math.min(Math.abs(u - .25), Math.abs(u - .75)); return [1.6*sst(.5, .1, v)*Math.exp(-cr*cr*60)*(fold(Math.atan2(v - .0, (u % .5) - .25)*5) - .5) + .8*(fbm(u*10, v*5) - .5), .7 + .3*sst(0, .35, v)]; });
  field(L.short, (u, v) => [1.3*(fold(u*TAU*3 + v*6 + 2*fbm(u*7, v*3)) - .5)*sst(.7, .2, v), .82 + .18*sst(.1, .3, v)]);
  field(L.sock, (u, v) => { const a = sst(.72, .9, v); return [1.6*a*(fold(v*70 + 2*Math.sin(u*TAU*2) + 1.5*fbm(u*6, v*4)) - .5), .82 + .18*sst(0, .1, v)]; });
  field(L.legSkin, (u, v) => [.5*fbm(u*12, v*9), .9 + .1*sst(0, .1, v)]);
  field(L.armSkin, (u, v) => [.4*fbm(u*12, v*9), 1]);
  field(L.glove, (u, v) => [1.4*Math.sqrt(Math.abs(Math.sin(u*PI*8)))*sst(.32, .4, v) + .3*fbm(u*20, v*20), .8 + .2*sst(.3, .5, v)]);
  field(L.boot, (u, v) => [.25*fbm(u*24, v*12), .75 + .25*sst(.0, .2, Math.min(u, 1 - u))]);

  /* regions: no slope across an island's edge */
  const REG = new Uint8Array(N*N), RECTS = Object.values(L);
  RECTS.forEach((r, k) => { for(let y = r[1]; y < r[1] + r[3]; y++) REG.fill(k + 1, y*N + r[0], y*N + r[0] + r[2]); });
  const H = new Float32Array(N*N);
  for(let y = 0; y < N; y++){
    const fy = Math.min(M2 - 1.001, Math.max(0, y/2 - .25)), y0 = fy | 0, ty = fy - y0;
    for(let x = 0; x < N; x++){
      const fx = Math.min(M2 - 1.001, Math.max(0, x/2 - .25)), x0 = fx | 0, tx = fx - x0, a = y0*M2 + x0;
      const f = (HF[a]*(1 - tx) + HF[a + 1]*tx)*(1 - ty) + (HF[a + M2]*(1 - tx) + HF[a + M2 + 1]*tx)*ty;
      const i = y*N + x; H[i] = (line[i*4] - 128)/16 + f;
    }
  }
  /* roughness by island */
  const ROUGH = { torso: .8, sleeve: .8, lsleeve: .82, sw: .7, pelvis: .7, short: .7, sock: .9, legSkin: .58, armSkin: .58, glove: .72, boot: .48, face: .55, hair: .86, scalp: .75, blob: 1 };
  const roughOf = new Uint8Array(RECTS.length + 1).fill(200); Object.keys(L).forEach((k, i) => { roughOf[i + 1] = Math.round((ROUGH[k] || .8)*255); });
  const nrm = new Uint8Array(N*N*4);
  for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
    const i = y*N + x, r = REG[i];
    const il = x > 0 && REG[i - 1] === r ? i - 1 : i, ir = x < N - 1 && REG[i + 1] === r ? i + 1 : i;
    const iu = y > 0 && REG[i - N] === r ? i - N : i, id = y < N - 1 && REG[i + N] === r ? i + N : i;
    const dx = (H[ir] - H[il])/((ir - il) || 1), dy = (H[id] - H[iu])/(((id - iu)/N) || 1);
    const nx = -dx, ny = dy, l = 1/Math.sqrt(nx*nx + ny*ny + 1);
    const o = ((N - 1 - y)*N + x)*4;
    nrm[o] = (nx*l*.5 + .5)*255 + .5; nrm[o + 1] = (ny*l*.5 + .5)*255 + .5; nrm[o + 2] = (l*.5 + .5)*255 + .5; nrm[o + 3] = roughOf[r];
  }
  /* swatches: studs and the collar's rib have their own roughness */
  const swR = (i, ro) => { const [sx, sy] = swPx(i); for(let y = sy; y < sy + 32; y++) for(let x = sx; x < sx + 32; x++) nrm[((N - 1 - y)*N + x)*4 + 3] = ro*255; };
  swR(SW.stud, .35); swR(SW.collar, .85); swR(SW.skin, .58); swR(SW.latex, .6);
  /* MSK at half size */
  const msk = new Uint8Array(M2*M2*4);
  const put = (r, sk, sh, kn) => { const x0 = r[0] >> 1, y0 = r[1] >> 1, w = Math.max(1, r[2] >> 1), h = Math.max(1, r[3] >> 1);
    for(let y = y0; y < y0 + h; y++) for(let x = x0; x < x0 + w; x++){ const o = ((M2 - 1 - y)*M2 + x)*4; msk[o] = sk*255; msk[o + 1] = sh*255; msk[o + 2] = kn*255; } };
  put([0, 0, N, N], 0, 0, 0);
  put(L.torso, 0, 1, .33); put(L.sleeve, 0, 1, .33); put(L.lsleeve, 0, 1, .33); put(L.pelvis, 0, .8, .0); put(L.short, 0, .8, 0); put(L.sock, 0, .9, 1);
  /* the mesh panels down the sides */
  for(const u of [0, .5, 1]) put([Math.max(0, Math.round(u*1024) - 46), Math.round(P(T, 0, .8)[1]), 92, Math.round(.62*T[3])], 0, 1, .66);
  put(L.legSkin, 1, .15, 0); put(L.armSkin, 1, .15, 0); put(L.glove, 0, .4, 0); put(L.hair, 0, .22, 0);
  { const [sx, sy] = swPx(SW.skin); put([sx, sy, 32, 32], 1, .15, 0); }
  { const [sx, sy] = swPx(SW.collar); put([sx, sy, 32, 32], 0, 1, 1); }
  for(let y = 0; y < M2; y++) for(let x = 0; x < M2; x++){ const o = ((M2 - 1 - y)*M2 + x)*4; msk[o + 3] = clamp(AO[y*M2 + x])*255; }
  const dt = (data, n) => { const t = new T3.DataTexture(data, n, n, T3.RGBAFormat); t.generateMipmaps = true; t.minFilter = T3.LinearMipmapLinearFilter; t.magFilter = T3.LinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t; };
  GLOBAL = { nrm: dt(nrm, N), msk: dt(msk, M2), ms: Math.round(performance.now() - t0) };
  return GLOBAL;
}

/* ===================================== THE TEAM MAP ===================================== */
function kitOf(o){
  const shirt = hexStr(o.shirt), shorts = hexStr(o.shorts == null ? 0xf4f4f0 : o.shorts), socks = hexStr(o.socks == null ? o.shirt : o.socks);
  const ink = hexStr(o.ink || (lum(shirt) > .55 ? '#141414' : '#ffffff'));
  /* the trim (collar, cuffs, the stripe down the shorts): the shorts' colour if it shows on the shirt, else the number's */
  const trim = gap(shorts, shirt) > 90 ? shorts : ink;
  const h = seedOf(shirt + shorts + socks);
  return { shirt, shorts, socks, ink, trim, gk: !!o.gloves, pat: h % 6, collar: (h >>> 4) % 3, h };
}
const teamCache = new Map();
function teamMap(K){
  const key = [K.shirt, K.shorts, K.socks, K.ink, K.gk ? 1 : 0].join('|');
  if(teamCache.has(key)){ const t = teamCache.get(key); t.userData.users++; return t; }
  let c = canvas(ATL, ATL); const g = c.getContext('2d');
  paintTeam(g, K);
  /* below the top quality a team map is kept at half size: a quarter of the memory, and on a phone's
     pitch the men are too small to tell (the numbers, names and faces are on the man maps anyway) */
  if(QUAL < 2){ const h = canvas(ATL/2, ATL/2), hg = h.getContext('2d'); hg.imageSmoothingQuality = 'high'; hg.drawImage(c, 0, 0, ATL/2, ATL/2); c = h; }
  const t = colourTex(c); t.userData = { key, users: 1 };
  teamCache.set(key, t);
  return t;
}
function releaseTeam(t){
  if(!t || !t.userData) return;
  if(--t.userData.users <= 0){ teamCache.delete(t.userData.key); t.dispose(); }
}
function paintTeam(g, K){
  const r = rng(K.h || 1), P = (rc, u, v) => [rc[0] + u*rc[2], rc[1] + (1 - v)*rc[3]];
  const fill = (rc, col) => { g.fillStyle = col; g.fillRect(rc[0], rc[1], rc[2], rc[3]); };
  g.fillStyle = K.shirt; g.fillRect(0, 0, ATL, ATL);
  /* ---- the shirt ---- */
  const T = L.torso; fill(T, K.shirt);
  g.save(); g.beginPath(); g.rect(...T); g.clip();
  const dk = lum(K.shirt) < .25;
  if(K.pat === 1){ g.globalAlpha = .07; g.fillStyle = dk ? '#fff' : '#000'; for(let x = 0; x < T[2]; x += 20) g.fillRect(x, T[1], 3, T[3]); }
  else if(K.pat === 2){ const gr = g.createLinearGradient(0, T[1] + T[3], 0, T[1]); gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(.6, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(...T); }
  else if(K.pat === 3){ g.globalAlpha = .1; g.fillStyle = dk ? '#fff' : '#000'; for(let y = T[1]; y < T[1] + T[3]; y += 34) g.fillRect(0, y, T[2], 13); }
  else if(K.pat === 4){ g.globalAlpha = .08; g.strokeStyle = dk ? '#fff' : '#000'; g.lineWidth = 9; for(let x = -T[3]; x < T[2]; x += 38){ g.beginPath(); g.moveTo(x, T[1] + T[3]); g.lineTo(x + T[3]*.8, T[1]); g.stroke(); } }
  else if(K.pat === 5){ g.globalAlpha = .9; g.fillStyle = shade(K.shirt, dk ? .14 : -.1); const y0 = P(T, 0, .74)[1]; g.fillRect(0, y0, T[2], .05*T[3]); }
  g.globalAlpha = 1;
  /* side panels under the arms, a shade darker */
  for(const u of [0, .5, 1]){
    const x = u*T[2], gr = g.createLinearGradient(x - 60, 0, x + 60, 0), sc = shade(K.shirt, -.16);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.3, sc); gr.addColorStop(.7, sc); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - 60, P(T, 0, .82)[1], 120, .7*T[3]);
  }
  /* raglan piping from the collar to the armpits, in the trim */
  g.strokeStyle = K.trim; g.lineWidth = 4; g.globalAlpha = .9;
  for(const [uc, us] of [[.25, 0], [.25, .5], [.75, .5], [.75, 1]]){
    g.beginPath(); for(let k = 0; k <= 16; k++){ const s = k/16, p = P(T, lerp(uc + (us > uc ? .085 : -.085), us, Math.pow(s, .8)), lerp(.985, .82, s)); g[k ? 'lineTo' : 'moveTo'](p[0], p[1] - 3); } g.stroke();
  }
  g.globalAlpha = 1;
  /* the neckline: a band of trim, a V at the front for some */
  g.fillStyle = K.trim; g.fillRect(0, T[1], T[2], .03*T[3]);
  if(K.collar === 1){ const p = P(T, .25, 1); g.beginPath(); g.moveTo(p[0] - 70, p[1]); g.lineTo(p[0], p[1] + .13*T[3]); g.lineTo(p[0] + 70, p[1]); g.lineTo(p[0] + 52, p[1]); g.lineTo(p[0], p[1] + .095*T[3]); g.lineTo(p[0] - 52, p[1]); g.closePath(); g.fill(); }
  /* the hem: two rows of stitching, a shade darker */
  g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, P(T, 0, .035)[1], T[2], .035*T[3]);
  noiseDots(g, T[0], T[1], T[2], T[3], 9000, .03, r);
  g.restore();
  /* ---- sleeves: a cuff in the trim ---- */
  for(const [rc, cuff] of [[L.sleeve, .9], [L.lsleeve, .92]]){
    fill(rc, K.shirt);
    if(K.pat === 2 && rc === L.sleeve){ const gr = g.createLinearGradient(0, rc[1], 0, rc[1] + rc[3]); gr.addColorStop(0, 'rgba(0,0,0,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(...rc); }
    g.fillStyle = K.trim; g.fillRect(rc[0], P(rc, 0, 1)[1], rc[2], (1 - cuff)*rc[3]);
    g.fillStyle = shade(K.shirt, -.15); g.fillRect(rc[0] + rc[2]*.47, rc[1], rc[2]*.06, rc[3]*cuff);
    noiseDots(g, rc[0], rc[1], rc[2], rc[3], 1500, .03, r);
  }
  /* ---- shorts: a stripe down the outside of each leg ---- */
  const stripe = gap(K.trim, K.shorts) > 60 ? K.trim : (gap(K.shirt, K.shorts) > 60 ? K.shirt : shade(K.shorts, -.25));
  for(const rc of [L.pelvis, L.short]){
    fill(rc, K.shorts);
    g.fillStyle = stripe; for(const u of rc === L.pelvis ? [0, .5, 1] : [0, 1]) g.fillRect(rc[0] + u*rc[2] - 9, rc[1], 18, rc[3]);
    noiseDots(g, rc[0], rc[1], rc[2], rc[3], 2000, .035, r);
  }
  g.fillStyle = shade(K.shorts, -.14); g.fillRect(L.pelvis[0], L.pelvis[1], L.pelvis[2], .1*L.pelvis[3]);
  g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(L.short[0], P(L.short, 0, .06)[1], L.short[2], .06*L.short[3]);
  /* ---- socks: two hoops at the top, the turned-over band ---- */
  { const rc = L.sock; fill(rc, K.socks);
    const hoop = gap(K.trim, K.socks) > 60 ? K.trim : (lum(K.socks) > .5 ? '#1a1a1a' : '#f2f2ee');
    g.fillStyle = hoop; g.fillRect(rc[0], P(rc, 0, .065)[1], rc[2], .018*rc[3]); g.fillRect(rc[0], P(rc, 0, .035)[1], rc[2], .012*rc[3]);
    g.fillStyle = 'rgba(0,0,0,.08)'; for(let x = rc[0]; x < rc[0] + rc[2]; x += 3) g.fillRect(x, P(rc, 0, .09)[1], 1.2, .09*rc[3]);
    /* the shin pad shows through a little at its edges */
    g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(rc[0] + .1*rc[2], P(rc, 0, .7)[1], .06*rc[2], .58*rc[3]); g.fillRect(rc[0] + .84*rc[2], P(rc, 0, .7)[1], .06*rc[2], .58*rc[3]);
    noiseDots(g, rc[0], rc[1], rc[2], rc[3], 2500, .04, r); }
  /* ---- skin: neutral grey, tinted per man in the shader ---- */
  for(const rc of [L.legSkin, L.armSkin]){
    fill(rc, '#808080');
    noiseDots(g, rc[0], rc[1], rc[2], rc[3], 3000, .05, r);
  }
  /* the knee: a little darker round the cap, lighter on it */
  { const rc = L.legSkin, kv = 1 - (.425 - .06)/.4; const p = P(rc, 0, kv); const gr = g.createLinearGradient(0, p[1] - 22, 0, p[1] + 22);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(rc[0], p[1] - 22, rc[2], 44); }
  /* ---- gloves: the keeper's, latex palm, a strap in the kit ---- */
  { const rc = L.glove, base = lum(K.shirt) > .6 ? '#1b1d22' : '#f1f2ee', acc = K.shirt;
    fill(rc, base);
    g.fillStyle = acc; g.fillRect(rc[0], P(rc, 0, .9)[1], rc[2], .12*rc[3]);
    g.fillStyle = acc; g.fillRect(rc[0], P(rc, 0, .26)[1], rc[2], .26*rc[3]);
    g.fillStyle = base; g.fillRect(rc[0], P(rc, 0, .17)[1], rc[2], .05*rc[3]);
    g.fillStyle = '#c9ccc4'; g.fillRect(rc[0] + .25*rc[2], P(rc, 0, .85)[1], .22*rc[2], .5*rc[3]);
    noiseDots(g, rc[0], rc[1], rc[2], rc[3], 2000, .04, r); }
  /* ---- swatches ---- */
  const sw = { collar: K.trim, skin: '#808080', stud: '#d9dbd6', sole: '#202124', white: '#f1f1ec', black: '#141416', trim: K.trim, latex: '#c9ccc4', band: K.shorts, kit: K.shirt, lace: '#f1f1ec' };
  for(const [name, j] of Object.entries(SW)){ const [x, y] = swPx(j); g.fillStyle = hexStr(sw[name]); g.fillRect(x, y, 32, 32); }
  /* ---- the contact shadow: soft, darkest under the feet ---- */
  { const rc = L.blob; g.clearRect(rc[0], rc[1], rc[2], rc[3]);
    const cx = rc[0] + rc[2]/2, cy = rc[1] + rc[3]/2, gr = g.createRadialGradient(cx, cy, 2, cx, cy, rc[2]*.36);
    gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(.45, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(cx, cy); g.scale(1, rc[3]/rc[2]); g.translate(-cx, -cy); g.fillStyle = gr; g.fillRect(rc[0], rc[1] - 20, rc[2], rc[2]); g.restore(); }
}

/* ===================================== HIS LOOK ===================================== */
const SKINS = ['#f2d0b4', '#e6bb96', '#d6a47b', '#c18a60', '#a87350', '#8e5c3c', '#75482e', '#5f3a25'];
const HAIRS = ['#14100c', '#22170f', '#33231a', '#4d3422', '#6e4b2c', '#94693c', '#b98b52', '#d2b277', '#7a2f1b'];
const EYES = ['#3a2416', '#4f3320', '#2f4c66', '#4c5a32', '#6b5130'];
const BOOTS = [['#f1f1ec', '#1b1c1f'], ['#141416', '#e9b84c'], ['#ff5a1f', '#141416'], ['#1e6bff', '#f1f1ec'], ['#e8e23a', '#141416'], ['#e94b9a', '#141416'],
  ['#20c7a8', '#141416'], ['#c9a24a', '#141416'], ['#d63031', '#f1f1ec'], ['#141416', '#f1f1ec'], ['#f1f1ec', '#ff5a1f'], ['#5b2bd9', '#e8e23a']];
function looksOf(name, o){
  const r = rng(seedOf('man:' + name)), skin = Math.min(SKINS.length - 1, Math.floor(r()*SKINS.length));
  const dark = skin >= 5;
  const hair = dark ? (r()*2)|0 : skin <= 1 && r() < .35 ? 4 + ((r()*5)|0) : (r()*5)|0;
  const sr = r();
  let style = dark ? (sr < .3 ? 0 : sr < .5 ? 1 : sr < .75 ? 5 : 2) : (sr < .3 ? 0 : sr < .42 ? 1 : sr < .64 ? 2 : sr < .84 ? 3 : 4);
  const beard = r() < .45 ? 0 : r() < .6 ? 1 : 2;
  const eyes = dark ? (r()*2)|0 : (r()*EYES.length)|0;
  const boot = BOOTS[(r()*BOOTS.length)|0];
  return { skin: SKINS[skin], skinI: skin, hair: HAIRS[hair], style, beard, eyes: EYES[eyes], boot, brow: .8 + r()*.5, jaw: r(), seed: (r()*1e9)|0 };
}

/* ===================================== THE MAN MAP =====================================
   Fractions of the man map (x, y down, w, h), and the team-map rectangles they cover. */
const MM = { num: [0, 0, 1, .5], name: [0, .5, 1, .125], face: [0, .625, .5, .375], hair: [.5, .625, .25, .125], scalp: [.75, .625, .25, .125], boot: [.5, .75, .5, .25] };
/* the back number (~25 cm), the chest number (~10 cm), the name over the back number */
const NUM_BACK = [608, 124, 320, 178], NUM_FRONT = [194, 134, 124, 72], NAME_BACK = [600, 62, 336, 40];
const BOXES = [[NUM_BACK, MM.num], [NUM_FRONT, MM.num], [NAME_BACK, MM.name], [L.face, MM.face], [L.hair, MM.hair], [L.scalp, MM.scalp], [L.boot, MM.boot]];
const BOX_R = BOXES.map(([a]) => new T3.Vector4(a[0]/ATL, 1 - (a[1] + a[3])/ATL, (a[0] + a[2])/ATL, 1 - a[1]/ATL));
const BOX_T = BOXES.map(([a, m]) => { const x0 = a[0]/ATL, x1 = (a[0] + a[2])/ATL, y0 = 1 - (a[1] + a[3])/ATL, y1 = 1 - a[1]/ATL;
  const sx = m[2]/(x1 - x0), sy = m[3]/(y1 - y0); return new T3.Vector4(sx, sy, m[0] - x0*sx, (1 - m[1] - m[3]) - y0*sy); });

function fontReady(f){ try { return !document.fonts || document.fonts.check(f); } catch(e){ return true; } }
function manMap(K, lk, name, num, S){
  const c = canvas(S, S), g = c.getContext('2d');
  const tex = colourTex(c);
  const paint = () => { g.clearRect(0, 0, S, S); paintMan(g, S, K, lk, name, num); tex.needsUpdate = true; };
  paint();
  const f = '800 40px ' + FONT;
  if(!fontReady(f) && document.fonts && document.fonts.load) document.fonts.load(f).then(() => { if(tex.image) paint(); }).catch(() => {});
  return tex;
}
function paintMan(g, S, K, lk, name, num){
  const box = m => [m[0]*S, m[1]*S, m[2]*S, m[3]*S];
  const r = rng(lk.seed || 1);
  /* ---- the number: heat-pressed, a thin outline in the trim, the faintest shadow ---- */
  if(num){
    const [x, y, w, h] = box(MM.num);
    const out = gap(K.trim, K.ink) > 80 && gap(K.trim, K.shirt) > 60 ? K.trim : null;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = h*.98; g.font = '800 ' + fs + 'px ' + FONT;
    const tw = g.measureText(num).width, sx = Math.min(1, w*.86/(tw || 1));
    g.translate(x + w/2, y + h*.53); g.scale(sx*1.05, 1);
    g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = h*.03;
    if(out){ g.strokeStyle = out; g.lineWidth = h*.07; g.strokeText(num, 0, 0); }
    g.shadowColor = 'transparent'; g.fillStyle = K.ink; g.fillText(num, 0, 0);
    /* a fine print texture, so it reads as material rather than paint */
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .1;
    for(let k = 0; k < 600; k++){ g.fillStyle = r() < .5 ? '#000' : '#fff'; g.fillRect((r() - .5)*w/sx, (r() - .5)*h, 2, 2); }
    g.restore();
  }
  /* ---- the name ---- */
  if(name){
    const [x, y, w, h] = box(MM.name);
    const txt = String(name).toUpperCase();
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = h*.9; g.font = '700 ' + fs + 'px ' + FONT;
    const sp = fs*.12, chars = [...txt], ws = chars.map(ch => g.measureText(ch).width), tw = ws.reduce((a, b) => a + b, 0) + sp*(chars.length - 1);
    const sx = Math.min(1, w*.94/(tw || 1));
    g.translate(x + w/2, y + h*.55); g.scale(sx, 1); g.fillStyle = K.ink;
    let cx = -tw/2; g.textAlign = 'left'; chars.forEach((ch, i) => { g.fillText(ch, cx, 0); cx += ws[i] + sp; });
    g.restore();
  }
  paintFace(g, box(MM.face), lk, r);
  paintHair(g, box(MM.hair), lk, r, false);
  paintScalp(g, box(MM.scalp), lk, r);
  paintBoot(g, box(MM.boot), lk, r);
}
/* the face, u across the front of the head (his right ear to his left), v chin to crown.
   Soft and quiet on purpose: shading and a few marks, never a painted portrait. */
function paintFace(g, [x0, y0, w, h], lk, r){
  const X = u => x0 + u*w, Y = v => y0 + (1 - v)*h, vOf = y => (y - HY0)/(HY1 - HY0);
  const sk = lk.skin, dark = lk.skinI >= 5;
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.fillStyle = sk; g.fillRect(x0, y0, w, h);
  /* the round of the head: darker towards the sides, under the jaw, at the temples */
  let gr = g.createLinearGradient(x0, 0, x0 + w, 0);
  gr.addColorStop(0, 'rgba(40,20,10,.28)'); gr.addColorStop(.22, 'rgba(40,20,10,.06)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(.78, 'rgba(40,20,10,.06)'); gr.addColorStop(1, 'rgba(40,20,10,.28)');
  g.fillStyle = gr; g.fillRect(x0, y0, w, h);
  gr = g.createLinearGradient(0, Y(.02), 0, Y(.2)); gr.addColorStop(0, 'rgba(40,20,10,.25)'); gr.addColorStop(1, 'rgba(40,20,10,0)'); g.fillStyle = gr; g.fillRect(x0, Y(.2), w, Y(0) - Y(.2));
  /* the cheeks warmer, the forehead a touch lighter */
  for(const s of [-1, 1]){ const cx = X(.5 + s*.15), cy = Y(.33); gr = g.createRadialGradient(cx, cy, 1, cx, cy, w*.1); gr.addColorStop(0, dark ? 'rgba(120,40,30,.08)' : 'rgba(200,70,60,.1)'); gr.addColorStop(1, 'rgba(200,70,60,0)'); g.fillStyle = gr; g.fillRect(cx - w*.1, cy - w*.1, w*.2, w*.2); }
  gr = g.createRadialGradient(X(.5), Y(.64), 1, X(.5), Y(.64), w*.2); gr.addColorStop(0, 'rgba(255,240,225,.1)'); gr.addColorStop(1, 'rgba(255,240,225,0)'); g.fillStyle = gr; g.fillRect(X(.3), Y(.84), w*.4, h*.4);
  /* the nose: shade down its sides, the nostrils */
  const nv = vOf(.05), nb = vOf(.04);
  for(const s of [-1, 1]){ gr = g.createLinearGradient(X(.5 + s*.012), 0, X(.5 + s*.05), 0); gr.addColorStop(0, 'rgba(60,30,15,0)'); gr.addColorStop(.5, 'rgba(60,30,15,.14)'); gr.addColorStop(1, 'rgba(60,30,15,0)'); g.fillStyle = gr; g.fillRect(Math.min(X(.5 + s*.012), X(.5 + s*.05)), Y(vOf(.085)), Math.abs(X(.5 + s*.05) - X(.5 + s*.012)), Y(nb) - Y(vOf(.085))); }
  g.fillStyle = 'rgba(40,18,10,.45)'; for(const s of [-1, 1]){ g.beginPath(); g.ellipse(X(.5 + s*.022), Y(nb - .004), w*.009, h*.008, 0, 0, TAU); g.fill(); }
  /* the eyes: set in sockets, a lid, a dark iris; small, so they never stare */
  const ev = vOf(.078), eu = .127;
  for(const s of [-1, 1]){
    const cx = X(.5 + s*eu), cy = Y(ev);
    gr = g.createRadialGradient(cx, cy, 1, cx, cy, w*.06); gr.addColorStop(0, 'rgba(50,25,15,.22)'); gr.addColorStop(1, 'rgba(50,25,15,0)'); g.fillStyle = gr; g.fillRect(cx - w*.07, cy - w*.07, w*.14, w*.14);
    const ew = w*.038, eh = h*.016;
    g.fillStyle = dark ? 'rgba(225,215,205,.85)' : 'rgba(235,228,220,.9)'; g.beginPath(); g.ellipse(cx, cy, ew, eh, 0, 0, TAU); g.fill();
    g.fillStyle = lk.eyes; g.beginPath(); g.arc(cx + s*w*.004, cy + eh*.1, eh*1.05, 0, TAU); g.fill();
    g.fillStyle = 'rgba(10,6,4,.9)'; g.beginPath(); g.arc(cx + s*w*.004, cy + eh*.1, eh*.45, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(25,12,8,.85)'; g.lineWidth = Math.max(1, h*.011); g.beginPath(); g.ellipse(cx, cy + eh*.2, ew*1.05, eh*1.25, 0, PI*1.05, PI*1.95); g.stroke();
    g.strokeStyle = 'rgba(60,30,20,.25)'; g.lineWidth = Math.max(1, h*.006); g.beginPath(); g.ellipse(cx, cy - eh*.2, ew*.95, eh*1.15, 0, PI*.1, PI*.9); g.stroke();
    /* the brow: hair-coloured strokes, heavier at the inner end */
    const bv = vOf(.098), by = Y(bv);
    g.strokeStyle = lk.hair; g.lineCap = 'round';
    for(let k = 0; k < 26; k++){ const t = r(); const bx = cx - s*ew*1.1 + s*t*ew*2.4; const yy = by - Math.sin(t*PI*.9 + .15)*h*.012 + (r() - .5)*h*.008;
      g.globalAlpha = (.5 + .4*(1 - t))*Math.min(1, lk.brow); g.lineWidth = Math.max(1, h*(.009 + .007*(1 - t))*lk.brow); g.beginPath(); g.moveTo(bx, yy); g.lineTo(bx + s*w*.012, yy - h*.004); g.stroke(); }
    g.globalAlpha = 1; g.lineCap = 'butt';
  }
  /* the mouth: lips a little darker and warmer, a line between them */
  const mv = vOf(.014), my = Y(mv), mw = w*.06;
  g.fillStyle = dark ? 'rgba(70,30,25,.35)' : 'rgba(150,60,55,.3)';
  g.beginPath(); g.ellipse(X(.5), my + h*.006, mw*.9, h*.016, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(X(.5), my - h*.008, mw, h*.012, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,15,10,.7)'; g.lineWidth = Math.max(1, h*.008); g.beginPath(); g.moveTo(X(.5) - mw, my); g.quadraticCurveTo(X(.5), my + h*.006, X(.5) + mw, my); g.stroke();
  /* stubble or a short beard: hair-coloured speckle over the jaw, the chin and the upper lip */
  if(lk.beard){
    const a = lk.beard === 1 ? .1 : .32, n = lk.beard === 1 ? 2200 : 4200;
    g.fillStyle = lk.hair;
    for(let k = 0; k < n; k++){
      const u = r(), v = r()*.36;
      const inJaw = v < .3 - .2*Math.pow(Math.abs(u - .5)*2, 3) && (Math.abs(u - .5) < .4 || v > .1);
      const lip = Math.abs(v - mv) < .025 && Math.abs(u - .5) < .07;
      const tache = v > mv + .01 && v < mv + .06 && Math.abs(u - .5) < .085;
      if(!(inJaw || tache) || lip) continue;
      g.globalAlpha = a*(.5 + .5*r()); g.fillRect(X(u), Y(v), Math.max(1, w*.006), Math.max(1, h*.008));
    }
    g.globalAlpha = 1;
  }
  /* the hair over the forehead and the temples, and sideburns down to the ears */
  if(lk.style !== 1){
    g.fillStyle = lk.hair;
    g.beginPath(); g.moveTo(X(0), Y(1)); g.lineTo(X(0), Y(vOf(.04)));
    for(let k = 0; k <= 40; k++){ const u = k/40, th = -PI/2 + u*PI; let hv = vOf(hairLine(lk.style, th));
      if(u < .05 || u > .95) hv = Math.min(hv, vOf(.075 + .02*Math.abs(u - .5)));
      g.lineTo(X(u), Y(hv) + (r() - .5)*h*.01); }
    g.lineTo(X(1), Y(1)); g.closePath(); g.fill();
    /* the hairline is never a line: short hairs and thinning just below it */
    for(let k = 0; k < 900; k++){ const u = r(), th = -PI/2 + u*PI, hv = vOf(hairLine(lk.style, th)) - r()*.05*r();
      g.globalAlpha = .25 + .35*r(); g.fillRect(X(u), Y(hv), Math.max(1, w*.004), Math.max(1, h*.012)); }
    g.globalAlpha = 1;
    noiseDots(g, x0, Y(1), w, Y(vOf(.12)) - Y(1), 600, .12, r);
  } else {
    gr = g.createLinearGradient(0, Y(1), 0, Y(vOf(.15))); gr.addColorStop(0, 'rgba(30,20,15,.18)'); gr.addColorStop(1, 'rgba(30,20,15,0)'); g.fillStyle = gr; g.fillRect(x0, Y(1), w, Y(vOf(.15)) - Y(1));
  }
  noiseDots(g, x0, y0, w, h, 2400, .035, r);
  g.restore();
}
function paintHair(g, [x0, y0, w, h], lk, r){
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  if(lk.style === 1){ g.fillStyle = lk.skin; g.fillRect(x0, y0, w, h); g.restore(); return; }
  g.fillStyle = lk.hair; g.fillRect(x0, y0, w, h);
  /* strands: lighter and darker streaks along the hair, short and curly for the textured styles */
  const curly = lk.style === 2 || lk.style === 5;
  const k0 = w/128;
  for(let k = 0; k < (curly ? 1400 : 700)*k0*k0; k++){
    const x = x0 + r()*w, y = y0 + r()*h, l = (curly ? 1 + r()*1.6 : 3 + r()*8)*k0;
    g.strokeStyle = r() < (curly ? .15 : .4) ? shade(lk.hair, curly ? .05 : .1) : shade(lk.hair, -.35); g.globalAlpha = .28; g.lineWidth = Math.max(.6, .5*k0);
    g.beginPath(); g.moveTo(x, y); if(curly) g.arc(x, y, l*.5, r()*TAU, r()*TAU + 3); else g.lineTo(x + (r() - .5)*2, y + l); g.stroke();
  }
  g.restore();
}
/* the back of the head: hair above the hairline, the neck's skin below it */
function paintScalp(g, [x0, y0, w, h], lk, r){
  const X = u => x0 + u*w, Y = v => y0 + (1 - v)*h, vOf = y => (y - HY0)/(HY1 - HY0);
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.fillStyle = lk.skin; g.fillRect(x0, y0, w, h);
  const gr = g.createLinearGradient(0, Y(0), 0, Y(.3)); gr.addColorStop(0, 'rgba(40,20,10,.2)'); gr.addColorStop(1, 'rgba(40,20,10,0)'); g.fillStyle = gr; g.fillRect(x0, Y(.3), w, Y(0) - Y(.3));
  if(lk.style !== 1){
    g.fillStyle = lk.hair; g.beginPath(); g.moveTo(X(0), Y(1));
    for(let k = 0; k <= 40; k++){ const u = k/40, th = PI/2 + u*PI; g.lineTo(X(u), Y(vOf(hairLine(lk.style, th) - .006))); }
    g.lineTo(X(1), Y(1)); g.closePath(); g.fill();
    noiseDots(g, x0, y0, w, h*.7, 500, .15, r);
  } else { g.fillStyle = 'rgba(30,20,15,.16)'; g.fillRect(x0, Y(1), w, Y(vOf(.06)) - Y(1)); }
  g.restore();
}
/* boots: u round the boot (0 under the sole, .5 over the laces), v heel to toe. A plain
   modern boot: its colour, a contrasting sole plate, one geometric flash. No maker's marks. */
function paintBoot(g, [x0, y0, w, h], lk, r){
  const X = u => x0 + u*w, Y = v => y0 + (1 - v)*h;
  const [base, acc] = lk.boot;
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.fillStyle = base; g.fillRect(x0, y0, w, h);
  /* the sole plate */
  g.fillStyle = acc; g.fillRect(x0, y0, w*.05, h); g.fillRect(X(.95), y0, w*.05, h);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X(.045), y0, w*.01, h); g.fillRect(X(.945), y0, w*.01, h);
  /* a flash down each side: a slanted band of the accent */
  g.fillStyle = acc; g.globalAlpha = .9;
  for(const uc of [.27, .73]){ g.beginPath(); g.moveTo(X(uc - .06), Y(.25)); g.lineTo(X(uc + .02), Y(.25)); g.lineTo(X(uc + .08), Y(.62)); g.lineTo(X(uc), Y(.62)); g.closePath(); g.fill(); }
  g.globalAlpha = 1;
  /* the knitted collar round the ankle, at the heel end over the top */
  g.fillStyle = shade(base, -.45); g.fillRect(X(.36), Y(.38), w*.28, h*.28);
  /* laces over the instep */
  /* laces over the instep, in the boot's own colour a shade off: a row of crossings, not stripes */
  const lace = lum(base) > .6 ? shade(base, -.22) : shade(base, .3);
  g.strokeStyle = lace; g.lineWidth = Math.max(1, h*.012);
  for(let k = 0; k < 9; k++){ const v = .4 + k*.03; g.beginPath(); g.moveTo(X(.475), Y(v)); g.lineTo(X(.525), Y(v + .02)); g.moveTo(X(.525), Y(v)); g.lineTo(X(.475), Y(v + .02)); g.stroke(); }
  /* a lighter toe box, the heel counter darker */
  let gr = g.createLinearGradient(0, Y(1), 0, Y(.75)); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x0, Y(1), w, Y(.75) - Y(1));
  gr = g.createLinearGradient(0, Y(0), 0, Y(.2)); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x0, Y(.2), w, Y(0) - Y(.2));
  noiseDots(g, x0, y0, w, h, 800, .05, r);
  g.restore();
}

/* ===================================== THE MATERIAL ===================================== */
const SHADER_KEY = 'ball3d-man-v1';
const KEEP_GLSL = `
attribute float aVar;
uniform vec2 bVar;
float bKeep(){
  if(aVar < .5) return 1.;
  if(aVar < 1.5) return 1. - bVar.x;
  if(aVar < 2.5) return bVar.x;
  return abs(aVar - 10. - bVar.y) < .5 ? 1. : 0.;
}`;
function patchVertex(shader, U){
  shader.uniforms.bVar = U.bVar;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>' + KEEP_GLSL)
    .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) * bKeep();');
}
function patch(shader, U, G){
  patchVertex(shader, U);
  Object.assign(shader.uniforms, { bMan: U.bMan, bMask: { value: G.msk }, bSkin: U.bSkin, bBoxR: { value: BOX_R }, bBoxT: { value: BOX_T }, bQ: U.bQ });
  const nfm = T3.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', `mapN.xy *= normalScale;
  {
    /* the knit: jersey dimples, the side panels' mesh, the rib of the socks and the collar; it fades out
       with distance so it never shimmers */
    vec2 px = vUv*1024.0;
    float kind = bMk.b > 0.9 ? 1.0 : bMk.b > 0.5 ? 0.66 : 0.33;
    float amp = (bMk.b > 0.1 ? 0.3 : 0.0)*(1.0 - bLetter)*bQ;
    mapN.xy += bKnit(px, kind, amp);
    /* the number and the name are pressed on: their edge stands up */
    vec2 du = vec2(max(1.0/1024.0, fwidth(vUv.x)), 0.0), dv = vec2(0.0, max(1.0/1024.0, fwidth(vUv.y)));
    float hL = bM.a, hLx = texture2D(bMan, (vUv + du)*bT.xy + bT.zw).a*bIn, hLy = texture2D(bMan, (vUv + dv)*bT.xy + bT.zw).a*bIn;
    mapN.xy -= vec2(hLx - hL, hLy - hL)*bIsL*1.2/max(1.0, du.x*1024.0);
  }`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform sampler2D bMan;
uniform sampler2D bMask;
uniform vec3 bSkin;
uniform vec4 bBoxR[7];
uniform vec4 bBoxT[7];
uniform float bQ;
vec4 bBoxOf(vec2 uv, out float inBox, out float letter){
  vec4 t = vec4(0.0); inBox = 0.0; letter = 0.0;
  for(int i = 0; i < 7; i++){
    vec4 r = bBoxR[i];
    float h = step(r.x, uv.x)*step(uv.x, r.z)*step(r.y, uv.y)*step(uv.y, r.w);
    t = mix(t, bBoxT[i], h); inBox = max(inBox, h);
    if(i < 3) letter = max(letter, h);
  }
  return t;
}
float bKnitH(vec2 p, float kind){
  if(kind < 0.5){ vec2 q = p*vec2(0.5, 0.58); q.x += 0.5*floor(q.y); vec2 f = fract(q) - 0.5; return -exp(-dot(f, f)*14.0); }
  if(kind < 0.8){ vec2 q = p*vec2(0.32, 0.37); q.x += 0.5*floor(q.y); vec2 f = fract(q) - 0.5; return -1.5*smoothstep(0.26, 0.13, length(f)); }
  return abs(sin(p.x*1.57));
}
vec2 bKnit(vec2 p, float kind, float amp){
  float per = kind < 0.5 ? 2.0 : kind < 0.8 ? 3.0 : 2.0;
  float fw = max(fwidth(p.x), fwidth(p.y));
  float fade = 1.0 - smoothstep(per*0.18, per*0.42, fw);
  if(fade <= 0.0 || amp <= 0.0) return vec2(0.0);
  float e = 0.2, h0 = bKnitH(p, kind);
  return -vec2(bKnitH(p + vec2(e, 0.0), kind) - h0, bKnitH(p + vec2(0.0, e), kind) - h0)/e*amp*fade;
}`)
    .replace('#include <map_fragment>', `#include <map_fragment>
  float bIn, bIsL; vec4 bT = bBoxOf(vUv, bIn, bIsL);
  vec4 bM = texture2D(bMan, vUv*bT.xy + bT.zw)*bIn;
  bM.a *= bIsL > 0.5 ? 1.0 : bIn;
  diffuseColor.rgb = mix(diffuseColor.rgb, mapTexelToLinear(vec4(bM.rgb, 1.0)).rgb*diffuse, bM.a);
  vec4 bMk = texture2D(bMask, vUv);
  /* skin: the neutral grey of the map, coloured by this man's skin */
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*bSkin*4.63, bMk.r*(1.0 - bIn));
  float bLetter = bM.a*bIsL;
  /* the occlusion of the folds and creases */
  diffuseColor.rgb *= mix(1.0, bMk.a, 0.85);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(texture2D(normalMap, vUv).a, 0.5, bLetter);`)
    .replace('#include <normal_fragment_maps>', nfm)
    .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `{
    /* cloth: a soft sheen at grazing angles instead of a plastic highlight; skin a little warmth where the light turns */
    vec3 bV = normalize(vViewPosition);
    float bFr = pow(1.0 - saturate(dot(normal, bV)), 3.0);
    vec3 bIrr = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse)/max(diffuseColor.rgb, vec3(0.03));
    outgoingLight += bMk.g*bFr*bIrr*mix(diffuseColor.rgb, vec3(1.0), 0.4)*0.38*bQ;
    outgoingLight += bMk.r*(1.0 - bIn)*bFr*bIrr*diffuseColor.rgb*vec3(0.5, 0.18, 0.1)*0.6;
  }
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
}
function manMaterial(atlas, man, skin){
  const G = globalMaps();
  const U = { bMan: { value: man }, bSkin: { value: new T3.Color(skin).convertSRGBToLinear() }, bVar: { value: new T3.Vector2(0, 0) }, bQ: { value: 1 } };
  const m = new T3.MeshStandardMaterial({ map: atlas, normalMap: G.nrm, normalScale: new T3.Vector2(1, 1), roughness: 1, metalness: 0,
    skinning: true, transparent: true, depthWrite: true, alphaTest: .02 });
  /* the stadium's light from every side (assets/ball3d/stage.js), on the men only: it is the one thing
     that sells cloth and skin, and on every pixel of the stands it would cost a phone dearly */
  try { if(B3.stage){ m.envMap = B3.stage(T3, W.renderer).env(); m.envMapIntensity = 1; } } catch(e){}
  m.onBeforeCompile = shader => patch(shader, U, G);
  m.customProgramCacheKey = () => SHADER_KEY;
  const d = new T3.MeshDepthMaterial({ depthPacking: T3.RGBADepthPacking, skinning: true, map: atlas, alphaTest: .5 });
  d.onBeforeCompile = shader => patchVertex(shader, U);
  d.customProgramCacheKey = () => SHADER_KEY + '-depth';
  m.userData.U = U; m.userData.depth = d;
  return m;
}

/* ===================================== A MAN ===================================== */
const allMen = new Set();
let QUAL = 2;
/* every frame, after the scene's matrices and before the skeletons are read: the contact shadow
   under his hips, and the level of detail by how tall he is on the screen */
const _p = V(), _q = new T3.Quaternion(), _s = V(), _m = new T3.Matrix4(), _y = V(), _e = new T3.Euler();
const _db = new T3.Vector2();
function frameHook(renderer, scene, camera){
  const set = scene.userData.b3men; if(!set) return;
  renderer.getDrawingBufferSize(_db);
  const tanF = Math.tan((camera.fov || 40)*PI/360);
  for(const f of set){
    if(!f.root.parent){ set.delete(f); continue; }
    if(!f.root.visible) continue;
    f.root.matrixWorld.decompose(_p, _q, _s);
    const sc = _s.x;
    /* the shadow on the grass, under the hips, turned with him */
    f.hips.getWorldPosition(_y);
    _e.setFromQuaternion(_q, 'YXZ');
    const hy = (_y.y - _p.y)/(sc || 1), k = clamp(1.15 - Math.max(0, hy - .9)*.9, .55, 1.2);
    _m.compose(_s.set(_y.x, .012, _y.z), _q.setFromEuler(_e.set(0, _e.y, 0)), V(sc*k, sc*k, sc*k));
    f.bones[B.ground].matrixWorld.copy(_m);
    /* near men in full, far men light */
    const d = Math.max(.1, _y.distanceTo(camera.position)), px = 1.9*sc/(2*d*tanF)*_db.y;
    const cur = f.lod, lim = QUAL >= 2 ? [90, 190] : QUAL >= 1 ? [110, 260] : [140, 1e9], hy2 = .12;
    let want = px > lim[1]*(cur === 'hi' ? 1 - hy2 : 1 + hy2) ? 'hi' : px > lim[0]*(cur === 'far' ? 1 + hy2 : 1 - hy2) ? 'lo' : 'far';
    if(want !== cur){ f.lod = want; f.mesh.geometry = variant(want, f.gk, f.looks.style); }
    /* far men keep their contact shadow but throw no real one below the top quality: it halves the shadow pass */
    f.mesh.castShadow = QUAL >= 2 || f.lod !== 'far';
  }
}
function hook(scene){
  if(scene.userData.b3men) return;
  scene.userData.b3men = new Set();
  B3.addHook(scene, frameHook);
}
function player(o, into){
  buildAll();
  const scene = into || W.scene;
  const K = kitOf(o), name = o.name || ('#' + (o.number || '') + K.shirt);
  const lk = Object.assign(looksOf(name, o), o.looks || {});
  const atlas = teamMap(K);
  const S = into && into !== W.scene ? 256 : 512;
  const man = manMap(K, lk, o.name ? String(o.name) : '', String(o.number || ''), S);
  const mat = manMaterial(atlas, man, lk.skin);
  mat.userData.U.bVar.value.set(o.gloves ? 1 : 0, lk.style);
  mat.userData.U.bQ.value = QUAL >= 2 ? 1 : 0;
  const root = new T3.Group();
  const bones = makeBones();
  root.add(bones[B.hips]); root.add(bones[B.ground]);
  bones[B.ground].matrixAutoUpdate = false;
  const skel = new T3.Skeleton(bones, INV.map(m => m.clone()));
  const mesh = new T3.SkinnedMesh(variant('lo', !!o.gloves, lk.style), mat);
  mesh.customDepthMaterial = mat.userData.depth;
  mesh.bind(skel, new T3.Matrix4());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = true;
  root.add(mesh);
  scene.add(root);
  const f = {
    root, mesh, bones, skinned: true, looks: lk, lod: 'lo', gk: !!o.gloves,
    hips: bones[B.hips], torso: bones[B.torso], head: bones[B.head],
    legs: [bones[B.thighL], bones[B.thighR]], knees: [bones[B.kneeL], bones[B.kneeR]], feet: [bones[B.footL], bones[B.footR]],
    arms: [bones[B.armL], bones[B.armR]], elbows: [bones[B.elbowL], bones[B.elbowR]], hands: [bones[B.handL], bones[B.handR]],
    own: [mat, mat.userData.depth, man, { dispose: () => releaseTeam(atlas) }],
    sync: p => sync(f, p)
  };
  hook(scene); scene.userData.b3men.add(f); allMen.add(f);
  return f;
}
/* a planted foot lies flat on the grass; a foot in the air follows the shin. p.aL / p.aR set the ankle
   outright (radians, + toes up) */
function sync(f, p){
  const hy = f.hips.position.y;
  for(let i = 0; i < 2; i++){
    const s = i ? 'R' : 'L', a = p['a' + s];
    if(a != null){ f.feet[i].rotation.x = a; continue; }
    const h = p['h' + s] || 0, k = p['k' + s] || 0;
    const ank = hy - .05 - .43*Math.cos(h) - .42*Math.cos(h - k);
    const planted = sst(.17, .08, ank);
    f.feet[i].rotation.x = clamp(h - k, -.6, .9)*planted;
  }
}
function freeRig(f, from){
  if(!f) return;
  try { (from || f.root.parent || W.scene).remove(f.root); } catch(e){}
  for(const x of f.own || []) try { x.dispose && x.dispose(); } catch(e){}
}
function quality(q){
  if(q != null){ QUAL = clamp(q|0, 0, 2);
    for(const f of allMen){ if(!f.root.parent){ allMen.delete(f); continue; } f.mesh.material.userData.U.bQ.value = QUAL >= 2 ? 1 : 0; } }
  return QUAL;
}
const api = { player, freeRig, sync, quality, globalMaps, buildAll, kitOf, looksOf, BONES: BDEF.map(d => d[0]), geo: () => GEO,
  stats: () => ({ teams: teamCache.size, variants: VAR.size, farVerts: GEO ? GEO.far.attributes.position.count : 0, hiVerts: GEO ? GEO.hi.attributes.position.count : 0, hiTris: GEO ? GEO.hi.index.count/3 : 0, loVerts: GEO ? GEO.lo.attributes.position.count : 0, loTris: GEO ? GEO.lo.index.count/3 : 0, buildMs: GEO ? GEO.ms : 0, mapsMs: GLOBAL ? GLOBAL.ms : 0 }) };
B3.playersApi = api;
try { if(B3.stage) quality(B3.stage(T3, W.renderer).q()); } catch(e){}
return api;
};

/* one onBeforeRender per scene, shared by everything that needs a look at the frame first */
B3.addHook = B3.addHook || function(scene, fn){
  const hs = scene.userData.b3hooks || (scene.userData.b3hooks = []);
  if(hs.indexOf(fn) < 0) hs.push(fn);
  scene.onBeforeRender = function(renderer, sc, camera, target){ for(const h of hs) h(renderer, sc, camera, target); };
};
})();
