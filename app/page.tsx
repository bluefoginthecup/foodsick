import { SignalMap } from "./signal-map";
import { NativeLink } from "./native-link";

const foundations = [
  "음식점 이름과 정확한 위치는 공개하지 않아요",
  "증상 신고는 진단이나 업소 평가가 아니에요",
  "공개 지도에는 충분히 모인 비식별 신호만 보여요",
];

export default function Home() {
  return (
    <main className="app-shell">
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
          <NativeLink className="secondary-button" href="/report">
            증상 신고하기
          </NativeLink>
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

      <section className="legal-entry" aria-labelledby="legal-entry-title">
        <div><p className="eyebrow">피해 이후의 다음 단계</p><h2 id="legal-entry-title">법률 대응·판례·상담할 곳을 한 번에</h2><p>증거를 어떻게 정리할지 확인하고, 공식 판례와 검증된 식중독 사건 수임경력을 찾아보세요.</p></div>
        <div><NativeLink href="/law-help#guide">대응 가이드</NativeLink><NativeLink href="/law-help#precedents">판례 보기</NativeLink><NativeLink className="legal-entry-primary" href="/law-help#firms">로펌 찾기</NativeLink></div>
      </section>

      <footer className="site-footer">
        <p>의료 진단 서비스가 아닙니다. 심한 증상은 의료기관에 문의하세요.</p>
        <span>Firebase·D1 백엔드 기반 · 10단계</span>
      </footer>
    </main>
  );
}
