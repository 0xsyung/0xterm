import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "0xterm — Terminal",
  description: "Launch the 0xterm Web3 terminal.",
  alternates: {
    canonical: "/app"
  }
};

export default function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
