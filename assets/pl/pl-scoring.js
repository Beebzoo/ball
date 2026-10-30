/* CALL IT: the prediction league's points, as plain functions (no DOM, no network).

   One of two copies of the same rules, on purpose: the server scores every
   call in SQL (supabase/migrations/009_call_it.sql, pl_points_football and
   pl_crowd_win), and the phone needs the same answer for "if it ended now"
   while a match is live. _tests/pl-scoring-test.js checks this file, and
   _tests/sql/009_call_it_parity.sql (written by `node _tools/pl-parity.js`)
   checks the SQL against it for every score from 0-0 to 7-7, so the two can't
   drift apart without a test going red.

   THE v1 RULES (_plans/call-it.md §3, from the simulation in
   _plans/call-it/03-game-design.md):
     right result (home win, draw, away win)             2
     + right goal difference (any right draw has it)     +1, so 3
     + exact score                                       +2, so 5
     against the crowd: the right WINNER, called by
       fewer than 20% of BALL's eligible calls, once the
       match has 200 of them. Never for a draw           +1
     the armband: one match per card                     ×2 (the best single match is 12)
   A score is always the one after 90 minutes plus stoppage time.

   flags, the same bits the server stores: 1 result · 2 goal difference · 4 exact · 8 against the crowd.

   Loads in a browser as window.PLScore, and in node with require(). */
(function(root){
"use strict";

const RULES = Object.freeze({ result: 2, diff: 1, exact: 2, crowd: 1, crowd_cut: 0.2, crowd_min: 200, armband: 2 });
const FLAG = Object.freeze({ RESULT: 1, DIFF: 2, EXACT: 4, CROWD: 8 });
const rulesOf = R => Object.assign({}, RULES, R || {});
const sgn = n => n > 0 ? 1 : n < 0 ? -1 : 0;
const isGoals = n => Number.isInteger(n) && n >= 0;

/* WAS THE WINNER A BRAVE CALL? crowd is the split frozen at kick-off,
   {n, h, d, a}: how many eligible calls there were, and how many said home,
   draw and away. A draw never qualifies, and neither does a match with fewer
   than crowd_min calls, which covers the small user base at launch. The share
   is a division, compared with the cut, exactly as the SQL does it. */
function crowdWin(crowd, fh, fa, R){
  R = rulesOf(R);
  if(!crowd || !isGoals(fh) || !isGoals(fa) || fh === fa) return false;
  const n = crowd.n | 0;
  if(n < R.crowd_min || n <= 0) return false;
  const side = (fh > fa ? crowd.h : crowd.a) | 0;
  return side / n < R.crowd_cut;
}

/* the points for one call (ch-ca) on one result (fh-fa): {pts, flags}.
   crowd is the split {n, h, d, a}, or already the answer as true/false. */
function points(ch, ca, fh, fa, R, crowd){
  R = rulesOf(R);
  if(![ch, ca, fh, fa].every(isGoals)) return { pts: 0, flags: 0 };
  if(sgn(ch - ca) !== sgn(fh - fa)) return { pts: 0, flags: 0 };
  let pts = R.result, flags = FLAG.RESULT;
  if(ch - ca === fh - fa){ pts += R.diff; flags |= FLAG.DIFF; }
  if(ch === fh && ca === fa){ pts += R.exact; flags |= FLAG.EXACT; }
  const brave = typeof crowd === "boolean" ? crowd : crowdWin(crowd, fh, fa, R);
  if(fh !== fa && brave){ pts += R.crowd; flags |= FLAG.CROWD; }
  return { pts, flags };
}

/* what a flags value is made of, as [key, points] pairs for the UI to word:
   result, diff, exact, crowd (the armband is the card's, see card()) */
function parts(flags, R){
  R = rulesOf(R);
  const out = [];
  if(flags & FLAG.RESULT) out.push(["result", R.result]);
  if(flags & FLAG.DIFF) out.push(["diff", R.diff]);
  if(flags & FLAG.EXACT) out.push(["exact", R.exact]);
  if(flags & FLAG.CROWD) out.push(["crowd", R.crowd]);
  return out;
}

/* A CARD, the way the server totals it (pl_rebuild_card):
     fixtures  [{id, ft: [h, a] | null, crowd?, void?, out?}]  out = moved outside the card's window
     calls     {fixtureId: [h, a]}
     armband   the fixture id it sits on, or null
   Only a fixture with a result scores; a void one, or one moved outside the
   window, counts for nothing on this card. Returns the totals plus each
   fixture's {pts, flags, armband}. For "if it ended now", pass the live score
   as ft. */
function card(fixtures, calls, armband, R){
  R = rulesOf(R);
  const out = { pts: 0, exact: 0, results: 0, crowd: 0, played: 0, called: 0, by: {} };
  for(const f of fixtures || []){
    if(f.out) continue;
    const c = calls && calls[f.id];
    if(!c) continue;
    out.called++;
    if(f.void || !Array.isArray(f.ft) || !isGoals(f.ft[0]) || !isGoals(f.ft[1])) continue;
    const p = points(c[0], c[1], f.ft[0], f.ft[1], R, f.crowd);
    const arm = armband != null && String(armband) === String(f.id);
    const pts = arm ? p.pts * R.armband : p.pts;
    out.by[f.id] = { pts, flags: p.flags, armband: arm };
    out.pts += pts; out.played++;
    if(p.flags & FLAG.EXACT) out.exact++;
    if(p.flags & FLAG.RESULT) out.results++;
    if(p.flags & FLAG.CROWD) out.crowd++;
  }
  return out;
}

/* The table order everywhere: points, then exact scores, then right results.
   Equal on all three is a shared place (1, 2, 2, 4). rows: [{pts, exact, results}] */
function rank(rows){
  const s = rows.slice().sort((a, b) => b.pts - a.pts || b.exact - a.exact || b.results - a.results);
  let pos = 0;
  s.forEach((r, i) => {
    const p = s[i - 1];
    if(!p || p.pts !== r.pts || p.exact !== r.exact || p.results !== r.results) pos = i + 1;
    r.pos = pos;
  });
  return s;
}

/* THE PARITY STRING: every call and result from 0-0 to 7-7, crowd bonus off
   and on, as two characters each (the points, then the flags in hex), in the
   order ((((ch*8 + ca)*8 + fh)*8 + fa)*2 + crowd). _tools/pl-parity.js writes it
   into the SQL test, which recomputes it with pl_points_football. */
function parity(R){
  let s = "";
  for(let ch = 0; ch < 8; ch++) for(let ca = 0; ca < 8; ca++) for(let fh = 0; fh < 8; fh++) for(let fa = 0; fa < 8; fa++)
    for(const brave of [false, true]){
      const p = points(ch, ca, fh, fa, R, brave);
      s += String(p.pts) + p.flags.toString(16);
    }
  return s;
}

const api = { RULES, FLAG, rulesOf, crowdWin, points, parts, card, rank, parity };
if(typeof module !== "undefined" && module.exports) module.exports = api;
else root.PLScore = api;
})(typeof window !== "undefined" ? window : globalThis);
