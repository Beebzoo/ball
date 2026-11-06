/* The referee of Frame: snooker's rules as pure functions over a small state, so the tests can
   play whole frames without a table. What is on (a red, a colour, or the next colour in order),
   what a shot scored, fouls (at least 4: the value of the ball on, the ball hit first or a ball
   potted wrongly, whichever is highest), colours back on their spots while reds remain, the
   colours in order at the end, the frame ending on the black (a re-spotted black on a tie), the
   break, points remaining and snookers needed. Not played: free ball, foul-and-a-miss and
   "play again" after a foul (the incoming player always plays).
   A shot is { first: id of the first ball the cue ball hit (or null), potted: [ids], cueIn }. */
(function(D){
  const VALUE = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
  const SEQ = ["yellow", "green", "brown", "blue", "pink", "black"];
  const kind = id => id === "cue" ? "cue" : /^r\d/.test(id) ? "red" : id;
  const value = id => VALUE[kind(id)] || 0;

  function create(reds, first){
    return { reds, redsLeft: reds, phase: "red", seq: 0, turn: first || 0, score: [0, 0], brk: 0, hb: [0, 0], over: false, winner: -1, rb: false, shots: 0 };
  }
  /* what is on: "red", "colour" (any colour, after a red) or the colour in order */
  const on = st => st.phase === "seq" ? SEQ[st.seq] : st.phase;
  /* points still on the table for the player at the table */
  function remaining(st){
    if(st.phase === "seq") return SEQ.slice(st.seq).reduce((s, c) => s + VALUE[c], 0);
    return st.redsLeft * 8 + 27 + (st.phase === "colour" ? 7 : 0);
  }
  const behind = (st, i) => st.score[1 - i] - st.score[i];
  /* player i can't win (or tie) on what is left: needs the other to give away fouls */
  const needsSnookers = (st, i) => behind(st, i) > remaining(st);
  /* the best next ball (a colour after a red counts as the black) */
  function nextValue(st){ const o = on(st); return o === "red" ? 1 : o === "colour" ? 7 : VALUE[o]; }
  /* "frame ball": potting the next ball puts the player at the table out of reach */
  const frameBall = st => { const lead = st.score[st.turn] - st.score[1 - st.turn], r = remaining(st), v = nextValue(st); return lead <= r && lead + 2 * v > r; };

  const legalFirst = (o, k) => o === "red" ? k === "red" : o === "colour" ? !!k && k !== "red" && k !== "cue" : k === o;

  /* the shot decides: returns what happened and updates st.
     { foul, pen, why, pts, potted, respot: [colour ids back on their spots], inHand, turnOver,
       brkEnded (the break that just ended, or 0), over, winner, rb (re-spotted black now) } */
  function apply(st, shot){
    const o = on(st), striker = st.turn;
    const first = shot.first || null, fk = first ? kind(first) : null;
    const pots = (shot.potted || []).filter(id => id !== "cue");
    const pk = pots.map(kind);
    let foul = false, pen = 4, why = "";
    const bump = v => { if(v > pen) pen = v; };
    const fault = w => { foul = true; if(!why) why = w; };
    /* the value of the ball on (a nominated colour = the colour hit first) */
    bump(o === "red" ? 1 : o === "colour" ? (fk && fk !== "red" ? VALUE[fk] : 0) : VALUE[o]);
    if(!first) fault("miss");
    else if(!legalFirst(o, fk)){ fault("wrong"); bump(VALUE[fk] || 0); }
    if(shot.cueIn) fault("inoff");
    pk.forEach((k, i) => {
      const ok = o === "red" ? k === "red" : o === "colour" ? k === fk && k !== "red" && pk.filter(x => x !== "red").length === 1 : k === o;
      if(!ok){ fault("pot"); bump(VALUE[k]); }
    });
    st.shots++;
    st.redsLeft -= pk.filter(k => k === "red").length;
    const out = { foul, pen: foul ? pen : 0, why, pts: 0, potted: pots, respot: [], inHand: !!shot.cueIn, turnOver: false, brkEnded: 0, over: false, winner: -1, rb: false, on: o };
    const lastBlack = o === "black";

    if(!foul && pots.length){
      out.pts = o === "red" ? pots.length : VALUE[pk[0]];
      st.score[striker] += out.pts; st.brk += out.pts;
      if(o === "red") st.phase = "colour";
      else if(o === "colour"){
        out.respot.push(pk[0]);
        if(st.redsLeft > 0) st.phase = "red"; else { st.phase = "seq"; st.seq = 0; }
      }
      else st.seq++;
      if(lastBlack) return end(st, out, striker);
      return out;
    }
    /* the visit ends: a miss, a safety or a foul */
    out.turnOver = true;
    out.brkEnded = st.brk;
    if(st.brk > st.hb[striker]) st.hb[striker] = st.brk;
    st.brk = 0;
    if(foul){
      st.score[1 - striker] += pen;
      pk.forEach(k => { if(k !== "red" && !(lastBlack && k === "black")) out.respot.push(k); });
    }
    if(st.phase === "colour" || (st.phase === "red" && st.redsLeft <= 0)){ if(st.redsLeft > 0) st.phase = "red"; else { st.phase = "seq"; st.seq = 0; } }
    st.turn = 1 - striker;
    /* with only the black left, the first score or foul ends the frame */
    if(lastBlack && foul) return end(st, out, striker);
    return out;
  }
  function end(st, out, striker){
    if(st.score[0] === st.score[1]){
      /* a re-spotted black: back on its spot, the other player plays from the D; next score or foul wins */
      st.phase = "seq"; st.seq = SEQ.length - 1; st.rb = true; st.brk = 0;
      st.turn = 1 - striker;
      out.respot = ["black"]; out.inHand = true; out.turnOver = true; out.rb = true;
      return out;
    }
    if(st.brk > st.hb[striker]) st.hb[striker] = st.brk;
    if(!out.brkEnded) out.brkEnded = st.brk;
    st.brk = 0;
    st.over = true; st.winner = st.score[0] > st.score[1] ? 0 : 1;
    out.over = true; out.winner = st.winner;
    return out;
  }
  function concede(st, i){
    if(st.brk > st.hb[st.turn]) st.hb[st.turn] = st.brk;
    st.brk = 0; st.over = true; st.winner = 1 - i; st.conceded = i;
    return st;
  }
  /* the highest break still possible in this visit (for the maximum chase) */
  const maxLeft = st => remaining(st);

  D.rules = { VALUE, SEQ, kind, value, create, on, remaining, behind, needsSnookers, frameBall, nextValue, apply, concede, maxLeft, legalFirst };
})(window.DART);
