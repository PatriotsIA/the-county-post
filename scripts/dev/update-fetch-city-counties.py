"""Build the Fetch place index from Census geography (no runtime geocoder).

The 2020 place list supplies census-designated places and the legacy counties
used in Connecticut editions. Replace incorporated-place parts elsewhere with
the 2025 estimates geography, including parts with zero resident population.
Include New England towns published as county subdivisions and sourced local
communities in editions outside the Census place inventory.
"""
import csv
import io
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

CODES = "https://www2.census.gov/geo/docs/reference/codes2020/"
ESTIMATES = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv"
OUTPUT = Path(__file__).resolve().parents[2] / "src/data/fetch-city-counties.json"


# Reader names for Census records whose formal labels differ. Key by place
# GEOID so that e.g. Boise City, Oklahoma keeps its own geography.
COMMON_NAMES = {
    "1303440": "Athens", "1304204": "Augusta", "1571550": "Honolulu",
    "1608830": "Boise", "2146027": "Lexington", "2148006": "Louisville",
    "4752006": "Nashville",
}


# The Census publishes New England towns as county subdivisions.
CURRENT_NEW_ENGLAND_STATES = {"23", "25", "33", "44", "50"}

# Communities confirmed by the governments serving these counties.
LOCAL_COMMUNITIES = {
    # https://health.hawaii.gov/kalaupapaupdates/
    "Kalaupapa": "15005",
    # https://www.jamescitycountyva.gov/905/History
    "Norge": "51095", "Toano": "51095",
}


def rows(url, delimiter, encoding):
    with urlopen(url, timeout=60) as response:
        yield from csv.DictReader(io.TextIOWrapper(response, encoding=encoding), delimiter=delimiter)


def place_name(raw):
    raw = raw.removesuffix(" (pt.)").removesuffix(" (balance)")
    return re.sub(r" (?:city|town|village|CDP|borough|township|municipality)$", "", raw)


def build():
    county_codes = {
        (r["STATEFP"], r["COUNTYNAME"]): r["STATEFP"] + r["COUNTYFP"]
        for r in rows(CODES + "national_county2020.txt", "|", "utf-8-sig")
    }
    places = {}
    for r in rows(CODES + "national_place2020.txt", "|", "utf-8-sig"):
        state = r["STATEFP"]
        if int(state) > 56:
            continue
        if state == "09" or r["TYPE"] == "CENSUS DESIGNATED PLACE":
            parts = {county_codes[state, c] for c in r["COUNTIES"].split("~~~")}
            places[state + r["PLACEFP"]] = (place_name(r["PLACENAME"]), parts)
    by_name = defaultdict(set)
    # Connecticut editions follow the historic counties in the 2020 file.
    for r in rows(CODES + "national_cousub2020.txt", "|", "utf-8-sig"):
        if r["STATEFP"] == "09" and r["COUSUBNAME"].endswith(" town"):
            by_name[place_name(r["COUSUBNAME"])].add("09" + r["COUNTYFP"])
    current_parts = {}
    for r in rows(ESTIMATES, ",", "cp1252"):
        state = r["STATE"]
        if state in CURRENT_NEW_ENGLAND_STATES and r["SUMLEV"] == "061" and r["NAME"].endswith(" town"):
            by_name[place_name(r["NAME"])].add(state + r["COUNTY"])
        if r["SUMLEV"] != "157" or state == "09" or r["NAME"].startswith("Balance of "):
            continue
        key = state + r["PLACE"]
        current_parts.setdefault(key, (place_name(r["NAME"]), set()))[1].add(state + r["COUNTY"])
    places.update(current_parts)

    for name, county in LOCAL_COMMUNITIES.items():
        by_name[name].add(county)
    for geoid, (name, parts) in places.items():
        group = " ".join(sorted(parts))
        by_name[name].add(group)
        if geoid in COMMON_NAMES:
            by_name[COMMON_NAMES[geoid]].add(group)
    index = {name: sorted(groups) for name, groups in sorted(by_name.items())}
    expected = {fips for (state, _), fips in county_codes.items() if int(state) <= 56}
    mapped = {fips for groups in index.values() for group in groups for fips in group.split()}
    if expected != mapped:
        raise ValueError(f"County coverage differs: missing {sorted(expected - mapped)}, unknown {sorted(mapped - expected)}")
    if (index.get("Amarillo") != ["48375 48381"] or "16001" not in index.get("Boise", [])
            or "53033" not in index.get("Seattle", []) or len(index) < 20000):
        raise ValueError("Incomplete city/county geography")
    # One name per line makes geographic updates reviewable.
    entries = [json.dumps(name, ensure_ascii=False) + ": " + json.dumps(groups)
               for name, groups in index.items()]
    OUTPUT.write_text("{\n" + ",\n".join(entries) + "\n}\n", encoding="utf-8")


if __name__ == "__main__":
    build()
