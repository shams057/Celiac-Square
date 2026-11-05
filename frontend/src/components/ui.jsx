import React from 'react';
import { Check, X, TriangleAlert, HelpCircle, LoaderCircle, SlidersHorizontal } from 'lucide-react';

// Translation helper: t(lang)('Français', 'العربية')
export const t = (lang) => (fr, ar) => (lang === 'ar' ? ar : fr);

/**
 * Every gluten status in the app (ATMC guide, association DB, Open Food Facts, vision)
 * collapses to one of four kinds.
 */
export const statusKind = (status) => {
  if (status === 'ALLOWED' || status === 'SAFE') return 'safe';
  if (status === 'NOT_ALLOWED' || status === 'UNSAFE') return 'unsafe';
  if (status === 'TO_CHECK' || status === 'WARNING' || status === 'CROSS_CONTAMINATION_RISK') return 'warning';
  return 'unknown';
};

export const STATUS = {
  safe: {
    icon: Check,
    fr: 'Sans gluten',
    ar: 'خالٍ من الغلوتين',
    tile: 'bg-status-safe text-ink',
    text: 'text-status-safe-ink',
  },
  warning: {
    icon: TriangleAlert,
    fr: 'À vérifier',
    ar: 'للتثبت',
    tile: 'bg-status-warning text-ink',
    text: 'text-status-warning-ink',
  },
  unsafe: {
    icon: X,
    fr: 'Contient du gluten',
    ar: 'يحتوي على الغلوتين',
    tile: 'bg-status-unsafe text-white',
    text: 'text-status-unsafe-ink',
  },
  unknown: {
    icon: HelpCircle,
    fr: 'Non référencé',
    ar: 'غير مصنف',
    tile: 'bg-canvas-sunk text-ink-soft',
    text: 'text-ink-soft',
  },
};

/** The square: the app's status mark */
export function StatusTile({ kind, size = 'md', className = '' }) {
  const meta = STATUS[kind] || STATUS.unknown;
  const Icon = meta.icon;
  const SIZES = {
    xs: ['w-4 h-4', 'w-3 h-3'],
    sm: ['w-6 h-6', 'w-3.5 h-3.5'],
    md: ['w-9 h-9', 'w-5 h-5'],
    lg: ['w-12 h-12', 'w-7 h-7'],
  };
  const [dims, icon] = SIZES[size] || SIZES.md;
  return (
    <span className={`${dims} ${meta.tile} rounded-tile inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
      <Icon className={icon} strokeWidth={2.5} />
    </span>
  );
}

/** Status tile with its label, for inline use */
export function StatusLabel({ kind, lang, label }) {
  const meta = STATUS[kind] || STATUS.unknown;
  return (
    <span className="inline-flex items-center gap-2">
      <StatusTile kind={kind} size="sm" />
      <span className={`text-sm font-medium ${meta.text}`}>{label || (lang === 'ar' ? meta.ar : meta.fr)}</span>
    </span>
  );
}

/** Logo: an olive leaf drawn as a "safe" tick inside a sage square, with an orange sun.
 *  `detailed` adds the leaf vein; leave it off below ~48px. */
export function BrandMark({ className = 'w-8 h-8', detailed = false }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <rect width="120" height="120" rx="28" fill="#8BA850" />
      <path d="M30 62 L50 82" stroke="#FFFFFF" strokeWidth={detailed ? 13 : 15} strokeLinecap="round" fill="none" />
      <path d="M46 86 C 51 58, 68 40, 95 29 C 92 58, 76 78, 46 86 Z" fill="#FFFFFF" />
      {detailed && (
        <path d="M54 77 C 64 62, 76 48, 88 37" stroke="#8BA850" strokeWidth="3" strokeLinecap="round" fill="none" />
      )}
      <circle cx="33" cy="33" r={detailed ? 8 : 10} fill="#FF8A41" />
    </svg>
  );
}

export function PageHead({ title, lede, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-soft" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Inline notice: tone = 'error' | 'warning' | 'info' | 'success' */
export function Notice({ tone = 'info', title, children, action }) {
  const tones = {
    error: 'border-status-unsafe/50 bg-status-unsafe/10',
    warning: 'border-status-warning/60 bg-status-warning/10',
    info: 'border-canvas-line bg-canvas-paper',
    success: 'border-status-safe/60 bg-status-safe/15',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm text-ink ${tones[tone]}`} role={tone === 'error' ? 'alert' : undefined}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-0.5 text-ink-soft' : ''}>{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <p className="text-lg font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Accessible modal shell */
export function Modal({ open, onClose, title, subtitle, children, width = 'max-w-xl', lang }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex animate-fade-in items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex max-h-[92vh] w-full ${width} animate-sheet-up flex-col rounded-t-3xl sm:animate-pop-in border border-white/60 bg-canvas-raised/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(47,38,29,0.35)] sm:rounded-3xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-canvas-line px-5 py-4 sm:px-6">
          <div>
            <h2 id="modal-title" className="text-xl font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost -me-2 p-2" aria-label={lang === 'ar' ? 'إغلاق' : 'Fermer'}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

/** Spot categories shared by the map, the submission form and the backoffice */
export const SPOT_CATEGORIES = [
  { value: 'DOCTOR', fr: 'Médecin spécialiste', ar: 'طبيب مختص', color: '#584A3B' },
  { value: 'ARTISAN', fr: 'Boulangerie, pâtisserie', ar: 'مخبزة، حلويات', color: '#4E6127' },
  { value: 'RESTAURANT', fr: 'Restaurant', ar: 'مطعم', color: '#E5702A' },
  { value: 'CAFE', fr: 'Café, salon de thé', ar: 'مقهى', color: '#A0763A' },
  { value: 'SUPERMARKET', fr: 'Épicerie, supermarché', ar: 'مغازة، متجر', color: '#6F8A8C' },
];

export const spotCategory = (value) => SPOT_CATEGORIES.find((c) => c.value === value) || SPOT_CATEGORIES[2];

/**
 * "Filtres" button that opens the filters in a bottom sheet. Only shown below
 * the lg breakpoint; on wide screens the page renders its filters inline.
 * Clicking an element marked data-closes-sheet closes the sheet.
 */
export function FilterSheet({ lang, activeCount = 0, children, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const tr = t(lang);
  return (
    <div className={`lg:hidden ${className}`}>
      <button type="button" onClick={() => setOpen(true)} className="btn-quiet h-full w-full" aria-haspopup="dialog">
        <SlidersHorizontal className="h-4 w-4" />
        {tr('Filtres', 'المرشحات')}
        {activeCount > 0 && <span className="rounded-md bg-accent px-1.5 text-sm tabular-nums text-ink">{activeCount}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={tr('Filtres', 'المرشحات')} lang={lang} width="max-w-lg">
        <div onClick={(e) => e.target.closest('[data-closes-sheet]') && setOpen(false)}>{children}</div>
        <div className="mt-6 border-t border-canvas-line pt-4">
          <button type="button" onClick={() => setOpen(false)} className="btn-primary w-full">
            {tr('Voir les résultats', 'عرض النتائج')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
