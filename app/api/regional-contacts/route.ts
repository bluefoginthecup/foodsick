import { fetchKakaoRegionalContacts } from "./kakao";
import type { RegionSelection, RegionalContactsError, RegionalContactsResponse } from "../../../regional-contacts";

const REGION_VALUE = /^[가-힣A-Za-z0-9·\-\s]{0,40}$/;

function readSelection(url: URL): RegionSelection | null {
  const selection = {
    sido: url.searchParams.get("sido")?.trim() ?? "",
    city: url.searchParams.get("city")?.trim() ?? "",
    district: url.searchParams.get("district")?.trim() ?? "",
    dong: url.searchParams.get("dong")?.trim() ?? "",
  };
  if (!selection.sido || !selection.city) return null;
  if (Object.values(selection).some((value) => !REGION_VALUE.test(value))) return null;
  return selection;
}

function json(body: RegionalContactsResponse | RegionalContactsError, status = 200) {
  return Response.json(body, {
    status,
    headers: status === 200
      ? { "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400" }
      : { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const selection = readSelection(new URL(request.url));
  if (!selection) {
    return json({ error: "invalid_region", message: "시/도와 시/군을 선택해주세요." }, 400);
  }

  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    return json({
      error: "provider_not_configured",
      message: "최신 연락처 조회 API가 아직 운영 환경에 연결되지 않았습니다.",
    }, 503);
  }

  try {
    const contacts = await fetchKakaoRegionalContacts(selection, apiKey);
    return json({
      region: [selection.sido, selection.city, selection.district, selection.dong].filter(Boolean).join(" "),
      provider: "kakao-local",
      fetchedAt: new Date().toISOString(),
      contacts,
    });
  } catch (error) {
    console.error("Regional contact provider failed", error);
    return json({
      error: "provider_unavailable",
      message: "최신 연락처를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
    }, 502);
  }
}
