import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useState } from "react";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div>{children}</div>,
  TileLayer: () => null,
  // Like the real component, only the data given at mount time is used; later prop changes are ignored.
  GeoJSON: ({ data }: any) => {
    const [mounted] = useState(data);
    return <div data-testid="geojson" data-count={mounted.features.length} />;
  },
}));

vi.mock("./api", async (orig) => {
  const actual = await orig<typeof import("./api")>();
  const site = (code: string, sitetype: string) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: { sitecode: code, sitetype },
  });
  return {
    ...actual,
    api: {
      sitesGeoJSON: vi.fn().mockResolvedValue({
        type: "FeatureCollection",
        features: [site("A", "SCI"), site("B", "SPA"), site("C", "SPA")],
      }),
      regions: vi.fn().mockResolvedValue({ type: "FeatureCollection", features: [] }),
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
    expect(screen.getByRole("heading", { name: "Natura 2000 – Ελλάδα" })).toBeInTheDocument();
    expect(screen.getByLabelText("Γλώσσα")).toHaveValue("el");
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
    fireEvent.click(screen.getByLabelText(/Κάλυψη περιφερειών/));
    expect(screen.getAllByTestId("geojson")).toHaveLength(2);
  });

  it("switches the interface to English", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Τι σημαίνουν αυτοί οι όροι;" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Κατανόηση του χάρτη");
    fireEvent.change(screen.getByLabelText("Γλώσσα"), { target: { value: "en" } });
    expect(await screen.findByRole("heading", { name: "Natura 2000 – Greece" })).toBeInTheDocument();
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByLabelText(/Region coverage/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("dialog")).toHaveTextContent("Understanding the map");
  });
});
