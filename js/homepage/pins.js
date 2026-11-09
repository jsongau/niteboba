/* Boba Night: shared shop-pin loader (Wave 4, 2026-11-08).
   One fetch of every open SoCal shop for every homepage widget (finder, night map), so the page
   never downloads the same 1,410 rows twice. Source: Supabase view niteboba_map_pins, paged
   1,000 rows per request (the API's per-request cap). Also the one place "open right now" is
   computed, so every widget agrees.
   API: BNPins.load() -> Promise<rows>; BNPins.now() -> {d, min} Pacific; BNPins.openFor(per, now)
        -> minutes until close if open now, else null. */
(function () {
  "use strict";
  if (window.BNPins) return;
  var SB = "https://hfvbeqlefwwjlrbyxpbj.supabase.co/rest/v1/", KEY = "sb_publishable_wlfujszvn2logC3KNL3MsA_AW1F42kf";
  var H = { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }, cached = null;
  function load() {
    if (cached) return cached;
    var rows = [];
    function next(off) {
      return fetch(SB + "niteboba_map_pins?select=s,n,c,county,la,lo,r,rc,gm,addr,pid,per&order=s&limit=1000&offset=" + off, H)
        .then(function (r) { if (!r.ok) throw new Error("pins " + r.status); return r.json(); })
        .then(function (pg) { rows = rows.concat(pg); return pg.length < 1000 ? rows : next(off + 1000); });
    }
    cached = next(0).catch(function (e) { cached = null; throw e; });
    return cached;
  }
  function now() {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    var d = 0, h = 0, m = 0, W = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    parts.forEach(function (p) { if (p.type === "weekday") d = W.indexOf(p.value); if (p.type === "hour") h = +p.value % 24; if (p.type === "minute") m = +p.value; });
    return { d: d, min: h * 60 + m };
  }
  function toMin(t) { return t ? (+t.slice(0, 2)) * 60 + (+t.slice(2)) : null; }
  function openFor(per, n) {
    if (!per) return null;
    for (var i = 0; i < per.length; i++) {
      var p = per[i], o = toMin(p[1]), c = toMin(p[2]);
      if (o == null) continue;
      if (c == null) { if (p[0] === n.d) return 24 * 60; continue; }
      if (c > o) { if (p[0] === n.d && n.min >= o && n.min < c) return c - n.min; }
      else {
        if (p[0] === n.d && n.min >= o) return 24 * 60 - n.min + c;
        if ((p[0] + 1) % 7 === n.d && n.min < c) return c - n.min;
      }
    }
    return null;
  }
  window.BNPins = { load: load, now: now, openFor: openFor };
})();
