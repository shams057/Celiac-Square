import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Flag, Bookmark, BookmarkCheck, CalendarClock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { fetchSaved, saveProduct, unsaveProduct, sendReport, errorMessage } from '../services/api';
import { navigate, pathFor } from '../services/router';
import { t, Modal, Notice } from './ui';

// ---------------------------------------------------------------------------------------------
// How fresh a verdict is
// ---------------------------------------------------------------------------------------------

// Past this age, the date is shown in orange with a reminder to check the package
const STALE_AFTER_MONTHS = 24;

const monthsSince = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
};

const formatDate = (iso, lang, withDay) =>
  new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR', withDay ? { day: 'numeric', month: 'short', year: 'numeric' } : { month: 'long', year: 'numeric' });

const SOURCE_NAMES = {
  atmc: ['Guide ATMC', 'دليل الجمعية'],
  // Written by the Celiac Square team, not published by the ATMC
  assoc: ['Fiche Celiac Square, non validée par l’ATMC', 'بطاقة Celiac Square، غير معتمدة من الجمعية'],
  off: ['Open Food Facts', 'Open Food Facts'],
};

/** 'atmc' | 'assoc' | 'off' from a product's key or source */
export const sourceKind = (item) => {
  const key = item?.productKey || item?.key || '';
  if (key.startsWith('atmc:') || /ATMC/.test(item?.source || '')) return 'atmc';
  if (key.startsWith('assoc:') || /Celiac Square|Association/.test(item?.source || '')) return 'assoc';
  return 'off';
};

/**
 * "Source : Guide ATMC · édition de décembre 2023", in orange with a warning when the data is
 * more than two years old. item: { source, productKey?, sourceDate?, sourceDateKind? }
 */
