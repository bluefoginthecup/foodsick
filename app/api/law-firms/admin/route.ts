import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, authenticatedAdmin } from "../../../../server/firebase-admin";

function iso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  if (!(await authenticatedAdmin(request))) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const snapshot = await adminDb.collection("lawFirmApplications").limit(200).get();
  const applications = snapshot.docs.map((doc) => {
    const application = doc.data();
    return {
      id: doc.id,
      ...application,
      createdAt: iso(application.createdAt) ?? new Date().toISOString(),
      updatedAt: iso(application.updatedAt) ?? new Date().toISOString(),
      verifiedAt: iso(application.verifiedAt),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ applications });
}

export async function PATCH(request: Request) {
  if (!(await authenticatedAdmin(request))) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const payload = await request.json() as { id?: string; status?: string; note?: string };
  const id = payload.id?.trim();
  const status = payload.status === "verified" ? "verified" : payload.status === "rejected" ? "rejected" : null;
  if (!id || !status) return Response.json({ error: "검토 상태를 확인해주세요." }, { status: 400 });
  const reference = adminDb.collection("lawFirmApplications").doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return Response.json({ error: "등록 신청을 찾을 수 없습니다." }, { status: 404 });
  const experience = snapshot.get("experience") as Record<string, unknown>;
  await reference.update({
    status,
    reviewNote: payload.note?.trim().slice(0, 300) ?? "",
    verifiedAt: status === "verified" ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp(),
    experience: { ...experience, verificationStatus: status },
  });
  return Response.json({ ok: true });
}
