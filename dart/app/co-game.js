/* Checkout: a score appears, you throw it out with three darts on the keypad, ending on
   a double. Fewest darts possible = 3 points, out with an extra dart = 2. On Hard
   some scores can't be finished (159, 162, 163, 165, 166, 168, 169): tap "No out".
   Modes: ten scores ("co10") or as many points as you can in 60 seconds ("coklok"). */
(function(D){
  const T = D.T;
  const LEVELS = { easy: [["Easy", "Makkelijk"], 2, 60], medium: [["Medium", "Gemiddeld"], 61, 110], hard: [["Hard", "Moeilijk"], 100, 170] };
  const lvName = k => T(LEVELS[k][0][0], LEVELS[k][0][1]);
  let pref = { level: "medium", mode: "co10" };

  function next(level, last){
    const [, lo, hi] = LEVELS[level];
    if(level === "hard" && Math.random() < 0.15){ const b = D.co.BOGEY[Math.random() * D.co.BOGEY.length | 0]; if(b !== last) return b; }
    let n; do n = lo + Math.floor(Math.random() * (hi - lo + 1)); while(!D.co.possible(n) || n === last);
    return n;
  }

  D.checkout = function(el){
    let tick = null, alive = true;
    const stop = () => { clearInterval(tick); tick = null; };

    function setup(){
      el.innerHTML = '<div class="g-top"><a class="back" href="#spelen">‹ Menu</a><b>Checkout</b><span></span></div>' +
        '<div class="g-body"><h1 class="g-h">Checkout</h1><p class="lead">' + T("Check out the exact score, the last dart on a double (the bull counts as a double). In the fewest darts possible is <b>3 points</b>.", "Gooi de score precies uit, de laatste pijl op een dubbel (de bull telt als dubbel). In zo min mogelijk pijlen is <b>3 punten</b>.") + "</p>" +
        '<div class="facts"><div><b>3</b><span>' + T("darts per score", "pijlen per score") + "</span></div><div><b>D</b><span>" + T("last dart on a double", "laatste pijl op een dubbel") + "</span></div><div><b>+3</b><span>" + T("in the fewest darts", "in de minste pijlen") + "</span></div></div>" +
        '<h2 class="sub-h">' + T("Level", "Niveau") + '</h2><div class="chips" id="lv">' + Object.entries(LEVELS).map(([k, [, lo, hi]]) => '<button data-v="' + k + '"' + (k === pref.level ? ' class="on"' : "") + ">" + lvName(k) + "<small>" + lo + "–" + hi + "</small></button>").join("") + "</div>" +
        '<h2 class="sub-h">' + T("Game", "Spel") + '</h2><div class="chips" id="md"><button data-v="co10"' + (pref.mode === "co10" ? ' class="on"' : "") + ">" + T("Ten scores<small>no rush, with tips</small>", "Tien stuks<small>rustig, met uitleg</small>") + '</button><button data-v="coklok"' + (pref.mode === "coklok" ? ' class="on"' : "") + ">" + T("Against the clock<small>60 seconds</small>", "Tegen de klok<small>60 seconden</small>") + "</button></div>" +
        '<button class="go" id="go">Game on</button></div>';
      [["#lv", "level"], ["#md", "mode"]].forEach(([id, k]) => el.querySelectorAll(id + " button").forEach(b => b.onclick = () => {
        pref[k] = b.dataset.v; el.querySelectorAll(id + " button").forEach(x => x.classList.toggle("on", x === b));
      }));
      el.querySelector("#go").onclick = play;
      D.fx.stagger(el.querySelector(".g-body"), null, 0);
    }

    function play(){
      const klok = pref.mode === "coklok";
      let score = 0, count = 0, n = 0, darts = [], mult = 1, busy = false, left = 60, log = [];
      el.innerHTML = '<div class="g-top"><a class="back" href="#spelen">‹ Stop</a><b id="prog"></b><span class="chalk sm" id="pts">0</span></div>' +
        '<div class="g-body co">' + (klok ? '<div class="tbar"><div class="clock" id="clk"><i id="bar"></i></div><span class="secs" id="secs">60</span></div>' : "") +
        '<div class="co-stage"><div class="co-board">' + D.board.svg() + '</div><div class="co-num"><span class="lbl">' + T("Left", "Nog") + '</span><b class="chalk" id="num"></b><div class="slots" id="slots"></div></div></div>' +
        '<p class="co-msg" id="msg"></p>' +
        '<div class="pad" id="pad"><div class="mult"><button data-m="1" class="on">Single</button><button data-m="2">' + T("Double", "Dubbel") + '</button><button data-m="3">' + T("Treble", "Triple") + '</button></div>' +
        '<div class="nums">' + Array.from({ length: 20 }, (_, i) => '<button data-n="' + (i + 1) + '">' + (i + 1) + "</button>").join("") + "</div>" +
        '<div class="extra"><button data-b="25">25</button><button data-b="50">Bull</button><button data-x="miss">' + T("Miss", "Mis") + '</button><button data-x="undo">⌫</button><button data-x="cant" class="cant">' + T("No out", "Kan niet") + '</button></div></div>' +
        '<div class="after" id="after" hidden><button class="go" id="nx"></button></div></div><div class="visit" id="vis"></div>';
      const $ = s => el.querySelector(s), svg = el.querySelector(".board");
      const setMult = m => { mult = m; el.querySelectorAll(".mult button").forEach(b => b.classList.toggle("on", +b.dataset.m === m)); };

      let shown = 0;
      function show(){
        const st = D.co.play(n, darts), num = $("#num"), was = parseInt(num.textContent, 10), now = st.state === "out" ? 0 : st.left;
        if(darts.length > shown && !isNaN(was) && was !== now){ D.fx.count(num, now, { from: was, dur: 280 }); } else num.textContent = now;
        num.classList.toggle("zero", st.state === "out");
        $("#slots").innerHTML = [0, 1, 2].map(i => '<span class="' + (darts[i] ? "used" + (i < shown ? " old" : "") : "") + '">' + (darts[i] ? D.co.label(darts[i]) : "") + "</span>").join("");
        shown = darts.length;
        $("#prog").textContent = klok ? T(count + " thrown", count + " gegooid") : "Score " + Math.min(count + 1, 10) + " / 10";
        el.querySelector('[data-x="cant"]').disabled = darts.length > 0 || busy;
        el.querySelector('[data-x="undo"]').disabled = !darts.length || busy;
      }
      function deal(){
        n = next(pref.level, n); darts = []; busy = false; setMult(1);
        D.board.clear(svg); $("#msg").textContent = ""; $("#msg").className = "co-msg";
        $("#after").hidden = true; $("#pad").classList.remove("off");
        const num = $("#num"); shown = 0; num.textContent = ""; num.classList.remove("deal"); void num.offsetWidth; num.classList.add("deal");
        show();
      }
      function finish(pts, text, good){
        busy = true; score += pts; count++;
        log.push({ n, darts: darts.map(D.co.label).join(" "), pts });
        if(pts){ D.fx.count($("#pts"), score, { from: score - pts, dur: 400 }); D.fx.bump($("#pts")); }
        const m = $("#msg"); m.innerHTML = text; m.className = "co-msg " + (good ? "good" : "bad");
        const v = $("#vis"); v.className = "visit show" + (good ? "" : " bust"); v.innerHTML = good ? "<b>+" + pts + "</b>" : "<b>" + (pts ? "+" + pts : T("Miss", "Mis")) + "</b>";
        setTimeout(() => { v.className = "visit"; }, 900);
        good ? D.sfx.good() : D.sfx.bad();
        D.fx.buzz(good ? 14 : [30, 40, 30]);
        if(good && pts === 3) D.fx.sparks($("#num"), n >= 100 ? null : ["#6ff0ae", "#fbf5e6", "#ffc94a"]);
        if(good && n === 170) D.sfx.call("Game shot! The big fish!");
        $("#pad").classList.add("off"); show();
        if(klok){ setTimeout(() => alive && left > 0 && deal(), good ? 700 : 1500); return; }
        if(count >= 10){ $("#nx").textContent = T("Result", "Uitslag"); $("#nx").onclick = end; } else { $("#nx").textContent = T("Next", "Volgende"); $("#nx").onclick = deal; }
        $("#after").hidden = false;
      }
      const how = () => T("Like this: <b>", "Zo kan het: <b>") + D.co.route(n).map(D.co.label).join(" · ") + "</b>";
      function throwDart(d){
        if(busy || darts.length >= 3) return;
        darts.push(d); D.board.mark(svg, d, darts.length); D.sfx.thud(); D.fx.buzz(8); setMult(1);
        const st = D.co.play(n, darts);
        if(!D.co.possible(n)) return finish(0, T(n + " can\u2019t be done in three darts. It\u2019s a <b>bogey</b> number.", n + " kan niet in drie pijlen. Dat is een <b>bogey</b>-nummer."), false);
        if(st.state === "out"){
          const min = D.co.minDarts(n), extra = darts.length > min;
          return finish(extra ? 2 : 3, extra ? T("Out! But it could be done in " + min + (min === 1 ? " dart" : " darts"), "Uit! Maar het kon in " + min + (min === 1 ? " pijl" : " pijlen")) + ". " + how() : T("Out in " + darts.length + "! ", "Uit in " + darts.length + "! ") + (darts.length === 3 ? "Game shot." : T("Lovely.", "Strak.")), true);
        }
        if(st.state === "bust"){
          const why = n - darts.slice(0, -1).reduce((a, x) => a + D.co.val(x), 0) - D.co.val(d);
          return finish(0, "Bust! " + (why < 0 ? T("Too much. ", "Te veel gegooid. ") : why === 1 ? T("That leaves 1, which can\u2019t be finished. ", "Je houdt 1 over, dat kan niet. ") : T("You didn\u2019t finish on a double. ", "Niet op een dubbel geëindigd. ")) + how(), false);
        }
        if(darts.length === 3) return finish(0, T(st.left + " left. ", "Nog " + st.left + " over. ") + how(), false);
        show();
      }
      el.querySelector("#pad").addEventListener("pointerdown", e => { const b = e.target.closest("button"); if(b && !b.disabled) D.fx.bump(b, "hit"); });
      el.querySelectorAll(".mult button").forEach(b => b.onclick = () => setMult(+b.dataset.m));
      el.querySelectorAll(".nums button").forEach(b => b.onclick = () => throwDart({ m: mult, n: +b.dataset.n }));
      el.querySelectorAll("[data-b]").forEach(b => b.onclick = () => throwDart({ m: b.dataset.b === "50" ? 2 : 1, n: 25 }));
      el.querySelector('[data-x="miss"]').onclick = () => throwDart({ m: 1, n: 0 });
      el.querySelector('[data-x="undo"]').onclick = () => {
        if(busy || !darts.length) return; darts.pop();
        const g = svg.querySelector(".darts"); if(g.lastChild) g.removeChild(g.lastChild); show();
      };
      el.querySelector('[data-x="cant"]').onclick = () => {
        if(busy || darts.length) return;
        D.co.possible(n) ? finish(0, T("It can be done! ", "Het kan wel! ") + how(), false) : finish(3, T("Right, " + n + " is a bogey number: no three-dart checkout.", "Klopt, " + n + " is een bogey-nummer: niet uit te gooien in drie pijlen."), true);
      };

      function end(){
        stop();
        const key = pref.mode, nb = D.store.result(key, score);
        const perfect = log.filter(l => l.pts === 3).length;
        el.innerHTML = '<div class="g-top"><a class="back" href="#spelen">‹ Menu</a><b>' + T("Result", "Uitslag") + '</b><span></span></div>' +
          '<div class="g-body end"><p class="lbl">' + D.esc(D.store.name) + " · " + lvName(pref.level) + '</p><div class="score-hero"><p class="chalk huge" id="big">' + score + "</p><small>" + (pref.mode === "coklok" ? T("points in 60 seconds", "punten in 60 seconden") : T("points out of 30", "punten van de 30")) + "</small></div>" +
          (nb ? '<p class="nb">' + T("New record!", "Nieuw record!") + "</p>" : "") +
          '<div class="stats"><div><b data-count="' + log.length + '">' + log.length + "</b><span>" + T("thrown", "gegooid") + '</span></div><div><b data-count="' + perfect + '">' + perfect + '</b><span>perfect</span></div><div><b data-count="' + ((D.store.rec(D.store.me, key) || {}).best || 0) + '">' + ((D.store.rec(D.store.me, key) || {}).best || 0) + "</b><span>record</span></div></div>" +
          '<div class="review co-rev">' + log.map(l => '<div class="' + (l.pts ? "ok" : "no") + '"><span class="chalk">' + l.n + "</span><b>" + (l.darts || (l.pts ? T("No out ✓", "Kan niet ✓") : T("No out ✗", "Kan niet ✗"))) + "</b><i>" + (D.co.possible(l.n) ? D.co.route(l.n).map(D.co.label).join(" ") : "bogey") + "</i></div>").join("") + "</div>" +
          '<div class="row"><button class="go" id="again">' + T("Again", "Nog een keer") + '</button><a class="go ghost" href="#spelen">Menu</a></div></div>';
        el.querySelector("#again").onclick = play;
        D.fx.count(el.querySelector("#big"), score, { dur: 1100 });
        D.fx.counts(el.querySelector(".stats"), { delay: 450 });
        D.fx.stagger(el.querySelector(".g-body"), ".stats, .review > div, .row", 2);
        if(nb){ D.sfx.good(); setTimeout(() => alive && D.fx.party(), 650); }
      }
      deal();
      if(klok){
        const bar = $("#bar"); requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = "transform 60s linear"; bar.style.transform = "scaleX(0)"; }));
        const secs = $("#secs");
        tick = setInterval(() => {
          left--; secs.textContent = Math.max(0, left);
          if(left <= 10){ $("#clk").classList.add("low"); secs.className = "secs"; void secs.offsetWidth; secs.className = "secs low"; }
          if(left <= 5 && left > 0) D.sfx.tick();
          if(left <= 0){ busy = true; end(); }
        }, 1000);
      }
    }

    setup();
    return () => { alive = false; stop(); };
  };
})(window.DART);
