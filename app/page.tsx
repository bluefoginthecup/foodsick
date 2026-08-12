import Link from "next/link";
import { SignalMap } from "./signal-map";

const foundations = [
  "음식점 이름과 정확한 위치는 공개하지 않아요",
  "증상 신고는 진단이나 업소 평가가 아니에요",
  "공개 지도에는 충분히 모인 비식별 신호만 보여요",
];

export default function Home() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="아파요 지도 홈">
          <span className="brand-mark" aria-hidden="true">아</span>
          <span>아파요 지도</span>
        </Link>
        <span className="prototype-badge">MVP 준비 중</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">시민 기반 위장관 증상 조기 신호</p>
        <h1 id="hero-title">나만 아픈 걸까?</h1>
        <p className="hero-copy">
          주변에서 비슷한 증상 신고가 늘고 있는지 확인하고,
          외식 후 겪은 증상을 안전하게 알려주세요.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#signals">
            주변 신호 보기
          </a>
          <button className="secondary-button" type="button" disabled>
            증상 신고하기
          </button>
        </div>
      </section>

      <div id="signals"><SignalMap /></div>

      <section className="trust-panel" aria-labelledby="trust-title">
        <p className="eyebrow">처음부터 지키는 원칙</p>
        <h2 id="trust-title">누군가를 지목하지 않고 신호만 봅니다</h2>
        <ul>
          {foundations.map((item) => (
            <li key={item}>
              <span className="check" aria-hidden="true">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <footer className="site-footer">
        <p>의료 진단 서비스가 아닙니다. 심한 증상은 의료기관에 문의하세요.</p>
        <span>공개 신호 지도 · 2단계</span>
      </footer>
    </main>
  );
}
