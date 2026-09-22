import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magii AirLine - 管理画面",
  description: "店舗待ち行列管理システム",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background text-text-primary">
        {children}
      </body>
    </html>
  );
}
