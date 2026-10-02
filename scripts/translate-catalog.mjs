// Development-only catalog generation. No user data or runtime translation calls.
import fs from 'node:fs';
const source = JSON.parse(fs.readFileSync('app/i18n/source-messages.json', 'utf8'));
const targets = ['en', 'zh-CN', 'ja', 'vi'];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function translate(text, target) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.search = new URLSearchParams({ client: 'gtx', sl: 'ko', tl: target, dt: 't', q: text }).toString();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
      const result = await response.json();
      return result[0].map(part => part[0] || '').join('');
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1500 * (attempt + 1));
    }
  }
}
await Promise.all(targets.map(async target => {
  const file = `app/i18n/${target}.json`;
  const catalog = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const pending = source.filter(key => !catalog[key]);
  let done = 0;
  while (done < pending.length) {
    const batch = [];
    let length = 0;
    while (done + batch.length < pending.length && batch.length < 18 && length < 2200) {
      const key = pending[done + batch.length];
      batch.push(key); length += key.length + 12;
    }
    const input = batch.map((key, i) => `${String(i).padStart(4, '0')}: ${key}`).join('\n');
    const output = await translate(input, target);
    const parsed = new Map([...output.matchAll(/(\d{4})\s*[:：]\s*([\s\S]*?)(?=\d{4}\s*[:：]|$)/g)].map(m => [Number(m[1]), m[2].trim()]));
    for (const [i, key] of batch.entries()) {
      let value = parsed.size === batch.length ? parsed.get(i) : null;
      if (!value || [...key.matchAll(/\{\d+\}/g)].some(m => !value.includes(m[0]))) value = await translate(key, target);
      catalog[key] = value;
    }
    done += batch.length;
    fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
    if (done % 180 < 18 || done === pending.length) console.log(`${target}: ${Object.keys(catalog).length}/${source.length}`);
    await sleep(150);
  }
}));
