import type { RegionSelection } from "./regional-contacts";

type SearchBoundaryData = {
  sido: Array<{ properties: { sidonm: string } }>;
  sgg: Array<{ properties: { sidonm: string; sggnm: string } }>;
  emd: Array<{ properties: { sidonm: string; sggnm?: string | null; emdnm: string } }>;
};

export type AdministrativeSearchResult = {
  id: string;
  label: string;
  detail: string;
  targetLevel: "city" | "district" | "dong";
  selection: RegionSelection;
};

export function cityName(value: string) {
  return value.match(/^(.+?시)/)?.[1] ?? value;
}

export function districtName(value: string, city: string) {
  const remainder = value.replace(city, "").trim();
  return remainder || city;
}

export function selectedRegionLabel(selection: RegionSelection) {
  return [selection.sido, selection.city, selection.district, selection.dong]
    .filter((value, index, values): value is string => Boolean(value) && value !== values[index - 1])
    .join(" ");
}

export function isOneTierRegion(selection: RegionSelection) {
  return Boolean(selection.city) && selection.city === selection.district;
}

export function regionMatches<T extends RegionSelection>(item: T, selection: RegionSelection) {
  return (selection.sido ? item.sido === selection.sido : true)
    && (selection.city ? item.city === selection.city : true)
    && (selection.district ? item.district === selection.district : true)
    && (selection.dong ? item.dong === selection.dong : true);
}

export function buildAdministrativeSearchIndex(data: SearchBoundaryData): AdministrativeSearchResult[] {
  const results = new Map<string, AdministrativeSearchResult>();
  const add = (result: AdministrativeSearchResult) => results.set(result.id, result);

  data.sido.forEach(({ properties }) => add({
    id: `sido:${properties.sidonm}`,
    label: properties.sidonm,
    detail: "시·도",
    targetLevel: "city",
    selection: { sido: properties.sidonm, city: "", district: "", dong: "" },
  }));

  data.sgg.forEach(({ properties }) => {
    const city = cityName(properties.sggnm);
    const district = districtName(properties.sggnm, city);
    if (city !== district) {
      add({
        id: `city:${properties.sidonm}:${city}`,
        label: `${properties.sidonm} ${city}`,
        detail: "시·군",
        targetLevel: "district",
        selection: { sido: properties.sidonm, city, district: "", dong: "" },
      });
    }
    add({
      id: `district:${properties.sidonm}:${city}:${district}`,
      label: selectedRegionLabel({ sido: properties.sidonm, city, district, dong: "" }),
      detail: city === district ? "시·군" : "구",
      targetLevel: "dong",
      selection: { sido: properties.sidonm, city, district, dong: "" },
    });
  });

  data.emd.forEach(({ properties }) => {
    const sgg = properties.sggnm ?? "";
    const city = cityName(sgg);
    const district = districtName(sgg, city);
    add({
      id: `dong:${properties.sidonm}:${city}:${district}:${properties.emdnm}`,
      label: selectedRegionLabel({ sido: properties.sidonm, city, district, dong: properties.emdnm }),
      detail: "읍·면·동",
      targetLevel: "dong",
      selection: { sido: properties.sidonm, city, district, dong: properties.emdnm },
    });
  });

  return [...results.values()].sort((left, right) => left.label.localeCompare(right.label, "ko"));
}

export function searchAdministrativeRegions(index: AdministrativeSearchResult[], query: string, limit = 8) {
  const tokens = query.normalize("NFC").trim().toLocaleLowerCase("ko-KR").split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return index
    .filter((result) => {
      const label = result.label.normalize("NFC").toLocaleLowerCase("ko-KR");
      return tokens.every((token) => label.includes(token));
    })
    .sort((left, right) => left.label.length - right.label.length || left.label.localeCompare(right.label, "ko"))
    .slice(0, limit);
}
