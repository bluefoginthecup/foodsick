import { kakaoFoodCategory } from "./food-category.js";
import { chooseSafeRegion, type SafeRegion } from "./public-signal.js";

type Place = { id: string; place_name: string; x: string; y: string; category_name: string; category_group_code: string };
type Region = { region_type: string; code: string; region_1depth_name: string; region_2depth_name: string; region_3depth_name: string };
type KakaoGet = <T>(path: string, params: Record<string, string>) => Promise<T[]>;

export function kakaoClient(apiKey: string, fetcher: typeof fetch = fetch): KakaoGet {
  return async <T>(path: string, params: Record<string, string>) => {
    const url = new URL(`https://dapi.kakao.com/v2/local/${path}.json`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetcher(url, { headers: { Authorization: `KakaoAK ${apiKey}` }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`Venue verification failed (${response.status})`);
    const result = await response.json() as { documents?: T[] };
    if (!Array.isArray(result.documents)) throw new Error("Invalid venue response");
    return result.documents;
  };
}

function regionOptions(region: Region): SafeRegion[] {
  const sido = region.region_1depth_name;
  const sgg = region.region_2depth_name || (sido === "세종특별자치시" ? "세종시" : "");
  const city = sgg.match(/^(.+?시)/)?.[1] ?? sgg;
  const district = sgg.replace(city, "").trim() || city;
  if (!sido || !city) return [];
  const base = { sido, city, district, dong: region.region_3depth_name, sameCategoryVenueCount: 0 };
  const result: SafeRegion[] = [];
  if (base.dong) result.push({ ...base, level: "dong", code: region.code });
  result.push({ ...base, dong: "", level: "gu", code: region.code.slice(0, 5) });
  if (district !== city) result.push({ ...base, district: "", dong: "", level: "city", code: `${sido}:${city}` });
  else if (/특별시|광역시|특별자치시/.test(sido)) result.push({ ...base, city: "", district: "", dong: "", level: "city", code: region.code.slice(0, 2) });
  return result;
}

function belongs(region: Region, option: SafeRegion) {
  const candidate = regionOptions(region).find((item) => item.level === option.level);
  return candidate?.sido === option.sido && candidate.city === option.city
    && candidate.district === option.district && candidate.dong === option.dong;
}

const keywords: Record<string, string> = {
  "회/초밥": "초밥", "고기/구이": "고기", "해산물/조개": "해산물", "국/탕/찌개": "국밥",
  "햄버거/패스트푸드": "햄버거", "동남아/아시아": "아시아음식", "인도/중동": "인도음식",
  "샐러드/건강식": "샐러드", "카페/디저트": "카페", "베이커리/떡": "베이커리",
  "편의점/마트 조리식품": "편의점", "급식/구내식당": "구내식당", "주점/안주": "주점",
};

export async function verifyVenuePrivacy(
  restaurantId: string, name: string, regionHint: string, category: string, get: KakaoGet,
): Promise<SafeRegion | null> {
  // Free-text entries and ambiguous categories stay private until independently matched.
  if (!/^kakao_\d+$/.test(restaurantId) || ["기타", "배달음식"].includes(category)) return null;
  const found = await get<Place>("search/keyword", { query: `${regionHint} ${name}`.trim(), size: "15" });
  const place = found.find((item) => `kakao_${item.id}` === restaurantId && item.x && item.y);
  if (!place) return null;
  const regionAt = async (item: Place) => (await get<Region>("geo/coord2regioncode", { x: item.x, y: item.y })).find((r) => r.region_type === "H");
  const target = await regionAt(place);
  if (!target) return null;
  const locationCache = new Map<string, Region | undefined>([[place.id, target]]);
  for (const option of regionOptions(target)) {
    const label = [option.sido, option.city, option.district, option.dong].filter((v, i, a) => v && v !== a[i - 1]).join(" ");
    const matches = await get<Place>("search/keyword", { query: `${label} ${keywords[category] ?? category}`, size: "15" });
    const verified = new Set<string>();
    for (const candidate of matches) {
      if (!candidate.id || !candidate.x || !candidate.y || kakaoFoodCategory(candidate.category_name, candidate.place_name) !== category) continue;
      if (!locationCache.has(candidate.id)) locationCache.set(candidate.id, await regionAt(candidate));
      const candidateRegion = locationCache.get(candidate.id);
      if (candidateRegion && belongs(candidateRegion, option)) verified.add(candidate.id);
      if (verified.size >= 3) return chooseSafeRegion([{ ...option, sameCategoryVenueCount: verified.size }]);
    }
  }
  return null;
}
