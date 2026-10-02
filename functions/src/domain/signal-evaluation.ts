import { buildClusterCandidates, type ClusterableReport } from "./clustering.js";
import { toPublicSignal, type SafeRegion } from "./public-signal.js";
import { PUBLIC_MENUS, standardMenus } from "./report.js";
export type EvaluationReport = ClusterableReport & { publicMenus?: string[]; menu?: string; menuReview?: { menus: string[] } | null };
export function publicationMenus(clusterIds: string[], reports: EvaluationReport[]) {
  const owners = new Map<string, Set<string>>();
  for (const r of reports.filter(r => clusterIds.includes(r.id))) {
    const menus = r.menuReview ? r.menuReview.menus : r.publicMenus ?? standardMenus(r.menu);
    for (const menu of menus) {
      if (!(PUBLIC_MENUS as readonly string[]).includes(menu)) continue;
      const set = owners.get(menu) ?? new Set<string>(); set.add(r.ownerUid); owners.set(menu, set);
    }
  }
  // No small menu subgroup is exposed; no per-menu counts are published.
  return [...owners].filter(([, ids]) => ids.size >= 3).map(([menu]) => menu).sort();
}
export function evaluateSignals(reports: EvaluationReport[], regions: Map<string, SafeRegion | null>, idFor: (candidateId: string) => string) {
  const candidates = buildClusterCandidates(reports);
  const signals = candidates.flatMap(cluster => {
    const region = regions.get(cluster.foodCategory);
    return region ? [{ ...toPublicSignal(idFor(cluster.candidateId), cluster, region), publicMenus: [] as string[] }] : [];
  });
  const checks = [...new Set(reports.map(r=>r.foodCategory))].map(category=>{
    const rows=reports.filter(r=>r.foodCategory===category);
    const eligible=rows.filter(r=>["submitted","reviewed","included_in_cluster"].includes(r.status) && r.symptoms.some(s=>["설사","구토","복통","발열","혈변"].includes(s)) && Date.parse(r.symptomOnsetAt)>=Date.parse(r.mealAt));
    const maxWindowOwners=Math.max(0,...eligible.map(first=>new Set(eligible.filter(r=>Date.parse(r.mealAt)>=Date.parse(first.mealAt)&&Date.parse(r.mealAt)<=Date.parse(first.mealAt)+72*3600000).map(r=>r.ownerUid)).size));
    return {category, reports:rows.length, eligible:eligible.length, owners:new Set(eligible.map(r=>r.ownerUid)).size,maxWindowOwners,region:regions.get(category)?.level??null};
  });
  return { candidates, signals, checks, reason: signals.length ? "공개 기준 충족" : candidates.length ? "장소 미확인 또는 주변 동일 유형 업소 수 부족" : "독립 신고자·72시간·증상·검토 상태 조건 미충족" };
}
