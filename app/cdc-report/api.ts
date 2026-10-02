import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "../firebase/client";
import type { CdcDraft } from "../../functions/src/domain/cdc";
export type CdcReport = { id: string; ownerUid: string; draft: CdcDraft; revision: number; status: string; reviewNote: string; createdAt: string; updatedAt: string; formVersion: string };
export type CdcPage = { reports: CdcReport[]; nextCursor: string | null };
const key = "foodsick.cdc-demo";
function read(): CdcReport[] { try { return JSON.parse(sessionStorage.getItem(key) ?? "[]"); } catch { return []; } }
function write(items: CdcReport[]) { sessionStorage.setItem(key, JSON.stringify(items)); }
async function call<T>(name: string, data: unknown) {
  const client = getFirebaseClient();
  if (!client) throw new Error("서비스에 연결하지 못했습니다.");
  return (await httpsCallable<unknown, T>(client.functions, name)(data)).data;
}
export function listCdc(real: boolean, uid: string, options: { admin?: boolean; ownerUid?: string; cursor?: string; id?: string } = {}): Promise<CdcPage> {
  if (real) return call("listCdcReports", options);
  return Promise.resolve({ reports: read().filter(r => (options.admin ? !options.ownerUid || r.ownerUid === options.ownerUid : r.ownerUid === uid) && (!options.id || options.id === r.id)).reverse(), nextCursor: null });
}
export async function saveCdc(real: boolean, uid: string, id: string, revision: number, draft: CdcDraft) {
  if (real) return call<{ id: string; revision: number }>("saveCdcReport", { id, revision, draft });
  const items = read(); const previous = items.find(r => r.id === id);
  if (previous && (previous.ownerUid !== uid || previous.revision !== revision)) throw new Error("신고를 다시 불러와주세요.");
  const now = new Date().toISOString();
  write([...items.filter(r => r.id !== id), { id, ownerUid: uid, draft, revision: revision + 1, status: "submitted", reviewNote: "", createdAt: previous?.createdAt ?? now, updatedAt: now, formVersion: "nhgq-2025-ko-pilot-v1" }]);
  return { id, revision: revision + 1 };
}
export async function deleteCdc(real: boolean, uid: string, id: string) {
  if (real) return call("deleteCdcReport", { id });
  write(read().filter(r => !(r.id === id && r.ownerUid === uid)));
}
export async function reviewCdc(real: boolean, report: CdcReport, note: string) {
  if (real) return call("reviewCdcReport", { id: report.id, revision: report.revision, note });
  write(read().map(r => r.id === report.id ? { ...r, status: "reviewed", reviewNote: note } : r));
}
