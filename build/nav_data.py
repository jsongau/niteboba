#!/usr/bin/env python3
"""build/nav_data.py, SINGLE SOURCE OF TRUTH for the Boba Night unified nav.

Everything the navigation renders is defined or derived here:

  * The six top-level items (SHOPS, BEST FOR, NEW, PICK FOR ME, GUIDES,
    RATINGS & MEETUPS), the persistent search field, and the pink "Tonight" CTA.
  * Region + city lists and their counts, DERIVED at build time from
    ``js/finder-data.js`` (the build snapshot of Supabase ``niteboba``, written
    by build/gen_finder_data.py). Open SoCal shops only; Las Vegas (Clark County)
    is excluded. Must match Supabase view ``niteboba_site_stats``.
    (changed 2026-11-08: was the stale 334-row SHOPS array in directory/index.html)
  * Each mega panel's columns, links and its one editorial feature cell.

Importable:
    from nav_data import NAV, REGIONS, render_header, build_search_index
Runnable:
    python3 build/nav_data.py            # prints a summary of derived data
    python3 build/nav_data.py --html     # prints the rendered header partial
    python3 build/nav_data.py --index    # prints the search index JSON

This module owns DATA + RENDER only. Writing the files (templates/nav.html,
js/search-index.json) is done by the build steps that call these helpers, so
the dict here stays the one place a link or a count is ever edited.
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict

from regions import region_of, NAV_COUNTIES, NAV_NAME

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # repo root (parent of build/)


def _repo(path: str) -> str:
    return os.path.join(ROOT, path)


# --------------------------------------------------------------------------
# Derive region + city data from directory/index.html's SHOPS array
# --------------------------------------------------------------------------
# Region display order for the SHOPS left rail (task-locked).
REGION_ORDER = ["The 626", "Orange County", "Greater LA", "San Diego", "Inland Empire"]

# Per-region metadata: the /area/ view-all slug, the /new/ slug, and a short
# honest blurb (no banned words) used on the city pane header.
REGION_META = {
    "The 626":        {"area": "sgv",           "new": "sgv",           "blurb": "The San Gabriel Valley, the densest tea corridor in the country."},
    "Orange County":  {"area": "orange-county", "new": "orange-county", "blurb": "Irvine to Westminster, down through Little Saigon."},
    "Greater LA":     {"area": "greater-la",    "new": "greater-la",    "blurb": "The city proper, the beach cities, and the east-side edges."},
    "San Diego":      {"area": "san-diego",     "new": "san-diego",     "blurb": "Convoy and beyond, all the way south."},
    "Inland Empire":  {"area": "inland-empire", "new": "inland-empire", "blurb": "Riverside, Temecula, and the valleys inland."},
}

CITIES_PER_REGION = 7  # <= 7 city links per region before the view-all


def _load_shops():
    """Open SoCal shops from js/finder-data.js (Supabase snapshot).

    Returns rows shaped like the old SHOPS array: n (name), c (city),
    cs (city slug), s (shop slug), ar (nav rail region or None for 805/Kern/
    Imperial), plus has_page (a committed profile page exists).
    """
    raw = open(_repo("js/finder-data.js"), encoding="utf-8").read()
    data = json.loads(raw[raw.index("{"):raw.rstrip().rstrip(";").rindex("}") + 1])
    county = {}
    for g in data["locations"]:
        county.setdefault(g["city"], g["county"].replace(" County", ""))
    rows = []
    for s in data["shops"]:
        if s.get("st") != "open":
            continue
        c = county.get(s["c"])
        if c is None or c == "Clark":
            continue
        ar = NAV_NAME[region_of(c, s["c"])] if c in NAV_COUNTIES else None
        rows.append({"n": s["n"], "c": s["c"], "cs": s["cs"], "s": s["sl"], "ar": ar,
                     "has_page": os.path.exists(_repo(f"boba/ca/{s['cs']}/{s['sl']}/index.html"))})
    return rows


def compute_regions():
    """Return an ordered list of region dicts derived from SHOPS.

    Each region dict: {name, count, area_url, new_url, blurb,
                       cities:[{name, slug, count, url}], view_all_url}
    """
    shops = _load_shops()
    total = len(shops)
    by_region = defaultdict(Counter)   # region -> Counter(city -> n)
    city_slug = {}                     # city display name -> city slug
    for s in shops:
        if s["ar"]:
            by_region[s["ar"]][s["c"]] += 1
        city_slug[s["c"]] = s["cs"]

    regions = []
    for name in REGION_ORDER:
        counter = by_region.get(name, Counter())
        meta = REGION_META[name]
        cities = []
        linkable = [(c, n) for c, n in counter.most_common()
                    if os.path.exists(_repo(f"boba/ca/{city_slug[c]}/index.html"))]
        for city, cnt in linkable[:CITIES_PER_REGION]:
            slug = city_slug[city]
            cities.append({
                "name": city,
                "slug": slug,
                "count": cnt,
                "url": f"/boba/ca/{slug}/",
            })
        regions.append({
            "name": name,
            "count": sum(counter.values()),
            "area_url": f"/area/{meta['area']}/",
            "new_url": f"/new/{meta['new']}/",
            "blurb": meta["blurb"],
            "cities": cities,
            "view_all_url": f"/area/{meta['area']}/",
        })
    return regions, total


REGIONS, TOTAL_SHOPS = compute_regions()
# Cities with at least one open SoCal shop: the same definition as Supabase
# niteboba_site_stats.socal_cities_with_shops, so baked HTML and live JS agree.
CITY_COUNT = len({s["c"] for s in _load_shops()})

# The one featured house, the SHOPS panel's editorial cell.
FEATURED_SHOP = {
    "name": "Taro Yuan",
    "city": "City of Industry",
    "region": "The 626",
    "url": "/boba/ca/city-of-industry/taro-yuan-city-of-industry/",
    "note": "The featured house. Taro pulled fresh, not powdered.",
}


# --------------------------------------------------------------------------
# The six top-level items + their panels
# --------------------------------------------------------------------------
# Landmark links for the SHOPS "Near a landmark" rail target (from /near/*).
LANDMARKS = [
    {"label": "UC Irvine",         "url": "/near/uc-irvine/"},
    {"label": "Cal State Fullerton", "url": "/near/cal-state-fullerton/"},
    {"label": "UCLA",              "url": "/near/ucla/"},
    {"label": "UC San Diego",      "url": "/near/uc-san-diego/"},
    {"label": "Convoy District",   "url": "/near/convoy-district/"},
    {"label": "South Coast Plaza", "url": "/near/south-coast-plaza/"},
    {"label": "The Americana",     "url": "/near/the-americana/"},
    {"label": "Disneyland",        "url": "/near/disneyland/"},
]

# BEST FOR, two intent columns + view-all.
BEST_OCCASION = [
    {"label": "Date night",  "url": "/best/date-night/"},
    {"label": "First date",  "url": "/best/first-date/"},
    {"label": "Open late",   "url": "/best/open-late/"},
    {"label": "Study",       "url": "/best/study/"},
    {"label": "Groups",      "url": "/best/group/"},
    {"label": "With food",   "url": "/best/with-food/"},
    {"label": "Drive-thru",  "url": "/best/drive-thru/"},
]
BEST_CRAVING = [
    {"label": "Brown sugar", "url": "/best/brown-sugar/"},
    {"label": "Fruit tea",   "url": "/best/fruit-tea/"},
    {"label": "Matcha",      "url": "/best/matcha/"},
    {"label": "Non-dairy",   "url": "/best/non-dairy/"},
    {"label": "Cheap",       "url": "/best/cheap/"},
]

# PICK FOR ME, five tools + the concierge.
TOOLS = [
    {"label": "The Order Oracle",   "url": "/tools/order-oracle/",  "hint": "what your order says"},
    {"label": "Drink Matcher",      "url": "/tools/drink-matcher/", "hint": "answer three questions"},
    {"label": "Build Your Sip",     "url": "/tools/build-your-sip/","hint": "assemble a cup"},
    {"label": "Date Night Planner", "url": "/tools/date-planner/",  "hint": "an itinerary for two"},
    {"label": "Roulette",           "url": "/tools/roulette/",      "hint": "spin for a shop"},
]

# GUIDES, six explainers + the Pantry.
GUIDES = [
    {"label": "Brown sugar vs tiger sugar", "url": "/guide/brown-sugar-vs-tiger-sugar/"},
    {"label": "Crystal boba vs tapioca",    "url": "/guide/crystal-boba-vs-tapioca/"},
    {"label": "Loose-leaf vs powder",       "url": "/guide/loose-leaf-vs-powder/"},
    {"label": "How to order non-dairy",     "url": "/guide/order-non-dairy-boba/"},
    {"label": "What 50% sweet means",       "url": "/guide/what-50-percent-sweet-means/"},
    {"label": "What cheese foam is",        "url": "/guide/what-is-cheese-foam/"},
]

# RATINGS & MEETUPS, critic column + meetups column.
CRITIC_LINKS = [
    {"label": "The Pearl Ratings",  "url": "/critic/"},
    {"label": "How we rank",        "url": "/how-we-rank/"},
    {"label": "How we make money",  "url": "/how-we-make-money/"},
    {"label": "Report a correction", "url": "/report/"},
    {"label": "Claim a shop",       "url": "/claim/"},
]
MEETUP_LINKS = [
    {"label": "Meetups & clubs",   "url": "/meetups/"},
    {"label": "Boba social clubs", "url": "/meetups/#clubs"},
    {"label": "Crawls & runs",     "url": "/meetups/#crawls"},
    {"label": "Fandom nights",     "url": "/meetups/#fandom"},
    {"label": "Host a club",       "url": "/meetups/#host"},
]

# The primary CTA + search field are rendered outside the panel loop.
CTA = {"label": "Tonight", "url": "/#tonight"}
SEARCH_PLACEHOLDER = "A shop, a city, an ingredient"
SAVED = {"label": "Saved", "url": "/#blackbook"}


def _panel_shops():
    return {
        "id": "shops",
        "label": "Shops",
        "trigger": f"Shops",
        "kind": "regions",   # special two-pane render
        "regions": REGIONS,
        "landmark_url": "/near/",
        "all_url": "/directory/",
        "all_count": TOTAL_SHOPS,
        "feature": {
            "kicker": "Featured",
            "title": FEATURED_SHOP["name"],
            "sub": f'{FEATURED_SHOP["city"]} · {FEATURED_SHOP["note"]}',
            "url": FEATURED_SHOP["url"],
            "plate": "plate--night",
        },
    }


NAV = [
    _panel_shops(),
    {
        "id": "best-for",
        "label": "Best for",
        "trigger": "Best for",
        "kind": "columns",
        "columns": [
            {"heading": "By occasion", "links": BEST_OCCASION},
            {"heading": "By craving",  "links": BEST_CRAVING},
        ],
        "view_all": {"label": "All best-for lists", "url": "/best/"},
        "feature": {
            "kicker": "Editor's pick",
            "title": "Where to take a first date",
            "sub": "Room, noise, and a menu you can share, ranked on fit.",
            "url": "/best/first-date/",
            "plate": "plate--jade",
        },
    },
    {
        "id": "new",
        "label": "New",
        "trigger": "New",
        "kind": "columns",
        "columns": [
            {"heading": "By region", "links": [
                {"label": r["name"], "url": r["new_url"]} for r in REGIONS
            ]},
        ],
        "view_all": {"label": "All new openings", "url": "/new/"},
        "feature": {
            "kicker": "Freshly opened",
            "title": "Openings we're tracking",
            "sub": "New rooms across the five regions, dated as we verify them.",
            "url": "/new/",
            "plate": "plate--amber",
        },
    },
    {
        "id": "pick-for-me",
        "label": "Pick for me",
        "trigger": "Pick for me",
        "kind": "columns",
        "columns": [
            {"heading": "Tools", "links": TOOLS},
            {"heading": "Or ask", "links": [
                {"label": "Ask the concierge", "url": "/#concierge", "hint": "tell us the night"},
            ]},
        ],
        "feature": {
            "kicker": "Undecided?",
            "title": "Ask the concierge",
            "sub": "Say the night you're planning; get a shop and an order back.",
            "url": "/#concierge",
            "plate": "plate--jade",
        },
    },
    {
        "id": "guides",
        "label": "Guides",
        "trigger": "Guides",
        "kind": "columns",
        "columns": [
            {"heading": "Explainers", "links": GUIDES},
            {"heading": "Reference", "links": [
                {"label": "The Pantry, ingredients", "url": "/pantry/", "hint": "57 toppings & teas"},
            ]},
        ],
        "feature": {
            "kicker": "Start here",
            "title": "The Pantry",
            "sub": "Every topping and tea, with what it is and where it comes from.",
            "url": "/pantry/",
            "plate": "plate--amber",
        },
    },
    {
        "id": "ratings-meetups",
        "label": "Ratings & meetups",
        "trigger": "Ratings & meetups",
        "kind": "columns",
        "columns": [
            {"heading": "The critic", "links": CRITIC_LINKS},
            {"heading": "Meetups",    "links": MEETUP_LINKS},
        ],
        "feature": {
            "kicker": "How it works",
            "title": "How we rank",
            "sub": "Fit over hype. The method is written down and the money is disclosed.",
            "url": "/how-we-rank/",
            "plate": "plate--night",
        },
    },
]


# --------------------------------------------------------------------------
# Search index (baked to js/search-index.json)
# --------------------------------------------------------------------------
def _slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s


def _ca_city_dirs():
    """Every city under /boba/ca/* that has an index.html (the city pages)."""
    base = _repo("boba/ca")
    out = []
    for name in sorted(os.listdir(base)):
        d = os.path.join(base, name)
        if os.path.isdir(d) and os.path.isfile(os.path.join(d, "index.html")):
            out.append(name)
    return out


def _pantry_ingredients():
    """Parse ingredient names from the pantry cards (h3 inside .pcard).

    The pantry page renders each ingredient as
        <article class="pcard" data-cat="..." data-name="..."><... <h3>Name</h3>
    There are no per-card id anchors, so ingredient results point at the
    Pantry index (its own on-page search filters by name).
    """
    html = open(_repo("pantry/index.html"), encoding="utf-8").read()
    out = []
    seen = set()
    for m in re.finditer(r'<article class="pcard"[^>]*>.*?<h3>(.*?)</h3>', html, re.S):
        raw = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        # collapse HTML entities lightly for the label
        name = raw.replace("&amp;", "&").replace("&#x27;", "'")
        key = name.lower()
        if name and key not in seen:
            seen.add(key)
            out.append(name)
    return out


def build_search_index():
    """Assemble the baked search index dict.

    Groups: shops, cities, pages (intents/tools/guides + key pages), ingredients.
    The nav overlay caps each group at 5 hits client-side; the full lists are
    baked so results are exact, not guessed.
    """
    shops = _load_shops()

    # Only shops whose profile page exists, so search never links a 404.
    shop_rows = [
        {"n": s["n"], "c": s["c"], "u": f"/boba/ca/{s['cs']}/{s['s']}/"}
        for s in shops if s["has_page"]
    ]

    # Cities: every city with an open shop AND a /boba/ca/* page.
    city_name = {}
    for s in shops:
        city_name[s["cs"]] = s["c"]
    dirs = set(_ca_city_dirs())
    city_rows = []
    for slug in sorted(dirs):
        if slug not in city_name:
            continue
        city_rows.append({"n": city_name[slug], "u": f"/boba/ca/{slug}/"})

    # Pages: intents (best/*), tools, guides, and the standing utility pages.
    page_rows = []
    for it in BEST_OCCASION + BEST_CRAVING:
        page_rows.append({"n": f"Best for {it['label'].lower()}", "u": it["url"], "g": "Best for"})
    for t in TOOLS:
        page_rows.append({"n": t["label"], "u": t["url"], "g": "Tools"})
    for g in GUIDES:
        page_rows.append({"n": g["label"], "u": g["url"], "g": "Guides"})
    for r in REGIONS:
        page_rows.append({"n": f"New in {r['name']}", "u": r["new_url"], "g": "New"})
        page_rows.append({"n": r["name"], "u": r["area_url"], "g": "Areas"})
    for p in ([{"n": "The Pantry", "u": "/pantry/"},
               {"n": "The directory", "u": "/directory/"},
               {"n": "The Pearl Ratings", "u": "/critic/"},
               {"n": "How we rank", "u": "/how-we-rank/"},
               {"n": "Meetups & clubs", "u": "/meetups/"},
               {"n": "New openings", "u": "/new/"}]):
        p["g"] = "Pages"
        page_rows.append(p)

    ingredient_rows = [
        {"n": name, "u": "/pantry/"} for name in _pantry_ingredients()
    ]

    return {
        "generated": "build/nav_data.py",
        "shops": shop_rows,
        "cities": city_rows,
        "pages": page_rows,
        "ingredients": ingredient_rows,
    }


# --------------------------------------------------------------------------
# Render the canonical header partial (templates/nav.html)
# --------------------------------------------------------------------------
def _esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _wordmark():
    return ('<a class="bn-word" href="/" aria-label="Boba Night, home">'
            'Boba <b>Night</b></a>')


def _feature_cell(f):
    return (
        f'<a class="bn-feat" href="{f["url"]}">'
        f'<span class="bn-feat-plate plate {f["plate"]}"><span class="grain"></span></span>'
        f'<span class="bn-feat-kick">{_esc(f["kicker"])}</span>'
        f'<span class="bn-feat-t">{_esc(f["title"])}</span>'
        f'<span class="bn-feat-s">{_esc(f["sub"])}</span>'
        f'</a>'
    )


def _links(links):
    out = []
    for l in links:
        hint = f'<span class="bn-hint">{_esc(l["hint"])}</span>' if l.get("hint") else ""
        out.append(f'<a href="{l["url"]}">{_esc(l["label"])}{hint}</a>')
    return "".join(out)


def _panel_regions_html(item):
    # left rail: regions (buttons that swap the right pane) + landmark + all
    rail = []
    for i, r in enumerate(item["regions"]):
        state = ' aria-selected="true"' if i == 0 else ' aria-selected="false"'
        tab = f'tabindex="{0 if i == 0 else -1}"'
        rail.append(
            f'<button class="bn-rail-b" role="tab"{state} {tab} '
            f'data-region="{_slug(r["name"])}" aria-controls="bnpane-{_slug(r["name"])}">'
            f'{_esc(r["name"])}<span class="bn-ct">{r["count"]}</span></button>'
        )
    rail.append(
        f'<a class="bn-rail-b bn-rail-link" href="{item["landmark_url"]}">Near a landmark</a>'
    )
    rail.append(
        f'<a class="bn-rail-b bn-rail-all" href="{item["all_url"]}">'
        f'All {item["all_count"]}</a>'
    )

    # right: one pane per region with its city links
    panes = []
    for i, r in enumerate(item["regions"]):
        hidden = "" if i == 0 else " hidden"
        cities = []
        for c in r["cities"]:
            cities.append(
                f'<a href="{c["url"]}">{_esc(c["name"])}<span class="bn-ct">{c["count"]}</span></a>'
            )
        cities.append(
            f'<a class="bn-viewall" href="{r["view_all_url"]}">'
            f'All of {_esc(r["name"])}</a>'
        )
        panes.append(
            f'<div class="bn-pane" id="bnpane-{_slug(r["name"])}" role="tabpanel" '
            f'data-region="{_slug(r["name"])}"{hidden}>'
            f'<p class="bn-pane-blurb">{_esc(r["blurb"])}</p>'
            f'<div class="bn-pane-cities">{"".join(cities)}</div>'
            f'</div>'
        )

    return (
        f'<div class="bn-mega bn-mega--shops">'
        f'<div class="bn-rail" role="tablist" aria-label="Regions">{"".join(rail)}</div>'
        f'<div class="bn-panes">{"".join(panes)}</div>'
        f'{_feature_cell(item["feature"])}'
        f'</div>'
    )


def _panel_columns_html(item):
    cols = []
    for c in item["columns"]:
        cols.append(
            f'<div class="bn-col"><h4>{_esc(c["heading"])}</h4>'
            f'<div class="bn-col-links">{_links(c["links"])}</div></div>'
        )
    va = ""
    if item.get("view_all"):
        va = (f'<a class="bn-viewall" href="{item["view_all"]["url"]}">'
              f'{_esc(item["view_all"]["label"])}'
              f'</a>')
    return (
        f'<div class="bn-mega">'
        f'<div class="bn-cols">{"".join(cols)}{va}</div>'
        f'{_feature_cell(item["feature"])}'
        f'</div>'
    )


def _desktop_nav():
    items = []
    for it in NAV:
        panel_id = f'bnpanel-{it["id"]}'
        if it["kind"] == "regions":
            panel = _panel_regions_html(it)
        else:
            panel = _panel_columns_html(it)
        items.append(
            f'<div class="bn-item" data-item="{it["id"]}">'
            f'<button class="bn-trigger" aria-expanded="false" aria-controls="{panel_id}">'
            f'{_esc(it["trigger"])}<span class="bn-caret" aria-hidden="true"></span></button>'
            f'<div class="bn-panel" id="{panel_id}" role="region" '
            f'aria-label="{_esc(it["label"])}" hidden>{panel}</div>'
            f'</div>'
        )
    return "".join(items)


def _drawer_accordions():
    """Mobile: five region accordions (grid-template-rows 0fr->1fr)."""
    out = []
    for r in REGIONS:
        cities = []
        for c in r["cities"]:
            cities.append(f'<a href="{c["url"]}">{_esc(c["name"])}<span class="bn-ct">{c["count"]}</span></a>')
        cities.append(f'<a class="bn-viewall" href="{r["view_all_url"]}">All of {_esc(r["name"])}</a>')
        out.append(
            f'<div class="bn-acc" data-acc>'
            f'<button class="bn-acc-b" aria-expanded="false">'
            f'{_esc(r["name"])}<span class="bn-ct">{r["count"]}</span>'
            f'<span class="bn-acc-ic" aria-hidden="true"></span></button>'
            f'<div class="bn-acc-panel"><div class="bn-acc-inner">{"".join(cities)}</div></div>'
            f'</div>'
        )
    return "".join(out)


# SVG icons for the fixed bottom bar (inline, currentColor, no deps).
_ICONS = {
    "tonight": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    "shops":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 9l1.2-4.2A2 2 0 0 1 6.1 3.4h11.8a2 2 0 0 1 1.9 1.4L21 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16"/></svg>',
    "search":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    "saved":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-8.4A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5.6C19 15.6 12 20 12 20z"/></svg>',
}


def _bottom_bar():
    slots = [
        ("tonight", "Tonight", CTA["url"], "bn-bb--cta"),
        ("shops",   "Shops",   "/directory/", ""),
        ("search",  "Search",  "#bn-search", "bn-bb--search"),
        ("saved",   "Saved",   SAVED["url"], ""),
    ]
    out = []
    for icon, label, href, cls in slots:
        if icon == "search":
            out.append(
                f'<button class="bn-bb {cls}" data-bn-open-search type="button">'
                f'{_ICONS[icon]}<span>{label}</span></button>'
            )
        else:
            out.append(f'<a class="bn-bb {cls}" href="{href}">{_ICONS[icon]}<span>{label}</span></a>')
    return f'<nav class="bn-bottombar" aria-label="Quick actions">{"".join(out)}</nav>'


def render_header():
    """Return the full canonical header partial as an HTML string."""
    search_field = (
        f'<form class="bn-search" role="search" data-bn-search-open>'
        f'<label class="bn-sr" for="bn-searchq">Search</label>'
        f'<span class="bn-search-ic" aria-hidden="true">{_ICONS["search"]}</span>'
        f'<input id="bn-searchq" type="search" placeholder="{_esc(SEARCH_PLACEHOLDER)}" '
        f'autocomplete="off" readonly aria-haspopup="dialog">'
        f'<kbd class="bn-kbd" aria-hidden="true">/</kbd>'
        f'</form>'
    )

    saved_btn = (
        f'<a class="bn-saved" href="{SAVED["url"]}" aria-label="Saved shops">'
        f'{_ICONS["saved"]}</a>'
    )
    cta = f'<a class="bn-cta" href="{CTA["url"]}">{_esc(CTA["label"])}</a>'
    burger = ('<button class="bn-burger" aria-label="Open menu" aria-expanded="false" '
              'aria-controls="bn-drawer"><span></span><span></span><span></span></button>')

    return f"""<!-- Boba Night, canonical navigation partial. Generated from build/nav_data.py.
     Edit the data there, re-render, never hand-patch this file. -->
<a class="bn-skip" href="#main">Skip to content</a>
<header class="bn-header" data-bn-header>
  <div class="bn-bar">
    {_wordmark()}
    <nav class="bn-nav" aria-label="Primary">
      {_desktop_nav()}
    </nav>
    <div class="bn-actions">
      {search_field}
      {saved_btn}
      {cta}
      {burger}
    </div>
  </div>
  <div class="bn-scrim" data-bn-scrim hidden></div>
</header>

<!-- Command-K / slash search overlay -->
<div class="bn-overlay" id="bn-search" role="dialog" aria-modal="true" aria-label="Search Boba Night" hidden>
  <div class="bn-overlay-scrim" data-bn-search-close></div>
  <div class="bn-overlay-box" role="document">
    <form class="bn-overlay-field" role="search">
      <span class="bn-search-ic" aria-hidden="true">{_ICONS["search"]}</span>
      <label class="bn-sr" for="bn-overlayq">Search a shop, a city, an ingredient</label>
      <input id="bn-overlayq" type="search" placeholder="{_esc(SEARCH_PLACEHOLDER)}" autocomplete="off"
             aria-controls="bn-results" aria-expanded="false">
      <button class="bn-overlay-esc" type="button" data-bn-search-close aria-label="Close search">Esc</button>
    </form>
    <div class="bn-results" id="bn-results" role="listbox" aria-label="Results">
      <p class="bn-results-empty" data-bn-empty>Type to search {TOTAL_SHOPS:,} shops, {CITY_COUNT} cities, pages and ingredients.</p>
    </div>
  </div>
</div>

<!-- Mobile drawer -->
<div class="bn-drawer" id="bn-drawer" role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <div class="bn-drawer-top">
    <span class="bn-word">Boba <b>Night</b></span>
    <button class="bn-drawer-x" aria-label="Close menu" data-bn-drawer-close>&times;</button>
  </div>
  <button class="bn-drawer-search" data-bn-open-search type="button">
    <span class="bn-search-ic" aria-hidden="true">{_ICONS["search"]}</span>
    <span>{_esc(SEARCH_PLACEHOLDER)}</span>
  </button>
  <nav class="bn-drawer-nav" aria-label="Regions">
    {_drawer_accordions()}
  </nav>
  <div class="bn-drawer-links">
    <a href="/best/">Best for</a><a href="/new/">New openings</a>
    <a href="/pantry/">The Pantry</a><a href="/critic/">The Pearl Ratings</a>
    <a href="/meetups/">Meetups &amp; clubs</a><a href="/directory/">All 334 shops</a>
  </div>
</div>

{_bottom_bar()}
"""


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def _summary():
    lines = [f"SHOPS total: {TOTAL_SHOPS}", "Regions (rail order):"]
    for r in REGIONS:
        lines.append(f"  {r['name']} · {r['count']}  ({len(r['cities'])} cities shown) -> {r['view_all_url']}")
        for c in r["cities"]:
            lines.append(f"      {c['name']} · {c['count']}  {c['url']}")
    idx = build_search_index()
    lines.append("")
    lines.append(f"Search index: {len(idx['shops'])} shops, {len(idx['cities'])} cities, "
                 f"{len(idx['pages'])} pages, {len(idx['ingredients'])} ingredients")
    lines.append(f"Nav top-level items: {[i['label'] for i in NAV]}")
    return "\n".join(lines)


if __name__ == "__main__":
    import sys
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--html":
        print(render_header())
    elif arg == "--index":
        print(json.dumps(build_search_index(), ensure_ascii=False, indent=2))
    else:
        print(_summary())
