/* Match point's point model: how an answer becomes a shot, the computer opponents, and how
   a rally ends. No DOM: the match screen uses it and _tests/rally-sim.js plays thousands of
   matches with it to keep the levels fair.

   A point has up to three steps, each a question for a human player (a roll for the computer):
     1. the serve: the server picked Easy/Medium/Hard for the game; right = a good first serve
        (Hard and right is a real ace chance), close = a soft first serve, off = a fault and a
        safe second serve, wrong or too late = a fault and a double fault risk;
     2. the return: right and fast = a chance of a winner down the line, wrong = a return error;
     3. the rally: on clay (often) and hard courts (sometimes) one rally question: right pushes,
        wrong is an unforced error. Grass points stay short.
   What's left is decided by a roll on the "edge" (a logit): serve quality minus return quality
   plus the server's surface advantage and the computer's skill. Grades: 0 right, 1 close
   (o[0]), 2 off (o[1]), 3 wrong (o[2]) or too late. */
window.RACKET = window.RACKET || {};
(function(R){
  const sig = x => 1 / (1 + Math.exp(-x));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* surfaces: ace factor, server's edge in rallies, chance of a rally question, rally length */
  const SURF = {
    hard: { ace: 1, srv: 0.2, rallyQ: 0.25, len: [2, 8], name: ["Hard court", "Hardcourt"] },
    clay: { ace: 0.55, srv: 0.05, rallyQ: 0.5, len: [4, 14], name: ["Clay", "Gravel"] },
    grass: { ace: 1.6, srv: 0.4, rallyQ: 0, len: [1, 5], name: ["Grass", "Gras"] }
  };
  /* the serve per question tier: ace chance (right answer), first-serve quality, double fault risk (wrong answer) */
  const SERVE = {
    easy: { ace: 0.04, q: 0.45, df: 0.16, name: ["Easy", "Makkelijk"], say: ["Safe serve", "Veilige opslag"] },
    medium: { ace: 0.13, q: 0.75, df: 0.28, name: ["Medium", "Gemiddeld"], say: ["Solid serve", "Stevige opslag"] },
    hard: { ace: 0.27, q: 1.05, df: 0.42, name: ["Hard", "Moeilijk"], say: ["Ace chance", "Kans op een ace"] }
  };
  const FAST = 3.5; // seconds: right within this is "fast"

  /* ten fictional opponents, two per level. srv: first-serve quality, first: first serves in,
     ace: ace chance on a first serve in, df: double faults on second serves, ret: return quality,
     rally: rally skill, clutch: extra on break/set/match points, surf: likes and dislikes,
     retW: return winners on second serves */
  const LEVELS = [["Club player", "Clubspeler"], ["County", "Regio"], ["Tour pro", "Tourprof"], ["Top 20", "Top 20"], ["Slam champion", "Slamkampioen"]];
  const OPP = [
    { id: "captain", lvl: 0, name: "Gerrit Bos", nick: ["The Club Captain", "De Clubkapitein"], flag: "NED", hand: "R",
      style: ["Thirty years at the same club. Never misses, never hurts you.", "Dertig jaar bij dezelfde club. Mist nooit, doet nooit pijn."],
      srv: 0.28, first: 0.7, ace: 0.01, df: 0.04, ret: 0.18, rally: -0.26, clutch: 0, surf: {}, retW: 0.01 },
    { id: "moonball", lvl: 0, name: "Inès Moreau", nick: ["Moonball", "Maanbal"], flag: "FRA", hand: "R",
      style: ["Loops everything sky-high. Loves clay, hates grass.", "Lobt alles de lucht in. Dol op gravel, haat gras."],
      srv: 0.3, first: 0.62, ace: 0.02, df: 0.07, ret: 0.12, rally: -0.2, clutch: 0, surf: { clay: 0.15, grass: -0.15 }, retW: 0.02 },
    { id: "wall", lvl: 1, name: "Mateo Quintanar", nick: ["The Wall", "De Muur"], flag: "ESP", hand: "R",
      style: ["Gets everything back. A clay grinder with a soft serve.", "Krijgt alles terug. Gravelvreter met een zachte opslag."],
      srv: 0.32, first: 0.68, ace: 0.02, df: 0.04, ret: 0.28, rally: -0.02, clutch: 0.05, surf: { clay: 0.15, grass: -0.12 }, retW: 0.03 },
    { id: "lefty", lvl: 1, name: "Freya Lindqvist", nick: ["The Lefty", "De Linkspoot"], flag: "SWE", hand: "L",
      style: ["A left-handed slice serve that swings you off the court.", "Linkse slice-opslag die je van de baan trekt."],
      srv: 0.5, first: 0.63, ace: 0.05, df: 0.06, ret: 0.16, rally: -0.06, clutch: 0, surf: { grass: 0.12 }, retW: 0.03 },
    { id: "cannon", lvl: 2, name: "Viktor Halberg", nick: ["The Cannon", "Het Kanon"], flag: "DEN", hand: "R",
      style: ["Serves bombs. Long rallies make him nervous.", "Slaat bommen. Van lange rally’s wordt hij zenuwachtig."],
      srv: 0.68, first: 0.58, ace: 0.11, df: 0.08, ret: 0.16, rally: 0.04, clutch: -0.05, surf: { grass: 0.15, clay: -0.15 }, retW: 0.04 },
    { id: "fox", lvl: 2, name: "Giulia Benedetti", nick: ["The Fox", "De Vos"], flag: "ITA", hand: "R",
      style: ["Drop shots, lobs, angles. Sharpest on the big points.", "Dropshots, lobs, hoeken. Op de grote punten op haar best."],
      srv: 0.42, first: 0.66, ace: 0.04, df: 0.04, ret: 0.26, rally: 0.1, clutch: 0.15, surf: {}, retW: 0.05 },
    { id: "engine", lvl: 3, name: "Lukas Brenner", nick: ["The Engine", "De Motor"], flag: "AUT", hand: "R",
      style: ["Never tires, never misses. Best on clay.", "Wordt nooit moe, mist nooit. Op zijn best op gravel."],
      srv: 0.5, first: 0.7, ace: 0.05, df: 0.03, ret: 0.42, rally: 0.34, clutch: 0.05, surf: { clay: 0.15, grass: -0.08 }, retW: 0.05 },
    { id: "storm", lvl: 3, name: "Amara Diallo", nick: ["The Storm", "De Storm"], flag: "SEN", hand: "R",
      style: ["A forehand like thunder. When she’s hot, you’re gone.", "Een forehand als de donder. Als zij loopt, ben jij weg."],
      srv: 0.7, first: 0.6, ace: 0.08, df: 0.06, ret: 0.36, rally: 0.3, clutch: -0.08, surf: { hard: 0.1 }, retW: 0.08, streak: true },
    { id: "ice", lvl: 4, name: "Elena Kovářová", nick: ["Ice Queen", "IJskoningin"], flag: "CZE", hand: "L",
      style: ["Calm, left-handed, merciless. Three Slams on three surfaces.", "Kalm, linkshandig, genadeloos. Drie Slams op drie ondergronden."],
      srv: 0.66, first: 0.67, ace: 0.07, df: 0.03, ret: 0.52, rally: 0.5, clutch: 0.18, surf: {}, retW: 0.07 },
    { id: "closer", lvl: 4, name: "Kai Nakamura", nick: ["The Closer", "De Afmaker"], flag: "JPN", hand: "R",
      style: ["The Slam champion. Big serve, no weak side.", "De Slamkampioen. Grote opslag, geen zwakke kant."],
      srv: 0.82, first: 0.66, ace: 0.1, df: 0.03, ret: 0.5, rally: 0.54, clutch: 0.12, surf: { grass: 0.05 }, retW: 0.08 }
  ];
  const opp = id => OPP.find(o => o.id === id) || OPP[0];

  /* a computer serve: { end: "ace"|"df" } or { q, first } */
  function cpuServe(o, surf, rnd){
    const S = SURF[surf];
    if(rnd() < o.first){
      if(rnd() < o.ace * S.ace) return { end: "ace", first: true };
      return { q: o.srv, first: true };
    }
    if(rnd() < o.df) return { end: "df", first: false };
    return { q: o.srv - 0.75, first: false };
  }
  /* a human serve from the answer: tier, grade, fast */
  function humanServe(tier, g, fast, surf, retSkill, rnd){
    const T = SERVE[tier], S = SURF[surf];
    if(g === 0){
      if(rnd() < T.ace * S.ace * (1 - clamp(retSkill, -0.5, 0.6) * 0.5)) return { end: "ace", first: true };
      return { q: T.q + (fast ? 0.1 : 0), first: true };
    }
    if(g === 1) return { q: 0.05, first: true, soft: true };
    if(rnd() < (g === 2 ? 0.07 : T.df)) return { end: "df", first: false };
    return { q: g === 2 ? -0.3 : -0.5, first: false };
  }
  /* a computer return against serve quality q: { end: "retW"|"retE" } or { q } */
  function cpuReturn(o, serve, rnd){
    if(!serve.first && rnd() < o.retW) return { end: "retW" };
    return { q: o.ret };
  }
  /* a human return from the answer: right and fast can be a winner down the line */
  function humanReturn(g, fast, serve, rnd){
    if(g === 0 && fast && rnd() < clamp(0.42 - serve.q * 0.12, 0.2, 0.55)) return { end: "retW" };
    if(g === 0) return { q: fast ? 0.6 : 0.35 };
    if(g === 1) return { q: -0.25 };
    if(g === 2) return { q: -0.7 };
    if(rnd() < 0.8) return { end: "retE" };
    return { q: -1.1 };
  }
  /* the edge of the server in the rally (logit). skill: the computer's rally skill (0 for a human),
     clutch: the computer's pressure bonus on a big point */
  function edge(serve, ret, ctx){
    const S = SURF[ctx.surf];
    let e = serve.q - ret.q + S.srv + (ctx.skill[ctx.server] || 0) - (ctx.skill[1 - ctx.server] || 0);
    if(ctx.stake) e += (ctx.clutch[ctx.server] || 0) - (ctx.clutch[1 - ctx.server] || 0);
    return e;
  }
  /* a rally question: right pushes, fast and right pushes more, wrong is an unforced error */
  function rallyShot(g, fast){
    if(g === 0) return { d: fast ? 0.8 : 0.5 };
    if(g === 1) return { d: 0 };
    if(g === 2) return { d: -0.55 };
    return { end: "ue" };
  }
  /* how the rally ends, for the court and the stats: who won, how, and how many shots */
  function finish(w, server, pW, surf, rnd){
    const S = SURF[surf], span = S.len[1] - S.len[0] + 1;
    let shots = S.len[0] + Math.floor(Math.pow(rnd(), 1.6) * span);
    if(w !== server) shots = Math.max(2, shots);
    let end;
    if(shots === 1) end = "unret";
    else {
      const r = rnd();
      end = pW > 0.6 ? (r < 0.62 ? "winner" : "forced") : pW > 0.4 ? (r < 0.42 ? "winner" : r < 0.66 ? "forced" : "ue") : (r < 0.45 ? "winner" : "ue");
    }
    return { w, end, shots };
  }
  /* the surface preference and streaks of a computer player, as a skill bonus */
  const surfBonus = (o, surf) => (o && o.surf && o.surf[surf]) || 0;

  /* plays one point. ctx: { surf, server, stake, players: [{ human, tier, o, run }, …] }.
     ask(p, kind, info) gives a human's answer { g, fast } for kind "serve", "return" or "rally"
     (a promise on screen, a plain value in the simulation). The result: { w, end, shots, first,
     by (who made the error), pS (the server's chance in the rally) } */
  async function playPoint(ctx, ask, rnd){
    rnd = rnd || Math.random;
    const s = ctx.server, r = 1 - s, P = ctx.players, S = SURF[ctx.surf];
    const skill = P.map(p => p.human ? 0 : p.o.rally + surfBonus(p.o, ctx.surf) + (p.o.streak && p.run >= 3 ? 0.35 : 0));
    const clutch = P.map(p => p.human ? 0 : p.o.clutch);
    const res = { server: s, first: true };
    const done = (w, end, shots, by) => Object.assign(res, { w, end, shots, by: by == null ? null : by });
    let bonus = 0; // a right answer on a big point: nerves of steel
    const steel = (p, a) => { if(ctx.stake && a.g === 0) bonus += p === s ? 0.25 : -0.25; };

    let serve;
    if(P[s].human){
      const a = await ask(s, "serve", { tier: P[s].tier });
      steel(s, a);
      serve = humanServe(P[s].tier, a.g, a.fast, ctx.surf, P[r].human ? 0 : P[r].o.ret, rnd);
    } else serve = cpuServe(P[s].o, ctx.surf, rnd);
    res.first = serve.first; res.soft = !!serve.soft;
    if(serve.end === "ace") return done(s, "ace", 1);
    if(serve.end === "df") return done(r, "df", 0, s);

    let ret;
    if(P[r].human){
      const a = await ask(r, "return", { serve });
      steel(r, a);
      ret = humanReturn(a.g, a.fast, serve, rnd);
    } else ret = cpuReturn(P[r].o, serve, rnd);
    if(ret.end === "retW") return done(r, "retW", 2);
    if(ret.end === "retE") return done(s, "retE", 1, r);

    let e = edge(serve, ret, { surf: ctx.surf, server: s, skill, clutch, stake: ctx.stake }) + bonus;
    const humans = [s, r].filter(p => P[p].human);
    if(humans.length && rnd() < S.rallyQ){
      /* against the computer the human plays it; between friends, whoever is on the back foot defends */
      const who = humans.length === 1 ? humans[0] : e >= 0 ? r : s;
      const attack = who === s ? e >= 0 : e < 0;
      const a = await ask(who, "rally", { attack });
      const sh = rallyShot(a.g, a.fast);
      if(sh.end) return done(1 - who, "ue", S.len[0] + 1 + Math.floor(rnd() * 4), who);
      e += who === s ? sh.d : -sh.d;
      res.rallyQ = who;
    }
    const pS = sig(e), w = rnd() < pS ? s : r, f = finish(w, s, w === s ? pS : 1 - pS, ctx.surf, rnd);
    res.pS = pS;
    return done(f.w, f.end, f.shots, f.end === "ue" || f.end === "forced" ? 1 - f.w : null);
  }

  R.rally = { SURF, SERVE, FAST, LEVELS, OPP, opp, cpuServe, humanServe, cpuReturn, humanReturn, edge, rallyShot, finish, surfBonus, playPoint, sig, clamp };
})(window.RACKET);
