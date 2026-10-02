import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import * as CFB from "cfb";
import { attachmentIssue, MAX_FILE_BYTES, MAX_IMAGE_BYTES, MAX_TOTAL_BYTES } from "../lib/domain/attachment-policy.js";
import { validateAttachmentBytes, decodeAttachment } from "../lib/domain/attachment-format.js";

test("enforces exact count, per-file, image and aggregate boundaries", () => {
  assert.equal(attachmentIssue([{ name: "a.pdf", size: MAX_FILE_BYTES }, { name: "b.csv", size: MAX_FILE_BYTES }]), null);
  assert.ok(attachmentIssue([{ name: "a.pdf", size: MAX_FILE_BYTES }, { name: "b.csv", size: MAX_FILE_BYTES }, { name: "c.csv", size: 1 }]));
  assert.ok(attachmentIssue(Array.from({ length: 4 }, (_, i) => ({ name: `${i}.pdf`, size: 1 }))));
  assert.equal(attachmentIssue([{ name: "a.JPG", size: MAX_IMAGE_BYTES }]), null);
  assert.ok(attachmentIssue([{ name: "a.jpg", size: MAX_IMAGE_BYTES + 1 }]));
  assert.ok(attachmentIssue([{ name: "a.pdf", size: MAX_FILE_BYTES + 1 }]));
  assert.ok(attachmentIssue([{ name: "a.zip", size: 10 }]));
  assert.ok(attachmentIssue([{ name: "../a.pdf", size: 10 }]));
  assert.ok(attachmentIssue([{ name: "a.csv", size: 0 }]));
  assert.equal(MAX_TOTAL_BYTES, 20 * 1024 * 1024);
});

function office(extension) {
  const main = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" }[extension];
  return { "[Content_Types].xml": strToU8(`<Types><Override PartName="/${main}" ContentType="test"/></Types>`), "_rels/.rels": strToU8("<Relationships/>"), [main]: strToU8("<document/>") };
}
test("recognizes all ten permitted formats and rejects renamed binary files", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=", "base64");
  const webp = Buffer.alloc(20); webp.write("RIFF"); webp.writeUInt32LE(12, 4); webp.write("WEBPVP8 ", 8);
  const cfb = CFB.utils.cfb_new(); const header = Buffer.alloc(256); header.write("HWP Document File"); CFB.utils.cfb_add(cfb, "FileHeader", header);
  const fixtures = { pdf: Buffer.from("%PDF-1.4\n%%EOF"), jpg: Buffer.from("ffd8ffe00000ffd9", "hex"), png, webp, hwp: CFB.write(cfb, { type: "buffer" }), hwpx: zipSync({ mimetype: strToU8("application/hwp+zip"), "Contents/header.xml": strToU8("<header/>"), "Contents/content.hpf": strToU8("<package/>") }), csv: Buffer.from("날짜,건수\n2026-10-02,3\n") };
  for (const ext of ["docx", "xlsx", "pptx"]) fixtures[ext] = zipSync(office(ext));
  for (const [ext, bytes] of Object.entries(fixtures)) {
    assert.equal(validateAttachmentBytes(`자료.${ext}`, Buffer.from(bytes)), ext);
    assert.throws(() => validateAttachmentBytes(`fake.${ext}`, Buffer.from("MZ\0binary")));
  }
  assert.throws(() => validateAttachmentBytes("wrong.xlsx", Buffer.from(zipSync(office("docx")))));
  assert.throws(() => decodeAttachment("a.pdf", "@@@@"));
  assert.throws(() => validateAttachmentBytes("a.csv", Buffer.from("<html><script>alert(1)</script></html>")));
});

test("rejects office macro payloads, traversal and decompression bombs without extracting them", () => {
  for (const extra of [{ "word/vbaProject.bin": strToU8("macro") }, { "../x": strToU8("traversal") }, { "big.bin": new Uint8Array(51 * 1024 * 1024) }]) {
    const bytes = Buffer.from(zipSync({ ...office("docx"), ...extra }));
    assert.throws(() => validateAttachmentBytes("paper.docx", bytes));
  }
});
