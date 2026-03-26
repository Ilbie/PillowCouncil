import type { Metadata } from "next";
import { Noto_Sans_KR, Space_Grotesk } from "next/font/google";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const body = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"]
});

const metadataBase = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: "PillowCouncil",
  description: "Decision board for multi-agent product debates powered by OpenCode providers.",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo.ico", sizes: "any" }
    ],
    shortcut: [{ url: "/logo.ico" }],
    apple: [{ url: "/logo.png" }]
  },
  openGraph: {
    title: "PillowCouncil",
    description: "Decision board for multi-agent product debates powered by OpenCode providers.",
    images: [{ url: "/logo.png" }]
  },
  twitter: {
    card: "summary",
    title: "PillowCouncil",
    description: "Decision board for multi-agent product debates powered by OpenCode providers.",
    images: ["/logo.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} antialiased`}>{children}</body>
    </html>
  );
}
