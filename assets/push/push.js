/* BALL 4 · PUSH REMINDERS: the phone side.
   _plans/go-to-market.md (the push stream); why: _plans/market-ready.md §2, "the biggest single retention gap".

   Loaded by index.html (pushNeed) the first time it is wanted: the one-time ask, the Settings page, a day knitted
   or an app that already has reminders on. Never at start on a new phone. A plain script with plain globals like
   pl.js, so the screens' onclick="" reach them; everything here is push / PUSH.

   THE PROMISE, kept on the server (015_push.sql, push_plan): one nudge a day at most, and only two kinds:
     - the scarf at risk: 19:30–20:30 your time, when yesterday's three were done and today's are not;
     - the card about to lock: twenty hours before your Call It card's first kick-off, with calls still to make.
   The phone sends the server three things: its push address (PushManager's endpoint and keys), its time zone,
   and "today's three are done" (push_day) so the evening nudge knows to stay quiet. Nothing else.

   THE ASK shows once, after the first Daily Ball finished or the first Call It lock-in, whichever comes first,
   never on first open; "Not now" is final until Settings. ?push=0 switches the whole feature off for a phone
   (PUSH_ON, in index.html). The server is 015's RPCs: push_subscribe, push_unsubscribe, push_prefs, push_day. */

const PUSH_KEY = "ball4-push";                      // {asked, on, endpoint, wants, day, at}
const PUSH_VAPID_PUBLIC = "BKsph3gmO6oM-mhT1SnnqiF3pSvDriWCI-0vbRmUAO0PLQb7sIMFAAuHW2woi7fDW1r6GZMX6cQWdHkSPuQLO94";   // written by _tools/vapid.js; the private half never leaves %USERPROFILE%\.ball
let PUSH_ASK_DELAY = 1500;                          // the result lands first, then the ask (a test sets it low)
const PUSH_WANTS = { streak: true, callit: true };

/* ---------- what this phone remembers ---------- */
function pushLocal(){ try{ return JSON.parse(localStorage.getItem(PUSH_KEY)) || {}; }catch(e){ return {}; } }
function pushLocalSet(o){ try{ localStorage.setItem(PUSH_KEY, JSON.stringify(Object.assign(pushLocal(), o))); }catch(e){} }
function pushWants(){ const w = pushLocal().wants; return { streak: !w || w.streak !== false, callit: !w || w.callit !== false }; }

/* ---------- can this phone take a push at all ---------- */
function pushSupported(){
  try{
    return typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" &&
      "PushManager" in window && typeof Notification !== "undefined" && !!PUSH_VAPID_PUBLIC && !pushNeedsInstall();
  }catch(e){ return false; }
}
/* an iPhone takes web push only as a home-screen app (iOS 16.4+) */
function pushNeedsInstall(){
  try{ return /iPhone|iPad|iPod/.test(navigator.userAgent || "") && !(typeof isStandalone === "function" && isStandalone()); }catch(e){ return false; }
}
/* off / on / denied / unsupported */
function pushState(){
  if(!pushSupported()) return "unsupported";
  try{ if(Notification.permission === "denied") return "denied"; }catch(e){}
  const L = pushLocal();
  if(L.on){ try{ if(Notification.permission !== "granted") return "off"; }catch(e){} return "on"; }
  return "off";
}
/* the VAPID key as the bytes PushManager wants */
function pushKeyBytes(s){
  const b = String(s || "").replace(/-/g, "+").replace(/_/g, "/"), pad = b + "=".repeat((4 - b.length % 4) % 4);
  const raw = atob(pad), out = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* ---------- the one-time ask ---------- */
const PUSH_WHY = { daily: "daily", lockin: "lockin" };
function pushAsk(reason){
  const L = pushLocal();
  if(L.asked) return false;
  if(pushState() !== "off"){ pushLocalSet({ asked: Date.now(), why: reason, skipped: pushState() }); return false; }
  /* the ask wants an account to keep the address under; a guest is an anonymous user once the server answered */
  try{ if(!acct().signedIn) return false; }catch(e){ return false; }
  try{ if($("#overlay").classList.contains("show")) return false; }catch(e){}
  pushLocalSet({ asked: Date.now(), why: reason });
  sheet('<div class="pushsheet"><h2>A nudge when it matters</h2>' +
    '<p class="pgsheetp">One nudge a day at most, only when your scarf is at risk or your card is about to lock. Nothing else, ever. Off again in Settings whenever you like.</p>' +
    b4Btn("Remind me", "pushOn('ask')") +
    '<button class="acnot" onclick="pushLater()">Not now</button></div>');
  try{ tlmEvent("push_ask", { why: reason }); }catch(e){}
  return true;
}
function pushLater(){ closeSheet(); pushLocalSet({ later: Date.now() }); }

/* ---------- on and off ---------- */
async function pushOn(why){
  try{ closeSheet(); }catch(e){}
  if(!pushSupported()){ toast(pushNeedsInstall() ? "Add BALL to your home screen first, then turn reminders on in Settings." : "This browser can't take reminders.", true); return false; }
  let perm = "default";
  try{ perm = Notification.permission; if(perm === "default") perm = await Notification.requestPermission(); }catch(e){ perm = "denied"; }
  if(perm !== "granted"){ pushLocalSet({ on: false }); toast("No reminders, then. Allow notifications for BALL in your phone's settings if you change your mind."); pushRedraw(); return false; }
  let sub = null;
  try{
    const reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(PUSH_VAPID_PUBLIC) });
  }catch(e){ sub = null; }
  if(!sub){ pushLocalSet({ on: false }); toast("Your phone wouldn't take the reminder address. Try again from Settings.", true); pushRedraw(); return false; }
  const ok = await pushSend(sub);
  if(!ok){ pushLocalSet({ on: false }); toast("BALL can't reach the server right now. Try again from Settings.", true); pushRedraw(); return false; }
  pushLocalSet({ on: true, at: Date.now() });
  toast("Reminders on. One a day at most.");
  try{ tlmEvent("push_on", { why: why || "settings" }); }catch(e){}
  pushDaySync();
  pushRedraw();
  return true;
}
/* the address, the zone and the wants, to the server; true when it has them */
async function pushSend(sub){
  try{
    const j = sub.toJSON ? sub.toJSON() : sub, keys = j.keys || {};
    let tz = null; try{ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; }catch(e){}
    const p = { endpoint: j.endpoint, p256dh: keys.p256dh, auth: keys.auth, tz, offset: -new Date().getTimezoneOffset(), wants: pushWants() };
    try{ p.ua = tlmUA(); }catch(e){}
    const r = await sbClient().rpc("push_subscribe", { p });
    if(r.error || !r.data || !r.data.ok) return false;
    pushLocalSet({ endpoint: j.endpoint, tz });
    return true;
  }catch(e){ return false; }
}
async function pushOff(){
  const L = pushLocal();
  let endpoint = L.endpoint || null;
  try{
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if(sub){ endpoint = sub.endpoint || endpoint; await sub.unsubscribe(); }
  }catch(e){}
  pushLocalSet({ on: false, endpoint: null });
  try{ if(endpoint) sbClient().rpc("push_unsubscribe", { p_endpoint: endpoint }).then(() => {}, () => {}); }catch(e){}
  toast("Reminders off.");
  try{ tlmEvent("push_off", {}); }catch(e){}
  pushRedraw();
}
function pushToggle(){ audio(); if(pushState() === "on") pushOff(); else pushOn("settings"); }
/* which reminders: kept here and on every subscription of this account */
function pushWant(kind, on){
  const w = pushWants(); w[kind] = !!on;
  pushLocalSet({ wants: w });
  try{ sbClient().rpc("push_prefs", { p_wants: w }).then(() => {}, () => {}); }catch(e){}
  if(kind === "streak" && on) pushDaySync();
}
function pushRedraw(){ try{ if(typeof ME_VIEW !== "undefined" && ME_VIEW === "settings") render(); }catch(e){} }

