/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8BA850', // Sage Olive Green
          dark: '#4E6127', // text-safe olive on sand
          tint: '#C9D3A6',
        },
        secondary: {
          DEFAULT: '#756452', // Earthy Brown
          dark: '#584A3B',
        },
        accent: {
          DEFAULT: '#FF8A41', // Vibrant Orange (CTA, carries ink text)
          dark: '#9A4510', // text-safe orange on sand
          tint: '#F6C29C',
        },
        canvas: {
          DEFAULT: '#DBD5BF', // Soft Sand page background
          raised: '#E6E1CF', // panels
          paper: '#F3F0E6', // inputs and lifted rows
          sunk: '#CFC8AF', // wells, tracks
          line: '#C2B99C', // borders
        },
        ink: {
          DEFAULT: '#2F261D',
          soft: '#584A3B',
          faint: '#7A6A58',
        },
        status: {
          safe: '#8BA850',
          'safe-ink': '#4E6127',
          warning: '#FF8A41',
          'warning-ink': '#9A4510',
          unsafe: '#D9534F',
          'unsafe-ink': '#A3302C',
        },
      },
      fontFamily: {
        sans: ['"Readex Pro"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        tile: '4px',
      },
      keyframes: {
        verdict: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        verdict: 'verdict 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
