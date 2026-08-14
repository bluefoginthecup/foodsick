import type { ExperienceInput, LawyerInput, ValidatedLawFirmApplication } from "./types";

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

function validateLawyer(value: unknown, index: number): LawyerInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LawFirmInputError(`변호사 ${index + 1} 정보를 확인해주세요.`);
  const lawyer = value as Record<string, unknown>;
  return {
    name: text(lawyer.name, `변호사 ${index + 1} 이름`, 80),
    barRegistrationNumber: text(lawyer.barRegistrationNumber, `변호사 ${index + 1} 등록번호`, 40),
  };
}

function validateExperience(value: unknown, index: number): ExperienceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LawFirmInputError(`사건기록 ${index + 1}을 확인해주세요.`);
  const experience = value as Record<string, unknown>;
  const evidenceType = experience.evidenceType === "case_number" ? "case_number" : experience.evidenceType === "summary" ? "summary" : null;
  if (!evidenceType) throw new LawFirmInputError(`사건기록 ${index + 1}의 확인 방법을 선택해주세요.`);
  const caseCount = Number(experience.caseCount);
  if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > 999) throw new LawFirmInputError(`사건기록 ${index + 1}의 사건 수를 확인해주세요.`);
  const result: ExperienceInput = {
    evidenceType,
    courtName: text(experience.courtName ?? "", `사건기록 ${index + 1} 법원명`, 80, evidenceType === "case_number"),
    caseNumber: text(experience.caseNumber ?? "", `사건기록 ${index + 1} 사건번호`, 80, evidenceType === "case_number"),
    precedentUrl: webUrl(experience.precedentUrl ?? "", `사건기록 ${index + 1} 공개 판결`, false),
    eventRegion: text(experience.eventRegion ?? "", `사건기록 ${index + 1} 발생 지역`, 100, evidenceType === "summary"),
    eventMonth: text(experience.eventMonth ?? "", `사건기록 ${index + 1} 발생 월`, 7, evidenceType === "summary"),
    victimCountBand: text(experience.victimCountBand ?? "", `사건기록 ${index + 1} 피해자 수 구간`, 30, evidenceType === "summary"),
    caseCount,
  };
  if (evidenceType === "summary" && !/^\d{4}-\d{2}$/.test(result.eventMonth)) throw new LawFirmInputError(`사건기록 ${index + 1}의 발생 월을 확인해주세요.`);
  return result;
}

export function validateLawFirmApplication(value: unknown): ValidatedLawFirmApplication {
  if (!value || typeof value !== "object") throw new LawFirmInputError("등록 내용을 확인해주세요.");
  const input = value as Record<string, unknown>;
  const consultationModes = Array.isArray(input.consultationModes)
    ? [...new Set(input.consultationModes.filter((item): item is string => typeof item === "string" && ["방문", "전화", "화상"].includes(item)))]
    : [];
  if (!consultationModes.length) throw new LawFirmInputError("상담 방식을 하나 이상 선택해주세요.");
  const rawLawyers = Array.isArray(input.lawyers)
    ? input.lawyers
    : [{ name: input.representativeLawyer, barRegistrationNumber: input.barRegistrationNumber }];
  const rawExperiences = Array.isArray(input.experiences) ? input.experiences : [input.experience];
  if (!rawLawyers.length || rawLawyers.length > 100) throw new LawFirmInputError("변호사를 1명 이상 100명 이하로 입력해주세요.");
  if (!rawExperiences.length || rawExperiences.length > 100) throw new LawFirmInputError("사건기록을 1건 이상 100건 이하로 입력해주세요.");
  const lawyers = rawLawyers.map(validateLawyer);
  const experiences = rawExperiences.map(validateExperience);
  const totalCaseCount = experiences.reduce((sum, item) => sum + item.caseCount, 0);
  const result: ValidatedLawFirmApplication = {
    firmName: text(input.firmName, "로펌 이름", 100),
    branchName: text(input.branchName ?? "", "지점명", 80, false),
    representativeLawyer: lawyers[0].name,
    barRegistrationNumber: lawyers[0].barRegistrationNumber,
    phone: text(input.phone, "전화번호", 30),
    website: webUrl(input.website, "홈페이지"),
    address: text(input.address, "사무실 주소", 180),
    region: text(input.region, "상담 가능 지역", 100),
    consultationModes,
    introduction: text(input.introduction ?? "", "소개", 500, false),
    lawyers,
    experiences,
    experience: { ...experiences[0], caseCount: totalCaseCount },
  };
  if (!/^[+\d()\-\s]{7,30}$/.test(result.phone)) throw new LawFirmInputError("전화번호를 확인해주세요.");
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
