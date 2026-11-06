/* Match point of the day: one hard question per date, the same on every phone. Each player gets
   one shot at it (friends on one phone: pick who is playing on Me, then pass the phone): right
   wins the match, wrong and your opponent saves the match point. 20 seconds. */
(function(R){
  const TIME = 20, T = R.T;

  R.daily = function(el){
    let timer = null, alive = true;
    const date = R.qs.today(), many = R.store.players.length > 1;
    el.innerHTML = '<div class="g-top"><a class="back" href="#play">‹ Menu</a><b>' + T("Match point of the day", "Matchpoint van de dag") + "</b><span></span></div>" +
      '<div class="g-body"><p class="loading">' + T("The crowd goes quiet…", "Het publiek wordt stil…") + "</p></div>";
    const body = () => el.querySelector(".g-body");
    R.qs.load().then(() => { if(alive) start(); }).catch(() => { if(alive) body().innerHTML = '<p class="loading">' + T("The question won’t load. Try again in a moment.", "De vraag laadt niet. Probeer het zo nog eens.") + "</p>"; });

    function who(){
      if(!many) return "";
      const day = R.store.daily(date);
      return '<div class="dq-who">' + R.store.players.map((p, i) => { const v = day[i]; return '<div class="' + (v ? (v.ok ? "ok" : "no") : "") + '">' + R.av(i) + "<b>" + R.esc(p) + "</b><em>" +
        (v ? (v.ok ? T("Won it", "Gewonnen") + " · " + (v.ms / 1000).toFixed(1) + " s" : T("Saved", "Weggewerkt")) : T("Not yet", "Nog niet")) + "</em></div>"; }).join("") + "</div>";
    }
    function start(){
      const q = R.qs.daily(date), mine = R.store.daily(date)[R.store.me];
      if(!q){ body().innerHTML = '<p class="loading">' + T("No hard questions in the bank yet.", "Nog geen moeilijke vragen in de bank.") + "</p>"; return; }
      if(mine) return result(q, mine, false);
      body().innerHTML = '<h1 class="g-h">' + T("Match<br>point", "Match&shy;point") + '</h1><p class="lead">' + T("One hard question, " + TIME + " seconds. Right and you win the match. Wrong and it’s saved. <b>" + (many ? "One shot each, per day." : "One shot a day.") + "</b>", "Eén moeilijke vraag, " + TIME + " seconden. Goed en je wint de partij. Fout en hij wordt weggewerkt. <b>" + (many ? "Eén kans per persoon, per dag." : "Eén kans per dag.") + "</b>") + "</p>" +
        who() + '<button class="go shine" id="go">' + R.esc(R.store.name) + T(" to serve", " slaat op") + "</button>";
      R.fx.stagger(body(), null, 0);
      el.querySelector("#go").onclick = () => ask(q);
    }
    function ask(q){
      const t0 = performance.now(); let done = false;
      R.sfx.heart(); setTimeout(() => R.sfx.call("Match point."), 300);
      body().innerHTML = '<div class="tbar"><div class="clock" id="clk"><i id="bar"></i></div><span class="secs" id="secs">' + TIME + "</span></div>" +
        '<div class="qcard dq-card qin"><p class="lbl">' + T("Match point", "Matchpoint") + " · " + R.esc(R.qs.name(q.deck)) + '</p><p class="q">' + R.esc(q.q) + '</p></div><div class="answers" id="ans">' +
        q.opts.map((o, k) => '<button data-k="' + k + '"><i>' + "ABCD"[k] + "</i><span>" + R.esc(o) + "</span></button>").join("") + "</div>";
      R.fx.stagger(el.querySelector("#ans"), null, 1);
      const bar = el.querySelector("#bar");
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = "transform " + TIME + "s linear"; bar.style.transform = "scaleX(0)"; }));
      const answer = k => {
        if(done) return; done = true; clearInterval(timer);
        const pick = k >= 0 ? q.opts[k] : null, ok = pick === q.a, ms = Math.round(performance.now() - t0);
        const v = { ok, ms, g: R.qs.grade(q, pick) };
        R.store.setDaily(date, R.store.me, v);
        R.fb.note(q, v.g, ms);
        el.querySelectorAll("#ans button").forEach((b, j) => { b.disabled = true; if(q.opts[j] === q.a) b.classList.add("right"); else if(j === k) b.classList.add("wrong", "g" + v.g); });
        if(ok){ R.sfx.pock(1.3); R.fx.buzz([20, 40, 20]); } else { R.sfx.bad(); R.fx.buzz([30, 40, 30]); }
        setTimeout(() => alive && result(q, v, true), ok ? 900 : 1300);
      };
      el.querySelectorAll("#ans button").forEach(b => b.onclick = () => answer(+b.dataset.k));
      let left = TIME;
      timer = setInterval(() => {
        left--; const s = el.querySelector("#secs"); if(s) s.textContent = Math.max(0, left);
        if(left <= 5){ const c = el.querySelector("#clk"); if(c) c.classList.add("low"); }
        if(left <= 5 && left > 0) R.sfx.heart();
        if(left <= 0) answer(-1);
      }, 1000);
    }
    function result(q, v, fresh){
      const d = R.dailyCount(R.store.me);
      body().innerHTML = '<div class="dq-res ' + (v.ok ? "ok" : "no") + '"><b>' + (v.ok ? T("Game, set and match", "Game, set en match") : T("Saved!", "Weggewerkt!")) + "</b><span>" +
        (v.ok ? R.esc(R.store.name) + T(" wins it in ", " maakt het af in ") + (v.ms / 1000).toFixed(1) + T(" seconds.", " seconden.") : T("The opponent saves the match point. Tomorrow a new one.", "De tegenstander werkt het matchpoint weg. Morgen een nieuwe.")) + "</span>" +
        (d.streak > 1 ? '<br><span class="streak">' + d.streak + T(" days in a row", " dagen op rij") + "</span>" : "") + "</div>" +
        '<div class="qcard"><p class="lbl">' + R.esc(R.qs.name(q.deck)) + '</p><p class="q">' + R.esc(q.q) + '</p></div><div class="after"><p>' + T("Answer: <b>", "Antwoord: <b>") + R.esc(q.a) + "</b>. " + R.esc(q.sub || "") + R.fb.flag(q) + "</p></div>" +
        who() + (many ? '<p class="note">' + T("Pass the phone: pick the next player on Me and open this card again.", "Geef de telefoon door: kies op Ik de volgende speler en open deze kaart opnieuw.") + "</p>" +
        '<div class="row"><a class="go ghost" href="#me">' + T("Switch player", "Wissel speler") + '</a><a class="go" href="#play">Menu</a></div>' : '<a class="go" href="#play">Menu</a>');
      R.fx.stagger(body(), null, 0);
      if(fresh){
        if(v.ok){ R.sfx.applause(1.3); setTimeout(() => R.sfx.call("Game, set and match, " + R.store.name + "."), 500); setTimeout(() => alive && R.fx.party(), 300); }
        else R.sfx.aww();
      }
    }
    return () => { alive = false; clearInterval(timer); };
  };
})(window.RACKET);
