/* BALL 4: THE MATCH CENTRE'S CHARTS (_plans/match-centre-v3.md §2; drawn to the dataviz skill's rules).
 *
 * Pure functions of what the match centre already holds for a competition (CL.mc[comp] in pl.js: m.rows, the
 * season's fixtures as clMcLoad maps them, and m.table, the table as clMcTable sorts it). Each returns an SVG
 * string, or "" when there is nothing to draw yet: fewer than three matchdays played, a club that isn't in the
 * table, rows that aren't rows. Nothing here throws; every chart is wrapped and gives "" on what it can't read.
 * No server calls, no libraries. The table after each matchday comes from MCStats.tableAt (mc-stats.js), so this
 * file loads after it, with mc.js. Pages call it through the contract: typeof mcCharts !== "undefined" ? … : "".
 *
 * The look (§1.2): inline SVG, 2 px lines, the followed club in gold, the leader in the ink, the rest in sage,
 * gridlines 1 px at 12% of the ink, axis labels 11 px caps in Barlow, tabular figures. The ink is currentColor,
 * so a chart reads on the cream card, the paper and a dark card alike; every other colour is a CSS variable with
 * its light value as the fallback, and mc-charts.css picks the dark ones (both sets run through the skill's
 * validator against the cream card, the paper and the dark surfaces). Never red: a defeat is the ink at 40%.
 * Every chart is role="img", with an aria-label that says the takeaway in words and a <desc> with the numbers.
 * A tap on a column, a bar or a dot shows a small label in place (mcChartsTap below only toggles data-on).
 * Lines draw in over 600 ms the first time a chart is drawn in a browser; never under reduced motion (the CSS). */
