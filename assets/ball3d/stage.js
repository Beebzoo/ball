/* BALL 4: THE LIGHT AND THE GRASS OF THE 3D SCENES (three.js r128, plain script, no modules).
   Loaded from index.html. G3D.world() (the shot) and P3D build() (the pitch) hand their scene to
   BALL3D.stage(THREE, renderer).dress(scene, { kind, sun, pitch, hemi, fills }) once, after they
   have built it; everything here only changes what they made, so without this file both scenes
   still draw exactly as before.

   - LIGHT LIKE A BROADCAST AT NIGHT: an environment map made in code (a dark bowl of stands, the
     floodlight banks along the roofs, the lit pitch as a floor), so cloth, skin and boots pick up
     the stadium's light from every side; the old sun becomes the main floodlight bank with a soft
     shadow, and two more banks from the far corners give every man a rim of light.
   - THE SHADOW FOLLOWS THE PLAY: on the pitch the shadow camera is fitted round the part of the
     ground the camera is looking at, so the men cast crisp shadows rather than 9 cm blocks.
   - GRASS: the scene's own pitch texture (stripes, lines, wear) is kept, and a tiling blade texture
     is multiplied over it at two scales, so close up it is grass and far away it is a pitch.
   - QUALITY: 2 everything; 1 smaller shadow map, no cloth micro-detail; 0 no shadows. The pitch
     drops a level by itself after a run of slow frames; BALL3D.quality(q) sets it. */
