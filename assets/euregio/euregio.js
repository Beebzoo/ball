/* BALL 4 · EUREGIO ZONE: the region's home (Martijn, 6 Nov 2026). "BALL starts in the Euregio."

   It opens on the Euregio League: a map of the region on grass, a road of twelve away days out of your own town and a final at the Three-Country Point. Behind
   it, on the second tab, the Euregio Quiz, the region's clubs and how far you are with each, the Limburg League ready to start, and the region's next European
   night. Loaded by index.html (ezNeed) on the first open with geo.js, the borders and the Maas; the door, the store's load and save and the shelf's line are
   there, next to World Tour's. A plain script with plain globals, like tour.js.

   THE ROAD
     - You pick who you take on the road: any club on the map, or your own founded club. A real club is its real squad, name and kit (its eleven comes from the pool, so
       Roda JC and Aachen can be played here though CLUB_NO_SIDE keeps them out of Matchday) and its town is home, its stop gone. A founded club plays from Maastricht with
       MVV's men, or your favourite's if that's one of the region's. Each club keeps its own road, so changing club wipes nothing.
     - The roads run both ways (EZ_ROADS), so any town can be home: a ground is open next to home or next to one you've won. The final, at the Three-Country Point, opens
       when every other ground is won. ezStates reads that from one club's wins and nothing else. The coordinates are the grounds', so the kilometres are worked out.
     - TWO GAMES A DAY, in all, on any open grounds and as any club (dayKey's day). A win and a loss each use one; leaving uses nothing. A won ground can't be played again
       while there's more to win; once the whole road and the final are won, all of them can.
     - An away day is a real Matchday: you against them, every question from their deck (S.qdeck), first to three or ninety minutes then penalties, all Matchday's own. The
       sides are one small pool, assets/euregio/clubs.json (_tools/build-euregio-clubs.js says where each came from, and which nationalities were filled in).
     - S.ez marks the match, and Matchday's code knows it in a handful of guarded places, each one line, so nothing changes for any other match: save (never
       parked), toMenu and askEnd (leaving counts as nothing), endGame (full time is ezFullTime), h2PoolOk (the pool), h2Draw (a thin tier goes to the next tier of the same club,
       never to the whole of football), progMatchEnd and progQueueMatch (the scarf is theirs, here and on the server).
     - The opposition's level is a decision, not a law: Easy next door, Medium along the road, Hard far away and in the final (ezLevelOf).
     - THE FRIENDS' TABLE is a Call It league: supabase/migrations/021_euregio.sql. ezReport puts each finished game on a small queue on this phone and sends it from there;
       its id is a uuid made on the phone, so a retry counts once. The app works in full without 021: a missing function just keeps the game for later, and the table says Coming
       soon. The phone's own games are the player's two a day, whatever the server says: a game it refuses goes off the queue and stays in s.games.
     - The Euregio XI are built at the kick off: a 4-3-3 of the other clubs' first-choice men, shared out evenly, against every deck on the road.
     - The map is the design's scale and pans sideways (EZ_LONS), opening on home, with the dock staying put: shrinking it to fit Leverkusen would collide Sittard, Kerkrade
       and Aachen. geo.js is cut from Natural Earth by _tools/build-euregio-geo.js. The grey dots (EZ_SOON) are the closest clubs of all, with no questions or squads yet.
       grass.jpg is its own: the app's grass has a pitch's white lines in it, and on a map those read as roads.

   THE CLUBS
     - EZ_CLUBS is the region, by the bank's slug. A club is on the Zone while clubExpertReady says so, so Lommel, which sits right on the bar, comes and goes with
       the bank and needs no code. key is the fixture feed's: only the clubs with one are in the Limburg League or on a European night. The three far Bundesliga clubs are
       on the road and in the tiles, and stay out of the quiz, which is the region's own.
     - A club's look is generated (clubOf, through crestURL): never a real crest. The bank spells Roda JC differently from clubs-identity.json,
       and BANK_SPELT is read backwards to find it. Before CLUBID lands a club is the house's green and cream, for the moment that takes.
     - Your favourite goes first if it's one of them, then the Dutch, the Belgians and the Germans.

   THE QUIZ
     - Ten multiple choice, twenty seconds each, EZ_PLAN's climb, at most two from one club, never an answer twice. The questions come straight
       from assets/q/club-<slug>.json (bankDecks, then qrRetier), all of them at the tap, like World Tour's. The decks share questions (a
       transfer from Fortuna to MVV is in both), so ezPool takes each one once.
     - A question names its club, so it reads fine out of its own deck. The club's patch shows only once it's answered: "Which Belgian club..."
       with Lommel's patch beside it would be a gift.
     - XP on every question, the app's clock, a right answer moves on by itself and a wrong one waits for a tap, because that's when the bank's
       fact is worth reading. All World Tour's.
     - topicKey reads a club's league from QUIZZES, and CLUB_NO_SIDE's five have no view there, so MVV, Roda JC, VVV, Aachen and Düsseldorf
       count as "general" and the other five as their league.

   THE SHAPE
     - ball4-euregio (ezStore, always read fresh): {v, best, runs, seen: [ids], as, roads: {as: {stop: {m, o, p, t}}}, games: [{day, stop, club, gf, ga, win, id}], out: [games not reported yet]}. best is out of ten; as is who you
       play as; m and o the goals, p the shootout or null, t when. games is every finished game, the friends' table's raw material: ezReport is the one place it leaves the
       phone. seen and out stay on the phone (assets/sync/sync.js), the rest follows the account: best can only rise, a won ground is never lost and a game is kept by its id.
     - The rules are plain functions of the store and the decks (ezStates, ezPlayable, ezLeft, ezResult, ezEleven, ezPool, ezDeal, ezRecord, ezNightOf...), so _tests/euregio-test.js can run them.
     - EZ is the quiz under way and EZD its result, EZW the win on screen; none of them is saved. A reload is a quiz abandoned: its questions went on seen as they came up.
     - EZ_NIGHT is memory only and the page never waits for it: it draws without the card, and the slot fills if the answer comes.

   GETTING ABOUT
     - A club's tile goes to its Club Expert page and back here: EZ_VIEW goes to null on the way out, as Fanbase Battle's does, so nothing else
       on the phone can land on a stale Zone, and expClose brings it back (ezReturn).
     - The Limburg League is Call It's own new-league page with the name and the clubs filled in (clNewFilled in pl.js), so a guest, a player
       with no username and an under-16 meet exactly what New league does to them. */

const EZ_N = 10, EZ_SECS = 20, EZ_MAX_CLUB = 2, EZ_SEEN_MAX = 1000, EZ_RIGHT_MS = 720, EZ_NIGHT_MS = 10 * 60e3;
const EZ_TIERS = ["easy", "normal", "hard", "extreme", "ball"];
const EZ_LETTER = { e: "easy", n: "normal", h: "hard", x: "extreme", b: "ball" };
const EZ_WORD = { easy: "Easy", normal: "Normal", hard: "Hard", extreme: "Extreme", ball: "Ball" };
/* World Tour's climb: three Easy, three Normal, three Hard and one Extreme to finish */
const EZ_PLAN = "eeennnhhhx";
/* the region. team is the side in the pool; far is on the road and in the tiles but not in the quiz */
const EZ_CLUBS = [
  { slug: "mvv-maastricht", key: "af:412", team: "MVV Maastricht" }, { slug: "roda-jc", key: "af:414", team: "Roda JC Kerkrade" }, { slug: "fortuna-sittard", key: "af:205", team: "Fortuna Sittard" },
  { slug: "vvv-venlo", key: "af:204", team: "VVV-Venlo" }, { slug: "genk", key: "af:742", team: "Genk" }, { slug: "sint-truidense", key: "af:735", team: "Sint-Truiden" },
  { slug: "standard-liege", key: "af:733", team: "Standard Liège" }, { slug: "lommel", key: "af:259", team: "Lommel" },
  { slug: "alemannia-aachen", key: null, team: "Alemannia Aachen" }, { slug: "fortuna-dusseldorf", key: null, team: "Fortuna Düsseldorf" },
  { slug: "borussia-monchengladbach", key: null, team: "Gladbach", far: true }, { slug: "koln", key: null, team: "Köln", far: true }, { slug: "bayer-leverkusen", key: null, team: "Bayer Leverkusen", far: true }];
/* the thirteen grounds, where they really are. dx and dy keep the three in the east apart; lab t puts a name above its shield */
const EZ_STOPS = [
  { id: "mvv", slug: "mvv-maastricht", city: "Maastricht", ground: "De Geusselt", lat: 50.8574, lon: 5.7136 },
  { id: "for", slug: "fortuna-sittard", city: "Sittard", ground: "Fortuna Sittard Stadion", lat: 50.9975, lon: 5.8553 },
  { id: "gnk", slug: "genk", city: "Genk", ground: "Cegeka Arena", lat: 51.0047, lon: 5.5333 },
  { id: "stv", slug: "sint-truidense", city: "Sint-Truiden", ground: "Stayen", lat: 50.8136, lon: 5.1650 },
  { id: "rod", slug: "roda-jc", city: "Kerkrade", ground: "Parkstad Limburg Stadion", lat: 50.8561, lon: 6.0069, lab: "t", dx: -5, dy: -5 },
  { id: "sta", slug: "standard-liege", city: "Liège", ground: "Sclessin", lat: 50.6100, lon: 5.5436 },
  { id: "lom", slug: "lommel", city: "Lommel", ground: "Soevereinstadion", lat: 51.2067, lon: 5.3100 },
  { id: "ale", slug: "alemannia-aachen", city: "Aachen", ground: "Tivoli", lat: 50.7936, lon: 6.0969, dx: 3, dy: 1 },
  { id: "vvv", slug: "vvv-venlo", city: "Venlo", ground: "Covebo Stadion De Koel", lat: 51.3644, lon: 6.1683 },
  { id: "bmg", slug: "borussia-monchengladbach", city: "Mönchengladbach", ground: "Borussia-Park", lat: 51.1746, lon: 6.3855 },
  { id: "f95", slug: "fortuna-dusseldorf", city: "Düsseldorf", ground: "Merkur Spiel-Arena", lat: 51.2616, lon: 6.7331 },
  { id: "koe", slug: "koln", city: "Cologne", ground: "RheinEnergieStadion", lat: 50.9335, lon: 6.8750 },
  { id: "b04", slug: "bayer-leverkusen", city: "Leverkusen", ground: "BayArena", lat: 51.0383, lon: 7.0023 }];
