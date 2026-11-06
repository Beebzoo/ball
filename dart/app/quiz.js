/* Quiz: ten questions, per sport.
   Darts: every right answer is a "visit": the faster, the higher (180 within 4 s, 140, 100,
   60). A wrong answer or no answer is a bust (0).
   Snooker: every right answer pots a red and a colour: the faster, the higher the colour
   (red + black = 8 within 4 s, pink 7, blue 6, brown 5). A wrong answer is a miss: no points,
   and the break starts again. Max 80; the best run is your break. */
(function(D){
  const N = 10, TIME = 15;
  const T = D.T;
  const TIERS = [["mix", ["Mix", "Mix"]], ["easy", ["Easy", "Makkelijk"]], ["medium", ["Medium", "Gemiddeld"]], ["hard", ["Hard", "Moeilijk"]]];
  const COLOUR = [[8, "black", ["Red and black", "Rood en zwart"]], [7, "pink", ["Red and pink", "Rood en roze"]], [6, "blue", ["Red and blue", "Rood en blauw"]], [5, "brown", ["Red and brown", "Rood en bruin"]]];
  const SP = {
    darts: { key: "quiz", max: 1800, back: "#spelen-oche", top: 180, load: ["Grabbing the darts…", "Pijlen pakken…"],
      pts: s => s < 4 ? 180 : s < 7 ? 140 : s < 11 ? 100 : 60,
      lead: () => T("Ten questions, " + TIME + " seconds each. Right within 4 seconds is <b>180</b>.", "Tien vragen, " + TIME + " seconden per vraag. Binnen 4 seconden goed is <b>180</b>."),
      facts: () => [["10", T("questions", "vragen")], [TIME + "s", T("per question", "per vraag")], ["180", T("right within 4 s", "goed binnen 4 s")]],
      verdict: t => t >= 1440 ? T("World champion stuff.", "Wereldkampioen-niveau.") : t >= 1000 ? T("That’s top-flight darts.", "Dat is topdarts.") : t >= 600 ? T("Nice pub darts.", "Lekker gegooid in het café.") : T("Still warming up.", "Even inwerpen nog."),
      good: 1000 },
    snooker: { key: "squiz", max: 80, back: "#spelen-tafel", top: 8, load: ["Chalking the cue…", "Keu krijten…"],
      pts: s => s < 4 ? 8 : s < 7 ? 7 : s < 11 ? 6 : 5,
      lead: () => T("Ten questions, " + TIME + " seconds each. Every right answer pots a red and a colour: within 4 seconds it’s <b>the black</b>. A wrong one ends your break.", "Tien vragen, " + TIME + " seconden per vraag. Elk goed antwoord pot een rode en een kleur: binnen 4 seconden is het <b>de zwarte</b>. Fout beëindigt je break."),
      facts: () => [["10", T("questions", "vragen")], [TIME + "s", T("per question", "per vraag")], ["80", T("ten reds and blacks", "tien rood-zwart")]],
      verdict: t => t >= 72 ? T("World-stage stuff.", "Wereldpodium-niveau.") : t >= 56 ? T("That’s a TV table.", "Dat is een tv-tafel.") : t >= 35 ? T("Nice club snooker.", "Lekker gespeeld in de club.") : T("Still chalking up.", "Nog even krijten."),
      good: 56 }
  };
  const prefs = { darts: { deck: "alles", tier: "mix" }, snooker: { deck: "alles", tier: "mix" } };

  D.quiz = function(el, sport){
    sport = sport === "snooker" ? "snooker" : "darts";
    const S = SP[sport], pref = prefs[sport], sn = sport === "snooker";
    let timer = null, alive = true;
    const stop = () => { clearInterval(timer); timer = null; };
    const deckName = d => d === "alles" ? T("Everything", "Alles") : D.esc(D.qs.name(d));

    function setup(){
      el.innerHTML = '<div class="g-top"><a class="back" href="' + S.back + '">‹ Menu</a><b>Quiz</b><span></span></div>' +
        '<div class="g-body"><p class="loading">' + T(S.load[0], S.load[1]) + '</p></div>';
      D.qs.load().then(() => alive && draw()).catch(() => { if(alive) el.querySelector(".g-body").innerHTML = '<p class="loading">' + T("The questions won’t load. Try again in a moment.", "De vragen laden niet. Probeer het zo nog eens.") + "</p>"; });
      function draw(){
        const decks = ["alles"].concat(D.qs.decks(sport));
        if(!decks.includes(pref.deck)) pref.deck = "alles";
        el.querySelector(".g-body").innerHTML =
          '<h1 class="g-h">' + (sn ? T("Snooker quiz", "Snookerquiz") : "Quiz") + '</h1><p class="lead">' + S.lead() + "</p>" +
          '<div class="facts">' + S.facts().map(f => "<div><b>" + f[0] + "</b><span>" + f[1] + "</span></div>").join("") + "</div>" +
          '<h2 class="sub-h">' + T("Topic", "Onderwerp") + '</h2><div class="chips" id="decks">' + decks.map(d => '<button data-v="' + d + '"' + (d === pref.deck ? ' class="on"' : "") + ">" + deckName(d) + "</button>").join("") + "</div>" +
          '<h2 class="sub-h">' + T("Level", "Niveau") + '</h2><div class="chips" id="tiers">' + TIERS.map(([v, l]) => '<button data-v="' + v + '"' + (v === pref.tier ? ' class="on"' : "") + ">" + T(l[0], l[1]) + "</button>").join("") + "</div>" +
          '<p class="count" id="cnt"></p><button class="go" id="go">' + (sn ? T("Break off", "Afstoten") : "Game on") + "</button>";
        const upd = () => {
          const c = D.qs.count(pref.deck, pref.tier, sport);
          el.querySelector("#cnt").textContent = T(c + " questions in this set", c + " vragen in deze bak");
          el.querySelector("#go").disabled = c < 4;
        };
        [["#decks", "deck"], ["#tiers", "tier"]].forEach(([id, k]) => el.querySelectorAll(id + " button").forEach(b => b.onclick = () => {
          pref[k] = b.dataset.v; el.querySelectorAll(id + " button").forEach(x => x.classList.toggle("on", x === b)); upd();
        }));
        el.querySelector("#go").onclick = () => play(D.qs.pick(pref.deck, pref.tier, N, sport));
        upd();
        D.fx.stagger(el.querySelector(".g-body"), null, 0);
      }
    }

    function play(list){
      let i = 0, total = 0, brk = 0, hb = 0, log = [];
      el.innerHTML = '<div class="g-top"><a class="back" href="' + S.back + '">‹ Stop</a><b id="qn"></b><span class="chalk sm" id="tot">0</span></div>' +
        '<div class="g-body quiz"><div class="pips" id="pips">' + list.map(() => "<i></i>").join("") + '</div><div class="tbar"><div class="clock" id="clk"><i id="bar"></i></div><span class="secs" id="secs"></span></div>' +
        (sn ? '<p class="q-brk" id="brk">' + T("Break", "Break") + " <b>0</b></p>" : "") +
        '<div class="qcard" id="qc"><p class="lbl" id="qd"></p><p class="q" id="q"></p></div><div class="answers" id="ans"></div>' +
        '<div class="after" id="after" hidden><p id="sub"></p><button class="go" id="nx"></button></div></div><div class="visit' + (sn ? " sn" : "") + '" id="vis"></div>';
      const $ = s => el.querySelector(s);
      function ask(){
        const q = list[i], t0 = performance.now(); let done = false;
        $("#qn").textContent = T("Question ", "Vraag ") + (i + 1) + " / " + list.length;
        $("#q").textContent = q.q;
        $("#qd").textContent = D.qs.name(q.deck);
        D.fx.bump($("#qc"), "qin");
        el.querySelectorAll("#pips i").forEach((p, j) => p.classList.toggle("cur", j === i));
        $("#after").hidden = true;
        $("#ans").innerHTML = q.opts.map((o, k) => '<button data-k="' + k + '"><i>' + "ABCD"[k] + "</i><span>" + D.esc(o) + "</span></button>").join("");
        D.fx.stagger($("#ans"), null, 1);
        const clk = $("#clk"), secs = $("#secs"); clk.classList.remove("low"); secs.className = "secs"; secs.textContent = TIME;
        const bar = $("#bar"); bar.style.transition = "none"; bar.style.transform = "scaleX(1)";
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = "transform " + TIME + "s linear"; bar.style.transform = "scaleX(0)"; }));
        const answer = k => {
          if(done) return; done = true; stop();
          const secs = (performance.now() - t0) / 1000, right = k >= 0 && q.opts[k] === q.a, pts = right ? S.pts(secs) : 0;
          total += pts; log.push({ q, pick: k >= 0 ? q.opts[k] : null, pts });
          if(pts){ brk += pts; hb = Math.max(hb, brk); } else brk = 0;
          bar.style.transition = "none"; bar.style.transform = getComputedStyle(bar).transform;
          el.querySelectorAll("#ans button").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.a) b.classList.add("right"); else if(j === k) b.classList.add("wrong"); });
          clk.classList.remove("low");
          const pip = el.querySelectorAll("#pips i")[i]; pip.className = pts === S.top ? "max" : pts ? "ok" : "no";
          if(pts){ D.fx.count($("#tot"), total, { from: total - pts, dur: 500 }); D.fx.bump($("#tot")); D.fx.buzz(10); } else D.fx.buzz([30, 40, 30]);
          if(sn){ const b = $("#brk"); b.innerHTML = T("Break", "Break") + " <b>" + brk + "</b>"; D.fx.bump(b); }
          const v = $("#vis");
          if(sn){
            const c = COLOUR.find(x => x[0] === pts);
            v.className = "visit sn show" + (pts === 8 ? " max" : pts ? "" : " bust");
            v.innerHTML = pts ? '<span class="vb"><i class="bl red"></i><i class="bl ' + c[1] + '"></i></span><b>' + pts + "</b><span>" + T(c[2][0], c[2][1]) + "</span>" : "<b>" + T("Miss", "Mis") + "</b><span>" + (k < 0 ? T("Too late", "Te laat") : T("The break is over", "De break is voorbij")) + "</span>";
            if(pts){ D.sfx.pot ? D.sfx.pot() : D.sfx.thud(); } else D.sfx.bad();
          } else {
            v.className = "visit show" + (pts === 180 ? " max" : pts ? "" : " bust");
            v.innerHTML = pts ? "<b>" + pts + "</b>" + (pts === 180 ? "<span>One hundred and eighty!</span>" : "") : "<b>Bust</b>" + (k < 0 ? "<span>" + T("Too late", "Te laat") + "</span>" : "");
            if(pts) D.sfx.thud(); else D.sfx.bad();
            if(pts === 180){ setTimeout(() => D.sfx.call("One hundred and eighty!"), 120); D.fx.sparks(v); }
          }
          if(sn && pts === 8) D.fx.sparks(v, ["#fff3c4", "#f2f2f2", "#ffc94a"]);
          setTimeout(() => { v.className = "visit" + (sn ? " sn" : ""); }, 1300);
          $("#sub").innerHTML = (right ? "" : T("Right answer: <b>", "Goed antwoord: <b>") + D.esc(q.a) + "</b>. ") + D.esc(q.sub || "");
          $("#after").hidden = false;
          $("#nx").textContent = i + 1 < list.length ? T("Next", "Volgende") : T("Result", "Uitslag");
          $("#nx").onclick = () => { i++; i < list.length ? ask() : end(); };
        };
        el.querySelectorAll("#ans button").forEach(b => b.onclick = () => answer(+b.dataset.k));
        let left = TIME;
        timer = setInterval(() => {
          left--; secs.textContent = Math.max(0, left);
          if(left <= 4){ clk.classList.add("low"); secs.className = "secs"; void secs.offsetWidth; secs.className = "secs low"; }
          if(left <= 3 && left > 0) D.sfx.tick();
          if(left <= 0) answer(-1);
        }, 1000);
      }
      function end(){
        const nb = D.store.result(S.key, total);
        D.store.result(S.key + ":" + pref.deck, total);
        if(sn) D.store.result("squizbrk", hb);
        const max = log.filter(l => l.pts === S.top).length, right = log.filter(l => l.pts).length, rec = (D.store.rec(D.store.me, S.key) || {}).best || 0;
        el.innerHTML = '<div class="g-top"><a class="back" href="' + S.back + '">‹ Menu</a><b>' + T("Result", "Uitslag") + '</b><span></span></div>' +
          '<div class="g-body end"><p class="lbl">' + D.esc(D.store.name) + " · " + deckName(pref.deck) + '</p><div class="score-hero"><p class="chalk huge" id="big">' + total + '</p><small>' + T("points out of " + S.max, "punten van de " + S.max) + "</small></div>" +
          (nb ? '<p class="nb">' + T("New record!", "Nieuw record!") + "</p>" : "") + '<p class="verdict">' + S.verdict(total) + "</p>" +
          '<div class="stats"><div><b><em data-count="' + right + '">' + right + "</em>/" + log.length + "</b><span>" + T("right", "goed") + '</span></div>' +
            (sn ? '<div><b data-count="' + hb + '">' + hb + "</b><span>" + T("highest break", "hoogste break") + "</span></div>"
              : '<div><b data-count="' + max + '">' + max + "</b><span>" + T("times 180", "keer 180") + "</span></div>") +
            '<div><b data-count="' + rec + '">' + rec + "</b><span>record</span></div></div>" +
          '<div class="review">' + log.map(l => '<div class="' + (l.pts === S.top ? "mx" : l.pts ? "ok" : "no") + '"><span>' + D.esc(l.q.q) + "</span><b>" + D.esc(l.q.a) + "</b><i>" + (l.pts || "–") + "</i></div>").join("") + "</div>" +
          '<div class="row"><button class="go" id="again">' + T("Again", "Nog een keer") + '</button><a class="go ghost" href="' + S.back + '">Menu</a></div></div>';
        el.querySelector("#again").onclick = () => play(D.qs.pick(pref.deck, pref.tier, N, sport));
        const g = el.querySelector(".g-body");
        D.fx.count(el.querySelector("#big"), total, { dur: 1300 });
        D.fx.counts(el.querySelector(".stats"), { delay: 500 });
        D.fx.stagger(g, ".verdict, .stats, .review > div, .row", 2);
        if(nb){ D.sfx.good(); setTimeout(() => alive && D.fx.party(), 700); }
        else if(total >= S.good) setTimeout(() => alive && D.fx.sparks(el.querySelector("#big")), 1200);
      }
      ask();
    }

    setup();
    return () => { alive = false; stop(); };
  };
})(window.DART);