export function SourceLine({ item, lang, className = '' }) {
  const tr = t(lang);
  const kind = sourceKind(item);
  const [fr, ar] = SOURCE_NAMES[kind];
  const months = item?.sourceDate ? monthsSince(item.sourceDate) : null;
  const stale = months !== null && months >= STALE_AFTER_MONTHS;
  const date =
    item?.sourceDate &&
    (item.sourceDateKind === 'edition'
      ? tr(`édition de ${formatDate(item.sourceDate, lang)}`, `طبعة ${formatDate(item.sourceDate, lang)}`)
      : tr(`fiche mise à jour le ${formatDate(item.sourceDate, lang, true)}`, `حُدّثت البطاقة في ${formatDate(item.sourceDate, lang, true)}`));

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 ${stale ? 'text-status-warning-ink' : ''} ${className}`}>
      {stale && <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>
        {tr('Source :', 'المصدر:')} {tr(fr, ar)}
        {date ? ` · ${date}` : ''}
        {kind === 'off' && !date ? tr(' — vérifiez l’étiquette', ' — تحقق من الملصق') : ''}
      </span>
      {stale && (
        <span className="font-medium">
          {tr(`— plus de ${Math.floor(months / 12)} ans, la recette a pu changer : vérifiez l’emballage`, `— أكثر من ${Math.floor(months / 12)} سنوات، قد تكون الوصفة تغيرت: تحقق من العلبة`)}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Report a problem
// ---------------------------------------------------------------------------------------------

const REASONS = {
  LABEL_CHANGED: ['L’étiquette a changé (gluten ajouté, nouvelle recette…)', 'تغيّر الملصق (غلوتين مضاف، وصفة جديدة…)'],
  WRONG_STATUS: ['Le statut affiché est faux', 'الحالة المعروضة خاطئة'],
  CLOSED: ['Ce lieu a fermé ou déménagé', 'أُغلق هذا المكان أو انتقل'],
  NO_LONGER_GLUTEN_FREE: ['Ce lieu ne propose plus de sans gluten sûr', 'لم يعد هذا المكان يقدم منتجات آمنة بدون غلوتين'],
  WRONG_INFO: ['Une information est fausse (adresse, horaires, nom…)', 'معلومة خاطئة (العنوان، الأوقات، الاسم…)'],
  REACTION: ['J’ai eu une réaction après en avoir mangé', 'أصابني عارض بعد تناوله'],
  OTHER: ['Autre problème', 'مشكلة أخرى'],
};

const REASONS_BY_TARGET = {
  SPOT: ['CLOSED', 'NO_LONGER_GLUTEN_FREE', 'WRONG_INFO', 'REACTION', 'OTHER'],
  SCAN: ['WRONG_STATUS', 'WRONG_INFO', 'OTHER'],
  default: ['LABEL_CHANGED', 'WRONG_STATUS', 'WRONG_INFO', 'REACTION', 'OTHER'],
};

/** targetType for a product, from its key */
export const productTargetType = (item) => ({ atmc: 'ATMC_PRODUCT', assoc: 'ASSOCIATION_PRODUCT', off: 'OFF_PRODUCT' })[sourceKind(item)];

/** The id the team needs to find the product: row id for the guides, barcode for Open Food Facts */
export const productTargetId = (item) => {
  const key = item?.productKey || item?.key || '';
  return key.includes(':') ? key.slice(key.indexOf(':') + 1) : item?.barcode || '';
};

function ReportForm({ target, lang, onDone }) {
  const tr = t(lang);
  const reasons = REASONS_BY_TARGET[target.type] || REASONS_BY_TARGET.default;
  const [reason, setReason] = useState(target.type === 'SCAN' ? 'WRONG_STATUS' : '');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState({ sending: false, error: '', done: '' });
  const needsMessage = reason === 'OTHER' || target.type === 'SCAN';

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setState({ sending: false, error: tr('Choisissez la raison.', 'اختر السبب.'), done: '' });
      return;
    }
    setState({ sending: true, error: '', done: '' });
    try {
      const res = await sendReport({ targetType: target.type, targetId: target.id || '', targetLabel: target.label || '', reason, message, website });
      setState({ sending: false, error: '', done: res?.message || 'ok' });
    } catch (err) {
      setState({ sending: false, error: errorMessage(err, tr('L’envoi a échoué. Vérifiez votre connexion puis réessayez.', 'فشل الإرسال. تحقق من الاتصال ثم أعد المحاولة.')), done: '' });
    }
  };

  if (state.done) {
    return (
      <div className="space-y-4">
        <Notice tone="success" title={tr('Merci, c’est transmis.', 'شكرا، تم الإرسال.')}>
          {tr('L’équipe vérifie chaque signalement et corrige la fiche si besoin.', 'يتحقق الفريق من كل بلاغ ويصحح البطاقة عند الحاجة.')}
        </Notice>
        {reason === 'REACTION' && (
          <p className="text-sm text-ink-soft">
            {tr(
              'Si vous avez des symptômes importants, consultez un médecin. Gardez l’emballage : il peut servir à identifier le lot.',
              'إذا كانت لديك أعراض قوية فاستشر طبيبا. احتفظ بالعلبة فقد تفيد في تحديد الدفعة.'
            )}
          </p>
        )}
        <button type="button" className="btn-primary" onClick={onDone}>
          {tr('Fermer', 'إغلاق')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="field-label">{tr('Quel est le problème ?', 'ما المشكلة؟')}</legend>
        <div className="space-y-1.5">
          {reasons.map((r) => (
            <label key={r} className="flex cursor-pointer items-start gap-3 rounded-xl border border-canvas-line/70 bg-canvas-paper/70 px-3.5 py-2.5 text-[15px] has-[:checked]:border-ink">
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="mt-1 accent-[#4F6B1C]" />
              <span>{tr(...REASONS[r])}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="report-message" className="field-label">
          {needsMessage ? tr('Détails', 'التفاصيل') : tr('Détails (facultatif)', 'التفاصيل (اختياري)')}
        </label>
        <textarea
          id="report-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={3}
          required={needsMessage}
          minLength={needsMessage ? 5 : undefined}
          className="field"
          placeholder={tr('Ex. : « blé » apparaît maintenant dans les ingrédients (lot de mars 2026).', 'مثال: يظهر «القمح» الآن في المكونات (دفعة مارس 2026).')}
        />
      </div>
      {/* Honeypot: hidden from people, filled in by bots */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <p className="text-xs text-ink-faint">
        {tr('Ne mettez pas d’informations personnelles. Le signalement est lu par l’équipe Celiac Square.', 'لا تضع معلومات شخصية. يقرأ فريق Celiac Square البلاغ.')}
      </p>
      <button type="submit" className="btn-primary" disabled={state.sending}>
        {state.sending ? tr('Envoi…', 'جاري الإرسال…') : tr('Envoyer le signalement', 'أرسل البلاغ')}
      </button>
    </form>
  );
}

/**
 * "Signaler un problème" link that opens the report form.
 * target: { type: 'ATMC_PRODUCT' | 'ASSOCIATION_PRODUCT' | 'OFF_PRODUCT' | 'SPOT' | 'SCAN', id?, label }
 * iconOnly: a small flag button for dense lists.
 */
export function ReportButton({ target, lang, iconOnly = false, className = '' }) {
  const tr = t(lang);
  const [open, setOpen] = useState(false);
  const label = tr('Signaler un problème', 'الإبلاغ عن مشكلة');
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          iconOnly
            ? `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-canvas-paper hover:text-ink ${className}`
            : `inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline ${className}`
        }
        aria-label={iconOnly ? `${label} : ${target.label}` : undefined}
        title={iconOnly ? label : undefined}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {!iconOnly && label}
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} lang={lang} title={label} subtitle={target.label}>
          <ReportForm target={target} lang={lang} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Saved products
// ---------------------------------------------------------------------------------------------

const SavedContext = createContext(null);

/** The signed-in user's saved products, shared by every save button and the "My products" page */
export function SavedProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | ready | unavailable | error

  const reload = useCallback(async () => {
    if (!user) {
      setItems([]);
      setState('idle');
      return;
    }
    setState('loading');
    try {
      const res = await fetchSaved();
      setItems(res?.data || []);
      setState('ready');
    } catch (err) {
      setState(err?.response?.data?.code === 'FEATURE_UNAVAILABLE' ? 'unavailable' : 'error');
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const keys = useMemo(() => new Set(items.map((i) => i.key)), [items]);

  const toggle = useCallback(
    async (key, snapshot) => {
      if (keys.has(key)) {
        await unsaveProduct(key);
        setItems((list) => list.filter((i) => i.key !== key));
      } else {
        const res = await saveProduct(key, snapshot);
        setItems((list) => [res.data, ...list.filter((i) => i.key !== key)]);
      }
    },
    [keys]
  );

  return <SavedContext.Provider value={{ items, keys, state, reload, toggle }}>{children}</SavedContext.Provider>;
}

export const useSaved = () => useContext(SavedContext);

/** What is kept with a saved product, from a search result / scanner match */
export const snapshotOf = (item) => ({
  name: item.productNameFr || item.nameFr || item.name || '',
  nameAr: item.productNameAr || '',
  brand: item.brand || '',
  status: item.status,
  badgeText: item.badgeText || '',
  badgeTextAr: item.badgeTextAr || '',
  source: item.source || '',
  sourceDate: item.sourceDate || '',
  barcode: item.barcode || '',
});

/**
 * Bookmark button. Signed out: explains that saving needs an account.
 * item: a product with productKey (search results, scanner matches, ATMC rows via atmcAsProduct)
 */
export function SaveButton({ item, lang, iconOnly = false }) {
  const tr = t(lang);
  const { user } = useAuth();
  const saved = useSaved();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const key = item?.productKey;
  if (!key || !saved) return null;
  const isSaved = saved.keys.has(key);
  const label = isSaved ? tr('Retirer de mes produits', 'إزالة من منتجاتي') : tr('Enregistrer dans mes produits', 'احفظ في منتجاتي');

  const onClick = async (e) => {
    e.stopPropagation();
    setMessage('');
    if (!user) {
      navigate(pathFor('account'));
      return;
    }
    setBusy(true);
    try {
      await saved.toggle(key, snapshotOf(item));
    } catch (err) {
      setMessage(errorMessage(err, tr('Échec, réessayez.', 'فشل، أعد المحاولة.')));
    } finally {
      setBusy(false);
    }
  };

  const Icon = isSaved ? BookmarkCheck : Bookmark;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={isSaved}
        aria-label={iconOnly ? `${label} : ${snapshotOf(item).name}` : undefined}
        title={!user ? tr('Connectez-vous pour enregistrer vos produits', 'سجّل الدخول لحفظ منتجاتك') : iconOnly ? label : undefined}
        className={
          iconOnly
            ? `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas-paper ${isSaved ? 'text-status-safe-ink' : 'text-ink-faint hover:text-ink'}`
            : `inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline ${isSaved ? 'font-medium text-status-safe-ink' : 'text-ink-soft hover:text-ink'}`
        }
      >
        <Icon className="h-4 w-4" aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
        {!iconOnly && (isSaved ? tr('Enregistré', 'محفوظ') : tr('Enregistrer', 'احفظ'))}
      </button>
      {message && <span className="text-xs text-status-unsafe-ink" role="alert">{message}</span>}
    </span>
  );
}

/** An ATMC catalog row in the shape of a search result (for saving and reporting) */
export const atmcAsProduct = (row) => ({
  productKey: `atmc:${row._id}`,
  productNameFr: row.nameFr || row.name,
  productNameAr: row.name !== row.nameFr ? row.name : '',
  brand: row.brand,
  status: row.status === 'ALLOWED' ? 'SAFE' : row.status === 'NOT_ALLOWED' ? 'UNSAFE' : 'WARNING',
  badgeText: row.statusLabelFr,
  badgeTextAr: row.statusLabelAr,
  source: 'Guide Officiel ATMC 2023',
  sourceDate: row.edition,
  sourceDateKind: 'edition',
});
