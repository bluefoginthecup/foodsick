"use client";
import { useI18n } from "./i18n/context";


import { useEffect, useMemo, useState } from "react";
import type { AdmFeature, EmdProperties, SggProperties, SidoProperties } from "admdongkor";
import { FOOD_CATEGORIES, type FoodCategory } from "./contracts";
import { signalDateRange, summarizeSignalDetail, type PublicSignal } from "./public-signals";
import { getFirebasePublicSignals } from "./firebase/report-api";
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
import { useTestMap } from "./use-test-map";
import { placeMapLabels } from "./map-labels";
import { MapVenues } from "./admin/map-venues";
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
  const { t, text, locale } = useI18n();
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
    ? `${new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(contactState.data.fetchedAt))} ${contactRefreshing ? "저장 정보 · 갱신 중" : contactState.data.cache === "fresh" ? "확인 · 캐시" : contactState.data.cache === "stale" ? "저장 정보" : "API 갱신"}`
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
          <p className="eyebrow">{t("선택 지역 생활·의료 안내")}</p>
          <h3 id="regional-help-title">{t("관할기관·의료기관 찾기")}</h3>
        </div>
        <span>{text(region)}</span>
      </div>

      <section className="food-safety-contacts" aria-labelledby="government-links-title">
        <div className="contact-section-heading">
          <div><span aria-hidden="true">!</span><h4 id="government-links-title">{t("식중독 신고·문의")}</h4></div>
          <small>{text(fetchedLabel)}</small>
        </div>
        <div className="contact-card-grid">
          {text(contactSlots.map((slot) => slot.contact ? (
            <article className={`contact-card ${slot.kind}`} key={slot.kind}>
              <span className="contact-kind">{text(slot.label)}</span>
              <strong>{slot.contact.name}</strong>
              <p>{text(slot.contact.address)}</p>
              <div className="contact-primary-actions">
                <a className="contact-phone" href={phoneHref(slot.contact.phone)}><span aria-hidden="true">☎</span>{text(slot.contact.phone)}</a>
                <a className="contact-source" href={slot.contact.sourceUrl} rel="noreferrer" target="_blank">{text(slot.contact.sourceLabel ?? "장소 정보")} ↗</a>
              </div>
              <div className="contact-check-actions">
                <a href={googleSearchUrl(`${region} ${slot.contact.name} ${slot.contact.phone} 공식 전화번호`)} rel="noreferrer" target="_blank">{t("구글로 다시 확인 ↗")}</a>
                <button onClick={() => setFeedbackContact(slot.contact)} type="button">{t("연락처 오류 신고")}</button>
              </div>
            </article>
          ) : (
            <article className={`contact-card ${slot.kind} unavailable`} key={slot.kind}>
              <span className="contact-kind">{text(slot.label)}</span>
              <strong>{text(slot.expectedName)}</strong>
              <p>{text(contactState.status === "loading" || contactState.status === "idle" ? "구글 검색은 바로 사용할 수 있으며, 최신 전화번호는 뒤에서 확인합니다." : "API에서 전화번호를 확인하지 못했습니다.")}</p>
              <a className="contact-google-search" href={googleSearchUrl(`${region} ${slot.expectedName} 대표전화 공식`)} rel="noreferrer" target="_blank">{t("구글에서 먼저 확인 ↗")}</a>
            </article>
          )))}
        </div>
        {text((contactState.status === "loading" || contactState.status === "error") && (
          <div className={`contact-api-status compact ${contactState.status}`} aria-live="polite">
            {text(contactState.status === "loading" && <i aria-hidden="true" />)}
            <p>{text(contactState.message)}</p>
            {text(contactState.status === "error" && <button onClick={() => setRefreshKey((value) => value + 1)} type="button">{t("다시 불러오기")}</button>)}
          </div>
        ))}
        <p className="contact-caution">{t("확인한 연락처는 지역별 서버 캐시에 저장해 즉시 표시하고, 6시간이 지나면 카카오 Local API·행정안전부 조직정보·지자체 공식 직원안내에서 새로 확인합니다.")}</p>
        <p className="contact-caution">{t("구글 검색은 AI 요약과 검색결과를 통한 보조 확인 수단이며, 최종 연락 전 공식 기관 페이지도 함께 확인해주세요.")}</p>
      </section>

      <section aria-labelledby="medical-links-title">
        <h4 id="medical-links-title">{t("선택 지역에서 의료기관 찾기")}</h4>
        <div className="regional-link-grid medical">
          {text(medicalLinks.map((item) => (
            <a href={mapSearchUrl(item.query)} key={item.label} rel="noreferrer" target="_blank">
              <span aria-hidden="true">⌖</span>{text(item.label)}
            </a>
          )))}
        </div>
        <a className="egen-link" href="https://www.e-gen.or.kr/egen/main.do" rel="noreferrer" target="_blank">{t("중앙응급의료센터 E-Gen에서 운영 여부 확인하기")}<span aria-hidden="true">↗</span>
        </a>
      </section>

      <div className="emergency-callout">
        <p><strong>{t("심한 호흡곤란·의식 저하 등 위급한 증상은 즉시 119에 연락하세요.")}</strong><span>{t("검색 결과와 실제 진료 가능 여부는 다를 수 있으니 방문 전에 전화로 확인해주세요.")}</span></p>
        <a href="tel:119">{t("119 전화")}</a>
      </div>

      {text(feedbackContact && (
        <div aria-labelledby="contact-feedback-title" aria-modal="true" className="contact-feedback-backdrop" role="dialog">
          <form className="contact-feedback-dialog" onSubmit={(event) => { event.preventDefault(); void submitFeedback(); }}>
            {text(feedbackSubmitted ? (
              <>
                <span className="feedback-done" aria-hidden="true">✓</span>
                <h4 id="contact-feedback-title">{t("관리자 검토 목록에 접수했습니다")}</h4>
                <p>{t("공식 출처를 다시 확인한 뒤 연락처를 갱신하겠습니다.")}</p>
                <button className="feedback-submit" onClick={closeFeedback} type="button">{t("확인")}</button>
              </>
            ) : (
              <>
                <div className="feedback-heading"><div><span>{t("연락처 오류 신고")}</span><h4 id="contact-feedback-title">{feedbackContact.name}</h4></div><button aria-label={t("닫기")} onClick={closeFeedback} type="button">×</button></div>
                <dl><div><dt>{t("선택 지역")}</dt><dd>{text(region)}</dd></div><div><dt>{t("현재 번호")}</dt><dd>{text(feedbackContact.phone)}</dd></div></dl>
                <label>{t("어떤 문제가 있나요?")}<select onChange={(event) => setFeedbackReason(event.target.value as ContactFeedbackReason)} value={feedbackReason}>
                    <option value="wrong_phone">{t("전화번호가 연결되지 않음")}</option>
                    <option value="outdated">{t("이전·폐지된 정보로 보임")}</option>
                    <option value="wrong_office">{t("관할 기관·부서가 다름")}</option>
                    <option value="other">{t("그 밖의 문제")}</option>
                  </select>
                </label>
                <label>{t("추가 설명 (선택)")}<textarea maxLength={300} onChange={(event) => setFeedbackNote(event.target.value)} placeholder={t("확인한 내용이나 올바른 연락처를 알려주세요. 개인정보는 입력하지 마세요.")} value={feedbackNote} />
                </label>
                <button className="feedback-submit" disabled={feedbackSending} type="submit">{text(feedbackSending ? "접수 중…" : "관리자에게 신고하기")}</button>
              </>
            ))}
          </form>
        </div>
      ))}
    </aside>
  );
}

