/* Boba Night universal footer — components/footer.js
   One footer for every page. Include these three lines in any template:
     <link rel="stylesheet" href="/components/footer.css">
     <div id="bn-footer"></div>
     <script src="/components/footer.js" defer></script>
   Editing THIS file (or footer.css) updates the footer on every page on the
   next load. Never regenerate page templates for a footer change.
   The shop/city counts render live from Supabase with a session cache;
   the numbers below are the checked fallback for the first paint. */
(function(){
'use strict';
var MARKUP="<footer class=\"ft2\">\n  <div class=\"wrap\">\n    <div class=\"ft2-crest\" aria-hidden=\"true\"><span class=\"ft2-hair\"></span><span class=\"ft2-pearls\"><i></i><i></i><i class=\"pk\"></i><i></i><i></i></span><span class=\"ft2-hair\"></span></div>\n    <div class=\"ft2-grid\">\n      <div class=\"ft2-brand\">\n        <span class=\"wordmark\" style=\"font-size:1.6rem\">Boba <b>Night</b><span class=\"soc\">Society</span></span>\n        <p class=\"ft2-tag\">The night guide to Southern California boba. Menus checked, sources shown, nothing invented.</p>\n        <p class=\"ft2-stat\"><b id=\"ft2Shops\">1,410</b> shops<span class=\"ft2-dot\"></span><b id=\"ft2Cities\">190</b> cities<span class=\"ft2-dot\"></span>checked and current</p>\n        <a class=\"ft2-late\" href=\"/best/open-late/\"><span class=\"ft2-led\" aria-hidden=\"true\"></span>Open past midnight. See who&rsquo;s still pouring.</a>\n      </div>\n      <nav class=\"ft2-col\" aria-label=\"Tonight\"><h5>Tonight</h5><a href=\"/#tonight\">Tonight&rsquo;s selection</a><a href=\"/#concierge\">The Concierge</a><a href=\"/boba/ca/city-of-industry/taro-yuan-city-of-industry/\">Featured shop</a><a href=\"/near-me/\">The boba map</a></nav>\n      <nav class=\"ft2-col\" aria-label=\"Explore\"><h5>Explore</h5><a href=\"/directory/\">The directory</a><a href=\"/area/sgv/\">The 626</a><a href=\"/area/orange-county/\">Orange County</a><a href=\"/area/greater-la/\">Greater LA</a><a href=\"/area/san-diego/\">San Diego</a><a href=\"/area/inland-empire/\">Inland Empire</a><a href=\"/area/ventura/\">Ventura 805</a><a href=\"/las-vegas/\">Las Vegas</a></nav>\n      <nav class=\"ft2-col\" aria-label=\"The menu\"><h5>The Menu</h5><a href=\"/best/matcha/\">Matcha</a><a href=\"/best/fruit-tea/\">Fruit tea</a><a href=\"/best/brown-sugar/\">Brown sugar</a><a href=\"/best/non-dairy/\">Dairy-free</a><a href=\"/best/open-late/\">Open late</a><a href=\"/pantry/\">The Pantry</a></nav>\n      <nav class=\"ft2-col\" aria-label=\"Community\"><h5>Community</h5><a href=\"/meetups/\">Meetups &amp; clubs</a><a href=\"/meetups/calendar/\">Venue calendar</a><a href=\"/critic/\">The Pearl Ratings</a><a href=\"/claim/\">Claim a shop</a><a href=\"/report/\">Report a correction</a></nav>\n    </div>\n    <div class=\"ft2-bottom\"><span>&copy; 2026 Boba Night Society &middot; Southern California</span><span>Menus checked July 1, 2026 &middot; No paid rankings &middot; <a href=\"/report/\">Corrections welcome</a></span></div>\n  </div>\n</footer>";
function mount(){
  var host=document.getElementById('bn-footer');
  var existing=document.querySelector('footer.ft2');
  if(host){host.innerHTML=MARKUP;}
  else if(existing){existing.outerHTML=MARKUP;}
  else{document.body.insertAdjacentHTML('beforeend',MARKUP);}
  counts();
}
function apply(s){
  var a=document.getElementById('ft2Shops');if(a)a.textContent=s.shops;
  var b=document.getElementById('ft2Cities');if(b)b.textContent=s.cities;
}
function counts(){
  try{var c=sessionStorage.getItem('bn_stats2');if(c){apply(JSON.parse(c));return;}}catch(e){}
  var K='sb_publishable_wlfujszvn2logC3KNL3MsA_AW1F42kf';
  /* W1 2026-11-08: one-row stats view; the old select=c read was capped at 1,000 rows. */
  fetch('https://hfvbeqlefwwjlrbyxpbj.supabase.co/rest/v1/niteboba_site_stats?select=socal_open_shops,socal_cities_with_shops',
    {headers:{apikey:K,Authorization:'Bearer '+K}})
  .then(function(r){return r.json()})
  .then(function(rows){
    if(!rows||!rows[0]||!(rows[0].socal_open_shops>0))return;
    var s={shops:rows[0].socal_open_shops.toLocaleString('en-US'),cities:rows[0].socal_cities_with_shops};
    try{sessionStorage.setItem('bn_stats2',JSON.stringify(s));}catch(e){}
    apply(s);
  }).catch(function(){});
}
if(document.readyState!=='loading')mount();
else document.addEventListener('DOMContentLoaded',mount);
})();
