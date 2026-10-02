"use client";
import { useI18n } from "../i18n/context";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { resources, resourceTypes } from "./data";
import { savePost, type PostDraft, type ResourcePost, type AttachmentInput } from "./api";
import { ATTACHMENT_EXTENSIONS, attachmentIssue } from "../../functions/src/domain/attachment-policy";

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다. 다시 선택해주세요."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}
function FilePreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => { const value = URL.createObjectURL(file); if (image.current) image.current.src = value; return () => URL.revokeObjectURL(value); }, [file]);
  // Local, temporary blob previews cannot use the remote image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} className="resource-file-preview" alt={`${file.name} 미리보기`} />;
}

const blank: PostDraft = { type: "논문·연구", title: "", source: "", language: "한국어", year: "", originalTitle: "", description: "", takeaway: "", url: "", tags: [] };
export function PostEditor({ post, admin, onCancel, onSaved, onBusy }: { post?: ResourcePost; admin: boolean; onCancel: () => void; onSaved: (published: boolean) => void; onBusy?: (busy: boolean) => void }) {
  const { text, t } = useI18n();
  const [draft, setDraft] = useState<PostDraft>(post ?? blank);
  const [tags, setTags] = useState(post?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const newId = useRef<string | null>(null);
  const [keptFiles, setKeptFiles] = useState(post?.attachments ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  function addFiles(files: File[]) {
    if (busy) return;
    const issue = attachmentIssue([...keptFiles, ...newFiles, ...files]);
    if (issue) { setError(issue); return; }
    setError(""); setNewFiles(previous => [...previous, ...files]);
  }
  function field(key: keyof PostDraft, value: string) { setDraft(d => ({ ...d, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const issue = attachmentIssue([...keptFiles, ...newFiles]);
    if (issue || (!draft.url.trim() && !keptFiles.length && !newFiles.length)) { setError(issue ?? "원문 주소 또는 첨부파일 중 하나를 입력해주세요."); return; }
    setBusy(true); onBusy?.(true); setError("");
    newId.current ??= crypto.randomUUID();
    try {
      const attachments: AttachmentInput[] = keptFiles.map(file => ({ id: file.id }));
      for (const [index, file] of newFiles.entries()) {
        setProgress(`파일 읽는 중 (${index + 1}/${newFiles.length}) · ${file.name}`);
        attachments.push({ name: file.name, base64: await fileBase64(file) });
      }
      setProgress("첨부파일을 검사하고 게시글을 저장하는 중입니다. 잠시 기다려주세요.");
      const result = await savePost(post?.id ?? newId.current, post?.revision ?? 0, { ...draft, tags: tags.split(",").map(t => t.trim()).filter(Boolean) }, attachments);
      onSaved(result.status === "approved");
    }
    catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setBusy(false); onBusy?.(false); setProgress(""); }
  }
  return <form className="resource-editor" onSubmit={event => void submit(event)}>
    <h2>{text(post ? "게시글 수정" : "자료 올리기")}</h2>
    <p>{text(admin ? "관리자가 저장한 글은 바로 공개됩니다." : "저장하면 관리자에게 승인을 요청합니다. 승인 전에는 본인과 관리자만 볼 수 있습니다.")}</p>
    {text(error && <p className="resource-error" role="alert">{text(error)}</p>)}
    {progress && <p role="status">{progress}</p>}
    <fieldset disabled={busy}>
      {text(admin && !post && <label>{t("추천자료로 시작하기")}<select defaultValue="" onChange={e => { const selected = resources.find(r => r.id === e.target.value); if (selected) { setDraft(selected); setTags(selected.tags.join(", ")); } }}><option value="" disabled>{t("확인된 참고자료 7개 중 선택 (선택사항)")}</option>{text(resources.map(r => <option key={r.id} value={r.id}>{text(r.title)}</option>))}</select></label>)}
      <div className="resource-editor-columns"><label>{t("자료 유형")}<select value={draft.type} onChange={e => field("type", e.target.value)}>{text(resourceTypes.map(t => <option value={t} key={t}>{text(t)}</option>))}</select></label><label>{t("원문 언어")}<select value={draft.language} onChange={e => field("language", e.target.value)}><option value={"한국어"}>{t("한국어")}</option><option value={"영어"}>{t("영어")}</option></select></label></div>
      <label>{t("제목 *")}<input required maxLength={160} value={draft.title} onChange={e => field("title", e.target.value)} /></label>
      <label>{t("출처·발행 기관 *")}<input required maxLength={200} value={draft.source} onChange={e => field("source", e.target.value)} placeholder={t("예: 식품의약품안전처 · 식품안전나라")} /></label>
      <label>{t("원문 주소")}<input type="url" maxLength={2000} value={draft.url} onChange={e => field("url", e.target.value)} placeholder="https://" /><small>원문 주소 또는 첨부파일 중 하나는 필요합니다.</small></label>
      <div className="resource-editor-columns"><label>{t("발행 연도")}<input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={draft.year ?? ""} onChange={e => field("year", e.target.value)} placeholder={t("선택사항")} /></label><label>{t("원문 제목")}<input maxLength={400} value={draft.originalTitle ?? ""} onChange={e => field("originalTitle", e.target.value)} placeholder={t("선택사항")} /></label></div>
      <label>{t("자료 소개 *")}<textarea required maxLength={5000} rows={6} value={draft.description} onChange={e => field("description", e.target.value)} /></label>
      <label>{t("활용 포인트·참고할 점")}<textarea maxLength={2000} rows={3} value={draft.takeaway} onChange={e => field("takeaway", e.target.value)} /></label>
      <section className="resource-attachments" aria-label="파일 첨부">
        <h3>첨부파일 <small>{keptFiles.length + newFiles.length}/3개 · {([...keptFiles, ...newFiles].reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)}/20MB</small></h3>
        <div className={`resource-file-drop${dragging ? " dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
          <label>파일 선택<input ref={fileInput} type="file" multiple accept={ATTACHMENT_EXTENSIONS.map(extension => `.${extension}`).join(",")} onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
          <p>파일을 선택하거나 이곳에 끌어놓으세요.</p>
          <small>최대 3개 · 파일당 10MB (이미지 5MB) · 합계 20MB<br />PDF, JPG, PNG, WEBP, HWP, HWPX, DOCX, XLSX, CSV, PPTX</small>
        </div>
        <ul>{keptFiles.map(file => <li key={file.id}><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)}MB · 기존 첨부</small></div><button type="button" aria-label={`${file.name} 첨부 제외`} onClick={() => setKeptFiles(previous => previous.filter(item => item.id !== file.id))}>제외</button></li>)}
          {newFiles.map((file, index) => <li key={`${file.name}-${index}`}>{/\.(jpg|png|webp)$/i.test(file.name) && <FilePreview file={file} />}<div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)}MB · 새 첨부</small></div><button type="button" aria-label={`${file.name} 첨부 제외`} onClick={() => setNewFiles(previous => previous.filter((_, i) => i !== index))}>제외</button></li>)}</ul>
        <p className="resource-file-note">공유 권한이 있는 자료만 첨부해주세요. 파일 변경은 저장할 때 반영되며, 회원이 변경한 파일은 재승인 후 공개됩니다.</p>
      </section>
      <label>{t("주제 (쉼표로 구분, 최대 6개·각 30자)")}<input maxLength={190} value={tags} onChange={e => setTags(e.target.value)} placeholder={t("시민 참여, 예방")} /></label>
      <div className="resource-post-actions"><button className="primary-button" type="submit">{text(busy ? "저장 중…" : admin ? "저장·공개" : "저장·승인 요청")}</button><button className="secondary-button" type="button" onClick={onCancel}>{t("취소")}</button></div>
    </fieldset>
  </form>;
}
