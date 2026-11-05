/* BALL 4 · WORLD TOUR: the game (_plans/games-round.md, round 4). "A stamp per country, won by beating its league deck."

   A passport that fills up, and a reason to learn football outside your own country. Every country the bank knows well enough is a stop.
   Ten multiple-choice questions, twenty seconds each, seven right wins the stamp. A miss costs nothing. Stamp a whole region and its page
   gets a gold visa; stamp them all and you're a Citizen of the World. No XP: this one is for the passport. Loaded by index.html (tourNeed) on
   the first open; the door, the store's load and save and the shelf's line are there, next to Time Machine's. A plain script with plain
   globals, like timemachine.js.

   THE MAP
     - The stops are worked out at load from assets/q/manifest.json, never typed in. Every league and nation deck has a cc; a country's stop
       is its decks together, the league with the most questions first, then its other league, then the national team.
     - THE RULE: a country is a stop when its decks hold TOUR_BAR multiple-choice questions, four tests without meeting one twice. Under
       the bar it simply isn't on the map yet. The day the bank grows past it, the manifest says so and it's there, in its region, with no
       code change: its name comes from its nation deck or the phone, its region from TOUR_REGIONS' list of the rest of the world, its
       flag from assets/natflags. A stop that made the bar and then can't deal is _tests/tour-test.js's to catch, on the real decks.
     - Regions are NATS's five, so the app has one way of grouping countries; NATS holds the countries with a national deck and TOUR_REGIONS
       the rest. Your own region and your own country come first, and a region of more than nine runs over two pages.

   THE SHAPE
     - ball4-tour (tourStore, always read fresh): {v, stamps: {cc: {t, n}}, visas: {region: t}, title: t, best: {cc: right}, runs: {cc: n}, total,
       seen: [ids]}. t is when, n the best score since. All plain data. Everything but seen follows the account (assets/sync/sync.js),
       and a stamp can't be lost: it's a union, and a stamp both phones won keeps the earlier date. seen stays on the phone.
     - A stamp's look isn't stored. Shape, tilt and ink are a hash of the country, so a stamp is the same on every phone for ever.
     - The rules are plain functions of the store and the decks (tourStopsFrom, tourDeal, tourRecord, tourWhere…), so the test can run them.
     - TOUR is the test under way and TOURD the last result; neither is saved. A reload is a test abandoned: its questions went on seen
       as they came up, so reloading to get kinder ones gets you the others.
     - A deck comes straight from assets/q/ (bankDecks, then qrRetier), like Time Machine's, and all of a stop's decks load at the tap.
     - The clock is the app's (startTimer). A right answer moves on by itself; a wrong one waits for a tap, because that's when the
       bank's fact is worth reading: it's most of what this game is for. */

const TOUR_N = 10, TOUR_PASS = 7, TOUR_SECS = 20, TOUR_BAR = 40, TOUR_SEEN_MAX = 500, TOUR_RIGHT_MS = 720, TOUR_PER_PAGE = 9;
const TOUR_DROP_MS = 520, TOUR_HIT_MS = 250, TOUR_VISA_MS = 760;
const TOUR_TIERS = ["easy", "normal", "hard", "extreme", "ball"];
const TOUR_LETTER = { e: "easy", n: "normal", h: "hard", x: "extreme", b: "ball" };
/* A CLIMB, not a wall: three Easy and three Normal get you to six, so a stamp asks for one Hard. That's a fair ask of a fan from the other side of
   the world, and enough of an ask that you'll have learned something by the time you get it. */
const TOUR_PLAN = "eeennnhhhx";
const TOUR_TITLE = "Citizen of the World";

/* NATS's five regions, in NATS's order. more is the rest of the world, the countries with no national deck yet, so one that joins the bank
   lands on the right page with no code change. A code is a manifest cc: England and Scotland are their own. */
const TOUR_REGIONS = [
  { id: "europe", name: "Europe", short: "Europe",
    more: "scotland cz pl gr tr wales northern-ireland republic-of-ireland ie se fi is ro bg hu sk si rs ba me mk al xk ua ru by md lt lv ee cy il ge am az kz lu mt li ad sm fo gi" },
  { id: "samerica", name: "South America", short: "S. America", more: "py pe cl bo ve gy sr" },
  { id: "africa", name: "Africa", short: "Africa",
    more: "cm ml bf gn gm tn ly sd ss et ug tz rw bi zm zw mw ao mz cd cg ga gq cf tg bj na bw sz ls mg mu cv mr so dj er sl lr gw ne td km st sc" },
  { id: "namerica", name: "North America & the Caribbean", short: "N. America", more: "cr pa hn gt sv ni bz cu ht do pr bs bb gd lc vc ag kn dm bm" },
  { id: "asia", name: "Asia & Oceania", short: "Asia",
    more: "kr kp cn sa qa ae kw bh om iq jo sy lb ps ye uz tj tm kg af pk in bd lk np bt mv th my sg ph kh mm la bn tl hk mo tw mn nz fj pg sb nc vu ws to" }];
/* the league-only countries NATS doesn't name */
const TOUR_NAMES = { scotland: "Scotland", cz: "Czechia", pl: "Poland", gr: "Greece", tr: "Turkey" };
/* roughly the middle of each stop, for "next door": a table of borders is a lot to keep for a nudge. Nobody is asked to agree with it; a stop not
   listed still gets suggested, from its own region */
const TOUR_AT = { es: [40, -4], fr: [47, 2], england: [53.2, -1.8], pt: [39.5, -8], nl: [52.2, 5.3], de: [51, 10], it: [42.8, 12.8], be: [50.6, 4.6], hr: [45.2, 15.5],
  ch: [46.8, 8.2], dk: [56, 10], no: [61, 9], at: [47.5, 14.5], scotland: [55.9, -4], cz: [49.8, 15.5], pl: [52, 19.5], gr: [39, 22], tr: [39, 35],
  ar: [-34, -64], br: [-14, -52], uy: [-33, -56], co: [4, -73], ec: [-1.5, -78], ma: [32, -6], sn: [14.5, -14.5], ng: [9, 8], gh: [8, -1.2], ci: [7.5, -5.5],
  eg: [27, 30], dz: [28, 2.5], za: [-29, 25], ke: [.5, 38], mx: [23, -102], us: [39, -98], ca: [50, -90], jm: [18.1, -77.3], tt: [10.5, -61.3], jp: [36, 138],
  ir: [32, 53], au: [-25, 134], id: [-3, 118], vn: [16, 107] };
