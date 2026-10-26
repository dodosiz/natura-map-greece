import type { FeatureCollection, Geometry } from "geojson";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export type SiteType = "SCI" | "SPA" | "SCISPA";

export interface SiteProps {
  sitecode: string;
  sitetype: SiteType;
  name_en: string | null;
  name_el: string | null;
  area_km2: number;
  land_share_pct: number | null;
  region_primary: string | null;
  centroid_lon: number;
  centroid_lat: number;
}

export interface RegionProps {
  name: string;
  area_km2: number;
  protected_km2: number;
  protected_pct: number;
  n_sites: number;
}

export interface Stats {
  total_sites: number;
  by_type: Record<SiteType, { count: number; area_km2: number }>;
  coverage: Record<string, number>;
  last_etl_run: { finished_at: string } | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
  return res.json();
}

export const api = {
  sitesGeoJSON: () => get<FeatureCollection<Geometry, SiteProps>>("/sites/geojson"),
  regions: () => get<FeatureCollection<Geometry, RegionProps>>("/regions"),
  stats: () => get<Stats>("/stats"),
};

export const siteName = (p: Pick<SiteProps, "name_en" | "name_el" | "sitecode">) =>
  p.name_en ?? p.name_el ?? p.sitecode;

