/* BALL 4 · ONE SAVE ON EVERY PHONE: the phone side.
   _plans/leagues-signup-sync.md §3 (Martijn, 2 Nov 2026: "is it possible that if you sign up then whichever device you
   use and login it has the exact data?"); every key and its rule: _plans/sync.md; the server: 019_sync.sql.

   Loaded by index.html (syncNeed) once this phone has a club that syncs: acctBoot with the server up, a sign-in, or a
   phone that synced before (so a change made offline is noticed from the first second). Never for a guest without a
   club (the plan's decision 4: a guest's save is the phone). A plain script with plain globals, like push.js.

   THE SHAPE
     - SYNC_KEYS: the localStorage keys that follow you, each with its merge rule. Everything else stays on the phone
       (SYNC_NEVER says why for each). The rules are pure (syncMerge) and exported for sync-test.js.
     - PUSH: one wrapper round localStorage.setItem notices a whitelisted key changing; two seconds after the last
       change (and never more than once in 30 seconds) the changed keys go up (state_push), each with the rev this
       phone last saw, so a write from another phone in between comes back as a conflict, is merged and goes up again.
       On pagehide or the tab hiding they go at once (keepalive). Offline they wait: the record ball4-sync keeps which
       keys changed, when, and the rev and hash of what the server has, and is itself never synced.
     - PULL: at boot, at a sign-in, and when the tab comes back after ten minutes: the rows newer than this phone's
       rev (all of them on a new phone). Each is merged into the phone with its rule; where the merge differs from the
       server's copy it goes back up. Merging waits for a front screen: never in the middle of a match or a game.
     - What the server already keeps comes down too (syncTakeProfile): the Daily streak, Daily wins, titles, the club,
       the favourites. XP, rating and placement come down in acctTake, as before. */

/* ---------- the limits, as 019 sets them (sync-test.js compares) ---------- */
const SYNC_LIMITS = { value: 65536, user: 1048576, pushes: 120, rows: 100 };
const SYNC_REC = "ball4-sync";        // {uid, rev, keys: {k: [rev, hash]}, t: {k: ms}, dirty: [k]}: this phone's own
const SYNC_ROOM = 60000;              // what one value may take on the way up (019 allows 64 KB)
let SYNC_DEBOUNCE = 2000, SYNC_GAP = 30000, SYNC_AWAY = 600000, SYNC_WATCH = 4000, SYNC_CALM_EVERY = 2500;   // a test sets them low

/* ---------- the rules ---------- */
const SYNC_MAX = { r: "max" }, SYNC_MIN = { r: "min" }, SYNC_OR = { r: "or" }, SYNC_LATEST = { r: "latest" }, SYNC_LOCAL = { r: "local" };
const syncU = o => Object.assign({ r: "union" }, o || {});                 // sets: arrays (by value or by id) and {k: x} maps
const syncK = each => ({ r: "keys", each });                               // a map whose entries merge with one rule
const syncF = (f, groups) => ({ r: "fields", f: f || {}, groups: groups || [] });   // per field; a group moves together
const syncD = o => Object.assign({ r: "days" }, o);                       // a day's record, or a dictionary of days
const syncS = o => Object.assign({ r: "streak", n: "played", last: "last" }, o || {});
const syncP = by => ({ r: "pick", by });                                   // the better of two, by SYNC_BETTER[by]
const SYNC_GAME = extra => syncF(Object.assign({ played: SYNC_MAX, won: SYNC_MAX, best: SYNC_MAX, "*": SYNC_LATEST }, extra || {}));

/* EVERY KEY THAT FOLLOWS YOU (the table with what each holds is _plans/sync.md). raw: a plain string, not JSON.
   fit: how a long value is trimmed on the way up (the phone keeps all of it). */
