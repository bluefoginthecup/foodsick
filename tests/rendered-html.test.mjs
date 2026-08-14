import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 32000 + Math.floor(Math.random() * 2000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, ["scripts/start-production.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Production test server did not start")), 10_000);
    server.once("error", reject);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Production server running")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => {
      if (String(chunk).includes("Server error")) {
        clearTimeout(timeout);
        reject(new Error(String(chunk)));
      }
    });
  });
});

after(() => {
  server?.kill();
});

async function render(pathname = "/") {
  return fetch(`${baseUrl}${pathname}`, { headers: { accept: "text/html" } });
}

test("keeps Firebase-backed API failures as JSON", async () => {
  const endpoints = [
    "/api/law-firms",
    "/api/restaurants/search?q=%EC%98%81%EB%8D%95%EA%B0%88%EB%B9%84&region=%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EC%9A%A9%EC%9D%B8%EC%8B%9C",
    "/api/regional-contacts?sido=%EC%9A%B8%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C&city=%EC%9A%B8%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C&district=%EC%A4%91%EA%B5%AC&dong=",
  ];
  for (const endpoint of endpoints) {
    const response = await fetch(`${baseUrl}${endpoint}`, { headers: { accept: "application/json" } });
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    const payload = await response.json();
    assert.equal(typeof payload.error, "string");
  }
});

test("renders the Korean mobile-first foundation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /나만 아픈 걸까/);
  assert.match(html, /전체 메뉴 열기/);
  assert.match(html, /지도·신고/);
  assert.match(html, /기관·의료/);
  assert.match(html, /법률지원/);
  assert.match(html, /관리자 검토실/);
  assert.match(html, /음식점 이름과 정확한 위치는 공개하지 않아요/);
  assert.match(html, /지금 모인 신호/);
  assert.match(html, /모의 데이터/);
  assert.match(html, /최근 1년 조회 가능/);
  assert.match(html, /대한민국 행정구역 경계 지도/);
  assert.match(html, /행정구역 검색/);
  assert.match(html, /예: 울산 중구/);
  assert.match(html, /관할기관·의료기관 찾기/);
  assert.match(html, /응급실 찾기/);
  assert.match(html, /119 전화/);
  assert.match(html, /식중독 신고·문의/);
  assert.match(html, /지역 선택 후 자동 조회/);
  assert.match(html, /지역별 서버 캐시에 저장해 즉시 표시하고/);
  assert.match(html, /최신 전화번호는 뒤에서 확인합니다/);
  assert.match(html, /구글에서 먼저 확인/);
  assert.match(html, /구글 검색은 AI 요약과 검색결과를 통한 보조 확인 수단/);
  assert.doesNotMatch(html, /031-6193-6303/);
  assert.doesNotMatch(html, /교동면옥|상호명|도로명주소/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("renders Kakao login without requesting profile data", async () => {
  const response = await render("/login");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /카카오로 시작하기/);
  assert.match(html, /프로필 이름·이메일을 요청하지 않아요/);
  assert.match(html, /체험 모드/);
});

test("renders the legal response, precedent, and verified law-firm directory", async () => {
  const response = await render("/law-help");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /상담 전에 준비하세요/);
  assert.match(html, /2018다260299/);
  assert.match(html, /식중독 사건 경험이 확인된 곳/);
  assert.doesNotMatch(html, /승소 보장|식중독 전문 로펌/);
});

test("renders private evidence fields for voluntary law-firm registration", async () => {
  const response = await render("/law-firms/register");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /사건번호로 확인/);
  assert.match(html, /익명 정보로 제출/);
  assert.match(html, /사건번호와 변호사 등록번호는 관리자 검증용/);
  assert.match(html, /변호사 추가/);
  assert.match(html, /사건기록 추가/);
});

test("keeps the report form behind authentication", async () => {
  const response = await render("/report");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /로그인이 필요해요/);
  assert.match(html, /카카오 로그인을 먼저 해주세요/);
});

test("keeps my reports behind the same session identity", async () => {
  const response = await render("/my-reports");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /내 신고를 보려면/);
  assert.match(html, /먼저 로그인해주세요/);
});

test("keeps the administrator area behind a role claim", async () => {
  const response = await render("/admin");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /관리자 권한이 필요합니다/);
  assert.match(html, /Firebase custom claim/);
});
