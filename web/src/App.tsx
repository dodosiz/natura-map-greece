import type { FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { api, RegionProps, siteName, SiteProps, SiteType, Stats } from "./api";
import InfoButton from "./InfoButton";

export const COLORS: Record<SiteType, string> = { SCI: "#2b8cbe", SPA: "#e6550d", SCISPA: "#31a354" };
const TYPES: SiteType[] = ["SCI", "SPA", "SCISPA"];
const TYPE_LABEL: Record<SiteType, string> = {
  SCI: "SCI (habitats)",
  SPA: "SPA (birds)",
  SCISPA: "SCI + SPA",
};
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

function choropleth(pct: number) {
  return pct > 40 ? "#08519c" : pct > 30 ? "#3182bd" : pct > 20 ? "#6baed6" : pct > 12 ? "#bdd7e7" : "#eff3ff";
}

export default function App() {
  const [sites, setSites] = useState<FeatureCollection<Geometry, SiteProps> | null>(null);
  const [regions, setRegions] = useState<FeatureCollection<Geometry, RegionProps> | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<SiteType, boolean>>({ SCI: true, SPA: true, SCISPA: true });
  const [showRegions, setShowRegions] = useState(false);

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
          <h1>Natura 2000 – Greece</h1>
          <InfoButton />
        </div>
        {error && <div className="error">API error: {error}</div>}
        {stats && cov && (
          <div className="stats">
            <div><b>{stats.total_sites}</b> sites</div>
            <div><b>{fmt(cov.network_km2)}</b> km² network</div>
            <div><b>{fmt(cov.network_land_pct, 1)}%</b> of land</div>
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
              {TYPE_LABEL[t]} {stats && `(${stats.by_type[t].count})`}
            </label>
          ))}
          <label>
            <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
            Region coverage (% protected)
          </label>
        </div>
        <footer>Data: © Ministry of Environment &amp; Energy (YPEN), CC BY-SA 4.0</footer>
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
              layer.bindTooltip(`${p.name}: ${p.protected_pct.toFixed(1)}% protected`, { sticky: true });
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
              `${siteName(p)} (${p.sitecode})<br/>${TYPE_LABEL[p.sitetype]} · ${fmt(p.area_km2, 1)} km²`,
              { sticky: true },
            );
          }}
        />
      </MapContainer>
    </div>
  );
}
