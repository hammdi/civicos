/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Civic trust palette
        navy: {
          DEFAULT: "#1B4F72",
          50: "#EAF1F6",
          100: "#D5E3ED",
          600: "#1B4F72",
          700: "#163F5B",
          800: "#102F44",
        },
        civic: {
          green: "#27AE60",
          greenDark: "#1E8449",
        },
        // Per-module accent colors
        queue: "#2563EB", // blue
        documents: "#EA8A0B", // orange
        market: "#27AE60", // green
        reports: "#E74C3C", // red
      },
      fontFamily: {
        sans: ["Inter", "Cairo", "system-ui", "Segoe UI", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};
