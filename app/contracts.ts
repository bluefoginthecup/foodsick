export const REPORT_STATUSES = [
  "submitted",
  "duplicate_suspected",
  "reviewed",
  "included_in_cluster",
  "rejected",
] as const;

export const CLUSTER_STATUSES = [
  "monitoring",
  "increased_signal",
  "reviewed",
  "official_confirmed",
  "closed",
] as const;

export const FOOD_CATEGORIES = [
  "냉면",
  "한식",
  "회/초밥",
  "중식",
  "일식",
  "양식",
  "분식",
  "고기/구이",
  "해산물/조개",
  "국/탕/찌개",
  "면요리",
  "치킨",
  "피자",
  "햄버거/패스트푸드",
  "동남아/아시아",
  "인도/중동",
  "샐러드/건강식",
  "뷔페",
  "카페/디저트",
  "베이커리/떡",
  "배달음식",
  "편의점/마트 조리식품",
  "급식/구내식당",
  "도시락",
  "주점/안주",
  "기타",
] as const;

export const COMPANION_GENDERS = ["female", "male", "other", "undisclosed"] as const;
export const UNDERLYING_CONDITIONS = [
  "없음",
  "당뇨병",
  "심혈관질환/고혈압",
  "신장질환",
  "간질환",
  "호흡기질환",
  "면역저하",
  "임신",
  "암 치료 중",
  "기타",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ClusterStatus = (typeof CLUSTER_STATUSES)[number];
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];
export type CompanionGender = (typeof COMPANION_GENDERS)[number];
export type UnderlyingCondition = (typeof UNDERLYING_CONDITIONS)[number];

export type CompanionDraft = {
  age: number | "";
  gender: CompanionGender | "";
  symptoms: string[];
  otherSymptom: string;
  onsetAt: string;
  medicalVisit: boolean;
  tested: boolean;
  underlyingConditions: UnderlyingCondition[];
  otherUnderlyingCondition: string;
};

export type IdentityState = {
  identityVerified: boolean;
  identityProvider: "pass" | "nice" | null;
  identityKey: string | null;
};

export type ReportDraft = {
  mealDate: string;
  mealTime: string;
  province: string;
  city: string;
  district: string;
  restaurantInternalId: string;
  restaurantDisplayInput: string;
  foodCategory: FoodCategory | "";
  foodCategoryDetail: string;
  menu: string;
  serviceMode: "dine_in" | "delivery" | "takeout" | "";
  symptoms: string[];
  diarrheaCount: number;
  otherSymptom: string;
  onsetDate: string;
  onsetTime: string;
  partyTotal: number;
  partySymptomatic: number;
  companions: CompanionDraft[];
  companionSymptoms: string[];
  companionOnsetAt: string;
  companionMedicalVisit: boolean;
  companionTested: boolean;
  medicalVisit: boolean;
  hospitalized: boolean;
  tested: boolean;
  pathogenKnown: boolean;
  pathogenType: string;
};
