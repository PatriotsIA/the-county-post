"""Extract full-year municipal police reports from the 2025 Texas DPS workbook."""
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path
from urllib.request import urlopen
from xml.etree import ElementTree as ET

SOURCE = "https://www.dps.texas.gov/sites/default/files/documents/crimereports/supplemental/2025/crimes_by_jurisdiction.xlsx"
DEST = Path(__file__).resolve().parents[2] / "src/data/fetch-city-crime.json"
HEADERS = ["ORINumber", "Agency", "Population", "Murder", "Rape", "Robbery", "Aggravated Assault",
           "Burglary", "Larceny & Theft", "Auto Theft", "Arson", "Human Trafficking", "Total", "Months", "MonthName"]

def extract(book):
    strings = ["".join(s.itertext()) for s in ET.fromstring(book.read("xl/sharedStrings.xml"))]
    paths = {r.get("Id"): r.get("Target") for r in ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))}
    directory = json.loads(DEST.with_name("fetch-city-counties.json").read_text())
    # Verify the agency's reporting county is part of this particular city.
    county_rows = json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        'import {getCountyByState} from "@nickgraffis/us-counties"; console.log(JSON.stringify(getCountyByState("Texas")));'
    ], cwd=DEST.parents[2]))
    counties = {c["FIPS"]: c["name"].upper() for c in county_rows}
    city_counties = {(name.upper(), counties[fips]) for name, groups in directory.items()
                     for group in groups for fips in group.split() if fips in counties}
    records = {}
    def value(cell):
        raw = cell.findtext("{*}v", "")
        return strings[int(raw)] if raw and cell.get("t") == "s" else raw
    for sheet in ET.fromstring(book.read("xl/workbook.xml")).findall(".//{*}sheet"):
        target = paths[sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
        rows = ET.fromstring(book.read("xl/" + target)).findall(".//{*}row")
        if not rows or not any("INDEX CRIMES BY AGENCY AND COUNTY FOR 12 MONTHS OF 2025" in value(c) for c in rows[0]):
            continue
        if [value(c) for c in rows[2]] != HEADERS:
            raise ValueError(f"Unexpected columns in {sheet.get('name')}")
        for agency, offenses, rates in zip(rows[3:], rows[4:], rows[5:]):
            header = [value(c) for c in agency]
            if len(header) < 3 or not re.fullmatch(r"TX[A-Z0-9]{7}", header[0]) or not header[1].endswith(" PD"):
                continue
            city = header[1][:-3]
            if (city, sheet.get("name").upper()) not in city_counties or not header[2].isdigit() or int(header[2]) == 0:
                continue
            counts = [value(c) for c in offenses]
            if len(counts) < 14 or counts[1] != "Number of Offenses" or counts[13] != "12":
                continue
            categories = list(map(int, counts[3:12]))
            if sum(categories) != int(counts[12]) or min(categories) < 0:
                raise ValueError(f"Inconsistent offense total for {header[0]}")
            published = [value(c) for c in rates]
            population = int(header[2])
            calculated = 100_000 * sum(categories) / population
            if published[1] != "Rate Per 100,000" or abs(calculated - float(published[12])) > 0.050000001:
                raise ValueError(f"Rate differs from the published one-decimal rate for {header[0]}")
            key = city + "|" + sheet.get("name").upper()
            if key in records:
                raise ValueError(f"Ambiguous agency for {key}")
            records[key] = dict(ori=header[0], population=population, offenses=categories)
    if not records:
        raise ValueError("No matching municipal police reports")
    return dict(year=2025, source=SOURCE, records=records)

if __name__ == "__main__":
    with urlopen(SOURCE, timeout=60) as response, zipfile.ZipFile(io.BytesIO(response.read())) as book:
        data = extract(book)
    DEST.write_text(json.dumps(data, separators=(",", ":"), sort_keys=True) + "\n")
    print(f"Saved {len(data['records'])} full-year municipal agency records.")
