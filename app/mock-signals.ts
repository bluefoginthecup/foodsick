import type { FoodCategory } from "./contracts";

export type PublicSignal = {
  id: string;
  region: string;
  broaderRegion: string;
  category: FoodCategory;
  windowHours: 24 | 72;
  independentReports: number;
  companionSymptoms: number;
  medicalVisits: number;
  position: { x: number; y: number };
  trend: "steady" | "increased";
  privacyLevel: "dong" | "gu" | "city";
};

export const publicSignals: PublicSignal[] = [
  {
    id: "signal-yongin-naengmyeon",
    region: "용인시 기흥구 영덕동",
    broaderRegion: "경기도 용인시",
    category: "냉면",
    windowHours: 72,
    independentReports: 4,
    companionSymptoms: 7,
    medicalVisits: 2,
    position: { x: 62, y: 42 },
    trend: "increased",
    privacyLevel: "dong",
  },
  {
    id: "signal-suwon-korean",
    region: "수원시 영통구",
    broaderRegion: "경기도 수원시",
    category: "한식",
    windowHours: 72,
    independentReports: 3,
    companionSymptoms: 2,
    medicalVisits: 1,
    position: { x: 35, y: 62 },
    trend: "increased",
    privacyLevel: "gu",
  },
  {
    id: "signal-seongnam-delivery",
    region: "성남시 분당구",
    broaderRegion: "경기도 성남시",
    category: "배달음식",
    windowHours: 24,
    independentReports: 2,
    companionSymptoms: 1,
    medicalVisits: 0,
    position: { x: 46, y: 25 },
    trend: "steady",
    privacyLevel: "gu",
  },
];
