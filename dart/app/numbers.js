/* The Numbers deck: questions worked out from checkout.js when the bank loads, so there is no file in _bank, nothing
   comes from memory and it can't go stale. A row has the shape of a bank row: Dutch with an en block, o = the wrong
   options closest first (the match grades the hand on that order), plus gen (the kind) and data (what the test
   recomputes it from). It stays off what the bank and the staged rows already ask: the highest finish, the two bogey
   rows in Spelregels (a 169 and a 167) and the lowest score that takes three darts (99). */
(function(D){
  const pair = v => Array.isArray(v) ? v.map(String) : [String(v), String(v)];
  const L = d => D.co.label(d);
  const line = r => r.map(L).join(" ");
  const sum = r => r.reduce((a, d) => a + D.co.val(d), 0);
  /* three wrong numbers around a, one per step: above or below by the seed, so the right one doesn't always sit in the same place */
  const near = (a, steps, seed, lo, hi) => steps.map((s, i) => {
    const up = seed >>> (i * 5 + 3) & 1, v = a + (up ? s : -s);
    return v < (lo || 1) || v > (hi || Infinity) ? a + (up ? -s : s) : v;
  });
  const dbl = n => L({ m: 2, n });
  /* the doubles around this one, nearest first */
  const doubles = (z, seed) => (z.n === 25 ? [20, 19, 18] : near(z.n, [1, 2, 4], seed, 1, 20)).map(dbl);
  /* the three closest from a list */
  const closest = (a, list) => list.filter(x => x !== a).sort((x, y) => Math.abs(x - a) - Math.abs(y - a) || y - x).slice(0, 3);
  /* darts that are safe on n, the nearest in value to the bust first: every one is checked with play() */
  const safe = (n, a) => D.co.ALL.filter(d => D.co.play(n, [d]).state !== "bust")
    .sort((x, y) => Math.abs(D.co.val(x) - D.co.val(a)) - Math.abs(D.co.val(y) - D.co.val(a)));
  /* wrong routes: one dart nudged, so it no longer adds up; three of them, closest first */
  function wrongRoutes(n, r){
    const seen = new Set([line(r)]), out = [];
    r.forEach((d, i) => [1, -1, 2, -2].forEach(by => {
      const x = d.n === 25 ? { m: 2, n: 20 } : { m: d.m, n: d.n + by };
      if(x.n < 1 || x.n > 20 || x.m > 3) return;
      const alt = r.slice(); alt[i] = x;
      if(seen.has(line(alt)) || D.co.play(n, alt).state === "out") return;
      seen.add(line(alt)); out.push({ t: line(alt), off: Math.abs(sum(alt) - n) });
    }));
    out.sort((a, b) => a.off - b.off);
    return [out[0], out[out.length >> 1], out[out.length - 1]].map(x => x.t);
  }

  D.numbers = function(){
    const rows = [], co = D.co, hash = D.qs.hash;
    const add = (kind, key, tier, q, a, o, sub, data) => {
      const A = pair(a), O = o.map(pair);
      rows.push({ id: "n-" + kind + "-" + key, gen: kind, tier, status: "ok", q: q[1], a: A[1], o: O.map(x => x[1]), sub: sub[1],
        en: { q: q[0], a: A[0], o: O.map(x => x[0]), sub: sub[0] }, data });
    };
    const scores = (lo, hi, f) => { const out = []; for(let n = lo; n <= hi; n++) if(f(n)) out.push(n); return out; };

    /* one dart: which double finishes it */
    scores(2, 50, n => co.minDarts(n) === 1).forEach(n => {
      const z = co.route(n)[0];
      add("double", n, "easy", ["Which double checks out " + n + "?", "Welke dubbel gooit " + n + " uit?"], L(z), doubles(z, hash("d" + n)),
        [L(z) + " is 2 × " + z.n + ".", L(z) + " is 2 × " + z.n + "."], { n });
    });
    /* what a bed is worth */
    [2, 3].forEach(m => scores(6, 20, () => true).forEach(n => {
      const a = co.val({ m, n }), other = (5 - m) * n, o = near(a, [m, 2 * m, 3 * m], hash("p" + m + n));
      if(!o.includes(other)) o[2] = other;
      o.sort((x, y) => Math.abs(x - a) - Math.abs(y - a));
      add("points", L({ m, n }), "easy", ["How many points is a " + (m === 3 ? "treble " : "double ") + n + "?", "Hoeveel punten is een " + (m === 3 ? "triple " : "dubbel ") + n + "?"], a, o,
        [m + " × " + n + " = " + a + ".", m + " × " + n + " = " + a + "."], { m, n });
    }));
    /* the chalker's sum */
    [501, 301].forEach(start => [26, 41, 45, 60, 81, 85, 95, 100, 121, 125, 140, 180].forEach(sc => {
      const a = start - sc;
      add("left", start + "-" + sc, "easy", ["You’re on " + start + " and score " + sc + ". What’s left?", "Je staat op " + start + " en gooit " + sc + ". Wat houd je over?"], a, near(a, [10, 20, 100], hash("l" + start + sc)),
        [start + " − " + sc + " = " + a + ".", start + " − " + sc + " = " + a + "."], { start, sc });
    }));
    /* the double a route leaves */
    scores(41, 170, co.possible).forEach(n => {
      const r = co.route(n), z = r[r.length - 1];
      if(r.length === 2) add("after", n, n <= 60 ? "easy" : "medium", ["You’re on " + n + " and hit " + L(r[0]) + ". Which double is left?", "Je staat op " + n + " en raakt " + L(r[0]) + ". Welke dubbel houd je over?"], L(z), doubles(z, hash("a" + n)),
        [n + " − " + co.val(r[0]) + " = " + co.val(z) + ": " + L(z) + ".", n + " − " + co.val(r[0]) + " = " + co.val(z) + ": " + L(z) + "."], { n, route: r.map(L) });
      if(r.length === 3) add("after3", n, "hard", ["You’re on " + n + " and hit " + L(r[0]) + " and " + L(r[1]) + ". Which double is left?", "Je staat op " + n + " en raakt " + L(r[0]) + " en " + L(r[1]) + ". Welke dubbel houd je over?"], L(z), doubles(z, hash("t" + n)),
        [n + " − " + co.val(r[0]) + " − " + co.val(r[1]) + " = " + co.val(z) + ": " + L(z) + ".", n + " − " + co.val(r[0]) + " − " + co.val(r[1]) + " = " + co.val(z) + ": " + L(z) + "."], { n, route: r.map(L) });
      if(r.length === 3) add("sum", n, "medium", [L(r[0]) + ", " + L(r[1]) + " and " + L(z) + ": what’s the total?", L(r[0]) + ", " + L(r[1]) + " en " + L(z) + ": hoeveel is dat samen?"], n, near(n, [3, 10, 20], hash("s" + n)),
        [r.map(d => co.val(d)).join(" + ") + " = " + n + ".", r.map(d => co.val(d)).join(" + ") + " = " + n + "."], { n, route: r.map(L) });
      /* which route adds up */
      if(r.length > 1) add("route", n, n <= 110 ? "medium" : "hard", ["Which route checks out " + n + "?", "Welke route gooit " + n + " uit?"], line(r), wrongRoutes(n, r),
        [r.map(d => co.val(d)).join(" + ") + " = " + n + ".", r.map(d => co.val(d)).join(" + ") + " = " + n + "."], { n });
    });
    /* the fewest darts: 1, 2, 3 or not in three */
    const WORDS = [["1 dart", "1 pijl"], ["2 darts", "2 pijlen"], ["3 darts", "3 pijlen"], ["Not in three", "Niet in drie"]];
    const fewest = (n, tier) => {
      const i = co.possible(n) ? co.minDarts(n) - 1 : 3, o = [0, 1, 2, 3].filter(x => x !== i).sort((x, y) => Math.abs(x - i) - Math.abs(y - i) || y - x).map(x => WORDS[x]);
      add("fewest", n, tier, ["What’s the fewest darts to check out " + n + "?", "Wat is het minste aantal pijlen om " + n + " uit te gooien?"], WORDS[i], o,
        co.possible(n) ? [line(co.route(n)) + ".", line(co.route(n)) + "."] : [n + " is a bogey number.", n + " is een bogey-nummer."], { n });
    };
    scores(60, 120, n => n % 5 === 0 && (n < 99 || n > 110)).forEach(n => fewest(n, "medium"));
    scores(99, 110, () => true).concat(scores(159, 170, () => true)).forEach(n => fewest(n, "hard"));
    /* which dart busts: too much, leaves 1, or lands on zero without a double */
    const bust = (kind, key, tier, n, d, en, nl) => {
      const near3 = safe(n, d);
      add("bust", kind + key, tier, ["You’re on " + n + ". Which dart busts?", "Je staat op " + n + ". Welke pijl is bust?"], L(d), [0, 2, 5].map(i => L(near3[i])), [en, nl], { n, dart: L(d) });
    };
    scores(22, 57, n => n % 2 === 0).forEach(n => {
      const d = { m: 3, n: Math.floor(n / 3) + 1 };
      bust("over", n, "medium", n, d, L(d) + " is " + co.val(d) + ": too much on " + n + ".", L(d) + " is " + co.val(d) + ": te veel op " + n + ".");
    });
    scores(21, 61, () => true).forEach(n => {
      const d = co.ALL.find(x => x.m > 1 && co.val(x) === n - 1);
      if(d) bust("one", n, "hard", n, d, L(d) + " leaves 1, and 1 can’t be finished.", L(d) + " laat 1 staan, en 1 kun je niet uitgooien.");
    });
    scores(8, 20, () => true).forEach(n => {
      const d = { m: 1, n };
      bust("zero", n, "hard", n, d, "A single " + n + " lands on zero, but not on a double.", "Een enkele " + n + " komt op nul, maar niet op een dubbel.");
    });
    /* the bogey numbers, the numbers around them, and what takes two darts or three */
    const can = scores(150, 170, co.possible), bogey = co.BOGEY;
    bogey.filter(n => n !== 169).forEach(n => add("bogey", n, "medium", ["Which of these scores has no three-dart checkout?", "Welke van deze scores is niet uit te gooien in drie pijlen?"], n, closest(n, can),
      [n + " is a bogey number.", n + " is een bogey-nummer."], { n }));
    can.filter(n => n >= 160 && n !== 167).forEach(n => add("can", n, "hard", ["Which of these scores does have a three-dart checkout?", "Welke van deze scores is wel uit te gooien in drie pijlen?"], n, closest(n, bogey),
      [line(co.route(n)) + ".", line(co.route(n)) + "."], { n }));
    const two = scores(99, 110, n => co.minDarts(n) === 2), three = scores(99, 110, n => co.minDarts(n) === 3);
    two.forEach(n => add("two", n, "hard", ["Which of these scores has a two-dart checkout?", "Welke van deze scores is uit te gooien in twee pijlen?"], n, closest(n, three),
      [line(co.route(n)) + ".", line(co.route(n)) + "."], { n }));
    three.filter(n => n !== 99).forEach(n => add("three", n, "hard", ["Which of these scores needs three darts?", "Welke van deze scores kost drie pijlen?"], n, closest(n, two),
      [line(co.route(n)) + ".", line(co.route(n)) + "."], { n }));
    return rows;
  };
})(window.DART);
