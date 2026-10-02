import fs from 'node:fs';
const locales = ['en', 'zh-CN', 'ja', 'vi'];
const reviewed = JSON.parse(fs.readFileSync('app/i18n/reviewed.json', 'utf8'));
for (const [index, locale] of locales.entries()) {
  const file = `app/i18n/${locale}.json`;
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [key, translations] of Object.entries(reviewed)) catalog[key] = translations[index];
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
}
console.log(`Applied ${Object.keys(reviewed).length} reviewed translations to each locale`);
