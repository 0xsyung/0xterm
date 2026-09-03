/**
 * @file layout.tsx
 * @description Root layout component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-plex"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://0xterm.xyz"),
  title: "0xterm",
  description: "Matrix-style Web3 Terminal Interface"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plexMono.variable}>
      <body>
        {children}
        <GoogleAnalytics gaId="G-K9JM491WTQ" />
      </body>
    </html>
  );
}
