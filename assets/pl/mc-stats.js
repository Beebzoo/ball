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

  /* ---------- head to head (§1.1, item 5) ---------- */
  /* the meetings (pl_h2h rows: {d, h, a, ft}) as wins for a, wins for b and draws, whoever was at home */
  function h2hSummary(meet, a, b){
    const s = { a: 0, b: 0, d: 0, n: 0 };
    for(const m of meet || []){
      if(!m || !Array.isArray(m.ft) || m.ft[0] == null || m.ft[1] == null || (m.h !== a && m.h !== b)) continue;
      const ga = m.h === a ? m.ft[0] : m.ft[1], gb = m.h === a ? m.ft[1] : m.ft[0];
      s[ga > gb ? "a" : gb > ga ? "b" : "d"]++; s.n++;
    }
    return s;
  }

  /* ---------- the story line (§3.3) ----------
     The most interesting sentence the data proves, in one line, never a probability. Every template checks its own
     facts and says nothing when they aren't so; the true one with the most weight wins. ctx: {rows (the season),
     x (the match), h2h (the meetings, newest first, or null), hn and an (the names), pos ({key: table position}),
     teams (how many sides in the table), cup (the competition's name when it isn't a league, else none)}. Clubs take
     the plural, as everywhere in BALL ("Ajax have"). */
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const nw = n => n <= 10 ? WORDS[n] : String(n);
  const before = (rows, x) => (rows || []).filter(r => r !== x && (!x || r.ko < x.ko));
  /* how many of a side's latest league results, newest back, pass a test */
  const run = (rows, key, test, venue) => { const g = games(rows, key, venue || "all"); let n = 0;
    for(let i = g.length - 1; i >= 0 && test(score(g[i], key)); i--) n++; return n; };
  /* the season here is this competition's own matches, not a side's cup or European nights, so a line says where it
     was made: "league games", or ctx.cup's ("Champions League games") for a competition that is not a league */
  const G1 = ctx => (ctx.cup || "league") + " game", G = ctx => G1(ctx) + "s", IN = ctx => "in the " + (ctx.cup || "league");
  /* a run as long as the season so far is the season */
  const whole = (ctx, key, n) => n === games(ctx.rows, key, "all").length;
  const TEMPLATES = [
    /* head to head */
    /* runs from the latest meeting back: draws, or a side without a defeat (four or more draws alone are the line
       before it, so an unbeaten run always has a win in it) */
    ctx => { const m = (ctx.h2h || []).filter(r => Array.isArray(r.ft)); if(m.length < 3) return null;
      let dr = 0; for(const r of m){ if(r.ft[0] !== r.ft[1]) break; dr++; }
      if(dr >= 3) return { k: "h2h_draws", w: 7, t: "The last " + nw(dr) + " meetings were all draws." };
      const unbeaten = key => { let n = 0;
        for(const r of m){ const g = r.h === key ? r.ft[0] - r.ft[1] : r.a === key ? r.ft[1] - r.ft[0] : -1; if(g < 0) break; n++; }
        return n; };
      const nh = unbeaten(ctx.x.h.key), na = unbeaten(ctx.x.a.key);
      if(nh >= 4) return { k: "h2h_unbeaten", w: 6, t: ctx.hn + " are unbeaten in their last " + nw(nh) + " meetings with " + ctx.an + "." };
      if(na >= 4) return { k: "h2h_unbeaten", w: 6, t: ctx.an + " are unbeaten in their last " + nw(na) + " meetings with " + ctx.hn + "." };
      return null; },
    ctx => { const m = (ctx.h2h || []).filter(r => Array.isArray(r.ft)); if(m.length < 3) return null;
      return m.every(r => r.ft[0] + r.ft[1] > 2) ? { k: "h2h_goals", w: 5, t: "The last " + nw(m.length) + " meetings all had over two goals." } : null; },
    /* the away side's visits: how long since they last won there */
    ctx => { const v = (ctx.h2h || []).filter(r => Array.isArray(r.ft) && r.h === ctx.x.h.key && r.a === ctx.x.a.key); let n = 0;
      for(const r of v){ if(r.ft[1] > r.ft[0]) break; n++; }
      return n >= 3 ? { k: "away_drought", w: 5, t: ctx.an + " haven't won at " + ctx.hn + " in their last " + nw(n) + " visits." } : null; },
    /* the table: first meets last */
    ctx => { const p = ctx.pos || {}, h = p[ctx.x.h.key], a = p[ctx.x.a.key], L = ctx.teams || 0;
      if(!h || !a || L < 6 || games(ctx.rows, ctx.x.h.key, "all").length < 4) return null;
      return (h === 1 && a === L) || (a === 1 && h === L) ? { k: "top_bottom", w: 6, t: "First meets last." } : null; },
    /* form */
    ctx => { let best = null;
      for(const [key, nm] of [[ctx.x.h.key, ctx.hn], [ctx.x.a.key, ctx.an]]){
        const w = run(ctx.rows, key, s => s[0] > s[1]);
        if(w >= 3 && (!best || w > best.n)) best = { n: w, t: whole(ctx, key, w) ? nm + " have won every " + G1(ctx) + " this season."
          : nm + " have won their last " + nw(w) + " " + G(ctx) + "." };
      }
      return best ? { k: "form_wins", w: 3 + best.n / 2, t: best.t } : null; },
    ctx => { let best = null;
      for(const [key, nm] of [[ctx.x.h.key, ctx.hn], [ctx.x.a.key, ctx.an]]){
        const n = run(ctx.rows, key, s => s[0] <= s[1]);
        if(n >= 5 && (!best || n > best.n)) best = { n, t: whole(ctx, key, n) ? nm + " haven't won a " + G1(ctx) + " this season."
          : nm + " haven't won in " + nw(n) + " " + G(ctx) + "." };
      }
      return best ? { k: "form_winless", w: 2.5 + best.n / 2, t: best.t } : null; },
    ctx => { let best = null;
      for(const [key, nm] of [[ctx.x.h.key, ctx.hn], [ctx.x.a.key, ctx.an]]){
        const n = run(ctx.rows, key, s => s[1] > 0);
        if(n >= 6 && (!best || n > best.n)) best = { n, t: whole(ctx, key, n) ? nm + " haven't kept a clean sheet " + IN(ctx) + " this season."
          : nm + " haven't kept a clean sheet in " + nw(n) + " " + G(ctx) + "." };
      }
      return best ? { k: "no_clean_sheet", w: 2 + best.n / 3, t: best.t } : null; },
    /* this season, at home and away */
    ctx => { const L = line(ctx.rows, ctx.x.h.key).home;
      return L.gp >= 4 && L.fts === 0 ? { k: "home_scored", w: 4, t: ctx.hn + " have scored in every home " + G1(ctx) + " this season." } : null; },
    ctx => { const L = line(ctx.rows, ctx.x.h.key).home;
      return L.gp >= 4 && L.l === 0 ? { k: "home_unbeaten", w: 4.5, t: ctx.hn + " haven't lost at home " + IN(ctx) + " this season." } : null; },
    ctx => { const L = line(ctx.rows, ctx.x.a.key).away;
      return L.gp >= 4 && L.l === 0 ? { k: "away_unbeaten", w: 4.5, t: ctx.an + " haven't lost away " + IN(ctx) + " this season." } : null; },
    ctx => { const L = line(ctx.rows, ctx.x.a.key).away;
      return L.gp >= 4 && L.w === 0 ? { k: "away_winless", w: 3.5, t: ctx.an + " haven't won away " + IN(ctx) + " this season." } : null; },
    /* the best defence and the best attack */
    ctx => { const F = figures(ctx.rows), h = F[ctx.x.h.key], a = F[ctx.x.a.key];
      if(!h || !a || h.line.all.gp < 4 || a.line.all.gp < 4) return null;
      if((h.rank.ga === 1 && a.rank.gf === 1) || (a.rank.ga === 1 && h.rank.gf === 1))
        return { k: "defence_attack", w: 6.5, t: (ctx.cup ? "The " + ctx.cup + "'s" : "The league's") + " best defence meets its best attack." };
      if(h.rank.ga === 1) return { k: "best_defence", w: 3, t: ctx.hn + " have the best defence " + IN(ctx) + "." };
      if(a.rank.ga === 1) return { k: "best_defence", w: 3, t: ctx.an + " have the best defence " + IN(ctx) + "." };
      if(h.rank.gf === 1) return { k: "best_attack", w: 3, t: ctx.hn + " have the best attack " + IN(ctx) + "." };
      if(a.rank.gf === 1) return { k: "best_attack", w: 3, t: ctx.an + " have the best attack " + IN(ctx) + "." };
      return null; } ];
  function story(ctx){
    if(!ctx || !ctx.x) return null;
    const c = Object.assign({}, ctx, { rows: before(ctx.rows, ctx.x) });
    let best = null;
    for(const f of TEMPLATES){ let s = null; try{ s = f(c); }catch(e){ s = null; } if(s && (!best || s.w > best.w)) best = s; }
    return best;
  }

  const MC = { played, league, games, form, line, figures, secondLeg, chance, round100, shrink, MIN_GAMES, h2hSummary, story, TEMPLATES };
  root.MCStats = MC;
  if(typeof module === "object" && module && module.exports) module.exports = MC;
})(typeof window !== "undefined" ? window : this);
