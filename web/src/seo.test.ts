import { beforeEach, describe, expect, it } from "vitest";
import { updatePageMetadata } from "./seo";

describe("updatePageMetadata", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" />
      <meta property="og:title" />
      <meta property="og:description" />
      <meta property="og:url" />
      <meta property="og:locale" />
      <link rel="canonical" />
      <link rel="alternate" hreflang="el" />
      <link rel="alternate" hreflang="en" />
      <link rel="alternate" hreflang="x-default" />
    `;
  });

  it("sets localized metadata and canonical URLs for the homepage", () => {
    updatePageMetadata({
      title: "Natura Map Greece",
      description: "Explore Natura 2000 sites in Greece.",
      language: "en",
      path: "/",
    });

    expect(document.title).toBe("Natura Map Greece");
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "Explore Natura 2000 sites in Greece.",
    );
    expect(document.querySelector('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://natura-map.gr/?lang=en",
    );
    expect(document.querySelector('link[hreflang="el"]')).toHaveAttribute("href", "https://natura-map.gr/");
    expect(document.querySelector('link[hreflang="en"]')).toHaveAttribute(
      "href",
      "https://natura-map.gr/?lang=en",
    );
  });

  it("keeps legal page canonicals separate from the map", () => {
    updatePageMetadata({
      title: "Privacy policy",
      description: "Learn about privacy.",
      language: "el",
      path: "/privacy",
    });

    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://natura-map.gr/privacy",
    );
    expect(document.querySelector('link[hreflang="en"]')).toHaveAttribute(
      "href",
      "https://natura-map.gr/privacy?lang=en",
    );
  });
});
