import { cookies } from "next/headers";
import { translations, Locale } from "./i18n-translations";

export async function getLocaleServer(): Promise<Locale> {
  const cookieStore = await cookies();
  const val = cookieStore.get("locale")?.value;
  return (val === "en" || val === "th" ? val : "th") as Locale; // default to Thai
}

export async function getTranslationsServer() {
  const locale = await getLocaleServer();
  return (key: keyof typeof translations.en) => {
    const dict = translations[locale];
    return dict[key] || translations.th[key] || key;
  };
}
export type ServerTranslator = Awaited<ReturnType<typeof getTranslationsServer>>;
