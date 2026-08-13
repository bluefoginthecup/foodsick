"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SessionControl } from "./auth/session-control";
import { NativeLink } from "./native-link";

const menuGroups = [
  {
    label: "지도·신고",
    description: "지역 신호를 보고 증상을 기록해요",
    links: [
      { href: "/", label: "홈" },
      { href: "/#signals", label: "증상 신호 지도" },
      { href: "/report", label: "증상 신고하기" },
      { href: "/my-reports", label: "내 신고" },
    ],
  },
  {
    label: "기관·의료",
    description: "선택 지역의 도움받을 곳을 찾아요",
    links: [
      { href: "/#regional-help", label: "관할기관·주변 의료" },
      { href: "tel:119", label: "긴급할 때 119" },
    ],
  },
  {
    label: "법률지원",
    description: "대응 방법과 검증된 상담처를 확인해요",
    links: [
      { href: "/law-help#guide", label: "대응 가이드" },
      { href: "/law-help#precedents", label: "판례 보기" },
      { href: "/law-help#firms", label: "로펌 찾기" },
      { href: "/law-firms/register", label: "로펌 등록 신청" },
    ],
  },
  {
    label: "운영",
    description: "서비스 검토와 관리 메뉴예요",
    links: [{ href: "/admin", label: "관리자 검토실" }],
  },
] as const;

function splitHref(href: string) {
  const [path, hash = ""] = href.split("#");
  return { path, hash: hash ? `#${hash}` : "" };
}

export function SiteNavigation() {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [hash, setHash] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
        detailsRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const isActive = (href: string) => {
    if (href.startsWith("tel:")) return false;
    const target = splitHref(href);
    if (target.hash) return pathname === target.path && hash === target.hash;
    return pathname === target.path && !hash;
  };

  return (
    <header className="site-navigation">
      <div className="site-nav-bar">
        <NativeLink className="brand" href="/" aria-label="아파요 지도 홈">
          <span className="brand-mark" aria-hidden="true">아</span>
          <span>아파요 지도</span>
        </NativeLink>

        <nav className="site-nav-quick" aria-label="주요 메뉴">
          <NativeLink href="/#signals">신호 지도</NativeLink>
          <NativeLink className="quick-report" href="/report">증상 신고</NativeLink>
          <NativeLink href="/law-help">법률지원</NativeLink>
        </nav>

        <details className="site-menu" onToggle={(event) => setMenuOpen(event.currentTarget.open)} ref={detailsRef}>
          <summary aria-label={menuOpen ? "전체 메뉴 닫기" : "전체 메뉴 열기"}>
            <span>전체 메뉴</span>
            <i aria-hidden="true"><b /><b /><b /></i>
          </summary>
          <div className="site-menu-panel">
            <div className="site-menu-heading">
              <div><span>ALL MENU</span><strong>무엇을 찾으세요?</strong></div>
              <small>메뉴를 선택하면 바로 이동합니다</small>
            </div>
            <nav className="site-menu-groups" aria-label="전체 메뉴">
              {menuGroups.map((group) => (
                <section key={group.label}>
                  <h2>{group.label}</h2>
                  <p>{group.description}</p>
                  <div>
                    {group.links.map((link) => (
                      <NativeLink
                        aria-current={isActive(link.href) ? "page" : undefined}
                        href={link.href}
                        key={`${group.label}-${link.label}`}
                        onClick={() => { if (detailsRef.current) detailsRef.current.open = false; }}
                      >
                        <span>{link.label}</span><b aria-hidden="true">↗</b>
                      </NativeLink>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
            <div className="site-menu-account">
              <span>내 활동</span>
              <SessionControl />
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
