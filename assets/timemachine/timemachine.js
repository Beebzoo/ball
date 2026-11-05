/* BALL 4 · TIME MACHINE: the game (_plans/games-round.md, round 3). "Survive each decade, all the way to today."

   Pick a route through football history. Five multiple-choice questions a decade, fifteen seconds each, three lives for the whole
   trip: a wrong answer or a timeout costs one. Lose the third and you're stranded in a year of that decade; get through the 2020s and
   you're home. Between decades the year rolls on like an odometer. Every question earns XP; the best is how far you got. Loaded by index.html
   (tmNeed) on the first open; the door, the store's load and save and the shelf's line are there, next to Transfer Trail's. A plain
   script with plain globals, like trail.js.

   THE SHAPE
     - TM_ROUTES is the game's data: every route, every stop, the decks a stop deals from and its line. Nothing else knows the routes.
     - ball4-tm (tmStore, always read fresh): {v, level, best: {"route-level": right}, far: {"route-level": year}, home: {…}, runs: {…},
       seen: [ids]}. A level is chosen on the route page, never on a screen of its own. Everything but seen follows the account
       (assets/sync/sync.js); seen is the last TM_SEEN_MAX questions you met, a preference, and it stays on the phone.
     - The rules are plain functions of the store and the decks (tmDeal, tmYear, tmRecord…), so _tests/timemachine-test.js can run them.
     - TM is the trip under way and TMD the last result; neither is saved. A reload is a trip abandoned: its questions went on seen as
       they came up, so reloading to get kinder ones gets you the others.
     - The right count alone orders the trips: you stop at three wrong, so more right is always further, on the same route.
     - A deck comes straight from assets/q/ (bankDecks, then qrRetier), not through needQuiz: QUIZZES only has the Eredivisie's four
       blocks, and a route wants its decades. All of a route's decks load at the tap, so the pub's wifi can't drop out at 1987.
     - The clock is the app's (startTimer). A right answer moves on by itself; a wrong one waits for a tap, since there are at most
       three in a trip and that's when you want to read the answer, or report it.

   THE LINES were checked claim by claim on 5 Nov 2026, twice, the second time by a reader told to break them (about 135 claims): champions
   against Wikipedia's lists of national champions for all six countries, finals against its list of European Cup and Champions League
   finals, the rest against a page of their own. The 2020s lines hold to the end of 2025-26 and the 2026 World Cup, and "take the next
   three", "share the rest" and the like need a look after each season. */

const TM_PER_STOP = 5, TM_LIVES = 3, TM_SECS = 15, TM_RIGHT_MS = 720, TM_SEEN_MAX = 700;
const TM_ROLL_MS = 1500, TM_BACK_MS = 1900, TM_STRAND_MS = 900;
const TM_LEVELS = [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]];
const TM_TIERS = ["easy", "normal", "hard", "extreme", "ball"];
const TM_LETTER = { e: "easy", n: "normal", h: "hard", x: "extreme", b: "ball" };
/* WHAT A STOP DEALS, easier first. The 1960s are hard for nearly everyone and last season isn't, so the same level asks more of you the
   nearer home you get, and a trip doesn't end in the first decade because nobody remembers Sparta's 1959. */
const TM_PLAN = {
  easy:   { old: "eeeen", mid: "eeenn", now: "eennn" },
  normal: { old: "eeenn", mid: "eennh", now: "ennhh" },
  hard:   { old: "nnhhx", mid: "nhhxx", now: "nhhxb" } };
const TM_FAV_CC = { nl: "ere", de: "bundesliga", it: "seriea", en: "premier", england: "premier", "gb-eng": "premier", es: "laliga", fr: "ligue1" };
const TM_WORDS = ["", "One decade", "Two decades", "Three decades", "Four decades", "Five decades", "Six decades", "Seven decades"];

