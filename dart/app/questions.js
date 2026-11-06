/* The question bank: every deck listed in _bank/questions/decks.json, rows with
   status "ok" only. Loaded once, the first time a game asks for it. Each deck has a sport
   ("darts" or "snooker") and a name; "alles" (everything) always means everything of one
   sport, so a darts match never gets a snooker question. The Numbers deck (numbers.js) has no
   file: it is worked out when the bank loads and joins in as one more darts deck. */
(function(D){
  const BASE = "_bank/questions/";
  /* a deck that belongs to one language stays out of "Everything" in the other; picked by name in the Quiz it is still there */
  const LOCAL = { nederland: "nl" };
  /* out of a mix of bank and Numbers rows, the share of Numbers: the bar quiz stays a quiz */
  const SHARE = 0.3;
  const TIERS = ["easy", "medium", "hard"];
  let all = null, loading = null, META = {};
  const name = d => META[d] ? D.T(META[d].name[0], META[d].name[1]) : d;
  const sportOf = d => (META[d] && META[d].sport) || "darts";

  function load(){
    if(all) return Promise.resolve(all);
    return loading = loading || fetch(BASE + "decks.json", { cache: "no-cache" }).then(r => r.json()).then(j => {
      /* a deck is { id, sport, name: [en, nl] } (an old plain id is a darts deck) */
      const decks = (Array.isArray(j) ? j : j.decks).map(d => typeof d === "string" ? { id: d, sport: "darts", name: [d, d] } : d);
      decks.forEach(d => META[d.id] = d);
      return Promise.all(decks.map(d => fetch(BASE + d.id + ".jsonl", { cache: "no-cache" }).then(r => r.ok ? r.text() : "").then(t =>
        t.split("\n").map(l => { try { return l.trim() ? JSON.parse(l) : null; } catch(e){ return null; } })
          .filter(q => q && q.status === "ok" && q.q && q.a && Array.isArray(q.o) && q.o.length >= 3)
          .map(q => Object.assign(q, { deck: d.id, sport: d.sport })))));
    }).then(lists => {
      META.numbers = { id: "numbers", sport: "darts", name: ["Numbers", "Cijfers"] };
      return (all = [].concat(...lists, D.numbers().map(q => Object.assign(q, { deck: "numbers", sport: "darts" }))));
    }).catch(e => { loading = null; throw e; });
  }
  const shuffle = a => { a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const away = q => LOCAL[q.deck] && LOCAL[q.deck] !== D.store.lang;
  const inSet = (q, deck, tier, sport) => (deck === "alles" ? q.sport === (sport || "darts") && !away(q) : q.deck === deck) && (tier === "mix" || q.tier === tier);

  /* every asked id once, the longest ago first (a list from before this had repeats: the last time counts) */
  const SEEN = "dart.seen";
  const seen = () => { try { const a = JSON.parse(localStorage.getItem(SEEN) || "[]"); return Array.isArray(a) ? [...new Set(a.reverse())].reverse() : []; } catch(e){ return []; } };
  const asked = ids => { try { localStorage.setItem(SEEN, JSON.stringify(seen().filter(id => !ids.includes(id)).concat(ids).slice(-all.length))); } catch(e){} };
  /* never asked first, then the longest ago. The order comes from the rows in this pool only (this sport, this tier), so
     parked rows don't count and a row can't come back before its whole pool has been round */
  function pick(deck, tier, n, sport){
    const pool = all.filter(q => inSet(q, deck, tier, sport)), when = new Map(seen().map((id, i) => [id, i]));
    const order = rows => shuffle(rows).sort((a, b) => (when.has(a.id) ? when.get(a.id) : -1) - (when.has(b.id) ? when.get(b.id) : -1));
    const bank = order(pool.filter(q => !q.gen)), gen = order(pool.filter(q => q.gen)), out = [];
    while(out.length < n && bank.length + gen.length) out.push(((Math.random() < SHARE && gen.length) || !bank.length ? gen : bank).shift());
    asked(out.map(q => q.id));
    return shuffle(out).map(local);
  }
  /* in English, the row's "en" block (same option order) replaces the Dutch text */
  function local(q){
    const L = D.store.lang === "en" && q.en && q.en.q ? Object.assign({}, q, { q: q.en.q, a: q.en.a, o: q.en.o, sub: q.en.sub || "" }) : Object.assign({}, q);
    L.opts = shuffle([L.a].concat(L.o.slice(0, 3)));
    return L;
  }
  const count = (deck, tier, sport) => all ? all.filter(q => inSet(q, deck, tier, sport)).length : 0;
  /* the decks of a sport that have questions, in decks.json order */
  const decks = sport => Object.keys(META).filter(d => sportOf(d) === (sport || "darts") && (!all || all.some(q => q.deck === d)));
  /* a small fixed hash: the same on every phone */
  const hash = s => { let h = 2166136261; for(const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  /* the same rows for everybody on a day (a day number): one per tier in turn, easiest first. Each tier stands in a fixed
     order that is walked a day at a time, so a row comes back only after its whole tier. New rows in the bank are simply
     in the walk from then on. Only rows that are for everyone, so the language doesn't change what is asked. */
  function daily(sport, n, day){
    const pool = all.filter(q => q.sport === sport && !q.gen && !LOCAL[q.deck]), out = [];
    for(let i = 0; i < n; i++){
      const rows = pool.filter(q => q.tier === TIERS[i % TIERS.length]).sort((a, b) => hash(a.id) - hash(b.id) || (a.id < b.id ? -1 : 1));
      if(rows.length) out.push(rows[(day + i) % rows.length]);
    }
    return out.map(local);
  }

  D.qs = { load, pick, count, name, shuffle, decks, sportOf, daily, local, hash, asked };
})(window.DART);
