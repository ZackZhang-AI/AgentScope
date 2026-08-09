import type { Metadata } from "next";
import { Suspense } from "react";
import { GuidedCodeFixDemo } from "@/components/agentscope/guided-code-fix-demo";
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
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-zinc-50" />}>
      <GuidedCodeFixDemo />
    </Suspense>
  );
}
