import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./resources/resources.css";
import { AuthProvider } from "./auth/auth-context";
import { ReportStoreProvider } from "./reports/report-store";
import { PwaRegister } from "./pwa-register";
import { ContactFeedbackProvider } from "./contact-feedback/contact-feedback-store";
import { SiteNavigation } from "./site-navigation";
import { headers } from "next/headers";
import { I18nProvider } from "./i18n/context";
import { requestLocale, translateText } from "./i18n/core";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:5173";

export const dynamic = "force-dynamic";
const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "나두아파 | 식중독 의심 증상 지도·신고 안내",
  description:
    "음식점 이름을 공개하지 않고 지역별 위장관 증상 신고 증가를 살펴보는 시민 참여 지도",
  manifest: "/manifest.webmanifest",
  applicationName: "나두아파",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "나두아파",
  },
  openGraph: {
    title: "나만 아픈 걸까? | 나두아파",
    description: "음식점을 공개하지 않고 지역별 위장관 증상 신고 증가를 살펴보는 시민 참여 지도",
    images: [{ url: "/og-nadoapa.png", width: 1536, height: 1024, alt: "나만 아픈 걸까? 나두아파" }],
    locale: "ko_KR",
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og-nadoapa.png"] },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const language = requestLocale(requestHeaders.get("cookie"), requestHeaders.get("accept-language"));
  return { ...baseMetadata,
    title: translateText("나두아파 | 식중독 의심 증상 지도·신고 안내", language),
    description: translateText(String(baseMetadata.description), language),
  };
}

export const viewport: Viewport = {
  themeColor: "#f6f2e9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const language = requestLocale(requestHeaders.get("cookie"), requestHeaders.get("accept-language"));
  return (
    <html lang={language === "zh-CN" ? "zh-Hans" : language} suppressHydrationWarning>
      <body><I18nProvider initialLocale={language}><AuthProvider><SiteNavigation /><ReportStoreProvider><ContactFeedbackProvider>{children}</ContactFeedbackProvider></ReportStoreProvider></AuthProvider><PwaRegister /></I18nProvider></body>
    </html>
  );
}
