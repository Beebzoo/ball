/* The dartboard, drawn as SVG in real millimetres (regulation sizes), 20 at the top.
   A dart is { m: 1|2|3, n: 1..20 | 25 }: m is single/double/treble, n 25 is the bull
   (m 1 = outer bull 25, m 2 = bull 50). */
(function(D){
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const R = { bull: 6.35, outer: 15.9, tIn: 99, tOut: 107, dIn: 162, dOut: 170, edge: 226 };
  const C = { black: "#16130f", cream: "#eadfc4", red: "#c8202f", green: "#14824a", wire: "#b9b3a6" };
  const rad = a => a * Math.PI / 180;
  const pt = (r, a) => [r * Math.cos(rad(a)), r * Math.sin(rad(a))];
  const f = n => n.toFixed(2);

  function wedge(r1, r2, a1, a2, fill){
    const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
    return '<path d="M' + f(x1) + " " + f(y1) + "A" + r2 + " " + r2 + " 0 0 1 " + f(x2) + " " + f(y2) +
      "L" + f(x3) + " " + f(y3) + "A" + r1 + " " + r1 + " 0 0 0 " + f(x4) + " " + f(y4) + 'Z" fill="' + fill + '"/>';
  }
  /* centre angle of a number (SVG angles: 0 = right, clockwise) */
  const angle = n => -90 + ORDER.indexOf(n) * 18;

  function svg(opts){
    opts = opts || {};
    let s = '<svg class="board' + (opts.cls ? " " + opts.cls : "") + '" viewBox="-240 -240 480 480" aria-hidden="true">';
    s += '<defs><radialGradient id="bdsh" r="0.5"><stop offset="0.86" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="bdlit" cx="0.42" cy="0.32" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient></defs>';
    s += '<circle r="240" fill="url(#bdsh)"/><circle r="' + R.edge + '" fill="#0d0b09"/>';
    ORDER.forEach((n, i) => {
      const a1 = -99 + i * 18, a2 = a1 + 18, even = i % 2 === 0;
      const single = even ? C.black : C.cream, ring = even ? C.red : C.green;
      s += '<g data-n="' + n + '">' + wedge(R.outer, R.tIn, a1, a2, single) + wedge(R.tIn, R.tOut, a1, a2, ring) +
        wedge(R.tOut, R.dIn, a1, a2, single) + wedge(R.dIn, R.dOut, a1, a2, ring) + "</g>";
      const [x, y] = pt(196, -90 + i * 18);
      s += '<text x="' + f(x) + '" y="' + f(y) + '" class="bnum">' + n + "</text>";
    });
    s += '<circle r="' + R.outer + '" fill="' + C.green + '"/><circle r="' + R.bull + '" fill="' + C.red + '"/>';
    /* the wire */
    s += '<g fill="none" stroke="' + C.wire + '" stroke-width="0.9" opacity="0.8">';
    [R.bull, R.outer, R.tIn, R.tOut, R.dIn, R.dOut].forEach(r => s += '<circle r="' + r + '"/>');
    for(let i = 0; i < 20; i++){ const a = -99 + i * 18, [x1, y1] = pt(R.outer, a), [x2, y2] = pt(R.dOut, a); s += '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '"/>'; }
    s += "</g>";
    s += '<circle r="' + R.dOut + '" fill="url(#bdlit)" pointer-events="none"/>';
    s += '<g class="lit"></g><g class="darts"></g></svg>';
    return s;
  }

  /* where a dart lands (a little scatter inside its bed, so three darts never stack) */
  function pos(d){
    if(d.n === 0) { const a = Math.random() * 360; return pt(200 + Math.random() * 14, a); }
    const j = (lo, hi) => lo + Math.random() * (hi - lo);
    if(d.n === 25) return d.m === 2 ? pt(j(0, R.bull - 2), j(0, 360)) : pt(j(R.bull + 2, R.outer - 2), j(0, 360));
    const a = angle(d.n) + j(-6, 6);
    const r = d.m === 3 ? j(R.tIn + 2, R.tOut - 2) : d.m === 2 ? j(R.dIn + 2, R.dOut - 2) : (Math.random() < 0.5 ? j(30, 92) : j(115, 155));
    return pt(r, a);
  }
  /* a dart stuck in the board. Seen from the oche: the tail sticks out towards you and
     leans a little to the thrower's side (`rot`, degrees from upright), plus a bit of depth.
     markAt(svg, x, y, i) drops it in (Checkout game); throwAt(...) flies it in (501 Match). */
  const mark = (svgEl, d, i) => { const [x, y] = pos(d); markAt(svgEl, x, y, i); };
  const lean = x => 14 - x / 226 * 16 + (Math.random() * 8 - 4);
  const DART = '<ellipse rx="4.5" ry="2" cx="2.5" cy="1.5" fill="#000" opacity=".5"/>' +
    '<line x1="0" y1="0" x2="0" y2="-11" stroke="#d9d4c9" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="0" y1="-10" x2="0" y2="-30" stroke="#0008" stroke-width="7" stroke-linecap="round"/>' +
    '<line x1="0" y1="-10" x2="0" y2="-30" stroke="#8b9198" stroke-width="5.4" stroke-linecap="round"/>' +
    '<line x1="0" y1="-13" x2="0" y2="-27" stroke="#3a3e43" stroke-width="5.4" stroke-dasharray="1.2 1.3"/>' +
    '<line x1="-1.4" y1="-11" x2="-1.4" y2="-29" stroke="#e6e9ec" stroke-width="1" opacity=".7"/>' +
    '<line x1="0" y1="-30" x2="0" y2="-43" stroke="#1d1d1d" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M0 -39 L-12 -58 L-2 -55 L0 -62 L2 -55 L12 -58 Z" class="flight"/><path d="M0 -40 L-2.6 -61 L2.6 -61 Z" class="flight f2"/>' +
    '<circle r="1.8" fill="#fff"/>';
  const tf = (x, y, rot, sc) => "translate(" + f(x) + " " + f(y) + ") rotate(" + f(rot) + ") scale(" + f(sc) + ")";
  function dartEl(svgEl, i, cls){
    const g = svgEl.querySelector(".darts"); if(!g) return null;
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("class", "dart d" + i + (cls ? " " + cls : ""));
    el.innerHTML = '<g class="dart-in">' + DART + "</g>";
    g.appendChild(el);
    return el;
  }
  function markAt(svgEl, x, y, i){
    const el = dartEl(svgEl, i); if(!el) return null;
    el.setAttribute("transform", tf(x, y, lean(x), 1.5));
    return el;
  }
  /* fly a dart in from the oche (big and low) to (x, y): ~ms long, then `done` (always
     called, on a timer, even when the page isn't painting). opts:
       bounce   it hits the wire (or another dart) and drops out of the board afterwards
       deflect  [x2, y2]: it touches (x, y) first (another dart's barrel or flight), then
                kicks to (x2, y2) in ~120 ms; done comes after the kick
       robin    { x, y, rot } of a dart in the board: it lodges in the back of that dart
       stop     hit-stop: the dart freezes this many ms before it quivers (a treble, the bull)
       slow     ease in and out (the slow-motion third dart of a 180 chase) */
  function throwAt(svgEl, x, y, i, opts, done){
    opts = opts || {};
    const el = dartEl(svgEl, i, "fly"); if(!el){ done && done(); return null; }
    const host = opts.robin;
    if(host){ const L = 58 * 1.5, a = rad(host.rot); x = host.x + L * Math.sin(a); y = host.y - L * Math.cos(a); }
    const ms = opts.ms || 230, rot = host ? host.rot + 4 : lean(x), sc = host ? 1.35 : 1.5, x0 = x * 0.35, y0 = 330, t0 = performance.now();
    let landed = false;
    const ease = opts.slow ? (t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) : (t => 1 - Math.pow(1 - t, 3));
    const step = now => {
      if(landed || !el.isConnected) return;
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      const px = x0 + (x - x0) * e, py = y0 + (y - y0) * e - Math.sin(Math.PI * t) * 70;
      el.setAttribute("transform", tf(px, py, rot - 25 * (1 - e), sc * (1 + 2.6 * (1 - e))));
      el.style.opacity = String(0.35 + 0.65 * Math.min(1, t * 2.5));
      if(t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    el._pos = { x, y, rot };
    setTimeout(() => {
      landed = true; el.style.opacity = "";
      el.setAttribute("transform", tf(x, y, rot, sc));
      /* the quiver after it sticks */
      const quiv = (qx, qy, amp) => {
        const q0 = performance.now(), quiver = now => {
          if(!el.isConnected || el.classList.contains("out")) return;
          const t = (now - q0) / 320; if(t >= 1){ el.setAttribute("transform", tf(qx, qy, rot, sc)); return; }
          el.setAttribute("transform", tf(qx, qy, rot + Math.sin(t * 22) * amp * (1 - t), sc));
          requestAnimationFrame(quiver);
        };
        requestAnimationFrame(quiver);
      };
      if(opts.bounce){
        /* hits the wire, hangs a moment, then drops off the board */
        el.setAttribute("transform", tf(x, y, rot + 35, sc * 1.1));
        setTimeout(() => {
          if(!el.isConnected) return;
          el.classList.add("out");
          const b0 = performance.now(), fall = now => {
            if(!el.isConnected) return;
            const t = Math.min(1, (now - b0) / 520);
            el.setAttribute("transform", tf(x + 18 * t, y + 260 * t * t, rot + 35 + 140 * t, sc * 1.1));
            el.style.opacity = String(1 - t);
            if(t < 1) requestAnimationFrame(fall); else el.remove();
          };
          requestAnimationFrame(fall);
        }, 120);
        done && done();
      } else if(opts.deflect){
        /* glances off: a quick kick from the first touch to where it sticks */
        const [x2, y2] = opts.deflect, k0 = performance.now(), kick = now => {
          if(!el.isConnected) return;
          const t = Math.min(1, (now - k0) / 120), e = 1 - Math.pow(1 - t, 2);
          el.setAttribute("transform", tf(x + (x2 - x) * e, y + (y2 - y) * e, rot + 18 * Math.sin(Math.PI * t), sc));
          if(t < 1) requestAnimationFrame(kick);
        };
        requestAnimationFrame(kick);
        el._pos = { x: x2, y: y2, rot };
        setTimeout(() => { if(el.isConnected) el.setAttribute("transform", tf(x2, y2, rot, sc)); quiv(x2, y2, 6); done && done(); }, 125);
      } else {
        if(opts.stop) setTimeout(() => quiv(x, y, host ? 2 : 4), opts.stop); else quiv(x, y, host ? 2 : 4);
        done && done();
      }
    }, ms);
    return el;
  }
  const clear = svgEl => { if(!svgEl) return; const g = svgEl.querySelector(".darts"); if(g) g.innerHTML = ""; const l = svgEl.querySelector(".lit"); if(l) l.innerHTML = ""; };

  /* the shape of the bed a dart scored in (all of it: a single is both single parts) */
  function bed(d){
    if(!d || d.n === 0) return "";
    const ring = (r1, r2) => '<path fill-rule="evenodd" d="M' + r2 + ' 0A' + r2 + " " + r2 + " 0 1 0 " + -r2 + " 0A" + r2 + " " + r2 + " 0 1 0 " + r2 + " 0Z" +
      (r1 ? "M" + r1 + " 0A" + r1 + " " + r1 + " 0 1 0 " + -r1 + " 0A" + r1 + " " + r1 + " 0 1 0 " + r1 + ' 0Z' : "") + '"/>';
    if(d.n === 25) return d.m === 2 ? ring(0, R.bull) : ring(R.bull, R.outer);
    const a1 = angle(d.n) - 9, a2 = a1 + 18, w = (r1, r2) => wedge(r1, r2, a1, a2, "currentColor");
    return d.m === 3 ? w(R.tIn, R.tOut) : d.m === 2 ? w(R.dIn, R.dOut) : w(R.outer, R.tIn) + w(R.tOut, R.dIn);
  }
  /* light up a bed: a flash that fades (ms) or, with ms 0, a steady glow until cleared */
  function light(svgEl, d, cls, ms){
    const g = svgEl && (svgEl.querySelector(".lit") || svgEl.querySelector(".darts")); if(!g || !d || d.n === 0) return null;
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("class", "bed " + (cls || "flash"));
    el.innerHTML = bed(d);
    if(g.classList.contains("darts")) g.parentNode.insertBefore(el, g); else g.appendChild(el);
    if(ms) setTimeout(() => el.remove(), ms);
    return el;
  }
  /* how far (mm) a point is from the nearest wire: the rings and the radial wires */
  function wire(x, y){
    const r = Math.hypot(x, y);
    let best = Math.min(...[R.bull, R.outer, R.tIn, R.tOut, R.dIn, R.dOut].map(w => Math.abs(r - w)));
    if(r > R.outer && r < R.dOut){
      const a = (Math.atan2(y, x) * 180 / Math.PI + 99 + 720) % 18, off = Math.min(a, 18 - a);
      best = Math.min(best, r * Math.sin(off * Math.PI / 180));
    }
    return best;
  }
  /* screen point -> board millimetres for this svg */
  function toMM(svgEl, cx, cy){
    const b = svgEl.getBoundingClientRect();
    return [(cx - b.left) / b.width * 480 - 240, (cy - b.top) / b.height * 480 - 240];
  }
  function toPx(svgEl, x, y){
    const b = svgEl.getBoundingClientRect();
    return [b.left + (x + 240) / 480 * b.width, b.top + (y + 240) / 480 * b.height];
  }

  /* what a point (in mm, centre = 0,0) scores: a dart { m, n }, n 0 = off the board */
  function hit(x, y){
    const r = Math.hypot(x, y);
    if(r <= R.bull) return { m: 2, n: 25 };
    if(r <= R.outer) return { m: 1, n: 25 };
    if(r > R.dOut) return { m: 1, n: 0 };
    const a = (Math.atan2(y, x) * 180 / Math.PI + 90 + 9 + 720) % 360, n = ORDER[Math.floor(a / 18) % 20];
    return { m: r > R.dIn ? 2 : r > R.tIn && r <= R.tOut ? 3 : 1, n };
  }
  /* the middle of a bed, where you'd aim for that dart */
  function target(d){
    if(d.n === 25) return d.m === 2 ? [0, 0] : [0, -11];
    return pt(d.m === 3 ? 103 : d.m === 2 ? 166 : 58, angle(d.n));
  }

  D.board = { svg, mark, markAt, throwAt, clear, hit, target, bed, light, wire, toMM, toPx, angle, ORDER, R };
})(window.DART);
