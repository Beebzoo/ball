/* BALL 4 · CLUB EXPERT: the game (_plans/club-expert.md §1, the rules Martijn accepted; _plans/games-round.md, round 1).

   Pick a club and take its Expert test: 10 multiple choice, Hard, Extreme and Ball only, 20 seconds each, 8 right is a
   pass. Three passes on three different days earn the club's medal. A question from a passed test never comes back, in
   any later test for that club; a failed test's questions may, after the ones you haven't met. Practice is Matchday's
   One club quiz. Loaded by index.html (expNeed) on the first open; the door, the store's load and save and the stubs for
   the Locker and Me are there, next to the Supporter's. A plain script with plain globals, like pl.js.

   THE SHAPE
     - ball4-expert (expertStore, always read fresh): {v, clubs: {slug: {days: {dayKey: right}, used: [ids], medal: dayKey}},
       seen: {slug: [ids]}}. days and used follow the account (assets/sync/sync.js: unions, never a lost pass, and a later
       Fanbase Battle can count clubs and days from them); seen, the questions of failed and abandoned tests, tried last,
       stays on the phone. A club's medal is three days in days, whichever phones they were passed on: medal is only the date.
     - The rules are plain functions of the store (expDeal, expRecord, expState…), so _tests/expert-test.js can run them.
     - EX is the test under way and EXD the last result; neither is saved. A reload is a test abandoned: its questions
       were put on seen as they came up, so reloading to see a kinder test gets you the others first.
     - The clock is the app's (startTimer: a deadline, so going off to look something up costs the seconds it took).
     - The medal is one of the 62 competition medals' family (_brand/competitions): the same rim, ring, disc and slanted
       plate, drawn here as SVG around BALL's generated club patch, never a crest, with the club's name in plain text. */

const EXP_N = 10, EXP_PASS = 8, EXP_DAYS = 3, EXP_SECS = 20, EXP_SEEN_MAX = 120;
const EXP_QUOTA = [["hard", 5], ["extreme", 3], ["ball", 2]];          // the spread where the club allows it, climbing
const EXP_TIER = { hard: "Hard", extreme: "Extreme", ball: "Ball" };
const EXP_LANDS = [["nl", "Netherlands"], ["be", "Belgium"], ["de", "Germany"], ["en", "England"], ["es", "Spain"], ["it", "Italy"], ["pt", "Portugal"], ["sc", "Scotland"]];
/* clubs-identity.json doesn't know these seven (promoted or small, or under another slug in the pools): their colours are
   facts like everyone else's, and BALL's patch draws them. b6SideImg would fall back on the pool's kit colour, which is
   black for Excelsior and missing for OH Leuven */
const EXP_LOOKS = {
  excelsior: { code: "EXC", c1: "#e30613", c2: "#151515", p: "stripes" },
  westerlo: { code: "WES", c1: "#f7d117", c2: "#1f4fa3", p: "plain" },
  "oh-leuven": { code: "OHL", c1: "#ffffff", c2: "#118a3a", p: "plain" },
  "la-louviere": { code: "LAL", c1: "#118a3a", c2: "#ffffff", p: "plain" },
  kortrijk: { code: "KOR", c1: "#e30613", c2: "#ffffff", p: "plain" },
  lommel: { code: "LOM", c1: "#118a3a", c2: "#ffffff", p: "plain" },
  "deportivo-alaves": { code: "ALA", c1: "#0057b8", c2: "#ffffff", p: "stripes" } };

let EX = null, EXD = null, EXP_SLUG = null, EXP_CD = null, EXP_UID = 0;

/* ---------- the rules ---------- */
const expClubOf = (s, slug) => (s.clubs && s.clubs[slug]) || { days: {}, used: [] };
const expDaysOf = c => Object.keys(c.days || {}).map(Number).sort((a, b) => a - b);
const expPasses = c => expDaysOf(c).length;
const expWon = c => expPasses(c) >= EXP_DAYS;
const expMedalDay = c => expWon(c) ? (c.medal || expDaysOf(c)[EXP_DAYS - 1]) : null;
/* what the club's page offers: a test, tomorrow, or the medal */
const expState = (c, today) => expWon(c) ? "medal" : (c.days || {})[today] != null ? "tomorrow" : "open";
const expId = r => r.id || r.q;

/* TEN QUESTIONS FOR THIS CLUB, NOW. Never a row of a passed test; the ones you haven't met before the ones from failed
   tests; five, three and two by tier where that holds, and never two with the same answer while there's a choice, since
   one would give the other away. The test climbs: Hard first, Ball last. Null when the club can't fill a test. */
