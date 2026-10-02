"use client";
import { useI18n } from "../i18n/context";
import type { ReactNode } from "react";
import type { AdminReport } from "../firebase/report-api";

const genders: Record<string, string> = { female: "여성", male: "남성", other: "기타", undisclosed: "응답하지 않음" };
const modes: Record<string, string> = { dine_in: "매장", delivery: "배달", takeout: "포장" };
function value(input: unknown): ReactNode {
  if (input === true) return "예";
  if (input === false) return "아니요";
  if (Array.isArray(input)) return input.length ? input.join(", ") : "선택 없음";
  return input === "" || input === null || input === undefined ? "미입력" : String(input);
}
function Rows({ items }: { items: Array<[string, unknown]> }) {
  const { text } = useI18n();
  const translatedFields = new Set(["음식 유형", "이용 방식", "성별", "계산된 잠복시간"]);
  return <dl className="admin-detail-grid">{items.map(([label, input]) => <div key={label}><dt>{text(label)}</dt><dd>{translatedFields.has(label) || typeof input === "boolean" || Array.isArray(input) || input === "" || input === null || input === undefined ? text(value(input)) : value(input)}</dd></div>)}</dl>;
}
function date(input: string, locale: string) {
  return input ? new Date(input).toLocaleString(locale, { timeZone: "Asia/Seoul" }) : "기록 없음";
}
export function ReportDetails({ report }: { report: AdminReport }) {
  const { t, text, locale } = useI18n();
  const d = report.draft;
  return <div className="admin-report-details">
    <h3>{t("접수 정보")}</h3>
    <Rows items={[["신고 번호", report.id], ["신고자 식별값", report.ownerUid], ["접수일 (한국 시간)", date(report.createdAt, locale)], ["수정일 (한국 시간)", date(report.updatedAt, locale)], ["건강정보 동의 버전", report.sensitiveDataConsentVersion], ["계산된 잠복시간", report.incubationMinutes === null ? "계산 전" : `${report.incubationMinutes}분`]]} />
    {text(!d ? <p role="alert">{t("이 신고의 작성 원본을 불러올 수 없습니다.")}</p> : <>
      <h3>{t("식사 정보")}</h3>
      <Rows items={[["식사 날짜", d.mealDate], ["식사 시간", d.mealTime], ["시/도", d.province], ["시/군/구", d.city], ["읍/면/동", d.district], ["음식점 상호명", d.restaurantDisplayInput], ["음식점 식별값", d.restaurantInternalId], ["음식 유형", d.foodCategory], ["기타 음식 유형", d.foodCategoryDetail], ["먹은 메뉴", d.menu], ["이용 방식", modes[d.serviceMode] ?? d.serviceMode]]} />
      <h3>{t("본인 증상")}</h3>
      <Rows items={[["선택한 증상", d.symptoms], ["하루 설사 횟수", d.diarrheaCount], ["기타 증상 원문", d.otherSymptom], ["최초 증상 날짜", d.onsetDate], ["최초 증상 시간", d.onsetTime]]} />
      <h3>{t("동행자")}</h3>
      <Rows items={[["본인 포함 총 인원", d.partyTotal], ["본인 외 증상자", d.partySymptomatic]]} />
      {text((d.companions ?? []).map((person, index) => <section className="admin-companion-detail" key={index}>
        <h4>{t("동행 증상자 ")}{text(index + 1)}</h4>
        <Rows items={[["나이", person.age], ["성별", genders[person.gender] ?? person.gender], ["증상", person.symptoms], ["기타 증상 원문", person.otherSymptom], ["증상 시작시간", person.onsetAt], ["병원 방문", person.medicalVisit], ["검사 여부", person.tested], ["기저질환", person.underlyingConditions], ["기타 기저질환 원문", person.otherUnderlyingCondition]]} />
      </section>))}
      <details><summary>{t("동행자 공통 입력 기록")}</summary><Rows items={[["공통 증상", d.companionSymptoms], ["공통 증상 시작시간", d.companionOnsetAt], ["병원 방문 기록", d.companionMedicalVisit], ["검사 기록", d.companionTested]]} /></details>
      <h3>{t("본인 의료 정보")}</h3>
      <Rows items={[["병원 방문", d.medicalVisit], ["입원", d.hospitalized], ["대변검사 등 검사", d.tested], ["병원체 확인", d.pathogenKnown], ["병원체 종류 원문", d.pathogenType]]} />
    </>)}
  </div>;
}
