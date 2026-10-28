import type { FeatureCollection, Geometry } from "geojson";
import { DomEvent, type Path, type PathOptions } from "leaflet";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import LayerIcon from "./LayerIcons";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { featuresAt } from "./geo";
import { api, type Language, type RegionProps, siteName, type SiteProps, type SiteType, type Stats } from "./api";
import InfoButton from "./InfoButton";

export const COLORS: Record<SiteType, string> = { SCI: "#2563eb", SPA: "#d97706", SCISPA: "#059669" };
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
  dataModified: string;
  language: string;
  lastSync: string;
  locate: string;
  stopLocate: string;
  locating: string;
  inside: string;
  outside: string;
  unknown: string;
  denied: string;
  unavailable: string;
  privacy: string;
  yourPosition: string;
}> = {
  el: {
    title: "Χάρτης Natura Ελλάδα",
    siteTypes: { SCI: "ΤΚΣ (οικότοποι & είδη)", SPA: "ΖΕΠ (πτηνά)", SCISPA: "ΤΚΣ + ΖΕΠ" },
    sites: "τόποι",
    network: "δίκτυο",
    land: "της χερσαίας έκτασης",
    regionCoverage: "Ποσοστό έκτασης Natura 2000 ανά περιφέρεια",
    apiError: "Σφάλμα API:",
    dataCredit: "Πηγές δεδομένων:",
    dataModified: "αναπροβολή, απλοποίηση και παράγωγα μεγέθη",
    language: "Γλώσσα",
    lastSync: "Τελευταίος συγχρονισμός δεδομένων:",
    locate: "Πού βρίσκομαι;",
    stopLocate: "Διακοπή εντοπισμού",
    locating: "Εντοπισμός θέσης…",
    inside: "Βρίσκεστε σε περιοχή Natura 2000",
    outside: "Δεν βρίσκεστε σε περιοχή Natura 2000",
    unknown: "Δεν υπάρχουν δεδομένα τρέχουσας θέσης",
    denied: "Η πρόσβαση στην τοποθεσία απορρίφθηκε.",
    unavailable: "Η θέση δεν είναι διαθέσιμη.",
    privacy: "Η θέση σας επεξεργάζεται μόνο στο πρόγραμμα περιήγησής σας· δεν αποστέλλεται ούτε αποθηκεύεται. Ο έλεγχος είναι κατά προσέγγιση (απλοποιημένα όρια) και δεν έχει νομική ισχύ.",
    yourPosition: "Η θέση σας",
  },
  en: {
    title: "Natura Map Greece",
    siteTypes: { SCI: "SCI (habitats & species)", SPA: "SPA (birds)", SCISPA: "SCI + SPA" },
    sites: "sites",
    network: "network",
    land: "of land",
    regionCoverage: "Natura 2000 area by region (%)",
    apiError: "API error:",
    dataCredit: "Data sources:",
    dataModified: "reprojected, simplified, derived measurements",
    language: "Language",
    lastSync: "Data last synced:",
    locate: "Where am I?",
    stopLocate: "Stop locating",
    locating: "Locating…",
    inside: "You are in a Natura 2000 area",
    outside: "You are not in a Natura 2000 area",
    unknown: "No current location data available",
    denied: "Location permission was denied.",
    unavailable: "Your position is unavailable.",
    privacy: "Your location is processed only in your browser; it is never sent or stored. The check is approximate (simplified boundaries) and has no legal force.",
    yourPosition: "Your position",
  },
};
type Position = { lat: number; lon: number; accuracy: number };
type LocStatus = "idle" | "locating" | "active" | "denied" | "unavailable";