function expDeal(slug, deck, s, rnd){
  rnd = rnd || Math.random;
  const used = new Set(expClubOf(s, slug).used || []), seen = (s.seen || {})[slug] || [], order = EXP_QUOTA.map(q => q[0]);
  const fresh = {}, again = {};
  for(const t of order){
    const rows = ((deck && deck[t]) || []).filter(r => Array.isArray(r.o) && r.o.length >= 4 && r.k != null && !used.has(expId(r)));
    for(let i = rows.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    fresh[t] = rows.filter(r => !seen.includes(expId(r)));
    again[t] = rows.filter(r => seen.includes(expId(r))).sort((a, b) => seen.indexOf(expId(a)) - seen.indexOf(expId(b)));   // the longest ago first
  }
  const out = [], answers = new Set();
  const have = t => out.filter(r => r.tier === t).length;
  const pull = (t, list, want, loose) => { for(let i = 0; i < list.length && want > 0 && out.length < EXP_N;){
    const r = list[i], a = String(r.a).toLowerCase();
    if(!loose && answers.has(a)){ i++; continue; }
    list.splice(i, 1); out.push(Object.assign({}, r, { tier: t })); answers.add(a); want--; } };
  for(const [t, n] of EXP_QUOTA) pull(t, fresh[t], n);
  for(const t of order) pull(t, fresh[t], EXP_N);
  for(const [t, n] of EXP_QUOTA) pull(t, again[t], n - have(t));
  for(const t of order) pull(t, again[t], EXP_N);
  for(const t of order){ pull(t, fresh[t], EXP_N, true); pull(t, again[t], EXP_N, true); }
  if(out.length < EXP_N) return null;
  return out.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
}
/* on the seen list as they come up, so an abandoned test counts as met */
function expMark(s, slug, ids){
  s.seen = s.seen || {};
  const list = (s.seen[slug] || []).filter(x => !ids.includes(x)).concat(ids);
  s.seen[slug] = list.slice(Math.max(0, list.length - EXP_SEEN_MAX));
}
/* a finished test. A pass books the day and retires its ten questions for good; a fail changes nothing but seen */
function expRecord(s, slug, ids, right, day){
  const pass = right >= EXP_PASS;
  if(!pass){ expMark(s, slug, ids); return { pass, medal: false, passes: expPasses(expClubOf(s, slug)) }; }
  s.clubs = s.clubs || {};
  const c = s.clubs[slug] = Object.assign({ days: {}, used: [] }, s.clubs[slug]), had = expWon(c);
  c.days = Object.assign({}, c.days); c.days[day] = Math.max(c.days[day] | 0, right);
  c.used = [...new Set((c.used || []).concat(ids))];
  if(s.seen && s.seen[slug]) s.seen[slug] = s.seen[slug].filter(x => !ids.includes(x));
  if(expWon(c) && !c.medal) c.medal = expDaysOf(c)[EXP_DAYS - 1];
  return { pass, medal: !had && expWon(c), passes: expPasses(c) };
}
/* your club, on the phone's account or in the Daily's save (fav.club is an identity slug, and the bank's are the same) */
function expFav(){
  let f = null;
  try{ f = (acctLocal().fav || {}).club; }catch(e){}
  if(!f) try{ f = (mine().fav || {}).club; }catch(e){}
  return f && clubExpertReady(bankClub(f)) ? f : null;
}
/* THE PICKER: only clubs at the bar. Your club first, then what you have under way and what you've won, then every country,
   yours first. */
function expPicker(s){
  const rows = BANK_CLUBS.filter(clubExpertReady), fav = expFav();
  const going = rows.filter(r => r[0] !== fav && expPasses(expClubOf(s, r[0]))).sort((a, b) => expPasses(expClubOf(s, b[0])) % EXP_DAYS - expPasses(expClubOf(s, a[0])) % EXP_DAYS).map(r => r[0]);
  const cc = fav ? bankClub(fav)[2] : null;
  const lands = EXP_LANDS.slice().sort((a, b) => (b[0] === cc) - (a[0] === cc))
    .map(([k, name]) => [k, name, rows.filter(r => r[2] === k && r[0] !== fav && !going.includes(r[0])).map(r => r[0])]).filter(l => l[2].length);
  return { fav, going, lands };
}

/* ---------- a club's look ---------- */
function expLook(slug){
  const r = bankClub(slug), name = r ? r[1] : slug;
  return Object.assign({ code: name.slice(0, 3).toUpperCase(), c1: "#123D24", c2: "#F8F1DD", p: "plain" }, clubOf(slug) || EXP_LOOKS[slug] || {}, { name });
}
const expPatchURL = (slug, px) => crestURL(slug, "patch", px, expLook(slug));
const EXP_BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
/* the picker has eighty of these: what isn't drawn yet is filled in a slice per frame, so the page comes up at once */
function expPatch(slug, w, cls){
  const px = w <= 40 ? 96 : w * 3, ready = crestCache.has(slug + "|patch|" + px);
  return '<img class="cxpatch' + (cls ? " " + cls : "") + '" width="' + w + '" height="' + Math.round(w * 7 / 6) + '" alt="" src="' +
    (ready ? expPatchURL(slug, px) : EXP_BLANK) + '"' + (ready ? "" : ' data-cxp="' + slug + '" data-px="' + px + '"') + '>';
}
function expFill(){
  let list; try{ list = [...document.querySelectorAll("img[data-cxp]")]; }catch(e){ return; }
  const step = () => {
    const end = performance.now() + 9;
    while(list.length && performance.now() < end){ const im = list.shift(), u = expPatchURL(im.getAttribute("data-cxp"), +im.getAttribute("data-px")); if(u) im.src = u; im.removeAttribute("data-cxp"); }
    if(list.length) requestAnimationFrame(step);
  };
  step();
}

/* ---------- the medal ---------- */
const EXP_INK = "#0a1f13", EXP_CREAM = "#f4ebd3", EXP_NIGHT = "#0b2416";
const EXP_GOLD = ["#8a6107", "#fff2bf", "#f0c95e", "#c8961f", "#e9b84c", "#fff2bf", "#8a6107"];
const expRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const expHex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
const expMix = (a, b, t) => { const A = expRGB(a), B = expRGB(b); return expHex(A.map((v, i) => v + (B[i] - v) * t)); };
function expLum(h){ const v = expRGB(h).map(x => x / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; }
const expContrast = (a, b) => { const x = expLum(a), y = expLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
/* the colours a club's medal takes: its first colour on the ring (the second when that is white, night when both are),
   deepened as the leagues' are; the darker of the two on the disc, with the other as its kit pattern */
function expTones(L){
  const light = h => expLum(h) > .8, first = !light(L.c1) ? L.c1 : !light(L.c2) ? L.c2 : EXP_NIGHT;
  const ring = expLum(first) > .33 ? first : expMix(first, "#0b1a12", .3);
  const dark = expLum(L.c1) <= expLum(L.c2) ? L.c1 : L.c2, other = dark === L.c1 ? L.c2 : L.c1;
  const base = light(dark) ? EXP_NIGHT : expMix(dark, "#06140c", .34);
  return { ring, ink: expContrast(EXP_CREAM, ring) >= 3 ? EXP_CREAM : EXP_INK, base, kit: other, drop: expLum(ring) > .1 ? (expContrast(ring, "#0b1a12") > 2.4 ? ring : "#e9b84c") : "#e9b84c" };
}
function expKit(L, col){
  const bar = (x, w) => '<rect x="' + x + '" y="30" width="' + w + '" height="196" fill="' + col + '"/>';
  if(L.p === "stripes") return [48, 88, 128, 168, 208].map(c => bar(c - 10, 20)).join("");
  if(L.p === "hoops") return [62, 102, 142, 182].map(y => '<rect x="30" y="' + y + '" width="196" height="20" fill="' + col + '"/>').join("");
  if(L.p === "halves") return bar(128, 98);
  if(L.p === "band") return bar(96, 64);
  if(L.p === "sash") return '<path d="M30 60L60 30L226 196L196 226z" fill="' + col + '"/>';
  return "";
}
const expStarD = (cx, cy, r) => { let d = ""; for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; d += (i ? "L" : "M") + (cx + q * Math.cos(a)).toFixed(2) + " " + (cy + q * Math.sin(a)).toFixed(2); } return d + "z"; };
const expFit = name => Math.min(30, 180 / (String(name).length * .54));
/* o: stars (how many of the three are lit, default all), mute (not won yet: the medal in steel, its stars still lit),
   year (round the bottom of the ring), art (for the share picture: without the text and the patch, the canvas draws those) */
function expMedalSVG(slug, px, o){
  o = o || {};
  const L = expLook(slug), T = expTones(L), C = 128, small = !o.art && px < 96, disc = small ? 112 : 89, id = "cx" + (++EXP_UID) + "-";
  const circle = (r, fill, extra) => '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" fill="' + fill + '"' + (extra || "") + '/>';
  const metal = (name, deg) => { const a = deg * Math.PI / 180, x1 = 50 - 50 * Math.cos(a), y1 = 50 - 50 * Math.sin(a);
    return '<linearGradient id="' + id + name + '" x1="' + x1.toFixed(1) + '%" y1="' + y1.toFixed(1) + '%" x2="' + (100 - x1).toFixed(1) + '%" y2="' + (100 - y1).toFixed(1) + '%">' +
      EXP_GOLD.map((c, i) => '<stop offset="' + (i / (EXP_GOLD.length - 1)).toFixed(2) + '" stop-color="' + c + '"/>').join("") + '</linearGradient>'; };
  const M = "url(#" + id + "m)", MR = "url(#" + id + "r)";
  const stars = o.stars == null ? EXP_DAYS : o.stars;
  let defs = metal("m", 35) + metal("r", 215) + '<clipPath id="' + id + 'c"><circle cx="' + C + '" cy="' + C + '" r="' + disc + '"/></clipPath>' +
    '<radialGradient id="' + id + 'v" cx="44%" cy="38%" r="64%"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".46"/></radialGradient>' +
    '<linearGradient id="' + id + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<radialGradient id="' + id + 'l" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3c4" stop-opacity=".42"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>';
  if(o.mute) defs += '<filter id="' + id + 'g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".04"/><feComponentTransfer><feFuncR type="linear" slope=".86" intercept=".1"/><feFuncG type="linear" slope=".86" intercept=".1"/><feFuncB type="linear" slope=".86" intercept=".11"/></feComponentTransfer></filter>';
  const steel = h => o.mute ? '<g filter="url(#' + id + 'g)">' + h + '</g>' : h;
  let b = circle(125.2, EXP_INK) + circle(124, M) + circle(120.5, MR);
  if(!small){
    b += circle(117, T.ring) + '<g fill="none" stroke="' + (T.ink === EXP_INK ? EXP_INK : EXP_CREAM) + '" stroke-opacity=".32" stroke-width="1" stroke-dasharray="2.4 2.2">' + circle(113.6, "none").replace(' fill="none"', "") + circle(95.4, "none").replace(' fill="none"', "") + '</g>';
    if(!o.art){
      const top = "CLUB EXPERT", bottom = String(o.year || "THREE DAYS"), mid = 104.5, half = s => s.length * 8.7 / 2 / mid + .1;
      const dots = [[-Math.PI / 2, half(top)], [Math.PI / 2, half(bottom)]].map(([a, h]) => [-1, 1].map(sg => '<circle cx="' + (C + mid * Math.cos(a + sg * h)).toFixed(1) + '" cy="' + (C + mid * Math.sin(a + sg * h)).toFixed(1) + '" r="2" fill="' + T.ink + '"/>').join("")).join("");
      defs += '<path id="' + id + 'a" d="M' + (C - 100.2) + ' ' + C + 'A100.2 100.2 0 0 1 ' + (C + 100.2) + ' ' + C + '" fill="none"/><path id="' + id + 'b" d="M' + (C - 108.8) + ' ' + C + 'A108.8 108.8 0 0 0 ' + (C + 108.8) + ' ' + C + '" fill="none"/>';
      const ring = (p, s) => '<text fill="' + T.ink + '" font-family="\'Barlow Semi Condensed\',sans-serif" font-weight="700" font-size="12.2" letter-spacing="2.4"><textPath href="#' + id + p + '" startOffset="50%" text-anchor="middle">' + esc(s) + '</textPath></text>';
      b += ring("a", top) + ring("b", bottom) + dots;
    }
    b += circle(92, M);
  }
  const rays = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6 + .13, w = .11, cy = small ? 118 : 108;
    return '<path d="M' + C + ' ' + cy + 'L' + (C + 190 * Math.cos(a - w)).toFixed(1) + ' ' + (cy + 190 * Math.sin(a - w)).toFixed(1) + 'L' + (C + 190 * Math.cos(a + w)).toFixed(1) + ' ' + (cy + 190 * Math.sin(a + w)).toFixed(1) + 'z"/>'; }).join("");
  b += '<g clip-path="url(#' + id + 'c)">' + circle(disc + 2, T.base) + '<g opacity=".2">' + expKit(L, T.kit) + '</g>' +
    '<g fill="#fff3c4" opacity=".09">' + rays + '</g>' +
    '<g fill="none" stroke="' + EXP_CREAM + '" stroke-opacity=".24" stroke-width="1.6"><circle cx="' + C + '" cy="' + (small ? 118 : 108) + '" r="62"/><path d="M30 ' + (small ? 118 : 108) + 'H226"/></g>' +
    '<ellipse cx="' + C + '" cy="' + (small ? 118 : 108) + '" rx="74" ry="78" fill="url(#' + id + 'l)"/>' + circle(disc, "url(#" + id + "v)") +
    '<ellipse cx="' + C + '" cy="' + (C - disc * .55) + '" rx="' + (disc * .9) + '" ry="' + (disc * .55) + '" fill="url(#' + id + 's)"/></g>';
  if(small) b += circle(disc, "none", ' stroke="' + EXP_INK + '" stroke-opacity=".35" stroke-width="1.5"');
  b = steel(b);
  if(!o.art){
    const pw = small ? 158 : 118, ph = pw * 7 / 6, py = small ? 128 - ph / 2 - 2 : 42, u = expPatchURL(slug, px < 64 ? 96 : px < 150 ? 180 : 330);
    b += u ? '<image x="' + (C - pw / 2) + '" y="' + py + '" width="' + pw + '" height="' + ph.toFixed(1) + '" href="' + u + '"/>'
      : '<circle cx="' + C + '" cy="' + (small ? 124 : 104) + '" r="' + (small ? 66 : 48) + '" fill="' + L.c1 + '" stroke="' + L.c2 + '" stroke-width="5"/>';
  }
  if(!small && !o.art){
    const up = L.name.toUpperCase(), size = expFit(up), h = 34, cy = 174, s = h / 2 * Math.tan(14 * Math.PI / 180), x0 = 33, x1 = 223, yT = cy - h / 2, yB = cy + h / 2;
    const base = cy + size * .35, adj = up.length > 13 ? ' textLength="180" lengthAdjust="spacingAndGlyphs"' : "";
    const t = (dx, fill) => '<text x="' + (C + dx) + '" y="' + (base + dx).toFixed(1) + '" text-anchor="middle" fill="' + fill + '"' + adj + ' font-family="\'Barlow Semi Condensed\',sans-serif" font-weight="900" font-style="italic" font-size="' + size.toFixed(1) + '">' + esc(up) + '</text>';
    b += steel('<path d="M' + (x0 + s + 3) + ' ' + (yB + 3.2) + 'L' + (x1 - s + 3) + ' ' + (yB + 3.2) + 'L' + (x1 + s + 3) + ' ' + (yT + 3.2) + '" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="3"/>' +
      '<path d="M' + (x0 + s) + ' ' + yT + 'L' + (x1 + s) + ' ' + yT + 'L' + (x1 - s) + ' ' + yB + 'L' + (x0 - s) + ' ' + yB + 'z" fill="#0b1a12" stroke="' + M + '" stroke-width="2.6"/>' + t(1.6, T.drop) + t(0, EXP_CREAM));
  }
  let lit = "";
  if(!small) [0, 1, 2].forEach(i => { lit += '<path d="' + expStarD(C + (i - 1) * 20, 204, i === 1 ? 7.4 : 6.2) + '" fill="' + (i < stars ? M : "#000") + '"' + (i < stars ? ' stroke="#5c3f05" stroke-width=".6"' : ' fill-opacity=".34"') + '/>'; });
  return '<svg class="cxmedal" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="' + px + '" height="' + px + '" role="img" aria-label="' + esc(L.name + " Expert medal") + '"><defs>' + defs + '</defs>' + b + lit + '</svg>';
}

