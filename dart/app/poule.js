/* The World Championship predictor (poule): darts and snooker, for the players on one phone.
   Parked (D.POULE, store.js) until it runs on BALL's server with the draw filled in. Local for now; the data is plain tables shaped like the
   shared engine's pl_* tables (football-quiz-4/_plans/call-it.md §8), so it can move to
   Supabase (dart_ tables) later without changing shape:
     comps:    { id, app: "chalk", sport, name, size (16 | 32), rules: { pts: [per round], champ },
                 players: [names in draw order], created }
     fixtures: { id, comp, round (0 = the first), slot, a, b (names or null), winner (a name or null), settled_at }
     calls:    { comp, fixture (a fixture id, or "champion"), user (player index), pick (a name), saved_at }
   One call per user per fixture. A call can change until that match's result is in; results
   are entered by hand, one tap per match (undo while the next round hasn't been played). The
   champion call locks with the first result. Points: 1 a match in the early rounds, 2 a
   quarter-final, 3 a semi-final, 5 the final, 10 the champion.
   D.pouleData: the data functions (also used by _tests/poule-test.js). D.poule(el, id): the screens. */
(function(D){
  const KEY = "dart.poule.v1";
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const blank = () => ({ v: 1, comps: [], fixtures: [], calls: [] });
  const ROUNDS = { 16: [["Last 16", "Laatste 16"], ["Quarter-finals", "Kwartfinales"], ["Semi-finals", "Halve finales"], ["Final", "Finale"]],
    32: [["Last 32", "Laatste 32"], ["Last 16", "Laatste 16"], ["Quarter-finals", "Kwartfinales"], ["Semi-finals", "Halve finales"], ["Final", "Finale"]] };
  const ptsFor = size => size === 32 ? [1, 1, 2, 3, 5] : [1, 2, 3, 5];

  /* ---------- the data ---------- */
  function create(S, o){
    const size = o.size === 32 ? 32 : 16, players = (o.players || []).slice(0, size);
    while(players.length < size) players.push("Player " + (players.length + 1));
    const comp = { id: uid(), app: "chalk", sport: o.sport === "snooker" ? "snooker" : "darts", name: String(o.name || "World Championship").slice(0, 60), size,
      rules: { pts: ptsFor(size), champ: 10 }, players, created: o.now || Date.now() };
    S.comps.push(comp);
    const R = Math.log2(size);
    for(let r = 0; r < R; r++) for(let k = 0; k < size >> (r + 1); k++)
      S.fixtures.push({ id: comp.id + "-" + r + "-" + k, comp: comp.id, round: r, slot: k, a: r ? null : players[2 * k], b: r ? null : players[2 * k + 1], winner: null, settled_at: null });
    return comp;
  }
  const comp = (S, id) => S.comps.find(c => c.id === id) || null;
  const fixturesOf = (S, id) => S.fixtures.filter(f => f.comp === id).sort((x, y) => x.round - y.round || x.slot - y.slot);
  const fx = (S, id) => S.fixtures.find(f => f.id === id) || null;
  /* the next round's names follow the results */
  function feed(S, cid){
    const all = fixturesOf(S, cid);
    all.filter(f => f.round > 0).forEach(f => {
      const a = all.find(x => x.round === f.round - 1 && x.slot === 2 * f.slot), b = all.find(x => x.round === f.round - 1 && x.slot === 2 * f.slot + 1);
      const na = a && a.winner || null, nb = b && b.winner || null;
      if(f.a !== na || f.b !== nb){ f.a = na; f.b = nb; if(f.winner && f.winner !== na && f.winner !== nb){ f.winner = null; f.settled_at = null; } }
    });
  }
  const open = f => !!(f && f.a && f.b && !f.winner);
  const started = (S, cid) => S.fixtures.some(f => f.comp === cid && f.winner);
  /* one call per user per fixture (changing it replaces it) */
  function call(S, cid, fid, user, pick, now){
    const f = fx(S, fid); if(!open(f) || f.comp !== cid || (pick !== f.a && pick !== f.b)) return false;
    upsert(S, cid, fid, user, pick, now); return true;
  }
  function callChampion(S, cid, user, name, now){
    const c = comp(S, cid); if(!c || started(S, cid) || !c.players.includes(name)) return false;
    upsert(S, cid, "champion", user, name, now); return true;
  }
  function upsert(S, cid, fid, user, pick, now){
    const old = S.calls.find(x => x.comp === cid && x.fixture === fid && x.user === user);
    if(old){ old.pick = pick; old.saved_at = now || Date.now(); }
    else S.calls.push({ comp: cid, fixture: fid, user, pick, saved_at: now || Date.now() });
  }
  const callOf = (S, cid, fid, user) => (S.calls.find(x => x.comp === cid && x.fixture === fid && x.user === user) || {}).pick || null;
  /* the result: one tap */
  function settle(S, cid, fid, winner, now){
    const f = fx(S, fid); if(!f || f.comp !== cid || !f.a || !f.b || (winner !== f.a && winner !== f.b)) return false;
    f.winner = winner; f.settled_at = now || Date.now(); feed(S, cid); return true;
  }
  /* undo a result while the match it feeds hasn't been played */
  function canUndo(S, cid, fid){
    const f = fx(S, fid); if(!f || !f.winner) return false;
    const next = fixturesOf(S, cid).find(x => x.round === f.round + 1 && x.slot === f.slot >> 1);
    return !next || !next.winner;
  }
  function undo(S, cid, fid){ if(!canUndo(S, cid, fid)) return false; const f = fx(S, fid); f.winner = null; f.settled_at = null; feed(S, cid); return true; }
  const champion = (S, cid) => { const c = comp(S, cid); if(!c) return null; const fin = fixturesOf(S, cid).find(f => f.round === Math.log2(c.size) - 1); return fin && fin.winner || null; };
  /* the table: points per user. users: the player indexes to show */
  function score(S, cid, users){
    const c = comp(S, cid); if(!c) return [];
    const champ = champion(S, cid), fs = fixturesOf(S, cid);
    return users.map(u => {
      const r = { user: u, pts: 0, right: 0, played: 0, rounds: c.rules.pts.map(() => 0), champ: callOf(S, cid, "champion", u), champOk: false };
      fs.forEach(f => {
        if(!f.winner) return;
        const p = callOf(S, cid, f.id, u); if(!p) return;
        r.played++;
        if(p === f.winner){ r.right++; r.pts += c.rules.pts[f.round]; r.rounds[f.round] += c.rules.pts[f.round]; }
      });
      if(champ && r.champ === champ){ r.champOk = true; r.pts += c.rules.champ; }
      return r;
    }).sort((x, y) => y.pts - x.pts || y.right - x.right || x.user - y.user);
  }
  function del(S, cid){ S.comps = S.comps.filter(c => c.id !== cid); S.fixtures = S.fixtures.filter(f => f.comp !== cid); S.calls = S.calls.filter(x => x.comp !== cid); }
  function rename(S, cid, i, name){
    const c = comp(S, cid); if(!c || started(S, cid)) return false;
    const old = c.players[i], nw = String(name || "").trim().slice(0, 40); if(!nw || c.players.includes(nw)) return false;
    c.players[i] = nw;
    S.fixtures.forEach(f => { if(f.comp !== cid) return; if(f.a === old) f.a = nw; if(f.b === old) f.b = nw; });
    S.calls.forEach(x => { if(x.comp === cid && x.pick === old) x.pick = nw; });
    return true;
  }
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && Array.isArray(s.comps) ? s : blank(); } catch(e){ return blank(); } };
  const save = S => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} };
  D.pouleData = { KEY, ROUNDS, ptsFor, blank, create, comp, fixturesOf, feed, open, started, call, callChampion, callOf, settle, canUndo, undo, champion, score, del, rename, load, save };

  /* ---------- the screens ---------- */
  if(typeof document === "undefined") return;
  const T = (en, nl) => D.T(en, nl), L = a => T(a[0], a[1]), esc = s => D.esc(s), PD = D.pouleData;

  D.poule = function(el, id){
    let S = PD.load(), view = "picks";
    const users = () => D.store.players.map((p, i) => i);
    const commit = () => PD.save(S);
    if(id === "new") return creator();
    if(id && PD.comp(S, id)) return show(id);
    return list();

    function list(){
      const room = D.store.room;
      const cards = S.comps.slice().reverse().map(c => {
        const fs = PD.fixturesOf(S, c.id), done = fs.filter(f => f.winner).length, champ = PD.champion(S, c.id);
        const top = PD.score(S, c.id, users())[0];
        return '<a class="pl-comp s-' + c.sport + '" href="#poule-' + c.id + '"><span class="pl-sp">' + (c.sport === "snooker" ? T("Snooker", "Snooker") : "Darts") + "</span><b>" + esc(c.name) + "</b><small>" +
          (champ ? T("Champion: ", "Kampioen: ") + esc(champ) : done + "/" + fs.length + T(" matches played", " wedstrijden gespeeld")) +
          (top && top.pts ? " · " + esc(D.store.players[top.user]) + T(" leads with ", " staat bovenaan met ") + top.pts : "") + "</small><i>›</i></a>";
      }).join("");
      el.innerHTML = '<div class="g-top"><a class="back" href="#spelen">‹ Menu</a><b>' + T("Predictor", "Poule") + '</b><span></span></div><div class="g-body">' +
        '<h1 class="g-h">' + T("World Championship predictor", "WK-poule") + '</h1><p class="lead">' +
        T("Pick the winner of every match from the last 16 (or 32), and the champion before it starts. Results go in by hand, one tap per match. Points: 1 a match, 2 a quarter-final, 3 a semi, 5 the final, 10 for the champion.",
          "Voorspel de winnaar van elke wedstrijd vanaf de laatste 16 (of 32), en de kampioen voordat het begint. Uitslagen voer je zelf in, één tik per wedstrijd. Punten: 1 per wedstrijd, 2 voor een kwartfinale, 3 een halve, 5 de finale, 10 voor de kampioen.") + "</p>" +
        (cards ? '<div class="pl-comps">' + cards + "</div>" : '<p class="note">' + T("No predictor yet. The darts World Championship starts mid-December; the last 16 is known after Christmas.", "Nog geen poule. Het WK darts begint half december; de laatste 16 is na Kerst bekend.") + "</p>") +
        '<a class="go" href="#poule-new">' + T("New predictor", "Nieuwe poule") + "</a>" +
        '<p class="note dim">' + T("On this phone for now.", "Voorlopig op deze telefoon.") + "</p></div>";
      D.fx.stagger(el.querySelector(".g-body"), null, 0);
    }

    function creator(){
      const room = D.store.room, y = new Date().getFullYear(), m = new Date().getMonth();
      const st = { sport: room === "tafel" ? "snooker" : "darts", size: 16 };
      const defName = sp => sp === "darts" ? T("Darts World Championship ", "WK darts ") + (m >= 6 ? y + "/" + String(y + 1).slice(2) : (y - 1) + "/" + String(y).slice(2)) : T("Snooker World Championship ", "WK snooker ") + (m >= 5 ? y + 1 : y);
      el.innerHTML = '<div class="g-top"><a class="back" href="#poule">‹ ' + T("Predictor", "Poule") + '</a><b>' + T("New", "Nieuw") + '</b><span></span></div><div class="g-body pl-new">' +
        '<h1 class="g-h">' + T("New predictor", "Nieuwe poule") + "</h1>" +
        (D.SNOOKER ? '<h2 class="sub-h">' + T("Sport", "Sport") + "</h2>" : "") + '<div class="chips seg" id="sp"' + (D.SNOOKER ? "" : ' style="display:none"') + '><button data-v="darts">Darts</button><button data-v="snooker">Snooker</button></div>' +
        '<h2 class="sub-h">' + T("From", "Vanaf") + '</h2><div class="chips" id="sz"><button data-v="16">' + T("The last 16<small>15 matches</small>", "De laatste 16<small>15 wedstrijden</small>") + '</button><button data-v="32">' + T("The last 32<small>31 matches</small>", "De laatste 32<small>31 wedstrijden</small>") + "</button></div>" +
        '<h2 class="sub-h">' + T("Name", "Naam") + '</h2><input class="pl-in" id="nm" maxlength="60">' +
        '<h2 class="sub-h">' + T("The players, in draw order", "De spelers, in volgorde van het schema") + '</h2><p class="note">' + T("One name per line, from the top of the draw: 1 plays 2, 3 plays 4 and so on. Paste the list if you have it.", "Eén naam per regel, van boven in het schema: 1 speelt tegen 2, 3 tegen 4 enzovoort. Plak de lijst als je hem hebt.") + "</p>" +
        '<textarea class="pl-ta" id="ta" rows="12" spellcheck="false"></textarea><p class="count" id="cnt"></p>' +
        '<button class="go" id="mk">' + T("Make the draw", "Schema maken") + "</button></div>";
      const $ = s => el.querySelector(s);
      const upd = () => {
        el.querySelectorAll("#sp button").forEach(b => b.classList.toggle("on", b.dataset.v === st.sport));
        $("#sp").classList.toggle("r", st.sport === "snooker");
        el.querySelectorAll("#sz button").forEach(b => b.classList.toggle("on", +b.dataset.v === st.size));
        const names = lines();
        $("#cnt").textContent = names.length + " / " + st.size + (names.length && names.length !== st.size ? T(" · the rest are filled in as Player n", " · de rest wordt Speler n") : "");
        $("#mk").disabled = names.length > st.size || new Set(names).size !== names.length;
        if(new Set(names).size !== names.length) $("#cnt").textContent += T(" · a name appears twice", " · een naam staat er twee keer");
      };
      const lines = () => $("#ta").value.split(/\r?\n/).map(s => s.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
      $("#nm").value = defName(st.sport);
      el.querySelectorAll("#sp button").forEach(b => b.onclick = () => { const was = defName(st.sport); st.sport = b.dataset.v; if($("#nm").value === was) $("#nm").value = defName(st.sport); D.sfx.tick(); upd(); });
      el.querySelectorAll("#sz button").forEach(b => b.onclick = () => { st.size = +b.dataset.v; upd(); });
      $("#ta").oninput = upd;
      $("#mk").onclick = () => {
        const c = PD.create(S, { sport: st.sport, size: st.size, name: $("#nm").value.trim() || defName(st.sport), players: lines() });
        commit(); D.sfx.good(); D.go("#poule-" + c.id);
      };
      upd();
    }

    function show(cid){
      const c = PD.comp(S, cid), me = D.store.me, P = D.store.players, R = PD.ROUNDS[c.size];
      const fs = PD.fixturesOf(S, cid), started = PD.started(S, cid), champ = PD.champion(S, cid);
      const tab = (v, n) => '<button data-v="' + v + '"' + (view === v ? ' class="on"' : "") + ">" + n + "</button>";
      let body = "";
      if(view === "picks"){
        const myChamp = PD.callOf(S, cid, "champion", me);
        body = (P.length < 2 ? "" : '<div class="chips pl-who">' + P.map((p, i) => '<button data-u="' + i + '"' + (i === me ? ' class="on"' : "") + ">" + D.av(i) + "<span>" + esc(p) + "</span></button>").join("") + "</div>") +
          '<h2 class="sub-h">' + T("Champion", "Kampioen") + (started ? T(" · locked", " · vast") : "") + "</h2>" +
          (started ? '<p class="pl-champ">' + (myChamp ? esc(myChamp) + (champ ? (champ === myChamp ? ' <em class="ok">+' + c.rules.champ + "</em>" : ' <em class="no">✗</em>') : "") : T("No champion picked", "Geen kampioen gekozen")) + "</p>"
            : '<select class="pl-in" id="champ"><option value="">' + T("Pick your champion…", "Kies je kampioen…") + "</option>" + c.players.map(n => '<option' + (n === myChamp ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select>") +
          R.map((rn, r) => {
            const list = fs.filter(f => f.round === r); if(!list.some(f => f.a || f.b)) return "";
            return '<h2 class="sub-h">' + L(rn) + ' <small class="pl-pts">' + c.rules.pts[r] + T(" pt", " pt") + "</small></h2>" + '<div class="pl-fx">' + list.map(f => {
              const pick = PD.callOf(S, cid, f.id, me), others = P.map((p, i) => i).filter(i => i !== me && PD.callOf(S, cid, f.id, i));
              const side = n => {
                if(!n) return '<span class="pl-side tbd">' + T("to come", "volgt") + "</span>";
                const cls = (pick === n ? " pick" : "") + (f.winner === n ? " won" : f.winner ? " lost" : "");
                return '<button class="pl-side' + cls + '" data-f="' + f.id + '" data-n="' + esc(n) + '"' + (PD.open(f) ? "" : " disabled") + ">" + esc(n) + (f.winner && pick === n ? (f.winner === n ? ' <em class="ok">+' + c.rules.pts[f.round] + "</em>" : "") : "") + "</button>";
              };
              const tag = f.winner ? (pick ? (pick === f.winner ? '<i class="ok">✓</i>' : '<i class="no">✗</i>') : '<i class="dim">–</i>') : pick ? '<i class="ok">●</i>' : "";
              return '<div class="pl-m' + (f.winner ? " done" : "") + '">' + side(f.a) + '<span class="pl-v">v</span>' + side(f.b) + '<span class="pl-tag">' + tag + "</span>" +
                (others.length && !f.winner ? '<span class="pl-oth">' + others.map(i => D.av(i)).join("") + "</span>" : "") + "</div>";
            }).join("") + "</div>";
          }).join("");
      } else if(view === "results"){
        body = '<p class="note">' + T("Tap the winner once the match is over. Everyone’s pick for that match locks.", "Tik de winnaar aan als de wedstrijd voorbij is. Ieders voorspelling voor die wedstrijd ligt dan vast.") + "</p>" +
          R.map((rn, r) => {
            const list = fs.filter(f => f.round === r); if(!list.some(f => f.a || f.b)) return "";
            return '<h2 class="sub-h">' + L(rn) + "</h2>" + '<div class="pl-fx">' + list.map(f => {
              const side = n => !n ? '<span class="pl-side tbd">' + T("to come", "volgt") + "</span>" :
                '<button class="pl-side res' + (f.winner === n ? " won" : f.winner ? " lost" : "") + '" data-f="' + f.id + '" data-n="' + esc(n) + '"' + (f.winner || !f.a || !f.b ? " disabled" : "") + ">" + esc(n) + "</button>";
              return '<div class="pl-m' + (f.winner ? " done" : "") + '">' + side(f.a) + '<span class="pl-v">v</span>' + side(f.b) +
                '<span class="pl-tag">' + (f.winner && PD.canUndo(S, cid, f.id) ? '<button class="pl-undo" data-u="' + f.id + '" aria-label="' + T("Undo", "Ongedaan maken") + '">↶</button>' : "") + "</span></div>";
            }).join("") + "</div>";
          }).join("") +
          (started ? "" : '<h2 class="sub-h">' + T("Fix a name", "Naam verbeteren") + '</h2><div class="pl-names">' + c.players.map((n, i) => '<input class="pl-in" data-i="' + i + '" value="' + esc(n) + '" maxlength="40">').join("") + "</div>") +
          '<button class="go ghost pl-del" id="del">' + T("Delete this predictor", "Deze poule verwijderen") + "</button>";
      } else {
        const tbl = PD.score(S, cid, users());
        body = '<div class="chalkboard"><table class="st pl-st"><thead><tr><th></th><th>' + T("Points", "Punten") + "</th><th>" + T("Right", "Goed") + "</th><th>" + T("Champion", "Kampioen") + "</th></tr></thead><tbody>" +
          tbl.map((r, k) => '<tr' + (r.user === me ? ' class="me"' : "") + '><th><span class="pl">' + D.av(r.user) + "<span>" + esc(P[r.user]) + "</span></span></th><td" + (k === 0 && r.pts ? ' class="top1"' : "") + ">" + r.pts + "</td><td>" + r.right + "/" + r.played + '</td><td class="pl-ch">' +
            (started || champ ? (r.champ ? esc(r.champ) + (r.champOk ? " ★" : "") : "–") : r.champ ? "✓" : "–") + "</td></tr>").join("") + "</tbody></table></div>" +
          '<p class="note">' + T("Champion picks are shown once the first result is in.", "Kampioenskeuzes zijn zichtbaar zodra de eerste uitslag binnen is.") + (champ ? " " + T("Champion: ", "Kampioen: ") + "<b>" + esc(champ) + "</b>." : "") + "</p>" +
          '<h2 class="sub-h">' + T("Per round", "Per ronde") + '</h2><div class="pl-rounds">' + tbl.map(r => '<div><span class="pl">' + D.av(r.user) + "</span>" + r.rounds.map((v, k) => "<b title=\"" + L(R[k]) + "\">" + v + "</b>").join("") + (r.champOk ? "<b class=\"gold\">" + c.rules.champ + "</b>" : "") + "</div>").join("") + "</div>";
      }
      el.innerHTML = '<div class="g-top"><a class="back" href="#poule">‹ ' + T("Predictor", "Poule") + '</a><b>' + (c.sport === "snooker" ? "Snooker" : "Darts") + '</b><span></span></div><div class="g-body pl-show s-' + c.sport + '">' +
        '<h1 class="g-h">' + esc(c.name) + '</h1><div class="chips pl-tabs" id="tabs">' + tab("picks", T("Picks", "Voorspellen")) + tab("results", T("Results", "Uitslagen")) + tab("table", T("Table", "Stand")) + "</div>" + body + "</div>";
      el.querySelectorAll("#tabs button").forEach(b => b.onclick = () => { view = b.dataset.v; D.sfx.tick(); show(cid); });
      el.querySelectorAll(".pl-who button").forEach(b => b.onclick = () => { D.store.setMe(+b.dataset.u); D.sfx.tick(); show(cid); });
      const ch = el.querySelector("#champ"); if(ch) ch.onchange = () => { if(ch.value){ PD.callChampion(S, cid, me, ch.value); commit(); D.sfx.good(); } };
      el.querySelectorAll(".pl-side[data-f]").forEach(b => b.onclick = () => {
        const f = b.dataset.f, n = b.dataset.n;
        if(view === "picks"){ if(PD.call(S, cid, f, me, n)){ commit(); D.sfx.tick(); D.fx.buzz(8); show(cid); } }
        else if(view === "results"){ if(PD.settle(S, cid, f, n)){ commit(); D.sfx.good(); D.fx.buzz(12); show(cid); } }
      });
      el.querySelectorAll(".pl-undo").forEach(b => b.onclick = () => { if(PD.undo(S, cid, b.dataset.u)){ commit(); D.sfx.tick(); show(cid); } });
      el.querySelectorAll(".pl-names input").forEach(inp => inp.onchange = () => { if(PD.rename(S, cid, +inp.dataset.i, inp.value)) commit(); show(cid); });
      const del = el.querySelector("#del");
      if(del) del.onclick = () => {
        if(del.dataset.sure){ PD.del(S, cid); commit(); D.go("#poule"); return; }
        del.dataset.sure = "1"; del.textContent = T("Sure? Tap again to delete", "Zeker? Tik nog een keer om te verwijderen");
      };
    }
  };
})(window.DART);
