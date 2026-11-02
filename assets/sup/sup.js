/* ---------- BALL 4: BALL SUPPORTER, the screens ----------
   _plans/supporter.md. Loaded on first need by supNeed() in index.html, where
   the door lives (SUP_ON, SUP_SHOW, isSupporter(), supGate(), openSupporter(),
   supBoot(), the mark). Here: the page, the gate sheet, buying (Stripe
   Checkout through the Edge Function stripe-checkout), the customer portal,
   Restore (ask the server again), a gift code, and the way back from Stripe.

   The rules, from the plan: cosmetics and comfort only, never an answer, a
   hint, a life or a point; nothing that reads as a stake or a prize; British
   English, one fan's voice, ico() not emoji, one gold pill per screen. The
   prices are placeholders in SUP_PRICES until Martijn's Stripe account exists;
   the price ids are the Edge secrets STRIPE_PRICE_MONTH / STRIPE_PRICE_YEAR. */

const SUP_PRICES = { month: "€1.99", year: "€14.99", yearNote: "two months free", refundDays: 7 };
/* a store build (the TWA, a Capacitor wrapper) must not sell on the web: the stores' rules. The wrapper sets
   its marker on the user agent; until one exists this is false and the web buttons show. */
const SUP_STORE = false;
const supStoreBuild = () => { try{ return SUP_STORE || /\bBALL-Store\b/.test(navigator.userAgent || ""); }catch(e){ return false; } };
const supE = s => esc(String(s == null ? "" : s));

/* ---------- what a Supporter gets, and what everyone has ---------- */
const SUP_BENEFITS = [
  { ico: "star", title: "Your mark", sub: "A small gold S after your name in every Call It table." },
  { ico: "stripes", title: "A scarf stripe and a pennant edge", sub: "Gold on your rack and your pennant.", soon: true },
  { ico: "rainbow", title: "Themes early", sub: "Wear any theme now. The way to earn it stays, and earned is yours for good.", soon: true },
  { ico: "shield", title: "More for your club", sub: "Extra crest shapes, a pennant shape and a scarf end for the editor.", soon: true },
  { ico: "rewind", title: "The archive", sub: "The Lists, any day since they began. Ten days back is free for everyone." },
  { ico: "users", title: "Twelve round one phone", sub: "Say it with up to twelve. Six is free for everyone." },
  { ico: "trophy", title: "Leagues of 200", sub: "Your Call It leagues take 200 players. Fifty is the house limit." },
  { ico: "card", title: "Your own round", sub: "Pick the matches of a round yourself from the competition's fixtures.", soon: true },
  { ico: "share", title: "A season page to share", sub: "Your league's table on one link, all season.", soon: true },
];
const SUP_FREE = "Every question. Matchday against the computer, a friend or online. Daily Ball, Guess the player, the Lists (ten days back), Higher or Lower, The Cup, Career Path, Tiki-Taka-Toe, Deadline Day, all of it. Your club, your pennant, your scarves, your trophies. Every theme you earn. Friends' quiz leagues. Call It: the Card of the week, every preset, leagues of up to fifty, the table, the armband. Party mode for six round one phone. Your career on the server, export and delete. No ads, ever.";
const supFreeHTML = () => '<div class="sup-free"><span class="kick">Free, for everyone, for ever</span><p>' + SUP_FREE + '</p></div>';

/* the gates' words: warm, short, one gold pill, one quiet way out */
const SUP_GATES = {
  archive: { h: "That one's in the archive", p: "Ten days back is free for everyone. A Supporter can play any day since the lists began." },
  party:   { h: "Seven's a crowd", p: "Up to six of you round one phone is free. A Supporter can bring twelve." },
  league:  { h: "Your league is full", p: "Fifty is the house limit. A Supporter's league takes two hundred, and the one you run grows the day you join." },
  card:    { h: "Pick your own matches", p: "A Supporter builds the round themselves, from the competition's fixtures." },
};

