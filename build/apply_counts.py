#!/usr/bin/env python3
"""build/apply_counts.py: stamp the one true shop/city count into every page (Wave 1, 2026-11-08).

Source: nav_data (which reads js/finder-data.js, the Supabase snapshot). Before writing,
it checks the totals against the numbers Supabase's niteboba_site_stats view reported,
passed in with --expect so a stale snapshot can never be stamped silently.

What it touches, and nothing else:
  * the mega-nav region rail (counts + "All N"), each region pane's city links,
    and the mobile drawer accordions (counts + city links). Blurbs and "All of X"
    links are kept byte-for-byte. A Las Vegas tab, where present, gets the LV count.
  * the search-overlay hint and the drawer's "All N shops" link.
  * js/search-index.json (rebuilt from nav_data.build_search_index()).

Idempotent: re-running with the same data changes nothing.
    python3 build/apply_counts.py --expect 1410,119            # dry run, report only
    python3 build/apply_counts.py --expect 1410,119 --apply    # write files
"""
import argparse, io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import nav_data as nd

SKIP_DIRS = {".git", "_sbscaffold", "_to_delete", "boba - 11JUL26", "docs", "design-library", "examples", "templates", "node_modules"}

def block(s, start):
    depth = 0
    for m in re.finditer(r"<div\b|</div>", s[start:]):
        depth += 1 if m.group(0) == "<div" else -1
        if depth == 0:
            return start + m.end()
    raise ValueError("unbalanced div")