const tmS = (from, to, name, decks, line) => ({ from, to, name, decks, line });
const TM_ROUTES = [
  { id: "all", league: null, name: "All football", share: "the All football route", stops: [
    tmS(1960, 1969, "The 1960s", ["ere-1956-1969", "bundesliga-1960s"], "Real Madrid’s run of five European Cups ends in 1961. Benfica, Milan and Inter win the next five, and England win the World Cup at home in 1966."),
    tmS(1970, 1979, "The 1970s", ["ere-1970s", "bundesliga-1970s"], "Total Football. Ajax win three European Cups in a row, Bayern the next three, and West Germany beat Cruyff’s Netherlands in the 1974 World Cup final."),
    tmS(1980, 1989, "The 1980s", ["ere-1980s", "bundesliga-1980s", "seriea-1980s"], "Maradona wins the 1986 World Cup for Argentina. After Heysel in 1985, English clubs are banned from Europe for five years, Liverpool for six."),
    tmS(1990, 1999, "The 1990s", ["ere-1990s", "bundesliga-1990s", "seriea-1990s", "premier-1990s", "laliga-1990s", "ligue1-1990s"], "The European Cup becomes the Champions League in 1992. The Bosman ruling lets EU players walk free when a contract ends, and France win the 1998 World Cup at home."),
    tmS(2000, 2009, "The 2000s", ["ere-2000s", "bundesliga-2000s", "seriea-2000s", "premier-2000s", "laliga-2000s", "ligue1-2000s"], "Greece win Euro 2004. Zidane is sent off in the 2006 World Cup final, and Ronaldo and Messi win their first Ballons d’Or in 2008 and 2009."),
    tmS(2010, 2019, "The 2010s", ["ere-2010s", "bundesliga-2010s", "seriea-2010s", "premier-2010s", "laliga-2010s", "ligue1-2010s"], "Spain win their first World Cup in 2010. Germany beat Brazil 7-1 in 2014, and VAR arrives at the 2018 World Cup."),
    tmS(2020, 2029, "The 2020s", ["ere-2020s", "bundesliga-2020s", "seriea-2020s", "premier-2020s", "laliga-2020s", "ligue1-2020s"], "Covid empties the grounds in 2020. Messi wins the World Cup in Qatar in 2022, and Spain win it in New Jersey in 2026.")] },
  { id: "ere", league: "ere", name: "Eredivisie", share: "the Eredivisie route", stops: [
    tmS(1956, 1969, "The 1950s and 60s", ["ere-1956-1969"], "The Eredivisie starts in 1956 and Ajax are the first champions. Rinus Michels takes over at Ajax in 1965, with a teenage Johan Cruyff in the side."),
    tmS(1970, 1979, "The 1970s", ["ere-1970s"], "Feyenoord win the European Cup in 1970, the first Dutch club to do it. Ajax win the next three."),
    tmS(1980, 1989, "The 1980s", ["ere-1980s"], "AZ take the title in 1981. Cruyff wins the double with Feyenoord in 1984, and PSV win the Treble in 1988, European Cup included."),
    tmS(1990, 1999, "The 1990s", ["ere-1990s"], "Louis van Gaal’s young Ajax go unbeaten in the league and win the Champions League in 1995. By 1997 Bosman has taken Davids, Reiziger and Kluivert to Milan for free."),
    tmS(2000, 2009, "The 2000s", ["ere-2000s"], "Feyenoord win the UEFA Cup in 2002, in their own ground. PSV win four titles in a row from 2005, and AZ end the run in 2009."),
    tmS(2010, 2019, "The 2010s", ["ere-2010s"], "Twente win their first title in 2010. Frank de Boer’s Ajax take the next four, and in 2019 a young Ajax fall seconds short of the Champions League final."),
    tmS(2020, 2029, "The 2020s", ["ere-2020s"], "The 2019-20 season stops for Covid with no champion. Arne Slot’s Feyenoord win the title in 2023, then PSV take the next three.")] },
  { id: "bundesliga", league: "bundesliga", name: "Bundesliga", share: "the Bundesliga route", stops: [
    tmS(1963, 1969, "The 1960s", ["bundesliga-1960s"], "The Bundesliga starts in 1963 without Bayern Munich, who only arrive in 1965. Köln are the first champions."),
    tmS(1970, 1979, "The 1970s", ["bundesliga-1970s"], "Borussia Mönchengladbach win five titles. Bayern Munich win three European Cups in a row."),
    tmS(1980, 1989, "The 1980s", ["bundesliga-1980s"], "Bayern win six titles, but Hamburg are the champions of Europe in 1983. Stuttgart and Werder Bremen each get a title too."),
    tmS(1990, 1999, "The 1990s", ["bundesliga-1990s"], "Reunification brings Hansa Rostock and Dynamo Dresden in 1991. Dortmund win the Champions League in 1997, and Kaiserslautern win the title straight after promotion in 1998."),
    tmS(2000, 2009, "The 2000s", ["bundesliga-2000s"], "In May 2001 Schalke’s fans are on the pitch celebrating the title when Bayern equalise in stoppage time in Hamburg. Days later Bayern win the Champions League."),
    tmS(2010, 2019, "The 2010s", ["bundesliga-2010s"], "Jürgen Klopp’s Dortmund win two titles in a row. Bayern beat them in the 2013 Champions League final, and win every title from then to 2019."),
    tmS(2020, 2029, "The 2020s", ["bundesliga-2020s"], "Bayern’s run reaches eleven in 2023. Xabi Alonso’s Leverkusen end it in 2024 without losing a league game.")] },
  { id: "seriea", league: "seriea", name: "Serie A", share: "the Serie A route", stops: [
    tmS(1980, 1989, "The 1980s", ["seriea-1980s"], "Italy lifts its ban on foreign players in 1980. Platini wins three Ballons d’Or at Juventus, and Maradona gives Napoli their first title in 1987."),
    tmS(1990, 1999, "The 1990s", ["seriea-1990s"], "Italy hosts the 1990 World Cup. Sampdoria win their only title in 1991, and Milan go 58 league games unbeaten."),
    tmS(2000, 2009, "The 2000s", ["seriea-2000s"], "Calciopoli breaks in 2006. Juventus lose two titles and go down to Serie B, and that same summer Italy win the World Cup."),
    tmS(2010, 2019, "The 2010s", ["seriea-2010s"], "José Mourinho’s Inter win the Treble in 2010. Juventus then win eight titles in a row, from 2012 to 2019."),
    tmS(2020, 2029, "The 2020s", ["seriea-2020s"], "Juventus make it nine in 2020, then Inter end the run. Napoli win their first title since Maradona’s day in 2023.")] },
  { id: "premier", league: "premier", name: "Premier League", share: "the Premier League route", stops: [
    tmS(1990, 1999, "The 1990s", ["premier-1990s"], "The Premier League starts in 1992. Alex Ferguson’s Manchester United win five of the first seven titles, the last of them in their Treble year of 1999."),
    tmS(2000, 2009, "The 2000s", ["premier-2000s"], "Roman Abramovich buys Chelsea in 2003. Arsenal go the whole 2003-04 league season unbeaten, Chelsea win the next two titles, then Manchester United win three in a row."),
    tmS(2010, 2019, "The 2010s", ["premier-2010s"], "Sergio Agüero wins Manchester City the title in stoppage time in 2012. Leicester are champions in 2016, and Pep Guardiola’s City reach 100 points in 2018."),
    tmS(2020, 2029, "The 2020s", ["premier-2020s"], "Liverpool end a 30-year wait in 2020. City win four in a row, the first men’s side in England to do it, and Arsenal end a 22-year wait in 2026.")] },
  { id: "laliga", league: "laliga", name: "La Liga", share: "the La Liga route", stops: [
    tmS(1990, 1999, "The 1990s", ["laliga-1990s"], "Johan Cruyff’s Barcelona win four titles in a row. Deportivo lose the 1994 title on a missed penalty in the last minute of the season."),
    tmS(2000, 2009, "The 2000s", ["laliga-2000s"], "Deportivo win their only title in 2000, and Valencia two under Rafa Benítez. Pep Guardiola’s Barcelona win the Treble in 2009."),
    tmS(2010, 2019, "The 2010s", ["laliga-2010s"], "Messi against Ronaldo. Barcelona and Real Madrid win nine titles in ten years, and only Diego Simeone’s Atlético break in, in 2014."),
    tmS(2020, 2029, "The 2020s", ["laliga-2020s"], "Messi leaves Barcelona in 2021, the year Atlético win the league. Real Madrid and Barcelona share the rest.")] },
  { id: "ligue1", league: "ligue1", name: "Ligue 1", share: "the Ligue 1 route", stops: [
    tmS(1990, 1999, "The 1990s", ["ligue1-1990s"], "Marseille win the Champions League in 1993, the first French club to do it. A match-fixing scandal then costs them the title and sends them down."),
    tmS(2000, 2009, "The 2000s", ["ligue1-2000s"], "Lyon win seven titles in a row from 2002 to 2008, with Juninho’s free kicks. Bordeaux stop them in 2009."),
    tmS(2010, 2019, "The 2010s", ["ligue1-2010s"], "Qatar Sports Investments buy Paris Saint-Germain in 2011, and Neymar arrives for a world record in 2017. From 2013 to 2019 only Monaco, in 2017, stop them winning the title."),
    tmS(2020, 2029, "The 2020s", ["ligue1-2020s"], "Lille beat PSG to the title in 2021. Mbappé leaves for Real Madrid in 2024, and a year later PSG win the Champions League for the first time.")] }];

