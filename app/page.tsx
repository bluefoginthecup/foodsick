import Home from "./home-client";
import { publicPageMetadata, publicSiteUrl } from "./seo";

export const metadata = {
  ...publicPageMetadata("/", "나두아파 | 식중독 의심 증상 지도·신고 안내", "식중독이 의심되는 외식 후 증상을 기록하고 지역별 신고 신호를 살펴보세요. 나두아파는 음식점 이름을 공개하지 않는 시민 참여 지도입니다."),
  verification: { other: { "naver-site-verification": "63e047b6abc8c3b24c71d8bf06dfaf92c3941567" } },
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": publicSiteUrl + "/#website",
  url: publicSiteUrl + "/",
  name: "나두아파",
  alternateName: "nadooapa",
  inLanguage: "ko-KR",
  description: "식중독이 의심되는 외식 후 증상을 기록하고 지역별 신고 신호를 살펴보세요. 나두아파는 음식점 이름을 공개하지 않는 시민 참여 지도입니다.",
};

export default function Page() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, "\\u003c") }} /><Home /></>;
}
