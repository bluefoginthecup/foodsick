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
  assert.doesNotMatch(html, /교동면옥|상호명|도로명주소/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
