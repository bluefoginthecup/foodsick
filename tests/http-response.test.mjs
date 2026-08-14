import test from "node:test";
import assert from "node:assert/strict";
import { readJsonResponse } from "../app/http-response.ts";

test("reads JSON API responses", async () => {
  const payload = await readJsonResponse(Response.json({ ok: true }), "요청 실패");
  assert.deepEqual(payload, { ok: true });
});

test("turns non-JSON server failures into a stable user-facing error", async () => {
  const response = new Response("Internal Server Error", {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
  await assert.rejects(() => readJsonResponse(response, "연락처를 불러오지 못했습니다"), {
    message: "연락처를 불러오지 못했습니다 (500)",
  });
});
