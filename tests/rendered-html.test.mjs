import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the Korean mobile-first foundation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /나만 아픈 걸까/);
  assert.match(html, /음식점 이름과 정확한 위치는 공개하지 않아요/);
  assert.match(html, /지금 모인 신호/);
  assert.match(html, /모의 데이터/);
  assert.match(html, /최근 1년 조회 가능/);
  assert.match(html, /대한민국 행정구역 경계 지도/);
  assert.match(html, /관할기관·의료기관 찾기/);
  assert.match(html, /응급실 찾기/);
  assert.match(html, /119 전화/);
  assert.match(html, /식중독 신고·문의/);
  assert.match(html, /지역 선택 후 자동 조회/);
  assert.match(html, /행정안전부 조직정보와 지자체 공식 직원안내에서 6시간마다 다시 확인합니다/);
  assert.match(html, /구글 검색은 AI 요약과 검색결과를 통한 보조 확인 수단/);
  assert.doesNotMatch(html, /031-6193-6303/);
  assert.doesNotMatch(html, /교동면옥|상호명|도로명주소/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("renders Kakao login without requesting profile data", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("login-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/login", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /카카오로 시작하기/);
  assert.match(html, /프로필 이름·이메일을 요청하지 않아요/);
  assert.match(html, /체험 모드/);
});

test("renders the legal response, precedent, and verified law-firm directory", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("law-help-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/law-help", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /상담 전에 준비하세요/);
  assert.match(html, /2018다260299/);
  assert.match(html, /식중독 사건 경험이 확인된 곳/);
  assert.doesNotMatch(html, /승소 보장|식중독 전문 로펌/);
});

test("renders private evidence fields for voluntary law-firm registration", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("firm-register-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/law-firms/register", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /사건번호로 확인/);
  assert.match(html, /익명 정보로 제출/);
  assert.match(html, /사건번호와 변호사 등록번호는 관리자 검증용/);
});

test("keeps the report form behind authentication", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("report-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/report", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /로그인이 필요해요/);
  assert.match(html, /카카오 로그인을 먼저 해주세요/);
});

test("keeps my reports behind the same session identity", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("my-report-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/my-reports", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /내 신고를 보려면/);
  assert.match(html, /먼저 로그인해주세요/);
});

test("keeps the administrator area behind a role claim", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("admin-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/admin", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /관리자 권한이 필요합니다/);
  assert.match(html, /Firebase custom claim/);
});
