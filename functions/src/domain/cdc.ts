// Korean adaptation of NHGQ (February 2025). This is not a CDC submission.
export const answers = { yes: "예", maybe: "그럴 수도 있음", no: "아니요", unknown: "모름", declined: "응답하지 않음" } as const;
export const symptoms = ["설사", "구토", "복통", "발열", "오한", "혈변", "두통", "근육통", "기타"];
export type Field = { key: string; label: string; type: "text" | "date" | "time" | "number" | "answer" | "select"; options?: Record<string, string>; max?: number };
export const basicFields: Field[] = [
  { key: "onsetPrecision", label: "증상 시작 시점", type: "select", options: { exact: "날짜와 시간을 알아요", approximate: "날짜만 알거나 대략 알아요", unknown: "기억나지 않아요" } },
  { key: "onsetDate", label: "증상 시작일", type: "date" }, { key: "onsetTime", label: "증상 시작 시간", type: "time" },
  { key: "otherSymptom", label: "기타 증상", type: "text" },
  { key: "suspectedMeal", label: "관련이 의심되는 식사가 있나요?", type: "select", options: { yes: "있어요", unknown: "어떤 식사인지 모르겠어요" } },
  { key: "source", label: "의심되는 식사의 종류", type: "select", options: { restaurant: "음식점", delivery: "배달·포장", home: "가정식", cafeteria: "학교·직장 급식", product: "구입한 식품", event: "행사·모임", other: "기타", unknown: "모름" } },
  { key: "mealDate", label: "의심되는 식사일", type: "date" }, { key: "mealTime", label: "식사 시간", type: "time" },
  { key: "place", label: "음식점·구입처 이름", type: "text" }, { key: "address", label: "주소·지역", type: "text" }, { key: "menu", label: "먹은 음식", type: "text" },
  { key: "partyTotal", label: "함께 먹은 전체 인원 (본인 포함, 모르면 비워두기)", type: "number", max: 10000 },
  { key: "partySick", label: "그중 증상이 있는 인원 (본인 포함, 모르면 비워두기)", type: "number", max: 10000 },
  { key: "medical", label: "의료기관에 방문했나요?", type: "answer" }, { key: "hospitalized", label: "하룻밤 이상 입원했나요?", type: "answer" }, { key: "tested", label: "대변 등 검체 검사를 받았나요?", type: "answer" },
];
export const detailGroups: { title: string; help: string; fields: Field[] }[] = [
  { title: "증상 경과", help: "기억하는 항목만 작성하세요. 횟수는 가장 심했던 24시간을 기준으로 적어주세요.", fields: [
    { key: "age", label: "증상 당시 나이 (만 나이)", type: "number", max: 120 },
    { key: "ongoing", label: "현재도 증상이 있나요?", type: "answer" },
    { key: "endDate", label: "증상이 끝난 날짜", type: "date" }, { key: "endTime", label: "증상이 끝난 시간", type: "time" },
    { key: "looseStool", label: "24시간 동안 묽은 변을 3회 이상 보았나요?", type: "answer" },
    { key: "diarrheaCount", label: "24시간 내 설사 횟수", type: "number", max: 100 }, { key: "vomitCount", label: "24시간 내 구토 횟수", type: "number", max: 100 },
    { key: "temperature", label: "측정한 최고 체온 (예: 38.2°C)", type: "text" },
  ] },
  { title: "동행자·접촉·여행", help: "증상 시작 전 7일을 우선 떠올려주세요. 필요한 조사 기간은 원인에 따라 달라집니다. 다른 사람의 이름·연락처는 적지 마세요.", fields: [
    { key: "wellCompanions", label: "같이 먹었지만 아프지 않은 사람이 있나요?", type: "answer" },
    { key: "companionNotes", label: "동행자의 증상·시작 시점·먹은 음식 차이", type: "text" },
    { key: "illContact", label: "설사·구토를 하는 사람과 접촉했나요?", type: "answer" }, { key: "contactNotes", label: "접촉 시기와 상황", type: "text" },
    { key: "travel", label: "평소 생활지역 밖으로 여행했나요?", type: "answer" }, { key: "travelNotes", label: "여행 지역·기간", type: "text" },
    { key: "animals", label: "동물이나 동물의 생활환경과 접촉했나요?", type: "answer" }, { key: "animalNotes", label: "동물 종류·접촉 장소·시기", type: "text" },
    { key: "gathering", label: "행사·단체 식사에 참여했나요?", type: "answer" }, { key: "gatheringNotes", label: "행사·식사 장소·날짜", type: "text" },
  ] },
  { title: "진료·검사", help: "검사 여부와 검사 결과는 구분해서 기록합니다. 진단서나 주민등록번호는 입력하지 마세요.", fields: [
    { key: "visitDate", label: "진료일", type: "date" }, { key: "sampleDate", label: "검체 채취일", type: "date" },
    { key: "resultStatus", label: "검사 결과 상태", type: "select", options: { pending: "결과 대기 중", known: "결과를 받았어요", unknown: "모름", not_tested: "검사하지 않음", declined: "응답하지 않음" } },
    { key: "resultNotes", label: "전달받은 검사 결과·병원체 이름", type: "text" }, { key: "notes", label: "추가로 알리고 싶은 내용", type: "text" },
  ] },
];
export const mealFields: Field[] = [
  { key: "date", label: "날짜 (기억나지 않으면 비워두기)", type: "date" }, { key: "time", label: "시간", type: "time" },
  { key: "place", label: "식사 장소·구입처", type: "text" }, { key: "foods", label: "먹은 음식·음료", type: "text" },
  { key: "brand", label: "제품명·브랜드", type: "text" }, { key: "preparation", label: "조리 상태", type: "select", options: { raw: "날것", undercooked: "덜 익힘", cooked: "익힘", unknown: "모름" } },
  { key: "notes", label: "그 밖에 기억나는 내용", type: "text" },
];
export type CdcDraft = { symptoms: string[]; basic: Record<string, string>; detail: Record<string, string>; meals: Record<string, string>[]; consent: boolean };
export type CdcIssue = { field: string; message: string };
export const emptyCdcDraft = (): CdcDraft => ({ symptoms: [], basic: {}, detail: {}, meals: [], consent: false });
export function validateCdcDraft(input: unknown): { draft: CdcDraft; issues: CdcIssue[] } {
  const issues: CdcIssue[] = [];
  const draft = emptyCdcDraft();
  const issue = (field: string, message: string) => issues.push({ field, message });
  if (!input || typeof input !== "object" || Array.isArray(input)) return { draft, issues: [{ field: "symptoms", message: "신고 내용을 확인해주세요." }] };
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.symptoms) || !value.symptoms.length || value.symptoms.some(s => !symptoms.includes(s as string)) || value.symptoms.length > symptoms.length) issue("symptoms", "증상을 하나 이상 선택해주세요.");
  else draft.symptoms = [...new Set(value.symptoms as string[])];
  const parse = (raw: unknown, fields: Field[], prefix: string) => {
    const result: Record<string, string> = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { issue(prefix, "입력 형식을 확인해주세요."); return result; }
    for (const field of fields) {
      const v = (raw as Record<string, unknown>)[field.key];
      if (v === undefined || v === "") continue;
      const key = `${prefix}.${field.key}`;
      if (typeof v !== "string" || v.length > 1000) { issue(key, `${field.label}: 1,000자 이내로 입력해주세요.`); continue; }
      const text = v.trim();
      result[field.key] = text;
      const options = field.type === "answer" ? answers : field.options;
      if (options && !Object.hasOwn(options, text)) issue(key, `${field.label}: 목록에서 선택해주세요.`);
      if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text || text > new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10))) issue(key, `${field.label}: 오늘까지의 올바른 날짜를 입력해주세요.`);
      if (field.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) issue(key, `${field.label}: 시간을 확인해주세요.`);
      if (field.type === "number" && (!/^\d+$/.test(text) || Number(text) > (field.max ?? 10000))) issue(key, `${field.label}: 0~${field.max ?? 10000}의 정수를 입력해주세요.`);
    }
    return result;
  };
  draft.basic = parse(value.basic, basicFields, "basic");
  draft.detail = parse(value.detail, detailGroups.flatMap(g => g.fields), "detail");
  if (!Array.isArray(value.meals) || value.meals.length > 30) issue("meals", "식사 기록은 최대 30개까지 추가할 수 있습니다.");
  else draft.meals = value.meals.map((meal, i) => parse(meal, mealFields, `meals.${i}`));
  const b = draft.basic;
  for (const key of ["onsetPrecision", "suspectedMeal", "medical", "hospitalized", "tested"]) if (!b[key]) issue(`basic.${key}`, `${basicFields.find(f => f.key === key)!.label}: 선택해주세요. 모름도 선택할 수 있습니다.`);
  if (b.onsetPrecision !== "unknown" && !b.onsetDate) issue("basic.onsetDate", "증상 시작일을 입력하거나 ‘기억나지 않아요’를 선택해주세요.");
  if (b.onsetPrecision === "exact" && !b.onsetTime) issue("basic.onsetTime", "시작 시간을 입력하거나 ‘날짜만 알거나 대략 알아요’를 선택해주세요.");
  if (draft.symptoms.includes("기타") && !b.otherSymptom) issue("basic.otherSymptom", "기타 증상을 적어주세요.");
  if (b.suspectedMeal === "yes" && !b.source) issue("basic.source", "의심되는 식사의 종류를 선택해주세요.");
  if (b.partyTotal && Number(b.partyTotal) < 1) issue("basic.partyTotal", "본인을 포함한 인원은 1명 이상입니다.");
  if (b.partySick && Number(b.partySick) < 1) issue("basic.partySick", "본인을 포함한 증상자는 1명 이상입니다.");
  if (b.partyTotal && b.partySick && Number(b.partySick) > Number(b.partyTotal)) issue("basic.partySick", "증상 인원은 전체 인원을 넘을 수 없습니다.");
  if (b.onsetDate && draft.detail.endDate && draft.detail.endDate < b.onsetDate) issue("detail.endDate", "증상 종료일은 시작일 이후여야 합니다.");
  if (b.onsetDate && b.mealDate && b.mealDate > b.onsetDate) issue("basic.mealDate", "의심되는 식사일은 증상 시작일 이전 또는 같은 날이어야 합니다.");
  draft.consent = value.consent === true;
  if (!draft.consent) issue("consent", "건강정보 수집·이용 동의가 필요합니다.");
  return { draft, issues };
}
