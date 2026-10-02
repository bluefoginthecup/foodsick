import type { ReportDraft } from "../contracts";
import type { CdcDraft } from "../../functions/src/domain/cdc";

export type AnalyticsReport = {
  testBatchId?: string; publicMenus?: string[] | null; menuReview?: {menus:string[]} | null;
  id: string; source: "symptom" | "cdc"; ownerUid: string; memberType: "real" | "test" | "unknown";
  status: string; draft: ReportDraft | CdcDraft | null; createdAt: string; updatedAt: string;
  incubationMinutes: number | null; sensitiveDataConsentVersion: string; reviewNote: string; revision: number; formVersion: string;
};
export type AnalyticsFilters = { source: string; memberType: string; dateBasis: string; start: string; end: string; region: string; restaurant: string; symptom: string; status: string; detailGroup: string; detailKey: string };
export const defaultFilters: AnalyticsFilters = { source: "symptom", memberType: "all", dateBasis: "created", start: "", end: "", region: "", restaurant: "", symptom: "", status: "", detailGroup: "", detailKey: "" };
export const statusLabels: Record<string, string> = { submitted: "접수됨", reviewed: "검토됨", rejected: "집계 제외", duplicate_suspected: "중복 확인 중", included_in_cluster: "신호 집계 포함" };
export function koreaDate(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms + 9 * 3600000).toISOString().slice(0, 10) : "";
}
export function facts(r: AnalyticsReport) {
  const d = r.draft;
  if (r.source === "cdc") {
    const c = d as CdcDraft | null;
    const b = c?.basic ?? {};
    return { mealDate: b.mealDate ?? "", region: b.address || "미입력", restaurant: b.place || "미입력", restaurantKey: b.place ? `cdc:${b.address || ""}:${b.place}` : "",
      category: "CDC · 음식 유형 미수집", symptoms: c?.symptoms ?? [], companions: b.partySick && /^\d+$/.test(b.partySick) ? Math.max(0, Number(b.partySick) - 1) : null,
      medical: b.medical || "unanswered", hospitalized: b.hospitalized || "unanswered" };
  }
  const s = d as ReportDraft | null;
  return { mealDate: s?.mealDate ?? "", region: [s?.province, s?.city, s?.district].filter(Boolean).join(" ") || "미입력", restaurant: s?.restaurantDisplayInput || "미입력", restaurantKey: s?.restaurantInternalId || "",
    category: s?.foodCategory || "미입력", symptoms: s?.symptoms ?? [], companions: typeof s?.partySymptomatic === "number" ? s.partySymptomatic : null,
    medical: typeof s?.medicalVisit === "boolean" ? s.medicalVisit ? "yes" : "no" : "unanswered", hospitalized: typeof s?.hospitalized === "boolean" ? s.hospitalized ? "yes" : "no" : "unanswered" };
}
export function filterReports(reports: AnalyticsReport[], f: AnalyticsFilters) {
  return reports.filter(r => {
    const x = facts(r);
    const date = f.dateBasis === "meal" ? x.mealDate : koreaDate(r.createdAt);
    const detail: Record<string,string | string[]> = { dates: date || "날짜 미입력", regions: x.region, categories: x.category, symptoms: x.symptoms, restaurants: x.restaurantKey || `${r.source}:unknown`, medical: x.medical, hospitalized: x.hospitalized };
    const value = detail[f.detailGroup];
    if (f.detailGroup && (Array.isArray(value) ? !value.includes(f.detailKey) : value !== f.detailKey)) return false;
    return (f.source === "all" || r.source === f.source) && (f.memberType === "all" || r.memberType === f.memberType)
      && (!f.start || (!!date && date >= f.start)) && (!f.end || (!!date && date <= f.end))
      && (!f.region || x.region.toLocaleLowerCase().includes(f.region.trim().toLocaleLowerCase()))
      && (!f.restaurant || x.restaurant.toLocaleLowerCase().includes(f.restaurant.trim().toLocaleLowerCase()))
      && (!f.symptom || x.symptoms.includes(f.symptom)) && (!f.status || r.status === f.status);
  });
}
export type Breakdown = { key: string; label: string; count: number; owners: number };
export function summarize(reports: AnalyticsReport[], dateBasis: string) {
  const group = (get: (r: AnalyticsReport) => { key: string; label: string }[]): Breakdown[] => {
    const map = new Map<string, { label: string; count: number; uids: Set<string> }>();
    for (const r of reports) for (const entry of get(r)) {
      const row = map.get(entry.key) ?? { label: entry.label, count: 0, uids: new Set<string>() };
      row.count++; if (r.ownerUid) row.uids.add(r.ownerUid); map.set(entry.key, row);
    }
    return [...map].map(([key, v]) => ({ key, label: v.label, count: v.count, owners: v.uids.size })).sort((a,b) => b.count-a.count || a.label.localeCompare(b.label));
  };
  const one = (label: string) => [{ key: label, label }];
  const values = reports.map(facts);
  return { count: reports.length, owners: new Set(reports.map(r => r.ownerUid).filter(Boolean)).size,
    companions: values.reduce((sum,v) => sum + (v.companions ?? 0), 0), unknownCompanions: values.filter(v => v.companions === null).length,
    medical: values.filter(v => v.medical === "yes").length, hospitalized: values.filter(v => v.hospitalized === "yes").length,
    medicalAnswers: group(r => one(facts(r).medical)), hospitalAnswers: group(r => one(facts(r).hospitalized)),
    dates: group(r => one((dateBasis === "meal" ? facts(r).mealDate : koreaDate(r.createdAt)) || "날짜 미입력")).sort((a,b) => a.key.localeCompare(b.key)),
    regions: group(r => one(facts(r).region)), categories: group(r => one(facts(r).category)),
    symptoms: group(r => facts(r).symptoms.map(label => ({ key: label, label }))),
    restaurants: group(r => { const x = facts(r); return [{ key: x.restaurantKey || `${r.source}:unknown`, label: `${x.restaurant} · ${x.region}` }]; }),
  };
}
