/* BALL 4: THE MATCH PAGE (_plans/match-centre.md §1.1).
 *
 * Phase 1, the preview from what the match centre already has: the season's fixtures it reads from pl_fixtures
 * (CL.mc), and no new call to anything. The scoreboard with your call and a derby; the win chance from this season's
 * goals (mc-stats.js, §3.4); each side's form; and this season side by side, every figure with its rank in the
 * league, the way PUCK compares two teams. Loaded the first time a match is opened (clMatchPage in pl.js), with
 * mc-stats.js and mc.css. Head to head, the story line, the report, absentees and line-ups come in later phases. */
const mcStats = () => window.MCStats;

/* THE DERBIES, by the feed's team keys sorted: the name the game goes by */
const MC_DERBIES = {
  "af:194|af:209": "De Klassieker", "af:194|af:197": "De Topper", "af:196|af:209": "Rotterdam derby", "af:209|af:426": "Rotterdam derby",
  "af:196|af:426": "Rotterdam derby", "af:202|af:210": "Derby of the North", "af:206|af:415": "Twente derby",
  "af:42|af:47": "North London derby", "af:33|af:50": "Manchester derby", "af:40|af:45": "Merseyside derby",
  "af:529|af:541": "El Clásico", "af:530|af:541": "Madrid derby", "af:536|af:543": "Seville derby", "af:529|af:540": "Barcelona derby",
  "af:489|af:505": "Milan derby", "af:487|af:497": "Rome derby", "af:496|af:503": "Turin derby", "af:496|af:505": "Derby d'Italia",
  "af:157|af:165": "Der Klassiker", "af:165|af:174": "Revierderby", "af:81|af:85": "Le Classique",
  "af:569|af:741": "Bruges derby", "af:554|af:733": "Belgian Clásico", "af:554|af:569": "De Topper" };
const mcDerby = (a, b) => MC_DERBIES[[clStr(a), clStr(b)].sort().join("|")] || "";
/* your call on this match, from any of your cards that has it (your own, so shown before kick-off too) */
function mcMyCall(fid){
  try{
    for(const id of Object.keys(CL.card || {})){
      if(!clF(id).some(f => String(f.id) === String(fid))) continue;
      const c = clMine(id).calls[fid];
      if(c) return c;
    }
  }catch(e){}
  return null;
}
const mcShortDate = ms => { const d = new Date(ms); return CL_DAYS[d.getDay()] + " " + d.getDate() + " " + CL_MONTHS[d.getMonth()]; };

function mcMatchPage(v){
  const C = CL_COMPS.find(c => c.id === v.comp) || CL_COMPS[0], m = clMcNeed(C.id), M = mcStats();
  if(!m || !M) return b4Page({ title: "Match", ctx: CL.mcErr || "Loading…", back: "clBack()", cls: "clpage mcpage", body: CL.mcErr ? "" : '<div class="lgskel"></div>' });
  const x = m.rows.find(r => String(r.id) === String(v.fid));
  if(!x) return b4Page({ title: "Match", ctx: C.name, back: "clBack()", cls: "clpage mcpage",
    body: '<div class="lgempty"><b>This match isn\'t in the season any more</b><span>It may have moved to another round.</span></div>' });
  const H = clTeam(x.h), A = clTeam(x.a), hc = clKit(H), ac = clKit(A);
  const done = clPlayed(x), live = x.st === "live" || x.st === "paused", off = /^(postponed|cancelled|suspended)$/.test(x.st);
  const figs = m.figs || (m.figs = M.figures(m.rows));
  const side = (T, t, c) => ({ name: T.name, short: T.code, flag: clPatchURL(t), color: c });
  const label = done ? (x.st === "awarded" ? "Awarded" : "Full time") : live ? "Kicked off" : off ? clStr(x.st).replace(/^./, s => s.toUpperCase())
    : mcShortDate(x.ko) + " · " + clTime(x.ko);
  const derby = mcDerby(x.h.key, x.a.key), call = mcMyCall(x.id);
  const tags = (derby ? '<span class="cl-tag gold">' + clE(derby) + '</span>' : "") + (call ? '<span class="cl-tag ghost">You called ' + call[0] + "–" + call[1] + '</span>' : "");
  const head = b4Score({ home: side(H, x.h, hc), away: side(A, x.a, ac), score: done ? [x.ft[0], x.ft[1]] : ["", ""], label }) +
    '<p class="mc-names"><button onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.h.key) + '\')">' + clE(H.name) + '</button><i>v</i>' +
    '<button onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.a.key) + '\')">' + clE(A.name) + '</button></p>' +
    (tags ? '<div class="mc-tags">' + tags + '</div>' : "") +
    (live ? '<p class="mc-note">Kicked off · the result after full time</p>' : "");
  const body = head + (done || live || off ? "" : mcChanceHTML(m.rows, x, H, A, hc, ac)) + mcFormHTML(m, x, H, A, !!v.fall) + mcSeasonHTML(figs, x, H, A);
  return b4Page({ title: done ? "Full time" : live ? "Kicked off" : "Preview", ctx: C.name + " · " + clRkLabel(clRk(x)), back: "clBack()", cls: "clpage mcpage", body });
}

