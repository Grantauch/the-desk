import { facetIndex, type DiscoveryOutcome } from "@/lib/pond/discovery";

type Props = { outcome: DiscoveryOutcome; size?: number; className?: string };

/**
 * Pond specimen marks.
 *
 * A compact, two-ink catalog mark, not an invented portrait of the discovery.
 * The six motifs are deliberately abstract (water, strata, leaves, heat,
 * current, and seed). A 24-bit punched register distinguishes all 10,485,760
 * procedural identities, without glowing gems, faces or AI-style creatures.
 *
 * This ornament is aria-hidden; the adjacent discovery name is the label.
 */
const ENGRAVINGS = [
  // Waterline: a little current with a consistent, hand-etched rhythm.
  "M13 24C19 19 24 19 30 24S42 29 51 21M13 34C19 29 24 29 30 34S42 39 51 31M18 44C28 39 36 47 46 42",
  // Strata: stacked sediment and a small ridge.
  "M12 43L22 36L29 39L39 27L52 38M12 49H52M17 28L24 23L30 25M36 19L45 24",
  // Leaf veins, deliberately diagrammatic rather than an illustrated animal.
  "M31 51V14M31 24C22 12 14 19 17 30C23 37 30 32 31 28M32 35C39 20 50 23 48 37C43 43 35 42 32 39",
  // A flame made from an unbroken line.
  "M31 50C17 47 17 36 24 27C24 33 30 35 29 16C42 24 48 37 42 45C39 50 35 51 31 50ZM31 45C25 43 29 38 34 32C35 38 40 42 34 45",
  // Wind/current flowing around the central specimen point.
  "M11 23H42C51 23 53 14 45 14C41 14 39 16 39 19M12 33H48C55 33 55 42 49 42C46 42 44 40 44 38M17 44H36C42 44 43 51 38 52",
  // Seed and orbit: a physical specimen, not an invented creature.
  "M32 16C22 25 21 33 23 40C25 47 39 47 41 40C44 31 39 22 32 16ZM32 18V46M23 31C28 29 36 31 41 28",
] as const;

const INKS = [
  "#31564b", // evergreen
  "#45656b", // lake blue
  "#8a6546", // clay
  "#626d4e", // reed
  "#53536b", // slate violet
  "#695d4c", // umber
] as const;

export function DiscoveryGlyph({ outcome, size = 44, className }: Props) {
  const { form, habitat, force, trait } = outcome.facets;
  const index = facetIndex(outcome.facets);
  const ink = INKS[(form + habitat + force) % INKS.length]!;
  const motif = ENGRAVINGS[form % ENGRAVINGS.length]!;
  // This register is an identity mark rather than a second illustration:
  // each lit hole represents one bit of the discovery's stable index.
  const punched = Array.from({ length: 24 }, (_, bit) => {
    if (((index >>> bit) & 1) === 0) return null;
    return <rect key={bit} x={12 + bit * 1.72} y={56} width={1.05} height={2.4} rx={0.15} />;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="1.5" y="1.5" width="61" height="61" rx="3" fill="#efe9d7" stroke="#9d9a81" strokeWidth="1" />
      <path d="M7 9H57M7 52H57" stroke={ink} strokeOpacity=".3" strokeWidth=".8" />
      <path d="M8 8V14M8 8H14M56 8H50M56 8V14" fill="none" stroke={ink} strokeWidth="1.1" />
      <path d={motif} fill="none" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={47 + (trait % 5)} cy={12 + (force % 5)} r={1.25} fill={ink} />
      <path d="M12 55V59M52 55V59" stroke={ink} strokeOpacity=".4" strokeWidth=".7" />
      <g fill={ink} opacity=".86">{punched}</g>
    </svg>
  );
}
