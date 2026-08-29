/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#e0eaff',
          200: '#c7d8ff',
          300: '#a3bdfe',
          400: '#7a9bfb',
          500: '#5678f5',
          600: '#3a56e8',
          700: '#2e42cc',
          800: '#2938a3',
          900: '#273481',
          950: '#1a2050',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 8px 0 rgb(30 41 59 / 0.06), 0 1px 2px 0 rgb(30 41 59 / 0.04)',
        card: '0 4px 16px -2px rgb(30 41 59 / 0.08), 0 2px 6px -2px rgb(30 41 59 / 0.05)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
