import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { lawFirmApplications, lawFirmExperiences } from "../../../db/schema";
import { LawFirmInputError, siteUser, validateLawFirmApplication } from "../../law-firms/server";
import type { PublicLawFirm } from "../../law-firms/types";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select({ application: lawFirmApplications, experience: lawFirmExperiences })
      .from(lawFirmApplications)
      .innerJoin(lawFirmExperiences, eq(lawFirmExperiences.applicationId, lawFirmApplications.id))
      .where(and(eq(lawFirmApplications.status, "verified"), eq(lawFirmExperiences.verificationStatus, "verified")))
      .orderBy(desc(lawFirmApplications.verifiedAt));
    const firms: PublicLawFirm[] = rows.map(({ application, experience }) => ({
      id: application.id,
      firmName: application.firmName,
      branchName: application.branchName,
      representativeLawyer: application.representativeLawyer,
      phone: application.phone,
      website: application.website,
      address: application.address,
      region: application.region,
      consultationModes: JSON.parse(application.consultationModes) as string[],
      introduction: application.introduction,
      verifiedAt: application.verifiedAt?.toISOString() ?? application.updatedAt.toISOString(),
      experience: {
        evidenceType: experience.evidenceType,
        precedentUrl: experience.precedentUrl,
        eventRegion: experience.eventRegion,
        eventMonth: experience.eventMonth,
        victimCountBand: experience.victimCountBand,
        caseCount: experience.caseCount,
        publicCaseReference: experience.precedentUrl ? "공개 판결 확인" : "비공개 증빙 확인",
      },
    }));
    return Response.json({ firms }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch (error) {
    console.error("Law firm directory read failed", error);
    return Response.json({ error: "로펌 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = siteUser(request);
  if (!user) return Response.json({ error: "로그인 후 등록할 수 있습니다." }, { status: 401 });
  try {
    const input = validateLawFirmApplication(await request.json());
    const db = getDb();
    const now = new Date();
    const applicationId = crypto.randomUUID();
    await db.batch([
      db.insert(lawFirmApplications).values({
        id: applicationId,
        ownerUserId: user.userId,
        ownerEmail: user.email,
        firmName: input.firmName,
        branchName: input.branchName,
        representativeLawyer: input.representativeLawyer,
        barRegistrationNumber: input.barRegistrationNumber,
        phone: input.phone,
        website: input.website,
        address: input.address,
        region: input.region,
        consultationModes: JSON.stringify(input.consultationModes),
        introduction: input.introduction,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(lawFirmExperiences).values({ id: crypto.randomUUID(), applicationId, ...input.experience }),
    ]);
    return Response.json({ id: applicationId, status: "pending" }, { status: 201 });
  } catch (error) {
    if (error instanceof LawFirmInputError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Law firm application failed", error);
    return Response.json({ error: "등록 신청을 접수하지 못했습니다." }, { status: 500 });
  }
}
