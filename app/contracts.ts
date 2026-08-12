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
  "분식",
  "카페/디저트",
  "배달음식",
  "기타",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ClusterStatus = (typeof CLUSTER_STATUSES)[number];
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

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
  menu: string;
  serviceMode: "dine_in" | "delivery" | "takeout" | "";
  symptoms: string[];
  diarrheaCount: number;
  otherSymptom: string;
  onsetDate: string;
  onsetTime: string;
  partyTotal: number;
  partySymptomatic: number;
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
