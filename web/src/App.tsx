import type { Feature, FeatureCollection, Geometry } from "geojson";
import { DomEvent, geoJSON, type Layer, type LatLngBounds, type Path, type PathOptions, type TooltipOptions } from "leaflet";
import { createPortal } from "react-dom";
import { type CSSProperties, memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import LayerIcon from "./LayerIcons";
import { Circle, CircleMarker, GeoJSON, MapContainer, Pane, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { featuresAt } from "./geo";
import { MIN_QUERY, searchSites } from "./search";
import { api, type Language, type RegionProps, siteName, type SiteProps, type SiteType, type Stats } from "./api";
import InfoButton from "./InfoButton";
import { TEXT } from "./i18n";
import { initialLanguage, pageHref } from "./lang";
import { updatePageMetadata } from "./seo";

export const COLORS: Record<SiteType, string> = { SCI: "#2563eb", SPA: "#d97706", SCISPA: "#059669" };
const TYPES: SiteType[] = ["SCI", "SPA", "SCISPA"];
type Position = { lat: number; lon: number; accuracy: number };
type SheetState = "collapsed" | "default" | "expanded";
const NEXT_SHEET: Record<SheetState, SheetState> = { collapsed: "default", default: "expanded", expanded: "collapsed" };
type LoadStatus = "loading" | "ok" | "error";
type Resource = "sites" | "regions" | "stats";
type LocStatus = "idle" | "locating" | "active" | "denied" | "unavailable";

function FlyTo({ pos }: { pos: Position | null }) {
  const map = useMap();
  const lat = pos?.lat;
  const lon = pos?.lon;
  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const zoom = Math.max(map.getZoom(), 10);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) map.setView([lat, lon], zoom);
    else map.flyTo([lat, lon], zoom);
    // Only recentre when the first fix arrives or the user re-requests; not on every update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, lat === undefined]);
  return null;
}
type FocusTarget = { bounds: LatLngBounds; code: string; nonce: number };
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function FitTo({ target }: { target: FocusTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    // The sidebar covers the left on desktop and the bottom ~45% (default sheet) on mobile.
    const mobile = window.matchMedia?.("(max-width: 760px)").matches ?? false;
    map.fitBounds(target.bounds, {
      paddingTopLeft: [mobile ? 24 : 368, 24],
      paddingBottomRight: [24, mobile ? Math.round(window.innerHeight * 0.45) + 24 : 24],
      maxZoom: 13,
      animate: !reducedMotion(),
    });
  }, [map, target]);
  return null;
}

function SiteSearch({ sites, language, loaded, onChoose, onActivate }: {
  sites: FeatureCollection<Geometry, SiteProps> | null;
  language: Language;
  loaded: boolean;
  onChoose: (f: Feature<Geometry, SiteProps>) => void;
  onActivate?: () => void;
}) {
  const text = TEXT[language];
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => (sites ? searchSites(sites.features, query, language) : []), [sites, query, language]);
  const searching = query.trim().length >= MIN_QUERY;
  const expanded = open && searching;
  const optionId = (i: number) => `${id}-opt-${i}`;
  const choose = (f: Feature<Geometry, SiteProps>) => {
    setOpen(false);
    setQuery("");
    onChoose(f);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!results.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : results.length - 1;
      setActive((a) => (a + step) % results.length);
    } else if (e.key === "Enter" && expanded && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape" && (query || open)) {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };
  return (
    <div className="site-search">
      <input
        type="search"
        role="combobox"
        aria-label={text.searchSites}
        placeholder={loaded ? text.searchSites : text.loadingSites}
        disabled={!loaded}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && results.length ? optionId(active) : undefined}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); onActivate?.(); }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        onFocus={() => { setOpen(true); onActivate?.(); }}
      />
      <ul id={listId} role="listbox" aria-label={text.searchSites} hidden={!expanded}>
        {expanded && results.map((f, i) => (
          <li
            key={f.properties.sitecode}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(f)}
            onMouseEnter={() => setActive(i)}
          >
            <span className="dot" style={{ background: COLORS[f.properties.sitetype] }} aria-hidden="true" />
            <span className="result-name">{siteName(f.properties, language)}</span>
            <span className="result-code">{f.properties.sitecode}</span>
          </li>
        ))}
        {expanded && results.length === 0 && <li className="no-results" role="option" aria-disabled="true" aria-selected="false">{text.noResults}</li>}
      </ul>
    </div>
  );
}

