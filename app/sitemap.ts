import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/demos/code-fix-loop", "/case-study"].map((path) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified: new Date("2026-08-01"),
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));
}
