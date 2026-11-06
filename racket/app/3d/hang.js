/* Hang Time's rules: what an answer is worth, and how good each opponent is. No DOM and no three.js, so the match
   (app/3d/match3d.js) and _tests/hang-sim.js use the same numbers. Grades: 0 right, 1 close, 2 off, 3 wrong or late.

   A QUIET POINT: the answer sets your feet. Never getting there ends the point; otherwise edge() is your chance of
   winning it, off the answer, the timing tap, and who you're playing.
   A LIVE BALL (break, set and match points): no dice but these. acc() is how often the computer answers right. */
window.RACKET = window.RACKET || {};
(function(R){
  const sig = x => 1 / (1 + Math.exp(-x));
  const TIP = [0.3, 0.55, 0.8]; // how much a serve helps, by the target it found
  /* how often an opponent answers right on a Live Ball: easy, medium, hard, per level */
  const ACC = [[0.56, 0.3, 0.14], [0.68, 0.42, 0.22], [0.78, 0.56, 0.34], [0.84, 0.64, 0.44], [0.9, 0.72, 0.52]];
  /* clock: how long you have. start: Live Balls begin this many steps heavier. climb: the chance a right answer
     adds weight, so a Live Ball on clay lasts longer */
  const SURF = { hard: { clock: 1, start: 0, climb: 1 }, clay: { clock: 1.3, start: 0, climb: 0.6 }, grass: { clock: 0.75, start: 1, climb: 1 } };
  const rq = (g, fast) => g === 0 ? (fast ? 0.6 : 0.35) : g === 1 ? -0.25 : g === 2 ? -0.7 : -1.1;
  const form = (o, surf) => o.rally + (o.surf[surf] || 0);
  /* an opponent is measured against a Tour pro, which is what the flat prototype's numbers were tuned on */
  const PRO = { rally: 0.1, ret: 0.26, srv: 0.42 }, K = 0.7;
  /* the two lowest levels are softer than their numbers: the first opponent has to be beatable by a casual player */
  const SOFT = [0.42, 0.2, 0, 0, 0];

  const hang = {
    SURF, TIP, ACC,
    /* did you never get to the ball? a: { k (-1 late), g, rush } */
    lost: (a, rnd) => a.k < 0 || !!a.rush || (a.g === 3 && rnd() < 0.7),
    /* how heavy the ball is on a quiet point: 0 easy, 1 medium, 2 hard */
    heat: (o, rnd) => { const r = rnd(), hard = 0.3 + 0.05 * o.lvl; return r < 0.2 - 0.03 * o.lvl ? 0 : r < 1 - hard ? 1 : 2; },
    /* your chance of the point once you've reached the ball. serving: you hit first and this is the third ball.
       tapped: the timing tap landed. Their tap is a coin with a bias */
    edge(a, serving, th, tapped, o, surf, rnd){
      const mine = tapped ? 0.15 : -0.15, theirs = rnd() < 0.6 ? 0.15 : -0.15, tap = mine - theirs, f = K * (form(o, surf) - PRO.rally) - SOFT[o.lvl];
      return serving ? sig(rq(a.g, a.fast) + 0.65 + (TIP[th] - 0.55) + tap - f - K * (o.ret - PRO.ret))
        : sig(rq(a.g, a.fast) - 0.2 + tap - f - K * (o.srv - PRO.srv));
    },
    /* the computer on a serve: "ace", "df" or null */
    cpuServe(o, surf, rnd){
      const r = rnd(), S = surf === "grass" ? 1.5 : surf === "clay" ? 0.6 : 1;
      if(r < o.first * o.ace * S) return "ace";
      return r > 1 - (1 - o.first) * o.df ? "df" : null;
    },
    /* how right the computer's answer is. big: a break, set or match point, where clutch counts */
    acc: (o, t, big) => Math.min(0.97, ACC[o.lvl][t] + (big ? o.clutch * 0.4 : 0)),
    cpuGrade(o, t, big, rnd){ return rnd() < hang.acc(o, t, big) ? 0 : rnd() < 0.35 ? 1 : 3; },
    /* a right answer: one step heavier, up to Hard */
    heavier: (W, surf, rnd) => Math.min(2, W + (rnd() < SURF[surf].climb ? 1 : 0))
  };
  R.hang = hang;
})(window.RACKET);