let TM = null, TMD = null, TM_TIMER = null, TM_BUSY = null;
const TM_DECKS = {};

/* ---------- the rules ---------- */
const tmRoute = id => TM_ROUTES.find(r => r.id === id) || null;
const tmId = r => r.id || r.q;
const tmSlot = (route, level) => route + "-" + level;
const tmNow = () => new Date().getFullYear();
const tmEra = stop => stop.from < 1990 ? "old" : stop.from < 2010 ? "mid" : "now";
const tmPlan = (level, stop) => [...TM_PLAN[level][tmEra(stop)]].map(c => TM_LETTER[c]);
const tmLevelName = l => (TM_LEVELS.find(x => x[0] === l) || [])[1] || "";
/* THE YEAR YOU'VE REACHED, from how far through the stop you are: the fourth question of the 1980s is 1987. The 2020s aren't over, so
   a stop never runs past this year. */
function tmYear(stop, i){
  const last = Math.min(stop.to, tmNow()), span = last - stop.from + 1;
  return stop.from + Math.floor((i + .5) * span / TM_PER_STOP);
}
/* A QUESTION THAT BELONGS IN THE STOP'S YEARS. The bank files a row under every decade it mentions, so the 1990s hold "Which coach won
   Ligue 1 with PSG in 2012-13, their first title since 1994?". Nobody in a time machine should be asked about a year they haven't reached,
   and a row that only names years before the stop is in the wrong decade. A row that names no year stays where the bank put it. */
