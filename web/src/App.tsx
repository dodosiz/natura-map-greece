import type { FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { api, type Language, type RegionProps, siteName, type SiteProps, type SiteType, type Stats } from "./api";
import InfoButton from "./InfoButton";

export const COLORS: Record<SiteType, string> = { SCI: "#2b8cbe", SPA: "#e6550d", SCISPA: "#31a354" };
const TYPES: SiteType[] = ["SCI", "SPA", "SCISPA"];
const TEXT: Record<Language, {
  title: string;
  siteTypes: Record<SiteType, string>;
  sites: string;
  network: string;
  land: string;
  regionCoverage: string;
  apiError: string;
  dataCredit: string;
  language: string;
}> = {
  el: {
    title: "Natura 2000 – Ελλάδα",
    siteTypes: { SCI: "ΤΚΣ (οικότοποι)", SPA: "ΖΕΠ (πτηνά)", SCISPA: "ΤΚΣ + ΖΕΠ" },
    sites: "τόποι",
    network: "δίκτυο",
    land: "της χερσαίας έκτασης",
    regionCoverage: "Κάλυψη περιφερειών (% προστατευόμενη έκταση)",
    apiError: "Σφάλμα API:",
    dataCredit: "Δεδομένα: © Υπουργείο Περιβάλλοντος & Ενέργειας (ΥΠΕΝ), CC BY-SA 4.0",
    language: "Γλώσσα",
  },
  en: {
    title: "Natura 2000 – Greece",
    siteTypes: { SCI: "SCI (habitats)", SPA: "SPA (birds)", SCISPA: "SCI + SPA" },
    sites: "sites",
    network: "network",
    land: "of land",
    regionCoverage: "Region coverage (% protected)",
    apiError: "API error:",
    dataCredit: "Data: © Ministry of Environment & Energy (YPEN), CC BY-SA 4.0",
    language: "Language",
  },
};
const LOCALE: Record<Language, string> = { el: "el-GR", en: "en-US" };
const fmt = (n: number, language: Language, d = 0) =>
  n.toLocaleString(LOCALE[language], { maximumFractionDigits: d });

function choropleth(pct: number) {
  return pct > 40 ? "#08519c" : pct > 30 ? "#3182bd" : pct > 20 ? "#6baed6" : pct > 12 ? "#bdd7e7" : "#eff3ff";
}

export default function App() {
  const [sites, setSites] = useState<FeatureCollection<Geometry, SiteProps> | null>(null);
  const [regions, setRegions] = useState<FeatureCollection<Geometry, RegionProps> | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("el");
  const [visible, setVisible] = useState<Record<SiteType, boolean>>({ SCI: true, SPA: true, SCISPA: true });
  const [showRegions, setShowRegions] = useState(false);
  const text = TEXT[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = text.title;
  }, [language, text.title]);

  useEffect(() => {
    Promise.all([api.sitesGeoJSON(), api.regions(), api.stats()])
      .then(([s, r, st]) => {
        setSites(s);
        setRegions(r);
        setStats(st);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const filtered = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: sites?.features.filter((f) => visible[f.properties.sitetype]) ?? [],
    }),
    [sites, visible],
  );
  const cov = stats?.coverage;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="title">
          <h1>{text.title}</h1>
          <InfoButton language={language} />
        </div>
        <label className="language-select">
          {text.language}
          <select aria-label={text.language} value={language} onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "el")}>
            <option value="el">Ελληνικά</option>
            <option value="en">English</option>
          </select>
        </label>
        {error && <div className="error">{text.apiError} {error}</div>}
        {stats && cov && (
          <div className="stats">
            <div><b>{fmt(stats.total_sites, language)}</b> {text.sites}</div>
            <div><b>{fmt(cov.network_km2, language)}</b> km² {text.network}</div>
            <div><b>{fmt(cov.network_land_pct, language, 1)}%</b> {text.land}</div>
          </div>
        )}

        <div className="types">
          {TYPES.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={visible[t]}
                onChange={(e) => setVisible({ ...visible, [t]: e.target.checked })}
              />
              <span className="swatch" style={{ background: COLORS[t] }} />
              {text.siteTypes[t]} {stats && `(${fmt(stats.by_type[t].count, language)})`}
            </label>
          ))}
          <label>
            <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
            {text.regionCoverage}
          </label>
        </div>
        <footer>{text.dataCredit}</footer>
      </aside>

      <MapContainer center={[39, 23.5]} zoom={6} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showRegions && regions && (
          <GeoJSON
            key="regions"
            data={regions}
            style={(f) => ({
              color: "#555",
              weight: 1,
              fillColor: choropleth((f?.properties as RegionProps).protected_pct),
              fillOpacity: 0.6,
            })}
            onEachFeature={(f, layer) => {
              const p = f.properties as RegionProps;
              layer.bindTooltip(`${p.name}: ${fmt(p.protected_pct, language, 1)}% ${language === "el" ? "προστατευόμενη έκταση" : "protected"}`, { sticky: true });
            }}
          />
        )}
        {/* react-leaflet's GeoJSON ignores data changes, so the key must change when data loads or filters change */}
        <GeoJSON
          key={`${sites ? "loaded" : "empty"}:${TYPES.filter((t) => visible[t]).join()}`}
          data={filtered}
          style={(f) => {
            const c = COLORS[(f?.properties as SiteProps).sitetype];
            return { color: c, weight: 1, fillColor: c, fillOpacity: 0.35 };
          }}
          onEachFeature={(f, layer) => {
            const p = f.properties as SiteProps;
            layer.bindTooltip(
              `${siteName(p, language)} (${p.sitecode})<br/>${text.siteTypes[p.sitetype]} · ${fmt(p.area_km2, language, 1)} km²`,
              { sticky: true },
            );
          }}
        />
      </MapContainer>
    </div>
  );
}
