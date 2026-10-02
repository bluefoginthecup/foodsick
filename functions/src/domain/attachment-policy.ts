export const ATTACHMENT_EXTENSIONS = ["pdf", "jpg", "png", "webp", "hwp", "hwpx", "docx", "xlsx", "csv", "pptx"] as const;
export const MAX_ATTACHMENTS = 3;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export type Attachment = { id: string; name: string; size: number; extension: string };
export function attachmentExtension(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }
export function attachmentIssue(files: readonly { name: string; size: number }[]): string | null {
  if (files.length > MAX_ATTACHMENTS) return "첨부파일은 최대 3개까지 올릴 수 있습니다.";
  for (const file of files) {
    const extension = attachmentExtension(file.name);
    if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) return "허용 형식: PDF, JPG, PNG, WEBP, HWP, HWPX, DOCX, XLSX, CSV, PPTX";
    // Reject control characters and direction overrides in filenames intentionally.
    // eslint-disable-next-line no-control-regex
    if (!file.name.trim() || file.name.length > 180 || /[/\\\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(file.name)) return "파일 이름은 경로·제어문자 없이 180자 이내여야 합니다.";
    const image = ["jpg", "png", "webp"].includes(extension);
    if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > (image ? MAX_IMAGE_BYTES : MAX_FILE_BYTES)) return image ? "이미지는 파일당 5MB까지 올릴 수 있습니다." : "파일은 0바이트를 초과하고 파일당 10MB 이하여야 합니다.";
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) return "첨부파일 합계는 20MB까지 허용됩니다.";
  return null;
}