function tmInEra(r, stop){
  const ys = (String(r.q).match(/\b(?:19|20)\d\d\b/g) || []).map(Number);
  if(!ys.length) return true;
  return !ys.some(y => y > stop.to + 1) && ys.some(y => y >= stop.from - 1);
}
/* everything a stop can deal: four options, in its years, once, with its tier and deck */
function tmPool(stop, decks){
  const out = [], have = new Set();
  for(const id of stop.decks) for(const t of TM_TIERS) for(const r of ((decks[id] || {})[t] || [])){
    if(!Array.isArray(r.o) || r.o.length !== 4 || r.k == null || r.o[r.k] !== r.a || !tmInEra(r, stop) || have.has(tmId(r))) continue;
    have.add(tmId(r)); out.push(Object.assign({}, r, { tier: t, deck: id }));
  }
  return out;
}
/* A WHOLE TRIP, a list of five per stop. A question comes once, on the row's id: 219 of them are filed under two decades. For each place
   in the stop's plan, in this order: never an answer the stop already has while there's a choice, since one would give the other
   away; a question you haven't met, the tier asked for first, up to two tiers off (the small decades have four Easy rows, and a new
   question beats an old one); then one you have met, the longest ago first; a tier three off only when all that has run out. Between
   equals the deck the stop has used least, so All football's 2010s really are a mix, then chance. Within a stop the tiers climb. */
