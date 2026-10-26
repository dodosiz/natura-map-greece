import { describe, expect, it } from "vitest";
import { geometryContains } from "./geo";

const square = (a: number, b: number) => [[a, a], [b, a], [b, b], [a, b], [a, a]];

describe("geometryContains", () => {
  it("handles polygons with holes", () => {
    const g = { type: "Polygon" as const, coordinates: [square(0, 10), square(4, 6)] };
    expect(geometryContains(g, 2, 2)).toBe(true);
    expect(geometryContains(g, 5, 5)).toBe(false);
    expect(geometryContains(g, 20, 20)).toBe(false);
  });

  it("handles multipolygons and ignores other geometry types", () => {
    const g = { type: "MultiPolygon" as const, coordinates: [[square(0, 1)], [square(10, 11)]] };
    expect(geometryContains(g, 10.5, 10.5)).toBe(true);
    expect(geometryContains(g, 5, 5)).toBe(false);
    expect(geometryContains({ type: "Point", coordinates: [0, 0] }, 0, 0)).toBe(false);
  });
});
