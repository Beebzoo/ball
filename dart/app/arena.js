/* The arena around the 501 Match: a big TV darts night, all drawn in code.
   Behind the page: a fixed layer with the arena (truss, beams, haze, a stage backdrop with
   LED pillars, the stage floor with the oche) on a static canvas, plus a second canvas with
   the crowd (silhouettes in rows, phone lights, flags, 180 cards, camera flashes) that
   reacts. On top: a pointer-events-free layer for the TV graphics (180 sting, GAME SHOT,
   match won, confetti). The stage follows the board's position on screen, so the
   spotlight, the surround and the stage floor always line up with it.

   match.js calls:
     D.arena.mount(rootEl)            when the match screen is built (rootEl = the .g-body.m element)
     D.arena.event(name, data)        "walkon" {a, b}, "turn" {name, cpu}, "dart" {label, score},
                                      "visit" {total, name}, "180" {name}, "bust" {name},
                                      "checkout" {score, name}, "leg" {name, legs}, "match" {name}
     D.arena.unmount()                when leaving the match
   Every call is safe at any time (no-ops until mounted; events sent a moment before the
   mount are replayed). Until match.js sends events, the arena mounts itself when a match
   screen appears and reads the moments off the page (the visit pop-up, the banner, the
   scoreboard, the dart slots). Once a real event arrives, it only listens to the events.
   After the last leg it stays behind the result screen for the celebration and goes away
   when the match screen does. */
