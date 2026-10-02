import type { SafeRegion } from "./public-signal.js";
// Deliberately fictional venues. Evidence replaces only the external place lookup.
const places = [
  ["경기도", "용인시", "기흥구", "영덕1동", 37.276, 127.075],
  ["경기도", "용인시", "기흥구", "영덕2동", 37.267, 127.076],
  ["서울특별시", "강남구", "강남구", "역삼1동", 37.500, 127.035],
  ["부산광역시", "해운대구", "해운대구", "우1동", 35.163, 129.159],
  ["대전광역시", "서구", "서구", "둔산1동", 36.351, 127.386],
  ["대구광역시", "중구", "중구", "성내1동", 35.869, 128.593],
] as const;
export function testVenue(batchId: string, group: number) {
  const [sido, city, district, dong, lat, lng] = places[group % places.length]!;
  const mode = group % 5;
  const counts = mode === 0 ? [6,10,20] : mode === 1 ? [1,6,20] : mode === 2 ? [1,2,10] : [1,1,2];
  const regions: SafeRegion[] = (["dong", "gu", "city"] as const).map((level,i) => ({
    sido, city: level === "city" && city === district ? "" : city, district: level === "city" ? "" : district, dong: level === "dong" ? dong : "",
    level, code: `fixture:${batchId}:${group}:${level}`, sameCategoryVenueCount: counts[i]!,
  }));
  return { id: `manual_test_${batchId}_v2_${group}`, name: `가상 시험 음식점 ${group+1}`, sido, city, district, dong, lat, lng,
    category: (["냉면","분식","중식","일식","양식","한식"] as const)[group % 6]!,
    menu: (["물냉면","김밥","짜장면","우동","파스타","비빔밥"] as const)[group % 6]!,
    verified: mode !== 4, regions, expected: mode === 0 ? "dong" : mode === 1 ? "gu" : mode === 2 ? "city" : "withheld" };
}
export function fixtureFor(restaurantId: string, batchId: string) {
  const prefix = `manual_test_${batchId}_v2_`;
  if (!restaurantId.startsWith(prefix)) return null;
  const suffix = restaurantId.slice(prefix.length);
  if (!/^\d{1,3}$/.test(suffix)) return null;
  return testVenue(batchId, Number(suffix));
}