const SYNC_KEYS = {
  /* progression (progBlank in index.html): XP, rating, titles, the locker */
  "ball4-prog": { rule: syncF({
      v: SYNC_MAX, xp: SYNC_MAX, hist: syncU({ id: "t", sort: "t", cap: 60 }), topics: syncK(syncP("n")), titles: SYNC_MAX,
      title: SYNC_LATEST, freeze: syncP("week"), lastDay: SYNC_MAX, wins: SYNC_MAX, dailyWins: SYNC_MAX, matches: SYNC_MAX,
      rankUps: SYNC_MAX, detective: SYNC_MAX, bestStreak: SYNC_MAX, hardWins: SYNC_MAX, moments: SYNC_LOCAL, migrated: SYNC_OR,
      since: SYNC_MIN, scarves: syncK(SYNC_MIN), trophies: syncK({ r: "trophy" }), pennant: SYNC_LATEST, colours: SYNC_LATEST,
      wall: SYNC_LATEST, unrated: syncU(), pending: SYNC_LOCAL, ptsDay: syncP("day"), weekWins: syncU({ sort: true, cap: 10 }),
      synced: SYNC_LOCAL, cupWon: SYNC_OR, snow: syncP("year"), "*": SYNC_LATEST },
    [{ keys: ["rating", "rated", "shield", "shieldFloor"], rule: syncP("rated") }]) },
  /* the Daily Ball, its streak, the album, the Cup (MINE_BLANK) */
  "ball4-mine": { fit: "mine", rule: syncF({
      v: SYNC_MAX,
      daily: syncD({ one: "date", same: syncP("ladder"), carry: { spent: syncU() } }),
      shoot: syncD({ one: "date", same: syncP("shootout") }),
      streak: syncS({ also: [["half", "lastHalf"]] }),
      album: syncF({ books: syncK(syncF({ have: SYNC_MAX, foils: syncU(), seen: syncU(), done: SYNC_OR, "*": SYNC_LATEST })),
        packs: SYNC_MAX, swaps: SYNC_MAX, "*": SYNC_LATEST }),
      cups: syncU({ id: "ts", sort: "ts", cap: 40 }),
      "*": SYNC_LATEST }) },
  "ball4-best": { rule: SYNC_MAX },
  "ball4-record": { rule: SYNC_MAX },
  "ball4-three": { rule: syncS({ n: "streak" }) },
  "ball4-gtp": { rule: syncF({ played: SYNC_MAX, wins: SYNC_MAX, "*": SYNC_LATEST }, [
      { keys: ["day", "guesses", "done", "won", "xp"], rule: syncD({ one: "day", same: syncP("gtp") }) },
      { keys: ["streak", "last"], rule: syncS({ n: "streak" }) }]) },
  "ball4-lists": { rule: syncF({ best: syncK(syncP("list")), streak: syncS(), golds: SYNC_MAX,
      daily: syncD({ one: "day", same: syncF({ all: syncP("entry"), top10: syncP("entry"), "*": SYNC_LATEST }) }), "*": SYNC_LATEST }) },
  "ball4-seen": { rule: syncU() },
  "ball4-seen-games": { rule: syncU() },
  "ball4-quiz-history-v1": { rule: syncU({ id: "id", sort: "ts", cap: 300 }), fit: "list" },
  "ball4-pl-seen": { rule: syncU({ cap: 400 }) },
  "ball4-theme": { rule: syncF({ seen: syncU(), unlocked: syncU(), "*": SYNC_LATEST }) },
  "ball4-feel": { rule: syncF({ low: SYNC_LOCAL, n: SYNC_MAX, asked: SYNC_OR, "*": SYNC_LATEST }) },
  "ball4-tt": { rule: SYNC_GAME() },
  "ball4-gw": { rule: SYNC_GAME({ matches: SYNC_MAX, mwon: SYNC_MAX }) },
  /* the cases seen lately, per level, are a recency list the game trims to 60: the newer list (a union would undo the trim) */
  "ball4-dd": { rule: SYNC_GAME({ seen: syncK(SYNC_LATEST) }) },
  "ball4-lb": { rule: SYNC_GAME() },
  "ball4-yr": { rule: SYNC_GAME() },
  "ball4-cele": { rule: SYNC_LATEST },
  "ball4-hilo": { rule: SYNC_LATEST },
  "ball4-simple": { rule: SYNC_LATEST },
  "ball4-party": { rule: SYNC_LATEST },
  "ball4-names": { rule: SYNC_LATEST },
  "ball4-us": { rule: SYNC_LATEST },
  "ball4-mc-pins": { rule: SYNC_LATEST },
  "ball4-mc-club": { rule: SYNC_LATEST },
  "ball4-answer": { raw: true, rule: SYNC_LATEST },
  "ball4-mute": { raw: true, rule: SYNC_LATEST },
  "ball4-tackle": { raw: true, rule: SYNC_LATEST },
  "ball4-h2h-flat": { raw: true, rule: SYNC_LATEST },
  "ball4-ai": { raw: true, rule: SYNC_LATEST },
  "ball4-ai-level": { raw: true, rule: SYNC_LATEST },
  "ball4-ai-tempo": { raw: true, rule: SYNC_LATEST },
  "ball4-mp-name": { raw: true, rule: SYNC_LATEST },
  "ball4-crew": { raw: true, rule: SYNC_LATEST },
  "ball4-first-match": { raw: true, rule: SYNC_LATEST },
  "ball4-lg-seg": { raw: true, rule: SYNC_LATEST },
};
/* AND EVERY KEY THAT STAYS ON THE PHONE, with why (sync-test.js checks that every ball4-* key in the app is in one
   of the two lists, so a new key has to be decided on) */
const SYNC_NEVER = {
  "ball4-quiz-v1": "the match in progress",
  "ball4-quiz-history-v1-bak": "the record book's second copy on this phone",
  "ball4-outbox": "the queue of matches and dailies on their way to the server",
  "ball4-p2-outbox": "player 2's queue",
  "ball4-pl-pend": "Call It calls not yet saved: they go to the server themselves",
  "ball4-acct": "this phone's account flags (signed out, founded, the join code)",
  "ball4-p2-auth": "player 2's sign-in on this phone",
  "ball4-fyc": "the sign-up draft",
  "ball4-stash:": "a signed-out account's save, put away under its id",
  "ball4-guest": "a guest's streak (a guest's save is the phone, plan decision 4)",
  "ball4-guest-prog": "a guest's progression: replayed into ball4-prog on founding, which then syncs",
  "ball4-guest-best": "a guest's bests: replayed into ball4-best on founding",
  "ball4-tlm": "telemetry queue", "ball4-tid": "the install id, never joined to the account", "ball4-tlm-once": "telemetry",
  "ball4-tlm-day": "telemetry", "ball4-tlm-on": "telemetry switch for this phone", "ball4-qrep": "question reports queue",
  "ball4-qrep-done": "question reports sent from this phone",
  "ball4-push": "this browser's push address", "ball4-push-on": "push switch for this phone",
  "ball4-install-hide": "the install hint on this phone", "ball4-intro": "the once-a-day intro on this screen",
  "ball4-fyc-on": "switch for this phone", "ball4-pl-on": "switch for this phone", "ball4-sup-on": "switch for this phone",
  "ball4-sync-on": "switch for this phone", "ball4-sync": "this record",
  "ball4-sup": "Supporter status, read from the server", "ball4-pl-strip": "a cache of the server's Call It",
  "ball4-mc-strip": "a cache of the Match Centre card",
  "ball4-outcomes": "the answer log (up to 8,000 rows, far past 64 KB): kept for the re-tier tool and Export",
  "ball4-outcomes-": "not a key: the name of the downloaded log",
  "ball4-lb-fix": "Letter Box appeals kept for a later data fix",
  "ball4-club": "the club design: the profile carries it (set_club checks it), so it comes down from there",
};

