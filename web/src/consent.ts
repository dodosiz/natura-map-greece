export type Consent = "granted" | "denied" | null;

const STORAGE_KEY = "analytics-consent";
const MEASUREMENT_ID: string = import.meta.env.VITE_GA_MEASUREMENT_ID ?? "";
const OPEN_EVENT = "open-cookie-settings";

// Without a measurement ID (local dev, forks) analytics and the consent banner are disabled.
export const analyticsEnabled = MEASUREMENT_ID !== "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

export function getConsent(): Consent {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

let loaded = false;

function loadAnalytics() {
  window[`ga-disable-${MEASUREMENT_ID}`] = false;
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  const gtag = function (..._args: unknown[]) {
    // gtag.js requires the original `arguments` object, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function deleteAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid" || n.startsWith("_gat"));
  const parts = window.location.hostname.split(".");
  const domains = [window.location.hostname];
  for (let i = 1; i < parts.length - 1; i++) domains.push(`.${parts.slice(i).join(".")}`);
  for (const name of names) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
    }
  }
}

export function setConsent(value: "granted" | "denied") {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable: the choice applies to this page view only.
  }
  if (value === "granted") {
    loadAnalytics();
  } else {
    window[`ga-disable-${MEASUREMENT_ID}`] = true;
    deleteAnalyticsCookies();
  }
}

export function initConsent() {
  if (analyticsEnabled && getConsent() === "granted") loadAnalytics();
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export const COOKIE_SETTINGS_EVENT = OPEN_EVENT;
