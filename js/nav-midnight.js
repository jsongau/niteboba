/* ============================================================================
   BOBA NIGHT — unified navigation behavior (nav-midnight.js)
   Vanilla, no dependencies. Disclosure panels (click-to-open, Escape-close),
   SHOPS region tablist, cmd-K / slash search overlay, mobile drawer with
   region accordions, fixed bottom bar. Keyboard-accessible throughout.
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  /* Vercel Web Analytics (Wave 0, 2026-11-08): cookieless pageviews on every page that loads this file. */
  try {
    if (!doc.querySelector('script[src="/_vercel/insights/script.js"]')) {
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
      var vas = doc.createElement("script"); vas.defer = true; vas.src = "/_vercel/insights/script.js";
      (doc.head || doc.documentElement).appendChild(vas);
    }
  } catch (e) {}
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  var header = $("[data-bn-header]");
  if (!header) return;

  /* ------------------------------------------------------- desktop panels */
  var items = $$(".bn-item", header);
  var openItem = null;

  function closePanel() {
    if (!openItem) return;
    var trig = $(".bn-trigger", openItem);
    var panel = $(".bn-panel", openItem);
    openItem.removeAttribute("data-open");
    trig.setAttribute("aria-expanded", "false");
    // let the fade run, then hide from a11y tree
    panel.setAttribute("hidden", "");
    openItem = null;
    header.removeAttribute("data-panel-open");
  }

  function openPanel(item) {
    if (openItem === item) { closePanel(); return; }
    if (openItem) closePanel();
    var trig = $(".bn-trigger", item);
    var panel = $(".bn-panel", item);
    panel.removeAttribute("hidden");
    // next frame so the transition plays from the hidden state
    requestAnimationFrame(function () { item.setAttribute("data-open", ""); });
    item.setAttribute("data-open", "");
    trig.setAttribute("aria-expanded", "true");
    header.setAttribute("data-panel-open", "");
    openItem = item;
  }

  // Desktop hover-intent: open on pointer-settle (~140ms), close on a ~260ms
  // grace period so a diagonal trip to the panel doesn't dismiss it. Touch and
  // narrow viewports fall through to click-to-open. Click + Escape stay intact.
  var mqHover = window.matchMedia("(min-width:1080px) and (pointer:fine)");

  items.forEach(function (item) {
    var trig = $(".bn-trigger", item);
    var openT = null, closeT = null, slow = false, lastX = null, lastY = null;

    trig.addEventListener("click", function (e) {
      e.stopPropagation();
      clearTimeout(openT); clearTimeout(closeT);
      openPanel(item);
    });

    // track pointer speed across the whole item (trigger + its panel)
    item.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var dx = e.clientX - (lastX == null ? e.clientX : lastX);
      var dy = e.clientY - (lastY == null ? e.clientY : lastY);
      slow = Math.sqrt(dx * dx + dy * dy) <= 8;
      lastX = e.clientX; lastY = e.clientY;
    });
    trig.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "touch" || !mqHover.matches) return;
      clearTimeout(closeT);
      openT = setTimeout(function () {
        if (slow && openItem !== item) openPanel(item);
      }, 140);
    });
    item.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch") return;
      clearTimeout(openT);
      closeT = setTimeout(function () {
        if (openItem === item) closePanel();
      }, 260);
    });
  });

  // close on outside click
  doc.addEventListener("click", function (e) {
    if (openItem && !openItem.contains(e.target)) closePanel();
  });

  /* --------------------------------------------- SHOPS region tablist swap */
  $$(".bn-mega--shops").forEach(function (mega) {
    var tabs = $$(".bn-rail-b[role='tab']", mega);
    var panes = $$(".bn-pane", mega);
    function select(tab, focus) {
      var region = tab.getAttribute("data-region");
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      panes.forEach(function (p) {
        if (p.getAttribute("data-region") === region) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("mouseenter", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowDown" || k === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        else if (k === "ArrowUp" || k === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (k === "Home") n = tabs[0];
        else if (k === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  });

  /* --------------------------------------------------------- search overlay */
  var overlay = $("#bn-search");
  var overlayInput = overlay ? $("#bn-overlayq", overlay) : null;
  var resultsBox = overlay ? $("#bn-results", overlay) : null;
  var emptyMsg = overlay ? $("[data-bn-empty]", overlay) : null;
  var index = null, indexLoading = false;
  var lastFocus = null;
  var activeRes = -1;
  var statusEl = null;

  // Upgrade the input to a proper combobox and add a polite live count.
  // Real focus stays in the input; the highlighted option is tracked with
  // aria-activedescendant (virtual focus), the tested pattern.
  if (overlay && overlayInput) {
    overlayInput.setAttribute("role", "combobox");
    overlayInput.setAttribute("aria-autocomplete", "list");
    overlayInput.setAttribute("aria-haspopup", "listbox");
    var box = $(".bn-overlay-box", overlay);
    if (box) {
      statusEl = doc.createElement("p");
      statusEl.className = "bn-sr";
      statusEl.setAttribute("role", "status");
      statusEl.setAttribute("aria-live", "polite");
      box.appendChild(statusEl);
    }
  }

  function loadIndex(cb) {
    if (index) { cb(index); return; }
    if (indexLoading) return;
    indexLoading = true;
    fetch("/js/search-index.json").then(function (r) { return r.json(); })
      .then(function (data) { index = data; indexLoading = false; cb(index); })
      .catch(function () { indexLoading = false; });
  }

  function openOverlay() {
    if (!overlay) return;
    lastFocus = doc.activeElement;
    overlay.removeAttribute("hidden");
    doc.body.classList.add("bn-lock");
    closePanel();
    closeDrawer();
    loadIndex(function () {});
    requestAnimationFrame(function () { overlayInput.focus(); });
  }
  function closeOverlay() {
    if (!overlay || overlay.hasAttribute("hidden")) return;
    overlay.setAttribute("hidden", "");
    doc.body.classList.remove("bn-lock");
    overlayInput.value = "";
    renderResults("");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  // Subsequence fuzzy score: -1 = no match, higher = better. Rewards
  // consecutive-hit streaks and word-start hits (start of string, or after a
  // space / hyphen) so "bt" ranks "Boba Time" above scattered matches.
  function fuzzyScore(q, text) {
    text = text.toLowerCase();
    var qi = 0, score = 0, streak = 0;
    for (var ti = 0; ti < text.length && qi < q.length; ti++) {
      if (text.charAt(ti) === q.charAt(qi)) {
        streak++; score += streak;
        var prev = ti === 0 ? " " : text.charAt(ti - 1);
        if (prev === " " || prev === "-") score += 4;
        qi++;
      } else streak = 0;
    }
    return qi === q.length ? score : -1;
  }
  // <mark>-wrap the same subsequence characters the score matched.
  function fuzzyMark(name, q) {
    var out = "", qi = 0, low = name.toLowerCase();
    for (var ti = 0; ti < name.length; ti++) {
      var ch = name.charAt(ti);
      if (qi < q.length && low.charAt(ti) === q.charAt(qi)) { out += "<mark>" + esc(ch) + "</mark>"; qi++; }
      else out += esc(ch);
    }
    return out;
  }
  function announce(n, q) {
    if (!statusEl) return;
    statusEl.textContent = !q ? "" : (n === 0 ? "No results" : n + " result" + (n === 1 ? "" : "s"));
  }

  var GROUPS = [
    { key: "shops", label: "Tea Houses", meta: function (r) { return r.c; } },
    { key: "cities", label: "Cities", meta: function () { return ""; } },
    { key: "pages", label: "Pages", meta: function (r) { return r.g || ""; } },
    { key: "ingredients", label: "Ingredients", meta: function () { return "Pantry"; } }
  ];

  function renderResults(q) {
    if (!resultsBox) return;
    activeRes = -1;
    if (overlayInput) overlayInput.removeAttribute("aria-activedescendant");
    q = (q || "").trim().toLowerCase();
    if (!q) { resultsBox.innerHTML = ""; resultsBox.appendChild(emptyMsg); overlayInput.setAttribute("aria-expanded", "false"); announce(0, ""); return; }
    if (!index) { return; }
    var html = "", total = 0, oid = 0;
    GROUPS.forEach(function (g) {
      var scored = [];
      (index[g.key] || []).forEach(function (r) {
        var s = fuzzyScore(q, r.n || "");
        if (s >= 0) scored.push({ r: r, s: s });
      });
      if (!scored.length) return;
      scored.sort(function (a, b) { return b.s - a.s; });
      scored = scored.slice(0, 5);
      html += '<div class="bn-group-h" role="presentation">' + esc(g.label) + "</div>";
      scored.forEach(function (it) {
        var r = it.r, m = g.meta(r);
        html += '<a class="bn-res" role="option" id="bn-opt-' + (oid++) + '" href="' + esc(r.u) + '">' +
          '<span class="bn-res-name">' + fuzzyMark(r.n, q) + "</span>" +
          (m ? '<span class="bn-res-meta">' + esc(m) + "</span>" : "") + "</a>";
        total++;
      });
    });
    overlayInput.setAttribute("aria-expanded", total ? "true" : "false");
    resultsBox.innerHTML = total ? html : '<p class="bn-results-empty">No matches for “' + esc(q) + '”.</p>';
    announce(total, q);
  }

  function resItems() { return $$(".bn-res", resultsBox); }
  function setActive(i) {
    var els = resItems();
    if (!els.length) { activeRes = -1; if (overlayInput) overlayInput.removeAttribute("aria-activedescendant"); return; }
    activeRes = (i + els.length) % els.length;
    els.forEach(function (el, n) {
      if (n === activeRes) {
        el.setAttribute("aria-selected", "true");
        el.scrollIntoView({ block: "nearest" });
        overlayInput.setAttribute("aria-activedescendant", el.id);
      } else el.removeAttribute("aria-selected");
    });
  }

  if (overlay) {
    overlayInput.addEventListener("input", function () { renderResults(overlayInput.value); });
    overlayInput.addEventListener("keydown", function (e) {
      var els = resItems();
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeRes + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeRes - 1); }
      else if (e.key === "Enter") {
        var go = (activeRes >= 0 && els[activeRes]) ? els[activeRes] : els[0];
        if (go) { e.preventDefault(); window.location.href = go.getAttribute("href"); }
      }
    });
    $$("[data-bn-search-close]", overlay).forEach(function (b) {
      b.addEventListener("click", closeOverlay);
    });
  }

  // openers: persistent field, drawer button, bottom-bar button
  $$("[data-bn-search-open]").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); openOverlay(); });
    el.addEventListener("submit", function (e) { e.preventDefault(); openOverlay(); });
  });
  $$("[data-bn-open-search]").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); openOverlay(); });
  });

  /* --------------------------------------------------------------- drawer */
  var drawer = $("#bn-drawer");
  var burger = $(".bn-burger", header);

  function openDrawer() {
    if (!drawer) return;
    drawer.removeAttribute("hidden");
    requestAnimationFrame(function () { drawer.setAttribute("data-open", ""); });
    burger.setAttribute("aria-expanded", "true");
    doc.body.classList.add("bn-lock");
    var x = $(".bn-drawer-x", drawer);
    if (x) x.focus();
  }
  function closeDrawer() {
    if (!drawer || drawer.hasAttribute("hidden")) return;
    drawer.removeAttribute("data-open");
    burger.setAttribute("aria-expanded", "false");
    doc.body.classList.remove("bn-lock");
    var d = drawer;
    var onEnd = function () { d.setAttribute("hidden", ""); d.removeEventListener("transitionend", onEnd); };
    d.addEventListener("transitionend", onEnd);
    // fallback for reduced-motion (no transition fires)
    setTimeout(function () { if (!d.hasAttribute("data-open")) d.setAttribute("hidden", ""); }, 320);
    if (burger) burger.focus();
  }

  if (burger) burger.addEventListener("click", function () {
    if (drawer && drawer.hasAttribute("hidden")) openDrawer(); else closeDrawer();
  });
  if (drawer) {
    $$("[data-bn-drawer-close]", drawer).forEach(function (b) { b.addEventListener("click", closeDrawer); });
    // region accordions
    $$(".bn-acc-b", drawer).forEach(function (b) {
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-expanded") === "true";
        b.setAttribute("aria-expanded", on ? "false" : "true");
      });
    });
  }

  /* ---------------------------------------------------------- global keys */
  doc.addEventListener("keydown", function (e) {
    // cmd-K / ctrl-K -> search
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault(); openOverlay(); return;
    }
    // "/" -> search (unless typing in a field)
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) && !e.target.isContentEditable) {
      e.preventDefault(); openOverlay(); return;
    }
    if (e.key === "Escape") {
      if (overlay && !overlay.hasAttribute("hidden")) { closeOverlay(); return; }
      if (drawer && !drawer.hasAttribute("hidden")) { closeDrawer(); return; }
      if (openItem) { var t = $(".bn-trigger", openItem); closePanel(); if (t) t.focus(); }
    }
  });

  /* -------------------------------------------------------- mobile bottom bar */
  var bottombar = $(".bn-bottombar");
  if (bottombar) {
    // Mark the tab for the current page so its neon dot carries the single glow.
    var here = location.pathname.replace(/\/+$/, "") || "/";
    var bbLinks = $$("a.bn-bb", bottombar);
    for (var i = 0; i < bbLinks.length; i++) {
      var lp = bbLinks[i].pathname.replace(/\/+$/, "") || "/";
      var lh = bbLinks[i].hash || "";
      if (lp === here && (!lh || lh === location.hash)) {
        bbLinks[i].setAttribute("aria-current", "page");
        break;
      }
    }
    // Hide on scroll down, reveal on scroll up (transform only; CSS guards RM).
    var lastY = window.pageYOffset || 0, ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset || 0;
        // don't hide while an overlay/drawer is open or near the top
        var locked = doc.body.classList.contains("bn-lock");
        if (!locked && y > lastY && y > 140) bottombar.classList.add("bn-bb-hidden");
        else if (y < lastY || y <= 140) bottombar.classList.remove("bn-bb-hidden");
        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }
})();


