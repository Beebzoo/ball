/* The question bank: every deck listed in _bank/questions/decks.json, rows with status "ok"
   only. Loaded once, the first time a screen asks for it. Rows are Dutch with an "en" block
   (same option order); in English the en block replaces the text. The wrong options are
   ordered closest first, so grade() can tell a near miss from a wild guess. */
(function(R){
  const BASE = "_bank/questions/";
  const NAMES = { regels: ["Rules", "Regels"], legendes: ["Legends", "Legendes"], nu: ["The tour now", "De tour nu"], slams: ["The majors", "De majors"], bijnamen: ["Nicknames", "Bijnamen"], nederland: ["Low Countries", "Lage Landen"],
    toernooien: ["Tournaments", "Toernooien"], materiaal: ["Gear & science", "Materiaal"], cultuur: ["Off court", "Naast de baan"], dubbel: ["Doubles & more", "Dubbel & meer"] };
  const name = d => NAMES[d] ? R.T(NAMES[d][0], NAMES[d][1]) : d;
  let all = null, loading = null;

  function load(){
    if(all) return Promise.resolve(all);
    return loading = loading || fetch(BASE + "decks.json", { cache: "no-cache" }).then(r => r.json()).then(j => {
      const decks = Array.isArray(j) ? j : j.decks;
      return Promise.all(decks.map(d => fetch(BASE + d + ".jsonl", { cache: "no-cache" }).then(r => r.ok ? r.text() : "").then(t =>
        t.split("\n").map(l => { try { return l.trim() ? JSON.parse(l) : null; } catch(e){ return null; } })
          .filter(q => q && q.status === "ok" && q.q && q.a && Array.isArray(q.o) && q.o.length >= 3)
          .map(q => Object.assign(q, { deck: d })))));
    }).then(lists => (all = [].concat(...lists))).catch(e => { loading = null; throw e; });
  }
  const shuffle = a => { a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* a row in the chosen language, with its four buttons shuffled */
  function local(q){
    const L = R.store.lang === "en" && q.en && q.en.q ? Object.assign({}, q, { q: q.en.q, a: q.en.a, o: q.en.o, sub: q.en.sub || "" }) : Object.assign({}, q);
    L.opts = shuffle([L.a].concat(L.o.slice(0, 3)));
    return L;
  }
  /* recently asked ids are kept so the next rounds don't repeat them */
  const SEEN = "racket.seen";
  const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || "[]"); } catch(e){ return []; } };
  const match = (q, deck, tier) => (deck === "all" || q.deck === deck) && (tier === "mix" || q.tier === tier);
  function pick(deck, tier, n){
    const pool = all.filter(q => match(q, deck, tier));
    const old = new Set(seen()), fresh = pool.filter(q => !old.has(q.id));
    const out = shuffle(fresh).slice(0, n);
    if(out.length < n) out.push(...shuffle(pool.filter(q => old.has(q.id))).slice(0, n - out.length));
    try { localStorage.setItem(SEEN, JSON.stringify(seen().concat(out.map(q => q.id)).slice(-Math.max(40, Math.floor(all.length * 0.7))))); } catch(e){}
    return out.map(local);
  }
  const count = (deck, tier) => all ? all.filter(q => match(q, deck, tier)).length : 0;
  /* 0 right, 1 close (o[0]), 2 off (o[1]), 3 wrong (o[2]) or no answer */
  const grade = (q, choice) => choice == null ? 3 : choice === q.a ? 0 : Math.min(3, 1 + Math.max(0, q.o.indexOf(choice)));

  /* the daily question: one hard question per date, the same on every phone */
  function today(){ const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function daily(date){
    date = date || today();
    /* only rows added before that date, so new questions never change a day's question;
       rows marked dull in the fun pass stay out until they're rewritten */
    let hard = all.filter(q => q.tier === "hard" && !q.dull && (!q.added || q.added < date));
    if(!hard.length) hard = all.filter(q => q.tier === "hard");
    hard.sort((a, b) => a.id < b.id ? -1 : 1);
    if(!hard.length) return null;
    let h = 2166136261; for(const c of date) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return local(hard[(h >>> 0) % hard.length]);
  }

  R.qs = { DECKS: Object.keys(NAMES), load, pick, count, name, shuffle, grade, daily, today, get decks(){ return all ? Object.keys(NAMES).filter(d => all.some(q => q.deck === d)) : []; } };
})(window.RACKET);
