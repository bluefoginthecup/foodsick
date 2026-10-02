"use client";

import { useEffect, useState } from "react";

type Regions = Record<string, Record<string, string[]>>;
type Selection = { province: string; city: string; district: string };

export function ReportRegionSelect({ value, onChange }: { value: Selection; onChange: (value: Selection) => void }) {
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
  const legacy = (selected: string, options: string[]) => selected && !options.includes(selected) ? <option value={selected}>{selected} (기존 입력)</option> : null;
  return <div className="report-region-select">
    <div className="field-row region-row">
      <label>시/도<select required disabled={!regions} value={value.province} onChange={(e) => onChange({ province: e.target.value, city: "", district: "" })}>
        <option value="">{regions ? "시/도 선택" : "지역 목록 불러오는 중"}</option>{legacy(value.province, provinces)}
        {provinces.map((name) => <option key={name}>{name}</option>)}
      </select></label>
      <label>시/군/구<select required disabled={!regions || !value.province} value={value.city} onChange={(e) => onChange({ province: value.province, city: e.target.value, district: "" })}>
        <option value="">{value.province ? "시/군/구 선택" : "시/도를 먼저 선택"}</option>{legacy(value.city, cities)}
        {cities.map((name) => <option key={name}>{name}</option>)}
      </select></label>
    </div>
    <label>읍/면/동<select required disabled={!regions || !value.city} value={value.district} onChange={(e) => onChange({ province: value.province, city: value.city, district: e.target.value })}>
      <option value="">{value.city ? "읍/면/동 선택" : "시/군/구를 먼저 선택"}</option>{legacy(value.district, dongs)}
      {dongs.map((name) => <option key={name}>{name}</option>)}
    </select></label>
    {error && <p role="alert" className="region-load-error">지역 목록을 불러오지 못했습니다. <button type="button" onClick={() => { setError(false); setRetry((n) => n + 1); }}>다시 불러오기</button></p>}
  </div>;
}