(function(){
'use strict';
const B3 = window.BALL3D = window.BALL3D || {};
let STAGE = null;
B3.stage = function(T3, renderer){
  if(STAGE && STAGE.renderer === renderer) return STAGE;
  const lin = c => new T3.Color(c).convertSRGBToLinear();
  const clamp = (t, a = 0, b = 1) => t < a ? a : t > b ? b : t;
  const phone = (window.innerWidth || 800) < 700;
  let QUAL = phone ? 1 : 2;
  try { const q = new URLSearchParams(location.search).get('q3d'); if(q != null && q !== ''){ QUAL = clamp(+q|0, 0, 2); B3.lockQuality = true; } } catch(e){}
  const dressed = [];

  /* ---------- the environment: a stadium at night, made in code ---------- */
  let ENV = null;
  function env(){
    if(ENV) return ENV;
    const pm = new T3.PMREMGenerator(renderer), es = new T3.Scene(), junk = [];
    const add = (geo, x, y, z, rgb, ry = 0, rx = 0) => {
      const m = new T3.MeshBasicMaterial({ side: T3.DoubleSide, toneMapped: false }); m.color.setRGB(rgb[0], rgb[1], rgb[2]);
      const me = new T3.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, 0); es.add(me); junk.push(geo, m); return me;
    };
    /* the bowl: dark stands, a darker sky over them */
    add(new T3.SphereGeometry(140, 24, 12), 0, 0, 0, [.012, .016, .026]);
    add(new T3.CylinderGeometry(118, 92, 46, 32, 1, true), 0, 14, 0, [.03, .03, .036]);
    /* the pitch as a floor, lit */
    add(new T3.PlaneGeometry(80, 120), 0, -.5, 0, [.05, .12, .045], 0, -Math.PI/2);
    add(new T3.PlaneGeometry(240, 240), 0, -.8, 0, [.02, .035, .02], 0, -Math.PI/2);
    /* the floodlights: banks along both roofs and over both ends, very bright */
    for(const s of [-1, 1]){
      for(let k = -3; k <= 3; k++) add(new T3.PlaneGeometry(9, 2.2), s*72, 38, k*16, [22, 21, 19], s*Math.PI/2, .7*s);
      for(let k = -2; k <= 2; k++) add(new T3.PlaneGeometry(9, 2.2), k*14, 36, s*92, [16, 15.5, 14], s > 0 ? Math.PI : 0, .6);
    }
    /* advertising and a scoreboard: a few warm and cool glows low down */
    for(let k = 0; k < 8; k++){ const a = k/8*Math.PI*2 + .2; add(new T3.PlaneGeometry(22, 1.2), Math.cos(a)*62, 1.5, Math.sin(a)*86, k % 2 ? [.5, .32, .1] : [.12, .2, .45], -a + Math.PI/2); }
    const rt = pm.fromScene(es, .04);
    for(const j of junk) j.dispose(); pm.dispose();
    ENV = rt.texture;
    return ENV;
  }

  /* ---------- grass: blades, tiled ---------- */
  let BLADES = null;
  function blades(){
    if(BLADES) return BLADES;
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    let s = 917; const r = () => (s = (s*16807) % 2147483647)/2147483647;
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N);
    /* G: soft patches (used at a large scale), R: blades */
    const img = g.getImageData(0, 0, N, N), d = img.data;
    const NG = new Float32Array(32*32); for(let k = 0; k < NG.length; k++) NG[k] = r();
    const nz = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy), a = xi & 31, b = (xi + 1) & 31, cc = (yi & 31)*32, dd = ((yi + 1) & 31)*32;
      return (NG[cc + a]*(1 - u) + NG[cc + b]*u)*(1 - v) + (NG[dd + a]*(1 - u) + NG[dd + b]*u)*v; };
    for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
      const o = (y*N + x)*4, f = nz(x/N*8, y/N*8)*.6 + nz(x/N*16 + 3, y/N*16 + 7)*.4;
      d[o + 1] = 128 + (f - .5)*70; d[o + 2] = 128;
    }
    g.putImageData(img, 0, 0);
    /* blades: short strokes, lighter tips, darker gaps; drawn wrapped so the tile has no seam */
    g.globalCompositeOperation = 'source-over';
    for(let k = 0; k < 26000; k++){
      const x = r()*N, y = r()*N, l = 3 + r()*7, a = -Math.PI/2 + (r() - .5)*1.1, v = r();
      const col = v < .45 ? 70 + r()*40 : 150 + r()*70;
      g.strokeStyle = 'rgba(' + col + ',' + 128 + ',128,' + (.35 + r()*.4).toFixed(2) + ')'; g.lineWidth = .8 + r()*.9;
      for(const ox of [0, -N, N]) for(const oy of [0, -N, N]){
        if((ox || oy) && !(x + ox > -12 && x + ox < N + 12 && y + oy > -12 && y + oy < N + 12)) continue;
        g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a)*l, y + oy + Math.sin(a)*l); g.stroke();
      }
    }
    const t = new T3.CanvasTexture(c);
    t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.minFilter = T3.LinearMipmapLinearFilter;
    BLADES = t;
    return t;
  }
  function grass(mesh, kind){
    const m = mesh.material; if(!m || m.userData.b3grass) return;
    m.userData.b3grass = true;
    m.roughness = .92; m.metalness = 0; m.envMapIntensity = .55;
    const U = { gBlades: { value: blades() }, gQ: { value: 1 }, gScale: { value: kind === 'pitch' ? .55 : .9 } };
    m.userData.U = U;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 gW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  gW = (modelMatrix*vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 gW;\nuniform sampler2D gBlades;\nuniform float gQ;\nuniform float gScale;')
        .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec4 gb = texture2D(gBlades, gW.xz*gScale*1.7);
    vec4 gp = texture2D(gBlades, gW.xz*0.045 + 0.31);
    float blade = mix(1.0, gb.r*2.0, 0.55*gQ);
    float gPat = mix(1.0, gp.g*2.0, 0.6);
    diffuseColor.rgb *= blade*gPat;
    /* a floodlit pitch: a touch warmer and lighter in the green */
    diffuseColor.rgb *= vec3(0.97, 1.03, 0.9);
  }`)
        .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `{
    /* grass at a glancing angle catches the light: a soft sheen towards the horizon */
    vec3 gV = normalize(vViewPosition);
    float gF = pow(1.0 - saturate(dot(normal, gV)), 4.0);
    outgoingLight += gF*vec3(0.05, 0.075, 0.035)*(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse)/max(diffuseColor.rgb, vec3(0.02));
  }
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
    };
    m.customProgramCacheKey = () => 'ball3d-grass-v1';
    m.needsUpdate = true;
  }

  /* ---------- the lights ---------- */
  function lights(scene, o){
    const kind = o.kind, sun = o.sun;
    const hemi = scene.children.filter(c => c.isHemisphereLight)[0];
    const dirs = scene.children.filter(c => c.isDirectionalLight && c !== sun);
    if(hemi){ hemi.intensity = .3; hemi.color.copy(lin(0xb9cdf0)); hemi.groundColor.copy(lin(0x24401f)); }
    if(sun){
      sun.color.copy(lin(0xfff1dc)); sun.intensity = kind === 'pitch' ? 1.45 : 1.5;
      sun.shadow.bias = -.0004; sun.shadow.normalBias = kind === 'pitch' ? .06 : .04; sun.shadow.radius = 3;
      if(!sun.target.parent) scene.add(sun.target);
    }
    /* the old fill stays a floodlight bank from the camera's side; the shot's back light becomes the
       far bank, cool, a rim on every man */
    dirs.forEach((d, i) => { d.color.copy(lin(i ? 0xdce8ff : 0xfff6e8)); d.intensity = i ? .7 : .6; if(i) d.position.set(14, 18, -28); });
    /* (no new lights: every light costs every lit pixel of the stands; the rims come from the environment) */
    return { hemi, sun };
  }

  /* the shadow camera, fitted round where the camera is looking (the pitch only) */
  const _f = new T3.Vector3(), _c = new T3.Vector3(), _o = new T3.Vector3();
  function follow(D, camera){
    const sun = D.sun; if(!sun || !sun.castShadow) return;
    camera.getWorldDirection(_f);
    const t = _f.y < -.05 ? clamp(-camera.position.y/_f.y, 5, 120) : 60;
    _c.copy(camera.position).addScaledVector(_f, t*.8); _c.y = 0;
    _c.x = clamp(_c.x, -40, 40); _c.z = clamp(_c.z, -60, 60);
    const R = clamp(t*.75, 14, 46);
    if(Math.abs(R - D.R) > 1.5){ D.R = R; Object.assign(sun.shadow.camera, { left: -R, right: R, top: R*1.25, bottom: -R*1.25, near: 1, far: 220 }); sun.shadow.camera.updateProjectionMatrix(); }
    _o.copy(D.off); sun.position.copy(_c).add(_o); sun.target.position.copy(_c);
    sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
  }
  function setShadows(D){
    const sun = D.sun; if(!sun) return;
    const want = QUAL > 0 && !(D.kind === 'pitch' && D.lowOff);
    const ms = QUAL >= 2 ? 2048 : 1024;
    if(sun.shadow.mapSize.x !== ms){ sun.shadow.mapSize.set(ms, ms); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.radius = QUAL >= 2 ? 3 : 1.5;
    if(D.kind === 'pitch') sun.castShadow = want;
  }

  /* ---------- dress a scene ---------- */
  function dress(scene, o){
    if(scene.userData.b3dressed) return;
    scene.userData.b3dressed = true;
    renderer.toneMappingExposure = .92;
    const L = lights(scene, o);
    if(o.pitch){ grass(o.pitch, o.kind); scene.userData.b3pitch = o.pitch; }
    const D = { scene, kind: o.kind, sun: L.sun, R: 0, off: L.sun ? L.sun.position.clone().normalize().multiplyScalar(90) : null, slow: 0, last: 0, n: 0 };
    dressed.push(D);
    setShadows(D);
    B3.addHook(scene, (r, sc, camera) => {
      if(D.kind === 'pitch'){
        /* the pitch's own watch (P3D) may have turned the shadow off on a slow phone: leave it off */
        if(D.sun && !D.sun.castShadow && QUAL > 0 && !D.forced) D.lowOff = true;
        if(D.forced && D.sun) D.sun.castShadow = QUAL > 0;
        follow(D, camera);
        /* our own watch: a run of slow frames drops a quality level */
        const now = performance.now(), dt = D.last ? now - D.last : 0; D.last = now;
        if(dt > 0 && dt < 500){ D.slow = dt > 45 ? D.slow + 1 : Math.max(0, D.slow - 1); if(D.slow > 40 && QUAL > 0 && !B3.lockQuality){ D.slow = 0; quality(QUAL - 1); } }
      }
    });
    return D;
  }
  function quality(q){
    if(q != null){
      QUAL = clamp(q|0, 0, 2);
      for(const D of dressed){ setShadows(D); if(D.scene.userData.b3pitch){ const U = D.scene.userData.b3pitch.material.userData.U; if(U) U.gQ.value = QUAL >= 1 ? 1 : .5; } }
      if(B3.onQuality) try { B3.onQuality(QUAL); } catch(e){}
    }
    return QUAL;
  }
  B3.addHook = B3.addHook || function(scene, fn){
    const hs = scene.userData.b3hooks || (scene.userData.b3hooks = []);
    if(hs.indexOf(fn) < 0) hs.push(fn);
    scene.onBeforeRender = function(r, sc, camera, target){ for(const h of hs) h(r, sc, camera, target); };
  };
  B3.quality = q => { const v = quality(q); if(B3.playersApi) B3.playersApi.quality(v); return v; };
  B3.forceShadows = on => { for(const D of dressed){ D.forced = !!on; D.lowOff = false; setShadows(D); } };
  STAGE = { renderer, dress, quality, env, q: () => QUAL };
  return STAGE;
};
})();
