import fs from 'node:fs';

function edit(file, change) {
  const before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, change(before));
}
// Whole sentences let each language use its own word order.
const sentences = {
  'app/report/report-wizard.tsx': [
    ['신고 화면을', '준비하고 있어요'], ['중복 신고를 줄이기 위해', '카카오 로그인을 먼저 해주세요'],
    ['저장된 내용을', '불러오고 있어요'], ['이 브라우저에 저장된', '신고가 아닙니다'], ['신고 내용을', '채우고 있어요'],
    ['언제, 어디서', '드셨나요?'], ['어떤 증상이', '있었나요?'], ['같이 드신 분도', '아팠나요?'], ['마지막으로', '확인해주세요'],
  ],
  'app/login/page.tsx': [['카카오 계정으로', '중복 신고를 줄여요']],
  'app/my-reports/page.tsx': [['내 신고를 보려면', '먼저 로그인해주세요']],
  'app/law-firms/register/page.tsx': [['식중독 사건 경험을', '검증받고 등록하세요']],
};
for (const [file, pairs] of Object.entries(sentences)) edit(file, s => {
  for (const [a, b] of pairs) s = s.replace(`{t("${a}")}<br />{t("${b}")}`, `{t("${a} ${b}")}`);
  return s;
});
edit('app/signal-map.tsx', s => s
  .replace('function formatObservedAt(value: string)', 'function formatObservedAt(value: string, locale: string)')
  .replaceAll('new Intl.DateTimeFormat("ko-KR",', 'new Intl.DateTimeFormat(locale,')
  .replace('formatObservedAt(signal.observedAt)', 'formatObservedAt(signal.observedAt, locale)')
  .replace('formatObservedAt(latest)', 'formatObservedAt(latest, locale)')
  .replace(/(function (?:RegionalHelp|SignalCard|RegionSummaryCard|SignalMap)[\s\S]*?const \{ )([^}]+)( \} = useI18n\(\);)/g, (whole, a, names, b) => names.includes('locale') ? whole : a + names + ', locale' + b)
  // Keep timestamp raw in state so a language change reformats it without a refetch.
  .replace('setLastChecked(new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date()));', 'setLastChecked(new Date().toISOString());')
  .replace('{text(lastChecked)}', '{text(lastChecked ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date(lastChecked)) : "")}'));
edit('app/admin/report-details.tsx', s => s
  .replace('function date(input: string)', 'function date(input: string, locale: string)')
  .replace('toLocaleString("ko-KR",', 'toLocaleString(locale,')
  .replace('date(report.createdAt)', 'date(report.createdAt, locale)')
  .replace('date(report.updatedAt)', 'date(report.updatedAt, locale)')
  .replace(/(function ReportDetails[\s\S]*?const \{ )([^}]+)( \} = useI18n\(\);)/, '$1$2, locale$3'));
// Never translate user-authored posts, names, notes, or proper addresses.
edit('app/resources/resource-directory.tsx', s => s.replace(/\{text\((post\.(?:title|source|language|originalTitle|description|takeaway|reviewNote))\)\}/g, '{$1}').replace('{text(tag)}', '{tag}'));
edit('app/admin/law-firm-review.tsx', s => s.replace(/\{text\((item\.(?:firmName|branchName|representativeLawyer|region))\)\}/g, '{$1}'));
edit('app/admin/page.tsx', s => s.replace('{text(event.note)}', '{event.note}'));
edit('app/report/report-wizard.tsx', s => s.replace('{text(draft.restaurantDisplayInput || "미입력")}', '{draft.restaurantDisplayInput || t("미입력")}'));
edit('app/cdc-report/report-list.tsx', s => s.replace('{text(report.draft.basic.place || "음식점 미입력")}', '{report.draft.basic.place || t("음식점 미입력")}'));
