"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { translations, Locale } from "./i18n-translations";

type LanguageContextType = {
  locale: Locale;
  setLocale: (lang: Locale) => void;
  t: (key: keyof typeof translations.en) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    // Set cookie
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Set localStorage for client persistence
    localStorage.setItem("locale", newLocale);
    // Trigger router refresh to re-run Server Components with new cookie
    router.refresh();
  };

  // Sync state on client mount if local storage differs
  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && saved !== locale && (saved === "en" || saved === "th")) {
      setLocale(saved);
    }
  }, []);

  const t = (key: keyof typeof translations.en): string => {
    const dict = translations[locale];
    return dict[key] || translations.th[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
