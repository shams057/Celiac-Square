import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The tab bar's pages sit side by side like the frames of a film roll (as on Instagram).
 *  - Phones: a sideways swipe anywhere on a page drags the roll; on release it springs on to the next page,
 *    or back when the swipe was short. Places with their own sideways gesture keep it (see ownsSwipe).
 *  - Phones: a touch while the roll still moves catches it where it is: a swipe never waits for the last one
 *    to finish. Caught on its way onto a page, the roll lands there at once and the swipe goes on from it.
 *  - Any screen: a tap or click on the tab bar rolls the film there, with a slight motion blur. Over several pages
 *    (Comprendre → Marché) the roll rushes past the pages in between and slows down on the last one.
 * Every animation stays under 0.3 s. The order is left to right in both languages, like the tab bar.
 *
 * Positions are counted in frames from the current page: +1 is the next page (to the right), -1 the one before.
 */

// The bottom tab bar is shown below this width (Tailwind's lg breakpoint, see Navbar.jsx)
const PHONE_QUERY = '(max-width: 1023px)';

// Movement before a touch counts as a swipe; below it, it stays a tap
const SLOP = 10;

// Release: a quick spring, barely past the page (it settles well under 0.3 s)
const SPRING = { stiffness: 520, damping: 0.92 };

// Taps on the tab bar: one page, or a speed ramp over several (fast, then easing into the last page)
const ROLL_ONE = { duration: 230, ease: [0.2, 0.75, 0.25, 1] };
const ROLL_MANY = { duration: 260, ease: [0.3, 0.6, 0.02, 1] };

// Horizontal blur, in px, per px/ms of speed, and its ceiling ("slight")
const BLUR = { perSpeed: 0.7, max: 7 };

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/**
 * One frame's step, in px: on a phone the page is the screen's width; on a wider screen the page is a centred
 * column, so the step is longer, enough for the next page to start just past the window's edge.
 */
const frameStep = (main) => {
  const page = main?.clientWidth || window.innerWidth;
  const screen = document.documentElement.clientWidth || window.innerWidth;
  return Math.max(page, (screen + page) / 2);
};

const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Past the first or last page the roll gives a little, then stops
const rubber = (d) => (d * 0.3) / (1 + d * 2);

/** cubic-bezier(x1, y1, x2, y2) as a function of time (0 to 1) */
const bezier = (x1, y1, x2, y2) => {
  const at = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
};

// Elements that keep sideways swipes for themselves: the forum's lists (they swipe the forum's tabs),
// the map, sliding switches, fields, dialogs, and the floating bars
const OWN_SWIPE = '[data-no-swipe], .forum-pager, .leaflet-container, .slider-track, input, textarea, select, [contenteditable="true"], [role="dialog"], header, nav';

/** True when a sideways swipe on `target` belongs to something on the page, not to the film roll */
export const ownsSwipe = (target) => {
  if (!target?.closest || target.closest(OWN_SWIPE)) return true;
  // Rows that scroll sideways
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
};

/**
 * stripRef: the element that moves (the current page, and the frames beside it while the roll moves).
 * frameRef: the element that clips it (its width is one frame).
 * blurRef: the feGaussianBlur of the #film-blur filter.
 * index: the current page's place in the tab bar, or -1 on pages outside it (no roll there).
 * onCommit(i): the roll landed on page i; the caller navigates there, then calls reset() before paint
 *   (after putting the page at its scroll position).
 * Returns:
 *  - film: the frames to draw beside the current page while the roll moves, or null:
 *    { frames: [{ index, slot, real }], offset, top }. slot: frames from the current page (-1, 1, 2…).
 *    Real frames are the pages themselves; the ones rushed past on a long roll are stand-ins.
 *  - pending: the page the roll is heading to (for the tab bar), or -1
 *  - go(i): rolls to page i, as after a tap; false when it does not apply (reduced motion, same page…)
 *  - reset(): puts the strip back at rest (or, after a catch, sets up the roll around the new page)
 */
