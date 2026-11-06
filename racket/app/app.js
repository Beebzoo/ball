/* RACKET shell: the router, the three tabs (Play, Table, Me) and shared helpers.
   First open: one screen that asks your name (hello), then Play.
   Routes: #play  #quiz  #daily  #match  #table  #me
   Every text goes through T(english, dutch); the language is set on Me (default English). */
(function(R){
  const app = document.getElementById("app"), tabs = document.getElementById("tabs");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  R.esc = esc;
  const T = R.T, fx = R.fx;
  /* a whole address, not a bare #: a bare one is read against whichever page is running the script */
  const stay = h => location.replace(location.href.split("#")[0] + h);
  R.go = h => { if(location.hash === h) route(); else if(R.EMBED) stay(h); else location.hash = h; };
  /* In BALL's frame the hash adds no history: the phone's back belongs to BALL and goes straight back to it. */
  if(R.EMBED) document.addEventListener("click", e => {
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if(a){ e.preventDefault(); stay(a.getAttribute("href")); }
  }, true);
  /* out of sight it stays loaded, so a match isn't lost, and it stays quiet */
  window.addEventListener("message", e => {
    if(e.origin !== location.origin || !e.data || !e.data.ball) return;
    R.hidden = e.data.ball === "hide";
    R.sfx.sight();
  });
  const toBall = e => { if(R.EMBED){ e.preventDefault(); parent.postMessage({ to: "ball" }, location.origin); } };

  /* a player's round badge: the first letter in their colour */
  R.av = i => '<i class="av p' + (i % 3) + '">' + esc((R.store.players[i] || "?").trim().charAt(0).toUpperCase() || "?") + "</i>";
  /* the wordmark and the way back to BALL */
  const brand = () => '<a class="mark" href="#play"><i class="ballico"></i><b>RACKET</b></a><a class="toball" href="https://ballquiz.app/" aria-label="' + T("Switch to BALL", "Naar BALL") + '"><span>BALL</span></a>';
  /* the top bar of a tab: wordmark and who is playing */
  R.top = () => '<header class="top">' + brand() +
    '<a class="who" href="#me"><span><small>' + T("On court", "Op de baan") + "</small><b>" + esc(R.store.name) + "</b></span>" + R.av(R.store.me) + "</a></header>";

  /* small flags for the fictional opponents (stripes, crosses, a disc) */
  const FLAGS = {
    NED: ["h", "#ae1c28", "#fff", "#21468b"], FRA: ["v", "#002654", "#fff", "#ed2939"], ITA: ["v", "#009246", "#fff", "#ce2b37"], AUT: ["h", "#ed2939", "#fff", "#ed2939"],
    BEL: ["v", "#111", "#fdda24", "#ef3340"], ESP: ["es"], SWE: ["x", "#006aa7", "#fecc00"], DEN: ["x", "#c8102e", "#fff"], SEN: ["sn"], CZE: ["cz"], JPN: ["jp"]
  };
  R.flag = code => {
    const f = FLAGS[code]; if(!f) return "";
    let b = "";
    if(f[0] === "h") b = '<rect width="30" height="20" fill="' + f[1] + '"/><rect y="6.67" width="30" height="6.67" fill="' + f[2] + '"/><rect y="13.33" width="30" height="6.67" fill="' + f[3] + '"/>';
    else if(f[0] === "v") b = '<rect width="10" height="20" fill="' + f[1] + '"/><rect x="10" width="10" height="20" fill="' + f[2] + '"/><rect x="20" width="10" height="20" fill="' + f[3] + '"/>';
    else if(f[0] === "x") b = '<rect width="30" height="20" fill="' + f[1] + '"/><rect x="9" width="4" height="20" fill="' + f[2] + '"/><rect y="8" width="30" height="4" fill="' + f[2] + '"/>';
    else if(f[0] === "es") b = '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>';
    else if(f[0] === "sn") b = '<rect width="10" height="20" fill="#00853f"/><rect x="10" width="10" height="20" fill="#fdef42"/><rect x="20" width="10" height="20" fill="#e31b23"/><path d="M15 6.6l1 3.1h3.2l-2.6 1.9 1 3.1-2.6-1.9-2.6 1.9 1-3.1-2.6-1.9H14z" fill="#00853f"/>';
    else if(f[0] === "cz") b = '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0l15 10L0 20z" fill="#11457e"/>';
    else if(f[0] === "jp") b = '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>';
    return '<svg class="flag" viewBox="0 0 30 20" aria-label="' + code + '">' + b + "</svg>";
  };
  /* a tennis ball (the hero, the daily card) */
  R.ballSvg = (id) => '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="bg' + id + '" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#fbffd6"/><stop offset=".42" stop-color="#e4f53c"/><stop offset="1" stop-color="#95a410"/></radialGradient>' +
    '<clipPath id="cl' + id + '"><circle cx="100" cy="100" r="96"/></clipPath><filter id="fe' + id + '"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 .8 0 0 0 .55 -.1"/></filter></defs>' +
    '<circle cx="100" cy="100" r="96" fill="url(#bg' + id + ')"/><g clip-path="url(#cl' + id + ')"><rect width="200" height="200" filter="url(#fe' + id + ')" opacity=".45"/>' +
    '<path d="M22 18C80 62 80 138 22 182M178 18C120 62 120 138 178 182" fill="none" stroke="#fffdec" stroke-width="8" stroke-linecap="round"/>' +
    '<path d="M22 18C80 62 80 138 22 182M178 18C120 62 120 138 178 182" fill="none" stroke="#0000001a" stroke-width="2" transform="translate(2 3)"/></g></svg>';

  function greet(){
    const h = new Date().getHours();
    return h < 6 ? T("Still up", "Nog wakker") : h < 12 ? T("Good morning", "Goedemorgen") : h < 18 ? T("Good afternoon", "Goedemiddag") : T("Good evening", "Goedenavond");
  }
  const ICON = {
    quiz: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7.5A3.5 3.5 0 0 1 9.5 4h13A3.5 3.5 0 0 1 26 7.5v10a3.5 3.5 0 0 1-3.5 3.5H15l-6 5v-5h0.5A3.5 3.5 0 0 1 6 17.5z"/><path d="M13.2 10.2a3 3 0 1 1 4.1 2.8c-.8.4-1.3 1-1.3 1.8v.4"/><circle cx="16" cy="18" r=".6" fill="currentColor"/></svg>',
    match: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="13" cy="12" rx="8" ry="9.5" transform="rotate(-35 13 12)"/><path d="M8 7.5l10 9M6.5 12.5l8.5 7.5M11 4.5l9 8M5.5 10l11-4M7.5 16.5l11.5-5M10.5 20l9-4"/><path d="M18.3 19.4l7.2 7.4"/><circle cx="26" cy="8" r="3.2" fill="currentColor" stroke="none"/></svg>',
    play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg>'
  };

  /* wins against the computer and friends, from the match log */
  function wins(p){
    let w = 0, n = 0, top = -1;
    for(const m of R.store.log){
      const side = m.a === p ? 0 : m.b === p ? 1 : -1; if(side < 0) continue;
      n++; if(m.w === side){ w++; if(typeof m.b === "string" && side === 0){ const o = R.rally.opp(m.b.slice(4)); top = Math.max(top, o.lvl); } }
    }
    return { w, n, top };
  }
  /* days the daily question was answered right, and the current streak */
  function dailyCount(p){
    const all = R.store.dailyAll; let ok = 0;
    for(const d in all) if(all[d][p] && all[d][p].ok) ok++;
    let streak = 0; const day = new Date();
    for(let i = 0; i < 400; i++){
      const k = day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, "0") + "-" + String(day.getDate()).padStart(2, "0");
      const v = all[k] && all[k][p];
      if(v && v.ok) streak++; else if(i > 0 || v) break;
      day.setDate(day.getDate() - 1);
    }
    return { ok, streak };
  }
  R.dailyCount = dailyCount;

  /* ---------- first open: your name, asked once (BALL's is filled in when RACKET runs in its frame) ---------- */
  function hello(el){
    const ph = T("Your name", "Je naam");
    el.innerHTML = '<header class="top">' + brand() + '</header><section class="welcome"><h1>' + T("What’s your <em>name?</em>", "Hoe <em>heet</em> je?") + '</h1><p class="tag">' + T("It goes on the scoreboard. It stays on this phone, and you can change it on Me.", "Hij komt op het scorebord. Hij blijft op deze telefoon, en je past hem aan op Ik.") + "</p></section>" +
      '<form class="hello"><input id="nm" maxlength="14" value="' + esc(R.store.ballName) + '" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off" autocapitalize="words"><button class="go">' + T("Play", "Spelen") + "</button></form>";
    fx.stagger(el, ".welcome, .hello", 0);
    /* left empty it stays "Player": asked once, never again */
    el.querySelector(".hello").onsubmit = e => {
      e.preventDefault();
      R.store.rename(0, el.querySelector("#nm").value.trim() || T("Player", "Speler"));
      R.sfx.good(); fx.buzz(10); route();
    };
  }
  /* add a friend on this phone: a name field and a button (Me, and the setup of a match). done(index) once they're in */
  R.addForm = (box, ph, done) => {
    box.innerHTML = '<form class="addp"><input maxlength="14" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" autocomplete="off" autocapitalize="words"><button>' + T("Add", "Toevoegen") + "</button></form>";
    const inp = box.querySelector("input");
    box.querySelector("form").onsubmit = e => {
      e.preventDefault();
      const i = R.store.addPlayer(inp.value);
      if(i < 0 || i === R.store.me) return inp.focus();
      R.sfx.good(); fx.buzz(10); done(i);
    };
  };

  function play(el){
    const mode = (cls, href, icon, name, txt, rec) => '<a class="mode ' + cls + '" href="' + href + '"><span class="mi">' + icon + "</span><b>" + name + '</b><span class="md">' + txt + "</span>" + rec + "<i>" + ICON.play + "</i></a>";
    const qb = R.store.rec(R.store.me, "quiz"), mw = wins(R.store.me);
    const day = R.store.daily(R.qs.today()), mine = day[R.store.me];
    el.innerHTML = R.top() +
      '<section class="hero"><div class="hero-shadow"></div><div class="hero-ball">' + R.ballSvg("h") + "</div>" +
      '<p class="hi">' + greet() + ", " + esc(R.store.name) + "</p><h1>" + T("New balls, <em>please.</em>", "Nieuwe ballen, <em>graag.</em>") + '</h1><p class="tag">' + T("The tennis quiz. Pick a game.", "De tennisquiz. Kies een spel.") + "</p></section>" +
      '<div class="modes">' +
        mode("m-quiz", "#quiz", ICON.quiz, "Quiz", T("Ten questions. Answer fast for an ace: 100 points each.", "Tien vragen. Snel antwoorden is een ace: 100 punten per vraag."),
          qb && qb.plays ? '<small class="mr best">' + T("Best ", "Record ") + qb.best + "</small>" : '<small class="mr">' + T("Not played yet", "Nog niet gespeeld") + "</small>") +
        mode("m-match", "#match", ICON.match, "Match point", T("A real match. Every answer is a shot: serve, return, rally, break point.", "Een echte partij. Elk antwoord is een slag: opslag, return, rally, breakpoint."),
          mw.n ? '<small class="mr best">' + mw.w + T(" won", " gewonnen") + " · " + mw.n + T(" played", " gespeeld") + "</small>" : '<small class="mr">' + T("Not played yet", "Nog niet gespeeld") + "</small>") +
      "</div>" +
      '<a class="dly" href="#daily"><span class="lbl">' + T("Match point of the day", "Matchpoint van de dag") + "</span><b>" + (mine ? (mine.ok ? T("Match won!", "Partij gewonnen!") : T("Saved by the opponent", "Weggewerkt door de tegenstander")) : T("One hard question. One shot.", "Eén moeilijke vraag. Eén kans.")) + "</b>" +
        (R.store.players.length > 1 ? '<span class="dly-who">' + R.store.players.map((p, i) => { const v = day[i]; return '<span class="' + (v ? (v.ok ? "ok" : "no") : "open") + '">' + R.av(i) + esc(p) + " <em>" + (v ? (v.ok ? "✓" : "✗") : "–") + "</em></span>"; }).join("") + "</span>" : "") +
        '<span class="dly-go' + (mine ? " done" : "") + '">' + (mine ? "✓" : T("Play", "Speel")) + "</span></a>";
    fx.stagger(el.querySelector(".modes"), null, 3);
    fx.stagger(el, ".dly", 6);
  }

  function table(el){
    const P = R.store.players, many = P.length > 1;
    const rows = P.map((p, i) => { const q = R.store.rec(i, "quiz"), m = wins(i), d = dailyCount(i); return { i, quiz: q ? q.best : null, w: m.n ? m.w : null, n: m.n, top: m.top, d: d.ok }; });
    const best = k => Math.max(0, ...rows.map(r => r[k] || 0));
    const LV = R.rally.LEVELS;
    const cell = (v, k, extra) => '<td' + (v && v === best(k) ? ' class="top1"' : "") + ">" + (v == null ? "–" : '<span data-count="' + v + '">' + v + "</span>" + (extra || "")) + "</td>";
    const body = rows.map(r => '<tr' + (r.i === R.store.me ? ' class="me"' : "") + '><th><span class="pl">' + R.av(r.i) + "<b>" + esc(P[r.i]) + "</b></span></th>" +
      cell(r.quiz, "quiz") + cell(r.w, "w", r.n ? "<small>/" + r.n + "</small>" : "") + cell(r.d || null, "d") +
      '<td class="lvl">' + (r.top >= 0 ? '<small>' + esc(R.L(LV[r.top])) + "</small>" : "–") + "</td></tr>").join("");
    /* friends head to head */
    const riv = [];
    for(let a = 0; a < P.length; a++) for(let b = a + 1; b < P.length; b++){
      const ms = R.store.log.filter(m => (m.a === a && m.b === b) || (m.a === b && m.b === a));
      const wa = ms.filter(m => (m.a === a) === (m.w === 0)).length, last = ms[ms.length - 1];
      riv.push('<div><div class="riv-top"><span class="riv-p">' + R.av(a) + "<b>" + esc(P[a]) + '</b></span><span class="riv-n">' + wa + "<em>–</em>" + (ms.length - wa) + '</span><span class="riv-p">' + R.av(b) + "<b>" + esc(P[b]) + "</b></span></div>" +
        "<p>" + (last ? T("Last: ", "Laatste: ") + esc(P[last.w === 0 ? last.a : last.b]) + " " + esc(last.line) : T("No match yet. Pick “A friend” in Match point.", "Nog geen partij. Kies “Een vriend” bij Matchpoint.")) + "</p></div>");
    }
    const recent = R.store.log.slice(-6).reverse().map(m => {
      const nm = x => typeof x === "string" ? R.rally.opp(x.slice(4)).name : P[x];
      const wn = m.w === 0 ? m.a : m.b, ls = m.w === 0 ? m.b : m.a;
      return '<div><i class="surf ' + m.surf + '"></i><span><b>' + esc(nm(wn)) + "</b> " + T("beat", "won van") + " " + esc(nm(ls)) + "</span><small>" + esc(m.line) + "</small></div>";
    }).join("");
    /* the topics that have questions: a deck still empty would show a row nobody can ever fill */
    const me = R.store.me, decks = R.qs.decks;
    const mine = decks.map(d => { const r = R.store.rec(me, "quiz:" + d); return "<div><span>" + R.qs.name(d) + "</span><b" + (r ? ' data-count="' + r.best + '">' + r.best : ">–") + '</b><i style="--p:' + (r ? Math.min(1, r.best / 1000).toFixed(3) : 0) + '"></i></div>'; }).join("");
    el.innerHTML = R.top() + '<h1 class="pt">' + T("Table", "Stand") + "</h1>" +
      '<p class="lead">' + (many ? T('Best scores on this phone. Pass the phone and pick who is playing on <a href="#me">Me</a>.', 'Beste scores op deze telefoon. Geef de telefoon door en kies op <a href="#me">Ik</a> wie er speelt.') : T("Your best scores on this phone.", "Je beste scores op deze telefoon.")) + "</p>" +
      '<div class="board"><table class="st"><thead><tr><th></th><th>Quiz</th><th>' + T("Matches won", "Partijen gewonnen") + "</th><th>" + T("Daily right", "Dagvraag goed") + "</th><th>" + T("Best win", "Beste zege") + "</th></tr></thead><tbody>" + body + "</tbody></table></div>" +
      '<p class="note">' + T("Quiz: max 1000 (ten aces). Best win: the strongest computer opponent you have beaten.", "Quiz: max 1000 (tien aces). Beste zege: de sterkste computertegenstander die je hebt verslagen.") + "</p>" +
      (many ? '<h2 class="sub-h">' + T("Head to head", "Onderling") + '</h2><div class="riv">' + riv.join("") + "</div>" : "") +
      (recent ? '<h2 class="sub-h">' + T("Recent matches", "Laatste partijen") + '</h2><div class="recent">' + recent + "</div>" : "") +
      (decks.length ? '<h2 class="sub-h">' + esc(R.store.name) + T(", quiz by topic", ", quiz per onderwerp") + '</h2><div class="decks-best">' + mine + "</div>" : "");
    fx.stagger(el, ".board, .note, .sub-h, .riv > div, .recent > div", 1);
    fx.stagger(el.querySelector(".decks-best"), null, 6);
    fx.counts(el, { delay: 250 });
    if(!decks.length) R.qs.load().then(() => { if(location.hash.slice(1).split("-")[0] === "table") table(el); }).catch(() => {});
  }

  function me(el){
    const P = R.store.players, lang = R.store.lang, court = R.store.court, many = P.length > 1;
    const d = dailyCount(R.store.me), mw = wins(R.store.me), fbc = R.fb.counts();
    el.innerHTML = R.top() + '<h1 class="pt">' + T("Me", "Ik") + "</h1>" +
      '<div class="facts"><div><b data-count="' + mw.w + '">' + mw.w + "</b><span>" + T("matches won", "partijen gewonnen") + '</span></div><div><b data-count="' + d.ok + '">' + d.ok + "</b><span>" + T("daily questions right", "dagvragen goed") + '</span></div><div><b data-count="' + d.streak + '">' + d.streak + "</b><span>" + T("days in a row", "dagen op rij") + "</span></div></div>" +
      (!many ? "" : '<h2 class="sub-h">' + T("Who’s playing?", "Wie speelt er?") + '</h2><div class="players">' +
      P.map((p, i) => '<button data-i="' + i + '"' + (i === R.store.me ? ' class="on"' : "") + ">" + R.av(i) + "<b>" + esc(p) + "</b><span>" + (i === R.store.me ? T("on court", "op de baan") : T("pick", "kies")) + "</span></button>").join("") +
      "</div>") + '<h2 class="sub-h">' + T("Language", "Taal") +'</h2><div class="seg" id="lang"><button data-v="en"' + (lang === "en" ? ' class="on"' : "") + '>English</button><button data-v="nl"' + (lang === "nl" ? ' class="on"' : "") + ">Nederlands</button></div>" +
      '<h2 class="sub-h">' + T("Court colour", "Kleur van de baan") + '</h2><div class="seg" id="court">' + ["hard", "clay", "grass"].map(c => '<button data-v="' + c + '"' + (c === court ? ' class="on"' : "") + '><i class="sw ' + c + '"></i>' + R.L(R.rally.SURF[c].name) + "</button>").join("") + "</div>" +
      '<h2 class="sub-h">' + (many ? T("Names", "Namen") : T("Your name", "Je naam")) + '</h2><div class="names">' +
      P.map((p, i) => "<label>" + R.av(i) + '<input data-i="' + i + '" value="' + esc(p) + '" maxlength="14" aria-label="' + T("Name player ", "Naam speler ") + (i + 1) + '"></label>').join("") +
      "</div>" + (P.length < R.store.MAX ? '<div id="addp"></div>' : "") + '<h2 class="sub-h">' + T("Settings", "Instellingen") + '</h2><label class="toggle"><input type="checkbox" id="snd"' + (R.store.sound ? " checked" : "") + "><span>" + T("Sound", "Geluid") + "</span></label>" +
      '<label class="toggle"><input type="checkbox" id="vc"' + (R.store.voice ? " checked" : "") + "><span>" + T("The umpire speaks out loud", "De scheidsrechter spreekt hardop") + "</span></label>" +
      '<button class="ghostbtn" id="utest">' + T("Test the umpire", "Test de scheidsrechter") + "<small>" + T("English, like on TV", "Engels, zoals op tv") + "</small></button>" +
      (!R.FEEDBACK ? "" : '<h2 class="sub-h">' + T("Question feedback", "Feedback op vragen") + '</h2><button class="ghostbtn" id="fbcopy">' + T("Copy for Claude", "Kopieer voor Claude") + "<small>" + fbc.reports + T(" reported", " gemeld") + " · " + fbc.answers + T(" answers", " antwoorden") + "</small></button>") +
      '<p class="note dim">RACKET</p>';
    fx.stagger(el, ".facts, .players > button, .sub-h, .seg, .names, .toggle, .ghostbtn", 1);
    fx.counts(el.querySelector(".facts"), { delay: 200 });
    const again = () => { me(el); el.querySelectorAll(".rise").forEach(x => x.classList.remove("rise")); };
    const add = el.querySelector("#addp");
    if(add) R.addForm(add, many ? T("Add another player", "Nog een speler toevoegen") : T("Add a friend", "Voeg een vriend toe"), again);
    el.querySelectorAll(".players button").forEach(b => b.onclick = () => { R.store.setMe(+b.dataset.i); R.sfx.pock(0.8); fx.buzz(10); again(); });
    el.querySelectorAll("#lang button").forEach(b => b.onclick = () => { if(b.dataset.v === R.store.lang) return; R.store.setLang(b.dataset.v); R.sfx.tick(); labels(); again(); });
    el.querySelectorAll("#court button").forEach(b => b.onclick = () => { R.store.setCourt(b.dataset.v); R.sfx.bounce(b.dataset.v); paint(); again(); });
    el.querySelectorAll(".names input").forEach(inp => inp.onchange = () => { R.store.rename(+inp.dataset.i, inp.value); again(); });
    el.querySelector("#snd").onchange = e => { R.store.setSound(e.target.checked); if(e.target.checked){ R.sfx.good(); fx.buzz(10); } else R.sfx.hush(); };
    if(R.FEEDBACK) el.querySelector("#fbcopy").onclick = e => R.fb.copy(e.currentTarget);
    /* the voice needs the sound on: asking for it turns both on */
    const voiceOn = () => {
      if(!R.store.sound){ R.store.setSound(true); el.querySelector("#snd").checked = true; }
      R.store.setVoice(true); el.querySelector("#vc").checked = true;
    };
    el.querySelector("#vc").onchange = e => { if(e.target.checked){ voiceOn(); R.sfx.call("Quiet, please."); } else { R.store.setVoice(false); R.sfx.hush(); } };
    el.querySelector("#utest").onclick = () => {
      voiceOn();
      R.sfx.unlock(); R.sfx.call("Quiet, please. " + R.store.name + " to serve."); fx.buzz(10);
    };
  }

  /* the tab bar's words, the page language and the court colour */
  function labels(){
    const L = { play: T("Play", "Spelen"), table: T("Table", "Stand"), me: T("Me", "Ik") };
    tabs.querySelectorAll("a").forEach(a => a.querySelector("span").textContent = L[a.dataset.tab]);
    document.documentElement.lang = R.store.lang;
  }
  /* the court colour; a match paints its own surface while it runs */
  const THEME = { hard: "#1a4f9e", clay: "#b0532d", grass: "#2f7431" };
  function paint(surf){
    const c = surf || R.store.court;
    document.body.dataset.court = c;
    const m = document.querySelector('meta[name="theme-color"]'); if(m) m.content = THEME[c];
  }
  R.paint = paint;

  const SCREENS = { play, table, me, quiz: el => R.quiz(el), daily: el => R.daily(el), match: el => R.match(el) };
  const DEPTH = { play: 0, table: 1, me: 2, quiz: 3, daily: 3, match: 3 };
  let cleanup = null, last = null;
  function route(){
    const raw = location.hash.slice(1).split("-")[0] || "play", name = R.store.needsName ? "hello" : SCREENS[raw] ? raw : "play", fn = name === "hello" ? hello : SCREENS[name];
    if(cleanup){ try { cleanup(); } catch(e){} cleanup = null; }
    const game = name === "quiz" || name === "daily" || name === "match" || name === "hello";
    document.body.classList.toggle("in-game", game);
    paint();
    tabs.querySelectorAll("a").forEach(a => a.classList.toggle("on", a.dataset.tab === name));
    const ti = { play: 0, table: 1, me: 2 }[name];
    if(ti != null) tabs.style.setProperty("--t", ti);
    const dir = last == null || last === name ? "n" : DEPTH[name] > DEPTH[last] ? "f" : DEPTH[name] < DEPTH[last] ? "b" : "n";
    app.className = "screen s-" + name;
    app.innerHTML = "";
    void app.offsetWidth;
    app.classList.add("enter-" + dir);
    last = name;
    cleanup = fn(app) || null;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  /* the daily card needs the bank (for nothing but the date); load it early */
  R.qs.load().catch(() => {});
  app.addEventListener("click", e => { if(e.target.closest && e.target.closest(".toball")) toBall(e); });
  labels();
  route();
})(window.RACKET);
