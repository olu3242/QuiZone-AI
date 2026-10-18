import { readFileSync, writeFileSync } from "node:fs";
const { brand, radius, shadow } = JSON.parse(
  readFileSync(new URL("../brand/brand-tokens.json", import.meta.url), "utf8"),
);
const names = {
  blue: "primary",
  navy: "navy",
  ink: "ink",
  muted: "muted",
  yellow: "yellow",
  violet: "violet",
  border: "border",
  soft: "surfaceSoft",
};
const colors = {
  "brand-blue": "primary",
  "brand-blue-dark": "primaryDark",
  "brand-navy": "navy",
  "brand-sky": "sky",
  "brand-violet": "violet",
  "brand-coral": "coral",
  "brand-orange": "orange",
  "brand-yellow": "yellow",
  "brand-green": "green",
  ink: "ink",
  muted: "muted",
  surface: "surface",
  "surface-soft": "surfaceSoft",
  border: "border",
};
const declarations = [
  ...Object.entries(colors).map(
    ([name, key]) => `  --color-${name}: ${brand[key]};`,
  ),
  ...Object.entries(radius).map(
    ([name, value]) => `  --radius-${name}2: ${value};`,
  ),
  ...Object.entries(shadow).map(
    ([name, value]) => `  --shadow-${name}: ${value};`,
  ),
  "  --font-display: Poppins, system-ui, sans-serif;",
  "  --font-sans: Inter, system-ui, sans-serif;",
  "  --container-prose2: 38rem;",
];
writeFileSync(
  new URL("../brand/theme.css", import.meta.url),
  "/* Generated from brand-tokens.json. */\n@theme {\n" +
    declarations.join("\n") +
    "\n}\n:root {\n" +
    Object.entries(names)
      .map(([name, key]) => `  --${name}: ${brand[key]};`)
      .join("\n") +
    "\n}\n",
);