const EZ_FINAL = { id: "final", city: "Three-Country Point", ground: "Three-Country Point", lat: 50.7548, lon: 6.0208, dx: -14, dy: 22 };
/* THE ROADS RUN BOTH WAYS. A third entry bends a road the other way, so it doesn't lie across a label. EZ_LAST is the walk to the final, drawn but opened by ezStates */
const EZ_ROADS = [["mvv", "for"], ["mvv", "gnk"], ["mvv", "stv", 1], ["mvv", "sta"], ["for", "rod"], ["gnk", "lom"], ["rod", "ale"], ["for", "vvv"], ["vvv", "bmg"], ["ale", "bmg"],
  ["bmg", "f95"], ["ale", "koe"], ["f95", "koe"], ["koe", "b04"]];
const EZ_LAST = ["ale", "final"];
const EZ_GAMES = 2, EZ_GAMES_MAX = 400, EZ_SCARF_CROP = 9;
const EZ_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* the report queue: the most it holds, how long it waits after a bad moment, and how long after slow_down or a server without 021. Only these two codes are worth asking again */
const EZ_OUT_MAX = 20, EZ_HOLD_MS = 120000, EZ_SLOW_MS = 600000, EZ_RETRY = ["slow_down", "not_signed_in"];
const EZ_POOL = "euregio-clubs", EZ_XI = "Euregio XI", EZ_ALL = "euregio-all";
const EZ_SHAPE = [["GK", 1], ["DF", 4], ["MF", 3], ["FW", 3]];
/* how far the map runs, west to east, and north to south for the fit */
const EZ_LONS = [4.98, 7.26], EZ_LATS = [51.3644, 50.61], EZ_OPEN_AT = .57;
/* the closest clubs of all, with no questions or squads yet */
const EZ_SOON = [["Patro Eisden", 50.98, 5.70], ["RFC Liège", 50.65, 5.57], ["Sporting Hasselt", 50.93, 5.33], ["Seraing", 50.60, 5.50], ["KAS Eupen", 50.63, 6.04]];
/* English on the map like everywhere else; the rivers keep the names people use for them */
const EZ_PLACES = [["Netherlands", 5.72, 51.25], ["Belgium", 5.27, 50.69], ["Germany", 6.55, 50.72], ["Maas", 5.263, 50.568, 0, "river"], ["Rhine", 6.93, 51.13, 0, "river"]];
const EZ_LANDS = ["nl", "be", "de"];
/* Martijn's list, in his order. Standard is in as the region's big neighbour, whatever the name says */
const EZ_LEAGUE = { name: "Limburg League", slugs: ["mvv-maastricht", "roda-jc", "vvv-venlo", "fortuna-sittard", "genk", "sint-truidense", "lommel", "standard-liege"] };
const EZ_COMPS = { "fb.CL": ["ucl", "Champions League"], "fb.EL": ["uel", "Europa League"], "fb.ECL": ["uecl", "Conference League"] };

let EZT = null, EZ_FLUSHING = false, EZ_HOLD = 0, EZ_MIGRATED = false;
let EZ = null, EZD = null, EZW = null, EZ_TIMER = null, EZ_BUSY = false, EZ_NIGHT = null, EZ_NIGHT_AT = 0, EZ_STOP = null, EZ_PAN = null;
const EZ_DECKS = {};

/* ---------- the clubs ---------- */
const ezClubs = () => EZ_CLUBS.filter(c => clubExpertReady(bankClub(c.slug)));
const ezQuizClubs = () => ezClubs().filter(c => !c.far);
const ezDeckOf = slug => "club-" + slug;
function ezLook(slug){
  const r = bankClub(slug), name = r ? r[1] : slug, id = Object.keys(BANK_SPELT).find(k => BANK_SPELT[k] === slug) || slug;
  return Object.assign({ code: name.slice(0, 3).toUpperCase(), c1: "#123D24", c2: "#F8F1DD", p: "plain" }, clubOf(slug) || clubOf(id) || {}, { name });
}
/* the generated patch; anywhere that can't draw (no canvas, tests) its colours and its code stand in */
function ezPatch(slug, w, cls){
  const L = ezLook(slug), u = crestURL(slug, "patch", w * 3, L), c = "ezpatch" + (cls ? " " + cls : "");
  if(u) return '<img class="' + c + '" width="' + w + '" height="' + Math.round(w * 7 / 6) + '" alt="" src="' + u + '">';
  return '<span class="' + c + ' plain" style="--ec1:' + L.c1 + ';--ec2:' + L.c2 + ';width:' + w + 'px;height:' + Math.round(w * 7 / 6) + 'px" aria-hidden="true">' + esc(L.code) + '</span>';
}
/* your club, on the phone's account or in the Daily's save, when it's one of ours */
function ezFav(list){
  let f = null;
  try{ f = (acctLocal().fav || {}).club; }catch(e){}
  if(!f) try{ f = (mine().fav || {}).club; }catch(e){}
  const r = f ? bankClub(f) : null;
  return r && list.some(c => c.slug === r[0]) ? r[0] : null;
}
/* YOUR FAVOURITE, THEN THE DUTCH, THE BELGIANS AND THE GERMANS */
function ezOrder(list, fav){
  const land = c => { const r = bankClub(c.slug), i = EZ_LANDS.indexOf(r ? r[2] : ""); return i < 0 ? EZ_LANDS.length : i; };
  return list.map((c, i) => [c, i]).sort((a, b) => (b[0].slug === fav) - (a[0].slug === fav) || land(a[0]) - land(b[0]) || a[1] - b[1]).map(x => x[0]);
}
/* Club Expert's three passes, from its own store: the Zone never needs expert.js to say how you stand */
const ezPasses = (s, slug) => Object.keys(((s.clubs || {})[slug] || {}).days || {}).length;
const ezTeams = () => EZ_LEAGUE.slugs.map(x => EZ_CLUBS.find(c => c.slug === x).key);
const ezNames = () => { const o = {}; for(const x of EZ_LEAGUE.slugs) o[EZ_CLUBS.find(c => c.slug === x).key] = ezLook(x).name; return o; };

/* ---------- the rules of a quiz ---------- */
const ezId = r => r.id || r.q;
const ezAns = a => String(a).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const ezOptsOk = r => Array.isArray(r.o) && r.o.length === 4 && r.k != null && r.o[r.k] === r.a && new Set(r.o.map(ezAns)).size === 4;
/* everything the region can deal: four clean options, each question once, with its tier and its club. decks is by slug */
function ezPool(clubs, decks){
  const out = [], ids = new Set(), asked = new Set();
  for(const c of clubs) for(const t of EZ_TIERS) for(const r of ((decks[c.slug] || {})[t] || [])){
    const q = ezAns(r.q);
    if(!ezOptsOk(r) || ids.has(ezId(r)) || asked.has(q)) continue;
    ids.add(ezId(r)); asked.add(q);
    out.push(Object.assign({}, r, { tier: t, deck: ezDeckOf(c.slug), slug: c.slug, ans: ezAns(r.a), at: EZ_TIERS.indexOf(t) }));
  }
  return out;
}
/* A WHOLE QUIZ, World Tour's way. For each place in the plan: never an answer the quiz already has, and never a third from one club. Then a
   question you haven't met, the tier asked for first and up to two off; then one you have, the longest ago first; a tier further off only when
   all that has run out. Between equals the club with the fewest so far, then chance, so ten clubs share ten questions. The tiers climb. Null if it can't. */
function ezDeal(pool, seen, rnd){
  rnd = rnd || Math.random;
  const met = new Map((seen || []).map((id, i) => [id, i])), used = new Set(), answers = new Set(), per = {}, got = [];
  for(const c of EZ_PLAN){
    const w = EZ_TIERS.indexOf(EZ_LETTER[c]);
    let best = null, low = Infinity;
    for(const r of pool){
      const id = ezId(r), n = per[r.slug] | 0;
      if(used.has(id) || answers.has(r.ans) || n >= EZ_MAX_CLUB) continue;
      const off = Math.abs(r.at - w), again = met.has(id);
      const band = again ? (off < 2 ? 3 : off < 3 ? 4 : 6) : off < 3 ? off : 5;
      const score = band * 1e7 + (again ? met.get(id) * 100 : 0) + n * 10 + rnd();
      if(score < low){ low = score; best = r; }
    }
    if(!best) return null;
    used.add(ezId(best)); answers.add(best.ans); per[best.slug] = (per[best.slug] | 0) + 1; got.push(best);
  }
  return got.map((r, i) => [r.at, i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}
/* on the list as they come up, so an abandoned quiz counts as met; the newest at the end, the list capped */
function ezMark(s, ids){
  const list = (s.seen || []).filter(x => !ids.includes(x)).concat(ids);
  s.seen = list.slice(Math.max(0, list.length - EZ_SEEN_MAX));
}
/* a quiz finished: the best out of ten only ever rises */
function ezRecord(s, right){
  const had = s.best | 0, first = !(s.runs | 0);
  s.runs = (s.runs | 0) + 1;
  s.best = Math.max(had, right);
  return { best: right > had, first };
}

/* ---------- the decks ---------- */
function ezLoad(list){
  const want = list.filter(c => !EZ_DECKS[c.slug]);
  /* one deck that won't come costs its club this quiz, not the quiz: ezDeal says when too few are left */
  return Promise.all(want.map(c => fetch("assets/q/" + ezDeckOf(c.slug) + ".json").then(r => { if(!r.ok) throw new Error(c.slug); return r.json(); })
    .then(b => { EZ_DECKS[c.slug] = qrRetier(bankDecks(b).mc); }).catch(() => null)));
}

/* ---------- European nights ---------- */
/* THE REGION'S NEXT MATCH IN EUROPE, from the fixture rows: not played, not kicked off, the earliest first. A local derby in Europe goes to your
   club, else the home side. Null when there's nothing */
function ezNightOf(rows, now, fav){
  const mine = new Map(EZ_CLUBS.filter(c => c.key).map(c => [c.key, c.slug]));
  const list = (rows || []).filter(x => EZ_COMPS[x.competition_id] && /^(scheduled|tbd)$/.test(x.status) && Date.parse(x.kickoff_at) > now && (mine.has(x.home_key) || mine.has(x.away_key)))
    .sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at));
  if(!list.length) return null;
  const x = list[0], h = mine.get(x.home_key) || null, a = mine.get(x.away_key) || null, slug = a === fav && a ? a : h || a;
  return { ko: Date.parse(x.kickoff_at), comp: x.competition_id, tbd: x.status === "tbd", slug,
    home: h ? ezLook(h).name : String(x.home_name || ""), away: a ? ezLook(a).name : String(x.away_name || "") };
}
function ezNightWhen(N){
  try{
    const d = new Date(N.ko), day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return N.tbd ? day : day + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }catch(e){ return ""; }
}
function ezNightHTML(){
  const N = EZ_NIGHT;
  if(!N || N.ko <= Date.now()) return "";
  const C = EZ_COMPS[N.comp], L = ezLook(N.slug), say = N.home + " v " + N.away + ", " + C[1] + ", " + ezNightWhen(N) + ". " + L.name + "’s Club Expert";
  return '<button class="eznight" onclick="ezClub(\'' + N.slug + '\')" aria-label="' + esc(say) + '">' + (compBadge(C[0], 46) || "") +
    '<span class="m"><small>European night · ' + esc(C[1]) + '</small><b>' + esc(N.home) + ' v ' + esc(N.away) + '</b><i>' + esc(ezNightWhen(N)) + '</i></span><span class="go" aria-hidden="true">›</span></button>';
}
/* one read of the public table, at most every ten minutes. Everything that can go wrong here just means no card */
async function ezNightAsk(){
  if(Date.now() - EZ_NIGHT_AT < EZ_NIGHT_MS) return;
  try{
    if(typeof navigator !== "undefined" && navigator.onLine === false) return;
    const sb = sbClient();
    if(!sb || !sb.from) return;
    EZ_NIGHT_AT = Date.now();
    const keys = EZ_CLUBS.filter(c => c.key).map(c => '"' + c.key + '"').join(",");
    const r = await sb.from("pl_fixtures").select("competition_id,kickoff_at,status,home_key,home_name,away_key,away_name")
      .in("competition_id", Object.keys(EZ_COMPS)).or("home_key.in.(" + keys + "),away_key.in.(" + keys + ")")
      .gte("kickoff_at", new Date().toISOString()).order("kickoff_at").limit(12);
    if(r.error) return;
    EZ_NIGHT = ezNightOf(r.data, Date.now(), ezFav(ezClubs()));
    const el = document.getElementById("eznight");
    if(el && EZ_VIEW === "zone") el.innerHTML = ezNightHTML();
  }catch(e){}
}

