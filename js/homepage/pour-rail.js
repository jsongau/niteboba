/* The night guide — a slim bar pinned to the viewport that rotates through
   real sourced drinks as you browse, each linking to a shop, with a second
   micro-line of honest house facts. Styles live in index.html <style id="pourrail">.
   Dismissible and remembered; no auto-rotate under prefers-reduced-motion.
   Desktop only (mobile already has the bottom bar). Degrades to nothing
   without JS. */
(function () {
  "use strict";
  var KEY = "bobanight_rail_v1";
  try { if (localStorage.getItem(KEY) === "off") return; } catch (e) {}

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tries = 0;
  function ready() { return window.CBS && window.CBS.S && window.CBS.S.drinks && window.CBS.S.drinks.length; }

  // Honest house facts only — every line traces to a claim already on the page.
  var HINTS = [
    "Turn the cards above for tonight's pick",
    "Real hours on every shop, synced from the source",
    "Every drink here comes from an official menu",
    "No shop pays to appear in this rotation"
  ];

  function build() {
    var CBS = window.CBS;
    // drinks that resolve to a real shop, so every rotation links somewhere real
    var pours = [];
    CBS.S.drinks.forEach(function (d) {
      var shop = CBS.shopFor(d, null);
      if (shop) pours.push({ d: d, shop: shop });
    });
    if (pours.length < 2) return;
    // stable shuffle seeded off the day so it's not identical every reload
    var seed = CBS.hash(new Date().toISOString().slice(0, 10));
    for (var i = pours.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; var j = seed % (i + 1); var t = pours[i]; pours[i] = pours[j]; pours[j] = t; }

    var bar = document.createElement("aside");
    bar.className = "pour-rail";
    bar.setAttribute("aria-label", "The night guide, rotating drink picks");
    bar.innerHTML =
      '<span class="pr-kick"><span class="pr-led" aria-hidden="true"></span>The night guide</span>' +
      '<a class="pr-body" href="#">' +
      '<span class="pr-text"><b class="pr-name"></b><span class="pr-at"> at </span><span class="pr-where"></span></span>' +
      '<span class="pr-hint"></span></a>' +
      '<div class="pr-controls"><button class="pr-next" type="button" aria-label="Next drink">Next</button>' +
      '<button class="pr-x" type="button" aria-label="Hide the night guide">&times;</button></div>';
    document.body.appendChild(bar);
    document.body.classList.add("has-pour-rail");

    var idx = 0, timer = null;
    var nameEl = bar.querySelector(".pr-name"), whereEl = bar.querySelector(".pr-where"),
        hintEl = bar.querySelector(".pr-hint"), link = bar.querySelector(".pr-body");
    function paint(animate) {
      var p = pours[idx % pours.length], d = p.d, shop = p.shop;
      var apply = function () {
        nameEl.textContent = d.n;
        whereEl.textContent = shop.name + ", " + shop.city;
        hintEl.textContent = HINTS[idx % HINTS.length];
        link.setAttribute("href", CBS.profileUrl(shop));
        if (animate && !reduce) { bar.classList.remove("is-in"); void bar.offsetWidth; bar.classList.add("is-in"); }
      };
      apply();
    }
    function next() { idx++; paint(true); }
    function schedule() { if (reduce) return; clearInterval(timer); timer = setInterval(next, 6000); }

    bar.querySelector(".pr-next").addEventListener("click", function () { next(); schedule(); });
    bar.querySelector(".pr-x").addEventListener("click", function () {
      bar.classList.add("is-out"); document.body.classList.remove("has-pour-rail");
      try { localStorage.setItem(KEY, "off"); } catch (e) {}
      setTimeout(function () { bar.remove(); }, 260);
    });
    bar.addEventListener("mouseenter", function () { clearInterval(timer); });
    bar.addEventListener("mouseleave", schedule);

    paint(false); bar.classList.add("is-in"); schedule();
  }

  function boot() { if (ready()) { build(); return; } if (tries++ < 40) setTimeout(boot, 150); }
  if (document.readyState !== "loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
