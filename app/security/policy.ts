import type { ReportStatus } from "../contracts";

const allowedTransitions: Record<ReportStatus, ReportStatus[]> = {
  submitted: ["duplicate_suspected", "reviewed", "included_in_cluster", "rejected"],
  duplicate_suspected: ["submitted", "reviewed", "rejected"],
  reviewed: ["included_in_cluster", "rejected"],
  included_in_cluster: ["reviewed", "rejected"],
  rejected: ["submitted"],
};

export function canTransitionReport(from: ReportStatus, to: ReportStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export const securityPolicy = {
  reportWritePath: "server-only",
  publicMapData: "aggregate-only",
  adminAuthorization: "firebase-custom-claim",
  appCheck: "required-in-production",
  rateLimits: {
    reportCreatePerHour: 5,
    reportUpdatePerHour: 20,
    publicMapReadsPerMinute: 60,
    adminMutationsPerMinute: 30,
  },
} as const;
