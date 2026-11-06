/* Tennis scoring: points, games and sets, deuce and advantage, tiebreaks and who serves.
   Plain data and no DOM, so the match screen and _tests/score-test.js use the same code.
   Formats: "tb" a single tiebreak to 7, "short" one set to 4 games (tiebreak at 4-4),
   "set" one set to 6 games (tiebreak at 6-6). Tiebreaks are first to 7, two clear. */
window.RACKET = window.RACKET || {};
(function(R){
  const FORMATS = {
    tb: { id: "tb", tbOnly: true, tbTo: 7, sets: 1 },
    short: { id: "short", games: 4, tbAt: 4, tbTo: 7, sets: 1 },
    set: { id: "set", games: 6, tbAt: 6, tbTo: 7, sets: 1 }
  };

  /* a new match; server: who serves the first point (0 or 1) */
  function create(fmt, server){
    const f = typeof fmt === "string" ? FORMATS[fmt] : fmt;
    server = server ? 1 : 0;
    return { f, sets: [], won: [0, 0], games: [0, 0], pts: [0, 0], tb: !!f.tbOnly, tbFirst: f.tbOnly ? server : null, gameServer: server, server, done: null, n: 0 };
  }
  const clone = s => JSON.parse(JSON.stringify(s));

  /* who serves point k (0-based) of a tiebreak: the first server once, then two each */
  const tbServer = (first, k) => first ^ (Math.floor((k + 1) / 2) % 2);

  /* player w wins the next point. Changes s and says what happened:
     { w, game, brk, set, match, tbStart, deuce, adv } (game/set/match: the winner or null) */
  function point(s, w){
    if(s.done != null) return null;
    const o = 1 - w, ev = { w, game: null, brk: false, set: null, match: null, tbStart: false, deuce: false, adv: null };
    s.n++;
    s.pts[w]++;
    const a = s.pts[w], b = s.pts[o];
    if(s.tb){
      if(a >= s.f.tbTo && a - b >= 2){
        ev.game = w; s.games[w]++;
        winSet(s, w, ev, [s.pts[0], s.pts[1]]);
      } else s.server = tbServer(s.tbFirst, a + b);
      return ev;
    }
    if(a >= 4 && a - b >= 2){
      ev.game = w; ev.brk = w !== s.gameServer;
      s.games[w]++; s.pts = [0, 0];
      const g = s.games[w], h = s.games[o];
      if(g >= s.f.games && g - h >= 2) winSet(s, w, ev, null);
      else {
        s.gameServer = s.server = 1 - s.gameServer;
        if(s.games[0] === s.f.tbAt && s.games[1] === s.f.tbAt){ s.tb = true; s.tbFirst = s.server; ev.tbStart = true; }
      }
      return ev;
    }
    if(a >= 3 && b >= 3){ if(a === b) ev.deuce = true; else ev.adv = a > b ? w : o; }
    return ev;
  }
  function winSet(s, w, ev, tbPts){
    ev.set = w;
    s.sets.push({ g: s.games.slice(), tb: tbPts });
    s.won[w]++;
    /* after a tiebreak, the player who received first in it serves first in the next set */
    const next = s.tb ? 1 - s.tbFirst : 1 - s.gameServer;
    s.games = [0, 0]; s.pts = [0, 0]; s.tb = false; s.tbFirst = null;
    s.gameServer = s.server = next;
    if(s.won[w] >= s.f.sets){ ev.match = w; s.done = w; }
  }

  /* what the next point would mean if p won it */
  const would = (s, p) => s.done != null ? {} : point(clone(s), p);
  const gamePoint = (s, p) => would(s, p).game === p;
  const breakPoint = s => !s.tb && s.done == null && gamePoint(s, 1 - s.server);
  const setPoint = (s, p) => would(s, p).set === p;
  const matchPoint = (s, p) => would(s, p).match === p;
  /* the biggest thing at stake on the next point: { kind: "match"|"set"|"break", p } or null */
  function stake(s){
    for(const p of [0, 1]) if(matchPoint(s, p)) return { kind: "match", p };
    for(const p of [0, 1]) if(setPoint(s, p)) return { kind: "set", p };
    if(breakPoint(s)) return { kind: "break", p: 1 - s.server };
    return null;
  }

  /* the points as shown on a scoreboard, per player: "0" "15" "30" "40" "AD" ("" for the other) */
  const NAMES = ["0", "15", "30", "40"];
  function labels(s){
    const [a, b] = s.pts;
    if(s.tb) return [String(a), String(b)];
    if(a >= 3 && b >= 3){ if(a === b) return ["40", "40"]; return a > b ? ["AD", ""] : ["", "AD"]; }
    return [NAMES[a], NAMES[b]];
  }
  /* the umpire's call after a point, server first: "15-0", "30 all", "Deuce", "Advantage", "Game" */
  const SAY = ["Love", "Fifteen", "Thirty", "Forty"];
  function call(s, ev, name){
    if(ev.match != null) return { en: "Game, set and match, " + name(ev.match), nl: "Game, set en match, " + name(ev.match), kind: "match" };
    if(ev.set != null) return { en: "Game and set, " + name(ev.set), nl: "Game en set, " + name(ev.set), kind: "set" };
    if(ev.game != null) return { en: "Game, " + name(ev.game), nl: "Game, " + name(ev.game), kind: ev.brk ? "break" : "game" };
    if(s.tb){ const a = s.pts[s.server], b = s.pts[1 - s.server]; return { en: a + "–" + b, nl: a + "–" + b, kind: "tb", say: a === b ? a + " all" : a + ", " + b + (a > b ? ", " + name(s.server) : ", " + name(1 - s.server)) }; }
    if(ev.deuce) return { en: "Deuce", nl: "Deuce", kind: "deuce" };
    if(ev.adv != null) return { en: "Advantage, " + name(ev.adv), nl: "Voordeel " + name(ev.adv), kind: "adv", say: "Advantage, " + name(ev.adv) };
    const a = s.pts[s.server], b = s.pts[1 - s.server];
    if(a === b) return { en: NAMES[a] + " all", nl: NAMES[a] + " gelijk", kind: "pt", say: SAY[a] + " all" };
    return { en: NAMES[a] + "–" + NAMES[b], nl: NAMES[a] + "–" + NAMES[b], kind: "pt", say: SAY[a] + ", " + SAY[b].toLowerCase() };
  }
  /* the final score from the winner's side: "6–4", "7–6 (7–5)", "4–2 6–7 (3–7) …" */
  function line(s, w){
    return s.sets.map(x => {
      const a = x.g[w], b = x.g[1 - w];
      if(s.f.tbOnly) return x.tb[w] + "–" + x.tb[1 - w];
      return a + "–" + b + (x.tb ? " (" + x.tb[w] + "–" + x.tb[1 - w] + ")" : "");
    }).join("  ");
  }

  R.score = { FORMATS, create, point, would, gamePoint, breakPoint, setPoint, matchPoint, stake, labels, call, line, tbServer, clone };
})(window.RACKET);
