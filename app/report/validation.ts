import type { ReportDraft } from "../contracts";

export type ReportIssue = { field: string; step: number; message: string };

export function validateReportDraft(draft: ReportDraft, consented: boolean): ReportIssue[] {
  const errors: ReportIssue[] = [];
  const add = (field: string, step: number, message: string) => errors.push({ field, step, message });
  const required: Array<[keyof ReportDraft, number, string]> = [
    ["mealDate", 0, "식사 날짜를 입력해주세요."], ["mealTime", 0, "식사 시간을 입력해주세요."],
    ["province", 0, "시/도를 선택해주세요."], ["city", 0, "시/군/구를 선택해주세요."], ["district", 0, "읍/면/동을 선택해주세요."],
    ["foodCategory", 0, "음식 유형을 선택해주세요."], ["serviceMode", 0, "매장·배달·포장 중 이용 방식을 선택해주세요."],
    ["onsetDate", 1, "최초 증상 날짜를 입력해주세요."], ["onsetTime", 1, "최초 증상 시간을 입력해주세요."],
  ];
  for (const [field, step, message] of required) if (!String(draft[field]).trim()) add(field, step, message);
  if (!draft.restaurantInternalId || !draft.restaurantDisplayInput.trim()) add("restaurantInternalId", 0, "음식점을 검색한 뒤 결과에서 선택해주세요.");
  if (draft.foodCategory === "기타" && !draft.foodCategoryDetail.trim()) add("foodCategoryDetail", 0, "기타 음식 유형을 입력해주세요.");
  if (!draft.symptoms.length) add("symptoms", 1, "해당하는 증상을 하나 이상 선택해주세요.");
  const meal = Date.parse(`${draft.mealDate}T${draft.mealTime}:00+09:00`);
  const onset = Date.parse(`${draft.onsetDate}T${draft.onsetTime}:00+09:00`);
  if (draft.mealDate && draft.mealTime && !Number.isFinite(meal)) add("mealDate", 0, "식사 날짜와 시간을 확인해주세요.");
  if (draft.onsetDate && draft.onsetTime) {
    if (!Number.isFinite(onset)) add("onsetDate", 1, "최초 증상 날짜와 시간을 확인해주세요.");
    else if (Number.isFinite(meal) && (onset < meal || onset - meal > 30 * 86400_000)) add("onsetDate", 1, "증상 시작은 식사 이후 30일 이내로 입력해주세요.");
  }
  if (!Number.isInteger(draft.diarrheaCount) || draft.diarrheaCount < 0 || draft.diarrheaCount > 50) add("diarrheaCount", 1, "설사 횟수는 0~50 사이의 정수로 입력해주세요.");
  if (!Number.isInteger(draft.partyTotal) || draft.partyTotal < 1 || draft.partyTotal > 100) add("partyTotal", 2, "총 인원은 1~100명으로 입력해주세요.");
  if (!Number.isInteger(draft.partySymptomatic) || draft.partySymptomatic < 0 || draft.partySymptomatic >= draft.partyTotal) add("partySymptomatic", 2, "동행 증상자 수는 본인을 제외한 인원 안에서 입력해주세요.");
  for (const [index, companion] of draft.companions.entries()) {
    if (companion.age !== "" && (!Number.isInteger(companion.age) || companion.age < 0 || companion.age > 120)) add(`companion-age-${index}`, 2, `동행자 ${index + 1}의 나이는 0~120 사이의 정수로 입력해주세요.`);
  }
  if (!consented) add("consent", 3, "건강정보 처리 동의를 확인해주세요.");
  return errors;
}

export function reportFieldId(field: string) {
  return field === "restaurantInternalId" ? "restaurant-query" : `report-${field}`;
}

export function serverReportIssue(field: string): ReportIssue | null {
  const aliases: Record<string, string> = { mealAt: "mealDate", symptomOnsetAt: "onsetDate", sensitiveDataConsentVersion: "consent", restaurantDisplayInput: "restaurantInternalId" };
  const normalized = aliases[field] ?? field;
  const labels: Record<string, [number, string]> = {
    mealDate: [0, "식사 날짜"], mealTime: [0, "식사 시간"], province: [0, "시/도"], city: [0, "시/군/구"], district: [0, "읍/면/동"],
    restaurantInternalId: [0, "음식점 선택"], foodCategory: [0, "음식 유형"], foodCategoryDetail: [0, "기타 음식 유형"], menu: [0, "먹은 메뉴"], serviceMode: [0, "이용 방식"],
    symptoms: [1, "증상"], onsetDate: [1, "최초 증상 날짜"], onsetTime: [1, "최초 증상 시간"], diarrheaCount: [1, "설사 횟수"], otherSymptom: [1, "기타 증상"],
    partyTotal: [2, "총 인원"], partySymptomatic: [2, "동행 증상자 수"], consent: [3, "건강정보 처리 동의"],
  };
  const entry = labels[normalized];
  return entry ? { field: normalized, step: entry[0], message: `${entry[1]} 항목을 다시 확인해주세요.` } : null;
}
