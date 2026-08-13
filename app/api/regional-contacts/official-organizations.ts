import type { RegionSelection, RegionalContact } from "../../../regional-contacts";

type FetchLike = typeof fetch;

type Organization = {
  code: string;
  fullName: string;
  name: string;
  phone: string;
};

const ORGANIZATION_SEARCH_PAGE = "https://www.code.go.kr/stdcode/orgCodeL.do";
const ORGANIZATION_SEARCH_URL = "https://www.code.go.kr/stdcode/orgCodeFrameL.do";
const YONGIN_STAFF_URL = "https://www.yongin.go.kr/common/orgcht/BD_iframeGuOrgList.do";
const FOOD_SAFETY_DEPARTMENT = /(식품위생|위생정책|환경위생|보건위생|지역경제위생|산업위생|위생관리|산업환경)/;
const PHONE = /0\d{1,2}[ -]\d{3,4}[ -]\d{4}/;

function decodeHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string) {
  return value.match(PHONE)?.[0].replaceAll(" ", "-") ?? "";
}

export function parseOrganizations(html: string): Organization[] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decodeHtml(cell[1]));
    if (cells.length < 4 || !/^\d{7}$/.test(cells[0])) return [];
    return [{ code: cells[0], fullName: cells[1], name: cells[2], phone: normalizePhone(cells[3]) }];
  });
}

export function parseFoodSafetyStaff(html: string) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => (
    [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decodeHtml(cell[1]))
  ));
  const match = rows.find((cells) => cells.some((cell) => /식중독.*(예방|관리|신고)|(?:예방|관리|신고).*식중독/.test(cell)));
  if (!match) return null;
  const phone = match.map(normalizePhone).find(Boolean);
  if (!phone) return null;
  return { phone, duty: match.at(-1) ?? "식중독 예방 및 관리" };
}

function sessionCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(/,(?=[^;,]+=[^;,]+)/).map((cookie) => cookie.split(";", 1)[0]).join("; ") ?? "";
}

async function searchOrganizations(selection: RegionSelection, fetcher: FetchLike) {
  const session = await fetcher(ORGANIZATION_SEARCH_PAGE, { headers: { Accept: "text/html" } });
  if (!session.ok) throw new Error(`Official organization directory returned ${session.status}`);
  const body = new URLSearchParams({
    codeseId: "00001",
    cPage: "1",
    sortedIndex: "0",
    fullNm: [selection.sido, selection.city, selection.district].filter(Boolean).join(" "),
    lowNm: "",
    orgCd: "",
    highCd: "0",
    stopSelt: "0",
    TelNoV: "1",
    CkStopSelt: "1",
    pageSize: "100",
  });
  const response = await fetcher(ORGANIZATION_SEARCH_URL, {
    method: "POST",
    body,
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Referer: ORGANIZATION_SEARCH_PAGE,
      Cookie: sessionCookie(session),
    },
  });
  if (!response.ok) throw new Error(`Official organization search returned ${response.status}`);
  return parseOrganizations(await response.text());
}

function selectDepartment(organizations: Organization[], selection: RegionSelection) {
  const expectedPrefix = [selection.sido, selection.city, selection.district].filter(Boolean).join(" ");
  return organizations
    .filter((organization) => organization.fullName.startsWith(expectedPrefix) && FOOD_SAFETY_DEPARTMENT.test(organization.name))
    .sort((left, right) => {
      const score = (item: Organization) => (/식품위생|위생정책/.test(item.name) ? 4 : /환경위생|보건위생|위생관리/.test(item.name) ? 3 : 1)
        + (item.phone ? 2 : 0);
      return score(right) - score(left);
    })[0];
}

async function yonginFoodSafetyStaff(department: Organization, fetcher: FetchLike) {
  const url = new URL(YONGIN_STAFF_URL);
  url.searchParams.set("q_deptCode", `${department.code}${"0".repeat(12)}`);
  url.searchParams.set("q_deptNm", "");
  const response = await fetcher(url, { headers: { Accept: "text/html" } });
  if (!response.ok) return null;
  const staff = parseFoodSafetyStaff(await response.text());
  if (!staff) return null;
  return { staff, sourceUrl: url.toString() };
}

export async function fetchOfficialFoodSafetyContact(
  selection: RegionSelection,
  fetcher: FetchLike = fetch,
): Promise<(Omit<RegionalContact, "phone"> & { phone: string }) | (Omit<RegionalContact, "phone"> & { phone: "" }) | null> {
  if (!selection.district) return null;
  const department = selectDepartment(await searchOrganizations(selection, fetcher), selection);
  if (!department) return null;

  if (selection.city === "용인시") {
    const result = await yonginFoodSafetyStaff(department, fetcher);
    if (result) {
      return {
        kind: "food_safety",
        label: "식중독 예방·관리 담당",
        name: `${selection.district} ${department.name}`,
        phone: result.staff.phone,
        address: result.staff.duty,
        sourceUrl: result.sourceUrl,
        sourceLabel: "지자체 공식 직원안내",
      };
    }
  }

  if (!department.phone) {
    return {
      kind: "food_safety",
      label: "관할 식품위생 담당",
      name: `${selection.district} ${department.name}`,
      phone: "",
      address: "직통번호 확인 중 · 구청 대표전화로 연결 요청 가능",
      sourceUrl: ORGANIZATION_SEARCH_PAGE,
      sourceLabel: "행정안전부 공식 조직정보",
    };
  }
  return {
    kind: "food_safety",
    label: "관할 식품위생 담당",
    name: department.fullName.replace(`${selection.sido} ${selection.city} `, ""),
    phone: department.phone,
    address: `${selection.sido} ${selection.city} ${selection.district}`,
    sourceUrl: ORGANIZATION_SEARCH_PAGE,
    sourceLabel: "행정안전부 공식 조직정보",
  };
}
