/* BALL 4: THE MATCH PAGE (_plans/match-centre.md §1.1).
 *
 * Phase 1, the preview from what the match centre already has (CL.mc, read from pl_fixtures): the scoreboard with
 * your call and a derby; the win chance from this season's goals (mc-stats.js, §3.4); each side's form; and this
 * season side by side, every figure with its rank in the league, the way PUCK compares two teams.
 * Phase 3 adds what 014 stores: the story line and head to head on the preview, your league's calls once it has
 * kicked off, and after full time the report (the goals and sendings off, the match's statistics, how your league
 * called it, the brave call). Each part only shows when its data is there: a server without 014 shows phase 1.
 * Loaded the first time a match is opened (clMatchPage in pl.js), with mc-stats.js and mc.css. */
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
const mcPair = x => [clStr(x.h.key), clStr(x.a.key)].sort().join("|");
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
const mcDay = d => { const t = new Date(clStr(d).slice(0, 10) + "T12:00:00Z"); return isNaN(t) ? "" : t.getUTCDate() + " " + CL_MONTHS[t.getUTCMonth()] + " " + t.getUTCFullYear(); };

/* 014's tables, a row at a time: undefined while it comes, null when there is none (or no 014 on the server yet).
   Asked once in a while, kept five minutes, like the match centre's own data */
function mcRow(key, table, col, val, cols){
  const C = CL.mcx || (CL.mcx = {}), c = C[key];
  if((!c || Date.now() - c.at > 5 * 60e3) && clOnce("mcx:" + key, c ? 60000 : 15000)){
    const keep = row => { C[key] = { at: Date.now(), row }; clRedraw(); };
    try{
      const sb = sbClient();
      if(sb && sb.from) Promise.resolve(sb.from(table).select(cols).eq(col, val))
        .then(r => keep(r && !r.error && Array.isArray(r.data) && r.data[0] ? r.data[0] : null), () => keep(null));
      else C[key] = { at: Date.now(), row: null };
    }catch(e){ C[key] = { at: Date.now(), row: null }; }
  }
  return c ? c.row : undefined;
}
const mcH2hRows = x => { const r = mcRow("h2h:" + mcPair(x), "pl_h2h", "pair", mcPair(x), "rows,fetched_at"); return r === undefined ? undefined : r && Array.isArray(r.rows) ? r.rows : null; };
const mcDetail = x => mcRow("det:" + x.id, "pl_fixture_detail", "fixture_id", x.id, "events,statistics,final,fetched_at");

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
  /* a cup tie decided after 90 minutes: the 90 minutes are the score (what Call It judges), the rest is a note */
  const after = done && x.end && x.end !== "REG" ? (x.end === "PEN" ? "Penalties" : "After extra time") + (x.fin ? ": " + x.fin[0] + "–" + x.fin[1] : "") : "";
  const head = b4Score({ home: side(H, x.h, hc), away: side(A, x.a, ac), score: done ? [x.ft[0], x.ft[1]] : ["", ""], label }) +
    (after ? '<p class="mc-after">' + clE(after) + '</p>' : "") +
    '<p class="mc-names"><button onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.h.key) + '\')">' + clE(H.name) + '</button><i>v</i>' +
    '<button onclick="clClubGo(\'' + C.id + '\',\'' + clE(x.a.key) + '\')">' + clE(A.name) + '</button></p>' +
    (tags ? '<div class="mc-tags">' + tags + '</div>' : "") +
    (live ? '<p class="mc-note">Kicked off · the result after full time</p>' : "");
  let body;
  if(done){
    const det = mcDetail(x);
    body = head + mcBraveHTML(m, x, H, A) + mcTimelineHTML(det, x) + mcStatsHTML(det, x, H, A) + mcCallsHTML(x, H, A, hc, ac, true) +
      mcFormHTML(m, x, H, A, !!v.fall) + mcSeasonHTML(figs, x, H, A);
  }else{
    const meet = mcH2hRows(x);
    body = head + (live || off ? "" : mcStoryHTML(m, x, H, A, meet, C) + mcChanceHTML(m.rows, x, H, A, hc, ac)) +
      (live ? mcCallsHTML(x, H, A, hc, ac, false) : "") + mcFormHTML(m, x, H, A, !!v.fall) + mcH2hHTML(meet, x, H, A) + mcSeasonHTML(figs, x, H, A);
  }
  return b4Page({ title: done ? "Full time" : live ? "Kicked off" : "Preview", ctx: C.name + " · " + clRkLabel(clRk(x)), back: "clBack()", cls: "clpage mcpage", body });
}

/* THE STORY LINE (§3.3): one true sentence, in Lora, under the names. Before kick-off only. The three European cups
   are the competitions here that are not leagues, so their lines say the name ("…in the Champions League this season") */
