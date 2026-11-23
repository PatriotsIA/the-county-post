// These independent cities share their base name with a county in the same
// state. Preserve county URLs and give each city its own FIPS-backed route.
const overlappingCityFips = new Set(["24510", "29510", "51600", "51620", "51760", "51770"]);

export function countySlug(name: string, fips: string) {
  const base = name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return overlappingCityFips.has(fips) ? `${base}-city` : base;
}

// Census 2020 county names, matched to the edition directory by FIPS.
const alaskaNames: Record<string, string> = {
  "02013": "Aleutians East Borough",
  "02016": "Aleutians West Census Area",
  "02020": "Anchorage Municipality",
  "02050": "Bethel Census Area",
  "02060": "Bristol Bay Borough",
  "02063": "Chugach Census Area",
  "02066": "Copper River Census Area",
  "02068": "Denali Borough",
  "02070": "Dillingham Census Area",
  "02090": "Fairbanks North Star Borough",
  "02100": "Haines Borough",
  "02105": "Hoonah-Angoon Census Area",
  "02110": "Juneau City and Borough",
  "02122": "Kenai Peninsula Borough",
  "02130": "Ketchikan Gateway Borough",
  "02150": "Kodiak Island Borough",
  "02158": "Kusilvak Census Area",
  "02164": "Lake and Peninsula Borough",
  "02170": "Matanuska-Susitna Borough",
  "02180": "Nome Census Area",
  "02185": "North Slope Borough",
  "02188": "Northwest Arctic Borough",
  "02195": "Petersburg Borough",
  "02198": "Prince of Wales-Hyder Census Area",
  "02220": "Sitka City and Borough",
  "02230": "Skagway Municipality",
  "02240": "Southeast Fairbanks Census Area",
  "02275": "Wrangell City and Borough",
  "02282": "Yakutat City and Borough",
  "02290": "Yukon-Koyukuk Census Area",
};

export function countyDisplayName(name: string, stateSlug: string, fips: string) {
  if (alaskaNames[fips]) return alaskaNames[fips];
  if (fips === "11001" || fips === "32510") return name;
  if (stateSlug === "louisiana") return `${name} Parish`;
  if (overlappingCityFips.has(fips) || (stateSlug === "virginia" && Number(fips.slice(2)) >= 500)) return `${name} City`;
  return `${name} County`;
}

// Fetch also accepts the names printed by earlier editions and local word order.
export function countyJurisdictionNames(county: { fips: string; name: string; displayName: string }) {
  const { name, fips, displayName } = county;
  const names = [displayName];
  if (alaskaNames[fips] || fips === "11001" || fips === "32510") names.push(name + " County");
  if (displayName.endsWith(" City and Borough")) names.push("City and Borough of " + name);
  if (displayName.endsWith(" Municipality")) names.push("Municipality of " + name);
  if (displayName.endsWith(" City") && fips !== "32510") names.push("City of " + name);
  return names;
}
