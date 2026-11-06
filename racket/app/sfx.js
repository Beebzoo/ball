/* Small synthesised sounds (no files): the pock of the racket, the bounce, the net, a crowd
   that applauds or groans, right/wrong tones, a heartbeat on big points, and the umpire, who
   uses the browser's speech voice (English, as on TV) when there is one, if the player turned it on.

   One audio engine for the whole game. A phone only starts it inside a real tap, and for a
   finger that means touchend or click, not pointerdown. So every tap asks until it runs, not just
   the first: a phone can take it away again, and iOS then says "interrupted" (a call, Siri, the
   lock screen). Sounds played while it is stopped are dropped: they would otherwise wait and all
   come out at once when it starts again. */
(function(R){
  let ac = null, askT = 0, tapT = -1e4, wakeT = 0;
  const quiet = p => { if(p && p.catch) p.catch(() => {}); };
  const ctx = () => {
    if(!ac || ac.state === "closed"){ try { ac = new (window.AudioContext || window.webkitAudioContext)(); ac.onstatechange = sight; } catch(e){ ac = null; } }
    if(ac && ac.state !== "running"){ try { quiet(ac.resume()); } catch(e){} }
    return ac;
  };
  const on = () => R.store.sound;
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
  /* out of sight (another app, the lock screen, BALL hiding the frame) the engine stops and the
     umpire goes quiet; back in sight the engine starts again, after a moment, because iOS can
     refuse in the event itself. If it refuses anyway, the next tap brings it back. Also runs when
     the engine's state changes. */
  function sight(){
    clearTimeout(wakeT);
    const away = () => document.hidden || R.hidden;
    if(away()) hush();
    else try { const s = window.speechSynthesis; if(s && s.paused) s.resume(); } catch(e){} /* iOS can leave the voice paused */
    if(!ac) return;
    if(away()){ if(ac.state === "running"){ try { quiet(ac.suspend()); } catch(e){} } return; }
    wakeT = setTimeout(() => { if(ac && !away() && ac.state !== "running") ctx(); }, 300);
  }
  ["touchend", "pointerup", "click", "keydown"].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  /* speech only from a click or a key: on iOS those are the gestures it is sure to take */
  ["click", "keydown"].forEach(ev => document.addEventListener(ev, prime, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", sight);
  ["pageshow", "focus"].forEach(ev => window.addEventListener(ev, sight));

  /* a short burst of filtered noise; shape: "hit" (sharp decay) or "swell" (sine envelope) */
  function noise(dur, f0, f1, gain, type, q, shape, at){
    const a = live(); if(!a) return;
    const t = a.currentTime + (at || 0), buf = a.createBuffer(1, Math.max(1, a.sampleRate * dur | 0), a.sampleRate), d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (shape === "hit" ? Math.pow(1 - i / d.length, 4) : Math.sin(Math.PI * i / d.length));
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = type || "bandpass"; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.value = gain; src.connect(f).connect(g).connect(a.destination); src.start(t);
  }
  function osc(f0, f1, dur, gain, type, at){
    const a = live(); if(!a) return;
    const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  /* the ball off the strings: a hollow pock (k 0..1.4: how hard) */
  function pock(k){
    k = k == null ? 1 : k;
    osc(560 + k * 140, 380, 0.07, 0.32 * Math.min(1.2, k), "sine");
    osc(1250, 900, 0.03, 0.08 * k, "triangle");
    noise(0.035, 2600, 1600, 0.35 * k, "bandpass", 1.4, "hit");
  }
  /* the ball on the court: clay is a dull puff, grass soft, hard a clean tap */
  function bounce(surf){
    if(surf === "clay"){ noise(0.06, 700, 300, 0.22, "lowpass", 0.8, "hit"); osc(170, 110, 0.05, 0.12); }
    else if(surf === "grass"){ noise(0.04, 500, 260, 0.12, "lowpass", 0.8, "hit"); osc(140, 100, 0.04, 0.08); }
    else { noise(0.03, 1400, 700, 0.18, "bandpass", 1, "hit"); osc(240, 150, 0.05, 0.16); }
  }
  /* into the net: a soft thud and the tape */
  const net = () => { noise(0.18, 500, 220, 0.3, "lowpass", 0.8, "hit"); osc(95, 60, 0.15, 0.2); };
  const whoosh = slow => slow ? noise(0.8, 300, 1800, 0.12) : noise(0.16, 800, 2600, 0.09);
  /* the crowd: applause is a cloud of claps; k 0.4 polite .. 1.4 roaring */
  function applause(k){
    const a = live(); if(!a) return;
    k = k == null ? 1 : k;
    const dur = 1.2 + k * 1.3, sr = a.sampleRate, buf = a.createBuffer(1, sr * dur | 0, sr), d = buf.getChannelData(0);
    const n = Math.round(dur * 55 * k);
    for(let c = 0; c < n; c++){
      const at = Math.pow(Math.random(), 0.7) * (d.length - 600) | 0, len = 220 + Math.random() * 260 | 0, amp = 0.25 + Math.random() * 0.5;
      for(let i = 0; i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.pow(1 - i / len, 3);
    }
    for(let i = 0; i < d.length; i++){ const x = i / d.length; d[i] *= Math.min(1, x * 8) * Math.pow(1 - x, 1.4); }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 0.6; g.gain.value = 0.32 * Math.min(1.2, k);
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  /* "ooh" (rising, a near miss) and "aww" (falling, a missed chance) */
  const ooh = () => { noise(0.9, 320, 620, 0.16, "bandpass", 3); noise(0.8, 420, 760, 0.1, "bandpass", 3.5); };
  const aww = () => { noise(0.9, 800, 300, 0.18, "bandpass", 2.2); noise(0.8, 650, 260, 0.12, "bandpass", 3); };
  /* the heartbeat of a big point: two low pulses */
  const heart = () => { osc(62, 38, 0.2, 0.55); osc(52, 38, 0.2, 0.4, "sine", 0.2); };
  function tone(freqs, dur, type, gain, gap){
    freqs.forEach((fq, i) => osc(fq, fq * 0.999, dur, gain || 0.22, type || "triangle", i * (gap == null ? dur * 0.8 : gap)));
  }
  /* the umpire: English, calm, a little slow. Off until the player turns the voice on (Me) */
  let voice = null, primed = false, spoke = false;
  function call(text, opts){
    if(!on() || !R.store.voice || !window.speechSynthesis || !text) return;
    try {
      spoke = true;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text), v = speechSynthesis.getVoices();
      voice = voice || v.find(x => /en-GB/i.test(x.lang)) || v.find(x => /^en/i.test(x.lang)) || null;
      u.voice = voice; u.lang = "en-GB"; u.rate = (opts && opts.rate) || 0.95; u.pitch = 1; speechSynthesis.speak(u);
    } catch(e){}
  }
  const hush = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch(e){} };
  /* iOS only lets speech start from a tap, once per page, and most of the umpire's calls come from
     timers. So the tap says something first: a space, silent and fast. That opens speech for the
     rest of the page. If an engine hangs on it, it is cancelled before it can hold up a call. */
  function prime(){
    const s = window.speechSynthesis;
    if(primed || !on() || !R.store.voice || !s || typeof SpeechSynthesisUtterance === "undefined") return;
    primed = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; u.rate = 10; s.speak(u);
      setTimeout(() => { try { if(!spoke && (s.speaking || s.pending)) s.cancel(); } catch(e){} }, 400);
    } catch(e){ primed = false; }
  }

  R.sfx = {
    unlock, ctx, sight, pock, bounce, net, whoosh, applause, ooh, aww, heart, call, hush,
    good: () => tone([660, 990], 0.14),
    bad: () => tone([220, 165], 0.18, "sawtooth", 0.16),
    tick: () => tone([1200], 0.03, "square", 0.12),
    chime: () => tone([784, 1047, 1319], 0.16, "sine", 0.14, 0.09)
  };
})(window.RACKET);
