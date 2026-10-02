import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebase.js";
import { attachmentBucket, removeResourceFile } from "./resource-file-store.js";
import type { Attachment } from "./domain/attachment-policy.js";

export async function cleanRemovedAttachments(postId: string, before: Attachment[], after: Attachment[]) {
  const kept = new Set(after.map(file => file.id));
  for (const file of before) if (!kept.has(file.id)) await removeResourceFile(postId, file.id);
}

// Also handles account withdrawal, which deletes the member's resource posts.
export const cleanupResourceAttachments = onDocumentWritten({ document: "resourcePosts/{postId}", region: "asia-northeast3", retry: true, timeoutSeconds: 120 }, async event => {
  if (!event.data) return;
  await cleanRemovedAttachments(event.params.postId, event.data.before.get("attachments") ?? [], event.data.after.get("attachments") ?? []);
});

export const sweepResourceAttachments = onSchedule({ schedule: "every 24 hours", region: "asia-northeast3", timeoutSeconds: 540, maxInstances: 1, concurrency: 1, retryCount: 3 }, async () => {
  const state = db.collection("resourceAttachmentMaintenance").doc("sweep");
  const cursor = (await state.get()).get("pageToken");
  const [files, next] = await attachmentBucket().getFiles({ prefix: "resource-attachments/", autoPaginate: false, maxResults: 1000, ...(cursor ? { pageToken: cursor } : {}) });
  for (const file of files) {
    const match = /^resource-attachments\/([\w-]{1,128})\/([\w-]{1,128})$/.exec(file.name);
    const created = Date.parse(file.metadata.timeCreated ?? "");
    if (!match || !Number.isFinite(created) || Date.now() - created < 24 * 60 * 60 * 1000) continue;
    const post = await db.collection("resourcePosts").doc(match[1]!).get();
    if (!(post.get("attachments") ?? []).some((item: Attachment) => item.id === match[2])) await file.delete({ ignoreNotFound: true });
  }
  await state.set({ pageToken: next?.pageToken ?? null });
});
