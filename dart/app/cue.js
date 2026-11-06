/* The cue arm in Frame, and the computer at the table.
   Your answer sets the cue arm for the shot, like the hand in the 501 Match (hand.js):
   0 Steady cue (right), 1 Slight wobble (close o[0], or right on an Easy question),
   2 Wobbly (off o[1]), 3 Miscue risk (wrong, too late, or any miss on a Hard question),
   4 Ice cue (right on a Hard question). The cue arm breathes like the darts hand
   (D.hand.breath): the aim sways and settles; strike at a still point = PERFECT (x0.58) or
   GOOD (x0.8). In the zone (pots in a row) steadies it, nerves on the pink and black shake it.
   Angles are in degrees here: a small error at the cue ball grows on the way to the pocket
   (about 17x on a medium cut), which is why they look tiny.
   The computer: ten fictional characters (OPP) with their own game (safety player,
   break-builder, nervous potter…). plan() tries pots and safeties on a copy of the table
   with the real physics and picks one the way that character would; shoot() adds the
   character's own error. */
(function(D){
  const ARM = [
    { name: ["Steady cue", "Vaste keu"], say: ["Spot on. Smooth cue action.", "Strak. Soepele stoot."], sway: 0.10, sd: 0.040, pw: 0.03, mis: 0 },
    { name: ["Slight wobble", "Licht wiebelend"], say: ["Nearly right, the cue arm wobbles a bit.", "Bijna goed, de keu-arm wiebelt een beetje."], sway: 0.16, sd: 0.060, pw: 0.045, mis: 0 },
    { name: ["Wobbly cue", "Wiebelende keu"], say: ["That was off. The cue wanders.", "Dat zat ernaast. De keu dwaalt af."], sway: 0.25, sd: 0.090, pw: 0.06, mis: 0.04 },
    { name: ["Miscue risk", "Kans op miscue"], say: ["Wrong. Careful, the tip could slip…", "Fout. Pas op, de pomerans kan wegglijden…"], sway: 0.38, sd: 0.140, pw: 0.08, mis: 0.12 },
    { name: ["Ice cue", "IJskoude keu"], say: ["A hard one, nailed. Ice cue.", "Een moeilijke, raak. IJskoude keu."], sway: 0.06, sd: 0.025, pw: 0.02, mis: 0 }
  ];
  const PERFECT = 0.58, GOOD = 0.8;
  const rad = d => d * Math.PI / 180;
  const gauss = rnd => { let u = 0, v = 0; while(!u) u = rnd(); while(!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  /* a seeded random (the tests and the simulator use it; the game uses Math.random) */
  function rng(seed){ let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* the visible sway of the aim (degrees) at motion time s, with the breathing factor amp */
  function sway(grade, s, ph, amp, st){
    const a = ARM[grade] || ARM[0], m = D.hand ? D.hand.mods(grade, st) : { speed: 1 };
    const k = m.speed || 1, p = ph || 0;
    return a.sway * amp * (0.62 * Math.sin(s * 2.1 * k + p) + 0.38 * Math.sin(s * 5.3 * k + p * 2.7));
  }
  /* your strike: aim (rad), power speed, the breathing at release (D.hand.breath result).
     Returns { a, v, miscue, clean } */
  function strike(grade, aim, v, s, ph, br, st, rnd){
    rnd = rnd || Math.random;
    const A = ARM[grade] || ARM[0], m = br.win === 2 ? PERFECT : br.win ? GOOD : 1;
    const mom = (st && st.mom) || 0, nerves = (st && st.nerves) || 0;
    const k = (1 - 0.06 * mom) * (1 + 0.15 * nerves);
    let a = aim + rad(sway(grade, s, ph, br.amp, st) + gauss(rnd) * A.sd * m * k), sp = v * (1 + gauss(rnd) * A.pw * m);
    const mis = A.mis * (br.win ? 0.5 : 1) * (1 + 0.3 * nerves) > rnd();
    if(mis){ a += rad((rnd() < 0.5 ? -1 : 1) * (1.5 + rnd() * 4)); sp *= 0.35 + rnd() * 0.3; }
    return { a, v: Math.max(150, sp), miscue: mis, clean: br.win };
  }

  /* ---------- the computer: characters (all fictional) ----------
     aim: potting error (degrees, 1 sd); attack: the pot chance it needs to go for it;
     pos: positional play 0..1 (how hard it thinks about the next shot); safe: safety error
     multiplier; nerve: error multiplier on the last pink/black or a frame ball; build: error
     multiplier gained per pot in a break (break-builder); long: error multiplier on long pots;
     fight: plays on for snookers instead of conceding; tempo: ms to think */
  const OPP = [
    { id: "wilf", lvl: 0, name: "Wilf Tanner", nick: ["Old Wilf", "Ouwe Wilf"], flag: "ENG", aim: 0.20, attack: 0.08, pos: 0, safe: 1.6, nerve: 1.1, build: 1, long: 1.2, fight: false, tempo: 900,
      tell: ["Goes for everything, never plays safe", "Gaat op alles af, speelt nooit safe"] },
    { id: "robbe", lvl: 0, name: "Robbe Willaert", nick: ["The Butterfly", "De Vlinder"], flag: "BEL", aim: 0.15, attack: 0.3, pos: 0.2, safe: 1.3, nerve: 2.2, build: 1, long: 1.1, fight: false, tempo: 700,
      tell: ["Pots well, but the nerves flutter on the pink and black", "Pot goed, maar fladdert van de zenuwen op roze en zwart"] },
    { id: "agnes", lvl: 1, name: "Agnes Kerr", nick: ["The Librarian", "De Bibliothecaris"], flag: "SCO", aim: 0.13, attack: 0.62, pos: 0.5, safe: 0.6, nerve: 1, build: 1, long: 1.25, fight: true, tempo: 1400,
      tell: ["Quiet safety player: she makes you play the hard shot", "Stille safetyspeler: zij laat jou de moeilijke bal spelen"] },
    { id: "pim", lvl: 1, name: "Pim Bakker", nick: ["Long Pot Pim", "Lange Pim"], flag: "NED", aim: 0.12, attack: 0.25, pos: 0.15, safe: 1.2, nerve: 1.05, build: 1, long: 0.7, fight: false, tempo: 800,
      tell: ["Pots from anywhere, but forgets about the next ball", "Pot van overal, maar vergeet de volgende bal"] },
    { id: "owain", lvl: 2, name: "Owain Pryce", nick: ["The Bricklayer", "De Metselaar"], flag: "WAL", aim: 0.11, attack: 0.4, pos: 0.8, safe: 0.9, nerve: 1, build: 0.965, long: 1.15, fight: true, tempo: 1300,
      tell: ["Slow break-builder: the longer the break, the better he gets", "Trage breakbouwer: hoe langer de break, hoe beter"] },
    { id: "mei", lvl: 2, name: "Mei Lin", nick: ["Velvet", "Fluweel"], flag: "CHN", aim: 0.095, attack: 0.38, pos: 0.7, safe: 0.85, nerve: 1, build: 0.99, long: 1, fight: false, tempo: 900,
      tell: ["Smooth all-rounder with lovely position", "Soepele allrounder met prachtige positie"] },
    { id: "declan", lvl: 3, name: "Declan Shaw", nick: ["The Night Owl", "De Nachtuil"], flag: "NIR", aim: 0.08, attack: 0.28, pos: 0.6, safe: 1, nerve: 1.1, build: 0.98, long: 0.9, fight: true, tempo: 600,
      tell: ["Attacks everything: punish him when he misses", "Valt alles aan: straf hem af als hij mist"] },
    { id: "somchai", lvl: 3, name: "Somchai Rattana", nick: ["The Breeze", "De Bries"], flag: "THA", aim: 0.075, attack: 0.36, pos: 0.75, safe: 0.9, nerve: 1, build: 0.985, long: 0.95, fight: false, tempo: 450,
      tell: ["Plays at the speed of light, and it flows", "Speelt razendsnel, en het loopt"] },
    { id: "graham", lvl: 4, name: "Graham Hale", nick: ["Granite", "Graniet"], flag: "ENG", aim: 0.065, attack: 0.5, pos: 0.85, safe: 0.6, nerve: 0.8, build: 0.985, long: 1, fight: true, tempo: 1200,
      tell: ["Nerveless and tactical: no gifts, ever", "Zenuwen van staal en tactisch: geeft nooit iets weg"] },
    { id: "kang", lvl: 4, name: "Kang Yiming", nick: ["Clockwork", "Het Uurwerk"], flag: "CHN", aim: 0.055, attack: 0.4, pos: 0.95, safe: 0.8, nerve: 0.95, build: 0.97, long: 0.95, fight: false, tempo: 850,
      tell: ["Defending champion. Once he’s in, he clears the table", "Titelverdediger. Als hij aan tafel komt, ruimt hij op"] }
  ];
  const LEVELS = [["Pub", "Kroeg"], ["Club", "Club"], ["Pro-Am", "Pro-Am"], ["TV table", "Tv-tafel"], ["World stage", "Wereldpodium"]];
  const opp = id => OPP.find(o => o.id === id) || OPP[2];

  /* ---------- looking at the table ---------- */
  const P = () => D.phys, Rl = () => D.rules;
  /* the balls that are on for the player at the table */
  function onBalls(w, st){
    const o = Rl().on(st);
    return w.balls.filter(b => b.on && b.id !== "cue" && (o === "red" ? Rl().kind(b.id) === "red" : o === "colour" ? Rl().kind(b.id) !== "red" : b.id === o));
  }
  const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  /* every pot that is on: { b, p (pocket index), aim (rad), cut, dcg, dop, chance, v (speed to pot it gently) }
     sd: the shooter's error in degrees */
  function pots(w, st, sd, from){
    const ph = P(), cue = from || ph.ball(w, "cue"), out = [], R = ph.R;
    for(const b of onBalls(w, st)) ph.POCKETS.forEach((pk, pi) => {
      const T = pk.aim, dx = T[0] - b.x, dy = T[1] - b.y, dop = Math.hypot(dx, dy); if(dop < 1) return;
      const ux = dx / dop, uy = dy / dop;
      /* the approach into the mouth */
      const cosA = -(ux * pk.n[0] + uy * pk.n[1]);
      if(cosA < (pk.corner ? 0.55 : 0.6)) return;
      const G = [b.x - ux * 2 * R, b.y - uy * 2 * R], gx = G[0] - cue.x, gy = G[1] - cue.y, dcg = Math.hypot(gx, gy);
      if(dcg < 1) return;
      const cosT = (gx * ux + gy * uy) / dcg; if(cosT < 0.17) return;
      if(!ph.clear(w, [b.x, b.y], T, [b.id]) || !ph.clear(w, [cue.x, cue.y], G, ["cue", b.id])) return;
      /* how much room the pocket gives along this line */
      const allow = pk.corner ? 24 * (0.5 + 0.5 * Math.min(1, (cosA - 0.55) / 0.45)) : 28 * cosA * cosA;
      const sphi = rad(sd) * dcg / (2 * R * Math.max(0.17, cosT)) + 0.004;
      const chance = Math.max(0, erf(Math.atan(allow / dop) / (sphi * Math.SQRT2)));
      /* a gentle pot: the object ball runs ~25 cm past the pocket */
      const vo = ph.speedFor(dop + 250), vc = vo / (cosT * 0.97), v = Math.min(ph.VMAX, ph.speedFor(ph.rollDist(vc) + dcg));
      out.push({ b: b.id, p: pi, aim: Math.atan2(gy, gx), cut: Math.acos(Math.min(1, cosT)), dcg, dop, chance, v, value: Rl().value(b.id) });
    });
    return out.sort((x, y) => y.chance * y.value - x.chance * x.value);
  }
  /* can the cue ball see any part of a ball on? (if not: snookered) */
  function canHit(w, st, from){
    const ph = P(), cue = from || ph.ball(w, "cue");
    return onBalls(w, st).some(b => {
      const d = Math.hypot(b.x - cue.x, b.y - cue.y), a0 = Math.atan2(b.y - cue.y, b.x - cue.x), half = Math.asin(Math.min(1, 2 * ph.R / d)) * 0.97;
      for(let k = -4; k <= 4; k++) if(ph.aimLine(w, a0 + half * k / 4, cue).id === b.id) return true;
      return false;
    });
  }
  /* the best next pot for the player at the table, as a number (chance x value, plus a little) */
  function leaveScore(w, st, sd){
    const p = pots(w, st, sd)[0];
    return p ? p.chance * (p.value + 1) : 0;
  }
  /* the rules' view of a simulated shot, applied to copies: { foul, pts, st (after), w (after, colours re-spotted) } */
  function outcome(w, st, res){
    const s = JSON.parse(JSON.stringify(st)), o = Rl().apply(s, res);
    o.respot.forEach(id => P().respot(w, id));
    return { o, st: s };
  }

  /* ---------- the computer plans a shot ----------
     ctx: { pots (in this break), pressure } ; returns { a, v, s, kind: "pot" | "safe", b, p, chance } */
  function plan(w, st, prof, ctx){
    ctx = ctx || {};
    const ph = P(), sd = effSd(prof, w, st, ctx), budget = 3 + Math.round(prof.pos * 4);
    const cands = pots(w, st, sd).slice(0, budget);
    let best = null;
    const spins = prof.pos >= 0.5 ? [-0.8, 0, 0.7] : prof.pos > 0 ? [0, 0.7] : [0];
    const mults = prof.pos >= 0.5 ? [1, 1.4, 1.9] : [1, 1.5];
    for(const c of cands){
      for(const m of mults) for(const s of spins){
        const v = Math.min(ph.VMAX, c.v * m), sw = ph.clone(w);
        ph.strike(sw, c.aim, v, s); const r = ph.run(sw);
        if(!r.potted.includes(c.b) || r.cueIn || r.first !== c.b) continue;
        const oc = outcome(sw, st, r);
        if(oc.o.foul) continue;
        const next = oc.st.over ? 8 : leaveScore(sw, oc.st, sd);
        const score = c.chance * (c.value + 0.9 * next * (0.3 + prof.pos)) - (1 - c.chance) * 2.2;
        if(!best || score > best.score) best = { a: c.aim, v, s, kind: "pot", b: c.b, p: c.p, chance: c.chance, score };
      }
      /* a pot that only works without thinking about position */
      if(!best || best.b !== c.b){
        const score = c.chance * c.value - (1 - c.chance) * 2.2;
        if(!best || score > best.score + 0.5) best = { a: c.aim, v: c.v, s: 0, kind: "pot", b: c.b, p: c.p, chance: c.chance, score };
      }
    }
    if(best && best.chance >= prof.attack) return best;
    const safe = safety(w, st, prof);
    if(!best || !safe) return best || safe || fallback(w, st);
    /* compare the risk: a pot that misses leaves a chance; a safety leaves the other one little */
    return best.chance * (best.score + 3) > safe.score + 3 * (1 - prof.attack) ? best : safe;
  }
  const OPP_SD = 0.09;
  function safety(w, st, prof){
    const ph = P(), cue = ph.ball(w, "cue"), list = onBalls(w, st);
    const targets = list.map(b => ({ b, d: Math.hypot(b.x - cue.x, b.y - cue.y) })).sort((a, b) => a.d - b.d).slice(0, 5);
    let best = null;
    for(const { b, d } of targets){
      const a0 = Math.atan2(b.y - cue.y, b.x - cue.x), half = Math.asin(Math.min(1, 2 * ph.R / d));
      for(const f of [-0.92, -0.6, -0.25, 0.25, 0.6, 0.92]) for(const v of [700, 1100, 1700]){
        const a = a0 + half * f, sw = ph.clone(w);
        ph.strike(sw, a, v, 0); const r = ph.run(sw);
        if(r.first !== b.id) continue;
        const oc = outcome(sw, st, r);
        if(oc.o.foul) continue;
        if(oc.o.pts){ /* it potted a ball on: a bonus, the visit goes on */ const sc = 3 + oc.o.pts; if(!best || sc > best.score) best = { a, v, s: 0, kind: "safe", b: b.id, score: sc }; continue; }
        const nc = ph.ball(sw, "cue"), opp = leaveScore(sw, oc.st, OPP_SD);
        const snookered = !canHit(sw, oc.st) ? 2.5 : 0;
        const far = Math.min(1, Math.min(...onBalls(sw, oc.st).map(x => Math.hypot(x.x - nc.x, x.y - nc.y)).concat([3000])) / 1500);
        const score = -opp * 1.6 + snookered + far * 0.8;
        if(!best || score > best.score) best = { a, v, s: 0, kind: "safe", b: b.id, score };
      }
    }
    if(best) best.score += 0;
    return best;
  }
  /* nothing legal found: just hit the nearest ball on full */
  function fallback(w, st){
    const ph = P(), cue = ph.ball(w, "cue"), list = onBalls(w, st);
    if(!list.length) return { a: 0, v: 800, s: 0, kind: "safe" };
    const b = list.map(b => ({ b, d: Math.hypot(b.x - cue.x, b.y - cue.y) })).sort((x, y) => x.d - y.d)[0].b;
    return { a: Math.atan2(b.y - cue.y, b.x - cue.x), v: 1200, s: 0, kind: "safe", b: b.id };
  }
  /* the character's error for this shot (degrees) */
  function effSd(prof, w, st, ctx){
    let sd = prof.aim;
    if(ctx.pressure) sd *= prof.nerve;
    if(ctx.pots) sd *= Math.max(0.72, Math.pow(prof.build, ctx.pots));
    return sd;
  }
  /* the computer strikes: its own error on top of the plan */
  function shoot(plan, prof, w, st, ctx, rnd){
    rnd = rnd || Math.random;
    let sd = effSd(prof, w, st, ctx || {});
    if(plan.kind === "safe") sd *= prof.safe;
    else if(plan.dcg && plan.dop && plan.dcg + plan.dop > 1800) sd *= prof.long;
    else { const c = pots(w, st, sd).find(x => x.b === plan.b && x.p === plan.p); if(c && c.dcg + c.dop > 1800) sd *= prof.long; }
    return { a: plan.a + rad(gauss(rnd) * sd), v: plan.v * (1 + gauss(rnd) * 0.035), s: plan.s };
  }
  /* the computer places the cue ball in the D: the spot with the best plan */
  function place(w, st, prof){
    const ph = P(), cue = ph.ball(w, "cue");
    let best = null;
    for(let k = 0; k < 14; k++){
      const ang = Math.PI * (k / 13), r = ph.DR * (k % 2 ? 0.5 : 0.9);
      const x = ph.CX + Math.cos(ang) * r, y = ph.BAULK + Math.sin(ang) * r * 0.9 + 2;
      if(!ph.inD(x, y) || !ph.free(w, x, y, "cue")) continue;
      cue.x = x; cue.y = y;
      const sc = leaveScore(w, st, prof.aim) + (canHit(w, st) ? 0 : -5);
      if(!best || sc > best.sc) best = { x, y, sc };
    }
    if(!best) best = { x: ph.CX, y: ph.BAULK + ph.DR * 0.5 };
    cue.x = best.x; cue.y = best.y; cue.on = true; cue.vx = cue.vy = 0;
    return best;
  }
  /* should the computer give up the frame? (needs snookers and isn't a fighter) */
  function concede(st, i, prof){
    const Rr = Rl(); if(!Rr.needsSnookers(st, i)) return false;
    const need = Rr.behind(st, i) - Rr.remaining(st);
    return !prof.fight || need > 14 || Rr.remaining(st) <= 7;
  }

  D.cue = { ARM, PERFECT, GOOD, sway, strike, OPP, LEVELS, opp, onBalls, pots, canHit, leaveScore, plan, safety, shoot, place, concede, rng, gauss, outcome };
})(window.DART);
