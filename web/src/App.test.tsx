import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useState } from "react";

const mapMock = vi.hoisted(() => {
  const container = document.createElement("div");
  container.innerHTML = '<div class="leaflet-top leaflet-left"></div>';
  document.body.appendChild(container);
  return { flyTo: vi.fn(), setView: vi.fn(), getZoom: () => 6, fitBounds: vi.fn(), getContainer: () => container };
});

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div>{children}</div>,
  TileLayer: () => null,
  // Like the real component, only the data and callbacks given at mount time are used; later prop changes are ignored.
  GeoJSON: ({ data, onEachFeature }: any) => {
    const [mounted] = useState(data);
    const [{ tooltips, clicks }] = useState(() => {
      const tooltips: string[] = [];
      const clicks: [string, () => void][] = [];
      for (const f of mounted.features) {
        const layer = { bindTooltip: (t: string) => tooltips.push(t), on: (_: string, fn: any) => clicks.push([f.properties.sitecode ?? "region", () => fn({})]), options: {}, setStyle: () => {}, bringToFront: () => {} };
        onEachFeature?.(f, layer);
      }
      return { tooltips, clicks };
    });
    return (
      <div data-testid="geojson" data-kind={mounted.features[0]?.properties.sitecode ? "site" : "region"} data-count={mounted.features.length} data-tooltips={tooltips.join("|")}>
        {clicks.map(([code, click]) => <button key={code} data-testid={`pick-${code}`} onClick={click} />)}
      </div>
    );
  },
  CircleMarker: ({ center }: any) => <div data-testid="marker" data-center={center.join(",")} />,
  Circle: ({ radius }: any) => <div data-testid="accuracy" data-radius={radius} />,
  Pane: ({ children }: any) => <div>{children}</div>,
  useMapEvents: () => null,
  useMap: () => mapMock,
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

