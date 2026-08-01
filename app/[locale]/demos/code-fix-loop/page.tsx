import type { Metadata } from "next";
import { CodeFixWorkbench } from "@/components/agentscope/code-fix-workbench";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { hasLocale } from "@/lib/i18n/config";
import { localizedAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const dictionary = await getDictionary(locale);
  return {
    title: dictionary["demo.metaTitle"],
    description: dictionary["demo.metaDescription"],
    alternates: localizedAlternates("/demos/code-fix-loop", locale),
  };
}

export default function CodeFixDemoPage() {
  return <CodeFixWorkbench autoStartDemo />;
}
