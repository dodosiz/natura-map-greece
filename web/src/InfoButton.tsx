import { useState } from "react";
import { createPortal } from "react-dom";
import type { SiteType } from "./api";

interface Term {
  type: SiteType | "N2K";
  title: string;
  color?: string;
  paragraphs: string[];
}

const TERMS: Term[] = [
  {
    type: "N2K",
    title: "Natura 2000",
    paragraphs: [
      "The EU-wide network of protected nature sites, set up under two laws: the Birds Directive (2009/147/EC) and the Habitats Directive (92/43/EEC). Together they protect around 1,200 rare and threatened species and 230 habitat types across more than 27,000 sites.",
      "Natura 2000 is not a “no-go” zone. Many sites are farmed, grazed, fished or visited, and those activities can continue as long as they do not harm what the site was designated to protect.",
    ],
  },
  {
    type: "SCI",
    title: "SCI – Site of Community Importance",
    color: "#2b8cbe",
    paragraphs: [
      "Designated under the Habitats Directive to protect rare or threatened natural habitats (forests, wetlands, grasslands, coastal and marine areas) and species other than birds, such as bats, otters, turtles or plants. Once a country has put the necessary management in place, an SCI is formally designated as a Special Area of Conservation (SAC).",
    ],
  },
  {
    type: "SPA",
    title: "SPA – Special Protection Area",
    color: "#e6550d",
    paragraphs: [
      "Designated under the Birds Directive to protect wild bird species that are rare, threatened or migratory, and the places they need to breed, feed, rest or overwinter (wetlands, cliffs, forests, marine areas).",
    ],
  },
  {
    type: "SCISPA",
    title: "SCI + SPA",
    color: "#31a354",
    paragraphs: ["Areas that are protected under both directives, for habitats/species and for birds."],
  },
];

const IMPACT = [
  "Plans or projects likely to have a significant effect on a site (for example roads, quarries, wind or solar parks, tourism developments, marinas, intensive aquaculture) must undergo an “appropriate assessment” of their impact on the site’s protected habitats and species before they can be approved (Article 6(3) of the Habitats Directive).",
  "Approval is only possible if the assessment shows that the site will not be adversely affected. If it will, the project can proceed only if there is no alternative, there are imperative reasons of overriding public interest, and compensation measures are taken. Special extra conditions apply when priority habitats or species are involved, and the European Commission must be informed (Article 6(4)).",
  "Construction is therefore not automatically banned, but it is strictly regulated: each case is assessed individually and the rules of the national environmental licensing procedure apply on top. Existing uses such as farming and fishing are also expected to be compatible with the site’s conservation objectives.",
  "This map is for orientation only, not legal advice. Before planning any activity, check the exact boundaries and the applicable rules with the competent Greek authorities (Ministry of Environment and Energy and the regional Natura 2000 management bodies).",
];

export default function InfoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="info-btn" onClick={() => setOpen(true)} aria-label="What do these terms mean?" title="What do these terms mean?">
        i
      </button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <h2>Understanding the map</h2>
            {TERMS.map((t) => (
              <section key={t.type}>
                <h3>
                  {t.color && <span className="swatch" style={{ background: t.color }} />}
                  {t.title}
                </h3>
                {t.paragraphs.map((p) => <p key={p}>{p}</p>)}
              </section>
            ))}
            <section>
              <h3>What does it mean for construction and other activities?</h3>
              {IMPACT.map((p) => <p key={p}>{p}</p>)}
            </section>
            <section>
              <h3>Region coverage</h3>
              <p>Colours the Greek regions by the share of their land area that lies inside the Natura 2000 network (overlapping SCI and SPA areas are counted once).</p>
            </section>
            <p className="sources">
              Sources:{" "}
              <a href="https://environment.ec.europa.eu/topics/nature-and-biodiversity/natura-2000_en" target="_blank" rel="noreferrer">European Commission – Natura 2000</a>,{" "}
              <a href="https://environment.ec.europa.eu/topics/nature-and-biodiversity/habitats-directive_en" target="_blank" rel="noreferrer">Habitats Directive</a>,{" "}
              <a href="https://environment.ec.europa.eu/topics/nature-and-biodiversity/birds-directive_en" target="_blank" rel="noreferrer">Birds Directive</a>.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
