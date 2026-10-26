import type { Feature, Geometry } from "geojson";

type Ring = number[][];

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// First ring is the outer boundary, the rest are holes.
function inPolygon(lon: number, lat: number, rings: Ring[]): boolean {
  return rings.length > 0 && inRing(lon, lat, rings[0]) && !rings.slice(1).some((h) => inRing(lon, lat, h));
}

export function geometryContains(geometry: Geometry, lon: number, lat: number): boolean {
  if (geometry.type === "Polygon") return inPolygon(lon, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((p) => inPolygon(lon, lat, p));
  return false;
}

/** Returns the features whose geometry contains the position. */
export function featuresAt<P>(features: Feature<Geometry, P>[], lon: number, lat: number): Feature<Geometry, P>[] {
  return features.filter((f) => geometryContains(f.geometry, lon, lat));
}
