import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./auth/auth-context";
import { ReportStoreProvider } from "./reports/report-store";

export const metadata: Metadata = {
  title: "아파요 지도 | 위장관 증상 조기 신호",
  description:
    "음식점 이름을 공개하지 않고 지역별 위장관 증상 신고 증가를 살펴보는 시민 참여 지도",
  manifest: "/manifest.webmanifest",
  applicationName: "아파요 지도",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "아파요 지도",
  },
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
      <body><AuthProvider><ReportStoreProvider>{children}</ReportStoreProvider></AuthProvider></body>
    </html>
  );
}
