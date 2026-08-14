import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, authenticatedUser } from "../../../server/firebase-admin";
import { LawFirmInputError, validateLawFirmApplication } from "../../law-firms/server";
import type { PublicLawFirm } from "../../law-firms/types";

function iso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString();
}

export async function GET() {
  try {
    const snapshot = await adminDb.collection("lawFirmApplications").where("status", "==", "verified").limit(100).get();
    const firms = snapshot.docs.map((doc) => {
      const application = doc.data();
      const experience = application.experience as Record<string, unknown>;
      return {
        id: doc.id,
        firmName: application.firmName,
        branchName: application.branchName,
        representativeLawyer: application.representativeLawyer,
        phone: application.phone,
        website: application.website,
        address: application.address,
        region: application.region,
        consultationModes: application.consultationModes,
        introduction: application.introduction,
        verifiedAt: iso(application.verifiedAt),
        experience: {
          evidenceType: experience.evidenceType,
          precedentUrl: experience.precedentUrl,
          eventRegion: experience.eventRegion,
          eventMonth: experience.eventMonth,
          victimCountBand: experience.victimCountBand,
          caseCount: experience.caseCount,
          publicCaseReference: experience.precedentUrl ? "공개 판결 확인" : "비공개 증빙 확인",
        },
      } as PublicLawFirm;
    }).sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
    return Response.json({ firms }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch (error) {
    console.error("Law firm directory read failed", error);
    return Response.json({ error: "로펌 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return Response.json({ error: "로그인 후 등록할 수 있습니다." }, { status: 401 });
  try {
    const input = validateLawFirmApplication(await request.json());
    const application = adminDb.collection("lawFirmApplications").doc();
    await application.create({
      ...input,
      experience: { ...input.experience, verificationStatus: "pending" },
      ownerUid: user.uid,
      ownerEmail: user.email,
      status: "pending",
      reviewNote: "",
      verifiedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ id: application.id, status: "pending" }, { status: 201 });
  } catch (error) {
    if (error instanceof LawFirmInputError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Law firm application failed", error);
    return Response.json({ error: "등록 신청을 접수하지 못했습니다." }, { status: 500 });
  }
}
