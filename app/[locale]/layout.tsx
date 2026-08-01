import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/i18n-provider";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { hasLocale, locales } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const dictionary = await getDictionary(locale);
  return {
    metadataBase: siteUrl,
    title: {
      default: dictionary["meta.title"],
      template: "%s | AgentScope",
    },
    description: dictionary["meta.description"],
    keywords: [
      "AI agents",
      "agent observability",
      "agent evaluation",
      "trace replay",
      "developer tools",
    ],
    authors: [{ name: "Zack Zhang", url: "https://github.com/ZackZhang-AI" }],
    creator: "Zack Zhang",
    openGraph: {
      type: "website",
      url: locale === "zh" ? "/zh" : "/",
      siteName: "AgentScope",
      title: dictionary["meta.title"],
      description: dictionary["meta.openGraphDescription"],
      images: [{
        url: "/agentscope-social-card.png",
        width: 1200,
        height: 630,
        alt: dictionary["meta.socialAlt"],
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: dictionary["meta.title"],
      description: dictionary["meta.openGraphDescription"],
      images: ["/agentscope-social-card.png"],
    },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-100 text-zinc-950 antialiased">
        <I18nProvider locale={locale} dictionary={dictionary}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
