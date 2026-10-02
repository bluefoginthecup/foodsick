import fs from 'node:fs';
const changes = {
  'app/signal-map.tsx': [['{text(slot.contact.name)}', '{slot.contact.name}'], ['{text(feedbackContact.name)}', '{feedbackContact.name}'], ['{text(shape.name)}', '{shape.name}']],
  'app/report/region-select.tsx': [['{text(name)}', '{name}'], ['{text(selected)}', '{selected}']],
  'app/my-reports/page.tsx': [['{text(report.draft.restaurantDisplayInput)}', '{report.draft.restaurantDisplayInput}']],
  'app/admin/report-review.tsx': [['{text(report.draft?.restaurantDisplayInput || "상호명 기록 없음")}', '{report.draft?.restaurantDisplayInput || t("상호명 기록 없음")}']],
  'app/admin/member-list.tsx': [['{text(member.nickname || "별명 미설정")}', '{member.nickname || t("별명 미설정")}']],
  'app/admin/test-members.tsx': [['{text(m.nickname)}', '{m.nickname}']],
  'app/admin/law-firm-review.tsx': [['{text(lawyer.name)}', '{lawyer.name}']],
  'app/admin/page.tsx': [['{text(item.contact.name)}', '{item.contact.name}']],
  'app/cdc-report/page.tsx': [['{text(p.name)}', '{p.name}'], ['{text(p.address)}', '{p.address}']],
};
for (const [file, pairs] of Object.entries(changes)) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of pairs) source = source.replaceAll(before, after);
  fs.writeFileSync(file, source);
}
