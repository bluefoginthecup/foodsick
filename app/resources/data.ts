export const resourceTypes = ["논문·연구", "공식 기관·사이트", "통계·데이터", "예방·증상 안내"] as const;

export type Resource = {
  id: string;
  type: (typeof resourceTypes)[number];
  title: string;
  originalTitle?: string;
  source: string;
  language: "한국어" | "영어";
  year?: string;
  description: string;
  takeaway: string;
  url: string;
  tags: string[];
};

// Original publisher pages reviewed on this date; this is not a live link monitor.
export const resourcesReviewedAt = "2026-10-02";
export const resources: Resource[] = [
  {
    id: "crowdsourced-surveillance", type: "논문·연구",
    title: "시민의 식중독 의심 신고가 감시에 도움이 될까요?",
    originalTitle: "A Platform for Crowdsourced Foodborne Illness Surveillance: Description of Users and Reports",
    source: "Quade & Nsoesie · JMIR Public Health and Surveillance", language: "영어", year: "2017",
    description: "Iwaspoisoned.com의 이용자와 신고 자료를 분석하고, 공식 확인에 앞서 신고가 접수된 사례를 소개한 연구입니다.",
    takeaway: "나두아파의 시민 참여 방식을 이해할 때 유용해요. 자발적 신고에는 참여 편향이 있으며, 이 연구가 나두아파의 정확도를 검증한 것은 아닙니다.",
    url: "https://publichealth.jmir.org/2017/3/e42/", tags: ["시민 참여", "조기 신호", "자가 신고"],
  },
  {
    id: "online-reviews", type: "논문·연구",
    title: "온라인 리뷰에서 미신고 식중독 사례를 찾은 연구",
    originalTitle: "Using Online Reviews by Restaurant Patrons to Identify Unreported Cases of Foodborne Illness — New York City, 2012–2013",
    source: "CDC · MMWR 63(20):441–445", language: "영어", year: "2014",
    description: "뉴욕시가 음식점 리뷰를 선별하고 후속 면담을 통해 기존에 신고되지 않은 집단 발생을 찾아낸 사례입니다.",
    takeaway: "온라인 증상 기록이 보건당국 조사로 이어지는 과정을 볼 수 있어요. 리뷰만으로 원인을 확정하지 않았으며, 추가 조사에 시간과 인력이 필요했습니다.",
    url: "https://www.cdc.gov/mmwr/preview/mmwrhtml/mm6320a1.htm", tags: ["온라인 리뷰", "역학조사", "조기 신호"],
  },
  {
    id: "who-food-safety", type: "공식 기관·사이트", title: "WHO 식품안전 한눈에 보기",
    source: "세계보건기구 · WHO", language: "영어",
    description: "식품 매개 질환의 주요 원인과 공중보건에 미치는 영향, 식품안전을 위한 국제적 대응을 설명합니다.",
    takeaway: "식중독을 개인의 경험과 지역사회의 건강 문제라는 두 관점에서 이해하는 출발점이에요.",
    url: "https://www.who.int/news-room/fact-sheets/food-safety", tags: ["식품안전", "기초 정보"],
  },
  {
    id: "cdc-nors", type: "공식 기관·사이트", title: "CDC 집단 발생 보고체계 NORS",
    source: "미국 질병통제예방센터 · CDC", language: "영어",
    description: "미국 보건기관이 식품·물 등을 통한 집단 발생 정보를 보고하는 국가 보고체계를 소개합니다.",
    takeaway: "시민의 증상 신고와 보건기관의 공식 집단 발생 보고가 어떻게 다른지 이해할 수 있어요. 일반 이용자가 직접 신고하는 창구는 아닙니다.",
    url: "https://www.cdc.gov/nors/about/index.html", tags: ["공식 보고", "역학조사", "미국"],
  },
  {
    id: "korea-statistics", type: "통계·데이터", title: "국내 식중독 발생 통계",
    source: "식품의약품안전처 · 식품안전나라", language: "한국어",
    description: "월별·연도별·지역별·원인시설별·원인물질별 식중독 통계와 교차 통계를 확인할 수 있습니다.",
    takeaway: "국내 발생 흐름을 살펴볼 때 유용해요. 신고·잠정·확정 통계를 구분하고, 나두아파의 증상 신고 수와 단순 비교하지 마세요.",
    url: "https://www.foodsafetykorea.go.kr/portal/healthyfoodlife/foodPoisoningStat.do?menu_no=519&menu_grp=MENU_GRP02", tags: ["국내 통계", "지역별", "원인균"],
  },
  {
    id: "five-keys", type: "예방·증상 안내", title: "안전한 식품을 위한 다섯 가지 원칙",
    source: "세계보건기구 · WHO", language: "영어", year: "2006",
    description: "청결 유지, 날것과 익힌 음식 분리, 충분한 가열, 안전한 온도 유지, 안전한 물과 식재료 사용을 설명한 교육 자료입니다.",
    takeaway: "가정과 조리 현장에서 식품안전 습관을 점검하거나 예방 교육 자료를 찾을 때 참고하세요.",
    url: "https://www.who.int/publications/i/item/9789241594639", tags: ["예방", "조리", "교육 자료"],
  },
  {
    id: "cdc-symptoms", type: "예방·증상 안내", title: "식중독 증상과 진료가 필요한 신호",
    source: "미국 질병통제예방센터 · CDC", language: "영어",
    description: "흔한 식중독 증상, 주요 원인별 증상 시작 시점, 의료진에게 도움을 구해야 하는 증상을 안내합니다.",
    takeaway: "증상 기록에 참고하되, 증상이나 식사 후 경과 시간만으로 원인 음식·병원체를 판단하지 마세요.",
    url: "https://www.cdc.gov/food-safety/signs-symptoms/index.html", tags: ["증상", "잠복기", "진료"],
  },
];