/* a language with one country in it. English alone says nothing about where */
const TOUR_LANG = { nl: "nl", de: "de", fr: "fr", es: "es", it: "it", pt: "pt", ja: "jp", pl: "pl", hr: "hr", da: "dk", no: "no", nb: "no", cs: "cz", el: "gr", tr: "tr", fa: "ir", id: "id", vi: "vn" };
/* seven inks you'd find on a border post's desk, dark enough to read on the page */
const TOUR_INKS = ["hsl(218,66%,33%)", "hsl(354,62%,38%)", "hsl(152,54%,24%)", "hsl(272,40%,36%)", "hsl(192,72%,24%)", "hsl(22,74%,34%)", "hsl(216,30%,22%)"];
const TOUR_SHAPES = ["round", "box", "oval", "cut"];

let TOUR = null, TOURD = null, TOUR_TIMER = null, TOUR_BUSY = null, TOUR_STOPS = null, TOUR_FAIL = false, TOUR_MAN = null, TOUR_PAGE = null;
const TOUR_DECKS = {};

/* ---------- the map ---------- */
function tourRegionOf(cc){
  const g = NATS.find(x => x[1].some(c => (c[2] || c[0]) === cc));
  return g ? TOUR_REGIONS.find(r => r.name === g[0]) || null : TOUR_REGIONS.find(r => r.more.split(" ").includes(cc)) || null;
}
function tourName(cc, nat){
  for(const g of NATS) for(const c of g[1]) if((c[2] || c[0]) === cc) return c[1];
  if(TOUR_NAMES[cc]) return TOUR_NAMES[cc];
  if(nat && nat.label) return nat.label;
  try{ return new Intl.DisplayNames(["en"], { type: "region" }).of(cc.toUpperCase()); }catch(e){}
  return cc.toUpperCase();
}
/* the app's order within a region, then the rest by name */
function tourRank(cc){
  for(const g of NATS){ const i = g[1].findIndex(c => (c[2] || c[0]) === cc); if(i >= 0) return i; }
  return 999;
}
/* THE LIST, from the manifest: see THE MAP above. The biggest league is the top flight: true of every country with two, and the test checks */
function tourStopsFrom(man){
  const by = {};
  for(const d of (man && man.decks) || []){
    if((d.kind !== "league" && d.kind !== "nation") || !d.cc || !(d.mc > 0)) continue;
    (by[d.cc] = by[d.cc] || []).push(d);
  }
  const out = [];
  for(const cc of Object.keys(by)){
    const list = by[cc], region = tourRegionOf(cc), n = list.reduce((a, d) => a + d.mc, 0);
    if(n < TOUR_BAR || !region) continue;
    const leagues = list.filter(d => d.kind === "league").sort((a, b) => b.mc - a.mc), nat = list.find(d => d.kind === "nation");
    out.push({ cc, name: tourName(cc, nat), region: region.id, n, top: leagues.length ? leagues[0].id : null, league: leagues.length ? leagues[0].label : null,
      decks: leagues.map(d => d.id).concat(nat ? [nat.id] : []) });
  }
  const at = r => TOUR_REGIONS.findIndex(x => x.id === r);
  return out.sort((a, b) => at(a.region) - at(b.region) || tourRank(a.cc) - tourRank(b.cc) || a.name.localeCompare(b.name));
}
const tourFind = cc => (TOUR_STOPS || []).find(x => x.cc === cc) || null;
/* A LEAGUE'S QUIZ KEY IS ITS BADGE'S, and the Eredivisie's isn't its deck's */
const tourQuizKey = deck => deck ? Object.keys(QUIZZES).find(k => QUIZZES[k].deck === deck && QUIZZES[k].ic === "stripes") || null : null;
function tourMedal(stop, px){ try{ return compBadge(tourQuizKey(stop.top), px) || ""; }catch(e){ return ""; } }
const tourFlag = cc => "assets/natflags/" + cc + ".png";

/* YOUR COUNTRY: where you said you live, your national side, the phone's region, your club's country, then the phone's language */
function tourHome(stops){
  const has = c => { const k = c === "gb" || c === "gb-eng" ? "england" : c; return k && stops.some(x => x.cc === k) ? k : null; };
  let f = {}, club = null, reg = null, lang = null;
  try{ f = acctLocal().fav || {}; }catch(e){}
  try{ club = f.club || (mine().fav || {}).club || null; }catch(e){}
  let langs = [];
  try{ langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).map(String); }catch(e){}
  /* en-GB and en-US are what a phone says by default anywhere English is the setting, so they say nothing about where: a Dutch Ajax fan
     on UK English is not English, a Kenyan on US English is not American. en-KE, nl-NL and the like do say */
  for(const l of langs){ const [a, b] = l.toLowerCase().split("-"); if(!(a === "en" && (b === "gb" || b === "us"))) reg = reg || has(b); lang = lang || has(TOUR_LANG[a]); }
  let cc = null;
  if(club){ try{ cc = (clubOf(club) || {}).cc || null; }catch(e){} if(!cc) try{ cc = (bankClub(club) || [])[2] || null; }catch(e){} if(!cc) try{ cc = CLUBCC ? CLUBCC[club] : null; }catch(e){} }
  return has(f.country) || has(f.nation) || reg || has(cc) || lang || null;
}
/* your region's pages first and your country first on them */
function tourOrder(stops, home){
  const h = stops.find(x => x.cc === home);
  if(!h) return stops.slice();
  const mine = stops.filter(x => x.region === h.region && x !== h), rest = stops.filter(x => x.region !== h.region);
  return [h].concat(mine, rest);
}
/* NINE TO A PAGE, shared evenly when a region runs over */
function tourPages(order){
  const out = [];
  for(const id of [...new Set(order.map(x => x.region))]){
    const reg = TOUR_REGIONS.find(r => r.id === id), list = order.filter(x => x.region === id), parts = Math.ceil(list.length / TOUR_PER_PAGE), per = Math.ceil(list.length / parts);
    for(let i = 0; i < parts; i++) out.push({ reg, list, part: i, parts, stops: list.slice(i * per, (i + 1) * per) });
  }
  return out;
}

