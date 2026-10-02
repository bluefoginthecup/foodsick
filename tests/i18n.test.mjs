import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { detectLocale, requestLocale, translateText, locales } from '../app/i18n/core.ts';
import { validateReportDraft } from '../app/report/validation.ts';

test('language negotiation supports all five languages, explicit choice and unsupported fallback', () => {
  assert.equal(detectLocale(['ko-KR']), 'ko');
  assert.equal(detectLocale(['en-GB']), 'en');
  assert.equal(detectLocale(['zh-TW']), 'zh-CN');
  assert.equal(detectLocale(['ja-JP']), 'ja');
  assert.equal(detectLocale(['vi-VN']), 'vi');
  assert.equal(detectLocale(['fr-FR']), 'en');
  assert.equal(detectLocale(['fr-FR', 'ja']), 'ja');
  assert.equal(requestLocale('other=1; nadoapa_language=vi', 'ko-KR,en;q=0.9'), 'vi');
  assert.equal(requestLocale('nadoapa_language=bad', 'ja;q=0.8,zh-CN;q=0.9'), 'zh-CN');
  assert.equal(requestLocale(null, 'ko;q=0,en;q=0.9'), 'en');
  assert.equal(requestLocale(null, null), 'ko');
  assert.equal(requestLocale(null, '*'), 'ko');
});

test('every extracted display message has a non-empty translation with intact placeholders', () => {
  const source = JSON.parse(fs.readFileSync(new URL('../app/i18n/source-messages.json', import.meta.url)));
  const slots = value => [...value.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
  for (const language of locales.filter(l => l !== 'ko')) {
    const catalog = JSON.parse(fs.readFileSync(new URL(`../app/i18n/${language}.json`, import.meta.url)));
    for (const key of source) {
      assert.ok(catalog[key]?.trim(), `${language}: missing ${key}`);
      assert.deepEqual(slots(catalog[key]), slots(key), `${language}: interpolation ${key}`);
    }
  }
});

test('translations handle validation, lists, counts and keep unknown original text', () => {
  assert.equal(translateText('설사, 구토', 'en'), 'Diarrhea, Vomiting');
  assert.equal(translateText('설사 · 구토', 'ja'), '下痢 · 嘔吐');
  assert.equal(translateText('  필수 ', 'en'), '  Required ');
  assert.equal(translateText('Private restaurant α: arbitrary original text', 'vi'), 'Private restaurant α: arbitrary original text');
  assert.match(translateText('동행자 2의 나이는 0~120 사이의 정수로 입력해주세요.', 'en'), /2/);
  assert.doesNotMatch(translateText('동행자 2의 나이는 0~120 사이의 정수로 입력해주세요.', 'en'), /[가-힣]/);
  assert.equal(translateText('설사', 'ko'), '설사');
  for (const language of locales.filter(l => l !== 'ko')) {
    assert.doesNotMatch(translateText('4시간 30분', language), /\{\d+\}/);
  }
});

test('rendering translated choices does not change canonical report values', () => {
  const draft = { mealDate: '2026-10-01', mealTime: '12:00', province: '경기도', city: '용인시 기흥구', district: '영덕1동', restaurantInternalId: 'kakao_100', restaurantDisplayInput: '테스트 식당', foodCategory: '한식', foodCategoryDetail: '', serviceMode: 'dine_in', symptoms: ['복통'], diarrheaCount: 0, onsetDate: '2026-10-01', onsetTime: '14:00', partyTotal: 1, partySymptomatic: 0, companions: [] };
  const original = structuredClone(draft);
  for (const language of locales) {
    translateText(draft.foodCategory, language);
    draft.symptoms.map(symptom => translateText(symptom, language));
    assert.deepEqual(validateReportDraft(draft, true), []);
    assert.deepEqual(draft, original);
  }
});
