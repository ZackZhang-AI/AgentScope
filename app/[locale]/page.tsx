import type { Metadata } from "next";
import { PortfolioHome } from "@/components/agentscope/portfolio-home";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { hasLocale } from "@/lib/i18n/config";
import { localizedAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const dictionary = await getDictionary(locale);
  return {
    title: { absolute: dictionary["meta.title"] },
    description: dictionary["meta.description"],
    alternates: localizedAlternates("/", locale),
  };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) return null;
  return <PortfolioHome locale={locale} />;
}
