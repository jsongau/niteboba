/* Boba Night: "SoCal tonight" night map (Wave 4, 2026-11-08).
   Every open SoCal shop as a dot on an SVG map of the metro: champagne = open now, neon = last
   call (closes within the hour), dim = closed. Beside it, live counts by county (each links into
   /near-me/?at=<city>), "last call" and "open past midnight". Recomputed every minute from posted
   hours (Pacific); no re-download. Shops without posted hours are never counted as open.
   Data + open logic: window.BNPins (js/homepage/pins.js). Mounts into #tonightMap. */
(function () {
  "use strict";
  var host = document.getElementById("tonightMap");
  if (!host || !window.BNPins) return;
  var GROUPS = [
    { k: "Los Angeles", label: "Los Angeles County", at: "los-angeles", counties: ["Los Angeles"] },
    { k: "Orange", label: "Orange County", at: "irvine", counties: ["Orange"] },
    { k: "San Diego", label: "San Diego County", at: "san-diego", counties: ["San Diego"] },
    { k: "Riverside", label: "Riverside County", at: "riverside", counties: ["Riverside"] },
    { k: "San Bernardino", label: "San Bernardino County", at: "rancho-cucamonga", counties: ["San Bernardino"] },
    { k: "805", label: "Ventura & the 805", at: "oxnard", counties: ["Ventura", "Santa Barbara", "San Luis Obispo"] }
  ];
  /* metro frame: Ventura to the desert, Lancaster to the border */
  var B = { w: -119.35, e: -115.85, n: 34.78, s: 32.52 }, W = 600, K = W / ((B.e - B.w) * Math.cos(33.7 * Math.PI / 180)), Hh = Math.round((B.n - B.s) * K);
  function xy(la, lo) { return [((lo - B.w) * Math.cos(33.7 * Math.PI / 180) * K).toFixed(1), ((B.n - la) * K).toFixed(1)]; }
  function fmt(min) { var h = Math.floor(min / 60) % 24, m = min % 60, ap = h < 12 ? "AM" : "PM"; return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + ap; }
  function n(x) { return x.toLocaleString("en-US"); }
  var shops = [], dots = [];

  function frame() {
    host.innerHTML =
      '<div class="tm-map"><svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-labelledby="tmSum" preserveAspectRatio="xMidYMid meet">' +
        '<defs><filter id="tmGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
        '<g class="tm-off"></g><g class="tm-on" filter="url(#tmGlow)"></g><g class="tm-last" filter="url(#tmGlow)"></g></svg>' +
        '<p class="tm-legend" aria-hidden="true"><span><i class="lg-on"></i>Open now</span><span><i class="lg-last"></i>Last call, closes within the hour</span><span><i class="lg-off"></i>Closed</span></p></div>' +
      '<div class="tm-panel"><p class="tm-big"><b id="tmOpen">&nbsp;</b> <span>open right now</span></p>' +
        '<p class="tm-sub" id="tmSum">Loading tonight&rsquo;s shops&hellip;</p><ul class="tm-rows" id="tmRows"></ul>' +
        '<div class="tm-facts"><p><b id="tmLast">&nbsp;</b> last call within the hour</p><p id="tmLateWrap"><b id="tmLate">&nbsp;</b> open past midnight tonight</p></div>' +
        '<p class="tm-note">From each shop&rsquo;s posted hours, Pacific time. Updates every minute.</p></div>';
  }
  function place() {
    var off = host.querySelector(".tm-off"), frag = [];
    dots = shops.map(function (s) {
      if (s.la == null || s.la > B.n || s.la < B.s || s.lo < B.w || s.lo > B.e) return null;
      var p = xy(+s.la, +s.lo), c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", "2.3"); off.appendChild(c); return c;
    });
  }
  function tick() {
    var now = BNPins.now(), on = host.querySelector(".tm-on"), off = host.querySelector(".tm-off"), last = host.querySelector(".tm-last");
    var open = 0, lastCall = 0, late = 0, tot = {}, op = {};
    GROUPS.forEach(function (g) { tot[g.k] = 0; op[g.k] = 0; });
    shops.forEach(function (s, i) {
      var left = BNPins.openFor(s.per, now), g = null;
      for (var j = 0; j < GROUPS.length; j++) if (GROUPS[j].counties.indexOf(s.county) >= 0) { g = GROUPS[j].k; break; }
      if (g) tot[g]++;
      var target = off;
      if (left != null) {
        open++; if (g) op[g]++;
        if (left <= 60) { lastCall++; target = last; } else target = on;
        if (left > 24 * 60 - now.min) late++;
      }
      var d = dots[i]; if (d && d.parentNode !== target) target.appendChild(d);
    });
    host.querySelector("#tmOpen").textContent = n(open);
    host.querySelector("#tmSum").textContent = "of " + n(shops.length) + " SoCal shops, as of " + fmt(now.min) + ". Nearest open: use the finder above.";
    host.querySelector("#tmRows").innerHTML = GROUPS.map(function (g) {
      var pct = tot[g.k] ? Math.round(100 * op[g.k] / tot[g.k]) : 0;
      return '<li><a href="/near-me/?at=' + g.at + '"><span class="tm-r-name">' + g.label + '</span>' +
        '<span class="tm-r-n"><b>' + n(op[g.k]) + "</b> / " + n(tot[g.k]) + '</span><span class="tm-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></a></li>';
    }).join("");
    host.querySelector("#tmLast").textContent = n(lastCall);
    host.querySelector("#tmLate").textContent = n(late);
    host.querySelector("#tmLateWrap").hidden = now.min < 17 * 60; /* "past midnight tonight" only reads true in the evening */
    host.querySelector("svg").setAttribute("aria-label", n(open) + " of " + n(shops.length) + " SoCal boba shops are open right now");
  }
  frame();
  BNPins.load().then(function (rows) {
    /* counts match the site-wide 1,410 (niteboba_site_stats); the 7 duplicated places sit on the
       same spot so they read as one dot, and get merged in the data-cleanup wave */
    shops = rows;
    place(); tick(); setInterval(tick, 60000);
  }).catch(function () {
    host.querySelector("#tmSum").innerHTML = 'Couldn&rsquo;t load tonight&rsquo;s shops. <a href="/near-me/">Open the map</a> instead.';
  });
})();
