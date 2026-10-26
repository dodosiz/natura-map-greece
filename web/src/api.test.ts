import { afterEach, describe, expect, it, vi } from "vitest";
import { api, siteName } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("siteName", () => {
  it("prefers English, then Greek, then code", () => {
    expect(siteName({ name_en: "En", name_el: "El", sitecode: "X" })).toBe("En");
    expect(siteName({ name_en: null, name_el: "El", sitecode: "X" })).toBe("El");
    expect(siteName({ name_en: null, name_el: null, sitecode: "X" })).toBe("X");
  });
});

describe("api", () => {
  it("fetches and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total_sites: 3 }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.stats()).resolves.toEqual({ total_sites: 3 });
    expect(fetchMock).toHaveBeenCalledWith("/api/stats");
  });

  it("throws on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Boom" }));
    await expect(api.regions()).rejects.toThrow("500 Boom: /regions");
  });
});
