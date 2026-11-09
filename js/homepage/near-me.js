/* Boba Night: "Where are you?" finder (Wave 3, 2026-11-08). Replaces js/homepage/near-me.js.
   Type a city or ZIP, or use GPS, and get the 3 closest shops that are OPEN RIGHT NOW (Pacific),
   with closing time, rating and one-tap directions. Then "See all N open on the map".

   Data: Supabase view niteboba_map_pins (open SoCal shops; hours as [[weekday,"HHMM","HHMM"]]),
   paged 1,000 rows per request. Places: window.FINDER_DATA.locations when the page has it (the
   homepage loads js/finder-data.js), otherwise the search_locations table.
   Honest by construction: only shops with posted hours can be "open"; no hours = never shown as open. */
(function () {
  "use strict";
  var root = document.getElementById("bnFind");
  if (!root) return;
  var form = root.querySelector("form"), input = root.querySelector("#bnFindQ"), list = root.querySelector("#bnFindAC"),
      gps = root.querySelector("#findNear"), out = document.getElementById("nearResults");
  var SB = "https://hfvbeqlefwwjlrbyxpbj.supabase.co/rest/v1/", KEY = "sb_publishable_wlfujszvn2logC3KNL3MsA_AW1F42kf";
  var H = { headers: { apikey: KEY, Authorization: "Bearer " + KEY } };
  var shops = null, places = null, loading = null, active = -1, matches = [];
  var track = function (e, p) { try { if (window.nbTrack) window.nbTrack(e, p); } catch (x) {} };

  /* ---------- data ---------- */
  function pageAll(url) {
    var rows = [];
    function next(off) {
      return fetch(url + "&limit=1000&offset=" + off, H).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (pg) { rows = rows.concat(pg); return pg.length < 1000 ? rows : next(off + 1000); });
    }
    return next(0);
  }
  function load() {
    if (loading) return loading;
    var p1 = pageAll(SB + "niteboba_map_pins?select=s,n,c,la,lo,r,rc,gm,addr,pid,per&order=s").then(function (r) { shops = r; });
    var fd = window.FINDER_DATA && window.FINDER_DATA.locations;
    var p2 = fd ? Promise.resolve(fd.map(function (l) { return { n: l.city, la: l.lat, lo: l.lng, z: l.zips || [] }; }))
      : pageAll(SB + "search_locations?select=name,lat,lng,zip_codes&type=eq.city&market_area=in.(%22Greater%20Los%20Angeles%22,%22Inland%20Empire%22,%22Orange%20County%22,%22San%20Diego%20Region%22)&order=name")
          .then(function (r) { return r.map(function (l) { return { n: l.name, la: +l.lat, lo: +l.lng, z: l.zip_codes || [] }; }); });
    loading = Promise.all([p1, p2.then(function (p) { places = p; })]);
    return loading;
  }

  /* ---------- time + hours (Pacific) ---------- */
  function pacificNow() {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    var d = 0, h = 0, m = 0, W = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    parts.forEach(function (p) { if (p.type === "weekday") d = W.indexOf(p.value); if (p.type === "hour") h = +p.value % 24; if (p.type === "minute") m = +p.value; });
    return { d: d, min: h * 60 + m };
  }
  function toMin(t) { return t ? (+t.slice(0, 2)) * 60 + (+t.slice(2)) : null; }
  function fmt(min) { var h = Math.floor(min / 60) % 24, m = min % 60, ap = h < 12 ? "AM" : "PM", h12 = h % 12 || 12; return h12 + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap; }
  /* returns minutes until close if open now, else null */
  function openFor(per, now) {
    if (!per) return null;
    for (var i = 0; i < per.length; i++) {
      var p = per[i], o = toMin(p[1]), c = toMin(p[2]);
      if (o == null) continue;
      if (c == null) { if (p[0] === now.d) return 24 * 60; continue; }
      if (c > o) { if (p[0] === now.d && now.min >= o && now.min < c) return c - now.min; }
      else {
        if (p[0] === now.d && now.min >= o) return 24 * 60 - now.min + c;
        if ((p[0] + 1) % 7 === now.d && now.min < c) return c - now.min;
      }
    }
    return null;
  }
  function miles(a, b, c, d) { var R = 3958.8, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
    var h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) * Math.sin(y / 2); return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

  /* ---------- the answer ---------- */
  function answer(la, lo, label, method, citySlug) {
    var now = pacificNow();
    var open = [];
    for (var i = 0; i < shops.length; i++) {
      var s = shops[i], left = openFor(s.per, now);
      if (left == null) continue;
      open.push({ s: s, d: miles(la, lo, +s.la, +s.lo), left: left });
    }
    open.sort(function (a, b) { return a.d - b.d; });
    /* a few places are listed twice in the data (same Google place id); show each place once */
    var seen = {}; open = open.filter(function (x) { var k = x.s.pid || x.s.s; if (seen[k]) return false; seen[k] = 1; return true; });
    var within = open.filter(function (x) { return x.d <= 5; }).length;
    var top = open.slice(0, 3);
    var mapUrl = "/near-me/" + (citySlug ? "?at=" + citySlug : "?lat=" + la.toFixed(3) + "&lng=" + lo.toFixed(3) + "&n=" + encodeURIComponent(label));
    track("results_shown", { area: label, radius: 5, results: within, open: within, lat: la, lng: lo });
    /* remember typed places only; a GPS fix is never stored (you may have moved, and it's precise) */
    if (citySlug) { try { localStorage.setItem("bn_last_area", JSON.stringify({ n: label, la: la, lo: lo, cs: citySlug })); } catch (e) {} }
    if (!top.length) {
      track("zero_open", { area: label, radius: 5, results: 0 });
      show('<p class="nf-head">Nothing with posted hours is open right now. Late-night spots reopen in the morning.</p>' +
        '<a class="nf-all" href="/best/open-late/">See what stays open late &rsaquo;</a>');
      return;
    }
    var far = top[0].d > 5;
    var cards = top.map(function (x, i) {
      var s = x.s, dist = x.d < 0.1 ? "here" : (x.d < 10 ? x.d.toFixed(1) : Math.round(x.d)) + " mi";
      var soon = x.left <= 45, closes = fmt((now.min + x.left) % (24 * 60));
      var dir = s.gm || ("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(s.n + " " + (s.addr || s.c)));
      var rating = s.r != null ? '<span class="nf-star">&#9733; ' + (+s.r).toFixed(1) + (s.rc ? ' <span class="nf-rc">(' + (+s.rc).toLocaleString("en-US") + ')</span>' : "") + "</span>" : "";
      return '<li class="nf-card">' +
        '<a class="nf-main" href="/boba/ca/' + slug(s.c) + "/" + esc(s.s) + '/" data-rank="' + (i + 1) + '" data-slug="' + esc(s.s) + '">' +
          '<span class="nf-rank" aria-hidden="true">' + (i + 1) + "</span>" +
          '<span class="nf-body"><span class="nf-name">' + esc(s.n) + "</span>" +
          '<span class="nf-meta"><span class="nf-open' + (soon ? " is-soon" : "") + '"><i></i>' + (soon ? "Closes soon &middot; " + closes : "Open until " + closes) + "</span>" +
          '<span class="nf-dot"></span>' + esc(s.c) + '<span class="nf-dot"></span>' + dist + "</span>" + rating + "</span></a>" +
        '<a class="nf-go" href="' + esc(dir) + '" target="_blank" rel="noopener" data-slug="' + esc(s.s) + '">Directions</a></li>';
    }).join("");
    show('<p class="nf-head">' + (far ? "Nothing open within 5 miles. Closest open to " : "Open now near ") + "<b>" + esc(label) + "</b></p>" +
      '<ol class="nf-list">' + cards + "</ol>" +
      '<a class="nf-all" href="' + mapUrl + '">' + (within > 3 ? "See all " + within + " open within 5 miles on the map" : "Open the map around " + esc(label)) + " &rsaquo;</a>");
  }
  function show(html) { out.hidden = false; out.innerHTML = html; }
  function busy(msg) { show('<p class="nf-head nf-loading">' + msg + "</p>"); }

  /* ---------- places typeahead ---------- */
  function findPlaces(q) {
    q = q.trim().toLowerCase(); if (!q || !places) return [];
    var zip = /^\d{2,5}$/.test(q), res = [];
    for (var i = 0; i < places.length; i++) {
      var p = places[i], n = p.n.toLowerCase(), hit = null;
      if (zip) { for (var j = 0; j < p.z.length; j++) if (p.z[j].indexOf(q) === 0) { hit = { p: p, sub: "ZIP " + p.z[j], rank: 0 }; break; } }
      else if (n.indexOf(q) === 0) hit = { p: p, sub: "", rank: 0 };
      else if (n.indexOf(" " + q) > 0) hit = { p: p, sub: "", rank: 1 };
      if (hit) res.push(hit);
    }
    res.sort(function (a, b) { return a.rank - b.rank || a.p.n.localeCompare(b.p.n); });
    return res.slice(0, 6);
  }
  function renderAC() {
    if (!matches.length) { list.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    list.innerHTML = matches.map(function (m, i) {
      return '<li role="option" id="bnFindOpt' + i + '" class="nf-opt' + (i === active ? " is-on" : "") + '" aria-selected="' + (i === active) + '" data-i="' + i + '">' +
        esc(m.p.n) + (m.sub ? ' <span class="nf-sub">' + esc(m.sub) + "</span>" : "") + "</li>";
    }).join("");
    list.hidden = false; input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", active >= 0 ? "bnFindOpt" + active : "");
  }
  function pick(m, typed) {
    matches = []; renderAC(); input.value = m.p.n;
    track("location_set", { method: /^\d/.test(typed || "") ? "zip" : "city", area: m.p.n, lat: m.p.la, lng: m.p.lo, radius: 5 });
    answer(m.p.la, m.p.lo, m.p.n, null, slug(m.p.n));
  }

  input.addEventListener("focus", function () { load(); }, { once: true });
  input.addEventListener("input", function () {
    load().then(function () { matches = findPlaces(input.value); active = matches.length ? 0 : -1; renderAC(); });
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!matches.length) return; e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length; renderAC(); }
    else if (e.key === "Escape") { matches = []; renderAC(); }
  });
  list.addEventListener("mousedown", function (e) { var li = e.target.closest("[data-i]"); if (li) { e.preventDefault(); pick(matches[+li.dataset.i], input.value); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault(); var typed = input.value;
    if (!typed.trim()) { input.focus(); return; }
    busy("Finding what&rsquo;s open&hellip;");
    load().then(function () {
      var m = matches[active] || findPlaces(typed)[0];
      if (m) pick(m, typed);
      else show('<p class="nf-head">We don&rsquo;t know &ldquo;' + esc(typed) + '&rdquo; yet. Try a SoCal city or ZIP, like Rowland Heights or 90630.</p>');
    }).catch(function () { show('<p class="nf-head">Couldn&rsquo;t load shops. <a href="/near-me/">Open the map</a> instead.</p>'); });
  });
  document.addEventListener("click", function (e) { if (!root.contains(e.target)) { matches = []; renderAC(); } });

  gps.addEventListener("click", function () {
    if (!("geolocation" in navigator)) { show('<p class="nf-head">Your browser won&rsquo;t share location. Type a city or ZIP instead.</p>'); input.focus(); return; }
    gps.classList.add("is-locating"); gps.setAttribute("aria-busy", "true"); busy("Finding you&hellip;");
    var done = function () { gps.classList.remove("is-locating"); gps.removeAttribute("aria-busy"); };
    navigator.geolocation.getCurrentPosition(function (pos) {
      var la = pos.coords.latitude, lo = pos.coords.longitude;
      track("location_set", { method: "gps", area: "Near me", lat: la, lng: lo, radius: 5 });
      load().then(function () { done(); answer(la, lo, "you", "gps"); }).catch(function () { done(); show('<p class="nf-head">Couldn&rsquo;t load shops. <a href="/near-me/">Open the map</a> instead.</p>'); });
    }, function () {
      done(); track("location_set", { method: "denied" });
      show('<p class="nf-head">Location is off. Type your city or ZIP above.</p>'); input.focus();
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  });

  out.addEventListener("click", function (e) {
    var a = e.target.closest("a"); if (!a) return;
    if (a.classList.contains("nf-go")) track("directions_click", { slug: a.dataset.slug, area: input.value || "you", radius: 5 });
    else if (a.classList.contains("nf-main")) track("shop_click", { slug: a.dataset.slug, rank: +a.dataset.rank, area: input.value || "you", radius: 5 });
  });

  /* Return visit: show tonight's answer for the last area right away (retention). */
  try {
    var last = JSON.parse(localStorage.getItem("bn_last_area") || "null");
    if (last && last.n && isFinite(last.la)) {
      if (last.n !== "you") input.value = last.n;
      load().then(function () { answer(+last.la, +last.lo, last.n, "return", last.cs || null); });
    }
  } catch (e) {}
})();
