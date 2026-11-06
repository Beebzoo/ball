/* Quiz: ten questions, 15 seconds each. A right answer is a shot and the speed decides how
   good: an ACE within 3 seconds (100), a WINNER within 6 (75), IN within 10 (50), JUST IN after
   that (25). A wrong answer is OUT; the nearly-right option (o[0]) is called "just wide". */
(function(R){
  const N = 10, TIME = 15;
  const T = R.T;
  const TIERS = [["mix", ["Mix", "Mix"]], ["easy", ["Easy", "Makkelijk"]], ["medium", ["Medium", "Gemiddeld"]], ["hard", ["Hard", "Moeilijk"]]];
  const SHOT = s => s < 3 ? [100, "Ace", "Ace"] : s < 6 ? [75, "Winner", "Winner"] : s < 10 ? [50, "In", "In"] : [25, "Just in", "Net in"];
  let pref = { deck: "all", tier: "mix" };

  R.quiz = function(el){
    let timer = null, alive = true;
    const stop = () => { clearInterval(timer); timer = null; };

    function setup(){
      el.innerHTML = '<div class="g-top"><a class="back" href="#play">‹ Menu</a><b>Quiz</b><span></span></div>' +
        '<div class="g-body"><p class="loading">' + T("Opening a new can of balls…", "Nieuw blik ballen openen…") + "</p></div>";
      R.qs.load().then(() => alive && draw()).catch(() => { if(alive) el.querySelector(".g-body").innerHTML = '<p class="loading">' + T("The questions won’t load. Try again in a moment.", "De vragen laden niet. Probeer het zo nog eens.") + "</p>"; });
      function draw(){
        const decks = ["all"].concat(R.qs.decks);
        el.querySelector(".g-body").innerHTML =
          '<h1 class="g-h">Quiz</h1><p class="lead">' + T("Ten questions, " + TIME + " seconds each. Right within 3 seconds is an <b>ace</b>: 100 points.", "Tien vragen, " + TIME + " seconden per vraag. Binnen 3 seconden goed is een <b>ace</b>: 100 punten.") + "</p>" +
          '<div class="facts"><div><b>100</b><span>' + T("ace, within 3 s", "ace, binnen 3 s") + "</span></div><div><b>75</b><span>" + T("winner, within 6 s", "winner, binnen 6 s") + "</span></div><div><b>50</b><span>" + T("in, within 10 s", "in, binnen 10 s") + "</span></div></div>" +
          '<h2 class="sub-h">' + T("Topic", "Onderwerp") + '</h2><div class="chips" id="decks">' + decks.map(d => '<button data-v="' + d + '"' + (d === pref.deck ? ' class="on"' : "") + ">" + (d === "all" ? T("Everything", "Alles") : R.esc(R.qs.name(d))) + "</button>").join("") + "</div>" +
          '<h2 class="sub-h">' + T("Level", "Niveau") + '</h2><div class="chips" id="tiers">' + TIERS.map(([v, l]) => '<button data-v="' + v + '"' + (v === pref.tier ? ' class="on"' : "") + ">" + R.L(l) + "</button>").join("") + "</div>" +
          '<p class="count" id="cnt"></p><button class="go shine" id="go">' + T("Play", "Spelen") + "</button>";
        const upd = () => {
          const c = R.qs.count(pref.deck, pref.tier);
          el.querySelector("#cnt").textContent = T(c + " questions in this set", c + " vragen in deze set");
          el.querySelector("#go").disabled = c < 4;
        };
        [["#decks", "deck"], ["#tiers", "tier"]].forEach(([id, k]) => el.querySelectorAll(id + " button").forEach(b => b.onclick = () => {
          pref[k] = b.dataset.v; el.querySelectorAll(id + " button").forEach(x => x.classList.toggle("on", x === b)); upd();
        }));
        el.querySelector("#go").onclick = () => play(R.qs.pick(pref.deck, pref.tier, N));
        upd();
        R.fx.stagger(el.querySelector(".g-body"), null, 0);
      }
    }

    function play(list){
      let i = 0, total = 0;
      const log = [];
      el.innerHTML = '<div class="g-top"><a class="back" href="#play">‹ Stop</a><b id="qn"></b><span class="pts" id="tot">0</span></div>' +
        '<div class="g-body quiz"><div class="pips" id="pips">' + list.map(() => "<i></i>").join("") + '</div><div class="tbar"><div class="clock" id="clk"><i id="bar"></i></div><span class="secs" id="secs"></span></div>' +
        '<div class="qcard" id="qc"><p class="lbl" id="qd"></p><p class="q" id="q"></p></div><div class="answers" id="ans"></div>' +
        '<div class="after" id="after" hidden><p id="sub"></p><button class="go" id="nx"></button></div></div><div class="shot" id="shot"></div>';
      const $ = s => el.querySelector(s);
      function ask(){
        const q = list[i], t0 = performance.now(); let done = false;
        $("#qn").textContent = T("Question ", "Vraag ") + (i + 1) + " / " + list.length;
        $("#q").textContent = q.q;
        $("#qd").textContent = R.qs.name(q.deck);
        R.fx.bump($("#qc"), "qin");
        el.querySelectorAll("#pips i").forEach((p, j) => p.classList.toggle("cur", j === i));
        $("#after").hidden = true;
        $("#ans").innerHTML = q.opts.map((o, k) => '<button data-k="' + k + '"><i>' + "ABCD"[k] + "</i><span>" + R.esc(o) + "</span></button>").join("");
        R.fx.stagger($("#ans"), null, 1);
        const clk = $("#clk"), secs = $("#secs"); clk.classList.remove("low"); secs.className = "secs"; secs.textContent = TIME;
        const bar = $("#bar"); bar.style.transition = "none"; bar.style.transform = "scaleX(1)";
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = "transform " + TIME + "s linear"; bar.style.transform = "scaleX(0)"; }));
        const answer = k => {
          if(done) return; done = true; stop();
          const s = (performance.now() - t0) / 1000, pick = k >= 0 ? q.opts[k] : null, g = R.qs.grade(q, pick);
          const shot = g === 0 ? SHOT(s) : null, pts = shot ? shot[0] : 0;
          total += pts; log.push({ q, pick, pts }); R.fb.note(q, g, s * 1000);
          bar.style.transition = "none"; bar.style.transform = getComputedStyle(bar).transform;
          el.querySelectorAll("#ans button").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.a) b.classList.add("right"); else if(j === k) b.classList.add("wrong", "g" + g); });
          clk.classList.remove("low");
          el.querySelectorAll("#pips i")[i].className = pts === 100 ? "max" : pts ? "ok" : "no";
          if(pts){ R.fx.count($("#tot"), total, { from: total - pts, dur: 500 }); R.fx.bump($("#tot")); R.fx.buzz(10); } else R.fx.buzz([30, 40, 30]);
          const v = $("#shot");
          v.className = "shot show" + (pts === 100 ? " ace" : pts ? "" : " out");
          v.innerHTML = pts ? "<b>" + T(shot[1], shot[2]) + "</b><span>+" + pts + "</span>" : "<b>" + (k < 0 ? T("Too late", "Te laat") : g === 1 ? T("Just wide", "Net naast") : "Out") + "</b>";
          if(pts){ R.sfx.pock(pts === 100 ? 1.3 : 1); setTimeout(() => R.sfx.bounce(R.store.court), 160); } else R.sfx.bad();
          if(pts === 100){ setTimeout(() => R.sfx.applause(0.6), 200); R.fx.sparks(v); }
          setTimeout(() => { v.className = "shot"; }, 1200);
          $("#sub").innerHTML = (g === 0 ? "" : (g === 1 && k >= 0 ? T("Close! ", "Bijna! ") : "") + T("Right answer: <b>", "Goed antwoord: <b>") + R.esc(q.a) + "</b>. ") + R.esc(q.sub || "") + R.fb.flag(q);
          $("#after").hidden = false;
          $("#nx").textContent = i + 1 < list.length ? T("Next", "Volgende") : T("Result", "Uitslag");
          $("#nx").onclick = () => { i++; i < list.length ? ask() : end(); };
        };
        el.querySelectorAll("#ans button").forEach(b => b.onclick = () => answer(+b.dataset.k));
        let left = TIME;
        timer = setInterval(() => {
          left--; secs.textContent = Math.max(0, left);
          if(left <= 4){ clk.classList.add("low"); secs.className = "secs"; void secs.offsetWidth; secs.className = "secs low"; }
          if(left <= 3 && left > 0) R.sfx.tick();
          if(left <= 0) answer(-1);
        }, 1000);
      }
      function end(){
        const nb = R.store.result("quiz", total);
        R.store.result("quiz:" + pref.deck, total);
        const aces = log.filter(l => l.pts === 100).length, right = log.filter(l => l.pts).length;
        const verdict = total >= 850 ? T("Champion stuff.", "Kampioenswerk.") : total >= 650 ? T("Top-ten form.", "Top tien-vorm.") : total >= 400 ? T("Solid club player.", "Degelijke clubspeler.") : T("Still warming up.", "Nog aan het inslaan.");
        const rec = (R.store.rec(R.store.me, "quiz") || {}).best || 0;
        el.innerHTML = '<div class="g-top"><a class="back" href="#play">‹ Menu</a><b>' + T("Result", "Uitslag") + "</b><span></span></div>" +
          '<div class="g-body end"><p class="lbl">' + R.esc(R.store.name) + " · " + (pref.deck === "all" ? T("Everything", "Alles") : R.esc(R.qs.name(pref.deck))) + '</p><div class="score-hero"><span class="huge" id="big">' + total + "</span><small>" + T("points out of 1000", "punten van de 1000") + "</small></div>" +
          (nb ? '<p class="nb">' + T("New record!", "Nieuw record!") + "</p>" : "") + '<p class="verdict">' + verdict + "</p>" +
          '<div class="stats"><div><b><em data-count="' + right + '">' + right + "</em>/" + log.length + "</b><span>" + T("right", "goed") + '</span></div><div><b data-count="' + aces + '">' + aces + "</b><span>" + T("aces", "aces") + '</span></div><div><b data-count="' + rec + '">' + rec + "</b><span>record</span></div></div>" +
          '<div class="review">' + log.map(l => '<div class="' + (l.pts === 100 ? "mx" : l.pts ? "ok" : "no") + '"><span>' + R.esc(l.q.q) + "</span><b>" + R.esc(l.q.a) + "</b><i>" + (l.pts || "–") + "</i>" + R.fb.flag(l.q) + "</div>").join("") + "</div>" +
          '<div class="row"><button class="go" id="again">' + T("Again", "Nog een keer") + '</button><a class="go ghost" href="#play">Menu</a></div></div>';
        el.querySelector("#again").onclick = () => play(R.qs.pick(pref.deck, pref.tier, N));
        R.fx.count(el.querySelector("#big"), total, { dur: 1300 });
        R.fx.counts(el.querySelector(".stats"), { delay: 500 });
        R.fx.stagger(el.querySelector(".g-body"), ".verdict, .stats, .review > div, .row", 2);
        if(nb){ R.sfx.chime(); setTimeout(() => alive && R.fx.party(), 700); }
        else if(total >= 650) setTimeout(() => { if(alive){ R.fx.sparks(el.querySelector("#big")); R.sfx.applause(0.8); } }, 1200);
      }
      ask();
    }

    setup();
    return () => { alive = false; stop(); };
  };
})(window.RACKET);
