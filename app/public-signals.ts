import { PUBLIC_MENUS } from "../functions/src/domain/report.ts";
export type PublicSignal = {
  publicMenus?: string[];
  id: string; region: string; sido: string; city: string; district: string; dong: string;
  category: string; observedAt: string; independentReports: number;
  companionSymptoms: number | null; medicalVisits: number | null;
  outpatientVisits?: number | null; inpatientVisits?: number | null; smallDetails?: string[];
  trend: "steady" | "increased"; privacyLevel: "dong" | "gu" | "city";
  privacyPolicyVersion: "privacy-v1"; regionAdjusted: boolean;
};

export function signalDateRange(now = new Date()) {
  const end = new Date(now.getTime() + 9 * 3600_000);
  const start = new Date(end.getTime() - 365 * 86400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function sumSignalDetails(signals: PublicSignal[], key: "companionSymptoms" | "medicalVisits") {
  return signals.some((signal) => signal[key] === null) ? null : signals.reduce((sum, signal) => sum + (signal[key] ?? 0), 0);
}

export function summarizeSignalDetail(signals: PublicSignal[], key: "companionSymptoms" | "outpatientVisits" | "inpatientVisits") {
  return signals.reduce((result, signal) => {
    if (typeof signal[key] === "number") result.known += signal[key]!;
    else if (signal.smallDetails?.includes(key)) result.smallGroups++;
    else result.unknown = true;
    return result;
  }, { known: 0, smallGroups: 0, unknown: false });
}

export function parsePublicSignals(input: unknown): PublicSignal[] {
  if (!Array.isArray(input)) throw new Error("신호 응답을 확인하지 못했습니다.");
  return input.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("신호 응답을 확인하지 못했습니다.");
    const s = value as Record<string, unknown>;
    if (["id", "region", "sido", "city", "district", "dong", "category", "observedAt"].some((key) => typeof s[key] !== "string")
      || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.observedAt)) || !Number.isFinite(Date.parse(String(s.observedAt)))
      || !Number.isSafeInteger(s.independentReports) || Number(s.independentReports) < 3
      || !["dong", "gu", "city"].includes(String(s.privacyLevel)) || s.privacyPolicyVersion !== "privacy-v1") {
      throw new Error("신호 응답을 확인하지 못했습니다.");
    }
    const detail = (n: unknown) => Number.isSafeInteger(n) && (Number(n) === 0 || Number(n) >= 3) ? Number(n) : null;
    return { publicMenus: Array.isArray(s.publicMenus) ? s.publicMenus.filter((v): v is string => typeof v === "string" && (PUBLIC_MENUS as readonly string[]).includes(v)) : [], id: String(s.id), region: String(s.region), sido: String(s.sido), city: String(s.city), district: String(s.district), dong: String(s.dong),
      category: String(s.category), observedAt: String(s.observedAt), independentReports: Number(s.independentReports),
      companionSymptoms: detail(s.companionSymptoms), medicalVisits: detail(s.medicalVisits), trend: "increased",
      outpatientVisits: detail(s.outpatientVisits), inpatientVisits: detail(s.inpatientVisits),
      smallDetails: s.detailCountsVersion === 2 && Array.isArray(s.smallDetails) ? s.smallDetails.filter((key): key is string => typeof key === "string" && ["companionSymptoms", "medicalVisits", "outpatientVisits", "inpatientVisits"].includes(key) && s[key] === null) : [],
      privacyLevel: s.privacyLevel as PublicSignal["privacyLevel"], privacyPolicyVersion: "privacy-v1", regionAdjusted: s.privacyLevel !== "dong" };
  });
}
