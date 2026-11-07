import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, RotateCcw, Search, MapPin } from 'lucide-react';
import { fetchReports, setReportStatus, errorMessage } from '../services/api';
import { navigate, pathFor } from '../services/router';
import { t, Notice, EmptyState, Spinner } from './ui';

const REASON_LABELS = {
  LABEL_CHANGED: ['Étiquette changée', 'تغيّر الملصق'],
  WRONG_STATUS: ['Statut faux', 'حالة خاطئة'],
  CLOSED: ['Lieu fermé / déménagé', 'مكان مغلق'],
  NO_LONGER_GLUTEN_FREE: ['Plus de sans gluten sûr', 'لم يعد آمنا'],
  WRONG_INFO: ['Information fausse', 'معلومة خاطئة'],
  REACTION: ['Réaction signalée', 'عارض صحي'],
  OTHER: ['Autre', 'أخرى'],
};

const TARGET_LABELS = {
  ATMC_PRODUCT: ['Guide ATMC', 'دليل الجمعية'],
  ASSOCIATION_PRODUCT: ['Fiche Celiac Square', 'بطاقة Celiac Square'],
  OFF_PRODUCT: ['Open Food Facts', 'Open Food Facts'],
  SPOT: ['Adresse', 'عنوان'],
  SCAN: ['Résultat du scanner', 'نتيجة الماسح'],
};

const FILTERS = [
  { id: 'OPEN', fr: 'À traiter', ar: 'للمعالجة' },
  { id: 'RESOLVED', fr: 'Traités', ar: 'تمت معالجتها' },
  { id: 'DISMISSED', fr: 'Classés', ar: 'مؤرشفة' },
  { id: 'ALL', fr: 'Tous', ar: 'الكل' },
];

const when = (iso, lang) =>
  new Date(iso).toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Problems reported by users: label changes, closed places, wrong statuses, reactions */
export default function BackofficeReports({ lang, onCountChange }) {
  const tr = t(lang);
  const [status, setStatus] = useState('OPEN');
  const [reports, setReports] = useState([]);
  const [state, setState] = useState({ loading: true, error: '', unavailable: false });
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setState({ loading: true, error: '', unavailable: false });
    try {
      const res = await fetchReports(status);
      setReports(res?.data || []);
      onCountChange?.(res?.openCount ?? 0);
      setState({ loading: false, error: '', unavailable: false });
    } catch (err) {
      const unavailable = err?.response?.data?.code === 'FEATURE_UNAVAILABLE';
      setState({ loading: false, unavailable, error: unavailable ? '' : errorMessage(err, tr('Les signalements n’ont pas pu être chargés.', 'تعذر تحميل البلاغات.')) });
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const update = async (report, next) => {
    setBusyId(report._id);
    setMessage('');
    try {
      const res = await setReportStatus(report._id, next);
      setMessage(res?.message || '');
      await load();
    } catch (err) {
      setMessage(errorMessage(err, tr('La mise à jour a échoué.', 'فشل التحديث.')));
    } finally {
      setBusyId(null);
    }
  };

  const openTarget = (r) => {
    if (r.targetType === 'SPOT') navigate(pathFor('map'));
    else navigate(pathFor('search', { query: { q: r.targetType === 'OFF_PRODUCT' && /^\d{8,14}$/.test(r.targetId) ? r.targetId : r.targetLabel.replace(/\s*\(.*\)$/, '') } }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{tr('Signalements', 'البلاغات')}</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
          {tr(
            'Envoyés par les visiteurs depuis le guide, la recherche, le scanner et la carte. Corrigez la fiche concernée (back-office Adresses, ou npm run atmc:import pour le guide), puis marquez le signalement comme traité.',
            'يرسلها الزوار من الدليل والبحث والماسح والخريطة. صحّح البطاقة المعنية ثم علّم البلاغ كمعالَج.'
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={tr('Filtrer', 'تصفية')}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={status === f.id} onClick={() => setStatus(f.id)}>
            {tr(f.fr, f.ar)}
          </button>
        ))}
      </div>

      {message && <Notice tone="info">{message}</Notice>}

      {state.loading ? (
        <Spinner label={tr('Chargement…', 'جاري التحميل…')} />
      ) : state.unavailable ? (
        <Notice tone="warning" title={tr('Table des signalements absente', 'جدول البلاغات غير موجود')}>
          {tr('Appliquez la migration supabase/migrations/20261108100000_community_feedback.sql.', 'طبّق ترحيل قاعدة البيانات 20261108100000_community_feedback.sql.')}
        </Notice>
      ) : state.error ? (
        <Notice tone="error" action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>}>
          {state.error}
        </Notice>
      ) : reports.length === 0 ? (
        <EmptyState title={status === 'OPEN' ? tr('Aucun signalement à traiter', 'لا توجد بلاغات للمعالجة') : tr('Aucun signalement', 'لا توجد بلاغات')} />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const [reasonFr, reasonAr] = REASON_LABELS[r.reason] || REASON_LABELS.OTHER;
            const [targetFr, targetAr] = TARGET_LABELS[r.targetType] || ['', ''];
            const urgent = r.reason === 'REACTION' || r.reason === 'LABEL_CHANGED' || r.reason === 'NO_LONGER_GLUTEN_FREE';
            return (
              <li key={r._id} className={`panel space-y-2 p-4 ${urgent && r.status === 'OPEN' ? 'border-status-unsafe/50' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-md px-2 py-0.5 font-medium ${urgent ? 'bg-status-unsafe/15 text-status-unsafe-ink' : 'bg-canvas-sunk text-ink'}`}>{tr(reasonFr, reasonAr)}</span>
                  <span className="text-ink-soft">{tr(targetFr, targetAr)}</span>
                  <span className="ms-auto text-xs text-ink-faint">{when(r.createdAt, lang)}</span>
                </div>
                <p dir="auto" className="text-left font-medium rtl:text-right">{r.targetLabel || '—'}</p>
                {r.targetId && <p className="text-xs tabular-nums text-ink-faint" dir="ltr">{r.targetId}</p>}
                {r.message && <p dir="auto" className="whitespace-pre-line border-s-2 border-canvas-line ps-3 text-left text-sm rtl:text-right">{r.message}</p>}
                <p className="text-xs text-ink-faint">
                  {r.reporter ? tr(`Par ${r.reporter.fullName || r.reporter.email} (${r.reporter.email})`, `من ${r.reporter.fullName || r.reporter.email}`) : tr('Visiteur non connecté', 'زائر غير مسجل')}
                  {r.resolvedAt && ` · ${tr('clos le', 'أُغلق في')} ${when(r.resolvedAt, lang)}`}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {r.targetType !== 'SCAN' && (
                    <button type="button" className="btn-quiet" onClick={() => openTarget(r)}>
                      {r.targetType === 'SPOT' ? <MapPin className="h-4 w-4" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                      {tr('Voir', 'عرض')}
                    </button>
                  )}
                  {r.status === 'OPEN' ? (
                    <>
                      <button type="button" className="btn-primary" disabled={busyId === r._id} onClick={() => update(r, 'RESOLVED')}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {tr('Traité', 'تمت المعالجة')}
                      </button>
                      <button type="button" className="btn-ghost" disabled={busyId === r._id} onClick={() => update(r, 'DISMISSED')}>
                        <X className="h-4 w-4" aria-hidden="true" />
                        {tr('Classer sans suite', 'أرشفة')}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-ghost" disabled={busyId === r._id} onClick={() => update(r, 'OPEN')}>
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      {tr('Rouvrir', 'إعادة الفتح')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
