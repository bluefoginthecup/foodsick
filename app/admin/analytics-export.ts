import { answers, basicFields, detailGroups, mealFields, type CdcDraft, type Field } from "../../functions/src/domain/cdc.ts";
import type { ReportDraft } from "../contracts";
import { summarize, statusLabels, type AnalyticsFilters, type AnalyticsReport } from "./analytics-model.ts";

export const memberLabels: Record<string,string> = { real: "실제", test: "테스트", unknown: "회원 확인 불가", all: "전체" };
export const answerLabels: Record<string,string> = { ...answers, unanswered: "미응답" };
const labels: Record<string,string> = {
  publicMenus: "선택한 공개용 메뉴", mealDate: "식사일", mealTime: "식사 시간", province: "시/도", city: "시/군/구", district: "읍/면/동", restaurantInternalId: "음식점 식별값", restaurantDisplayInput: "음식점 이름", foodCategory: "음식 유형", foodCategoryDetail: "기타 음식 유형", menu: "먹은 메뉴", serviceMode: "이용 방식", symptoms: "증상", diarrheaCount: "설사 횟수", otherSymptom: "기타 증상", onsetDate: "증상 시작일", onsetTime: "증상 시작 시간", partyTotal: "동행 전체 인원 (본인 포함)", partySymptomatic: "동행 증상자 (본인 제외)", companionSymptoms: "동행자 공통 증상", companionOnsetAt: "동행자 공통 시작 시점", companionMedicalVisit: "동행자 병원 방문", companionTested: "동행자 검사", medicalVisit: "병원 방문", hospitalized: "입원", tested: "검사", pathogenKnown: "병원체 확인", pathogenType: "병원체 종류",
  age: "나이", gender: "성별", onsetAt: "증상 시작 시점", underlyingConditions: "기저질환", otherUnderlyingCondition: "기타 기저질환",
};
const enumLabels: Record<string,string> = { dine_in: "매장", delivery: "배달", takeout: "포장", female: "여성", male: "남성", other: "기타", undisclosed: "응답하지 않음" };
const choiceLabels = new Set([
  "증상", "동행자 공통 증상", "음식 유형", "이용 방식", "성별", "기저질환", "병원 방문", "입원", "검사", "병원체 확인", "동의", "동행자 병원 방문", "동행자 검사", "회원구분", "검토상태",
  ...[...basicFields, ...mealFields].filter(f => f.type === "answer" || f.options).map(f => f.label),
  ...detailGroups.flatMap(g => g.fields.filter(f => f.type === "answer" || f.options).map(f => `${g.title} · ${f.label}`)),
]);
export function localizeDetailValue(label: string, value: string | number, translate: (value: string) => string): string | number {
  return typeof value === "string" && choiceLabels.has(label) ? translate(value) : value;
}
export function cellValue(v: unknown): string | number {
  if (v === undefined || v === null || v === "") return "미응답";
  if (v === true) return "예";
  if (v === false) return "아니요";
  if (Array.isArray(v)) return v.length ? v.map(x => typeof x === "object" ? JSON.stringify(x) : String(x)).join(", ") : "선택 없음";
  return typeof v === "number" ? v : String(v);
}
function fieldValue(field: Field, values: Record<string,string>) {
  const v = values[field.key];
  return v ? (field.type === "answer" ? answerLabels[v] ?? v : field.options?.[v] ?? v) : "미응답";
}
export function detailRows(r: AnalyticsReport): Array<[string, string | number]> {
  if (!r.draft) return [["작성 원본", "없음"]];
  if (r.source === "cdc") {
    const d = r.draft as CdcDraft;
    return [["증상", cellValue(d.symptoms)], ...basicFields.map(f => [f.label, fieldValue(f, d.basic)] as [string,string]), ...detailGroups.flatMap(g => g.fields.map(f => [`${g.title} · ${f.label}`, fieldValue(f, d.detail)] as [string,string])), ["동의", cellValue(d.consent)]];
  }
  return Object.entries(r.draft).filter(([key]) => key !== "companions").map(([key, value]) => [labels[key] ?? key, cellValue(typeof value === "string" && ["gender", "serviceMode"].includes(key) ? enumLabels[value] ?? value : value)]);
}
export function companionRows(r: AnalyticsReport): Array<Array<[string, string | number]>> {
  if (r.source !== "symptom") return [];
  return ((r.draft as ReportDraft | null)?.companions ?? []).map(c => Object.entries(c).map(([k,v]) => [labels[k] ?? k, cellValue(k === "gender" ? enumLabels[String(v)] ?? v : v)]));
}
export function cdcMealRows(r: AnalyticsReport): Array<Array<[string, string | number]>> {
  if (r.source !== "cdc") return [];
  return ((r.draft as CdcDraft | null)?.meals ?? []).map(m => mealFields.map(f => [f.label, fieldValue(f,m)]));
}

