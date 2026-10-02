import { NativeLink } from "../native-link";
import { publicPageMetadata } from "../seo";
import "./about.css";

export const metadata = publicPageMetadata("/about", "서비스 소개·자주 묻는 질문 | 나두아파", "나두아파의 목적, 공개 정보의 범위와 증상 신고 지도를 읽는 방법을 안내합니다.");

export default function AboutPage() {
  return <main className="app-shell about-page" lang="ko">
    <section className="hero">
      <p className="eyebrow">나두아파 소개</p>
      <h1>지역의 증상 신호를 함께 살펴봅니다</h1>
      <p className="hero-copy">나두아파는 외식 후 겪은 위장관 증상을 시민이 신고하고, 지역별 신고 증가를 살펴보는 시민 참여 지도입니다. 음식점 이름과 정확한 위치를 공개하지 않고, 비식별 신고 이력과 최근 신고 집중 안내를 보여줍니다.</p>
    </section>
    <section className="trust-panel" aria-labelledby="about-faq">
      <h2 id="about-faq">자주 묻는 질문</h2>
      <h3>지도에 신호가 보이면 식중독이 확정된 건가요?</h3>
      <p>아닙니다. 시민의 증상 신고를 모은 신호이며, 의료 진단이나 공식 식중독 발생 통계가 아닙니다. 신고만으로 특정 음식이나 업소가 원인이라고 판단할 수 없습니다.</p>
      <h3>음식점 이름이나 개인의 신고 내용을 볼 수 있나요?</h3>
      <p>공개 지도에는 음식점 이름과 정확한 위치를 표시하지 않습니다. 위치를 확인할 수 있는 신고를 지역·음식 유형별로 표시합니다. 최근 집중 안내는 같은 음식점에서 72시간 이내 식사한 서로 다른 회원 3명 이상의 신고를 따로 안내합니다.</p>
      <h3>신호가 없는 지역은 안전한가요?</h3>
      <p>신호가 없다는 것은 증상이 없거나 안전하다는 뜻이 아닙니다. 참여 인원과 신고 시점에 따라 지도에 보이는 정보가 달라질 수 있습니다.</p>
      <h3>이곳에 신고하면 의료기관이나 공공기관에 공식 접수되나요?</h3>
      <p>나두아파의 시민 증상 신고는 의료 진료나 공공기관의 공식 신고를 대신하지 않습니다. 필요한 경우 해당 기관의 공식 절차를 이용해주세요.</p>
      <h3>자료의 근거는 어디에서 확인하나요?</h3>
      <p><NativeLink href="/resources">논문·참고자료</NativeLink>에서 연구와 공식 통계·예방 안내의 원문 링크를 확인할 수 있습니다. 법률 대응 자료는 <NativeLink href="/law-help">대응 가이드</NativeLink>에서 살펴볼 수 있습니다.</p>
    </section>
    <footer className="site-footer"><NativeLink href="/">증상 신호 지도로 돌아가기</NativeLink><p>나두아파는 의료 진단 서비스가 아닙니다.</p></footer>
  </main>;
}
