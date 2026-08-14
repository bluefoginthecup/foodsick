import { fetchKakaoRestaurants } from "./kakao";

function validText(value: string, minimum: number, maximum: number) {
  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  return value.length >= minimum && value.length <= maximum && !hasControlCharacter;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const region = url.searchParams.get("region")?.trim() ?? "";
  if (!validText(query, 2, 80) || !validText(region, 0, 120)) {
    return Response.json({ error: "검색어를 두 글자 이상 입력해주세요." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "음식점 검색 API가 아직 연결되지 않았습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const candidates = await fetchKakaoRestaurants(query, region, apiKey);
    return Response.json({ candidates }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Restaurant search failed", error);
    return Response.json({ error: "음식점 검색 결과를 불러오지 못했습니다." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
