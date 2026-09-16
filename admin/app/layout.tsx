import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magii AirLine - 管理画面",
  description: "店舗待ち行列管理システム",
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
