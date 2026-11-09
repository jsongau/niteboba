# SESSION 2026-11-08 — Wave 4: "SoCal tonight" night map + PM Countdown patterns

## What shipped
- NEW js/homepage/pins.js (BNPins): one shared download of niteboba_map_pins (paged) and the one
  open-now rule for every homepage widget. Pattern borrowed from PM Countdown's `TD` data module.
- NEW js/homepage/tonight-map.js: SVG dot map of every SoCal shop (champagne open, neon last call
  ≤60 min, dim closed) + panel: open count, per-county open/total rows linking to
  /near-me/?at=<city>, last call, open past midnight (evenings). Re-ticks every minute, no refetch.
  Counts match the site-wide 1,410. Mounted inside the existing #opennear section (no new section).
- js/homepage/near-me.js (finder) reads BNPins when present.

## Verified
Local serve, Chrome, 21:15 PT, real data: 532 open (LA 297/698, OC 116/257, SD 50/146, Riverside
31/119, San Bernardino 28/124, 805 9/61), 344 last call, 28 past midnight; one download shared by
finder + map; 0 page errors. Contrast: panel moved from jade (grey 3.35:1, neon 3.29:1 failed) onto
an obsidian card; all text ≥ 5.48:1. Preview deployment dpl_2A2uXzydDEJu4zFdawzgmW6WmLum checked first.

## PM Countdown patterns (Ross) — next
data-expires for dated content; OG images for ?at= links; honest Sponsored slot; post-value email
opt-in; "most-searched tonight" from niteboba_events. Rejected: dock/extra floaters.

## Open
- Retire the older #locate finder (Jay to decide). Merge 7 duplicated places (+301s).
- W3a hours refresh (~$8–28/month) awaiting Jay's OK — every widget now promises "open right now".
