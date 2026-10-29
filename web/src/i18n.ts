import type { Language, SiteType } from "./api";

export interface Messages {
  title: string;
  siteTypes: Record<SiteType, string>;
  sites: string;
  network: string;
  land: string;
  regionCoverage: string;
  legendTitle: string;
  centreOnMe: string;
  resetView: string;
  loadError: string;
  retry: string;
  loadingSites: string;
  noLayers: string;
  dataCredit: string;
  dataModified: string;
  language: string;
  seoTitle: string;
  seoDescription: string;
  aboutHeading: string;
  about: string;
  lastSync: string;
  locate: string;
  stopLocate: string;
  locating: string;
  inside: string;
  outside: string;
  unknown: string;
  denied: string;
  unavailable: string;
  privacy: string;
  privacyShort: string;
  learnMore: string;
  layers: string;
  aboutMap: string;
  yourPosition: string;
  showPanel: string;
  hidePanel: string;
  expandPanel: string;
  ypen: string;
  legalNav: string;
  privacyPolicy: string;
  imprint: string;
  backToMap: string;
  onThisPage: string;
  protectedSuffix: string;
  closeDetails: string;
  siteCodeLabel: string;
  areaLabel: string;
  protectedShareLabel: string;
  sitesCountLabel: string;
  searchSites: string;
  noResults: string;
}

