export type ClusterableReport = {
  id: string;
  ownerUid: string;
  canonicalRestaurantId: string;
  mealAt: string;
  symptomOnsetAt: string;
  symptoms: string[];
  foodCategory: string;
  partySymptomatic: number;
  medicalVisit: boolean;
  status: "submitted" | "duplicate_suspected" | "reviewed" | "included_in_cluster" | "rejected";
};

export type ClusterCandidate = {
  candidateId: string;
  canonicalRestaurantId: string;
  foodCategory: string;
  reportIds: string[];
  independentReporterCount: number;
  companionSymptomaticCount: number;
  totalSymptomaticCount: number;
  medicalVisitReportCount: number;
  windowStart: string;
  windowEnd: string;
  status: "monitoring" | "increased_signal";
  ruleVersion: "cluster-v1";
  reasonCodes: string[];
};

export type RegionPrivacyOption = {
  level: "dong" | "gu" | "city";
  code: string;
  label: string;
  sameCategoryVenueCount: number;
  publicCenter: { lat: number; lng: number };
};

export type PublicSignalAggregate = {
  publicId: string;
  displayRegionCode: string;
  displayRegion: string;
  displayRegionLevel: RegionPrivacyOption["level"];
  displayCenter: RegionPrivacyOption["publicCenter"];
  foodCategory: string;
  independentReportCount: number;
  companionSymptomaticCount: number | null;
  medicalVisitReportCount: number | null;
  windowStart: string;
  windowEnd: string;
  message: "유사 증상 신고 증가";
  privacyPolicyVersion: "privacy-v1";
};

const GASTROINTESTINAL = new Set(["설사", "구토", "복통", "발열", "혈변"]);

function hasGastrointestinalSymptom(report: ClusterableReport) {
  return report.symptoms.some((symptom) => GASTROINTESTINAL.has(symptom));
}

function isEligible(report: ClusterableReport) {
  return ["submitted", "reviewed", "included_in_cluster"].includes(report.status)
    && Boolean(report.ownerUid && report.canonicalRestaurantId)
    && Number.isFinite(Date.parse(report.mealAt))
    && Date.parse(report.symptomOnsetAt) >= Date.parse(report.mealAt)
    && hasGastrointestinalSymptom(report);
}

export function buildClusterCandidates(reports: ClusterableReport[], windowHours = 72, minimumIndependentReporters = 3) {
  const groups = new Map<string, ClusterableReport[]>();
  for (const report of reports.filter(isEligible)) {
    const key = JSON.stringify([report.canonicalRestaurantId, report.foodCategory]);
    const current = groups.get(key) ?? [];
    current.push(report);
    groups.set(key, current);
  }

  const candidates: ClusterCandidate[] = [];
  for (const grouped of groups.values()) {
    const sorted = [...grouped].sort((a, b) => Date.parse(a.mealAt) - Date.parse(b.mealAt) || a.id.localeCompare(b.id));
    for (let start = 0; start < sorted.length; start += 1) {
      const first = sorted[start]!;
      const restaurantId = first.canonicalRestaurantId;
      const windowStartMs = Date.parse(first.mealAt);
      const windowEndMs = windowStartMs + windowHours * 60 * 60 * 1000;
      const withinWindow = sorted.filter((report) => {
        const mealAt = Date.parse(report.mealAt);
        return mealAt >= windowStartMs && mealAt <= windowEndMs;
      });
      const uniqueByOwner = new Map<string, ClusterableReport>();
      for (const report of withinWindow) if (!uniqueByOwner.has(report.ownerUid)) uniqueByOwner.set(report.ownerUid, report);
      if (uniqueByOwner.size < minimumIndependentReporters) continue;
      const independent = [...uniqueByOwner.values()];
      const companionCount = independent.reduce((sum, report) => sum + Math.max(0, report.partySymptomatic), 0);
      candidates.push({
        candidateId: JSON.stringify([restaurantId, first.foodCategory, first.mealAt]),
        canonicalRestaurantId: restaurantId,
        foodCategory: first.foodCategory,
        reportIds: independent.map((report) => report.id),
        independentReporterCount: independent.length,
        companionSymptomaticCount: companionCount,
        totalSymptomaticCount: independent.length + companionCount,
        medicalVisitReportCount: independent.filter((report) => report.medicalVisit).length,
        windowStart: new Date(windowStartMs).toISOString(),
        windowEnd: new Date(Math.min(windowEndMs, Math.max(...independent.map((report) => Date.parse(report.mealAt))))).toISOString(),
        status: "increased_signal",
        ruleVersion: "cluster-v1",
        reasonCodes: ["same_canonical_restaurant", `${windowHours}h_meal_window`, "gastrointestinal_pattern", "three_unique_owners"],
      });
      // Disjoint meal windows prevent one report appearing in multiple signals.
      while (start + 1 < sorted.length && Date.parse(sorted[start + 1]!.mealAt) <= windowEndMs) start += 1;
    }
  }
  return candidates;
}

export function createPrivacySafeAggregate(
  cluster: ClusterCandidate,
  regionOptions: RegionPrivacyOption[],
  options = { minimumVenues: 3, minimumIndependentReporters: 3, detailCountThreshold: 3 },
): PublicSignalAggregate | null {
  if (cluster.independentReporterCount < options.minimumIndependentReporters) return null;
  const ordered = [...regionOptions].sort((a, b) => ["dong", "gu", "city"].indexOf(a.level) - ["dong", "gu", "city"].indexOf(b.level));
  const safeRegion = ordered.find((region) => region.sameCategoryVenueCount >= options.minimumVenues);
  if (!safeRegion) return null;

  return {
    publicId: `public_${safeRegion.code}_${cluster.foodCategory}_${cluster.windowStart.slice(0, 10)}`,
    displayRegionCode: safeRegion.code,
    displayRegion: safeRegion.label,
    displayRegionLevel: safeRegion.level,
    displayCenter: safeRegion.publicCenter,
    foodCategory: cluster.foodCategory,
    independentReportCount: cluster.independentReporterCount,
    companionSymptomaticCount: cluster.companionSymptomaticCount >= options.detailCountThreshold ? cluster.companionSymptomaticCount : null,
    medicalVisitReportCount: cluster.medicalVisitReportCount >= options.detailCountThreshold ? cluster.medicalVisitReportCount : null,
    windowStart: cluster.windowStart,
    windowEnd: cluster.windowEnd,
    message: "유사 증상 신고 증가",
    privacyPolicyVersion: "privacy-v1",
  };
}
