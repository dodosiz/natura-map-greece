import "leaflet/dist/leaflet.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LegalPage from "./LegalPage";
import CookieBanner from "./CookieBanner";
import { initConsent } from "./consent";
import "./styles.css";

initConsent();

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const legalPage = path === "/privacy" ? "privacy" : path === "/imprint" ? "imprint" : null;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {legalPage ? <LegalPage page={legalPage} /> : <App />}
    <CookieBanner />
  </React.StrictMode>,
);
