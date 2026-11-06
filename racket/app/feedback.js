/* Feedback on the questions, kept on this device: how often each question was answered and got
   right, and the questions someone reported. Every game calls fb.note(); fb.flag(q) gives the
   small Report button that opens the reasons. Me copies it all as text, and
   _tools/bank-feedback.js turns that into a list of fixes and level changes. */
(function(R){
  const STATS = "racket.qstats", REPORTS = "racket.reports";
  const T = R.T;
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch(e){ return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const REASONS = [["wrong", ["The answer is wrong", "Het antwoord klopt niet"]], ["options", ["The options don’t work", "De opties kloppen niet"]], ["unclear", ["The question is unclear", "De vraag is onduidelijk"]], ["level", ["Wrong level", "Verkeerd niveau"]], ["old", ["Out of date", "Verouderd"]]];
  const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14.5V2M3.5 2.5h8.5l-2.2 3 2.2 3H3.5"/></svg>';

  /* one answer: stats[id] = [asked, right, milliseconds of the right answers]; g from qs.grade */
  function note(q, g, ms){
    if(!q || !q.id) return;
    const s = read(STATS, {}), r = s[q.id] || [0, 0, 0];
    r[0]++;
    if(g === 0){ r[1]++; r[2] += Math.round(ms || 0); }
    s[q.id] = r; write(STATS, s);
  }
  const reports = () => read(REPORTS, []);
  const reported = id => reports().some(x => x.id === id && x.p === R.store.me);
  function report(q, why){
    const list = reports();
    if(!list.some(x => x.id === q.id && x.why === why && x.p === R.store.me)) list.push({ id: q.id, why, p: R.store.me, t: Date.now(), q: String(q.q).slice(0, 140), a: q.a });
    write(REPORTS, list);
  }

  /* the Report button; a click anywhere on one opens the reasons (see below) */
  const known = {};
  function flag(q){
    if(!q || !q.id) return "";
    known[q.id] = q;
    const on = reported(q.id);
    return '<button class="fb-flag' + (on ? " on" : "") + '" type="button" data-fb="' + R.esc(q.id) + '">' + ICON + "<span>" + (on ? T("Reported", "Gemeld") : T("Report", "Melden")) + "</span></button>";
  }
  let wrap = null;
  const close = () => { if(wrap){ wrap.remove(); wrap = null; } };
  function open(q, btn){
    close();
    wrap = document.createElement("div"); wrap.className = "fb-wrap";
    wrap.innerHTML = '<div class="sheet fb" role="dialog" aria-label="' + T("Report this question", "Meld deze vraag") + '"><p class="lbl">' + T("Report this question", "Meld deze vraag") + '</p><p class="fb-q">' + R.esc(q.q) + '</p><div class="fb-why">' +
      REASONS.map(([k, l]) => '<button type="button" data-k="' + k + '">' + R.esc(R.L(l)) + "</button>").join("") + '</div><button class="fb-no" type="button">' + T("Cancel", "Annuleren") + "</button></div>";
    wrap.onclick = e => {
      if(e.target === wrap || e.target.classList.contains("fb-no")) return close();
      const b = e.target.closest("[data-k]"); if(!b) return;
      report(q, b.dataset.k); R.sfx.tick(); R.fx.buzz(10); close();
      btn.classList.add("on"); btn.querySelector("span").textContent = T("Reported", "Gemeld");
    };
    document.body.appendChild(wrap);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-fb]");
    if(b && known[b.dataset.fb]) open(known[b.dataset.fb], b);
  });
  window.addEventListener("hashchange", close);

  const dump = () => JSON.stringify({ app: "racket", v: 1, t: new Date().toISOString(), stats: read(STATS, {}), reports: reports() });
  function counts(){ let n = 0; const s = read(STATS, {}); for(const k in s) n += s[k][0]; return { answers: n, reports: reports().length }; }
  /* copy for Claude: the clipboard API needs https, so the phone's LAN address uses the old way */
  function copy(btn){
    const text = dump(), done = ok => {
      const small = btn.querySelector("small"); if(small) small.textContent = ok ? T("Copied", "Gekopieerd") : T("Couldn’t copy", "Kopiëren lukte niet");
      if(ok) R.fx.buzz(10);
    };
    const old = () => {
      const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch(e){}
      t.remove(); done(ok);
    };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), old); else old();
  }

  R.fb = { note, flag, counts, copy, dump, reports };
})(window.RACKET);
