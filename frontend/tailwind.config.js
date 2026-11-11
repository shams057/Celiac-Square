import plugin from 'tailwindcss/plugin.js';

// One source for both themes. Colours are "R G B" so Tailwind can add opacity: rgb(var(--c-ink) / 0.5).
const light = {
  'color-scheme': 'light',
  '--c-ground': '244 243 239',
  '--c-raised': '250 250 248',
  '--c-paper': '255 255 255',
  '--c-sunk': '233 232 227',
  '--c-line': '227 226 220',
  '--c-edge': '210 209 202',
  '--c-ink': '29 29 27',
  '--c-ink-soft': '85 85 79',
  '--c-ink-faint': '101 101 95',
  '--c-placeholder': '118 118 112',
  '--c-primary-dark': '79 107 28',
  '--c-primary-tint': '228 235 211',
  '--c-accent-dark': '134 59 13',
  '--c-accent-tint': '255 227 209',
  '--c-unsafe-ink': '146 40 37',
  '--c-secondary': '117 100 82',
  '--c-secondary-dark': '88 74 59',
  // Glass
  '--glass-fill': 'linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.22))',
  '--glass-filter': 'blur(12px) saturate(210%) brightness(1.04)',
  '--glass-spec': 'rgba(255, 255, 255, 0.95)',
  '--glass-low': 'rgba(0, 0, 0, 0.05)',
  '--glass-shadow': '0 10px 30px -8px rgba(0, 0, 0, 0.2), 0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08)',
  '--glass-rim': 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.2) 38%, rgba(0, 0, 0, 0.1) 100%)',
  '--glass-thick-fill': 'linear-gradient(180deg, rgba(255, 255, 255, 0.93), rgba(250, 250, 248, 0.88))',
  '--glass-thick-shadow': '0 28px 70px -16px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.08)',
  '--glass-solid': 'rgba(250, 250, 248, 0.97)',
  '--lens': 'rgba(0, 0, 0, 0.075)',
  '--hairline': 'rgba(0, 0, 0, 0.04)',
  '--chip-line': 'rgba(0, 0, 0, 0.07)',
  '--wash-sage': 'rgba(139, 168, 80, 0.14)',
  '--wash-orange': 'rgba(255, 138, 65, 0.08)',
  '--map-tiles': 'none',
};

const dark = {
  'color-scheme': 'dark',
  '--c-ground': '10 10 9',
  '--c-raised': '22 22 21',
  '--c-paper': '28 28 26',
  '--c-sunk': '46 46 43',
  '--c-line': '50 50 47',
  '--c-edge': '72 72 68',
  '--c-ink': '245 245 242',
  '--c-ink-soft': '188 188 181',
  '--c-ink-faint': '158 158 151',
  '--c-placeholder': '138 138 132',
  '--c-primary-dark': '169 199 107',
  '--c-primary-tint': '42 51 26',
  '--c-accent-dark': '255 168 115',
  '--c-accent-tint': '58 36 22',
  '--c-unsafe-ink': '255 143 138',
  '--c-secondary': '168 147 125',
  '--c-secondary-dark': '196 178 158',
  // Dark glass: a smoked pane, lit along its top edge
  '--glass-fill': 'linear-gradient(180deg, rgba(128, 128, 122, 0.3), rgba(72, 72, 68, 0.3))',
  '--glass-filter': 'blur(14px) saturate(190%)',
  '--glass-spec': 'rgba(255, 255, 255, 0.26)',
  '--glass-low': 'rgba(0, 0, 0, 0.3)',
  '--glass-shadow': '0 12px 32px -8px rgba(0, 0, 0, 0.75), 0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.4)',
  '--glass-rim': 'linear-gradient(135deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.08) 40%, rgba(255, 255, 255, 0.16) 100%)',
  '--glass-thick-fill': 'linear-gradient(180deg, rgba(44, 44, 41, 0.95), rgba(30, 30, 28, 0.93))',
  '--glass-thick-shadow': '0 28px 70px -16px rgba(0, 0, 0, 0.85), 0 0 0 0.5px rgba(255, 255, 255, 0.12)',
  '--glass-solid': 'rgba(30, 30, 28, 0.98)',
  '--lens': 'rgba(255, 255, 255, 0.16)',
  '--hairline': 'rgba(255, 255, 255, 0.07)',
  '--chip-line': 'rgba(255, 255, 255, 0.12)',
  '--wash-sage': 'rgba(139, 168, 80, 0.1)',
  '--wash-orange': 'rgba(255, 138, 65, 0.05)',
  // OpenStreetMap tiles are light: turn them into a dark map, keeping water blue and parks green
  '--map-tiles': 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.7)',
};

// Dark follows the device unless the person chose a theme (data-theme on <html>, see services/theme.js)
const themes = plugin(({ addBase }) =>
  addBase({
    ':root': light,
    '@media (prefers-color-scheme: dark)': { ":root:not([data-theme='light'])": dark },
    ":root[data-theme='dark']": dark,
  })
);

/** @type {import('tailwindcss').Config} */
export default {
  // `dark:` matches the same rule as the theme variables
  darkMode: ['variant', ['@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *) }', '&:is([data-theme="dark"] *)']],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Colours that change between light and dark are CSS variables (see `themes` above);
      // brand and verdict colours are the same in both.
      colors: {
        primary: {
          DEFAULT: '#8BA850', // Sage: the "safe" colour
          dark: 'rgb(var(--c-primary-dark) / <alpha-value>)', // sage for text and the selected tab
          tint: 'rgb(var(--c-primary-tint) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--c-secondary) / <alpha-value>)', // Earthy Brown
          dark: 'rgb(var(--c-secondary-dark) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#FF8A41', // Orange: the tint of the one primary action
          dark: 'rgb(var(--c-accent-dark) / <alpha-value>)', // orange for text
          tint: 'rgb(var(--c-accent-tint) / <alpha-value>)',
        },
        // Text on the sage and orange fills: always dark, whatever the theme
        onbright: '#1D1D1B',
        // Content layer, after iOS grouped lists: a quiet ground with cards on it
        canvas: {
          DEFAULT: 'rgb(var(--c-ground) / <alpha-value>)', // page ground
          raised: 'rgb(var(--c-raised) / <alpha-value>)', // quiet panels
          paper: 'rgb(var(--c-paper) / <alpha-value>)', // cards, inputs, lists
          sunk: 'rgb(var(--c-sunk) / <alpha-value>)', // fills, wells, tracks
          line: 'rgb(var(--c-line) / <alpha-value>)', // separators
          edge: 'rgb(var(--c-edge) / <alpha-value>)', // control outlines
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)', // >= 4.5:1 on every canvas tone, in both themes (WCAG AA)
        },
        status: {
          safe: '#8BA850',
          'safe-ink': 'rgb(var(--c-primary-dark) / <alpha-value>)',
          warning: '#FF8A41',
          'warning-ink': 'rgb(var(--c-accent-dark) / <alpha-value>)',
          unsafe: '#C9423D', // white text on it >= 4.5:1
          'unsafe-ink': 'rgb(var(--c-unsafe-ink) / <alpha-value>)',
        },
      },
      fontFamily: {
        // The system face on Apple devices (San Francisco, SF Arabic); Inter and IBM Plex Sans Arabic elsewhere
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      // Controls are capsules; cards keep a fixed, generous radius and what sits inside steps down from it
      borderRadius: {
        tile: '7px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '22px',
        '3xl': '30px',
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
  plugins: [themes],
};
