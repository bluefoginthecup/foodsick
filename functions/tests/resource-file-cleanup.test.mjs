import assert from "node:assert/strict";
import { mock, test } from "node:test";
const deleted = [];
mock.module("../lib/firebase.js", { namedExports: { db: {} } });
mock.module("../lib/resource-file-store.js", { namedExports: { attachmentBucket: () => ({}), removeResourceFile: async (postId, id) => deleted.push(`${postId}/${id}`) } });
const { cleanRemovedAttachments } = await import("../lib/resource-file-cleanup.js");
test("post edit, deletion and withdrawal cleanup preserve files still attached", async () => {
  await cleanRemovedAttachments("post", [{ id: "kept" }, { id: "removed" }], [{ id: "kept" }, { id: "new" }]);
  assert.deepEqual(deleted, ["post/removed"]);
  await cleanRemovedAttachments("post", [{ id: "kept" }, { id: "new" }], []);
  assert.deepEqual(deleted, ["post/removed", "post/kept", "post/new"]);
});
