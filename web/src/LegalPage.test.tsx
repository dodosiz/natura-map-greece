import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LegalPage from "./LegalPage";

describe("LegalPage", () => {
  it("shows the privacy notice in Greek and English", () => {
    render(<LegalPage page="privacy" />);

    expect(screen.getByRole("heading", { name: "Πολιτική απορρήτου" })).toBeInTheDocument();
    expect(screen.getByText(/europe-west3, Φρανκφούρτη/)).toBeInTheDocument();
    expect(screen.getByText(/δεν αποστέλλονται στον διακομιστή του ιστότοπου/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByRole("heading", { name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getAllByText(/Google Cloud Logging/).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps the selected language when navigating", () => {
    window.history.pushState({}, "", "/privacy?lang=en");
    render(<LegalPage page="privacy" />);
    expect(screen.getByRole("heading", { name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Imprint" })).toHaveAttribute("href", "/imprint?lang=en");
    expect(screen.getByRole("link", { name: "Back to map" })).toHaveAttribute("href", "/?lang=en");
    window.history.pushState({}, "", "/");
  });

  it("shows the supplied operator details and links to the privacy policy", () => {
    const { container } = render(<LegalPage page="imprint" />);

    expect(screen.getByRole("heading", { name: "Στοιχεία εκδότη" })).toBeInTheDocument();
    expect(container.querySelector("address")).toHaveTextContent("Pratinou 12");
    expect(container.querySelector("address")).toHaveTextContent("11634 Αθήνα, Ελλάδα");
    expect(screen.getByText("ΑΦΜ / αριθμός ΦΠΑ: EL143106080")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Πολιτική απορρήτου" })).toHaveAttribute("href", "/privacy");
  });
});
