import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        "bg-primary": "#FAFBFC",
        "bg-secondary": "#FFFFFF", 
        "bg-tertiary": "#F5F6F8",
        "text-light": "#1A1D21",
        "text-muted": "#6B7280", 
        "accent-blue": "#60A5FA", // Changed from blue-600 to blue-400
        "accent-blue-dark": "#3B82F6", // Changed from custom dark to blue-500
        "accent-blue-light": "#93C5FD", // Changed from blue-400 to blue-300
        "accent-blue-lighter": "#DBEAFE", // Changed from blue-50 to blue-100
        "accent-orange": "#F59E0B",
        "status-green": "#059669",
        "status-red": "#DC2626",
        "link-blue": "#60A5FA", // Changed from blue-500 to blue-400
        border: "#E5E7EB",
        shadow: "rgba(0, 0, 0, 0.1)",
        "shadow-lg": "rgba(0, 0, 0, 0.15)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
export default config;
