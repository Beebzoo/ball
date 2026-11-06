/* Hang Time in 3D: the court, the net, the stadium, the ball and the cameras, and the game clock.
   A view, never a driver: match3d.js decides what happens, this only shows it.

   Court: metres, y up, x across, z along, the net at z 0, you at +z, as in flight.js.
   THE CLOCK: gt is game time, and everything that moves reads it. The hang is gt running at a crawl, so the
   ball, both players and the racket all slow down together. Real time keeps going for the camera and the UI.

   Everything is built in code. There are no image files, so nothing here needs a licence. The lines and the
   net are drawn by the shader, exactly, at any distance: no texture to blur and no mesh to shimmer. */
(function(R){
  const T3 = window.THREE;
  const SIN = 4.115, DBL = 5.485, BASE = 11.885, SVC = 6.40, POST = 6.40;
  const lin = c => new T3.Color(c).convertSRGBToLinear();
  const clamp = (t, a, b) => t < a ? a : t > b ? b : t, mix = (a, b, t) => a + (b - a) * t;
  const SURFACES = {
    hard: { inner: "#17508f", outer: "#14574a", wear: 0.1, rough: 0.74, stripe: 0 },
    clay: { inner: "#b4552d", outer: "#a64d29", wear: 0.2, rough: 0.92, stripe: 0 },
    grass: { inner: "#2f6e2c", outer: "#2a6329", wear: 0.2, rough: 0.85, stripe: 0.09, dirt: "#8a7a4e" }
  };
  const HEAT = ["#e8fb3c", "#ffb03a", "#ff5a4a"];

  const V = R.v3 = { gt: 0, rate: 1, ready: false, frames: { n: 0, ms: 0, slow: 0 } };
  let renderer, scene, camera, sun, net, courtM, ballM, shadowB, trail, rings = [], hooks = [], raf = 0, last = 0, wait = [], timers = [];
  let rateFrom = 1, rateTo = 1, rateT = 1, rateD = 1;

  /* ---------- a tiled noise, for the court's grain ---------- */
  function noiseTex(){
    const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d"), img = g.createImageData(N, N), d = img.data;
    let s = 917; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const G = new Float32Array(64 * 64); for(let k = 0; k < G.length; k++) G[k] = r();
    const nz = (x, y, w) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = xi % w, b = (xi + 1) % w, cc = (yi % w) * 64, dd = ((yi + 1) % w) * 64; return (G[cc + a] * (1 - u) + G[cc + b] * u) * (1 - v) + (G[dd + a] * (1 - u) + G[dd + b] * u) * v; };
    for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
      const o = (y * N + x) * 4, f = nz(x / N * 4, y / N * 4, 4) * 0.5 + nz(x / N * 8, y / N * 8, 8) * 0.3 + nz(x / N * 16, y / N * 16, 16) * 0.2;
      d[o] = 110 + r() * 40 + (r() - 0.5) * 60; d[o + 1] = f * 255; d[o + 2] = nz(x / N * 32, y / N * 32, 32) * 255; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  /* ---------- the court: one plane, one shader ---------- */
  function court(surf){
    const s = SURFACES[surf] || SURFACES.hard, m = new T3.MeshStandardMaterial({ roughness: s.rough, metalness: 0, envMapIntensity: 0.22 });
    const U = { uGrain: { value: noiseTex() }, uIn: { value: lin(s.inner) }, uOut: { value: lin(s.outer) }, uWear: { value: s.wear }, uStripe: { value: s.stripe }, uDirt: { value: lin(s.dirt || "#000000") }, uHasDirt: { value: s.dirt ? 1 : 0 } };
    courtM = { m, U };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 cW;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n  cW = (modelMatrix*vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 cW;
uniform sampler2D uGrain; uniform vec3 uIn; uniform vec3 uOut; uniform float uWear; uniform float uStripe; uniform vec3 uDirt; uniform float uHasDirt;
/* how much of this pixel a strip of half-width hw covers, exactly */
float strip(float d, float hw, float w){ w = max(w, 1e-4); return clamp((d + hw)/w + .5, 0., 1.) - clamp((d - hw)/w + .5, 0., 1.); }
float seg(float a, float a0, float a1, float w){ return clamp((a - a0)/w + .5, 0., 1.) - clamp((a - a1)/w + .5, 0., 1.); }
float gauss(float d, float s){ return exp(-d*d/(s*s)); }`)
        .replace("#include <map_fragment>", `#include <map_fragment>
  {
    vec2 p = cW.xz; float wx = max(fwidth(p.x), 1e-4), wz = max(fwidth(p.y), 1e-4);
    float ax = abs(p.x), az = abs(p.y);
    float inDbl = seg(p.x, -${DBL.toFixed(3)}, ${DBL.toFixed(3)}, wx)*seg(p.y, -${BASE.toFixed(3)}, ${BASE.toFixed(3)}, wz);
    vec3 grain = texture2D(uGrain, p*1.9).rgb, big = texture2D(uGrain, p*.11 + .3).rgb;
    vec3 col = mix(uOut, uIn, inDbl);
    /* the paint: a grain up close, slow rollers' patches across the court */
    float near = clamp(1.4 - length(fwidth(p))*22., 0., 1.);
    col *= 1. + (grain.r - .5)*.14*near + (big.g - .5)*.1 + (grain.g - .5)*.04;
    /* play wears it: behind the baselines, around the T and the service boxes */
    float wear = gauss(az - 12.4, 1.15)*smoothstep(4.6, 2.2, ax) + .5*gauss(az - 6.6, 1.6)*gauss(ax, 1.6) + .35*gauss(az - 10.3, 2.2)*smoothstep(4.4, 1.4, ax);
    wear *= .7 + big.b*.7 + (grain.b - .5)*.6;
    /* grass is mown in lanes, and wears to dirt where they play */
    if(uStripe > 0.){ float lane = abs(fract(p.y/2.6) - .5)*2. - .5; col *= 1. + uStripe*clamp(lane/max(wz*.8, .02), -1., 1.); }
    col = mix(col, mix(col*1.12 + vec3(.012), uDirt*(.8 + big.g*.5), uHasDirt), clamp(wear*uWear*5., 0., 1.));
    /* the lines */
    float L = 0.;
    float zb = seg(p.y, -${(BASE + 0.05).toFixed(3)}, ${(BASE + 0.05).toFixed(3)}, wz), xd = seg(p.x, -${(DBL + 0.025).toFixed(3)}, ${(DBL + 0.025).toFixed(3)}, wx), xs = seg(p.x, -${(SIN + 0.025).toFixed(3)}, ${(SIN + 0.025).toFixed(3)}, wx);
    L = max(L, strip(az - 11.835, .05, wz)*xd);                 /* baselines, 10 cm */
    L = max(L, strip(ax - ${DBL.toFixed(3)}, .025, wx)*zb);     /* the doubles lines */
    L = max(L, strip(ax - ${SIN.toFixed(3)}, .025, wx)*zb);     /* the singles lines */
    L = max(L, strip(az - ${SVC.toFixed(3)}, .025, wz)*xs);     /* the service lines */
    L = max(L, strip(p.x, .025, wx)*seg(p.y, -${SVC.toFixed(3)}, ${SVC.toFixed(3)}, wz)); /* the centre line */
    L = max(L, strip(p.x, .025, wx)*step(11.685, az)*zb);       /* the centre marks */
    vec3 chalk = vec3(.93, .94, .92)*(1. - .1*wear);
    col = mix(col, chalk, L*.97);
    /* baked: the floodlights' pool, the soft shadows of the net, the dark under the barriers */
    float pool = .78 + .32*exp(-(p.x*p.x)/(90.) - (p.y*p.y)/(420.));
    float netSh = .24*gauss(p.y + .42, .34)*step(ax, ${POST.toFixed(2)}) + .14*gauss(p.y - .5, .5)*step(ax, ${POST.toFixed(2)});
    float edge = smoothstep(16.5, 18.5, az) + smoothstep(8.2, 9.2, ax);
    diffuseColor.rgb = col*pool*(1. - netSh)*(1. - .55*clamp(edge, 0., 1.));
  }`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
  { vec3 gr = texture2D(uGrain, cW.xz*.5).rgb; roughnessFactor = clamp(roughnessFactor + (gr.g - .5)*.2, .2, 1.); }`);
    };
    m.customProgramCacheKey = () => "racket-court-v1";
    const mesh = new T3.Mesh(new T3.PlaneGeometry(44, 70), m);
    mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  /* ---------- the net: a grid drawn per pixel, a ripple by formula ---------- */
  const NET_Y0 = 1.07, NET_Y1 = 0.914;
  function buildNet(){
    const U = { uHit: { value: new T3.Vector4(0, 0.6, -10, 0) }, uT: { value: 0 }, uSun: { value: 1 } };
    const sag = "float top(float x){ float u = abs(x)/" + POST.toFixed(2) + "; return " + NET_Y1.toFixed(3) + " + (" + NET_Y0.toFixed(3) + " - " + NET_Y1.toFixed(3) + ")*u*u; }";
    const mat = new T3.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, side: T3.DoubleSide,
      extensions: { derivatives: true },
      vertexShader: `${sag}
uniform vec4 uHit; uniform float uT;
varying vec2 vP; varying float vTop; varying float vShade;
void main(){
  float h = top(position.x), y = position.y*h;
  vP = vec2(position.x, y); vTop = h;
  /* the ball pushes a pocket in, and it rings out from there */
  float tt = max(uT - uHit.z, 0.), r = length(vec2(position.x - uHit.x, y - uHit.y));
  float env = uHit.w*exp(-tt*5.5)*smoothstep(0., .02, tt), pin = smoothstep(0., .12, y)*smoothstep(0., .05, h - y)*smoothstep(0., .4, ${POST.toFixed(2)} - abs(position.x));
  float z = env*pin*(exp(-r*r/.28)*cos(tt*17.) + .35*exp(-r*r/2.6)*cos(tt*11. - r*5.));
  vShade = z;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(position.x, y, z, 1.);
}`,
      fragmentShader: `uniform float uT; varying vec2 vP; varying float vTop; varying float vShade;
/* iq's box-filtered grid: the exact share of this pixel that is hole */
float hole(vec2 p, float n, vec2 w){
  vec2 a = p + .5*w, b = p - .5*w;
  vec2 i = (floor(a) + min(fract(a)*n, 1.) - floor(b) - min(fract(b)*n, 1.))/(n*w);
  return (1. - i.x)*(1. - i.y);
}
void main(){
  vec2 pc = vP/.045, w = max(abs(dFdx(pc)), abs(dFdy(pc))) + 1e-4;
  float h = hole(pc, 11., w);
  float d = vTop - vP.y, px = max(abs(dFdy(vP.y)), 1e-4);
  /* tape along the top, a band down the middle, the side bands */
  float tape = 1. - smoothstep(.055 - px*.5, .055 + px*.5, d);
  float strap = (1. - smoothstep(.024 - px*.5, .024 + px*.5, abs(vP.x)));
  float side = smoothstep(${(POST - 0.03).toFixed(2)}, ${(POST - 0.02).toFixed(2)}, abs(vP.x));
  float white = max(tape, strap);
  vec3 cord = vec3(.012, .016, .02)*(1. + 7.*max(vShade, 0.));
  vec3 tapeCol = vec3(.96, .97, .95)*(.86 + .14*smoothstep(0., .05, d));
  vec3 col = mix(cord, tapeCol, white);
  float a = mix(1. - h, 1., max(white, side));
  gl_FragColor = vec4(col, a*.98);
  #include <encodings_fragment>
}`
    });
    const g = new T3.PlaneGeometry(POST * 2, 1, 96, 10); g.translate(0, 0.5, 0);
    const mesh = new T3.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2;
    scene.add(mesh);
    /* posts, singles sticks, the winder */
    const dark = new T3.MeshStandardMaterial({ color: lin("#123326"), roughness: 0.45, metalness: 0.4 });
    for(const s of [-1, 1]){
      const p = new T3.Mesh(new T3.CylinderGeometry(0.042, 0.042, 1.09, 14), dark); p.position.set(s * POST, 0.545, 0); p.castShadow = true; scene.add(p);
      const c = new T3.Mesh(new T3.SphereGeometry(0.05, 12, 8), dark); c.position.set(s * POST, 1.09, 0); scene.add(c);
      const w = new T3.Mesh(new T3.CylinderGeometry(0.03, 0.03, 0.09, 10), dark); w.rotation.x = Math.PI / 2; w.position.set(s * POST, 0.92, 0.07); scene.add(w);
      const st = new T3.Mesh(new T3.CylinderGeometry(0.012, 0.012, 1.07, 8), new T3.MeshStandardMaterial({ color: lin("#d9dcd6"), roughness: 0.5 })); st.position.set(s * 5.029, 0.535, 0); st.castShadow = true; scene.add(st);
    }
    return { mesh, U };
  }

  /* ---------- the stadium ---------- */
  function crowdTex(){
    const W = 1024, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); let s = 4242; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = "#0b0f16"; g.fillRect(0, 0, W, H);
    const cols = ["#c9c6bb", "#b3ad9f", "#6f7889", "#3a4d6e", "#2a3345", "#8c3a35", "#b8913a", "#3a6a52", "#d8d5ca", "#4f5563", "#242a35", "#1c2029"];
    const rows = 13, rh = H / rows, skin = ["#caa98f", "#b08a6e", "#7f5f48", "#54402f"];
    g.filter = "blur(1.3px)";
    for(let y = 0; y < rows; y++){
      const cw = 37;
      for(let x = -cw; x < W + cw; x += cw){
        if(r() < 0.1) continue;
        const px = x + (r() - 0.5) * 12 + (y % 2) * 18, py = y * rh + rh * 0.34 + (r() - 0.5) * 3;
        g.fillStyle = cols[(r() * cols.length) | 0]; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(px, py + rh * 0.42, 13, rh * 0.42, 0, 0, 7); g.fill();
        g.globalAlpha = 0.68; g.fillStyle = skin[(r() * 4) | 0]; g.beginPath(); g.arc(px, py, 6.6, 0, 7); g.fill();
      }
    }
    g.globalAlpha = 1; g.filter = "none";
    const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.encoding = T3.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  /* a closed loop round the court, as a strip from one rounded rectangle up to a wider, higher one */
  function ring(sx0, sz0, y0, sx1, sz1, y1, mat, uScale, vcol, vScale){
    const N = 96, pos = [], uv = [], col = [], idx = [];
    const pt = (a, sx, sz) => { const c = Math.cos(a), s = Math.sin(a), e = 0.17, x = Math.sign(c) * Math.pow(Math.abs(c), e) * sx, z = Math.sign(s) * Math.pow(Math.abs(s), e) * sz; return [x, z]; };
    let u = 0, prev = null;
    for(let i = 0; i <= N; i++){
      const a = i / N * Math.PI * 2 + 0.03, p0 = pt(a, sx0, sz0), p1 = pt(a, sx1, sz1);
      if(prev) u += Math.hypot(p1[0] - prev[0], p1[1] - prev[1]); prev = p1;
      pos.push(p0[0], y0, p0[1], p1[0], y1, p1[1]); uv.push(u * uScale, 0, u * uScale, vScale || 1);
      if(vcol){ col.push(vcol[0], vcol[0], vcol[0], vcol[1], vcol[1], vcol[1]); }
      if(i < N){ const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new T3.BufferGeometry();
    g.setAttribute("position", new T3.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T3.Float32BufferAttribute(uv, 2));
    if(vcol) g.setAttribute("color", new T3.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new T3.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
    return m;
  }
  function wallTex(){
    const c = document.createElement("canvas"); c.width = 1024; c.height = 96; const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, "#14304f"); gr.addColorStop(1, "#0d2036");
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 96); g.fillStyle = "#e4f53c"; g.fillRect(0, 0, 1024, 3);
    g.font = "800 44px system-ui, Segoe UI, sans-serif"; g.textBaseline = "middle"; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,.17)";
    for(let i = 0; i < 3; i++) g.fillText("R A C K E T", 170 + i * 342, 52);
    const t = new T3.CanvasTexture(c); t.wrapS = T3.RepeatWrapping; t.encoding = T3.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  function stadium(){
    /* the barrier, then the bowl */
    ring(9.6, 19.2, 0, 9.6, 19.2, 1.25, new T3.MeshBasicMaterial({ map: wallTex(), side: T3.DoubleSide, color: 0xd8dde4 }), 1 / 17, null);
    ring(9.6, 19.2, 1.25, 11, 20.6, 1.6, new T3.MeshBasicMaterial({ color: lin("#0b1420") }), 1, null);
    const crowd = new T3.MeshBasicMaterial({ map: crowdTex(), vertexColors: true, side: T3.DoubleSide });
    ring(11, 20.6, 1.6, 27, 38, 14.5, crowd, 1 / 11, [0.62, 0.2], 3);
    ring(29, 40, 16.5, 40, 50, 26, new T3.MeshBasicMaterial({ map: crowd.map, vertexColors: true, side: T3.DoubleSide, color: 0x6a7080 }), 1 / 14, [0.26, 0.08], 2);
    ring(27, 38, 14.5, 29, 40, 16.5, new T3.MeshBasicMaterial({ color: lin("#0f1826") }), 1, null);
    /* the umpire's chair, in silhouette, and the benches */
    const steel = new T3.MeshStandardMaterial({ color: lin("#2b3644"), roughness: 0.5, metalness: 0.3 });
    const add = (w, h, d, x, y, z) => { const m = new T3.Mesh(new T3.BoxGeometry(w, h, d), steel); m.position.set(x, y, z); m.castShadow = true; scene.add(m); return m; };
    for(const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) add(0.05, 1.9, 0.05, -7.1 + dx, 0.95, dz);
    add(0.75, 0.05, 0.75, -7.1, 1.9, 0); add(0.06, 0.65, 0.65, -7.45, 2.22, 0); add(0.4, 0.12, 0.5, -7.05, 2.0, 0);
    const bench = (s, z) => { add(0.55, 0.42, 2.2, s * 7.9, 0.21, z); add(0.1, 0.5, 2.2, s * 8.16, 0.6, z); };
    bench(-1, 3.6); bench(-1, -3.6);
    /* the floodlights: bars of light high on the roof */
    const lamp = new T3.MeshBasicMaterial({ color: new T3.Color(9, 8.6, 7.8) }), halo = glowTex();
    for(const s of [-1, 1]) for(let k = -2; k <= 2; k++){
      const m = new T3.Mesh(new T3.BoxGeometry(0.5, 0.25, 5), lamp); m.position.set(s * 25, 27, k * 15); m.rotation.z = s * 0.5; scene.add(m);
      const sp = new T3.Sprite(new T3.SpriteMaterial({ map: halo, color: 0xffeedd, blending: T3.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false })); sp.position.copy(m.position); sp.scale.set(14, 14, 1); scene.add(sp);
    }
  }
  function glowTex(){
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new T3.CanvasTexture(c);
  }

  /* ---------- the ball ---------- */
  function ballTex(){
    const S = 256, c = document.createElement("canvas"); c.width = S * 2; c.height = S; const g = c.getContext("2d");
    g.fillStyle = "#dcf02e"; g.fillRect(0, 0, S * 2, S);
    let s = 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for(let k = 0; k < 9000; k++){ g.fillStyle = r() < 0.5 ? "rgba(255,255,190,.1)" : "rgba(130,150,0,.1)"; g.fillRect(r() * S * 2, r() * S, 2, 2); }
    /* the seam: the tennis-ball curve, drawn over the sphere's map */
    g.strokeStyle = "#f4f6ea"; g.lineWidth = 5; g.beginPath();
    let lastU = 0;
    for(let i = 0; i <= 256; i++){
      const t = i / 256 * Math.PI * 2, a = 0.44, x = Math.cos(t) * (1 - a) + a * Math.cos(3 * t), y = Math.sin(t) * (1 - a) - a * Math.sin(3 * t), z = 2 * Math.sqrt(a * (1 - a)) * Math.sin(2 * t);
      const l = Math.hypot(x, y, z), u = (Math.atan2(y / l, x / l) / (Math.PI * 2) + 1) % 1, v = Math.acos(z / l) / Math.PI;
      if(!i || Math.abs(u - lastU) > 0.5) g.moveTo(u * S * 2, v * S); else g.lineTo(u * S * 2, v * S);
      lastU = u;
    }
    g.stroke();
    const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  function buildBall(){
    ballM = new T3.Mesh(new T3.SphereGeometry(R.fl.RAD, 22, 16), new T3.MeshStandardMaterial({ map: ballTex(), roughness: 0.82, emissive: lin("#7c8a10"), emissiveIntensity: 0.55, envMapIntensity: 0.6 }));
    ballM.castShadow = true; scene.add(ballM);
    /* a halo keeps it readable at 3 px on a phone; it grows with the heat */
    const halo = new T3.Sprite(new T3.SpriteMaterial({ map: glowTex(), color: lin(HEAT[0]), blending: T3.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
    halo.scale.set(0.5, 0.5, 1); ballM.add(halo); V.halo = halo;
    /* the shadow you read the ball by */
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadowB = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: new T3.CanvasTexture(c), transparent: true, depthWrite: false }));
    shadowB.rotation.x = -Math.PI / 2; shadowB.renderOrder = 1; scene.add(shadowB);
    /* the trail: a ribbon that always faces the camera */
    const N = 22, g2 = new T3.BufferGeometry(), pos = new Float32Array(N * 2 * 3), al = new Float32Array(N * 2), idx = [];
    for(let i = 0; i < N; i++){ al[i * 2] = al[i * 2 + 1] = i / (N - 1); if(i < N - 1){ const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    g2.setAttribute("position", new T3.BufferAttribute(pos, 3)); g2.setAttribute("aA", new T3.BufferAttribute(al, 1)); g2.setIndex(idx);
    const m2 = new T3.ShaderMaterial({ transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, uniforms: { uC: { value: lin(HEAT[0]) }, uO: { value: 0.6 } },
      vertexShader: "attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }",
      fragmentShader: "uniform vec3 uC; uniform float uO; varying float vA; void main(){ gl_FragColor = vec4(uC, vA*vA*uO); }" });
    trail = { mesh: new T3.Mesh(g2, m2), pts: [], N, pos, g: g2, m: m2 }; trail.mesh.frustumCulled = false; trail.mesh.renderOrder = 3; scene.add(trail.mesh);
  }
  const _a = new T3.Vector3(), _b = new T3.Vector3(), _c = new T3.Vector3(), _d = new T3.Vector3();
  function updateTrail(){
    const t = trail, n = t.pts.length; if(!n){ t.mesh.visible = false; return; }
    t.mesh.visible = true;
    const w = 0.012 + 0.0016 * camera.position.distanceTo(ballM.position), N = t.N;
    for(let i = 0; i < N; i++){
      const k = Math.max(0, n - N + i), p = t.pts[k], q = t.pts[Math.min(n - 1, k + 1)], o = t.pts[Math.max(0, k - 1)];
      _a.set(q[0] - o[0], q[1] - o[1], q[2] - o[2]); _b.set(p[0], p[1], p[2]); _c.copy(camera.position).sub(_b); _d.crossVectors(_a, _c).normalize().multiplyScalar(w * (i / (N - 1)));
      t.pos[i * 6] = p[0] + _d.x; t.pos[i * 6 + 1] = p[1] + _d.y; t.pos[i * 6 + 2] = p[2] + _d.z;
      t.pos[i * 6 + 3] = p[0] - _d.x; t.pos[i * 6 + 4] = p[1] - _d.y; t.pos[i * 6 + 5] = p[2] - _d.z;
    }
    t.g.attributes.position.needsUpdate = true;
  }
  /* where the ball is. The rest of it follows: the shadow, the trail, the size it must keep on a phone */
  const B = V.ball = { p: [0, 1, 0], path: null, t0: 0, spin: [0, 0, 0], held: null, on: true };
  function placeBall(dt){
    if(B.path) B.path.at(V.gt - B.t0, B.p);
    else if(B.held) B.held(B.p);
    ballM.position.set(B.p[0], B.p[1], B.p[2]); ballM.visible = B.on;
    const d = camera.position.distanceTo(ballM.position), f = V.h / (2 * Math.tan(camera.fov * Math.PI / 360)), k = Math.max(1, (V.rate < 0.1 ? 6 : 4.4) * d / (f * 0.067));
    ballM.scale.setScalar(k); V.halo.scale.set(9 / k * 0.0335 * Math.max(1.4, d * 0.09), 9 / k * 0.0335 * Math.max(1.4, d * 0.09), 1);
    const h = Math.max(0, B.p[1]);
    shadowB.visible = B.on; shadowB.position.set(B.p[0] - h * 0.1, 0.012, B.p[2] - h * 0.07); const s = 0.17 + h * 0.13; shadowB.scale.set(s, s, 1); shadowB.material.opacity = clamp(1 - h * 0.13, 0.3, 1);
    if(B.path && dt > 0){ ballM.rotation.x += B.spinRate * dt; ballM.rotation.y += 0.3 * B.spinRate * dt; }
    const pts = trail.pts, L = pts[pts.length - 1];
    if(!B.on || !B.path) pts.length = 0;
    else if(!L || Math.hypot(L[0] - B.p[0], L[1] - B.p[1], L[2] - B.p[2]) > 0.04){ pts.push(B.p.slice()); if(pts.length > trail.N * 2) pts.shift(); }
  }
  V.follow = (path, t0, heat) => { B.path = path; B.t0 = t0 == null ? V.gt : t0; B.held = null; B.on = true; B.spinRate = path.rpm / 60 * 6.283 * 0.6; if(heat != null) V.heat(heat); };
  V.hold = fn => { B.path = null; B.held = fn; B.on = true; };
  V.hide = () => { B.on = false; B.path = null; B.held = null; };
  V.heat = h => { const c = lin(HEAT[h]); trail.m.uniforms.uC.value.copy(c); trail.m.uniforms.uO.value = 0.55 + h * 0.2; V.halo.material.color.copy(c); V.halo.material.opacity = 0.42 + h * 0.2; };

  /* a mark where the ball bounced */
  function buildMarks(){
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.strokeStyle = "#fff"; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
    const tex = new T3.CanvasTexture(c);
    for(let i = 0; i < 4; i++){
      const m = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, opacity: 0 }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 1; scene.add(m); rings.push({ m, t: 9 });
    }
  }
  V.mark = (x, z, heat) => { const r = rings.shift(); rings.push(r); r.t = 0; r.m.position.x = x; r.m.position.z = z; r.m.material.color.copy(lin(HEAT[heat || 0])); };
  /* the four spots on your side, drawn on the court under the answers */
  const spotsM = [];
  function buildSpots(){
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 10, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,.75)"); gr.addColorStop(0.72, "rgba(255,255,255,.25)"); gr.addColorStop(0.75, "rgba(255,255,255,.9)"); gr.addColorStop(0.82, "rgba(255,255,255,.1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tex = new T3.CanvasTexture(c);
    for(let i = 0; i < 4; i++){
      const m = new T3.Mesh(new T3.PlaneGeometry(1.5, 1.5), new T3.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, blending: T3.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.016; m.renderOrder = 1; scene.add(m); spotsM.push(m);
    }
  }
  V.spots = list => spotsM.forEach((m, i) => { const s = list && list[i]; m.userData.want = s ? 0.5 : 0; if(s){ m.position.x = s[0]; m.position.z = s[1]; m.material.color.set(s[2] || 0xffffff); } });

  /* ---------- the cameras ---------- */
  /* track: how much of your sideways position the camera takes. In portrait a low camera sees about 5 m of
     your baseline, so it has to go with you. That beats a high camera that fits the whole court: the far player
     is the same size either way, and yours is twice as big */
  const CAMS = {
    tv:    { p: [0, 8.9, 23.4], l: [0, 0.2, 1.6], fov: 54, track: 0.8, look: 0.46, back: 1 },
    hang:  { p: [0.95, 2.75, 17.1], l: [-0.1, 1.05, 3.6], fov: 52, track: 0.92, look: 0.45 },
    serve: { p: [0.4, 3.3, 18.6], l: [0, 2.0, 3], fov: 56 }    // behind you, for the toss
  };
  const C = { p: CAMS.tv.p.slice(), l: CAMS.tv.l.slice(), fov: CAMS.tv.fov, k: 2.4, want: CAMS.tv, shake: 0 };
  V.focus = () => 0; V.deep = () => 0; // your x, and how far you are behind the baseline
  V.cam = (name, k) => { C.want = CAMS[name] || name; C.k = k || 2.4; };
  V.snap = name => { const c = CAMS[name] || name, x = V.focus() * (c.track || 0); C.want = c; C.p = c.p.slice(); C.l = c.l.slice(); C.p[0] += x; C.l[0] += x * (c.look || 1); C.fov = c.fov; };
  V.shake = a => { C.shake = Math.max(C.shake, a); };
  function moveCam(dt){
    const e = 1 - Math.exp(-dt * C.k), w = C.want, tx = (w.track || 0) * V.focus();
    const tz = (w.back || 0) * V.deep();
    for(let i = 0; i < 3; i++){ C.p[i] += (w.p[i] + (i === 0 ? tx : i === 2 ? tz : 0) - C.p[i]) * e; C.l[i] += (w.l[i] + (i === 0 ? tx * (w.look || 1) : i === 2 ? tz : 0) - C.l[i]) * e; }
    C.fov += (w.fov - C.fov) * e;
    C.shake *= Math.exp(-dt * 9);
    const sh = C.shake, t = performance.now() * 0.05;
    camera.position.set(C.p[0] + Math.sin(t * 1.3) * sh, C.p[1] + Math.cos(t * 1.7) * sh, C.p[2]);
    camera.lookAt(C.l[0], C.l[1], C.l[2]);
    if(Math.abs(camera.fov - C.fov) > 0.01){ camera.fov = C.fov; camera.updateProjectionMatrix(); }
  }
  /* court point to stage percent, so the answers can sit on their spots */
  const _p = new T3.Vector3();
  V.project = (x, y, z) => { _p.set(x, y, z).project(camera); return [(_p.x + 1) * 50, (1 - _p.y) * 50]; };

  /* ---------- the clock ---------- */
  V.slow = (r, ms) => { rateFrom = V.rate; rateTo = r; rateT = 0; rateD = Math.max(1, ms || 1) / 1000; };
  /* resolves when the game clock reaches t. A leaving game clears the queue with false */
  V.until = t => new Promise(res => { if(V.gt >= t) res(true); else wait.push({ t, res }); });
  V.real = ms => new Promise(res => timers.push({ t: V.now() + ms, res }));
  V.clear = () => { for(const w of wait) w.res(false); for(const w of timers) w.res(false); wait = []; timers = []; };
  V.onTick = f => { hooks.push(f); return () => { hooks = hooks.filter(h => h !== f); }; };

  /* the test drives the clock by hand (_tests/ has no GPU): V.manual(), then V.step(ms, draw) */
  let handClock = null;
  V.now = () => handClock == null ? performance.now() : handClock;
  V.manual = () => { handClock = 0; };
  V.step = async (ms, draw, each) => { const f = each || 33.34, n = Math.max(1, Math.round(ms / f)); for(let i = 0; i < n; i++){ handClock += f; tick(f / 1000, handClock, draw && i === n - 1); await new Promise(r => setTimeout(r, 0)); } };

  function frame(now){
    raf = requestAnimationFrame(frame);
    const ms = now - last, dt = Math.min(0.05, ms / 1000 || 0.016); last = now;
    if(ms > 0 && ms < 250){ V.frames.n++; V.frames.ms += ms; if(ms > 34) V.frames.slow++; watch(ms); }
    tick(dt, now, true);
  }
  function tick(dt, now, draw){
    if(rateT < rateD){ rateT = Math.min(rateD, rateT + dt); const u = rateT / rateD; V.rate = mix(rateFrom, rateTo, u * u * (3 - 2 * u)); }
    const gdt = dt * V.rate; V.gt += gdt;
    net.U.uT.value = V.gt;
    if(wait.length){ const go = wait.filter(w => V.gt >= w.t); if(go.length){ wait = wait.filter(w => V.gt < w.t); go.forEach(w => w.res(true)); } }
    if(timers.length){ const go = timers.filter(w => now >= w.t); if(go.length){ timers = timers.filter(w => now < w.t); go.forEach(w => w.res(true)); } }
    for(const h of hooks) h(gdt, dt);
    placeBall(gdt); moveCam(dt); updateTrail();
    for(const r of rings){ if(r.t < 1){ r.t += dt * 1.6; const u = Math.min(1, r.t), s = 0.1 + u * 0.75; r.m.scale.set(s, s, 1); r.m.material.opacity = (1 - u) * 0.8; } }
    for(const m of spotsM){ const w = m.userData.want || 0; m.material.opacity += (w - m.material.opacity) * (1 - Math.exp(-dt * 8)); }
    if(draw) renderer.render(scene, camera);
  }
  V.tick = tick;
  /* A slow phone drops a level by itself: fewer pixels first, then the shadows. A run of 90 frames decides, so one
     stutter doesn't, and it never climbs back, so the picture doesn't pump */
  let qual = 2, runN = 0, runMs = 0;
  function setQuality(q){
    qual = q;
    const dpr = window.devicePixelRatio || 1, phone = (window.innerWidth || 800) < 700;
    renderer.setPixelRatio(q >= 2 ? Math.min(dpr, phone ? 2 : 1.5) : q === 1 ? Math.min(dpr, 1.4) : 1);
    if(q === 0){ sun.castShadow = false; }
    fit();
  }
  function watch(ms){
    runN++; runMs += ms;
    if(runN < 90) return;
    if(runMs / runN > 26 && qual > 0) setQuality(qual - 1);
    runN = 0; runMs = 0;
  }
  V.quality = () => qual;
  /* Off the screen means no work. Why: "hide" (BALL's frame, or the phone's home screen) or "gl" (the context went).
     Timers keep their place: a real second doesn't pass for a game that isn't on screen */
  const off = {}; let was = false, offAt = 0;
  V.pause = (why, on) => {
    const any = () => Object.keys(off).some(k => off[k]), before = any();
    off[why] = on;
    if(any() === before) return;
    if(any()){ offAt = V.now(); was = !!raf; if(raf){ cancelAnimationFrame(raf); raf = 0; } }
    else { const gap = V.now() - offAt; timers.forEach(t => { t.t += gap; }); if(was) V.start(); }
  };
  V.start = () => { if(!raf && handClock == null && !Object.keys(off).some(k => off[k])){ last = performance.now(); raf = requestAnimationFrame(frame); } else was = true; };
  V.stop = () => { was = false; if(raf){ cancelAnimationFrame(raf); raf = 0; } };
  /* leaving Match point gives the phone its memory back; the next match builds it again */
  V.release = () => {
    if(!V.ready) return;
    V.ready = false; V.stop(); V.clear();
    try { renderer.forceContextLoss(); renderer.dispose(); } catch(e){}
    renderer.domElement.remove();
    rings = []; spotsM.length = 0; qual = 2; off.gl = false;
  };
  /* a big point: the lights seem to close in on the court */
  let mood = 0, moodTo = 0;
  V.mood = k => { moodTo = k; };
  V.onTick((gdt, dt) => { mood += (moodTo - mood) * (1 - Math.exp(-dt * 3)); if(renderer) renderer.toneMappingExposure = 1.02 - 0.2 * mood; });
  V.surface = surf => { const s = SURFACES[surf] || SURFACES.hard, U = courtM.U; U.uIn.value.copy(lin(s.inner)); U.uOut.value.copy(lin(s.outer)); U.uWear.value = s.wear; U.uStripe.value = s.stripe; U.uDirt.value.copy(lin(s.dirt || "#000000")); U.uHasDirt.value = s.dirt ? 1 : 0; courtM.m.roughness = s.rough; };
  V.ripple = (x, y, amp) => { net.U.uHit.value.set(x, y, V.gt, amp == null ? 0.16 : amp); };

  function fit(){
    const el = V.host, w = el.clientWidth, h = el.clientHeight; if(!w) return;
    V.w = w; V.h = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  V.init = (host, surf) => {
    if(V.ready){ host.prepend(renderer.domElement); V.host = host; fit(); V.surface(surf || "hard"); return true; }
    const canvas = document.createElement("canvas");
    canvas.id = "gl"; host.prepend(canvas); V.host = host;
    try { renderer = new T3.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
    catch(e){ canvas.remove(); return false; }
    const phone = (window.innerWidth || 800) < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 2 : 1.5));
    /* three.js puts everything back by itself if the phone gives the context back */
    canvas.addEventListener("webglcontextlost", () => { if(V.ready){ V.pause("gl", true); if(V.onLost) V.onLost(true); } });
    canvas.addEventListener("webglcontextrestored", () => { V.pause("gl", false); if(V.onLost) V.onLost(false); });
    renderer.outputEncoding = T3.sRGBEncoding; renderer.toneMapping = T3.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFSoftShadowMap;
    V.renderer = renderer;
    scene = V.scene = new T3.Scene(); scene.background = lin("#05080e"); scene.fog = new T3.Fog(lin("#05080e"), 46, 120);
    camera = V.camera = new T3.PerspectiveCamera(60, 0.5, 0.3, 300);
    const stage = window.BALL3D.stage(T3, renderer);
    scene.environment = stage.env();
    /* one key, high and to one side; only the players, the rackets and the ball cast real shadows */
    const hemi = new T3.HemisphereLight(lin("#a9bfe6"), lin("#27384a"), 0.38); scene.add(hemi);
    sun = new T3.DirectionalLight(lin("#fff2e0"), 1.55); sun.position.set(7, 24, 6); sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 19; sc.bottom = -19; sc.near = 2; sc.far = 60;
    sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    scene.add(sun); scene.add(sun.target);
    const fill = new T3.DirectionalLight(lin("#dce8ff"), 0.55); fill.position.set(-12, 16, -22); scene.add(fill);
    court(surf || "hard"); net = buildNet(); stadium(); buildBall(); buildMarks(); buildSpots();
    V.heat(0);
    V.players = window.BALL3D.players(T3, { renderer, scene });
    fit();
    if(!V.fits){ V.fits = true; window.addEventListener("resize", () => { if(V.ready) fit(); }); }
    V.ready = true;
    return true;
  };
  V.SIN = SIN; V.DBL = DBL; V.BASE = BASE; V.SVC = SVC;
})(window.RACKET);
