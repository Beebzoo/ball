/* The TV caller (English, as on TV; speech synthesis, queued). Owned by the caller/progress work.
   match.js calls (respect D.store.sound and D.store.voice; everything is a safe no-op without a voice):
     D.caller.walkon(a, b)                  "Best of three legs. Sam to throw first. Game on!"
                                            a: the name throwing first, b: { best, start, opp } or the
                                            best-of number; or a = { first, second, best, start }
     D.caller.visit(name, total, info)      every visit, human and computer; info {cpu, bust, left}
                                            (left 0 = checked out: the score isn't called, the
                                            "gameshot" moment is; if none comes, "Game shot!")
     D.caller.require(name, left)           "Sam, you require eighty-one" when on a finish
     D.caller.moment(type, data)            "180" | "bust" | "gameshot" {name, score, leg, match}
                                            | "nine" (nine-dart chance) | "robin" | "bounce"
                                            extras: "ninedarter" {name} | "matchdart" {name}
     D.caller.stop()                        on leaving the match
   Also: D.caller.test() (Me), D.caller.line(text, {pri}) for any other line, D.caller.words(n).

   The queue: lines play in order and are never cut off (only stop() cancels). Priority 0 =
   plain scores (skipped when something is already waiting, dropped when stale), 1 = requires,
   tons-plus, busts, 2 = 180, game shot, walk-on, nine-dart chance (jump ahead of plain lines).
   Without a speech voice the line shows as a small chyron at the top instead.
   D.caller.unlock() goes in a tap: iOS only lets speech start from a tap, once per page. */
