/* The hand in the 501 Match. Your answer sets the hand for the whole visit:
   0 Steady (right), 1 Slight tremble (close o[0], or right on an Easy question),
   2 Shaky (off o[1]), 3 The yips (wrong o[2], too late, or any miss on a Hard question),
   4 Ice (right on a Hard question).
   The hand breathes: from touch-down the wobble swells and settles in cycles. At each
   still point there is a short clean-release window: let go inside its core = PERFECT,
   in the rest of it = GOOD, outside it = EARLY or LATE. Each dart finds its own first
   still point, so the ring has to be read: no fixed thumb rhythm does it. The grade sets
   the tempo, the window and how still the still point gets. Holding still too long tires
   the arm.
   Sizes are millimetres on a regulation board (treble bed 8 mm deep, ~33 mm wide).
   Darts already in the board block and deflect (collide), and the computer opponents
   are characters with their own throwing traits (OPP). */
(function(D){
  /* side/deep: wobble amplitude (mm); sd: release scatter; pull: drift into the neighbours;
     speed: wobble frequency; P: breathing period (s); hw: half the clean window (s);
     minE: wobble left at the still point */
  const HANDS = [
    { name: ["Steady hand", "Vaste hand"], say: ["Spot on. Now let go on the gold.", "Strak. Laat nu los op het goud."], side: 10, deep: 10, sd: 11, pull: 0, speed: 0.9, P: 1.5, hw: 0.15, minE: 0.30 },
    { name: ["Slight tremble", "Licht trillend"], say: ["Nearly right, the hand trembles a bit.", "Bijna goed, de hand trilt een beetje."], side: 14, deep: 14, sd: 15, pull: 4, speed: 1.2, P: 1.3, hw: 0.12, minE: 0.38 },
    { name: ["Shaky", "Trillend"], say: ["That was off. It drifts away.", "Dat zat er naast. Hij trekt weg."], side: 16, deep: 17, sd: 19, pull: 15, speed: 1.6, P: 1.1, hw: 0.10, minE: 0.45 },
    { name: ["The yips", "Bibberend"], say: ["Wrong. It pulls into the neighbours…", "Fout. Die trekt naar de buren…"], side: 14, deep: 18, sd: 21, pull: 28, speed: 2.1, P: 0.9, hw: 0.08, minE: 0.55 },
    { name: ["Ice hand", "IJskoude hand"], say: ["A hard one, nailed. Ice in the veins.", "Een moeilijke, raak. IJs in de aderen."], side: 6, deep: 6, sd: 6.6, pull: 0, speed: 0.75, P: 1.7, hw: 0.18, minE: 0.2 }
  ];
  /* question tier + answer -> hand. ans: 0 right, 1 close, 2 off, 3 wrong / too late */
  const TIERS = ["easy", "medium", "hard"];
  function gradeFor(tier, ans){
    if(tier === "hard") return ans === 0 ? 4 : 3;
    if(tier === "easy") return ans === 0 ? 1 : ans;
    return ans;
  }
  /* ---------- the throw: the numbers to tune on a real phone ----------
     PERFECT, GOOD, LOOSE: how much of the hidden scatter is left after a release in the core
     of the window, in the rest of it, or outside it (1 = all). PERFECT is the reward for
     reading the ring. LOOSE is the floor for a player who doesn't: raise it and a thumb that
     never looks does worse.
     CORE: the share of the window (hw in HANDS) that counts as PERFECT.
     FIRST: the earliest a dart's first still point can come after touch-down (s).
     NUDGE: how much later it can come, drawn per dart, as a share of the hand's period P.
     This is what beats a fixed thumb rhythm: one hold is clean at most 2 hw / (NUDGE x P) of
     the time. Higher is harder to solve but a longer wait on the slow hands.
     The computer's characters use none of these. _tests/throw-test.js guards them. */
  const CORE = 0.35, PERFECT = 0.45, GOOD = 0.72, LOOSE = 0.85, FIRST = 0.55, NUDGE = 0.4;
  const FAT0 = 4, FATK = 0.12, FATMAX = 1.5;
  const gauss = () => { let u = 0, v = 0; while(!u) u = Math.random(); while(!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  /* offset [x, y] that is "sideways" (tangential) by t and "deeper" (radial) by r at the aim point */
  function frame(aim, t, r){
    const len = Math.hypot(aim[0], aim[1]);
    if(len < 1) return [t, r];
    const ux = aim[0] / len, uy = aim[1] / len;
    return [ux * r - uy * t, uy * r + ux * t];
  }
  /* the hand with momentum (st.mom, 0..3 pips) and nerves (st.nerves, 0..3) applied */
  function mods(grade, st){
    const h = HANDS[grade] || HANDS[0], m = (st && st.mom) || 0, n = (st && st.nerves) || 0;
    return Object.assign({}, h, { hw: h.hw * (1 + 0.2 * m) * (1 - 0.12 * n), minE: h.minE * (1 - 0.1 * m), sd: h.sd * (1 - 0.04 * m),
      speed: h.speed * (1 + 0.1 * n), P: h.P / (1 + 0.1 * n) });
  }
  /* a new touch: this dart's first still point (s after touch-down), then one every P */
  function firstStill(grade, st){ return FIRST + Math.random() * NUDGE * mods(grade, st).P; }
  /* breathing time b against the nearest still point (s): below 0 early, above 0 late */
  function still(b, h, first){ const f = first == null ? FIRST : first, k = Math.max(0, Math.round((b - f) / h.P)); return b - (f + k * h.P); }
  /* the breathing: hs = { b: seconds since touch-down, rest: seconds the finger rested, first:
     this dart's first still point } or null (not touching: the full wobble). amp = wobble
     factor, win = 0 / 1 GOOD / 2 PERFECT, tired = the fatigue factor (1 = fresh), off = how far
     from the nearest still point (s, below 0 early) */
  function breath(hs, grade, st){
    const h = mods(grade, st);
    if(!hs) return { amp: 1, win: 0, tired: 1, base: 1, off: 0 };
    const off = still(hs.b, h, hs.first), d = Math.abs(off), dd = Math.min(d, h.P / 2);
    const base = h.minE + (1 - h.minE) * (1 - Math.cos(Math.PI * dd / (h.P / 2))) / 2;
    const tired = Math.min(FATMAX, 1 + FATK * Math.max(0, (hs.rest || 0) - FAT0));
    return { amp: base * tired, base, win: d < h.hw ? (d < h.hw * CORE ? 2 : 1) : 0, tired, off };
  }
  /* the wobble at time s (the global motion clock, so the crosshair never jumps): smooth,
     never quite repeating. A shaky hand also pulls to one side; the side swings over every
     few seconds (so you can't simply aim the other way). */
  function wobble(aim, s, grade, ph, hs, st){
    const h = mods(grade, st), k = h.speed, p = ph || 0, a = breath(hs, grade, st).amp;
    const pull = h.pull * Math.tanh(6 * Math.sin(s * 0.5 * k + p * 13.7));
    const t = pull + h.side * (0.62 * Math.sin(s * 2.1 * k + p) + 0.38 * Math.sin(s * 5.3 * k + p * 2.7));
    const r = h.deep * (0.6 * Math.sin(s * 2.9 * k + p * 1.3) + 0.4 * Math.sin(s * 6.7 * k + p * 0.7));
    return frame(aim, t * a, r * a);
  }
  /* where the dart actually goes when released: { pt, clean: 0 | 1 GOOD | 2 PERFECT, off } */
  function release(aim, s, grade, ph, hs, st){
    const h = mods(grade, st), br = breath(hs, grade, st), m = br.win === 2 ? PERFECT : br.win ? GOOD : LOOSE;
    const w = wobble(aim, s, grade, ph, hs, st), e = frame(aim, gauss() * h.sd * 1.2 * m, gauss() * h.sd * 0.8 * m);
    return { pt: [aim[0] + w[0] + e[0], aim[1] + w[1] + e[1]], clean: br.win, off: br.off };
  }
  /* a bad hand sometimes catches the wire and the dart drops out (no score) */
  const BOUNCE = [[0, 0], [0, 0], [0.5, 0.14], [0.7, 0.22], [0, 0]];
  function bounce(pt, grade){
    const [mm, p] = BOUNCE[grade] || BOUNCE[0];
    return mm > 0 && D.board.wire(pt[0], pt[1]) < mm && Math.random() < p;
  }

  /* ---------- darts in the board block and deflect ---------- */
  /* the barrel: an ellipse 3.5 mm to each side, 7 mm up and 2 mm down from the tip (the tail
     leans up on screen). < 1 = inside */
  const BX = 3.5, BUP = 7, BDN = 2;
  const blockDist = (p, q) => Math.hypot((p[0] - q[0]) / BX, (p[1] - q[1] + (BUP - BDN) / 2) / ((BUP + BDN) / 2));
  /* the shaft and flight: 5-16 mm above the tip, 7 mm to each side */
  const flightDist = (p, q) => Math.hypot((p[0] - q[0]) / 7, (p[1] - q[1] + 10.5) / 5.5);
  const blocked = (aim, inBoard) => (inBoard || []).some(q => !q.robin && (blockDist(aim, q.pt) < 1 || flightDist(aim, q.pt) < 1));
  /* inBoard: [{ pt, robin }]. Returns { pt, bo, robin, host, defl, flight } */
  function collide(pt, inBoard){
    inBoard = inBoard || [];
    for(let i = 0; i < inBoard.length; i++){
      const q = inBoard[i];
      if(q.robin || blockDist(pt, q.pt) >= 1) continue;
      const dd = Math.hypot(pt[0] - q.pt[0], pt[1] - q.pt[1]);
      if(dd < 0.8 && Math.random() < 0.5) return { pt: q.pt.slice(), robin: true, host: i, bo: false, defl: true };
      if(Math.random() < 0.3) return { pt, bo: true, defl: true, host: i };
      let ang = Math.atan2(pt[1] - q.pt[1], pt[0] - q.pt[0]); if(dd < 0.3) ang = Math.random() * 2 * Math.PI;
      ang += (Math.random() - 0.5) * 1.2;
      const push = BX + 1 + Math.random() * 5;
      return { pt: [q.pt[0] + Math.cos(ang) * push, q.pt[1] + Math.sin(ang) * push], bo: false, defl: true, host: i };
    }
    for(let i = 0; i < inBoard.length; i++){
      const q = inBoard[i];
      if(q.robin || flightDist(pt, q.pt) >= 1 || Math.random() >= 0.4) continue;
      if(Math.random() < 0.1) return { pt, bo: true, defl: true, flight: true, host: i };
      return { pt: [pt[0] + gauss() * 3, pt[1] + 4 + Math.random() * 6], bo: false, defl: true, flight: true, host: i };
    }
    return { pt, bo: false, defl: false };
  }
  /* aim at the freest part of the bed; switch T20 <-> T19 when the bed is shut */
  function smartAim(d, inBoard){
    const base = D.board.target(d);
    const live = (inBoard || []).filter(q => !q.robin);
    if(!live.length || (d.m === 2 && d.n === 25)) return { aim: base, d };
    let best = null;
    for(let t = -11; t <= 11; t += 1) for(let r = -2; r <= 2; r += 1){
      const a = d.n === 25 ? [base[0] + t * 0.6, base[1] + r] : frame(base, t, r).map((v, i) => v + base[i]);
      const hit = D.board.hit(a[0], a[1]); if(hit.m !== d.m || hit.n !== d.n) continue;
      const free = Math.min(...live.map(q => Math.min(blockDist(a, q.pt), flightDist(a, q.pt) + 0.4)));
      const sc = Math.min(free, 2.2) - Math.abs(t) * 0.04 - Math.abs(r) * 0.1;
      if(!best || sc > best.sc) best = { sc, a, free };
    }
    if(best && best.free > 1.25) return { aim: best.a, d };
    if(d.m === 3 && (d.n === 20 || d.n === 19)){ const alt = { m: 3, n: d.n === 20 ? 19 : 20 }; return { aim: D.board.target(alt), d: alt, switched: true }; }
    return { aim: best ? best.a : base, d };
  }

  /* ---------- the computer: characters (all fictional) ----------
     sd: scoring scatter (mm), calibrated with _tests/hand-sim.js to `avg`; shape: sideways vs deep;
     bed: favourite treble; dbl: scatter multiplier at a double (<1 cold finisher, >1 chokes);
     press: multiplier when you are on a finish or it's his match dart; streak: [chance per visit
     to turn hot or cold (or back), hot mult, cold mult]; erupt: one wild visit a leg (x this);
     aggro: chance to go for the bull / big finishes; prefer: favourite doubles (set-up);
     tempo: ms between darts; smart: aims around darts in the bed.
     The ids are saved in records and setups, so they stay when a name changes ("sparky" is Firefly). */
  const OPP = [
    { id: "landlord", lvl: 0, name: "Dennis Pruitt", nick: ["The Landlord", "De Kastelein"], flag: "ENG", avg: 35, sd: 24.4, shape: [1.15, 0.85], bed: 19, dbl: 1, press: 1, streak: [0, 1, 1], aggro: 0, tempo: 1250,
      tell: ["Throws T19 (“the 20 is for show-offs”), slow, never nervous", "Gooit T19 (“de 20 is voor opscheppers”), traag, nooit zenuwachtig"] },
    { id: "bitterbal", lvl: 0, name: "Bram de Wit", nick: ["Bitterbal", "Bitterbal"], flag: "NED", avg: 40, sd: 19.2, shape: [1.1, 0.9], bed: 20, dbl: 1.05, press: 1.05, streak: [0, 1, 1], aggro: 0.6, tempo: 950,
      tell: ["Loves the bull: goes for it far too often", "Is gek op de bull: gooit er veel te vaak op"] },
    { id: "sparky", lvl: 0, name: "Tasha Rowe", nick: ["Firefly", "Vuurvlieg"], flag: "WAL", avg: 45, sd: 18.6, shape: [1.15, 0.85], bed: 20, dbl: 1, press: 1.05, streak: [0.3, 0.6, 1.6], aggro: 0, tempo: 450,
      tell: ["Fast and erratic: wait for her cold spell", "Snel en wisselvallig: wacht op haar koude periode"] },
    { id: "accountant", lvl: 1, name: "Gordon Pike", nick: ["The Accountant", "De Boekhouder"], flag: "ENG", avg: 58, sd: 14.7, shape: [1.15, 0.85], bed: 20, dbl: 0.6, press: 1, streak: [0, 1, 1], aggro: 0, prefer: [32, 16, 8], tempo: 900,
      tell: ["Average scorer, cold finisher: never leave him a double", "Gewone scorer, ijskoude finisher: laat hem nooit een dubbel staan"] },
    { id: "molenaar", lvl: 1, name: "Kees Vermolen", nick: ["The Miller", "De Molenaar"], flag: "NED", avg: 62, sd: 12.3, shape: [1.1, 0.9], bed: 19, dbl: 1, press: 0.85, streak: [0, 1, 1], aggro: 0, tempo: 1000,
      tell: ["T19 grinder, steady under pressure", "T19-maler, rustig onder druk"] },
    { id: "hailstorm", lvl: 1, name: "Moira Quinn", nick: ["Hailstorm", "Hagelbui"], flag: "IRL", avg: 66, sd: 11.8, shape: [1.15, 0.85], bed: 20, dbl: 1, press: 1, streak: [0.3, 0.7, 1.3], aggro: 0, tempo: 520,
      tell: ["Fast and streaky: once she’s hot, she stays hot", "Snel en grillig: als ze warm loopt, blijft ze warm"] },
    { id: "maddog", lvl: 2, name: "Marek Kowal", nick: ["Mad Dog", "Dolle Hond"], flag: "POL", avg: 82, sd: 8.2, shape: [1.15, 0.85], bed: 20, dbl: 1.05, press: 1, streak: [0.1, 0.85, 1.2], aggro: 0.8, tempo: 700, smart: true,
      tell: ["Aggressive: goes for big fish and bull finishes", "Agressief: gaat voor grote finishes en de bull"] },
    { id: "sequins", lvl: 2, name: "Jet Halloran", nick: ["Sequins", "Pailletten"], flag: "ENG", avg: 86, sd: 7.25, shape: [1.15, 0.85], bed: 20, dbl: 1.6, press: 1.35, streak: [0, 1, 1], aggro: 0, tempo: 800, smart: true,
      tell: ["Big scorer, chokes on doubles: let him get there first", "Grote scorer, verkrampt op dubbels: laat hem maar eerst komen"] },
    { id: "tide", lvl: 3, name: "Callum Baird", nick: ["The Tide", "Het Getij"], flag: "SCO", avg: 97, sd: 6.8, shape: [1.15, 0.85], bed: 20, dbl: 1, press: 1, streak: [0, 1, 1], aggro: 0, tempo: 850, smart: true,
      tell: ["Relentless and even: no hot spells, no nerves", "Onverbiddelijk en gelijkmatig: geen pieken, geen zenuwen"] },
    { id: "metronome", lvl: 3, name: "Lena Brandt", nick: ["Metronome", "Metronoom"], flag: "GER", avg: 101, sd: 6.5, shape: [1.15, 0.85], bed: 20, dbl: 0.95, press: 0.9, streak: [0, 1, 1], aggro: 0, tempo: 800, smart: true,
      tell: ["Same rhythm every dart, a bit better when it matters", "Elke pijl hetzelfde ritme, net beter als het erop aankomt"] },
    { id: "ghost", lvl: 4, name: "Ezra Vale", nick: ["The Ghost", "De Geest"], flag: "CAN", avg: 110, sd: 5.55, shape: [1.15, 0.85], bed: 20, dbl: 1, press: 0.8, streak: [0, 1, 1], aggro: 0.1, tempo: 950, smart: true,
      tell: ["Ice cold in the big moments: the crowd goes quiet", "IJskoud als het erop aankomt: het publiek valt stil"] },
    { id: "volcano", lvl: 4, name: "Rocco Ferraro", nick: ["The Volcano", "De Vulkaan"], flag: "ITA", avg: 116, sd: 4.45, shape: [1.15, 0.85], bed: 20, dbl: 1, press: 1, streak: [0, 1, 1], erupt: 2.2, aggro: 0.2, tempo: 600, smart: true,
      tell: ["Defending champion. One eruption a leg: pounce on it", "Titelverdediger. Eén uitbarsting per leg: sla dan toe"] }
  ];
  const LEVELS = [["Pub", "Kroeg"], ["County", "Regio"], ["Open", "Open"], ["TV stage", "TV-podium"], ["World stage", "Wereldpodium"]];
  const opp = id => OPP.find(o => o.id === id) || OPP[4];

  /* a fresh form for a leg (streaks and the one eruption) */
  const oppLeg = P => ({ form: 0, erupt: P.erupt ? 1 + Math.floor(Math.random() * 6) : -1, visit: 0, now: 1 });
  /* at the start of each computer visit: hot/cold switches, the eruption. Returns the multiplier */
  function oppVisit(P, f){
    f.visit++;
    const p = P.streak[0];
    if(p > 0 && Math.random() < p) f.form = f.form ? 0 : (Math.random() < 0.5 ? 1 : -1);
    f.now = f.form === 1 ? P.streak[1] : f.form === -1 ? P.streak[2] : 1;
    if(f.visit === f.erupt) f.now *= P.erupt;
    return f.now;
  }
  /* the computer's dart. aimD: the bed; ctx { pressure, form, inBoard }. Returns the collide
     result { pt, bo, robin, host, defl } plus { raw (before any dart was hit), aim, target, switched } */
  function cpuThrow(aimD, P, ctx){
    ctx = ctx || {};
    const sd = P.sd * (aimD.m === 2 ? P.dbl : 1) * (ctx.pressure ? P.press : 1) * (ctx.form || 1);
    const sa = P.smart ? smartAim(aimD, ctx.inBoard) : { aim: D.board.target(aimD), d: aimD };
    const e = frame(sa.aim, gauss() * sd * P.shape[0], gauss() * sd * P.shape[1]), raw = [sa.aim[0] + e[0], sa.aim[1] + e[1]];
    const c = collide(raw, ctx.inBoard);
    return Object.assign(c, { raw, aim: sa.aim, target: sa.d, switched: !!sa.switched });
  }

  /* what the computer aims at with `left` to go and `k` darts left in the visit */
  const NICE = [40, 32, 16, 36, 24, 20, 8, 28, 12, 4];
  function cpuAim(left, k, P){
    const co = D.co, bed = (P && P.bed) || 20, aggro = (P && P.aggro) || 0;
    /* the bull lover / big-fish hunter: finish on the bull when one dart leaves 50 */
    if(aggro && left <= 110 && left >= 50 && Math.random() < aggro){
      if(left === 50) return { m: 2, n: 25 };
      if(k >= 2){
        const one = co.ALL.filter(d => co.val(d) === left - 50 && d.n !== 25).sort((a, b) => b.m - a.m)[0];
        if(one) return one;
      }
    }
    const r = co.route(left);
    if(r && r.length <= k) return r[0];
    if(left > 100){
      if(aggro > 0.5 && left > 170 && Math.random() < aggro * 0.25) return { m: 2, n: 25 };
      const alt = bed === 20 ? 19 : 20;
      return { m: 3, n: left - bed * 3 >= 2 && co.possible(left - bed * 3) || left > 170 ? bed : alt };
    }
    /* set up a finish for the next dart or visit: the single that leaves the nicest double */
    const pref = (P && P.prefer) ? P.prefer.concat(NICE.filter(x => !P.prefer.includes(x))) : NICE;
    let best = { m: 3, n: bed }, score = -1;
    for(const d of co.ALL){
      const rest = left - co.val(d);
      if(rest < 2) continue;
      const one = (rest <= 40 && rest % 2 === 0) || rest === 50, rr = co.route(rest), pi = pref.indexOf(rest);
      const v = (one ? 100 - (pi >= 0 ? pi : 10) * (rest <= 40 ? 1 : 0) : rr && rr.length <= 2 ? 50 : rr ? 20 : 0) - (d.m === 1 ? 0 : d.m === 3 ? 6 : 12) - (d.n === 25 ? 10 : 0);
      if(v > score){ score = v; best = d; }
    }
    return best;
  }
  /* ---------- the friend handicap (design-throwing 3.5): the weaker player starts lower ----------
     a, b: the two players' form (three-dart averages); returns [start for a, start for b]. The
     cut comes in tens, so a start still ends in 1, and takes at most HMAX of the start */
  const HCAP = 1.1, HMAX = 0.6;
  const tens = v => Math.round(v / 10) * 10;
  function handicap(a, b, start, k){
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if(!(hi > 0) || !(lo >= 0)) return [start, start];
    const low = start - Math.min(tens(start * HMAX), tens((k || HCAP) * start * (hi - lo) / hi));
    return a >= b ? [start, low] : [low, start];
  }

  /* the four plain levels of before map onto characters */
  const CPU = { easy: { name: ["Easy", "Makkelijk"], id: "landlord" }, medium: { name: ["Medium", "Gemiddeld"], id: "molenaar" }, hard: { name: ["Hard", "Moeilijk"], id: "sequins" }, expert: { name: ["Expert", "Expert"], id: "volcano" } };

  D.hand = { HANDS, TIERS, gradeFor, mods, firstStill, still, breath, wobble, release, bounce, frame, gauss,
    collide, blocked, smartAim, blockDist, flightDist,
    OPP, LEVELS, opp, oppLeg, oppVisit, cpuThrow, cpuAim, CPU, handicap,
    K: { CORE, PERFECT, GOOD, LOOSE, FIRST, NUDGE, FAT0, FATK, FATMAX } };
})(window.DART);
