"use client";

import { useMemo, useState } from "react";
import { FOOD_CATEGORIES, type FoodCategory } from "./contracts";
import { publicSignals, type PublicSignal } from "./mock-signals";

type TimeFilter = 24 | 72;

function SignalCard({ signal }: { signal: PublicSignal }) {
  return (
    <article className="signal-card" aria-live="polite">
      <div className="signal-card-heading">
        <div>
          <span className="privacy-label">
            {signal.privacyLevel === "dong" ? "동 단위 공개" : "넓혀서 공개"}
          </span>
          <h3>{signal.region}</h3>
          <p>{signal.category} 유형 · 최근 {signal.windowHours}시간</p>
        </div>
        <span className={`trend-badge ${signal.trend}`}>
          {signal.trend === "increased" ? "신고 증가" : "관찰 중"}
        </span>
      </div>
      <dl className="signal-stats">
        <div>
          <dt>독립 신고</dt>
          <dd>{signal.independentReports}<small>건</small></dd>
        </div>
        <div>
          <dt>동행 증상자</dt>
          <dd>{signal.companionSymptoms}<small>명</small></dd>
        </div>
        <div>
          <dt>병원 방문</dt>
          <dd>{signal.medicalVisits}<small>건</small></dd>
        </div>
      </dl>
      <p className="signal-disclaimer">
        이 신호는 사용자 신고의 증가를 뜻하며 특정 업소의 식중독 발생을 의미하지 않습니다.
      </p>
    </article>
  );
}

export function SignalMap() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(72);
  const [category, setCategory] = useState<FoodCategory | "전체">("전체");
  const [activeId, setActiveId] = useState(publicSignals[0].id);

  const visibleSignals = useMemo(
    () => publicSignals.filter((signal) =>
      signal.windowHours <= timeFilter && (category === "전체" || signal.category === category)),
    [category, timeFilter],
  );

  const activeSignal = visibleSignals.find((signal) => signal.id === activeId) ?? visibleSignals[0];

  return (
    <section className="map-section" aria-labelledby="map-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">주변 위장관 증상 신호</p>
          <h2 id="map-title">지금 모인 신호</h2>
        </div>
        <span className="live-status"><i aria-hidden="true" /> 모의 데이터</span>
      </div>

      <div className="filter-strip" aria-label="지도 필터">
        <div className="segmented-control" aria-label="조회 기간">
          {([24, 72] as const).map((hours) => (
            <button
              aria-pressed={timeFilter === hours}
              className={timeFilter === hours ? "active" : ""}
              key={hours}
              onClick={() => setTimeFilter(hours)}
              type="button"
            >
              {hours}시간
            </button>
          ))}
        </div>
        <select
          aria-label="음식 유형"
          onChange={(event) => setCategory(event.target.value as FoodCategory | "전체")}
          value={category}
        >
          <option value="전체">모든 음식 유형</option>
          {FOOD_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="signal-map" role="application" aria-label="비식별 증상 신호 지도">
        <div className="road road-one" aria-hidden="true" />
        <div className="road road-two" aria-hidden="true" />
        <div className="road road-three" aria-hidden="true" />
        <div className="water" aria-hidden="true" />
        <span className="map-place place-one">수원시</span>
        <span className="map-place place-two">용인시</span>
        <span className="map-place place-three">성남시</span>

        {visibleSignals.map((signal) => (
          <button
            aria-label={`${signal.region} ${signal.category} 유형 신고 ${signal.independentReports}건`}
            aria-pressed={activeSignal?.id === signal.id}
            className={`signal-pin ${signal.trend} ${activeSignal?.id === signal.id ? "active" : ""}`}
            key={signal.id}
            onClick={() => setActiveId(signal.id)}
            style={{ left: `${signal.position.x}%`, top: `${signal.position.y}%` }}
            type="button"
          >
            <span>{signal.independentReports}</span>
          </button>
        ))}

        {visibleSignals.length === 0 && (
          <div className="empty-map">선택한 조건에 공개할 수 있는 신호가 아직 없어요.</div>
        )}
      </div>

      {activeSignal && <SignalCard signal={activeSignal} />}

      <p className="map-privacy-note">
        <span aria-hidden="true">◎</span>
        핀은 음식점 좌표가 아닌 공개 가능한 행정구역 중심을 나타냅니다.
      </p>
    </section>
  );
}