/* Search Boba Night floater: appears after the hero, dismiss lasts the visit (2026-07-22) */
(function(){function ready(f){if(document.readyState!=="loading")f();else document.addEventListener("DOMContentLoaded",f);}ready(function(){(function(){
var K="bn_search_float_closed";
try{localStorage.removeItem(K);}catch(e){}
var floats=[].slice.call(document.querySelectorAll(".ty-float"));
if(!floats.length)return;
var closed=false;try{closed=sessionStorage.getItem(K)==="1";}catch(e){}
var pastHero=false;
function apply(){floats.forEach(function(f){f.classList.toggle("ty-on",pastHero&&!closed);});}
function kill(){closed=true;apply();try{sessionStorage.setItem(K,"1");}catch(_){}}
document.querySelectorAll(".ty-x").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();kill();});});
var hero=document.getElementById("tonight");
function byScroll(){var h=hero?hero.offsetHeight:600;pastHero=window.scrollY>=h*0.9;apply();}
if(hero&&"IntersectionObserver" in window){
  new IntersectionObserver(function(en){en.forEach(function(x){pastHero=!x.isIntersecting;apply();});},{threshold:0.05}).observe(hero);
}else{
  window.addEventListener("scroll",byScroll,{passive:true});
}
byScroll();
})();});})();


