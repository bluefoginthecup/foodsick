export type RegionalContact = {
  kind: "food_safety" | "health_center" | "district_office" | "city_office";
  label: string;
  name: string;
  phone: string;
  description: string;
  sourceUrl: string;
};

type RegionalContactDirectory = {
  regionIncludes: string;
  verifiedAt: string;
  contacts: RegionalContact[];
};

const directories: RegionalContactDirectory[] = [
  {
    regionIncludes: "용인시 기흥구",
    verifiedAt: "2026-08-13",
    contacts: [
      {
        kind: "food_safety",
        label: "식품위생 담당",
        name: "기흥구청 산업환경과 위생지도",
        phone: "031-6193-6303",
        description: "식중독 예방·관리, 위생업소 지도·점검",
        sourceUrl: "https://www.yongin.go.kr/common/orgcht/BD_iframeGuOrgList.do?q_deptCode=5630018000000000000&q_deptNm=",
      },
      {
        kind: "health_center",
        label: "관할 보건소",
        name: "기흥구보건소 민원접수",
        phone: "031-6193-0269",
        description: "보건소 민원 및 건강진단 안내",
        sourceUrl: "https://www.yongin.go.kr/common/orgcht/BD_selectOrgList.do?q_domainCode=8&q_gbn=gh",
      },
      {
        kind: "district_office",
        label: "관할 구청",
        name: "기흥구청 민원 연결",
        phone: "031-6193-6221",
        description: "구청 업무 안내 및 담당부서 연결",
        sourceUrl: "https://www.yongin.go.kr/event/2026_seolnal/",
      },
      {
        kind: "city_office",
        label: "관할 시청",
        name: "용인특례시 민원상담 콜센터",
        phone: "1577-1122",
        description: "평일 08:30–18:00, 주말·공휴일 09:00–18:00",
        sourceUrl: "https://www.yongin.go.kr/home/cvIf/cvIfTotal/cvIfTotal12.jsp",
      },
    ],
  },
];

export function contactsForRegion(region: string) {
  return directories.find((directory) => region.includes(directory.regionIncludes)) ?? null;
}

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
