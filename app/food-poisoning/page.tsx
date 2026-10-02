import { NativeLink } from "../native-link";
import { publicPageMetadata, publicSiteUrl } from "../seo";
import "./guide.css";

const title = "식중독 의심 증상·대처·신고 안내 | 나두아파";
const description = "외식 후 구토·설사 등 식중독이 의심될 때 확인할 증상, 진료가 필요한 상황, 공식 신고 창구와 기록할 내용을 안내합니다.";
export const metadata = publicPageMetadata("/food-poisoning", title, description);
const kdca = "https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5239";
const foodSafety = "https://www.foodsafetykorea.go.kr/portalmobile/poison/poisonMain.do";
const structured = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebPage", "@id": `${publicSiteUrl}/food-poisoning#page`, url: `${publicSiteUrl}/food-poisoning`, name: title, description, inLanguage: "ko-KR", isPartOf: { "@id": `${publicSiteUrl}/#website` }, dateModified: "2026-10-02", citation: [kdca, foodSafety] },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "나두아파", item: publicSiteUrl + "/" },
      { "@type": "ListItem", position: 2, name: "식중독 의심 시 안내", item: `${publicSiteUrl}/food-poisoning` },
    ] },
  ],
};

export default function FoodPoisoningGuide() {
  return <main className="app-shell food-guide" lang="ko">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    <nav aria-label="현재 위치"><NativeLink href="/">나두아파</NativeLink><span aria-hidden="true"> / </span>식중독 의심 시 안내</nav>
    <header className="hero">
      <p className="eyebrow">증상을 확인하고, 필요한 도움으로</p>
      <h1>식중독이 의심될 때<br />무엇부터 해야 할까요?</h1>
      <p className="hero-copy">외식 후 몸이 불편하다면 건강 상태를 먼저 살피고, 식사와 증상 발생 시점을 기록하세요. 공식 신고와 시민 증상 기록은 서로 다른 절차입니다.</p>
      <p className="guide-note">공공기관 자료를 바탕으로 정리한 일반 안내입니다. 의료진의 개별 진단을 대신하지 않으며, 증상만으로 원인 음식이나 업소를 확정할 수 없습니다.</p>
      <p className="guide-note">정리: 나두아파 · 자료 확인일: <time dateTime="2026-10-02">2026년 10월 2일</time></p>
    </header>
    <nav className="guide-toc" aria-label="이 페이지의 내용">
      <a href="#symptoms">증상과 진료</a><a href="#record">기록할 내용</a><a href="#reporting">어디에 신고하나요?</a><a href="#questions">자주 묻는 질문</a>
    </nav>
    <section id="symptoms">
      <h2>식중독 증상과 진료가 필요한 상황</h2>
      <p>식중독에서는 구토·설사 같은 소화기 증상이 나타날 수 있고, 원인에 따라 발열이 동반되기도 합니다. 증상이 나타나는 시점과 양상은 원인에 따라 달라집니다.</p>
      <p>구토로 물을 마시기 어렵거나 탈수가 심해 기운이 크게 떨어지면 의료기관의 진료가 필요합니다. 혈변이나 심한 발열이 있으면 의료진에게 알리세요. 설사가 심하다고 지사제를 임의로 복용하지 마세요.</p>
      <p className="guide-source">근거: <a href={kdca} target="_blank" rel="noopener noreferrer">질병관리청 국가건강정보포털 ‘식중독’</a></p>
    </section>
    <section id="record">
      <h2>진료·상담 전에 기록하면 좋은 내용</h2>
      <p>기억을 바탕으로 추측하기보다, 확인할 수 있는 사실과 모르는 내용을 구분해 정리하세요. 아래 항목은 식사와 증상의 흐름을 설명하기 위한 기록 도우미입니다.</p>
      <dl>
        <dt>식사 기록</dt><dd>먹은 날짜와 시간, 음식·메뉴, 동행 여부. 최근 여러 끼의 식사를 함께 적어두세요.</dd>
        <dt>증상 기록</dt><dd>처음 불편해진 시각, 구토·설사 등 증상과 변화, 진료·검사 여부.</dd>
        <dt>확인 가능한 자료</dt><dd>결제 내역·영수증, 식품 포장과 표시사항 사진, 진료 기록 등 원본 자료.</dd>
        <dt>함께 식사한 사람</dt><dd>동행자에게도 증상이 있었는지 확인하되, 타인의 개인정보를 공개 게시하지 마세요.</dd>
      </dl>
      <p><NativeLink href="/report">나두아파에 내 증상 기록하기</NativeLink> · <NativeLink href="/law-help#guide">피해 이후 대응 자료 보기</NativeLink></p>
    </section>
    <section id="reporting">
      <h2>식중독 의심 시 어디에 신고하나요?</h2>
      <div className="guide-options">
        <article><h3>공식 상담·신고</h3><p>공식 조사가 필요하다면 관할 보건소에 문의하고, 식품 관련 소비자 신고는 식품안전나라의 안내를 확인하세요. 식품안전나라에서 안내하는 소비자 신고 번호는 <a href="tel:1399">국번 없이 1399</a>입니다.</p><a href={foodSafety} target="_blank" rel="noopener noreferrer">식품안전나라 공식 안내 ↗</a></article>
        <article><h3>나두아파 시민 증상 기록</h3><p>나두아파는 지역별로 비슷한 증상 신고가 늘어나는지 살펴보는 시민 참여 서비스입니다. 음식점 이름과 정확한 위치를 공개하지 않으며, 이곳의 기록은 공공기관 공식 신고로 자동 접수되지 않습니다.</p><NativeLink href="/">지역 증상 신호 지도 보기</NativeLink></article>
      </div>
    </section>
    <section id="questions">
      <h2>자주 묻는 질문</h2>
      <h3>나두아파 지도는 식중독 확진자 지도인가요?</h3><p>아닙니다. 시민의 증상 신고를 모은 비식별 신호입니다. 공식 발생 통계나 의료 진단, 특정 음식점의 안전성 평가가 아닙니다.</p>
      <h3>지도에 신호가 없으면 안전한가요?</h3><p>그렇게 판단할 수 없습니다. 신고 참여와 공개 기준에 따라 신호가 표시되지 않을 수 있습니다.</p>
      <h3>신고만 하면 진료를 받지 않아도 되나요?</h3><p>아닙니다. 신고나 기록은 진료를 대신하지 않습니다. 증상이 심하거나 상태가 나빠지면 의료진에게 상담하세요.</p>
    </section>
    <footer className="site-footer"><NativeLink href="/about">서비스 소개·공개 기준</NativeLink><NativeLink href="/resources">논문·공식 참고자료</NativeLink></footer>
  </main>;
}
