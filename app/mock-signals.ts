import type { FoodCategory } from "./contracts";

export type PublicSignal = {
  id: string;
  region: string;
  sido: string;
  city: string;
  district: string;
  dong: string;
  category: FoodCategory;
  observedAt: string;
  independentReports: number;
  companionSymptoms: number;
  medicalVisits: number;
  trend: "steady" | "increased";
  privacyLevel: "dong" | "gu" | "city";
  privacyPolicyVersion: "privacy-v1";
  regionAdjusted: boolean;
};

export const SIGNAL_DATA_START = "2025-08-13";
export const SIGNAL_DATA_END = "2026-08-13";

export const publicSignals: PublicSignal[] = [
  {
    id: "signal-yongin-naengmyeon",
    region: "경기도 용인시 기흥구 영덕1동",
    sido: "경기도",
    city: "용인시",
    district: "기흥구",
    dong: "영덕1동",
    category: "냉면",
    observedAt: "2026-08-12",
    independentReports: 4,
    companionSymptoms: 7,
    medicalVisits: 2,
    trend: "increased",
    privacyLevel: "dong",
    privacyPolicyVersion: "privacy-v1",
    regionAdjusted: false,
  },
  {
    id: "signal-suwon-korean",
    region: "경기도 수원시 영통구",
    sido: "경기도",
    city: "수원시",
    district: "영통구",
    dong: "",
    category: "한식",
    observedAt: "2026-07-04",
    independentReports: 3,
    companionSymptoms: 2,
    medicalVisits: 1,
    trend: "increased",
    privacyLevel: "gu",
    privacyPolicyVersion: "privacy-v1",
    regionAdjusted: true,
  },
  {
    id: "signal-seongnam-delivery",
    region: "경기도 성남시 분당구",
    sido: "경기도",
    city: "성남시",
    district: "분당구",
    dong: "",
    category: "배달음식",
    observedAt: "2026-04-19",
    independentReports: 3,
    companionSymptoms: 1,
    medicalVisits: 0,
    trend: "steady",
    privacyLevel: "gu",
    privacyPolicyVersion: "privacy-v1",
    regionAdjusted: true,
  },
  {
    id: "signal-yongin-sushi",
    region: "경기도 용인시 수지구 죽전동",
    sido: "경기도",
    city: "용인시",
    district: "수지구",
    dong: "죽전동",
    category: "회/초밥",
    observedAt: "2026-01-16",
    independentReports: 5,
    companionSymptoms: 3,
    medicalVisits: 2,
    trend: "increased",
    privacyLevel: "dong",
    privacyPolicyVersion: "privacy-v1",
    regionAdjusted: false,
  },
  {
    id: "signal-suwon-cafe",
    region: "경기도 수원시 팔달구",
    sido: "경기도",
    city: "수원시",
    district: "팔달구",
    dong: "",
    category: "카페/디저트",
    observedAt: "2025-11-08",
    independentReports: 3,
    companionSymptoms: 2,
    medicalVisits: 0,
    trend: "steady",
    privacyLevel: "gu",
    privacyPolicyVersion: "privacy-v1",
    regionAdjusted: true,
  },
  {
    id: "signal-seongnam-chinese",
    region: "경기도 성남시 수정구",
    sido: "경기도",
    city: "성남시",
    district: "수정구",
    dong: "",
    category: "중식",
    observedAt: "2025-09-02",
    independentReports: 4,
    companionSymptoms: 4,
    medicalVisits: 1,
    trend: "steady",
    privacyLevel: "gu",
    privacyPolicyVersion: "privacy-v1",
    regionAdjusted: true,
  },
];
