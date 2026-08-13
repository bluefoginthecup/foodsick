export type ExperienceInput = {
  evidenceType: "case_number" | "summary";
  courtName: string;
  caseNumber: string;
  precedentUrl: string;
  eventRegion: string;
  eventMonth: string;
  victimCountBand: string;
  caseCount: number;
};

export type LawFirmApplicationInput = {
  firmName: string;
  branchName: string;
  representativeLawyer: string;
  barRegistrationNumber: string;
  phone: string;
  website: string;
  address: string;
  region: string;
  consultationModes: string[];
  introduction: string;
  experience: ExperienceInput;
};

export type PublicLawFirm = Omit<LawFirmApplicationInput, "barRegistrationNumber" | "experience"> & {
  id: string;
  verifiedAt: string;
  experience: Omit<ExperienceInput, "caseNumber" | "courtName"> & { publicCaseReference: string };
};

export type AdminLawFirmApplication = LawFirmApplicationInput & {
  id: string;
  ownerEmail: string;
  status: "pending" | "verified" | "rejected";
  reviewNote: string;
  createdAt: string;
};
