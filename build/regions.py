"""build/regions.py: the one region rule for Boba Night (Wave 1, 2026-11-08).

Moved verbatim out of gen_site.py so gen_site (city/area pages) and nav_data
(mega-nav counts, search index) group cities the same way. Edit here only.
"""

# ---- region mapping (editorial; adjustable) ----
SGV_CITIES = {"Arcadia","Covina","Pasadena","Walnut","Rowland Heights","Monterey Park","City of Industry",
              "El Monte","Diamond Bar","Rosemead","San Gabriel","Baldwin Park","Temple City","Monrovia"}

def region_of(county, city):
    if county == "Orange": return "orange-county"
    if county == "San Diego": return "san-diego"
    if county in ("Riverside","San Bernardino"): return "inland-empire"
    if county == "Los Angeles":
        return "sgv" if city in SGV_CITIES else "greater-la"
    return "greater-la"

# The nav's five rail regions only cover these counties. Ventura / 805, Kern and
# Imperial shops count toward the SoCal total but not toward a rail region
# (region_of would otherwise fold Santa Barbara into "Greater LA").
NAV_COUNTIES = {"Los Angeles", "Orange", "San Diego", "Riverside", "San Bernardino"}

# region_of() key -> nav rail display name (nav_data.REGION_ORDER)
NAV_NAME = {"sgv": "The 626", "orange-county": "Orange County", "greater-la": "Greater LA",
            "san-diego": "San Diego", "inland-empire": "Inland Empire"}