/* location pin state machine: any geolocation call animates every .bn-pin (2026-07-22) */
(function(){var g=navigator.geolocation;if(!g||!g.getCurrentPosition)return;var orig=g.getCurrentPosition.bind(g);
function pins(st){[].slice.call(document.querySelectorAll(".bn-pin")).forEach(function(b){
  b.classList.remove("is-searching","is-found");
  if(st==="searching")b.classList.add("is-searching");
  if(st==="found")b.classList.add("is-found");});}
navigator.geolocation.getCurrentPosition=function(ok,err,opt){pins("searching");
  orig(function(p){pins("found");try{if(window.__bnApplyGeo)window.__bnApplyGeo(p.coords.latitude,p.coords.longitude);}catch(e){}if(ok)ok(p);},function(e){pins("idle");if(err)err(e);},opt);};})();


/* ===== market toggle: SoCal <-> Las Vegas (2026-07-22) ===== */
(function(){
"use strict";
var LV=/^\/(las-vegas|boba\/nv)(\/|$)/.test(location.pathname)||(document.body&&document.body.getAttribute("data-market")==="lv");
try{if(LV)localStorage.setItem("bn_market","lv");}catch(e){}
function bind(){
  var p=document.getElementById("bnMkt");
  if(!p||p.__bnb)return !!p;
  p.__bnb=1;
  if(LV){p.classList.add("is-lv");p.setAttribute("href","/");p.title="Switch to SoCal";p.setAttribute("aria-label","Switch to Southern California");}
  else{p.setAttribute("href","/las-vegas/");p.title="Switch to Las Vegas";p.setAttribute("aria-label","Switch to Las Vegas");}
  p.addEventListener("click",function(){try{localStorage.setItem("bn_market",LV?"sc":"lv");}catch(e){}});
  return true;
}
var tries=0,t=setInterval(function(){if(bind()||++tries>12)clearInterval(t);},350);
bind();
if(!LV&&(location.pathname==="/"||/\/index\.html$/.test(location.pathname))){
  var pref=null,dis=null;
  try{pref=localStorage.getItem("bn_market");dis=sessionStorage.getItem("bn_mkt_dis");}catch(e){}
  if(pref==="lv"&&!dis){
    var r=document.createElement("div");
    r.className="bn-mktrib";
    r.innerHTML='<span>You were browsing <b>Las Vegas</b>.</span><a href="/las-vegas/">Back to Las Vegas</a><button type="button" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(r);
    r.querySelector("button").addEventListener("click",function(){r.remove();try{sessionStorage.setItem("bn_mkt_dis","1");}catch(e){}});
    requestAnimationFrame(function(){requestAnimationFrame(function(){r.classList.add("on");});});
  }
}
})();