/* ---------- the Euregio League: the road ---------- */
const ezStop = id => id === "final" ? EZ_FINAL : EZ_STOPS.find(x => x.id === id) || null;
const ezClubBy = slug => EZ_CLUBS.find(c => c.slug === slug) || null;
const ezTeamOf = id => ezClubBy(ezStop(id).slug).team;
const ezOthers = home => EZ_STOPS.filter(x => x.id !== home).map(x => x.id);
const ezTotal = () => EZ_STOPS.length - 1;
const ezWon = (home, wins) => ezOthers(home).filter(id => (wins || {})[id]).length;
/* THE WHOLE MAP, from one club's wins: home, won, open or locked. The roads run both ways, so any town can be home: a ground is open next to home or next to a
   ground you've won. The final opens when every other ground is won */
function ezStates(home, wins){
  const out = {}, w = wins || {};
  for(const x of EZ_STOPS) out[x.id] = x.id === home ? "home" : w[x.id] ? "won" : "locked";
  const on = id => out[id] === "home" || out[id] === "won";
  for(const [a, b] of EZ_ROADS){ if(on(a) && out[b] === "locked") out[b] = "open"; if(on(b) && out[a] === "locked") out[a] = "open"; }
  out.final = ezOthers(home).every(id => w[id]) ? (w.final ? "won" : "open") : "locked";
  return out;
}
/* a won ground stays won while there's anything left to win; with the whole road and the final won, every ground can be played again */
const ezPlayable = (st, id) => st[id] === "open" || (st[id] === "won" && st.final === "won");
/* TWO GAMES A DAY, on any grounds and as any club. Only a finished game counts */
const ezGamesOn = (s, day) => (s.games || []).filter(g => g.day === day).length;
const ezLeft = (s, day) => Math.max(0, EZ_GAMES - ezGamesOn(s, day));
const ezLeftSay = n => n === 1 ? "1 game left today" : n + " games left today";
const ezKm = (a, b) => { const r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon), h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2; return Math.round(2 * 6371 * Math.asin(Math.sqrt(h))); };
/* how many roads a ground is from home: the opposition gets better the further you go. Easy next door, Medium along the road, Hard far away; the final is Hard */
function ezHops(home){
  const d = { [home]: 0 }, go = [home];
  while(go.length){ const a = go.shift(); for(const [x, y] of EZ_ROADS){ const n = x === a ? y : y === a ? x : null; if(n && d[n] == null){ d[n] = d[a] + 1; go.push(n); } } }
  return d;
}
const ezLevelOf = (home, id) => { if(id === "final") return "champs"; const n = ezHops(home)[id] | 0; return n < 2 ? "sunday" : n < 4 ? "ere" : "champs"; };
/* the dock: the final once it's open, else the nearest open ground; null when there's no more road */
function ezNextStop(home, st){
  if(st.final === "open") return "final";
  const H = ezStop(home), open = EZ_STOPS.filter(x => st[x.id] === "open").sort((a, b) => ezKm(H, a) - ezKm(H, b));
  return open.length ? open[0].id : null;
}
const ezScore = w => w.m + "–" + w.o + (w.p ? " P" : "");
/* A GAME OVER. Every finished game goes on the list, win or lose, as a plain record: the friends' table will read these. A win also writes the ground on this club's
   road for good, and a later win never moves its score or date. as is whose road, club the name you played as. Out comes the game */
function ezResult(s, as, id, club, gf, ga, pens, now, day){
  s.roads = s.roads || {};
  const w = s.roads[as] = s.roads[as] || {}, win = gf > ga || (gf === ga && !!pens && pens[0] > pens[1]);
  if(win && !w[id]) w[id] = { m: gf, o: ga, p: pens || null, t: now };
  const game = { day, stop: id, club, gf, ga, win, id: ezGameId() };
  s.games = (s.games || []).concat([game]).slice(-EZ_GAMES_MAX);
  return game;
}
/* THE EUREGIO XI: 4-3-3, a place at a time, always from the club with the fewest in the side so far, and each club's own order says who's its best */
function ezEleven(T, teams){
  const taken = new Set(), per = {}, xi = [], best = pos => { let hit = null;
    for(const t of teams) if(!hit || (per[t] | 0) < (per[hit.t] | 0)){ const p = ((T[t] || {}).xi || []).find(m => m.pos === pos && !taken.has(m.full)); if(p) hit = { t, p }; }
    return hit; };
  for(const [pos, n] of EZ_SHAPE) for(let i = 0; i < n; i++){
    const hit = best(pos);
    if(!hit) return null;
    taken.add(hit.p.full); per[hit.t] = (per[hit.t] | 0) + 1; xi.push(Object.assign({}, hit.p, { no: xi.length + 1 }));
  }
  const bench = teams.flatMap(t => ((T[t] || {}).xi || []).filter(m => !taken.has(m.full))).slice(0, 12).map((m, i) => Object.assign({}, m, { no: 12 + i }));
  return { kit: "#e9b84c", abbr: "EUR", flag: null, slug: null, squad: 11 + bench.length, xi, bench };
}

/* ---------- who you take on the road ---------- */
const ezOwnOk = () => { try{ return !!fycClubOn(); }catch(e){ return false; } };
/* A REAL CLUB IS ITS REAL SQUAD, NAME AND KIT, and its town is home. YOUR OWN FOUNDED CLUB plays from Maastricht with MVV's men, or your favourite's if it's one of
   the region's. Nothing chosen yet, or a founded club that's gone (a sign-out), reads as MVV */
function ezSide(s){
  s = s || ezStore();
  if(s.as === "own" && ezOwnOk()){
    let d = null; try{ d = clubMine(); }catch(e){}
    const fav = ezFav(EZ_CLUBS);
    if(d) return { as: "own", home: "mvv", design: d, base: ((fav && ezClubBy(fav)) || {}).team || "MVV Maastricht", name: d.name };
  }
  const id = ezStop(s.as) && s.as !== "final" ? s.as : "mvv", x = ezStop(id);
  return { as: id, home: id, design: null, base: ezClubBy(x.slug).team, name: ezLook(x.slug).name };
}
const ezWinsOf = (s, me) => (s.roads || {})[me.as] || {};
/* in the pool: a real club is already there. A founded club is a copy of a squad in the club's colours, under its own name (FC on the end if that's taken), and it
   borrows MVV's men on the day it meets the side whose men it has */
