import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const hslVar = (name: string) => `hsl(var(--${name}))`;

const colorScale = (name: string) => ({
  DEFAULT: hslVar(`${name}-500`),
  foreground: hslVar(`${name}-foreground`),
  ...Object.fromEntries(steps.map((step) => [step, hslVar(`${name}-${step}`)])),
});

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        geist: ["var(--font-geist)", "Inter", "system-ui", "sans-serif"],
        jakarta: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["var(--font-display)", { lineHeight: "1.05" }],
        h1: ["var(--font-h1)", { lineHeight: "1.1" }],
        h2: ["var(--font-h2)", { lineHeight: "1.15" }],
        h3: ["var(--font-h3)", { lineHeight: "1.2" }],
        body: ["var(--font-body)", { lineHeight: "1.65" }],
        small: ["var(--font-small)", { lineHeight: "1.5" }],
        tiny: ["var(--font-tiny)", { lineHeight: "1.45" }],
      },
      colors: {
        border: hslVar("border"),
        input: hslVar("input"),
        ring: hslVar("ring"),
        background: hslVar("background"),
        foreground: hslVar("foreground"),
        primary: colorScale("primary"),
        secondary: colorScale("secondary"),
        accent: colorScale("accent"),
        success: colorScale("success"),
        warning: colorScale("warning"),
        destructive: colorScale("destructive"),
        danger: colorScale("destructive"),
        info: colorScale("info"),
        muted: {
          DEFAULT: hslVar("muted"),
          foreground: hslVar("muted-foreground"),
        },
        popover: {
          DEFAULT: hslVar("popover"),
          foreground: hslVar("popover-foreground"),
        },
        card: {
          DEFAULT: hslVar("card"),
          foreground: hslVar("card-foreground"),
        },
        "bg-canvas": hslVar("bg-canvas"),
        "bg-surface": hslVar("bg-surface"),
        "bg-elevated": hslVar("bg-elevated"),
        "bg-main": hslVar("bg-canvas"),
        "bg-accent": hslVar("bg-accent"),
        "text-primary": hslVar("text-primary"),
        "text-muted": hslVar("text-muted"),
        "text-main": hslVar("text-primary"),
        "text-sub": hslVar("text-muted"),
        "text-dim": hslVar("text-dim"),
        "border-subtle": hslVar("border-subtle"),
        "border-strong": hslVar("border-strong"),
        "mp-bg": hslVar("mp-bg"),
        "mp-surface": hslVar("mp-surface"),
        "mp-primary": hslVar("primary-500"),
        "mp-accent": hslVar("accent-500"),
        "mp-success": hslVar("success-500"),
        "mp-text": hslVar("mp-text"),
        "mp-text-secondary": hslVar("mp-text-secondary"),
        "tech-blue": colorScale("primary"),
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        12: "var(--space-12)",
        16: "var(--space-16)",
        24: "var(--space-24)",
        32: "var(--space-32)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "border-gradient":
          "linear-gradient(90deg, hsl(var(--primary-500) / 0.2), hsl(var(--accent-500) / 0.2))",
        noise:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='m0 0h1v1h-1zm2 2h1v1h-1z'/%3E%3C/svg%3E\")",
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
        card: "var(--radius-xl)",
        btn: "var(--radius-md)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        "primary-glow": "var(--shadow-primary-glow)",
      },
      zIndex: {
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        header: "var(--z-header)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        popover: "var(--z-popover)",
        toast: "var(--z-toast)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      transitionDuration: {
        150: "var(--duration-150)",
        200: "var(--duration-200)",
        300: "var(--duration-300)",
        500: "var(--duration-500)",
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
        "slide-in": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary-500) / 0.4)" },
          "50%": { boxShadow: "0 0 40px hsl(var(--primary-500) / 0.7)" },
        },
        "pulse-glow-slow": {
          "0%, 100%": { boxShadow: "0 0 30px hsl(var(--primary-500) / 0.3)" },
          "50%": { boxShadow: "0 0 50px hsl(var(--primary-500) / 0.5)" },
        },
        "float-orb": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(10px, -15px) scale(1.05)" },
          "50%": { transform: "translate(-5px, -25px) scale(1)" },
          "75%": { transform: "translate(-15px, -10px) scale(0.95)" },
        },
        "hover-lift": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-4px)" },
        },
        "draw-line": {
          from: { strokeDashoffset: "1000" },
          to: { strokeDashoffset: "0" },
        },
        "gradient-shift": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in": "slide-in 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in": "fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        shimmer: "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "pulse-glow-slow": "pulse-glow-slow 4s ease-in-out infinite",
        "float-orb": "float-orb 8s ease-in-out infinite",
        "hover-lift": "hover-lift 0.2s ease-out forwards",
        "draw-line": "draw-line 2s ease-out forwards",
        "gradient-shift": "gradient-shift 3s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
};

export default config;
