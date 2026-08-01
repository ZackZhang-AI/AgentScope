import en from "./dictionaries/en.json";

export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export type Dictionary = typeof en;
export type MessageKey = keyof Dictionary;

export const defaultLocale: Locale = "en";

export function hasLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function stripLocalePrefix(pathname: string) {
  const stripped = pathname.replace(/^\/(?:en|zh)(?=\/|$)/, "");
  return stripped || "/";
}

export function localizedPath(path: string, locale: Locale) {
  const match = path.match(/^([^?#]*)([?#].*)?$/);
  const pathname = stripLocalePrefix(match?.[1] || "/");
  const suffix = match?.[2] ?? "";
  if (locale === "zh") {
    return `${pathname === "/" ? "/zh" : `/zh${pathname}`}${suffix}`;
  }
  return `${pathname}${suffix}`;
}

export function formatMessage(
  template: string,
  values: Record<string, string | number> = {},
) {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder,
  );
}
