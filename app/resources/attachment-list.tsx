"use client";
import { useState } from "react";
import { downloadAttachment, type Attachment } from "./api";

export function AttachmentList({ postId, files }: { postId: string; files: Attachment[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!files.length) return null;
  async function download(file: Attachment) {
    if (downloading) return;
    setDownloading(file.id); setError("");
    try { await downloadAttachment(postId, file.id); }
    catch (e) { setError(e instanceof Error ? e.message : "파일을 내려받지 못했습니다."); }
    finally { setDownloading(null); }
  }
  return <section className="resource-attachments" aria-label="첨부파일"><h4>첨부파일 {files.length}개</h4><ul>{files.map(file => <li key={file.id}><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)}MB · {file.extension.toUpperCase()}</small></div><button type="button" disabled={downloading !== null} onClick={() => void download(file)}>{downloading === file.id ? "다운로드 준비 중…" : "다운로드"}</button></li>)}</ul>{error && <p role="alert">{error}</p>}</section>;
}
