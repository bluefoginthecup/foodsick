"use client";
import { useI18n } from "./i18n/context";
import { SignalMap } from "./signal-map";
import { NativeLink } from "./native-link";

const foundations = [
  "음식점 이름과 정확한 위치는 공개하지 않아요",
  "증상 신고는 진단이나 업소 평가가 아니에요",
  "공개 지도에는 충분히 모인 비식별 신호만 보여요",
];

export default function Home() {
  const { t, text } = useI18n();
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">나두아파 · {t("시민 기반 위장관 증상 조기 신호")}</p>
        <h1 id="hero-title">{t("나만 아픈 걸까?")}</h1>
        <p className="hero-copy">{t("주변에서 비슷한 증상 신고가 늘고 있는지 확인하고, 외식 후 겪은 증상을 안전하게 알려주세요.")}</p>
        <div className="hero-actions">
          <a className="primary-button" href="#signals">{t("주변 신호 보기")}</a>
          <NativeLink className="secondary-button" href="/report">{t("증상 신고하기")}</NativeLink>
        </div>
      </section>

      <div id="signals"><SignalMap /></div>

      <section className="legal-entry" lang="ko" aria-labelledby="food-guide-entry">
        <div><p className="eyebrow">외식 후 몸이 불편하다면</p><h2 id="food-guide-entry">식중독 의심 증상부터 대처·신고까지</h2><p>진료가 필요한 상황과 기록할 내용, 공식 신고와 시민 증상 기록의 차이를 확인하세요.</p></div>
        <NativeLink className="legal-entry-primary" href="/food-poisoning">식중독 의심 시 안내 보기</NativeLink>
      </section>

      <section className="trust-panel" aria-labelledby="trust-title">
        <p className="eyebrow">{t("처음부터 지키는 원칙")}</p>
        <h2 id="trust-title">{t("누군가를 지목하지 않고 신호만 봅니다")}</h2>
        <ul>
          {text(foundations.map((item) => (
            <li key={item}>
              <span className="check" aria-hidden="true">✓</span>
              {text(item)}
            </li>
          )))}
        </ul>
      </section>

      <section className="legal-entry" aria-labelledby="legal-entry-title">
        <div><p className="eyebrow">{t("피해 이후의 다음 단계")}</p><h2 id="legal-entry-title">{t("법률 대응·판례·상담할 곳을 한 번에")}</h2><p>{t("증거를 어떻게 정리할지 확인하고, 공식 판례와 검증된 식중독 사건 수임경력을 찾아보세요.")}</p></div>
        <div><NativeLink href="/law-help#guide">{t("대응 가이드")}</NativeLink><NativeLink href="/law-help#precedents">{t("판례 보기")}</NativeLink><NativeLink className="legal-entry-primary" href="/law-help#firms">{t("로펌 찾기")}</NativeLink></div>
      </section>

      <section className="legal-entry" aria-labelledby="resources-entry-title">
        <div><p className="eyebrow">{t("신호를 이해하는 자료실")}</p><h2 id="resources-entry-title">{t("논문부터 공식 통계, 예방 안내까지")}</h2><p>{t("시민 참여 연구와 식품안전 자료를 유형별로 살펴보고 원문에서 확인하세요.")}</p></div>
        <div><NativeLink className="legal-entry-primary" href="/resources">{t("논문·참고자료 보기 ↗")}</NativeLink></div>
      </section>

      <footer className="site-footer">
        <p>{t("의료 진단 서비스가 아닙니다. 심한 증상은 의료기관에 문의하세요.")}</p>
        <NativeLink href="/about">서비스 소개·자주 묻는 질문</NativeLink>
      </footer>
    </main>
  );
}
