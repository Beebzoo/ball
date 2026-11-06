/* Checkout maths: which scores can be finished in three darts, the fewest darts each
   needs, a sensible route, and checking a finish someone typed in.
   Rules: finish exactly on 0 with a double (the bull 50 counts as a double). */
(function(D){
  const ALL = [];
  for(let n = 1; n <= 20; n++) for(let m = 1; m <= 3; m++) ALL.push({ m, n });
  ALL.push({ m: 1, n: 25 }, { m: 2, n: 25 });
  const DOUBLES = ALL.filter(d => d.m === 2);
  const val = d => d.m * d.n;
  const label = d => d.n === 0 ? (D.T ? D.T("Miss", "Mis") : "Miss") : d.n === 25 ? (d.m === 2 ? "Bull" : "25") : (d.m === 3 ? "T" : d.m === 2 ? "D" : "") + d.n;

  /* how much we like a dart: lower is better */
  const LIKE_D = [20, 16, 8, 18, 12, 10, 4, 14, 6, 2, 19, 17, 13, 11, 15, 9, 7, 5, 3, 1, 25];
  const finishCost = d => LIKE_D.indexOf(d.n) * 0.5;
  function setupCost(d){
    if(d.n === 25) return d.m === 2 ? 6 : 7;
    if(d.m === 3) return ({ 20: 0, 19: 1, 18: 1.5, 17: 1.5, 16: 2, 15: 2.5 })[d.n] ?? 3 + (15 - d.n) * 0.15;
    if(d.m === 1) return 1.5 + (20 - d.n) * 0.08;
    return 5; /* a double as a set-up dart */
  }

  /* best route for every score 2..170 (fewest darts, then the nicest), computed once */
  const BEST = {};
  function consider(score, route){
    const set = route.slice(0, -1).map(setupCost);
    /* the bigger set-up dart goes first, as players throw it */
    const order = set.length === 2 && (set[0] > set[1] || (set[0] === set[1] && val(route[0]) < val(route[1]))) ? 0.5 : 0;
    const cost = route.length * 100 + set.reduce((a, c) => a + c, 0) + order + finishCost(route[route.length - 1]);
    if(!BEST[score] || cost < BEST[score].cost) BEST[score] = { cost, route };
  }
  for(const z of DOUBLES) consider(val(z), [z]);
  for(const a of ALL) for(const z of DOUBLES) consider(val(a) + val(z), [a, z]);
  for(const a of ALL) for(const b of ALL) for(const z of DOUBLES) consider(val(a) + val(b) + val(z), [a, b, z]);

  const route = n => BEST[n] ? BEST[n].route : null;
  const minDarts = n => BEST[n] ? BEST[n].route.length : 0;
  const possible = n => !!BEST[n];
  /* the famous scores under 171 that can't be finished in three darts */
  const BOGEY = [];
  for(let n = 2; n <= 170; n++) if(!possible(n)) BOGEY.push(n);

  /* play darts on a score: { left, state: "open" | "out" | "bust", darts } */
  function play(score, darts){
    let left = score;
    for(let i = 0; i < darts.length; i++){
      const d = darts[i], after = left - val(d);
      if(after < 0 || after === 1) return { left, state: "bust", at: i };
      if(after === 0) return d.m === 2 ? { left: 0, state: "out", at: i } : { left, state: "bust", at: i };
      left = after;
    }
    return { left, state: "open" };
  }

  D.co = { ALL, val, label, route, minDarts, possible, play, BOGEY };
})(window.DART);
