import type { LawFirmApplicationInput } from "./types";

export class LawFirmInputError extends Error {}

function text(value: unknown, label: string, max: number, required = true) {
  if (typeof value !== "string") throw new LawFirmInputError(`${label}을(를) 확인해주세요.`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) throw new LawFirmInputError(`${label}을(를) 확인해주세요.`);
  return normalized;
}

function webUrl(value: unknown, label: string, required = true) {
  const normalized = text(value, label, 400, required);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.toString();
  } catch {
    throw new LawFirmInputError(`${label} 주소를 확인해주세요.`);
  }
}

export function validateLawFirmApplication(value: unknown): LawFirmApplicationInput {
  if (!value || typeof value !== "object") throw new LawFirmInputError("등록 내용을 확인해주세요.");
  const input = value as Record<string, unknown>;
  const experience = input.experience as Record<string, unknown> | undefined;
  const evidenceType = experience?.evidenceType === "case_number" ? "case_number" : experience?.evidenceType === "summary" ? "summary" : null;
  if (!evidenceType) throw new LawFirmInputError("수임경력 확인 방법을 선택해주세요.");
  const consultationModes = Array.isArray(input.consultationModes)
    ? [...new Set(input.consultationModes.filter((item): item is string => typeof item === "string" && ["방문", "전화", "화상"].includes(item)))]
    : [];
  if (!consultationModes.length) throw new LawFirmInputError("상담 방식을 하나 이상 선택해주세요.");

  const caseCount = Number(experience?.caseCount);
  if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > 999) throw new LawFirmInputError("식중독 관련 사건 수를 확인해주세요.");
  const result: LawFirmApplicationInput = {
    firmName: text(input.firmName, "로펌 이름", 100),
    branchName: text(input.branchName ?? "", "지점명", 80, false),
    representativeLawyer: text(input.representativeLawyer, "담당 변호사", 80),
    barRegistrationNumber: text(input.barRegistrationNumber, "변호사 등록번호", 40),
    phone: text(input.phone, "전화번호", 30),
    website: webUrl(input.website, "홈페이지"),
    address: text(input.address, "사무실 주소", 180),
    region: text(input.region, "상담 가능 지역", 100),
    consultationModes,
    introduction: text(input.introduction ?? "", "소개", 500, false),
    experience: {
      evidenceType,
      courtName: text(experience?.courtName ?? "", "법원명", 80, evidenceType === "case_number"),
      caseNumber: text(experience?.caseNumber ?? "", "사건번호", 80, evidenceType === "case_number"),
      precedentUrl: webUrl(experience?.precedentUrl ?? "", "공개 판결", false),
      eventRegion: text(experience?.eventRegion ?? "", "사건 발생 지역", 100, evidenceType === "summary"),
      eventMonth: text(experience?.eventMonth ?? "", "사건 발생 월", 7, evidenceType === "summary"),
      victimCountBand: text(experience?.victimCountBand ?? "", "피해자 수 구간", 30, evidenceType === "summary"),
      caseCount,
    },
  };
  if (!/^[+\d()\-\s]{7,30}$/.test(result.phone)) throw new LawFirmInputError("전화번호를 확인해주세요.");
  if (evidenceType === "summary" && !/^\d{4}-\d{2}$/.test(result.experience.eventMonth)) throw new LawFirmInputError("사건 발생 월을 확인해주세요.");
  return result;
}

export function siteUser(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim();
  if (!userId || !email) return null;
  return { userId, email };
}

export function requireAdmin(request: Request) {
  const user = siteUser(request);
  if (!user) return null;
  const configured = (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!configured.length || !configured.includes(user.email.toLowerCase())) return null;
  return user;
}
