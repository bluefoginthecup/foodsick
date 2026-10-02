import { createHash } from "node:crypto";
import { isEligible, type ClusterableReport } from "./clustering.js";
import { toPublicSignal, type SafeRegion } from "./public-signal.js";

export type HistoryRow = { region: SafeRegion; date: string; category: string; count: number; companions: number; medical: number; outpatient: number; inpatient: number; unknownMedical: boolean };
export function historyRows(reports: ClusterableReport[], regions: Map<string, SafeRegion | null>): HistoryRow[] {
  const rows = new Map<string, HistoryRow>();
  for (const report of reports.filter(isEligible)) {
    const region = regions.get(report.foodCategory);
    if (!region) continue;
    const date = new Date(Date.parse(report.mealAt) + 9 * 3600000).toISOString().slice(0,10);
    const key = `${region.code}:${report.foodCategory}:${date}`;
    const row = rows.get(key) ?? { region, date, category: report.foodCategory, count: 0, companions: 0, medical: 0, outpatient: 0, inpatient: 0, unknownMedical: false };
    row.count++; row.companions += Math.max(0, report.partySymptomatic);
    if (report.medicalVisit) row.medical++;
    if (report.hospitalized === true) row.inpatient++;
    else if (report.medicalVisit && report.hospitalized === false) row.outpatient++;
    if (report.medicalVisit && typeof report.hospitalized !== "boolean") row.unknownMedical = true;
    rows.set(key,row);
  }
  return [...rows.values()];
}
// Combine venue contributions on the server before exposing any rows to the browser.
export function publicHistory(rows: HistoryRow[]) {
  const grouped = new Map<string, HistoryRow>();
  for (const row of rows) {
    const key = `${row.region.code}:${row.category}:${row.date}`;
    const prior = grouped.get(key);
    if (!prior) grouped.set(key, {...row});
    else { prior.count += row.count; prior.companions += row.companions; prior.medical += row.medical; prior.outpatient += row.outpatient; prior.inpatient += row.inpatient; prior.unknownMedical ||= row.unknownMedical; }
  }
  return [...grouped].map(([key,r]) => ({...toPublicSignal(createHash("sha256").update(key).digest("hex"), {
    candidateId: "", canonicalRestaurantId: "", foodCategory:r.category, reportIds:[], independentReporterCount:r.count,
    companionSymptomaticCount:r.companions, totalSymptomaticCount:r.count+r.companions, medicalVisitReportCount:r.medical,
    outpatientReportCount:r.unknownMedical?null:r.outpatient, inpatientReportCount:r.unknownMedical?null:r.inpatient,
    windowStart:`${r.date}T00:00:00+09:00`,windowEnd:`${r.date}T00:00:00+09:00`, status:"increased_signal",ruleVersion:"cluster-v1",reasonCodes:[]
  },r.region),kind:"history" as const}));
}
