/* Find boba near me — geolocate, show nearest open shops. Honest: only shops
   with verified coordinates + not closed. No fake distances. */
(function () {
  "use strict";
  var btn = document.getElementById("findNear");
  var out = document.getElementById("nearResults");
  if (!btn || !out) return;
  var shops = null;

  function miles(la1, lo1, la2, lo2) {
    var R = 3958.8, t = Math.PI / 180;
    var dLa = (la2 - la1) * t, dLo = (lo2 - lo1) * t;
    var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
      Math.cos(la1 * t) * Math.cos(la2 * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];});}
  function show(html){ out.hidden = false; out.innerHTML = html; }

  function render(pos) {
    var la = pos.coords.latitude, lo = pos.coords.longitude;
    var near = shops.map(function (s) { return { s: s, d: miles(la, lo, s.la, s.lo) }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, 6);
    var cards = near.map(function (x) {
      var s = x.s, dist = x.d < 0.1 ? "under 0.1 mi" : x.d.toFixed(1) + " mi";
      var maps = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(s.n + " " + s.c + " CA");
      return '<li class="near-card">'
        + '<a class="near-main" href="/boba/ca/' + s.cs + '/' + s.s + '/">'
        + '<span class="near-name">' + esc(s.n) + '</span>'
        + '<span class="near-meta">' + esc(s.c) + '<span class="near-dot"></span>' + dist
        + (s.vf ? '<span class="near-open">Open</span>' : '<span class="near-vg">Verifying</span>') + '</span></a>'
        + '<a class="near-go" href="' + maps + '" target="_blank" rel="noopener">Directions</a></li>';
    }).join("");
    show('<p class="near-head">Closest to you, sorted by distance</p><ul class="near-list">' + cards + '</ul>'
      + '<a class="near-all" href="/directory/">See every shop</a>');
    if (window.BobaSound && window.BobaSound.enabled) try { window.BobaSound.chime("reveal"); } catch (e) {}
  }

  function fail(msg) {
    show('<p class="near-head">' + msg + '</p><a class="near-all" href="/directory/">Browse every shop instead</a>');
  }

  btn.addEventListener("click", function () {
    if (!("geolocation" in navigator)) { fail("Your browser will not share location. Browse the directory instead."); return; }
    btn.classList.add("is-locating"); btn.setAttribute("aria-busy", "true");
    show('<p class="near-head near-loading">Finding shops near you…</p>');
    var go = function () {
      navigator.geolocation.getCurrentPosition(function (pos) {
        btn.classList.remove("is-locating"); btn.removeAttribute("aria-busy");
        render(pos);
      }, function () {
        btn.classList.remove("is-locating"); btn.removeAttribute("aria-busy");
        fail("Location is off, so we cannot sort by distance. Pick your area in the directory.");
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    };
    if (shops) { go(); return; }
    fetch("/js/near-index.json").then(function (r) { return r.json(); })
      .then(function (j) { shops = j; go(); })
      .catch(function () { btn.classList.remove("is-locating"); fail("Could not load shop locations. Browse the directory."); });
  });
})();
