import { initializeApp } from "firebase-admin/app";

initializeApp();

export { getMyReports, setReportStatus, submitReport, updateReport } from "./reports.js";
export { getPublicSignals } from "./signals.js";
