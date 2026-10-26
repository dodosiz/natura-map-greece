import { useState } from "react";
import { createPortal } from "react-dom";
import type { Language, SiteType } from "./api";

interface Term {
  type: SiteType | "N2K";
  title: string;
  color?: string;
  paragraphs: string[];
}

const CONTENT: Record<Language, {
  terms: Term[];
  impactTitle: string;
  impact: string[];
  regionTitle: string;
  regionDescription: string;
  sources: string;
  sourceNames: [string, string, string];
  infoLabel: string;
  closeLabel: string;
  dialogTitle: string;
}> = {
  en: {
    terms: [
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
    ],
    impactTitle: "What does it mean for construction and other activities?",
    impact: [
      "Plans or projects likely to have a significant effect on a site (for example roads, quarries, wind or solar parks, tourism developments, marinas, intensive aquaculture) must undergo an “appropriate assessment” of their impact on the site’s protected habitats and species before they can be approved (Article 6(3) of the Habitats Directive).",
      "Approval is only possible if the assessment shows that the site will not be adversely affected. If it will, the project can proceed only if there is no alternative, there are imperative reasons of overriding public interest, and compensation measures are taken. Special extra conditions apply when priority habitats or species are involved, and the European Commission must be informed (Article 6(4)).",
      "Construction is therefore not automatically banned, but it is strictly regulated: each case is assessed individually and the rules of the national environmental licensing procedure apply on top. Existing uses such as farming and fishing are also expected to be compatible with the site’s conservation objectives.",
      "This map is for orientation only, not legal advice. Before planning any activity, check the exact boundaries and the applicable rules with the competent Greek authorities (Ministry of Environment and Energy and the regional Natura 2000 management bodies).",
    ],
    regionTitle: "Region coverage",
    regionDescription: "Colours the Greek regions by the share of their land area that lies inside the Natura 2000 network (overlapping SCI and SPA areas are counted once).",
    sources: "Sources:",
    sourceNames: ["European Commission – Natura 2000", "Habitats Directive", "Birds Directive"],
    infoLabel: "What do these terms mean?",
    closeLabel: "Close",
    dialogTitle: "Understanding the map",
  },
  el: {
    terms: [
      {
        type: "N2K",
        title: "Natura 2000",
        paragraphs: [
          "Το ευρωπαϊκό δίκτυο προστατευόμενων φυσικών περιοχών, που θεσπίστηκε βάσει δύο νομοθετημάτων: της Οδηγίας για τα Πτηνά (2009/147/ΕΚ) και της Οδηγίας για τους Οικοτόπους (92/43/ΕΟΚ). Μαζί προστατεύουν περίπου 1.200 σπάνια και απειλούμενα είδη και 230 τύπους οικοτόπων σε περισσότερες από 27.000 περιοχές.",
          "Το Natura 2000 δεν είναι ζώνη όπου απαγορεύονται όλες οι δραστηριότητες. Σε πολλές περιοχές συνεχίζονται η γεωργία, η βόσκηση, η αλιεία και οι επισκέψεις, εφόσον δεν βλάπτουν όσα έχουν χαρακτηριστεί για προστασία.",
        ],
      },
      {
        type: "SCI",
        title: "ΤΚΣ – Τόπος Κοινοτικής Σημασίας",
        color: "#2b8cbe",
        paragraphs: [
          "Χαρακτηρίζεται βάσει της Οδηγίας για τους Οικοτόπους για την προστασία σπάνιων ή απειλούμενων φυσικών οικοτόπων (δάση, υγρότοποι, λιβάδια, παράκτιες και θαλάσσιες περιοχές) και ειδών εκτός των πτηνών, όπως νυχτερίδες, ενυδρίδες, χελώνες ή φυτά. Όταν ληφθούν τα απαραίτητα μέτρα διαχείρισης, ο ΤΚΣ χαρακτηρίζεται επίσημα ως Ειδική Ζώνη Διατήρησης (ΕΖΔ).",
        ],
      },
      {
        type: "SPA",
        title: "ΖΕΠ – Ζώνη Ειδικής Προστασίας",
        color: "#e6550d",
        paragraphs: [
          "Χαρακτηρίζεται βάσει της Οδηγίας για τα Πτηνά για την προστασία σπάνιων, απειλούμενων ή μεταναστευτικών άγριων πτηνών και των περιοχών που χρειάζονται για αναπαραγωγή, τροφοληψία, ανάπαυση ή διαχείμαση (υγρότοποι, απόκρημνες ακτές, δάση και θαλάσσιες περιοχές).",
        ],
      },
      {
        type: "SCISPA",
        title: "ΤΚΣ + ΖΕΠ",
        color: "#31a354",
        paragraphs: ["Περιοχές που προστατεύονται βάσει και των δύο οδηγιών, για οικοτόπους και είδη καθώς και για πτηνά."],
      },
    ],
    impactTitle: "Τι σημαίνει αυτό για την κατασκευή και άλλες δραστηριότητες;",
    impact: [
      "Σχέδια ή έργα που ενδέχεται να επηρεάσουν σημαντικά μια περιοχή (για παράδειγμα δρόμοι, λατομεία, αιολικά ή φωτοβολταϊκά πάρκα, τουριστικές εγκαταστάσεις, μαρίνες και εντατική υδατοκαλλιέργεια) πρέπει, πριν εγκριθούν, να υποβληθούν σε «δέουσα εκτίμηση» των επιπτώσεών τους στους προστατευόμενους οικοτόπους και τα είδη της περιοχής (άρθρο 6 παράγραφος 3 της Οδηγίας για τους Οικοτόπους).",
      "Έγκριση είναι δυνατή μόνο αν η εκτίμηση δείξει ότι δεν θα υπάρξουν αρνητικές επιπτώσεις στην περιοχή. Αν υπάρξουν, το έργο μπορεί να προχωρήσει μόνο εφόσον δεν υπάρχει εναλλακτική λύση, συντρέχουν επιτακτικοί λόγοι υπέρτερου δημοσίου συμφέροντος και ληφθούν αντισταθμιστικά μέτρα. Ισχύουν πρόσθετες προϋποθέσεις για οικότοπους ή είδη προτεραιότητας και πρέπει να ενημερωθεί η Ευρωπαϊκή Επιτροπή (άρθρο 6 παράγραφος 4).",
      "Επομένως, οι κατασκευές δεν απαγορεύονται αυτομάτως, αλλά υπόκεινται σε αυστηρή ρύθμιση: κάθε περίπτωση αξιολογείται χωριστά και εφαρμόζονται επιπλέον οι κανόνες της εθνικής διαδικασίας περιβαλλοντικής αδειοδότησης. Οι υφιστάμενες χρήσεις, όπως η γεωργία και η αλιεία, πρέπει επίσης να είναι συμβατές με τους στόχους διατήρησης της περιοχής.",
      "Ο χάρτης είναι μόνο ενδεικτικός και δεν αποτελεί νομική συμβουλή. Πριν σχεδιάσετε οποιαδήποτε δραστηριότητα, ελέγξτε τα ακριβή όρια και τους ισχύοντες κανόνες με τις αρμόδιες ελληνικές αρχές (Υπουργείο Περιβάλλοντος και Ενέργειας και περιφερειακούς φορείς διαχείρισης Natura 2000).",
    ],
    regionTitle: "Κάλυψη περιφερειών",
    regionDescription: "Οι περιφέρειες χρωματίζονται ανάλογα με το ποσοστό της χερσαίας έκτασής τους που βρίσκεται εντός του δικτύου Natura 2000 (οι επικαλυπτόμενες περιοχές ΤΚΣ και ΖΕΠ υπολογίζονται μία φορά).",
    sources: "Πηγές:",
    sourceNames: ["Ευρωπαϊκή Επιτροπή – Natura 2000", "Οδηγία για τους Οικοτόπους", "Οδηγία για τα Πτηνά"],
    infoLabel: "Τι σημαίνουν αυτοί οι όροι;",
    closeLabel: "Κλείσιμο",
    dialogTitle: "Κατανόηση του χάρτη",
  },
};

