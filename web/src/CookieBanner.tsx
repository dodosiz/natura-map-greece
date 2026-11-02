import { useEffect, useState } from "react";
import { analyticsEnabled, COOKIE_SETTINGS_EVENT, getConsent, setConsent } from "./consent";
import { initialLanguage, pageHref } from "./lang";

const COPY = {
  el: {
    label: "Συγκατάθεση για cookies",
    text: "Χρησιμοποιούμε το Google Analytics (cookies) για στατιστικά επισκεψιμότητας, μόνο αν συναινέσετε. Ο χάρτης λειτουργεί κανονικά και χωρίς αυτό.",
    accept: "Αποδοχή",
    reject: "Απόρριψη",
    more: "Πολιτική απορρήτου",
  },
  en: {
    label: "Cookie consent",
    text: "We use Google Analytics (cookies) for visitor statistics only if you consent. The map works the same without it.",
    accept: "Accept",
    reject: "Reject",
    more: "Privacy policy",
  },
};

export default function CookieBanner() {
  const [open, setOpen] = useState(() => getConsent() === null);
  const language = initialLanguage();
  const copy = COPY[language];

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, show);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, show);
  }, []);

  if (!analyticsEnabled || !open) return null;
  const choose = (value: "granted" | "denied") => {
    setConsent(value);
    setOpen(false);
  };

  return (
    <div className="cookie-banner" role="region" aria-label={copy.label}>
      <p>
        {copy.text} <a href={pageHref("/privacy", language)}>{copy.more}</a>
      </p>
      <div className="cookie-actions">
        <button type="button" onClick={() => choose("denied")}>{copy.reject}</button>
        <button type="button" onClick={() => choose("granted")}>{copy.accept}</button>
      </div>
    </div>
  );
}
