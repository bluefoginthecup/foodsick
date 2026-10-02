"use client";
import { useI18n } from "../i18n/context";


import { useEffect, useState } from "react";
import { reportFieldId, type ReportIssue } from "./validation";

type Regions = Record<string, Record<string, string[]>>;
type Selection = { province: string; city: string; district: string };

export function ReportRegionSelect({ value, onChange, errors = [] }: { value: Selection; onChange: (value: Selection) => void; errors?: ReportIssue[] }) {
  const { text, t } = useI18n();
  const [regions, setRegions] = useState<Regions | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/administrative-regions.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Region lookup failed");
        const payload = await response.json() as { regions: Regions };
        if (!payload.regions || Object.keys(payload.regions).length === 0) throw new Error("Invalid regions");
        if (!controller.signal.aborted) { setRegions(payload.regions); setError(false); }
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [retry]);
  const provinces = Object.keys(regions ?? {}).sort((a, b) => a.localeCompare(b, "ko"));
  const cities = Object.keys(regions?.[value.province] ?? {}).sort((a, b) => a.localeCompare(b, "ko"));
  const dongs = regions?.[value.province]?.[value.city] ?? [];
  const legacy = (selected: string, options: string[]) => selected && !options.includes(selected) ? <option value={selected}>{selected}{t(" (현재 선택)")}</option> : null;
  const errorFor = (field: string) => errors.find((issue) => issue.field === field);
  const attrs = (field: string) => ({ id: reportFieldId(field), "aria-label": t(({ province: "시/도", city: "시/군/구", district: "읍/면/동" } as Record<string, string>)[field]), "aria-invalid": !!errorFor(field), "aria-describedby": errorFor(field) ? `error-${field}` : undefined });
  const message = (field: string) => errorFor(field) ? <span className="field-error" id={`error-${field}`}>{text(errorFor(field)!.message)}</span> : null;
  return <div className="report-region-select">
    <div className="field-row region-row">
      <label>{t("시/도 ")}<span className="required-mark" aria-hidden="true">{t("필수")}</span><select {...attrs("province")} required disabled={!regions} value={value.province} onChange={(e) => onChange({ province: e.target.value, city: "", district: "" })}>
        <option value="">{text(regions ? "시/도 선택" : "지역 목록 불러오는 중")}</option>{text(legacy(value.province, provinces))}
        {text(provinces.map((name) => <option value={name} key={name}>{name}</option>))}
      </select>{text(message("province"))}</label>
      <label>{t("시/군/구 ")}<span className="required-mark" aria-hidden="true">{t("필수")}</span><select {...attrs("city")} required disabled={!regions || !value.province} value={value.city} onChange={(e) => onChange({ province: value.province, city: e.target.value, district: "" })}>
        <option value="">{text(value.province ? "시/군/구 선택" : "시/도를 먼저 선택")}</option>{text(legacy(value.city, cities))}
        {text(cities.map((name) => <option value={name} key={name}>{name}</option>))}
      </select>{text(message("city"))}</label>
    </div>
    <label>{t("읍/면/동 ")}<span className="required-mark" aria-hidden="true">{t("필수")}</span><select {...attrs("district")} required disabled={!regions || !value.city} value={value.district} onChange={(e) => onChange({ province: value.province, city: value.city, district: e.target.value })}>
      <option value="">{text(value.city ? "읍/면/동 선택" : "시/군/구를 먼저 선택")}</option>{text(legacy(value.district, dongs))}
      {text(dongs.map((name) => <option value={name} key={name}>{name}</option>))}
    </select>{text(message("district"))}</label>
    {text(error && <p role="alert" className="region-load-error">{t("지역 목록을 불러오지 못했습니다. ")}<button type="button" onClick={() => { setError(false); setRetry((n) => n + 1); }}>{t("다시 불러오기")}</button></p>)}
  </div>;
}
