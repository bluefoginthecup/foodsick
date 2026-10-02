"use client";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "../firebase/client";
import type { Resource } from "./data";
import type { Attachment } from "../../functions/src/domain/attachment-policy";
export type { Attachment } from "../../functions/src/domain/attachment-policy";

export type PostDraft = Omit<Resource, "id">;
export type ResourcePost = Resource & { attachments?: Attachment[]; createdAt: string; updatedAt: string; ownerUid?: string; revision?: number; status?: "pending" | "approved" | "rejected"; reviewNote?: string };
export type PostScope = "public" | "mine" | "admin";
async function call<T>(name: string, data: unknown) {
  const client = getFirebaseClient();
  if (!client) throw new Error("게시판 연결 설정이 필요합니다.");
  return (await httpsCallable<unknown, T>(client.functions, name, { timeout: 180000 })(data)).data;
}
export const listPosts = (scope: PostScope, cursor?: string) => call<{ posts: ResourcePost[]; nextCursor: string | null }>("listResourcePosts", { scope, ...(cursor ? { cursor } : {}) });
export type AttachmentInput = { id: string } | { name: string; base64: string };
export const savePost = (id: string, revision: number, draft: PostDraft, attachments?: AttachmentInput[]) => call<{ status: string }>("saveResourcePost", { id, revision, draft, ...(attachments ? { attachments } : {}) });
export async function downloadAttachment(postId: string, fileId: string) {
  const result = await call<{ name: string; base64: string }>("downloadResourceAttachment", { postId, fileId });
  const decoded = atob(result.base64);
  const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url; link.download = result.name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const reviewPost = (post: ResourcePost, status: "approved" | "rejected", note: string) => call("reviewResourcePost", { id: post.id, revision: post.revision, status, note });
export const deletePost = (post: ResourcePost) => call("deleteResourcePost", { id: post.id, revision: post.revision });