/* ---------- the rules of a test ---------- */
const tourId = r => r.id || r.q;
const tourAns = a => String(a).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tourOptsOk = r => Array.isArray(r.o) && r.o.length === 4 && r.k != null && r.o[r.k] === r.a && new Set(r.o.map(tourAns)).size === 4;
/* everything a stop can deal: four clean options, once, with its tier and how far down the country's decks it is */
function tourPool(stop, decks){
  const out = [], ids = new Set(), asked = new Set();
  stop.decks.forEach((id, rank) => {
    for(const t of TOUR_TIERS) for(const r of ((decks[id] || {})[t] || [])){
      const q = tourAns(r.q);
      if(!tourOptsOk(r) || ids.has(tourId(r)) || asked.has(q)) continue;
      ids.add(tourId(r)); asked.add(q); out.push(Object.assign({}, r, { tier: t, deck: id, rank, ans: tourAns(r.a), at: TOUR_TIERS.indexOf(t) }));
    }
  });
  return out;
}
/* A WHOLE TEST. For each place in the plan: never an answer the test already has, because one would give the other away. Then a question you
   haven't met, the tier asked for first and up to two off; then one you have, the longest ago first; a tier further off only when all that
   has run out. Between equals the top league, then its second tier, then the national team, then chance. The tiers climb. Null if it can't. */
function tourDeal(pool, seen, rnd){
  rnd = rnd || Math.random;
  const met = new Map((seen || []).map((id, i) => [id, i])), used = new Set(), answers = new Set(), got = [];
  for(const c of TOUR_PLAN){
    const w = TOUR_TIERS.indexOf(TOUR_LETTER[c]);
    let best = null, low = Infinity;
    for(const r of pool){
      const id = r.id || r.q;
      if(used.has(id) || answers.has(r.ans)) continue;
      const off = r.at > w ? r.at - w : w - r.at, again = met.has(id);
      const band = again ? (off < 2 ? 3 : off < 3 ? 4 : 6) : off < 3 ? off : 5;
      const score = band * 1e7 + (again ? met.get(id) * 100 : 0) + r.rank * 10 + rnd();
      if(score < low){ low = score; best = r; }
    }
    if(!best) return null;
    used.add(best.id || best.q); answers.add(best.ans); got.push(best);
  }
  return got.map((r, i) => [r.at, i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}
/* on the list as they come up, so an abandoned test counts as met; the newest at the end, the list capped */
function tourMark(s, ids){
  const list = (s.seen || []).filter(x => !ids.includes(x)).concat(ids);
  s.seen = list.slice(Math.max(0, list.length - TOUR_SEEN_MAX));
}
const tourCount = (stops, s) => stops.filter(x => (s.stamps || {})[x.cc]).length;
/* a region's visa and the one title, for whatever the stamps now earn. Stamps can land from another phone, so this runs on every open too.
   What's earned stays earned: a region that gains a stop later keeps its visa */
function tourAward(s, stops, now){
  s.stamps = s.stamps || {}; s.visas = s.visas || {};
  const out = { visas: [], title: false };
  for(const r of TOUR_REGIONS){
    const list = stops.filter(x => x.region === r.id);
    if(list.length && !s.visas[r.id] && list.every(x => s.stamps[x.cc])){ s.visas[r.id] = now; out.visas.push(r.id); }
  }
  if(stops.length && !s.title && stops.every(x => s.stamps[x.cc])){ s.title = now; out.title = true; }
  return out;
}
/* a test finished. A stamp's date is the day it was first won and never moves; n is the best score since */
function tourRecord(s, stops, cc, right, now){
  s.stamps = s.stamps || {}; s.best = s.best || {}; s.runs = s.runs || {};
  const pass = right >= TOUR_PASS, first = pass && !s.stamps[cc], before = s.best[cc] | 0;
  s.runs[cc] = (s.runs[cc] | 0) + 1;
  if(right > before) s.best[cc] = right;
  if(first) s.stamps[cc] = { t: now, n: right };
  else if(pass && right > (s.stamps[cc].n | 0)) s.stamps[cc].n = right;
  const won = tourAward(s, stops, now);
  return { pass, first, best: right > before, visas: won.visas, title: won.title };
}
const tourMiles = (a, b) => {
  const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) * r / 2), y = (b[0] - a[0]) * r;
  return 6371 * Math.sqrt(x * x + y * y);
};
const tourLastOf = (stops, s) => stops.filter(x => (s.stamps || {})[x.cc]).sort((a, b) => s.stamps[b.cc].t - s.stamps[a.cc].t)[0] || null;
/* WHERE NEXT. Nothing stamped: your own country. After that the nearest stop you haven't got to the last one you won, else the first left in its
   region, else the first left. near says how it's worded: 0 first, 1 next door, 2 not far, 3 on from there */
function tourWhere(stops, s, home){
  const left = tourOrder(stops, home).filter(x => !(s.stamps || {})[x.cc]);
  if(!left.length) return null;
  const last = tourLastOf(stops, s);
  if(!last) return { stop: left[0], from: null, near: 0 };
  const at = TOUR_AT[last.cc], far = x => at && TOUR_AT[x.cc] ? tourMiles(at, TOUR_AT[x.cc]) : Infinity;
  const stop = left.slice().sort((a, b) => far(a) - far(b) || (b.region === last.region) - (a.region === last.region))[0], d = far(stop);
  const same = left.find(x => x.region === last.region);
  if(d === Infinity) return { stop: same || left[0], from: last, near: same ? 2 : 3 };
  return { stop, from: last, near: d < 1200 ? 1 : d < 3500 ? 2 : 3 };
}
function tourShareText(stops, s){
  const last = tourLastOf(stops, s);
  return "BALL · World Tour: " + tourCount(stops, s) + " of " + stops.length + " stamps" + (last ? ", last stop " + last.name : "") +
    "\nA stamp per country: ten questions, seven right.\nballquiz.app";
}

/* ---------- the decks ---------- */
function tourLoad(stop){
  const want = stop.decks.filter(d => !TOUR_DECKS[d]);
  return Promise.all(want.map(d => fetch("assets/q/" + d + ".json").then(r => { if(!r.ok) throw new Error(d); return r.json(); })
    .then(b => { TOUR_DECKS[d] = qrRetier(bankDecks(b).mc); })));
}
/* who's on the map today; the shelf reads the count from the store */
function tourFetch(){
  if(TOUR_MAN) return TOUR_MAN;
  return (TOUR_MAN = fetch("assets/q/manifest.json").then(r => { if(!r.ok) throw new Error("manifest"); return r.json(); }).then(m => {
    TOUR_STOPS = tourStopsFrom(m); TOUR_MAN = null;
    if(TOUR_VIEW) render();
    return TOUR_STOPS;
  }, () => { TOUR_MAN = null; TOUR_FAIL = true; if(TOUR_VIEW) render(); return null; }));
}