function ClearSelection({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}
const regionName = (p: RegionProps, language: Language) => (language === "el" ? p.name_el : p.name_en) ?? p.name;
const LOCALE: Record<Language, string> = { el: "el-GR", en: "en-US" };
const fmt = (n: number, language: Language, d = 0) =>
  n.toLocaleString(LOCALE[language], { maximumFractionDigits: d });

type Selection = { kind: "site"; props: SiteProps } | { kind: "region"; props: RegionProps };

export function FeatureCard({ selection, language, onClose }: { selection: Selection; language: Language; onClose: () => void }) {
  const text = TEXT[language];
  const isSite = selection.kind === "site";
  const name = isSite ? siteName(selection.props, language) : regionName(selection.props, language);
  const rows: [string, string][] = [];
  if (selection.kind === "site") {
    rows.push([text.siteCodeLabel, selection.props.sitecode]);
    if (selection.props.area_km2 != null) rows.push([text.areaLabel, `${fmt(selection.props.area_km2, language, 1)} km²`]);
  } else {
    const r = selection.props;
    if (r.protected_pct != null) rows.push([text.protectedShareLabel, `${fmt(r.protected_pct, language, 1)}%`]);
    if (r.protected_km2 != null) rows.push([text.areaLabel, `${fmt(r.protected_km2, language, 1)} km²`]);
    if (r.n_sites != null) rows.push([text.sitesCountLabel, fmt(r.n_sites, language)]);
  }
  return (
    <div className="feature-card" role="region" aria-label={name} aria-live="polite">
      <div className="feature-head">
        <h2>{name}</h2>
        <button type="button" className="close" aria-label={text.closeDetails} onClick={onClose}>×</button>
      </div>
      {selection.kind === "site" && (
        <div className="feature-type">
          <span className="dot" style={{ background: COLORS[selection.props.sitetype] }} aria-hidden="true" />
          {text.siteTypes[selection.props.sitetype]}
        </div>
      )}
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

// Hover tooltips are useless (and sticky) on touch-only devices.
const bindTooltip = (layer: Layer, content: string, options?: TooltipOptions) => {
  if (window.matchMedia?.("(hover: hover)").matches ?? true) layer.bindTooltip(content, options);
};

// Single source of truth for the choropleth and its legend (ColorBrewer RdPu 5-class, colour-blind safe, distinct from site colours).
// Ascending by `max`: a value belongs to the first bin where pct <= max.
export const REGION_BINS = [
  { max: 12, color: "#fcc5c0", label: "< 12%" },
  { max: 20, color: "#f98fae", label: "12–20%" },
  { max: 30, color: "#f768a1", label: "20–30%" },
  { max: 40, color: "#c51b8a", label: "30–40%" },
  { max: Infinity, color: "#7a0177", label: "> 40%" },
] as const;

export function choropleth(pct: number) {
  return (REGION_BINS.find((b) => pct <= b.max) ?? REGION_BINS[REGION_BINS.length - 1]).color;
}

function RegionLegend({ title }: { title: string }) {
  return (
    <div className="legend" role="group" aria-labelledby="legend-title">
      <div className="legend-title" id="legend-title">{title}</div>
      <ul>
        {REGION_BINS.map((b) => (
          <li key={b.label}><span className="swatch" style={{ background: b.color }} aria-hidden="true" />{b.label}</li>
        ))}
      </ul>
    </div>
  );
}

const INITIAL_CENTER: [number, number] = [39, 23.5];
const INITIAL_ZOOM = 6;

function MapButtons({ pos, text }: { pos: Position | null; text: { centreOnMe: string; resetView: string } }) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  // Render inside Leaflet's top-left corner so it stacks under the zoom control with identical alignment.
  const [corner, setCorner] = useState<Element | null>(null);
  useEffect(() => {
    setCorner(map.getContainer().querySelector(".leaflet-top.leaflet-left"));
  }, [map]);
  useEffect(() => {
    if (ref.current) {
      DomEvent.disableClickPropagation(ref.current);
      DomEvent.disableScrollPropagation(ref.current);
    }
  }, [corner]);
  const centre = () => {
    if (!pos) return;
    const zoom = Math.max(map.getZoom(), 10);
    if (reducedMotion()) map.setView([pos.lat, pos.lon], zoom);
    else map.flyTo([pos.lat, pos.lon], zoom);
  };
  if (!corner) return null;
  return createPortal(
    <div className="map-actions leaflet-bar leaflet-control" ref={ref}>
      {pos && (
        <button type="button" aria-label={text.centreOnMe} title={text.centreOnMe} onClick={centre}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
      <button
        type="button"
        aria-label={text.resetView}
        title={text.resetView}
        onClick={() => map.setView(INITIAL_CENTER, INITIAL_ZOOM, { animate: !reducedMotion() })}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 12 12 4l9 8" /><path d="M5 10v10h5v-6h4v6h5V10" />
        </svg>
      </button>
    </div>,
    corner,
  );
}

// Stable references: react-leaflet re-applies `style` when its identity changes, which would erase the selection highlight on every location update.
const regionStyle = (f?: Feature<Geometry, any>): PathOptions => ({
  color: "#4a044e",
  weight: 0.8,
  dashArray: "3 3",
  fillColor: choropleth((f?.properties as RegionProps).protected_pct),
  fillOpacity: 0.38,
});
const siteStyle = (f?: Feature<Geometry, any>): PathOptions => {
  const c = COLORS[(f?.properties as SiteProps).sitetype];
  return { color: c, weight: 1.2, fillColor: c, fillOpacity: 0.4 };
};

type LayerSelect = (layer: Path, next: Selection) => void;

const RegionLayer = memo(function RegionLayer({ data, language, protectedSuffix, onSelect }: {
  data: FeatureCollection<Geometry, RegionProps>;
  language: Language;
  protectedSuffix: string;
  onSelect: LayerSelect;
}) {
  const onEachFeature = useCallback(
    (f: Feature<Geometry, any>, layer: Layer) => {
      const p = f.properties as RegionProps;
      bindTooltip(layer, `${regionName(p, language)}: ${fmt(p.protected_pct, language, 1)}% ${protectedSuffix}`, { sticky: true });
      layer.on("click", (e) => { DomEvent.stopPropagation(e); onSelect(layer as Path, { kind: "region", props: p }); });
    },
    [language, protectedSuffix, onSelect],
  );
  return <GeoJSON data={data} style={regionStyle} onEachFeature={onEachFeature} />;
});

const SiteTypeLayer = memo(function SiteTypeLayer({ features, language, siteTypeLabel, registry, onSelect }: {
  features: Feature<Geometry, SiteProps>[];
  language: Language;
  siteTypeLabel: string;
  registry: { current: Map<string, Path> };
  onSelect: LayerSelect;
}) {
  const data = useMemo(() => ({ type: "FeatureCollection" as const, features }), [features]);
  const onEachFeature = useCallback(
    (f: Feature<Geometry, any>, layer: Layer) => {
      const p = f.properties as SiteProps;
      registry.current.set(p.sitecode, layer as Path);
      bindTooltip(layer, `${siteName(p, language)} (${p.sitecode})<br/>${siteTypeLabel} · ${fmt(p.area_km2, language, 1)} km²`, { sticky: true });
      layer.on("click", (e) => { DomEvent.stopPropagation(e); onSelect(layer as Path, { kind: "site", props: p }); });
    },
    [language, siteTypeLabel, registry, onSelect],
  );
  useEffect(() => () => {
    for (const f of features) registry.current.delete(f.properties.sitecode);
  }, [features, registry]);
  return <GeoJSON data={data} style={siteStyle} onEachFeature={onEachFeature} />;
});

export default function App() {
  const [sites, setSites] = useState<FeatureCollection<Geometry, SiteProps> | null>(null);
  const [regions, setRegions] = useState<FeatureCollection<Geometry, RegionProps> | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<Record<Resource, LoadStatus>>({ sites: "loading", regions: "loading", stats: "loading" });
  const [sheet, setSheet] = useState<SheetState>("default");
  const collapsed = sheet === "collapsed";
  const openSheet = () => setSheet((s) => (s === "collapsed" ? "default" : s));
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [visible, setVisible] = useState<Record<SiteType, boolean>>({ SCI: true, SPA: true, SCISPA: true });
  const [showRegions, setShowRegions] = useState(false);
  const text = TEXT[language];
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [pos, setPos] = useState<Position | null>(null);
  const watchId = useRef<number | null>(null);
  const selected = useRef<{ layer: Path; style: PathOptions } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const siteLayers = useRef<Map<string, Path>>(new Map());
  const applied = useRef(0);
  const sidebarRef = useRef<HTMLElement>(null);
  const clearHighlight = () => {
    if (selected.current) {
      selected.current.layer.setStyle(selected.current.style);
      selected.current.layer.getElement?.()?.classList.remove("is-selected");
    }
    selected.current = null;
  };
  const clearSelection = () => {
    clearHighlight();
    setSelection(null);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if ((e.target as Element | null)?.closest?.('[role="dialog"], dialog')) return;
      clearSelection();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (selection) {
      setSheet("default");
      sidebarRef.current?.scrollTo?.({ top: 0 });
    }
  }, [selection]);
  const select = useCallback((layer: Path, next: Selection) => {
    setSelection(next);
    if (selected.current?.layer === layer) return;
    clearHighlight();
    const { color, weight, fillColor, fillOpacity } = layer.options;
    selected.current = { layer, style: { color, weight, fillColor, fillOpacity } };
    layer.setStyle({ color: "#0f172a", weight: 3, fillOpacity: 0.5 });
    layer.getElement?.()?.classList.add("is-selected");
    layer.bringToFront();
  }, []);

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
    setSelection(null);
    updatePageMetadata({
      title: text.seoTitle,
      description: text.seoDescription,
      language,
      path: "/",
    });
  }, [language, text.seoDescription, text.seoTitle]);

  const load = (which: Resource[]) => {
    const setters = { sites: setSites, regions: setRegions, stats: setStats } as Record<Resource, (v: any) => void>;
    const calls = { sites: api.sitesGeoJSON, regions: api.regions, stats: api.stats };
    setStatus((s) => ({ ...s, ...Object.fromEntries(which.map((r) => [r, "loading"])) }));
    for (const r of which) {
      calls[r]().then(
        (data) => {
          setters[r](data);
          setStatus((s) => ({ ...s, [r]: "ok" }));
        },
        (e) => {
          console.error(`Failed to load ${r}`, e);
          setStatus((s) => ({ ...s, [r]: "error" }));
        },
      );
    }
  };
  useEffect(() => load(["sites", "regions", "stats"]), []);
  const failed = (Object.keys(status) as Resource[]).filter((r) => status[r] === "error");
  const noLayers = !showRegions && TYPES.every((t) => !visible[t]);

  const byType = useMemo(() => {
    const m: Record<SiteType, Feature<Geometry, SiteProps>[]> = { SCI: [], SPA: [], SCISPA: [] };
    for (const f of sites?.features ?? []) m[f.properties.sitetype].push(f);
    return m;
  }, [sites]);
  const sitesKey = `${sites ? "loaded" : "empty"}:${language}:${TYPES.filter((t) => visible[t]).join()}`;
  const chooseSite = (f: Feature<Geometry, SiteProps>) => {
    const p = f.properties;
    if (!visible[p.sitetype]) setVisible((v) => ({ ...v, [p.sitetype]: true }));
    setFocus((prev) => ({ bounds: geoJSON(f).getBounds(), code: p.sitecode, nonce: (prev?.nonce ?? 0) + 1 }));
  };
  // Runs after the layers for the new key exist, so a hidden type that was just turned on can be highlighted.
  useEffect(() => {
    if (!focus || !sites || applied.current === focus.nonce) return;
    const layer = siteLayers.current.get(focus.code);
    const props = sites.features.find((f) => f.properties.sitecode === focus.code)?.properties;
    if (layer && props) {
      applied.current = focus.nonce;
      select(layer, { kind: "site", props });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, sitesKey]);
  const cov = stats?.coverage;
  const syncDate = stats?.last_etl_run ? new Date(stats.last_etl_run.finished_at) : null;
  const lastSync = syncDate && !isNaN(syncDate.getTime()) ? syncDate : null;

  return (
    <main className="app" data-sheet={sheet}>
      <aside ref={sidebarRef} className={`sidebar sheet-${sheet}${collapsed ? " collapsed" : ""}`} data-sheet={sheet}>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={!collapsed}
          aria-label={sheet === "collapsed" ? text.showPanel : sheet === "default" ? text.expandPanel : text.hidePanel}
          onClick={() => setSheet((s) => NEXT_SHEET[s])}
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
        <SiteSearch sites={sites} language={language} loaded={status.sites === "ok"} onChoose={chooseSite} onActivate={openSheet} />
        {selection && <FeatureCard selection={selection} language={language} onClose={clearSelection} />}
        {failed.length > 0 && (
          <div className="error" role="alert">
            <span>{text.loadError}</span>
            <button type="button" onClick={() => load(failed)}>{text.retry}</button>
          </div>
        )}
        <div className="layers">
          <h2 id="layers-heading">{text.layers}</h2>
          {noLayers && <p className="empty-hint">{text.noLayers}</p>}
          <div className="types" role="group" aria-labelledby="layers-heading">
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
              style={{ "--tile-color": "#c51b8a" } as CSSProperties}
              onClick={() => setShowRegions(!showRegions)}
            >
              <LayerIcon layer="regions" />
              <span className="tile-label">{text.regionCoverage}</span>
            </button>
          </div>
        </div>
        {status.stats === "loading" && (
          <div className="stats skeleton" aria-hidden="true">
            {[0, 1, 2].map((i) => <div className="stat" key={i}><b /><span /></div>)}
          </div>
        )}
        {stats && cov && (
          <div className="stats">
            <div className="stat"><b>{fmt(stats.total_sites, language)}</b> <span>{text.sites}</span></div>
            <div className="stat"><b>{fmt(cov.network_km2, language)}</b> <span>km² {text.network}</span></div>
            <div className="stat"><b>{fmt(cov.network_land_pct, language, 1)}%</b> <span>{text.land}</span></div>
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
          <div className="loc-note">{text.privacyShort}</div>
          <details className="loc-more">
            <summary>{text.learnMore}</summary>
            <p className="loc-note">{text.privacy}</p>
          </details>
        </div>

        <details className="about">
          <summary>{text.aboutMap}</summary>
          <h2 id="intro-heading">{text.aboutHeading}</h2>
          <p>{text.about}</p>
        </details>
        <footer className="attribution">
          {lastSync && (
            <div className="last-sync">
              {text.lastSync}{" "}
              <time dateTime={lastSync.toISOString()}>
                {lastSync.toLocaleDateString(LOCALE[language], { year: "numeric", month: "long", day: "numeric" })}
              </time>
            </div>
          )}
          <details>
          <summary>{text.dataCredit}</summary>
          ©{" "}
          <a href="http://geoportal.ypen.gr/geonetwork/srv/eng/catalog.search#/metadata/c140c8d2-3820-4847-bfdc-1d6668d66325" target="_blank" rel="noopener noreferrer">
            {text.ypen}
          </a>{" "}
          (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>, {text.dataModified}) ·{" "}
          <a href="https://www.wikidata.org/wiki/Property:P3425" target="_blank" rel="noopener noreferrer">Wikidata</a> (
          <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0</a>) ·{" "}
          <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">geoBoundaries</a> (
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>).
          </details>
          <nav className="legal-links"           aria-label={text.legalNav}>
                      <a href={pageHref("/privacy", language)}>{text.privacyPolicy}</a>
                      <a href={pageHref("/imprint", language)}>{text.imprint}</a>
          </nav>
        </footer>
      </aside>

      {status.sites === "loading" && (
        <div className="map-chip" role="status" aria-live="polite">{text.loadingSites}</div>
      )}
      <MapContainer center={INITIAL_CENTER} zoom={INITIAL_ZOOM} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (<a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>)'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Regions get their own pane below the default overlay pane (400) so sites stay on top and clickable. */}
        <Pane name="regions" style={{ zIndex: 390 }}>
          {showRegions && regions && <RegionLayer key={`regions:${language}`} data={regions} language={language} protectedSuffix={text.protectedSuffix} onSelect={select} />}
        </Pane>
        {/* One GeoJSON per type, so toggling a type only mounts/unmounts that layer and leaves the others and the selection alone. */}
        {TYPES.map((t) =>
          visible[t] && byType[t].length ? (
            <SiteTypeLayer key={`${t}:${language}`} features={byType[t]} language={language} siteTypeLabel={text.siteTypes[t]} registry={siteLayers} onSelect={select} />
          ) : null,
        )}
        <FitTo target={focus} />
        <ClearSelection onClear={clearSelection} />
        <FlyTo pos={pos} />
        <MapButtons pos={locStatus === "idle" ? null : pos} text={text} />
        {pos && (
          <Circle
            center={[pos.lat, pos.lon]}
            radius={pos.accuracy}
            interactive={false}
            pathOptions={{ color: "#1a73e8", weight: 1, fillColor: "#1a73e8", fillOpacity: 0.1 }}
          />
        )}
        {pos && (
          <CircleMarker
            center={[pos.lat, pos.lon]}
            radius={8}
            interactive={false}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#1a73e8", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
      {showRegions && <RegionLegend title={text.legendTitle} />}
    </main>
  );
}
