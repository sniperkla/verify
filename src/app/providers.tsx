"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n-client";
import { Locale } from "@/lib/i18n-translations";

export default function Providers({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  return (
    <LanguageProvider initialLocale={initialLocale}>
      <SessionProvider>{children}</SessionProvider>
    </LanguageProvider>
  );
}