/* ---------- the page (ME_VIEW === "supporter") ---------- */
function supRender(st){
  const a = acct(), s = supState(), on = isSupporter(), store = supStoreBuild();
  const until = s.until ? new Date(s.until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const source = { stripe: "on the web", play: "through Google Play", apple: "through the App Store", gift: "with a gift code" }[s.source] || "";
  const you = on
    ? b4Card('<div class="sup-you"><span class="kick">BALL Supporter</span><h2>Thank you</h2><p>Supporter until ' + supE(until) + (source ? ', ' + source : "") + '. ' +
        (s.source === "stripe" ? 'It renews by itself; manage or cancel it any time below.' : s.source === "gift" ? 'A gift. If you like, carry it on below.' : 'Manage it where you took it out.') + '</p></div>')
    : store
      ? b4Card('<div class="sup-you"><span class="kick">BALL Supporter</span><h2>Soon in this store</h2><p>Supporting BALL from the store is on its way. Already a Supporter on the web? Sign in to your club and it follows you.</p></div>')
      : '<div class="sup-prices">' +
        '<button class="sup-price" onclick="supBuy(\'month\')"><small>Monthly</small><b>' + supE(SUP_PRICES.month) + '</b><em>a month, cancel any time</em></button>' +
        '<button class="sup-price gold" onclick="supBuy(\'year\')"><small>Yearly</small><b>' + supE(SUP_PRICES.year) + '</b><em>a year, ' + supE(SUP_PRICES.yearNote) + '</em></button></div>';
  const list = '<div class="b6hdr">What you get</div><div class="sup-list">' + SUP_BENEFITS.map(b =>
    '<div class="sup-item">' + ico(b.ico) + '<span><b>' + b.title + '</b><small>' + b.sub + '</small></span>' + (b.soon ? '<span class="sup-soon">Soon</span>' : "<span></span>") + '</div>').join("") + '</div>';
  const rows = '<div class="sup-rows">' +
    (on && s.source === "stripe" && !store ? '<button onclick="supPortal()">Manage subscription</button>' : "") +
    '<button onclick="supRestore()">Restore</button>' +
    (a.linked ? '<button onclick="supGiftSheet()">Have a code?</button>' : "") + '</div>';
  const legal = '<p class="sup-legal">Billed by Stripe, prices include VAT. Changed your mind? Within ' + SUP_PRICES.refundDays + ' days, a full refund, no questions. ' +
    'Nothing here changes how BALL plays: no answers, no hints, no lives. ' +
    '<button onclick="legalPage(\'terms\')">Terms</button> · <button onclick="legalPage(\'privacy\')">Privacy</button></p>';
  st.innerHTML = b4Page({ title: "BALL Supporter", ctx: "Made by one fan", back: "openSettings()", cls: "suppage", body:
    '<p class="sup-lead">BALL is free, and it stays free. Supporters keep the lights on, and get a few things in return. Never an edge.</p>' +
    you + list + supFreeHTML() + rows + legal });
}

/* ---------- the gate sheet ---------- */
function supGateSheet(feature){
  const g = SUP_GATES[feature] || SUP_GATES.archive;
  sheet('<div class="sup-gate"><h2>' + g.h + '</h2><p class="pgsheetp">' + g.p + '</p>' +
    '<button class="bigbtn sup-pill" onclick="openSupporter()">' + ico("star") + 'See Supporter</button>' +
    '<button class="acnot" onclick="closeSheet()">Not now</button></div>');
}

/* ---------- buying, the portal, restore, a code ---------- */
async function supFn(name, body){
  const s = ACCT.session;
  if(!s) return { ok: false, code: "not_signed_in" };
  try{
    const res = await fetch(SUPA_URL + "/functions/v1/" + name, { method: "POST",
      headers: { "Authorization": "Bearer " + s.access_token, "apikey": SUPA_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    const d = await res.json().catch(() => ({}));
    return d && typeof d === "object" ? d : { ok: false, code: "bad" };
  }catch(e){ return { ok: false, code: "offline" }; }
}
const supHere = () => { try{ return location.origin + location.pathname; }catch(e){ return ""; } };
async function supBuy(plan){
  audio();
  const a = acct();
  if(!a.linked){ toast("Sign in to your club first, so your Supporter follows you to a new phone."); return acctSaveSheet(); }
  if(supStoreBuild()) return toast("Supporting BALL from the store is on its way.");
  toast("One moment…");
  const d = await supFn("stripe-checkout", { plan: plan === "year" ? "year" : "month", return: supHere() });
  if(d.ok && d.url){ try{ location.assign(d.url); }catch(e){} return; }
  toast(({ guest: "Sign in to your club first.", not_configured: "Supporting isn't open yet. Soon.", offline: "You're offline. Try again when you're back.",
    not_signed_in: "Sign in first." })[d.code] || "Couldn't open the checkout right now.", true);
}
async function supPortal(){
  audio();
  toast("One moment…");
  const d = await supFn("stripe-portal", { return: supHere() });
  if(d.ok && d.url){ try{ location.assign(d.url); }catch(e){} return; }
  toast(({ no_customer: "This subscription was taken out elsewhere: manage it there.", not_configured: "Not open yet.", offline: "You're offline. Try again when you're back." })[d.code] || "Couldn't open it right now.", true);
}
async function supRestore(){
  audio();
  const a = acct();
  if(!a.linked){ toast("Sign in to your club: your Supporter is on your account."); return acctSaveSheet(); }
  const was = isSupporter(), ok = await supRefreshFlag();
  if(!ok) return toast("Couldn't reach the server right now.", true);
  toast(isSupporter() ? (was ? "You're a Supporter. All good." : "Welcome back, Supporter.") : "No Supporter on this account.");
  if(ME_VIEW === "supporter") render();
}
function supGiftSheet(){
  audio();
  sheet('<h2>A code</h2><p class="pgsheetp">From Martijn, or a friend who had one to give.</p>' +
    '<div class="sup-code"><input id="supcode" maxlength="24" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="FRIENDS-30" aria-label="Your code"></div>' +
    '<button class="bigbtn" onclick="supGift()">Use it</button><button class="acnot" onclick="closeSheet()">Not now</button>');
  try{ const el = document.getElementById("supcode"); if(el) el.focus(); }catch(e){}
}
async function supGift(code){
  audio();
  const el = document.getElementById("supcode");
  code = String(code != null ? code : el ? el.value : "").trim().toUpperCase();
  if(code.length < 4) return toast("Codes are at least four letters.", true);
  try{
    const r = await sbClient().rpc("supporter_gift", { p_code: code });
    const d = (r && r.data) || { ok: false, code: r && r.error ? "error" : "bad" };
    if(!d.ok) return toast(({ not_found: "No code like that.", already: "You've used that one.", used_up: "That code has been used up.", guest: "Sign in to your club first.",
      slow_down: "A lot of tries. Have a breather.", not_signed_in: "Sign in first." })[d.code] || "Couldn't use it right now.", true);
    closeSheet();
    try{ localStorage.setItem(SUP_KEY, JSON.stringify(Object.assign(supState(), { until: d.until, source: supState().source || "gift", at: Date.now() }))); }catch(e){}
    supRefreshFlag();
    toast("Thank you. " + d.days + " days of Supporter, yours.");
    render();
  }catch(e){ toast("Couldn't use it right now.", true); }
}

/* ---------- the way back from Stripe: ?sup=ok | ?sup=no ---------- */
function supReturn(ok){
  try{ history.replaceState(null, "", location.pathname + location.search.replace(/[?&]sup=(ok|no)\b/, "").replace(/^&/, "?") + location.hash); }catch(e){}
  if(!ok) return;
  toast("Thank you. Your Supporter is on its way.");
  /* the webhook may land a moment after the player does: ask a few times */
  let n = 0;
  const again = async () => {
    if(await supRefreshFlag() && isSupporter()){ toast("You're a BALL Supporter. Thank you."); if(ME_VIEW || LOCKER_VIEW) render(); return; }
    if(++n < 5) setTimeout(again, 3000 * n);
  };
  again();
}