export default function InfoButton({ language }: { language: Language }) {
  const [open, setOpen] = useState(false);
  const content = CONTENT[language];
  return (
    <>
      <button className="info-btn" onClick={() => setOpen(true)} aria-label={content.infoLabel} title={content.infoLabel}>
        i
      </button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setOpen(false)} aria-label={content.closeLabel}>×</button>
            <h2>{content.dialogTitle}</h2>
            {content.terms.map((t) => (
              <section key={t.type}>
                <h3>
                  {t.color && <span className="swatch" style={{ background: t.color }} />}
                  {t.title}
                </h3>
                {t.paragraphs.map((p) => <p key={p}>{p}</p>)}
              </section>
            ))}
            <section>
              <h3>{content.impactTitle}</h3>
              {content.impact.map((p) => <p key={p}>{p}</p>)}
            </section>
            <section>
              <h3>{content.regionTitle}</h3>
              <p>{content.regionDescription}</p>
            </section>
            <p className="sources">
              {content.sources}{" "}
              <a href="https://environment.ec.europa.eu/topics/nature-and-biodiversity/natura-2000_en" target="_blank" rel="noreferrer">{content.sourceNames[0]}</a>,{" "}
              <a href="https://environment.ec.europa.eu/topics/nature-and-biodiversity/habitats-directive_en" target="_blank" rel="noreferrer">{content.sourceNames[1]}</a>,{" "}
              <a href="https://environment.ec.europa.eu/topics/nature-and-biodiversity/birds-directive_en" target="_blank" rel="noreferrer">{content.sourceNames[2]}</a>.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