/* ---------- the pure part ---------- */
const syncObj = x => !!x && typeof x === "object" && !Array.isArray(x);
const syncNumStr = x => typeof x === "string" && /^-?\d+(\.\d+)?$/.test(x);
const syncLen = x => (Array.isArray(x) ? x.length : 0);
function syncCmp(a, b){
  if(a === b) return 0;
  if(a == null) return -1; if(b == null) return 1;
  if(typeof a === "number" && typeof b === "number") return a - b;
  if(syncNumStr(a) && syncNumStr(b)) return +a - +b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
/* a day as a number of days: the app's dayKey (20261102, or "20261102") or "2026-11-02" */
function syncDayNum(v){
  if(v == null || v === "") return null;
  const m = String(v).match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null;
}
const syncKeysOf = (a, b) => Object.keys(a).concat(Object.keys(b).filter(k => !Object.prototype.hasOwnProperty.call(a, k)));
const SYNC_MEDAL = { bronze: 1, silver: 2, gold: 3 };
/* which of two is better: > 0 the first, < 0 the second, 0 a tie (the phone's stays) */
const SYNC_BETTER = {
  n: (a, b) => (+a.n || 0) - (+b.n || 0),                                         // a topic's counters: the one with more answers
  rated: (a, b) => (+a.rated || 0) - (+b.rated || 0),                             // rating, placement, shield: more rated games
  week: (a, b) => syncCmp(a.week, b.week) || (+b.left || 0) - (+a.left || 0),     // the freeze: the later week; a spent one stays spent
  day: (a, b) => syncCmp(syncDayNum(a.day) ?? a.day, syncDayNum(b.day) ?? b.day) || (+a.n || 0) - (+b.n || 0),
  year: (a, b) => (+a.year || 0) - (+b.year || 0) || (+a.n || 0) - (+b.n || 0),
  list: (a, b) => (+a.found || 0) - (+b.found || 0) || (SYNC_MEDAL[a.medal] || 0) - (SYNC_MEDAL[b.medal] || 0),
  entry: (a, b) => (!!a.done - !!b.done) || syncLen(a.found) - syncLen(b.found),
  ladder: (a, b) => (!!a.done - !!b.done) || (+a.reached || 0) - (+b.reached || 0) || (+a.rung || 0) - (+b.rung || 0) || syncLen(a.got) - syncLen(b.got),
  shootout: (a, b) => (!!a.done - !!b.done) || syncLen(a.kicks) - syncLen(b.kicks),
  gtp: (a, b) => (!!a.done - !!b.done) || (a.done
    ? (!!a.won - !!b.won) || (a.won ? syncLen(b.guesses) - syncLen(a.guesses) : 0)       // found in fewer is better
    : syncLen(a.guesses) - syncLen(b.guesses)),                                         // a day under way: the further one
};
const syncLatest = (a, b, c) => (a === undefined ? b : b === undefined ? a : c && c.local ? a : b);
/* two runs of days, [last - n + 1 .. last] each: touching or overlapping they are one run; apart, the later one */
function syncStreakJoin(out, a, b, nf, lf){
  const na = +a[nf] || 0, nb = +b[nf] || 0, la = syncDayNum(a[lf]), lb = syncDayNum(b[lf]);
  const A = na > 0 && la != null ? [la - na + 1, la] : null, B = nb > 0 && lb != null ? [lb - nb + 1, lb] : null;
  if(!A && !B) return;
  let n, from;
  if(!A){ n = nb; from = b; }
  else if(!B){ n = na; from = a; }
  else if(A[0] <= B[1] + 1 && B[0] <= A[1] + 1){ n = Math.max(A[1], B[1]) - Math.min(A[0], B[0]) + 1; from = A[1] >= B[1] ? a : b; }
  else { from = A[1] >= B[1] ? a : b; n = from === a ? na : nb; }
  out[nf] = n; out[lf] = from[lf];
}
function syncMerge(rule, a, b, c){
  rule = rule || SYNC_LATEST;
  if(rule.r === "local") return a;
  if(a === undefined && rule.r === "fields" && syncObj(b)) a = {};
  if(a === undefined) return b;
  if(b === undefined) return a;
  /* nothing on one side (a list not started today, no Cup run) is nothing, except as a setting's value */
  if(rule.r !== "latest"){ if(a === null) return b; if(b === null) return a; }
  switch(rule.r){
    case "max": {
      if(typeof a === "number" && typeof b === "number") return Math.max(a, b);
      if(syncNumStr(a) && syncNumStr(b)) return +a >= +b ? a : b;
      if(typeof a === "boolean" && typeof b === "boolean") return a || b;
      if(syncObj(a) && syncObj(b)){ const o = {}; for(const k of syncKeysOf(a, b)) o[k] = syncMerge(SYNC_MAX, a[k], b[k], c); return o; }
      return syncLatest(a, b, c);
    }
    case "min": {
      if(typeof a === "number" && typeof b === "number") return Math.min(a, b);
      if(syncNumStr(a) && syncNumStr(b)) return +a <= +b ? a : b;
      return syncLatest(a, b, c);
    }
    case "or": return a || b;
    case "latest": return syncLatest(a, b, c);
    case "union": {
      if(Array.isArray(a) && Array.isArray(b)){
        /* the server's order first and this phone's extras after it: the next phone to merge finds nothing to add,
           so two phones agree instead of swapping the order back and forth */
        let o = b.slice();
        if(rule.id){
          const ids = new Set(b.map(x => x && x[rule.id]));
          for(const x of a){ const id = x && x[rule.id]; if(id === undefined || !ids.has(id)){ o.push(x); ids.add(id); } }
        } else {
          const has = new Set(b.map(syncCanon));
          for(const x of a){ const k = syncCanon(x); if(!has.has(k)){ o.push(x); has.add(k); } }
        }
        if(rule.sort) o = o.map((x, i) => [x, i]).sort((p, q) => (rule.sort === true ? syncCmp(p[0], q[0]) : syncCmp(p[0] && p[0][rule.sort], q[0] && q[0][rule.sort])) || p[1] - q[1]).map(p => p[0]);
        if(rule.cap && o.length > rule.cap) o = o.slice(o.length - rule.cap);
        return o;
      }
      if(syncObj(a) && syncObj(b)){
        const o = {};
        for(const k of syncKeysOf(a, b)) o[k] = (k in a && k in b) ? (rule.each ? syncMerge(rule.each, a[k], b[k], c) : a[k]) : (k in a ? a[k] : b[k]);
        /* a cap keeps the last keys in sorted order (Call It's fixture ids: the newest), the same on every phone */
        if(rule.cap){ const ks = Object.keys(o).sort(syncCmp); for(const k of ks.slice(0, Math.max(0, ks.length - rule.cap))) delete o[k]; }
        return o;
      }
      return syncLatest(a, b, c);
    }
    case "keys": {
      if(!syncObj(a) || !syncObj(b)) return syncLatest(a, b, c);
      const o = {};
      for(const k of syncKeysOf(a, b)) o[k] = (k in a && k in b) ? syncMerge(rule.each, a[k], b[k], c) : (k in a ? a[k] : b[k]);
      return o;
    }
    case "fields": {
      if(!syncObj(a) || !syncObj(b)) return syncLatest(a, b, c);
      const o = {}, done = new Set();
      for(const g of rule.groups || []){
        const sa = {}, sb = {};
        for(const k of g.keys){ if(a[k] !== undefined) sa[k] = a[k]; if(b[k] !== undefined) sb[k] = b[k]; done.add(k); }
        const m = !Object.keys(sa).length ? sb : !Object.keys(sb).length ? sa : syncMerge(g.rule, sa, sb, c);
        for(const k of g.keys) if(m && m[k] !== undefined) o[k] = m[k];
      }
      for(const k of syncKeysOf(a, b)){
        if(done.has(k)) continue;
        const v = syncMerge(rule.f[k] || rule.f["*"] || SYNC_LATEST, a[k], b[k], c);
        if(v !== undefined) o[k] = v;
      }
      return o;
    }
    case "days": {
      if(!syncObj(a) || !syncObj(b)) return syncLatest(a, b, c);
      if(rule.one){
        const da = syncDayNum(a[rule.one]) ?? -1, db = syncDayNum(b[rule.one]) ?? -1;
        let o = da > db ? Object.assign({}, a) : db > da ? Object.assign({}, b)
          : Object.assign({}, rule.same ? syncMerge(rule.same, a, b, c) : a);
        for(const f of Object.keys(rule.carry || {})){ const v = syncMerge(rule.carry[f], a[f], b[f], c); if(v !== undefined) o[f] = v; }
        return o;
      }
      /* a dictionary {day: entry}: every day from either side, a clash the better entry, the newest cap days */
      const o = {};
      for(const k of syncKeysOf(a, b)) o[k] = (k in a && k in b) ? (rule.same ? syncMerge(rule.same, a[k], b[k], c) : a[k]) : (k in a ? a[k] : b[k]);
      if(rule.cap){ const ks = Object.keys(o).sort((x, y) => (syncDayNum(x) ?? 0) - (syncDayNum(y) ?? 0)); for(const k of ks.slice(0, Math.max(0, ks.length - rule.cap))) delete o[k]; }
      return o;
    }
    case "streak": {
      if(!syncObj(a) || !syncObj(b)) return syncLatest(a, b, c);
      const la = syncDayNum(a[rule.last]) ?? -1, lb = syncDayNum(b[rule.last]) ?? -1;
      const aNewer = la > lb || (la === lb && (+a[rule.n] || 0) >= (+b[rule.n] || 0));
      const o = Object.assign({}, aNewer ? b : a, aNewer ? a : b);
      syncStreakJoin(o, a, b, rule.n, rule.last);
      for(const [n2, l2] of rule.also || []) syncStreakJoin(o, a, b, n2, l2);
      if(a.best !== undefined || b.best !== undefined) o.best = Math.max(+a.best || 0, +b.best || 0, +o[rule.n] || 0);
      return o;
    }
    case "pick": {
      if(!syncObj(a) || !syncObj(b)) return syncLatest(a, b, c);
      const f = SYNC_BETTER[rule.by];
      return (f ? f(a, b) : 0) < 0 ? b : a;
    }
    case "trophy": {
      if(!syncObj(a) || !syncObj(b)) return syncLatest(a, b, c);
      const newer = (+a.last || 0) >= (+b.last || 0) ? a : b;
      const o = Object.assign({}, newer === a ? b : a, newer);
      o.count = Math.max(+a.count || 1, +b.count || 1);
      o.metal = (SYNC_MEDAL[a.metal] || 0) >= (SYNC_MEDAL[b.metal] || 0) ? a.metal : b.metal;
      const firsts = [+a.first, +b.first].filter(x => x > 0);
      if(firsts.length) o.first = Math.min(...firsts);
      o.last = Math.max(+a.last || 0, +b.last || 0) || o.last;
      return o;
    }
  }
  return syncLatest(a, b, c);
}
/* the same value always writes the same text, whatever order its keys came in (jsonb sorts them) */
function syncCanon(v){
  if(v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if(Array.isArray(v)) return "[" + v.map(syncCanon).join(",") + "]";
  return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + syncCanon(v[k])).join(",") + "}";
}
function syncHash(v){
  const s = syncCanon(v);
  let h = 0x811c9dc5;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + "." + s.length.toString(36);
}
function syncBytes(s){
  try{ if(typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length; }catch(e){}
  return String(s).length * 2;
}
/* what goes up: the fields that stay on this phone left out, a long list trimmed from its oldest end */
function syncFit(k, v){
  const spec = SYNC_KEYS[k];
  if(!spec || v === undefined) return v;
  if(spec.rule.r === "fields" && syncObj(v)){
    const loc = Object.keys(spec.rule.f).filter(f => spec.rule.f[f] === SYNC_LOCAL && f in v);
    if(loc.length){ v = Object.assign({}, v); for(const f of loc) delete v[f]; }
  }
  if(!spec.fit || syncBytes(JSON.stringify(v)) <= SYNC_ROOM) return v;
  if(spec.fit === "list" && Array.isArray(v)){
    let o = v.slice();
    while(o.length && syncBytes(JSON.stringify(o)) > SYNC_ROOM) o = o.slice(Math.max(1, Math.ceil(o.length / 10)));
    return o;
  }
  if(spec.fit === "mine" && syncObj(v) && syncObj(v.daily) && syncObj(v.daily.spent)){
    /* the Daily's spent questions are the long part: the newest ones go up, every one stays on the phone */
    let ks = Object.keys(v.daily.spent), o = v;
    while(ks.length && syncBytes(JSON.stringify(o)) > SYNC_ROOM){
      ks = ks.slice(Math.ceil(ks.length / 4));
      const spent = {}; for(const q of ks) spent[q] = v.daily.spent[q];
      o = Object.assign({}, v, { daily: Object.assign({}, v.daily, { spent }) });
    }
    return o;
  }
  return v;
}
/* how many keys each rule has, for the plan and the test */
function syncInventory(){
  const n = {};
  for(const k of Object.keys(SYNC_KEYS)){ const r = SYNC_KEYS[k].rule.r; n[r] = (n[r] || 0) + 1; }
  return { synced: Object.keys(SYNC_KEYS).length, never: Object.keys(SYNC_NEVER).length, byRule: n };
}

/* ---------- the phone ---------- */
let SYNC = { on: false, uid: null, rec: null, state: "idle", at: 0, last: 0, first: 0, busy: false, timer: null, recT: null,
  calmT: null, retryT: null, fails: 0, pending: null, scan: false, hidAt: 0, big: {}, titles: null, shown: "", q: Promise.resolve(),
  set: (k, v) => localStorage.setItem(k, v), wrapped: false, watch: null };

function syncRead(k){
  let raw = null;
  try{ raw = localStorage.getItem(k); }catch(e){}
  if(raw == null) return { raw: null, v: undefined };
  const spec = SYNC_KEYS[k];
  if(spec && spec.raw) return { raw, v: raw };
  try{ return { raw, v: JSON.parse(raw) }; }catch(e){ return { raw, v: undefined }; }
}
function syncWrite(k, v){
  const spec = SYNC_KEYS[k];
  try{ SYNC.set(k, spec && spec.raw ? String(v) : JSON.stringify(v)); return true; }catch(e){ return false; }
}
function syncRec(){
  if(SYNC.rec) return SYNC.rec;
  let r = null;
  try{ r = JSON.parse(localStorage.getItem(SYNC_REC) || "null"); }catch(e){}
  r = syncObj(r) ? r : {};
  r.uid = r.uid || null; r.rev = +r.rev || 0;
  r.keys = syncObj(r.keys) ? r.keys : {}; r.t = syncObj(r.t) ? r.t : {}; r.dirty = Array.isArray(r.dirty) ? r.dirty : [];
  return (SYNC.rec = r);
}
function syncRecSave(){ clearTimeout(SYNC.recT); SYNC.recT = null; try{ SYNC.set(SYNC_REC, JSON.stringify(syncRec())); }catch(e){} }
function syncRecSoon(){ if(!SYNC.recT) SYNC.recT = setTimeout(syncRecSave, 400); }

/* who syncs: a signed-in account with a club (or any account while Found your club is off), never a guest */
function syncAllowed(){
  try{
    if(typeof SYNC_ON !== "undefined" && !SYNC_ON) return false;
    const u = ACCT && ACCT.server && ACCT.session && ACCT.session.user;
    if(!u || !u.id) return false;
    if(typeof fycTrial === "function" && fycTrial()) return false;
    return true;
  }catch(e){ return false; }
}
/* a change is noted while this phone has a club, signed in or offline; a signed-out phone is a fresh guest */
function syncTracking(){
  try{
    if(typeof SYNC_ON !== "undefined" && !SYNC_ON) return false;
    if(typeof fycTrial === "function" && fycTrial()) return false;
    return !(typeof acctLocal === "function" && acctLocal().signedOut);
  }catch(e){ return false; }
}
/* a front screen: no match, no game, no sheet, no editor. Merging into what a game holds in memory would lose it */
function syncCalm(){
  try{
    const ov = typeof $ === "function" ? $("#overlay") : null;
    if(ov && ov.classList && ov.classList.contains("show")) return false;
    if(typeof CLUB_VIEW !== "undefined" && CLUB_VIEW) return false;
    if(typeof FYC_VIEW !== "undefined" && FYC_VIEW) return false;
    if(typeof b6ScreenKey !== "function" || typeof b6RootOf !== "function") return typeof S === "undefined" || !S;
    const root = b6RootOf(b6ScreenKey());
    if(root === "play") return typeof b4AtHome === "function" ? b4AtHome() : true;
    return !!root;
  }catch(e){ return false; }
}

/* ---------- PUSH ---------- */
function syncTouched(k){
  try{
    if(!syncTracking()) return;
    const r = syncRec();
    r.t[k] = Date.now();
    if(!r.dirty.includes(k)) r.dirty.push(k);
    if(!SYNC.first) SYNC.first = Date.now();
    syncRecSoon();
    if(SYNC.on){ syncPushSoon(); syncShow(); }
  }catch(e){}
}
function syncWrap(){
  if(SYNC.wrapped) return;
  try{
    const LS = localStorage;
    const proto = (typeof Storage !== "undefined" && LS instanceof Storage) ? Storage.prototype : LS;
    const set = proto.setItem, get = proto.getItem;
    SYNC.set = (k, v) => set.call(LS, k, v);
    proto.setItem = function(k, v){
      const watch = this === LS && Object.prototype.hasOwnProperty.call(SYNC_KEYS, k);
      let old = null;
      if(watch){ try{ old = get.call(LS, k); }catch(e){} }
      const out = set.apply(this, arguments);
      if(watch && old !== String(v)) syncTouched(k);
      return out;
    };
    SYNC.wrapped = true;
  }catch(e){}
}
function syncRun(fn){ SYNC.q = SYNC.q.then(() => fn()).catch(() => {}); return SYNC.q; }
/* two seconds after the last change, never closer than SYNC_GAP to the last push; a stream of changes still goes up
   every SYNC_GAP */
function syncPushSoon(delay){
  if(!SYNC.on || SYNC.state === "none") return;
  const now = Date.now();
  let wait = delay == null ? SYNC_DEBOUNCE : delay;
  if(SYNC.first && now - SYNC.first >= SYNC_GAP) wait = 0;
  wait = Math.max(wait, SYNC.last + SYNC_GAP - now, 0);
  clearTimeout(SYNC.timer);
  SYNC.timer = setTimeout(() => { SYNC.timer = null; syncRun(() => syncPush()); }, wait);
}
/* the rows to send: the changed keys (and, after a start, every key) whose value is not what the server has */
function syncRows(){
  const r = syncRec(), cand = new Set(r.dirty), rows = [], hashes = {}, clean = [];
  if(SYNC.scan) for(const k of Object.keys(SYNC_KEYS)) cand.add(k);
  for(const k of cand){
    if(SYNC.pending && SYNC.pending.rows[k]) continue;          // the server's copy is waiting to be merged first
    if(!SYNC_KEYS[k]){ clean.push(k); continue; }
    const loc = syncRead(k);
    if(loc.v === undefined){ clean.push(k); continue; }       // nothing on the phone: never a deletion
    const v = syncFit(k, loc.v), h = syncHash(v), known = r.keys[k];
    if(known && known[1] === h){ clean.push(k); continue; }
    const size = syncBytes(JSON.stringify(v));
    if(size > SYNC_LIMITS.value){ SYNC.big[k] = size; clean.push(k); continue; }
    delete SYNC.big[k];
    if(rows.length >= SYNC_LIMITS.rows) continue;
    const row = { k, v, base: known ? known[0] : 0 };
    if(+r.t[k] > 0) row.at = +r.t[k];
    rows.push(row); hashes[k] = h;
  }
  return { rows, hashes, clean, all: rows.length < SYNC_LIMITS.rows };
}
async function syncPush(o){
  o = o || {};
  SYNC.first = 0;
  if(!SYNC.on || !syncAllowed() || (typeof ACCT_DEL !== "undefined" && ACCT_DEL)) return;
  const r = syncRec(), uid = SYNC.uid;
  const { rows, hashes, clean, all } = syncRows();
  if(clean.length){ r.dirty = r.dirty.filter(k => !clean.includes(k)); }
  if(!rows.length){ if(all) SYNC.scan = false; syncRecSave(); syncShow(); return; }
  SYNC.busy = true; syncShow();
  let d = null;
  try{
    if(o.keepalive) d = await syncBeacon(rows);
    else {
      const res = await sbClient().rpc("state_push", { p_rows: rows });
      if(res.error) throw res.error;
      d = res.data;
    }
  }catch(e){ SYNC.busy = false; return syncFail(e); }
  SYNC.busy = false; SYNC.last = Date.now();
  if(SYNC.uid !== uid) return;
  if(!d || !d.ok){
    if(d && d.code === "rate"){ SYNC.state = "offline"; syncRetry((+d.retry_in || 600) * 1000); syncShow(); return; }
    return syncFail(d && d.code);
  }
  SYNC.fails = 0; SYNC.state = "ok"; SYNC.at = Date.now();
  const done = new Set();
  for(const s of d.saved || []){
    if(!hashes[s.k]) continue;
    r.keys[s.k] = [+s.rev, hashes[s.k]];
    /* changed again while it was on its way: it stays to go */
    const now = syncRead(s.k);
    if(now.v !== undefined && syncHash(syncFit(s.k, now.v)) === hashes[s.k]) done.add(s.k);
  }
  for(const x of d.rejected || []){ if(x && x.k){ SYNC.big[x.k] = x.code; done.add(x.k); } }
  r.dirty = r.dirty.filter(k => !done.has(k));
  if(d.conflicts && d.conflicts.length){ syncPend(d.conflicts, 0); }
  if(all && !(d.conflicts && d.conflicts.length)) SYNC.scan = false;
  syncRecSave(); syncShow();
  if(SYNC.pending) syncApplyWhenCalm();
  else if(r.dirty.length || SYNC.scan) syncPushSoon(0);
}
/* the page is going: the same push, with keepalive so it outlives the page */
async function syncBeacon(rows){
  const s = ACCT.session, body = JSON.stringify({ p_rows: rows });
  if(!s || !s.access_token || typeof fetch !== "function" || body.length > 60000){
    const res = await sbClient().rpc("state_push", { p_rows: rows });
    if(res.error) throw res.error;
    return res.data;
  }
  const res = await fetch(SUPA_URL + "/rest/v1/rpc/state_push", { method: "POST", keepalive: true,
    headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + s.access_token, "Content-Type": "application/json" }, body });
  if(!res.ok) throw Object.assign(new Error("http " + res.status), { status: res.status });
  return await res.json();
}
/* no network, or the server said no: everything stays on the phone and is tried again, slower each time; a server
   without 019 is quiet (the old Settings line shows) until the next start */
function syncFail(e){
  const code = String((e && (e.code || e.message)) || e || "");
  if(/PGRST202|42883|not find the function|state_(push|pull)/.test(code) || (e && e.status === 404)){ SYNC.state = "none"; syncShow(); return; }
  if(code === "not_signed_in"){ SYNC.state = "idle"; syncShow(); return; }
  SYNC.state = "offline"; SYNC.fails++;
  syncRecSave();                                             // what is waiting survives the app being closed
  syncRetry(Math.min(SYNC_GAP * Math.pow(2, SYNC.fails - 1), 600000));
  syncShow();
}
function syncRetry(ms){
  clearTimeout(SYNC.retryT);
  SYNC.retryT = setTimeout(() => { SYNC.retryT = null; if(!SYNC.on) return; syncRun(SYNC.pulled ? () => syncPush() : () => syncPull()); }, ms);
}

/* ---------- PULL ---------- */
async function syncPull(){
  if(!SYNC.on || !syncAllowed()) return;
  const c = sbClient(); if(!c) return syncFail("offline");
  const r = syncRec(), uid = SYNC.uid;
  /* a key the phone had from the server and has lost (put away when signing out, a cleared site): all of it again */
  const lost = Object.keys(r.keys).some(k => { try{ return localStorage.getItem(k) == null; }catch(e){ return false; } });
  const since = lost ? 0 : r.rev;
  let d = null;
  try{
    const res = await c.rpc("state_pull", { p_since: since });
    if(res.error) throw res.error;
    d = res.data;
  }catch(e){ return syncFail(e); }
  if(!d || !d.ok) return syncFail(d && d.code);
  if(!SYNC.on || SYNC.uid !== uid) return;
  /* the titles the server has, once a start (the profile does not carry them) */
  if(!SYNC.titles && c.from) try{
    const t = await c.from("titles").select("key,tier,earned_at");
    if(t && !t.error && Array.isArray(t.data)) SYNC.titles = t.data;
  }catch(e){}
  SYNC.fails = 0; SYNC.state = "ok"; SYNC.at = SYNC.pulledAt = Date.now(); SYNC.pulled = true;
  if(+d.rev < since){ r.rev = 0; r.keys = {}; SYNC.scan = true; }   // the save was emptied on the server: all of it goes up again
  syncPend(d.rows || [], +d.rev || 0);
  syncShow();
  syncApplyWhenCalm();
  syncPushSoon(0);
}
function syncPend(rows, rev){
  const P = SYNC.pending || (SYNC.pending = { rows: {}, rev: 0 });
  for(const x of rows){ if(x && x.k && (!P.rows[x.k] || +x.rev > +P.rows[x.k].rev)) P.rows[x.k] = x; }
  P.rev = Math.max(P.rev, rev || 0);
}
function syncApplyWhenCalm(){
  clearTimeout(SYNC.calmT); SYNC.calmT = null;
  if(!SYNC.pending || !SYNC.on) return;
  if(syncCalm()) return syncApply();
  SYNC.calmT = setTimeout(syncApplyWhenCalm, SYNC_CALM_EVERY);
}
/* what a game keeps in memory goes to the phone first, so the merge sees it */
function syncFlushMemory(){
  try{ if(typeof PROG !== "undefined" && PROG && PROG_AT === "ball4-prog") progSave(PROG); }catch(e){}
  try{ if(typeof MINE !== "undefined" && MINE && !MINE_FOREIGN) mineSave(); }catch(e){}
  try{ if(typeof FEEL !== "undefined" && FEEL) feelSave(); }catch(e){}
}
/* and after the merge, what it keeps in memory is read again */
const SYNC_REFRESH = {
  "ball4-prog": () => { PROG = null; PROG_AT = null; },
  "ball4-mine": () => { MINE = null; },
  "ball4-feel": () => { FEEL = JSON.parse(localStorage.getItem("ball4-feel") || "null") || {}; feelApply(); },
  "ball4-us": () => { usUp = usLoad(); },
  "ball4-names": () => { const n = loadNames(); setupNames.splice(0, setupNames.length, ...n); },
  "ball4-tackle": () => { h2TackleOn = localStorage.getItem("ball4-tackle") !== "0"; },
  "ball4-h2h-flat": () => { h2Tilt = localStorage.getItem("ball4-h2h-flat") !== "1"; },
  "ball4-ai-tempo": () => { AI_TEMPO = Math.min(2, Math.max(.5, parseFloat(localStorage.getItem("ball4-ai-tempo")) || 1)); },
  "ball4-ai": () => { setupAi = localStorage.getItem("ball4-ai") || null; },
  "ball4-ai-level": () => { setupAiLevel = localStorage.getItem("ball4-ai-level") || "ere"; },
};
function syncApply(){
  const P = SYNC.pending; SYNC.pending = null;
  if(!P) return;
  syncFlushMemory();
  const r = syncRec(), dirty = new Set(r.dirty), changed = new Set();
  for(const row of Object.values(P.rows).sort((x, y) => +x.rev - +y.rev)){
    const k = row.k, spec = SYNC_KEYS[k];
    if(!spec) continue;                                       // a key this build doesn't know: left on the server as it is
    const remote = spec.raw ? (typeof row.v === "string" ? row.v : undefined) : row.v;
    if(remote === undefined) continue;
    const loc = syncRead(k), known = r.keys[k];
    const hr = syncHash(remote);
    const ldirty = loc.v !== undefined && (!known || syncHash(syncFit(k, loc.v)) !== known[1]);
    /* "the newer write wins": the phone's only when it changed since the last sync and later than the server's */
    const merged = syncMerge(spec.rule, loc.v, remote, { local: ldirty && (+r.t[k] || 0) > (+row.at || 0) && (+r.t[k] || 0) >= (+r.joined || Infinity) });
    if(merged === undefined) continue;
    if(loc.v === undefined || syncCanon(merged) !== syncCanon(loc.v)){ syncWrite(k, merged); changed.add(k); }
    r.keys[k] = [+row.rev, hr];
    if(syncHash(syncFit(k, merged)) === hr) dirty.delete(k); else dirty.add(k);
  }
  r.rev = Math.max(r.rev, P.rev || 0);
  /* from now on a setting changed here is a choice made with the club's save in front of you: it can win */
  if(!r.joined) r.joined = Date.now();
  const refresh = ks => { for(const k of ks) try{ if(SYNC_REFRESH[k]) SYNC_REFRESH[k](); }catch(e){} };
  refresh(changed);                                          // before the profile is taken: mine() and progLoad() read the merge
  const took = syncTakeProfile();
  for(const k of took){ changed.add(k); if(SYNC_KEYS[k]) dirty.add(k); }
  refresh(took);
  r.dirty = [...dirty];
  syncRecSave();
  if(changed.size) try{ render(); }catch(e){}
  syncShow();
  if(r.dirty.length || SYNC.scan) syncPushSoon(0);
}
/* WHAT THE SERVER ALREADY KEEPS comes down too, the bigger or newer side winning (acctTake does XP, rating, placement,
   wins, the title and a first pennant): the Daily streak (the server's run joined with the phone's), Daily wins, the
   titles, the club (unless a change is still on its way up) and the favourites on a phone that has none */
const SYNC_DAILY_STREAK = syncS({ also: [["half", "lastHalf"]] });
function syncTakeProfile(){
  const out = [], pr = (typeof ACCT !== "undefined" && ACCT.profile) || null;
  if(!pr) return out;
  const box = (() => { try{ return outboxLoad(); }catch(e){ return []; } })();
  if(pr.imported){
    try{
      const last = syncDayNum(pr.last_daily) != null ? +String(pr.last_daily).replace(/-/g, "") : null, n = +pr.streak || 0;
      if(last && n > 0){
        const m = mine(), st = syncObj(m.streak) ? m.streak : { played: 0, half: 0, last: null };
        const j = syncMerge(SYNC_DAILY_STREAK, st, { played: n, last }, {});
        if(syncCanon(j) !== syncCanon(st)){ m.streak = j; mineSave(); out.push("ball4-mine"); }
      }
    }catch(e){}
    try{
      const p = progLoad();
      let moved = false;
      if(+pr.daily_wins > (+p.dailyWins || 0)){ p.dailyWins = +pr.daily_wins; moved = true; }
      /* a topic title is its tier; a special one is the moment it was earned, as on the phone */
      for(const t of SYNC.titles || []){
        if(!t || !/^(topic|sp):/.test(t.key)) continue;
        if(/^sp:/.test(t.key)){ if(!p.titles[t.key]){ p.titles[t.key] = Date.parse(t.earned_at) || Date.now(); moved = true; } continue; }
        if(!(p.titles[t.key] >= +t.tier)){ p.titles[t.key] = Math.max(+p.titles[t.key] || 0, +t.tier || 1); moved = true; }
      }
      if(moved){ progSave(p); out.push("ball4-prog"); }
    }catch(e){}
  }
  try{
    if(pr.club && typeof clubClean === "function" && !box.some(x => x.kind === "club")){
      const d = clubClean(pr.club), raw = localStorage.getItem("ball4-club");
      let had = null; try{ had = JSON.parse(raw || "null"); }catch(e){}
      if(!had || syncCanon(had) !== syncCanon(d)){ SYNC.set("ball4-club", JSON.stringify(d)); out.push("ball4-club"); }
    }
  }catch(e){}
  try{
    const L = acctLocal();
    if(!L.fav && (pr.fav_club || pr.fav_nation || pr.country)) acctLocalSet({ fav: { club: pr.fav_club || null, nation: pr.fav_nation || null, country: pr.country || null } });
    if(L.marketing === undefined && pr.marketing_ok === true) acctLocalSet({ marketing: true });
  }catch(e){}
  return out;
}

/* ---------- starting, stopping ---------- */
function syncCheck(why){
  if(!syncAllowed()){
    if(SYNC.on){ SYNC.on = false; clearTimeout(SYNC.timer); clearTimeout(SYNC.calmT); clearTimeout(SYNC.retryT); SYNC.pending = null; SYNC.state = "idle"; }
    return false;
  }
  const uid = ACCT.session.user.id;
  if(!SYNC.on || SYNC.uid !== uid){
    SYNC.on = true; SYNC.uid = uid; SYNC.titles = null; SYNC.pulled = false; SYNC.state = "saving"; SYNC.scan = true;
    const r = syncRec();
    /* another account on this phone (or the first): its own save, this phone's changes found by the scan */
    if(r.uid !== uid){ SYNC.rec = { uid, rev: 0, keys: {}, t: {}, dirty: [], joined: 0 }; syncRecSave(); }
    syncRun(() => syncPull());
    return true;
  }
  /* the same account again: a sign-in (the auth client says so on a refresh too, hence the minute) or back after ten */
  if(why === "back" || (why === "signin" && Date.now() - (SYNC.pulledAt || 0) > 60000)) syncRun(() => syncPull());
  return true;
}
function syncHide(){
  SYNC.hidAt = Date.now();
  if(!SYNC.on) return;
  syncRecSave();
  if(syncRec().dirty.length){ clearTimeout(SYNC.timer); SYNC.timer = null; syncRun(() => syncPush({ keepalive: true })); }
}
function syncBack(){
  if(!SYNC.on) return;
  if(SYNC.hidAt && Date.now() - SYNC.hidAt >= SYNC_AWAY) syncCheck("back");
  SYNC.hidAt = 0;
}

/* ---------- Settings → Account ---------- */
function syncAgo(t){
  const s = (Date.now() - t) / 1000;
  if(s < 60) return "just now";
  if(s < 3600) return Math.floor(s / 60) + " min ago";
  if(s < 86400) return Math.floor(s / 3600) + " h ago";
  try{ return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }catch(e){ return "a while ago"; }
}
function syncStatusText(){
  if(!SYNC.on || SYNC.state === "none" || SYNC.state === "idle") return "";
  let q = 0; try{ q = outboxLoad().length; }catch(e){}
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if(SYNC.state === "offline" || offline) return "Offline: on this phone for now";
  if(SYNC.busy || SYNC.pending || q || syncRec().dirty.length || !SYNC.at) return "Saving…";
  return "Saved to your club · " + syncAgo(SYNC.at);
}
/* the line under the account card; "" while not syncing, and Settings shows its old line */
function syncStatusHTML(){
  const t = syncStatusText();
  SYNC.shown = t;
  return t ? '<div class="acsync" aria-live="polite">' + t + '</div>' : "";
}
function syncShow(){
  try{ if(typeof ME_VIEW !== "undefined" && ME_VIEW === "settings" && syncStatusText() !== SYNC.shown) render(); }catch(e){}
}

/* ---------- in ---------- */
function syncInstall(){
  syncWrap();
  try{
    if(typeof document !== "undefined" && document.addEventListener)
      document.addEventListener("visibilitychange", () => { if(document.hidden) syncHide(); else syncBack(); });
    if(typeof window !== "undefined" && window.addEventListener){
      window.addEventListener("pagehide", syncHide);
      window.addEventListener("online", () => { if(SYNC.on) syncRun(SYNC.pulled ? () => syncPush() : () => syncPull()); });
    }
  }catch(e){}
  try{
    const c = sbClient();
    if(c && c.auth && c.auth.onAuthStateChange) c.auth.onAuthStateChange(ev => {
      if(ev === "SIGNED_OUT") setTimeout(() => syncCheck("out"), 0);
      else if(ev === "SIGNED_IN") setTimeout(() => syncCheck("signin"), 0);
    });
  }catch(e){}
  /* founding a club, a sign-in finishing, a sign-out: noticed within a few seconds whoever caused it */
  try{ SYNC.watch = setInterval(() => syncCheck("watch"), SYNC_WATCH); if(SYNC.watch && SYNC.watch.unref) SYNC.watch.unref(); }catch(e){}
}
if(typeof ACCT !== "undefined" && typeof localStorage !== "undefined") syncInstall();

if(typeof module !== "undefined" && module.exports) module.exports = { SYNC_KEYS, SYNC_NEVER, SYNC_LIMITS, SYNC_BETTER, syncMerge, syncCanon,
  syncHash, syncFit, syncDayNum, syncInventory };
