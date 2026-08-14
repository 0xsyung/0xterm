/**
 * @file layout.tsx
 * @description Root layout component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "0xterm",
  description: "Matrix-style Web3 Terminal Interface"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
