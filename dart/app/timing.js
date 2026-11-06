/* The release log, for tuning the throw on a real phone: how far each release came from its
   still point, and how long the handler ran after the finger lifted. Open the game once with
   ?timing=1 and this phone keeps the last 300 darts and shows a line on the board; ?timing=0 stops
   it and wipes the log. Nothing leaves the phone.
   A row is [ms from the still point (below 0 early), ms of handler delay, 0 | 1 GOOD | 2 PERFECT, hand]. */
(function(D){
  const KEY = "dart.timing", MAX = 300, NEAR = 250;
  const read = () => { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : null; } catch(e){ return null; } };
  const write = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch(e){} };
  const flag = /[?&]timing=([01])/.exec(location.search);
  if(flag){ if(flag[1] === "1"){ if(!read()) write([]); } else { try { localStorage.removeItem(KEY); } catch(e){} } }

  const on = () => !!read();
  function add(off, lag, clean, grade){
    const a = read(); if(!a) return;
    a.push([Math.round(off * 1000), Math.round(lag), clean, grade]);
    write(a.slice(-MAX));
  }
  /* bias, sd and the shares count real attempts at a still point, not a lift half a beat away */
  function stats(){
    const all = read() || [], near = all.filter(r => Math.abs(r[0]) < NEAR), n = near.length;
    if(!n) return { n: 0, all: all.length };
    const bias = near.reduce((s, r) => s + r[0], 0) / n, sd = Math.sqrt(near.reduce((s, r) => s + (r[0] - bias) * (r[0] - bias), 0) / n);
    return { n, all: all.length, bias, sd, lag: all.map(r => r[1]).sort((a, b) => a - b)[all.length >> 1],
      perfect: near.filter(r => r[2] === 2).length / n, good: near.filter(r => r[2] === 1).length / n };
  }
  function line(){
    const s = stats(), T = D.T;
    if(!s.n) return T("Timing: throw a dart", "Timing: gooi een pijl");
    const ms = Math.round(s.bias), pc = x => Math.round(x * 100) + "%";
    return s.n + T(" darts · ", " pijlen · ") + (ms > 0 ? "+" : "") + ms + " ms · " + T("spread ", "spreiding ") + Math.round(s.sd) + " · " + T("delay ", "vertraging ") + s.lag + " · PERFECT " + pc(s.perfect) + " · GOOD " + pc(s.good);
  }
  D.timing = { on, add, stats, line };
})(window.DART);
