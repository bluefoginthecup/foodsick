export const FOOD_CATEGORIES = [
  "냉면", "한식", "회/초밥", "중식", "일식", "양식", "분식", "고기/구이", "해산물/조개",
  "국/탕/찌개", "면요리", "치킨", "피자", "햄버거/패스트푸드", "동남아/아시아", "인도/중동",
  "샐러드/건강식", "뷔페", "카페/디저트", "베이커리/떡", "배달음식", "편의점/마트 조리식품",
  "급식/구내식당", "도시락", "주점/안주", "기타",
] as const;

export const SYMPTOMS = ["설사", "구토", "복통", "발열", "오한", "혈변", "두통", "근육통"] as const;
export const SERVICE_MODES = ["dine_in", "delivery", "takeout"] as const;
export const COMPANION_GENDERS = ["female", "male", "other", "undisclosed"] as const;
export const UNDERLYING_CONDITIONS = [
  "없음", "당뇨병", "심혈관질환/고혈압", "신장질환", "간질환", "호흡기질환", "면역저하", "임신", "암 치료 중", "기타",
] as const;

export type CompanionInput = {
  age: number | "";
  gender: (typeof COMPANION_GENDERS)[number] | "";
  symptoms: string[];
  otherSymptom: string;
  onsetAt: string;
  medicalVisit: boolean;
  tested: boolean;
  underlyingConditions: string[];
  otherUnderlyingCondition: string;
};

export type ReportInput = {
  mealDate: string;
  mealTime: string;
  province: string;
  city: string;
  district: string;
  restaurantInternalId: string;
  restaurantDisplayInput: string;
  foodCategory: (typeof FOOD_CATEGORIES)[number];
  foodCategoryDetail: string;
  menu: string;
  serviceMode: (typeof SERVICE_MODES)[number];
  symptoms: string[];
  diarrheaCount: number;
  otherSymptom: string;
  onsetDate: string;
  onsetTime: string;
  partyTotal: number;
  partySymptomatic: number;
  companions: CompanionInput[];
  companionSymptoms: string[];
  companionOnsetAt: string;
  companionMedicalVisit: boolean;
  companionTested: boolean;
  medicalVisit: boolean;
  hospitalized: boolean;
  tested: boolean;
  pathogenKnown: boolean;
  pathogenType: string;
  sensitiveDataConsentVersion: string;
};

export type ValidatedReport = ReportInput & {
  mealAt: Date;
  symptomOnsetAt: Date;
  incubationMinutes: number;
};

export class InputError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "InputError";
    this.field = field;
  }
}

function requiredString(record: Record<string, unknown>, field: string, maxLength: number) {
  const value = record[field];
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new InputError(field, `${field} 값이 올바르지 않습니다.`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, field: string, maxLength: number) {
  const value = record[field];
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > maxLength) throw new InputError(field, `${field} 값이 너무 깁니다.`);
  return value.trim();
}

function booleanValue(record: Record<string, unknown>, field: string) {
  if (typeof record[field] !== "boolean") throw new InputError(field, `${field} 값이 필요합니다.`);
  return record[field] as boolean;
}

function boundedInteger(record: Record<string, unknown>, field: string, minimum: number, maximum: number) {
  const value = record[field];
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new InputError(field, `${field} 범위를 확인해주세요.`);
  }
  return value as number;
}

function stringList(record: Record<string, unknown>, field: string, allowed: readonly string[], required: boolean) {
  const value = record[field];
  if (!Array.isArray(value) || (required && value.length === 0) || value.length > allowed.length) {
    throw new InputError(field, `${field} 선택값이 올바르지 않습니다.`);
  }
  const unique = [...new Set(value)];
  if (unique.some((item) => typeof item !== "string" || !allowed.includes(item))) {
    throw new InputError(field, `${field}에 허용되지 않은 값이 있습니다.`);
  }
  return unique as string[];
}

