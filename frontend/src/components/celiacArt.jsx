import React, { useEffect, useRef, useState } from 'react';
import { t } from './ui';

/**
 * Drawings and motion for the "Comprendre" page (AboutCeliac.jsx): the scroll reveal,
 * the villi window and the food illustrations. Everything is inline SVG or plain elements,
 * so nothing is fetched and the page works offline.
 */

/**
 * Shows its content when it scrolls into view, once. `kind` picks where it comes from:
 * 'rise' (from below), 'pop' (scales up), 'start' / 'end' (from that side, mirrored in Arabic).
 * The styles are in index.css (.reveal).
 */
export function Reveal({ as: Tag = 'div', kind = 'rise', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal={kind} style={{ '--reveal-delay': `${delay}ms` }} className={`reveal ${shown ? 'is-shown' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// Villus heights, as a share of the space above the gut wall
const HEALTHY = [70, 88, 62, 94, 76, 90, 66, 82];
const FLATTENED = [15, 19, 12, 21, 15, 18, 13, 17];

// Where the gluten grains float: [inline-start %, top %, rotation]
const GRAINS = [
  [12, 44, -24],
  [27, 57, 18],
  [43, 41, -8],
  [58, 60, 32],
  [72, 46, -30],
  [86, 58, 12],
];

/**
 * The inside of the small intestine, very close up. The switch shows what gluten does to the villi
 * of a person with celiac disease, and that they grow back without it.
 */
export function VilliWindow({ lang }) {
  const tr = t(lang);
  const [gluten, setGluten] = useState(false);
  const [grown, setGrown] = useState(false);

  // The villi grow in when the page opens
  useEffect(() => {
    const id = setTimeout(() => setGrown(true), 200);
    return () => clearTimeout(id);
  }, []);

  const heights = gluten ? FLATTENED : HEALTHY;
  const tissue = gluten ? '#DB8468' : '#8BA850';
  const options = [
    { on: false, fr: 'Sans gluten', ar: 'بدون غلوتين' },
    { on: true, fr: 'Avec gluten', ar: 'مع الغلوتين' },
  ];
  const nutrients = [
    ['Fer', 'حديد'],
    ['Calcium', 'كالسيوم'],
    ['Vitamines', 'فيتامينات'],
  ];

  return (
    <figure>
      <div className={`relative aspect-[5/4] overflow-hidden rounded-[2.25rem] transition-colors duration-700 ${gluten ? 'bg-accent-tint' : 'bg-primary-tint'}`}>
        <p className="absolute inset-x-5 top-4 text-sm font-medium text-ink-soft">{tr('L’intestin grêle, vu de très près', 'الأمعاء الدقيقة عن قرب شديد')}</p>

        {/* What the villi are there to absorb */}
        <ul className="absolute inset-x-5 top-11 flex flex-wrap gap-1.5" aria-hidden="true">
          {nutrients.map(([fr, ar]) => (
            <li
              key={fr}
              className={`inline-flex items-center gap-1.5 rounded-full bg-canvas-paper/90 px-2.5 py-1 text-xs font-medium transition-opacity duration-500 ${gluten ? 'line-through opacity-45' : ''}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${gluten ? 'bg-ink-faint' : 'bg-primary'}`} />
              {tr(fr, ar)}
            </li>
          ))}
        </ul>

        {/* Gluten grains */}
        <div className="absolute inset-0" aria-hidden="true">
          {GRAINS.map(([x, y, rot], i) => (
            <span
              key={i}
              className="absolute transition-[opacity,transform] duration-700 ease-out"
              style={{
                insetInlineStart: `${x}%`,
                top: `${y}%`,
                opacity: gluten ? 1 : 0,
                transform: gluten ? 'translateY(0)' : 'translateY(-18px)',
                transitionDelay: gluten ? `${i * 60}ms` : '0ms',
              }}
            >
              <span className="grain block h-2.5 w-[1.125rem] rounded-full bg-accent" style={{ rotate: `${rot}deg`, animationDelay: `${i * -0.7}s` }} />
            </span>
          ))}
        </div>

        {/* The villi stand on the gut wall */}
        <div className="absolute inset-x-[7%] bottom-[17%] top-[34%] flex items-end justify-between" aria-hidden="true">
          {heights.map((h, i) => (
            <span key={i} className="villus" style={{ height: `${grown ? h : 0}%`, transitionDelay: `${i * 45}ms`, backgroundColor: tissue }} />
          ))}
        </div>
        <div
          className="absolute inset-x-0 bottom-0 flex h-[18%] items-center justify-center text-xs font-medium text-onbright/80 transition-colors duration-700"
          style={{ backgroundColor: tissue }}
          aria-hidden="true"
        >
          {tr('paroi de l’intestin', 'جدار الأمعاء')}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="inline-flex rounded-full bg-ink/[0.07] p-1" role="radiogroup" aria-label={tr('État de l’intestin', 'حالة الأمعاء')}>
          {options.map(({ on, fr, ar }) => {
            const active = gluten === on;
            return (
              <button
                key={fr}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setGluten(on)}
                className={`min-h-10 rounded-full px-4 text-[15px] transition-colors ${active ? 'bg-canvas-paper font-semibold text-ink shadow-sm dark:bg-canvas-edge' : 'text-ink-soft hover:text-ink'}`}
              >
                {tr(fr, ar)}
              </button>
            );
          })}
        </div>
      </div>

      <figcaption className="mx-auto mt-3 min-h-[5.5rem] max-w-[46ch] text-center text-[15px] leading-relaxed text-ink-soft" aria-live="polite">
        {gluten
          ? tr(
              'Avec du gluten, le système immunitaire attaque la paroi de l’intestin : les villosités s’aplatissent et les nutriments passent sans être absorbés.',
              'مع الغلوتين يهاجم جهاز المناعة جدار الأمعاء: تتسطح الزغابات وتمرّ المغذيات دون أن تُمتص.'
            )
          : tr(
              'Sans gluten, les villosités se redressent et absorbent de nouveau le fer, le calcium et les vitamines. Comptez quelques mois chez l’enfant, souvent un à deux ans chez l’adulte.',
              'بدون غلوتين تنتصب الزغابات من جديد وتمتص الحديد والكالسيوم والفيتامينات. يتطلب ذلك بضعة أشهر عند الطفل، وغالبا سنة إلى سنتين عند الكبار.'
            )}
      </figcaption>
    </figure>
  );
}

// Illustration colours: the same in light and dark, like the brand colours
const CRUST = '#D9A05B';
const BAKED = '#A0763A';
const CRUMB = '#F6E2B8';
const DOUGH = '#F2C76B';
const SAGE = '#8BA850';
const ORANGE = '#FF8A41';
const RED = '#C9423D';

const round = { strokeLinecap: 'round', strokeLinejoin: 'round' };

const FOOD = {
  bread: (
    <>
      {/* A baguette lying across, a round loaf in front of it */}
      <g transform="rotate(-24 48 36)">
        <rect x="6" y="27" width="84" height="18" rx="9" fill={BAKED} />
        <g stroke={CRUMB} strokeWidth="3" {...round}>
          <path d="M22 32l6 8M36 32l6 8M50 32l6 8M64 32l6 8" />
        </g>
      </g>
      <ellipse cx="50" cy="65" rx="27" ry="18" fill={CRUST} />
      <g fill="none" stroke={CRUMB} strokeWidth="3.5" {...round}>
        <path d="M34 62q16-12 32 0" />
        <path d="M39 72q11-8 22 0" />
      </g>
    </>
  ),
  couscous: (
    <>
      <path d="M21 52Q48 12 75 52Z" fill={DOUGH} />
      <g fill={BAKED}>
        <circle cx="42" cy="38" r="2" />
        <circle cx="52" cy="32" r="2" />
        <circle cx="56" cy="43" r="2" />
        <circle cx="35" cy="46" r="2" />
        <circle cx="46" cy="46" r="2" />
        <circle cx="64" cy="47" r="2" />
      </g>
      <circle cx="47" cy="25" r="5" fill={ORANGE} />
      <path d="M12 52H84C84 71 68 83 48 83S12 71 12 52Z" fill={SAGE} />
      <path d="M36 88h24" stroke={SAGE} strokeWidth="5" {...round} />
    </>
  ),
  pasta: (
    <>
      <g transform="translate(34 36) rotate(-18)">
        <path d="M0-9L19-17V17L0 9L-19 17V-17Z" fill={DOUGH} stroke={CRUST} strokeWidth="2.5" {...round} />
        <rect x="-4" y="-10" width="8" height="20" rx="4" fill={CRUST} />
      </g>
      <g transform="translate(60 62) rotate(24)">
        <path d="M0-9L19-17V17L0 9L-19 17V-17Z" fill={DOUGH} stroke={CRUST} strokeWidth="2.5" {...round} />
        <rect x="-4" y="-10" width="8" height="20" rx="4" fill={CRUST} />
      </g>
    </>
  ),
  brik: (
    <>
      <path d="M17 74L48 20L79 74Z" fill={CRUST} stroke={CRUST} strokeWidth="10" {...round} />
      <path d="M30 68L48 37L66 68Z" fill="none" stroke={CRUMB} strokeWidth="3" {...round} />
      <g fill={BAKED}>
        <circle cx="48" cy="56" r="2.5" />
        <circle cx="40" cy="63" r="2" />
        <circle cx="56" cy="62" r="2" />
      </g>
    </>
  ),
  cake: (
    <>
      <rect x="20" y="42" width="56" height="34" rx="7" fill={CRUST} />
      <rect x="20" y="57" width="56" height="5" fill={CRUMB} />
      <path d="M20 49a7 7 0 0 1 7-7h42a7 7 0 0 1 7 7v3c-4 5-9 5-13 0c-4 6-10 6-15 0c-4 5-9 5-13 0c-5 6-11 5-15 0Z" fill="#FFF6E4" />
      <path d="M48 36c1-6 5-10 10-11" fill="none" stroke={SAGE} strokeWidth="2.5" {...round} />
      <circle cx="48" cy="35" r="6.5" fill={RED} />
      <path d="M12 80h72" stroke={BAKED} strokeWidth="4" {...round} />
    </>
  ),
  biscuits: (
    <>
      <circle cx="58" cy="38" r="23" fill={BAKED} />
      <circle cx="40" cy="57" r="25" fill={CRUST} />
      <circle cx="40" cy="57" r="20" fill="none" stroke={BAKED} strokeWidth="3.5" strokeDasharray="1 8.5" {...round} />
      <g fill={BAKED}>
        <circle cx="33" cy="51" r="2.5" />
        <circle cx="47" cy="51" r="2.5" />
        <circle cx="40" cy="58" r="2.5" />
        <circle cx="33" cy="65" r="2.5" />
        <circle cx="47" cy="65" r="2.5" />
      </g>
    </>
  ),
  pizza: (
    <>
      <path d="M48 84L17 27Q48 12 79 27Z" fill={DOUGH} stroke={DOUGH} strokeWidth="4" {...round} />
      <path d="M17 27Q48 12 79 27" fill="none" stroke={CRUST} strokeWidth="10" {...round} />
      <circle cx="40" cy="42" r="5.5" fill={RED} />
      <circle cx="56" cy="46" r="5.5" fill={RED} />
      <circle cx="47" cy="62" r="5" fill={RED} />
      <circle cx="49" cy="33" r="2.5" fill={SAGE} />
      <circle cx="43" cy="53" r="2.5" fill={SAGE} />
    </>
  ),
  soup: (
    <>
      <g fill="none" stroke={BAKED} strokeWidth="3.5" {...round}>
        <path d="M36 32c-5-6 5-9 0-16" />
        <path d="M50 30c-5-6 5-9 0-16" />
        <path d="M64 32c-5-6 5-9 0-16" />
      </g>
      <path d="M12 46H84C84 68 68 82 48 82S12 68 12 46Z" fill={ORANGE} />
      <ellipse cx="48" cy="46" rx="36" ry="8" fill="#B5532A" />
      <g fill={DOUGH}>
        <circle cx="34" cy="45" r="2" />
        <circle cx="44" cy="48" r="2" />
        <circle cx="54" cy="44" r="2" />
        <circle cx="63" cy="47" r="2" />
      </g>
      <path d="M36 87h24" stroke={ORANGE} strokeWidth="5" {...round} />
    </>
  ),
  fritter: (
    <>
      <circle cx="48" cy="50" r="23" fill="none" stroke={CRUST} strokeWidth="19" />
      <path d="M30 34a25 25 0 0 1 30-6" fill="none" stroke={CRUMB} strokeWidth="4" opacity="0.7" {...round} />
      <g fill="#FFF6E4">
        <circle cx="26" cy="46" r="2" />
        <circle cx="33" cy="66" r="2" />
        <circle cx="52" cy="73" r="2" />
        <circle cx="69" cy="60" r="2" />
        <circle cx="70" cy="40" r="2" />
        <circle cx="48" cy="26" r="2" />
      </g>
    </>
  ),
  beer: (
    <>
      <path d="M62 42h7a9 9 0 0 1 9 9v9a9 9 0 0 1-9 9h-7" fill="none" stroke={CRUMB} strokeWidth="6" {...round} />
      <rect x="24" y="30" width="40" height="52" rx="7" fill="#F2B33D" />
      <g stroke="#D48F1F" strokeWidth="3.5" {...round}>
        <path d="M36 46v24M44 46v24M52 46v24" />
      </g>
      <g fill="#FFF6E4">
        <circle cx="30" cy="30" r="9" />
        <circle cx="44" cy="25" r="11" />
        <circle cx="58" cy="30" r="9" />
        <rect x="24" y="28" width="40" height="10" rx="5" />
      </g>
    </>
  ),
};

/** One food drawing; `name` is a key of FOOD */
export function FoodArt({ name, className = '' }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      {FOOD[name]}
    </svg>
  );
}
