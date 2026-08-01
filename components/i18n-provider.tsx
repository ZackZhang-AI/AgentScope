"use client";

import { createContext, useContext, useMemo } from "react";
import {
  formatMessage,
  localizedPath,
  type Dictionary,
  type Locale,
  type MessageKey,
} from "@/lib/i18n/config";

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  localizedPath: (path: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  dictionary,
  locale,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    dictionary,
    t: (key, values) => formatMessage(dictionary[key], values),
    localizedPath: (path) => localizedPath(path, locale),
  }), [dictionary, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider.");
  return value;
}
