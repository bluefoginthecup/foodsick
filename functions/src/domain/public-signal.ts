import type { ClusterCandidate } from "./clustering.js";

export type SafeRegion = {
  sido: string; city: string; district: string; dong: string;
  level: "dong" | "gu" | "city";
  code: string;
  sameCategoryVenueCount: number;
};

export function chooseSafeRegion(regions: SafeRegion[]) {
  return [...regions].sort((a, b) => ["dong", "gu", "city"].indexOf(a.level) - ["dong", "gu", "city"].indexOf(b.level))
    .find((region) => region.sido && (region.city || region.level === "city") && region.code && region.sameCategoryVenueCount >= 3) ?? null;
}

export function toPublicSignal(id: string, cluster: ClusterCandidate, region: SafeRegion) {
  const counts = { companionSymptoms: cluster.companionSymptomaticCount, medicalVisits: cluster.medicalVisitReportCount, outpatientVisits: cluster.outpatientReportCount, inpatientVisits: cluster.inpatientReportCount };
  const detail = (n: number | null | undefined) => n === 0 || (typeof n === "number" && n >= 3) ? n : null;
  return {
    id,
    publicMenus: [] as string[],
    region: [region.sido, region.city, region.district, region.dong].filter((v, i, a) => v && v !== a[i - 1]).join(" "),
    sido: region.sido, city: region.city, district: region.district, dong: region.dong,
    category: cluster.foodCategory,
    observedAt: new Date(Date.parse(cluster.windowEnd) + 9 * 3600_000).toISOString().slice(0, 10),
    independentReports: cluster.independentReporterCount,
    companionSymptoms: detail(counts.companionSymptoms), medicalVisits: detail(counts.medicalVisits),
    outpatientVisits: detail(counts.outpatientVisits), inpatientVisits: detail(counts.inpatientVisits),
    smallDetails: Object.entries(counts).filter(([, n]) => typeof n === "number" && n > 0 && n < 3).map(([key]) => key),
    detailCountsVersion: 2,
    trend: "increased" as const,
    privacyLevel: region.level,
    privacyPolicyVersion: "privacy-v1" as const,
    regionAdjusted: region.level !== "dong",
  };
}

// Explicit allowlist: never return Firestore documents, private IDs, or coordinates.
export function publicSignalView(data: Record<string, unknown>) {
  const strings = ["id", "region", "sido", "city", "district", "dong", "category", "observedAt"] as const;
  if (strings.some((key) => typeof data[key] !== "string")) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.observedAt as string) || !Number.isFinite(Date.parse(data.observedAt as string))) return null;
  if (!Number.isSafeInteger(data.independentReports) || Number(data.independentReports) < 3) return null;
  if (!["dong", "gu", "city"].includes(String(data.privacyLevel)) || data.privacyPolicyVersion !== "privacy-v1") return null;
  const detail = (value: unknown) => Number.isSafeInteger(value) && (Number(value) === 0 || Number(value) >= 3) ? Number(value) : null;
  return {
    publicMenus: [] as string[],
    id: data.id as string, region: data.region as string,
    sido: data.sido as string, city: data.city as string, district: data.district as string, dong: data.dong as string,
    category: data.category as string, observedAt: data.observedAt as string,
    independentReports: Number(data.independentReports), companionSymptoms: detail(data.companionSymptoms), medicalVisits: detail(data.medicalVisits),
    outpatientVisits: detail(data.outpatientVisits), inpatientVisits: detail(data.inpatientVisits),
    smallDetails: data.detailCountsVersion === 2 && Array.isArray(data.smallDetails) ? data.smallDetails.filter((key): key is string => typeof key === "string" && ["companionSymptoms", "medicalVisits", "outpatientVisits", "inpatientVisits"].includes(key) && data[key] === null) : [],
    detailCountsVersion: 2,
    trend: "increased" as const, privacyLevel: data.privacyLevel as SafeRegion["level"],
    privacyPolicyVersion: "privacy-v1" as const, regionAdjusted: data.privacyLevel !== "dong",
  };
}
