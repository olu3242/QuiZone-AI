import type { Config } from "tailwindcss";
import tokens from "./brand/brand-tokens.json";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: tokens.brand.primary,
          "blue-dark": tokens.brand.primaryDark,
          navy: tokens.brand.navy,
          sky: tokens.brand.sky,
          violet: tokens.brand.violet,
          coral: tokens.brand.coral,
          orange: tokens.brand.orange,
          yellow: tokens.brand.yellow,
          green: tokens.brand.green,
        },
        ink: tokens.brand.ink,
        muted: tokens.brand.muted,
        surface: tokens.brand.surface,
        "surface-soft": tokens.brand.surfaceSoft,
        border: tokens.brand.border,
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm2: tokens.radius.sm,
        md2: tokens.radius.md,
        lg2: tokens.radius.lg,
        xl2: tokens.radius.xl,
      },
      boxShadow: {
        card: tokens.shadow.card,
        lifted: tokens.shadow.lifted,
      },
      maxWidth: {
        prose2: "38rem",
      },
    },
  },
  plugins: [],
};

export default config;
