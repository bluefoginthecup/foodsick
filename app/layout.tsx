import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./auth/auth-context";
import { ReportStoreProvider } from "./reports/report-store";
import { PwaRegister } from "./pwa-register";
import { ContactFeedbackProvider } from "./contact-feedback/contact-feedback-store";
import { SiteNavigation } from "./site-navigation";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:5173";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "나두아파 | 위장관 증상 조기 신호",
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

export const viewport: Viewport = {
  themeColor: "#f6f2e9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><AuthProvider><SiteNavigation /><ReportStoreProvider><ContactFeedbackProvider>{children}</ContactFeedbackProvider></ReportStoreProvider></AuthProvider><PwaRegister /></body>
    </html>
  );
}
