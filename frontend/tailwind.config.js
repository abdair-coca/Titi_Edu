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
          // Acentos por categoría de curso (design.md §2 "Acento de categoría"):
          // sólido para íconos/nodos, `-light` para portadas sin imagen.
          'cat-code': '#1CB0F6',
          'cat-code-light': '#DDF4FF',
          'cat-data': '#A855F7',
          'cat-data-light': '#F3E8FF',
          'cat-math': '#FF6B35',
          'cat-math-light': '#FFEDD5',
          'cat-lang': '#58CC02',
          'cat-lang-light': '#E5F8D4',
          'cat-science': '#00B8A9',
          'cat-science-light': '#D5F5F2',
          'cat-design': '#FF4B91',
          'cat-design-light': '#FFE4EF',
          'cat-business': '#F59E0B',
          'cat-business-light': '#FEF3C7',
          'cat-music': '#6C5CE7',
          'cat-music-light': '#E9E6FD',
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