/* ---------- today's three, done: the server must know, so the evening stays quiet ---------- */
function pushDay(day, done){
  const L = pushLocal();
  if(!L.on || !pushWants().streak) return false;
  const d = String(day || dayKey());
  if(L.day === d && done) return false;                    // told already
  try{ sbClient().rpc("push_day", { p_day: d, p_done: !!done }).then(r => { if(r && !r.error) pushLocalSet({ day: done ? d : null }); }, () => {}); }catch(e){ return false; }
  return true;
}
function pushDaySync(){ try{ if(threeToday().all) pushDay(dayKey(), true); }catch(e){} }

/* ---------- the call sites (index.html's pushHook, pl.js's lock-in) ---------- */
function pushEvent(kind, arg){
  if(kind === "daily" || kind === "lockin"){ setTimeout(() => { try{ pushAsk(kind); }catch(e){} }, PUSH_ASK_DELAY); return; }
  if(kind === "three"){ pushDay(arg, true); return; }
  if(kind === "boot"){ pushBoot(); }
}
/* an app that has reminders on: the address can change under us (the browser rotates it), so it is sent again
   when it did; and if the phone revoked the permission, this phone says off */
async function pushBoot(){
  const L = pushLocal();
  if(!L.on || !pushSupported()) return;
  try{
    if(Notification.permission !== "granted"){ pushLocalSet({ on: false }); return; }
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if(!sub){ pushLocalSet({ on: false }); return; }
    if(sub.endpoint !== L.endpoint) await pushSend(sub);
    pushDaySync();
  }catch(e){}
}

/* ---------- Settings ---------- */
function pushSettingsHTML(){
  const st = pushState(), w = pushWants();
  let row;
  if(st === "unsupported"){
    row = '<div class="accard pushcard"><span><small>Reminders</small><b>Not on this browser</b><em>' +
      (pushNeedsInstall() ? "Add BALL to your home screen first, then come back here." : "This browser can't take reminders.") + '</em></span></div>';
  }else if(st === "denied"){
    row = '<div class="accard pushcard"><span><small>Reminders</small><b>Blocked by your phone</b><em>Allow notifications for BALL in your phone\'s settings, then come back here.</em></span></div>';
  }else{
    row = '<div class="accard pushcard"><span><small>Reminders</small><b>' + (st === "on" ? "On" : "Off") + '</b><em>One nudge a day at most.</em></span>' +
      '<button class="pushsw" role="switch" aria-checked="' + (st === "on") + '" aria-label="Reminders" onclick="pushToggle()"><i></i></button></div>' +
      (st === "on"
        ? '<label class="fyccheck pushwant"><input type="checkbox"' + (w.streak ? " checked" : "") + ' onchange="pushWant(\'streak\', this.checked)"><span><b>Scarf at risk</b><small>In the evening, when today\'s three aren\'t done yet.</small></span></label>' +
          '<label class="fyccheck pushwant"><input type="checkbox"' + (w.callit ? " checked" : "") + ' onchange="pushWant(\'callit\', this.checked)"><span><b>Card about to lock</b><small>The day before your Call It card\'s first kick-off, with calls still to make.</small></span></label>'
        : "");
  }
  return '<div class="b6hdr">Reminders</div>' + row +
    '<p class="pushnote">With reminders on, the server keeps this phone\'s push address, its time zone and whether today\'s three are done. Turning them off removes it.</p>';
}