const MC_CUPS = { "fb.CL": "Champions League", "fb.EL": "Europa League", "fb.ECL": "Conference League" };
function mcStoryHTML(m, x, H, A, meet, C){
  const pos = {};
  (m.table || []).forEach(t => { if(t.p) pos[t.key] = t.pos; });
  const s = mcStats().story({ rows: m.rows, x, h2h: meet || null, hn: H.name, an: A.name, pos, teams: (m.table || []).filter(t => t.p).length,
    cup: (C && MC_CUPS[C.id]) || null });
  return s ? '<p class="mc-story">' + clE(s.t) + '</p>' : "";
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

/* HEAD TO HEAD (§1.1 item 5): the last five meetings, the newest first and lit, and what they add up to */
function mcH2hHTML(meet, x, H, A){
  if(!Array.isArray(meet)) return "";
  if(!meet.length) return b4Sec("Head to head") + '<p class="mc-none">No meetings in recent years</p>';
  const s = mcStats().h2hSummary(meet, x.h.key, x.a.key), pl = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  const row = (r, i) => {
    const hn = clTeam({ key: r.h, name: r.hn }).name, an = clTeam({ key: r.a, name: r.an }).name, ft = r.ft || [], hw = ft[0] > ft[1], aw = ft[1] > ft[0];
    return '<div class="mc-meet' + (i ? "" : " last") + '"><span class="d">' + clE(mcDay(r.d)) + '<small>' + clE(r.comp || "") + '</small></span>' +
      '<span class="t"><span class="' + (hw ? "w" : "") + '">' + clE(hn) + '</span><i>' + ft[0] + '–' + ft[1] + '</i><span class="' + (aw ? "w" : "") + '">' + clE(an) + '</span>' +
      (r.end ? '<small>' + (r.end === "PEN" ? "on penalties" : "after extra time") + '</small>' : "") + '</span></div>';
  };
  return b4Sec("Head to head") + '<p class="mc-h2hsum"><b>' + clE(H.name) + '</b> ' + pl(s.a, "win") + ' · ' + pl(s.d, "draw") + ' · <b>' + clE(A.name) + '</b> ' + pl(s.b, "win") + '</p>' +
    '<div class="mc-meets">' + meet.slice(0, 5).map(row).join("") + '</div>';
}

/* THIS SEASON, side by side (PUCK's mirror): each bar grows out from the middle, the better side's in gold, and
   every figure carries its rank in the league */
function mcMirror(label, hv, av, o, i){
  const hi = Math.max(hv || 0, av || 0), good = o.low ? -1 : 1;
  const wd = v => v == null || !(hi > 0) ? 0 : Math.max(4, v / hi * 100);
  const best = hv == null || av == null || Math.abs(hv - av) < 1e-9 ? 0 : (hv - av) * good > 0 ? -1 : 1;
  const f = v => v == null ? "–" : (o.dp ? v.toFixed(o.dp) : String(Math.round(v))) + (o.suf || "");
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
  return b4Sec("This season") + mcKey(x, H, A) +
    '<div class="mc-mirror">' + rows.map(([label, fh, fa, dp, low], i) => mcMirror(label, h.v[fh], a.v[fa], { dp, low, hr: h.rank[fh], ar: a.rank[fa] }, i)).join("") + '</div>' +
    '<p class="mc-fine">Small figures: the rank in the league. From ' + (h.line.all.gp === a.line.all.gp ? h.line.all.gp + " league matches each" : "this season's league matches") + '.</p>';
}
const mcKey = (x, H, A) => '<div class="mc-key"><span>' + clPatch(x.h, 20) + clE(H.code) + '</span><span>' + clE(A.code) + clPatch(x.a, 20) + '</span></div>';

/* ---------- after full time: the report (§1.1) ---------- */

/* THE GOALS AND THE SENDINGS OFF on a line between the two sides. Which side the feed files an own goal under is
   checked against the score at 90 minutes, so it always lands on the side it counted for */
const MC_RED = '<svg class="mc-red" viewBox="0 0 10 14" aria-hidden="true"><rect x="1" y="1" width="8" height="12" rx="1.5"/></svg>';
function mcTimelineHTML(det, x){
  if(!det || !Array.isArray(det.events)) return "";
  const ev = det.events, other = s => s === "h" ? "a" : "h";
  const tally = flip => { const t = { h: 0, a: 0 };
    for(const e of ev) if(e.m <= 90 && /^(goal|pen|og)$/.test(e.k)) t[e.k === "og" && flip ? other(e.s) : e.s]++;
    return t; };
  const asIs = tally(false), flipped = tally(true);
  const flip = !(asIs.h === x.ft[0] && asIs.a === x.ft[1]) && flipped.h === x.ft[0] && flipped.a === x.ft[1];
  const shown = ev.filter(e => /^(goal|pen|og|miss|red|red2)$/.test(e.k));
  if(!shown.length) return b4Sec("The match") + '<p class="mc-none">' + (x.ft[0] + x.ft[1] ? "No details from this match" : "No goals") + '</p>';
  const what = e => e.k === "pen" ? " (pen.)" : e.k === "og" ? " (o.g.)" : e.k === "miss" ? " missed a penalty" : e.k === "red2" ? " sent off, second yellow" : e.k === "red" ? " sent off" : "";
  const icon = e => e.k === "red" || e.k === "red2" ? MC_RED : e.k === "miss" ? ico("close") : ico("ball");
  return b4Sec("The match") + '<div class="mc-tl">' + shown.map((e, i) => {
    const s = e.k === "og" && flip ? other(e.s) : e.s, min = e.m + "'" + (e.x ? "+" + e.x : "");
    const txt = '<span class="ic">' + icon(e) + '</span><span class="who"><b>' + clE(e.p || "") + '</b>' + clE(what(e)) +
      (e.a ? '<small>' + clE(e.a) + '</small>' : "") + '</span>';
    return '<div class="mc-ev ' + s + (/^red/.test(e.k) ? " red" : e.k === "miss" ? " miss" : "") + '" style="--i:' + i + '">' +
      (s === "h" ? '<span class="side h">' + txt + '</span>' : '<span class="side"></span>') + '<span class="min">' + min + '</span>' +
      (s === "a" ? '<span class="side a">' + txt + '</span>' : '<span class="side"></span>') + '</div>';
  }).join("") + '</div>';
}

/* THE MATCH IN NUMBERS: the feed's statistics side by side, expected goals when it has them */
function mcStatsHTML(det, x, H, A){
  const s = det && det.statistics;
  if(!s || !s.h || !s.a) return "";
  const rows = [["Shots", "shots"], ["Shots on target", "on"], ["Possession", "poss", 0, false, "%"], ["Corners", "corners"],
    ["Fouls", "fouls", 0, true], ["Yellow cards", "yellow", 0, true], ["Red cards", "red", 0, true]];
  if(s.h.xg != null && s.a.xg != null) rows.splice(2, 0, ["Expected goals", "xg", 2]);
  return b4Sec("The match in numbers") + mcKey(x, H, A) + '<div class="mc-mirror">' +
    rows.filter(r => s.h[r[1]] != null || s.a[r[1]] != null).map(([label, k, dp, low, suf], i) =>
      mcMirror(label, s.h[k] == null ? null : +s.h[k], s.a[k] == null ? null : +s.a[k], { dp, low, suf }, i)).join("") + '</div>';
}

/* YOUR LEAGUE ON THIS MATCH: from the first of your cards that has it, its league's board (Call It's reveal, loaded
   once in a while). Calls stay hidden until kick-off, so this is only drawn after it */
function mcBoard(fid){
  try{
    for(const id of Object.keys(CL.card || {})){
      if(!clF(id).some(f => String(f.id) === String(fid))) continue;
      const k = CL.card[id], series = k && k.card && k.card.series, lg = (CL.leagues || []).find(l => l.series === series);
      if(!lg) continue;
      const key = lg.id + ":" + id;
      if(clOnce("mcb:" + key, 60000)) clLoadBoard(lg.id, id);
      return { lg, b: CL.board[key] || null, rules: k.rules || null };
    }
  }catch(e){}
  return null;
}
function mcCallsHTML(x, H, A, hc, ac, done){
  const L = mcBoard(x.id);
  if(!L || !L.b) return "";
  const bf = (L.b.fixtures || []).find(f => String(f.id) === String(x.id)) || {};
  const ms = (L.b.members || []).filter(m => m.calls && m.calls[x.id]).sort((p, q) => (q.me ? 1 : 0) - (p.me ? 1 : 0));
  if(!ms.length) return "";
  /* a match moved out of the card's window counts for nothing on it, so it gets no points here either */
  const P = window.PLScore, ft = done && bf.in !== false ? x.ft : null, exact = [];
  const mult = L.rules && +L.rules.armband > 1 ? +L.rules.armband : 2;
  const rows = ms.map(m => {
    const c = m.calls[x.id], arm = String(m.armband) === String(x.id);
    let pts = null, cls = "";
    /* the server's own points and flags once it has scored the call ([h, a, points, flags]), so this page and the
       table never disagree; until then worked out the same way here, with the crowd as it stood at kick-off */
    const r = !ft ? null : c[2] != null ? { pts: +c[2] || 0, flags: +c[3] || 0 }
      : P && P.points ? P.points(c[0], c[1], ft[0], ft[1], L.rules, bf.crowd || null) : null;
    if(r){
      pts = r.pts * (arm ? mult : 1);
      cls = r.flags & 4 ? " exact" : r.flags & 1 ? " right" : " off";
      if(r.flags & 4) exact.push(m.me ? "You" : clStr(m.display_name));
    }
    return '<div class="mc-call' + cls + (m.me ? " me" : "") + '">' + clCrest(m, 24) + '<span class="n">' + clE(m.me ? "You" : m.display_name) + '</span>' +
      (arm ? '<span class="cl-c sm">C</span>' : "") + '<b>' + c[0] + '–' + c[1] + '</b>' + (pts != null ? '<em>' + (pts ? "+" + pts : "0") + '</em>' : "") + '</div>';
  }).join("");
  const sp = bf.league;
  const split = sp && sp.n ? '<div class="cl-split" role="img" aria-label="' + sp.h + ' for ' + clE(H.name) + ', ' + sp.d + ' for a draw, ' + sp.a + ' for ' + clE(A.name) + '">' +
    (sp.h ? '<span style="flex:' + sp.h + ';background:' + hc + ';color:' + clInk(hc) + '">' + sp.h + '</span>' : "") + (sp.d ? '<span class="d" style="flex:' + sp.d + '">' + sp.d + '</span>' : "") +
    (sp.a ? '<span style="flex:' + sp.a + ';background:' + ac + ';color:' + clInk(ac) + '">' + sp.a + '</span>' : "") + '</div>' +
    '<div class="cl-splitlab"><span>' + clE(H.name) + '</span><span>Draw</span><span>' + clE(A.name) + '</span></div>' : "";
  return b4Sec(done ? "How " + clStr(L.lg.name) + " called it" : clStr(L.lg.name) + "'s calls") + split + '<div class="mc-calls">' + rows + '</div>' +
    (exact.length ? '<p class="mc-called">Called it: ' + clE(exact.length > 2 ? exact.slice(0, -1).join(", ") + " and " + exact[exact.length - 1] : exact.join(" and ")) + '.</p>' : "");
}

/* THE BRAVE CALL (§1.1 report item 5): your call against a low chance, as it stood at kick-off */
function mcBraveHTML(m, x, H, A){
  const c = mcMyCall(x.id);
  if(!c || !clPlayed(x)) return "";
  const ch = mcStats().chance(m.rows.filter(r => r.ko < x.ko), x.h.key, x.a.key, x);
  if(!ch) return "";
  const pick = c[0] > c[1] ? "h" : c[0] < c[1] ? "a" : "d", pct = ch[pick];
  if(pct >= 25) return "";
  const res = x.ft[0] > x.ft[1] ? "h" : x.ft[0] < x.ft[1] ? "a" : "d";
  const who = pick === "h" ? H.name : pick === "a" ? A.name : "a draw";
  return '<p class="mc-brave">You called ' + clE(who) + ' at ' + pct + '%' + (res === pick ? ", and you were right." : ". Brave.") + '</p>';
}

/* ---------- MC v3: THE PAGES STREAM (_plans/match-centre-v3.md §1.1 items 6–7) ----------
   The competition page's Leaders and Stats tabs, the player sheet, and the middle of the club page: its position this
   season, this season against the league, its scorers, its absentees, and the story line of its next match. pl.js
   draws the rest of both pages and asks for these once this file is here. The charts are the charts stream's
   (clChart in pl.js: "" when they are not here), so each part also stands on its own numbers. */

/* how long ago, plainly: "2h ago" */
function mcAgo(ms){
  if(!(ms > 0)) return "";
  const n = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return n < 2 ? "just now" : n < 60 ? n + " min ago" : n < 1440 ? Math.round(n / 60) + "h ago" : n < 2880 ? "yesterday" : Math.round(n / 1440) + " days ago";
}
const mcUp = s => clStr(s).charAt(0).toLowerCase() + clStr(s).slice(1);

/* THE LEADERS (match-centre.md §1.3; 014's pl_leaders rows {r, n, t, tn, mp, min, g, a, y, rc}, public to read): a
   competition's three lists, read when its Leaders tab or one of its club pages first wants them, kept half an hour
   (they change once a night), asked at most once a minute; a failed read is tried again after a minute */
const MC_LEAD = { goals: { tab: "Goals", f: "g", one: "goal", many: "goals", top: "Top scorer" },
  assists: { tab: "Assists", f: "a", one: "assist", many: "assists", top: "Top for assists" },
  cards: { tab: "Cards", f: "y", one: "yellow card", many: "yellow cards", top: "Most booked" } };
/* number one's shirt (the icon set's, filled): his club's kit colour, the figure on its back in the ink that reads on it */
const MC_SHIRT = "M15.5 3a3.5 3.5 0 0 1-7 0L3 6.5l2.5 4 2-1.2V21h9V9.3l2 1.2 2.5-4z";
/* a list by its figure, the feed's order between equals */
const mcLeadSort = (rows, kind) => { const f = MC_LEAD[kind].f;
  return rows.filter(p => p && p.n).map((p, i) => [p, i]).sort((a, b) => (b[0][f] | 0) - (a[0][f] | 0) || a[1] - b[1]).map(x => x[0]); };
/* a shared place for a shared figure */
const mcLeadRank = (list, p, f) => 1 + list.filter(o => (o[f] | 0) > (p[f] | 0)).length;
/* the season's lists by kind: {goals: {rows, at}, ...}; undefined while the first read is on its way */
function mcLeadNeed(comp, season){
  const C = CL.lead || (CL.lead = {}), c = C[comp];
  if((!c || Date.now() - c.at > 30 * 60e3) && clOnce("lead:" + comp, 60000)){
    const set = (all, ok) => { C[comp] = { at: ok ? Date.now() : Date.now() - 29 * 60e3, all }; };
    try{
      const sb = sbClient();
      if(sb && sb.from) Promise.resolve(sb.from("pl_leaders").select("season,kind,rows,fetched_at").eq("competition_id", comp))
        .then(r => { if(r && !r.error && Array.isArray(r.data)) set(r.data, true); else set([], false); clRedraw(); }, () => { set([], false); clRedraw(); });
      else set([], false);
    }catch(e){ set([], false); }
  }
  const d = C[comp];
  if(!d) return undefined;
  const ok = d.all.filter(x => x && MC_LEAD[x.kind] && Array.isArray(x.rows));
  const ss = [...new Set(ok.map(x => clStr(x.season)))].sort(), s = season != null && ss.includes(clStr(season)) ? clStr(season) : ss[ss.length - 1];
  const out = {};
  ok.filter(x => clStr(x.season) === s).forEach(x => { out[x.kind] = { rows: mcLeadSort(x.rows, x.kind), at: Date.parse(x.fetched_at) || 0 }; });
  return out;
}
function mcLead(k){ audio(); const v = clV(); v.lk = k; render(); }
/* THE LEADERS TAB: Goals · Assists · Cards (Cards only when the feed has them, decision 3). Number one on a dark card
   with his figure on a shirt in his club's kit colour (no photo); then 2 to 10 as rows; a tap opens his season */
function mcLeadersHTML(C, m, v){
  const L = mcLeadNeed(C.id, m.season);
  if(L === undefined) return '<div class="lgskel"></div>';
  const kinds = Object.keys(MC_LEAD).filter(k => L[k] && L[k].rows.length);
  if(!kinds.length) return '<div class="lgempty"><b>No leaders yet</b><span>Leaders arrive with the next sync.</span></div>';
  const kind = kinds.includes(v.lk) ? v.lk : kinds[0], K = MC_LEAD[kind], list = L[kind].rows.slice(0, 10), fk = clFollowKey(m);
  const one = list[0], T1 = clTeam({ key: one.t, name: one.tn }), n1 = one[K.f] | 0;
  const kit = T1.own ? clKit(T1) : (typeof CL_C !== "undefined" ? CL_C.gold1 : "#f3cd6b"), ink = clInk(kit);
  const joint = list.filter(p => (p[K.f] | 0) === n1).length > 1;
  const go = i => 'mcPlayer(\'' + C.id + '\',\'' + kind + '\',' + i + ')';
  const card = '<button class="b4card dark mc-lead1" onclick="' + go(0) + '">' +
    '<span class="mc-fg"><svg class="mc-shirt" viewBox="0 0 24 24" width="96" height="96" aria-hidden="true"><path d="' + MC_SHIRT + '" fill="' + clE(kit) + '"/>' +
      '<text x="12" y="17.2" text-anchor="middle" fill="' + ink + '">' + n1 + '</text></svg>' +
      '<small>' + (n1 === 1 ? K.one : K.many) + '</small></span>' +
    '<span class="who"><span class="cl-kick">' + (joint ? "Joint " + mcUp(K.top) : K.top) + '</span><b class="nm">' + clE(one.n) + '</b>' +
      '<span class="club">' + clPatch({ key: one.t, name: one.tn }, 22) + '<span>' + clE(T1.name) + '</span></span>' +
      '<small class="meta">' + (one.mp | 0) + ' matches · ' + (one.min | 0) + ' min' + (kind === "cards" && one.rc ? ' · ' + one.rc + ' red' : "") + '</small></span></button>';
  const rows = list.slice(1).map((p, j) => {
    const T = clTeam({ key: p.t, name: p.tn });
    return '<button class="mc-lrow' + (fk && p.t === fk ? " fol" : "") + '" onclick="' + go(j + 1) + '"><span class="rk">' + mcLeadRank(list, p, K.f) + '</span>' + clPatch({ key: p.t, name: p.tn }, 22) +
      '<span class="nm"><b>' + clE(p.n) + '</b><small>' + clE(T.name) + (kind === "cards" && p.rc ? " · " + p.rc + " red" : "") + '</small></span><span class="mp">' + (p.mp | 0) + '</span><span class="mc-fg">' + (p[K.f] | 0) + '</span></button>';
  }).join("");
  return clSubTabs(kinds.map(k => [k, MC_LEAD[k].tab]), kind, "mcLead", "Which list") + card +
    (rows ? '<div class="b4card cream mc-leadlist"><div class="mc-lrow hd" aria-hidden="true"><span>#</span><span></span><span>Player</span><span>MP</span><span>' + K.tab + '</span></div>' + rows + '</div>' : "") +
    '<p class="mc-fine">' + (L[kind].at ? "Updated " + mcAgo(L[kind].at) + ". " : "") + 'Tap a player for his season.</p>';
}
/* THE PLAYER SHEET: his season line and his club; no player pages */
function mcPlayer(comp, kind, i){
  audio();
  const L = mcLeadNeed(comp, (CL.mc[comp] || {}).season), p = L && L[kind] && L[kind].rows[i];
  if(!p) return;
  const C = CL_COMPS.find(c => c.id === comp) || { name: "" }, T = clTeam({ key: p.t, name: p.tn }), v = clV();
  const cell = (n, lab) => '<span><b>' + (n | 0) + '</b><small>' + lab + '</small></span>';
  const per = p.g > 0 && p.min > 0 ? "A goal every " + Math.round(p.min / p.g) + " minutes." : p.a > 0 && p.min > 0 ? "An assist every " + Math.round(p.min / p.a) + " minutes." : "";
  const here = v.s === "club" && v.team === p.t;
  sheet('<div class="mc-psheet"><span class="cl-kick">' + clE(C.name) + ' · this season</span><h2>' + clE(p.n) + '</h2>' +
    '<p class="mc-psclub">' + clPatch({ key: p.t, name: p.tn }, 28) + '<span>' + clE(T.name) + '</span></p>' +
    '<div class="mc-psgrid">' + cell(p.g, "Goals") + cell(p.a, "Assists") + cell(p.mp, "Matches") + cell(p.min, "Minutes") + cell(p.y, "Yellow cards") + cell(p.rc, "Red cards") + '</div>' +
    (per ? '<p class="mc-psline">' + per + '</p>' : "") +
    (here ? "" : b4Btn(clE(T.name) + " ›", "closeSheet();clClubGo('" + comp + "','" + clE(p.t) + "')", "dark")) +
    '<button class="acnot" onclick="closeSheet()">Close</button></div>');
}

/* THE STATS TAB: each chart under its heading with one line on what to look at. A cup's league stage gets the race and
   the biggest wins only. Without the charts module the numbers this file can work out itself stand in: the biggest
   wins as a list, home and away as a plain table */
function mcStatsTabHTML(C, m, v){
  const cup = clCupStage(C.id), fk = clFollowKey(m);
  const sec = (title, cap, html) => html ? b4Sec(title) + '<p class="mc-cap">' + cap + '</p>' + html : "";
  const chart = (fn, ...a) => { const s = clChart(fn, ...a); return s ? '<div class="mc-chart mcs-' + fn + '">' + s + '</div>' : ""; };
  const body = sec("The race", cup ? "Who's going through: points after each matchday." : "Who's pulling away: points after each matchday.", chart("race", m, { follow: fk, n: 6 })) +
    (cup ? "" : sec("Goals for and against", "Scored and conceded, the best goal difference first.", chart("goals", m, { follow: fk }))) +
    (cup ? "" : sec("Home and away", "Who makes their ground count, and who travels well.", chart("homeAway", m, fk || undefined) || mcHomeAwayHTML(C, m, fk))) +
    (cup ? "" : sec("Form", "The last five of every club, newest on the right.", chart("form", m, { follow: fk }))) +
    sec("Biggest wins", "The widest margins of the season so far.", chart("bigWins", m, 5) || mcBigWinsHTML(C, m, 5));
  return body || '<div class="lgempty"><b>No stats yet</b><span>The numbers start with the season\'s first results.</span></div>';
}
/* home and away as a plain table: won-drawn-lost and points, the table's order */
function mcHomeAwayHTML(C, m, fk){
  const M = mcStats(), T = m.table.filter(t => t.p);
  if(!M || !T.length) return "";
  const rec = s => s.w + "-" + s.d + "-" + s.l;
  return '<div class="b4card cream mc-ha"><div class="mc-harow hd" aria-hidden="true"><span>#</span><span></span><span>Club</span><span>Home</span><span>Pts</span><span>Away</span><span>Pts</span></div>' +
    T.map(t => {
      const s = M.line(m.rows, t.key), nm = clTeam(t).name;
      return '<button class="mc-harow' + (t.key === fk ? " fol" : "") + '" onclick="clClubGo(\'' + C.id + '\',\'' + clE(t.key) + '\')" aria-label="' + clE(nm) + ': at home ' +
        s.home.w + ' won, ' + s.home.d + ' drawn, ' + s.home.l + ' lost, ' + clPts(s.home.pts) + '; away ' + s.away.w + ' won, ' + s.away.d + ' drawn, ' + s.away.l + ' lost, ' + clPts(s.away.pts) + '">' +
        '<span class="pos">' + t.pos + '</span>' + clPatch(t, 22) + '<span class="nm">' + clE(nm) + '</span><span class="rec">' + rec(s.home) + '</span><span class="pts">' + s.home.pts + '</span>' +
        '<span class="rec">' + rec(s.away) + '</span><span class="pts">' + s.away.pts + '</span></button>';
    }).join("") + '</div>';
}
/* the biggest wins: the widest margins, then the most goals, then the latest; each opens its match */
function mcBigWinsHTML(C, m, n){
  const won = m.rows.filter(x => clPlayed(x) && x.ft[0] !== x.ft[1]).map(x => ({ x, g: Math.abs(x.ft[0] - x.ft[1]), t: x.ft[0] + x.ft[1] }))
    .sort((p, q) => q.g - p.g || q.t - p.t || q.x.ko - p.x.ko).slice(0, n || 5);
  if(!won.length) return "";
  return '<div class="mc-wins">' + won.map(({ x, g }) => {
    const hw = x.ft[0] > x.ft[1];
    return '<button class="mc-win" onclick="clMatchGo(\'' + C.id + '\',\'' + clE(x.id) + '\')"><span class="d">' + clE(mcShortDate(x.ko)) + '<small>' + clE(clRkLabel(clRk(x))) + '</small></span>' +
      '<span class="t"><span class="' + (hw ? "w" : "") + '">' + clE(clTeam(x.h).name) + '</span><i>' + x.ft[0] + '–' + x.ft[1] + '</i><span class="' + (hw ? "" : "w") + '">' + clE(clTeam(x.a).name) + '</span></span>' +
      '<span class="mg">+' + g + '</span></button>';
  }).join("") + '</div>';
}

/* THE CLUB PAGE'S MIDDLE: its position this season (the charts stream's line, with this competition's zones), this
   season against the league, its scorers and its absentees for the next match */
function mcClubMoreHTML(C, m, key, name, next){
  const pos = clChart("position", m, key, { zones: CL_ZONES[C.id] || null });
  return (pos ? b4Sec("Position this season") + '<p class="mc-cap">Where they stood after each matchday, and the zones they moved through.</p><div class="mc-chart mcs-position">' + pos + '</div>' : "") +
    mcClubSeasonHTML(C, m, key, name) + mcClubLeadHTML(C, m, key, name) + mcClubAbsHTML(C, key, next && next[0]);
}
/* THIS SEASON, the club against the league's average, as the match page's mirror: the club's bar gold where it beats the
   average, each figure with its rank in the league */
const MC_VS = [["Goals scored per match", "gf", 2], ["Goals conceded per match", "ga", 2, true], ["Clean sheets", "cs", 0], ["Failed to score", "fts", 0, true],
  ["Points per match at home", "ppmHome", 2], ["Points per match away", "ppmAway", 2]];
function mcVsAvg(label, cv, av, o, i){
  const hi = Math.max(cv || 0, av || 0), wd = x => x == null || !(hi > 0) ? 0 : Math.max(4, x / hi * 100);
  const on = cv != null && av != null && Math.abs(cv - av) > 1e-9 && (cv - av) * (o.low ? -1 : 1) > 0 ? " on" : "";
  const f = (x, dp) => x == null ? "–" : x.toFixed(dp);
  return '<div class="mc-st" style="--i:' + i + '"><small>' + clE(label) + '</small>' +
    '<span class="v h' + on + '">' + f(cv, o.dp) + (o.rank ? '<em>' + ordinal(o.rank) + '</em>' : "") + '</span>' +
    '<span class="bar h' + on + '"><i style="width:' + wd(cv).toFixed(1) + '%"></i></span>' +
    '<span class="bar a avg"><i style="width:' + wd(av).toFixed(1) + '%"></i></span>' +
    '<span class="v a avg">' + f(av, Math.max(1, o.dp)) + '<em>avg</em></span></div>';
}
function mcClubSeasonHTML(C, m, key, name){
  const M = mcStats();
  if(!M) return "";
  const figs = m.figs || (m.figs = M.figures(m.rows)), f = figs[key];
  if(!f || !f.line.all.gp) return "";
  const all = Object.values(figs), cup = clCupStage(C.id);
  const avg = k => { const v = all.map(t => t.v[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return b4Sec("This season") + '<div class="mc-key"><span>' + clPatch({ key, name }, 20) + clE(clTeam({ key, name }).code) + '</span><span>' + (cup ? "Average" : "League average") + '</span></div>' +
    '<div class="mc-mirror mc-vsavg">' + MC_VS.map(([lab, k, dp, low], i) => mcVsAvg(lab, f.v[k], avg(k), { dp, low, rank: f.rank[k] }, i)).join("") + '</div>' +
    '<p class="mc-fine">Small figures: the rank among ' + all.length + ' clubs. From ' + f.line.all.gp + ' ' + (cup ? "league stage" : "league") + ' match' + (f.line.all.gp === 1 ? "" : "es") + '.</p>';
}
/* ITS SCORERS: its players in the league's goals and assists lists, the most goals first; a tap opens the sheet */
function mcLeadersGo(comp){ clGo("comp", { comp, tab: "leaders", from: clV() }); }
function mcClubLeadHTML(C, m, key, name){
  const L = mcLeadNeed(C.id, m.season), title = b4Sec("Top scorers and assists");
  if(L === undefined) return title + '<div class="lgskel cl-skel-s"></div>';
  if(!L.goals && !L.assists) return "";
  const mine = {};
  ["goals", "assists"].forEach(kind => (L[kind] ? L[kind].rows : []).forEach((p, i) => {
    if((p.t === key || (!p.t && p.tn === name)) && !mine[p.n]) mine[p.n] = { p, kind, i };
  }));
  const list = Object.values(mine).sort((x, y) => (y.p.g | 0) - (x.p.g | 0) || (y.p.a | 0) - (x.p.a | 0) || (x.p.min | 0) - (y.p.min | 0)).slice(0, 5);
  const more = '<button class="b4btn quiet mc-more" onclick="mcLeadersGo(\'' + C.id + '\')">Full list ›</button>';
  if(!list.length) return title + '<p class="mc-none">None of their players is in the league\'s top twenty yet.</p>' + more;
  return title + '<div class="b4card cream mc-leadlist mc-clublead"><div class="mc-lrow hd" aria-hidden="true"><span>Player</span><span>MP</span><span>G</span><span>A</span></div>' +
    list.map(({ p, kind, i }) => '<button class="mc-lrow" onclick="mcPlayer(\'' + C.id + '\',\'' + kind + '\',' + i + ')" aria-label="' + clE(p.n) + ': ' + (p.g | 0) + ' goals, ' + (p.a | 0) + ' assists in ' + (p.mp | 0) + ' matches">' +
      '<span class="nm"><b>' + clE(p.n) + '</b><small>' + (p.min | 0) + ' min</small></span><span class="mp">' + (p.mp | 0) + '</span><span class="mc-fg">' + (p.g | 0) + '</span><span class="mc-fg a">' + (p.a | 0) + '</span></button>').join("") +
    '</div>' + more;
}
/* ITS ABSENTEES for the next match (014's pl_absences, public to read; the feed lists some twice): Out and Doubtful,
   the reason in plain words. Nothing stored for that match yet: no section */
function mcClubAbsHTML(C, key, x){
  if(!x) return "";
  const r = mcRow("abs:" + x.id, "pl_absences", "fixture_id", x.id, "rows,fetched_at");
  if(!r || !Array.isArray(r.rows)) return "";
  const seen = {}, mine = r.rows.filter(a => a && a.t === key && a.n && !seen[a.n + "|" + a.k] && (seen[a.n + "|" + a.k] = 1));
  const home = x.h.key === key, opp = home ? x.a : x.h, at = Date.parse(r.fetched_at) || 0;
  const head = b4Sec("Absentees") + '<p class="mc-cap">' + (home ? "v " : "at ") + clE(clTeam(opp).name) + ', ' + clE(mcShortDate(x.ko)) + (at ? " · updated " + mcAgo(at) : "") + '</p>';
  if(!mine.length) return head + '<p class="mc-none">No reported absentees</p>';
  const col = (k, title) => { const l = mine.filter(a => a.k === k);
    return l.length ? '<div class="mc-abscol ' + k + '"><b>' + title + '</b>' + l.map(a => '<span><i>' + clE(a.n) + '</i><small>' + clE(a.why || (k === "out" ? "Out" : "Doubtful")) + '</small></span>').join("") + '</div>' : ""; };
  return head + '<div class="b4card cream mc-abs">' + col("out", "Out") + col("doubtful", "Doubtful") + '</div>';
}
/* THE STORY LINE of the club's next match (§3.3), under it on the club page; before kick-off only */
function mcClubStoryHTML(C, m, x){
  if(!x || !mcStats() || /^(live|paused|postponed|cancelled|suspended)$/.test(clStr(x.st))) return "";
  return mcStoryHTML(m, x, clTeam(x.h), clTeam(x.a), mcH2hRows(x), C);
}
