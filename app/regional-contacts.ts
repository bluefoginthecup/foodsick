export type ContactKind = "food_safety" | "health_center" | "district_office" | "city_office";

export type RegionSelection = {
  sido: string;
  city: string;
  district: string;
  dong: string;
};

export type RegionalContact = {
  kind: ContactKind;
  label: string;
  name: string;
  phone: string;
  address: string;
  sourceUrl: string;
  sourceLabel?: string;
};

export type RegionalContactsResponse = {
  region: string;
  provider: "kakao-local+official-organizations";
  fetchedAt: string;
  cache: "fresh" | "refreshed" | "stale";
  cacheAgeSeconds: number;
  contacts: RegionalContact[];
};

export type RegionalContactsError = {
  error: "invalid_region" | "provider_not_configured" | "provider_unavailable";
  message: string;
};

export function regionSelectionLabel(selection: RegionSelection) {
  return [selection.sido, selection.city, selection.district, selection.dong]
    .filter((value, index, values): value is string => Boolean(value) && value !== values[index - 1])
    .join(" ");
}

export function regionSelectionKey(selection: RegionSelection) {
  return [selection.sido, selection.city, selection.district, selection.dong].join("|");
}

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
