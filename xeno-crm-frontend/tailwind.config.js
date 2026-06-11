/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "rgb(var(--color-brand-50) / <alpha-value>)",
          100: "rgb(var(--color-brand-100) / <alpha-value>)", 
          200: "rgb(var(--color-brand-200) / <alpha-value>)",
          300: "rgb(var(--color-brand-300) / <alpha-value>)",
          400: "rgb(var(--color-brand-400) / <alpha-value>)",
          500: "rgb(var(--color-brand-500) / <alpha-value>)",
          600: "rgb(var(--color-brand-600) / <alpha-value>)",
          700: "rgb(var(--color-brand-700) / <alpha-value>)",
          800: "rgb(var(--color-brand-800) / <alpha-value>)",
          900: "rgb(var(--color-brand-900) / <alpha-value>)",
        },
        surface: {
          base:    "rgb(var(--color-surface-base) / <alpha-value>)",
          raised:  "rgb(var(--color-surface-raised) / <alpha-value>)",
          overlay: "rgb(var(--color-surface-overlay) / <alpha-value>)",
          border:  "rgb(var(--color-surface-border) / <alpha-value>)",
          hover:   "rgb(var(--color-surface-hover) / <alpha-value>)",
        },
        text: {
          primary:   "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          muted:     "rgb(var(--color-text-muted) / <alpha-value>)",
          accent:    "rgb(var(--color-text-accent) / <alpha-value>)",
        },
        status: {
          success: "#10B981",
          warning: "#F59E0B", 
          danger:  "#EF4444",
          info:    "#6C47FF",
          neutral: "#4A4A6A",
        }
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, rgb(var(--color-brand-500)) 0%, rgb(var(--color-brand-300)) 100%)',
        'gradient-card':  'linear-gradient(145deg, rgb(var(--color-surface-raised)) 0%, rgb(var(--color-surface-overlay)) 100%)',
        'gradient-glow':  'var(--bg-glow)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      }
    },
  },
  plugins: [],
}
