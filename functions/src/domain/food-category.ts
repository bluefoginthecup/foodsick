export function kakaoFoodCategory(categoryName: string, placeName = "") {
  const value = `${categoryName} ${placeName}`;
  if (/냉면/.test(value)) return "냉면";
  if (/초밥|스시|횟집|생선회/.test(value)) return "회/초밥";
  if (/중식|중화요리|짜장|짬뽕/.test(value)) return "중식";
  if (/일식|일본식/.test(value)) return "일식";
  if (/양식|이탈리안|프렌치/.test(value)) return "양식";
  if (/분식|떡볶이|김밥/.test(value)) return "분식";
  if (/갈비|고기|육류|삼겹살|곱창|구이/.test(value)) return "고기/구이";
  if (/해산물|조개|게요리|복어요리/.test(value)) return "해산물/조개";
  if (/국밥|감자탕|설렁탕|곰탕|찌개|전골/.test(value)) return "국/탕/찌개";
  if (/국수|면요리|라멘|우동|소바/.test(value)) return "면요리";
  if (/치킨|닭강정/.test(value)) return "치킨";
  if (/피자/.test(value)) return "피자";
  if (/햄버거|패스트푸드/.test(value)) return "햄버거/패스트푸드";
  if (/베트남|태국|동남아|아시아음식/.test(value)) return "동남아/아시아";
  if (/인도|중동|터키/.test(value)) return "인도/중동";
  if (/샐러드|건강식|비건|채식/.test(value)) return "샐러드/건강식";
  if (/뷔페/.test(value)) return "뷔페";
  if (/카페|디저트|아이스크림|빙수/.test(value)) return "카페/디저트";
  if (/베이커리|제과|빵|떡카페|떡집/.test(value)) return "베이커리/떡";
  if (/편의점|대형마트|슈퍼마켓/.test(value)) return "편의점/마트 조리식품";
  if (/구내식당|급식/.test(value)) return "급식/구내식당";
  if (/도시락/.test(value)) return "도시락";
  if (/주점|호프|술집|이자카야/.test(value)) return "주점/안주";
  if (/배달/.test(value)) return "배달음식";
  if (/한식/.test(value)) return "한식";
  return "기타";
}


