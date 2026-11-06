/* Checkout of the day: one number and three questions for everyone on a date, on the real board. Three visits, nine darts
   (a bust costs the whole visit), a question before each visit, Easy, then Medium, then Hard; the answer sets the hand as in
   the 501 Match, and the score is the darts used. The first go of the day counts from the moment it starts, also if you
   walk away. After that the same number is practice: other questions, nothing kept. The streak counts days with a counted
   go, so a day without a checkout keeps it and only a day without a go ends it. Glory only: no XP, no records, no trophies.
   The throw is match.js's own, run as a mode (see the top of that file).
   Stored per player under "dart.daily.v1": { p: { player: { "2026-11-06": { n, out, left, darts, right, asked } } } }.
   A day is the phone's own calendar date, kept with a go from its start, so a go that runs past midnight stays on its day. */
(function(D){
  const T = D.T, KEY = "dart.daily.v1", VISITS = 3, TIERS = ["easy", "medium", "hard"];
  const MONTHS = [["Jan", "jan"], ["Feb", "feb"], ["Mar", "mrt"], ["Apr", "apr"], ["May", "mei"], ["Jun", "jun"], ["Jul", "jul"], ["Aug", "aug"], ["Sep", "sep"], ["Oct", "okt"], ["Nov", "nov"], ["Dec", "dec"]];
  const name = () => T("Checkout of the day", "Checkout van de dag");
  const pad = n => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  /* days counted from the calendar, so summer time can't skip one: the seed, and the way to step back a day */
  const dayNo = k => { const [y, m, d] = k.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const shift = (k, by) => new Date((dayNo(k) + by) * 864e5).toISOString().slice(0, 10);
  const stamp = k => { const [, m, d] = k.split("-").map(Number); return d + " " + T(MONTHS[m - 1][0], MONTHS[m - 1][1]); };
  /* every finish from 61 to 170 once before any comes back: a fixed shuffle, walked a day at a time */
  const ORDER = (() => { const ok = []; for(let n = 61; n <= 170; n++) if(D.co.possible(n)) ok.push(n); return ok.sort((a, b) => D.qs.hash("n" + a) - D.qs.hash("n" + b)); })();
  const number = k => ORDER[dayNo(k) % ORDER.length];

  const read = () => { let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch(e){} return s && s.p && typeof s.p === "object" ? s : { p: {} }; };
  let S = read(), shown = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} };
  const days = p => S.p[p] || (S.p[p] = {});

  /* days in a row with a counted go, up to day k; not thrown yet on k, then k - 1 still holds it */
  function streak(p, k){
    const d = days(p);
    let at = d[k] ? k : shift(k, -1), n = 0;
    while(d[at]){ n++; at = shift(at, -1); }
    return n;
  }
  function bestStreak(p){
    let best = 0, run = 0, prev = null;
    Object.keys(days(p)).sort().forEach(k => { run = prev && shift(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return best;
  }
  /* the day's counted go: it exists from here on, so a second one can't take its place. null when there already is one */
  function begin(p, k){
    S = read();
    if(days(p)[k]) return null;
    const n = number(k);
    days(p)[k] = { n, out: false, left: n, darts: 0, right: 0, asked: 0 };
    save();
    return days(p)[k];
  }
  /* one line for the group chat: no route, no questions */
  const shareLine = (k, r, st) => "DART " + stamp(k) + " · " + r.n + (r.out ? T(" in " + r.darts + " darts", " in " + r.darts + " pijlen") : T(" not out", " niet uit")) + " · " + T("streak ", "reeks ") + st;
  const inRow = n => n === 1 ? T("1 day in a row", "1 dag op rij") : T(n + " days in a row", n + " dagen op rij");
  const outText = r => r.out ? T("Out in " + r.darts + " darts", "Uit in " + r.darts + " pijlen") : T("Not out", "Niet uit");

  /* the card at the top of Home */
  function card(){
    S = read();
    const k = today(), p = D.store.me, r = days(p)[k], st = streak(p, k);
    shown = k;
    const t = r ? outText(r) + "<br>" + inRow(st) : st ? inRow(st) + "<br>" + T("Throw today to keep it", "Gooi vandaag om het te houden") : T("Nine darts. Today’s first go counts", "Negen pijlen. Je eerste poging vandaag telt");
    return '<a class="cod dy-card' + (r ? " done" : "") + '" href="#daily"><span class="cod-board">' + D.board.svg() + '</span><span class="cod-txt"><span class="lbl">' + name() + '</span><span class="cod-t"><span>' + t + '</span></span></span><b class="chalk' + (r && r.out ? " out" : "") + '">' + number(k) + "</b></a>";
  }
  /* a phone that stays open overnight: Home catches up with the date when you come back to it */
  if(typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
    if(!document.hidden && shown && shown !== today() && document.querySelector(".dy-card")) D.go(location.hash || "#spelen");
  });

  /* the mode for match.js. rec gets the score after every visit; qs = the day's rows, or none for practice */
  function mode(n, rec, qs, done){
    let v = 0;
    return {
      pref: { vs: "solo", friend: -1, best: 1, start: n, tier: "pick", clock: 15, last: {} },
      head: () => (qs ? "" : T("Practice · ", "Oefenen · ")) + T("Visit ", "Beurt ") + Math.min(v + 1, VISITS) + T(" of ", " van ") + VISITS,
      tier: () => TIERS[v],
      question(){
        if(!qs) return D.qs.pick("alles", TIERS[v], 1, "darts")[0];
        D.qs.asked([qs[v].id]);
        return qs[v];
      },
      visit(p, how, darts){
        v++;
        Object.assign(rec, { darts: rec.darts + (how === "bust" ? VISITS : darts), left: p.left, out: how === "out", right: p.qRight, asked: p.qAll });
        save();
        return v < VISITS;
      },
      end: done
    };
  }

  function screen(el){
    /* the 501 Match's look, for all three screens of the daily */
    el.classList.add("s-match"); document.body.classList.add("in-match");
    let alive = true, stop = null;
    const me = D.store.me, fx = D.fx;
    const leave = () => { if(stop){ stop(); stop = null; } };
    const top = back => '<div class="g-top"><a class="back" href="#spelen">‹ ' + back + "</a><b>" + name() + "</b><span></span></div>";
    function run(k, rec){
      leave();
      const go = rec || { darts: 0, left: 0, right: 0, asked: 0 };
      const m = mode(rec ? rec.n : number(k), go, rec && D.qs.daily("darts", VISITS, dayNo(k)), () => result(k, rec, !rec && Object.assign({ n: number(k) }, go)));
      /* Stop on a counted go says what it costs: it won't come back */
      if(rec) m.sure = () => T("Sure? It counts", "Zeker? Hij telt");
      stop = D.match(el, m);
    }
    function practice(k, btn){
      btn.disabled = true;
      D.qs.load().then(() => alive && run(k, null)).catch(() => { btn.disabled = false; });
    }
    function intro(){
      const k = today(), n = number(k), st = streak(me, k);
      el.innerHTML = top("Menu") + '<div class="g-body dy"><p class="lbl">' + stamp(k) + T(" · the same for everyone", " · voor iedereen hetzelfde") + '</p>' +
        '<div class="dy-stage"><div class="dy-board">' + D.board.svg() + '</div><b class="chalk">' + n + "</b></div>" +
        '<div class="facts"><div><b>9</b><span>' + T("darts, in three visits", "pijlen, in drie beurten") + "</span></div><div><b>3</b><span>" + T("questions, one per visit", "vragen, één per beurt") + "</span></div><div><b>1</b><span>" + T("go that counts", "poging die telt") + "</span></div></div>" +
        '<p class="lead">' + T("The answer sets your hand, as in the 501 Match: Easy first, Hard last. Your first go counts from the first question, also if you stop. After that you can practise.",
          "Het antwoord bepaalt je hand, net als in de 501 Match: eerst makkelijk, als laatste moeilijk. Je eerste poging telt vanaf de eerste vraag, ook als je stopt. Daarna kun je oefenen.") + "</p>" +
        (st ? '<p class="dy-st">' + inRow(st) + "</p>" : "") +
        '<button class="go" id="go">Game on</button><p class="count" id="ld"></p></div>';
      const go = el.querySelector("#go");
      go.onclick = () => {
        /* left open past midnight: show the new number first */
        if(today() !== k) return intro();
        go.disabled = true; el.querySelector("#ld").textContent = T("Loading questions…", "Vragen laden…");
        D.qs.load().then(() => {
          if(!alive) return;
          const rec = begin(me, k);
          rec ? run(k, rec) : result(k);
        }).catch(() => { go.disabled = false; el.querySelector("#ld").textContent = T("The questions won’t load. Try again in a moment.", "De vragen laden niet. Probeer het zo nog eens."); });
      };
      fx.stagger(el.querySelector(".g-body"), null, 0);
    }
    function verdict(r){
      if(!r.out) return r.darts < 9 ? T("You left the oche. It still counts.", "Van de oche gelopen. Hij telt wel.") : T("Not today.", "Vandaag niet.");
      return r.darts === D.co.minDarts(r.n) ? T("As fast as it can be done.", "Sneller kan niet.") : r.darts <= 6 ? T("Lovely finishing.", "Mooi uitgegooid.") : T("Got there.", "Toch uit.");
    }
    /* the day's result; fresh = just finished, tried = a practice go just finished */
    function result(k, fresh, tried){
      const r = days(me)[k], st = streak(me, k), text = shareLine(k, r, st), now = k === today();
      el.innerHTML = top("Menu") + '<div class="g-body dy-end"><p class="lbl">' + D.esc(D.store.players[me] || "") + " · " + stamp(k) + "</p>" +
        '<div class="score-hero"><p class="chalk huge">' + r.n + "</p><small>" + outText(r) + (r.out ? "" : T(", " + r.left + " left", ", nog " + r.left)) + "</small></div>" +
        '<p class="verdict">' + verdict(r) + "</p>" +
        (tried ? '<p class="dy-st">' + T("Practice: ", "Oefenen: ") + outText(tried).toLowerCase() + T(". Today’s result stays.", ". Je uitslag van vandaag blijft staan.") + "</p>" : "") +
        '<div class="stats"><div><b>' + r.darts + "</b><span>" + T("darts used", "pijlen gebruikt") + "</span></div><div><b>" + r.right + "/" + r.asked + "</b><span>" + T("questions right", "vragen goed") + "</span></div><div><b>" + st + "</b><span>" + T("in a row · best ", "op rij · record ") + bestStreak(me) + "</span></div></div>" +
        '<p class="dy-line" id="line">' + D.esc(text) + '</p><button class="go" id="share">' + T("Share", "Delen") + "</button>" +
        '<div class="row dy-row">' + (now ? '<button class="go ghost" id="again">' + T("Practice", "Oefenen") + "</button>" : "") + '<a class="go ghost" href="#spelen">Menu</a></div>' +
        '<p class="note">' + (now ? T("A new number tomorrow.", "Morgen een nieuw getal.") : T("Today’s number is ready.", "Het getal van vandaag staat klaar.")) + "</p></div>";
      const again = el.querySelector("#again"), btn = el.querySelector("#share");
      if(again) again.onclick = () => practice(k, again);
      btn.onclick = () => share(btn, text);
      fx.stagger(el.querySelector(".g-body"), ".verdict, .stats, .dy-line, #share, .dy-row, .note", 2);
      if(fresh && r.out){ D.sfx.good(); setTimeout(() => alive && fx.party(), 500); }
    }
    async function share(btn, text){
      try { if(navigator.share){ await navigator.share({ text }); return; } } catch(e){ if(e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(text); btn.textContent = T("Copied", "Gekopieerd"); fx.buzz(10); } catch(e){ btn.textContent = T("Copy the line above", "Kopieer de regel hierboven"); }
    }
    S = read();
    days(me)[today()] ? result(today()) : intro();
    return () => { alive = false; leave(); };
  }

  D.daily = { card, screen, today, dayNo, shift, number, streak, bestStreak, begin, shareLine, mode, _reload: () => { S = read(); } };
})(window.DART);
