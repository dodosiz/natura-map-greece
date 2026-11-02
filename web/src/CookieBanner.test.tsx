import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import CookieBanner from "./CookieBanner";
import { getConsent, openCookieSettings } from "./consent";

const GA_SELECTOR = 'script[src*="googletagmanager.com"]';

describe("CookieBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.querySelectorAll(GA_SELECTOR).forEach((s) => s.remove());
  });

  it("asks for consent and loads no analytics before a choice", () => {
    render(<CookieBanner />);
    expect(screen.getByRole("button", { name: "Αποδοχή" })).toBeInTheDocument();
    expect(document.querySelector(GA_SELECTOR)).toBeNull();
  });

  it("rejecting stores the choice and loads nothing", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Απόρριψη" }));
    expect(getConsent()).toBe("denied");
    expect(document.querySelector(GA_SELECTOR)).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("accepting loads analytics, and settings can reopen the banner", () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Αποδοχή" }));
    expect(getConsent()).toBe("granted");
    expect(document.querySelector(GA_SELECTOR)).not.toBeNull();
    act(() => openCookieSettings());
    expect(screen.getByRole("button", { name: "Απόρριψη" })).toBeInTheDocument();
  });
});
