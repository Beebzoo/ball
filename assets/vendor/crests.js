/* BALL 4 club identity: knitted scarves, embroidered patches, enamel pins. (v2)

   Everything here is drawn from facts about a club: two colours, the kit
   pattern, the name and a three-letter code. Nothing comes from a club's
   crest, which is the whole point: BALL 3 shipped 2,894 scraped club logos,
   and those are copyrighted artwork and registered trademarks. See README.md.

   v2 brings the crests into the BALL 4 logo's world: cream instead of white,
   gold thread and the logo's gold metal, a slanted dark plate with the code in
   cream italic over a gold drop (the wordmark, small), bolder slanted scarf
   lettering, light from the upper left, and a small mode for list sizes.

   Browser only (it needs <canvas> and Path2D). The app can call it at runtime,
   or render.py runs it in headless Edge and writes WebP files to export/.

     Crests.scarf(canvas, club, {cell, fringe, sag})   knitted bar scarf
     Crests.patch(canvas, club, {size, small})          embroidered shield patch
     Crests.pin(canvas, club, {size, small, metal})     enamel pin shield

   `size` is the output width in device pixels. Below 100 the shields switch to
   small mode on their own (bigger plate and code, no fine texture). Load
   Barlow Semi Condensed 800 italic before drawing a shield
   (document.fonts.load); without it the code falls back to 700 italic.

   A club: {name, code, c1, c2, p}
     c1, c2   main and second kit colour, "#rrggbb"
     p        kit pattern: plain | stripes | halves | hoops | band | sash
     code     three letters for the shield plate
     scarf    optional overrides: {text, panel, letter, end, ends}
   Everything else is derived, so a whole league needs only those five fields.

   Random detail (stitch jitter, fibres, tassels) is seeded from the club, so
   the same club always comes out the same. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Crests = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- colour ---------- */
  const hex2 = h => { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, v * f)));
  const tint = (c, f) => c.map(v => v + (255 - v) * f);
  function lum(c) {
    const v = c.map(x => x / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4));
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const toHex = c => "#" + c.map(v => (v | 0).toString(16).padStart(2, "0")).join("");

  /* The logo's palette (_brand/logo: the "cream" ball and the wordmark). */
  const CREAM = [244, 235, 211];       // #f4ebd3 ivory leather: plates, letters
  const WOOL = [243, 236, 218];        // what a white kit becomes in wool, thread and enamel
  const GOLD = [217, 162, 58];         // #d9a23a the ball's gold panels: thread, drop shadow
  const GOLD_LIGHT = [255, 243, 196];  // #fff3c4
  const DARK = [20, 22, 17];           // the wordmark's outline: plates
  const INK = [16, 28, 43];
  const METAL = [[0, "#8a6107"], [.18, "#fff2bf"], [.38, "#f0c95e"], [.55, "#c8961f"], [.72, "#e9b84c"], [.88, "#fff2bf"], [1, "#8a6107"]];
  const SILVER = [[0, "#5d636b"], [.18, "#eef1f4"], [.34, "#9aa1aa"], [.52, "#ffffff"], [.7, "#8a919a"], [.86, "#d9dde2"], [1, "#4f555c"]];
  const UI = '"Barlow Semi Condensed", "Arial Narrow", sans-serif';

  // white kits are never pure white in wool, thread or enamel: warm them to the logo's cream
  const warm = c => lum(c) > .8 ? WOOL.slice() : c;

  /* ---------- seeded randomness ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  /* ======================================================================
     SCARF
     ====================================================================== */

  /* The stitch alphabet: 5x7, read row by row. Knitted bold (each dot is 2
     rows by 3 stitches, overlapping into a 3-stitch stroke) and slanted by a
     stair-step of 2 stitches over the letter height, to echo the italic
     wordmark. Ours, so the lettering owes nothing to any club's type. */
  const FONT = {A:"01110100011000111111100011000110001",B:"11110100011000111110100011000111110",C:"01110100011000010000100001000101110",D:"11110100011000110001100011000111110",
    E:"11111100001000011110100001000011111",F:"11111100001000011110100001000010000",G:"01110100011000010111100011000101111",H:"10001100011000111111100011000110001",
    I:"01110001000010000100001000010001110",J:"00111000100001000010000101001001100",K:"10001100101010011000101001001010001",L:"10000100001000010000100001000011111",
    M:"10001110111010110101100011000110001",N:"10001100011100110101100111000110001",O:"01110100011000110001100011000101110",P:"11110100011000111110100001000010000",
    Q:"01110100011000110001101011001001101",R:"11110100011000111110101001001010001",S:"01111100001000001110000010000111110",T:"11111001000010000100001000010000100",
    U:"10001100011000110001100011000101110",V:"10001100011000110001100010101000100",W:"10001100011000110101101011010101010",X:"10001100010101000100010101000110001",
    Y:"10001100010101000100001000010000100",Z:"11111000010001000100010001000011111",
    "0":"01110100011001110101110011000101110","1":"00100011000010000100001000010001110","2":"01110100010000100010001000100011111","3":"11110000010000101110000010000111110",
    "4":"00010001100101010010111110001000010","5":"11111100001111000001000011000101110","6":"00110010001000011110100011000101110","7":"11111000010001000100010000100001000",
    "8":"01110100011000101110100011000101110","9":"01110100011000101111000010001001100",
    ".":"00000000000000000000000000110001100","-":"00000000000000011111000000000000000","&":"01100100101010001000101011001001101","'":"00100001000100000000000000000000000"};
  const clean = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

  /* Scarf colours from the kit: the panel takes the darker colour, the
     lettering the lighter one (or cream/ink when the pair is too close to
     read), the ends alternate the two. White becomes cream wool.
     Overrides in club.scarf win. */
  function scarfSpec(club) {
    const o = club.scarf || {};
    const a = hex2(club.c1), b = hex2(club.c2);
    const dark = lum(a) <= lum(b) ? a : b, light = dark === a ? b : a;
    const panel = warm(o.panel ? hex2(o.panel) : dark);
    const end = warm(o.end ? hex2(o.end) : light);
    let letter = warm(o.letter ? hex2(o.letter) : light);
    if (!o.letter && contrast(panel, letter) < 3) letter = contrast(panel, WOOL) >= contrast(panel, INK) ? WOOL.slice() : INK;
    const ends = o.ends || (club.p === "stripes" ? "stripes" : club.p === "hoops" ? "hoops" : "bars");
    return { text: o.text || club.name, panel: toHex(panel), letter: toHex(letter), end: toHex(end), ends, ball: o.ball !== false };
  }

  /* BALL's own ball, knitted into each end where an official scarf would
     carry the club crest: the logo's cream leather and gold pentagon, with a
     dark seam. 15 x 14 stitches (stitches are taller than wide, so it knits
     round): a centre pentagon and five cut off at the edge, symmetric, so
     both ends read the same. The gold yarn is a shade deeper than the
     logo's gold, or it melts into the cream at stitch size. */
  const BALL_SPRITE = [
    ".....ooooo.....",
    "...oocgggcoo...",
    "..occccgcccco..",
    ".occccccccccco.",
    ".oggcccccccggo.",
    "ogggccgggccgggo",
    "oggccgggggccggo",
    "occccgggggcccco",
    "occcccgggccccco",
    "occccccccccccco",
    ".ocggcccccggco.",
    "..ogggcccgggo..",
    "...oocccccoo...",
    ".....ooooo.....",
  ];
  const BALL_YARN = { o: DARK, c: WOOL, g: [190, 132, 30] };
  // the end, from the outside edge in: E, P, E, the ball block, then E, P, E into the panel
  const BALL_END = [[2, "E"], [1, "P"], [1, "E"], [17, "B"], [1, "E"], [2, "P"], [2, "E"]];

  const ROWS = 22, TEXT_TOP = 4, TEXT_ROWS = 14, MIN_TEXT = 110, END_LEN = 26, SLANT = 2;
  function lettering(text) { // -> {w, on(col,row)}
    const marks = new Set(); let w = 0;
    for (const ch of clean(text)) {
      const g = FONT[ch];
      if (!g) { w += 7; continue; }
      for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (g[y * 5 + x] === "1")
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) {
          const r = y * 2 + dy;
          marks.add((w + x * 2 + dx + Math.round((TEXT_ROWS - 1 - r) * SLANT / (TEXT_ROWS - 1))) + "," + r);
        }
      w += 14;
    }
    return { w: Math.max(0, w - 3 + SLANT), on: (c, r) => marks.has(c + "," + r) };
  }

  function scarfGrid(spec) {
    const P = hex2(spec.panel), T = hex2(spec.letter), E = hex2(spec.end);
    const txt = lettering(spec.text);
    const pad = Math.max(9, Math.ceil((MIN_TEXT - txt.w) / 2));
    const L = END_LEN * 2 + pad * 2 + txt.w;
    const hoop = r => (r < 2 || r >= ROWS - 2) ? E : (Math.floor((r - 2) / 3) % 2 ? P : E);
    const endColour = (c, r) => { // c counted from the outside edge
      if (spec.ball) {
        let acc = 0;
        for (const [n, k] of BALL_END) {
          if (c < acc + n) {
            if (k !== "B") return spec.ends === "hoops" ? hoop(r) : (k === "E" ? E : P);
            if (r < 2 || r >= ROWS - 2) return E;
            const sr = r - 4, sc = c - acc - 1;
            const ch = sr >= 0 && sr < BALL_SPRITE.length && sc >= 0 && sc < 15 ? BALL_SPRITE[sr][sc] : ".";
            return ch === "." ? P : BALL_YARN[ch];
          }
          acc += n;
        }
        return P;
      }
      if (spec.ends === "stripes") return Math.floor(c / 3) % 2 ? P : E;
      if (spec.ends === "hoops") return (r < 2 || r >= ROWS - 2) ? E : (Math.floor((r - 2) / 3) % 2 ? P : E);
      const seq = [[11, E], [3, P], [4, E], [3, P], [3, E], [2, P]];
      let acc = 0; for (const [n, col] of seq) { acc += n; if (c < acc) return col; } return P;
    };
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = new Array(L);
      for (let c = 0; c < L; c++) {
        let col;
        if (c < END_LEN) col = endColour(c, r);
        else if (c >= L - END_LEN) col = endColour(L - 1 - c, r);
        else {
          col = (r < 2 || r >= ROWS - 2) ? E : P;
          const tc = c - END_LEN - pad, tr = r - TEXT_TOP;
          if (tr >= 0 && tr < TEXT_ROWS && txt.on(tc, tr)) col = T;
        }
        row[c] = col;
      }
      grid.push(row);
    }
    return { grid, L };
  }

  function scarf(canvas, club, opts = {}) {
    const spec = scarfSpec(club);
    const { grid, L } = scarfGrid(spec);
    const W = opts.cell || 9, H = Math.round(W * 1.12);
    const FR = opts.fringe ?? Math.round(W * 6), SAG = opts.sag ?? W * 1.6, PAD = Math.round(W * 2.2);
    const rand = rng(hash(spec.text + spec.panel));
    const x0 = PAD + FR, y0 = PAD, phase = rand() * 6;
    const sag = c => SAG * (1 - Math.pow(2 * c / (L - 1) - 1, 2)) + W * .18 * Math.sin(c * .33 + phase);
    canvas.width = L * W + 2 * x0; canvas.height = Math.ceil(ROWS * H + SAG + PAD * 2 + W * 1.2);
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, canvas.width, canvas.height);

    // body and its cast shadow (light from the upper left, so it falls down-right)
    g.save();
    if (opts.shadow !== false) { g.shadowColor = "rgba(0,0,0,.34)"; g.shadowBlur = W * 2; g.shadowOffsetY = W * 1.1; g.shadowOffsetX = W * .5; }
    g.beginPath(); g.moveTo(x0, y0 + sag(0));
    for (let c = 0; c < L; c++) g.lineTo(x0 + (c + 1) * W, y0 + sag(Math.min(c + 1, L - 1)));
    for (let c = L - 1; c >= 0; c--) g.lineTo(x0 + (c + 1) * W, y0 + sag(Math.min(c + 1, L - 1)) + ROWS * H);
    g.lineTo(x0, y0 + sag(0) + ROWS * H); g.closePath();
    g.fillStyle = rgb(shade(grid[ROWS >> 1][L >> 1], .5)); g.fill(); g.restore();

    // the gaps between stitches
    for (let c = 0; c < L; c++) { const top = y0 + sag(c); for (let r = 0; r < ROWS; r++) { g.fillStyle = rgb(shade(grid[r][c], .42)); g.fillRect(x0 + c * W - .3, top + r * H - .3, W + .6, H + .6); } }

    // stitches: two leaning legs make each V, lit from the upper left
    g.lineWidth = Math.max(.6, W * .08);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < L; c++) {
      const col = shade(grid[r][c], .94 + rand() * .1);
      const cx = x0 + c * W + W / 2, cy = y0 + sag(c) + r * H + H * .5;
      for (const side of [-1, 1]) {
        const ex = cx + side * W * .23, rx = W * .27, ry = H * .6, rot = side * .52;
        g.beginPath(); g.ellipse(ex, cy, rx, ry, rot, 0, Math.PI * 2);
        const gr = g.createLinearGradient(ex - rx, cy - ry, ex + rx, cy + ry);
        gr.addColorStop(0, rgb(tint(col, .18))); gr.addColorStop(.55, rgb(col)); gr.addColorStop(1, rgb(shade(col, .7)));
        g.fillStyle = gr; g.fill();
        g.strokeStyle = "rgba(0,0,0,.22)"; g.stroke();
        g.beginPath(); g.ellipse(ex - W * .05, cy - H * .15, rx * .32, ry * .45, rot, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,255,255,.13)"; g.fill();
      }
    }

    // wool fuzz over the surface and haloing the edges
    g.lineCap = "round";
    const N = Math.round(L * ROWS * .9);
    for (let i = 0; i < N; i++) {
      const c = Math.floor(rand() * L), r = Math.floor(rand() * ROWS);
      const x = x0 + c * W + rand() * W, y = y0 + sag(c) + r * H + rand() * H, a = rand() * Math.PI * 2, len = W * (.3 + rand() * .6);
      g.strokeStyle = rgb(rand() < .5 ? tint(grid[r][c], .35) : shade(grid[r][c], .5), .35); g.lineWidth = W * .05;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * len * .5, y + Math.sin(a + .6) * len * .5, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    for (let c = 0; c < L; c++) for (const edge of [0, 1]) for (let k = 0; k < 2; k++) {
      const r = edge ? ROWS - 1 : 0, x = x0 + c * W + rand() * W, y = y0 + sag(c) + (edge ? ROWS * H : 0), len = W * (.2 + rand() * .45), a = (edge ? 1 : -1) * (Math.PI / 2 + (rand() - .5) * 1.4);
      g.strokeStyle = rgb(tint(grid[r][c], .1), .55); g.lineWidth = W * .05;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }

    // drape: light from the upper left, soft folds along the length, darker ends
    g.save(); g.globalCompositeOperation = "source-atop";
    const v = g.createLinearGradient(0, y0, 0, y0 + SAG + ROWS * H);
    v.addColorStop(0, "rgba(255,255,255,.14)"); v.addColorStop(.35, "rgba(255,255,255,0)"); v.addColorStop(.7, "rgba(0,0,0,.04)"); v.addColorStop(1, "rgba(0,0,0,.28)");
    g.fillStyle = v; g.fillRect(0, 0, canvas.width, canvas.height);
    const side = g.createLinearGradient(x0, 0, x0 + L * W, 0);
    side.addColorStop(0, "rgba(255,248,225,.10)"); side.addColorStop(.5, "rgba(0,0,0,0)"); side.addColorStop(1, "rgba(0,0,0,.10)");
    g.fillStyle = side; g.fillRect(0, 0, canvas.width, canvas.height);
    const nf = 6 + Math.floor(rand() * 3);
    if (opts.folds !== false) { // a waving scarf makes its own folds, so wave() turns these off
      const folds = g.createLinearGradient(x0, 0, x0 + L * W, 0);
      for (let i = 0; i <= nf * 4; i++) { const t = i / (nf * 4), s = Math.sin(t * nf * Math.PI * 2 + phase); folds.addColorStop(t, s > 0 ? `rgba(255,255,255,${(.07 * s).toFixed(3)})` : `rgba(0,0,0,${(-.16 * s).toFixed(3)})`); }
      g.fillStyle = folds; g.fillRect(0, 0, canvas.width, canvas.height);
    }
    const ends = g.createLinearGradient(x0, 0, x0 + L * W, 0);
    ends.addColorStop(0, "rgba(0,0,0,.16)"); ends.addColorStop(.06, "rgba(0,0,0,0)"); ends.addColorStop(.94, "rgba(0,0,0,0)"); ends.addColorStop(1, "rgba(0,0,0,.2)");
    g.fillStyle = ends; g.fillRect(0, 0, canvas.width, canvas.height);
    g.restore();

    // fringe: knotted, frayed tassels at both ends
    if (FR > 0) {
      g.save(); g.shadowColor = "rgba(0,0,0,.3)"; g.shadowBlur = W * .8; g.shadowOffsetY = W * .4; g.shadowOffsetX = W * .2; g.lineCap = "round";
      for (const sd of [-1, 1]) {
        const c = sd < 0 ? 0 : L - 1, xe = sd < 0 ? x0 : x0 + L * W, top = y0 + sag(c), groups = 8;
        for (let k = 0; k < groups; k++) {
          const rr = Math.min(ROWS - 1, Math.round((k + .5) * ROWS / groups)), col = grid[rr][c];
          const yk = top + (k + .5) * (ROWS * H / groups), strands = 7;
          for (let s = 0; s < strands; s++) {
            const off = (s - (strands - 1) / 2) * W * .16, len = FR * (.8 + rand() * .22), drop = W * (.4 + rand() * 1.1);
            const ex = xe + sd * len, ey = yk + off * 2.2 + drop + (rand() - .5) * W * .6, sc = shade(col, .78 + rand() * .3);
            g.strokeStyle = rgb(sc); g.lineWidth = W * .3;
            g.beginPath(); g.moveTo(xe + sd * W * .5, yk + off); g.quadraticCurveTo(xe + sd * len * .55, yk + off * 1.6 + (rand() - .3) * W * .8, ex, ey); g.stroke();
            g.shadowColor = "transparent";
            g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = W * .09;
            g.beginPath(); g.moveTo(xe + sd * W * .5, yk + off - W * .06); g.quadraticCurveTo(xe + sd * len * .55, yk + off * 1.6 - W * .06, ex, ey - W * .06); g.stroke();
            g.shadowColor = "rgba(0,0,0,.3)";
            g.strokeStyle = rgb(tint(sc, .1), .6); g.lineWidth = W * .06;
            for (let f = 0; f < 2; f++) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + sd * W * (.2 + rand() * .35), ey + (rand() - .5) * W * .5); g.stroke(); }
          }
          const kc = shade(col, .85);
          g.beginPath(); g.ellipse(xe + sd * W * .55, yk, W * .55, W * .48, 0, 0, Math.PI * 2);
          const kg = g.createRadialGradient(xe + sd * W * .4, yk - W * .2, W * .05, xe + sd * W * .55, yk, W * .6);
          kg.addColorStop(0, rgb(tint(kc, .25))); kg.addColorStop(1, rgb(shade(kc, .6)));
          g.fillStyle = kg; g.fill();
        }
      }
      g.restore();
    }
    return canvas;
  }

  /* A scarf held up at both ends and waving, for the result screen.
     The scarf is knitted once, flat; each frame slices it into stitch columns,
     lifts each column on a billow plus a travelling ripple, and shades it by
     its slope (light from the upper left). Cheap enough for every frame on a
     phone. Honours prefers-reduced-motion by drawing one still pose.
     Returns {stop()}; call it when the screen closes. */
  function wave(canvas, club, opts = {}) {
    const W = opts.cell || 8;
    const flat = scarf(mk(1, 1), club, Object.assign({}, opts, { sag: 0, shadow: false, folds: false }));
    const A = W * (opts.amp ?? 1.7), M = Math.ceil(A * 1.8 + W * 2.5);
    canvas.width = flat.width; canvas.height = flat.height + M * 2;
    const g = canvas.getContext("2d"), buf = mk(canvas.width, canvas.height), b = buf.getContext("2d");
    const cols = Math.ceil(flat.width / W), len = flat.width;
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = opts.speed ?? 1;
    const yAt = (x, t) => {
      const u = Math.max(0, Math.min(1, x / len)), hold = Math.sin(Math.PI * u); // the ends are held, the middle billows
      return hold * (A * (.15 + .85 * Math.sin(t * 2.1)) + A * .35 * Math.sin(4 * Math.PI * u - t * 3.4));
    };
    let raf = 0, live = true; const t0 = performance.now();
    function draw(now) {
      const t = reduce ? .75 : (now - t0) / 1000 * speed;
      b.clearRect(0, 0, buf.width, buf.height);
      for (let i = 0; i < cols; i++) {
        const x = i * W, w = Math.min(W + 1, flat.width - x);
        if (w > 0) b.drawImage(flat, x, 0, w, flat.height, x, M + yAt(x + W / 2, t), w, flat.height);
      }
      b.save(); b.globalCompositeOperation = "source-atop";
      for (let i = 0; i < cols; i++) {
        const x = i * W + W / 2, s = (yAt(x + W, t) - yAt(x - W, t)) / (2 * W);
        const a = Math.max(-.26, Math.min(.26, s * 1.5));
        b.fillStyle = a > 0 ? `rgba(0,0,0,${a.toFixed(3)})` : `rgba(255,248,225,${(-a * .6).toFixed(3)})`;
        b.fillRect(i * W, 0, W + 1, buf.height);
      }
      b.restore();
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.save(); g.shadowColor = "rgba(0,0,0,.34)"; g.shadowBlur = W * 2; g.shadowOffsetY = W * 1.4; g.shadowOffsetX = W * .5;
      g.drawImage(buf, 0, 0); g.restore();
      if (live && !reduce) raf = requestAnimationFrame(draw);
    }
    draw(performance.now());
    return { canvas, stop() { live = false; cancelAnimationFrame(raf); } };
  }

  /* ======================================================================
     SHIELDS: one shape for every club, in design units (100 x 120)
     ====================================================================== */
  const SHIELD_D = "M10 6H90V58C90 88 72 104 50 114C28 104 10 88 10 58Z";
  const TRIM_D = "M19 15H81V58C81 81 67 94 50 102C33 94 19 81 19 58Z";

  /* The plate is the "FOOTBALL QUIZ" banner's slant: a parallelogram, dark,
     gold-edged, with the code in cream italic over a gold drop like the BALL
     wordmark. Small mode makes it bigger so the code survives at 32 px. */
  const PLATES = {
    full:  { pts: [[25, 45], [83, 45], [75, 70], [17, 70]], font: 21, y: 64.6, drop: 1.1 },
    small: { pts: [[17, 39], [91, 39], [83, 78], [9, 78]], font: 31, y: 69.5, drop: 1.6 },
  };
  let SHAPES = null; // Path2D needs a browser, so build on first use
  function shapes() {
    if (SHAPES) return SHAPES;
    const poly = (pts, r) => { // parallelogram with softly rounded corners
      const p = new Path2D(), n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
        const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
        const p1 = [b[0] + (a[0] - b[0]) * r / d1, b[1] + (a[1] - b[1]) * r / d1], p2 = [b[0] + (c[0] - b[0]) * r / d2, b[1] + (c[1] - b[1]) * r / d2];
        if (i === 0) p.moveTo(p1[0], p1[1]); else p.lineTo(p1[0], p1[1]);
        p.quadraticCurveTo(b[0], b[1], p2[0], p2[1]);
      }
      p.closePath(); return p;
    };
    SHAPES = { shield: new Path2D(SHIELD_D), trim: new Path2D(TRIM_D), rim: outline(1.15), poly,
      plate: { full: poly(PLATES.full.pts, 2.5), small: poly(PLATES.small.pts, 3) } };
    return SHAPES;
  }

  // evenly spaced points round the shield, clockwise, with outward normals
  function outline(step) {
    const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]; };
    const raw = []; const lin = (a, b) => { for (let i = 0; i < 40; i++) { const t = i / 40; raw.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } };
    lin([10, 6], [90, 6]); lin([90, 6], [90, 58]);
    for (let i = 0; i < 60; i++) raw.push(bez([90, 58], [90, 88], [72, 104], [50, 114], i / 60));
    for (let i = 0; i < 60; i++) raw.push(bez([50, 114], [28, 104], [10, 88], [10, 58], i / 60));
    lin([10, 58], [10, 6]); raw.push([10, 6]);
    const pts = [raw[0]]; let acc = 0;
    for (let i = 1; i < raw.length; i++) {
      const d = Math.hypot(raw[i][0] - raw[i-1][0], raw[i][1] - raw[i-1][1]); acc += d;
      while (acc >= step) { acc -= step; const f = 1 - acc / d; pts.push([raw[i-1][0] + (raw[i][0] - raw[i-1][0]) * f, raw[i-1][1] + (raw[i][1] - raw[i-1][1]) * f]); }
    }
    return pts.map((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      return { x: p[0], y: p[1], tx, ty, nx: ty, ny: -tx };
    });
  }

  /* The kit pattern as fill regions. ang = thread direction for the patch
     (satin runs across a stripe, tatami fills big areas); edge = the lines
     where the pin gets a metal divider. White becomes cream. */
  function regions(c) {
    const A = warm(hex2(c.c1)), B = warm(hex2(c.c2)), out = [{ fill: x => x.fillRect(0, 0, 100, 120), col: A, ang: 32, tat: true }];
    if (c.p === "stripes") { const sw = 100 / 7; for (let i = 1; i < 7; i += 2) out.push({ fill: x => x.fillRect(i * sw, 0, sw, 120), col: B, ang: 0, edge: [[i * sw, 0, i * sw, 120], [(i + 1) * sw, 0, (i + 1) * sw, 120]] }); }
    else if (c.p === "halves") out.push({ fill: x => x.fillRect(50, 0, 50, 120), col: B, ang: -32, tat: true, edge: [[50, 0, 50, 120]] });
    else if (c.p === "hoops") { const sh = 120 / 8; for (let i = 1; i < 8; i += 2) out.push({ fill: x => x.fillRect(0, i * sh, 100, sh), col: B, ang: 90, edge: [[0, i * sh, 100, i * sh], [0, (i + 1) * sh, 100, (i + 1) * sh]] }); }
    else if (c.p === "band") out.push({ fill: x => x.fillRect(36, 0, 28, 120), col: B, ang: 0, edge: [[36, 0, 36, 120], [64, 0, 64, 120]] });
    else if (c.p === "sash") out.push({ fill: x => { x.beginPath(); x.moveTo(0, 0); x.lineTo(30, 0); x.lineTo(100, 84); x.lineTo(100, 120); x.lineTo(70, 120); x.lineTo(0, 36); x.closePath(); x.fill(); }, col: B, ang: -50, edge: [[30, 0, 100, 84], [0, 36, 70, 120]] });
    return out;
  }

  const codeFont = px => `italic 800 ${px}px ${UI}`;

  /* ---------- embroidered patch ---------- */

  // thread texture laid over whatever is already on the layer
  function threads(x, base, angDeg, sp, tatami, rand) {
    const W = x.canvas.width, H = x.canvas.height;
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-atop"; x.lineCap = "butt";
    const a = angDeg * Math.PI / 180, tx = Math.cos(a), ty = Math.sin(a), nx = -ty, ny = tx, cx = W / 2, cy = H / 2, D = Math.hypot(W, H) / 2 + 4;
    const seg = sp * 5.5; let row = 0;
    const ln = off => { x.beginPath(); x.moveTo(cx + nx * off - tx * D, cy + ny * off - ty * D); x.lineTo(cx + nx * off + tx * D, cy + ny * off + ty * D); x.stroke(); };
    const light = lum(base) > .7; // pale thread shows its shading less, or it reads grey
    const groove = light ? .16 : .3, gap = light ? .2 : .35;
    for (let d = -D; d <= D; d += sp, row++) {
      x.setLineDash([]);
      x.strokeStyle = rgb(shade(base, (light ? .93 : .84) + rand() * (light ? .1 : .26)), .6); x.lineWidth = sp * .95; ln(d);
      x.strokeStyle = `rgba(0,0,0,${groove})`; x.lineWidth = Math.max(.45, sp * .2); ln(d + sp * .5);
      if (tatami) { x.setLineDash([seg - sp * .8, sp * .8]); x.lineDashOffset = (row % 3) * seg / 3; }
      x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = sp * .34; ln(d - sp * .12);
      if (tatami) { x.setLineDash([sp * .8, seg - sp * .8]); x.lineDashOffset = (row % 3) * seg / 3 - (seg - sp * .8); x.strokeStyle = `rgba(0,0,0,${gap})`; x.lineWidth = sp * .9; ln(d); }
    }
    x.restore();
  }

  function frame(canvas, size) {
    const S = size / 120, O = 10 * S;
    canvas.width = Math.round(120 * S); canvas.height = Math.round(140 * S);
    return { S, O, W: canvas.width, H: canvas.height, T: x => x.setTransform(S, 0, 0, S, O, O) };
  }

  function patch(canvas, club, opts = {}) {
    const size = opts.size || 240, small = opts.small ?? size < 100;
    const { shield, trim, rim, plate } = shapes();
    const { S, W, H, T } = frame(canvas, size);
    const g = canvas.getContext("2d"), rand = rng(hash(club.code + club.c1 + club.c2 + club.p + "patch"));
    const border = opts.border ? hex2(opts.border) : GOLD;
    const PL = small ? PLATES.small : PLATES.full, plateP = small ? plate.small : plate.full;
    const sp = Math.max(.9, S * .62);
    const layer = (draw, col, ang, tat, clip = true, spx = sp) => {
      const c = mk(W, H), x = c.getContext("2d"); T(x); if (clip) x.clip(shield); draw(x);
      if (small) { // no thread at list sizes: a soft sheen keeps it from looking flat
        x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-atop";
        const sh = x.createLinearGradient(0, 0, W, H); sh.addColorStop(0, "rgba(255,255,255,.12)"); sh.addColorStop(1, "rgba(0,0,0,.12)");
        x.fillStyle = sh; x.fillRect(0, 0, W, H); x.restore();
      } else threads(x, col, ang, spx, tat, rand);
      return c;
    };
    const put = (c, blur, dy, a) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = blur * S; g.shadowOffsetY = dy * S; g.shadowOffsetX = dy * S * .4; g.drawImage(c, 0, 0); g.restore(); };

    // twill backing and cast shadow, falling down-right
    g.save(); T(g); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 4 * S; g.shadowOffsetY = 2.4 * S; g.shadowOffsetX = 1 * S;
    g.fillStyle = rgb(shade(warm(hex2(club.c1)), .6)); g.fill(shield); g.lineWidth = small ? 9 : 7; g.strokeStyle = rgb(shade(border, .55)); g.stroke(shield); g.restore();

    // body regions, each stitched in its own direction
    regions(club).forEach((r, i) => put(layer(x => { x.fillStyle = rgb(r.col); r.fill(x); }, r.col, r.ang, !!r.tat), i ? .9 : 0, i ? .25 : 0, i ? .4 : 0));
    // trim for plain kits, so plain-red clubs still tell apart
    if (club.p === "plain") { const B = warm(hex2(club.c2)); put(layer(x => { x.lineWidth = small ? 6 : 4.2; x.strokeStyle = rgb(B); x.stroke(trim); }, B, 90, false, true, sp * .85), 1.1, .4, .45); }

    // plate: dark satin, gold edge, raised
    put(layer(x => { x.fillStyle = rgb(DARK); x.fill(plateP); }, DARK, 90, false, false), 1.8, .7, .5);
    put(layer(x => { x.lineWidth = small ? 3.2 : 2.2; x.lineJoin = "round"; x.strokeStyle = rgb(GOLD); x.stroke(plateP); }, GOLD, 90, false, false, sp * .8), .5, .2, .35);
    // the code: gold drop, then cream on top, stitched in two passes like the wordmark
    const code = x => { x.font = codeFont(PL.font); x.textAlign = "center"; x.textBaseline = "alphabetic"; };
    put(layer(x => { code(x); x.fillStyle = rgb(GOLD); x.fillText(club.code, 50 + PL.drop, PL.y + PL.drop); }, GOLD, 74, false, false, sp * .7), .3, .1, .3);
    put(layer(x => { code(x); x.fillStyle = rgb(CREAM); x.fillText(club.code, 50, PL.y); }, CREAM, 74, false, false, sp * .7), .6, .3, .4);

    // merrowed edge in gold thread: dense slanted overcast stitches all round
    g.save(); T(g); g.lineCap = "round";
    if (small) {
      const e = g.createLinearGradient(10, 6, 90, 114); e.addColorStop(0, rgb(tint(border, .35))); e.addColorStop(.5, rgb(border)); e.addColorStop(1, rgb(shade(border, .6)));
      g.lineWidth = 7.5; g.strokeStyle = e; g.stroke(shield);
    } else for (const p of rim) {
      const len = 3.6, sl = .9, lit = .5 - .5 * (p.nx * .6 + p.ny * .8); // brighter where the edge faces the upper left
      g.strokeStyle = rgb(shade(border, .62 + lit * .5 + rand() * .22)); g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(p.x - p.nx * len + p.tx * sl, p.y - p.ny * len + p.ty * sl); g.lineTo(p.x + p.nx * len - p.tx * sl, p.y + p.ny * len - p.ty * sl); g.stroke();
      g.strokeStyle = rgb(GOLD_LIGHT, .28 + lit * .25); g.lineWidth = .42;
      g.beginPath(); g.moveTo(p.x - p.nx * len * .7 + p.tx * sl * .5 - .25, p.y - p.ny * len * .7 + p.ty * sl * .5 - .25); g.lineTo(p.x + p.nx * len * .7 - p.tx * sl * .5 - .25, p.y + p.ny * len * .7 - p.ty * sl * .5 - .25); g.stroke();
    }
    g.restore();

    // light from the upper left, puffed edges
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop";
    const L = g.createRadialGradient(W * .3, H * .15, W * .05, W * .5, H * .5, W * .75);
    L.addColorStop(0, "rgba(255,248,225,.16)"); L.addColorStop(.5, "rgba(255,255,255,0)"); L.addColorStop(1, "rgba(0,0,0,.24)");
    g.fillStyle = L; g.fillRect(0, 0, W, H); g.restore();

    // a few loose gold fibres off the edge
    if (!small) {
      g.save(); T(g); g.lineCap = "round";
      for (let i = 0; i < 60; i++) {
        const p = rim[Math.floor(rand() * rim.length)], a = Math.atan2(p.ny, p.nx) + (rand() - .5) * 1.6, l = .8 + rand() * 1.6;
        g.strokeStyle = rgb(tint(border, .2), .5); g.lineWidth = .18;
        g.beginPath(); g.moveTo(p.x + p.nx * 3, p.y + p.ny * 3); g.lineTo(p.x + p.nx * 3 + Math.cos(a) * l, p.y + p.ny * 3 + Math.sin(a) * l); g.stroke();
      }
      g.restore();
    }
    return canvas;
  }

  /* ---------- enamel pin ---------- */
  function pin(canvas, club, opts = {}) {
    const size = opts.size || 240, small = opts.small ?? size < 100;
    const { shield, trim, poly } = shapes();
    const { S, O, T } = frame(canvas, size);
    const g = canvas.getContext("2d");
    const M = g.createLinearGradient(O, O, O + 100 * S, O + 120 * S);
    (opts.metal === "silver" ? SILVER : METAL).forEach(([t, c]) => M.addColorStop(t, c));
    const PL = small ? PLATES.small : PLATES.full;
    const rimW = small ? 5.4 : 7.2;

    // metal body with its shadow
    g.save(); T(g); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 4.5 * S; g.shadowOffsetY = 2.6 * S; g.shadowOffsetX = 1 * S;
    g.fillStyle = M; g.fill(shield); g.lineWidth = rimW; g.strokeStyle = M; g.stroke(shield); g.restore();

    // enamel fields, then metal dividers between them
    g.save(); T(g); g.clip(shield);
    const regs = regions(club);
    for (const r of regs) { const e = g.createLinearGradient(0, 0, 0, 120); e.addColorStop(0, rgb(tint(r.col, .08))); e.addColorStop(1, rgb(shade(r.col, .86))); g.fillStyle = e; r.fill(g); }
    g.lineCap = "butt";
    for (const r of regs) for (const [a, b, c, d] of (r.edge || [])) {
      if (!small) { g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2.1; g.beginPath(); g.moveTo(a + .3, b + .3); g.lineTo(c + .3, d + .3); g.stroke(); }
      g.strokeStyle = M; g.lineWidth = small ? 1.8 : 1.5; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
    }
    if (club.p === "plain") { g.lineWidth = small ? 7.4 : 5.6; g.strokeStyle = M; g.stroke(trim); g.lineWidth = small ? 5 : 3.4; g.strokeStyle = rgb(warm(hex2(club.c2))); g.stroke(trim); }
    g.restore();

    // plate: metal frame, dark enamel, cream code with a gold drop and metal edge
    g.save(); T(g);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 1.2 * S; g.shadowOffsetY = .5 * S;
    const grow = (pts, d) => pts.map(([x, y]) => [x + (x < 50 ? -d : d), y + (y < 58 ? -d : d)]);
    g.fillStyle = M; g.fill(poly(grow(PL.pts, 1.6), 3.4)); g.shadowColor = "transparent";
    const pe = g.createLinearGradient(0, PL.pts[0][1], 0, PL.pts[2][1]); pe.addColorStop(0, "#2a2c25"); pe.addColorStop(1, rgb(DARK));
    g.fillStyle = pe; g.fill(poly(PL.pts, 2.4));
    g.font = codeFont(PL.font); g.textAlign = "center";
    g.fillStyle = M; g.fillText(club.code, 50 + PL.drop, PL.y + PL.drop);
    g.fillStyle = rgb(CREAM); g.fillText(club.code, 50, PL.y);
    if (!small) { g.lineWidth = .5; g.strokeStyle = "rgba(255,242,191,.6)"; g.strokeText(club.code, 50, PL.y); }
    g.restore();

    // rim with a bevel
    g.save(); T(g);
    g.lineWidth = rimW; g.strokeStyle = M; g.stroke(shield);
    g.save(); g.clip(shield); g.lineWidth = 1.4; g.strokeStyle = "rgba(0,0,0,.38)"; g.translate(.5, .7); g.stroke(shield); g.restore();
    g.lineWidth = .8; g.strokeStyle = "rgba(255,250,225,.7)"; g.translate(-.35, -.45); g.stroke(shield);
    g.restore();

    // gloss: domed highlight, a diagonal streak, darker towards the point
    g.save(); T(g); g.clip(shield);
    const gl = g.createLinearGradient(0, 6, 0, 52); gl.addColorStop(0, `rgba(255,255,255,${small ? .3 : .4})`); gl.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gl; g.beginPath(); g.ellipse(44, 10, 46, 30, -.12, 0, Math.PI * 2); g.fill();
    if (!small) { g.fillStyle = "rgba(255,255,255,.11)"; g.beginPath(); g.moveTo(62, 6); g.lineTo(74, 6); g.lineTo(32, 114); g.lineTo(20, 114); g.closePath(); g.fill(); }
    const lo = g.createLinearGradient(0, 70, 0, 114); lo.addColorStop(0, "rgba(0,0,0,0)"); lo.addColorStop(1, "rgba(0,0,0,.18)"); g.fillStyle = lo; g.fillRect(0, 70, 100, 50);
    g.restore();
    // a glint on the rim, top left where the light is
    if (!small) { g.save(); T(g); const sg = g.createRadialGradient(16, 9, 0, 16, 9, 6); sg.addColorStop(0, "rgba(255,255,255,.95)"); sg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = sg; g.fillRect(8, 2, 16, 14); g.restore(); }
    return canvas;
  }

  /* A NATION'S SCARF: the same knitting, from up to three flag colours. The
     panel takes c1, the lettering c2, the ends c3 (striped when there is a
     third colour). Used for BALL 4's scarf rewards (plan §6). */
  function nationClub(n) {
    return { name: n.name, code: n.code, c1: n.c1, c2: n.c2, p: n.c3 ? "stripes" : "plain",
      scarf: { panel: n.c1, letter: n.c2, end: n.c3 || n.c2, ends: n.c3 ? "stripes" : "bars" } };
  }
  const nationScarf = (canvas, n, opts) => scarf(canvas, nationClub(n), opts);
  const nationWave = (canvas, n, opts) => wave(canvas, nationClub(n), opts);

  return { scarf, wave, patch, pin, nationScarf, nationWave, nationClub, scarfSpec, regions, FONT, clean, SHIELD_D, TRIM_D, PLATES, version: 3 };
});
