"use client";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "../firebase/client";
import type { Resource } from "./data";

export type PostDraft = Omit<Resource, "id">;
export type ResourcePost = Resource & { createdAt: string; updatedAt: string; ownerUid?: string; revision?: number; status?: "pending" | "approved" | "rejected"; reviewNote?: string };
export type PostScope = "public" | "mine" | "admin";
async function call<T>(name: string, data: unknown) {
  const client = getFirebaseClient();
  if (!client) throw new Error("게시판 연결 설정이 필요합니다.");
  return (await httpsCallable<unknown, T>(client.functions, name)(data)).data;
}
export const listPosts = (scope: PostScope, cursor?: string) => call<{ posts: ResourcePost[]; nextCursor: string | null }>("listResourcePosts", { scope, ...(cursor ? { cursor } : {}) });
export const savePost = (id: string, revision: number, draft: PostDraft) => call<{ status: string }>("saveResourcePost", { id, revision, draft });
export const reviewPost = (post: ResourcePost, status: "approved" | "rejected", note: string) => call("reviewResourcePost", { id: post.id, revision: post.revision, status, note });
export const deletePost = (post: ResourcePost) => call("deleteResourcePost", { id: post.id, revision: post.revision });
