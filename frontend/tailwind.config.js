/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Paleta oficial Titi (design.md §2 — sin aliases legacy) ----
        titi: {
          yellow: '#FFD93D',
          'yellow-hover': '#FFC107',
          'yellow-light': '#FFF3B0',
          'yellow-dark': '#E6B800',
          cream: '#FFFBF0',
          dark: '#1A1A2E',
          'dark-mid': '#16213E',
          'dark-deep': '#0F3460',
          streak: '#FF6B35',
          achievement: '#A855F7',
          certificate: '#F59E0B',
        },
      },
      fontFamily: {
        sans: [
          'Nunito',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
