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

export type LawyerInput = {
  name: string;
  barRegistrationNumber: string;
};

export type LawFirmApplicationInput = {
  firmName: string;
  branchName: string;
  phone: string;
  website: string;
  address: string;
  region: string;
  consultationModes: string[];
  introduction: string;
  lawyers: LawyerInput[];
  experiences: ExperienceInput[];
};

export type ValidatedLawFirmApplication = LawFirmApplicationInput & {
  representativeLawyer: string;
  barRegistrationNumber: string;
  experience: ExperienceInput;
};

export type PublicLawFirm = Omit<LawFirmApplicationInput, "lawyers" | "experiences"> & {
  id: string;
  representativeLawyer: string;
  lawyerCount: number;
  verifiedAt: string;
  experience: Omit<ExperienceInput, "caseNumber" | "courtName"> & { publicCaseReference: string };
};

export type AdminLawFirmApplication = ValidatedLawFirmApplication & {
  id: string;
  ownerEmail: string;
  status: "pending" | "verified" | "rejected";
  reviewNote: string;
  createdAt: string;
};
