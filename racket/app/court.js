/* The court of Match point: a TV view from behind the near baseline, drawn in SVG with a small
   perspective projection (no 3D library). Player 0 is always at the bottom (near), player 1 at
   the top (far). court.play(script) animates one point: the serve (with a fault first when the
   first serve missed), the rally and its end (ace, double fault, return winner, winner, out,
   net), and resolves when the ball is dead. Metres everywhere: x across (0 = centre),
   y along (0 = near baseline, 23.77 = far baseline), z up. */
(function(R){
  const L = 23.77, NET = L / 2, HW = 5.485, SW = 4.115, SVC = 6.40;
  const F = 600, D = 20, H = 14, YH = -140, VW = 360, VH = 326, CX = VW / 2;
  const proj = (x, y, z) => { const k = F / (D + y); return [CX + x * k, YH + (H - (z || 0)) * k, k]; };
  const P = (x, y, z) => proj(x, y, z).slice(0, 2).map(v => v.toFixed(1)).join(",");
  const rnd = (a, b) => a + Math.random() * (b - a);
  const NS = "http://www.w3.org/2000/svg";
  const SPEED = { grass: 0.46, hard: 0.55, clay: 0.66 };
  const T = (en, nl) => R.T(en, nl);

  function svg(surf){
    let s = '<svg class="court" viewBox="0 0 ' + VW + " " + VH + '" preserveAspectRatio="xMidYMid meet">';
    /* the stands behind the far end and a crowd of dots */
    s += '<rect class="c-stand" x="0" y="0" width="' + VW + '" height="27"/><g class="crowd">';
    const cols = ["#e8e2d4", "#c9d2de", "#f2c66d", "#d0623f", "#5a87c6", "#9db88b", "#f5f5f0", "#b9776b"];
    for(let r = 0; r < 3; r++) for(let i = 0; i < 46; i++){
      const x = 4 + i * 7.7 + (r % 2) * 3.8 + rnd(-1, 1), y = 5.5 + r * 7.4;
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.6" fill="' + cols[Math.random() * cols.length | 0] + '" style="--d:' + rnd(0, 0.4).toFixed(2) + 's"/>';
    }
    s += "</g>";
    /* the surround and the court */
    const far = proj(0, L + 7)[1], near = VH;
    s += '<rect class="c-out" x="0" y="' + far.toFixed(1) + '" width="' + VW + '" height="' + (near - far).toFixed(1) + '"/>';
    if(surf === "grass") for(let i = -6; i < 30; i += 2.4) s += '<polygon class="c-stripe" points="' + [P(-30, i, 0), P(30, i, 0), P(30, i + 1.2, 0), P(-30, i + 1.2, 0)].join(" ") + '"/>';
    s += '<polygon class="c-in" points="' + [P(-HW, 0), P(HW, 0), P(HW, L), P(-HW, L)].join(" ") + '"/>';
    if(surf === "grass") for(let i = 0; i < L; i += 2.4) s += '<polygon class="c-stripe in" points="' + [P(-HW, i), P(HW, i), P(HW, i + 1.2), P(-HW, i + 1.2)].join(" ") + '"/>';
    /* the lines */
    const ln = (a, b) => '<line x1="' + proj(a[0], a[1])[0].toFixed(1) + '" y1="' + proj(a[0], a[1])[1].toFixed(1) + '" x2="' + proj(b[0], b[1])[0].toFixed(1) + '" y2="' + proj(b[0], b[1])[1].toFixed(1) + '"/>';
    s += '<g class="c-lines">' + ln([-HW, 0], [HW, 0]) + ln([-HW, L], [HW, L]) + ln([-HW, 0], [-HW, L]) + ln([HW, 0], [HW, L]) + ln([-SW, 0], [-SW, L]) + ln([SW, 0], [SW, L]) +
      ln([-SW, NET - SVC], [SW, NET - SVC]) + ln([-SW, NET + SVC], [SW, NET + SVC]) + ln([0, NET - SVC], [0, NET + SVC]) + ln([0, 0], [0, 0.3]) + ln([0, L], [0, L - 0.3]) + "</g>";
    s += '<g class="c-marks"></g>';
    /* the umpire's chair at the net, on the left */
    const [ux, uy, uk] = proj(-HW - 1.4, NET, 0), [, uy2] = proj(-HW - 1.4, NET, 2.6);
    s += '<g class="c-ump"><line x1="' + ux.toFixed(1) + '" y1="' + uy.toFixed(1) + '" x2="' + ux.toFixed(1) + '" y2="' + uy2.toFixed(1) + '"/><rect x="' + (ux - 0.4 * uk).toFixed(1) + '" y="' + (uy2 - 0.2 * uk).toFixed(1) + '" width="' + (0.8 * uk).toFixed(1) + '" height="' + (0.25 * uk).toFixed(1) + '" rx="1"/>' +
      '<circle cx="' + ux.toFixed(1) + '" cy="' + (uy2 - 0.75 * uk).toFixed(1) + '" r="' + (0.22 * uk).toFixed(1) + '"/><rect x="' + (ux - 0.25 * uk).toFixed(1) + '" y="' + (uy2 - 0.6 * uk).toFixed(1) + '" width="' + (0.5 * uk).toFixed(1) + '" height="' + (0.45 * uk).toFixed(1) + '" rx="2"/></g>';
    /* far player, then the net, then the ball (it flies in front of the net), then the near player */
    s += '<g class="pl pl1"></g>';
    s += '<g class="sh-far"></g>';
    const nx = HW + 0.914;
    s += '<polygon class="c-net" points="' + [P(-nx, NET, 0), P(nx, NET, 0), P(nx, NET, 1.07), P(0, NET, 0.914), P(-nx, NET, 1.07)].join(" ") + '"/>' +
      '<polyline class="c-tape" points="' + [P(-nx, NET, 1.07), P(0, NET, 0.914), P(nx, NET, 1.07)].join(" ") + '"/>' +
      '<line class="c-post" x1="' + proj(-nx, NET, 0)[0].toFixed(1) + '" y1="' + proj(-nx, NET, 0)[1].toFixed(1) + '" x2="' + proj(-nx, NET, 1.07)[0].toFixed(1) + '" y2="' + proj(-nx, NET, 1.07)[1].toFixed(1) + '"/>' +
      '<line class="c-post" x1="' + proj(nx, NET, 0)[0].toFixed(1) + '" y1="' + proj(nx, NET, 0)[1].toFixed(1) + '" x2="' + proj(nx, NET, 1.07)[0].toFixed(1) + '" y2="' + proj(nx, NET, 1.07)[1].toFixed(1) + '"/>';
    s += '<g class="sh-near"></g><ellipse class="b-sh" rx="2" ry="1"/><g class="pl pl0"></g><circle class="ball" r="3"/>';
    return s + "</svg>";
  }

  /* a player figure in metres (feet at 0,0, up is -y), scaled by the projection */
  function figure(col, hand){
    const r = hand === "L" ? -1 : 1;
    return '<ellipse class="p-sh" cx="0" cy="0" rx="0.5" ry="0.16"/>' +
      '<g class="p-body"><rect x="-0.2" y="-0.9" width="0.16" height="0.9" rx="0.07" fill="#1c2633"/><rect x="0.04" y="-0.9" width="0.16" height="0.9" rx="0.07" fill="#1c2633"/>' +
      '<rect x="-0.3" y="-1.55" width="0.6" height="0.75" rx="0.24" fill="' + col + '"/>' +
      '<circle cx="0" cy="-1.72" r="0.17" fill="' + col + '"/><circle cx="0" cy="-1.72" r="0.17" fill="#fff" opacity=".45"/>' +
      '<g class="p-rk" style="--r:' + r + '"><line x1="' + (0.28 * r) + '" y1="-1.2" x2="' + (0.62 * r) + '" y2="-1.35" stroke="#e8e8e8" stroke-width="0.07"/>' +
      '<ellipse cx="' + (0.82 * r) + '" cy="-1.42" rx="0.22" ry="0.16" fill="none" stroke="#f4f4f4" stroke-width="0.06"/></g></g>';
  }

  R.court = {
    proj,
    mount(host, opts){
      const surf = opts.surf;
      host.innerHTML = '<div class="c-wrap c-' + surf + '">' + svg(surf) + '<div class="c-call" id="ccall"></div></div>';
      const root = host.querySelector(".c-wrap"), sv = root.querySelector("svg");
      const ball = sv.querySelector(".ball"), bsh = sv.querySelector(".b-sh"), marks = sv.querySelector(".c-marks"), crowd = sv.querySelector(".crowd");
      const pl = [sv.querySelector(".pl0"), sv.querySelector(".pl1")];
      opts.players.forEach((p, i) => { pl[i].innerHTML = figure(p.col, p.hand); });
      const pos = [{ x: 0.5, y: -1 }, { x: -0.5, y: L + 1 }];
      let alive = true, raf = 0;
      const k1 = SPEED[surf];
      let pace = 1;

      function drawPlayer(i){
        const [sx, sy, k] = proj(pos[i].x, pos[i].y, 0);
        pl[i].setAttribute("transform", "translate(" + sx.toFixed(1) + " " + sy.toFixed(1) + ") scale(" + (k * 1.15).toFixed(2) + ")");
      }
      function drawBall(b){
        if(!b){ ball.style.opacity = 0; bsh.style.opacity = 0; return; }
        const [sx, sy, k] = proj(b.x, b.y, b.z), [hx, hy] = proj(b.x, b.y, 0);
        ball.setAttribute("cx", sx.toFixed(1)); ball.setAttribute("cy", sy.toFixed(1)); ball.setAttribute("r", Math.max(1.8, 0.2 * k).toFixed(2));
        bsh.setAttribute("cx", hx.toFixed(1)); bsh.setAttribute("cy", hy.toFixed(1)); bsh.setAttribute("rx", Math.max(1.6, 0.18 * k).toFixed(2)); bsh.setAttribute("ry", Math.max(0.6, 0.07 * k).toFixed(2));
        ball.style.opacity = 1; bsh.style.opacity = Math.max(0.15, 0.55 - b.z * 0.12);
      }
      const wait = ms => new Promise(res => setTimeout(res, ms));
      /* move along a path over dur ms; f(t) gives the ball, run: players moving meanwhile */
      function tween(dur, f, run){
        return new Promise(res => {
          const t0 = performance.now(), from = pos.map(p => ({ x: p.x, y: p.y }));
          const step = now => {
            if(!alive) return res();
            const t = Math.min(1, (now - t0) / dur);
            if(f) drawBall(f(t));
            (run || []).forEach(m => { const e = 1 - Math.pow(1 - Math.min(1, t * (m.fast || 1.25)), 2); pos[m.i].x = from[m.i].x + (m.x - from[m.i].x) * e; pos[m.i].y = from[m.i].y + (m.y - from[m.i].y) * e; drawPlayer(m.i); });
            if(t < 1) raf = requestAnimationFrame(step); else res();
          };
          raf = requestAnimationFrame(step);
        });
      }
      const swing = i => { R.fx.bump(pl[i].querySelector(".p-rk"), "sw"); };
      function mark(x, y, out){
        const [sx, sy, k] = proj(x, y, 0), e = document.createElementNS(NS, "ellipse");
        e.setAttribute("cx", sx.toFixed(1)); e.setAttribute("cy", sy.toFixed(1)); e.setAttribute("rx", (0.22 * k).toFixed(1)); e.setAttribute("ry", (0.08 * k).toFixed(1));
        e.setAttribute("class", "mk" + (out ? " out" : "")); marks.appendChild(e);
      }
      function call(text, cls){
        const c = root.querySelector("#ccall"); if(!c) return;
        c.className = "c-call"; void c.offsetWidth; c.className = "c-call show " + (cls || ""); c.textContent = text;
      }
      /* one flight: from a hit at a (z) to a bounce at b, then on to c (z) */
      function flight(a, b, c, apex, dur){
        const d1 = Math.hypot(b.x - a.x, b.y - a.y), d2 = c ? Math.hypot(c.x - b.x, c.y - b.y) : 0, t1 = d1 / (d1 + d2 || 1);
        return t => {
          if(t <= t1){ const u = t / t1; return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z * (1 - u) + 4 * apex * u * (1 - u) }; }
          const u = (t - t1) / (1 - t1); return { x: b.x + (c.x - b.x) * u, y: b.y + (c.y - b.y) * u, z: c.z * u + 4 * apex * 0.45 * u * (1 - u) };
        };
      }
      /* where the hitter's racket meets the ball */
      const hitAt = i => ({ x: pos[i].x + (opts.players[i].hand === "L" ? -0.7 : 0.7) * (i ? -1 : 1), y: pos[i].y + (i ? -0.2 : 0.2), z: 1 });
      const half = i => i === 0 ? [1.2, NET - 1.5] : [NET + 1.5, L - 1.2];
      const behind = i => i === 0 ? rnd(-1.6, -0.6) : L + rnd(0.6, 1.6);

      /* the ball from hitter i over the net; kind: "in" (receiver gets there), "winner", "net", "out" */
      async function rallyShot(i, kind, dur, slow){
        const o = 1 - i, a = hitAt(i);
        const [y0, y1] = half(o);
        let b = { x: rnd(-SW + 0.6, SW - 0.6), y: rnd(y0 + (y1 - y0) * 0.35, y1) };
        if(kind === "winner") b = { x: (pos[o].x > 0 ? -1 : 1) * rnd(SW - 0.9, SW - 0.3), y: o ? rnd(L - 4, L - 1) : rnd(1, 4) };
        if(kind === "out"){ const wide = Math.random() < 0.5; b = wide ? { x: (Math.random() < 0.5 ? -1 : 1) * rnd(SW + 0.2, SW + 1.1), y: o ? rnd(NET + 5, L - 2) : rnd(2, NET - 5) } : { x: rnd(-3, 3), y: o ? L + rnd(0.25, 1.4) : -rnd(0.25, 1.4) }; }
        swing(i); R.sfx.pock(kind === "winner" ? 1.3 : 0.9 + Math.random() * 0.2);
        if(kind === "net"){
          const n = { x: a.x + (b.x - a.x) * 0.5, y: NET + (o ? -0.15 : 0.15) };
          await tween(dur * 0.55, t => ({ x: a.x + (n.x - a.x) * t, y: a.y + (n.y - a.y) * t, z: 1 * (1 - t) + 0.7 * t + 4 * 0.25 * t * (1 - t) }));
          R.sfx.net(); call("Net", "out");
          await tween(dur * 0.35, t => ({ x: n.x, y: n.y + (o ? -0.6 : 0.6) * t, z: 0.7 * (1 - t * t) }));
          return;
        }
        const c = kind === "winner" ? { x: b.x * 1.25, y: o ? L + 4 : -4, z: 0.5 } : kind === "out" ? { x: b.x * 1.1, y: o ? L + 3 : -3, z: 0.4 } : { x: b.x + (o ? -0.7 : 0.7) * 0.6, y: behind(o), z: 1 };
        /* the receiver runs: all the way when it's in, part of the way for a winner, not for an out */
        const run = kind === "in" ? [{ i: o, x: c.x + (opts.players[o].hand === "L" ? 0.7 : -0.7) * (o ? -1 : 1), y: c.y, fast: 1.2 }] : kind === "winner" ? [{ i: o, x: pos[o].x + (b.x - pos[o].x) * 0.55, y: pos[o].y, fast: 1 }] : [];
        run.push({ i, x: pos[i].x * 0.5, y: behind(i) });
        const f = flight(a, b, c, rnd(1.3, 2.3) + (surf === "clay" ? 0.6 : 0), dur * (slow ? 3 : 1));
        const d1 = Math.hypot(b.x - a.x, b.y - a.y), d2 = Math.hypot(c.x - b.x, c.y - b.y), tB = d1 / (d1 + d2);
        setTimeout(() => { if(!alive) return; R.sfx.bounce(surf); mark(b.x, b.y, kind === "out"); if(kind === "out"){ call("Out!", "out"); R.sfx.call("Out!", { rate: 1.1 }); } }, dur * (slow ? 3 : 1) * tB);
        await tween(dur * (slow ? 3 : 1), f, run);
      }
      /* the serve from player i into the box for this side; kind: "in", "ace", "net", "long" */
      async function serve(i, side, kind, dur){
        const o = 1 - i, sgn = i === 0 ? 1 : -1, deuce = side === "deuce";
        const sx = sgn * (deuce ? 1 : -1) * rnd(0.4, 1.2), sy = i === 0 ? -0.3 : L + 0.3;
        pos[i] = { x: sx, y: sy }; drawPlayer(i);
        pos[o] = { x: (o === 0 ? 1 : -1) * (deuce ? 1 : -1) * 2.9, y: o === 0 ? -1.2 : L + 1.2 }; drawPlayer(o);
        const toss = { x: sx + sgn * 0.3, y: sy + (i ? -0.4 : 0.4) };
        await tween(380, t => ({ x: toss.x, y: toss.y, z: 1.2 + 1.8 * Math.sin(t * Math.PI * 0.62) }));
        const a = { x: toss.x, y: toss.y, z: 2.85 };
        const boxX = (o === 0 ? 1 : -1) * (deuce ? 1 : -1), y0 = o === 0 ? NET - SVC + 0.3 : NET + 0.4, y1 = o === 0 ? NET - 0.4 : NET + SVC - 0.3;
        let b = { x: boxX * rnd(0.4, SW - 0.4), y: rnd(y0, y1) };
        if(kind === "ace") b = { x: boxX * (Math.random() < 0.5 ? rnd(0.15, 0.6) : rnd(SW - 0.6, SW - 0.15)), y: o === 0 ? rnd(NET - SVC + 0.2, NET - SVC + 1.2) : rnd(NET + SVC - 1.2, NET + SVC - 0.2) };
        if(kind === "long") b = { x: boxX * rnd(0.6, SW - 0.6), y: o === 0 ? NET - SVC - rnd(0.3, 1.2) : NET + SVC + rnd(0.3, 1.2) };
        swing(i); R.sfx.pock(kind === "ace" ? 1.4 : 1.15); R.sfx.whoosh();
        if(kind === "net"){
          const n = { x: a.x + (b.x - a.x) * 0.55, y: NET + (o ? -0.15 : 0.15) };
          await tween(dur * 0.5, t => ({ x: a.x + (n.x - a.x) * t, y: a.y + (n.y - a.y) * t, z: a.z * (1 - t) + 0.75 * t }));
          R.sfx.net(); call(T("Fault", "Fout"), "out");
          await tween(dur * 0.3, t => ({ x: n.x, y: n.y + (o ? -0.5 : 0.5) * t, z: 0.75 * (1 - t * t) }));
          return;
        }
        const c = kind === "in" ? { x: pos[o].x + (o ? 0.7 : -0.7) * (opts.players[o].hand === "L" ? -1 : 1), y: pos[o].y, z: 1 } : { x: b.x * 1.4, y: o === 0 ? -5 : L + 5, z: 0.6 };
        const f = flight(a, b, c, 0.25, dur * 0.85), d1 = Math.hypot(b.x - a.x, b.y - a.y), d2 = Math.hypot(c.x - b.x, c.y - b.y), tB = d1 / (d1 + d2);
        setTimeout(() => { if(!alive) return; R.sfx.bounce(surf); mark(b.x, b.y, kind === "long"); if(kind === "long") call(T("Fault", "Fout"), "out"); }, dur * 0.85 * tB);
        const run = kind === "ace" ? [{ i: o, x: pos[o].x + (b.x - pos[o].x) * 0.4, y: pos[o].y, fast: 1.4 }] : kind === "in" ? [{ i: o, x: c.x - (o ? 0.7 : -0.7), y: c.y }] : [];
        await tween(dur * 0.85, f, run);
      }

      return {
        root,
        /* one point. sc: { server, side, first, end, w, shots, by, slow } (see rally.playPoint) */
        async play(sc){
          if(!alive) return;
          marks.innerHTML = ""; root.classList.remove("slow");
          const s = sc.server, r = 1 - s, base = 1000 * k1 * pace;
          drawBall(null);
          if(!sc.first){ await serve(s, sc.side, Math.random() < 0.55 ? "net" : "long", base * 1.1); await wait(420); marks.innerHTML = ""; }
          if(sc.end === "df"){ await serve(s, sc.side, Math.random() < 0.5 ? "net" : "long", base * 1.1); call(T("Double fault", "Dubbele fout"), "out"); return wait(500); }
          if(sc.end === "ace"){ if(sc.slow) root.classList.add("slow"); await serve(s, sc.side, "ace", base * (sc.slow ? 2.4 : 1.1)); call("Ace!", "ace"); return wait(450); }
          await serve(s, sc.side, "in", base * 1.1);
          /* the shots after the serve: the returner hits first */
          const n = Math.max(1, (sc.shots || 2) - 1), show = Math.min(n, 9), fast = n > show ? 0.8 : 1;
          let hitter = r;
          for(let k = 0; k < show; k++){
            const last = k === show - 1;
            if(last && sc.slow) root.classList.add("slow");
            let kind = "in";
            if(last){
              if(sc.end === "winner" || sc.end === "retW") kind = "winner";
              else if(sc.end === "unret" || sc.end === "retE") kind = Math.random() < 0.5 ? "net" : "out";
              else kind = Math.random() < 0.45 ? "net" : "out";
              /* the last shot is always hit by the right player */
              const by = kind === "winner" ? sc.w : 1 - sc.w;
              if(hitter !== by){ await rallyShot(hitter, "in", base * fast); hitter = by; }
            }
            await rallyShot(hitter, kind, base * fast * (k === 0 ? 0.9 : 1), last && sc.slow);
            if(last && kind === "winner") call("Winner", "ace");
            hitter = 1 - hitter;
          }
          await wait(380);
        },
        /* put both players in place for the next point */
        ready(server, side){
          const sgn = server === 0 ? 1 : -1, deuce = side === "deuce", o = 1 - server;
          pos[server] = { x: sgn * (deuce ? 1 : -1) * 0.8, y: server === 0 ? -0.3 : L + 0.3 };
          pos[o] = { x: (o === 0 ? 1 : -1) * (deuce ? 1 : -1) * 2.9, y: o === 0 ? -1.2 : L + 1.2 };
          drawPlayer(0); drawPlayer(1); drawBall(null); marks.innerHTML = "";
        },
        cheer(k){ crowd.classList.remove("cheer", "big"); void root.offsetWidth; crowd.classList.add("cheer"); if(k > 1) crowd.classList.add("big"); },
        call, setPace(p){ pace = p; },
        stop(){ alive = false; cancelAnimationFrame(raf); }
      };
    }
  };
})(window.RACKET);
