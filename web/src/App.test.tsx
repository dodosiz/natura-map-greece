import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useState } from "react";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div>{children}</div>,
  TileLayer: () => null,
  // Like the real component, only the data and callbacks given at mount time are used; later prop changes are ignored.
  GeoJSON: ({ data, onEachFeature }: any) => {
    const [mounted] = useState(data);
    const [tooltips] = useState(() => {
      const out: string[] = [];
      for (const f of mounted.features) onEachFeature?.(f, { bindTooltip: (t: string) => out.push(t), on: () => {} });
      return out;
    });
    return <div data-testid="geojson" data-count={mounted.features.length} data-tooltips={tooltips.join("|")} />;
  },
  CircleMarker: ({ center }: any) => <div data-testid="marker" data-center={center.join(",")} />,
  useMapEvents: () => null,
  useMap: () => ({ flyTo: vi.fn(), getZoom: () => 6 }),
}));

vi.mock("./api", async (orig) => {
  const actual = await orig<typeof import("./api")>();
  const site = (code: string, sitetype: string) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]] },
    properties: { sitecode: code, sitetype, name_el: `Ελ-${code}`, name_en: `En-${code}`, area_km2: 1 },
  });
  return {
    ...actual,
    api: {
      sitesGeoJSON: vi.fn().mockResolvedValue({
        type: "FeatureCollection",
        features: [site("A", "SCI"), site("B", "SPA"), site("C", "SPA")],
      }),
      regions: vi.fn().mockResolvedValue({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: site("R", "SCI").geometry, properties: { name: "Kritis", name_el: "Κρήτη", name_en: "Crete", protected_pct: 20 } }],
      }),
      stats: vi.fn().mockResolvedValue({
        total_sites: 3,
        by_type: {
          SCI: { count: 1, area_km2: 1 },
          SPA: { count: 2, area_km2: 1 },
          SCISPA: { count: 0, area_km2: 0 },
        },
        coverage: { network_km2: 1234, network_land_pct: 12.5 },
        last_etl_run: null,
      }),
    },
  };
});

import App from "./App";

const siteLayer = () => {
  const layers = screen.getAllByTestId("geojson");
  return layers[layers.length - 1];
};

describe("App", () => {
  it("shows site data on initial render without any user interaction", async () => {
    render(<App />);
    await waitFor(() => expect(siteLayer()).toHaveAttribute("data-count", "3"));
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Χάρτης Natura Ελλάδα" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ΕΛ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/ΤΚΣ \(οικότοποι & είδη\)/)).toBeInTheDocument();
  });

  it("shows linked data sources and licenses in the page attribution", () => {
    render(<App />);
    const attribution = screen.getByText(/Πηγές δεδομένων:/).closest("footer");
    expect(attribution).toHaveTextContent("Υπουργείο Περιβάλλοντος & Ενέργειας (ΥΠΕΝ)");
    expect(attribution).toHaveTextContent("Wikidata");
    expect(attribution).toHaveTextContent("geoBoundaries");
    expect(attribution).toHaveTextContent("αναπροβολή, απλοποίηση και παράγωγα μεγέθη");
    expect(attribution?.querySelector('a[href="https://creativecommons.org/licenses/by-sa/4.0/"]')).toBeInTheDocument();
    expect(attribution?.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]')).toBeInTheDocument();
  });

  it("filters sites when a type checkbox is toggled", async () => {
    render(<App />);
    await waitFor(() => expect(siteLayer()).toHaveAttribute("data-count", "3"));
    fireEvent.click(screen.getByLabelText(/ΖΕΠ \(πτηνά\)/));
    await waitFor(() => expect(siteLayer()).toHaveAttribute("data-count", "1"));
  });

  it("shows the regions layer only when enabled", async () => {
    render(<App />);
    await waitFor(() => expect(siteLayer()).toHaveAttribute("data-count", "3"));
    expect(screen.getAllByTestId("geojson")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText(/Ποσοστό έκτασης Natura 2000 ανά περιφέρεια/));
    expect(screen.getAllByTestId("geojson")).toHaveLength(2);
  });

  it("shows unknown status before location is shared and reports inside/outside after", async () => {
    let success: PositionCallback = () => {};
    let failure: PositionErrorCallback = () => {};
    const watchPosition = vi.fn((s: PositionCallback, f: PositionErrorCallback) => {
      success = s;
      failure = f;
      return 1;
    });
    const clearWatch = vi.fn();
    Object.defineProperty(navigator, "geolocation", { value: { watchPosition, clearWatch }, configurable: true });
    const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude, accuracy: 5 } }) as GeolocationPosition;

    render(<App />);
    await waitFor(() => expect(siteLayer()).toHaveAttribute("data-count", "3"));
    expect(screen.getByRole("status")).toHaveTextContent("Δεν υπάρχουν δεδομένα τρέχουσας θέσης");
    expect(watchPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Πού βρίσκομαι;" }));
    expect(watchPosition).toHaveBeenCalledTimes(1);
    act(() => success(fix(0, 0)));
    expect(screen.getByRole("status")).toHaveTextContent("Βρίσκεστε σε περιοχή Natura 2000");
    expect(screen.getByTestId("marker")).toHaveAttribute("data-center", "0,0");
    act(() => success(fix(30, 30)));
    expect(screen.getByRole("status")).toHaveTextContent("Δεν βρίσκεστε σε περιοχή Natura 2000");

    act(() => failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError));
    expect(screen.getByRole("status")).toHaveTextContent("Δεν υπάρχουν δεδομένα τρέχουσας θέσης");
    expect(screen.getByText("Η πρόσβαση στην τοποθεσία απορρίφθηκε.")).toBeInTheDocument();
    expect(screen.queryByTestId("marker")).toBeNull();
  });

  it("switches the interface to English", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Τι σημαίνουν αυτοί οι όροι;" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Κατανόηση του χάρτη");
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(await screen.findByRole("heading", { name: "Natura Map Greece" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/SCI \(habitats & species\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Natura 2000 area by region/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("dialog")).toHaveTextContent("Understanding the map");
  });

  it("translates site and region tooltips when the language changes", async () => {
    render(<App />);
    await waitFor(() => expect(siteLayer()).toHaveAttribute("data-count", "3"));
    fireEvent.click(screen.getByLabelText(/Ποσοστό έκτασης Natura 2000 ανά περιφέρεια/));
    const tooltips = (i: number) => screen.getAllByTestId("geojson")[i].getAttribute("data-tooltips");
    expect(tooltips(0)).toContain("Κρήτη: 20% προστατευόμενη έκταση");
    expect(tooltips(1)).toContain("Ελ-A (A)");

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    await waitFor(() => expect(tooltips(1)).toContain("En-A (A)"));
    expect(tooltips(0)).toContain("Crete: 20% protected");
    expect(tooltips(1)).toContain("SCI (habitats & species)");
    expect(tooltips(1)).not.toContain("Ελ-");
  });
});