function tmDeal(route, decks, level, seen, rnd){
  rnd = rnd || Math.random;
  const met = new Map((seen || []).map((id, i) => [id, i])), used = new Set();
  return route.stops.map(stop => {
    const pool = tmPool(stop, decks), got = [], answers = new Set(), byDeck = {};
    for(const want of tmPlan(level, stop)){
      const w = TM_TIERS.indexOf(want);
      let best = null, low = Infinity;
      for(const r of pool){
        const id = tmId(r);
        if(used.has(id)) continue;
        const off = Math.abs(TM_TIERS.indexOf(r.tier) - w), again = met.has(id);
        const band = again ? (off < 2 ? 3 : off < 3 ? 4 : 6) : off < 3 ? off : 5;
        const score = (answers.has(String(r.a).toLowerCase()) ? 1e9 : 0) + band * 1e7 + (again ? met.get(id) * 100 : 0) + (byDeck[r.deck] | 0) * 10 + rnd();
        if(score < low){ low = score; best = r; }
      }
      if(!best) return null;
      used.add(tmId(best)); answers.add(String(best.a).toLowerCase()); byDeck[best.deck] = (byDeck[best.deck] | 0) + 1; got.push(best);
    }
    return got.map((r, i) => [TM_TIERS.indexOf(r.tier), i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  });
}
/* on the list as they come up, so an abandoned trip counts as met; the newest at the end, the list capped */
function tmMark(s, ids){
  const list = (s.seen || []).filter(x => !ids.includes(x)).concat(ids);
  s.seen = list.slice(Math.max(0, list.length - TM_SEEN_MAX));
}
/* a trip over. best and far only ever rise, and a level has its own */
function tmRecord(s, route, level, right, year, home){
  const k = tmSlot(route, level);
  s.best = s.best || {}; s.far = s.far || {}; s.home = s.home || {}; s.runs = s.runs || {};
  const before = s.best[k] | 0, wasHome = (s.home[k] | 0) > 0, best = right > before;
  if(best) s.best[k] = right;
  if(year > (s.far[k] | 0)) s.far[k] = year;
  if(home) s.home[k] = (s.home[k] | 0) + 1;
  s.runs[k] = (s.runs[k] | 0) + 1;
  return { best, before, firstHome: home && !wasHome };
}
/* your favourite's league first: fav.club is an identity slug, and an identity knows its country */
function tmFavRoute(){
  let f = null, cc = null;
  try{ f = (acctLocal().fav || {}).club; }catch(e){}
  if(!f) try{ f = (mine().fav || {}).club; }catch(e){}
  if(!f) return null;
  try{ cc = (clubOf(f) || {}).cc || null; }catch(e){}
  if(!cc) try{ cc = (bankClub(f) || [])[2] || null; }catch(e){}
  if(!cc) try{ cc = CLUBCC ? CLUBCC[f] : null; }catch(e){}
  return TM_FAV_CC[cc] || null;
}
function tmRoutes(){
  const fav = tmFavRoute();
  return fav ? [tmRoute(fav)].concat(TM_ROUTES.filter(r => r.id !== fav)) : TM_ROUTES.slice();
}

/* ---------- the decks ---------- */
function tmLoad(route){
  const want = [...new Set(route.stops.flatMap(s => s.decks))].filter(d => !TM_DECKS[d]);
  return Promise.all(want.map(d => fetch("assets/q/" + d + ".json").then(r => { if(!r.ok) throw new Error(d); return r.json(); })
    .then(b => { TM_DECKS[d] = qrRetier(bankDecks(b).mc); })));
}

/* ---------- the odometer ---------- */
/* WHERE EACH WHEEL STANDS at year v, thousands first. The last wheel turns all the time; a wheel above only turns while the one below it
   goes from 9 to 0, like the real thing, so 1989 to 1990 moves two wheels and 1999 to 2000 moves all four. */
function tmWheels(v){
  return [1000, 100, 10, 1].map(p => {
    if(p === 1) return ((v % 10) + 10) % 10;
    const under = ((v % p) + p) % p, turn = Math.max(0, under - (p - 1));
    return (Math.floor(v / p) + turn) % 10;
  });
}
const tmShift = pos => "translateY(" + (-pos * 100 / 11).toFixed(3) + "%)";
function tmOdo(year, size){
  const w = tmWheels(year), strip = "0123456789".split("").concat("0").map(d => '<i>' + d + '</i>').join("");
  return '<span class="tmodo ' + (size || "big") + '" role="img" aria-label="' + Math.round(year) + '">' + w.map((p, i) => '<span class="tmw' + (i === 3 ? " last" : "") + '"><span class="tms" style="transform:' + tmShift(p) + '">' + strip + '</span></span>').join("") + '</span>';
}
/* the wheels from one year to another; a tick for a year passing, a clunk on landing. Reduced motion and slow phones get the end */
function tmRoll(el, from, to, ms, done, quiet){
  let strips = [];
  try{ strips = [...el.querySelectorAll(".tms")]; }catch(e){}
  const set = v => { const w = tmWheels(v); strips.forEach((s, i) => { s.style.transform = tmShift(w[i]); }); };
  const end = () => { set(to); try{ if(!quiet) popfx(); }catch(e){} if(done) done(); };
  let still = true;
  try{ still = !strips.length || reducedMotion() || lowEnd() || typeof requestAnimationFrame !== "function"; }catch(e){}
  if(still) return end();
  const t0 = performance.now();
  let last = from, heard = 0;
  const step = now => {
    if(!el.isConnected) return;
    const t = Math.min(1, Math.max(0, (now - t0) / ms)), v = from + (to - from) * (1 - Math.pow(1 - t, 3));
    set(v);
    if(!quiet && Math.floor(v) !== Math.floor(last) && now - heard > 70){ heard = now; try{ tick(); }catch(e){} }
    last = v;
    if(t < 1) requestAnimationFrame(step); else end();
  };
  requestAnimationFrame(step);
}

/* ---------- the pieces ---------- */
/* THE LIVES ARE THREE VALVES: glass tubes with a lit filament, the sort that kept a machine running before chips. One blows when you lose a life */
const tmValve = (on, blow) => '<svg class="tmv' + (on ? " on" : "") + (blow ? " blow" : "") + '" viewBox="0 0 20 34" aria-hidden="true"><path class="g" d="M4 25V11a6 6 0 0 1 12 0v14z"/><path class="f" d="M7.5 24v-7c0-3.2 1.2-5 2.5-5s2.5 1.8 2.5 5v7"/><path class="b" d="M3 25h14v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path class="p" d="M7 30v3M13 30v3"/></svg>';
function tmValves(lives, blow){
  return '<span class="tmvs" role="img" aria-label="' + lives + (lives === 1 ? " life" : " lives") + ' left">' + Array.from({ length: TM_LIVES }, (_, i) => tmValve(i < lives, blow && i === lives)).join("") + '</span>';
}
/* the decades of a route, as far as you've been: gold behind you, ringed where you are, red where you fell */
function tmPath(R, at, fell){
  return '<span class="tmpath" aria-hidden="true">' + R.stops.map((s, i) => '<i class="' + (fell && i === at ? "fell" : i < at ? "past" : i === at ? "now" : "") + '">' + String(s.from).slice(2, 3) + '0</i>').join("") + '</span>';
}
/* the furthest stop a year reaches on this route */
const tmStopOf = (R, year) => R.stops.reduce((n, s, i) => year >= s.from ? i : n, -1);
const tmGlobe = () => '<svg class="tmglobe" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';

/* ---------- the route page ---------- */
function tmCard(R, s, level, fav){
  const k = tmSlot(R.id, level), far = (s.far || {})[k] | 0, right = (s.best || {})[k] | 0, home = (s.home || {})[k] | 0, busy = TM_BUSY === R.id;
  const first = R.stops[0], at = home ? R.stops.length : far ? tmStopOf(R, far) : -1;
  const since = "from the " + Math.floor(first.from / 10) * 10 + "s", sub = busy ? "One moment…" : fav ? "Your league · " + since : TM_WORDS[R.stops.length] + ", " + since;
  const end = home ? '<b class="h">Home</b><small>' + right + ' right</small>' : far ? '<b>' + far + '</b><small>' + right + ' right</small>' : '<b class="n">–</b><small>Best</small>';
  const say = R.name + ", " + TM_WORDS[R.stops.length].toLowerCase() + (home ? ", made it home" : far ? ", reached " + far : "");
  return '<button class="tmroute' + (R.id === "all" ? " head" : "") + '" onclick="tmStart(\'' + R.id + '\')" aria-label="' + esc(say) + '"' + (TM_BUSY ? " disabled" : "") + '>' +
    '<span class="a">' + (R.league ? (compBadge(R.league, 44) || tmGlobe()) : tmGlobe()) + '</span><span class="m"><b>' + esc(R.name) + '</b><small>' + esc(sub) + '</small>' + tmPath(R, at) + '</span><span class="r">' + end + '</span></button>';
}
function tmPickHTML(){
  const s = tmStore(), level = TM_PLAN[s.level] ? s.level : "normal", fav = tmFavRoute(), tried = Object.keys(s.far || {}).length;
  const pill = l => '<button class="' + (l[0] === level ? "on" : "") + '" onclick="tmLevel(\'' + l[0] + '\')" aria-pressed="' + (l[0] === level) + '">' + l[1] + '</button>';
  return b4Page({ title: "Time Machine", ctx: tried ? "Your furthest trips" : "Three lives, every decade", back: "tmBack()", cls: "tmpage tm-pick", body:
    '<p class="tmlead">Five questions a decade, three lives for the whole trip. Get through them all and you’re home.</p>' +
    '<div class="tmlevels" role="group" aria-label="Level">' + TM_LEVELS.map(pill).join("") + '</div>' +
    tmRoutes().map(R => tmCard(R, s, level, R.id === fav)).join("") });
}
function tmLevel(l){
  audio();
  if(!TM_PLAN[l]) return;
  try{ haptic("select"); }catch(e){}
  const s = tmStore(); s.level = l; tmSave(s);
  render();
}

/* ---------- between decades ---------- */
const tmStopName = st => st.name.replace(/^The/, "the");
function tmRollHTML(){
  const R = tmRoute(TM.route), st = R.stops[TM.s], n = R.stops.length;
  return b4Page({ title: "Time Machine", ctx: R.name + " · Stop " + (TM.s + 1) + " of " + n, back: "tmAskLeave()", leave: "tmAskLeave()", cls: "tmpage tm-roll" + (TM.s ? "" : " first"), body:
    '<span hidden data-tmk="' + tmViewKey() + '"></span>' +
    '<div class="tmdeck">' + tmOdo(TM.rollFrom, "big") + tmPath(R, TM.s) + tmValves(TM.lives) + '</div>' +
    '<div class="tmline"><b>' + esc(st.name) + '</b><p>' + esc(st.line) + '</p></div>' +
    b4Btn("Into " + esc(tmStopName(st)), "tmGo()", "gold") });
}
function tmGo(){
  if(!TM || TM_VIEW !== "roll") return;
  audio();
  try{ haptic("select"); }catch(e){}
  TM_VIEW = "run";
  tmShow();
}

/* ---------- the trip ---------- */
const tmViewKey = () => TM_VIEW === "roll" ? "r" + TM.s : TM.s + "-" + TM.i + (TM.shown ? "s" : "q");
const tmQ = () => TM.deal[TM.s][TM.i];
function tmRunHTML(){
  const R = tmRoute(TM.route), st = R.stops[TM.s], Q = tmQ(), shown = TM.shown, picks = TM.picks[TM.s] || [];
  const pip = i => '<i class="' + (i < picks.length ? (picks[i] ? "hit" : "miss") : i === TM.i ? "cur" : "") + '"></i>';
  const opts = Q.o.map((t, i) => '<button class="h2opt' + (shown ? (i === Q.k ? " right" : i === TM.pick ? " wrong" : " dim") : "") + '"' + (shown ? " disabled" : "") + ' onclick="tmAnswer(' + i + ')"><span class="k">' + "ABCD"[i] + '</span>' + esc(String(t)) + '</button>').join("");
  const clock = shown ? '<div class="clock tmclock tmstop"><div class="bar"><i style="width:' + Math.round(100 * Math.max(0, TM.left) / TM_SECS) + '%"></i></div><div class="digits">' + Math.max(0, TM.left).toFixed(1) + '</div></div>'
    : '<div class="clock tmclock" id="clock" role="timer"><div class="bar"><i style="width:100%"></i></div><div class="digits">' + TM_SECS + '.0</div></div>';
  const next = shown && !picks[TM.i] ? b4Btn(TM.lives ? "Next question" : "Out of lives", "tmNext()", "gold") : "";
  return b4Page({ title: st.name, ctx: R.name + " · " + (TM.i + 1) + " of " + TM_PER_STOP, back: "tmAskLeave()", leave: "tmAskLeave()", cls: "tmpage tm-run", body:
    '<span hidden data-tmk="' + tmViewKey() + '"></span>' +
    '<div class="tmdash">' + tmOdo(st.from, "mini") +
      '<span class="tmfive" role="img" aria-label="' + picks.filter(Boolean).length + ' right this decade">' + Array.from({ length: TM_PER_STOP }, (_, i) => pip(i)).join("") + '</span>' + tmValves(TM.lives, TM.blow) + '</div>' +
    clock +
    '<div class="qcard tmq' + (shown ? "" : " qin") + '"><div class="qtext">' + esc(String(Q.q)) + '</div><div class="tmopts">' + opts + '</div>' +
      '<div class="tmsay" role="status">' + esc(TM.say || "") + '</div></div>' + next });
}
function tmShow(){
  const Q = tmQ();
  TM.shown = false; TM.pick = null; TM.say = ""; TM.blow = false; TM.left = TM_SECS;
  const s = tmStore(); tmMark(s, [tmId(Q)]); tmSave(s);
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  startTimer(TM_SECS, tmTimeUp, "tm:" + TM.n + ":" + TM.s + ":" + TM.i);
}
function tmAnswer(i){
  if(!TM || TM.shown || TM_VIEW !== "run") return;
  audio();
  TM.left = Math.max(0, (T.deadline - performance.now()) / 1000);
  stopTimer();
  tmReveal(i);
}
function tmTimeUp(){ if(!TM || TM.shown) return; TM.left = 0; stopTimer(); tmReveal(-1); }
function tmReveal(i){
  const Q = tmQ(), ok = i === Q.k;
  TM.shown = true; TM.pick = i;
  (TM.picks[TM.s] = TM.picks[TM.s] || []).push(ok);
  if(ok) TM.right++;
  else { TM.lives--; TM.wrong++; TM.blow = true; }
  try{ progAnswer({ ok, tier: Q.tier, topic: topicKey(Q.deck) || "general" }); }catch(e){}
  try{ if(ok) fb.correct(null); else if(i >= 0) fb.wrong(null); else fb.run = 0; }catch(e){}
  const left = TM.lives === 2 ? "Two lives left." : TM.lives === 1 ? "One life left." : "That was your last life.";
  TM.say = ok ? "Right." : (i < 0 ? "Out of time. " : "") + left;   // the green option is the answer: an answer can be a whole sentence
  try{ a11ySay(ok ? TM.say : "It was " + Q.o[Q.k] + ". " + TM.say); }catch(e){}
  render();
  if(ok){ clearTimeout(TM_TIMER); const run = TM; TM_TIMER = setTimeout(() => { if(TM === run) tmNext(); }, TM_RIGHT_MS); }
}
/* the next question, the next decade, stranded, or home */
function tmNext(){
  if(!TM || !TM.shown) return;
  audio();
  clearTimeout(TM_TIMER); TM_TIMER = null;
  if(TM.lives <= 0) return tmFinish("stranded");
  TM.i++;
  if(TM.i < TM_PER_STOP) return tmShow();
  const R = tmRoute(TM.route);
  if(TM.s + 1 >= R.stops.length) return tmFinish("home");
  TM.rollFrom = R.stops[TM.s].from;
  TM.s++; TM.i = 0; TM.shown = false; TM.blow = false;
  TM_VIEW = "roll"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
/* a route picked: its decks first, then the trip, starting with the fall back through the years */
function tmStart(id){
  audio();
  const R = tmRoute(id);
  if(!R || TM_BUSY) return;
  if(R.stops.some(st => st.decks.some(d => !TM_DECKS[d]))){
    TM_BUSY = id; render();
    return tmLoad(R).then(() => { TM_BUSY = null; if(TM_VIEW === "pick" || TM_VIEW === "done") tmStart(id); },
      () => { TM_BUSY = null; render(); toast("That didn’t load. Try again in a moment.", true); });
  }
  const s = tmStore(), level = TM_PLAN[s.level] ? s.level : "normal", deal = tmDeal(R, TM_DECKS, level, s.seen || []);
  if(!deal || deal.some(x => !x)) return toast("We’re short of questions for this route. Try another one.", true);
  try{ wakeLock(); }catch(e){}
  try{ fb.run = 0; }catch(e){}
  TM = { route: id, level, deal, n: Date.now(), s: 0, i: 0, lives: TM_LIVES, right: 0, wrong: 0, picks: [], shown: false, pick: null, say: "", blow: false, left: TM_SECS, rollFrom: tmNow() };
  TMD = null;
  TM_VIEW = "roll"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function tmFinish(how){
  if(!TM) return;
  clearTimeout(TM_TIMER); TM_TIMER = null; stopTimer();
  try{ progSave(progLoad()); }catch(e){}
  const R = tmRoute(TM.route), home = how === "home", answered = TM.right + TM.wrong;
  if(how === "left" && !answered){ TM = null; TM_VIEW = "pick"; render(); return; }
  const stop = R.stops[TM.s], year = home ? tmNow() : tmYear(stop, Math.min(TM.i, TM_PER_STOP - 1));
  const s = tmStore(), rec = tmRecord(s, TM.route, TM.level, TM.right, year, home);
  tmSave(s);
  try{ tlmEvent("tm_done", { route: TM.route, level: TM.level, right: TM.right, year, home: home ? 1 : 0 }); }catch(e){}
  const cleared = home ? R.stops.length : TM.s;
  TMD = { route: TM.route, level: TM.level, how, home, year, right: TM.right, lives: TM.lives, at: TM.s, cleared, best: rec.best, before: rec.before, firstHome: rec.firstHome, rolled: false };
  TM = null; TM_VIEW = "done";
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function tmAskLeave(){
  audio();
  if(TM_TIMER) return;   // the answer is landing: a moment, and it's the next question
  const st = TM ? tmRoute(TM.route).stops[TM.s] : null, answered = TM ? TM.right + TM.wrong : 0;
  sheet('<h2>End the trip?</h2><p>' + (answered ? "You’d stay in " + tmYear(st, Math.min(TM.i, TM_PER_STOP - 1)) + ", with " + TM.right + " right." : "You’re only just setting off.") + '</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep going</button><button class="b4btn quiet" onclick="tmLeave()">End it</button>');
}
function tmLeave(){ audio(); closeSheet(); if(TM) tmFinish("left"); }
/* the line under a revealed question reports this question */
function tmQrep(){
  if(!TM || !TM.shown) return null;
  const Q = tmQ(), anchor = document.querySelector("#stage .tmq");
  return Q && anchor ? { q: Q.q, a: Q.o[Q.k], deck: Q.deck, tier: Q.tier, anchor } : null;
}

/* ---------- the end card ---------- */
function tmHeadline(D){ return D.home ? "Made it home" : D.how === "left" ? "Stepped out in " + D.year : "Stranded in " + D.year; }
function tmDoneHTML(){
  const D = TMD, R = tmRoute(D.route), s = tmStore(), k = tmSlot(D.route, D.level), best = (s.best || {})[k] | 0, st = R.stops[D.at], n = R.stops.length;
  const sub = D.home ? (D.lives === TM_LIVES ? "Every decade, and not a life lost." : "Every decade, with " + (D.lives === 2 ? "two lives" : "one life") + " to spare.")
    : D.cleared ? "You got through " + D.cleared + " of " + n + " decades." : "You never got out of " + tmStopName(st) + ".";
  return b4Page({ title: "Time Machine", ctx: R.name + (D.level === "normal" ? "" : " · " + tmLevelName(D.level)), back: "tmBack()", cls: "tmpage tm-done", body:
    '<div class="tmdeck' + (D.home ? " home" : " out") + (D.rolled ? " rested" : "") + '">' + tmOdo(D.rolled ? D.year : st.from, "big") + tmPath(R, D.home ? n : D.at, !D.home) + tmValves(D.lives) + '</div>' +
    b4Q(esc(tmHeadline(D)), esc(sub)) +
    '<div class="tmscore"><span><b>' + D.right + '</b>right</span><span><b>' + D.cleared + '</b>' + (D.cleared === 1 ? "decade" : "decades") + '</span><span class="g"><b>' + best + '</b>' + (D.best ? "new best" : "best") + '</span></div>' +
    b4Btn("Go again", "tmStart('" + D.route + "')", "gold") + b4Btn("Share", "tmShare()", "dark") + b4Btn("Change route", "tmBack()", "quiet") });
}
function tmShareText(D){
  const R = tmRoute(D.route), lvl = D.level === "normal" ? "" : " (" + tmLevelName(D.level) + ")", did = D.home ? "made it home" : D.how === "left" ? "stepped out in " + D.year : "stranded in " + D.year;
  return "BALL · Time Machine: " + did + " with " + R.share + ", " + D.right + " right" + lvl + "\nFive questions a decade, three lives for the whole trip. Can you get home?\nballquiz.app";
}
function tmShare(){
  audio();
  if(!TMD) return;
  try{ tlmEvent("share", { what: "tm" }); }catch(e){}
  const text = tmShareText(TMD);
  try{ if(navigator.share) return navigator.share({ title: "BALL", text }).catch(() => {}); }catch(e){}
  try{ navigator.clipboard.writeText(text).then(() => toast("Copied. Send it on."), () => toast("Could not copy", true)); }catch(e){ toast("Could not copy", true); }
}

/* ---------- getting about ---------- */
function tmClose(){
  clearTimeout(TM_TIMER); TM_TIMER = null;
  stopTimer();
  TM_VIEW = null; TM = null; TMD = null;
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function tmBack(){
  audio();
  if(TM_VIEW === "done"){ TMD = null; TM_VIEW = "pick"; render(); try{ window.scrollTo(0, 0); }catch(e){} return; }
  tmClose();
}

/* ---------- the screen ---------- */
/* what moves once a screen is up: the year on to the next decade, and at the end on from the decade you were in, to this year or to
   wherever the machine gave out. The dash holds the decade while you play, since a year that ticked on would say 1957 over a question
   about 1967-68. */
function tmAfter(st){
  if(TM_VIEW === "roll"){
    const R = tmRoute(TM.route), to = R.stops[TM.s].from;
    tmRoll(st.querySelector(".tmodo"), TM.rollFrom, to, TM.s ? TM_ROLL_MS : TM_BACK_MS);
  }else if(TM_VIEW === "done" && !TMD.rolled){
    TMD.rolled = true;
    const D = TMD, from = tmRoute(D.route).stops[D.at].from, el = st.querySelector(".tmodo");
    if(!D.home) return tmRoll(el, from, D.year, TM_STRAND_MS, () => { try{ el.classList.add("gave"); }catch(e){} }, true);
    tmRoll(el, from, D.year, TM_ROLL_MS, () => { try{ if(TMD === D) celebrate(D.firstHome ? 4 : 3, { type: "tmHome", n: D.firstHome ? 150 : 80 }); slamfx(); haptic("goal"); }catch(e){} });
  }
}
function tmRender(st){
  /* something landing while a screen is up calls render(): the question, its clock and the rolling wheels stay where they are */
  if(TM && (TM_VIEW === "run" || TM_VIEW === "roll")){ try{ if(st.querySelector("[data-tmk='" + tmViewKey() + "']")){ b6Paper(true); return; } }catch(e){} }
  if((TM_VIEW === "run" || TM_VIEW === "roll") && !TM) TM_VIEW = "pick";
  if(TM_VIEW === "done" && !TMD) TM_VIEW = "pick";
  st.innerHTML = TM_VIEW === "run" ? tmRunHTML() : TM_VIEW === "roll" ? tmRollHTML() : TM_VIEW === "done" ? tmDoneHTML() : tmPickHTML();
  try{ tmAfter(st); }catch(e){}
}
