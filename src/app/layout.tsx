import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ファイル形式変換",
  description: "ブラウザ内でファイル形式を変換するシンプルなツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}