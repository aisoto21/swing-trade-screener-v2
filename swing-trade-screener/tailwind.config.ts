import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--background-base)",
        "bg-surface": "var(--background-surface)",
        "bg-elevated": "var(--background-elevated)",
        "bg-subtle": "var(--background-subtle)",
        "border-default": "var(--border-default)",
        "border-emphasis": "var(--border-emphasis)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "signal-long": "var(--signal-long)",
        "signal-long-muted": "var(--signal-long-muted)",
        "signal-short": "var(--signal-short)",
        "signal-short-muted": "var(--signal-short-muted)",
        "signal-neutral": "var(--signal-neutral)",
        "signal-neutral-muted": "var(--signal-neutral-muted)",
        "grade-aplus": "var(--grade-aplus)",
        "grade-a": "var(--grade-a)",
        "grade-b": "var(--grade-b)",
        "grade-c": "var(--grade-c)",
        "volume-institutional": "var(--volume-institutional)",
        "volume-climactic": "var(--volume-climactic)",
        "volume-weak": "var(--volume-weak)",
        "regime-bull": "var(--regime-bull)",
        "regime-bear": "var(--regime-bear)",
        "regime-choppy": "var(--regime-choppy)",
        "regime-distribution": "var(--regime-distribution)",
        "regime-accumulation": "var(--regime-accumulation)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        mono: ["var(--font-dm-mono)", "monospace"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
