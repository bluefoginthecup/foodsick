import type { Metadata } from "next";

export const publicSiteUrl = "https://nadooapa.kr";

export function publicPageMetadata(path: string, title: string, description: string): Metadata {
  const url = new URL(path, publicSiteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: "나두아파", type: "website", locale: "ko_KR",
      images: [{ url: `${publicSiteUrl}/og-nadoapa.png`, width: 1536, height: 1024, alt: "나두아파" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${publicSiteUrl}/og-nadoapa.png`] },
  };
}
