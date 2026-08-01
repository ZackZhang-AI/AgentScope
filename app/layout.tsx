import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "AgentScope | AI Agent Black Box Replay",
    template: "%s | AgentScope",
  },
  description:
    "Trace, replay, fork and evaluate a code-repair Agent through span-linked evidence.",
  keywords: [
    "AI agents",
    "agent observability",
    "agent evaluation",
    "trace replay",
    "developer tools",
  ],
  authors: [{ name: "Zack Zhang", url: "https://github.com/ZackZhang-AI" }],
  creator: "Zack Zhang",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AgentScope",
    title: "AgentScope | AI Agent Black Box Replay",
    description:
      "Inspect a failed Agent run, fork an immutable checkpoint and verify the fix with deterministic evidence.",
    images: [{
      url: "/agentscope-social-card.png",
      width: 1200,
      height: 630,
      alt: "AgentScope agent execution trace from failure loop to verified success",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentScope | AI Agent Black Box Replay",
    description:
      "Failure, root cause, immutable fork and verified fix in one observable Agent run.",
    images: ["/agentscope-social-card.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-100 text-zinc-950 antialiased">{children}</body>
    </html>
  );
}
