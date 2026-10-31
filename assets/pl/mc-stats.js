/* BALL 4: THE MATCH CENTRE'S NUMBERS (_plans/match-centre.md §2.1 and §3.4).
 *
 * Pure functions over a competition's season as the match centre already holds it (CL.mc[comp].rows: {id, md,
 * stg, ko, st, h: {key, name}, a: {key, name}, ft: [home, away] or null}). No server and no feed: a side's form,
 * its season in figures and where each figure ranks in the league, and the chance of a home win, a draw and an
 * away win from this season's goals. Loaded with the match page (assets/pl/mc.js); _tests/mc-stats-test.js holds
 * it to the plan's rules. */
(function(root){
  const played = x => !!x && (x.st === "finished" || x.st === "awarded") && Array.isArray(x.ft) && x.ft[0] != null && x.ft[1] != null;
  /* a league's own matches are its matchdays, as the table counts them: a cup's qualifiers and knockouts have none */
  const league = rows => (rows || []).filter(x => x.md != null);
  /* a side's played league matches, oldest first; venue "home", "away" or "all" */
  function games(rows, key, venue){
    return league(rows).filter(x => played(x) && ((venue !== "away" && x.h.key === key) || (venue !== "home" && x.a.key === key)))
      .sort((p, q) => p.ko - q.ko);
  }
  const score = (x, key) => x.h.key === key ? [x.ft[0], x.ft[1]] : [x.ft[1], x.ft[0]];
  const result = (x, key) => { const [f, a] = score(x, key); return f > a ? "W" : f < a ? "L" : "D"; };
  /* the last n results, oldest first so the newest sits on the right */
  function form(rows, key, venue, n){ return games(rows, key, venue || "all").slice(-(n || 5)).map(x => result(x, key)); }

  /* a side's season: everything, and at home and away apart */
  function line(rows, key){
    const z = () => ({ gp: 0, gf: 0, ga: 0, cs: 0, fts: 0, w: 0, d: 0, l: 0, pts: 0 });
    const o = { all: z(), home: z(), away: z() };
    for(const x of games(rows, key, "all")){
      const [f, a] = score(x, key);
      for(const s of [o.all, x.h.key === key ? o.home : o.away]){
        s.gp++; s.gf += f; s.ga += a;
        if(!a) s.cs++;
        if(!f) s.fts++;
        if(f > a){ s.w++; s.pts += 3; } else if(f === a){ s.d++; s.pts++; } else s.l++;
      }
    }
    return o;
  }
  const per = (n, gp) => gp ? n / gp : null;
  /* the figures the match page compares, and which way is better */
  const FIGS = {
    gf: { of: s => per(s.all.gf, s.all.gp), hi: true },          // goals scored per match
    ga: { of: s => per(s.all.ga, s.all.gp), hi: false },         // goals conceded per match
    cs: { of: s => s.all.gp ? s.all.cs : null, hi: true },       // clean sheets
    fts: { of: s => s.all.gp ? s.all.fts : null, hi: false },    // failed to score
    ppmHome: { of: s => per(s.home.pts, s.home.gp), hi: true },  // points per match at home
    ppmAway: { of: s => per(s.away.pts, s.away.gp), hi: true } };// and away
  /* every side's figures and where each ranks in the league: 1 is the best, and level sides share a rank */
  function figures(rows){
    const keys = [...new Set(league(rows).flatMap(x => [x.h.key, x.a.key]))], t = {};
    for(const k of keys){ const s = line(rows, k); t[k] = { key: k, line: s, v: {}, rank: {} }; for(const f in FIGS) t[k].v[f] = FIGS[f].of(s); }
    for(const f in FIGS){
      const list = keys.filter(k => t[k].v[f] != null).sort((a, b) => FIGS[f].hi ? t[b].v[f] - t[a].v[f] : t[a].v[f] - t[b].v[f]);
      list.forEach((k, i) => { const p = list[i - 1]; t[k].rank[f] = p != null && Math.abs(t[p].v[f] - t[k].v[f]) < 1e-9 ? t[p].rank[f] : i + 1; });
    }
    return t;
  }
  /* the second leg of a knockout tie: the same two sides met earlier in the same round, the other way round */
  const secondLeg = (rows, x) => !!x && x.md == null && (rows || []).some(y => y !== x && y.md == null && y.stg === x.stg &&
    y.h.key === x.a.key && y.a.key === x.h.key && y.ko < x.ko);

  /* ---------- the win chance (§3.4): a Poisson model from this season's goals ---------- */
  const fact = n => { let f = 1; for(let i = 2; i <= n; i++) f *= i; return f; };
  const pois = (k, l) => Math.exp(-l) * Math.pow(l, k) / fact(k);
  /* three whole percentages that add up to 100: the largest remainders get the points left over */
  function round100(p){
    const raw = p.map(x => x * 100), out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if(left > 0){ out[i]++; left--; } });
    return out;
  }
  /* a strength from n matches, pulled toward the league's average (1.0) while n is small: two matches can't say 90% */
  const SHRINK = 5;
  const shrink = (s, n) => 1 + (s - 1) * n / (n + SHRINK);
  const MIN_GAMES = 3;
  /* {h, d, a} in whole percentages, or null when there is too little to go on: fewer than three league matches for
     either side, a league without a goal yet at home or away, or the second leg of a knockout tie. Never a score:
     the most likely one would give the calls away */
  function chance(rows, homeKey, awayKey, x){
    if(x && secondLeg(rows, x)) return null;
    const L = league(rows).filter(played);
    const H = line(rows, homeKey), A = line(rows, awayKey);
    if(H.all.gp < MIN_GAMES || A.all.gp < MIN_GAMES) return null;
    const hg = L.reduce((a, y) => a + y.ft[0], 0) / L.length, ag = L.reduce((a, y) => a + y.ft[1], 0) / L.length;
    if(!(hg > 0) || !(ag > 0)) return null;
    /* a side's strength at that venue: its goals per match against the league's, shrunk; a venue not played yet is 1.0 */
    const st = (goals, base, n) => n ? shrink(goals / n / base, n) : 1;
    const hAtt = st(H.home.gf, hg, H.home.gp), hDef = st(H.home.ga, ag, H.home.gp);
    const aAtt = st(A.away.gf, ag, A.away.gp), aDef = st(A.away.ga, hg, A.away.gp);
    const lh = hg * hAtt * aDef, la = ag * aAtt * hDef;
    let ph = 0, pd = 0, pa = 0;
    for(let i = 0; i <= 10; i++) for(let j = 0; j <= 10; j++){
      const p = pois(i, lh) * pois(j, la);
      if(i > j) ph += p; else if(i === j) pd += p; else pa += p;
    }
    const tot = ph + pd + pa;
    if(!(tot > 0)) return null;
    const [h, d, a] = round100([ph / tot, pd / tot, pa / tot]);
    return { h, d, a };
  }

  const MC = { played, league, games, form, line, figures, secondLeg, chance, round100, shrink, MIN_GAMES };
  root.MCStats = MC;
  if(typeof module === "object" && module && module.exports) module.exports = MC;
})(typeof window !== "undefined" ? window : this);
