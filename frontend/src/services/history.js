/**
 * Scan history, kept on this device only (localStorage): the last scans with their verdict.
 * Nothing is sent to the server; clearing the browser's data clears it.
 */
const KEY = 'celiac-square-scans';
const MAX = 30;
export const HISTORY_EVENT = 'celiac-square-scans';

export const readHistory = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // storage full or unavailable: history is a convenience
  }
  window.dispatchEvent(new Event(HISTORY_EVENT));
};

/**
 * entry: { mode: 'product' | 'ingredients' | 'barcode', label, status, detail?, query? }
 * The same label scanned again moves to the top instead of appearing twice.
 */
export const addToHistory = (entry) => {
  if (!entry?.label) return;
  const item = { ...entry, at: new Date().toISOString() };
  write([item, ...readHistory().filter((e) => !(e.label === entry.label && e.mode === entry.mode))]);
};

export const clearHistory = () => write([]);
