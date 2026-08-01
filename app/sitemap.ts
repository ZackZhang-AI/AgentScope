import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/demos/code-fix-loop", "/case-study"].flatMap((path) => {
    const english = path;
    const chinese = path === "/" ? "/zh" : `/zh${path}`;
    const languages = {
      en: new URL(english, siteUrl).toString(),
      "zh-CN": new URL(chinese, siteUrl).toString(),
    };
    return [english, chinese].map((localized) => ({
      url: new URL(localized, siteUrl).toString(),
      lastModified: new Date("2026-08-01"),
      changeFrequency: "monthly" as const,
      priority: path === "/" ? 1 : 0.8,
      alternates: { languages },
    }));
  });
}
