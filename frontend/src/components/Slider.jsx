import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Segmented controls that really slide: the selection is a thumb you can press and drag to
 * another option, as on iOS. It follows the finger (stretching to the width of the option under it),
 * springs onto the nearest option on release, and a plain tap still picks an option.
 *
 * The thumb is placed from the measured position of each option, so options of different widths
 * work, and so does Arabic (offsetLeft is physical, whatever the direction).
 */

// Movement before a press becomes a drag; below it, the press stays a tap
const DRAG_START = 6;

/** Past the first or last option the thumb gives a little, then stops */
const rubber = (d) => Math.min(d * 0.3, 14);

export function useSlideSelect({ count, index, onSelect, disabled = false, grabAnywhere = true, keyboard = true }) {
  const trackRef = useRef(null);
  const segs = useRef([]);
  const gesture = useRef(null);
  const suppressClickUntil = useRef(0);
  const [rects, setRects] = useState(null);
  const [dragX, setDragX] = useState(null);

  const measure = useCallback(() => {
    const els = segs.current.slice(0, count);
    if (els.length < count || els.some((el) => !el)) return;
    setRects(els.map((el) => ({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight })));
  }, [count]);

  // Measured again whenever the track or an option changes size (fonts loading, language, window)
  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    segs.current.slice(0, count).forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [measure, count]);

  const centre = (r) => r.left + r.width / 2;

  const nearest = (x) => {
    if (!rects) return index;
    let best = 0;
    rects.forEach((r, i) => {
      if (Math.abs(centre(r) - x) < Math.abs(centre(rects[best]) - x)) best = i;
    });
    return best;
  };

  // Pointer position in the track's coordinates (the same as offsetLeft)
  const xIn = (e) => {
    const track = trackRef.current;
    const box = track.getBoundingClientRect();
    return e.clientX - box.left - track.clientLeft + track.scrollLeft;
  };

  const segmentOf = (target) => segs.current.findIndex((el) => el && el.contains(target));

  const onPointerDown = (e) => {
    if (disabled || !rects || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (!grabAnywhere && segmentOf(e.target) !== index) return;
    gesture.current = { id: e.pointerId, x: xIn(e), y: e.clientY, moved: false };
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const x = xIn(e);
    if (!g.moved) {
      const dx = Math.abs(x - g.x);
      const dy = Math.abs(e.clientY - g.y);
      if (dy > 10 && dy > dx) {
        gesture.current = null; // a vertical swipe: the page scrolls
        return;
      }
      if (dx < DRAG_START) return;
      g.moved = true;
      try {
        trackRef.current.setPointerCapture(e.pointerId);
      } catch {
        // the pointer is already gone
      }
    }
    setDragX(x);
  };

  const endDrag = (e, commit) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !g.moved) return;
    // The click that follows a drag must not also select the option it ends on
    suppressClickUntil.current = performance.now() + 300;
    setDragX(null);
    if (commit) {
      const next = nearest(xIn(e));
      if (next !== index) onSelect(next);
    }
  };

  const onClickCapture = (e) => {
    if (performance.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Arrow keys move the selection (mirrored in Arabic), Home and End jump to the ends
  const onKeyDown = (e) => {
    if (!keyboard || disabled) return;
    const rtl = getComputedStyle(trackRef.current).direction === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
    let next = null;
    if (step) next = (index + step + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
    segs.current[next]?.focus();
  };

  // Where the thumb is: on the selected option, or under the finger, as wide as the options around it
  let thumb = null;
  if (rects) {
    if (dragX === null) {
      thumb = rects[index] || null;
    } else {
      // Options in screen order, left to right (in Arabic the first option is on the right)
      const row = [...rects].sort((p, q) => centre(p) - centre(q));
      const first = centre(row[0]);
      const last = centre(row[count - 1]);
      let x = dragX;
      if (x < first) x = first - rubber(first - x);
      if (x > last) x = last + rubber(x - last);
      const at = Math.min(Math.max(x, first), last);
      let i = 0;
      while (i < count - 2 && centre(row[i + 1]) < at) i += 1;
      const a = row[i];
      const b = row[Math.min(i + 1, count - 1)];
      const t = b === a ? 0 : (at - centre(a)) / (centre(b) - centre(a));
      const lerp = (p, q) => p + (q - p) * t;
      const width = lerp(a.width, b.width);
      thumb = { left: x - width / 2, width, top: lerp(a.top, b.top), height: lerp(a.height, b.height) };
    }
  }

  return {
    trackRef,
    segRef: (i) => (el) => {
      segs.current[i] = el;
    },
    thumbStyle: thumb ? { left: thumb.left, top: thumb.top, width: thumb.width, height: thumb.height } : { opacity: 0 },
    dragging: dragX !== null,
    // The option shown as selected: the one under the finger while dragging
    current: dragX === null ? index : nearest(dragX),
    trackProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e) => endDrag(e, true),
      onPointerCancel: (e) => endDrag(e, false),
      onLostPointerCapture: (e) => gesture.current?.moved && endDrag(e, true),
      onClickCapture,
      onKeyDown,
      onDragStart: (e) => e.preventDefault(),
    },
  };
}

/**
 * A segmented control built on useSlideSelect.
 * options: [{ id, ... }]; renderOption(option, selected) draws its content.
 * role: 'radiogroup' (a setting) or 'tablist' (switches what the page shows).
 */
export function SegmentedSlider({
  options,
  value,
  onChange,
  role = 'radiogroup',
  ariaLabel,
  className = '',
  thumbClassName = '',
  segmentClassName = () => '',
  renderOption,
  disabled = false,
  grabAnywhere = true,
  hint = false,
}) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const { trackRef, segRef, thumbStyle, dragging, current, trackProps } = useSlideSelect({
    count: options.length,
    index,
    onSelect: (i) => onChange(options[i].id),
    disabled,
    grabAnywhere,
  });
  const itemRole = role === 'tablist' ? 'tab' : 'radio';

  return (
    <div
      ref={trackRef}
      role={role}
      aria-label={ariaLabel}
      className={`slider-track relative ${grabAnywhere ? 'slider-grab' : ''} ${hint ? 'slider-hint' : ''} ${className}`}
      {...trackProps}
    >
      <span aria-hidden="true" data-dragging={dragging} className={`slider-thumb ${thumbClassName}`} style={thumbStyle} />
      {options.map((option, i) => {
        const selected = i === index;
        return (
          <button
            key={option.id}
            ref={segRef(i)}
            type="button"
            role={itemRole}
            aria-checked={itemRole === 'radio' ? selected : undefined}
            aria-selected={itemRole === 'tab' ? selected : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => !selected && onChange(option.id)}
            className={`relative z-[1] ${!grabAnywhere && selected ? 'slider-grip' : ''} ${segmentClassName(i === current)}`}
          >
            {renderOption(option, i === current)}
          </button>
        );
      })}
    </div>
  );
}
