/* Small synthesised sounds (no files): the thud of a dart (a different one per bed), the
   snooker table (ball clicks, cushions, the pocket, the cue tip, polite applause),
   right/wrong, the clean-release pings, the heartbeat of a 180 chase, the crowd's "awww",
   the crowd's roar, and the old one-line caller (Quiz and Checkout; the 501 Match uses
   app/caller.js). The caller uses the browser's speech voice (English, as on TV) when there is one.

   One audio engine for the whole game. A phone only starts it inside a real tap, and for a
   finger that means touchend or click, not pointerdown. So every tap asks until it runs, not just
   the first: a phone can take it away again, and iOS then says "interrupted" (a call, Siri, the
   lock screen). Sounds played while it is stopped are dropped: they would otherwise wait and all
   come out at once when it starts again. */
(function(D){
  let ac = null, askT = 0, tapT = -1e4, wakeT = 0;
  const quiet = p => { if(p && p.catch) p.catch(() => {}); };
  const ctx = () => {
    if(!ac || ac.state === "closed"){ try { ac = new (window.AudioContext || window.webkitAudioContext)(); ac.onstatechange = sight; } catch(e){ ac = null; } }
    if(ac && ac.state !== "running"){ try { quiet(ac.resume()); } catch(e){} }
    return ac;
  };
  const on = () => D.store.sound;
  /* the engine to play on: it must be running, or a tap must have just asked it to */
  const live = () => { if(!on()) return null; const a = ctx(); return a && (a.state === "running" || performance.now() - tapT < 500) ? a : null; };
  /* a tap. If an earlier tap's request came to nothing the engine is dead (iOS after a long
     interruption): only a new one helps, and a tap is the moment it can start. */
  function unlock(){
    const t = performance.now();
    if(ac && ac.state !== "running" && askT && t - askT > 1000){ try { quiet(ac.close()); } catch(e){} ac = null; askT = 0; }
    const a = ctx(); if(!a) return null;
    tapT = t;
    if(a.state === "running"){ askT = 0; return a; }
    if(!askT) askT = t;
    /* the silent sample older iPhones want before they make a sound */
    try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); } catch(e){}
    return a;
  }
  /* out of sight (another app, the lock screen, BALL hiding the frame) the engine stops; back in
     sight it starts again, after a moment, because iOS can refuse in the event itself. If it
     refuses anyway, the next tap brings it back. Also runs when the engine's state changes. */
  function sight(){
    clearTimeout(wakeT);
    if(!ac) return;
    const away = () => document.hidden || D.hidden;
    if(away()){ if(ac.state === "running"){ try { quiet(ac.suspend()); } catch(e){} } return; }
    wakeT = setTimeout(() => { if(ac && !away() && ac.state !== "running") ctx(); }, 300);
  }
  ["touchend", "pointerup", "click", "keydown"].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  /* speech only from a click or a key: on iOS those are the gestures it is sure to take */
  ["click", "keydown"].forEach(ev => document.addEventListener(ev, () => { if(D.caller) D.caller.unlock(); }, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", sight);
  ["pageshow", "focus"].forEach(ev => window.addEventListener(ev, sight));

  /* the dart going into sisal. v: a number 0..1 (how hard; a miss is softer) or a bed:
     "treble" (higher, tighter tock), "double" (thud + a light wire tink), "bull" (deep thunk),
     "single", "miss" (a dull puff into the surround) */
  const KIND = {
    treble: { k: 1, lp: 2200, o0: 230, o1: 95, click: true },
    double: { k: 0.95, lp: 1500, o0: 180, o1: 70, tink: true },
    bull: { k: 1.05, lp: 1100, o0: 120, o1: 55 },
    single: { k: 0.9, lp: 1300, o0: 180, o1: 70 },
    miss: { k: 0.45, lp: 500, o0: 0 }
  };
  function thud(v){
    const a = live(); if(!a) return;
    const K = typeof v === "string" ? (KIND[v] || KIND.single) : { k: v == null ? 1 : v, lp: 1100 + Math.random() * 600, o0: 180, o1: 70 };
    const k = K.k, t = a.currentTime, len = 0.09, buf = a.createBuffer(1, a.sampleRate * len | 0, a.sampleRate), d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "lowpass"; f.frequency.value = K.lp; g.gain.value = 0.9 * k;
    src.connect(f).connect(g).connect(a.destination); src.start(t);
    if(K.o0){
      const o = a.createOscillator(), og = a.createGain();
      o.frequency.setValueAtTime(K.o0, t); o.frequency.exponentialRampToValueAtTime(K.o1, t + 0.08);
      og.gain.setValueAtTime(0.5 * k, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(og).connect(a.destination); o.start(t); o.stop(t + 0.11);
    }
    if(K.click) noise(0.006, 5000, 4000, 0.35, "highpass", 0.7);
    if(K.tink) tink(0.35);
  }
  /* filtered noise: the dart through the air (a short rising swish) */
  function noise(dur, f0, f1, gain, type, q){
    const a = live(); if(!a) return;
    const t = a.currentTime, buf = a.createBuffer(1, Math.max(1, a.sampleRate * dur | 0), a.sampleRate), d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = type || "bandpass"; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.value = gain; src.connect(f).connect(g).connect(a.destination); src.start(t);
  }
  const whoosh = slow => slow ? noise(0.7, 400, 2200, 0.13) : noise(0.2, 700, 2600, 0.12);
  /* metal on metal: the wire (k 1) or a light tink (a dart glancing off another, a double) */
  function tink(k){
    const a = live(); if(!a) return;
    const t = a.currentTime, g0 = k == null ? 1 : k;
    [2350, 3710, 5200].forEach((fq, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = fq * (g0 < 1 ? 1.25 : 1);
      g.gain.setValueAtTime(0.16 * g0 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.27);
    });
    noise(0.05, 4000, 3000, 0.2 * g0, "highpass", 0.7);
  }
  const wire = () => tink(1);
  function tone(freqs, dur, type, gain, gap){
    const a = live(); if(!a) return;
    freqs.forEach((fq, i) => {
      const t = a.currentTime + i * (gap == null ? dur * 0.8 : gap), o = a.createOscillator(), g = a.createGain();
      o.type = type || "triangle"; o.frequency.value = fq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  }
  /* a clean release: GOOD a soft ping, PERFECT a bright double ping */
  const clean = lvl => lvl === 2 ? tone([1320, 1980], 0.12, "sine", 0.16, 0.06) : tone([1046], 0.1, "sine", 0.1);
  /* the heartbeat of a 180 chase: two low pulses */
  function heart(){
    const a = live(); if(!a) return;
    [0, 0.2].forEach((dt, i) => {
      const t = a.currentTime + dt, o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(i ? 52 : 62, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i ? 0.45 : 0.6, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.22);
    });
  }
  /* the crowd: "awww" (noise with the band sliding down) */
  const aww = () => { noise(0.9, 900, 300, 0.22, "bandpass", 2.2); noise(0.8, 700, 260, 0.14, "bandpass", 3); };
  /* the crowd: a short roar (filtered noise), for the arena's big moments */
  function roar(level, dur){
    const a = live(); if(!a) return;
    try {
      const t = a.currentTime, len = dur + 0.2, sr = a.sampleRate, buf = a.createBuffer(1, sr * len | 0, sr), d = buf.getChannelData(0);
      let b = 0;
      for(let i = 0; i < d.length; i++){ b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 * (0.75 + 0.25 * Math.sin(i / sr * 23 + Math.sin(i / sr * 7) * 3)); }
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf; f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * level, t + 0.25); g.gain.setValueAtTime(0.16 * level, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(a.destination); src.start(t); src.stop(t + len);
    } catch(e){}
  }
  /* ---------- the snooker table ---------- */
  /* ball on ball: a short bright clack, louder for a harder contact (k 0..1) */
  function click(k){
    const a = live(); if(!a) return;
    k = Math.max(0.08, Math.min(1, k == null ? 0.6 : k));
    const t = a.currentTime;
    [3100, 4700].forEach((fq, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = fq * (0.96 + Math.random() * 0.08);
      g.gain.setValueAtTime(0.22 * k / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.05);
    });
    noise(0.012, 6000, 3500, 0.25 * k, "highpass", 0.8);
  }
  /* the cushion: a soft low thump (a jaw is a little brighter) */
  const cush = (k, jaw) => noise(0.07, jaw ? 900 : 420, jaw ? 300 : 160, 0.3 * Math.max(0.15, Math.min(1, k == null ? 0.5 : k)), "lowpass", 0.9);
  /* into the pocket: the drop and the roll down the net */
  function pocket(){
    const a = live(); if(!a) return;
    noise(0.12, 380, 120, 0.42, "lowpass", 1);
    [0.07, 0.15, 0.26].forEach((dt, i) => setTimeout(() => noise(0.03, 900 - i * 150, 500, 0.12 / (i + 1), "bandpass", 2), dt * 1000));
  }
  const pot = () => { click(0.5); setTimeout(pocket, 140); };
  /* the cue tip on the cue ball: a dry tock */
  function tip(k){
    const a = live(); if(!a) return;
    k = Math.max(0.2, Math.min(1, k == null ? 0.6 : k));
    noise(0.02, 2400, 1200, 0.28 * k, "bandpass", 1.4);
    tone([720], 0.05, "sine", 0.08 * k);
  }
  /* snooker applause: polite clapping, more hands for a bigger moment (n ~0.3 … 1.5) */
  function clap(n){
    const a = live(); if(!a) return;
    n = Math.max(0.2, Math.min(1.6, n || 0.6));
    const dur = 0.9 + n * 1.4, count = Math.round(14 + n * 46);
    for(let i = 0; i < count; i++){
      const at = Math.pow(Math.random(), 1.6) * dur;
      setTimeout(() => noise(0.018 + Math.random() * 0.012, 1500 + Math.random() * 1500, 900 + Math.random() * 600, (0.05 + Math.random() * 0.05) * (1 - at / dur * 0.7), "bandpass", 1.1), at * 1000);
    }
  }
  function call(text){
    if(!on() || !D.store.voice || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text), v = speechSynthesis.getVoices();
      u.voice = v.find(x => /en-GB/i.test(x.lang)) || v.find(x => /^en/i.test(x.lang)) || null;
      u.lang = "en-GB"; u.rate = 0.82; u.pitch = 0.9; speechSynthesis.speak(u);
    } catch(e){}
  }
  D.sfx = {
    unlock, ctx, sight, thud, whoosh, wire, tink, clean, heart, aww, roar, click, cush, pocket, pot, tip, clap,
    good: () => tone([660, 990], 0.14),
    bad: () => tone([220, 165], 0.18, "sawtooth"),
    tick: () => tone([1200], 0.03, "square"),
    call
  };
})(window.DART);