import App, { choropleth, FeatureCard, REGION_BINS } from "./App";
import { api } from "./api";

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe("loading, error and empty states", () => {
  it("shows a loading chip and stats skeleton that disappear once data arrives", async () => {
    const sites = deferred<any>();
    const stats = deferred<any>();
    const realSites = await api.sitesGeoJSON();
    const realStats = await api.stats();
    vi.mocked(api.sitesGeoJSON).mockReturnValueOnce(sites.promise);
    vi.mocked(api.stats).mockReturnValueOnce(stats.promise);
    const { container } = render(<App />);
    expect(screen.getByText("Φόρτωση περιοχών…")).toHaveAttribute("role", "status");
    expect(container.querySelector(".stats.skeleton")).toBeInTheDocument();
    await act(async () => stats.resolve(realStats));
    expect(container.querySelector(".stats.skeleton")).toBeNull();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("Φόρτωση περιοχών…")).toBeInTheDocument();
    await act(async () => sites.resolve(realSites));
    expect(screen.queryByText("Φόρτωση περιοχών…")).toBeNull();
  });

  it("shows a friendly error for a partial failure and retries only the failed resource", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(api.stats).mockRejectedValueOnce(new Error("boom 500"));
    vi.mocked(api.sitesGeoJSON).mockClear();
    vi.mocked(api.regions).mockClear();
    vi.mocked(api.stats).mockClear();
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Δεν ήταν δυνατή η φόρτωση");
    expect(alert).not.toHaveTextContent("boom");
    expect(spy).toHaveBeenCalled();
    await waitFor(() => expect(siteCount()).toBe(3));
    fireEvent.click(screen.getByRole("button", { name: "Επανάληψη" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(await screen.findByText("1.234")).toBeInTheDocument();
    expect(api.stats).toHaveBeenCalledTimes(2);
    expect(api.sitesGeoJSON).toHaveBeenCalledTimes(1);
    expect(api.regions).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("shows a hint when no layers are selected", async () => {
    render(<App />);
    const hint = "Δεν έχει επιλεγεί κανένα επίπεδο. Ενεργοποιήστε ένα επίπεδο για να το δείτε στον χάρτη.";
    expect(screen.queryByText(hint)).toBeNull();
    for (const name of [/ΤΚΣ \(οικότοποι/, /ΖΕΠ \(πτηνά\)/, /^ΤΚΣ \+ ΖΕΠ/]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(screen.getByText(hint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ποσοστό έκτασης Natura 2000 ανά περιφέρεια/ }));
    expect(screen.queryByText(hint)).toBeNull();
  });
});

// Site layers are one GeoJSON per visible type; the regions layer (when on) renders first.
const siteCount = () =>
  screen
    .queryAllByTestId("geojson")
    .filter((l) => l.getAttribute("data-kind") === "site")
    .reduce((n, l) => n + Number(l.getAttribute("data-count")), 0);

describe("App", () => {
  it("shows site data on initial render without any user interaction", async () => {
    render(<App />);
    await waitFor(() => expect(siteCount()).toBe(3));
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Χάρτης Natura Ελλάδα" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ΕΛ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /ΤΚΣ \(οικότοποι & είδη\)/ })).toBeInTheDocument();
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

  it("structures the sidebar: layers group, collapsed about/privacy disclosures, sync in footer", async () => {
    vi.mocked(api.stats).mockResolvedValueOnce({
      ...(await api.stats()),
      last_etl_run: { finished_at: "2026-01-15T10:00:00Z" },
    } as never);
    const { container } = render(<App />);
    await waitFor(() => expect(siteCount()).toBe(3));
    const heading = screen.getByRole("heading", { name: "Επίπεδα" });
    const group = screen.getByRole("group", { name: "Επίπεδα" });
    expect(group).toHaveAttribute("aria-labelledby", heading.id);
    expect(group).toContainElement(screen.getByRole("button", { name: /ΖΕΠ \(πτηνά\)/ }));
    const about = screen.getByText("Σχετικά με τον χάρτη").closest("details")!;
    expect(about).not.toHaveAttribute("open");
    expect(about).toContainElement(screen.getByRole("heading", { name: "Το δίκτυο Natura 2000 στην Ελλάδα", hidden: true }));
    expect(screen.getByText("Η θέση σας δεν φεύγει από το πρόγραμμα περιήγησής σας.")).toBeInTheDocument();
    const more = screen.getByText("Μάθετε περισσότερα").closest("details")!;
    expect(more).not.toHaveAttribute("open");
    expect(more).toHaveTextContent("δεν έχει νομική ισχύ");
    expect(container.querySelector("footer .last-sync")).toBeInTheDocument();
  });

  it("filters sites when a type checkbox is toggled", async () => {
    render(<App />);
    await waitFor(() => expect(siteCount()).toBe(3));
    fireEvent.click(screen.getByRole("button", { name: /ΖΕΠ \(πτηνά\)/ }));
    await waitFor(() => expect(siteCount()).toBe(1));
  });

  it("keeps the selection and other layers mounted when another layer is toggled", async () => {
    render(<App />);
    await waitFor(() => expect(siteCount()).toBe(3));
    fireEvent.click(screen.getByTestId("pick-A"));
    expect(screen.getByRole("heading", { name: /Ελ-A/ })).toBeInTheDocument();
    const mountedA = screen.getByTestId("pick-A");
    fireEvent.click(screen.getByRole("button", { name: /ΖΕΠ \(πτηνά\)/ }));
    await waitFor(() => expect(siteCount()).toBe(1));
    expect(screen.getByTestId("pick-A")).toBe(mountedA);
    expect(screen.getByRole("heading", { name: /Ελ-A/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ΖΕΠ \(πτηνά\)/ }));
    await waitFor(() => expect(siteCount()).toBe(3));
    expect(screen.getByTestId("pick-A")).toBe(mountedA);
    expect(screen.getByRole("heading", { name: /Ελ-A/ })).toBeInTheDocument();
  });

  it("shows the regions layer only when enabled", async () => {
    render(<App />);
    await waitFor(() => expect(siteCount()).toBe(3));
    expect(screen.getAllByTestId("geojson")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Ποσοστό έκτασης Natura 2000 ανά περιφέρεια/ }));
    expect(screen.getAllByTestId("geojson")).toHaveLength(3);
  });

  it("shows the legend only while regions are on, with text labels matching the bins", async () => {
    render(<App />);
    await waitFor(() => expect(siteCount()).toBe(3));
    expect(screen.queryByText("Ποσοστό προστατευόμενης έκτασης")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Ποσοστό έκτασης Natura 2000 ανά περιφέρεια/ });
    fireEvent.click(toggle);
    const legend = screen.getByRole("group", { name: "Ποσοστό προστατευόμενης έκτασης" });
    const items = within(legend).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["< 12%", "12–20%", "20–30%", "30–40%", "> 40%"]);
    fireEvent.click(toggle);
    expect(screen.queryByRole("group", { name: "Ποσοστό προστατευόμενης έκτασης" })).not.toBeInTheDocument();
  });

  it("choropleth colours agree with the shared legend bins", () => {
    const samples = [0, 12, 12.1, 20, 20.1, 30, 30.1, 40, 40.1, 100];
    const expected = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
    samples.forEach((pct, i) => expect(choropleth(pct)).toBe(REGION_BINS[expected[i]].color));
    expect(new Set(REGION_BINS.map((b) => b.color)).size).toBe(5);
  });

  it("resets the map view to the initial centre and zoom", () => {
    mapMock.setView.mockClear();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Επαναφορά προβολής" }));
    expect(mapMock.setView).toHaveBeenCalledWith([39, 23.5], 6, expect.objectContaining({ animate: expect.any(Boolean) }));
    expect(screen.queryByRole("button", { name: "Κέντρο στη θέση μου" })).not.toBeInTheDocument();
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
    await waitFor(() => expect(siteCount()).toBe(3));
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
    expect(screen.getByRole("button", { name: /SCI \(habitats & species\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Natura 2000 area by region/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("dialog")).toHaveTextContent("Understanding the map");
  });

  it("translates the panel toggle label", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Ανάπτυξη πίνακα" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide panel" }));
    expect(screen.getByRole("button", { name: "Show panel" })).toHaveAttribute("aria-expanded", "false");
  });

  it("cycles the bottom sheet default -> expanded -> collapsed -> default", () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector(".sidebar")!;
    const state = () => sidebar.getAttribute("data-sheet");
    const handle = () => container.querySelector(".panel-toggle") as HTMLElement;
    expect(state()).toBe("default");
    fireEvent.click(handle());
    expect(state()).toBe("expanded");
    expect(sidebar).toHaveClass("sheet-expanded");
    fireEvent.click(handle());
    expect(state()).toBe("collapsed");
    expect(sidebar).toHaveClass("collapsed");
    fireEvent.click(handle());
    expect(state()).toBe("default");
  });

  it("restores a collapsed sheet to default when the search input is focused", () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector(".sidebar")!;
    fireEvent.click(container.querySelector(".panel-toggle")!);
    fireEvent.click(container.querySelector(".panel-toggle")!);
    expect(sidebar).toHaveAttribute("data-sheet", "collapsed");
    fireEvent.focus(container.querySelector(".site-search input")!);
    expect(sidebar).toHaveAttribute("data-sheet", "default");
  });

  it("labels the info dialog, closes on Escape and returns focus to the trigger", () => {
    render(<App />);
    const trigger = screen.getByRole("button", { name: "Τι σημαίνουν αυτοί οι όροι;" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Κατανόηση του χάρτη" });
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(document.body.style.overflow).toBe("hidden");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps keyboard focus inside the info dialog", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Τι σημαίνουν αυτοί οι όροι;" }));
    const dialog = screen.getByRole("dialog");
    const links = dialog.querySelectorAll("a[href]");
    (links[links.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Κλείσιμο" })).toHaveFocus();
  });

  it("renders a site detail card and closes it", () => {
    const onClose = vi.fn();
    render(
      <FeatureCard
        selection={{ kind: "site", props: { sitecode: "GR1", sitetype: "SPA", name_en: "Lake", name_el: null, area_km2: 12.34 } as any }}
        language="en"
        onClose={onClose}
      />,
    );
    const card = screen.getByRole("region", { name: "Lake" });
    expect(card).toHaveTextContent("GR1");
    expect(card).toHaveTextContent("12.3 km²");
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders a region detail card", () => {
    render(
      <FeatureCard
        selection={{ kind: "region", props: { name: "Kritis", name_el: "Κρήτη", name_en: "Crete", protected_pct: 20, protected_km2: 1500, n_sites: 7 } }}
        language="el"
        onClose={() => {}}
      />,
    );
    const card = screen.getByRole("region", { name: "Κρήτη" });
    expect(card).toHaveTextContent("20%");
    expect(card).toHaveTextContent("1.500 km²");
  });

  it("translates site and region tooltips when the language changes", async () => {
    render(<App />);
    await waitFor(() => expect(siteCount()).toBe(3));
    fireEvent.click(screen.getByRole("button", { name: /Ποσοστό έκτασης Natura 2000 ανά περιφέρεια/ }));
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

describe("site search", () => {
  it("finds a site, re-enables its hidden layer, fits the map and shows the card", async () => {
    render(<App />);
    const input = screen.getByRole("combobox", { name: "Αναζήτηση περιοχών με όνομα ή κωδικό" });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /ΖΕΠ \(πτηνά\)/ }));
    expect(screen.getByRole("button", { name: /ΖΕΠ \(πτηνά\)/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.change(input, { target: { value: "ελ-b" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: /ΖΕΠ \(πτηνά\)/ })).toHaveAttribute("aria-pressed", "true");
    expect(mapMock.fitBounds).toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Ελ-B" })).toBeInTheDocument();
  });

  it("shows a no-results row after two characters", async () => {
    render(<App />);
    const input = screen.getByRole("combobox");
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "z" } });
    expect(screen.queryByText("Δεν βρέθηκαν αποτελέσματα")).toBeNull();
    fireEvent.change(input, { target: { value: "zz" } });
    expect(screen.getByText("Δεν βρέθηκαν αποτελέσματα")).toBeInTheDocument();
  });
});