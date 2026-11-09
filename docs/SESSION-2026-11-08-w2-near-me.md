# SESSION 2026-11-08 — Wave 2 item 1: /near-me/ sees every shop, open-now first

## Problem
/near-me/ baked only 215 shops inline (a hand-written July list) and never loaded the full data.
Default openOnly:false ranked closed shops first. At 21:04 PT, Rowland Heights showed 19 shops
(8 closed); the database has 34 open within 5 miles.

## Backend (Supabase CoverCapy, live)
- niteboba_finder: appended addr + pid columns (append-only; existing readers unaffected).
- NEW niteboba_map_pins: open SoCal shops only, compact shape for the map, hours as
  [[weekday,"HHMM","HHMM"]]. 1,410 rows; 820 KB raw vs 1.82 MB from the raw finder.

## Page (near-me/index.html)
- `let SHOPS`: the inline 215 stay as instant first paint and API-failure fallback.
- loadAllShops(): pages niteboba_map_pins 1,000 rows/request, maps to the inline shape, swaps
  SHOPS, recomputes city "nearby" counts, re-renders, re-logs the W0 results_shown.
- openOnly defaults to true; the Open now toggle starts pressed.

## Verified (jsdom, mock API with the real 1,410 shops/coords/hours)
LA 10 (4 closed) → 36 open; Rowland Heights 19 (8 closed) → 34 open; Cypress 12 (7 closed) → 24
open. 0 JS errors, 2 paged calls.

## Traps
- The cloud sandbox and bridge VM cannot reach *.supabase.co; browsers can. Prefer runtime reads
  of a purpose-built view over build-time exports when the page is an app, not an SEO page.
- REST responses cap at 1,000 rows: always page.

## Next
Homepage one-answer hero ("Where are you?" → top 3 open shops, from niteboba_map_pins);
shareable /near-me/?at=<city-slug>; drop the inline 215 once live data proves reliable.