(function(D){
  const T = (en, nl) => D.T ? D.T(en, nl) : en;
  const RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const now = () => performance.now();

  let S = null;            // the mounted arena (null = not mounted)
  let pending = [];        // events sent just before the mount
  let appObs = null;

  /* a small seeded random, so the crowd looks the same after a resize */
  function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------------------------------------------------------------- the hooks */
  function mount(rootEl){
    if(!rootEl || !rootEl.isConnected) return;
    if(S && S.root === rootEl) return;
    if(S) S.rebind(rootEl);
    else S = build(rootEl);
    const keep = pending.filter(p => now() - p.t < 400); pending = [];
    keep.forEach(p => { S.wired = true; handle(p.name, p.data); });
  }
  function unmount(){
    if(!S) return;
    /* match.js may call this just before it puts up the result screen: keep the arena
       behind the result (the celebration); tear down when the match screen is gone */
    S.root = null;
    setTimeout(() => { if(S) check(); }, 0);
  }
  function event(name, data){
    if(!S){ pending.push({ name, data: data || {}, t: now() }); if(pending.length > 12) pending.shift(); return; }
    S.wired = true;
    handle(name, data || {});
  }

  /* the screen we are on: arena while #app is a match screen with a board or a result */
  function check(){
    const app = document.getElementById("app");
    const onMatch = app && app.classList.contains("s-match");
    const m = onMatch && app.querySelector(".g-body.m");
    const end = onMatch && app.querySelector(".g-body.end");
    if(m){ if(!S || S.root !== m) mount(m); return; }
    if(S && end){ S.resultMode(); return; }
    if(S) S.destroy();
  }
  function watchApp(){
    const app = document.getElementById("app");
    if(!app || appObs) return;
    appObs = new MutationObserver(() => check());
    appObs.observe(app, { childList: true, attributes: true, attributeFilter: ["class"] });
    check();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchApp); else setTimeout(watchApp, 0);

  /* ---------------------------------------------------------------- build */
  function build(rootEl){
    const st = {
      root: rootEl, wired: false, alive: true,
      W: 0, H: 0, geo: null, chunks: [], phones: [], flags: [], flashes: [], confetti: [],
      hype: 0, hypeHold: 0, groan: 0, groanHold: 0, up: 0, walk: false, walkT: 0, led: "idle", ledT: 0, ledFor: 0,
      raf: 0, lastDraw: 0, frame: 0, gen: 0, timers: new Set(), obs: [], result: false, shiftT: 0, holdEnd: 0
    };
    st.later = (f, ms) => { const t = setTimeout(() => { st.timers.delete(t); if(st.alive) f(); }, ms); st.timers.add(t); return t; };

    /* the background layer */
    const bg = document.createElement("div");
    bg.className = "arena"; bg.setAttribute("aria-hidden", "true");
    bg.innerHTML = '<canvas class="ar-st"></canvas><div class="ar-cone"></div><div class="ar-pool"></div>' +
      '<div class="ar-beams">' + "<i></i>".repeat(6) + '</div><div class="ar-beams hot">' + "<i></i>".repeat(6) + "</div>" +
      '<div class="ar-haze"><i></i><i></i></div><canvas class="ar-cr"></canvas><div class="ar-wash"></div>';
    /* the graphics layer (never takes a touch) */
    const fx = document.createElement("div");
    fx.className = "ar-fx"; fx.setAttribute("aria-hidden", "true");
    document.body.prepend(bg); document.body.appendChild(fx);
    document.body.classList.add("arena-on");
    st.bg = bg; st.fx = fx;
    const stC = bg.querySelector(".ar-st"), crC = bg.querySelector(".ar-cr");
    const sx = stC.getContext("2d"), cx = crC.getContext("2d");

    /* ---------- geometry: where the board is ---------- */
    function measure(){
      const W = innerWidth, H = innerHeight;
      const b = st.root && st.root.isConnected && st.root.querySelector(".m-board .board");
      const r = b && b.getBoundingClientRect();
      let bx, by, R;
      if(r && r.width > 60){ bx = r.left + r.width / 2; by = r.top + r.height / 2; R = r.width / 2; }
      else { bx = W / 2; by = H * 0.4; R = Math.min(W, 520) / 2 * 0.9; }
      return { W, H, bx, by, R };
    }
    const near = (a, b) => Math.abs(a - b) < 1;
    function setVars(bx, by, R){
      bg.style.setProperty("--bx", bx.toFixed(1) + "px");
      bg.style.setProperty("--by", by.toFixed(1) + "px");
      bg.style.setProperty("--br", R.toFixed(1) + "px");
    }
    function layout(force){
      const g = measure(), o = st.geo;
      if(!force && o && o.W === g.W && o.H === g.H && near(o.bx, g.bx) && near(o.R, g.R)){
        if(near(o.by, g.by)) return false;
        /* the board only moved up or down (scrolling, a taller score bug): slide the
           canvases now, redraw once it has been still for a while */
        const dy = g.by - o.by;
        stC.style.transform = crC.style.transform = "translate3d(0," + dy.toFixed(1) + "px,0)";
        setVars(o.bx, g.by, o.R);
        clearTimeout(st.shiftT);
        st.shiftT = setTimeout(() => { if(st.alive) layout(true); }, Math.abs(dy) > 60 ? 300 : 1500);
        return false;
      }
      stC.style.transform = crC.style.transform = "";
      st.geo = g; st.W = g.W; st.H = g.H; g.result = st.result;
      const { W, bx, by, R } = g;
      g.bw = R * 2.9;
      g.x0 = bx - g.bw / 2; g.x1 = bx + g.bw / 2;
      g.floorY = by + R * 1.04;
      g.frontY = g.floorY + Math.max(24, R * 0.2);
      g.sw1 = Math.min(g.bw, W * 1.2) * 1.25;
      setVars(bx, by, R);
      g.dpr = Math.min(window.devicePixelRatio || 1, 2); g.dpr2 = Math.min(window.devicePixelRatio || 1, 1.5);
      stC.width = W * g.dpr | 0; stC.height = g.H * g.dpr | 0;
      crC.width = W * g.dpr2 | 0; crC.height = g.H * g.dpr2 | 0;
      drawStatic(g);
      makeCrowd(g);
      drawCrowd(now());
      /* the arms-up pictures (with the 180 cards) are drawn a few at a time afterwards */
      const todo = st.chunks.slice(), gen = ++st.gen;
      const more = () => { if(!st.alive || gen !== st.gen) return; const t0 = now(); while(todo.length && now() - t0 < 6){ const ch = todo.shift(); ch.cv[1] = ch.mkUp(); } if(todo.length) setTimeout(more, 30); };
      setTimeout(more, 60);
      return true;
    }

    /* ---------- the static scene ---------- */
    function drawStatic(g){
      const { W, H, bx, by, R, x0, x1, floorY, frontY } = g, c = sx;
      c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      /* the arena: dark blue-black with coloured washes */
      let gr = c.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#05060d"); gr.addColorStop(0.45, "#0d0d22"); gr.addColorStop(1, "#08070c");
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      const wash = (x, y, r, col) => { const q = c.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col); q.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = q; c.fillRect(x - r, y - r, r * 2, r * 2); };
      wash(W * 0.06, H * 0.45, Math.max(W, H) * 0.55, "rgba(110,60,190,0.34)");
      wash(W * 0.94, H * 0.40, Math.max(W, H) * 0.55, "rgba(40,90,210,0.32)");
      wash(bx, floorY, R * 2.6, "rgba(200,40,60,0.16)");

      /* the backdrop: a dark LED wall behind the board */
      const bot = floorY;
      gr = c.createLinearGradient(0, 0, 0, bot);
      gr.addColorStop(0, "#0b0c18"); gr.addColorStop(0.6, "#13121f"); gr.addColorStop(1, "#0c0b12");
      c.fillStyle = gr; c.fillRect(x0, 0, x1 - x0, bot);
      const p = document.createElement("canvas"); p.width = p.height = 6;
      const pc = p.getContext("2d"); pc.fillStyle = "rgba(160,170,255,0.10)"; pc.fillRect(2, 2, 1.5, 1.5);
      c.fillStyle = c.createPattern(p, "repeat"); c.fillRect(x0, 0, x1 - x0, bot);
      c.save(); c.beginPath(); c.rect(x0, 0, x1 - x0, bot); c.clip();
      wash(x0 + (x1 - x0) * 0.18, by - R * 0.3, R * 1.5, "rgba(210,42,55,0.24)");
      wash(x0 + (x1 - x0) * 0.82, by - R * 0.3, R * 1.5, "rgba(242,193,78,0.16)");
      c.strokeStyle = "rgba(255,255,255,0.04)"; c.lineWidth = 1;
      for(let x = bx - Math.floor((bx - x0) / (R * 0.5)) * R * 0.5; x < x1; x += R * 0.5){ c.beginPath(); c.moveTo(x, 0); c.lineTo(x, bot); c.stroke(); }
      /* a lit fascia band above the board */
      const fy = g.result ? -99 : by - R * 1.2;
      gr = c.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, "rgba(210,42,55,0)"); gr.addColorStop(0.25, "rgba(210,42,55,0.6)"); gr.addColorStop(0.5, "rgba(255,214,140,0.8)"); gr.addColorStop(0.75, "rgba(210,42,55,0.6)"); gr.addColorStop(1, "rgba(210,42,55,0)");
      c.fillStyle = gr; c.fillRect(x0, fy, x1 - x0, 3);
      wash(bx, fy, R * 1.2, "rgba(255,180,120,0.10)");
      c.restore();
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x0 - 6, 0, 6, bot); c.fillRect(x1, 0, 6, bot);

      /* the truss with its lamps */
      const ty = 6;
      c.strokeStyle = "#2e3142"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, ty); c.lineTo(W, ty); c.moveTo(0, ty + 12); c.lineTo(W, ty + 12); c.stroke();
      c.lineWidth = 1; c.beginPath();
      for(let x = 0; x < W; x += 12){ c.moveTo(x, ty); c.lineTo(x + 6, ty + 12); c.lineTo(x + 12, ty); }
      c.stroke();
      const lamps = Math.max(5, Math.round(W / 70));
      for(let i = 0; i < lamps; i++){
        const x = (i + 0.5) * W / lamps, y = ty + 20;
        c.fillStyle = "#1c1e29"; c.fillRect(x - 7, ty + 10, 14, 12);
        const q = c.createRadialGradient(x, y, 0, x, y, 24); q.addColorStop(0, "rgba(255,246,225,0.95)"); q.addColorStop(0.15, "rgba(255,230,190,0.5)"); q.addColorStop(1, "rgba(255,230,190,0)");
        c.fillStyle = q; c.fillRect(x - 24, y - 24, 48, 48);
      }

      /* the stage floor: dark gloss, the board's light on it, the oche */
      const sw0 = Math.min(g.bw, W * 1.2), sw1 = g.sw1;
      c.beginPath(); c.moveTo(bx - sw0 / 2, floorY); c.lineTo(bx + sw0 / 2, floorY); c.lineTo(bx + sw1 / 2, frontY); c.lineTo(bx - sw1 / 2, frontY); c.closePath();
      gr = c.createLinearGradient(0, floorY, 0, frontY); gr.addColorStop(0, "#1d1920"); gr.addColorStop(1, "#0d0b0f");
      c.fillStyle = gr; c.fill();
      c.save(); c.clip();
      c.translate(bx, floorY); c.scale(1, 0.22);
      const q = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.3); q.addColorStop(0, "rgba(255,226,180,0.38)"); q.addColorStop(1, "rgba(255,226,180,0)");
      c.fillStyle = q; c.fillRect(-R * 1.3, -R * 1.3, R * 2.6, R * 2.6);
      c.restore();
      /* the oche: a raised bar on the floor */
      if(g.result) return;
      const oy = floorY + (frontY - floorY) * 0.6, ow = R * 0.95;
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(bx - ow / 2, oy + 1.5, ow, 3);
      gr = c.createLinearGradient(bx - ow / 2, 0, bx + ow / 2, 0); gr.addColorStop(0, "rgba(220,220,230,0.15)"); gr.addColorStop(0.5, "rgba(250,250,255,0.9)"); gr.addColorStop(1, "rgba(220,220,230,0.15)");
      c.fillStyle = gr; c.fillRect(bx - ow / 2, oy - 1, ow, 2.5);
      c.fillStyle = "#08070a"; c.fillRect(bx - sw1 / 2, frontY, sw1, 12);
      c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(x0, floorY - 2, x1 - x0, 3);
    }

    /* ---------- the crowd ---------- */
    function person(c, x, yb, s, up, card, rimCol, fill, R){
      const hr = s * (0.32 + R() * 0.08), hx = x + (R() - 0.5) * s * 0.15, hy = yb - s * 0.5 - R() * s * 0.15, w = s * (0.66 + R() * 0.14);
      const shape = dy => {
        c.beginPath(); c.ellipse(hx, hy + dy, hr * 0.92, hr, 0, 0, 6.283); c.fill();
        c.beginPath();
        c.moveTo(x - w, yb + s * 2.3 + dy);
        c.lineTo(x - w, yb + s * 0.45 + dy);
        c.quadraticCurveTo(x - w, yb + dy, x - w * 0.35, yb - s * 0.02 + dy);
        c.lineTo(x + w * 0.35, yb - s * 0.02 + dy);
        c.quadraticCurveTo(x + w, yb + dy, x + w, yb + s * 0.45 + dy);
        c.lineTo(x + w, yb + s * 2.3 + dy);
        c.fill();
        if(up){
          c.lineCap = "round"; c.lineWidth = s * 0.26; c.strokeStyle = c.fillStyle;
          const ax = s * (0.75 + up * 0.2), ay = yb - s * (1.25 + up * 0.35);
          c.beginPath(); c.moveTo(x - w * 0.7, yb + s * 0.25 + dy); c.lineTo(x - ax, ay + dy);
          c.moveTo(x + w * 0.7, yb + s * 0.25 + dy); c.lineTo(x + ax, ay + dy); c.stroke();
        }
      };
      c.fillStyle = rimCol; shape(-Math.max(1, s * 0.08));
      c.fillStyle = fill; shape(0);
      if(card){
        const cw = s * 1.75, ch = s * 0.95, cy = yb - s * (up ? 2.6 : 2.2);
        c.fillStyle = card.bg; c.fillRect(x - cw / 2, cy, cw, ch);
        if(card.t){ c.fillStyle = card.fg; c.font = (ch * 0.82).toFixed(1) + "px Anton, Impact, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(card.t, x, cy + ch * 0.55); }
      }
    }
    function makeCrowd(g){
      const { W, H, R: BR, x0, x1, floorY, frontY } = g;
      const R = rng(1801 + (W | 0));
      st.chunks = []; st.phones = []; st.flags = [];
      const dpr = g.dpr2;
      /* one row of people, cut into chunks that bounce on their own */
      function row(y, s, depth, side, nCh){
        const step = s * (1.2 + R() * 0.2), people = [], cards = s <= 12, cardBase = cards ? 1 : 0;
        for(let x = -s + R() * step; x < W + s; x += step * (0.85 + R() * 0.3)){
          if(side && x > x0 - s * 0.6 && x < x1 + s * 0.6) continue;
          const r = R();
          people.push({ x, y: y + (R() - 0.5) * s * 0.35, s: s * (0.9 + R() * 0.2), up: R() < 0.55 ? 0.5 + R() * 0.5 : 0, seed: R() * 1e9 | 0,
            card: !cardBase ? null : r < 0.025 ? { bg: "#f4f1ea", fg: "#c8202f", t: "180", always: true } :
              r < 0.04 ? { bg: ["#d22a37", "#f2c14e", "#2c6bd6", "#19985a"][R() * 4 | 0], fg: "#fff", t: "", always: true } :
              r < 0.11 ? { bg: "#f4f1ea", fg: "#c8202f", t: "180", always: false } : null });
        }
        if(!people.length) return;
        const cw = W / nCh;
        const fill = depth < 0.5 ? "rgb(" + (30 - depth * 26 | 0) + "," + (28 - depth * 24 | 0) + "," + (48 - depth * 40 | 0) + ")" : "rgb(" + (17 - (depth - 0.5) * 16 | 0) + "," + (15 - (depth - 0.5) * 14 | 0) + "," + (23 - (depth - 0.5) * 20 | 0) + ")";
        const rim = depth < 0.5 ? "rgba(150,165,255,0.38)" : "rgba(255,200,150," + (0.6 - (depth - 0.5) * 0.6).toFixed(2) + ")";
        for(let k = 0; k < nCh; k++){
          const ps = people.filter(p => p.x >= k * cw && p.x < (k + 1) * cw);
          if(!ps.length) continue;
          const left = k * cw - s * 2, wpx = cw + s * 4, top = y - s * 3.4, hpx = s * 6;
          const mk = up => {
            const cv = document.createElement("canvas");
            cv.width = Math.ceil(wpx * dpr); cv.height = Math.ceil(hpx * dpr);
            const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
            /* haze between this row and the one behind */
            const hz = c.createLinearGradient(0, y - s * 1.6, 0, y + s * 0.6);
            hz.addColorStop(0, "rgba(120,120,200,0)"); hz.addColorStop(0.7, depth < 0.5 ? "rgba(120,120,210,0.10)" : "rgba(255,185,140,0.13)"); hz.addColorStop(1, "rgba(120,120,200,0)");
            c.fillStyle = hz; c.fillRect(left, y - s * 1.6, wpx, s * 2.2);
            ps.forEach(p => {
              const card = p.card && (p.card.always || up) ? p.card : null;
              person(c, p.x, p.y, p.s, up ? (p.up || (card ? 0.8 : 0)) : (card ? 0.7 : 0), card, rim, fill, rng(p.seed));
            });
            return cv;
          };
          const ch = { x: left, y: top, w: wpx, h: hpx, s, depth, cv: [mk(false), null], mkUp: () => mk(true), ph: R() * 6.283, sp: 0.8 + R() * 0.5, dy: 0 };
          st.chunks.push(ch);
          /* phone lights at a raised hand */
          ps.forEach(p => {
            if(R() < (depth < 0.5 ? 0.18 : 0.14)) st.phones.push({ ch, x: p.x + (R() - 0.5) * p.s * 1.4, y: p.y - p.s * (1.3 + R() * 0.6), s: p.s, ph: R() * 6.283, base: R() });
          });
          if(depth > 0.2 && R() < 0.3 && st.flags.length < 6){
            const p = ps[R() * ps.length | 0];
            const cols = [["#e8432d", "#ffffff", "#2448a8"], ["#f47b20", "#ffffff", "#f47b20"], ["#1d7a3a", "#ffffff", "#d22a37"], ["#111111", "#d22a37", "#f2c14e"], ["#2448a8", "#ffffff", "#2448a8"]][R() * 5 | 0];
            st.flags.push({ ch, x: p.x + p.s * 0.6, y: p.y - p.s * 0.2, s: p.s, cols, ph: R() * 6.283 });
          }
        }
      }
      /* side tiers (only where the wall doesn't stand: on a wide screen) */
      if(x0 > 8 || x1 < W - 8){
        const top = Math.max(H * 0.14, g.by - BR * 1.15);
        let y = top, s = 6;
        while(y < floorY - 2){ row(y, s, 0.05 + 0.4 * (y - top) / Math.max(1, floorY - top), true, 4); y += s * 1.55; s = Math.min(12, s * 1.03); }
      }
      /* the crowd in front of the stage */
      let y = frontY + 10, s = Math.max(7, BR * 0.04), i = 0;
      while(y < H + s * 2 && i < 16){ row(y, s, 0.5 + Math.min(0.5, i * 0.06), false, Math.max(3, Math.round(W / 110))); y += s * 1.2; s = Math.min(22, s * 1.12); i++; }
    }

    /* glow sprites */
    const sprite = (r, rgb) => { const c = document.createElement("canvas"); c.width = c.height = r * 2; const x = c.getContext("2d"), q = x.createRadialGradient(r, r, 0, r, r, r); q.addColorStop(0, "rgba(" + rgb + ",1)"); q.addColorStop(0.25, "rgba(" + rgb + ",0.35)"); q.addColorStop(1, "rgba(" + rgb + ",0)"); x.fillStyle = q; x.fillRect(0, 0, r * 2, r * 2); return c; };
    const SPR = { phone: sprite(16, "235,245,255"), flash: sprite(48, "255,255,255") };

    /* ---------- one frame of the crowd ---------- */
    function drawCrowd(t){
      const g = st.geo; if(!g) return;
      const c = cx, s = t / 1000, still = RM.matches;
      c.setTransform(g.dpr2, 0, 0, g.dpr2, 0, 0);
      c.clearRect(0, 0, g.W, g.H);
      const hype = st.hype, groan = st.groan, armsUp = st.up > 0;
      for(const ch of st.chunks){
        let dy;
        if(still) dy = groan > 0.3 ? ch.s * 0.3 : 0;
        else {
          dy = Math.sin(s * 0.9 * ch.sp + ch.ph) * 0.5 * (0.3 + ch.depth);
          if(hype > 0) dy -= hype * ch.s * 0.6 * Math.abs(Math.sin(s * 7.5 * ch.sp + ch.ph));
          if(groan > 0) dy += groan * ch.s * 0.4;
        }
        ch.dy = dy;
        c.drawImage(ch.cv[armsUp && ch.cv[1] ? 1 : 0], ch.x, ch.y + dy, ch.w, ch.h);
      }
      /* flags */
      for(const f of st.flags){
        const x = f.x, y = f.y + f.ch.dy, h = f.s * 2.7, fw = f.s * 1.8, fh = f.s * 1.15, n = 6;
        c.strokeStyle = "#5a5a66"; c.lineWidth = Math.max(1, f.s * 0.1);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke();
        for(let i = 0; i < n; i++){
          const w0 = still ? 0 : Math.sin(s * (4 + hype * 6) + f.ph - i * 0.7) * f.s * 0.2 * (i / n);
          for(let k = 0; k < 3; k++){ c.fillStyle = f.cols[k]; c.fillRect(x + i * fw / n, y - h + w0 + k * fh / 3, fw / n + 0.6, fh / 3 + 0.6); }
        }
      }
      /* phone lights */
      const level = st.walk ? 0.95 : 0.22 + hype * 0.5;
      for(const p of st.phones){
        if(p.base >= level) continue;
        const tw = still ? 1 : 0.65 + 0.35 * Math.sin(s * 2.3 + p.ph);
        const sway = still || !st.walk ? 0 : Math.sin(s * 1.6 + p.ph) * p.s * 0.5;
        const x = p.x + sway, y = p.y + p.ch.dy, r = Math.max(8, p.s * 1.7), d = Math.max(1, p.s * 0.14);
        c.globalAlpha = 0.85 * tw; c.drawImage(SPR.phone, x - r, y - r, r * 2, r * 2);
        c.globalAlpha = 1; c.fillStyle = "#f4f8ff"; c.fillRect(x - d, y - d * 1.6, d * 2, d * 3.2);
      }
      /* the LED strip on the stage front and the wall's pillars */
      const led = st.led, lt = (t - st.ledT) / 1000;
      let col = "rgba(210,42,55,0.9)", a = 0.8;
      if(led === "gold"){ col = "rgba(255,206,90,1)"; a = still ? 1 : (Math.sin(lt * 18) > 0 ? 1 : 0.45); }
      else if(led === "red"){ col = "rgba(255,40,50,1)"; a = still ? 1 : (Math.sin(lt * 14) > 0 ? 1 : 0.25); }
      const sw1 = g.sw1;
      c.globalAlpha = a;
      if(led === "walk" && !still){
        const gr = c.createLinearGradient(g.bx - sw1 / 2, 0, g.bx + sw1 / 2, 0), p = Math.min(1, Math.max(0, (((lt * 0.6) % 1) + 1) % 1));
        gr.addColorStop(0, "rgba(210,42,55,0.9)"); gr.addColorStop(Math.max(0, p - 0.1), "rgba(210,42,55,0.9)"); gr.addColorStop(p, "rgba(255,244,220,1)"); gr.addColorStop(Math.min(1, p + 0.1), "rgba(242,193,78,0.95)"); gr.addColorStop(1, "rgba(242,193,78,0.95)");
        c.fillStyle = gr;
      } else c.fillStyle = col;
      c.fillRect(g.bx - sw1 / 2, g.frontY + 2, sw1, 3);
      if(g.x0 > 0 || g.x1 < g.W){
        const top = g.by - g.R * 1.2, bot = g.floorY;
        for(const x of [g.x0 + 10, g.x1 - 16]){
          const gr = c.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, led === "idle" || led === "walk" ? "rgba(210,42,55,0.75)" : col); gr.addColorStop(1, "rgba(255,255,255,0)");
          c.fillStyle = gr; c.fillRect(x, top, 6, bot - top);
        }
      }
      c.globalAlpha = 1;
      /* the crowd nearest the camera sinks into the dark (the buttons sit there) */
      const vg = c.createLinearGradient(0, g.H * 0.8, 0, g.H);
      vg.addColorStop(0, "rgba(4,4,9,0)"); vg.addColorStop(1, "rgba(4,4,9,0.4)");
      c.fillStyle = vg; c.fillRect(0, g.H * 0.8, g.W, g.H * 0.2);
      /* camera flashes */
      st.flashes = st.flashes.filter(f => t - f.t < 160);
      for(const f of st.flashes){
        const k = 1 - (t - f.t) / 160, r = f.r * (0.6 + k * 0.4);
        c.globalAlpha = Math.max(0, k); c.drawImage(SPR.flash, f.x - r, f.y - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
    }

    /* ---------- the loop: ~30 fps while something happens, ~15 when calm ---------- */
    function loop(t){
      st.raf = requestAnimationFrame(loop);
      /* a finger on the board: the crowd holds still, so a slow phone keeps every frame for the ring */
      if(t < st.holdEnd) return;
      const busy = st.hype > 0.01 || st.groan > 0.01 || st.walk || st.flashes.length || st.led !== "idle";
      if(t - st.lastDraw < (busy ? 32 : 64)) return;
      const dt = Math.min(0.1, (t - (st.lastDraw || t)) / 1000);
      st.lastDraw = t;
      /* is the match screen still there? (in case unmount is never called) */
      if(!st.result && (!st.root || !st.root.isConnected)){ check(); if(!st.alive) return; }
      if(++st.frame % 4 === 0) layout(false);
      if(t > st.hypeHold) st.hype = Math.max(0, st.hype - dt * 0.9);
      if(t > st.groanHold) st.groan = Math.max(0, st.groan - dt * 0.8);
      if(st.up && t > st.up) st.up = 0;
      if(st.led !== "idle" && st.led !== "walk" && t - st.ledT > st.ledFor) st.led = "idle";
      if(st.walk && t - st.walkT > 700 && !(st.root && st.root.querySelector(".banner.walk:not([hidden])"))) endWalk();
      if(st.hype > 0.5 && Math.random() < st.hype * 0.45) flash(1);
      else if(Math.random() < 0.012) flash(1);
      drawCrowd(t);
      if(st.result && !busy){ cancelAnimationFrame(st.raf); st.raf = 0; }
    }
    function kick(){
      if(!st.alive) return;
      if(RM.matches){ drawCrowd(now()); st.later(() => drawCrowd(now()), 2700); return; }
      if(!st.raf) st.raf = requestAnimationFrame(loop);
    }
    st.kick = kick;

    function flash(n){
      if(RM.matches || !st.phones.length) return;
      for(let i = 0; i < n; i++){
        const p = st.phones[Math.random() * st.phones.length | 0];
        st.flashes.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 10, r: 18 + Math.random() * 26, t: now() });
      }
    }
    st.flash = flash;
    function endWalk(){ st.walk = false; if(st.led === "walk") st.led = "idle"; bg.classList.remove("walk"); }
    st.endWalk = endWalk;

    /* ---------- reading the moments off the page (only until match.js sends events) ---------- */
    function observeRoot(root){
      st.obs.forEach(o => o.disconnect()); st.obs = [];
      const scr = root.parentNode;
      const vis = scr && scr.querySelector(".visit"), ban = root.querySelector(".banner"), sb = root.querySelector(".sb"), slots = root.querySelector(".slots");
      const nameOf = el => { const n = el && el.querySelector(".nm"); return n && n.firstChild ? n.firstChild.textContent.trim() : ""; };
      const onName = () => nameOf(root.querySelector(".sbp.on"));
      const mo = (el, opts, f) => { if(!el) return; const o = new MutationObserver(() => { if(!st.wired && st.alive) f(); }); o.observe(el, opts); st.obs.push(o); };
      mo(vis, { attributes: true, attributeFilter: ["class"] }, () => {
        if(!vis.classList.contains("show")) return;
        const n = parseInt(vis.textContent, 10) || 0, nm = onName();
        if(vis.classList.contains("max")) handle("180", { name: nm });
        else if(vis.classList.contains("bust")) handle("bust", { name: nm });
        else if(/game shot/i.test(vis.textContent)) handle("checkout", { score: n, name: nm });
        else handle("visit", { total: n, name: nm });
      });
      let walkShown = !!(ban && !ban.hidden && ban.classList.contains("walk"));
      mo(ban, { attributes: true, attributeFilter: ["hidden", "class"] }, () => {
        if(ban.hidden){ if(walkShown){ walkShown = false; handle("turn", { name: onName() }); } return; }
        if(ban.classList.contains("walk")){ if(!walkShown){ walkShown = true; handle("walkon", {}); } }
        else { const n = ban.querySelector(".pass-n"); handle("leg", { name: n ? n.textContent : "" }); }
      });
      let lastOn = onName();
      mo(sb, { attributes: true, subtree: true, attributeFilter: ["class"] }, () => { const n = onName(); if(n && n !== lastOn){ lastOn = n; handle("turn", { name: n }); } });
      let used = 0;
      mo(slots, { childList: true }, () => {
        const u = slots.querySelectorAll(".used"), k = u.length;
        if(k > used){ const label = u[k - 1].textContent; handle("dart", { label, score: score(label) }); }
        used = k;
      });
      if(walkShown && !st.wired) handle("walkon", {});
    }
    const score = l => { if(l === "Bull") return 50; const m = /^([TD]?)(\d+)$/.exec(l || ""); return m ? +m[2] * (m[1] === "T" ? 3 : m[1] === "D" ? 2 : 1) : 0; };

    /* when the result screen replaces the match: stay for the celebration */
    st.resultMode = () => {
      if(st.result) return;
      st.result = true; st.root = null;
      st.obs.forEach(o => o.disconnect()); st.obs = [];
      bg.classList.add("result");
      if(!st.matchShown){
        const v = document.querySelector("#app .verdict"), won = v ? v.textContent.replace(/ (wins|wint)\b.*$/, "").trim() : "";
        handle("match", { name: won });
      }
      layout(true); kick();
    };
    st.rebind = root => {
      st.root = root; st.result = false; st.matchShown = false; bg.classList.remove("result");
      observeRoot(root); layout(true); kick();
    };
    st.destroy = () => {
      st.alive = false;
      cancelAnimationFrame(st.raf); cancelAnimationFrame(st.confRaf || 0); clearTimeout(st.shiftT);
      st.timers.forEach(clearTimeout); st.timers.clear();
      st.obs.forEach(o => o.disconnect());
      removeEventListener("resize", onResize); removeEventListener("scroll", onResize);
      bg.remove(); fx.remove();
      document.body.classList.remove("arena-on", "ar-co", "ar-max");
      if(S === st) S = null;
    };
    const onResize = () => { if(st.alive) layout(false); };
    addEventListener("resize", onResize); addEventListener("scroll", onResize, { passive: true });

    observeRoot(rootEl);
    layout(true);
    kick();
    if(document.fonts && document.fonts.check && !document.fonts.check("20px Anton")) document.fonts.load("20px Anton").then(() => { if(st.alive) layout(true); }).catch(() => {});
    return st;
  }

  /* ---------------------------------------------------------------- the moments */
  function cheer(level, ms){
    const t = now();
    S.hype = Math.max(S.hype, level); S.hypeHold = Math.max(S.hypeHold, t + ms);
    S.groan = 0;
    if(level >= 0.7) S.up = Math.max(S.up, t + ms + 300);
  }
  function setLed(mode, ms){ S.led = mode; S.ledT = now(); S.ledFor = ms; }
  function pulse(cls, ms){
    const bg = S.bg; bg.classList.remove(cls); void bg.offsetWidth; bg.classList.add(cls);
    S.later(() => bg.classList.remove(cls), ms);
  }
  function sting(kind, big, sub, ms){
    const fx = S.fx;
    fx.querySelectorAll(".ar-sting").forEach(e => e.remove());
    const el = document.createElement("div");
    el.className = "ar-sting " + kind;
    el.style.setProperty("--ms", ms + "ms");
    el.innerHTML = '<div class="ar-band"></div><div class="ar-in"><b class="ar-big">' + big + "</b>" + (sub ? '<span class="ar-sub">' + sub + "</span>" : "") + "</div>";
    fx.appendChild(el);
    S.later(() => el.remove(), ms);
  }
  function confetti(n){
    if(RM.matches) return;
    const fx = S.fx, st = S;
    let cv = fx.querySelector("canvas.ar-conf");
    const W = innerWidth, H = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if(!cv){ cv = document.createElement("canvas"); cv.className = "ar-conf"; cv.width = W * dpr | 0; cv.height = H * dpr | 0; fx.prepend(cv); }
    const cols = ["#f2c14e", "#ffffff", "#d22a37", "#ffe08a", "#19985a"];
    for(let i = 0; i < n; i++) st.confetti.push({ x: Math.random() * W, y: -10 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 130, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12, w: 5 + Math.random() * 5, h: 3 + Math.random() * 3, c: cols[i % cols.length] });
    if(st.confRaf) return;
    const c = cv.getContext("2d");
    let last = now();
    const step = t => {
      if(!st.alive){ st.confRaf = 0; return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      st.confetti = st.confetti.filter(p => p.y < H + 20);
      for(const p of st.confetti){
        p.vy += 30 * dt; p.x += (p.vx + Math.sin(t / 300 + p.r) * 30) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        c.fillStyle = p.c; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.scale(1, Math.cos(p.r * 1.7)); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
      }
      if(st.confetti.length) st.confRaf = requestAnimationFrame(step);
      else { st.confRaf = 0; cv.remove(); }
    };
    st.confRaf = requestAnimationFrame(step);
  }

  /* the crowd's roar plays on the game's one audio engine (sfx.js) */
  const roar = (level, dur) => { if(D.sfx) D.sfx.roar(level, dur); };

  function handle(name, d){
    if(!S || !S.alive) return;
    d = d || {};
    const nm = esc(d.name || "");
    switch(name){
      case "walkon":
        S.walk = true; S.walkT = now(); S.bg.classList.add("walk"); setLed("walk", 1e9);
        cheer(0.6, 2200);
        break;
      case "turn":
        if(S.walk && now() - S.walkT > 300) S.endWalk();
        break;
      case "hold":      /* it runs out by itself, in case the lift never reaches us */
        S.holdEnd = d.on ? now() + 8000 : 0;
        break;
      case "dart": {
        const sc = +d.score || 0;
        if(sc >= 50 || /^T(20|19|18)$/.test(d.label || "")){ cheer(0.3, 250); S.flash(2); }
        break;
      }
      case "visit": {
        const t = +d.total || 0;
        if(t >= 140){ cheer(0.8, 1400); pulse("hot", 1400); roar(0.7, 1.6); S.flash(6); }
        else if(t >= 100){ cheer(0.55, 1000); roar(0.4, 1.2); S.flash(3); }
        else if(t < 20){ S.groan = 0.5; S.groanHold = now() + 700; }
        break;
      }
      case "180":
        cheer(1, 2600); setLed("gold", 2600); pulse("hot", 2600); S.flash(14); roar(1, 2.6);
        document.body.classList.add("ar-max"); S.later(() => document.body.classList.remove("ar-max"), 2300);
        sting("s180", "180", (nm ? nm + " · " : "") + T("maximum!", "maximum!"), 2300);
        break;
      case "bust":
        S.hype = 0; S.up = 0; S.groan = 1; S.groanHold = now() + 1300; setLed("red", 1300); pulse("bust", 1300);
        break;
      case "checkout": {
        const sc = +d.score || 0;
        cheer(1, 2800); setLed("gold", 2800); pulse("hot", 2800); S.flash(16); roar(1, 2.8);
        document.body.classList.add("ar-co"); S.later(() => document.body.classList.remove("ar-co"), 1500);
        sting("sgs", "Game shot", (nm ? nm + (sc ? " · " : "") : "") + (sc ? T(sc + " checkout", sc + " uitgegooid") : ""), 1900);
        confetti(sc >= 100 ? 110 : 60);
        break;
      }
      case "leg":
        cheer(0.65, 2600); if(S.led === "idle") setLed("gold", 1200);
        break;
      case "match":
        if(S.matchShown) break;
        S.matchShown = true;
        cheer(1, 4200); setLed("gold", 4200); pulse("hot", 4000); S.flash(20); roar(1.1, 3.6);
        sting("smatch", nm || T("Match", "Wedstrijd"), T("wins the match", "wint de wedstrijd"), 3400);
        confetti(160);
        break;
    }
    S.kick();
  }

  D.arena = { mount, event, unmount };
})(window.DART);
