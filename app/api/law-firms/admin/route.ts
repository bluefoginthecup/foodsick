import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { lawFirmApplications, lawFirmExperiences } from "../../../../db/schema";
import { requireAdmin } from "../../../law-firms/server";

export async function GET(request: Request) {
  if (!requireAdmin(request)) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const db = getDb();
  const rows = await db.select({ application: lawFirmApplications, experience: lawFirmExperiences })
    .from(lawFirmApplications)
    .innerJoin(lawFirmExperiences, eq(lawFirmExperiences.applicationId, lawFirmApplications.id))
    .orderBy(desc(lawFirmApplications.createdAt));
  return Response.json({ applications: rows.map(({ application, experience }) => ({
    ...application,
    consultationModes: JSON.parse(application.consultationModes) as string[],
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    verifiedAt: application.verifiedAt?.toISOString() ?? null,
    experience,
  })) });
}

export async function PATCH(request: Request) {
  if (!requireAdmin(request)) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const payload = await request.json() as { id?: string; status?: string; note?: string };
  const id = payload.id?.trim();
  const status = payload.status === "verified" ? "verified" : payload.status === "rejected" ? "rejected" : null;
  if (!id || !status) return Response.json({ error: "검토 상태를 확인해주세요." }, { status: 400 });
  const db = getDb();
  const now = new Date();
  await db.batch([
    db.update(lawFirmApplications).set({
      status,
      reviewNote: payload.note?.trim().slice(0, 300) ?? "",
      verifiedAt: status === "verified" ? now : null,
      updatedAt: now,
    }).where(eq(lawFirmApplications.id, id)),
    db.update(lawFirmExperiences).set({ verificationStatus: status }).where(eq(lawFirmExperiences.applicationId, id)),
  ]);
  return Response.json({ ok: true });
}
