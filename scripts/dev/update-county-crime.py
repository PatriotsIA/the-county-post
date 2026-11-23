"""Build the county Public Safety release. Optional --cache reuses downloaded inputs."""
import argparse
import csv
import hashlib
import io
import json
import math
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "src/data/county-crime.json"
REPORT = "https://zenodo.org/records/24011321/files/crime-data.json"
PLACE = "https://placestats.org/data/csv/us/ucr-{}_crime_rate.csv"
TRENDS = "https://www.countyhealthrankings.org/sites/default/files/media/document/chr_trends_csv_2022.csv"


CT_REPORT = "https://portal.ct.gov/dcj/-/media/dcj-beta/connecticut-data-report2025.pdf"
COUSUB = "https://www2.census.gov/geo/docs/reference/codes2020/national_cousub2020.txt"


def connecticut_districts(records, read):
    # CGS § 51-344(11),(13). Match the complete town set to the edition boundary.
    # https://www.cga.ct.gov/current/pub/chap_890.htm
    districts = {
        "09013": ("Tolland", "Andover Bolton Columbia Coventry Ellington Hebron Mansfield Somers Stafford Tolland Union Vernon Willington"),
        "09015": ("Windham", "Ashford Brooklyn Canterbury Chaplin Eastford Hampton Killingly Plainfield Pomfret Putnam Scotland Sterling Thompson Windham Woodstock"),
    }
    towns = list(csv.DictReader(io.StringIO(read(COUSUB).decode("utf-8-sig")), delimiter="|"))
    report = subprocess.check_output(["pdftotext", "-layout", "-", "-"], input=read(CT_REPORT)).decode()
    table = report.split("(All Judicial Districts)", 1)[1].split("Statewide", 1)[0]
    for fips, (name, members) in districts.items():
        census = {r["COUSUBNAME"].removesuffix(" town") for r in towns if r["STATEFP"] + r["COUNTYFP"] == fips}
        if census != set(members.split()):
            raise ValueError(f"Town boundaries do not match {name}")
        match = re.search(rf"^\s*{name} JD\s+([\d,]+)\s+[\d.]+\s+([\d,]+)\s+[\d.]+\s+([\d,]+)\s*$", table, re.M)
        if not match:
            raise ValueError(f"Missing district totals for {name}")
        violent, prop, population = [int(x.replace(",", "")) for x in match.groups()]
        records[fips] = dict(source="ct", year=2024, violentCount=violent, propertyCount=prop,
                             violent=round(violent * 100_000 / population, 2), property=round(prop * 100_000 / population, 2))


def build(read):
    # Use the same 50 states and DC and county directory as the edition router.
    states = re.findall(r'name: "([^"]+)", abbr:', (ROOT / "src/data/states.ts").read_text())
    js = 'import {getCountyByState} from "@nickgraffis/us-counties"; console.log(JSON.stringify(process.argv.slice(1).flatMap(getCountyByState)));'
    counties = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", js, *states], cwd=ROOT))
    records = {c["FIPS"]: None for c in counties}
    if len(states) != 51 or len(records) != len(counties):
        raise ValueError("Invalid edition directory")

    master = read(REPORT)
    if hashlib.sha256(master).hexdigest() != "08c5d9dee2eb55758a065449cc62272153aea7273bd1aab564d971ed27bc2d02":
        raise ValueError("Review the revised source file before changing the release")
    all_rows = json.loads(master)["records"]
    state_context = {r["jurisdiction"]: [r["violent_per_100k"], r["property_per_100k"]] for r in all_rows if r["level"] == "state" and r["year"] == 2025}
    if set(state_context) != set(re.findall(r'abbr: "([A-Z]{2})"', (ROOT / "src/data/states.ts").read_text())) or not all(
        all(isinstance(x, (int, float)) and math.isfinite(x) and x >= 0 for x in pair)
        for pair in state_context.values()
    ):
        raise ValueError("Expected all state context rows")
    for r in all_rows:
        fips = r.get("county")
        if r["level"] != "county" or fips not in records:
            continue
        if records[fips] or r["year"] != 2025 or r["flags"]["suppressed"]:
            raise ValueError(f"Unexpected source row for {fips}")
        coverage = r["coverage_offenses_pct"]
        counts = [r["violent_crimes"], r["property_crimes"]]
        rates = [r["violent_per_100k"], r["property_per_100k"]]
        if not (0 < coverage <= 100 and r["population"] > 0 and r["agencies"] > 0
                and all(type(v) is int and v >= 0 for v in counts)
                and all(math.isfinite(v) and v >= 0 for v in rates)):
            raise ValueError(f"Invalid offense figures for {fips}")
        records[fips] = dict(source="agency", year=2025, violent=rates[0], property=rates[1],
                             violentCount=counts[0], propertyCount=counts[1], coverage=coverage)

    # Prefer paired violent/property rates from a common year for other counties.
    series = {}
    for measure in ["violent", "property"]:
        lines = read(PLACE.format(measure)).decode("utf-8-sig").splitlines()
        if not any("at least 90%" in line for line in lines[:8]):
            raise ValueError("Review the reporting coverage definition")
        for r in csv.DictReader(line for line in lines if not line.startswith("#")):
            fips = r["geoid"]
            if r["level"] != "County" or fips not in records or records[fips]:
                continue
            for year, cell in r.items():
                if year.isdigit() and int(year) <= 2025 and cell:
                    value = float(cell)
                    if not math.isfinite(value) or value < 0:
                        raise ValueError(f"Invalid rate for {fips}")
                    series.setdefault(fips, {}).setdefault(int(year), {})[measure] = value
    for fips, years in series.items():
        paired = [y for y, measures in years.items() if len(measures) == 2]
        if paired:
            year = max(paired)
            records[fips] = dict(source="returnA", year=year, **years[year])

    # Older annual county observations remain explicitly dated. No interpolation.
    history = csv.DictReader(io.StringIO(read(TRENDS).decode("utf-8-sig")))
    for r in history:
        fips = r["statecode"] + r["countycode"]
        if r["measureid"] != "43" or fips not in records or not r["rawvalue"] or not r["denominator"]:
            continue
        year = int(r["yearspan"])
        old = records[fips]
        if old and (old["source"] != "chr" or old["year"] >= year):
            continue
        value = float(r["rawvalue"].replace(",", ""))
        if not math.isfinite(value) or value < 0 or float(r["denominator"].replace(",", "")) <= 0:
            continue
        records[fips] = dict(source="chr", year=year, violent=value)
    connecticut_districts(records, read)
    return {"counties": records, "states": state_context}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path)
    cache = parser.parse_args().cache
    def read(url):
        path = cache / url.rsplit("/", 1)[1] if cache else None
        if path and path.exists():
            return path.read_bytes()
        body = subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--location", "--max-time", "90", url])
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        return body
    output = build(read)
    DEST.write_text(json.dumps(output, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n")
    counties = output["counties"]
    print(f"{len(counties)} county editions", dict(Counter(row["source"] if row else "unavailable" for row in counties.values())))