def city_links(r):
    return "".join(f'<a href="{c["url"]}">{nd._esc(c["name"])}<span class="bn-ct">{c["count"]}</span></a>' for c in r["cities"])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--expect", required=True, help="socal_open,lv_open from niteboba_site_stats")
    ap.add_argument("--apply", action="store_true"); a = ap.parse_args()
    exp_socal, exp_lv = (int(x) for x in a.expect.split(","))
    if nd.TOTAL_SHOPS != exp_socal:
        sys.exit(f"ABORT: snapshot says {nd.TOTAL_SHOPS} SoCal shops, Supabase says {exp_socal}. Regenerate js/finder-data.js first.")
    lv = exp_lv
    by_name = {r["name"]: r for r in nd.REGIONS}
    by_slug = {nd._slug(r["name"]): r for r in nd.REGIONS}
    total = f"{nd.TOTAL_SHOPS:,}"
    hint_new = f"Type to search {total} shops, {nd.CITY_COUNT} cities, pages and ingredients."

    def fix_rail(frag):
        def btn(m):
            name = m.group(2)
            n = by_name[name]["count"] if name in by_name else (lv if name == "Las Vegas" else None)
            return m.group(0) if n is None else f'{m.group(1)}{name}<span class="bn-ct">{n}</span>'
        frag = re.sub(r'(<button class="bn-rail-b"[^>]*>)([^<]+)<span class="bn-ct">\d[\d,]*</span>', btn, frag)
        return re.sub(r'(class="bn-rail-b bn-rail-all"[^>]*>)All [\d,]+(</a>)', lambda m: f"{m.group(1)}All {total}{m.group(2)}", frag)

    def fix_cities_div(inner, r):
        va = re.search(r'<a class="bn-viewall".*?</a>\s?', inner, re.S)
        return city_links(r) + (va.group(0) if va else "")

    def fix_panes(frag):
        def pane(m):
            r = by_slug.get(m.group(2))
            if not r: return m.group(0)
            return m.group(1) + fix_cities_div(m.group(3), r) + m.group(4)
        return re.sub(r'(<div class="bn-pane" id="bnpane-([a-z0-9-]+)".*?<div class="bn-pane-cities">)(.*?)(</div></div>)', pane, frag, flags=re.S)

    def fix_acc_one(b):
        m = re.match(r'(<div class="bn-acc" data-acc><button class="bn-acc-b" aria-expanded="false">)([^<]+)<span class="bn-ct">[\d,]+</span>(.*?<div class="bn-acc-inner">)(.*?)(</div></div></div>)$', b, re.S)
        if not m: return b
        name = m.group(2); r = by_name.get(name)
        if not r: return b
        return f'{m.group(1)}{name}<span class="bn-ct">{r["count"]}</span>{m.group(3)}{fix_cities_div(m.group(4), r)}{m.group(5)}'

    C = nd.CITY_COUNT
    AREA = {"sgv": "The 626", "orange-county": "Orange County", "greater-la": "Greater LA",
            "san-diego": "San Diego", "inland-empire": "Inland Empire"}
    def stamp_prose(s):
        """Homepage hero/meta/directory tiles and the footer's first-paint numbers."""
        s = re.sub(r"\b[\d,]+ tea shops across \d+ cities", f"{total} tea shops across {C} cities", s)
        s = re.sub(r"\b[\d,]+ shops, \d+ cities, six regions", f"{total} shops, {C} cities, six regions", s)
        s = re.sub(r"(Boba Night — )[\d,]+( SoCal boba shops)", lambda m: f"{m.group(1)}{total}{m.group(2)}", s)
        s = re.sub(r'(<p class="sub">)[\d,]+ shops across \d+ cities\.', lambda m: f"{m.group(1)}{total} shops across {C} cities.", s)
        s = re.sub(r'(id="dirLede">)[\d,]+ boba shops across \d+ Southern California cities', lambda m: f"{m.group(1)}{total} boba shops across {C} Southern California cities", s)
        s = re.sub(r'(<a class="dirx-area" href="/area/([a-z-]+)/"><span class="da-n">)[\d,]+(</span>)',
                   lambda m: f"{m.group(1)}{by_name[AREA[m.group(2)]]['count']}{m.group(3)}" if m.group(2) in AREA else m.group(0), s)
        s = re.sub(r'(<a class="dirx-area" href="/directory/"><span class="da-n">)[\d,]+(</span>)', lambda m: f"{m.group(1)}{total}{m.group(2)}", s)
        s = re.sub(r'(<b id=\\?"ft2Shops\\?">)[\d,]+(</b>)', lambda m: f"{m.group(1)}{total}{m.group(2)}", s)
        s = re.sub(r'(<b id=\\?"ft2Cities\\?">)\d+(</b>)', lambda m: f"{m.group(1)}{C}{m.group(2)}", s)
        return s

    changed = scanned = 0; leftovers = {}
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in fns:
            if not fn.endswith(".html"): continue
            p = os.path.join(dp, fn); s = io.open(p, encoding="utf-8").read(); scanned += 1; o = s
            i = s.find('<div class="bn-rail" role="tablist" aria-label="Regions">')
            if i >= 0: e = block(s, i); s = s[:i] + fix_rail(s[i:e]) + s[e:]
            i = s.find('<div class="bn-panes">')
            if i >= 0: e = block(s, i); s = s[:i] + fix_panes(s[i:e]) + s[e:]
            i = s.find('<div class="bn-acc" data-acc>')
            if i >= 0:
                out, j = "", i
                while s.startswith('<div class="bn-acc" data-acc>', j):
                    e = block(s, j); out += fix_acc_one(s[j:e]); j = e
                s = s[:i] + out + s[j:]
            s = re.sub(r"Type to search [\d,]+ shops, \d+ cities, pages and ingredients\.", hint_new, s)
            s = stamp_prose(s)
            s = re.sub(r'(<a href="/directory/">)All [\d,]+ shops(</a>)', lambda m: f"{m.group(1)}All {total} shops{m.group(2)}", s)
            for pat in ("334 shops", "46 cities", "334 boba shops"):
                if pat in s: leftovers.setdefault(pat, []).append(os.path.relpath(p, ROOT))
            if s != o:
                changed += 1
                if a.apply: io.open(p, "w", encoding="utf-8").write(s)
    fp = os.path.join(ROOT, "components/footer.js"); fs_ = io.open(fp, encoding="utf-8").read(); fo = fs_
    fs_ = stamp_prose(fs_)
    if fs_ != fo:
        changed += 1
        if a.apply: io.open(fp, "w", encoding="utf-8").write(fs_)
    idx = nd.build_search_index(); idx["generated"] = "build/nav_data.py via build/apply_counts.py"
    idx_s = json.dumps(idx, ensure_ascii=False, separators=(",", ":"))
    if a.apply: io.open(os.path.join(ROOT, "js/search-index.json"), "w", encoding="utf-8").write(idx_s)
    print(f"{'APPLIED' if a.apply else 'DRY RUN'}: scanned {scanned} pages, {changed} {'changed' if a.apply else 'would change'}")
    print(f"totals: {total} SoCal shops, {nd.CITY_COUNT} cities with pages, LV {lv}; regions: " + ", ".join(f"{r['name']} {r['count']}" for r in nd.REGIONS))
    print(f"search index: {len(idx['shops'])} shops, {len(idx['cities'])} cities, {len(idx_s)//1024} KB")
    for k, v in leftovers.items(): print(f"leftover '{k}' in {len(v)} files, e.g. {v[:5]}")

if __name__ == "__main__":
    main()
