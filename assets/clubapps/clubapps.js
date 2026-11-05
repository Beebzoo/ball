/* BALL 4 · HIGHER OR LOWER'S NEW QUESTIONS (_plans/games-round.md, round 2): "Who played more league games for Ajax?" and
   "Who won more caps?". The numbers are _tools/build-hilo-apps.js's, and its header says who is left out and why. The game is
   capsPick's: this file only finds the bank. index.json lists the clubs, one <slug>.json is one club and comes down when you
   pick it, and the service worker keeps what it has seen; assets/caps/wide.json is the caps. Loaded on the first open by
   hiloNeed() in index.html, which also holds HILO_CLUB, CAPSW and the STATS rows. No new key: a run's best is ball4-best. */
let HC_INDEX = null, HC_LOADING = null, HC_FAILED = false;

function hcIndex(){
  if(HC_INDEX || HC_LOADING) return HC_LOADING;
  HC_FAILED = false;
  return HC_LOADING = fetch("assets/clubapps/index.json").then(r => r.ok ? r.json() : null).then(j => { HC_LOADING = null; if(!j) throw 0; HC_INDEX = j; render(); })
    .catch(() => { HC_LOADING = null; HC_FAILED = true; render(); });
}
const hcRow = slug => HC_INDEX ? HC_INDEX.clubs.find(c => c[0] === slug) || null : null;
/* a club's colours: clubs-identity.json, or the index for the handful it doesn't know */
function hcLook(slug){
  const r = hcRow(slug), name = r ? r[1] : slug;
  return Object.assign({ code: name.slice(0, 3).toUpperCase(), c1: "#123D24", c2: "#F8F1DD", p: "plain" }, clubOf(slug) || (r && r[4]) || {}, { name });
}
/* the shirt for dressKit: the club's own two colours through our own drawing. A busy shirt keeps its name in the plain ink,
   a plain one can wear its second colour */
const HC_PATTERN = { stripes: "stripes", hoops: "hoops", sash: "sash", band: "band", halves: "halves" };
function hcKit(slug){
  const L = hcLook(slug), pattern = HC_PATTERN[L.p] || null, body = dressHex(L.c1) || "#123d24", trim = dressHex(L.c2) || "#f8f1dd";
  const far = Math.abs(dressLum(body) - dressLum(trim)) > 70;
  return { kit: body, abbr: L.code, dress: { trim, trim2: trim, ink: !pattern && far ? trim : kitInk(body), pattern } };
}
/* one club, in memory and the game's: every row a locker in that club's shirt */
function hcTake(slug, rows){
  const r = hcRow(slug), kit = hcKit(slug);
  for(const p of rows) p.side = slug;
  HILO_CLUB = { slug, name: r ? r[1] : clubName(slug), rows, kit };
}
function hcFetch(slug){
  return fetch("assets/clubapps/" + encodeURIComponent(slug) + ".json").then(r => r.ok ? r.json() : null).then(rows => { if(rows && rows.length) { hcTake(slug, rows); return true; } return false; });
}
function hcPick(slug){
  audio(); try{ haptic("select"); }catch(e){}
  hcFetch(slug).then(ok => { if(!ok) throw 0; render(); try{ window.scrollTo(0, 0); }catch(e){} }).catch(() => toast("That club needs a signal the first time", true));
}
/* the wide caps: rows and the shirts for the sides the books don't have */
function hcCaps(){
  if(CAPSW) return Promise.resolve(true);
  return fetch("assets/caps/wide.json").then(r => r.ok ? r.json() : null).then(j => { if(j){ CAPSW = j; if(b4Step === "hilo") render(); } return !!j; }).catch(() => false);
}
/* what a parked run needs, so it can come back after a restart: the club it was on, or the caps. The index first, for the name */
function hcBring(s){
  if(s.mode === "wcaps") return hcCaps();
  if(!HC_INDEX) return (hcIndex() || Promise.resolve()).then(() => HC_INDEX ? hcFetch(s.hiloClub) : false);
  return hcFetch(s.hiloClub);
}

/* ---------- the picker ----------
   Matchday's shape: your club, then the leagues, yours first. Patches are BALL's own (Crests.patch), a slice per frame: a
   hundred and fifty of them is more than a phone draws at once. */
const HC_BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
function hcPatch(slug, w){
  const px = w <= 40 ? 96 : w * 3, ready = crestCache.has(slug + "|patch|" + px);
  return '<img class="hcpatch" width="' + w + '" height="' + Math.round(w * 7 / 6) + '" alt="" src="' + (ready ? crestURL(slug, "patch", px, hcLook(slug)) : HC_BLANK) + '"' +
    (ready ? "" : ' data-hcp="' + slug + '" data-px="' + px + '"') + '>';
}
function hcFill(){
  let list; try{ list = [...document.querySelectorAll("img[data-hcp]")]; }catch(e){ return; }
  const step = () => {
    const end = performance.now() + 9;
    while(list.length && performance.now() < end){ const im = list.shift(), u = crestURL(im.getAttribute("data-hcp"), "patch", +im.getAttribute("data-px"), hcLook(im.getAttribute("data-hcp"))); if(u) im.src = u; im.removeAttribute("data-hcp"); }
    if(list.length) requestAnimationFrame(step);
  };
  step();
}
function hcFav(){
  let f = null;
  try{ f = (acctLocal().fav || {}).club; }catch(e){}
  if(!f) try{ f = (mine().fav || {}).club; }catch(e){}
  return f && hcRow(f) ? f : null;
}
const HC_BADGE = { nl: "ere", en: "premier", es: "laliga", de: "bundesliga", it: "seriea", be: "belgian", pt: "primeira", sc: "scotland", fr: "ligue1" };
const hcTile = c => '<button class="hctile" onclick="hcPick(\'' + c[0] + '\')" aria-label="' + esc(c[1]) + '"><span class="hctart">' + hcPatch(c[0], 36) + '</span><b>' + esc(c[1]) + '</b></button>';
function hcPickerHTML(){
  if(!HC_INDEX){
    hcIndex();
    return b6StepHead(0, 0, "League games") + '<div class="b6q">Which club?</div><div class="b6qs">' + (HC_FAILED ? "That needs a signal the first time." : "Getting the clubs…") + '</div>';
  }
  setTimeout(hcFill, 0);
  const fav = hcFav(), cc = fav ? hcRow(fav)[2] : null, rows = HC_INDEX.clubs.filter(c => c[0] !== fav);
  const lands = HC_INDEX.lands.slice().sort((a, b) => (b[0] === cc) - (a[0] === cc));
  return b6StepHead(0, 0, "League games") +
    '<div class="b6q">Which club?</div><div class="b6qs">Who played more league games for them? Cups and Europe don\'t count.</div>' +
    (fav ? '<button class="hchero" onclick="hcPick(\'' + fav + '\')">' + hcPatch(fav, 62) + '<span class="hchm"><small>Your club</small><b>' + esc(hcRow(fav)[1]) + '</b></span><span class="hcgo" aria-hidden="true">›</span></button>' : "") +
    lands.map(([k, name]) => { const list = rows.filter(c => c[2] === k); return list.length ? '<div class="b6hdr hch">' + (compBadge(HC_BADGE[k], 26) || "") + esc(name) + '<span>' + list.length + '</span></div><div class="hcgrid">' + list.map(hcTile).join("") + '</div>' : ""; }).join("");
}
