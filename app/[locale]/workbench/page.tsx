import type { Metadata } from "next";
import { AdvancedRunWorkbench } from "@/components/agentscope/advanced-run-workbench";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { hasLocale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const dictionary = await getDictionary(locale);
  return {
    title: dictionary["workbench.metaTitle"],
    description: dictionary["workbench.metaDescription"],
    robots: { index: false, follow: false },
  };
}

export default function WorkbenchPage() {
  return <AdvancedRunWorkbench />;
}