/* ---------- the pieces ---------- */
function expPips(c){
  const n = expPasses(c);
  return '<span class="cxpips" role="img" aria-label="' + n + ' of ' + EXP_DAYS + ' passed">' + [0, 1, 2].map(i => '<i' + (i < n ? ' class="on"' : "") + '></i>').join("") + '</span>';
}
const expDayLabel = k => { const d = new Date(Math.floor(k / 1e4), Math.floor(k / 100) % 100 - 1, k % 100); return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
const expDayLong = k => { const d = new Date(Math.floor(k / 1e4), Math.floor(k / 100) % 100 - 1, k % 100); return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };
/* the three days: what's done with its date and score, then today or tomorrow, then what's after that */
function expPath(c, today, fresh){
  const days = expDaysOf(c), st = expState(c, today);
  const cell = i => {
    const k = days[i];
    if(k != null) return '<div class="cxday done' + (k === fresh ? " new" : "") + '"><i>' + ico("check") + '</i><b>' + esc(expDayLabel(k)) + '</b><small>' + c.days[k] + ' of ' + EXP_N + '</small></div>';
    const next = i === days.length;
    return '<div class="cxday' + (next ? " next" : "") + '"><i>' + (i + 1) + '</i><b>' + (next ? (st === "tomorrow" ? "Tomorrow" : "Today") : "Another day") + '</b><small>' + ["First pass", "Second pass", "The medal"][i] + '</small></div>';
  };
  return '<div class="cxpath" role="list">' + [0, 1, 2].map(cell).join("") + '</div>';
}
function expCountdown(){ return '<span id="cxcd">' + (typeof threeClock === "function" ? threeClock() : "") + '</span>'; }
/* tomorrow's test, to the second; at midnight the page redraws and it's open */
function expClockTick(){
  if(EXP_CD) return;
  const day0 = dayKey();
  try{ EXP_CD = setInterval(() => { const el = document.getElementById("cxcd");
    if(!el){ clearInterval(EXP_CD); EXP_CD = null; return; }
    if(dayKey() !== day0){ clearInterval(EXP_CD); EXP_CD = null; if(EXP_VIEW) render(); return; }
    el.textContent = threeClock(); }, 1000); }catch(e){}
}

/* ---------- the picker ---------- */
function expTile(slug, s){
  const c = expClubOf(s, slug), won = expWon(c), L = expLook(slug);
  return '<button class="cxtile' + (won ? " won" : "") + '" onclick="expPick(\'' + slug + '\')" aria-label="' + esc(L.name + (won ? ", Expert medal" : ", " + expPasses(c) + " of " + EXP_DAYS + " passed")) + '">' +
    '<span class="cxtart">' + (won ? expMedalSVG(slug, 46) : expPatch(slug, 36)) + '</span><span class="cxtn"><b>' + esc(L.name) + '</b>' + (won ? '<small>Expert</small>' : expPips(c)) + '</span></button>';
}
function expHero(slug, s){
  const c = expClubOf(s, slug), won = expWon(c), st = expState(c, dayKey()), L = expLook(slug);
  const line = won ? "Expert since " + expDayLong(expMedalDay(c)) : st === "tomorrow" ? "Passed today. Back tomorrow." : expPasses(c) ? expPasses(c) + " of " + EXP_DAYS + " passed. Today’s test is open." : "Three passes for the medal.";
  return '<button class="cxhero" onclick="expPick(\'' + slug + '\')">' + (won ? expMedalSVG(slug, 74) : expPatch(slug, 62)) +
    '<span class="cxhm"><small>Your club</small><b>' + esc(L.name) + '</b><em>' + esc(line) + '</em>' + (won ? "" : expPips(c)) + '</span><span class="cxgo" aria-hidden="true">›</span></button>';
}
function expPickHTML(){
  const s = expertStore(), P = expPicker(s), won = BANK_CLUBS.filter(r => expWon(expClubOf(s, r[0]))).length;
  const grid = list => '<div class="cxgrid">' + list.map(k => expTile(k, s)).join("") + '</div>';
  const league = k => compBadge(CLUB_LEAGUE[k], 26) || "";
  return b4Page({ title: "Club Expert", ctx: won ? won + (won === 1 ? " medal" : " medals") : "Know your club", back: "expBack()", cls: "cxpage cx-pick", body:
    '<p class="cxlead">Ten hard questions, eight to pass. Do it on three different days and the club’s medal is yours.</p>' +
    (P.fav ? expHero(P.fav, s) : "") +
    (P.going.length ? '<div class="b6hdr cxh">Your clubs</div>' + grid(P.going) : "") +
    P.lands.map(([k, name, list]) => '<div class="b6hdr cxh">' + league(k) + esc(name) + '<span>' + list.length + '</span></div>' + grid(list)).join("") });
}

/* ---------- a club's page ---------- */
const expShowBtn = (slug, c) => '<button class="cxshow won" onclick="expMedalSheet(\'' + slug + '\')" aria-label="' + esc(expLook(slug).name + " Expert medal") + '">' + expMedalSVG(slug, 216, { year: String(expMedalDay(c)).slice(0, 4) }) + '</button>';
function expClubHTML(slug){
  const s = expertStore(), c = expClubOf(s, slug), today = dayKey(), st = expState(c, today), L = expLook(slug), id = "club-" + slug, won = st === "medal";
  needQuiz(id);
  const deck = DECKS[id + "-mc"], n = expPasses(c);
  let act;
  if(won){ act = b4Btn("Share the medal", "expShare('" + slug + "')", "gold") + b4Btn("Pick another club", "expBack()", "dark"); expPic(slug); }
  else if(st === "tomorrow") act = '<div class="cxnext"><small>Passed today. Come back tomorrow</small><b>' + expCountdown() + '</b></div>' + b4Btn("Pick another club", "expBack()", "dark");
  else if(!deck) act = '<button class="b4btn gold" disabled>Loading the questions…</button>';
  else act = b4Btn("Take the test", "expStart('" + slug + "')", "gold");
  return b4Page({ title: "Club Expert", ctx: L.name, back: "expBack()", cls: "cxpage cx-club", body:
    (won ? expShowBtn(slug, c) : '<div class="cxshow">' + expMedalSVG(slug, 216, { stars: n, mute: true }) + '</div>') +
    (won ? '<p class="cxwon"><b>' + esc(L.name) + ' Expert</b>Since ' + esc(expDayLong(expMedalDay(c))) + '</p>' : "") +
    expPath(c, today) +
    (won ? "" : '<div class="cxrules"><span><b>' + EXP_N + '</b>questions</span><span><b>' + EXP_SECS + '</b>seconds each</span><span><b>' + EXP_PASS + '</b>to pass</span></div>' +
      '<p class="cxlead">Hard, Extreme and Ball. A question from a passed test never comes back.</p>') +
    act + b4Btn("Practise with One club ›", "expPractise('" + slug + "')", "quiet") });
}

/* ---------- the test ---------- */
function expTestHTML(){
  const Q = EX.rows[EX.i], L = expLook(EX.slug), shown = EX.shown;
  const pip = i => '<i class="' + (i < EX.picks.length ? (EX.picks[i] ? "hit" : "miss") : i === EX.i ? "cur" : "") + (i === EXP_PASS - 1 ? " mark" : "") + '"></i>';
  const opts = Q.o.map((t, i) => '<button class="h2opt' + (shown ? (i === Q.k ? " right" : i === EX.pick ? " wrong" : " dim") : "") + '"' + (shown ? " disabled" : "") + ' onclick="expAnswer(' + i + ')"><span class="k">' + "ABCD"[i] + '</span>' + esc(String(t)) + '</button>').join("");
  return b4Page({ title: L.name, ctx: "Question " + (EX.i + 1) + " of " + EXP_N, back: "expAskLeave()", leave: "expAskLeave()", cls: "cxpage cx-test", body:
    '<span hidden data-cxk="' + expTestKey() + '"></span>' +
    '<div class="cxbar"><div class="cxten" role="img" aria-label="' + EX.right + ' right so far, ' + EXP_PASS + ' to pass">' + Array.from({ length: EXP_N }, (_, i) => pip(i)).join("") + '</div>' +
      (shown ? '<div class="clock cxclock cxstop"><div class="bar"><i style="width:' + Math.round(100 * Math.max(0, EX.left) / EXP_SECS) + '%"></i></div><div class="digits">' + Math.max(0, EX.left).toFixed(1) + '</div></div>'
        : '<div class="clock cxclock" id="clock" role="timer"><div class="bar"><i style="width:100%"></i></div><div class="digits">' + EXP_SECS + '.0</div></div>') + '</div>' +
    '<div class="qcard cxq' + (shown ? "" : " qin") + '"><div class="cxtier ' + Q.tier + '">' + EXP_TIER[Q.tier] + '</div><div class="qtext">' + esc(String(Q.q)) + '</div><div class="cxopts">' + opts + '</div>' +
      (shown ? '<div class="cxsay">' + esc(EX.say) + '</div>' : "") + '</div>' +
    (shown ? '<div class="cxnextq">' + b4Btn(EX.i + 1 < EXP_N ? "Next question" : "See how you did", "expNext()", "gold") + '</div>' : "") });
}
const expTestKey = () => EX.i + (EX.shown ? "s" : "q");
function expShow(){
  const Q = EX.rows[EX.i];
  EX.shown = false; EX.pick = null; EX.say = "";
  const s = expertStore(); expMark(s, EX.slug, [expId(Q)]); expertSave(s);
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  startTimer(EXP_SECS, expTimeUp, "expert:" + EX.slug + ":" + EX.i);
}
function expAnswer(i){
  if(!EX || EX.shown) return;
  audio();
  EX.left = Math.max(0, (T.deadline - performance.now()) / 1000);
  stopTimer();
  expReveal(i);
}
function expTimeUp(){ if(!EX || EX.shown) return; EX.left = 0; stopTimer(); expReveal(-1); }
function expReveal(i){
  const Q = EX.rows[EX.i], ok = i === Q.k;
  EX.shown = true; EX.pick = i; EX.picks.push(ok);
  if(ok) EX.right++;
  try{ progAnswer({ ok, tier: Q.tier, topic: topicKey("club-" + EX.slug) || "general" }); }catch(e){}
  try{ if(ok) fb.correct(null); else if(i >= 0) fb.wrong(null); else fb.run = 0; }catch(e){}
  const miss = EX.picks.filter(x => !x).length, gone = !ok && miss === EXP_N - EXP_PASS + 1;
  EX.say = ok ? "Right. " + EX.right + " of " + EX.picks.length + " so far." : (i < 0 ? "Out of time." : fb.word()) +
    (gone ? " Eight’s out of reach now. Play on for the practice, or leave it here." : "");
  try{ a11ySay(EX.say); }catch(e){}
  render();
}
function expNext(){
  if(!EX || !EX.shown) return;
  audio();
  EX.i++;
  if(EX.i >= EX.rows.length) return expFinish();
  expShow();
}
function expFinish(){
  const { slug, rows, right, picks } = EX, s = expertStore(), day = dayKey(), R = expRecord(s, slug, rows.map(expId), right, day);
  expertSave(s);
  try{ progSave(progLoad()); }catch(e){}
  try{ tlmEvent("expert_done", { right, pass: R.pass ? 1 : 0, medal: R.medal ? 1 : 0 }); }catch(e){}
  EXD = { slug, right, picks, pass: R.pass, medal: R.medal, passes: R.passes, day };
  EX = null; EXP_VIEW = "done";
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  if(R.medal) return expMoment(slug);
  if(R.pass) try{ celebrate(3, { type: "expertPass", n: 60 }); ching(); }catch(e){}
}
function expAskLeave(){
  audio();
  sheet('<h2>Leave the test?</h2><p>It won’t count, and the questions you’ve seen may come back in another test.</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep going</button><button class="b4btn quiet" onclick="expLeave()">Leave</button>');
}
function expLeave(){
  audio(); stopTimer();
  const slug = EX ? EX.slug : EXP_SLUG;
  try{ progSave(progLoad()); }catch(e){}
  EX = null; EXP_SLUG = slug; EXP_VIEW = "club"; closeSheet(); render();
}
/* the line under a revealed question reports this question, not whatever Matchday has parked */
function expQrep(){
  if(!EX || !EX.shown) return null;
  const Q = EX.rows[EX.i], anchor = document.querySelector("#stage .cxq");
  return Q && anchor ? { q: Q.q, a: Q.o[Q.k], deck: "club-" + EX.slug, tier: Q.tier, anchor } : null;
}

/* ---------- the result ---------- */
function expDoneHTML(){
  const D = EXD, s = expertStore(), c = expClubOf(s, D.slug), L = expLook(D.slug), left = EXP_DAYS - D.passes, won = expWon(c);
  const ten = '<div class="cxten big" role="img" aria-label="' + D.right + ' of ' + EXP_N + ' right">' + D.picks.map(ok => '<i class="' + (ok ? "hit" : "miss") + '"></i>').join("") + '</div>';
  const score = b4Score({ home: { name: L.name, color: L.c1 === "#ffffff" ? L.c2 : L.c1, flag: expPatchURL(D.slug, 120) }, score: D.right + "/" + EXP_N, label: D.pass ? "Pass " + Math.min(D.passes, EXP_DAYS) + " of " + EXP_DAYS : "Eight to pass" });
  let body;
  if(won && D.pass){
    body = b4Q(esc(L.name) + " Expert", "Three passes on three different days. It’s yours.") + expShowBtn(D.slug, c) + ten + expPath(c, D.day, D.day) +
      b4Btn("Share the medal", "expShare('" + D.slug + "')", "gold") + b4Btn("Pick another club", "expBackAll()", "dark");
  } else if(D.pass){
    body = b4Q("Passed", D.right + " of " + EXP_N + ". " + (left === 1 ? "One more day and the medal is yours." : "Two more days and the medal is yours.")) + ten + expPath(c, D.day, D.day) +
      '<div class="cxnext"><small>Come back tomorrow</small><b>' + expCountdown() + '</b></div>' +
      '<p class="cxlead">These ten are gone for good. Tomorrow’s test is all new questions.</p>' + b4Btn("Pick another club", "expBackAll()", "gold") + b4Btn("Back to " + esc(L.name), "expBack()", "quiet");
  } else {
    const short = EXP_PASS - D.right;
    body = b4Q("Not this time", D.right + " of " + EXP_N + ", " + (short === 1 ? "one short." : short + " short.") + " No harm done: try again whenever you like.") + ten + expPath(c, D.day) +
      b4Btn("Try again", "expStart('" + D.slug + "')", "gold") + b4Btn("Practise with One club", "expPractise('" + D.slug + "')", "dark") + b4Btn("Back to " + esc(L.name), "expBack()", "quiet");
  }
  return b4Page({ title: "Club Expert", ctx: L.name, back: "expBack()", score, cls: "cxpage cx-done", body });
}
/* THE THIRD PASS: the medal is struck, in front of everything, and it stays on the page behind when you close this */
function expMoment(slug){
  const c = expClubOf(expertStore(), slug), L = expLook(slug), o = document.createElement("div");
  o.className = "pgmoment cxmoment";
  o.innerHTML = '<div class="pgm-in"><div class="cxstrike"><i class="cxrays" aria-hidden="true"></i>' + expMedalSVG(slug, 248, { year: String(expMedalDay(c)).slice(0, 4) }) + '<i class="cxshine" aria-hidden="true"></i></div>' +
    '<span class="pgm-k">Club Expert</span><h2>' + esc(L.name) + ' Expert</h2><p>Three passes on three different days. Thirty questions, and not one of them twice.</p>' +
    '<button class="b6cta" onclick="expShare(\'' + slug + '\')">Share the medal</button><button class="b6dark" onclick="expMomentClose(this)">Done</button></div>';
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add("on"));
  try{ celebrate(4, { type: "expertMedal", n: 170 }); slamfx(); haptic("goal"); }catch(e){}
  expPic(slug);
}
function expMomentClose(btn){ audio(); const o = btn.closest(".pgmoment"); if(o){ o.classList.remove("on"); setTimeout(() => o.remove(), 260); } }

