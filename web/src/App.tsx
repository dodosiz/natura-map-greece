import type { Feature, FeatureCollection, Geometry } from "geojson";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import { api, RegionProps, siteName, SiteDetail, SiteProps, SiteType, Stats } from "./api";

export const COLORS: Record<SiteType, string> = { SCI: "#2b8cbe", SPA: "#e6550d", SCISPA: "#31a354" };
const TYPES: SiteType[] = ["SCI", "SPA", "SCISPA"];
const TYPE_LABEL: Record<SiteType, string> = {
  SCI: "SCI (habitats)",
  SPA: "SPA (birds)",
  SCISPA: "SCI + SPA",
};
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

function FlyTo({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.isValid()) map.fitBounds(bounds, { maxZoom: 12, padding: [30, 30] });
  }, [bounds, map]);
  return null;
}

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
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<SiteDetail | null>(null);
  const [selectedGeom, setSelectedGeom] = useState<Feature<Geometry> | null>(null);

  useEffect(() => {
    Promise.all([api.sitesGeoJSON(), api.regions(), api.stats()])
      .then(([s, r, st]) => {
        setSites(s);
        setRegions(r);
        setStats(st);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const select = (code: string) =>
    api
      .site(code)
      .then((f) => {
        setSelected(f.properties);
        setSelectedGeom(f);
      })
      .catch((e) => setError(String(e.message ?? e)));

  const filtered = useMemo(() => {
    if (!sites) return [];
    const q = query.trim().toLowerCase();
    return sites.features.filter((f) => {
      const p = f.properties;
      return (
        visible[p.sitetype] &&
        (!region || p.region_primary === region) &&
        (!q || `${p.sitecode} ${p.name_en ?? ""} ${p.name_el ?? ""}`.toLowerCase().includes(q))
      );
    });
  }, [sites, visible, query, region]);

  const filteredFc = useMemo(
    () => ({ type: "FeatureCollection" as const, features: filtered }),
    [filtered],
  );
  const regionNames = useMemo(
    () => (regions?.features.map((f) => f.properties.name) ?? []).sort(),
    [regions],
  );
  const bounds = useMemo(
    () => (selectedGeom ? L.geoJSON(selectedGeom).getBounds() : null),
    [selectedGeom],
  );
  const cov = stats?.coverage;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Natura 2000 – Greece</h1>
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

        <input
          className="search"
          placeholder="Search name or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All regions</option>
          {regionNames.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        {selected && (
          <div className="detail">
            <button className="close" onClick={() => { setSelected(null); setSelectedGeom(null); }}>×</button>
            <h2>{siteName(selected)}</h2>
            {selected.name_el && selected.name_en && <div className="sub">{selected.name_el}</div>}
            <table>
              <tbody>
                <tr><td>Code</td><td>{selected.sitecode}</td></tr>
                <tr><td>Type</td><td>{TYPE_LABEL[selected.sitetype]}</td></tr>
                <tr><td>Area</td><td>{fmt(selected.area_km2, 1)} km²</td></tr>
                <tr><td>On land</td><td>{fmt(selected.land_share_pct ?? 0)}%</td></tr>
                <tr><td>Regions</td><td>{selected.regions.map((r) => r.region).join(", ") || "—"}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="count">{filtered.length} sites</div>
        <ul className="list">
          {filtered
            .slice()
            .sort((a, b) => siteName(a.properties).localeCompare(siteName(b.properties)))
            .map((f) => (
              <li
                key={f.properties.sitecode}
                className={selected?.sitecode === f.properties.sitecode ? "active" : ""}
                onClick={() => select(f.properties.sitecode)}
              >
                <span className="swatch" style={{ background: COLORS[f.properties.sitetype] }} />
                {siteName(f.properties)}
                <small>{fmt(f.properties.area_km2, 1)} km²</small>
              </li>
            ))}
        </ul>
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
        {/* key forces a re-render when the filtered set changes */}
        <GeoJSON
          key={filtered.map((f) => f.properties.sitecode).join()}
          data={filteredFc}
          style={(f) => {
            const c = COLORS[(f?.properties as SiteProps).sitetype];
            return { color: c, weight: 1, fillColor: c, fillOpacity: 0.35 };
          }}
          onEachFeature={(f, layer) => {
            const p = f.properties as SiteProps;
            layer.bindTooltip(`${siteName(p)} (${p.sitecode})`, { sticky: true });
            layer.on("click", () => select(p.sitecode));
          }}
        />
        {selectedGeom && (
          <GeoJSON
            key={`sel-${selected?.sitecode}`}
            data={selectedGeom}
            style={{ color: "#000", weight: 3, fillOpacity: 0 }}
            interactive={false}
          />
        )}
        <FlyTo bounds={bounds} />
      </MapContainer>
    </div>
  );
}
