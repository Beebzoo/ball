/* Small shared effects for the DART screens: count-ups, staggered entrances, confetti and
   sparks (board colours), a short buzz on phones. Everything respects
   prefers-reduced-motion: then numbers just appear and nothing flies. */
(function(D){
  const mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const calm = () => !!(mq && mq.matches);
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* count a number up from 0 (or from=) to its value; el.dataset.count holds the target */
  function count(el, to, opts){
    if(!el) return;
    opts = opts || {};
    const dec = opts.dec || 0, from = opts.from || 0, dur = opts.dur || 900, delay = opts.delay || 0;
    const fmt = v => dec ? v.toFixed(dec) : String(Math.round(v));
    if(calm() || to === from){ el.textContent = fmt(to); return; }
    el.textContent = fmt(from);
    const t0 = performance.now() + delay;
    const step = now => {
      if(!el.isConnected) return;
      const t = Math.max(0, Math.min(1, (now - t0) / dur));
      el.textContent = fmt(from + (to - from) * ease(t));
      if(t < 1) requestAnimationFrame(step); else { el.textContent = fmt(to); if(opts.done) opts.done(); }
    };
    requestAnimationFrame(step);
  }
  /* every [data-count] inside root counts up, one after the other */
  function counts(root, opts){
    opts = opts || {};
    (root || document).querySelectorAll("[data-count]").forEach((el, i) => {
      const v = parseFloat(el.dataset.count); if(isNaN(v)) return;
      count(el, v, { dec: +(el.dataset.dec || 0), dur: opts.dur || 900, delay: (opts.delay || 0) + i * (opts.gap == null ? 70 : opts.gap) });
    });
  }
  /* give the children of a list an index for the CSS stagger (.rise uses --i) */
  function stagger(root, sel, start){
    if(!root) return;
    (sel ? root.querySelectorAll(sel) : Array.from(root.children)).forEach((c, i) => { c.style.setProperty("--i", (start || 0) + i); c.classList.add("rise"); });
  }
  /* restart a CSS animation class on an element */
  function bump(el, cls){
    if(!el) return; cls = cls || "bump";
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }
  const buzz = ms => { try { if(navigator.vibrate && D.store.sound) navigator.vibrate(ms || 12); } catch(e){} };

  /* confetti: little paper bits in board colours, from a point (or the top of the screen) */
  const COLS = ["#e8323f", "#1fb26b", "#ffc94a", "#fbf5e6", "#4da3ff"];
  let cv = null, ctx = null, parts = [], raf = 0;
  function canvas(){
    if(cv && cv.isConnected) return;
    cv = document.createElement("canvas"); cv.className = "fx-canvas"; cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv); ctx = cv.getContext("2d");
    size();
  }
  function size(){
    if(!cv) return;
    const r = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * r; cv.height = innerHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  window.addEventListener("resize", size);
  function loop(){
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
    parts.forEach(p => {
      p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.translate(p.x, p.y);
      if(p.spark){
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 6.283); ctx.fill();
      } else {
        ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 1.7)); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      }
      ctx.restore();
    });
    if(parts.length) raf = requestAnimationFrame(loop); else { raf = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function burst(o){
    if(calm()) return;
    canvas();
    o = o || {};
    const n = o.n || 90, x = o.x == null ? innerWidth / 2 : o.x, y = o.y == null ? innerHeight * 0.32 : o.y;
    for(let i = 0; i < n; i++){
      const a = o.spark ? Math.random() * 6.283 : -Math.PI / 2 + (Math.random() - 0.5) * (o.spread || 2.4);
      const v = (o.speed || 9) * (0.45 + Math.random() * 0.75);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.spark ? 0.12 : 0.22, drag: o.spark ? 0.93 : 0.985,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, s: o.spark ? 1.4 + Math.random() * 2 : 6 + Math.random() * 6,
        c: (o.cols || COLS)[Math.random() * (o.cols || COLS).length | 0], life: o.spark ? 40 + Math.random() * 25 : 110 + Math.random() * 60, spark: !!o.spark });
    }
    if(!raf) raf = requestAnimationFrame(loop);
  }
  /* confetti from both bottom corners and the middle: a new record */
  function party(){
    burst({ x: innerWidth * 0.5, y: innerHeight * 0.3, n: 70, speed: 10, spread: 3.2 });
    setTimeout(() => { burst({ x: 0, y: innerHeight * 0.75, n: 50, speed: 15, spread: 0.9 }); parts.slice(-50).forEach(p => { p.vx = Math.abs(p.vx) + 3; }); }, 140);
    setTimeout(() => { burst({ x: innerWidth, y: innerHeight * 0.75, n: 50, speed: 15, spread: 0.9 }); parts.slice(-50).forEach(p => { p.vx = -Math.abs(p.vx) - 3; }); }, 260);
  }
  /* sparks from the middle of an element (a 180, a checkout) */
  function sparks(el, cols){
    if(!el) return;
    const r = el.getBoundingClientRect();
    burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: 46, speed: 7, spark: true, cols: cols || ["#ffc94a", "#fff3c4", "#ff8a3a"] });
  }

  D.fx = { calm, count, counts, stagger, bump, buzz, burst, party, sparks };
})(window.DART);
