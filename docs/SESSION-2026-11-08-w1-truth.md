# SESSION 2026-11-08 — Wave 1: one true count everywhere

## Why
The site showed four different shop counts (998, 334, 215, and the real 1,410) and a stale
calendar. Trust work, and the prerequisite for measuring Wave 2.

## Truth source
Supabase views (CoverCapy, migration `niteboba_counts_w1`):
- `niteboba_site_stats` (1 row, anon-readable): 1,410 open SoCal shops, 190 cities, 119 LV.
- `niteboba_city_counts`: open shops per county+city.
Build snapshot js/finder-data.js matched exactly (md5 of sorted city|count list
9e0992672cf12b536bcec0c2f4312cb1 on both sides). NOTE: 1,529 = all open INCLUDING Las Vegas.

## Root causes
1. build/nav_data.py read a 334-row SHOPS array from directory/index.html that no longer
   exists → raised on import → nav counts frozen at 334/46 AND gen_site.py unimportable.
2. js/below-hero.js + components/footer.js counted `niteboba_finder?select=c` rows; the API
   caps a response at 1,000 rows and the view holds 1,637 (incl. closed + LV) → "998".
3. Same cap in below-hero.js loadLive(): homepage live sections used the first 1,000 rows,
   including permanently closed shops.
4. Three region rules (gen_site.py, below-hero.js, nav) disagreed.

## Changes
- NEW build/regions.py (region_of + SGV_CITIES moved verbatim from gen_site.py).
- build/nav_data.py reads js/finder-data.js (open, non-Clark); nav links only to existing hubs;
  search only to existing profiles; CITY_COUNT = cities with an open shop (Supabase definition).
- NEW build/apply_counts.py: stamps nav rail/panes/drawer, search hint, "All N shops",
  homepage hero/meta/tiles, footer fallback; rebuilds js/search-index.json (1,410 shops).
  `--expect socal,lv` from niteboba_site_stats is required; aborts on mismatch; idempotent.
- 978 pages restamped. Homepage: 1,410/190; tiles 207/257/491/146/243; "Hours synced July 23,
  2026"; weekly calendar card computes next Thursday (Pacific); stale race date removed.
- below-hero.js: stats view for counts; loadLive pages open SoCal shops 1,000 at a time;
  renderDir no longer re-derives counts. footer.js: stats view, cache key bn_stats2.
- near-me.js / pour-rail.js copy made number-free.

## Re-run after any data refresh
    python3 /Users/kytlegacy/Claude/Projects/NiteBoba/build/gen_finder_data.py
    python3 /Users/kytlegacy/Claude/Projects/NiteBoba/build/apply_counts.py --expect 1410,119 --apply
(replace 1410,119 with the current niteboba_site_stats socal_open_shops,lv_open_shops)

## Verified
jsdom homepage (finder mocked as 1,000 + 410 rows): every count surface reads 1,410/190, two
paged requests, 0 JS errors. 978 pages: div/script balance unchanged. check_nav_sync SYNCED.
gen_site imports again.

## Traps
- best/date-night/index.html had someone else's uncommitted edits: committed only the
  nav-count hunks applied onto HEAD; the working copy keeps their edits + the new counts.
- Never count rows returned by the REST API; ask the database to count.

## Next
- Wave 2 FIRST ITEM: /near-me/ bakes only 215 shops inline and never loads js/near-index.json
  (1,529 pins). Then open-now default (`openOnly:true`) and the one-answer hero.
- Lynwood hub page missing (1 shop). Page the `niteboba_finder?select=s,rating,reviews` read.
