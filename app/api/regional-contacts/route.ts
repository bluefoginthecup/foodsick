import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { regionalContactCache } from "../../../db/schema";
import { fetchKakaoRegionalContacts } from "./kakao";
import { fetchOfficialFoodSafetyContact } from "./official-organizations";
import type { RegionSelection, RegionalContactsError, RegionalContactsResponse } from "../../../regional-contacts";
import { contactCacheFreshness } from "./cache-policy";

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
  const stale = "cache" in body && body.cache === "stale";
  return Response.json(body, {
    status,
    headers: status === 200
      ? { "Cache-Control": stale ? "public, max-age=30, s-maxage=60" : "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400" }
      : { "Cache-Control": "no-store" },
  });
}

function regionKey(selection: RegionSelection) {
  return [selection.sido, selection.city, selection.district].map((value) => value.trim()).join("|");
}

function regionLabel(selection: RegionSelection) {
  return [selection.sido, selection.city, selection.district, selection.dong].filter(Boolean).join(" ");
}

async function readCachedContacts(selection: RegionSelection) {
  try {
    const db = getDb();
    const [row] = await db.select().from(regionalContactCache).where(eq(regionalContactCache.regionKey, regionKey(selection))).limit(1);
    if (!row || contactCacheFreshness(row.fetchedAt) === "expired") return null;
    const cached = JSON.parse(row.payload) as Omit<RegionalContactsResponse, "cache" | "cacheAgeSeconds">;
    return {
      response: cached,
      freshness: contactCacheFreshness(row.fetchedAt),
      ageSeconds: Math.max(0, Math.floor((Date.now() - row.fetchedAt.getTime()) / 1000)),
    };
  } catch (error) {
    console.error("Regional contact cache read failed", error);
    return null;
  }
}

async function writeCachedContacts(selection: RegionSelection, response: Omit<RegionalContactsResponse, "cache" | "cacheAgeSeconds">) {
  try {
    const db = getDb();
    const now = new Date();
    await db.insert(regionalContactCache).values({
      regionKey: regionKey(selection),
      region: response.region,
      payload: JSON.stringify(response),
      fetchedAt: new Date(response.fetchedAt),
      updatedAt: now,
    }).onConflictDoUpdate({
      target: regionalContactCache.regionKey,
      set: { region: response.region, payload: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), updatedAt: now },
    });
  } catch (error) {
    console.error("Regional contact cache write failed", error);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const selection = readSelection(url);
  if (!selection) {
    return json({ error: "invalid_region", message: "시/도와 시/군을 선택해주세요." }, 400);
  }

  const cached = await readCachedContacts(selection);
  const forceRefresh = url.searchParams.get("refresh") === "1";
  if (cached && !forceRefresh) {
    return json({ ...cached.response, region: regionLabel(selection), cache: cached.freshness, cacheAgeSeconds: cached.ageSeconds });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    if (cached) return json({ ...cached.response, region: regionLabel(selection), cache: "stale", cacheAgeSeconds: cached.ageSeconds });
    return json({
      error: "provider_not_configured",
      message: "최신 연락처 조회 API가 아직 운영 환경에 연결되지 않았습니다.",
    }, 503);
  }

  try {
    const [contacts, officialFoodSafety] = await Promise.all([
      fetchKakaoRegionalContacts(selection, apiKey),
      fetchOfficialFoodSafetyContact(selection).catch((error) => {
        console.error("Official food-safety contact provider failed", error);
        return null;
      }),
    ]);
    const districtOffice = contacts.find((contact) => contact.kind === "district_office");
    const resolvedFoodSafety = officialFoodSafety && !officialFoodSafety.phone && districtOffice
      ? {
          ...officialFoodSafety,
          phone: districtOffice.phone,
          address: `직통번호 확인 중 · ${districtOffice.name} 대표전화로 담당부서 연결 요청`,
        }
      : officialFoodSafety;
    const mergedContacts = resolvedFoodSafety?.phone
      ? [resolvedFoodSafety, ...contacts.filter((contact) => contact.kind !== "food_safety")]
      : contacts;
    const response = {
      region: regionLabel(selection),
      provider: "kakao-local+official-organizations" as const,
      fetchedAt: new Date().toISOString(),
      contacts: mergedContacts,
    };
    await writeCachedContacts(selection, response);
    return json({ ...response, cache: "refreshed", cacheAgeSeconds: 0 });
  } catch (error) {
    console.error("Regional contact provider failed", error);
    if (cached) return json({ ...cached.response, region: regionLabel(selection), cache: "stale", cacheAgeSeconds: cached.ageSeconds });
    return json({
      error: "provider_unavailable",
      message: "최신 연락처를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
    }, 502);
  }
}