/* THE WIN CHANCE (§3.4): a split bar in the two kits, "Based on this season's stats"; never odds, never a score */
function mcChanceHTML(rows, x, H, A, hc, ac){
  const c = mcStats().chance(rows, x.h.key, x.a.key, x);
  if(!c) return b4Sec("Win chance") + '<p class="mc-none">Not enough matches yet</p>';
  const seg = (n, bg, cls) => n ? '<span' + (cls ? ' class="' + cls + '"' : "") + ' style="flex:' + n + (bg ? ';background:' + bg + ';color:' + clInk(bg) : "") + '">' + (n >= 9 ? n + "%" : "") + '</span>' : "";
  return b4Sec("Win chance") +
    '<div class="cl-split mc-chance" role="img" aria-label="' + clE(H.name) + ' ' + c.h + '%, a draw ' + c.d + '%, ' + clE(A.name) + ' ' + c.a + '%">' +
      seg(c.h, hc) + seg(c.d, null, "d") + seg(c.a, ac) + '</div>' +
    '<div class="cl-splitlab"><span>' + clE(H.name) + '</span><span>Draw</span><span>' + clE(A.name) + '</span></div>' +
    '<p class="mc-fine">Based on this season\'s stats</p>';
}

/* FORM: the last five, newest on the right; the home side at home and the away side away, or everything */
function mcForm(all){ audio(); const v = clV(); v.fall = !!all; render(); }
function mcFormHTML(m, x, H, A, all){
  const pos = k => { const T = m.table.find(t => t.key === k); return T && T.p ? ordinal(T.pos) : ""; };
  const col = (t, T, venue) => {
    const f = mcStats().form(m.rows, t.key, all ? "all" : venue), p = pos(t.key);
    return '<div class="mc-fcol ' + venue + '"><b>' + clE(T.name) + '</b><small>' + (p ? p + " · " : "") + (all ? "all matches" : venue === "home" ? "at home" : "away") + '</small>' +
      (f.length ? clMcForm(f) : '<span class="mc-none">None yet</span>') + '</div>';
  };
  return b4Sec("Form") + '<div class="lgseg lgseg2 mc-fseg" role="group" aria-label="Form">' +
      '<button aria-pressed="' + !all + '" onclick="mcForm(false)">Home and away</button><button aria-pressed="' + all + '" onclick="mcForm(true)">All matches</button></div>' +
    '<div class="mc-form">' + col(x.h, H, "home") + col(x.a, A, "away") + '</div>';
}

/* THIS SEASON, side by side (PUCK's mirror): each bar grows out from the middle, the better side's in gold, and
   every figure carries its rank in the league */
function mcMirror(label, hv, av, o, i){
  const hi = Math.max(hv || 0, av || 0), good = o.low ? -1 : 1;
  const wd = v => v == null || !(hi > 0) ? 0 : Math.max(4, v / hi * 100);
  const best = hv == null || av == null || Math.abs(hv - av) < 1e-9 ? 0 : (hv - av) * good > 0 ? -1 : 1;
  const f = v => v == null ? "–" : o.dp ? v.toFixed(o.dp) : String(v);
  const rk = r => r ? '<em>' + ordinal(r) + '</em>' : "";
  return '<div class="mc-st" style="--i:' + i + '"><small>' + clE(label) + '</small>' +
    '<span class="v h' + (best < 0 ? " on" : "") + '">' + f(hv) + rk(o.hr) + '</span>' +
    '<span class="bar h' + (best < 0 ? " on" : "") + '"><i style="width:' + wd(hv).toFixed(1) + '%"></i></span>' +
    '<span class="bar a' + (best > 0 ? " on" : "") + '"><i style="width:' + wd(av).toFixed(1) + '%"></i></span>' +
    '<span class="v a' + (best > 0 ? " on" : "") + '">' + f(av) + rk(o.ar) + '</span></div>';
}
function mcSeasonHTML(figs, x, H, A){
  const h = figs[x.h.key], a = figs[x.a.key];
  if(!h || !a || !h.line.all.gp || !a.line.all.gp) return b4Sec("This season") + '<p class="mc-none">No league matches played yet</p>';
  const rows = [["Goals scored per match", "gf", "gf", 2], ["Goals conceded per match", "ga", "ga", 2, true], ["Clean sheets", "cs", "cs", 0],
    ["Failed to score", "fts", "fts", 0, true], ["Points per match: " + H.code + " at home, " + A.code + " away", "ppmHome", "ppmAway", 2]];
  return b4Sec("This season") + '<div class="mc-key"><span>' + clPatch(x.h, 20) + clE(H.code) + '</span><span>' + clE(A.code) + clPatch(x.a, 20) + '</span></div>' +
    '<div class="mc-mirror">' + rows.map(([label, fh, fa, dp, low], i) => mcMirror(label, h.v[fh], a.v[fa], { dp, low, hr: h.rank[fh], ar: a.rank[fa] }, i)).join("") + '</div>' +
    '<p class="mc-fine">Small figures: the rank in the league. From ' + (h.line.all.gp === a.line.all.gp ? h.line.all.gp + " league matches each" : "this season's league matches") + '.</p>';
}
