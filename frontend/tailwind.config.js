/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bafd',
          400: '#8194fb',
          500: '#6270f5',
          600: '#4f4fe8',
          700: '#413ecc',
          800: '#3534a4',
          900: '#2f3082',
        },
        surface: {
          0: '#ffffff',
          1: '#f8f9fc',
          2: '#f0f2f8',
          3: '#e4e7f0',
        },
      },
    },
  },
  plugins: [],
}
