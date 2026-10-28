import "leaflet/dist/leaflet.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LegalPage from "./LegalPage";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const legalPage = path === "/privacy" ? "privacy" : path === "/imprint" ? "imprint" : null;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {legalPage ? <LegalPage page={legalPage} /> : <App />}
  </React.StrictMode>,
);
