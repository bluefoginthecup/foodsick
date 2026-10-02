import assert from "node:assert/strict";
import test from "node:test";
import { validateReportDraft, reportFieldId, serverReportIssue } from "../app/report/validation.ts";

const valid = () => ({ mealDate: "2026-10-01", mealTime: "12:00", province: "경기도", city: "용인시 기흥구", district: "영덕1동", restaurantInternalId: "kakao_100", restaurantDisplayInput: "테스트 식당", foodCategory: "한식", foodCategoryDetail: "", serviceMode: "dine_in", symptoms: ["복통"], diarrheaCount: 0, onsetDate: "2026-10-01", onsetTime: "14:00", partyTotal: 1, partySymptomatic: 0, companions: [] });
test("missing inputs are assigned to their exact wizard step and focus target", () => {
  const issues = validateReportDraft({ ...valid(), mealDate: "", city: "", symptoms: [], onsetTime: "" }, false);
  assert.deepEqual(issues.map(({field, step}) => [field, step]), [["mealDate", 0], ["city", 0], ["onsetTime", 1], ["symptoms", 1], ["consent", 3]]);
  assert.equal(reportFieldId("restaurantInternalId"), "restaurant-query");
  assert.equal(serverReportIssue("symptomOnsetAt").step, 1);
});
test("conditional details, time order, and optional companion ages are validated", () => {
  assert.deepEqual(validateReportDraft(valid(), true), []);
  assert.ok(validateReportDraft({ ...valid(), foodCategory: "기타" }, true).some(i => i.field === "foodCategoryDetail"));
  assert.ok(validateReportDraft({ ...valid(), onsetTime: "10:00" }, true).some(i => i.field === "onsetDate"));
  assert.ok(validateReportDraft({ ...valid(), companions: [{ age: 150 }] }, true).some(i => i.field === "companion-age-0"));
  assert.deepEqual(validateReportDraft({ ...valid(), companions: [{ age: "" }] }, true), []);
});
