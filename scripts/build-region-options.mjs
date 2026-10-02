import { get } from "admdongkor";
import { writeFile } from "node:fs/promises";

// Compact snapshot of the same administrative dataset used by the map.
const version = "20260701";
const data = await get(version, "emd");
const regions = {};
for (const { properties: p } of data.features) {
  const province = p.sidonm;
  const city = (p.sggnm || province).replace(/^(.+?시)(.+구)$/, "$1 $2");
  if (!province || !p.emdnm) continue;
  ((regions[province] ??= {})[city] ??= []).push(p.emdnm);
}
for (const cities of Object.values(regions)) {
  for (const [city, dongs] of Object.entries(cities)) cities[city] = [...new Set(dongs)].sort((a, b) => a.localeCompare(b, "ko"));
}
await writeFile(new URL("../public/administrative-regions.json", import.meta.url), JSON.stringify({ version, regions }));
console.log(`Saved ${Object.keys(regions).length} provinces and ${Object.values(regions).reduce((n, cities) => n + Object.keys(cities).length, 0)} districts.`);