function companionList(value: unknown, expectedCount: number): CompanionInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length !== expectedCount || value.length > 99) {
    throw new InputError("companions", "동행 증상자 정보를 확인해주세요.");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new InputError(`companions.${index}`, "동행자 정보가 올바르지 않습니다.");
    }
    const companion = item as Record<string, unknown>;
    const ageValue = companion.age;
    const age = ageValue === "" || ageValue === undefined
      ? ""
      : boundedInteger(companion, "age", 0, 120);
    const gender = optionalString(companion, "gender", 20);
    if (gender && !COMPANION_GENDERS.includes(gender as (typeof COMPANION_GENDERS)[number])) {
      throw new InputError(`companions.${index}.gender`, "동행자 성별을 확인해주세요.");
    }
    return {
      age,
      gender: gender as CompanionInput["gender"],
      symptoms: stringList(companion, "symptoms", SYMPTOMS, false),
      otherSymptom: optionalString(companion, "otherSymptom", 300),
      onsetAt: optionalString(companion, "onsetAt", 30),
      medicalVisit: booleanValue(companion, "medicalVisit"),
      tested: booleanValue(companion, "tested"),
      underlyingConditions: stringList(companion, "underlyingConditions", UNDERLYING_CONDITIONS, false),
      otherUnderlyingCondition: optionalString(companion, "otherUnderlyingCondition", 100),
    };
  });
}

function parseKoreanDateTime(date: string, time: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new InputError(field, `${field} 형식이 올바르지 않습니다.`);
  const value = new Date(`${date}T${time}:00+09:00`);
  if (Number.isNaN(value.getTime())) throw new InputError(field, `${field}을 확인해주세요.`);
  return value;
}

export function validateReportInput(input: unknown): ValidatedReport {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InputError("report", "신고 데이터가 필요합니다.");
  const record = input as Record<string, unknown>;
  const mealDate = requiredString(record, "mealDate", 10);
  const mealTime = requiredString(record, "mealTime", 5);
  const onsetDate = requiredString(record, "onsetDate", 10);
  const onsetTime = requiredString(record, "onsetTime", 5);
  const mealAt = parseKoreanDateTime(mealDate, mealTime, "mealAt");
  const symptomOnsetAt = parseKoreanDateTime(onsetDate, onsetTime, "symptomOnsetAt");
  const incubationMinutes = Math.round((symptomOnsetAt.getTime() - mealAt.getTime()) / 60_000);
  if (incubationMinutes < 0 || incubationMinutes > 30 * 24 * 60) throw new InputError("symptomOnsetAt", "증상 시작시간을 확인해주세요.");

  const foodCategory = requiredString(record, "foodCategory", 20);
  if (!FOOD_CATEGORIES.includes(foodCategory as ReportInput["foodCategory"])) throw new InputError("foodCategory", "음식 유형을 확인해주세요.");
  const serviceMode = requiredString(record, "serviceMode", 20);
  if (!SERVICE_MODES.includes(serviceMode as ReportInput["serviceMode"])) throw new InputError("serviceMode", "이용 방식을 확인해주세요.");
  const partyTotal = boundedInteger(record, "partyTotal", 1, 100);
  const partySymptomatic = boundedInteger(record, "partySymptomatic", 0, 99);
  if (partySymptomatic > partyTotal - 1) throw new InputError("partySymptomatic", "동행 증상자 수가 전체 동행자 수보다 많습니다.");

  return {
    mealDate,
    mealTime,
    province: requiredString(record, "province", 30),
    city: requiredString(record, "city", 30),
    district: requiredString(record, "district", 40),
    restaurantInternalId: requiredString(record, "restaurantInternalId", 128),
    restaurantDisplayInput: requiredString(record, "restaurantDisplayInput", 120),
    foodCategory: foodCategory as ReportInput["foodCategory"],
    foodCategoryDetail: optionalString(record, "foodCategoryDetail", 50),
    menu: optionalString(record, "menu", 100),
    serviceMode: serviceMode as ReportInput["serviceMode"],
    symptoms: stringList(record, "symptoms", SYMPTOMS, true),
    diarrheaCount: boundedInteger(record, "diarrheaCount", 0, 50),
    otherSymptom: optionalString(record, "otherSymptom", 300),
    onsetDate,
    onsetTime,
    partyTotal,
    partySymptomatic,
    companions: companionList(record.companions, partySymptomatic),
    companionSymptoms: stringList(record, "companionSymptoms", SYMPTOMS, false),
    companionOnsetAt: optionalString(record, "companionOnsetAt", 30),
    companionMedicalVisit: booleanValue(record, "companionMedicalVisit"),
    companionTested: booleanValue(record, "companionTested"),
    medicalVisit: booleanValue(record, "medicalVisit"),
    hospitalized: booleanValue(record, "hospitalized"),
    tested: booleanValue(record, "tested"),
    pathogenKnown: booleanValue(record, "pathogenKnown"),
    pathogenType: optionalString(record, "pathogenType", 80),
    sensitiveDataConsentVersion: requiredString(record, "sensitiveDataConsentVersion", 40),
    mealAt,
    symptomOnsetAt,
    incubationMinutes,
  };
}
