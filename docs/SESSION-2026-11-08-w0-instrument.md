# SESSION 2026-11-08 — Wave 0: instrument the funnel

## Why
Audit (project doc engagement-waves-audit-2026-11-08) found the site had zero measurement:
Vercel Web Analytics was off and no first-party events existed. Engagement work without a
baseline is unprovable, so Wave 0 ships measurement before any UX change.

## What changed
- Supabase (CoverCapy hfvbeqlefwwjlrbyxpbj), migration `niteboba_events_w0`:
  `public.niteboba_events` (anon INSERT only; no select/update/delete; CHECK constraints on
  event/method names, lengths, lat/lng ranges) + `public.niteboba_funnel_daily` view
  (not exposed to anon): located -> results -> clicked -> directions per Pacific day,
  plus gps_denied and zero_open.
- NEW `js/nb-events.js`: `window.nbTrack(event, props)`. No cookies, per-tab session id,
  coords rounded to 2 dp (~1 km), honors Do Not Track, skips webdriver, 3 s de-dupe
  (key includes method), batched fetch keepalive, flush on pagehide. Never throws.
- `near-me/index.html`: loads nb-events.js before the engine; hooks for default load,
  GPS ok/denied, city/ZIP pick, search-shop pick (rank 0, area "search"), results_shown
  once per (place, radius) + zero_open + widen_radius, map-pin tap (rank 0), list-card tap
  (rank = list position), Directions tap (maps.google./google.com/maps/goo.gl links).
- `js/nav-midnight.js`: injects /_vercel/insights/script.js once -> pageviews on every page
  that loads the shared nav (975 pages).

## Verified
- DB: anon INSERT=true, SELECT/UPDATE/DELETE=false; 10-row replay as role anon (rolled back)
  produced funnel 1/1/1/1, gps_denied 1. Table left empty.
- Page: jsdom run of the real HTML with a scripted visitor (load -> GPS Rowland Heights ->
  "Cypress" -> "90630" -> card #1 -> Directions -> GPS denied) emitted 10 valid rows,
  one session id, 0 JS errors. Inline scripts parse clean.

## Traps
- Directions links are `https://maps.google.com/?cid=...` (all 215), not google.com/maps.
- De-dupe key without `method` swallowed a ZIP pick that resolved to the same city.
- Neither the cloud sandbox nor the bridge VM can reach *.supabase.co or bobanight.com;
  prove RLS with `set local role anon` inside a rolled-back transaction instead.
- Vercel Web Analytics cannot be enabled via API; dashboard toggle only.
- Repo has stale .git/HEAD.lock + next-index-21.lock -> commit via temp-index plumbing.
- Untracked *.bundle files and sb_all_shops.json* in repo root: never `git add -A`.

## Decisions
- Measure before changing UX (Ross/Mary disagreement on cutting homepage sections deferred
  until 7 days of data). Rejected Google Analytics: cookies + consent banner, and it cannot
  express "searched Cypress, nothing open".
- Dessert expansion held for Wave 5, gated on data.

## Next
1. Jay: enable Analytics at vercel.com/cover-capy/bobatime/analytics; push to deploy.
2. After ~7 days: read niteboba_funnel_daily for the baseline.
3. Wave 1 (single count source) then Wave 2 (open-now default: `openOnly:true`, one-answer hero).
