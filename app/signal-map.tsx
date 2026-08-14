"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdmFeature, EmdProperties, SggProperties, SidoProperties } from "admdongkor";
import { FOOD_CATEGORIES, type FoodCategory } from "./contracts";
import { publicSignals, SIGNAL_DATA_END, SIGNAL_DATA_START, type PublicSignal } from "./mock-signals";
import {
  phoneHref,
  regionSelectionKey,
  type RegionSelection,
  type RegionalContactsError,
  type RegionalContactsResponse,
} from "./regional-contacts";
import { useContactFeedback, type ContactFeedbackReason } from "./contact-feedback/contact-feedback-store";
import { submitFirebaseContactFeedback } from "./firebase/contact-feedback-api";
import {
  buildAdministrativeSearchIndex,
  cityName,
  districtName,
  isOneTierRegion,
  regionMatches,
  searchAdministrativeRegions,
  selectedRegionLabel,
} from "./administrative-search";
import { expectedRegionalContactSlots } from "./regional-contact-slots";
import { readJsonResponse } from "./http-response";

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

function googleSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

type ContactState =
  | { status: "idle" | "loading"; data: null; message: string }
  | { status: "loaded"; data: RegionalContactsResponse; message: string; selectionKey: string }
  | { status: "error"; data: null; message: string };

