import React, { useEffect, useState } from 'react';
import { Trash2, History, Bookmark, ScanBarcode, ScanText, ListChecks, Search } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useSaved, SourceLine, SaveButton } from './community';
import { readHistory, clearHistory, HISTORY_EVENT } from '../services/history';
import { navigate, pathFor } from '../services/router';
import { t, statusKind, STATUS, StatusTile, PageHead, Notice, EmptyState, Spinner } from './ui';

const SCAN_ICONS = { product: ScanText, ingredients: ListChecks, barcode: ScanBarcode };

const when = (iso, lang) =>
  new Date(iso).toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "My products": products saved with the account, and the scans made on this device */
export default function SavedProducts({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const saved = useSaved();
  const [history, setHistory] = useState(readHistory);

  useEffect(() => {
    const sync = () => setHistory(readHistory());
    window.addEventListener(HISTORY_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(HISTORY_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const search = (q) => navigate(pathFor('search', { query: { q } }));
  const changed = saved.items.filter((i) => i.currentStatus);

  return (
    <div className="space-y-10">
      <PageHead
        title={tr('Mes produits', 'منتجاتي')}
        lede={tr(
          'Les produits que vous avez enregistrés, et vos derniers scans. Si le guide change le statut d’un produit enregistré, il est signalé ici.',
          'المنتجات التي حفظتها وآخر عمليات المسح. إذا غيّر الدليل حالة منتج محفوظ، يظهر ذلك هنا.'
        )}
      />

      <section aria-labelledby="saved-heading" className="space-y-4">
        <h2 id="saved-heading" className="flex items-center gap-2 text-xl font-semibold">
          <Bookmark className="h-5 w-5" aria-hidden="true" />
          {tr('Enregistrés', 'المحفوظة')}
        </h2>

        {!user ? (
          <EmptyState
            title={tr('Connectez-vous pour enregistrer vos produits', 'سجّل الدخول لحفظ منتجاتك')}
            action={
              <button type="button" className="btn-primary" onClick={() => navigate(pathFor('account'))}>
                {tr('Se connecter', 'تسجيل الدخول')}
              </button>
            }
          >
            {tr('Votre liste vous suit sur tous vos appareils, et vous êtes prévenu si le guide reclasse un produit.', 'تتبعك قائمتك على كل أجهزتك، وتُنبَّه إذا أعاد الدليل تصنيف منتج.')}
          </EmptyState>
        ) : saved.state === 'loading' ? (
          <Spinner label={tr('Chargement…', 'جاري التحميل…')} />
        ) : saved.state === 'unavailable' ? (
          <Notice tone="info">{tr('Cette fonction arrive bientôt.', 'هذه الميزة قادمة قريبا.')}</Notice>
        ) : saved.state === 'error' ? (
          <Notice
            tone="error"
            title={tr('Votre liste n’a pas pu être chargée.', 'تعذر تحميل قائمتك.')}
            action={
              <button type="button" className="btn-quiet" onClick={saved.reload}>
                {tr('Réessayer', 'إعادة المحاولة')}
              </button>
            }
          />
        ) : saved.items.length === 0 ? (
          <EmptyState title={tr('Aucun produit enregistré', 'لا توجد منتجات محفوظة')}>
            {tr('Touchez le signet à côté d’un produit (guide, recherche ou scanner) pour l’ajouter ici.', 'المس علامة الحفظ بجانب أي منتج (الدليل أو البحث أو الماسح) لإضافته هنا.')}
          </EmptyState>
        ) : (
          <>
            {changed.length > 0 && (
              <Notice tone="warning" title={tr(`${changed.length} produit(s) ont changé de statut depuis que vous les avez enregistrés`, `تغيّرت حالة ${changed.length} منتج منذ حفظه`)}>
                {tr('Le nouveau statut est affiché. Relisez l’emballage avant de les racheter.', 'الحالة الجديدة معروضة. اقرأ العلبة قبل إعادة الشراء.')}
              </Notice>
            )}
            <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80">
              {saved.items.map((item) => {
                const status = item.currentStatus || item.status;
                const kind = statusKind(status);
                const name = lang === 'ar' && item.nameAr ? item.nameAr : item.name;
                return (
                  <li key={item.key} className="flex items-start gap-3.5 px-4 py-3.5">
                    <StatusTile kind={kind} size="sm" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="text-left text-[15px] font-medium leading-snug rtl:text-right">{name}</p>
                      <p className={`mt-0.5 text-sm font-medium ${STATUS[kind].text}`}>
                        {item.currentStatus
                          ? tr(`Statut changé : ${STATUS[kind].fr} (avant : ${STATUS[statusKind(item.status)].fr})`, `تغيّرت الحالة: ${STATUS[kind].ar} (سابقا: ${STATUS[statusKind(item.status)].ar})`)
                          : lang === 'ar'
                          ? item.badgeTextAr || STATUS[kind].ar
                          : item.badgeText || STATUS[kind].fr}
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {item.brand && <span dir="auto">{item.brand} · </span>}
                        <SourceLine item={{ ...item, productKey: item.key, sourceDateKind: item.key.startsWith('atmc:') ? 'edition' : 'updated' }} lang={lang} />
                      </p>
                    </div>
                    <SaveButton item={{ ...item, productKey: item.key, productNameFr: item.name, productNameAr: item.nameAr }} lang={lang} iconOnly />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="history-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="history-heading" className="flex items-center gap-2 text-xl font-semibold">
            <History className="h-5 w-5" aria-hidden="true" />
            {tr('Derniers scans sur cet appareil', 'آخر عمليات المسح على هذا الجهاز')}
          </h2>
          {history.length > 0 && (
            <button type="button" className="btn-ghost" onClick={clearHistory}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {tr('Effacer l’historique', 'مسح السجل')}
            </button>
          )}
        </div>
        <p className="text-sm text-ink-soft">
          {tr('L’historique reste sur ce téléphone ou cet ordinateur : il n’est jamais envoyé à nos serveurs.', 'يبقى السجل على هذا الجهاز ولا يُرسل أبدا إلى خوادمنا.')}
        </p>
        {history.length === 0 ? (
          <EmptyState
            title={tr('Aucun scan pour l’instant', 'لا توجد عمليات مسح بعد')}
            action={
              <button type="button" className="btn-primary" onClick={() => navigate(pathFor('vision'))}>
                {tr('Scanner un produit', 'امسح منتجا')}
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80">
            {history.map((h) => {
              const kind = statusKind(h.status);
              const Icon = SCAN_ICONS[h.mode] || ScanText;
              return (
                <li key={`${h.mode}-${h.at}`} className="flex items-start gap-3.5 px-4 py-3.5">
                  <StatusTile kind={kind} size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="text-left text-[15px] leading-snug rtl:text-right">{h.label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className={STATUS[kind].text}>{h.detail || tr(STATUS[kind].fr, STATUS[kind].ar)}</span>
                      <span>· {when(h.at, lang)}</span>
                    </p>
                  </div>
                  {h.query && (
                    <button type="button" className="btn-ghost px-2" onClick={() => search(h.query)} aria-label={tr(`Rechercher ${h.query}`, `ابحث عن ${h.query}`)}>
                      <Search className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