function ezSideKey(me, opp){
  if(!me.design) return me.base;
  const T = TEAMS[EZ_POOL] || {}, k = T[me.name] && !T[me.name].mine ? me.name + " FC" : me.name, base = me.base === opp ? "MVV Maastricht" : me.base;
  T[k] = Object.assign({}, T[base], { kit: me.design.colours[0], abbr: clubInitials(me.design.name), flag: null, slug: null, mine: true });
  return k;
}
function ezCrest(me, px){
  if(me.design){ try{ return clubCrestSVG(me.design, px, { year: false }); }catch(e){} }
  return ezPatch(ezStop(me.home).slug, px);
}
function ezPickHTML(){
  const s = ezStore(), me = ezSide(s), fav = ezFav(EZ_CLUBS), first = !s.as, total = ezTotal();
  const order = ezOrder(EZ_STOPS.map(x => ezClubBy(x.slug)), fav).map(c => EZ_STOPS.find(x => x.slug === c.slug));
  const row = (id, art, name, sub, on) => '<button class="ezpick' + (on ? " on" : "") + '" onclick="ezAs(\'' + id + '\')" aria-pressed="' + on + '">' + art + '<span class="m"><b>' + esc(name) + '</b><small>' + esc(sub) + '</small></span></button>';
  const road = id => { const n = ezWon(id === "own" ? "mvv" : id, (s.roads || {})[id]); return n ? n + " of " + total + " won" : ""; };
  let own = "";
  if(ezOwnOk()){ try{ const d = clubMine(); own = '<div class="b6hdr ezh">Your own club</div><div class="ezpicks one">' + row("own", '<span class="ezownc">' + clubCrestSVG(d, 40, { year: false }) + '</span>', d.name, road("own") || "Home in Maastricht", !first && me.as === "own") + '</div>'; }catch(e){} }
  return b4Page({ title: "Pick your club", ctx: "Euregio League", back: "ezBack()", cls: "ezpage ezpickp", body:
    '<p class="ezline">Who do you take on the road? Their squad, their kit, and their town is home. Change it any time: each club keeps its own road.</p>' + own +
    '<div class="b6hdr ezh">A club on the map</div><div class="ezpicks">' + order.map(x => row(x.id, ezPatch(x.slug, 34), ezLook(x.slug).name, road(x.id) || "Home in " + x.city, !first && me.as === x.id)).join("") + '</div>' });
}
function ezAs(id){
  audio();
  try{ haptic("select"); }catch(e){}
  const s = ezStore();
  s.as = id; ezSave(s);
  EZ_PAN = null; EZ_VIEW = "map"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
/* the first word of a name is enough next to its shield, a short one whole */
const ezShort = name => name.length <= 12 ? name : name.split(" ")[0];
function ezPickOpen(){ audio(); EZ_VIEW = "pick"; render(); try{ window.scrollTo(0, 0); }catch(e){} }

/* ---------- the map ---------- */
/* THE DESIGN'S SCALE, ON A WIDER MAP. The height sets the scale and the map runs as far east as it must: it pans sideways rather than shrinking until Sittard, Kerkrade
   and Aachen collide. Venlo sits under the title and Liège over the dock */
function ezView(w, h){
  const s = Math.min(w / 390, h / 844), kx = 346 * s, ky = 548 * s, span = kx * (EZ_LONS[1] - EZ_LONS[0]), W = Math.max(w, Math.round(span)), reach = (EZ_LATS[0] - EZ_LATS[1]) * ky;
  return { w: W, h, s, kx, ky, lon0: EZ_LONS[0] - (W - span) / 2 / kx, lat0: EZ_LATS[0] + (150 + (h - 270 - reach) * .25) / ky };
}
/* near enough to read, wide enough to hold both ends of the road just won */
function ezZoom(w, h, a, b){
  const dx = Math.abs(a.lon - b.lon), dy = Math.abs(a.lat - b.lat), kx = Math.min(640, (w - 96) / Math.max(dx, .01), (h - 110) / Math.max(dy * 1.583, .01)), ky = kx * 1.583;
  return { w, h, s: 1, kx, ky, lon0: (a.lon + b.lon) / 2 - w / 2 / kx, lat0: (a.lat + b.lat) / 2 + (h - 16) / 2 / ky };
}
const ezAt = (V, x) => ({ x: (x.lon - V.lon0) * V.kx + (x.dx || 0) * V.s, y: (V.lat0 - x.lat) * V.ky + (x.dy || 0) * V.s });
function ezGeoPaths(V){
  const G = typeof window !== "undefined" && window.EGGEO;
  if(!G) return { nl: "", be: "", de: "", maas: "", rhine: "" };
  const line = r => { let d = ""; r.forEach((p, i) => { d += (i ? "L" : "M") + ((p[0] - V.lon0) * V.kx).toFixed(1) + " " + ((V.lat0 - p[1]) * V.ky).toFixed(1); }); return d; };
  const c = a => (G.countries[a] || []).map(r => line(r) + "Z").join("");
  return { nl: c("NLD"), be: c("BEL"), de: c("DEU"), maas: (G.maas || []).map(line).join(""), rhine: (G.rhine || []).map(line).join("") };
}
/* a road is gold between two grounds that are yours, dotted to one you can go to next, faint otherwise. The arrow points at the open end, whichever way the road was written */
function ezRoadsSVG(V, st, r){
  let out = "";
  const on = id => st[id] === "home" || st[id] === "won", next = id => st[id] === "open" || (id === "final" && st.final === "won");
  for(const [a, b, flip] of EZ_ROADS.concat([EZ_LAST])){
    const p = ezAt(V, ezStop(a)), q = ezAt(V, ezStop(b)), dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    if(L < 1) continue;
    const ux = dx / L, uy = dy / L, r0 = a === "final" ? r * .8 : r, r1 = b === "final" ? r * .8 : r, bend = (flip ? -.1 : .1) * L, cx = (p.x + q.x) / 2 - uy * bend, cy = (p.y + q.y) / 2 + ux * bend;
    const to = (x, y) => { const d = Math.hypot(cx - x, cy - y) || 1; return [(cx - x) / d, (cy - y) / d]; };
    const [ax, ay] = to(p.x, p.y), [bx, by] = to(q.x, q.y), x0 = p.x + ax * r0, y0 = p.y + ay * r0, x1 = q.x + bx * r1, y1 = q.y + by * r1;
    const d = "M" + x0.toFixed(1) + " " + y0.toFixed(1) + "Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + x1.toFixed(1) + " " + y1.toFixed(1);
    if((on(a) || st[a] === "won") && (on(b) || st[b] === "won")){ out += '<path d="' + d + '" class="ezr done"/>'; continue; }
    if((on(a) && next(b)) || (on(b) && next(a))){
      out += '<path d="' + d + '" class="ezr open"/>';
      const hx = on(a) ? x1 : x0, hy = on(a) ? y1 : y0, t = Math.atan2(hy - cy, hx - cx), h = 9, wing = o => (hx - Math.cos(t + o) * h).toFixed(1) + " " + (hy - Math.sin(t + o) * h).toFixed(1);
      out += '<path class="ezarrow" d="M' + wing(-.5) + "L" + hx.toFixed(1) + " " + hy.toFixed(1) + "L" + wing(.5) + '"/>';
    }else out += '<path d="' + d + '" class="ezr lock"/>';
  }
  return out;
}
const EZ_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.6 1.4 6.7-6.1-3.4-6.1 3.4 1.4-6.7-5-4.6 6.8-.8z"/></svg>';
function ezMapHTML(V, st, wins, o){
  o = o || {};
  const g = ezGeoPaths(V), w = Math.round((o.patch || 42) * Math.max(V.s, .84)), r = Math.round(w * .6), say = { home: "home", won: "won", open: "open", locked: "locked" };
  let nodes = "";
  for(const x of EZ_STOPS){
    const t = st[x.id], p = ezAt(V, x);
    if(p.x < -30 || p.x > V.w + 30 || p.y < -30 || p.y > V.h + 30) continue;
    nodes += '<button class="eznd ' + t + ' lab-' + (x.lab || "b") + '" style="left:' + p.x.toFixed(1) + 'px;top:' + p.y.toFixed(1) + 'px" onclick="ezOpen(\'' + x.id + '\')" aria-label="' + esc(x.city + ", " + say[t] + (t === "won" ? " " + ezScore(wins[x.id]) : "")) + '">' +
      ezPatch(x.slug, w) + (t === "home" ? '<span class="eztag home">Home</span>' : t === "won" ? '<span class="eztag">' + esc(ezScore(wins[x.id])) + '</span>' : "") + '<em>' + esc(x.city) + '</em></button>';
  }
  const f = ezAt(V, EZ_FINAL);
  nodes += '<button class="ezstar ' + (st.final || "locked") + '" style="left:' + f.x.toFixed(1) + 'px;top:' + f.y.toFixed(1) + 'px" onclick="ezOpen(\'final\')" aria-label="' + esc("The final, the Three-Country Point, " + say[st.final || "locked"]) + '">' + EZ_STAR + '</button>';
  /* the closest clubs of all, with no questions or squads yet: a place on the map, not a stop */
  const soon = o.noSoon ? "" : EZ_SOON.map(c => { const p = ezAt(V, { lon: c[2], lat: c[1] }); return '<i class="ezsoon" style="left:' + p.x.toFixed(1) + 'px;top:' + p.y.toFixed(1) + 'px" title="' + esc(c[0] + ", coming") + '"></i>'; }).join("");
  const labels = (o.labels || []).map(l => { const c = ezAt(V, { lon: l[1], lat: l[2] }); return '<span class="ezlab ' + (l[4] || "") + '" style="left:' + c.x.toFixed(1) + 'px;top:' + c.y.toFixed(1) + 'px' + (l[3] ? ";transform:rotate(" + l[3] + "deg)" : "") + '">' + esc(l[0]) + '</span>'; }).join("");
  return '<div class="ezmap' + (o.cls ? " " + o.cls : "") + '" style="width:' + V.w + 'px;height:' + V.h + 'px"><svg class="ezgeo" viewBox="0 0 ' + V.w + ' ' + V.h + '" width="' + V.w + '" height="' + V.h + '" aria-hidden="true">' +
    '<path class="ezc nl" d="' + g.nl + '"/><path class="ezc be" d="' + g.be + '"/><path class="ezc de" d="' + g.de + '"/><path class="ezborder" d="' + g.nl + '"/><path class="ezborder" d="' + g.be + '"/>' +
    '<path class="ezmaas2" d="' + g.maas + g.rhine + '"/><path class="ezmaas" d="' + g.maas + g.rhine + '"/>' + ezRoadsSVG(V, st, r) + '</svg>' + labels + soon + nodes + '</div>';
}
/* the next games come at midnight: the day is dayKey's, the player's own calendar */
function ezNextGames(now){
  const d = now || new Date(), m = Math.max(1, Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d) / 6e4)), h = Math.floor(m / 60);
  return (h ? h + " h " : "") + (m % 60 ? m % 60 + " min" : "");
}
function ezDockHTML(me, st, left){
  const home = me.home, n = ezNextStop(home, st);
  if(!left) return '<div class="ezgo still"><span class="m"><small>No games left today</small><b>Back at midnight</b><i>Two more games in ' + esc(ezNextGames()) + '.</i></span></div>';
  if(n === "final") return '<button class="ezgo gold" onclick="ezOpen(\'final\')">' + EZ_STAR + '<span class="m"><small>The final</small><b>Euregio XI</b><i>At the Three-Country Point, Vaals</i></span><span class="go">Go</span></button>';
  if(n){
    const x = ezStop(n);
    return '<button class="ezgo" onclick="ezOpen(\'' + n + '\')">' + ezPatch(x.slug, 46) + '<span class="m"><small>Next away day</small><b>' + esc(ezLook(x.slug).name) + '</b><i>' + esc(x.ground + ", " + x.city + " · " + ezKm(ezStop(home), x) + " km") + '</i></span><span class="go">Go</span></button>';
  }
  return '<div class="ezgo gold still">' + EZ_STAR + '<span class="m"><small>Euregio League</small><b>Champions</b><i>Tap any ground to play it again.</i></span></div>';
}
function ezMapPage(){
  const s = ezStore(), me = ezSide(s), wins = ezWinsOf(s, me), st = ezStates(me.home, wins), left = ezLeft(s, dayKey()), n = ezWon(me.home, wins);
  let w = 390, h = 844; try{ w = window.innerWidth || w; h = window.innerHeight || h; }catch(e){}
  const V = ezView(w, h), homeX = Math.round(ezAt(V, ezStop(me.home)).x);
  return '<div class="b6 step b6m b4page ezpage ezfull"><div class="b6band"></div><div class="ezscroll" id="ezscroll" data-home="' + homeX + '" onscroll="ezPanned(this)">' + ezMapHTML(V, st, wins, { labels: EZ_PLACES }) + '</div>' +
    '<div class="b6body">' + b6MatchHead(n + " of " + ezTotal() + " won", "ezBack()", null, "Euregio League") + '</div>' +
    '<button class="ezas" onclick="ezPickOpen()" aria-label="' + esc("Playing as " + me.name + ". Change club") + '">' + (me.design ? "" : ezPatch(ezStop(me.home).slug, 18)) + esc(me.design ? clubInitials(me.design.name) : ezShort(me.name)) + ' ›</button><span class="ezpills">' + (PL_ON ? '<button class="ezmore" onclick="ezTableOpen()">Table</button>' : "") + '<button class="ezmore" onclick="ezTab()">Quiz &amp; clubs</button></span>' +
    '<button class="ezpan l" onclick="ezPan(-1)" aria-label="Pan the map west">‹</button><button class="ezpan r" onclick="ezPan(1)" aria-label="Pan the map east">›</button>' +
    '<div class="ezdock">' + (left ? '<div class="ezleft">' + esc(ezLeftSay(left)) + '</div>' : "") + ezDockHTML(me, st, left) + '</div></div>';
}
/* the map opens on home and stays where you left it, until you change club */
function ezMapAfter(st){
  const el = st.querySelector && st.querySelector("#ezscroll");
  if(!el) return;
  el.scrollLeft = EZ_PAN != null ? EZ_PAN : Math.max(0, (+el.getAttribute("data-home") || 0) - el.clientWidth * EZ_OPEN_AT);
  ezPanned(el, true);
}
function ezPanned(el, quiet){
  if(!quiet) EZ_PAN = el.scrollLeft;
  const page = el.parentNode, max = el.scrollWidth - el.clientWidth;
  try{ page.classList.toggle("atw", el.scrollLeft < 8); page.classList.toggle("ate", el.scrollLeft > max - 8); }catch(e){}
}
function ezPan(dir){
  audio();
  const el = document.getElementById("ezscroll");
  if(!el) return;
  let still = false; try{ still = reducedMotion(); }catch(e){}
  try{ el.scrollBy({ left: dir * el.clientWidth * .7, behavior: still ? "auto" : "smooth" }); }catch(e){ el.scrollLeft += dir * el.clientWidth * .7; }
}
function ezOpen(id){
  audio();
  const s = ezStore(), me = ezSide(s), st = ezStates(me.home, ezWinsOf(s, me)), x = ezStop(id);
  if(st[id] === "home") return toast("Home. Every road starts here.");
  if(st[id] === "locked") return toast(id === "final" ? "Every ground first, then the final." : "Win a ground next to " + x.city + " first.");
  try{ haptic("select"); }catch(e){}
  EZ_STOP = id; EZ_VIEW = "away"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function ezTab(){ audio(); EZ_VIEW = "zone"; render(); try{ window.scrollTo(0, 0); }catch(e){} }

/* ---------- the away day ---------- */
const ezFact = (k, v) => '<div class="ezfact"><small>' + esc(k) + '</small><b>' + esc(v) + '</b></div>';
const ezScarfBand = (who, cell) => '<canvas class="ezscarf" data-who="' + esc(who) + '" data-cell="' + cell + '"></canvas>';
const ezDecks = () => EZ_STOPS.map(x => ezClubBy(x.slug));
function ezAwayHTML(){
  const s = ezStore(), me = ezSide(s), wins = ezWinsOf(s, me), home = ezStop(me.home), st = ezStates(me.home, wins), id = EZ_STOP, t = st[id], w = wins[id], final = id === "final", x = ezStop(id), left = ezLeft(s, dayKey()), play = ezPlayable(st, id);
  const name = final ? EZ_XI : ezLook(x.slug).name, n = ezWon(me.home, wins);
  const total = final ? ezDecks().reduce((a, c) => a + (bankClub(c.slug) || [0, 0, 0, 0])[3], 0) : (bankClub(x.slug) || [0, 0, 0, 0])[3];
  const line = !play ? (w ? "You won here on " + ezDateLong(w.t) + ". Every ground can be played again once the whole road is won." : "Win a ground next to " + x.city + " first.") : !left ? "That’s today’s two games. Two more at midnight." : "First to three, or ninety minutes and then penalties. Two games a day, win or lose.";
  return b4Page({ title: final ? "The final" : "Away day", ctx: w ? ezScore(w) : final ? "Three-Country Point" : "Stop " + Math.min(n + 1, ezTotal()) + " of " + ezTotal(), back: "ezBack()", cls: "ezpage ezaway", body:
    '<div class="ezscarfrow">' + ezScarfBand(final ? "final" : x.slug, 4) + '</div>' +
    '<div class="ezvs"><div class="ezside">' + ezCrest(me, 88) + '<b>' + esc(me.name) + '</b><small>Home in ' + esc(home.city) + '</small></div><span class="ezv">v</span><div class="ezside">' + (final ? '<span class="ezbigstar">' + EZ_STAR + '</span>' : ezPatch(x.slug, 80)) + '<b>' + esc(name) + '</b><small>' + esc(final ? "Vaals" : x.city) + '</small></div></div>' +
    '<div class="ezfacts">' + ezFact("Ground", x.ground) + ezFact("The road", ezKm(home, x) + " km from home") + ezFact("The questions", nf(total) + (final ? " from the whole region" : ", all on " + name)) + ezFact("Take home", final ? "The Euregio League trophy" : "Their scarf, for your Locker") + '</div>' +
    '<p class="ezline">' + esc(line) + '</p>' + (play ? '<div class="ezleft on' + (left ? "" : " none") + '">' + esc(ezLeftSay(left)) + '</div>' : "") +
    (play && left ? b4Btn(EZ_BUSY ? "One moment…" : "Kick off", "ezKick()", "gold") : play ? '<button class="b4btn gold" disabled>Back at midnight</button>' : b4Btn("Back to the map", "ezBack()", "gold")) });
}
const ezDateLong = t => { try{ return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long" }); }catch(e){ return "the day"; } };
/* a scarf is knitted once the canvas is on the page: their real one, or the Euregio's own in gold for the final */
function ezPaint(st){
  if(typeof Crests === "undefined" || !st.querySelectorAll) return;
  st.querySelectorAll("canvas.ezscarf").forEach(c => { try{
    const who = c.getAttribute("data-who"), L = who === "final" ? { name: EZ_XI, code: "EUR", c1: "#e9b84c", c2: "#123D24", p: "plain" } : ezLook(who);
    const cell = +c.getAttribute("data-cell") || 4, room = (c.parentNode && c.parentNode.clientWidth) || 0;
    Crests.scarf(c, L, { cell });
    if(room && c.width > room && (cell < 4 || L.name.length > EZ_SCARF_CROP)){ c.style.width = room + "px"; c.style.height = "auto"; }
  }catch(e){} });
}

/* ---------- kick off ---------- */
/* THE QUESTIONS AND THE SIDES FIRST. A deck comes down the quiz's way (ezLoad) and goes where the pitch looks for it; the final's is every deck on the road */
function ezKick(){
  audio();
  const id = EZ_STOP, final = id === "final", list = final ? ezDecks() : [ezClubBy(ezStop(id).slug)], s = ezStore(), me = ezSide(s);
  if(EZ_BUSY || !ezPlayable(ezStates(me.home, ezWinsOf(s, me)), id) || !ezLeft(s, dayKey())) return render();
  const ready = () => list.every(c => EZ_DECKS[c.slug]) && TEAMS[EZ_POOL];
  needPool(EZ_POOL);
  if(!ready()){
    EZ_BUSY = true; render();
    let n = 0;
    const wait = () => { if(TEAMS[EZ_POOL] || ++n > 40) return ezKickNow(id, ready()); setTimeout(wait, 100); };
    return ezLoad(list).then(wait);
  }
  ezKickNow(id, true);
}
function ezKickNow(id, ok){
  EZ_BUSY = false;
  if(!ok){ render(); return toast("That didn’t load. Try again in a moment.", true); }
  b4Explain("pitch", () => {
    const final = id === "final", x = ezStop(id), me = ezSide(), T = TEAMS[EZ_POOL], opp = final ? EZ_XI : ezTeamOf(id), mine = ezSideKey(me, opp), level = setupAiLevel;
    if(final){
      T[EZ_XI] = ezEleven(T, ezOthers(me.home).map(ezTeamOf));
      const D = {}, seen = new Set();
      for(const t of EZ_TIERS){ D[t] = []; for(const c of ezDecks()) for(const r of ((EZ_DECKS[c.slug] || {})[t] || [])){ const q = ezAns(r.q); if(!seen.has(q) && !r.x){ seen.add(q); D[t].push(r); } } }
      DECKS[EZ_ALL + "-mc"] = D;
    }else DECKS["club-" + x.slug + "-mc"] = DECKS["club-" + x.slug + "-mc"] || EZ_DECKS[x.slug];
    closeSheet();
    EZ_VIEW = null;
    /* starting a match saves it before it can be marked as ours (save knows S.ez only from here on), so the match that was parked goes back where it was */
    let parked = null; try{ parked = localStorage.getItem(SAVE_KEY); }catch(e){}
    b4Go("classic", "pitch", { level: ezLevelOf(me.home, id), src: "own" });
    setupAiLevel = level;
    if(!S || !isPitch(S.play)){ EZ_VIEW = "away"; render(); return toast("That didn’t load. Try again in a moment.", true); }
    S.mc = true; S.qdeck = final ? EZ_ALL : "club-" + x.slug; S.pool = EZ_POOL; S.lockPool = true;
    S.ez = { stop: id, scarf: final ? null : opp, as: me.as, name: me.name };
    try{ if(parked != null) localStorage.setItem(SAVE_KEY, parked); else clearSave(); }catch(e){}
    const H = h2();
    H.teams = [mine, opp];
    H.tossed = true; H.coin = "heads"; H.call = "heads"; H.who = 0; H.at = 0;
    b4Step = null;
    try{ tlmEvent("euregio_kick", { stop: id }); }catch(e){}
    h2KickOff();
  });
}
/* LEAVING USES NOTHING: no game is written, and there is no parked match to come back to, so it asks first */
function ezAskMatchLeave(){
  audio();
  sheet('<h2>Leave the match?</h2><p>It won’t count, and it won’t use up a game.</p><button class="b4btn gold" onclick="closeSheet()">Keep playing</button><button class="b4btn quiet" onclick="ezMatchLeave()">Leave</button>');
}
function ezMatchLeave(){
  closeSheet(); stopTimer();
  S = null; EZ_VIEW = "map";
  render();
}
/* FULL TIME, from endGame, with the match still in S. Win or lose it's one of the day's two; a win writes the ground and gets its page, a loss goes back to the map. The
   XP, the scarf and the rest are the match's own, done by now (recordMatch). What's still queued (a rank, a title) comes up on the way back to the map */
function ezFullTime(){
  const z = S && S.ez;
  if(!z) return;
  const gf = S.players[0].score, ga = S.players[1].score, pens = S.pens || null, id = z.stop, final = id === "final", x = ezStop(id);
  const s = ezStore(), first = !((s.roads || {})[z.as] || {})[id], game = ezResult(s, z.as, id, z.name, gf, ga, pens, Date.now(), dayKey()), they = final ? EZ_XI : ezLook(x.slug).name;
  ezSave(s);
  ezReport(game);
  if(game.win && final && first){
    const t = progTrophy("euregio", "league", "Euregio League", "gold"), p = progLoad();
    p.moments.push({ kind: "trophy", name: "Euregio League", sub: "The whole road, and the Euregio XI. It’s in your Locker.", metal: t.metal, shape: t.shape });
    progSave(p);
  }
  S = null; EZD = null;
  const line = z.name + " " + gf + "–" + ga + " " + they;
  if(!game.win){
    EZ_VIEW = "map"; render();
    toast(line + (pens ? " on penalties" : "") + ". " + ezLeftSay(ezLeft(s, dayKey())) + ".");
    return ezMoments();
  }
  EZW = { id, line: line + (pens ? " (" + pens[0] + "–" + pens[1] + " pens)" : "") };
  EZ_VIEW = "won"; render();
  try{ window.scrollTo(0, 0); celebrate(3, { type: "matchWon" }); }catch(e){}
}
function ezMoments(){ try{ progKeep = true; progMoment(); }catch(e){ progKeep = false; } }
function ezWonHTML(){
  const W = EZW, id = W.id, final = id === "final", x = ezStop(id), s = ezStore(), me = ezSide(s), wins = ezWinsOf(s, me), st = ezStates(me.home, wins), home = ezStop(me.home);
  /* the road just won: from the nearest ground of yours next to it */
  const next = EZ_ROADS.concat([EZ_LAST]).flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : []).map(ezStop).filter(n => st[n.id] === "home" || st[n.id] === "won").sort((a, b) => ezKm(a, x) - ezKm(b, x));
  let w = 390; try{ w = Math.min(window.innerWidth || w, 560); }catch(e){}
  const V = ezZoom(w - 32, 300, next[0] || home, x);
  return b4Page({ title: (final ? "The Euregio" : x.city) + " is yours", ctx: W.line, back: "ezBack()", cls: "ezpage ezwon", body:
    '<div class="ezcard">' + ezMapHTML(V, st, wins, { cls: "zoom", patch: 50, noSoon: true, labels: EZ_PLACES.slice(0, 3) }) + '</div>' +
    (final ? '<div class="ezgift"><span class="ezbigstar">' + EZ_STAR + '</span><b>The Euregio League trophy is in your Locker</b></div>'
      : '<div class="ezgift">' + ezScarfBand(x.slug, 2) + '<b>Their scarf is in your Locker</b></div>') +
    b4Btn("Back to the map", "ezBack()", "gold") });
}

/* ---------- the friends' table: a game goes out ---------- */
/* AN ID IS MADE ON THE PHONE AND KEPT, so a retry carries the same one and the server counts it once. crypto.randomUUID is only there on https and localhost, so
   an http page takes the same random bytes another way */
const ezUuidOf = b => { const x = Array.from(b); x[6] = (x[6] & 15) | 64; x[8] = (x[8] & 63) | 128; const h = x.map(n => n.toString(16).padStart(2, "0")).join(""); return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20); };
function ezGameId(){
  try{ if(crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  const b = new Uint8Array(16);
  try{ crypto.getRandomValues(b); }catch(e){ for(let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  return ezUuidOf(b);
}
/* an id from before ids were uuids becomes the same uuid on every phone, so the cloud save still sees one game */
function ezUuidFrom(old){
  const b = []; let h = 2166136261;
  for(let i = 0; i < 16; i++){ for(const ch of old + ":" + i) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; b.push(h & 255); }
  return ezUuidOf(b);
}
function ezMigrate(s){
  let moved = false;
  const seen = new Set(), list = [];
  for(const g of s.games || []){
    const id = EZ_UUID.test(g.id) ? g.id : ezUuidFrom(String(g.id));
    if(id !== g.id || seen.has(id)) moved = true;
    if(!seen.has(id)){ seen.add(id); list.push(id === g.id ? g : Object.assign({}, g, { id })); }
  }
  if(moved) s.games = list;
  return moved;
}
/* what eg_report takes: whole goals from 0 to 9 and a boolean win, which on a level score is who took the penalties */
const ezGoals = n => Math.max(0, Math.min(9, Math.round(+n) || 0));
const ezWire = g => ({ id: g.id, day: g.day, stop: g.stop, club: String(g.club || "").trim().slice(0, 40), gf: ezGoals(g.gf), ga: ezGoals(g.ga), win: !!g.win });
const ezDayOf = k => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
const ezDaysApart = (a, b) => Math.round((ezDayOf(b) - ezDayOf(a)) / 864e5);
/* the server takes yesterday, today and tomorrow by its own date, so past two days a game can only come back bad_day. A small queue, newest kept */
const ezOutKeep = (list, day) => list.filter(g => ezDaysApart(g.day, day) <= 2).slice(-EZ_OUT_MAX);
/* what a server without 021 answers: PostgREST's "no such function" */
const ezNoFn = e => !!e && (e.code === "PGRST202" || e.status === 404 || /could not find the function/i.test(String(e.message || "")));
/* THE ONE PLACE A FINISHED GAME LEAVES THE PHONE. It goes on the queue first and is sent from there, so a game is never lost to a bad moment */
function ezReport(game){
  try{ tlmEvent("euregio_done", { stop: game.stop, won: game.win ? 1 : 0 }); }catch(e){}
  const s = ezStore();
  s.out = ezOutKeep((s.out || []).concat([ezWire(game)]), game.day);
  ezSave(s);
  return ezFlush(true);
}
/* THE QUEUE, oldest first. A network error, a server without 021, slow_down and not_signed_in keep the game for later, quietly. An answer in any other form takes it off
   the queue: {ok: true} and {already: true} because it's in, and every other code because it's final. That is the queue and not the phone: a game the server won't have stays
   in s.games and in the player's two a day, and the server's left and day_full never change that count. A guest (an anonymous account) is asked about first: what a guest
   does stays on the phone unless they're in a league, which is what the privacy page promises, so with no league nothing is sent at all */
async function ezFlush(now){
  if(EZ_FLUSHING || (!now && Date.now() < EZ_HOLD)) return;
  const first = ezStore(), kept = ezOutKeep(first.out || [], dayKey());
  if((first.out || []).length !== kept.length){ first.out = kept; ezSave(first); }
  if(!kept.length) return;
  let a = null, sb = null; try{ a = acct(); sb = sbClient(); }catch(e){}
  if(!a || !a.signedIn || !sb || !sb.rpc) return;
  try{ if(navigator.onLine === false) return; }catch(e){}
  const hold = ms => { EZ_HOLD = Date.now() + ms; };
  EZ_FLUSHING = true;
  try{
    if(a.anon){
      const r = await sb.rpc("pl_my_leagues");
      if(r.error || !r.data){ hold(EZ_HOLD_MS); return; }
      if(!(r.data.leagues || []).length){ const s = ezStore(); s.out = []; ezSave(s); return; }
    }
    for(let n = 0; n < EZ_OUT_MAX + 4; n++){
      const g = (ezStore().out || [])[0];
      if(!g) break;
      const r = await sb.rpc("eg_report", { p: g }), d = r.data;
      if(r.error || !d || typeof d.ok !== "boolean"){ hold(ezNoFn(r.error) ? EZ_SLOW_MS : EZ_HOLD_MS); break; }
      if(!d.ok && EZ_RETRY.includes(d.code)){ hold(d.code === "slow_down" ? EZ_SLOW_MS : EZ_HOLD_MS); break; }
      const s = ezStore(); s.out = (s.out || []).filter(x => x.id !== g.id); ezSave(s);
    }
  }catch(e){ hold(EZ_HOLD_MS); }
  finally{ EZ_FLUSHING = false; }
}

/* ---------- the friends' table: the screen ---------- */
const ezGd = n => n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0";
/* a shield as a league row draws it (clCrest in pl.js, which may not be here yet): the member's own club, or their initials */
function ezRowCrest(r, px){
  if(r && r.club){ try{ return clubCrestSVG(r.club, px, { mini: true }); }catch(e){} }
  const n = String((r && r.display_name) || "").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";
  return '<span class="ezinit" style="width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * .4) + 'px">' + esc(n) + '</span>';
}
/* a dot per ground won, in each ground's colour, then the ones still to win; a star for the final. A player who has played as two clubs can have all thirteen */
function ezDots(stops){
  const got = Array.isArray(stops) ? stops : [], won = EZ_STOPS.filter(x => got.includes(x.id));
  return '<span class="ezdots" role="img" aria-label="' + won.length + (won.length === 1 ? " ground won" : " grounds won") + '">' +
    won.map(x => '<i style="background:' + ezLook(x.slug).c1 + '"></i>').join("") + '<i class="mt"></i>'.repeat(Math.max(0, ezTotal() - won.length)) + (got.includes("final") ? '<i class="fin"></i>' : "") + '</span>';
}
/* the week starts again on the server's clock, so it's the server's clock that says how long is left */
function ezWeekLeft(d){
  const h = Math.max(0, Math.ceil(((+d.resets_at || 0) - (+d.server_now || 0)) / 36e5));
  return h > 47 ? "New week in " + Math.ceil(h / 24) + " days" : h > 1 ? "New week in " + h + " hours" : "New week within the hour";
}
function ezTableRows(d, tab){
  const n = (r, k) => +((r[tab] || {})[k]) || 0, rows = (d.rows || []).slice().sort((a, b) => n(a, "pos") - n(b, "pos"));
  return b4Table(["Club", "P", "W", "L", "GD", "Pts"], rows.map(r => ({ me: !!r.me, cells: [
    '<span class="ezname">' + ezRowCrest(r, 34) + '<span><b>' + esc(String(r.display_name || "")) + '</b>' + (r.me ? '<small>You</small>' : "") + ezDots((r[tab] || {}).stops) + '</span></span>',
    n(r, "played"), n(r, "won"), n(r, "lost"), ezGd(n(r, "gd")), '<b class="ezpts">' + n(r, "pts") + '</b>'] })));
}
function ezTableHTML(){
  const T = EZT || {}, s = ezStore(), left = ezLeft(s, dayKey()), d = T.data;
  const page = (ctx, body) => b4Page({ title: "Your league", ctx, back: "ezBack()", cls: "ezpage eztablep", body });
  const count = '<div class="ezleft on' + (left ? "" : " none") + '">' + esc(ezLeftSay(left)) + '</div>';
  const say = (b, t, more) => '<div class="lgempty"><b>' + esc(b) + '</b><span>' + esc(t) + '</span></div>' + (more || "") + count + b4Btn("Back to the map", "ezBack()", "quiet");
  if(T.state === "under16") return page("Euregio League", say("Leagues are for 16 and over", "Your road, your scarves and your two games a day are all yours. Leagues and a public username open up when you turn 16."));
  if(T.state === "age") return page("Euregio League", say("One question first", "Friends and leagues are for players aged 16 and over.", b4Btn("Answer it", "ezTableAge()", "gold")));
  if(T.state === "soon") return page("Euregio League", say("Coming soon", "The table opens shortly. Your road and your games are safe on this phone."));
  if(T.state === "off") return page("Euregio League", say("Not available right now", "Check the connection and try again.", b4Btn("Try again", "ezTableOpen()", "gold")));
  if(T.state === "slow") return page("Euregio League", say("One moment", "That’s a lot of looks at the table. Try again in a while."));
  if(T.state === "none") return page("Euregio League",
    '<div class="b4card dark eztableoffer"><h2>Take on your mates</h2><p>Same twelve grounds, your own road, three points a win. The table lives in a Call It league: start one and share the code, or join theirs.</p>' +
      b4Btn("Start a league", "ezToLeague('new')", "gold") + b4Btn("Join with a code", "ezToLeague('join')", "dark") + '</div>' + count + b4Btn("Back to the map", "ezBack()", "quiet"));
  if(T.state !== "ok" || !d) return page("Euregio League", '<div class="lgskel"></div>');
  const tab = T.tab === "all" ? "all" : "week", leagues = T.leagues || [], name = (d.league && d.league.name) || "Euregio League";
  const seg = (k, t) => '<button aria-pressed="' + (tab === k) + '" onclick="ezTableTab(\'' + k + '\')">' + t + '</button>';
  return page(name,
    (leagues.length > 1 ? '<div class="ezleagues" role="group" aria-label="Your leagues">' + leagues.map(l => '<button aria-pressed="' + (l.id === T.league) + '" onclick="ezTablePick(\'' + esc(String(l.id)) + '\')">' + esc(String(l.name || "")) + '</button>').join("") + '</div>' : "") +
    '<div class="lgseg lgseg2 ezseg" role="group" aria-label="The table">' + seg("week", "This week") + seg("all", "All time") + '</div>' +
    '<div class="b6hdr ezh">Twelve away days, three points a win</div>' + ezTableRows(d, tab) +
    ((d.rows || []).length < 2 ? '<p class="ezline">Just you so far. Share the code and the table fills up.</p>' : "") +
    '<p class="ezline">Everyone plays the same twelve grounds. A dot is a ground won.' + (tab === "week" ? " " + esc(ezWeekLeft(d)) + "." : "") + '</p>' + count + b4Btn("Back to the map", "ezBack()", "quiet"));
}
function ezTableOpen(){
  audio();
  const was = EZT || {};
  EZT = { tab: was.tab || "week", league: was.league || null, leagues: null, data: null, state: "loading" };
  EZ_VIEW = "table"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
  return ezTableLoad(EZT);
}
const ezTableSet = (T, o) => { if(EZT !== T) return; Object.assign(T, o); if(EZ_VIEW === "table") render(); };
/* WHO GETS WHAT: a guest and anyone in no league the offer, an under-16 what leagues show them, and a member the table. Whatever goes wrong here is a calm line and never a toast */
async function ezTableLoad(T){
  let a = null, sb = null; try{ a = acct(); sb = sbClient(); }catch(e){}
  if(!a || !a.signedIn) return ezTableSet(T, { state: "none" });
  if(!a.asked16) return ezTableSet(T, { state: "age" });
  if(!a.ageOk) return ezTableSet(T, { state: "under16" });
  if(!sb || !sb.rpc) return ezTableSet(T, { state: "off" });
  try{
    const r = await sb.rpc("pl_my_leagues");
    if(r.error) return ezTableSet(T, { state: ezNoFn(r.error) ? "soon" : "off" });
    const L = (r.data && r.data.leagues) || [];
    if(!L.length) return ezTableSet(T, { state: "none", leagues: [] });
    T.leagues = L;
    if(!L.some(l => l.id === T.league)) T.league = L[0].id;
    await ezTableRead(T);
  }catch(e){ ezTableSet(T, { state: "off" }); }
}
async function ezTableRead(T){
  const r = await sbClient().rpc("eg_table", { p_league: T.league }), d = r.data;
  if(r.error) return ezTableSet(T, { state: ezNoFn(r.error) ? "soon" : "off" });
  if(!d || !d.ok){
    const c = d && d.code;
    if(c === "slow_down") return ezTableSet(T, { state: "slow" });
    if(c === "not_signed_in") return ezTableSet(T, { state: "none" });
    /* not_member: that league has gone from under us, so ask again which ones are left */
    if(c === "not_member" && !T.again){ T.again = true; T.league = null; return ezTableLoad(T); }
    return ezTableSet(T, { state: "off" });
  }
  ezTableSet(T, { state: "ok", data: d });
}
function ezTableTab(k){ audio(); if(EZT){ EZT.tab = k === "all" ? "all" : "week"; render(); } }
function ezTablePick(id){
  audio();
  if(!EZT || EZT.league === id) return;
  EZT.league = id; EZT.state = "loading"; EZT.data = null; render();
  ezTableRead(EZT).catch(() => ezTableSet(EZT, { state: "off" }));
}
function ezTableAge(){ audio(); try{ acctAgeSheet(); }catch(e){} }
/* NO LEAGUE YET: Call It's own pages. A guest meets its guest card, or goes straight to the code, as pl_join allows; a new league keeps every rule clNew has. Their ‹ comes back here */
function ezToLeague(what){
  EZ_VIEW = null;
  openLeague("callit");
  plNeed(() => {
    if(!LEAGUE_VIEW) return;
    const why = clBlocked();
    if(what === "join" && why === "guest") return clGuestStart("join");
    if(why) return render();
    if(what === "join") return clGo("join", { back: "ezTableBack()" });
    clNew();
    if(clV().s === "new"){ LEAGUE_VIEW.cl.back = "ezTableBack()"; render(); }
  });
}
function ezTableBack(){ LEAGUE_VIEW = null; ezTableOpen(); }

/* ---------- the Zone: the second tab ---------- */
function ezTile(slug, s){
  const L = ezLook(slug), n = Math.min(ezPasses(s, slug), 3), won = n >= 3;
  return '<button class="eztile' + (won ? " won" : "") + '" style="--ec1:' + L.c1 + ';--ec2:' + L.c2 + '" onclick="ezClub(\'' + slug + '\')" aria-label="' + esc(L.name + (won ? ", Expert medal" : ", " + n + " of 3 passed")) + '">' +
    ezPatch(slug, 34) + '<span class="ezn"><b>' + esc(L.name) + '</b>' + (won ? '<small>Expert</small>' : ezPips(n)) + '</span></button>';
}
const ezPips = n => '<span class="ezpips" aria-hidden="true">' + [0, 1, 2].map(i => '<i' + (i < n ? ' class="on"' : "") + '></i>').join("") + '</span>';
function ezHero(slug, s){
  const L = ezLook(slug), n = Math.min(ezPasses(s, slug), 3), won = n >= 3;
  return '<button class="ezfav" style="--ec1:' + L.c1 + ';--ec2:' + L.c2 + '" onclick="ezClub(\'' + slug + '\')" aria-label="' + esc("Your club, " + L.name + (won ? ", Expert medal" : ", " + n + " of 3 passed")) + '">' + ezPatch(slug, 54) +
    '<span class="m"><small>Your club</small><b>' + esc(L.name) + '</b>' + (won ? '<i>Expert</i>' : ezPips(n)) + '</span><span class="go" aria-hidden="true">›</span></button>';
}
function ezZoneHTML(){
  const list = ezClubs(), fav = ezFav(list), order = ezOrder(list, fav), s = ezStore(), xs = expertStore(), medals = list.filter(c => ezPasses(xs, c.slug) >= 3).length;
  const rest = order.filter(c => c.slug !== fav);
  const stat = s.runs ? '<span class="ezbest"><b>' + (s.best | 0) + '<small>/' + EZ_N + '</small></b><i>Your best</i></span>' : "";
  return b4Page({ title: "Euregio Zone", ctx: "Three countries, " + list.length + " clubs", back: "ezBack()", cls: "ezpage ez-zone", body:
    '<section class="ezquiz" aria-label="Euregio Quiz"><div class="ezqtop"><div class="m"><small>Euregio Quiz</small><b>The whole region, easy to hard</b><i>Ten questions, twenty seconds each.</i></div>' + stat + '</div>' +
      '<button class="b4btn gold" onclick="ezStart()"' + (EZ_BUSY ? " disabled" : "") + '>' + (EZ_BUSY ? "One moment…" : s.runs ? "Play again" : "Play") + '</button></section>' +
    '<div id="eznight" class="ezslot">' + ezNightHTML() + '</div>' +
    '<div class="b6hdr ezh">The clubs<span>' + (medals ? medals + " of " + list.length + " medals" : "Club Expert") + '</span></div>' +
    (fav ? ezHero(fav, xs) : "") + '<div class="ezgrid">' + rest.map(c => ezTile(c.slug, xs)).join("") + '</div>' +
    (PL_ON ? '<div class="b6hdr ezh">With your mates</div><section class="ezleague" aria-label="' + esc(EZ_LEAGUE.name) + '"><div class="ezlrow" aria-hidden="true">' + EZ_LEAGUE.slugs.map(x => ezPatch(x, 26)).join("") + '</div>' +
      '<b>' + esc(EZ_LEAGUE.name) + '</b><p>Eight local clubs, every match they play. Call the scores, beat your mates.</p>' + b4Btn("Start the league", "ezLeague()", "dark") + '</section>' : "") });
}

/* ---------- a quiz ---------- */
const ezQ = () => EZ.deal[EZ.i];
const ezViewKey = () => EZ.i + (EZ.shown ? "s" : "q");
function ezRunHTML(){
  const Q = ezQ(), shown = EZ.shown, picks = EZ.picks, right = picks.filter(Boolean).length;
  const pip = i => '<i class="' + (i < picks.length ? (picks[i] ? "hit" : "miss") : i === EZ.i ? "cur" : "") + '"></i>';
  const opts = Q.o.map((t, i) => '<button class="h2opt' + (shown ? (i === Q.k ? " right" : i === EZ.pick ? " wrong" : " dim") : "") + '"' + (shown ? " disabled" : "") + ' onclick="ezAnswer(' + i + ')"><span class="k">' + "ABCD"[i] + '</span>' + esc(String(t)) + '</button>').join("");
  const clock = shown ? "" : '<div class="clock ezclock" id="clock" role="timer"><div class="bar"><i style="width:100%"></i></div><div class="digits">' + EZ_SECS + '.0</div></div>';
  const next = shown && !picks[EZ.i] ? b4Btn(EZ.i + 1 < EZ_N ? "Next question" : "See how you did", "ezNext()", "gold") : "";
  return b4Page({ title: "Euregio Quiz", ctx: (EZ.i + 1) + " of " + EZ_N + " · " + EZ_WORD[Q.tier], back: "ezAskLeave()", leave: "ezAskLeave()", cls: "ezpage ez-run", body:
    '<span hidden data-ezk="' + ezViewKey() + '"></span>' +
    '<div class="ezdash"><span class="ezmark">' + (shown ? ezPatch(Q.slug, 26) : "") + '</span><span class="ezten" role="img" aria-label="' + right + ' right so far">' + Array.from({ length: EZ_N }, (_, i) => pip(i)).join("") + '</span><b>' + right + '<small>/' + EZ_N + '</small></b></div>' + clock +
    '<div class="qcard ezq' + (shown ? "" : " qin") + '"><div class="qtext">' + esc(String(Q.q)) + '</div><div class="ezopts">' + opts + '</div>' +
      '<div class="ezsay" role="status">' + esc(EZ.say || "") + '</div></div>' + next });
}
function ezShow(){
  const Q = ezQ();
  EZ.shown = false; EZ.pick = null; EZ.say = "";
  const s = ezStore(); ezMark(s, [ezId(Q)]); ezSave(s);
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  startTimer(EZ_SECS, ezTimeUp, "euregio:" + EZ.n + ":" + EZ.i);
}
function ezAnswer(i){
  if(!EZ || EZ.shown || EZ_VIEW !== "run") return;
  audio();
  stopTimer();
  ezReveal(i);
}
function ezTimeUp(){ if(!EZ || EZ.shown) return; stopTimer(); ezReveal(-1); }
function ezReveal(i){
  const Q = ezQ(), ok = i === Q.k;
  EZ.shown = true; EZ.pick = i;
  EZ.picks.push(ok);
  if(ok) EZ.right++;
  try{ progAnswer({ ok, tier: Q.tier, topic: topicKey(Q.deck) || "general" }); }catch(e){}
  try{ if(ok) fb.correct(null); else if(i >= 0) fb.wrong(null); else fb.run = 0; }catch(e){}
  /* the green option is the answer, so what's said under it is the bank's fact */
  EZ.say = ok ? "Right." : (i < 0 ? "Out of time. " : "") + String(Q.sub || "");
  try{ a11ySay(ok ? "Right." : "It was " + Q.o[Q.k] + ". " + EZ.say); }catch(e){}
  render();
  if(ok){ clearTimeout(EZ_TIMER); const run = EZ; EZ_TIMER = setTimeout(() => { if(EZ === run) ezNext(); }, EZ_RIGHT_MS); }
}
function ezNext(){
  if(!EZ || !EZ.shown) return;
  audio();
  clearTimeout(EZ_TIMER); EZ_TIMER = null;
  EZ.i++;
  if(EZ.i < EZ_N) return ezShow();
  ezFinish();
}
/* the decks first, then the quiz */
function ezStart(){
  audio();
  if(EZ_BUSY) return;
  const list = ezQuizClubs();
  if(list.some(c => !EZ_DECKS[c.slug])){
    EZ_BUSY = true; render();
    return ezLoad(list).then(() => { EZ_BUSY = false; ezGo(list); });
  }
  ezGo(list);
}
function ezGo(list){
  if(!EZ_VIEW || EZ) return;
  const s = ezStore(), deal = ezDeal(ezPool(list, EZ_DECKS), s.seen || []);
  if(!deal){ render(); return toast("That didn’t load. Try again in a moment.", true); }
  try{ wakeLock(); }catch(e){}
  try{ fb.run = 0; }catch(e){}
  EZ = { deal, n: Date.now(), i: 0, right: 0, picks: [], shown: false, pick: null, say: "" };
  EZD = null;
  EZ_VIEW = "run";
  ezShow();
}
function ezFinish(){
  if(!EZ) return;
  clearTimeout(EZ_TIMER); EZ_TIMER = null; stopTimer();
  try{ progSave(progLoad()); }catch(e){}
  const s = ezStore(), right = EZ.right, rec = ezRecord(s, right);
  ezSave(s);
  try{ tlmEvent("euregio_done", { right, best: rec.best ? 1 : 0 }); }catch(e){}
  EZD = { right, picks: EZ.picks, clubs: EZ.deal.map(r => r.slug), best: rec.best, first: rec.first };
  EZ = null; EZ_VIEW = "done";
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function ezAskLeave(){
  audio();
  if(EZ_TIMER) return;   // the answer is landing: a moment, and it's the next question
  sheet('<h2>Leave the quiz?</h2><p>' + (EZ && EZ.right ? "You’d lose these " + EZ.right + " right. Your best stays as it is." : "Nothing is lost. Your best stays as it is.") + '</p>' +
    '<button class="b4btn gold" onclick="closeSheet()">Keep going</button><button class="b4btn quiet" onclick="ezLeave()">Leave</button>');
}
function ezLeave(){
  audio(); closeSheet();
  clearTimeout(EZ_TIMER); EZ_TIMER = null; stopTimer();
  EZ = null; EZ_VIEW = "zone"; render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
/* the line under a revealed question reports this question */
function ezQrep(){
  if(!EZ || !EZ.shown) return null;
  const Q = ezQ(), anchor = document.querySelector("#stage .ezq");
  return Q && anchor ? { q: Q.q, a: Q.o[Q.k], deck: Q.deck, tier: Q.tier, anchor } : null;
}

/* ---------- after a quiz ---------- */
function ezDoneHTML(){
  const D = EZD, s = ezStore(), best = s.best | 0;
  const sub = D.first ? "That’s your score to beat." : D.best ? "A new best." : D.right === best ? "Level with your best." : "Your best is " + best + " of " + EZ_N + ".";
  const row = D.clubs.map((x, i) => '<span class="' + (D.picks[i] ? "hit" : "miss") + '">' + ezPatch(x, 24) + '</span>').join("");
  return b4Page({ title: "Euregio Quiz", ctx: D.best && !D.first ? "New best" : "Full time", back: "ezBack()", cls: "ezpage ez-done", body:
    '<div class="ezres" role="img" aria-label="' + D.right + ' of ' + EZ_N + ' right">' + row + '</div>' + b4Q(esc(D.right + " of " + EZ_N), esc(sub + " The ones you’ve just seen come last next time.")) +
    b4Btn("Play again", "ezStart()", "gold") + b4Btn("Back to the Zone", "ezBack()", "quiet") });
}

/* ---------- getting about ---------- */
function ezClose(){
  clearTimeout(EZ_TIMER); EZ_TIMER = null;
  stopTimer();
  EZ_VIEW = null; EZ = null; EZD = null;
  render();
  try{ feelScrollBack("home"); }catch(e){}
}
function ezBack(){
  audio();
  if(EZ_VIEW === "done"){ EZD = null; EZ_VIEW = "zone"; render(); try{ window.scrollTo(0, 0); }catch(e){} return; }
  if(EZ_VIEW === "pick" && !ezStore().as) return ezClose();   // nothing chosen yet: there's no map to go back to
  if(EZ_VIEW === "zone" || EZ_VIEW === "away" || EZ_VIEW === "won" || EZ_VIEW === "pick" || EZ_VIEW === "table"){ const won = EZ_VIEW === "won"; EZW = null; EZ_VIEW = "map"; render(); if(won) ezMoments(); return; }
  ezClose();
}
/* A CLUB'S TILE: its Club Expert page, once Club Expert is here, and back comes back (expBack, expClose). Fanbase Battle's way in */
function ezClub(slug){
  audio();
  expertSeen();
  b4Explain("expert", () => {
    if(EXP_LOAD === -1) EXP_LOAD = 0;
    EZ_VIEW = null; EXP_FROM = "euregio"; EXP_VIEW = "pick"; ME_VIEW = null; LOCKER_VIEW = null; closeSheet();
    expNeed(() => { if(EXP_VIEW) expPick(slug); });
    if(EXP_LOAD !== 2) render();
  });
}
/* THE LIMBURG LEAGUE: Call It's new-league page, filled in, whatever else Call It has to say first. Its back comes back here */
function ezLeague(){
  EZ_VIEW = null;
  openLeague("callit");
  plNeed(() => { if(LEAGUE_VIEW) clNewFilled({ name: EZ_LEAGUE.name, teams: ezTeams(), names: ezNames(), back: "ezLeagueBack()" }); });
}
function ezLeagueBack(){ audio(); LEAGUE_VIEW = null; ezReturn(); }

/* ---------- the screen ---------- */
function ezRender(st){
  /* something landing while a question is up calls render(): the question and its clock stay where they are */
  if(EZ && EZ_VIEW === "run"){ try{ if(st.querySelector("[data-ezk='" + ezViewKey() + "']")){ b6Paper(true); return; } }catch(e){} }
  if(EZ_VIEW === "run" && !EZ) EZ_VIEW = "zone";
  if(EZ_VIEW === "done" && !EZD) EZ_VIEW = "zone";
  if(EZ_VIEW === "won" && !EZW) EZ_VIEW = "map";
  if(EZ_VIEW === "map" && !ezStore().as) EZ_VIEW = "pick";   // the first time in: who do you take on the road?
  if(EZ_VIEW === "away" && !ezStop(EZ_STOP)) EZ_VIEW = "map";
  b6Paper(true);
  st.innerHTML = EZ_VIEW === "run" ? ezRunHTML() : EZ_VIEW === "done" ? ezDoneHTML() : EZ_VIEW === "zone" ? ezZoneHTML() : EZ_VIEW === "away" ? ezAwayHTML() : EZ_VIEW === "won" ? ezWonHTML() : EZ_VIEW === "pick" ? ezPickHTML() : EZ_VIEW === "table" ? ezTableHTML() : ezMapPage();
  ezPaint(st);
  ezMapAfter(st);
  if(!EZ_MIGRATED){ EZ_MIGRATED = true; const s = ezStore(); if(ezMigrate(s)) ezSave(s); }
  if(EZ_VIEW === "map") ezFlush();
  if(EZ_VIEW !== "zone") return;
  /* back from a club: b6Screen puts every new screen at the top on its next frame, so the page goes back where it was on the one after */
  if(EZ_BACK_Y != null){ const y = EZ_BACK_Y; EZ_BACK_Y = null; requestAnimationFrame(() => requestAnimationFrame(() => { try{ window.scrollTo(0, y); }catch(e){} })); }
  ezNightAsk();
  if(!CLUBID) setTimeout(() => { if(EZ_VIEW === "zone") render(); }, 600);
}
try{ window.addEventListener("resize", () => { if(EZ_VIEW === "map") render(); }); window.addEventListener("online", () => ezFlush(true)); }catch(e){}
