import { facetIndex, type DiscoveryOutcome } from "@/lib/pond/discovery";

type Props = { outcome: DiscoveryOutcome; size?: number; className?: string };

/**
 * Lightweight original vector specimen art. Shapes, colors, orbit and glints
 * are driven by the same stable facets as the outcome's name.
 */
export function DiscoveryGlyph({ outcome, size = 44, className }: Props) {
  const { form, habitat, force, trait } = outcome.facets;
  const hue = (force * 29 + form * 11) % 360;
  const secondary = (habitat * 23 + trait * 7 + 80) % 360;
  const fill = "hsl(" + hue + " 70% 65%)";
  const shadow = "hsl(" + secondary + " 58% 30%)";
  const glow = "hsl(" + secondary + " 85% 78%)";
  // Twenty-four binary pixels encode every index in the 10.48M-identity space.
  // No two procedural outcomes share this signature pattern.
  const index = facetIndex(outcome.facets);
  const signature = Array.from({ length: 24 }, (_, bit) => {
    if (((index >>> bit) & 1) === 0) return "";
    const x = 23 + (bit % 4) * 4;
    const y = 21 + Math.floor(bit / 4) * 4;
    return "M" + x + " " + y + "h2v2h-2Z";
  }).join(" ");
  const paths = [
    "M32 10 C47 22 49 37 32 54 C15 38 17 22 32 10Z",
    "M14 45 L26 19 L35 36 L43 14 L53 45Z",
    "M15 31 C21 14 43 14 49 31 C43 49 21 49 15 31Z",
    "M32 12 L38 24 L51 19 L46 32 L54 40 L39 42 L32 53 L25 42 L10 40 L18 32 L13 19 L26 24Z",
    "M12 36 Q23 13 36 26 Q44 23 53 32 Q42 40 36 36 Q22 52 12 36Z",
    "M18 48 L18 24 Q32 10 46 24 L46 48Z M25 24 L25 16 L39 16 L39 24",
    "M13 43 Q15 18 32 21 Q49 18 51 43 L40 49 L24 49Z",
    "M28 52 Q13 34 24 15 Q39 9 43 23 Q49 42 28 52Z",
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="30" fill={shadow} />
      <circle cx="32" cy="32" r="26" fill="none" stroke={glow} strokeOpacity="0.36" />
      <path d={paths[form % paths.length]} fill={fill} stroke={glow} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={signature} fill={glow} opacity=".85" />
      <path d="M16 49 Q32 57 48 49" fill="none" stroke={glow} strokeOpacity=".5" strokeWidth="2" />
      <circle cx={12 + (habitat % 13)} cy={12 + (force % 8)} r={1.5 + (trait % 3)} fill={glow} />
      <circle cx={44 + (trait % 8)} cy={13 + (habitat % 11)} r={1.5 + (force % 2)} fill={glow} />
      <path d={"M" + (20 + trait % 22) + " 11 l2 -4 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2Z"} fill={glow} opacity=".55" />
    </svg>
  );
}