function RegionalHelp({ region, selection }: { region: string; selection: RegionSelection }) {
  const { sido, city, district, dong } = selection;
  const activeSelectionKey = regionSelectionKey(selection);
  const [fetchedContactState, setContactState] = useState<ContactState>({
    status: "idle",
    data: null,
    message: "시·군·구를 선택하면 최신 연락처를 조회합니다.",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [contactRefreshing, setContactRefreshing] = useState(false);
  const { submitContactFeedback } = useContactFeedback();
  const [feedbackContact, setFeedbackContact] = useState<RegionalContactsResponse["contacts"][number] | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<ContactFeedbackReason>("wrong_phone");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const medicalLinks = [
    { label: "대학병원 찾기", query: `${region} 대학병원` },
    { label: "응급실 찾기", query: `${region} 응급실` },
    { label: "내과 찾기", query: `${region} 내과` },
  ];

  useEffect(() => {
    const controller = new AbortController();
    if (!sido || !city) return () => controller.abort();
    const params = new URLSearchParams({ sido, city, district, dong });
    const endpoint = `/api/regional-contacts?${params.toString()}`;
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setContactRefreshing(false);
        setContactState({ status: "loading", data: null, message: "저장된 연락처를 확인하는 중입니다." });
      }
    });
    void (async () => {
      try {
        const response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: controller.signal });
        const payload = await readJsonResponse<RegionalContactsResponse | RegionalContactsError>(response, "연락처를 불러오지 못했습니다");
        if (!response.ok || "error" in payload) throw new Error("message" in payload ? payload.message : "연락처를 불러오지 못했습니다.");
        setContactState({ status: "loaded", data: payload, message: "", selectionKey: activeSelectionKey });
        if (payload.cache !== "stale") return;

        setContactRefreshing(true);
        try {
          const refreshed = await fetch(`${endpoint}&refresh=1`, { headers: { Accept: "application/json" }, signal: controller.signal });
          const refreshedPayload = await readJsonResponse<RegionalContactsResponse | RegionalContactsError>(refreshed, "연락처를 새로 확인하지 못했습니다");
          if (refreshed.ok && !("error" in refreshedPayload)) setContactState({ status: "loaded", data: refreshedPayload, message: "", selectionKey: activeSelectionKey });
        } catch (error) {
          if (!controller.signal.aborted) console.error("Regional contact background refresh failed", error);
        } finally {
          if (!controller.signal.aborted) setContactRefreshing(false);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setContactState({
          status: "error",
          data: null,
          message: error instanceof Error ? error.message : "최신 연락처를 불러오지 못했습니다.",
        });
      }
    })();
    return () => controller.abort();
  }, [activeSelectionKey, city, district, dong, refreshKey, sido]);

  const contactState: ContactState = !sido || !city
    ? { status: "idle", data: null, message: "시·군·구를 선택하면 최신 연락처를 조회합니다." }
    : fetchedContactState.status === "loaded" && fetchedContactState.selectionKey !== activeSelectionKey
      ? { status: "loading", data: null, message: "API에서 최신 연락처를 불러오는 중입니다." }
      : fetchedContactState;
  const contactSlots = expectedRegionalContactSlots(selection, contactState.status === "loaded" ? contactState.data.contacts : []);

  const fetchedLabel = contactState.status === "loaded"
    ? `${new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(contactState.data.fetchedAt))} ${contactRefreshing ? "저장 정보 · 갱신 중" : contactState.data.cache === "fresh" ? "확인 · 캐시" : contactState.data.cache === "stale" ? "저장 정보" : "API 갱신"}`
    : contactState.status === "loading" ? "캐시 확인 중" : "지역 선택 후 자동 조회";

  const closeFeedback = () => {
    setFeedbackContact(null);
    setFeedbackReason("wrong_phone");
    setFeedbackNote("");
    setFeedbackSubmitted(false);
  };

  const submitFeedback = async () => {
    if (!feedbackContact) return;
    const input = {
      region,
      contact: {
        kind: feedbackContact.kind,
        name: feedbackContact.name,
        phone: feedbackContact.phone,
        sourceUrl: feedbackContact.sourceUrl,
      },
      reason: feedbackReason,
      note: feedbackNote.trim().slice(0, 300),
    };
    setFeedbackSending(true);
    try {
      await submitFirebaseContactFeedback(input);
    } catch (error) {
      console.error("Central contact feedback submission failed; retained in the local review queue", error);
    }
    submitContactFeedback(input);
    setFeedbackSending(false);
    setFeedbackSubmitted(true);
  };

  return (
    <aside className="regional-help" id="regional-help" aria-labelledby="regional-help-title">
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
        <div className="contact-card-grid">
          {contactSlots.map((slot) => slot.contact ? (
            <article className={`contact-card ${slot.kind}`} key={slot.kind}>
              <span className="contact-kind">{slot.label}</span>
              <strong>{slot.contact.name}</strong>
              <p>{slot.contact.address}</p>
              <div className="contact-primary-actions">
                <a className="contact-phone" href={phoneHref(slot.contact.phone)}><span aria-hidden="true">☎</span>{slot.contact.phone}</a>
                <a className="contact-source" href={slot.contact.sourceUrl} rel="noreferrer" target="_blank">{slot.contact.sourceLabel ?? "장소 정보"} ↗</a>
              </div>
              <div className="contact-check-actions">
                <a href={googleSearchUrl(`${region} ${slot.contact.name} ${slot.contact.phone} 공식 전화번호`)} rel="noreferrer" target="_blank">구글로 다시 확인 ↗</a>
                <button onClick={() => setFeedbackContact(slot.contact)} type="button">연락처 오류 신고</button>
              </div>
            </article>
          ) : (
            <article className={`contact-card ${slot.kind} unavailable`} key={slot.kind}>
              <span className="contact-kind">{slot.label}</span>
              <strong>{slot.expectedName}</strong>
              <p>{contactState.status === "loading" || contactState.status === "idle" ? "구글 검색은 바로 사용할 수 있으며, 최신 전화번호는 뒤에서 확인합니다." : "API에서 전화번호를 확인하지 못했습니다."}</p>
              <a className="contact-google-search" href={googleSearchUrl(`${region} ${slot.expectedName} 대표전화 공식`)} rel="noreferrer" target="_blank">구글에서 먼저 확인 ↗</a>
            </article>
          ))}
        </div>
        {(contactState.status === "loading" || contactState.status === "error") && (
          <div className={`contact-api-status compact ${contactState.status}`} aria-live="polite">
            {contactState.status === "loading" && <i aria-hidden="true" />}
            <p>{contactState.message}</p>
            {contactState.status === "error" && <button onClick={() => setRefreshKey((value) => value + 1)} type="button">다시 불러오기</button>}
          </div>
        )}
        <p className="contact-caution">확인한 연락처는 지역별 서버 캐시에 저장해 즉시 표시하고, 6시간이 지나면 카카오 Local API·행정안전부 조직정보·지자체 공식 직원안내에서 새로 확인합니다.</p>
        <p className="contact-caution">구글 검색은 AI 요약과 검색결과를 통한 보조 확인 수단이며, 최종 연락 전 공식 기관 페이지도 함께 확인해주세요.</p>
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

      {feedbackContact && (
        <div aria-labelledby="contact-feedback-title" aria-modal="true" className="contact-feedback-backdrop" role="dialog">
          <form className="contact-feedback-dialog" onSubmit={(event) => { event.preventDefault(); void submitFeedback(); }}>
            {feedbackSubmitted ? (
              <>
                <span className="feedback-done" aria-hidden="true">✓</span>
                <h4 id="contact-feedback-title">관리자 검토 목록에 접수했습니다</h4>
                <p>공식 출처를 다시 확인한 뒤 연락처를 갱신하겠습니다.</p>
                <button className="feedback-submit" onClick={closeFeedback} type="button">확인</button>
              </>
            ) : (
              <>
                <div className="feedback-heading"><div><span>연락처 오류 신고</span><h4 id="contact-feedback-title">{feedbackContact.name}</h4></div><button aria-label="닫기" onClick={closeFeedback} type="button">×</button></div>
                <dl><div><dt>선택 지역</dt><dd>{region}</dd></div><div><dt>현재 번호</dt><dd>{feedbackContact.phone}</dd></div></dl>
                <label>어떤 문제가 있나요?
                  <select onChange={(event) => setFeedbackReason(event.target.value as ContactFeedbackReason)} value={feedbackReason}>
                    <option value="wrong_phone">전화번호가 연결되지 않음</option>
                    <option value="outdated">이전·폐지된 정보로 보임</option>
                    <option value="wrong_office">관할 기관·부서가 다름</option>
                    <option value="other">그 밖의 문제</option>
                  </select>
                </label>
                <label>추가 설명 (선택)
                  <textarea maxLength={300} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="확인한 내용이나 올바른 연락처를 알려주세요. 개인정보는 입력하지 마세요." value={feedbackNote} />
                </label>
                <button className="feedback-submit" disabled={feedbackSending} type="submit">{feedbackSending ? "접수 중…" : "관리자에게 신고하기"}</button>
              </>
            )}
          </form>
        </div>
      )}
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

function RegionSummaryCard({ region, signals }: { region: string; signals: PublicSignal[] }) {
  const totals = signals.reduce((sum, signal) => ({
    independentReports: sum.independentReports + signal.independentReports,
    companionSymptoms: sum.companionSymptoms + signal.companionSymptoms,
    medicalVisits: sum.medicalVisits + signal.medicalVisits,
  }), { independentReports: 0, companionSymptoms: 0, medicalVisits: 0 });
  const categories = [...new Set(signals.map((signal) => signal.category))];
  const latest = signals.map((signal) => signal.observedAt).sort().at(-1);

  return (
    <article className={`signal-card region-summary ${signals.length ? "" : "empty-region"}`} aria-live="polite">
      <div className="signal-card-heading">
        <div>
          <span className="privacy-label">{signals.length ? "공개 기준 충족 신호 있음" : "현재 공개 신호 없음"}</span>
          <h3>{region}</h3>
          <p>{signals.length ? `${categories.join(" · ")} · ${latest ? formatObservedAt(latest) : ""} 기준` : "선택한 기간과 음식 유형 기준"}</p>
        </div>
        <span className={`trend-badge ${signals.some((signal) => signal.trend === "increased") ? "increased" : "steady"}`}>
          {signals.length ? `신호 ${signals.length}개` : "0건"}
        </span>
      </div>
      <dl className="signal-stats">
        <div><dt>독립 신고</dt><dd>{totals.independentReports}<small>건</small></dd></div>
        <div><dt>동행 증상자</dt><dd>{totals.companionSymptoms}<small>명</small></dd></div>
        <div><dt>병원 방문</dt><dd>{totals.medicalVisits}<small>건</small></dd></div>
      </dl>
      <p className="signal-disclaimer">
        {signals.length
          ? "이 수치는 선택 지역 안에서 공개 기준을 충족한 신호의 합계이며 특정 업소의 식중독 발생을 의미하지 않습니다."
          : "0건은 신고가 전혀 없다는 뜻이 아니라, 현재 선택 조건에서 공개 기준을 충족한 신호가 없다는 뜻입니다."}
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
    `${ring.map((point: number[], index: number) => `${index ? "L" : "M"}${project(point).map((value) => value.toFixed(1)).join(" ")}`).join(" ")} Z`
  )).join(" ");
  const points = shape.features.flatMap((feature) => geometryRings(feature).flat()).map(project);
  const label = points.reduce((box, [x, y]) => ({
    minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y), maxY: Math.max(box.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  return { path: paths, labelX: (label.minX + label.maxX) / 2, labelY: (label.minY + label.maxY) / 2 };
}

function countSignals(signals: PublicSignal[], level: MapLevel, name: string, selection: RegionSelection) {
  return signals.filter((signal) => signal[level] === name && regionMatches(signal, selection)).length;
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
    signalCount: countSignals(signals, level, name, selection),
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
  const [regionQuery, setRegionQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

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
  const searchIndex = useMemo(() => boundaries ? buildAdministrativeSearchIndex(boundaries) : [], [boundaries]);
  const searchResults = useMemo(() => searchAdministrativeRegions(searchIndex, regionQuery), [regionQuery, searchIndex]);
  const selectedSignals = useMemo(() => selection.sido ? visibleSignals.filter((signal) => regionMatches(signal, selection)) : [], [selection, visibleSignals]);
  const activeSignal = !selection.sido ? visibleSignals.find((signal) => signal.id === activeId) ?? visibleSignals[0] : undefined;
  const helpSelection = selection.sido ? selection : activeSignal ? {
    sido: activeSignal.sido,
    city: activeSignal.city,
    district: activeSignal.district,
    dong: activeSignal.dong,
  } : EMPTY_SELECTION;
  const selectedRegion = selectedRegionLabel(helpSelection) || "대한민국";
  const oneTierSelection = isOneTierRegion(selection);

  const selectSearchResult = (result: (typeof searchResults)[number]) => {
    setSelection(result.selection);
    setLevel(result.targetLevel);
    setRegionQuery(result.label);
    setSearchOpen(false);
    const matchingSignal = visibleSignals.find((signal) => regionMatches(signal, result.selection));
    if (matchingSignal) setActiveId(matchingSignal.id);
  };

  const moveTo = (shape: RegionShape) => {
    const matchingSignal = visibleSignals.find((signal) => signal[level] === shape.name);
    if (matchingSignal) setActiveId(matchingSignal.id);
    if (level === "sido") { setSelection({ sido: shape.name, city: "", district: "", dong: "" }); setLevel("city"); }
    if (level === "city") {
      const oneTier = shape.features.every((feature) => {
        const sgg = (feature.properties as SggProperties).sggnm;
        return districtName(sgg, cityName(sgg)) === cityName(sgg);
      });
      setSelection((current) => ({ ...current, city: shape.name, district: oneTier ? shape.name : "", dong: "" }));
      setLevel(oneTier ? "dong" : "district");
    }
    if (level === "district") { setSelection((current) => ({ ...current, district: shape.name, dong: "" })); setLevel("dong"); }
    if (level === "dong") setSelection((current) => ({ ...current, dong: shape.name }));
  };

  const resetTo = (target: MapLevel) => {
    setLevel(target);
    if (target === "sido") setSelection(EMPTY_SELECTION);
    if (target === "city") setSelection((current) => ({ sido: current.sido, city: "", district: "", dong: "" }));
    if (target === "district") setSelection((current) => ({ ...current, district: "", dong: "" }));
  };

  const resetCityOrDistrict = () => {
    if (!oneTierSelection) {
      resetTo("district");
      return;
    }
    setLevel("dong");
    setSelection((current) => ({ ...current, dong: "" }));
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

      <div className="region-search">
        <label htmlFor="region-search-input">행정구역 검색</label>
        <div className="region-search-control">
          <span aria-hidden="true">⌕</span>
          <input
            aria-autocomplete="list"
            aria-controls="region-search-results"
            aria-expanded={searchOpen && Boolean(regionQuery.trim())}
            autoComplete="off"
            id="region-search-input"
            onChange={(event) => { setRegionQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="예: 울산 중구, 서울 종로구, 용인 기흥구"
            role="combobox"
            value={regionQuery}
          />
          {regionQuery && <button aria-label="검색어 지우기" onClick={() => { setRegionQuery(""); setSearchOpen(false); }} type="button">×</button>}
        </div>
        {searchOpen && regionQuery.trim() && (
          <div className="region-search-results" id="region-search-results" role="listbox">
            {searchResults.length ? searchResults.map((result) => (
              <button aria-selected="false" key={result.id} onClick={() => selectSearchResult(result)} role="option" type="button">
                <span>{result.label}</span><small>{result.detail}</small>
              </button>
            )) : <p>일치하는 최신 행정구역이 없습니다.</p>}
          </div>
        )}
      </div>

      <nav className="map-breadcrumb" aria-label="행정구역 단계">
        <button aria-current={level === "sido" ? "page" : undefined} onClick={() => resetTo("sido")} type="button">시/도</button>
        {selection.sido && <><span>›</span><button aria-current={level === "city" ? "page" : undefined} onClick={() => resetTo("city")} type="button">{selection.sido}</button></>}
        {selection.city && <><span>›</span><button aria-current={(level === "district" || (oneTierSelection && level === "dong" && !selection.dong)) ? "page" : undefined} onClick={resetCityOrDistrict} type="button">{selection.city}</button></>}
        {selection.district && !oneTierSelection && <><span>›</span><button aria-current={level === "dong" && !selection.dong ? "page" : undefined} type="button">{selection.district}</button></>}
        {selection.dong && <><span>›</span><button aria-current="page" type="button">{selection.dong}</button></>}
      </nav>

      <div className="admin-map-shell">
        <div className="admin-boundary-map" role="application" aria-label="대한민국 행정구역 경계 지도">
          {!boundaries && !boundaryError && <div className="map-loading"><i aria-hidden="true" /> 최신 행정경계를 불러오는 중입니다</div>}
          {boundaryError && <div className="empty-map">행정경계 데이터를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</div>}
          {bounds && (
            <svg aria-label={`${level} 단계 행정구역`} className={shapes.length > 20 ? "dense" : ""} role="img" viewBox="0 0 720 520">
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
                    <text x={projected.labelX} y={projected.labelY}>{shape.name}<tspan dx="5">{shape.signalCount ? shape.signalCount : ""}</tspan></text>
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

      {selection.sido ? <RegionSummaryCard region={selectedRegionLabel(selection)} signals={selectedSignals} /> : activeSignal ? <SignalCard signal={activeSignal} /> : boundaries && <div className="no-signal-card">선택한 기간과 음식 유형에 공개할 수 있는 신호가 없습니다.</div>}

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
