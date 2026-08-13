import assert from "node:assert/strict";
import test from "node:test";
import { LawFirmInputError, requireAdmin, validateLawFirmApplication } from "../app/law-firms/server.ts";

const base = {
  firmName: "법무법인 안전",
  branchName: "용인지점",
  representativeLawyer: "김안전",
  barRegistrationNumber: "12345",
  phone: "02-1234-5678",
  website: "https://example.com",
  address: "경기도 용인시 기흥구",
  region: "서울·경기",
  consultationModes: ["방문", "전화"],
  introduction: "식품 안전 사건 상담",
};

test("accepts a private case-number reference without requiring public case details", () => {
  const result = validateLawFirmApplication({
    ...base,
    experience: { evidenceType: "case_number", courtName: "서울중앙지방법원", caseNumber: "2024가단12345", precedentUrl: "", eventRegion: "", eventMonth: "", victimCountBand: "", caseCount: 2 },
  });
  assert.equal(result.experience.caseNumber, "2024가단12345");
  assert.equal(result.experience.caseCount, 2);
});

test("requires anonymized region, month and victim band when no case number is provided", () => {
  assert.throws(() => validateLawFirmApplication({
    ...base,
    experience: { evidenceType: "summary", eventRegion: "", eventMonth: "2026-08", victimCountBand: "2~5명", caseCount: 1 },
  }), LawFirmInputError);
  const result = validateLawFirmApplication({
    ...base,
    experience: { evidenceType: "summary", courtName: "", caseNumber: "", precedentUrl: "", eventRegion: "경기도 용인시", eventMonth: "2026-08", victimCountBand: "2~5명", caseCount: 1 },
  });
  assert.equal(result.experience.eventRegion, "경기도 용인시");
});

test("admin review fails closed unless an authenticated email is explicitly configured", () => {
  const previous = process.env.ADMIN_EMAILS;
  const request = new Request("https://example.com/api/law-firms/admin", {
    headers: {
      "oai-authenticated-user-id": "user-1",
      "oai-authenticated-user-email": "admin@example.com",
    },
  });
  try {
    delete process.env.ADMIN_EMAILS;
    assert.equal(requireAdmin(request), null);
    process.env.ADMIN_EMAILS = "admin@example.com";
    assert.equal(requireAdmin(request)?.email, "admin@example.com");
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previous;
  }
});
