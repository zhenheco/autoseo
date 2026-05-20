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
      fontFamily: {
        geist: ["var(--font-geist)", "Inter", "system-ui", "sans-serif"],
        jakarta: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
      },
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
        // Modern Professional Color Palette
        "mp-bg": "#020617", // 極深藍黑
        "mp-surface": "#0F172A", // 深石板藍
        "mp-primary": "#3B82F6", // 科技亮藍
        "mp-accent": "#8B5CF6", // 創意紫羅蘭
        "mp-success": "#10B981", // 成長綠
        "mp-text": "#F8FAFC", // 接近純白
        "mp-text-secondary": "#94A3B8", // 灰色
        "tech-blue": {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "border-gradient":
          "linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))",
        noise:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='m0 0h1v1h-1zm2 2h1v1h-1z'/%3E%3C/svg%3E\")",
      },
      backdropBlur: {
        xs: "2px",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)" },
          "50%": { boxShadow: "0 0 40px rgba(59, 130, 246, 0.7)" },
        },
        "pulse-glow-slow": {
          "0%, 100%": { boxShadow: "0 0 30px rgba(59, 130, 246, 0.3)" },
          "50%": { boxShadow: "0 0 50px rgba(59, 130, 246, 0.5)" },
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
