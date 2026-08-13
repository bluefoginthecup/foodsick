import type { ContactKind, RegionSelection, RegionalContact } from "../../../regional-contacts";

type KakaoPlace = {
  place_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  category_group_code: string;
  place_url: string;
};

type KakaoSearchResponse = {
  documents?: KakaoPlace[];
};

type ContactQuery = {
  kind: ContactKind;
  label: string;
  query: string;
  expectedName: string;
  categoryGroup?: "PO3";
};

type FetchLike = typeof fetch;

const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

export function contactQueries(selection: RegionSelection): ContactQuery[] {
  const prefix = [selection.sido, selection.city, selection.district].filter(Boolean).join(" ");
  const metropolitan = /(?:특별시|광역시|특별자치시)$/.test(selection.sido);
  const metropolitanDistrict = /(?:특별시|광역시)$/.test(selection.sido);
  const cityOfficeName = metropolitan ? `${selection.sido}청` : `${selection.city}청`;
  const queries: ContactQuery[] = [
    {
      kind: "city_office",
      label: "관할 시청",
      query: `${selection.sido} ${cityOfficeName}`,
      expectedName: cityOfficeName,
      categoryGroup: "PO3",
    },
    {
      kind: "health_center",
      label: "관할 보건소",
      query: `${prefix} 보건소`,
      expectedName: "보건소",
    },
  ];

  if (selection.district && (selection.district !== selection.city || metropolitanDistrict)) {
    queries.splice(1, 0, {
      kind: "district_office",
      label: "관할 구청",
      query: `${selection.sido} ${selection.city} ${selection.district}청`,
      expectedName: `${selection.district}청`,
      categoryGroup: "PO3",
    });
    queries.unshift({
      kind: "food_safety",
      label: "식품위생 담당",
      query: `${prefix} 식품위생과`,
      expectedName: "위생",
    });
  }

  return queries;
}

function scorePlace(place: KakaoPlace, query: ContactQuery, selection: RegionSelection) {
  const address = `${place.road_address_name} ${place.address_name}`;
  let score = 0;
  if (place.place_name.replaceAll(" ", "").includes(query.expectedName.replaceAll(" ", ""))) score += 8;
  if (selection.city && address.includes(selection.city)) score += 4;
  if (selection.district && address.includes(selection.district)) score += 3;
  if (place.category_group_code === "PO3") score += 2;
  if (place.phone) score += 1;
  return score;
}

function hasExpectedInstitutionName(place: KakaoPlace, query: ContactQuery) {
  const name = place.place_name.replaceAll(" ", "");
  if (!name.includes(query.expectedName.replaceAll(" ", ""))) return false;
  if (query.kind !== "food_safety") return true;
  return /(시청|군청|구청|보건소)/.test(name) || /위생.*(과|팀)$/.test(name);
}

function selectPlace(documents: KakaoPlace[], query: ContactQuery, selection: RegionSelection) {
  return documents
    .filter((place) => place.place_name && place.phone && hasExpectedInstitutionName(place, query))
    .map((place, index) => ({ place, index, score: scorePlace(place, query, selection) }))
    .filter(({ score }) => score >= 5)
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.place;
}

export async function fetchKakaoRegionalContacts(
  selection: RegionSelection,
  apiKey: string,
  fetcher: FetchLike = fetch,
): Promise<RegionalContact[]> {
  const results = await Promise.all(contactQueries(selection).map(async (contactQuery) => {
    const url = new URL(KAKAO_KEYWORD_URL);
    url.searchParams.set("query", contactQuery.query);
    if (contactQuery.categoryGroup) url.searchParams.set("category_group_code", contactQuery.categoryGroup);
    url.searchParams.set("size", "5");

    const response = await fetcher(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    if (!response.ok) throw new Error(`Kakao Local API returned ${response.status}`);

    const payload = await response.json() as KakaoSearchResponse;
    const place = selectPlace(payload.documents ?? [], contactQuery, selection);
    if (!place) return null;
    return {
      kind: contactQuery.kind,
      label: contactQuery.label,
      name: place.place_name,
      phone: place.phone,
      address: place.road_address_name || place.address_name,
      sourceUrl: place.place_url,
    } satisfies RegionalContact;
  }));

  const seen = new Set<string>();
  return results.filter((contact): contact is RegionalContact => {
    if (!contact) return false;
    const key = `${contact.kind}:${contact.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