(function(D){
  const synth = () => window.speechSynthesis || null;
  const on = () => !!(D.store && D.store.sound && D.store.voice);
  const TTL = [3000, 6500, 14000], MAXQ = 3, GAP = 160;

  /* ---------- numbers the British way: "one hundred and forty-one" ---------- */
  const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function words(n){
    n = Math.round(Math.abs(+n || 0));
    if(n < 20) return ONES[n];
    if(n < 100) return TENS[n / 10 | 0] + (n % 10 ? "-" + ONES[n % 10] : "");
    if(n < 1000) return ONES[n / 100 | 0] + " hundred" + (n % 100 ? " and " + words(n % 100) : "");
    return String(n);
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh"];
  const pick = a => a[Math.random() * a.length | 0];
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => o[k] == null ? "" : o[k]);
  const nm = x => x == null ? "" : String(typeof x === "object" ? (x.name || "") : x).trim();

  /* ---------- the voice: British first, a male TV-ish voice if there is one ---------- */
  let vc = null, vcN = -1;
  function voice(){
    const s = synth(); if(!s) return null;
    let vs = []; try { vs = s.getVoices() || []; } catch(e){}
    if(vs.length === vcN) return vc;
    vcN = vs.length;
    let best = null, bs = -1e9;
    vs.forEach(v => {
      const l = String(v.lang || "").replace("_", "-"), n = String(v.name || "");
      let sc = /^en-GB/i.test(l) ? 10 : /^en-(IE|AU|NZ)/i.test(l) ? 6 : /^en/i.test(l) ? 3 : -100;
      if(/Ryan|George|Daniel|Arthur|Oliver|Thomas|Brian|Alfie|Elliot|Male/i.test(n)) sc += 4;
      if(/Natural|Online|Neural|Premium|Enhanced/i.test(n)) sc += 2;
      if(/Female|Libby|Sonia|Hazel|Susan|Kate|Serena|Martha|Maisie|Bella|Mia/i.test(n)) sc -= 1;
      if(/Google UK English Male/i.test(n)) sc += 3;
      if(sc > bs){ bs = sc; best = v; }
    });
    vc = bs > -50 ? best : null;
    return vc;
  }
  try { const s = synth(); if(s && s.addEventListener) s.addEventListener("voiceschanged", () => { vcN = -1; }); } catch(e){}

  /* ---------- the chyron: the line on screen when there's no voice ---------- */
  let chy = null, chyT = 0;
  function chyron(text, ms){
    if(!document.body) return;
    if(!chy || !chy.isConnected){
      chy = document.createElement("div"); chy.className = "dc-chy"; chy.setAttribute("aria-live", "polite");
      document.body.appendChild(chy);
    }
    chy.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5"/><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5V15"/></svg><span></span>';
    chy.lastChild.textContent = text;
    chy.classList.remove("on"); void chy.offsetWidth; chy.classList.add("on");
    clearTimeout(chyT); chyT = setTimeout(() => chy && chy.classList.remove("on"), Math.max(1400, ms));
  }

  /* ---------- the queue ---------- */
  let q = [], cur = null, token = 0, safety = 0, gapT = 0, gsT = 0;
  /* The walk-on is spoken after the questions have loaded, outside the tap, so the tap says
     something first: a space, silent and fast. That opens speech for the rest of the page. It
     stays out of the queue; if an engine hangs on it, it is cancelled before it can hold up a line. */
  let primed = false;
  function unlock(){
    const s = synth();
    if(primed || !on() || !s || typeof SpeechSynthesisUtterance === "undefined") return;
    primed = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; u.rate = 10; s.speak(u);
      setTimeout(() => { try { if(!cur && !q.length && !gapT && (s.speaking || s.pending)) s.cancel(); } catch(e){} }, 400);
    } catch(e){ primed = false; }
  }
  const recent = {};
  const est = it => (600 + it.text.length * 62) / (it.rate || 1);
  function prune(now){ q = q.filter(it => now - it.t <= it.ttl); }

  function say(text, o){
    o = o || {};
    if(!on() || !text) return false;
    const now = Date.now(), pri = o.pri || 0;
    if(o.key && recent[o.key] && now - recent[o.key] < (o.dedup || 2600)) return false;
    prune(now);
    /* a small line is skipped when something is already playing and another line waits */
    if(pri === 0 && cur && q.length) return false;
    const it = { text, pri, rate: o.rate || 1, pitch: o.pitch || 0.9, t: now, ttl: o.ttl || TTL[pri], key: o.key || "", vol: o.vol || 1 };
    /* a big line goes ahead of any plain score still waiting */
    let at = q.length;
    if(pri === 2){ const i = q.findIndex(x => x.pri === 0); if(i >= 0) at = i; }
    q.splice(at, 0, it);
    /* never let the queue run behind the play: drop the oldest, least important lines */
    while(q.length > MAXQ){
      let lo = 0; q.forEach((x, i) => { if(x.pri < q[lo].pri) lo = i; });
      q.splice(lo, 1);
    }
    if(o.key) recent[o.key] = now;
    pump();
    return true;
  }
  function pump(){
    if(cur || gapT) return;
    const now = Date.now();
    prune(now);
    const it = q.shift(); if(!it) return;
    if(!on()){ q = []; return; }
    cur = it; it.started = now;
    const my = ++token;
    const done = () => {
      if(my !== token) return;
      token++; clearTimeout(safety); cur = null;
      gapT = setTimeout(() => { gapT = 0; pump(); }, GAP);
    };
    if(D.caller.onLine) try { D.caller.onLine(it.text, it); } catch(e){}
    const s = synth();
    if(!s || typeof SpeechSynthesisUtterance === "undefined"){
      chyron(it.text, est(it));
      safety = setTimeout(done, est(it));
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(it.text), v = voice();
      if(v) u.voice = v;
      u.lang = v ? v.lang : "en-GB"; u.rate = it.rate; u.pitch = it.pitch; u.volume = it.vol;
      it.u = u; /* held here: a browser can drop an utterance nothing points at, and its end event with it */
      u.onend = done;
      u.onerror = ev => { if(ev && ev.error === "not-allowed") primed = false; if(ev && /not-allowed|synthesis-(failed|unavailable)|audio-hardware|language-unavailable|voice-unavailable/.test(ev.error || "")) chyron(it.text, est(it)); done(); };
      /* some engines never fire onend: move on after twice the expected time */
      safety = setTimeout(done, est(it) * 2 + 2500);
      s.speak(u);
    } catch(e){ chyron(it.text, est(it)); safety = setTimeout(done, est(it)); }
  }
  function stop(){
    q = []; token++; clearTimeout(safety); clearTimeout(gapT); clearTimeout(gsT); gapT = 0; gsT = 0;
    const was = cur; cur = null;
    Object.keys(recent).forEach(k => delete recent[k]);
    try { const s = synth(); if(s && (was || s.speaking || s.pending)) s.cancel(); } catch(e){}
    if(chy) chy.classList.remove("on");
  }

  /* out of sight nobody speaks; back in sight, iOS can have left the voice paused */
  document.addEventListener("visibilitychange", () => {
    if(document.hidden) return stop();
    try { const s = synth(); if(s && s.paused) s.resume(); } catch(e){}
  });

  /* ---------- the lines ---------- */
  const L180 = [
    { text: "One hundred and eighty!", rate: 0.62, pitch: 0.82 },
    { text: "One hundred... and eighty!", rate: 0.66, pitch: 0.8 },
    { text: "One hun-dred and eigh-ty!", rate: 0.6, pitch: 0.85 },
    { text: "One... hundred... and eighty!", rate: 0.7, pitch: 0.8 }
  ];
  function call180(){ const l = pick(L180); say(l.text, { pri: 2, rate: l.rate, pitch: l.pitch, key: "180", dedup: 3000 }); }
  function noScore(){ say(pick(["No score.", "No score.", "No score!"]), { pri: 1, rate: 0.92, key: "bust" }); }

  function walkon(a, b){
    let o = {};
    if(a && typeof a === "object" && !Array.isArray(a)){
      if(b && typeof b === "object" && (a.name || b.name) && a.best == null && a.first == null) o = { first: nm(a), second: nm(b) };
      else { o = Object.assign({}, a); if(typeof b === "number") o.best = b; }
    } else if(Array.isArray(a)){ o = { first: nm(a[0]), second: nm(a[1]) }; if(typeof b === "number") o.best = b; else if(b && typeof b === "object") Object.assign(o, b); }
    else {
      o.first = nm(a);
      if(typeof b === "number") o.best = b;
      else if(typeof b === "string") o.second = b;
      else if(b && typeof b === "object") Object.assign(o, b);
    }
    const first = nm(o.first || o.name), second = nm(o.second || o.opp || o.vs), best = +o.best || +o.legs || 0;
    const fmt = best > 1 ? "best of " + words(best) + " legs" : best === 1 ? "one leg, winner takes all" : "";
    const game = +o.start === 301 ? "three-oh-one, " : "";
    const lines = [];
    if(fmt){
      lines.push(cap(game + fmt) + ". {first} to throw first. Game on!");
      lines.push("Ladies and gentlemen... this match is " + game + fmt + ". {first} to throw first. Game on!");
      if(second) lines.push("{first} versus {second}, " + game + fmt + ". {first} to throw. Game on!");
      if(best > 1) lines.push(cap(game + fmt) + ". {first} to throw first. Let's play darts!");
    } else {
      lines.push("{first} to throw first. Game on!");
      if(second) lines.push("{first} versus {second}. {first} to throw first. Game on!");
    }
    say(fill(pick(lines), { first: first || "Player one", second }), { pri: 2, rate: 0.9, pitch: 0.88, key: "walkon", ttl: 20000 });
  }

  function visit(name, total, info){
    info = info || {};
    total = Math.round(+total || 0);
    if(info.bust) return noScore();
    if(info.left === 0){
      /* checked out: TV calls "Game shot", not the score; wait a moment for the moment() call */
      clearTimeout(gsT);
      gsT = setTimeout(() => { gsT = 0; say(pick(["Game shot!", "Game shot!", "Game shot, and the leg!"]), { pri: 2, rate: 0.88, key: "gameshot", dedup: 4000 }); }, 650);
      return;
    }
    if(total === 180) return call180();
    if(total === 0) return say("No score.", { pri: 0, rate: 0.95, key: "v0", dedup: 900 });
    const w = cap(words(total));
    if(total >= 140) return say(w + "!", { pri: 1, rate: 0.82, pitch: 0.86 });
    if(total >= 100) return say(w + "!", { pri: 1, rate: 0.88, pitch: 0.88 });
    say(w + ".", { pri: 0, rate: 0.98, pitch: 0.9 });
  }

  function require(name, left){
    left = Math.round(+left || 0);
    if(left < 2 || left > 170) return;
    if(D.co && D.co.possible && !D.co.possible(left)) return;
    const n = nm(name), w = words(left);
    const lines = n ? [n + ", you require " + w + ".", n + "... you require " + w + "."] : ["You require " + w + "."];
    if(left === 170) lines.push(n ? n + ", you require one hundred and seventy. The big fish." : "You require one hundred and seventy.");
    say(pick(lines), { pri: 1, rate: 0.9, pitch: 0.88, key: "req", dedup: 1200 });
  }

  function moment(type, data){
    data = data || {};
    const n = nm(data.name);
    const t = String(type || "").toLowerCase();
    if(t === "180") return call180();
    if(t === "bust") return noScore();
    if(t === "gameshot" || t === "checkout" || t === "leg" || t === "match"){
      clearTimeout(gsT); gsT = 0;
      const matchWon = !!data.match || t === "match";
      const leg = +data.leg || 0, ord = ORD[leg] || "", sc = typeof data.score === "number" ? data.score : 0;
      let lines;
      if(matchWon) lines = ["Game shot, and the match!", n ? "Game shot, and the match, to " + n + "!" : "Game shot... and the match!", n ? "Game shot... and the match! " + n + " wins it." : "Game shot, and the match!"];
      else if(ord) lines = ["Game shot, and the " + ord + " leg!", n ? "Game shot, and the " + ord + " leg, " + n + "!" : "Game shot, and the " + ord + " leg!", n ? "Game shot! And the " + ord + " leg to " + n + "." : "Game shot! And the " + ord + " leg."];
      else lines = ["Game shot, and the leg!", n ? "Game shot, and the leg, to " + n + "!" : "Game shot!"];
      say(pick(lines), { pri: 2, rate: matchWon ? 0.8 : 0.88, pitch: 0.86, key: "gameshot", dedup: 4000, ttl: 15000 });
      if(sc === 170) say(pick(["The big fish! One hundred and seventy!", "One hundred and seventy... the big fish!", "The maximum checkout! One hundred and seventy!"]), { pri: 1, rate: 0.78, key: "co", ttl: 15000 });
      else if(sc >= 100) say(pick(["A " + words(sc) + " checkout!", "What a finish! " + cap(words(sc)) + ".", cap(words(sc)) + " checkout!"]), { pri: 1, rate: 0.86, key: "co", ttl: 15000 });
      return;
    }
    if(t === "nine") return say(pick([n ? n + " is on for a nine-darter!" : "On for a nine-darter!", "Six perfect darts... here we go.", "Nine-dart finish on... the crowd holds its breath.", n ? "Six perfect darts for " + n + ". Nine-darter on!" : "Six perfect darts. Nine-darter on!"]), { pri: 2, rate: 0.84, pitch: 0.86, key: "nine", dedup: 8000 });
    if(t === "ninedarter" || t === "perfect") return say(pick(["A nine-dart finish! Perfection!", "Nine darts! Absolute perfection!", n ? "A nine-darter for " + n + "! Darts doesn't get better than this." : "A nine-darter! Darts doesn't get better than this."]), { pri: 2, rate: 0.78, pitch: 0.84, key: "ninedarter", dedup: 8000, ttl: 15000 });
    if(t === "robin") return say(pick(["Robin Hood! Dart in the dart!", "Would you believe it... a Robin Hood!", "Straight into the back of the other dart! Robin Hood!"]), { pri: 1, rate: 0.9, key: "robin" });
    if(t === "bounce") return say(pick(["Bounce-out.", "Oh, it's bounced out!", "Off the wire, and out."]), { pri: 0, rate: 0.95, key: "bounce", dedup: 1500 });
    if(t === "matchdart") return say(pick([n ? n + ", for the match." : "Match dart.", "Match dart.", n ? "This for the match, " + n + "." : "This for the match."]), { pri: 1, rate: 0.86, key: "matchdart", dedup: 6000 });
  }

  /* a short demo for Me: the classic sequence */
  function test(){
    stop();
    const n = (D.store && D.store.name) || "Player";
    say("Sixty.", { pri: 0 });
    say(n + ", you require eighty-one.", { pri: 1, rate: 0.9, pitch: 0.88 });
    const l = L180[0]; say(l.text, { pri: 2, rate: l.rate, pitch: l.pitch });
    say("Game shot, and the first leg!", { pri: 2, rate: 0.88, pitch: 0.86 });
  }

  D.caller = {
    walkon, visit, require, moment, stop, test, words, unlock,
    line: (text, o) => say(text, o),
    /* for tests and the match: is something playing or waiting */
    get busy(){ return !!cur || q.length > 0; },
    _state: () => ({ cur: cur && cur.text, q: q.map(x => x.text) }),
    onLine: null
  };
})(window.DART);
