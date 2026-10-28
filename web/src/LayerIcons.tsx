import type { SiteType } from "./api";

export type LayerKey = SiteType | "regions";

const frame = { width: 56, height: 56, viewBox: "0 0 56 56", "aria-hidden": true, focusable: false } as const;

const ICONS: Record<LayerKey, JSX.Element> = {
  // Habitats & species: meadow with a flower under a blue sky
  SCI: (
    <svg {...frame}>
      <rect width="56" height="56" fill="#dbeafe" />
      <circle cx="44" cy="12" r="6" fill="#fde68a" />
      <path d="M0 40 Q14 30 28 38 T56 34 V56 H0Z" fill="#60a5fa" />
      <path d="M0 46 Q16 38 30 45 T56 42 V56 H0Z" fill="#2563eb" />
      <path d="M26 44 V26" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 38 Q19 38 18 31 Q25 31 26 38Z" fill="#22c55e" />
      <path d="M26 34 Q33 34 34 27 Q27 27 26 34Z" fill="#16a34a" />
      <g fill="#f472b6">
        <circle cx="26" cy="19" r="4" />
        <circle cx="21" cy="23" r="4" />
        <circle cx="31" cy="23" r="4" />
        <circle cx="23" cy="28" r="0" />
      </g>
      <circle cx="26" cy="23" r="3.2" fill="#fbbf24" />
    </svg>
  ),
  // Birds: flying bird over an amber sky
  SPA: (
    <svg {...frame}>
      <defs>
        <linearGradient id="spa-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" fill="url(#spa-sky)" />
      <path d="M0 46 Q18 38 34 45 T56 42 V56 H0Z" fill="#b45309" />
      <path d="M10 28 Q18 14 28 26 Q38 14 46 28 Q37 24 28 33 Q19 24 10 28Z" fill="#78350f" />
      <circle cx="28" cy="27" r="3" fill="#78350f" />
      <path d="M31 26 L36 27.5 L31 29Z" fill="#fff7ed" />
      <circle cx="29" cy="26" r="0.9" fill="#fff" />
    </svg>
  ),
  // Both: green land split with leaf and wing
  SCISPA: (
    <svg {...frame}>
      <rect width="56" height="56" fill="#d1fae5" />
      <path d="M0 0 H56 L0 56Z" fill="#a7f3d0" />
      <path d="M0 44 Q16 36 30 43 T56 40 V56 H0Z" fill="#059669" />
      <path d="M0 50 Q18 44 34 49 T56 47 V56 H0Z" fill="#047857" />
      <path d="M12 34 Q8 20 22 14 Q26 28 12 34Z" fill="#10b981" stroke="#065f46" strokeWidth="1.5" />
      <path d="M13 32 Q16 24 20 18" stroke="#065f46" strokeWidth="1.2" fill="none" />
      <path d="M30 24 Q38 10 46 22 Q50 14 52 24 Q42 22 38 30 Q36 24 30 24Z" fill="#064e3b" />
      <circle cx="44" cy="27" r="0" />
    </svg>
  ),
  // Regional coverage: choropleth patches
  regions: (
    <svg {...frame}>
      <rect width="56" height="56" fill="#eff3ff" />
      <path d="M4 10 L24 4 L30 20 L14 28 L4 22Z" fill="#6baed6" stroke="#fff" strokeWidth="1.5" />
      <path d="M24 4 L48 8 L52 24 L30 20Z" fill="#08519c" stroke="#fff" strokeWidth="1.5" />
      <path d="M14 28 L30 20 L52 24 L44 40 L22 38Z" fill="#3182bd" stroke="#fff" strokeWidth="1.5" />
      <path d="M4 22 L14 28 L22 38 L12 50 L4 42Z" fill="#bdd7e7" stroke="#fff" strokeWidth="1.5" />
      <path d="M22 38 L44 40 L38 52 L12 50Z" fill="#9ecae1" stroke="#fff" strokeWidth="1.5" />
    </svg>
  ),
};

export default function LayerIcon({ layer }: { layer: LayerKey }) {
  return ICONS[layer];
}