export async function buildAnalyticsWorkbook(reports: AnalyticsReport[], filters: AnalyticsFilters, loadedAt: string, auditId: string, translate: (value: string) => string = value => value) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook();
  workbook.creator = "나두아파"; workbook.created = new Date();
  const summary = summarize(reports, filters.dateBasis);
  const summaryRows: Array<Record<string,string|number>> = [
    { 항목: "생성 시각", 값: new Date().toISOString() }, { 항목: "자료 조회 완료 시각", 값: loadedAt }, { 항목: "다운로드 기록 번호", 값: auditId },
    { 항목: "집계 안내", 값: "신고 기준 집계입니다. 중복 제출·두 양식 간 같은 사건을 자동으로 합치지 않습니다. 동행자는 중복될 수 있습니다." },
    { 항목: "조회 방식", 값: "조회 중 수정·삭제가 발생할 수 있으며 시점 고정 스냅샷이 아닙니다." },
    ...Object.entries(filters).map(([k,v]) => ({ 항목: ({ source: "신고 양식", memberType: "회원 구분", dateBasis: "날짜 기준", start: "시작일", end: "종료일", region: "지역 검색", restaurant: "음식점 검색", symptom: "증상", status: "검토 상태", detailGroup: "상세 선택 구분", detailKey: "상세 선택 항목" } as Record<string,string>)[k], 값: k === "memberType" ? memberLabels[v] : k === "source" ? ({ symptom: "증상 신고", cdc: "CDC 신고", all: "두 양식 전체" } as Record<string,string>)[v] : k === "dateBasis" ? v === "meal" ? "식사일" : "신고일 (한국 시간)" : k === "status" ? statusLabels[v] || "전체" : v || "전체" })),
    ...Object.entries({ 신고건수: summary.count, 신고회원수: summary.owners, 동행증상자합계: summary.companions, 동행인원미응답건수: summary.unknownCompanions, 병원방문신고건수: summary.medical, 입원신고건수: summary.hospitalized }).map(([항목,값]) => ({ 항목, 값 })),
    ...([['날짜별',summary.dates],['지역별',summary.regions],['음식유형별',summary.categories],['증상별 (복수선택)',summary.symptoms],['음식점별',summary.restaurants],['병원 방문 응답',summary.medicalAnswers],['입원 응답',summary.hospitalAnswers]] as const).flatMap(([title,rows]) => rows.map(row => ({ 항목: `${title} · ${answerLabels[row.label] ?? row.label}`, 값: row.count, 신고회원수: row.owners }))),
  ];
  const meta = (r: AnalyticsReport) => ({ 시험묶음: r.testBatchId ?? "", 공개메뉴검토: r.menuReview ? (r.menuReview.menus.join(", ") || "비공개 확정") : "미검토", 신고번호: r.id, 신고회원ID: r.ownerUid, 회원구분: memberLabels[r.memberType], 검토상태: statusLabels[r.status] ?? r.status, 신고시각UTC: r.createdAt, 수정시각UTC: r.updatedAt, 동의버전: r.sensitiveDataConsentVersion, 잠복시간분: r.incubationMinutes ?? "미응답", 검토메모: r.reviewNote, 양식버전: r.formVersion, 수정버전: r.revision });
  const sheets: Array<[string, Array<Record<string,string|number>>]> = [
    ["요약 통계", summaryRows],
    ["증상 신고", reports.filter(r => r.source === "symptom").map(r => ({ ...meta(r), ...Object.fromEntries(detailRows(r)) }))],
    ["동행자", reports.flatMap(r => companionRows(r).map((rows,i) => ({ 신고번호: r.id, 동행자번호: i+1, ...Object.fromEntries(rows) })))],
    ["CDC 신고", reports.filter(r => r.source === "cdc").map(r => ({ ...meta(r), ...Object.fromEntries(detailRows(r)) }))],
    ["CDC 식사 기록", reports.flatMap(r => cdcMealRows(r).map((rows,i) => ({ 신고번호: r.id, 식사번호: i+1, ...Object.fromEntries(rows) })))],
  ];
  for (const [name, rows] of sheets) {
    const sheet = workbook.addWorksheet(translate(name).replace(/[\\/?*[\]:]/g, " ").slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    if (!keys.length) { sheet.addRow([translate("조회 조건에 해당하는 자료가 없습니다.")]); continue; }
    sheet.columns = keys.map(key => ({ header: translate(key), key, width: translate(key).length > 14 ? 34 : 22 }));
    // Values stay explicit strings/numbers; user text is never assigned as an Excel formula.
    rows.forEach(row => sheet.addRow(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, localizeDetailValue(key, value, translate)]))));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1,rows.length+1), column: keys.length } };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF265D4B" } };
    sheet.getRow(1).height = 36;
    sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
  }
  return workbook;
}
