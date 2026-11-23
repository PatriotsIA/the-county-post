"""Refresh the small Census extract used by the optional Fetch guide."""
import csv
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

PEP = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv"
ACS = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/"
TABLES = {
    "income": "B19013", "rent": "B25064", "homeValue": "B25077",
    "age": "B01002", "households": "B11001", "perCapita": "B19301",
}
destination = Path(__file__).resolve().parents[2] / "src/data/fetch-state-census.json"

with urlopen(PEP, timeout=60) as response:
    records = {
        row["STATE"]: {
            "name": row["STNAME"],
            "population": {str(y): int(row[f"POPESTIMATE{y}"]) for y in range(2020, 2026)},
        }
        for row in csv.DictReader(io.TextIOWrapper(response, encoding="latin-1"))
        if row["SUMLEV"] == "040"
    }
if len(records) != 51:
    raise ValueError("Expected state totals for all 50 states and DC")


def state_table(entry):
    key, table = entry
    url = ACS + "acsdt5y2024-" + table.lower() + ".dat"
    values = {}
    with urlopen(url, timeout=60) as response:
        for row in csv.DictReader(io.TextIOWrapper(response), delimiter="|"):
            match = re.fullmatch(r"0400000US(\d{2})", row["GEO_ID"])
            if match and match[1] in records:
                pair = [float(row[table + suffix]) for suffix in ("_E001", "_M001")]
                if min(pair) < 0:
                    raise ValueError(f"Missing {table} estimate or margin for {match[1]}")
                values[match[1]] = [int(n) if n.is_integer() else n for n in pair]
                if len(values) == len(records):
                    break
    if values.keys() != records.keys():
        raise ValueError(f"Incomplete state coverage for {table}")
    return key, values


with ThreadPoolExecutor(max_workers=3) as pool:
    for key, values in pool.map(state_table, TABLES.items()):
        for fips, pair in values.items():
            records[fips][key] = pair

data = {r.pop("name"): r for r in records.values()}
destination.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
print(f"Wrote {len(data)} state geographies, {len(TABLES)} ACS measures and six annual population estimates from Vintage 2025.")
