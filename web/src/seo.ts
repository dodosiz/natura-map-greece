import type { Language } from "./api";

const SITE_URL = "https://natura-map.gr";

type PageMetadata = {
  title: string;
  description: string;
  language: Language;
  path: string;
};

function setMetaContent(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
}

export function updatePageMetadata({ title, description, language, path }: PageMetadata) {
  document.title = title;
  document.documentElement.lang = language;

  const canonical = new URL(path, SITE_URL);
  if (language === "en") canonical.searchParams.set("lang", "en");
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonical.href);
  setMetaContent('meta[property="og:locale"]', language === "el" ? "el_GR" : "en_US");
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonical.href);

  for (const alternateLanguage of ["el", "en"] as const) {
    const alternate = new URL(path, SITE_URL);
    if (alternateLanguage === "en") alternate.searchParams.set("lang", "en");
    document
      .querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${alternateLanguage}"]`)
      ?.setAttribute("href", alternate.href);
  }
  document
    .querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="x-default"]')
    ?.setAttribute("href", new URL(path, SITE_URL).href);
}
