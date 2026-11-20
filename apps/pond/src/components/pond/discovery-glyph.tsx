import { facetIndex, type DiscoveryOutcome } from "@/lib/pond/discovery";

type Props = { outcome: DiscoveryOutcome; size?: number; className?: string };

/** One deliberate silhouette per form: specimens should not all resemble gems. */
const FORM_SILHOUETTES = [
  "M14 43Q20 34 25 27L18 13L29 20Q34 18 38 20L48 12L46 29Q53 36 51 43L43 50L22 50Z", // Fox
  "M12 38Q14 28 27 28L41 22Q52 24 53 35Q48 45 34 44L21 51L16 47L22 42Z", // Otter
  "M15 33Q19 20 32 20Q45 20 49 33L47 42L17 42Z M15 37L9 39L14 43M49 37L55 39L50 43M30 43L26 49L36 49L34 43", // Turtle
  "M23 52L19 30L11 23L13 11L21 25L23 17L27 29L32 32L37 29L41 17L43 25L51 11L53 23L45 30L41 52Z", // Stag
  "M32 18Q40 20 52 31L57 42L41 37L34 46L30 46L23 37L7 42L12 31Q24 20 32 18Z", // Hawk
  "M31 21Q19 5 13 18Q9 33 26 34Q11 35 16 48Q24 53 32 40Q40 53 48 48Q53 35 38 34Q55 33 51 18Q45 5 33 21Z", // Moth
  "M32 14Q45 14 48 27L49 42L42 49L22 49L15 42L16 27Q19 14 32 14Z M32 17V47M17 29L11 24M47 29L53 24M17 39L10 44M47 39L54 44", // Beetle
  "M9 35Q14 20 36 23Q48 25 53 35L58 25L59 43L53 39Q46 51 31 46Q17 48 9 35Z", // Whale
  "M16 48L20 30L17 10L29 21L35 21L47 10L44 30L49 47L40 52L23 52Z", // Wolf
  "M11 30Q16 10 32 10Q48 10 53 30L45 35L19 35Z M27 35V52H37V35", // Mushroom
  "M32 53V13M31 19Q13 13 11 27Q24 31 31 24M33 25Q51 17 53 31Q41 34 33 30M30 35Q17 28 13 43Q25 47 30 40M34 40Q50 34 51 47Q40 49 34 44", // Fern
  "M32 24Q21 10 19 24Q8 26 20 37Q17 52 32 43Q47 52 44 37Q56 26 44 24Q43 10 32 24Z M32 44V55", // Flower
  "M29 52V38L16 39L25 27L20 27L32 10L44 27L39 27L48 39L35 38V52Z", // Tree
  "M31 52V17L20 9L24 29L13 19L10 38L23 34L21 49L31 42L42 50L40 34L53 38L50 19L40 29L44 9Z", // Coral
  "M32 8L44 19L51 40L32 56L13 40L20 19Z M32 8V56M20 19L32 31L44 19", // Crystal
  "M23 10H41L45 22L52 26L50 49H41L38 55H26L23 49H14L12 26L19 22Z", // Golem
  "M27 11H37V17H43L47 46L43 52H21L17 46L21 17H27Z M23 24H41V43H23Z", // Lantern
  "M32 9L43 13L51 24V40L43 51L32 55L21 51L13 40V24L21 13Z M32 19V33L42 38", // Clock
  "M32 9L52 32L32 55L12 32Z M32 9V55M12 32H52", // Kite
  "M9 38L17 49H47L55 38Z M31 12V39M34 13L49 35H34Z M28 20L15 35H28Z", // Ship
  "M20 51V29H25V20H39V29H44V51Z M26 20L32 9L38 20M29 37H35V51", // Tower
  "M10 46Q24 37 39 41Q51 32 57 42L50 51H15Z M16 38Q25 27 30 30Q39 15 46 34", // Island
  "M45 12Q58 14 53 27Q49 34 36 37L20 53L26 36L11 38L29 25Q35 12 45 12Z", // Comet
  "M40 9Q19 20 24 39Q28 51 43 54Q27 60 16 46Q5 29 19 14Q28 7 40 9Z", // Moon
  "M32 8L39 25L57 25L44 36L49 55L32 44L15 55L20 36L7 25L25 25Z", // Star
  "M11 43Q20 25 30 33Q34 17 47 11L43 27L55 21L49 39L38 47L24 53L15 51Z", // Dragon
  "M32 10Q39 23 49 25L43 35L53 44L38 46L32 55L26 46L11 44L21 35L15 25Q25 23 32 10Z", // Phoenix
  "M32 15Q47 19 45 32Q51 37 46 49L37 45L32 55L27 45L18 49Q13 37 19 32Q17 19 32 15Z", // Sprite
  "M12 44Q12 24 25 26Q36 28 36 38Q39 47 47 39Q53 28 46 19L56 20Q61 39 48 49Q36 57 28 44Q20 36 18 46Z", // Serpent
  "M19 47Q14 38 23 29L19 8L29 11L32 24L37 9L47 11L43 30Q52 40 44 49L32 53Z", // Rabbit
  "M12 26L19 10L29 18L35 18L45 10L52 26L47 47L32 55L17 47Z M22 29L29 34M42 29L35 34", // Owl
  "M13 38Q19 22 32 24Q45 22 51 38L45 49L19 49Z M19 38L10 43M45 38L54 43", // Frog
  "M15 33Q17 14 32 15Q47 14 49 33L43 38L21 38Z M22 38L19 53M30 38L29 56M38 38L38 53M46 38L49 53", // Jellyfish
  "M22 15H42V22H50V46H42V53H22V46H14V22H22Z M26 10H38V15M21 34H43M28 43H36", // Robot
  "M22 43A10 10 0 1 1 21 43M44 43A10 10 0 1 1 43 43M22 43L33 23L44 43H22L38 27H48", // Bicycle
  "M32 8Q50 8 50 28Q49 39 36 46L34 53H30L28 46Q15 39 14 28Q14 8 32 8Z M29 46H35", // Balloon
  "M32 10Q48 23 43 40Q38 51 32 55Q26 51 21 40Q16 23 32 10Z M32 20V48", // Seed
  "M12 42Q13 27 25 20Q40 12 51 26L52 44L40 52L23 52Z M21 45Q29 25 43 29", // Shell
  "M12 30L32 12L52 30V53H12Z M19 29H45V52H19Z M28 39H36V52", // Cottage
  "M20 15L27 11H37L44 15L49 27V52H39L36 45H28L25 52H15V27Z", // Giant
] as const;

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
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="30" fill={shadow} />
      <ellipse cx="32" cy="50" rx="21" ry="4" fill="#071014" opacity=".25" />
      <circle cx="32" cy="32" r="26" fill="none" stroke={glow} strokeOpacity="0.36" />
      <path d={FORM_SILHOUETTES[form]} fill={fill} stroke={glow} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={signature} fill={glow} opacity=".55" />
      <path d="M16 49 Q32 57 48 49" fill="none" stroke={glow} strokeOpacity=".5" strokeWidth="2" />
      <circle cx={12 + (habitat % 13)} cy={12 + (force % 8)} r={1.5 + (trait % 3)} fill={glow} />
      <circle cx={44 + (trait % 8)} cy={13 + (habitat % 11)} r={1.5 + (force % 2)} fill={glow} />
      <path d={"M" + (20 + trait % 22) + " 11 l2 -4 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2Z"} fill={glow} opacity=".55" />
    </svg>
  );
}
