import type { Metadata } from "next";
import type { Locale } from "./config";
import { localizedPath } from "./config";

export function localizedAlternates(path: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: localizedPath(path, locale),
    languages: {
      en: localizedPath(path, "en"),
      "zh-CN": localizedPath(path, "zh"),
    },
  };
}
