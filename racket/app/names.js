/* The names a player sees on the top level and on four computer opponents, neutral for strangers:
   no real player's nickname, no registered tournament word. They sit here, on top of rally.js, only
   because other work is going on in that file right now: fold them into LEVELS and OPP there and
   delete this file. The ids stay as they are, so the match log ("cpu:fox") keeps its records. */
(function(R){
  const RA = R.rally, set = (id, o) => Object.assign(RA.opp(id), o);
  RA.LEVELS[4] = ["Champion", "Kampioen"];
  /* three nicknames were taken: The Wall (David Goffin), The Fox (Jannik Sinner), Ice Queen (Elena Rybakina) */
  set("wall", { nick: ["The Boomerang", "De Boemerang"] });
  set("fox", { nick: ["The Needle", "De Naald"] });
  set("ice", { nick: ["The Glacier", "De Gletsjer"], style: ["Calm, left-handed, merciless. Champion on every surface.", "Kalm, linkshandig, genadeloos. Kampioen op elke ondergrond."] });
  set("closer", { style: ["The champion. Big serve, no weak side.", "De kampioen. Grote opslag, geen zwakke kant."] });
})(window.RACKET);
