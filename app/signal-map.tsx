"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdmFeature, EmdProperties, SggProperties, SidoProperties } from "admdongkor";
import { FOOD_CATEGORIES, type FoodCategory } from "./contracts";
import { publicSignals, SIGNAL_DATA_END, SIGNAL_DATA_START, type PublicSignal } from "./mock-signals";
import {
  phoneHref,
  type RegionSelection,
  type RegionalContactsError,
  type RegionalContactsResponse,
} from "./regional-contacts";

type MapLevel = "sido" | "city" | "district" | "dong";
type BoundaryFeature = AdmFeature<SidoProperties | SggProperties | EmdProperties>;
type BoundaryData = {
  sido: AdmFeature<SidoProperties>[];
  sgg: AdmFeature<SggProperties>[];
  emd: AdmFeature<EmdProperties>[];
};
type RegionShape = { id: string; name: string; features: BoundaryFeature[]; signalCount: number };

const EMPTY_SELECTION: RegionSelection = { sido: "", city: "", district: "", dong: "" };

function mapSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

type ContactState =
  | { status: "idle" | "loading"; data: null; message: string }
  | { status: "loaded"; data: RegionalContactsResponse; message: string }
  | { status: "error"; data: null; message: string };

function RegionalHelp({ region, selection }: { region: string; selection: RegionSelection }) {
  const { sido, city, district, dong } = selection;
  const [contactState, setContactState] = useState<ContactState>({
    status: "idle",
    data: null,
    message: "시·군·구를 선택하면 최신 연락처를 조회합니다.",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const medicalLinks = [
    { label: "대학병원 찾기", query: `${region} 대학병원` },
    { label: "응급실 찾기", query: `${region} 응급실` },
    { label: "내과 찾기", query: `${region} 내과` },
  ];

  useEffect(() => {
    const controller = new AbortController();
    if (!sido || !city) return () => controller.abort();
    const params = new URLSearchParams({ sido, city, district, dong });
    queueMicrotask(() => {
      if (!controller.signal.aborted) setContactState({ status: "loading", data: null, message: "API에서 최신 연락처를 불러오는 중입니다." });
    });
    void fetch(`/api/regional-contacts?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json() as RegionalContactsResponse | RegionalContactsError;
      if (!response.ok || "error" in payload) throw new Error("message" in payload ? payload.message : "연락처를 불러오지 못했습니다.");
      setContactState({ status: "loaded", data: payload, message: "" });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setContactState({
        status: "error",
        data: null,
        message: error instanceof Error ? error.message : "최신 연락처를 불러오지 못했습니다.",
      });
    });
    return () => controller.abort();
  }, [city, district, dong, refreshKey, sido]);

  const fetchedLabel = contactState.status === "loaded"
    ? `${new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(contactState.data.fetchedAt))} API 조회`
    : contactState.status === "loading" ? "API 조회 중" : "지역 선택 후 자동 조회";

  return (
    <aside className="regional-help" aria-labelledby="regional-help-title">
      <div className="regional-help-heading">
        <div>
          <p className="eyebrow">선택 지역 생활·의료 안내</p>
          <h3 id="regional-help-title">관할기관·의료기관 찾기</h3>
        </div>
        <span>{region}</span>
      </div>

      <section className="food-safety-contacts" aria-labelledby="government-links-title">
        <div className="contact-section-heading">
          <div><span aria-hidden="true">!</span><h4 id="government-links-title">식중독 신고·문의</h4></div>
          <small>{fetchedLabel}</small>
        </div>
        {contactState.status === "loaded" && contactState.data.contacts.length > 0 ? (
          <div className="contact-card-grid">
            {contactState.data.contacts.map((contact) => (
              <article className={`contact-card ${contact.kind}`} key={`${contact.kind}-${contact.phone}`}>
                <span className="contact-kind">{contact.label}</span>
                <strong>{contact.name}</strong>
                <p>{contact.address}</p>
                <div>
                  <a className="contact-phone" href={phoneHref(contact.phone)}><span aria-hidden="true">☎</span>{contact.phone}</a>
                  <a className="contact-source" href={contact.sourceUrl} rel="noreferrer" target="_blank">장소 정보 ↗</a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={`contact-api-status ${contactState.status}`} aria-live="polite">
            {contactState.status === "loading" && <i aria-hidden="true" />}
            <p>{contactState.status === "loaded" ? "선택 지역에서 전화번호가 확인된 관할기관이 없습니다." : contactState.message}</p>
            {contactState.status === "error" && <button onClick={() => setRefreshKey((value) => value + 1)} type="button">다시 불러오기</button>}
          </div>
        )}
        <p className="contact-caution">카카오 Local API에서 6시간마다 최신 장소·전화 정보를 다시 확인합니다. 위생 담당부서는 검색 결과가 확인되는 지역만 표시합니다.</p>
      </section>

      <section aria-labelledby="medical-links-title">
        <h4 id="medical-links-title">선택 지역에서 의료기관 찾기</h4>
        <div className="regional-link-grid medical">
          {medicalLinks.map((item) => (
            <a href={mapSearchUrl(item.query)} key={item.label} rel="noreferrer" target="_blank">
              <span aria-hidden="true">⌖</span>{item.label}
            </a>
          ))}
        </div>
        <a className="egen-link" href="https://www.e-gen.or.kr/egen/main.do" rel="noreferrer" target="_blank">
          중앙응급의료센터 E-Gen에서 운영 여부 확인하기 <span aria-hidden="true">↗</span>
        </a>
      </section>

      <div className="emergency-callout">
        <p><strong>심한 호흡곤란·의식 저하 등 위급한 증상은 즉시 119에 연락하세요.</strong><span>검색 결과와 실제 진료 가능 여부는 다를 수 있으니 방문 전에 전화로 확인해주세요.</span></p>
        <a href="tel:119">119 전화</a>
      </div>
    </aside>
  );
}

function formatObservedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T12:00:00+09:00`));
}

function SignalCard({ signal }: { signal: PublicSignal }) {
  return (
    <article className="signal-card" aria-live="polite">
      <div className="signal-card-heading">
        <div>
          <span className="privacy-label">
            {signal.regionAdjusted ? "재식별 방지를 위해 넓혀서 공개" : "공개 기준 충족"}
          </span>
          <h3>{signal.region}</h3>
          <p>{signal.category} 유형 · {formatObservedAt(signal.observedAt)} 감지</p>
        </div>
        <span className={`trend-badge ${signal.trend}`}>
          {signal.trend === "increased" ? "신고 증가" : "관찰 기록"}
        </span>
      </div>
      <dl className="signal-stats">
        <div><dt>독립 신고</dt><dd>{signal.independentReports}<small>건</small></dd></div>
        <div><dt>동행 증상자</dt><dd>{signal.companionSymptoms}<small>명</small></dd></div>
        <div><dt>병원 방문</dt><dd>{signal.medicalVisits}<small>건</small></dd></div>
      </dl>
      <p className="signal-disclaimer">
        이 신호는 사용자 신고의 증가를 뜻하며 특정 업소의 식중독 발생을 의미하지 않습니다.
      </p>
    </article>
  );
}

function geometryRings(feature: BoundaryFeature) {
  const geometry = feature.geometry;
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

function shapeBounds(shapes: RegionShape[]) {
  const points = shapes.flatMap((shape) => shape.features.flatMap((feature) => geometryRings(feature).flat()));
  if (!points.length) return null;
  return points.reduce((bounds, [x, y]) => ({
    minX: Math.min(bounds.minX, x), maxX: Math.max(bounds.maxX, x),
    minY: Math.min(bounds.minY, y), maxY: Math.max(bounds.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function projectedShape(shape: RegionShape, bounds: NonNullable<ReturnType<typeof shapeBounds>>) {
  const width = 720;
  const height = 520;
  const margin = 22;
  const scaleX = (width - margin * 2) / Math.max(0.0001, bounds.maxX - bounds.minX);
  const scaleY = (height - margin * 2) / Math.max(0.0001, bounds.maxY - bounds.minY);
  const scale = Math.min(scaleX, scaleY);
  const drawnWidth = (bounds.maxX - bounds.minX) * scale;
  const drawnHeight = (bounds.maxY - bounds.minY) * scale;
  const offsetX = (width - drawnWidth) / 2;
  const offsetY = (height - drawnHeight) / 2;
  const project = ([x, y]: number[]) => [offsetX + (x - bounds.minX) * scale, offsetY + (bounds.maxY - y) * scale];
  const paths = shape.features.flatMap((feature) => geometryRings(feature)).map((ring) => (
    `${ring.map((point, index) => `${index ? "L" : "M"}${project(point).map((value) => value.toFixed(1)).join(" ")}`).join(" ")} Z`
  )).join(" ");
  const points = shape.features.flatMap((feature) => geometryRings(feature).flat()).map(project);
  const label = points.reduce((box, [x, y]) => ({
    minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y), maxY: Math.max(box.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  return { path: paths, labelX: (label.minX + label.maxX) / 2, labelY: (label.minY + label.maxY) / 2 };
}

function cityName(value: string) {
  return value.match(/^(.+?시)/)?.[1] ?? value;
}

function districtName(value: string, city: string) {
  const remainder = value.replace(city, "").trim();
  return remainder || city;
}

function countSignals(signals: PublicSignal[], level: MapLevel, name: string) {
  return signals.filter((signal) => signal[level] === name).length;
}

function makeShapes(data: BoundaryData | null, level: MapLevel, selection: RegionSelection, signals: PublicSignal[]): RegionShape[] {
  if (!data) return [];
  const groups = new Map<string, BoundaryFeature[]>();
  const add = (name: string, feature: BoundaryFeature) => groups.set(name, [...(groups.get(name) ?? []), feature]);

  if (level === "sido") data.sido.forEach((feature) => add(feature.properties.sidonm, feature));
  if (level === "city") data.sgg.filter((feature) => feature.properties.sidonm === selection.sido)
    .forEach((feature) => add(cityName(feature.properties.sggnm), feature));
  if (level === "district") data.sgg.filter((feature) => feature.properties.sidonm === selection.sido && cityName(feature.properties.sggnm) === selection.city)
    .forEach((feature) => add(districtName(feature.properties.sggnm, selection.city), feature));
  if (level === "dong") data.emd.filter((feature) => feature.properties.sidonm === selection.sido
    && cityName(feature.properties.sggnm ?? "") === selection.city
    && districtName(feature.properties.sggnm ?? "", selection.city) === selection.district)
    .forEach((feature) => add(feature.properties.emdnm, feature));

  return [...groups.entries()].map(([name, features]) => ({
    id: `${level}-${name}`,
    name,
    features,
    signalCount: countSignals(signals, level, name),
  })).sort((a, b) => b.signalCount - a.signalCount || a.name.localeCompare(b.name, "ko"));
}

export function SignalMap() {
  const [startDate, setStartDate] = useState(SIGNAL_DATA_START);
  const [endDate, setEndDate] = useState(SIGNAL_DATA_END);
  const [category, setCategory] = useState<FoodCategory | "전체">("전체");
  const [level, setLevel] = useState<MapLevel>("sido");
  const [selection, setSelection] = useState<RegionSelection>(EMPTY_SELECTION);
  const [activeId, setActiveId] = useState(publicSignals[0].id);
  const [boundaries, setBoundaries] = useState<BoundaryData | null>(null);
  const [boundaryError, setBoundaryError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void import("admdongkor").then(async ({ get }) => {
      const [sido, sgg, emd] = await Promise.all([
        get("20260701", "sido", { signal: controller.signal }),
        get("20260701", "sgg", { signal: controller.signal }),
        get("20260701", "emd", { signal: controller.signal }),
      ]);
      if (!controller.signal.aborted) setBoundaries({
        sido: sido.features as AdmFeature<SidoProperties>[],
        sgg: sgg.features as AdmFeature<SggProperties>[],
        emd: emd.features as AdmFeature<EmdProperties>[],
      });
    }).catch(() => { if (!controller.signal.aborted) setBoundaryError(true); });
    return () => controller.abort();
  }, []);

  const visibleSignals = useMemo(() => publicSignals.filter((signal) =>
    signal.observedAt >= startDate && signal.observedAt <= endDate
    && (category === "전체" || signal.category === category)), [category, endDate, startDate]);
  const shapes = useMemo(() => makeShapes(boundaries, level, selection, visibleSignals), [boundaries, level, selection, visibleSignals]);
  const bounds = useMemo(() => shapeBounds(shapes), [shapes]);
  const activeSignal = visibleSignals.find((signal) => signal.id === activeId) ?? visibleSignals[0];
  const helpSelection = selection.sido ? selection : activeSignal ? {
    sido: activeSignal.sido,
    city: activeSignal.city,
    district: activeSignal.district,
    dong: activeSignal.dong,
  } : EMPTY_SELECTION;
  const selectedRegion = [helpSelection.sido, helpSelection.city, helpSelection.district, helpSelection.dong].filter(Boolean).join(" ") || "대한민국";

  const moveTo = (shape: RegionShape) => {
    const matchingSignal = visibleSignals.find((signal) => signal[level] === shape.name);
    if (matchingSignal) setActiveId(matchingSignal.id);
    if (level === "sido") { setSelection({ sido: shape.name, city: "", district: "", dong: "" }); setLevel("city"); }
    if (level === "city") { setSelection((current) => ({ ...current, city: shape.name, district: "", dong: "" })); setLevel("district"); }
    if (level === "district") { setSelection((current) => ({ ...current, district: shape.name, dong: "" })); setLevel("dong"); }
    if (level === "dong") setSelection((current) => ({ ...current, dong: shape.name }));
  };

  const resetTo = (target: MapLevel) => {
    setLevel(target);
    if (target === "sido") setSelection(EMPTY_SELECTION);
    if (target === "city") setSelection((current) => ({ sido: current.sido, city: "", district: "", dong: "" }));
    if (target === "district") setSelection((current) => ({ ...current, district: "", dong: "" }));
  };

  return (
    <section className="map-section" aria-labelledby="map-title">
      <div className="section-heading">
        <div><p className="eyebrow">행정구역별 위장관 증상 신호</p><h2 id="map-title">지금 모인 신호</h2></div>
        <span className="live-status"><i aria-hidden="true" /> 행정경계 · 모의 데이터</span>
      </div>

      <div className="date-filter" aria-label="조회 기간">
        <label>시작일<input min={SIGNAL_DATA_START} max={endDate} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <span aria-hidden="true">→</span>
        <label>종료일<input min={startDate} max={SIGNAL_DATA_END} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <small>최근 1년 조회 가능</small>
      </div>
      <div className="filter-strip" aria-label="지도 필터">
        <select aria-label="음식 유형" onChange={(event) => setCategory(event.target.value as FoodCategory | "전체")} value={category}>
          <option value="전체">모든 음식 유형</option>
          {FOOD_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <span className="result-count">공개 신호 {visibleSignals.length}건</span>
      </div>

      <nav className="map-breadcrumb" aria-label="행정구역 단계">
        <button aria-current={level === "sido" ? "page" : undefined} onClick={() => resetTo("sido")} type="button">시/도</button>
        {selection.sido && <><span>›</span><button aria-current={level === "city" ? "page" : undefined} onClick={() => resetTo("city")} type="button">{selection.sido}</button></>}
        {selection.city && <><span>›</span><button aria-current={level === "district" ? "page" : undefined} onClick={() => resetTo("district")} type="button">{selection.city}</button></>}
        {selection.district && <><span>›</span><button aria-current={level === "dong" && !selection.dong ? "page" : undefined} type="button">{selection.district}</button></>}
        {selection.dong && <><span>›</span><button aria-current="page" type="button">{selection.dong}</button></>}
      </nav>

      <div className="admin-map-shell">
        <div className="admin-boundary-map" role="application" aria-label="대한민국 행정구역 경계 지도">
          {!boundaries && !boundaryError && <div className="map-loading"><i aria-hidden="true" /> 최신 행정경계를 불러오는 중입니다</div>}
          {boundaryError && <div className="empty-map">행정경계 데이터를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</div>}
          {bounds && (
            <svg aria-label={`${level} 단계 행정구역`} role="img" viewBox="0 0 720 520">
              {shapes.map((shape) => {
                const projected = projectedShape(shape, bounds);
                return (
                  <g
                    aria-label={`${shape.name}${shape.signalCount ? `, 공개 신호 ${shape.signalCount}건` : ", 공개 신호 없음"}`}
                    className={shape.signalCount ? "has-signal" : ""}
                    key={shape.id}
                    onClick={() => moveTo(shape)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") moveTo(shape); }}
                    role="button"
                    tabIndex={0}
                  >
                    <path d={projected.path} />
                    {(shape.signalCount > 0 || shapes.length <= 20) && <text x={projected.labelX} y={projected.labelY}>{shape.name}<tspan dx="5">{shape.signalCount ? shape.signalCount : ""}</tspan></text>}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        <div className="admin-region-list" aria-label="현재 단계 행정구역 목록">
          {shapes.map((shape) => (
            <button className={shape.signalCount ? "has-signal" : ""} key={shape.id} onClick={() => moveTo(shape)} type="button">
              <span>{shape.name}</span><strong>{shape.signalCount ? `${shape.signalCount}건` : "–"}</strong>
            </button>
          ))}
        </div>
      </div>

      {activeSignal && <SignalCard signal={activeSignal} />}
      {!activeSignal && boundaries && <div className="no-signal-card">선택한 기간과 음식 유형에 공개할 수 있는 신호가 없습니다.</div>}

      <RegionalHelp region={selectedRegion} selection={helpSelection} />

      <p className="map-privacy-note"><span aria-hidden="true">◎</span>경계는 최신 행정동 기준이며, 신호는 음식점 위치가 아닌 공개 가능한 행정구역에만 표시합니다.</p>
      <details className="privacy-explainer">
        <summary>어떤 신호가 지도에 공개되나요?</summary>
        <div>
          <p><strong>서로 다른 계정 3명 이상</strong>이 비슷한 시간대와 증상으로 신고한 후보만 검토합니다.</p>
          <p>같은 음식 유형의 업소가 적으면 <strong>동 → 구 → 시</strong> 순서로 지역을 넓혀 특정 업소를 추측하기 어렵게 만듭니다.</p>
          <p>동행 증상자는 독립 신고 건수에 포함하지 않으며, 작은 세부 수치는 숨길 수 있습니다.</p>
        </div>
      </details>
    </section>
  );
}
