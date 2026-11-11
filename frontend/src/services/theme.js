import { useState } from 'react';

/**
 * Appearance: 'auto' follows the device, 'light' and 'dark' are the person's own choice.
 * The choice is written on <html data-theme>; the colours for each theme live in tailwind.config.js.
 */
const KEY = 'celiac-square-theme';
const BAR = { light: '#F4F3EF', dark: '#0A0A09' };

export const getThemeChoice = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable
  }
  return 'auto';
};

export const applyTheme = (choice) => {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.dataset.theme = choice;
  else delete root.dataset.theme;
  // The browser's own bars (address bar, status bar) take the page ground of the theme in use
  const set = (scheme, value) => document.head.querySelector(`meta[name="theme-color"][media*="${scheme}"]`)?.setAttribute('content', value);
  set('light', choice === 'dark' ? BAR.dark : BAR.light);
  set('dark', choice === 'light' ? BAR.light : BAR.dark);
};

export const setThemeChoice = (choice) => {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // storage unavailable
  }
  applyTheme(choice);
};

/** [choice, choose] for the appearance switch */
export function useTheme() {
  const [choice, setChoice] = useState(getThemeChoice);
  const choose = (next) => {
    setChoice(next);
    setThemeChoice(next);
  };
  return [choice, choose];
}