function tourRetry(){ audio(); TOUR_FAIL = false; render(); }

/* ---------- the stamp ---------- */
const tourHash = t => { let h = 7; for(const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
/* a country's stamp, the same on every phone: shape, ink, tilt, and a little off the grid */
function tourLook(cc){
  const h = tourHash(cc), r = (h % 13) - 6;
  return { shape: TOUR_SHAPES[(h >>> 4) % TOUR_SHAPES.length], ink: TOUR_INKS[(h >>> 9) % TOUR_INKS.length], r: r || 3, x: ((h >>> 14) % 7) - 3, y: ((h >>> 18) % 7) - 3 };
}
const TOUR_MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function tourDate(t){ const d = new Date(t); return String(d.getDate()).padStart(2, "0") + " " + TOUR_MON[d.getMonth()] + " " + d.getFullYear(); }
const tourDateLong = t => { try{ return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }catch(e){ return tourDate(t); } };
const tourTxt = (x, y, size, t, cls, more) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" class="' + (cls || "") + '"' + (more || "") + '>' + esc(String(t)) + '</text>';
/* a line that has to fit: the name is the point of a stamp, so a long one gets smaller rather than wider */
const tourFit = (t, w, big) => Math.min(big, +(w / (String(t).length * .56)).toFixed(1));
/* the name in two lines, as near level as the words allow */
function tourTwo(name){
  const w = name.split(" ");
  if(w.length < 2) return [name];
  let cut = 1, best = Infinity;
  for(let i = 1; i < w.length; i++){ const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length); if(d < best){ best = d; cut = i; } }
  return [w.slice(0, cut).join(" "), w.slice(cut).join(" ")];
}
const TOUR_OUT = {
  round: { w: 120, h: 120, cx: 60, cy: 60, a: '<circle cx="60" cy="60" r="56.5" class="o"/>', b: '<circle cx="60" cy="60" r="50.5" class="i"/>' },
  oval: { w: 148, h: 106, cx: 74, cy: 53, a: '<ellipse cx="74" cy="53" rx="70.5" ry="49.5" class="o"/>', b: '<ellipse cx="74" cy="53" rx="64.5" ry="43.5" class="i"/>' },
  box: { w: 148, h: 100, cx: 74, cy: 50, a: '<rect x="3.5" y="3.5" width="141" height="93" rx="7" class="o"/>', b: '<rect x="9" y="9" width="130" height="82" rx="3" class="i"/>' },
  cut: { w: 120, h: 120, cx: 60, cy: 60, a: '<path d="M26 4H94L116 26V94L94 116H26L4 94V26Z" class="o"/>', b: '<path d="M29 10H91L110 29V91L91 110H29L10 91V29Z" class="i"/>' } };
/* A RUBBER STAMP, drawn: double rule, the country's name, its flag, the date you won it, in its own ink, a little rotated. Shape, ink and tilt come
   from tourLook. rec null is the empty slot: the same outline in dots, with the name. o: id (when one page draws the same stamp twice),
   home, best, next */
function tourStamp(stop, rec, o){
  o = o || {};
  const L = tourLook(stop.cc), S = TOUR_OUT[L.shape], name = stop.name.toUpperCase();
  const open = '<svg class="tourst ' + L.shape + (rec ? " inked" : " mt") + '" viewBox="0 0 ' + S.w + ' ' + S.h + '" aria-hidden="true"' + (rec ? ' style="color:' + L.ink + '"' : "") + '>';
  if(!rec){
    const lines = tourTwo(stop.name), size = Math.min(...lines.map(l => tourFit(l, S.w - 34, 15))), top = S.cy - (lines.length - 1) * size * .56 + size * .34;
    return open + S.a + lines.map((l, i) => tourTxt(S.cx, (top + i * size * 1.12).toFixed(1), size, l, "n", ' text-anchor="middle"')).join("") +
      (o.home ? tourTxt(S.cx, (top - size - 3).toFixed(1), 8.5, "Home", "k", ' text-anchor="middle"') : "") +
      (o.best ? tourTxt(S.cx, (top + (lines.length - 1) * size * 1.12 + 13).toFixed(1), 9, "Best " + o.best + "/" + TOUR_N, "k", ' text-anchor="middle"') : "") + '</svg>';
  }
  const date = tourDate(rec.t), id = "tp" + stop.cc + (o.id || ""), flag = (x, y, w, h) => '<image href="' + tourFlag(stop.cc) + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice"/><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" class="i"/>';
  let inner;
  if(L.shape === "round") inner = '<path id="' + id + '" d="M15 65a45 45 0 0 1 90 0" fill="none"/>' +
      '<text font-size="' + tourFit(name, 112, 15) + '" class="n" text-anchor="middle"><textPath href="#' + id + '" startOffset="50%">' + esc(name) + '</textPath></text>' +
      flag(37, 34, 46, 30) + tourTxt(60, 82, 12.5, date, "d", ' text-anchor="middle"') + tourTxt(60, 99, 8.5, "BALL", "k", ' text-anchor="middle"');
  else if(L.shape === "oval") inner = tourTxt(74, 31, tourFit(name, 100, 15.5), name, "n", ' text-anchor="middle"') + flag(54, 37, 40, 26) + tourTxt(74, 78, 12.5, date, "d", ' text-anchor="middle"') + tourTxt(74, 90, 8, "BALL", "k", ' text-anchor="middle"');
  else if(L.shape === "box") inner = tourTxt(16, 28, tourFit(name, 116, 17), name, "n") + '<path d="M16 34H132" class="i"/>' + flag(16, 41, 54, 36) +
      tourTxt(77, 58, 18, date.slice(0, 6), "d") + tourTxt(77, 76, 13, date.slice(7), "d") + tourTxt(132, 76, 8, "BALL", "k", ' text-anchor="end"');
  else inner = tourTxt(60, 33, tourFit(name, 92, 15.5), name, "n", ' text-anchor="middle"') + flag(36, 40, 48, 32) + tourTxt(60, 88, 12.5, date, "d", ' text-anchor="middle"') + tourTxt(60, 100, 8, "BALL", "k", ' text-anchor="middle"');
  return open + '<g' + tourInkAttr() + '>' + S.a + S.b + inner + '</g></svg>';
}
/* the worn edge of a real stamp is a filter, one per page; a slow phone goes without it */
function tourInkAttr(){ try{ return lowEnd() ? "" : ' filter="url(#tourink)"'; }catch(e){ return ""; } }
const tourDefs = () => '<svg class="tourdefs" width="0" height="0" aria-hidden="true"><defs><filter id="tourink" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">' +
  '<feTurbulence type="fractalNoise" baseFrequency=".62" numOctaves="3" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -5.2 4.15" result="holes"/>' +
  '<feComposite in="SourceGraphic" in2="holes" operator="in" result="ink"/><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="9" result="w"/>' +
  '<feDisplacementMap in="ink" in2="w" scale="1.3" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>';
const tourGlobe = () => '<svg class="tourglobe" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
const tourStar = () => '<svg class="tourstar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';

/* ---------- the passport ---------- */
function tourSlot(stop, s, o){
  const rec = (s.stamps || {})[stop.cc], L = tourLook(stop.cc), land = o.land === stop.cc, best = (s.best || {})[stop.cc] | 0;
  const say = stop.name + (rec && !land ? ", stamped " + tourDateLong(rec.t) : ", no stamp yet" + (best ? ", best " + best + " of " + TOUR_N : "")) + (o.next === stop.cc ? ", next stop" : "");
  const cls = "tourslot " + L.shape + (rec && !land ? " done" : "") + (land ? " landing" : "") + (o.next === stop.cc ? " next" : "");
  const art = land ? tourStamp(stop, null, { home: o.home === stop.cc }) + tourStamp(stop, rec, { id: "l" }) : tourStamp(stop, rec || null, { home: o.home === stop.cc, best });
  return '<button class="' + cls + '" style="--r:' + L.r + 'deg;--x:' + L.x + 'px;--y:' + L.y + 'px" onclick="tourOpen(\'' + stop.cc + '\')" aria-label="' + esc(say) + '"' + (TOUR_BUSY ? " disabled" : "") + '>' + art + '</button>';
}
/* a region's visa, at the foot of its last page: dots until the last stamp lands, then gold */
function tourVisa(reg, s, n, land){
  const t = (s.visas || {})[reg.id];
  if(t && !land) return '<div class="tourvisa on" role="img" aria-label="' + esc("Gold visa for " + reg.name + ", " + tourDateLong(t)) + '">' + tourStar() + '<span><small>Visa</small><b>' + esc(reg.name) + '</b></span><time>' + tourDate(t) + '</time></div>';
  return '<div class="tourvisa' + (land ? " landing" : "") + '" aria-hidden="' + (land ? "false" : "true") + '">' + tourStar() + '<span><small>Visa</small><b>' + esc(land ? reg.name : "All " + n + " stamps, then this page gets its visa") + '</b></span>' + (land ? '<time>' + tourDate(t) + '</time>' : "") + '</div>';
}
function tourPageHTML(P, n, s, o){
  const got = P.list.filter(x => (s.stamps || {})[x.cc]).length, c = P.stops.length, foot = P.part === P.parts - 1 || o.visa === P.reg.id;
  const lay = c === 5 ? "wide five" : c <= 6 ? "wide" : "tight";
  return '<section class="tourpg" aria-label="' + esc(P.reg.name + ", page " + n) + '" data-r="' + P.reg.id + '"><header><span class="r">' + esc(P.reg.name) + (P.parts > 1 ? ' <i>' + (P.part + 1) + '/' + P.parts + '</i>' : "") + '</span><span class="c">' + got + ' of ' + P.list.length + '</span></header>' +
    '<div class="tourslots ' + lay + '">' + P.stops.map(x => tourSlot(x, s, o)).join("") + '</div>' +
    '<footer>' + (foot ? tourVisa(P.reg, s, P.list.length, o.visa === P.reg.id) : '<div class="tourover">Over the page</div>') + '<span class="no">' + n + '</span></footer></section>';
}
/* THE DATA PAGE at the front: whose passport it is, and the machine-read strip every real one has */
function tourIdHTML(stops, s, home){
  const n = tourCount(stops, s), v = Object.keys(s.visas || {}).length, first = Math.min(...Object.values(s.stamps || {}).map(x => x.t).concat(Date.now()));
  const H = stops.find(x => x.cc === home), who = (typeof mpName === "function" && mpName()) || "Football fan", last = tourLastOf(stops, s), rows = [["Holder", who], ["Home", H ? H.name : "The world"], ["Issued", tourDate(first)], ["Stamps", n + " of " + stops.length], ["Visas", v + " of " + TOUR_REGIONS.length]].concat(last ? [["Last stop", last.name]] : [], s.title ? [["Title", TOUR_TITLE]] : []);
  const mrz = t => String(t).toUpperCase().normalize("NFD").replace(/[^A-Z0-9]+/g, "<");
  const line = t => (t + "<".repeat(44)).slice(0, 44);
  return '<section class="tourpg tourid" aria-label="Your passport"><header><span class="r">Passport</span><span class="c">World Tour</span></header>' +
    '<div class="touridrow"><div class="tourphoto">' + (H ? '<img src="' + tourFlag(H.cc) + '" alt="">' : tourGlobe()) + '</div><dl>' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join("") + '</dl></div>' +
    '<div class="tourvisas">' + TOUR_REGIONS.map(r => '<span class="' + ((s.visas || {})[r.id] ? "on" : "") + '">' + tourStar() + '<small>' + esc(r.short) + '</small></span>').join("") + '</div>' +
    '<div class="tourmrz" aria-hidden="true">' + esc(line("P<BALL<<" + mrz(who))) + '<br>' + esc(line(mrz(H ? H.name : "WORLD").slice(0, 3) + "<<STAMPS<" + String(n).padStart(3, "0") + "<OF<" + String(stops.length).padStart(3, "0"))) + '</div></section>';
}
function tourNextHTML(stops, s, home){
  const N = tourWhere(stops, s, home);
  if(!N) return '<div class="tournext won">' + tourStar() + '<span class="m"><small>Every stop stamped</small><b>' + TOUR_TITLE + '</b><i>Since ' + esc(tourDateLong(s.title || Date.now())) + '</i></span></div>';
  const X = N.stop, busy = TOUR_BUSY === X.cc;
  const why = busy ? "One moment…" : !N.from ? (X.cc === home ? "Home comes first" : "Start anywhere") : (N.near === 1 ? "Next door to " : N.near === 2 ? "Not far from " : "On from ") + N.from.name;
  return '<button class="tournext" onclick="tourStart(\'' + X.cc + '\')" aria-label="' + esc((N.from ? "Next stop, " : "Your first stamp, ") + X.name + ". " + why) + '"' + (TOUR_BUSY ? " disabled" : "") + '><img src="' + tourFlag(X.cc) + '" alt=""><span class="m"><small>' + (N.from ? "Next stop" : "Your first stamp") + '</small><b>' + esc(X.name) + '</b><i>' + esc(why) + '</i></span><span class="go">Go</span></button>';
}
function tourBookHTML(){
  const stops = TOUR_STOPS, s = tourStore(), home = tourHome(stops), order = tourOrder(stops, home), pages = tourPages(order), n = tourCount(stops, s), next = tourWhere(stops, s, home), nx = next ? next.stop.cc : null;
  const open = TOUR_PAGE != null && TOUR_PAGE <= pages.length ? TOUR_PAGE : next ? 1 + pages.findIndex(P => P.stops.includes(next.stop)) : 1;
  TOUR_PAGE = open;
  const tabs = [...new Set(pages.map(P => P.reg))];
  const tab = (r, i) => { const P = pages.findIndex(x => x.reg === r), list = order.filter(x => x.region === r.id), got = list.filter(x => (s.stamps || {})[x.cc]).length, on = open > 0 && pages[open - 1].reg === r;
    return '<button class="tourtab' + (on ? " on" : "") + ((s.visas || {})[r.id] ? " gold" : "") + '" data-r="' + r.id + '" onclick="tourTurn(' + (P + 1) + ')" aria-pressed="' + on + '">' + esc(r.short) + '<small>' + got + '/' + list.length + '</small></button>'; };
  return b4Page({ title: "World Tour", ctx: n ? n + " of " + stops.length + " stamps" : stops.length + " stops", back: "tourBack()", cls: "tourpage tour-book", body:
    tourDefs() + tourNextHTML(stops, s, home) +
    '<div class="tourtabs" role="group" aria-label="Regions"><button class="tourtab id' + (open ? "" : " on") + '" onclick="tourTurn(0)" aria-pressed="' + !open + '" aria-label="Your passport">' + tourGlobe() + '</button>' + tabs.map(tab).join("") + '</div>' +
    '<div class="tourbook" id="tourbook" onscroll="tourTurned(this)">' + tourIdHTML(stops, s, home) + pages.map((P, i) => tourPageHTML(P, i + 1, s, { next: nx, home })).join("") + '</div>' +
    '<p class="tourlead">Ten questions, twenty seconds each. Seven right wins the stamp, and a miss costs nothing.</p>' +
    (n ? b4Btn("Share", "tourShare()", "dark") : "") });
}
/* a tab or a tap: the book turns to a page, and the tabs follow by themselves */
function tourTurn(i){
  audio();
  const el = document.getElementById("tourbook");
  if(!el) return;
  let still = false; try{ still = reducedMotion(); }catch(e){}
  try{ el.scrollTo({ left: i * el.clientWidth, behavior: still ? "auto" : "smooth" }); }catch(e){ el.scrollLeft = i * el.clientWidth; }
}
function tourTurned(el){
  const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
  if(i === TOUR_PAGE) return;
  TOUR_PAGE = i;
  try{
    const r = i ? el.children[i].getAttribute("data-r") : null;
    document.querySelectorAll(".tourtabs .tourtab").forEach(t => { const on = i ? t.getAttribute("data-r") === r : t.classList.contains("id"); t.classList.toggle("on", on); t.setAttribute("aria-pressed", on); });
  }catch(e){}
}
/* tapping a slot: what it's for, or what you did there */
function tourOpen(cc){
  audio();
  const x = tourFind(cc);
  if(!x || TOUR_BUSY) return;
  const s = tourStore(), rec = s.stamps[cc], best = (s.best || {})[cc] | 0;
  const art = rec ? '<div class="tourshow">' + tourStamp(x, rec, { id: "s" }) + '</div>' : '<div class="tourshow head"><img src="' + tourFlag(cc) + '" alt="">' + tourMedal(x, 44) + '</div>';
  const line = rec ? "Stamped on " + tourDateLong(rec.t) + (rec.n ? ", best " + rec.n + " of " + TOUR_N : "") + "." : "Ten questions on " + (x.top ? esc(x.league) : "the national team") + ", twenty seconds each. Seven right wins the stamp." + (best ? " Your best is " + best + "." : "");
  sheet('<h2>' + esc(x.name) + '</h2><p>' + line + '</p>' + art + b4Btn(rec ? "Sit it again" : "Take the test", "closeSheet();tourStart('" + cc + "')", rec ? "dark" : "gold") + '<button class="b4btn quiet" onclick="closeSheet()">Not now</button>');
}

/* ---------- a test ---------- */
const tourQ = () => TOUR.deal[TOUR.i];
const tourViewKey = () => TOUR.i + (TOUR.shown ? "s" : "q");
function tourRunHTML(){
  const x = tourFind(TOUR.cc), Q = tourQ(), shown = TOUR.shown, picks = TOUR.picks, right = picks.filter(Boolean).length;
  const pip = i => '<i class="' + (i < picks.length ? (picks[i] ? "hit" : "miss") : i === TOUR.i ? "cur" : "") + (i === TOUR_PASS - 1 ? " gate" : "") + '"></i>';
  const opts = Q.o.map((t, i) => '<button class="h2opt' + (shown ? (i === Q.k ? " right" : i === TOUR.pick ? " wrong" : " dim") : "") + '"' + (shown ? " disabled" : "") + ' onclick="tourAnswer(' + i + ')"><span class="k">' + "ABCD"[i] + '</span>' + esc(String(t)) + '</button>').join("");
  const clock = shown ? "" : '<div class="clock tourclock" id="clock" role="timer"><div class="bar"><i style="width:100%"></i></div><div class="digits">' + TOUR_SECS + '.0</div></div>';
  const next = shown && !picks[TOUR.i] ? b4Btn(TOUR.i + 1 < TOUR_N ? "Next question" : "See how you did", "tourNext()", "gold") : "";
  return b4Page({ title: x.name, ctx: (TOUR.i + 1) + " of " + TOUR_N + " · " + TOUR_PASS + " to pass", back: "tourAskLeave()", leave: "tourAskLeave()", cls: "tourpage tour-run", body:
    '<span hidden data-tourk="' + tourViewKey() + '"></span>' +
    '<div class="tourdash"><img src="' + tourFlag(x.cc) + '" alt=""><span class="tourten" role="img" aria-label="' + right + ' right so far, ' + TOUR_PASS + ' to pass">' + Array.from({ length: TOUR_N }, (_, i) => pip(i)).join("") + '</span><b>' + right + '<small>/' + TOUR_PASS + '</small></b></div>' + clock +
    '<div class="qcard tourq' + (shown ? "" : " qin") + '"><div class="qtext">' + esc(String(Q.q)) + '</div><div class="touropts">' + opts + '</div>' +
      '<div class="toursay" role="status">' + esc(TOUR.say || "") + '</div></div>' + next });
}
function tourShow(){
  const Q = tourQ();
  TOUR.shown = false; TOUR.pick = null; TOUR.say = ""; TOUR.left = TOUR_SECS;
  const s = tourStore(); tourMark(s, [tourId(Q)]); tourSave(s);
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  startTimer(TOUR_SECS, tourTimeUp, "tour:" + TOUR.n + ":" + TOUR.i);
}
function tourAnswer(i){
  if(!TOUR || TOUR.shown || TOUR_VIEW !== "run") return;
  audio();
  stopTimer();
  tourReveal(i);
}
function tourTimeUp(){ if(!TOUR || TOUR.shown) return; stopTimer(); tourReveal(-1); }
function tourReveal(i){
  const Q = tourQ(), ok = i === Q.k;
  TOUR.shown = true; TOUR.pick = i;
  TOUR.picks.push(ok);
  if(ok) TOUR.right++;
  try{ if(ok) fb.correct(null); else if(i >= 0) fb.wrong(null); else fb.run = 0; }catch(e){}
  /* the green option is the answer, so what's said under it is the bank's fact: the reason to be here */
  TOUR.say = ok ? "Right." : (i < 0 ? "Out of time. " : "") + String(Q.sub || "");
  try{ a11ySay(ok ? "Right." : "It was " + Q.o[Q.k] + ". " + TOUR.say); }catch(e){}
  render();
  if(ok){ clearTimeout(TOUR_TIMER); const run = TOUR; TOUR_TIMER = setTimeout(() => { if(TOUR === run) tourNext(); }, TOUR_RIGHT_MS); }
}
function tourNext(){
  if(!TOUR || !TOUR.shown) return;
  audio();
  clearTimeout(TOUR_TIMER); TOUR_TIMER = null;
  TOUR.i++;
  if(TOUR.i < TOUR_N) return tourShow();
  tourFinish();
}
/* a stop picked: its decks first, then the test */
function tourStart(cc){
  audio();
  const x = tourFind(cc);
  if(!x || TOUR_BUSY) return;
  if(x.decks.some(d => !TOUR_DECKS[d])){
    TOUR_BUSY = cc; render();
    return tourLoad(x).then(() => { TOUR_BUSY = null; if(TOUR_VIEW) tourStart(cc); },
      () => { TOUR_BUSY = null; render(); toast("That didn’t load. Try again in a moment.", true); });
  }
  const s = tourStore(), deal = tourDeal(tourPool(x, TOUR_DECKS), s.seen || []);
  if(!deal) return toast("We’re short of questions for this stop. Try another one.", true);
  try{ wakeLock(); }catch(e){}
  try{ fb.run = 0; }catch(e){}
  TOUR = { cc, deal, n: Date.now(), i: 0, right: 0, picks: [], shown: false, pick: null, say: "", left: TOUR_SECS };
  TOURD = null;
  TOUR_VIEW = "run";
  tourShow();
}
function tourFinish(){
  if(!TOUR) return;
  clearTimeout(TOUR_TIMER); TOUR_TIMER = null; stopTimer();
  const s = tourStore(), cc = TOUR.cc, right = TOUR.right, rec = tourRecord(s, TOUR_STOPS, cc, right, Date.now());
  tourSave(s);
  try{ tlmEvent("tour_done", { cc, right, pass: rec.pass ? 1 : 0, stamp: rec.first ? 1 : 0 }); }catch(e){}
  TOURD = { cc, right, picks: TOUR.picks, pass: rec.pass, first: rec.first, best: rec.best, visas: rec.visas, title: rec.title, landed: false };
  TOUR = null; TOUR_VIEW = rec.first ? "land" : "done"; TOUR_PAGE = null;
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function tourAskLeave(){
  audio();
  if(TOUR_TIMER) return;   // the answer is landing: a moment, and it's the next question
  sheet('<h2>Leave the test?</h2><p>' + (TOUR && TOUR.right ? "You’d lose these " + TOUR.right + " right. Your passport keeps everything else." : "Nothing is lost. Your passport stays as it is.") + '</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep going</button><button class="b4btn quiet" onclick="tourLeave()">Leave</button>');
}
function tourLeave(){
  audio(); closeSheet();
  clearTimeout(TOUR_TIMER); TOUR_TIMER = null; stopTimer();
  TOUR = null; TOUR_VIEW = "book"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
/* the line under a revealed question reports this question */
function tourQrep(){
  if(!TOUR || !TOUR.shown) return null;
  const Q = tourQ(), anchor = document.querySelector("#stage .tourq");
  return Q && anchor ? { q: Q.q, a: Q.o[Q.k], deck: Q.deck, tier: Q.tier, anchor } : null;
}

/* ---------- after a test ---------- */
const tourTen = picks => '<span class="tourten big" role="img" aria-label="' + picks.filter(Boolean).length + ' of ' + TOUR_N + ' right">' + picks.map(p => '<i class="' + (p ? "hit" : "miss") + '"></i>').join("") + '</span>';
/* the stop's own page, the empty slot waiting and then the stamp coming down on it; its gold visa after that, if it finished the region */
function tourLandHTML(){
  const D = TOURD, stops = TOUR_STOPS, s = tourStore(), x = tourFind(D.cc), home = tourHome(stops), order = tourOrder(stops, home), pages = tourPages(order), i = pages.findIndex(P => P.stops.includes(x)), n = tourCount(stops, s);
  const next = tourWhere(stops, s, home), visa = D.visas[0] || null;
  const say = D.title ? "That’s every stop. You’re a " + TOUR_TITLE + "." : visa ? "And that’s " + TOUR_REGIONS.find(r => r.id === visa).name + " done: the gold visa is yours." : D.right + " of " + TOUR_N + ". Stamped.";
  return b4Page({ title: x.name, ctx: "Stamp " + n + " of " + stops.length, back: "tourBack()", cls: "tourpage tour-land", body:
    '<span hidden data-tourk="land"></span>' + tourDefs() + '<div class="tourbook one">' + tourPageHTML(pages[i], i + 1, s, { land: D.landed ? null : D.cc, visa: D.landed ? null : visa, home }) + '</div>' +
    '<p class="tourlead" role="status">' + esc(say) + '</p>' +
    (next ? b4Btn("Next stop: " + esc(next.stop.name), "tourStart('" + next.stop.cc + "')", "gold") : "") + b4Btn("Share", "tourShare()", next ? "dark" : "gold") + b4Btn("Back to the passport", "tourBack()", "quiet") });
}
function tourLand(st){
  const D = TOURD;
  if(!D || D.landed) return;
  D.landed = true;
  const x = tourFind(D.cc), slot = st.querySelector(".tourslot.landing"), page = st.querySelector(".tourpg"), visa = st.querySelector(".tourvisa.landing");
  let still = true; try{ still = !slot || reducedMotion() || lowEnd(); }catch(e){}
  const hit = () => { try{ snd.thud(); haptic("goal"); a11ySay(x.name + " stamped."); }catch(e){} };
  const gold = () => { if(D.title || visa) try{ if(TOURD === D) celebrate(D.title ? 4 : 3, { type: "tourVisa", n: D.title ? 150 : 90 }); slamfx(); }catch(e){} };
  if(still){ try{ if(slot) slot.classList.add("down", "still"); if(visa) visa.classList.add("down", "still"); }catch(e){} hit(); return gold(); }
  setTimeout(() => {
    if(TOURD !== D) return;
    slot.classList.add("down");
    setTimeout(() => {
      if(TOURD !== D) return;
      page.classList.add("thud"); hit();
      if(visa) return setTimeout(() => { if(TOURD !== D) return; visa.classList.add("down"); page.classList.remove("thud"); gold(); }, TOUR_VISA_MS);
      gold();
    }, TOUR_HIT_MS);
  }, TOUR_DROP_MS);
}
function tourDoneHTML(){
  const D = TOURD, x = tourFind(D.cc), s = tourStore(), rec = s.stamps[D.cc], short = TOUR_PASS - D.right;
  const sub = D.pass ? "You’ve had this stamp since " + tourDateLong(rec.t) + "." : (short === 1 ? "One short of the stamp." : short + " short of the stamp.") + " Nothing’s lost, and the ones you’ve just seen come last next time.";
  return b4Page({ title: x.name, ctx: D.pass ? "Stamped already" : "No stamp yet", back: "tourBack()", cls: "tourpage tour-done", body:
    tourDefs() + '<div class="tourwait">' + tourStamp(x, rec || null, { id: "d" }) + tourTen(D.picks) + '</div>' + b4Q(esc(D.right + " of " + TOUR_N), esc(sub)) +
    b4Btn(D.pass ? "Sit it again" : "Try again", "tourStart('" + D.cc + "')", D.pass ? "dark" : "gold") + b4Btn("Back to the passport", "tourBack()", "quiet") });
}
function tourShare(){
  audio();
  const s = tourStore(), text = tourShareText(TOUR_STOPS, s);
  try{ tlmEvent("share", { what: "tour" }); }catch(e){}
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}

/* ---------- getting about ---------- */
function tourClose(){
  clearTimeout(TOUR_TIMER); TOUR_TIMER = null;
  stopTimer();
  TOUR_VIEW = null; TOUR = null; TOURD = null; TOUR_PAGE = null;
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function tourBack(){
  audio();
  if(TOUR_VIEW === "done" || TOUR_VIEW === "land"){ TOURD = null; TOUR_VIEW = "book"; render(); try{ window.scrollTo(0, 0); }catch(e){} return; }
  tourClose();
}

/* ---------- the screen ---------- */
/* what the store needs from the map: the count for the shelf, and anything stamps from another phone have earned */
function tourSettle(){
  const s = tourStore(), n = TOUR_STOPS.length, won = tourAward(s, TOUR_STOPS, Date.now());
  if(s.total !== n || won.visas.length || won.title){ s.total = n; tourSave(s); }
}
function tourAfter(st){
  if(TOUR_VIEW === "land") return tourLand(st);
  if(TOUR_VIEW === "book"){ const el = st.querySelector("#tourbook"); try{ if(el) el.scrollLeft = (TOUR_PAGE | 0) * el.clientWidth; }catch(e){} }
}
function tourRender(st){
  if(!TOUR_STOPS){
    if(!TOUR_FAIL) tourFetch();
    st.innerHTML = b4Page({ title: "World Tour", ctx: TOUR_FAIL ? "Couldn’t open it" : "One moment", back: "tourBack()", cls: "tourpage", body: TOUR_FAIL ? b4Q("The map didn’t load", "Check the connection and try again.") + b4Btn("Try again", "tourRetry()", "gold") : "" });
    return;
  }
  /* something landing while a screen is up calls render(): the question, its clock and the falling stamp stay where they are */
  if((TOUR && TOUR_VIEW === "run") || TOUR_VIEW === "land"){ try{ if(st.querySelector("[data-tourk='" + (TOUR_VIEW === "land" ? "land" : tourViewKey()) + "']")){ b6Paper(true); return; } }catch(e){} }
  if(TOUR_VIEW === "run" && !TOUR) TOUR_VIEW = "book";
  if((TOUR_VIEW === "done" || TOUR_VIEW === "land") && !TOURD) TOUR_VIEW = "book";
  tourSettle();
  st.innerHTML = TOUR_VIEW === "run" ? tourRunHTML() : TOUR_VIEW === "land" ? tourLandHTML() : TOUR_VIEW === "done" ? tourDoneHTML() : tourBookHTML();
  try{ tourAfter(st); }catch(e){}
}
