/**
 * "Open now" from the free-text opening hours of a spot, as written in the back office:
 *
 *   "Lun–jeu 12 h–22 h · ven–sam 12 h–23 h · dim 17 h–22 h"
 *   "Tous les jours 8 h 30–20 h"
 *   "Mar–dim 10 h–19 h · fermé le lundi"
 *   "Lun-Ven: 08:30 - 16:30, Sam: 08:30 - 12:30"
 *
 * parseHours() returns null for anything it does not fully understand: the map then shows the text
 * alone, never a guessed "open". Days that are not mentioned are closed. Times are Tunisia's.
 */

// Monday = 0 … Sunday = 6
const DAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const DAY_WORD = '(lun(?:di)?|mar(?:di)?|mer(?:credi)?|jeu(?:di)?|ven(?:dredi)?|sam(?:edi)?|dim(?:anche)?)\\.?';
const DAY_RANGE_RE = new RegExp(`^${DAY_WORD}\\s*(?:[-–—]|a|au)\\s*${DAY_WORD}`);
const DAY_LIST_RE = new RegExp(`^${DAY_WORD}(?:\\s*(?:,|et|&)\\s*${DAY_WORD})*`);
const EVERY_DAY_RE = /^(?:tous les jours|tlj|7\s*j\s*\/\s*7|7j\/7)/;
const TIME = '(\\d{1,2})\\s*(?:h|:)\\s*(\\d{2})?';
const RANGE_RE = new RegExp(`${TIME}\\s*(?:[-–—]|a)\\s*${TIME}`, 'g');

const fold = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const dayIndex = (word) => DAYS.indexOf(word.slice(0, 3));

const daysBetween = (a, b) => {
  const out = [];
  for (let d = a; ; d = (d + 1) % 7) {
    out.push(d);
    if (d === b || out.length > 7) break;
  }
  return out;
};

/** Days a segment applies to and the rest of the text, or null */
const readDays = (segment) => {
  const every = EVERY_DAY_RE.exec(segment);
  if (every) return { days: [0, 1, 2, 3, 4, 5, 6], rest: segment.slice(every[0].length) };
  const range = DAY_RANGE_RE.exec(segment);
  if (range) return { days: daysBetween(dayIndex(range[1]), dayIndex(range[2])), rest: segment.slice(range[0].length) };
  const list = DAY_LIST_RE.exec(segment);
  if (list) {
    const days = [...list[0].matchAll(new RegExp(DAY_WORD, 'g'))].map((m) => dayIndex(m[1]));
    return { days, rest: segment.slice(list[0].length) };
  }
  return null;
};

/**
 * Weekly schedule: an array of 7 days (Monday first), each a list of [openMinute, closeMinute].
 * A close past midnight is > 1440. Returns null when the text cannot be read with certainty.
 */
export const parseHours = (text) => {
  const clean = fold(text).replace(/\([^)]*\)/g, ' ').trim();
  if (!clean) return null;
  const week = Array.from({ length: 7 }, () => []);
  // Segments: "·", ";", a new line, or a comma followed by a day name
  const segments = clean.split(/\s*[·;\n|]\s*|,\s*(?=[a-z])/).map((s) => s.trim()).filter(Boolean);
  let understood = 0;
  for (const segment of segments) {
    if (/^ferme/.test(segment)) continue; // "fermé le lundi": days not listed are closed anyway
    const parsed = readDays(segment);
    if (!parsed) return null;
    const ranges = [...parsed.rest.matchAll(RANGE_RE)].map((m) => {
      const open = Number(m[1]) * 60 + Number(m[2] || 0);
      let close = Number(m[3]) * 60 + Number(m[4] || 0);
      if (close <= open) close += 24 * 60; // e.g. 18 h–2 h
      return [open, close];
    });
    if (!ranges.length || ranges.some(([o, c]) => o >= 24 * 60 || c > 48 * 60)) return null;
    // Leftover text other than separators means a format we do not handle
    if (parsed.rest.replace(RANGE_RE, '').replace(/[\s:,et&-]/g, '')) return null;
    parsed.days.forEach((d) => week[d].push(...ranges));
    understood += 1;
  }
  return understood ? week : null;
};

/** Day of week (Monday = 0) and minutes since midnight, in Tunisia */
export const tunisNow = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

/**
 * { open: true, closesAt } or { open: false, opensAt: { day, minutes } | null }, or null when the
 * hours could not be read. closesAt / opensAt.minutes are minutes since midnight.
 */
export const openState = (text, date = new Date()) => {
  const week = parseHours(text);
  if (!week) return null;
  const { day, minutes } = tunisNow(date);
  // Today's ranges, and yesterday's that run past midnight
  const yesterday = (day + 6) % 7;
  for (const [o, c] of week[day]) if (minutes >= o && minutes < c) return { open: true, closesAt: c % (24 * 60) };
  for (const [, c] of week[yesterday]) if (c > 24 * 60 && minutes < c - 24 * 60) return { open: true, closesAt: c - 24 * 60 };
  // Next opening: later today, then the following days
  const later = week[day].filter(([o]) => o > minutes).sort((a, b) => a[0] - b[0])[0];
  if (later) return { open: false, opensAt: { day, minutes: later[0], today: true } };
  for (let i = 1; i <= 7; i += 1) {
    const d = (day + i) % 7;
    const first = [...week[d]].sort((a, b) => a[0] - b[0])[0];
    if (first) return { open: false, opensAt: { day: d, minutes: first[0], today: false, tomorrow: i === 1 } };
  }
  return { open: false, opensAt: null };
};

/** "22 h", "8 h 30" */
export const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};

export const DAY_NAMES = {
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  ar: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
};

/** Distance in km between two [lat, lng] points (haversine) */
export const distanceKm = ([lat1, lng1], [lat2, lng2]) => {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};
