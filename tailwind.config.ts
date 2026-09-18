import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48", // Crimson-coral accent
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)",
        pop: "0 10px 24px -4px rgba(0, 0, 0, 0.06), 0 4px 8px -4px rgba(0, 0, 0, 0.03)",
      },
      keyframes: {
        pulseSoft: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } },
      },
      animation: { pulseSoft: "pulseSoft 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
