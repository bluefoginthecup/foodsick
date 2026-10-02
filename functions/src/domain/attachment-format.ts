import { unzipSync } from "fflate";
import * as CFB from "cfb";
import { attachmentExtension, attachmentIssue, MAX_FILE_BYTES } from "./attachment-policy.js";

// Identifies the container and expected document parts. This is not antivirus scanning.
export function validateAttachmentBytes(name: string, data: Buffer) {
  const issue = attachmentIssue([{ name, size: data.length }]);
  if (issue) throw new Error(issue);
  const extension = attachmentExtension(name);
  const starts = (hex: string) => data.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  let valid = false;
  if (extension === "pdf") valid = /^%PDF-\d\.\d/.test(data.subarray(0, 8).toString("ascii")) && data.subarray(-2048).includes(Buffer.from("%%EOF"));
  if (extension === "jpg") valid = data.length >= 4 && starts("ffd8ff") && data.subarray(-2).equals(Buffer.from("ffd9", "hex"));
  if (extension === "png") valid = data.length >= 45 && starts("89504e470d0a1a0a") && data.toString("ascii", 12, 16) === "IHDR" && data.subarray(-8, -4).toString("ascii") === "IEND";
  if (extension === "webp") valid = data.length >= 20 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16)) && data.readUInt32LE(4) + 8 === data.length;
  if (extension === "csv") {
    // UTF-8 and Korean Windows CSV exports are accepted; binary control bytes are not.
    let content: string;
    if (starts("fffe")) content = new TextDecoder("utf-16le", { fatal: true }).decode(data);
    else if (starts("feff")) content = new TextDecoder("utf-16be", { fatal: true }).decode(data);
    else {
      try { content = new TextDecoder("utf-8", { fatal: true }).decode(data); }
      catch { content = new TextDecoder("euc-kr", { fatal: true }).decode(data); }
    }
    // Only tab/newline control characters are valid in this text format.
    // eslint-disable-next-line no-control-regex
    valid = Boolean(content.trim()) && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(content) && !/^\s*(?:<!doctype|<html|<script|<svg|%PDF-)/i.test(content);
  }
  if (extension === "hwp" && starts("d0cf11e0a1b11ae1")) {
    const document = CFB.read(data, { type: "buffer" });
    const header = CFB.find(document, "FileHeader");
    const content = header?.content ? Buffer.from(header.content) : Buffer.alloc(0);
    valid = content.length >= 256 && content.toString("ascii", 0, 17) === "HWP Document File";
    if (valid && (content.readUInt32LE(36) & 2)) throw new Error("암호가 설정된 문서는 첨부할 수 없습니다.");
  }
  if (["hwpx", "docx", "xlsx", "pptx"].includes(extension) && starts("504b0304")) {
    let count = 0, total = 0;
    const names = new Set<string>();
    const main = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml", hwpx: "Contents/content.hpf" }[extension]!;
    const files = unzipSync(data, { filter: entry => {
      count++; total += entry.originalSize;
      if (count > 4000 || total > 100 * 1024 * 1024 || entry.originalSize > 50 * 1024 * 1024 || names.has(entry.name)) throw new Error("문서 내부 크기 또는 구조가 허용 범위를 벗어났습니다.");
      names.add(entry.name);
      if (/(^|\/)\.\.(\/|$)|^[/\\]|vbaProject\.bin$|\.(exe|dll|js|vbs|ps1|bat|cmd)$/i.test(entry.name)) throw new Error("실행 코드나 매크로가 포함된 문서는 첨부할 수 없습니다.");
      const inspect = ["mimetype", "[Content_Types].xml"].includes(entry.name);
      if (inspect && entry.originalSize > 1024 * 1024) throw new Error("문서 형식 정보가 너무 큽니다.");
      return inspect;
    } });
    if (extension === "hwpx") valid = Buffer.from(files.mimetype ?? []).toString().trim() === "application/hwp+zip" && names.has(main) && names.has("Contents/header.xml");
    else {
      const types = Buffer.from(files["[Content_Types].xml"] ?? []).toString();
      valid = names.has(main) && names.has("_rels/.rels") && types.includes(`PartName="/${main}"`) && !/macroEnabled|vbaProject/i.test(types);
    }
  }
  if (!valid) throw new Error("확장자와 실제 파일 형식이 다르거나 손상된 파일입니다. 원본 파일을 확인해주세요.");
  return extension;
}

export function decodeAttachment(name: unknown, base64: unknown) {
  if (typeof name !== "string" || typeof base64 !== "string" || base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error("첨부파일 데이터를 확인해주세요.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) throw new Error("첨부파일 데이터가 올바르지 않습니다.");
  const extension = validateAttachmentBytes(name, bytes);
  return { name, size: bytes.length, extension, bytes };
}
