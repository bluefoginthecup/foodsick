import { kakaoClient } from "../../../../functions/src/domain/venue-privacy.ts";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const x = params.get("x") ?? "";
  const y = params.get("y") ?? "";
  if (!x || !y || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y)) || Number(x) < 124 || Number(x) > 132 || Number(y) < 32 || Number(y) > 40) {
    return Response.json({ error: "음식점 위치를 확인하지 못했습니다. 지역을 직접 선택해주세요." }, { status: 400 });
  }
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return Response.json({ error: "지역을 자동으로 확인하지 못했습니다. 아래에서 직접 선택해주세요." }, { status: 503 });
  try {
    const documents = await kakaoClient(key)<{ region_type: string; region_1depth_name: string; region_2depth_name: string; region_3depth_name: string }>("geo/coord2regioncode", { x, y });
    const region = documents.find((item) => item.region_type === "H") ?? documents.find((item) => item.region_type === "B");
    if (!region) throw new Error("Region not found");
    return Response.json({ region: { province: region.region_1depth_name, city: region.region_2depth_name || (region.region_1depth_name === "세종특별자치시" ? "세종시" : ""), district: region.region_3depth_name } }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "지역 자동 입력에 실패했습니다. 아래 목록에서 선택해주세요." }, { status: 502 });
  }
}
