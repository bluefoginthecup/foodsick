import fs from 'node:fs';
const file = 'app/admin/analytics-panel.tsx';
let source = fs.readFileSync(file, 'utf8');
const replacements = [
  ['const { t } = useI18n();', 'const { t, locale } = useI18n();'],
  ['audit.data.auditId);', 'audit.data.auditId, t);'],
  ['toLocaleString("ko-KR",', 'toLocaleString(locale,'],
  ['>증상 신고</option>', '>{t("증상 신고")}</option>'],
  ['>CDC 신고</option>', '>{t("CDC 신고")}</option>'],
  ['>두 양식 전체</option>', '>{t("두 양식 전체")}</option>'],
  ['>신고일 (한국 시간)</option>', '>{t("신고일 (한국 시간)")}</option>'],
  ['>식사일</option>', '>{t("식사일")}</option>'],
  ['>전체</option>', '>{t("전체")}</option>'],
  ['placeholder="지역 이름 검색"', 'placeholder={t("지역 이름 검색")}'],
  ['placeholder="음식점 이름 검색"', 'placeholder={t("음식점 이름 검색")}'],
  ['<option key={s}>{s}</option>', '<option value={s} key={s}>{t(s)}</option>'],
  ['<option value={k} key={k}>{v}</option>', '<option value={k} key={k}>{t(v)}</option>'],
  ['>{r.label}</button>', '>{["regions", "restaurants"].includes(group) ? r.label : t(r.label)}</button>'],
  ['{answerLabels[filters.detailKey] ?? filters.detailKey}', '{t(answerLabels[filters.detailKey] ?? filters.detailKey)}'],
  ['{summary.unknownCompanions}건.', '{summary.unknownCompanions} {t("건")}.'],
  ['`${answerLabels[r.key] ?? r.key} ${r.count}건`', '`${t(answerLabels[r.key] ?? r.key)}: ${r.count}`'],
  ['{r.source === "cdc" ? "CDC" : "증상 신고"}', '{r.source === "cdc" ? "CDC" : t("증상 신고")}'],
  ['{statusLabels[r.status] ?? r.status}', '{t(statusLabels[r.status] ?? r.status)}'],
  ['{memberLabels[r.memberType]}', '{t(memberLabels[r.memberType])}'],
  ['{r.reviewNote || "없음"}', '{r.reviewNote || t("없음")}'],
  ['<dt>{k}</dt>', '<dt>{t(k)}</dt>'],
  ['{r.source === "cdc" ? "식사 기록" : "동행자"}', '{t(r.source === "cdc" ? "식사 기록" : "동행자")}'],
];
for (const [before, after] of replacements) source = source.replaceAll(before, after);
fs.writeFileSync(file, source);
