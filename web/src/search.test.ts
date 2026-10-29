import { describe, expect, it } from "vitest";
import { normalize, searchSites } from "./search";

const f = (sitecode: string, name_el: string | null, name_en: string | null) =>
  ({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { sitecode, sitetype: "SCI", name_el, name_en, area_km2: 1 } }) as any;

const data = [f("GR1250001", "Όρος Όλυμπος", "Mount Olympus"), f("GR2000002", "Λίμνη Κορώνεια", null), f("GR3000003", null, "Pindos")];

describe("searchSites", () => {
  it("normalizes case and accents", () => {
    expect(normalize("Όλυμπος")).toBe("ολυμπος");
  });
  it("matches Greek accent-insensitively", () => {
    expect(searchSites(data, "ολυμπος", "en").map((x) => x.properties.sitecode)).toEqual(["GR1250001"]);
    expect(searchSites(data, "ΚΟΡΩΝΕΙΑ", "el")).toHaveLength(1);
  });
  it("matches the other-language name and the code", () => {
    expect(searchSites(data, "olympus", "el")).toHaveLength(1);
    expect(searchSites(data, "gr3000003", "el")).toHaveLength(1);
  });
  it("returns nothing for short or empty queries", () => {
    expect(searchSites(data, "", "el")).toEqual([]);
    expect(searchSites(data, " o ", "el")).toEqual([]);
  });
  it("limits results", () => {
    const many = Array.from({ length: 20 }, (_, i) => f(`GR${i}`, null, `Site ${i}`));
    expect(searchSites(many, "site", "en")).toHaveLength(8);
    expect(searchSites(many, "site", "en", 3)).toHaveLength(3);
  });
});
