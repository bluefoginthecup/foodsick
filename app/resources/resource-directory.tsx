"use client";
import { useI18n } from "../i18n/context";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { resourceTypes } from "./data";
import { deletePost, listPosts, reviewPost, type PostScope, type ResourcePost } from "./api";
import { PostEditor } from "./post-editor";

const statusLabels = { pending: "승인 대기", approved: "공개", rejected: "반려·비공개" };
function errorText(error: unknown) { return error instanceof Error ? error.message : "요청을 처리하지 못했습니다. 다시 시도해주세요."; }

export function ResourceDirectory({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  return <ResourceBoard key={`${user?.uid ?? "guest"}:${user?.role ?? "guest"}`} admin={admin} />;
}

function ResourceBoard({ admin }: { admin: boolean }) {
  const { t, text } = useI18n();
  const { user, loading: authLoading, firebaseMode } = useAuth();
  const [scope, setScope] = useState<PostScope>(admin ? "admin" : "public");
  const [type, setType] = useState("전체");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("전체");
  const [posts, setPosts] = useState<ResourcePost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<ResourcePost | "new" | null>(null);
  const [deleting, setDeleting] = useState<ResourcePost | null>(null);
  const [reviewing, setReviewing] = useState<ResourcePost | null>(null);
  const [note, setNote] = useState("");
  const generation = useRef(0);
  const isAdmin = user?.role === "admin";
  const identity = `${user?.uid ?? "guest"}:${user?.role ?? "guest"}`;
  const [loadedFor, setLoadedFor] = useState("");
  const viewKey = `${identity}:${scope}`;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    generation.current++;
    setPosts([]); setCursor(null); setError(""); setLoading(true); setLoadedFor("");
    setEditor(null); setDeleting(null); setReviewing(null);
    if (authLoading) return;
    if ((scope !== "public" && !user) || (scope === "admin" && !isAdmin)) { setLoading(false); return; }
    if (!firebaseMode) { setLoading(false); setError("게시판은 운영 계정으로 이용할 수 있습니다. 현재 체험 환경에서는 게시글을 저장하거나 조회하지 않습니다."); return; }
    void listPosts(scope).then(result => {
      if (!cancelled) { setPosts(result.posts); setCursor(result.nextCursor); setLoadedFor(viewKey); }
    }).catch(e => { if (!cancelled) setError(errorText(e)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // Account identity and role are represented by viewKey.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, authLoading, firebaseMode, refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function loadMore() {
    if (!cursor) return;
    const current = generation.current;
    setLoading(true); setError("");
    try {
      const result = await listPosts(scope, cursor);
      if (current === generation.current) { setPosts(previous => [...new Map([...previous, ...result.posts].map(p => [p.id, p])).values()]); setCursor(result.nextCursor); }
    } catch (e) { if (current === generation.current) setError(errorText(e)); }
    finally { if (current === generation.current) setLoading(false); }
  }
  async function mutate(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); setRefresh(n => n + 1); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  const safePosts = loadedFor === viewKey ? posts : [];
  const terms = query.trim().toLocaleLowerCase("ko-KR").split(/\s+/).filter(Boolean);
  const visible = safePosts.filter(item => (type === "전체" || item.type === type)
    && (scope === "public" || status === "전체" || item.status === status)
    && terms.every(term => [item.title, item.originalTitle, item.source, item.description, item.takeaway, ...item.tags].join(" ").toLocaleLowerCase("ko-KR").includes(term)));
  const permitted = scope === "public" || (scope === "mine" && user) || (scope === "admin" && isAdmin);

  return <section className={admin ? "resource-page resource-admin" : "app-shell resource-page"} aria-label={t("논문·참고자료 게시판")}>
    <header className="resource-hero"><p className="eyebrow">{t("나두아파 자료실")}</p><h1>{t("함께 나누는")}<br /><em>{t("논문·참고자료")}</em></h1><p>{t("논문, 공식 사이트, 통계와 예방 정보를 나누는 게시판입니다.")}<br />{t("회원의 글은 관리자 승인 후 공개됩니다.")}</p></header>
    <div className="resource-board-toolbar">
      <div className="resource-filters" role="group" aria-label={t("게시판 보기")}>
        {text(!admin && <button type="button" aria-pressed={scope === "public"} disabled={busy} onClick={() => setScope("public")}>{t("공개 자료")}</button>)}
        {text(!admin && user && <button type="button" aria-pressed={scope === "mine"} disabled={busy} onClick={() => setScope("mine")}>{t("내 게시글")}</button>)}
        {text(isAdmin && <button type="button" aria-pressed={scope === "admin"} disabled={busy} onClick={() => setScope("admin")}>{t("승인·게시글 관리")}</button>)}
      </div>
      {text(user && firebaseMode ? <button type="button" className="primary-button" disabled={busy} onClick={() => { setEditor("new"); setMessage(""); }}>{t("자료 올리기")}</button> : <NativeLink className="secondary-button" href="/login?returnTo=%2Fresources">{t("로그인하고 글쓰기")}</NativeLink>)}
    </div>
    {text(message && <p className="resource-notice" role="status">{text(message)}</p>)}
    {text(error && <div className="resource-error" role="alert"><p>{text(error)}</p><button type="button" disabled={loading || busy} onClick={() => setRefresh(n => n + 1)}>{t("다시 불러오기")}</button></div>)}
    {text(editor && user && <PostEditor key={editor === "new" ? `new-${identity}` : `${editor.id}-${editor.revision}`} post={editor === "new" ? undefined : editor} admin={isAdmin} onCancel={() => setEditor(null)} onSaved={(published) => { setEditor(null); setMessage(published ? "게시글을 공개했습니다." : "승인을 요청했습니다. 내 게시글에서 진행 상태를 확인하세요."); setScope(isAdmin ? "admin" : "mine"); setRefresh(n => n + 1); }} />)}
    {text(permitted && <section className="resource-browser" aria-labelledby={admin ? "admin-resource-list" : "resource-list"}>
      <h2 id={admin ? "admin-resource-list" : "resource-list"}>{text(scope === "public" ? "공개 자료" : scope === "mine" ? "내 게시글" : "승인·게시글 관리")}</h2>
      <label className="resource-search" htmlFor={admin ? "admin-resource-search" : "resource-search"}>{t("불러온 글에서 검색")}<input id={admin ? "admin-resource-search" : "resource-search"} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("제목, 출처, 주제 검색")} /></label>
      <div className="resource-filters" role="group" aria-label={t("자료 유형")}>{text(["전체", ...resourceTypes].map(category => <button key={category} type="button" aria-pressed={type === category} onClick={() => setType(category)}>{text(category)}</button>))}</div>
      {text(scope !== "public" && <label className="resource-status-filter">{t("검토 상태 ")}<select value={status} onChange={e => setStatus(e.target.value)}><option value="전체">{t("전체")}</option>{text(Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{text(label)}</option>))}</select></label>)}
      <div className="resource-board-summary"><p className="resource-result" role="status">{t("불러온 ")}{text(safePosts.length)}{t("개 중 ")}{text(visible.length)}{t("개 표시 · 최신 등록순")}</p><button type="button" disabled={loading || busy} onClick={() => setRefresh(n => n + 1)}>{t("새로고침")}</button></div>
      {text(!loading && !error && !visible.length && <div className="resource-empty"><h3>{text(safePosts.length ? "조건에 맞는 글이 없어요" : scope === "public" ? "아직 공개된 자료가 없어요" : "등록된 게시글이 없어요")}</h3><p>{text(safePosts.length ? "검색어와 필터를 바꾸거나 다음 글을 불러와보세요." : "자료를 올려 함께 채워주세요. 관리자가 확인한 뒤 공개됩니다.")}</p></div>)}
      <div className="resource-board-list">{text(visible.map(post => <article className="resource-board-post" key={post.id}>
        <details><summary><div className="resource-card-meta"><span>{text(post.type)}</span>{text(post.status && <span>{text(statusLabels[post.status])}</span>)}</div><h3>{post.title}</h3><p>{post.source} · {post.language}{text(post.year && ` · ${post.year} 발행`)}</p><small>{text(post.createdAt.slice(0, 10))}{t(" 등록 · 내용 펼치기")}</small></summary>
          <div className="resource-post-body">{text(post.originalTitle && <p className="resource-original">{post.originalTitle}</p>)}<p className="resource-description">{post.description}</p>{text(post.takeaway && <div className="resource-takeaway"><strong>{t("이렇게 참고하세요")}</strong><p>{post.takeaway}</p></div>)}<ul className="resource-tags" aria-label={t("주제")}>{text(post.tags.map(tag => <li key={tag}>{tag}</li>))}</ul><a className="resource-link" href={post.url} target="_blank" rel="noopener noreferrer">{t("원문 보기 ")}<span>{t("새 탭 ↗")}</span></a>{text(post.reviewNote && <p className="resource-notice"><strong>{t("관리자 메모")}</strong><br />{post.reviewNote}</p>)}</div>
        </details>
        {text(scope !== "public" && <div className="resource-post-actions"><button type="button" disabled={busy} onClick={() => setEditor(post)}>{t("수정")}</button><button type="button" disabled={busy} onClick={() => setDeleting(post)}>{t("삭제")}</button>{text(scope === "admin" && <button type="button" disabled={busy} onClick={() => { setReviewing(post); setNote(""); }}>{t("승인·반려 검토")}</button>)}</div>)}
        {text(deleting?.id === post.id && <div className="resource-confirm" role="group" aria-label={t("삭제 확인")}><p>“{post.title}{t("” 글을 삭제할까요? 삭제 후 복구할 수 없습니다.")}</p><button type="button" disabled={busy} onClick={() => void mutate(() => deletePost(post), "게시글을 삭제했습니다.")}>{t("삭제 확정")}</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>{t("취소")}</button></div>)}
        {text(reviewing?.id === post.id && scope === "admin" && <div className="resource-confirm"><p>{t("펼친 본문과 원문을 확인한 뒤 검토해주세요. 승인하면 공개되고, 반려하면 공개 목록에서 제외됩니다.")}</p><label>{t("검토 메모 (반려 시 필수)")}<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label><button type="button" disabled={busy} onClick={() => void mutate(() => reviewPost(post, "approved", note), "게시글을 승인했습니다.")}>{t("승인·공개")}</button><button type="button" disabled={busy || !note.trim()} onClick={() => void mutate(() => reviewPost(post, "rejected", note), "게시글을 반려하고 비공개로 전환했습니다.")}>{t("반려·비공개")}</button><button type="button" disabled={busy} onClick={() => setReviewing(null)}>{t("취소")}</button></div>)}
      </article>))}</div>
      {text(loading && <p role="status">{t("자료를 불러오는 중입니다.")}</p>)}
      {text(cursor && <button className="secondary-button resource-more" type="button" disabled={loading || busy} onClick={() => void loadMore()}>{t("다음 게시글 30개 불러오기")}</button>)}
    </section>)}
    {text(!permitted && !authLoading && <p>{t("이 목록을 볼 수 있는 계정으로 로그인해주세요.")}</p>)}
    <aside className="resource-note"><h2>{t("함께 지키는 자료실 원칙")}</h2><p>{t("출처와 원문 주소를 함께 올려주세요. 개인정보나 특정 음식점을 지목하는 내용은 올리지 말아주세요. 회원이 공개된 글을 수정하면 다시 승인 대기로 바뀌며, 재승인 전까지 공개되지 않습니다. 관리자의 승인은 자료 공유를 위한 검토이며 의학적 사실의 보증은 아닙니다.")}</p><NativeLink href="/law-help">{t("피해 이후 대응·판례·상담처 보기 ↗")}</NativeLink></aside>
  </section>;
}
