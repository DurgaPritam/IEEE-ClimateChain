// VERDANT-X — Tailwind config. Import tokens.css globally (app/globals.css); colors resolve per theme.
// Dark is default; toggle light with <html data-theme="light">.
const v = (name) => `var(--vx-${name})`;

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), "surface-2": v("surface-2"),
        line: v("line"), "line-soft": v("line-soft"),
        ink: { DEFAULT: v("text"), 2: v("text-2"), 3: v("text-3") },
        accent: { DEFAULT: v("accent"), ink: v("accent-ink") },
        "on-status": v("on-status"),
        pass: { DEFAULT: v("pass"), bg: v("pass-bg") },
        warn: { DEFAULT: v("warn"), bg: v("warn-bg") },
        block: { DEFAULT: v("block"), bg: v("block-bg") },
        signed: { DEFAULT: v("signed"), bg: v("signed-bg") },
        anchored: { DEFAULT: v("anchored"), bg: v("anchored-bg") },
        verified: { DEFAULT: v("verified"), bg: v("verified-bg") },
      },
      fontFamily: { sans: [v("font-sans")], mono: [v("font-mono")] },
      fontSize: {
        "display-xl": [v("fs-display-xl"), { lineHeight: "0.92", letterSpacing: "-0.035em", fontWeight: "300" }],
        display: [v("fs-display"), { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "300" }],
        h1: ["30px", { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "500" }],
        h2: ["21px", { lineHeight: "1.25", fontWeight: "500" }],
        h3: ["16px", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["15px", { lineHeight: "1.5" }],
        small: ["13px", { lineHeight: "1.45" }],
        label: ["11px", { lineHeight: "1.2", letterSpacing: "0.09em", fontWeight: "500" }],
        mono: ["13px", { lineHeight: "1.4" }],
      },
      borderRadius: { sm: "4px", DEFAULT: "8px", lg: "12px" },
      boxShadow: { card: v("shadow") },
    },
  },
};
