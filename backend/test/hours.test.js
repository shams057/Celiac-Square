// The opening-hours parser lives in the frontend (frontend/src/services/hours.js): plain JS, tested here
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHours, openState, distanceKm } from '../../frontend/src/services/hours.js';

// 2026-11-09 is a Monday. Tunisia is UTC+1 all year.
const at = (isoLocal) => new Date(`${isoLocal}+01:00`);

test('parses the formats used on the map', () => {
  const tiktak = parseHours('Lun–jeu 12 h–22 h · ven–sam 12 h–23 h · dim 17 h–22 h');
  assert.deepEqual(tiktak[0], [[720, 1320]]);
  assert.deepEqual(tiktak[4], [[720, 1380]]);
  assert.deepEqual(tiktak[6], [[1020, 1320]]);

  const daily = parseHours('Tous les jours 8 h 30–20 h');
  assert.ok(daily.every((d) => d.length === 1 && d[0][0] === 510 && d[0][1] === 1200));

  const closedMonday = parseHours('Mar–dim 10 h–19 h · fermé le lundi');
  assert.deepEqual(closedMonday[0], []);
  assert.deepEqual(closedMonday[1], [[600, 1140]]);

  const doctor = parseHours('Lun-Ven: 08:30 - 16:30, Sam: 08:30 - 12:30');
  assert.deepEqual(doctor[4], [[510, 990]]);
  assert.deepEqual(doctor[5], [[510, 750]]);
  assert.deepEqual(doctor[6], []);

  // Parenthesised remarks are ignored (the range stays conservative)
  assert.ok(parseHours('Tous les jours 8 h 30–22 h (lundi dès 8 h)'));
  // Split shifts
  assert.deepEqual(parseHours('Lun–sam 8 h–12 h, 14 h–18 h')[2], [[480, 720], [840, 1080]]);
});

test('anything unclear gives null, never a guess', () => {
  assert.equal(parseHours(''), null);
  assert.equal(parseHours('Sur rendez-vous'), null);
  assert.equal(parseHours('Lun–ven le matin'), null);
  assert.equal(parseHours('Lun–ven 9 h–18 h sauf jours fériés'), null);
});

test('open now, closing time and next opening (Tunisia time)', () => {
  const hours = 'Lun–jeu 12 h–22 h · ven–sam 12 h–23 h · dim 17 h–22 h';
  assert.deepEqual(openState(hours, at('2026-11-09T13:00:00')), { open: true, closesAt: 1320 });
  const morning = openState(hours, at('2026-11-09T09:00:00'));
  assert.equal(morning.open, false);
  assert.equal(morning.opensAt.minutes, 720);
  assert.equal(morning.opensAt.today, true);

  const monday = openState('Mar–dim 10 h–19 h · fermé le lundi', at('2026-11-09T12:00:00'));
  assert.equal(monday.open, false);
  assert.equal(monday.opensAt.day, 1);
  assert.equal(monday.opensAt.tomorrow, true);

  // Past midnight: open until 2 h on the next day
  assert.deepEqual(openState('Tous les jours 18 h–2 h', at('2026-11-10T01:00:00')), { open: true, closesAt: 120 });
  assert.equal(openState('Sur rendez-vous'), null);
});

test('distance between two points', () => {
  // La Marsa to El Menzah: about 15 km
  const d = distanceKm([36.879, 10.326], [36.8455, 10.1647]);
  assert.ok(d > 13 && d < 17, String(d));
});
