# SESSION 2026-11-08 — Wave 3: "Where are you?" homepage finder + shareable map links

## What shipped (commit below)
- Homepage hero: the single "Find boba near me" button became a finder. Type a city or ZIP
  (typeahead over FINDER_DATA.locations) or tap "Use my location" → the 3 closest shops OPEN NOW
  (Pacific), "Open until 11 PM" / neon "Closes soon" (≤45 min), rating, one-tap Directions,
  then "See all N open within 5 miles on the map". Data: Supabase view niteboba_map_pins, paged.
  Shops without posted hours are never shown as open.
- js/homepage/near-me.js rewritten in place (same #findNear + #nearResults hooks). Fixes a live
  bug: the old button labelled shops "Open" from the is_featured flag, not hours.
- Return visits: remembers the last TYPED place (never a GPS fix) and answers at once.
- W0 events from the homepage (nb-events.js now loaded there): location_set city/zip/gps/denied,
  results_shown, zero_open, shop_click (rank), directions_click.
- /near-me/: ?at=<city-slug> and ?lat=&lng=&n= center the map on load; picking a city writes
  ?at= back (history.replaceState); GPS clears it so coordinates never land in a URL.
- Duplicate places (same Google place id) show once in the finder and once on the map.
- components/footer.js: "Menus checked July 1, 2026" → "Hours synced July 23, 2026".
- Styles: the hero's existing <style id="findme"> block, matched to the live hero (3px corners,
  syrup-pink primary, gilt Directions); tokens from luxury-homepage.css.

## Verified (local server of the real repo, headless Chrome, clock 21:15 PT, real 1,410-shop data)
Homepage Rowland Heights: Boba Bear 0.7 mi, Tastea 0.8 mi, Matcha Cafe Maiko 0.8 mi, "See all 34"
→ /near-me/?at=rowland-heights shows "Boba near Rowland Heights, 34 open now". GPS: same top 3.
Shared /near-me/?at=cypress: 24 open. ZIP 92618 desktop: Irvine, 31 open, duplicate 85C gone.
0 page errors on every flow; 8 funnel events sent. Contrast: all text pairs ≥ 4.5:1 (preview v1).

## Data issue found (needs its own wave + Jay's call)
7 Google places are listed twice in niteboba (8 extra rows), sometimes under two cities
(e.g. 7 Leaves Costa Mesa / Huntington Beach, It's Boba Time Hollywood / Los Angeles,
85°C Irvine x2, Class 302 Irvine / Santa Ana). Merge + 301 the duplicate profile slugs
(CLAUDE.md rule 5), then restamp counts (true total ~1,402).

## Still parked
- W3a hours refresh (pg_cron + Places Details, ~$8–28/month) — waiting on Jay's spend OK.
