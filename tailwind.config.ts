import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)",
        pop: "0 12px 32px -8px rgba(16,24,40,.18)",
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
