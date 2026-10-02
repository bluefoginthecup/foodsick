"use client";
import { useI18n } from "../i18n/context";

import { useRef, useState, type FormEvent } from "react";
import { resources, resourceTypes } from "./data";
import { savePost, type PostDraft, type ResourcePost } from "./api";

const blank: PostDraft = { type: "논문·연구", title: "", source: "", language: "한국어", year: "", originalTitle: "", description: "", takeaway: "", url: "", tags: [] };
export function PostEditor({ post, admin, onCancel, onSaved }: { post?: ResourcePost; admin: boolean; onCancel: () => void; onSaved: (published: boolean) => void }) {
  const { text, t } = useI18n();
  const [draft, setDraft] = useState<PostDraft>(post ?? blank);
  const [tags, setTags] = useState(post?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const newId = useRef<string | null>(null);
  function field(key: keyof PostDraft, value: string) { setDraft(d => ({ ...d, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    newId.current ??= crypto.randomUUID();
    try { const result = await savePost(post?.id ?? newId.current, post?.revision ?? 0, { ...draft, tags: tags.split(",").map(t => t.trim()).filter(Boolean) }); onSaved(result.status === "approved"); }
    catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <form className="resource-editor" onSubmit={event => void submit(event)}>
    <h2>{text(post ? "게시글 수정" : "자료 올리기")}</h2>
    <p>{text(admin ? "관리자가 저장한 글은 바로 공개됩니다." : "저장하면 관리자에게 승인을 요청합니다. 승인 전에는 본인과 관리자만 볼 수 있습니다.")}</p>
    {text(error && <p className="resource-error" role="alert">{text(error)}</p>)}
    <fieldset disabled={busy}>
      {text(admin && !post && <label>{t("추천자료로 시작하기")}<select defaultValue="" onChange={e => { const selected = resources.find(r => r.id === e.target.value); if (selected) { setDraft(selected); setTags(selected.tags.join(", ")); } }}><option value="" disabled>{t("확인된 참고자료 7개 중 선택 (선택사항)")}</option>{text(resources.map(r => <option key={r.id} value={r.id}>{text(r.title)}</option>))}</select></label>)}
      <div className="resource-editor-columns"><label>{t("자료 유형")}<select value={draft.type} onChange={e => field("type", e.target.value)}>{text(resourceTypes.map(t => <option value={t} key={t}>{text(t)}</option>))}</select></label><label>{t("원문 언어")}<select value={draft.language} onChange={e => field("language", e.target.value)}><option value={"한국어"}>{t("한국어")}</option><option value={"영어"}>{t("영어")}</option></select></label></div>
      <label>{t("제목 *")}<input required maxLength={160} value={draft.title} onChange={e => field("title", e.target.value)} /></label>
      <label>{t("출처·발행 기관 *")}<input required maxLength={200} value={draft.source} onChange={e => field("source", e.target.value)} placeholder={t("예: 식품의약품안전처 · 식품안전나라")} /></label>
      <label>{t("원문 주소 *")}<input required type="url" maxLength={2000} value={draft.url} onChange={e => field("url", e.target.value)} placeholder="https://" /></label>
      <div className="resource-editor-columns"><label>{t("발행 연도")}<input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={draft.year ?? ""} onChange={e => field("year", e.target.value)} placeholder={t("선택사항")} /></label><label>{t("원문 제목")}<input maxLength={400} value={draft.originalTitle ?? ""} onChange={e => field("originalTitle", e.target.value)} placeholder={t("선택사항")} /></label></div>
      <label>{t("자료 소개 *")}<textarea required maxLength={5000} rows={6} value={draft.description} onChange={e => field("description", e.target.value)} /></label>
      <label>{t("활용 포인트·참고할 점")}<textarea maxLength={2000} rows={3} value={draft.takeaway} onChange={e => field("takeaway", e.target.value)} /></label>
      <label>{t("주제 (쉼표로 구분, 최대 6개·각 30자)")}<input maxLength={190} value={tags} onChange={e => setTags(e.target.value)} placeholder={t("시민 참여, 예방")} /></label>
      <div className="resource-post-actions"><button className="primary-button" type="submit">{text(busy ? "저장 중…" : admin ? "저장·공개" : "저장·승인 요청")}</button><button className="secondary-button" type="button" onClick={onCancel}>{t("취소")}</button></div>
    </fieldset>
  </form>;
}