/* ---------- getting about ---------- */
function expPick(slug){ audio(); try{ haptic("select"); }catch(e){} EXP_SLUG = slug; EXP_VIEW = "club"; render(); try{ window.scrollTo(0, 0); }catch(e){} }
function expStart(slug){
  audio();
  const s = expertStore(), deck = DECKS["club-" + slug + "-mc"];
  if(expState(expClubOf(s, slug), dayKey()) !== "open") return render();
  if(!deck){ needQuiz("club-" + slug); return toast("Those questions are still loading, give it a second", true); }
  const rows = expDeal(slug, deck, s);
  if(!rows) return toast("We’re short of questions for this club. Try another one.", true);
  try{ wakeLock(); }catch(e){}
  EX = { slug, rows, i: 0, picks: [], right: 0, shown: false, pick: null, say: "", left: EXP_SECS };
  EXP_SLUG = slug; EXP_VIEW = "test";
  expShow();
}
function expClose(){
  const from = EXP_FROM;
  EXP_VIEW = null; EXP_SLUG = null; EXD = null; EX = null;
  if(from === "locker") return openLocker();
  if(from === "me") return openMe();
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function expBack(){
  audio();
  try{ document.querySelectorAll(".cxmoment").forEach(e => e.remove()); }catch(e){}
  if(EXP_VIEW === "done"){ EXP_VIEW = "club"; EXD = null; render(); return; }
  if(EXP_VIEW === "club"){ EXP_VIEW = "pick"; render(); try{ feelScrollBack("expert:pick"); }catch(e){} return; }
  expClose();
}
function expBackAll(){ audio(); EXD = null; EXP_VIEW = "pick"; render(); try{ feelScrollBack("expert:pick"); }catch(e){} }
/* Practice is Matchday's One club: "Which questions?" with this club chosen */
function expPractise(slug){
  audio();
  const id = "club-" + slug, Q = QUIZZES[id];
  EXP_VIEW = null; EX = null; EXD = null;
  b4QOwn = true; b4QView = "club"; b4QClub = id;
  needQuiz(id); needPool(Q.pool);
  if(TEAMS[Q.pool]) return b4StartPitch(Q.pool, Q.league);
  render();
  toast("Still loading those squads, give it a second", true);
}

/* ---------- the medals elsewhere ---------- */
const expWonList = s => BANK_CLUBS.map(r => r[0]).filter(k => expWon(expClubOf(s, k))).sort((a, b) => expMedalDay(expClubOf(s, b)) - expMedalDay(expClubOf(s, a)));
function expShelfHTML(){
  const s = expertStore();
  return '<div class="lkshelf cxshelf">' + expWonList(s).map(k => '<button class="lktro cxm" onclick="expMedalSheet(\'' + k + '\')" aria-label="' + esc(expLook(k).name + " Expert medal") + '">' + expMedalSVG(k, 66) + '<b>' + esc(expLook(k).name) + '</b><span>EXPERT</span></button>').join("") + '<i class="lkplank"></i></div>';
}
function expMeHTML(){
  const s = expertStore(), list = expWonList(s), n = list.length;
  return '<div class="b6hdr cxmeh">Expert medals<button onclick="openExpert(\'me\')">Club Expert ›</button></div><div class="cxmerow">' + list.slice(0, 5).map(k => '<button onclick="expMedalSheet(\'' + k + '\')" aria-label="' + esc(expLook(k).name + " Expert medal") + '">' + expMedalSVG(k, 56) + '</button>').join("") +
    (n > 5 ? '<button class="cxall" onclick="openLocker()">All ' + n + ' ›</button>' : "") + '</div>';
}
function expMedalSheet(slug){
  audio();
  const c = expClubOf(expertStore(), slug), L = expLook(slug);
  if(!expWon(c)) return;
  expPic(slug);
  sheet('<div class="cxsheet">' + expMedalSVG(slug, 220, { year: String(expMedalDay(c)).slice(0, 4) }) + '<h2>' + esc(L.name) + ' Expert</h2><p>Passed on ' + esc(expDaysOf(c).slice(0, EXP_DAYS).map(expDayLabel).join(", ")) + '.</p>' +
    b4Btn("Share", "expShare('" + slug + "')", "gold") + b4Btn("Close", "closeSheet()", "quiet") + '</div>');
}

/* ---------- the share ---------- */
function expShareText(slug){
  return "BALL · " + expLook(slug).name + " Expert, 3 of 3\nThree tests on three different days, never the same question twice.\nHow well do you know your club?\nballquiz.app";
}
/* the medal for the picture: the SVG's rim, ring and disc, then the patch, the plate and the lettering on the canvas, since
   text in an SVG image can't use the page's fonts */
function expArc(x, str, cx, cy, r, top, size, track, ink){
  x.font = "700 " + size + "px 'Barlow Semi Condensed', sans-serif"; x.fillStyle = ink; x.textAlign = "center"; x.textBaseline = "alphabetic";
  const ch = [...str], ws = ch.map(k => x.measureText(k).width + track), total = ws.reduce((a, b) => a + b, 0) - track;
  let a = top ? -Math.PI / 2 - total / 2 / r : Math.PI / 2 + total / 2 / r;
  ch.forEach((k, i) => { const w = (ws[i] - track) / 2 / r, m = top ? a + w : a - w;
    x.save(); x.translate(cx + r * Math.cos(m), cy + r * Math.sin(m)); x.rotate(top ? m + Math.PI / 2 : m - Math.PI / 2); x.fillText(k, 0, 0); x.restore();
    a += (top ? 1 : -1) * ws[i] / r; });
}
function expImage(src){ return new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; }); }
async function expCanvas(slug){
  if(typeof document === "undefined" || !document.createElement) return null;
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const x = c.getContext && c.getContext("2d"); if(!x) return null;
  const S = expertStore(), rec = expClubOf(S, slug), L = expLook(slug), T = expTones(L), year = String(expMedalDay(rec) || dayKey()).slice(0, 4);
  x.fillStyle = "#efe4c8"; x.fillRect(0, 0, 1080, 1350);
  /* the band, the house's grass when it's on the phone */
  x.save(); x.beginPath(); x.moveTo(0, 0); x.lineTo(1080, 0); x.lineTo(1080, 214); x.lineTo(0, 268); x.closePath(); x.clip();
  x.fillStyle = "#123D24"; x.fillRect(0, 0, 1080, 300);
  const grass = await expImage("assets/grass-match@2x.jpg");
  if(grass){ x.drawImage(grass, 0, 0, 1080, 1080 * grass.height / grass.width); x.fillStyle = "rgba(5,20,10,.42)"; x.fillRect(0, 0, 1080, 300); }
  x.restore();
  x.textAlign = "center"; x.fillStyle = "#c99a2e"; x.font = "italic 900 104px 'Barlow Semi Condensed', sans-serif"; x.fillText("CLUB EXPERT", 544, 138);
  x.fillStyle = "#F8F1DD"; x.fillText("CLUB EXPERT", 540, 134);
  /* the medal, a 256 box scaled to 800 */
  const size = 800, mx = 140, my = 262, k = size / 256, C = 128, svg = expMedalSVG(slug, size, { art: true, stars: EXP_DAYS });
  const im = await expImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  x.save(); x.shadowColor = "rgba(18,61,36,.4)"; x.shadowBlur = 46; x.shadowOffsetY = 20; if(im) x.drawImage(im, mx, my, size, size); x.restore();
  x.save(); x.translate(mx, my); x.scale(k, k);
  expArc(x, "CLUB EXPERT", C, C, 100.2, true, 12.2, 2.4, T.ink); expArc(x, year, C, C, 108.8, false, 12.2, 2.4, T.ink);
  const patch = document.createElement("canvas");
  try{ if(typeof Crests !== "undefined") Crests.patch(patch, clubOf(slug) || L, { size: 600 }); }catch(e){}
  if(patch.width > 300) x.drawImage(patch, C - 59, 42, 118, 118 * 7 / 6);
  const up = L.name.toUpperCase(), h = 34, cy = 174, s = h / 2 * Math.tan(14 * Math.PI / 180), x0 = 33, x1 = 223, yT = cy - h / 2, yB = cy + h / 2;
  x.beginPath(); x.moveTo(x0 + s, yT); x.lineTo(x1 + s, yT); x.lineTo(x1 - s, yB); x.lineTo(x0 - s, yB); x.closePath();
  const g = x.createLinearGradient(30, 60, 226, 200); EXP_GOLD.forEach((col, i) => g.addColorStop(i / (EXP_GOLD.length - 1), col));
  x.fillStyle = "#0b1a12"; x.fill(); x.strokeStyle = g; x.lineWidth = 2.6; x.stroke();
  const fs = expFit(up), base = cy + fs * .35; x.textAlign = "center"; x.font = "italic 900 " + fs + "px 'Barlow Semi Condensed', sans-serif";
  const wide = Math.min(1, 180 / x.measureText(up).width);
  x.save(); x.translate(C, 0); x.scale(wide, 1); x.fillStyle = T.drop; x.fillText(up, 1.6, base + 1.6); x.fillStyle = EXP_CREAM; x.fillText(up, 0, base); x.restore();
  x.restore();
  x.fillStyle = "#123D24"; x.font = "italic 900 58px 'Barlow Semi Condensed', sans-serif"; x.fillText(L.name.toUpperCase() + " EXPERT, 3 OF 3", 540, 1158);
  x.fillStyle = "#3d4a38"; x.font = "italic 400 33px Lora, Georgia, serif"; x.fillText("Three tests on three different days", 540, 1212);
  x.fillStyle = "#4f6b56"; x.font = "700 32px 'Barlow Semi Condensed', sans-serif"; x.fillText("ballquiz.app", 540, 1290);
  return c;
}
/* the picture is drawn ahead of the tap: a share sheet has to open straight from it, and Safari won't wait for images */
const EXP_PIC = {};
function expPic(slug){
  return EXP_PIC[slug] || (EXP_PIC[slug] = expCanvas(slug).then(c => c && c.toBlob ? new Promise(ok => c.toBlob(ok, "image/png")) : null).catch(() => null));
}
async function expShare(slug){
  audio();
  try{ tlmEvent("share", { what: "expert" }); }catch(e){}
  const text = expShareText(slug), blob = await expPic(slug);
  try{ if(blob && typeof File === "function" && navigator.canShare){
    const file = new File([blob], "club-expert-" + slug + ".png", { type: "image/png" });
    if(navigator.canShare({ files: [file] })) return navigator.share({ files: [file], text }).catch(() => {}); } }catch(e){}
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}

/* ---------- the screen ---------- */
function expRender(st){
  /* a deck landing while a question is up calls render(): the question stays where it is, focus and clock with it */
  if(EXP_VIEW === "test" && EX){ try{ if(st.querySelector("[data-cxk='" + expTestKey() + "']")){ b6Paper(true); return; } }catch(e){} }
  if(EXP_VIEW === "test" && !EX) EXP_VIEW = EXP_SLUG ? "club" : "pick";
  if(EXP_VIEW === "done" && !EXD) EXP_VIEW = EXP_SLUG ? "club" : "pick";
  if(EXP_VIEW === "club" && !EXP_SLUG) EXP_VIEW = "pick";
  st.innerHTML = EXP_VIEW === "test" ? expTestHTML() : EXP_VIEW === "done" ? expDoneHTML() : EXP_VIEW === "club" ? expClubHTML(EXP_SLUG) : expPickHTML();
  if(EXP_VIEW === "pick"){ expFill(); if(!CLUBID) setTimeout(() => { if(EXP_VIEW === "pick") render(); }, 600); }
  if(document.getElementById && document.getElementById("cxcd")) expClockTick();
}
