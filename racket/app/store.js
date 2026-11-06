/* Everything RACKET remembers lives on this device, under "racket.*" in localStorage.
   A new phone starts with one player and no name: app.js asks for it once (needsName). Friends are
   added by hand (addPlayer) and share the phone (pass the phone); each has their own records. */
window.RACKET = window.RACKET || {};
/* Inside the BALL app RACKET runs in a frame, and BALL's sport switch says when it is out of sight (app.js). */
window.RACKET.EMBED = typeof window.parent !== "undefined" && window.parent !== window;
/* The question feedback on Me and the frame rate on the 3D report are for the people building RACKET, not for players: ?feedback=1 brings them up. */
window.RACKET.FEEDBACK = typeof location !== "undefined" && /[?&]feedback=1/.test(location.search);
(function(R){
  const KEY = "racket.v1", MAX = 6;
  const blank = () => ({ players: [""], me: 0, sound: true, lang: "en", court: "hard", rec: {}, log: [], daily: {} });
  let s, old = null;
  try { old = JSON.parse(localStorage.getItem(KEY) || "null"); s = Object.assign(blank(), old); } catch(e){ s = blank(); }
  if(!Array.isArray(s.players) || !s.players.length) s.players = [""];
  if(!s.players[s.me]) s.me = 0;
  if(!Array.isArray(s.log)) s.log = [];
  ["rec", "daily"].forEach(k => { if(!s[k] || typeof s[k] !== "object") s[k] = {}; });
  /* the umpire speaking out loud: off for a new player, a first match on a train stays quiet. A
     save from before this switch has been hearing the umpire, so it stays that way. */
  if(s.voice == null) s.voice = !!old && !!s.sound;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} };
  /* In BALL's frame its localStorage is ours too (same origin). */
  const ball = k => { if(!R.EMBED) return null; try { return localStorage.getItem(k); } catch(e){ return null; } };

  R.store = {
    get players(){ return s.players.slice(); },
    get me(){ return s.me; },
    get name(){ return s.players[s.me] || R.T("Player", "Speler"); },
    /* a new phone: the one name nobody has given yet */
    get needsName(){ return s.players.length === 1 && !s.players[0]; },
    /* the name BALL knows you by, to fill in: your club's username, else the name you gave for a room ("" outside BALL or if it has none) */
    get ballName(){
      let u = ""; try { u = ((JSON.parse(ball("ball4-fyc")) || {}).draft || {}).username; } catch(e){}
      const n = String(u || ball("ball4-mp-name") || "").replace(/_+/g, " ").trim();
      return (n.charAt(0).toUpperCase() + n.slice(1)).slice(0, 14).trim();
    },
    /* nothing plays out of sight: BALL hid the frame (R.hidden), or the phone went to another app */
    get sound(){ return s.sound && !R.hidden && !(typeof document !== "undefined" && document.hidden); },
    setMe(i){ s.me = i; save(); },
    rename(i, n){ s.players[i] = String(n).trim().slice(0, 14) || s.players[i]; save(); },
    /* a friend on this phone: returns their index, or -1 (no name, or the list is full). A name that's already here is that player */
    MAX,
    addPlayer(n){
      n = String(n).trim().slice(0, 14); if(!n) return -1;
      const k = s.players.findIndex(p => p.toLowerCase() === n.toLowerCase());
      if(k >= 0 || s.players.length >= MAX) return k;
      s.players.push(n); save(); return s.players.length - 1;
    },
    setSound(on){ s.sound = !!on; save(); },
    get voice(){ return !!s.voice; },
    setVoice(on){ s.voice = !!on; save(); },
    get lang(){ return s.lang === "nl" ? "nl" : "en"; },
    setLang(l){ s.lang = l === "nl" ? "nl" : "en"; save(); },
    /* the colour of the app: hard (blue), clay (orange) or grass (green) */
    get court(){ return ["hard", "clay", "grass"].includes(s.court) ? s.court : "hard"; },
    setCourt(c){ s.court = c; save(); },
    /* records per player: rec[player][key] = { best, plays, last, when } */
    rec(p, key){ return ((s.rec[p] || {})[key]) || null; },
    /* returns true when this is a new best (p: the player, default whoever is playing) */
    result(key, score, p){
      if(p == null) p = s.me;
      const r = (s.rec[p] = s.rec[p] || {}), cur = r[key] || { best: 0, plays: 0 };
      const best = score > cur.best;
      r[key] = { best: Math.max(cur.best, score), plays: cur.plays + 1, last: score, when: Date.now() };
      save(); return best && cur.plays > 0;
    },
    /* the match log: { t, a, b (player index or "cpu:<id>"), w (0 = a won), line, surf, fmt, stats } */
    get log(){ return s.log.slice(); },
    addMatch(m){ s.log.push(Object.assign({ t: Date.now() }, m)); if(s.log.length > 300) s.log.splice(0, s.log.length - 300); save(); },
    /* the daily question: daily[date][player] = { ok, ms } */
    daily(date){ return s.daily[date] || {}; },
    setDaily(date, p, v){ (s.daily[date] = s.daily[date] || {})[p] = v; save(); },
    get dailyAll(){ return s.daily; }
  };
  /* T("English", "Nederlands"): the text in the chosen language */
  R.T = (en, nl) => R.store.lang === "nl" ? nl : en;
  /* L(["English", "Nederlands"]) */
  R.L = a => Array.isArray(a) ? R.T(a[0], a[1]) : a;
})(window.RACKET);
