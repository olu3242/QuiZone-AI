import { readFileSync, writeFileSync } from "node:fs";
const { brand } = JSON.parse(
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
writeFileSync(
  new URL("../brand/theme.css", import.meta.url),
  "/* Generated from brand-tokens.json. */\n:root {\n" +
    Object.entries(names)
      .map(([name, key]) => `  --${name}: ${brand[key]};`)
      .join("\n") +
    "\n}\n",
);