export function useFilmSwipe({ stripRef, frameRef, blurRef, index, count, onCommit }) {
  const [film, setFilm] = useState(null);
  const [pending, setPending] = useState(-1);
  const pos = useRef(0); // where the roll is, in frames from the current page
  const run = useRef(null); // { kind: 'swipe' | 'tap', offset, lo, hi, target }
  const touch = useRef(null);
  const frame = useRef(0);
  const carry = useRef(null); // a catch that landed the roll: { x } to set up around the new page
  const live = useRef({ index, count, onCommit });
  live.current = { index, count, onCommit };

  const setBlur = useCallback(
    (px) => {
      const strip = stripRef.current;
      const node = blurRef.current;
      if (!strip || !node) return;
      if (px < 0.3) {
        strip.style.filter = '';
        return;
      }
      node.setAttribute('stdDeviation', `${px.toFixed(2)} 0`);
      strip.style.filter = 'url(#film-blur)';
    },
    [stripRef, blurRef]
  );

  const paint = useCallback(() => {
    const r = run.current;
    const strip = stripRef.current;
    if (!strip || !r) return;
    strip.style.transform = `translate3d(${-pos.current * r.offset}px, 0, 0)`;
  }, [stripRef]);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  /** A swipe's roll around the current page: the pages on either side, as far as they exist */
  const startSwipe = useCallback(
    (x = 0) => {
      const { index: i, count: n } = live.current;
      const offset = frameStep(frameRef.current);
      const frames = [];
      if (i > 0) frames.push({ index: i - 1, slot: -1, real: true });
      if (i < n - 1) frames.push({ index: i + 1, slot: 1, real: true });
      run.current = { kind: 'swipe', offset, lo: i > 0 ? -1 : 0, hi: i < n - 1 ? 1 : 0, target: 0 };
      pos.current = x;
      stripRef.current.dataset.filmMoving = 'true';
      setFilm({ frames, offset, top: Math.max(0, window.scrollY) });
      paint();
    },
    [frameRef, stripRef, paint]
  );

  const reset = useCallback(() => {
    stop();
    setPending(-1);
    // A catch landed the roll under the finger: the swipe goes on around the new page, from where it is
    if (carry.current) {
      const { x } = carry.current;
      carry.current = null;
      startSwipe(x);
      return;
    }
    run.current = null;
    pos.current = 0;
    const strip = stripRef.current;
    if (strip) {
      strip.style.transform = '';
      strip.style.filter = '';
      delete strip.dataset.filmMoving;
    }
  }, [stripRef, startSwipe]);

  /** The roll stopped on a whole frame: a new page (the caller navigates), or back on the current one */
  const land = useCallback(
    (at) => {
      frame.current = 0;
      setBlur(0);
      setFilm(null);
      if (at !== 0) live.current.onCommit(live.current.index + at);
      else reset();
    },
    [reset, setBlur]
  );

  /** After a swipe: springs to `target` (-1, 0 or 1), starting at v0 frames per second */
  const spring = useCallback(
    (target, v0) => {
      run.current.target = target;
      setPending(target !== 0 ? live.current.index + target : -1);
      if (reducedMotion()) {
        pos.current = target;
        paint();
        land(target);
        return;
      }
      const k = SPRING.stiffness;
      const c = 2 * Math.sqrt(k) * SPRING.damping;
      const { lo, hi } = run.current;
      let x = pos.current;
      let v = v0;
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(0.064, (now - last) / 1000);
        last = now;
        const n = Math.max(1, Math.ceil(dt / 0.004));
        const h = dt / n;
        for (let s = 0; s < n; s += 1) {
          v += (-k * (x - target) - c * v) * h;
          x += v * h;
        }
        // Never past the frames that exist: there is nothing beyond them to show
        pos.current = clamp(x, lo - 0.03, hi + 0.03);
        paint();
        if (Math.abs(x - target) < 0.002 && Math.abs(v) < 0.02) {
          pos.current = target;
          paint();
          land(target);
          return;
        }
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [paint, land]
  );

  /** After a tap: a timed roll over `to` frames, with motion blur that follows the speed */
  const roll = useCallback(
    (to) => {
      const r = run.current;
      const { duration, ease } = Math.abs(to) > 1 ? ROLL_MANY : ROLL_ONE;
      const curve = bezier(...ease);
      let start = 0;
      let lastX = 0;
      let lastT = 0;
      const step = (now) => {
        if (!start) {
          start = now;
          lastT = now;
        }
        const t = clamp((now - start) / duration, 0, 1);
        const x = curve(t) * to;
        const speed = now > lastT ? (Math.abs(x - lastX) * r.offset) / (now - lastT) : 0; // px per ms
        lastX = x;
        lastT = now;
        pos.current = x;
        paint();
        setBlur(t < 1 ? Math.min(BLUR.max, speed * BLUR.perSpeed) : 0);
        if (t >= 1) {
          land(to);
          return;
        }
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [paint, land, setBlur]
  );

  /** Rolls to page j, as after a tap on the tab bar. False when the roll does not apply. */
  const go = useCallback(
    (j) => {
      const { index: i, count: n } = live.current;
      if (reducedMotion() || i < 0 || j < 0 || j >= n || j === i || run.current) return false;
      const side = Math.sign(j - i);
      const steps = Math.abs(j - i);
      const offset = frameStep(frameRef.current);
      run.current = { kind: 'tap', offset, lo: Math.min(0, j - i), hi: Math.max(0, j - i), target: j - i };
      pos.current = 0;
      stripRef.current.dataset.filmMoving = 'true';
      setFilm({
        frames: Array.from({ length: steps }, (_, k) => ({ index: i + side * (k + 1), slot: side * (k + 1), real: k === steps - 1 })),
        offset,
        top: Math.max(0, window.scrollY),
      });
      setPending(j);
      // From the next frame, once the pages beside are drawn
      frame.current = requestAnimationFrame(() => roll(j - i));
      return true;
    },
    [frameRef, stripRef, roll]
  );

  useEffect(() => {
    // Lets go of a roll that was caught and not dragged: on to the page it is past half way to, else back
    const release = () => {
      const x = pos.current;
      const { lo, hi } = run.current;
      spring(clamp(Math.abs(x) > 0.5 ? Math.sign(x) : 0, lo, hi), 0);
    };

    // The rest of a touch is followed on the element it started on: if that element leaves the page
    // (a frame the roll was passing over), its touches still arrive there, though not at the window
    let followed = null;
    const follow = (el) => {
      unfollow();
      followed = el;
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd);
      el.addEventListener('touchcancel', onTouchEnd);
    };
    const unfollow = () => {
      if (!followed) return;
      followed.removeEventListener('touchmove', onTouchMove);
      followed.removeEventListener('touchend', onTouchEnd);
      followed.removeEventListener('touchcancel', onTouchEnd);
      followed = null;
    };

    const onTouchStart = (e) => {
      touch.current = null;
      unfollow();
      if (e.touches.length !== 1 || !isPhone() || live.current.index < 0) return;
      if (document.body.style.overflow === 'hidden' || ownsSwipe(e.target)) return;
      const t = e.touches[0];
      const g = { x: t.clientX, y: t.clientY, samples: [{ x: t.clientX, t: e.timeStamp }] };
      const r = run.current;
      if (r && !carry.current) {
        stop();
        setBlur(0);
        if (r.kind === 'tap') {
          // A tap's roll: it lands at once (it is nearly there), and this touch starts on the new page
          pos.current = r.target;
          paint();
          land(r.target);
        } else if (r.target !== 0) {
          // Caught on its way onto the next page: it lands there now, and the swipe goes on around it
          // from where it is (the page left is now on the other side)
          carry.current = { x: pos.current - r.target };
          land(r.target);
        } else {
          // Caught on its way back: the finger holds the roll where it is
          setPending(-1);
        }
      }
      touch.current = g;
      follow(e.target);
    };

    const onTouchMove = (e) => {
      const g = touch.current;
      if (!g) return;
      if (e.touches.length !== 1) {
        // A second finger (pinch): let it be
        if (run.current?.kind === 'swipe' && !frame.current && !carry.current) release();
        touch.current = null;
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.decided) {
        // A roll that just landed: wait until the new page is in place before this touch moves anything
        if (carry.current || (run.current && run.current.kind !== 'swipe')) return;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        g.decided = true;
        // Up or down first: the page scrolls, and a caught roll goes on to the nearest page
        if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
          if (run.current) release();
          touch.current = null;
          return;
        }
        g.x = t.clientX; // the roll moves from here on, with no jump
        if (!run.current) startSwipe(0);
        g.base = pos.current;
      }
      const r = run.current;
      if (!r || r.kind !== 'swipe' || frame.current) return;
      // Claims the gesture: no page scroll while the roll moves
      if (e.cancelable) e.preventDefault();
      g.samples.push({ x: t.clientX, t: e.timeStamp });
      if (g.samples.length > 6) g.samples.shift();
      // To the left: towards the next page
      const raw = g.base - (t.clientX - g.x) / r.offset;
      pos.current = raw > r.hi ? r.hi + (r.hi === 0 ? rubber(raw) : 0) : raw < r.lo ? r.lo - (r.lo === 0 ? rubber(-raw) : 0) : raw;
      paint();
    };

    const onTouchEnd = (e) => {
      const g = touch.current;
      touch.current = null;
      unfollow();
      const r = run.current;
      if (!g || !r || r.kind !== 'swipe' || frame.current || carry.current) return;
      // Caught and let go without moving: the roll goes on to the nearest page
      if (!g.decided) {
        release();
        return;
      }
      const x = pos.current;
      // Speed over the last ~100 ms, in frames per second towards the next page
      const lastS = g.samples[g.samples.length - 1];
      const firstS = g.samples.find((s) => lastS.t - s.t <= 100) || g.samples[0];
      const vx = lastS.t > firstS.t ? (lastS.x - firstS.x) / (lastS.t - firstS.t) : 0;
      const v = e.type === 'touchcancel' ? 0 : (-vx * 1000) / r.offset;
      // Towards the page on the side shown: on when past a third of the way, or flicked onwards;
      // back when flicked away, and always back past the first or last page
      const dir = Math.sign(x);
      const towards = v * dir;
      const onward = dir !== 0 && e.type !== 'touchcancel' && (towards > 0.6 ? Math.abs(x) > 0.04 : towards < -0.6 ? false : Math.abs(x) > 0.33);
      spring(onward ? clamp(dir, r.lo, r.hi) : 0, v);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      unfollow();
    };
  }, [paint, spring, land, setBlur, startSwipe]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { film, pending, go, reset };
}
