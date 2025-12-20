import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

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
      colors: {
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
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        "dark-section": "var(--dark-bg)",
        "dark-section-secondary": "var(--dark-bg-secondary)",
        "light-section": "var(--light-bg)",
        "light-section-secondary": "var(--light-bg-secondary)",
        /* 1waySEO 品牌色系 */
        "brand-blue": {
          50: "#e6f0ff",
          100: "#cce0ff",
          200: "#99c2ff",
          300: "#66a3ff",
          400: "#3377ff",
          500: "#0055ff",
          600: "#0044cc",
          700: "#003399",
          800: "#002266",
          900: "#001133",
          950: "#000819",
        },
        "brand-cyan": {
          400: "#33e5f0",
          500: "#00ddeb",
          600: "#00b3be",
        },
        "brand-orange": {
          400: "#ff7033",
          500: "#ff4d00",
          600: "#cc3d00",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 85, 255, 0.4)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 85, 255, 0.7)" },
        },
        "pulse-glow-slow": {
          "0%, 100%": { boxShadow: "0 0 30px rgba(0, 85, 255, 0.3)" },
          "50%": { boxShadow: "0 0 50px rgba(0, 85, 255, 0.5)" },
        },
        "float-orb": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(10px, -15px) scale(1.05)" },
          "50%": { transform: "translate(-5px, -25px) scale(1)" },
          "75%": { transform: "translate(-15px, -10px) scale(0.95)" },
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
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
};

export default config;