function FlyTo({ pos }: { pos: Position | null }) {
  const map = useMap();
  const lat = pos?.lat;
  const lon = pos?.lon;
  useEffect(() => {
    if (lat !== undefined && lon !== undefined) map.flyTo([lat, lon], Math.max(map.getZoom(), 10));
    // Only recentre when the first fix arrives or the user re-requests; not on every update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, lat === undefined]);
  return null;
}
function ClearSelection({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}
const regionName = (p: RegionProps, language: Language) => (language === "el" ? p.name_el : p.name_en) ?? p.name;
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
  const [collapsed, setCollapsed] = useState(false);
  const [language, setLanguage] = useState<Language>("el");
  const [visible, setVisible] = useState<Record<SiteType, boolean>>({ SCI: true, SPA: true, SCISPA: true });
  const [showRegions, setShowRegions] = useState(false);
  const text = TEXT[language];
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [pos, setPos] = useState<Position | null>(null);
  const watchId = useRef<number | null>(null);
  const selected = useRef<{ layer: Path; style: PathOptions } | null>(null);
  const clearSelection = () => {
    if (selected.current) selected.current.layer.setStyle(selected.current.style);
    selected.current = null;
  };
  const select = (layer: Path) => {
    if (selected.current?.layer === layer) return;
    clearSelection();
    const { color, weight, fillColor, fillOpacity } = layer.options;
    selected.current = { layer, style: { color, weight, fillColor, fillOpacity } };
    layer.setStyle({ color: "#dc2626", weight: 4, fillOpacity: 0.15 });
    layer.bringToFront();
  };

  const stopLocating = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setPos(null);
    setLocStatus("idle");
  };
  const startLocating = () => {
    if (!("geolocation" in navigator)) {
      setLocStatus("unavailable");
      return;
    }
    setLocStatus("locating");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy });
        setLocStatus("active");
      },
      (err) => {
        setPos(null);
        if (err.code === err.PERMISSION_DENIED) {
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          setLocStatus("denied");
        } else {
          setLocStatus("unavailable");
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };
  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  const inNatura = useMemo(
    () => (pos && sites ? featuresAt(sites.features, pos.lon, pos.lat).length > 0 : null),
    [pos, sites],
  );
  const natura =
    inNatura === null
      ? { cls: "unknown", label: text.unknown }
      : inNatura
        ? { cls: "inside", label: text.inside }
        : { cls: "outside", label: text.outside };
  useEffect(() => {
    // Layers are rebuilt on language change, so the old highlighted layer is gone.
    selected.current = null;
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
  const syncDate = stats?.last_etl_run ? new Date(stats.last_etl_run.finished_at) : null;
  const lastSync = syncDate && !isNaN(syncDate.getTime()) ? syncDate : null;

  return (
    <div className="app">
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show panel" : "Hide panel"}
          onClick={() => setCollapsed((c) => !c)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="title">
          <img className="logo" src="/favicon.svg" alt="" width="40" height="40" />
          <h1>{text.title}</h1>
          <div className="lang-toggle" role="group" aria-label={text.language}>
            {(["el", "en"] as Language[]).map((l) => (
              <button key={l} type="button" aria-pressed={language === l} onClick={() => setLanguage(l)}>
                {l === "el" ? "ΕΛ" : "EN"}
              </button>
            ))}
          </div>
          <InfoButton language={language} />
        </div>
        {error && <div className="error">{text.apiError} {error}</div>}
        {stats && cov && (
          <div className="stats">
            <div className="stat"><b>{fmt(stats.total_sites, language)}</b> <span>{text.sites}</span></div>
            <div className="stat"><b>{fmt(cov.network_km2, language)}</b> <span>km² {text.network}</span></div>
            <div className="stat"><b>{fmt(cov.network_land_pct, language, 1)}%</b> <span>{text.land}</span></div>
          </div>
        )}
        {lastSync && (
          <div className="last-sync">
            {text.lastSync}{" "}
            <time dateTime={lastSync.toISOString()}>
              {lastSync.toLocaleDateString(LOCALE[language], { year: "numeric", month: "long", day: "numeric" })}
            </time>
          </div>
        )}

        <div className="locator">
          <button type="button" onClick={locStatus === "idle" || locStatus === "denied" || locStatus === "unavailable" ? startLocating : stopLocating}>
            {locStatus === "idle" || locStatus === "denied" || locStatus === "unavailable" ? text.locate : text.stopLocate}
          </button>
          <div className={`natura-status ${natura.cls}`} role="status">
            <span className="dot" aria-hidden="true" /> {locStatus === "locating" ? text.locating : natura.label}
          </div>
          {locStatus === "denied" && <div className="loc-note">{text.denied}</div>}
          {locStatus === "unavailable" && <div className="loc-note">{text.unavailable}</div>}
          <div className="loc-note" title={text.privacy}>{text.privacy}</div>
        </div>

        <div className="types">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t}
              className="tile"
              aria-pressed={visible[t]}
              aria-label={text.siteTypes[t]}
              style={{ "--tile-color": COLORS[t] } as CSSProperties}
              onClick={() => setVisible({ ...visible, [t]: !visible[t] })}
            >
              <LayerIcon layer={t} />
              <span className="tile-label">{text.siteTypes[t]}</span>
              {stats && <span className="tile-count">{fmt(stats.by_type[t].count, language)}</span>}
            </button>
          ))}
          <button
            type="button"
            className="tile"
            aria-pressed={showRegions}
            aria-label={text.regionCoverage}
            style={{ "--tile-color": "#08519c" } as CSSProperties}
            onClick={() => setShowRegions(!showRegions)}
          >
            <LayerIcon layer="regions" />
            <span className="tile-label">{text.regionCoverage}</span>
          </button>
        </div>
        <footer className="attribution">
          <details>
          <summary>{text.dataCredit}</summary>
          ©{" "}
          <a href="http://geoportal.ypen.gr/geonetwork/srv/eng/catalog.search#/metadata/c140c8d2-3820-4847-bfdc-1d6668d66325" target="_blank" rel="noopener noreferrer">
            {language === "el" ? "Υπουργείο Περιβάλλοντος & Ενέργειας (ΥΠΕΝ)" : "Ministry of Environment & Energy (YPEN)"}
          </a>{" "}
          (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>, {text.dataModified}) ·{" "}
          <a href="https://www.wikidata.org/wiki/Property:P3425" target="_blank" rel="noopener noreferrer">Wikidata</a> (
          <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0</a>) ·{" "}
          <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">geoBoundaries</a> (
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>).
          </details>
          <nav className="legal-links" aria-label={language === "el" ? "Νομικές πληροφορίες" : "Legal information"}>
            <a href="/privacy">{language === "el" ? "Πολιτική απορρήτου" : "Privacy policy"}</a>
            <a href="/imprint">{language === "el" ? "Στοιχεία εκδότη" : "Imprint"}</a>
          </nav>
        </footer>
      </aside>

      <MapContainer center={[39, 23.5]} zoom={6} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (<a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>)'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showRegions && regions && (
          <GeoJSON
            key={`regions:${language}`}
            data={regions}
            style={(f) => ({
              color: "#555",
              weight: 1,
              fillColor: choropleth((f?.properties as RegionProps).protected_pct),
              fillOpacity: 0.6,
            })}
            onEachFeature={(f, layer) => {
              const p = f.properties as RegionProps;
              layer.bindTooltip(`${regionName(p, language)}: ${fmt(p.protected_pct, language, 1)}% ${language === "el" ? "προστατευόμενη έκταση" : "protected"}`, { sticky: true });
              layer.on("click", (e) => { DomEvent.stopPropagation(e); select(layer as Path); });
            }}
          />
        )}
        {/* react-leaflet's GeoJSON ignores data changes, so the key must change when data loads or filters change */}
        <GeoJSON
          key={`${sites ? "loaded" : "empty"}:${language}:${TYPES.filter((t) => visible[t]).join()}`}
          data={filtered}
          style={(f) => {
            const c = COLORS[(f?.properties as SiteProps).sitetype];
            return { color: c, weight: 1.2, fillColor: c, fillOpacity: 0.4 };
          }}
          onEachFeature={(f, layer) => {
            const p = f.properties as SiteProps;
            layer.bindTooltip(
              `${siteName(p, language)} (${p.sitecode})<br/>${text.siteTypes[p.sitetype]} · ${fmt(p.area_km2, language, 1)} km²`,
              { sticky: true },
            );
            layer.on("click", (e) => { DomEvent.stopPropagation(e); select(layer as Path); });
          }}
        />
        <ClearSelection onClear={clearSelection} />
        <FlyTo pos={pos} />
        {pos && (
          <CircleMarker
            center={[pos.lat, pos.lon]}
            radius={8}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#1a73e8", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
