import type { Language } from "./api";

export function initialLanguage(): Language {
  return new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "el";
}

export const pageHref = (path: string, language: Language) => (language === "en" ? `${path}?lang=en` : path);
