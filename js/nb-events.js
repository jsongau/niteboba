/* ============================================================================
   BOBA NIGHT - first-party funnel events (Wave 0, 2026-11-08)
   Privacy: no cookies, no IP stored by us, coordinates rounded to ~1 km,
   per-tab session id only, honors Do Not Track, skips automated browsers.
   Writes insert-only rows to Supabase public.niteboba_events (anon RLS).
   API: window.nbTrack(event, props)  - never throws, never blocks the page.
   ========================================================================== */
(function () {
  "use strict";
  var URL_ = "https://hfvbeqlefwwjlrbyxpbj.supabase.co/rest/v1/niteboba_events";
  var KEY = "sb_publishable_wlfujszvn2logC3KNL3MsA_AW1F42kf";
  var EVENTS = { location_set: 1, results_shown: 1, shop_click: 1, directions_click: 1, zero_open: 1, widen_radius: 1 };
  var METHODS = { gps: 1, zip: 1, city: 1, landmark: 1, denied: 1, "default": 1 };
  var nav = window.navigator || {};
  var off = (nav.doNotTrack === "1" || window.doNotTrack === "1" || nav.webdriver === true) && !window.NB_TRACK_FORCE;

  function sid() {
    try {
      var s = sessionStorage.getItem("nb_sid");
      if (!s) { s = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("nb_sid", s); }
      return s;
    } catch (e) { return window.__nbSid || (window.__nbSid = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); }
  }
  function r2(n) { n = +n; return isFinite(n) ? Math.round(n * 100) / 100 : null; }
  function int(n, max) { n = Math.round(+n); return isFinite(n) && n >= 0 ? Math.min(n, max) : null; }
  function str(s, max) { return s == null ? null : String(s).slice(0, max); }

  var queue = [], timer = null, last = {};
  function flush() {
    timer = null;
    if (!queue.length) return;
    var body = JSON.stringify(queue); queue = [];
    try {
      fetch(URL_, {
        method: "POST", keepalive: true, mode: "cors", credentials: "omit",
        headers: { "apikey": KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: body
      }).catch(function () {});
    } catch (e) {}
  }

  window.nbTrack = function (event, p) {
    try {
      if (off || !EVENTS[event]) return;
      p = p || {};
      var row = {
        session_id: sid(),
        page: str(location.pathname, 200),
        event: event,
        method: METHODS[p.method] ? p.method : null,
        area_label: str(p.area, 80),
        lat2: r2(p.lat), lng2: r2(p.lng),
        radius_mi: int(p.radius, 100),
        result_count: int(p.results, 5000),
        open_count: int(p.open, 5000),
        rank: int(p.rank, 500),
        shop_slug: str(p.slug, 160)
      };
      if (row.lat2 != null && (row.lat2 < 30 || row.lat2 > 40)) { row.lat2 = null; row.lng2 = null; }
      if (row.lng2 != null && (row.lng2 < -125 || row.lng2 > -110)) { row.lat2 = null; row.lng2 = null; }
      /* de-dupe: the same event+payload within 3s is one event (re-renders, double taps) */
      var k = event + "|" + row.method + "|" + row.area_label + "|" + row.radius_mi + "|" + row.shop_slug + "|" + row.result_count;
      var now = Date.now();
      if (last[k] && now - last[k] < 3000) return;
      last[k] = now;
      queue.push(row);
      if (event === "directions_click" || event === "shop_click") flush();
      else if (!timer) timer = setTimeout(flush, 1500);
    } catch (e) {}
  };
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);
})();
