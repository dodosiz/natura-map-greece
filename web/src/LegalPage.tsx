import { useEffect, useState, type ReactNode } from "react";
import { TEXT } from "./i18n";
import { initialLanguage, pageHref } from "./lang";
import { updatePageMetadata } from "./seo";

type LegalPageKind = "privacy" | "imprint";
type Language = "el" | "en";

const SEO_DESCRIPTIONS: Record<Language, Record<LegalPageKind, string>> = {
  el: {
    privacy: "Μάθετε πώς ο ιστότοπος Χάρτης Natura Ελλάδα διαχειρίζεται τα δεδομένα, τα αιτήματα χάρτη και την προαιρετική χρήση τοποθεσίας.",
    imprint: "Στοιχεία εκδότη και υπευθύνου για τον ιστότοπο Χάρτης Natura Ελλάδα.",
  },
  en: {
    privacy: "Learn how Natura Map Greece handles website data, map requests, and optional location use.",
    imprint: "Publisher and operator details for the Natura Map Greece website.",
  },
};

const LEGAL_COPY: Record<
  Language,
  Record<LegalPageKind, { title: string; sections: { heading: string; body: ReactNode }[] }>
> = {
  el: {
    privacy: {
      title: "Πολιτική απορρήτου",
      sections: [
        {
          heading: "Υπεύθυνος επεξεργασίας",
          body: (
            <p>
              Υπεύθυνος επεξεργασίας είναι ο Θεοδόσιος Ασβεστόπουλος, Πρατίνου 12, 11634 Αθήνα,
              Ελλάδα. Για ερωτήματα σχετικά με τα προσωπικά δεδομένα:{" "}
              <a href="mailto:t.v.asvestopoulos@gmail.com">t.v.asvestopoulos@gmail.com</a>.
            </p>
          ),
        },
        {
          heading: "Δεδομένα που επεξεργάζεται ο ιστότοπος",
          body: (
            <>
              <p>
                Ο ιστότοπος είναι μόνο για ανάγνωση και δεν έχει λογαριασμούς ή φόρμα επικοινωνίας.
                Δεν αποθηκεύει προσωπικά δεδομένα χρηστών στη βάση δεδομένων του.
              </p>
              <p>
                Η υπηρεσία φιλοξενείται στο Google Cloud Run (περιοχή europe-west1, Βέλγιο).
                Το Cloud Run δημιουργεί αυτόματα αρχεία καταγραφής αιτημάτων στο Google Cloud
                Logging. Ανάλογα με τις ρυθμίσεις της υπηρεσίας, αυτά μπορεί να περιλαμβάνουν τη
                διεύθυνση IP, τη διεύθυνση URL και τον χρόνο του αιτήματος, την κατάσταση απόκρισης
                και τεχνικά στοιχεία όπως το πρόγραμμα περιήγησης ή το referer. Τα αρχεία αυτά
                χρησιμοποιούνται για τη λειτουργία, την ασφάλεια και την αντιμετώπιση προβλημάτων
                της υπηρεσίας. Νομική βάση είναι το έννομο συμφέρον του υπευθύνου (άρθρο 6 παρ. 1
                στοιχ. στ΄ ΓΚΠΔ).
              </p>
              <p>
                Η διάρκεια διατήρησης και η περιοχή αποθήκευσης των αρχείων καταγραφής καθορίζονται
                από τις ρυθμίσεις του Google Cloud project και δεν έχουν επαληθευτεί για τη
                δημοσίευση της παρούσας πολιτικής. Σύμφωνα με τον υπεύθυνο, τα αρχεία παραμένουν
                στο Google Cloud και δεν εξάγονται σε άλλον πάροχο.
              </p>
            </>
          ),
        },
        {
          heading: "Χάρτης και OpenStreetMap",
          body: (
            <p>
              Για την εμφάνιση του χάρτη, το πρόγραμμα περιήγησής σας ζητά απευθείας πλακίδια
              χάρτη από το OpenStreetMap Foundation (OSMF), χωρίς να μεσολαβεί ο διακομιστής του
              ιστότοπου. Το OSMF λαμβάνει τη διεύθυνση IP και τα αιτήματα για τα πλακίδια που
              εμφανίζονται, μαζί με τα τεχνικά στοιχεία που συνοδεύουν τα αιτήματα. Αυτό είναι
              αναγκαίο για την παροχή του χάρτη και βασίζεται στο έννομο συμφέρον του υπευθύνου
              (άρθρο 6 παρ. 1 στοιχ. στ΄ ΓΚΠΔ). Για πληροφορίες σχετικά με την επεξεργασία από το
              OSMF, δείτε την{" "}
              <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">
                πολιτική απορρήτου του OSMF
              </a>
              .
            </p>
          ),
        },
        {
          heading: "Προαιρετική χρήση τοποθεσίας",
          body: (
            <p>
              Η τοποθεσία ζητείται μόνο όταν επιλέξετε «Πού βρίσκομαι;» και επιτρέψετε την πρόσβαση
              από το πρόγραμμα περιήγησης. Οι συντεταγμένες χρησιμοποιούνται αποκλειστικά στη
              συσκευή σας για σύγκριση με τα ήδη φορτωμένα όρια Natura 2000· δεν αποστέλλονται στον
              διακομιστή του ιστότοπου ούτε αποθηκεύονται σε cookie ή τοπικό χώρο αποθήκευσης.
              Μπορείτε να σταματήσετε τον εντοπισμό από το κουμπί ή να ανακαλέσετε την άδεια από τις
              ρυθμίσεις του προγράμματος περιήγησης. Η μετακίνηση του χάρτη στην τοποθεσία μπορεί
              να προκαλέσει αιτήματα πλακιδίων προς το OSMF για την περιοχή που προβάλλεται. Η
              ένδειξη εντός/εκτός περιοχής είναι προσεγγιστική και δεν έχει νομική ισχύ. Η νομική
              βάση για αυτή την προαιρετική λειτουργία είναι η συγκατάθεσή σας (άρθρο 6 παρ. 1
              στοιχ. α΄ ΓΚΠΔ).
            </p>
          ),
        },
        {
          heading: "Cookies και παρόμοιες τεχνολογίες",
          body: (
            <p>
              Ο ιστότοπος δεν χρησιμοποιεί cookies, analytics, διαφημιστικούς ιχνηλάτες ή
              αποθήκευση προτιμήσεων στο πρόγραμμα περιήγησης.
            </p>
          ),
        },
        {
          heading: "Πάροχοι, αποδέκτες και διαβιβάσεις",
          body: (
            <p>
              Τα τεχνικά αιτήματα και τα αρχεία καταγραφής υποβάλλονται σε επεξεργασία μέσω Google
              Cloud Run και Google Cloud Logging. Τα αιτήματα πλακιδίων αποστέλλονται στο OSMF. Η
              περιοχή αποθήκευσης των αρχείων Google Cloud Logging δεν έχει επαληθευτεί και οι
              υπηρεσίες τρίτων ενδέχεται να επεξεργάζονται δεδομένα εκτός του Ευρωπαϊκού
              Οικονομικού Χώρου, σύμφωνα με τους δικούς τους όρους και τις εφαρμοστέες εγγυήσεις
              διαβίβασης. Περισσότερες πληροφορίες παρέχουν οι{" "}
              <a href="https://cloud.google.com/terms/cloud-privacy-notice" target="_blank" rel="noopener noreferrer">
                όροι απορρήτου του Google Cloud
              </a>{" "}
              και η πολιτική απορρήτου του OSMF που αναφέρεται παραπάνω.
            </p>
          ),
        },
        {
          heading: "Επικοινωνία και διατήρηση",
          body: (
            <p>
              Αν επικοινωνήσετε με email, θα γίνει επεξεργασία της διεύθυνσης και του περιεχομένου
              του μηνύματός σας μόνο για να απαντηθεί το αίτημα και να τηρηθούν τυχόν νόμιμες
              υποχρεώσεις. Τα μηνύματα διαγράφονται όταν δεν είναι πλέον αναγκαία, με την επιφύλαξη
              τυχόν νόμιμης υποχρέωσης ή ανάγκης θεμελίωσης, άσκησης ή υποστήριξης νομικών αξιώσεων.
              Η διεύθυνση επικοινωνίας χρησιμοποιεί το Gmail της Google· δείτε την{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                πολιτική απορρήτου της Google
              </a>
              .
            </p>
          ),
        },
        {
          heading: "Τα δικαιώματά σας",
          body: (
            <>
              <p>
                Υπό τις προϋποθέσεις του ΓΚΠΔ, μπορείτε να ζητήσετε πρόσβαση, διόρθωση, διαγραφή ή
                περιορισμό της επεξεργασίας, να αντιταχθείτε σε επεξεργασία που βασίζεται σε έννομο
                συμφέρον και να ασκήσετε δικαίωμα φορητότητας όπου εφαρμόζεται. Για άσκηση
                δικαιωμάτων, επικοινωνήστε στο{" "}
                <a href="mailto:t.v.asvestopoulos@gmail.com">t.v.asvestopoulos@gmail.com</a>.
                Μπορείτε επίσης να υποβάλετε καταγγελία στην{" "}
                <a href="https://www.dpa.gr/" target="_blank" rel="noopener noreferrer">
                  Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα
                </a>
                . Η συγκατάθεση για τη χρήση τοποθεσίας ανακαλείται οποτεδήποτε από τις ρυθμίσεις
                του προγράμματος περιήγησης.
              </p>
            </>
          ),
        },
        {
          heading: "Ενημερώσεις",
          body: <p>Τελευταία ενημέρωση: 28 Οκτωβρίου 2026.</p>,
        },
      ],
    },
    imprint: {
      title: "Στοιχεία εκδότη",
      sections: [
        {
          heading: "Υπεύθυνος λειτουργίας",
          body: (
            <address>
              Θεοδόσιος Ασβεστόπουλος
              <br />
              Πρατίνου 12
              <br />
              11634 Αθήνα, Ελλάδα
              <br />
              <a href="mailto:t.v.asvestopoulos@gmail.com">t.v.asvestopoulos@gmail.com</a>
            </address>
          ),
        },
        {
          heading: "Φορολογικά στοιχεία",
          body: <p>ΑΦΜ / αριθμός ΦΠΑ: EL143106080</p>,
        },
        {
          heading: "Σχετικά με τον χάρτη",
          body: (
            <p>
              Ο ιστότοπος παρέχει ενημερωτικό και χαρτογραφικό εργαλείο για τις περιοχές Natura
              2000 στην Ελλάδα. Τα γεωχωρικά δεδομένα απλοποιούνται και οι υπολογισμοί είναι
              προσεγγιστικοί. Ο χάρτης δεν αποτελεί επίσημη διοικητική πράξη ή νομική συμβουλή και
              δεν υποκαθιστά τα επίσημα στοιχεία των αρμόδιων αρχών.
            </p>
          ),
        },
        {
          heading: "Πνευματικά δικαιώματα και πηγές",
          body: (
            <p>
              Οι πηγές και οι άδειες των δεδομένων εμφανίζονται στην απόδοση του χάρτη. Τα
              δικαιώματα επί δεδομένων, χαρτογραφικών πλακιδίων, λογισμικού και άλλου περιεχομένου
              τρίτων παραμένουν στους αντίστοιχους δικαιούχους.
            </p>
          ),
        },
        {
          heading: "Φωτογραφία",
          body: (
            <p>
              Φωτογραφία του{" "}
              <a href="https://unsplash.com/@v2osk?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">v2osk</a>{" "}
              στο{" "}
              <a href="https://unsplash.com/photos/foggy-mountain-summit-1Z2niiBPg5A?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>.
            </p>
          ),
        },
      ],
    },
  },
  en: {
    privacy: {
      title: "Privacy policy",
      sections: [
        {
          heading: "Data controller",
          body: (
            <p>
              The controller is Theodosios Asvestopoulos, Pratinou 12, 11634 Athens, Greece. For
              privacy questions, contact{" "}
              <a href="mailto:t.v.asvestopoulos@gmail.com">t.v.asvestopoulos@gmail.com</a>.
            </p>
          ),
        },
        {
          heading: "Data processed by this website",
          body: (
            <>
              <p>
                This is a read-only website with no accounts or contact form. It does not store
                visitors' personal data in its application database.
              </p>
              <p>
                The service is hosted on Google Cloud Run (europe-west1, Belgium). Cloud Run
                automatically creates request logs in Google Cloud Logging. Depending on service
                settings, these may include an IP address, request URL and time, response status,
                and technical details such as browser or referrer. These logs are used to operate,
                secure, and troubleshoot the service. The legal basis is the controller's
                legitimate interests (GDPR Article 6(1)(f)).
              </p>
              <p>
                Log retention and storage location are controlled by the Google Cloud project's
                settings and have not been verified for this notice. The operator reports that
                logs remain in Google Cloud and are not exported to another provider.
              </p>
            </>
          ),
        },
        {
          heading: "Map and OpenStreetMap",
          body: (
            <p>
              To display the map, your browser requests map tiles directly from the OpenStreetMap
              Foundation (OSMF), without going through this website's server. OSMF receives your
              IP address and requests for the tiles being displayed, together with technical
              information sent with those requests. This is necessary to provide the map and is
              based on the controller's legitimate interests (GDPR Article 6(1)(f)). For
              information about OSMF's processing, see the{" "}
              <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">
                OSMF privacy policy
              </a>
              .
            </p>
          ),
        },
        {
          heading: "Optional location feature",
          body: (
            <p>
              Location is requested only after you select “Where am I?” and grant permission in
              your browser. Coordinates are used only on your device to compare your location with
              the already-loaded Natura 2000 boundaries; they are not sent to this website's
              server or stored in cookies or browser storage. You can stop location tracking using
              the button or revoke permission in your browser settings. Moving the map to your
              location may cause tile requests to OSMF for the area displayed. The inside/outside
              result is approximate and has no legal effect. The legal basis for this optional
              feature is your consent (GDPR Article 6(1)(a)).
            </p>
          ),
        },
        {
          heading: "Cookies and similar technologies",
          body: (
            <p>
              This website does not use cookies, analytics, advertising trackers, or browser
              storage for preferences.
            </p>
          ),
        },
        {
          heading: "Providers, recipients, and transfers",
          body: (
            <p>
              Technical requests and request logs are processed through Google Cloud Run and
              Google Cloud Logging. Tile requests are sent to OSMF. The storage location for
              Google Cloud Logging has not been verified, and third-party services may process
              data outside the European Economic Area under their own terms and applicable
              transfer safeguards. Further information is available in the{" "}
              <a href="https://cloud.google.com/terms/cloud-privacy-notice" target="_blank" rel="noopener noreferrer">
                Google Cloud Privacy Notice
              </a>{" "}
              and the OSMF privacy policy linked above.
            </p>
          ),
        },
        {
          heading: "Email and retention",
          body: (
            <p>
              If you contact the operator by email, your email address and message content will be
              processed only to respond and meet any legal obligations. Messages are deleted when
              no longer needed, subject to any legal retention duty or need to establish, exercise,
              or defend legal claims.
              The contact address uses Google Gmail; see{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                Google's Privacy Policy
              </a>
              .
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p>
              Subject to GDPR conditions, you can request access, rectification, erasure, or
              restriction of processing; object to processing based on legitimate interests; and
              exercise the right to data portability where applicable. Contact{" "}
              <a href="mailto:t.v.asvestopoulos@gmail.com">t.v.asvestopoulos@gmail.com</a> to
              exercise your rights. You may also lodge a complaint with the{" "}
              <a href="https://www.dpa.gr/" target="_blank" rel="noopener noreferrer">
                Hellenic Data Protection Authority
              </a>
              . You can withdraw permission for location access at any time through your browser
              settings.
            </p>
          ),
        },
        {
          heading: "Updates",
          body: <p>Last updated: 28 October 2026.</p>,
        },
      ],
    },
    imprint: {
      title: "Imprint",
      sections: [
        {
          heading: "Operator",
          body: (
            <address>
              Theodosios Asvestopoulos
              <br />
              Pratinou 12
              <br />
              11634 Athens, Greece
              <br />
              <a href="mailto:t.v.asvestopoulos@gmail.com">t.v.asvestopoulos@gmail.com</a>
            </address>
          ),
        },
        {
          heading: "Tax details",
          body: <p>VAT number: EL143106080</p>,
        },
        {
          heading: "About the map",
          body: (
            <p>
              This website provides an informational mapping tool for Natura 2000 areas in
              Greece. Geospatial data is simplified and calculations are approximate. The map is
              not an official administrative decision or legal advice and does not replace
              official information from the competent authorities.
            </p>
          ),
        },
        {
          heading: "Copyright and sources",
          body: (
            <p>
              Data sources and licences are shown in the map attribution. Rights in third-party
              data, map tiles, software, and other content remain with their respective
              rightsholders.
            </p>
          ),
        },
        {
          heading: "Photo credit",
          body: (
            <p>
              Photo by{" "}
              <a href="https://unsplash.com/@v2osk?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">v2osk</a>{" "}
              on{" "}
              <a href="https://unsplash.com/photos/foggy-mountain-summit-1Z2niiBPg5A?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>.
            </p>
          ),
        },
      ],
    },
  },
};

export default function LegalPage({ page }: { page: LegalPageKind }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const copy = LEGAL_COPY[language][page];
  const text = TEXT[language];

  useEffect(() => {
    updatePageMetadata({
      title: `${copy.title} — ${TEXT[language].title}`,
      description: SEO_DESCRIPTIONS[language][page],
      language,
      path: `/${page}`,
    });
  }, [copy.title, language, page]);

  return (
    <main className="legal-page">
      <a className="legal-back" href={pageHref("/", language)}>
        <span aria-hidden="true">←</span> {text.backToMap}
      </a>
      <header className="legal-header">
        <a className="legal-brand" href={pageHref("/", language)}>
          {text.title}
        </a>
        <div className="lang-toggle" role="group" aria-label={text.language}>
          {(["el", "en"] as Language[]).map((item) => (
            <button key={item} type="button" aria-pressed={language === item} onClick={() => setLanguage(item)}>
              {item === "el" ? "ΕΛ" : "EN"}
            </button>
          ))}
        </div>
      </header>
      <nav className="legal-nav"       aria-label={text.legalNav}>
        <a href={pageHref("/privacy", language)} aria-current={page === "privacy" ? "page" : undefined}>
                {text.privacyPolicy}
        </a>
        <a href={pageHref("/imprint", language)} aria-current={page === "imprint" ? "page" : undefined}>
                {text.imprint}
        </a>
      </nav>
      <article className="legal-content">
        <h1>{copy.title}</h1>
        <nav className="legal-toc" aria-label={text.onThisPage}>
          <p className="legal-toc-title">{text.onThisPage}</p>
          <ol>
            {copy.sections.map((section, i) => (
              <li key={section.heading}>
                <a href={`#section-${i + 1}`}>{section.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
        {copy.sections.map((section, i) => (
          <section key={section.heading} aria-labelledby={`section-${i + 1}`}>
            <h2 id={`section-${i + 1}`}>{section.heading}</h2>
            {section.body}
          </section>
        ))}
      </article>
    </main>
  );
}