/* ===== Night-Market Charms: active tab, pill, pencil hover, press feedback (2026-07-23) ===== */
(function(){
"use strict";
function init(){
  var bar=document.querySelector(".bn-bottombar");
  if(!bar||bar.__chm)return !!bar;
  bar.__chm=1;
  var tabs=[].slice.call(bar.querySelectorAll(".bn-bb"));
  var pill=bar.querySelector(".bn-bbpill");
  var path=location.pathname;
  var idx=-1;
  if(path.indexOf("/account")===0)idx=0;
  else if(path.indexOf("/directory")===0)idx=1;
  else if(path.indexOf("/near-me")===0||path.indexOf("/nearby")===0)idx=2;
  if(idx>-1&&tabs[idx]){
    tabs[idx].setAttribute("aria-current","page");
    if(pill){pill.style.transform="translateX("+(idx*100)+"%)";
      requestAnimationFrame(function(){pill.classList.add("on");});}
  }
  tabs.forEach(function(t){
    t.addEventListener("pointerover",function(e){if(e.pointerType==="pen")t.classList.add("pen-hover");});
    t.addEventListener("pointerout",function(){t.classList.remove("pen-hover");});
    t.addEventListener("pointerdown",function(){
      if("vibrate" in navigator){try{navigator.vibrate(8);}catch(e){}}
    });
  });
  return true;
}
var n=0,t=setInterval(function(){if(init()||++n>12)clearInterval(t);},350);
init();
})();