(function(root){
  const STATS = () => {
    if(root && root.MCStats) return root.MCStats;
    try{ return typeof require === "function" ? require("./mc-stats.js") : null; }catch(e){ return null; }
  };
  const W = 340;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const n1 = v => Math.round(v * 10) / 10;
  const ord = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  const sgn = n => (n > 0 ? "+" : "") + n;
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* the colours that aren't the ink: the light value is the fallback, mc-charts.css has the dark ones */
  const COL = { gold: "var(--mcc-gold,#c99a2e)", rest: "var(--mcc-rest,#8FB79E)", win: "var(--mcc-win,#2c7a48)",
    winInk: "var(--mcc-win-ink,#fff)", surf: "var(--mcc-surface,#F8F1DD)", ink: "currentColor" };
  /* the axis labels: 11 px caps, the ink at 78% (5.8:1 on the cream card, 5.4:1 on the paper) */
  const AX = ' font-size="11" font-weight="700" letter-spacing=".6" fill="currentColor" fill-opacity=".78"';
  const LAB = ' font-size="12" fill="currentColor"';

  /* ---------- the data ---------- */
  const valid = x => !!x && typeof x === "object" && !!x.h && !!x.a && x.h.key != null && x.a.key != null;
  const rowsOf = m => m && typeof m === "object" && Array.isArray(m.rows) ? m.rows.filter(valid) : null;
  /* the table as the page shows it (m.table, clMcTable's), else worked out the same way */
  function tableOf(m, S, rows){
    const t = m && Array.isArray(m.table) ? m.table.filter(x => x && x.key != null && typeof x.pts === "number") : [];
    return t.length ? t : S.tableAt(rows);
  }
  /* a club's name: the page's (clTeam, from teams.json) when it is there, else the feed's */
  function nameOf(t, o){
    try{
      if(o && typeof o.name === "function"){ const n = o.name(t); if(n) return String(n); }
      if(root && typeof root.clTeam === "function") return String(root.clTeam(t).name);
    }catch(e){}
    return String((t && t.name) || "?");
  }
  /* short enough for the end of a line: "Nottingham Forest" is "Nottingham F." */
  function shortName(n){
    let s = String(n == null ? "" : n).trim();
    if(s.length <= 14) return s;
    s = s.replace(/^(FC|AFC|SC|SV|AC|AS|SS|RC|CF|CD|FK|NK|SK)\s+/, "").replace(/\s+(FC|AFC|SC|CF|CFC|FK)$/, "");
    if(s.length <= 14) return s;
    const w = s.split(/\s+/);
    if(w.length > 1){ const t = w.slice(0, -1).join(" ") + " " + w[w.length - 1][0] + "."; if(t.length <= 15) return t; }
    return s.slice(0, 13) + "…";
  }
  /* about how wide a label is in Barlow Semi Condensed (no DOM to measure with) */
  function tw(s, px, bold){
    let w = 0;
    for(const c of String(s)){
      w += /[A-Z]/.test(c) ? (/[MW]/.test(c) ? .78 : /[IJ]/.test(c) ? .3 : .58) : /[0-9]/.test(c) ? .52 : /[mw]/.test(c) ? .74 :
        /[iljtfr]/.test(c) ? .3 : /[ .,'·–\-:]/.test(c) ? .26 : .5;
    }
    return w * px * (bold ? 1.06 : 1);
  }
  const STEPS = [1, 2, 5, 10, 15, 20, 25, 50, 100];
  const niceStep = (span, most) => STEPS.find(s => span / s <= most) || Math.ceil(span / most);
  /* the matchday labels along the bottom: the first, round numbers, the last, never two on top of each other */
  function mdTicks(lo, hi, X){
    const span = hi - lo, st = span <= 6 ? 1 : span <= 12 ? 2 : span <= 30 ? 5 : 10, out = [lo];
    for(let v = st >= 5 ? Math.ceil((lo + 1) / st) * st : lo + st; v < hi; v += st) out.push(v);
    if(hi !== lo) out.push(hi);
    return out.filter((v, i, a) => i === 0 || i === a.length - 1 ? true : X(v) - X(a[i - 1]) >= 22 && X(a[a.length - 1]) - X(v) >= 22);
  }
  /* end labels that would sit on top of each other are moved apart, never more than they must */
  function spread(items, gap, lo, hi){
    const s = items.slice().sort((p, q) => p.y - q.y);
    s.forEach((it, i) => { it.ly = Math.max(it.y, i ? s[i - 1].ly + gap : lo); });
    for(let i = s.length - 1; i >= 0; i--){ const lim = i === s.length - 1 ? hi : s[i + 1].ly - gap; if(s[i].ly > lim) s[i].ly = lim; }
    s.forEach((it, i) => { if(i && it.ly < s[i - 1].ly + gap) it.ly = s[i - 1].ly + gap; });
    return items;
  }

  /* ---------- the drawing ---------- */
  const txt = (x, y, s, a) => '<text x="' + n1(x) + '" y="' + n1(y) + '"' + (a || "") + ">" + esc(s) + "</text>";
  const hline = (x0, x1, y, op) => '<path d="M' + n1(x0) + " " + n1(y) + "H" + n1(x1) + '" stroke="currentColor" stroke-opacity="' + op + '" stroke-width="1" shape-rendering="crispEdges"/>';
  const vline = (x, y0, y1, op) => '<path d="M' + n1(x) + " " + n1(y0) + "V" + n1(y1) + '" stroke="currentColor" stroke-opacity="' + op + '" stroke-width="1" shape-rendering="crispEdges"/>';
  const dot = (x, y, r, fill, cls, ring) => '<circle' + (cls ? ' class="' + cls + '"' : "") + ' cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + r + '" style="fill:' + fill + ";stroke:" + COL.surf + '" stroke-width="' + (ring || 2) + '"/>';
  /* a bar from its baseline x, len long (negative: leftwards), top y, h high: the data end rounded, the baseline square */
  function hbar(x, y, len, h, r){
    if(!(Math.abs(len) >= .5)) return "";
    const d = len < 0 ? -1 : 1, L = Math.abs(len), rr = Math.min(r, L, h / 2), e = x + d * L;
    return "M" + n1(x) + " " + n1(y) + "H" + n1(e - d * rr) + "Q" + n1(e) + " " + n1(y) + " " + n1(e) + " " + n1(y + rr) + "V" + n1(y + h - rr) +
      "Q" + n1(e) + " " + n1(y + h) + " " + n1(e - d * rr) + " " + n1(y + h) + "H" + n1(x) + "Z";
  }
  /* the small label a tap shows: a head line, then rows [colour of a line key or null, the value, what it is].
     It sits right of x, or left when there is no room, inside [xmin, xmax]. Only ever seen with mc-charts.css
     loaded (that is what shows it), so its look lives there, in classes, and a chart's markup stays small */
  function tipBox(x, y, head, rows, xmin, xmax){
    const rh = 15, w = Math.ceil(Math.max(head ? tw(head, 11) + 2 : 0, ...rows.map(r => (r[0] ? 16 : 0) + tw(r[1], 12, true) + (r[2] ? 5 + tw(r[2], 12) : 0)))) + 16;
    const h = 7 + (head ? 14 : 0) + rows.length * rh + 2;
    let bx = x + 10;
    if(bx + w > xmax) bx = x - 10 - w;
    if(bx < xmin) bx = xmin;
    let s = '<rect class="mcc-tb" x="' + n1(bx) + '" y="' + n1(y) + '" width="' + w + '" height="' + h + '" rx="6"/>';
    let yy = y + 7;
    if(head){ s += '<text class="mcc-th" x="' + n1(bx + 8) + '" y="' + n1(yy + 9) + '">' + esc(head) + "</text>"; yy += 14; }
    for(const r of rows){
      let tx = bx + 8;
      if(r[0]){ s += '<path class="mcc-tk" d="M' + n1(tx) + " " + n1(yy + 7) + 'h10" style="stroke:' + r[0] + '"/>'; tx += 16; }
      s += '<text class="mcc-tx" x="' + n1(tx) + '" y="' + n1(yy + 11) + '"><tspan class="v">' + esc(r[1]) + "</tspan>" + (r[2] ? '<tspan dx="5">' + esc(r[2]) + "</tspan>" : "") + "</text>";
      yy += rh;
    }
    return s;
  }
  /* inside a tap label: the line through a matchday and a dot on a line (their look is the CSS's too) */
  const tline = (x, y0, y1) => '<path class="mcc-tl" d="M' + n1(x) + " " + n1(y0) + "V" + n1(y1) + '"/>';
  const tdot = (x, y, fill) => '<circle class="mcc-td" cx="' + n1(x) + '" cy="' + n1(y) + '" r="3.5" style="fill:' + fill + '"/>';
  /* a tap target: an invisible hit area bigger than the mark, and what shows while it is on */
  const tapG = (hit, on) => '<g class="mcc-t">' + hit + '<g class="mcc-on" visibility="hidden">' + on + "</g></g>";
  const hitRect = (x, y, w, h) => '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(Math.max(1, w)) + '" height="' + n1(Math.max(1, h)) + '" fill="transparent"/>';

  /* the draw-in: the first time a chart is drawn in a browser, not when the page draws it again (a pure function
     still: o.anim true or false says it outright, and outside a browser it is off) */
  const SEEN = {};
  function animate(o, sig){
    if(o && o.anim != null) return !!o.anim;
    if(typeof document === "undefined" || !document) return false;
    if(SEEN[sig]) return false;
    SEEN[sig] = 1;
    return true;
  }
  const sigOf = (kind, rows, mds, k) => kind + "|" + (k || "") + "|" + rows.length + "|" + (mds.length ? mds[mds.length - 1] : "") + "|" + (rows[0] ? rows[0].id : "");
  function hash(s){ let h = 5381; for(let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function shell(kind, w, h, label, desc, body, o, size){
    const id = "mcc-" + kind + "-" + hash(kind + label + desc);
    return '<svg class="mcc mcc-' + kind + (o.anim ? " mcc-in" : "") + (o.dark ? " mcc-dark" : "") + '" viewBox="0 0 ' + w + " " + h + '"' + (size || ' width="100%"') +
      ' role="img" aria-label="' + esc(label) + '" aria-describedby="' + id + '" onclick="window.mcChartsTap&amp;&amp;mcChartsTap(event)"' +
      " style=\"font-family:var(--ui,'Barlow Semi Condensed',sans-serif);font-variant-numeric:tabular-nums;overflow:visible\">" +
      '<desc id="' + id + '">' + esc(desc) + "</desc>" + body + "</svg>";
  }
  /* the season matchday by matchday: each played matchday and the table after it, keyed by club */
  function history(S, rows){
    const mds = S.byMatchday(rows);
    return { mds, by: mds.map(md => { const by = {}; S.tableAt(rows, md).forEach(x => { by[x.key] = x; }); return by; }) };
  }
  const opts = o => (o && typeof o === "object" ? Object.assign({}, o) : {});

  /* ---------- the race: points by matchday, the top n and the followed club ---------- */
  function race(m, o){
    try{
      o = opts(o);
      const S = STATS(), rows = rowsOf(m);
      if(!S || !rows) return "";
      const { mds, by } = history(S, rows);
      if(mds.length < 3) return "";
      const cur = tableOf(m, S, rows);
      if(cur.length < 2) return "";
      const n = Math.max(1, Math.min(12, Math.round(+o.n) || 6));
      const fol = o.follow != null && cur.some(x => x.key === o.follow) ? o.follow : null;
      const keys = cur.slice(0, n).map(x => x.key);
      if(fol && keys.indexOf(fol) < 0) keys.push(fol);
      const lead = cur[0].key, last = mds[mds.length - 1];
      const ser = keys.map(k => { const T = cur.find(x => x.key === k);
        return { k, T, nm: nameOf(T, o), pts: by.map(b => b[k] ? b[k].pts : 0), role: k === fol ? "f" : k === lead ? "l" : "r" }; });
      const colour = s => s.role === "f" ? COL.gold : s.role === "l" ? COL.ink : COL.rest;
      /* the takeaway: who leads, by how much, after which matchday; and where your club is */
      const a = cur[0], b = cur[1];
      let label = a.pts > b.pts ? nameOf(a, o) + " lead by " + plural(a.pts - b.pts, "point") + " after matchday " + last
        : nameOf(a, o) + " and " + nameOf(b, o) + " are level on " + plural(a.pts, "point") + " after matchday " + last;
      if(fol && fol !== lead){ const F = cur.find(x => x.key === fol); label += "; " + nameOf(F, o) + " are " + ord(F.pos) + " on " + plural(F.pts, "point"); }
      label += ".";
      const desc = "Points after each matchday, " + mds[0] + " to " + last + ". " + ser.map(s => s.nm + ": " + s.pts.join(", ")).join("; ") + ".";

      const H = 214, y0 = 22, y1 = H - 24, x0 = 28;
      const labs = ser.map(s => shortName(s.nm) + " " + s.pts[s.pts.length - 1]);
      const lw = Math.min(118, Math.max(...labs.map(t => tw(t, 12, true))) + 4);
      const x1 = W - lw - 18;
      const mx = Math.max(3, ...ser.map(s => Math.max(...s.pts))), st = niceStep(mx, 4), top = Math.ceil(mx / st) * st;
      const lo = mds[0], X = md => x0 + (md - lo) / Math.max(1, last - lo) * (x1 - x0), Y = v => y1 - v / top * (y1 - y0);
      let g = "", ax = txt(x0 - 6, y0 - 10, "PTS", ' text-anchor="end"');
      for(let v = 0; v <= top; v += st){ g += hline(x0, x1, Y(v), v ? .12 : .3); ax += txt(x0 - 6, Y(v) + 4, String(v), ' text-anchor="end"'); }
      mdTicks(lo, last, X).forEach((md, i) => { ax += txt(X(md), y1 + 16, (i ? "" : "MD ") + md, ' text-anchor="middle"'); });
      g += '<g' + AX + ">" + ax + "</g>";
      /* the rest first, the leader over them, your club on top */
      const order = ser.slice().sort((p, q) => "rlf".indexOf(p.role) - "rlf".indexOf(q.role));
      for(const s of order){
        g += '<path class="mcc-ln" pathLength="1" d="' + s.pts.map((v, i) => (i ? "L" : "M") + n1(X(mds[i])) + " " + n1(Y(v))).join("") + '" fill="none" stroke-width="2"' +
          ' stroke-linejoin="round" stroke-linecap="round" style="stroke:' + colour(s) + '"' + (s.role === "r" ? ' stroke-opacity=".6"' : "") + "/>";
      }
      /* the ends: a dot on each line, the name and points at the right edge, a leader line where a label had to move */
      const ends = spread(order.map(s => ({ s, y: Y(s.pts[s.pts.length - 1]) })), 14, y0 + 2, y1 + 4);
      for(const e of ends){
        if(Math.abs(e.ly - e.y) > 2.5) g += '<path class="mcc-lab" d="M' + n1(x1 + 6) + " " + n1(e.y) + "L" + n1(x1 + 13) + " " + n1(e.ly) + '" stroke="currentColor" stroke-opacity=".4" stroke-width="1" fill="none"/>';
        g += dot(x1, e.y, 4, colour(e.s), "mcc-dot");
        g += '<text class="mcc-lab" x="' + n1(x1 + 16) + '" y="' + n1(e.ly + 4) + '"' + LAB + '><tspan font-weight="' + (e.s.role === "r" ? 600 : 800) + '">' + esc(shortName(e.s.nm)) +
          '</tspan><tspan font-weight="800" dx="4">' + e.s.pts[e.s.pts.length - 1] + "</tspan></text>";
      }
      /* a tap on a matchday: the line through it, a dot on each line, and the points in a small label */
      const half = (x1 - x0) / Math.max(1, last - lo) / 2;
      mds.forEach((md, i) => {
        const cx = X(md), list = ser.map(s => ({ s, v: s.pts[i] })).sort((p, q) => q.v - p.v || "frl".indexOf(p.s.role) - "frl".indexOf(q.s.role));
        const on = tline(cx, y0 - 4, y1) + list.map(r => tdot(cx, Y(r.v), colour(r.s))).join("") +
          tipBox(cx, y0 - 4, "MATCHDAY " + md, list.map(r => [r.s.role === "r" ? COL.rest : colour(r.s), String(r.v), shortName(r.s.nm)]), 0, x1 + 4);
        g += tapG(hitRect(Math.max(x0 - 8, cx - Math.max(half, 6)), y0 - 6, Math.max(half, 6) * 2, y1 - y0 + 12), on);
      });
      o.anim = animate(o, sigOf("race", rows, mds, fol));
      return shell("race", W, H, label, desc, g, o);
    }catch(e){ return ""; }
  }

  /* ---------- the zones: lines, not promises (match-centre-v3.md §3). Pages pass CL_ZONES[comp]: {cl: [1, 2],
     eu: [3, 4], po: [16], down: [17, 18]}, a [from, to] (or a single place) each; {at: [..], label} names one ---------- */
  const ZONE = {
    cl: ["Champions League", "top"], ucl: ["Champions League", "top"], clq: ["CL qualifying", "top2"], cl2: ["CL qualifying", "top2"],
    eu: ["Europe", "mid"], el: ["Europa League", "mid"], uel: ["Europa League", "mid"], ecl: ["Conference League", "mid"], conf: ["Conference League", "mid"],
    up: ["Promotion", "top"], promo: ["Promotion", "top"], top: ["Last 16", "top"], r16: ["Last 16", "top"], direct: ["Last 16", "top"],
    ko: ["Knockout play-off", "mid"], kpo: ["Knockout play-off", "mid"], po: ["Play-off", "low"], playoff: ["Play-off", "low"], pr: ["Play-off round", "mid"],
    down: ["Relegation", "down"], rel: ["Relegation", "down"], out: ["Out", "down"] };
  /* a zone's shading: gold for the top, sage for the next, the ink for the bottom (never red) */
  const TONE = { top: [COL.gold, .2], top2: [COL.gold, .1], mid: [COL.rest, .3], low: [COL.ink, .06], down: [COL.ink, .1] };
  function zonesOf(z, N){
    const out = [];
    if(!z || typeof z !== "object") return out;
    for(const k of Object.keys(z)){
      const v = z[k], at = Array.isArray(v) ? v : v && Array.isArray(v.at) ? v.at : v && Array.isArray(v.pos) ? v.pos : null;
      const ps = (at || []).map(Number).filter(x => isFinite(x) && x >= 1);
      if(!ps.length) continue;
      const info = ZONE[k] || [k.charAt(0).toUpperCase() + k.slice(1), "low"];
      const a = Math.max(1, Math.min(...ps)), b = Math.min(N, Math.max(...ps));
      if(a > N || b < a) continue;
      out.push({ k, a, b, label: String((v && v.label) || info[0]), tone: TONE[(v && v.tone) || info[1]] || TONE.low });
    }
    return out.sort((p, q) => p.a - q.a);
  }

  /* ---------- a club's place by matchday: 1 at the top, the zones shaded ---------- */
  function position(m, key, o){
    try{
      o = opts(o);
      const S = STATS(), rows = rowsOf(m);
      if(!S || !rows || key == null) return "";
      const { mds, by } = history(S, rows);
      if(mds.length < 3) return "";
      const cur = tableOf(m, S, rows), T = cur.find(x => x.key === key), N = cur.length;
      if(!T || N < 2) return "";
      const ps = mds.map((md, i) => by[i][key] ? { md, pos: by[i][key].pos, pts: by[i][key].pts } : null).filter(Boolean);
      if(ps.length < 3) return "";
      const nm = nameOf(T, o), now = ps[ps.length - 1], best = Math.min(...ps.map(p => p.pos)), worst = Math.max(...ps.map(p => p.pos));
      const label = nm + " are " + ord(now.pos) + " after matchday " + now.md + (best !== worst ? "; their highest " + ord(best) + ", their lowest " + ord(worst) : "") + ".";
      const zs = zonesOf(o.zones, N);
      const desc = "Place in the table after each matchday: " + ps.map(p => "matchday " + p.md + ", " + ord(p.pos)).join("; ") + "." +
        (zs.length ? " Shaded: " + zs.map(z => z.label + " " + z.a + (z.b > z.a ? "–" + z.b : "")).join(", ") + "." : "");

      const x0 = 26, x1 = W - 52, y0 = 12, y1 = 176;
      /* the zones' key under the chart, wrapped when it doesn't fit on one line */
      let lx = x0 - 20, ly = y1 + 40, legend = "";
      for(const z of zs){
        const w = 14 + tw(z.label.toUpperCase(), 11) + 12;
        if(lx + w > W && lx > x0 - 20){ lx = x0 - 20; ly += 16; }
        legend += '<rect x="' + n1(lx) + '" y="' + n1(ly - 9) + '" width="10" height="10" rx="2" style="fill:' + z.tone[0] + '" fill-opacity="' + Math.min(1, z.tone[1] * 2.2) + '"/>' +
          txt(lx + 14, ly, z.label.toUpperCase(), AX);
        lx += w;
      }
      let ax = "";
      const H = zs.length ? ly + 8 : y1 + 26;
      const lo = mds[0], last = mds[mds.length - 1];
      const X = md => x0 + (md - lo) / Math.max(1, last - lo) * (x1 - x0), step = (y1 - y0) / Math.max(1, N - 1), Y = p => y0 + (p - 1) * step;
      let g = "";
      for(const z of zs){
        const a = Math.max(y0 - 6, Y(z.a) - step / 2), b = Math.min(y1 + 6, Y(z.b) + step / 2);
        g += '<rect x="' + x0 + '" y="' + n1(a) + '" width="' + (x1 - x0) + '" height="' + n1(Math.max(2, b - a)) + '" style="fill:' + z.tone[0] + '" fill-opacity="' + z.tone[1] + '"/>';
      }
      const ticks = [1];
      for(let p = N <= 20 ? 5 : 10; p < N; p += N <= 20 ? 5 : 10) if((N - p) * step >= 14) ticks.push(p);
      ticks.push(N);
      for(const p of ticks){ g += hline(x0, x1, Y(p), .12); ax += txt(x0 - 6, Y(p) + 4, String(p), ' text-anchor="end"'); }
      mdTicks(lo, last, X).forEach((md, i) => { ax += txt(X(md), y1 + 18, (i ? "" : "MD ") + md, ' text-anchor="middle"'); });
      g += '<g' + AX + ">" + ax + "</g>";
      const c = o.follow != null && o.follow === key ? COL.gold : COL.ink;
      g += '<path class="mcc-ln" pathLength="1" d="' + ps.map((p, i) => (i ? "L" : "M") + n1(X(p.md)) + " " + n1(Y(p.pos))).join("") +
        '" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style="stroke:' + c + '"/>';
      const ex = X(now.md), ey = Y(now.pos);
      g += dot(ex, ey, 4, c, "mcc-dot");
      g += '<text class="mcc-lab" x="' + n1(ex + 9) + '" y="' + n1(ey + 1) + '"' + LAB + ' font-size="13" font-weight="800">' + esc(ord(now.pos).toUpperCase()) + "</text>" +
        txt(ex + 9, ey + 13, plural(now.pts, "PT").toUpperCase(), AX + ' class="mcc-lab"');
      const half = (x1 - x0) / Math.max(1, last - lo) / 2;
      ps.forEach(p => {
        const cx = X(p.md), on = tline(cx, y0 - 6, y1 + 4) + tdot(cx, Y(p.pos), c) +
          tipBox(cx, Math.min(Y(p.pos) + 8, y1 - 34), "MATCHDAY " + p.md, [[null, ord(p.pos), plural(p.pts, "pt")]], 0, W);
        g += tapG(hitRect(Math.max(x0 - 8, cx - Math.max(half, 6)), y0 - 8, Math.max(half, 6) * 2, y1 - y0 + 16), on);
      });
      o.anim = animate(o, sigOf("position", rows, mds, key));
      return shell("position", W, H, label, desc, g + legend, o);
    }catch(e){ return ""; }
  }

  /* ---------- goals: scored to the right, conceded to the left, every club, best goal difference first ---------- */
  function goals(m, o){
    try{
      o = opts(o);
      const S = STATS(), rows = rowsOf(m);
      if(!S || !rows || S.byMatchday(rows).length < 3) return "";
      const list = tableOf(m, S, rows).slice().sort((p, q) => (q.gf - q.ga) - (p.gf - p.ga) || q.gf - p.gf || (p.pos || 0) - (q.pos || 0));
      if(list.length < 2) return "";
      const fol = o.follow != null ? o.follow : null, top = list[0], most = list.slice().sort((p, q) => q.gf - p.gf)[0];
      let label = nameOf(top, o) + " have the best goal difference, " + sgn(top.gf - top.ga) + ": " + top.gf + " scored, " + top.ga + " conceded";
      if(most.key !== top.key) label += "; " + nameOf(most, o) + " have scored the most, " + most.gf;
      const F = fol != null ? list.find(x => x.key === fol) : null;
      if(F && F.key !== top.key && F.key !== most.key) label += "; " + nameOf(F, o) + " " + sgn(F.gf - F.ga);
      label += ".";
      const desc = "Goals scored and conceded, best goal difference first. " + list.map(t => nameOf(t, o) + ": " + t.gf + " scored, " + t.ga + " conceded, " + sgn(t.gf - t.ga)).join("; ") + ".";

      const rh = 17, hy = 22, H = hy + list.length * rh + 6, nx = 6, cx = 200, gx = W - 4, room = 80;
      const mx = Math.max(1, ...list.map(t => Math.max(t.gf, t.ga))), sc = v => v / mx * room;
      let g = '<rect x="' + (cx - 6 - tw("CONCEDED", 11) - 16) + '" y="4" width="9" height="9" rx="2" style="fill:currentColor" fill-opacity=".35"/>' +
        '<rect x="' + (cx + 6) + '" y="4" width="9" height="9" rx="2" style="fill:' + COL.win + '"/>' + vline(cx, hy - 2, H - 4, .3);
      let ax = txt(cx - 6, 12, "CONCEDED", ' text-anchor="end"') + txt(cx + 20, 12, "SCORED") + txt(gx, 12, "GD", ' text-anchor="end"'), vals = "", nm = "", bars = "", taps = "";
      list.forEach((t, i) => {
        const y = hy + i * rh, by = y + 3.5, me = fol != null && t.key === fol, gd = t.gf - t.ga;
        if(me) g += '<rect x="0" y="' + n1(y) + '" width="' + W + '" height="' + rh + '" rx="5" style="fill:' + COL.gold + '" fill-opacity=".2"/>';
        nm += txt(nx, y + 12.5, shortName(nameOf(t, o)), me ? ' font-weight="800"' : "") + txt(gx, y + 12.5, sgn(gd), ' font-weight="800" text-anchor="end"');
        const lc = hbar(cx - 1, by, -sc(t.ga), 10, 4), rc = hbar(cx + 1, by, sc(t.gf), 10, 4);
        if(lc) bars += '<path class="mcc-bar l" d="' + lc + '" style="fill:currentColor" fill-opacity=".35"/>';
        if(rc) bars += '<path class="mcc-bar" d="' + rc + '" style="fill:' + COL.win + '"/>';
        vals += txt(cx - 1 - sc(t.ga) - 4, y + 12, String(t.ga), ' text-anchor="end"') + txt(cx + 1 + sc(t.gf) + 4, y + 12, String(t.gf));
        const p = t.p || 0;
        taps += tapG(hitRect(0, y, W, rh), tipBox(cx + 12, y - 30 < 0 ? y + rh : y - 30, null,
          [[null, plural(p, "game"), p ? f1(t.gf / p) + " scored, " + f1(t.ga / p) + " conceded a game" : ""]], 0, W));
      });
      g += bars + '<g' + AX + ">" + ax + '<g class="mcc-lab">' + vals + "</g></g>" + '<g font-size="12" font-weight="600" fill="currentColor">' + nm + "</g>" + taps;
      o.anim = animate(o, sigOf("goals", rows, S.byMatchday(rows), fol));
      return shell("goals", W, H, label, desc, g, o);
    }catch(e){ return ""; }
  }

  /* ---------- home and away: points a game, home to the left, away to the right ---------- */
  function homeAway(m, key, o){
    try{
      o = opts(o);
      const S = STATS(), rows = rowsOf(m);
      if(!S || !rows || S.byMatchday(rows).length < 3) return "";
      const cur = tableOf(m, S, rows);
      const ppg = s => s.gp ? s.pts / s.gp : null;
      const of = (t, nm) => { const L = S.line(rows, t.key); return { key: t.key, nm, h: ppg(L.home), a: ppg(L.away), hg: L.home.gp, ag: L.away.gp, hp: L.home.pts, ap: L.away.pts }; };
      let list, label, avg = null;
      const played = S.league(rows).filter(S.played);
      if(!played.length) return "";
      if(key != null){
        const T = cur.find(x => x.key === key);
        if(!T) return "";
        const hp = played.reduce((s, x) => s + (x.ft[0] > x.ft[1] ? 3 : x.ft[0] === x.ft[1] ? 1 : 0), 0), ap = played.reduce((s, x) => s + (x.ft[1] > x.ft[0] ? 3 : x.ft[0] === x.ft[1] ? 1 : 0), 0);
        avg = { key: null, nm: "League average", h: hp / played.length, a: ap / played.length, hg: played.length, ag: played.length, avg: true };
        const c = of(T, nameOf(T, o));
        list = [c, avg];
        label = c.nm + " take " + (c.h == null ? "no points yet" : f1(c.h) + " points a game") + " at home and " + (c.a == null ? "none yet" : f1(c.a)) + " away; the league averages " + f1(avg.h) + " and " + f1(avg.a) + ".";
      }else{
        list = cur.slice(0, 8).map(t => of(t, nameOf(t, o)));
        const bh = list.filter(x => x.h != null).sort((p, q) => q.h - p.h)[0], ba = list.filter(x => x.a != null).sort((p, q) => q.a - p.a)[0];
        if(!bh || !ba) return "";
        label = "Of the top eight, " + bh.nm + " take the most points at home, " + f1(bh.h) + " a game, and " + (ba.key === bh.key ? "away too, " : ba.nm + " away, ") + f1(ba.a) + ".";
      }
      const desc = "Points a game at home and away. " + list.map(x => x.nm + ": home " + (x.h == null ? "none played" : f1(x.h)) + ", away " + (x.a == null ? "none played" : f1(x.a))).join("; ") + ".";

      const rh = key != null ? 26 : 22, bh = key != null ? 14 : 12, hy = 22, cx = 210, unit = 32, nx = 6;
      const H = hy + list.length * rh + 26, fol = o.follow != null ? o.follow : null;
      let g = '<rect x="' + (cx - 6 - tw("HOME", 11) - 15) + '" y="4" width="9" height="9" rx="2" style="fill:currentColor"/>' +
        '<rect x="' + (cx + 6) + '" y="4" width="9" height="9" rx="2" style="fill:' + COL.rest + '"/>';
      let ax = txt(cx - 6, 12, "HOME", ' text-anchor="end"') + txt(cx + 20, 12, "AWAY"), vals = "", nm = "", taps = "";
      const yb = hy + list.length * rh;
      for(const k of [1, 2, 3]){ g += vline(cx - k * unit, hy - 2, yb, .12) + vline(cx + k * unit, hy - 2, yb, .12);
        ax += txt(cx - k * unit, yb + 13, String(k), ' text-anchor="middle"') + txt(cx + k * unit, yb + 13, String(k), ' text-anchor="middle"'); }
      g += vline(cx, hy - 2, yb, .3);
      ax += txt(cx, yb + 13, "0", ' text-anchor="middle"') + txt(nx, yb + 13, "PTS A GAME");
      list.forEach((x, i) => {
        const y = hy + i * rh, by = y + (rh - bh) / 2, me = !x.avg && fol != null && x.key === fol, op = x.avg ? ' fill-opacity=".3"' : "";
        if(me) g += '<rect x="0" y="' + n1(y) + '" width="' + W + '" height="' + rh + '" rx="5" style="fill:' + COL.gold + '" fill-opacity=".2"/>';
        nm += txt(nx, by + bh - 1.5, x.avg ? "League average" : shortName(x.nm), me ? ' font-weight="800"' : x.avg ? ' font-weight="500" fill-opacity=".78"' : "");
        const lh = x.h != null ? hbar(cx - 1, by, -x.h * unit, bh, 4) : "", ra = x.a != null ? hbar(cx + 1, by, x.a * unit, bh, 4) : "";
        if(lh) g += '<path class="mcc-bar l" d="' + lh + '" style="fill:currentColor"' + op + "/>";
        if(ra) g += '<path class="mcc-bar" d="' + ra + '" style="fill:' + COL.rest + '"' + op + "/>";
        vals += txt(cx - 1 - (x.h || 0) * unit - 4, by + bh - 2, x.h == null ? "–" : f1(x.h), ' text-anchor="end"') + txt(cx + 1 + (x.a || 0) * unit + 4, by + bh - 2, x.a == null ? "–" : f1(x.a));
        if(!x.avg) taps += tapG(hitRect(0, y, W, rh), tipBox(cx + 14, y - 46 < 0 ? y + rh : y - 46, null,
          [[null, "Home", plural(x.hp, "pt") + " from " + plural(x.hg, "game")], [null, "Away", plural(x.ap, "pt") + " from " + plural(x.ag, "game")]], 0, W));
      });
      g += '<g' + AX + ">" + ax + '<g class="mcc-lab">' + vals + "</g></g>" + '<g font-size="12" font-weight="600" fill="currentColor">' + nm + "</g>" + taps;
      o.anim = animate(o, sigOf("homeAway", rows, S.byMatchday(rows), key));
      return shell("homeaway", W, H, label, desc, g, o);
    }catch(e){ return ""; }
  }

  /* ---------- form: every club's last five, oldest left, newest right. A win green, a draw faint, a defeat the
     ink at 40%; the letter in each, so it never rests on colour ---------- */
  function form(m, o){
    try{
      o = opts(o);
      const S = STATS(), rows = rowsOf(m);
      if(!S || !rows || S.byMatchday(rows).length < 3) return "";
      const cur = tableOf(m, S, rows);
      if(cur.length < 2) return "";
      const fol = o.follow != null ? o.follow : null;
      const res = (x, k) => { const f = x.h.key === k ? x.ft[0] : x.ft[1], a = x.h.key === k ? x.ft[1] : x.ft[0]; return f > a ? "W" : f < a ? "L" : "D"; };
      const P = { W: 3, D: 1, L: 0 };
      const list = cur.map(t => { const gs = S.games(rows, t.key, "all").slice(-5), r = gs.map(x => res(x, t.key)); return { t, nm: nameOf(t, o), gs, r, pts: r.reduce((s, v) => s + P[v], 0) }; });
      const best = list.slice().sort((p, q) => q.pts - p.pts || (p.t.pos || 0) - (q.t.pos || 0))[0];
      let label = "Best form: " + best.nm + ", " + plural(best.pts, "point") + " from their last " + ["no", "one", "two", "three", "four", "five"][best.r.length] + " (" + best.r.join(" ") + ")";
      const F = fol != null ? list.find(x => x.t.key === fol) : null;
      if(F && F !== best) label += "; " + F.nm + ": " + F.r.join(" ");
      label += ".";
      const desc = "Last five results, oldest first, and the points from them. " + list.map(x => x.nm + ": " + (x.r.join(" ") || "none") + ", " + x.pts).join("; ") + ".";

      const rh = 20, hy = 20, H = hy + list.length * rh + 4, px = W - 4, d0 = px - 40 - 4 * 19;
      /* the text attributes sit on groups, once, not on every label: a full league is 90 dots */
      let g = "", ax = txt(d0 + 38, 12, "LAST 5", ' text-anchor="middle"') + txt(px, 12, "PTS", ' text-anchor="end"'), nm = "", dots = "", taps = "";
      list.forEach((x, i) => {
        const y = hy + i * rh, cy = y + rh / 2, me = fol != null && x.t.key === fol;
        if(me) g += '<rect x="0" y="' + n1(y) + '" width="' + W + '" height="' + rh + '" rx="5" style="fill:' + COL.gold + '" fill-opacity=".2"/>';
        ax += txt(20, cy + 4, String(x.t.pos != null ? x.t.pos : i + 1), ' text-anchor="end"');
        nm += txt(28, cy + 4.5, shortName(x.nm), me ? ' font-weight="800"' : "") + txt(px, cy + 4.5, String(x.pts), ' font-weight="800" text-anchor="end"');
        const off = 5 - x.r.length;
        x.r.forEach((r, j) => {
          const dx = d0 + (off + j) * 19, gm = x.gs[j], home = gm.h.key === x.t.key, opp = home ? gm.a : gm.h;
          const f = home ? gm.ft[0] : gm.ft[1], a = home ? gm.ft[1] : gm.ft[0];
          dots += '<circle cx="' + n1(dx) + '" cy="' + n1(cy) + '" r="7.5" style="fill:' + (r === "W" ? COL.win + '"' : 'currentColor" fill-opacity="' + (r === "D" ? ".12" : ".4") + '"') + "/>" +
            '<text x="' + n1(dx) + '" y="' + n1(cy + 3.3) + '"' + (r === "W" ? ' style="fill:' + COL.winInk + '"' : "") + ">" + r + "</text>";
          /* the taps go on a layer of their own, over every dot, so a label is never under the next one; the hit
             area is the grid's full pitch round the dot, 19 by 20 */
          taps += tapG(hitRect(dx - 9.5, y, 19, rh), tipBox(dx, cy - 36 < 0 ? cy + 12 : cy - 36, null,
            [[null, f + "–" + a, (home ? "v " : "at ") + shortName(nameOf(opp, o)) + (gm.md != null ? ", MD " + gm.md : "")]], 0, W));
        });
      });
      g += '<g' + AX + ">" + ax + "</g>" + '<g font-size="12" font-weight="600" fill="currentColor">' + nm + "</g>" +
        '<g font-size="9.5" font-weight="800" text-anchor="middle" fill="currentColor">' + dots + "</g>" + taps;
      o.anim = animate(o, sigOf("form", rows, S.byMatchday(rows), fol));
      return shell("form", W, H, label, desc, g, o);
    }catch(e){ return ""; }
  }

  /* ---------- the sparkline: a club's place by matchday in 80 × 20, no axes, now a gold dot ---------- */
  function sparkline(m, key, o){
    try{
      o = opts(o);
      const S = STATS(), rows = rowsOf(m);
      if(!S || !rows || key == null) return "";
      const { mds, by } = history(S, rows);
      if(mds.length < 3) return "";
      const cur = tableOf(m, S, rows), T = cur.find(x => x.key === key);
      if(!T) return "";
      const ps = mds.map((md, i) => by[i][key] ? { md, pos: by[i][key].pos } : null).filter(Boolean);
      if(ps.length < 3) return "";
      const nm = nameOf(T, o), a = ps[0], z = ps[ps.length - 1];
      const label = nm + " are " + ord(z.pos) + " after matchday " + z.md + (a.pos !== z.pos ? ", " + (z.pos < a.pos ? "up" : "down") + " from " + ord(a.pos) + " after matchday " + a.md : "") + ".";
      const desc = "Place after each matchday: " + ps.map(p => ord(p.pos)).join(", ") + ".";
      /* its own range, but never fewer than five places tall, so a wobble between 2nd and 3rd stays a wobble */
      const N = cur.length, mn = Math.min(...ps.map(p => p.pos)), mx = Math.max(...ps.map(p => p.pos));
      let lo = mn, hi = mx;
      if(hi - lo < 4){ const pad = (4 - (hi - lo)) / 2; lo -= pad; hi += pad; if(lo < 1){ hi += 1 - lo; lo = 1; } if(hi > Math.max(N, 5)){ lo -= hi - Math.max(N, 5); hi = Math.max(N, 5); } }
      const X = i => 3 + i * 72 / Math.max(1, ps.length - 1), Y = p => 3 + (p - lo) / Math.max(1, hi - lo) * 14;
      const g = '<path class="mcc-ln" pathLength="1" d="' + ps.map((p, i) => (i ? "L" : "M") + n1(X(i)) + " " + n1(Y(p.pos))).join("") +
        '" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
        dot(X(ps.length - 1), Y(z.pos), 3, COL.gold, "mcc-dot", 1.5);
      o.anim = animate(o, sigOf("spark", rows, mds, key));
      return shell("spark", 80, 20, label, desc, g, o, ' width="80" height="20"');
    }catch(e){ return ""; }
  }

  /* ---------- the biggest wins: not a chart, a list for the Stats tab (the league's own matches; o.all: every
     round, the qualifiers too) ---------- */
  function bigWins(m, n, o){
    try{
      if(n && typeof n === "object"){ o = n; n = o.n; }
      o = opts(o);
      n = Math.max(1, Math.min(20, Math.round(+n) || 5));
      const S = STATS(), rows = rowsOf(m);
      if(!S || !rows || S.byMatchday(rows).length < 3) return "";
      const pool = (o.all ? rows : S.league(rows)).filter(x => S.played(x) && +x.ft[0] !== +x.ft[1]);
      if(!pool.length) return "";
      const top = pool.slice().sort((p, q) => Math.abs(q.ft[0] - q.ft[1]) - Math.abs(p.ft[0] - p.ft[1]) || (q.ft[0] + q.ft[1]) - (p.ft[0] + p.ft[1]) || (q.ko || 0) - (p.ko || 0)).slice(0, n);
      return '<ol class="mcc-wins" aria-label="The biggest wins this season">' + top.map(x => {
        const d = new Date(x.ko), hw = x.ft[0] > x.ft[1], day = isFinite(d) ? DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] : "";
        return '<li><span class="mcc-wd">' + esc(day) + (x.md != null ? " · MD " + esc(x.md) : "") + '</span><span class="mcc-wm"><span' + (hw ? ' class="w"' : "") + ">" + esc(nameOf(x.h, o)) + "</span><b>" +
          esc(x.ft[0]) + "–" + esc(x.ft[1]) + "</b><span" + (hw ? "" : ' class="w"') + ">" + esc(nameOf(x.a, o)) + "</span></span></li>";
      }).join("") + "</ol>";
    }catch(e){ return ""; }
  }

  /* ---------- the tap: one small label at a time, on and off; nothing else ---------- */
  function mcChartsTap(ev){
    try{
      const el = ev && ev.target;
      if(!el || typeof el.closest !== "function") return;
      const svg = el.closest(".mcc");
      if(!svg) return;
      const t = el.closest(".mcc-t"), was = !!(t && t.hasAttribute("data-on"));
      svg.querySelectorAll(".mcc-t[data-on]").forEach(x => x.removeAttribute("data-on"));
      if(t){ if(!was) t.setAttribute("data-on", ""); if(ev.stopPropagation) ev.stopPropagation(); }
    }catch(e){}
  }

  const API = { race, position, goals, homeAway, form, sparkline, bigWins, shortName, ZONE, tap: mcChartsTap };
  if(root){ root.mcCharts = API; root.mcChartsTap = mcChartsTap; }
  if(typeof module === "object" && module && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : this);
