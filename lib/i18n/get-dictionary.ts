import "server-only";
import type { Dictionary, Locale } from "./config";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  zh: () => import("./dictionaries/zh.json").then((module) => module.default),
};

export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
