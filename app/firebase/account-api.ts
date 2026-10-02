import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "./client";
export type MyAccount = { uid: string; nickname: string; provider: string; createdAt: string | null; lastLoginAt: string | null };
function client() {
  const firebase = getFirebaseClient();
  if (!firebase) throw new Error("계정 서비스에 연결하지 못했습니다.");
  return firebase.functions;
}
export async function getMyAccount() {
  return (await httpsCallable<Record<string, never>, MyAccount>(client(), "getMyAccount")({})).data;
}
export async function updateMyAccount(nickname: string) {
  return (await httpsCallable<{ nickname: string }, { nickname: string }>(client(), "updateMyAccount")({ nickname })).data;
}

export async function withdrawMyAccount() {
  return (await httpsCallable<{ confirmation: string }, { accepted: boolean }>(client(), "withdrawMyAccount")({ confirmation: "탈퇴" })).data;
}
