/* The snooker table as SVG, from above, in millimetres (the physics' own coordinates, so a
   ball at x, y is drawn at x, y): mahogany rails, cushions, six pockets, green baize under
   a hanging lamp, the baulk line, the D and the spots. The baulk end is at the bottom.
   D.table.svg({ cls, balls, lamp, mini }) returns the markup; balls are circles with
   data-id, moved later with D.table.put(svg, id, x, y). */
(function(D){
  const P = D.phys, RAIL = 150, CUSH = 46;
  const COL = { cue: "#f6f2e6", red: "#d0142c", yellow: "#f7c51d", green: "#13843f", brown: "#7a4521", blue: "#1f56d8", pink: "#f598bb", black: "#141414" };
  const colour = id => COL[P.kind(id)] || "#fff";
  const VB = [-RAIL, -RAIL, P.W + 2 * RAIL, P.L + 2 * RAIL];
  let uid = 0;

  function ball(b, k){
    const c = colour(b.id), r = P.R;
    return '<g class="bl" data-id="' + b.id + '" transform="translate(' + b.x.toFixed(1) + " " + b.y.toFixed(1) + ')"' + (b.on === false ? ' style="display:none"' : "") + ">" +
      '<ellipse class="bsh" cx="5" cy="9" rx="' + (r * 1.02).toFixed(1) + '" ry="' + (r * 0.92).toFixed(1) + '"/>' +
      '<circle r="' + r + '" fill="' + c + '"/><circle r="' + r + '" fill="url(#' + k + 'sh)"/>' +
      (b.id === "cue" ? "" : "") + "</g>";
  }
  function svg(o){
    o = o || {};
    const k = "tb" + (++uid) + "-", W = P.W, L = P.L, R = P.R;
    const pockets = P.POCKETS.map(p => {
      const [x, y] = p.at, r = p.corner ? 66 : 58, cx = p.corner ? x + (x ? 14 : -14) : x + (x ? 22 : -22), cy = p.corner ? y + (y ? 14 : -14) : y;
      return '<circle class="pk-rim" cx="' + cx + '" cy="' + cy + '" r="' + (r + 16) + '"/><circle class="pk" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
    }).join("");
    const spots = P.COLOURS.map(c => '<circle class="spot" cx="' + P.SPOT[c][0] + '" cy="' + P.SPOT[c][1] + '" r="5"/>').join("");
    return '<svg class="table' + (o.cls ? " " + o.cls : "") + '" viewBox="' + VB.join(" ") + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      "<defs>" +
        '<linearGradient id="' + k + 'wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a2c17"/><stop offset=".45" stop-color="#3a1a0c"/><stop offset="1" stop-color="#26100a"/></linearGradient>' +
        '<radialGradient id="' + k + 'cloth" cx=".5" cy=".5" r=".72"><stop offset="0" stop-color="#2b9150"/><stop offset=".55" stop-color="#1d7a3f"/><stop offset="1" stop-color="#0f4f27"/></radialGradient>' +
        '<radialGradient id="' + k + 'sh" cx=".34" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".18" stop-color="#fff" stop-opacity=".25"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>' +
        '<radialGradient id="' + k + 'lamp" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff6d8" stop-opacity=".16"/><stop offset=".7" stop-color="#fff6d8" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>' +
      "</defs>" +
      '<rect class="rail" x="' + VB[0] + '" y="' + VB[1] + '" width="' + VB[2] + '" height="' + VB[3] + '" rx="70" fill="url(#' + k + 'wood)"/>' +
      '<rect class="rail-hl" x="' + (VB[0] + 10) + '" y="' + (VB[1] + 10) + '" width="' + (VB[2] - 20) + '" height="' + (VB[3] - 20) + '" rx="62"/>' +
      (o.mini ? "" : [[-RAIL / 2, L * 0.25], [-RAIL / 2, L * 0.75], [W + RAIL / 2, L * 0.25], [W + RAIL / 2, L * 0.75], [W * 0.25, -RAIL / 2], [W * 0.75, -RAIL / 2], [W * 0.25, L + RAIL / 2], [W * 0.75, L + RAIL / 2]].map(d => '<circle class="diamond" cx="' + d[0] + '" cy="' + d[1] + '" r="9"/>').join("")) +
      '<rect class="cush" x="' + -CUSH + '" y="' + -CUSH + '" width="' + (W + 2 * CUSH) + '" height="' + (L + 2 * CUSH) + '" fill="#145f30"/>' +
      '<rect class="cloth" x="0" y="0" width="' + W + '" height="' + L + '" fill="url(#' + k + 'cloth)"/>' +
      '<rect class="nose" x="0" y="0" width="' + W + '" height="' + L + '"/>' +
      pockets +
      '<g class="marks"><line x1="0" y1="' + P.BAULK + '" x2="' + W + '" y2="' + P.BAULK + '"/><path d="M' + (P.CX - P.DR) + " " + P.BAULK + " A" + P.DR + " " + P.DR + " 0 0 0 " + (P.CX + P.DR) + " " + P.BAULK + '"/>' + spots + "</g>" +
      '<g class="lit"></g><g class="guide"></g>' +
      '<g class="balls">' + (o.balls || []).map(b => ball(b, k)).join("") + "</g>" +
      '<g class="fx"></g>' +
      (o.lamp === false ? "" : '<rect class="lamp" x="0" y="0" width="' + W + '" height="' + L + '" fill="url(#' + k + 'lamp)" pointer-events="none"/>') +
      "</svg>";
  }
  /* move a ball (or hide it with x == null) */
  function put(svgEl, id, x, y){
    const g = svgEl.querySelector('.bl[data-id="' + id + '"]'); if(!g) return;
    if(x == null){ g.style.display = "none"; return; }
    g.style.display = ""; g.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")");
  }
  /* the shine gradient id inside a table svg (for balls added later) */
  const key = svgEl => { const g = svgEl.querySelector("radialGradient[id$='sh']"); return g ? g.id.slice(0, -2) : "tb0-"; };
  function addBall(svgEl, b){ svgEl.querySelector(".balls").insertAdjacentHTML("beforeend", ball(b, key(svgEl))); }
  /* a ball as a small HTML chip (for the score bar and lists) */
  const chip = (id, cls) => '<i class="bchip' + (cls ? " " + cls : "") + '" style="--bc:' + colour(id) + '"></i>';

  D.table = { svg, put, addBall, colour, chip, VB, RAIL, COL };
})(window.DART);
