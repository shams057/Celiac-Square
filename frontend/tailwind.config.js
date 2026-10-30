/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8BA850', // Sage Olive Green
          dark: '#6e873b',
          light: '#a6c16f',
        },
        secondary: {
          DEFAULT: '#756452', // Earthy Brown
          dark: '#584a3b',
          light: '#8f7d69',
        },
        accent: {
          DEFAULT: '#FF8A41', // Vibrant Orange
          dark: '#e66f24',
          light: '#ffa569',
        },
        canvas: {
          DEFAULT: '#DBD5BF', // Soft Sand/Beige
          light: '#f5f2e8',
          card: '#FAF8F2',
          border: '#C8C0A6',
        },
        status: {
          safe: '#8BA850',
          warning: '#FF8A41',
          unsafe: '#D9534F',
          risk: '#E06D2D',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'Cairo', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
