/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8BA850', // Sage Olive Green
          dark: '#45561E', // text-safe olive on sand
          tint: '#C9D3A6',
        },
        secondary: {
          DEFAULT: '#756452', // Earthy Brown
          dark: '#584A3B',
        },
        accent: {
          DEFAULT: '#FF8A41', // Vibrant Orange (CTA, carries ink text)
          dark: '#863B0D', // text-safe orange on sand
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
          faint: '#63543F', // ≥ 4.5:1 on every canvas tone (WCAG AA)
        },
        status: {
          safe: '#8BA850',
          'safe-ink': '#45561E',
          warning: '#FF8A41',
          'warning-ink': '#863B0D',
          unsafe: '#C9423D', // white text on it ≥ 4.5:1
          'unsafe-ink': '#922825',
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
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        // Dialogs and filter sheets: rise from the bottom on phones, settle in place on larger screens
        'sheet-up': { '0%': { opacity: '0', transform: 'translateY(32px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pop-in': { '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        // Page changes: the new page slides in from the side of the tab that was tapped.
        // "backwards" drops the transform when done, so fixed dialogs inside the page stay fixed to the screen
        'page-from-end': { '0%': { opacity: '0', transform: 'translateX(var(--page-shift))' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'page-from-start': { '0%': { opacity: '0', transform: 'translateX(calc(var(--page-shift) * -1))' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'grow-x': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
        indeterminate: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
      },
      animation: {
        verdict: 'verdict 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'fade-in': 'fade-in 200ms ease-out both',
        'sheet-up': 'sheet-up 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'pop-in': 'pop-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'page-from-end': 'page-from-end 300ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        'page-from-start': 'page-from-start 300ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        'grow-x': 'grow-x 600ms cubic-bezier(0.2, 0.8, 0.2, 1) 200ms both',
        indeterminate: 'indeterminate 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