export const TEXT: Record<Language, Messages> = {
  el: {
    title: "Χάρτης Natura Ελλάδα",
    siteTypes: { SCI: "ΤΚΣ (οικότοποι & είδη)", SPA: "ΖΕΠ (πτηνά)", SCISPA: "ΤΚΣ + ΖΕΠ" },
    sites: "τόποι",
    network: "δίκτυο",
    land: "της χερσαίας έκτασης",
    regionCoverage: "Ποσοστό έκτασης Natura 2000 ανά περιφέρεια",
    legendTitle: "Ποσοστό προστατευόμενης έκτασης",
    centreOnMe: "Κέντρο στη θέση μου",
    resetView: "Επαναφορά προβολής",
    loadError: "Δεν ήταν δυνατή η φόρτωση ορισμένων δεδομένων. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
    retry: "Επανάληψη",
    loadingSites: "Φόρτωση περιοχών…",
    noLayers: "Δεν έχει επιλεγεί κανένα επίπεδο. Ενεργοποιήστε ένα επίπεδο για να το δείτε στον χάρτη.",
    dataCredit: "Πηγές δεδομένων:",
    dataModified: "αναπροβολή, απλοποίηση και παράγωγα μεγέθη",
    language: "Γλώσσα",
    seoTitle: "Περιοχές Natura 2000 στην Ελλάδα | Χάρτης Natura Ελλάδα",
    seoDescription: "Διαδραστικός χάρτης των περιοχών Natura 2000 στην Ελλάδα. Εξερευνήστε τόπους κοινοτικής σημασίας, ζώνες προστασίας πτηνών και κάλυψη ανά περιφέρεια.",
    aboutHeading: "Το δίκτυο Natura 2000 στην Ελλάδα",
    about: "Εξερευνήστε τις προστατευόμενες περιοχές της Ελλάδας, δείτε τόπους κοινοτικής σημασίας (ΤΚΣ), ζώνες ειδικής προστασίας (ΖΕΠ) και την κάλυψη Natura 2000 ανά περιφέρεια.",
    lastSync: "Τελευταίος συγχρονισμός δεδομένων:",
    locate: "Πού βρίσκομαι;",
    stopLocate: "Διακοπή εντοπισμού",
    locating: "Εντοπισμός θέσης…",
    inside: "Βρίσκεστε σε περιοχή Natura 2000",
    outside: "Δεν βρίσκεστε σε περιοχή Natura 2000",
    unknown: "Δεν υπάρχουν δεδομένα τρέχουσας θέσης",
    denied: "Η πρόσβαση στην τοποθεσία απορρίφθηκε.",
    unavailable: "Η θέση δεν είναι διαθέσιμη.",
    privacyShort: "Η θέση σας δεν φεύγει από το πρόγραμμα περιήγησής σας.",
    learnMore: "Μάθετε περισσότερα",
    layers: "Επίπεδα",
    aboutMap: "Σχετικά με τον χάρτη",
    privacy: "Η θέση σας επεξεργάζεται μόνο στο πρόγραμμα περιήγησής σας· δεν αποστέλλεται ούτε αποθηκεύεται. Ο έλεγχος είναι κατά προσέγγιση (απλοποιημένα όρια) και δεν έχει νομική ισχύ.",
    yourPosition: "Η θέση σας",
    showPanel: "Εμφάνιση πίνακα",
    hidePanel: "Απόκρυψη πίνακα",
    expandPanel: "Ανάπτυξη πίνακα",
    ypen: "Υπουργείο Περιβάλλοντος & Ενέργειας (ΥΠΕΝ)",
    legalNav: "Νομικές πληροφορίες",
    privacyPolicy: "Πολιτική απορρήτου",
    imprint: "Στοιχεία εκδότη",
    backToMap: "Επιστροφή στον χάρτη",
    onThisPage: "Σε αυτή τη σελίδα",
    protectedSuffix: "προστατευόμενη έκταση",
    closeDetails: "Κλείσιμο λεπτομερειών",
    siteCodeLabel: "Κωδικός",
    areaLabel: "Έκταση",
    protectedShareLabel: "Προστατευόμενο",
    sitesCountLabel: "Περιοχές",
    searchSites: "Αναζήτηση περιοχών με όνομα ή κωδικό",
    noResults: "Δεν βρέθηκαν αποτελέσματα",
  },
  en: {
    title: "Natura Map Greece",
    siteTypes: { SCI: "SCI (habitats & species)", SPA: "SPA (birds)", SCISPA: "SCI + SPA" },
    sites: "sites",
    network: "network",
    land: "of land",
    regionCoverage: "Natura 2000 area by region (%)",
    legendTitle: "Protected area share",
    centreOnMe: "Centre on my position",
    resetView: "Reset view",
    loadError: "Some data could not be loaded. Check your connection and try again.",
    retry: "Retry",
    loadingSites: "Loading sites…",
    noLayers: "No layers selected. Turn on a layer to see it on the map.",
    dataCredit: "Data sources:",
    dataModified: "reprojected, simplified, derived measurements",
    language: "Language",
    seoTitle: "Natura 2000 Sites in Greece | Natura Map Greece",
    seoDescription: "Explore an interactive map of Natura 2000 protected sites in Greece, including habitat and bird protection sites and coverage by region.",
    aboutHeading: "Natura 2000 in Greece",
    about: "Explore Greece's protected sites, including Sites of Community Importance (SCI), Special Protection Areas (SPA), and Natura 2000 coverage by region.",
    lastSync: "Data last synced:",
    locate: "Where am I?",
    stopLocate: "Stop locating",
    locating: "Locating…",
    inside: "You are in a Natura 2000 area",
    outside: "You are not in a Natura 2000 area",
    unknown: "No current location data available",
    denied: "Location permission was denied.",
    unavailable: "Your position is unavailable.",
    privacyShort: "Your location never leaves your browser.",
    learnMore: "Learn more",
    layers: "Layers",
    aboutMap: "About this map",
    privacy: "Your location is processed only in your browser; it is never sent or stored. The check is approximate (simplified boundaries) and has no legal force.",
    yourPosition: "Your position",
    showPanel: "Show panel",
    hidePanel: "Hide panel",
    expandPanel: "Expand panel",
    ypen: "Ministry of Environment & Energy (YPEN)",
    legalNav: "Legal information",
    privacyPolicy: "Privacy policy",
    imprint: "Imprint",
    backToMap: "Back to map",
    onThisPage: "On this page",
    protectedSuffix: "protected",
    closeDetails: "Close details",
    siteCodeLabel: "Code",
    areaLabel: "Area",
    protectedShareLabel: "Protected",
    sitesCountLabel: "Sites",
    searchSites: "Search sites by name or code",
    noResults: "No results",
  },
};
