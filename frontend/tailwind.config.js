/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neo: {
          bg: '#0a0a0a',
          card: '#1a1a1a',
          accent: '#fe2c55',
          accentHover: '#ff4d70',
          muted: '#9ca3af',
          border: '#27272a',
        },
      },
      fontFamily: {
        sans: [
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
      boxShadow: {
        neo: '0 8px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
