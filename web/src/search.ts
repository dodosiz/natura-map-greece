import type { Feature, Geometry } from "geojson";
import { type Language, siteName, type SiteProps } from "./api";

export const MAX_RESULTS = 8;
export const MIN_QUERY = 2;

/** Lower-cases and strips diacritics so "ολυμπος" matches "Όλυμπος". */
export const normalize = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().normalize("NFC");

type SiteFeature = Feature<Geometry, SiteProps>;

export function searchSites(features: SiteFeature[], query: string, language: Language, limit = MAX_RESULTS): SiteFeature[] {
  const q = normalize(query.trim());
  if (q.length < MIN_QUERY) return [];
  const out: SiteFeature[] = [];
  for (const f of features) {
    const p = f.properties;
    const hay = [siteName(p, language), p.name_el, p.name_en, p.sitecode].map((v) => normalize(v ?? ""));
    if (hay.some((h) => h.includes(q))) {
      out.push(f);
      if (out.length >= limit) break;
    }
  }
  return out;
}
