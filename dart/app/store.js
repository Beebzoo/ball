/* Everything DART remembers lives on this device, under "dart.*" in localStorage (the keys
   kept their DART names, so darts records from before CHALK are still there).
   A new phone starts with one player and no name: app.js asks for it once (needsName). Friends are
   added by hand (addPlayer) and share the phone (pass-the-phone); each has their own records, their
   sport (darts, snooker or both, picked at first open) and the room they were last in. */
window.DART = window.DART || {};
/* Snooker is parked (Martijn, 6 Nov 2026): the table, Frame and the snooker quiz stay in the code but are not offered.
   ?snooker=1 brings the room back, for the tests and for the day it returns. */
/* Inside the BALL app DART runs in a frame, and BALL's sport switch says when it is out of sight (app.js). */
window.DART.EMBED = typeof window.parent !== "undefined" && window.parent !== window;
window.DART.SNOOKER = typeof location !== "undefined" && /[?&]snooker=1/.test(location.search);
/* The predictor is parked too, until it runs on BALL's server with the draw filled in: the code stays, ?poule=1 brings it back. */
window.DART.POULE = typeof location !== "undefined" && /[?&]poule=1/.test(location.search);
(function(D){
  const KEY = "dart.v1", MAX = 6;
  const blank = () => ({ players: [""], me: 0, sound: true, lang: "en", rec: {}, sport: {}, room: {} });
  let s, old = null;
  try { old = JSON.parse(localStorage.getItem(KEY) || "null"); s = Object.assign(blank(), old); } catch(e){ s = blank(); }
  if(!Array.isArray(s.players) || !s.players.length) s.players = [""];
  if(!s.players[s.me]) s.me = 0;
  /* the caller speaking out loud: off for a new player, a first match on a train stays quiet. A
     save from before this switch has been hearing the caller, so it stays that way. */
  if(s.voice == null) s.voice = !!old && !!s.sound;
  if(!s.sport || typeof s.sport !== "object") s.sport = {};
  if(!s.room || typeof s.room !== "object") s.room = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} };
  /* In BALL's frame its localStorage is ours too (same origin). BALL has no language of its own yet: it is English only
     and stores none (its _plans/dutch-ui.md). The day it gets a Dutch switch that saves "ball4-lang" (en or nl), DART
     follows it, read once when DART loads; until then DART keeps the language chosen on Me. */
  const ball = k => { if(!D.EMBED) return null; try { return localStorage.getItem(k); } catch(e){ return null; } };
  const ballLang = (/^"?(en|nl)\b/.exec(ball("ball4-lang") || "") || [])[1] || null;

  D.store = {
    get players(){ return s.players.slice(); },
    get me(){ return s.me; },
    get name(){ return s.players[s.me] || D.T("Player", "Speler"); },
    /* a new phone: the one name nobody has given yet */
    get needsName(){ return s.players.length === 1 && !s.players[0]; },
    /* the name BALL knows you by, to fill in: your club's username, else the name you gave for a room ("" outside BALL or if it has none) */
    get ballName(){
      let u = ""; try { u = ((JSON.parse(ball("ball4-fyc")) || {}).draft || {}).username; } catch(e){}
      const n = String(u || ball("ball4-mp-name") || "").replace(/_+/g, " ").trim();
      return (n.charAt(0).toUpperCase() + n.slice(1)).slice(0, 14).trim();
    },
    /* nothing plays out of sight: BALL hid the frame (D.hidden), or the phone went to another app */
    get sound(){ return s.sound && !D.hidden && !(typeof document !== "undefined" && document.hidden); },
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
    get lang(){ return ballLang || (s.lang === "nl" ? "nl" : "en"); },
    get langFromBall(){ return !!ballLang; },
    setLang(l){ s.lang = l === "nl" ? "nl" : "en"; save(); },
    /* the player at the table: "darts" | "snooker" | "both", or null before the first pick */
    get sport(){ return D.SNOOKER ? s.sport[s.me] || null : "darts"; },
    sportOf(i){ return D.SNOOKER ? s.sport[i] || null : "darts"; },
    setSport(v){ s.sport[s.me] = ["darts", "snooker", "both"].includes(v) ? v : "both"; if(v !== "both") s.room[s.me] = v === "snooker" ? "tafel" : "oche"; save(); },
    /* the room: "oche" (darts) or "tafel" (snooker) */
    get room(){ return !D.SNOOKER ? "oche" : s.room[s.me] || (s.sport[s.me] === "snooker" ? "tafel" : "oche"); },
    setRoom(r){ s.room[s.me] = r === "tafel" ? "tafel" : "oche"; save(); },
    /* records per player: rec[player][key] = { best, plays, last } */
    rec(p, key){ return ((s.rec[p] || {})[key]) || null; },
    /* returns true when this is a new best (p: the player, default whoever is at the oche) */
    result(key, score, p){
      if(p == null) p = s.me;
      const r = (s.rec[p] = s.rec[p] || {}), cur = r[key] || { best: 0, plays: 0 };
      const best = score > cur.best;
      r[key] = { best: Math.max(cur.best, score), plays: cur.plays + 1, last: score, when: Date.now() };
      save(); return best && cur.plays > 0;
    },
    all(){ return s.rec; }
  };
  /* T("English", "Nederlands"): the text in the chosen language */
  D.T = (en, nl) => D.store.lang === "nl" ? nl : en;
})(window.DART);