function formatObservedAt(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T12:00:00+09:00`));
}

function SignalHealthStats({ signals }: { signals: PublicSignal[] }) {
  const { t } = useI18n();
  return <dl className="signal-stats signal-health-stats">
    <div><dt>{t("독립 신고")}</dt><dd>{signals.reduce((sum, s) => sum + s.independentReports, 0)}<small>{t("건")}</small></dd></div>
    {([["companionSymptoms", "동행 증상자", "명"], ["outpatientVisits", "통원", "건"], ["inpatientVisits", "입원", "건"]] as const).map(([key, label, unit]) => {
      const count = summarizeSignalDetail(signals, key);
      return <div key={key}><dt>{t(label)}</dt><dd>
        {(count.known > 0 || (!count.smallGroups && !count.unknown)) && <>{count.known}<small>{t(unit)}</small></>}
        {!!count.smallGroups && <small className="signal-count-note">{count.known ? "+ " : ""}{t(count.smallGroups === 1 ? "소수 인원(1~2)" : "소수 인원 포함")}</small>}
        {count.unknown && <small className="signal-count-note">{t("미확인 포함")}</small>}
      </dd></div>;
    })}
  </dl>;
}

function SignalCard({ signal }: { signal: PublicSignal }) {
  const { text, t, locale } = useI18n();
  return (
    <article className="signal-card" aria-live="polite">
      <div className="signal-card-heading">
        <div>
          <span className="privacy-label">
            {text(signal.regionAdjusted ? "재식별 방지를 위해 넓혀서 공개" : "공개 기준 충족")}
          </span>
          <h3>{text(signal.region)}</h3>
          <p>{text(formatObservedAt(signal.observedAt, locale))}{t(" 감지")}</p>
        </div>
        <span className={`trend-badge ${signal.trend}`}>
          {text(signal.trend === "increased" ? "신고 증가" : "관찰 기록")}
        </span>
      </div>
      <div className="signal-menu-types"><strong>{t("메뉴")}</strong><span>{t(signal.category)}</span></div>
      <SignalHealthStats signals={[signal]} />
      <p className="signal-disclaimer">{t("이 신호는 사용자 신고의 증가를 뜻하며 특정 업소의 식중독 발생을 의미하지 않습니다.")}</p>
    </article>
  );
}

function RegionSummaryCard({ region, signals }: { region: string; signals: PublicSignal[] }) {
  const { text, t, locale } = useI18n();
  const categories = [...new Set(signals.map((signal) => signal.category))];
  const latest = signals.map((signal) => signal.observedAt).sort().at(-1);

  return (
    <article className={`signal-card region-summary ${signals.length ? "" : "empty-region"}`} aria-live="polite">
      <div className="signal-card-heading">
        <div>
          <span className="privacy-label">{text(signals.length ? "공개 기준 충족 신호 있음" : "현재 공개 신호 없음")}</span>
          <h3>{text(region)}</h3>
          <p>{text(signals.length ? `${latest ? formatObservedAt(latest, locale) : ""} 기준` : "선택한 기간과 음식 유형 기준")}</p>
        </div>
        <span className={`trend-badge ${signals.some((signal) => signal.trend === "increased") ? "increased" : "steady"}`}>
          {text(signals.length ? `신호 ${signals.length}개` : "0건")}
        </span>
      </div>
      {!!categories.length && <div className="signal-menu-types"><strong>{t("메뉴")}</strong>{categories.map(category => <span key={category}>{t(category)}</span>)}</div>}
      <SignalHealthStats signals={signals} />
      {!!signals.length && <p className="signal-disclaimer">{t("통원·입원은 신고자 기준이며, 입원한 신고는 통원에 중복 집계하지 않습니다. 1~2명은 소수 인원으로 표시합니다.")}</p>}
      <p className="signal-disclaimer">
        {text(signals.length
          ? "이 수치는 선택 지역 안에서 공개 기준을 충족한 신호의 합계이며 특정 업소의 식중독 발생을 의미하지 않습니다."
          : "0건은 신고가 전혀 없다는 뜻이 아니라, 현재 선택 조건에서 공개 기준을 충족한 신호가 없다는 뜻입니다.")}
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
  const testMap = useTestMap();
  const { t, text, locale } = useI18n();
  const [dateRange] = useState(() => signalDateRange());
  const [startDate, setStartDate] = useState(dateRange.start);
  const [endDate, setEndDate] = useState(dateRange.end);
  const [publicSignals, setPublicSignals] = useState<PublicSignal[]>([]);
  const [signalStatus, setSignalStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [signalRefresh, setSignalRefresh] = useState(0);
  const [lastChecked, setLastChecked] = useState("");
  const [category, setCategory] = useState<FoodCategory | "전체">("전체");
  const [level, setLevel] = useState<MapLevel>("sido");
  const [selection, setSelection] = useState<RegionSelection>(EMPTY_SELECTION);
  const [activeId, setActiveId] = useState("");
  const [boundaries, setBoundaries] = useState<BoundaryData | null>(null);
  const [boundaryError, setBoundaryError] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const signals = await getFirebasePublicSignals();
        if (!cancelled) {
          setPublicSignals(signals);
          setSignalStatus("loaded");
          setLastChecked(new Date().toISOString());
        }
      } catch {
        if (!cancelled) { setPublicSignals([]); setSignalStatus("error"); }
      } finally { inFlight = false; }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [signalRefresh]);

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

  const displayStatus = signalStatus;
  const mapSignals = publicSignals;
  const visibleSignals = useMemo(() => mapSignals.filter((signal) =>
    signal.observedAt >= startDate && signal.observedAt <= endDate
    && (category === "전체" || signal.category === category)), [mapSignals, category, endDate, startDate]);
  const shapes = useMemo(() => makeShapes(boundaries, level, selection, visibleSignals), [boundaries, level, selection, visibleSignals]);
  const bounds = useMemo(() => shapeBounds(shapes), [shapes]);
  const projectedShapes = useMemo(() => bounds ? shapes.map(shape => ({shape, projected:projectedShape(shape,bounds)})) : [], [shapes,bounds]);
  const mapLabels = useMemo(() => placeMapLabels(projectedShapes.map(({shape,projected}) => ({id:shape.id,x:projected.labelX,y:projected.labelY,text:`${shape.name}${shape.signalCount ? ` ${shape.signalCount}` : ""}`}))), [projectedShapes]);
  const mapHeight = Math.max(520,...mapLabels.map(label=>label.y+20));
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
        <div><p className="eyebrow">{t("행정구역별 위장관 증상 신호")}</p><h2 id="map-title">{t("지금 모인 신호")}</h2></div>
        <span className="live-status">{text(displayStatus === "loaded" ? `신고 집계 · ${lastChecked ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date(lastChecked)) : ""} 확인` : displayStatus === "error" ? "신호 조회 실패" : "신호 확인 중")}</span>
      </div>

      {testMap.allowed && <aside className="signal-card"><p>모든 회원의 신고를 같은 지도와 집계에서 확인합니다.</p><button type="button" disabled={testMap.loading} onClick={testMap.refresh}>관리자 자료·집계 새로고침</button><p role="status">{testMap.loading?"조회 중…":testMap.error||(testMap.loaded?`원본 ${testMap.reports.length}건 조회 완료`:"음식점별 상세를 보려면 자료를 조회해주세요.")}</p></aside>}
      <div className="date-filter" aria-label={t("조회 기간")}>
        <label>{t("시작일")}<input min={dateRange.start} max={endDate} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <span aria-hidden="true">→</span>
        <label>{t("종료일")}<input min={startDate} max={dateRange.end} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <small>{t("최근 1년 조회 가능")}</small>
      </div>
      <div className="filter-strip" aria-label={t("지도 필터")}>
        <select aria-label={t("음식 유형")} onChange={(event) => setCategory(event.target.value as FoodCategory | "전체")} value={category}>
          <option value="전체">{t("모든 음식 유형")}</option>
          {text(FOOD_CATEGORIES.map((item) => <option value={item} key={item}>{text(item)}</option>))}
        </select>
        <span className="result-count">{text(displayStatus === "loaded" ? `공개 신호 ${visibleSignals.length}건` : "공개 신호 확인 중")}</span>
      </div>

      <div className="region-search">
        <label htmlFor="region-search-input">{t("행정구역 검색")}</label>
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
            placeholder={t("예: 울산 중구, 서울 종로구, 용인 기흥구")}
            role="combobox"
            value={regionQuery}
          />
          {text(regionQuery && <button aria-label={t("검색어 지우기")} onClick={() => { setRegionQuery(""); setSearchOpen(false); }} type="button">×</button>)}
        </div>
        {text(searchOpen && regionQuery.trim() && (
          <div className="region-search-results" id="region-search-results" role="listbox">
            {text(searchResults.length ? searchResults.map((result) => (
              <button aria-selected="false" key={result.id} onClick={() => selectSearchResult(result)} role="option" type="button">
                <span>{text(result.label)}</span><small>{text(result.detail)}</small>
              </button>
            )) : <p>{t("일치하는 최신 행정구역이 없습니다.")}</p>)}
          </div>
        ))}
      </div>

      <nav className="map-breadcrumb" aria-label={t("행정구역 단계")}>
        <button aria-current={level === "sido" ? "page" : undefined} onClick={() => resetTo("sido")} type="button">{t("시/도")}</button>
        {text(selection.sido && <><span>›</span><button aria-current={level === "city" ? "page" : undefined} onClick={() => resetTo("city")} type="button">{text(selection.sido)}</button></>)}
        {text(selection.city && <><span>›</span><button aria-current={(level === "district" || (oneTierSelection && level === "dong" && !selection.dong)) ? "page" : undefined} onClick={resetCityOrDistrict} type="button">{text(selection.city)}</button></>)}
        {text(selection.district && !oneTierSelection && <><span>›</span><button aria-current={level === "dong" && !selection.dong ? "page" : undefined} type="button">{text(selection.district)}</button></>)}
        {text(selection.dong && <><span>›</span><button aria-current="page" type="button">{text(selection.dong)}</button></>)}
      </nav>

      <div className="admin-map-shell">
        <div className="admin-boundary-map" role="application" aria-label={t("대한민국 행정구역 경계 지도")}>
          {text(!boundaries && !boundaryError && <div className="map-loading"><i aria-hidden="true" />{t(" 최신 행정경계를 불러오는 중입니다")}</div>)}
          {text(boundaryError && <div className="empty-map">{t("행정경계 데이터를 불러오지 못했습니다. 잠시 후 새로고침해주세요.")}</div>)}
          {text(bounds && (
            <svg aria-label={t(`${level} 단계 행정구역`)} className={shapes.length > 20 ? "dense" : ""} role="img" viewBox={`0 0 720 ${mapHeight}`}>
              {text(shapes.map((shape) => {
                const projected = projectedShape(shape, bounds);
                return (
                  <g
                    aria-label={t(`${shape.name}${displayStatus !== "loaded" ? ", 신호 미확인" : shape.signalCount ? `, 공개 신호 ${shape.signalCount}건` : ", 공개 신호 없음"}`)}
                    className={shape.signalCount ? "has-signal" : ""}
                    key={shape.id}
                    onClick={() => moveTo(shape)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") moveTo(shape); }}
                    role="button"
                    tabIndex={0}
                  >
                    <path d={projected.path}  />

                  </g>
                );
              }))}
              <g className="map-label-layer">
                {mapLabels.map(label => {const shape=shapes.find(item=>item.id===label.id)!;return <g key={label.id} role="button" tabIndex={0} aria-label={`${shape.name} 지역 선택`} onClick={()=>moveTo(shape)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();moveTo(shape);}}}>
                  {(Math.abs(label.x-label.anchorX)>8||Math.abs(label.y-label.anchorY)>8)&&<line x1={label.anchorX} y1={label.anchorY} x2={label.x} y2={label.y} stroke="#547368" strokeWidth="1"/>}
                  <rect x={label.x-label.width/2} y={label.y-13} width={label.width} height={22} rx={5} fill="#fffdf7" fillOpacity="0.96"/>
                  <text x={label.x} y={label.y+3}>{label.text}</text>
                </g>;})}
              </g>
            </svg>
          ))}
        </div>
        <div className="admin-region-list" aria-label={t("현재 단계 행정구역 목록")}>
          {text(shapes.map((shape) => (
            <button className={shape.signalCount ? "has-signal" : ""} key={shape.id} onClick={() => moveTo(shape)} type="button">
              <span>{shape.name}</span><strong>{text(shape.signalCount ? `${shape.signalCount}건` : "–")}</strong>
            </button>
          )))}
        </div>
      </div>

      {testMap.allowed && testMap.loaded && <MapVenues key={`${startDate}:${endDate}:${category}:${JSON.stringify(selection)}`} reports={testMap.reports} selection={selection} start={startDate} end={endDate} category={category} scope="all"/>}
      {text(displayStatus === "error" ? <div className="no-signal-card" role="alert"><p>{t("신호를 불러오지 못했습니다. 신고가 없다는 뜻은 아닙니다.")}</p><button type="button" className="secondary-button" onClick={() => { setSignalStatus("loading"); setSignalRefresh((value) => value + 1); }}>{t("다시 불러오기")}</button></div>
        : displayStatus === "loading" ? <div className="no-signal-card" role="status">{t("공개 가능한 신고 신호를 확인하고 있습니다.")}</div>
        : selection.sido ? <RegionSummaryCard region={selectedRegionLabel(selection)} signals={selectedSignals} /> : activeSignal ? <SignalCard signal={activeSignal} /> : <div className="no-signal-card">{t("선택한 기간과 음식 유형에 공개할 수 있는 신호가 없습니다. 신고가 전혀 없다는 뜻은 아닙니다.")}</div>)}

      <RegionalHelp region={selectedRegion} selection={helpSelection} />

      <p className="map-privacy-note"><span aria-hidden="true">◎</span>{t("경계는 최신 행정동 기준이며, 신호는 음식점 위치가 아닌 공개 가능한 행정구역에만 표시합니다.")}</p>
      <details className="privacy-explainer">
        <summary>{t("어떤 신호가 지도에 공개되나요?")}</summary>
        <div>
          <p>{t("같은 음식점에서 ")}<strong>{t("72시간 이내에 식사한 서로 다른 계정 3명 이상")}</strong>{t("이 같은 음식 유형과 위장관 증상을 신고하면 공개 기준을 확인합니다.")}</p>
          <p>{t("같은 음식 유형의 업소가 적으면 ")}<strong>{t("동 → 구 → 시")}</strong>{t(" 순서로 지역을 넓혀 특정 업소를 추측하기 어렵게 만듭니다.")}</p>
          <p>{t("동행 증상자는 독립 신고 건수에 포함하지 않으며, 작은 세부 수치는 숨길 수 있습니다.")}</p>
          <p>{t("음식점과 지역 내 동일 유형 업소 수를 확인할 수 없으면 공개하지 않습니다. 지도는 1분마다 새로 확인하며, 신고 수정·제외는 재집계 후 반영됩니다.")}</p>
        </div>
      </details>
    </section>
  );
}
