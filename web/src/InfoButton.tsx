import { useEffect, useRef, useState } from "react";
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
          "Natura 2000 is the EU-wide ecological network of protected areas, established under the Birds Directive (2009/147/EC) and the Habitats Directive (92/43/EEC). Together, these directives protect around 1,200 rare and threatened species and 230 habitat types across more than 27,000 sites.",
          "Natura 2000 does not mean that all activities are prohibited. Farming, grazing, fishing and recreation can continue in many sites when they are compatible with that site's conservation objectives.",
        ],
      },
      {
        type: "SCI",
        title: "SCI – Site of Community Importance",
        color: "#2563eb",
        paragraphs: [
          "Identified under the Habitats Directive to protect natural habitat types of European importance (such as forests, wetlands, grasslands, and coastal and marine habitats) and species of European importance other than birds (such as bats, otters, turtles and plants). After the European Commission adopts a site as an SCI, the Member State must designate it as a Special Area of Conservation (SAC) within six years and establish the necessary conservation measures.",
        ],
      },
      {
        type: "SPA",
        title: "SPA – Special Protection Area",
        color: "#d97706",
        paragraphs: [
          "Designated under the Birds Directive for wild bird species listed in its Annex I and regularly occurring migratory species, and for the habitats they need to breed, feed, rest and overwinter (such as wetlands, cliffs, forests and marine areas).",
        ],
      },
      {
        type: "SCISPA",
        title: "SCI + SPA",
        color: "#059669",
        paragraphs: ["Areas designated under both directives: as an SCI for habitats and other species, and as an SPA for birds."],
      },
    ],
    impactTitle: "What does it mean for projects and other activities?",
    impact: [
      "Plans or projects likely to have a significant effect on a Natura 2000 site, either alone or in combination with other plans or projects (for example, roads, quarries, wind or solar parks, tourism developments, marinas and intensive aquaculture), must undergo an “appropriate assessment” of their implications for the site in view of its conservation objectives, before they are approved (Article 6(3) of the Habitats Directive).",
      "Approval is possible only if it is established that the plan or project will not adversely affect the site's integrity. By way of exception, it may proceed if there are no alternatives and imperative reasons of overriding public interest, provided that all necessary compensatory measures are taken to safeguard the overall coherence of the Natura 2000 network. Additional conditions apply when priority habitats or species are affected (Article 6(4)).",
      "Projects and other activities are not automatically prohibited: each case is assessed individually, and the national environmental permitting rules also apply. Existing activities such as farming and fishing can continue when they are compatible with the site's conservation objectives.",
      "This map is for orientation only and does not constitute legal advice. Before planning an activity, check the exact boundaries and applicable rules with the competent Greek authorities, including the Ministry of Environment and Energy and the Natura 2000 management bodies.",
    ],
    regionTitle: "Natura 2000 by region",
    regionDescription: "The colour scale shows the share of each Greek region's land area within the Natura 2000 network. Overlapping SCI and SPA areas are counted once.",
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
          "Το Natura 2000 είναι το ευρωπαϊκό οικολογικό δίκτυο προστατευόμενων περιοχών, που θεσπίστηκε βάσει της Οδηγίας για τα Πτηνά (2009/147/ΕΚ) και της Οδηγίας για τους Οικοτόπους (92/43/ΕΟΚ). Οι δύο οδηγίες προστατεύουν περίπου 1.200 σπάνια και απειλούμενα είδη και 230 τύπους οικοτόπων σε περισσότερες από 27.000 περιοχές.",
          "Το Natura 2000 δεν συνεπάγεται καθολική απαγόρευση δραστηριοτήτων. Σε πολλές περιοχές μπορούν να συνεχίζονται η γεωργία, η βόσκηση, η αλιεία και η αναψυχή, εφόσον είναι συμβατές με τους στόχους διατήρησης της συγκεκριμένης περιοχής.",
        ],
      },
      {
        type: "SCI",
        title: "ΤΚΣ – Τόπος Κοινοτικής Σημασίας",
        color: "#2563eb",
        paragraphs: [
          "Οι ΤΚΣ προσδιορίζονται βάσει της Οδηγίας για τους Οικοτόπους για την προστασία φυσικών τύπων οικοτόπων κοινοτικής σημασίας (όπως δάση, υγρότοποι, λιβάδια και παράκτιοι και θαλάσσιοι οικότοποι) και ειδών κοινοτικής σημασίας, πλην των πτηνών (όπως νυχτερίδες, ενυδρίδες, χελώνες και φυτά). Μετά την έγκριση ενός τόπου ως ΤΚΣ από την Ευρωπαϊκή Επιτροπή, το κράτος μέλος οφείλει, μέσα σε έξι χρόνια, να τον χαρακτηρίσει ως Ειδική Ζώνη Διατήρησης (ΕΖΔ) και να θεσπίσει τα αναγκαία μέτρα διατήρησης.",
        ],
      },
      {
        type: "SPA",
        title: "ΖΕΠ – Ζώνη Ειδικής Προστασίας",
        color: "#d97706",
        paragraphs: [
          "Οι ΖΕΠ ορίζονται βάσει της Οδηγίας για τα Πτηνά για είδη άγριων πτηνών που περιλαμβάνονται στο Παράρτημα I της, καθώς και για τακτικά μεταναστευτικά είδη και τους οικοτόπους τους. Οι περιοχές αυτές καλύπτουν ανάγκες όπως η αναπαραγωγή, η αναζήτηση τροφής, η ανάπαυση και η διαχείμαση (π.χ. υγρότοποι, απόκρημνες ακτές, δάση και θαλάσσιες περιοχές).",
        ],
      },
      {
        type: "SCISPA",
        title: "ΤΚΣ + ΖΕΠ",
        color: "#059669",
        paragraphs: ["Περιοχές που έχουν χαρακτηριστεί τόσο ως ΤΚΣ, για οικοτόπους και άλλα είδη, όσο και ως ΖΕΠ, για πτηνά."],
      },
    ],
    impactTitle: "Τι σημαίνει αυτό για τα έργα και τις άλλες δραστηριότητες;",
    impact: [
      "Σχέδια ή έργα που ενδέχεται να έχουν σημαντικές επιπτώσεις σε περιοχή Natura 2000, μεμονωμένα ή σε συνδυασμό με άλλα σχέδια ή έργα (π.χ. δρόμοι, λατομεία, αιολικά ή φωτοβολταϊκά πάρκα, τουριστικές εγκαταστάσεις, μαρίνες και εντατική υδατοκαλλιέργεια), πρέπει πριν εγκριθούν να υποβάλλονται σε «δέουσα εκτίμηση» των επιπτώσεών τους στην περιοχή, με βάση τους στόχους διατήρησής της (άρθρο 6 παράγραφος 3 της Οδηγίας για τους Οικοτόπους).",
      "Η έγκριση επιτρέπεται μόνο εφόσον διαπιστωθεί ότι δεν θίγεται η ακεραιότητα της περιοχής. Κατ’ εξαίρεση, ένα έργο μπορεί να προχωρήσει εφόσον δεν υπάρχει εναλλακτική λύση και συντρέχουν επιτακτικοί λόγοι υπέρτερου δημοσίου συμφέροντος· στην περίπτωση αυτή απαιτούνται όλα τα αναγκαία αντισταθμιστικά μέτρα για τη διασφάλιση της συνοχής του δικτύου Natura 2000. Για οικοτόπους και είδη προτεραιότητας ισχύουν πρόσθετες προϋποθέσεις (άρθρο 6 παράγραφος 4).",
      "Τα έργα και οι άλλες δραστηριότητες δεν απαγορεύονται αυτομάτως: κάθε περίπτωση αξιολογείται χωριστά και εφαρμόζονται επίσης οι κανόνες της εθνικής περιβαλλοντικής αδειοδότησης. Υφιστάμενες δραστηριότητες, όπως η γεωργία και η αλιεία, μπορούν να συνεχίζονται εφόσον είναι συμβατές με τους στόχους διατήρησης της περιοχής.",
      "Ο χάρτης είναι ενδεικτικός και δεν αποτελεί νομική συμβουλή. Πριν σχεδιάσετε κάποια δραστηριότητα, ελέγξτε τα ακριβή όρια και τους ισχύοντες κανόνες με τις αρμόδιες ελληνικές αρχές, όπως το Υπουργείο Περιβάλλοντος και Ενέργειας και τους φορείς διαχείρισης Natura 2000.",
    ],
    regionTitle: "Ποσοστό Natura 2000 ανά περιφέρεια",
    regionDescription: "Η χρωματική διαβάθμιση δείχνει το ποσοστό της χερσαίας έκτασης κάθε περιφέρειας που βρίσκεται εντός του δικτύου Natura 2000. Οι επικαλυπτόμενες περιοχές ΤΚΣ και ΖΕΠ υπολογίζονται μία φορά.",
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector<HTMLElement>(".close")?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!modalRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} className="info-btn" onClick={() => setOpen(true)} aria-label={content.infoLabel} title={content.infoLabel}>
        i
      </button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="info-dialog-title" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setOpen(false)} aria-label={content.closeLabel}>×</button>
            <h2 id="info-dialog-title">{content.dialogTitle}</h2>
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
