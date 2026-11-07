import React, { useState, useEffect } from 'react';
import { Search, LoaderCircle, X } from 'lucide-react';
import { searchProducts, fetchAtmcProducts } from '../services/api';
import { t, statusKind, STATUS, StatusTile, PageHead, Notice, EmptyState } from './ui';
import { SourceLine, SaveButton, ReportButton, atmcAsProduct, productTargetType, productTargetId } from './community';

const fold = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Offline: the search runs on the copy of the ATMC guide saved on the device (see src/sw.js) */
const searchSavedGuide = async (query) => {
  const res = await fetchAtmcProducts({ category: 'ALL', status: 'ALL' });
  if (!res?.offlineCopy || !Array.isArray(res.data)) return null;
  const q = fold(query.trim());
  const rows = q ? res.data.filter((p) => fold(`${p.nameFr} ${p.name} ${p.brand} ${p.categoryFr}`).includes(q)) : [];
  return rows.slice(0, 40).map((row) => ({
    ...atmcAsProduct(row),
    id: row._id,
    // The Arabic text is already the product's Arabic name: the category is the useful note
    notes: row.categoryFr,
    notesAr: row.categoryAr,
  }));
};

export default function ProductSearch({ initialQuery = '', lang }) {
  const tr = t(lang);
  const [query, setQuery] = useState(initialQuery);
  const [localQuery, setLocalQuery] = useState(initialQuery.trim());
  const [offQuery, setOffQuery] = useState(initialQuery.trim());
  const [loading, setLoading] = useState(false);
  const [localItems, setLocalItems] = useState([]);
  const [offItems, setOffItems] = useState([]);
  const [offState, setOffState] = useState('idle'); // 'idle' | 'loading' | 'ok' | 'unavailable'
  const [offRetry, setOffRetry] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setLocalQuery(initialQuery.trim());
      setOffQuery(initialQuery.trim());
    }
  }, [initialQuery]);

  // Local guides answer instantly; Open Food Facts is rate limited, so it waits for a real pause
  useEffect(() => {
    const local = setTimeout(() => setLocalQuery(query.trim()), 250);
    const off = setTimeout(() => setOffQuery(query.trim()), 900);
    return () => {
      clearTimeout(local);
      clearTimeout(off);
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    searchProducts(localQuery, 'local')
      .then((res) => {
        if (cancelled) return;
        setOffline(false);
        if (res?.success) setLocalItems(res.layerB || []);
        else setErrorMsg('failed');
      })
      .catch(async () => {
        // No connection: fall back to the guide saved on the device
        const rows = await searchSavedGuide(localQuery).catch(() => null);
        if (cancelled) return;
        if (rows) {
          setOffline(true);
          setLocalItems(rows);
        } else setErrorMsg('network');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [localQuery]);

  useEffect(() => {
    setOffItems([]);
    if (offQuery.length < 3) {
      setOffState('idle');
      return undefined;
    }
    let cancelled = false;
    setOffState('loading');
    searchProducts(offQuery, 'off')
      .then((res) => {
        if (cancelled) return;
        setOffItems(res?.layerA || []);
        setOffState(res?.offStatus === 'unavailable' ? 'unavailable' : 'ok');
      })
      .catch(() => !cancelled && setOffState('unavailable'));
    return () => {
      cancelled = true;
    };
  }, [offQuery, offRetry]);

  // Results for the previous text stay on screen until the new ones arrive
  const stale = query.trim() !== localQuery;
  const items = [...localItems, ...offItems];

  return (
    <div className="space-y-6">
      <PageHead
        title={tr('Rechercher un produit', 'ابحث عن منتج')}
        lede={tr(
          'Un nom, une marque ou un code-barres. La recherche couvre les guides tunisiens (produits locaux, vrac, souk) et Open Food Facts (produits emballés du monde entier).',
          'اسم، علامة أو رمز شريطي. يشمل البحث الأدلة التونسية (المنتجات المحلية والسائبة) وقاعدة Open Food Facts للمنتجات المعلبة.'
        )}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr('couscous, harissa, Barilla, 8076809545440…', 'كسكسي، هريسة، باريلا، 8076809545440…')}
          aria-label={tr('Nom, marque ou code-barres', 'اسم، علامة أو رمز شريطي')}
          className="field h-14 pe-12 ps-12 text-base"
        />
        <span className="absolute end-3 top-1/2 -translate-y-1/2">
          {loading || stale || offState === 'loading' ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-ink-soft" aria-label={tr('Recherche en cours', 'جاري البحث')} />
          ) : (
            query && (
              <button type="button" onClick={() => setQuery('')} className="rounded-md p-1.5 text-ink-soft hover:text-ink" aria-label={tr('Effacer', 'مسح')}>
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft" aria-live="polite">
        <p>
          {items.length} {tr(items.length > 1 ? 'résultats' : 'résultat', 'نتيجة')}
        </p>
        {offState === 'loading' && <p>{tr('Recherche dans Open Food Facts…', 'جاري البحث في Open Food Facts…')}</p>}
      </div>

      {offState === 'unavailable' && !offline && (
        <Notice
          tone="warning"
          title={tr('Open Food Facts ne répond pas pour le moment.', 'Open Food Facts لا يستجيب حاليا.')}
          action={
            <button type="button" className="btn-quiet" onClick={() => setOffRetry((n) => n + 1)}>
              {tr('Réessayer Open Food Facts', 'أعد المحاولة')}
            </button>
          }
        >
          {tr(
            'Les résultats des guides tunisiens sont affichés. Le service limite le nombre de recherches : réessayez dans une minute.',
            'تُعرض نتائج الأدلة التونسية. الخدمة تحدّ من عدد عمليات البحث: أعد المحاولة بعد دقيقة.'
          )}
        </Notice>
      )}

      {offline && (
        <Notice tone="info" title={tr('Hors ligne : recherche dans le guide ATMC enregistré sur cet appareil', 'غير متصل: البحث في دليل الجمعية المحفوظ على هذا الجهاز')}>
          {tr('Open Food Facts et les fiches de l’association reviendront avec la connexion.', 'ستعود نتائج Open Food Facts وبطاقات الجمعية مع عودة الاتصال.')}
        </Notice>
      )}

      {errorMsg && (
        <Notice tone="error" title={tr('La recherche n’a pas abouti.', 'تعذر إتمام البحث.')}>
          {tr('Vérifiez votre connexion internet puis relancez la recherche.', 'تحقق من الاتصال ثم أعد البحث.')}
        </Notice>
      )}

      {offItems.length > 0 && (
        <Notice tone="warning" title={tr('Résultats Open Food Facts : vérifiez toujours l’étiquette.', 'نتائج Open Food Facts: تحقق دائما من الملصق.')}>
          {tr(
            'Ces fiches sont remplies par des bénévoles et notre lecture des ingrédients est automatique : elles peuvent être incomplètes ou dépassées. Seul l’emballage fait foi.',
            'يملأ هذه البطاقات متطوعون وقراءتنا للمكونات آلية: قد تكون ناقصة أو قديمة. العلبة وحدها هي المرجع.'
          )}
        </Notice>
      )}

      {items.length > 0 ? (
        <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80 backdrop-blur-sm">
          {items.map((item, idx) => {
            const k = statusKind(item.status);
            const label = lang === 'ar' ? item.badgeTextAr || STATUS[k].ar : item.badgeText || STATUS[k].fr;
            const notes = lang === 'ar' ? item.notesAr || item.notes : item.notes;
            return (
              <li key={item.id || idx} className="flex gap-4 px-4 py-4 sm:px-5">
                <StatusTile kind={k} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-x-4 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 dir="auto" className="text-left text-base font-medium leading-snug rtl:text-right">
                      {lang === 'ar' && item.productNameAr ? item.productNameAr : item.productNameFr}
                    </h3>
                    <p className={`shrink-0 text-sm font-medium ${STATUS[k].text}`}>{label}</p>
                  </div>
                  {lang !== 'ar' && item.productNameAr && item.productNameAr !== item.productNameFr && (
                    <p dir="rtl" lang="ar" className="text-left text-sm text-ink-soft">
                      {item.productNameAr}
                    </p>
                  )}
                  {notes && <p dir="auto" className="mt-2 line-clamp-3 max-w-[70ch] text-left text-sm text-ink-soft rtl:text-right">{notes}</p>}
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
                    {item.brand && <span dir="auto">{item.brand}</span>}
                    {item.barcode && <span className="tabular-nums">{item.barcode}</span>}
                    <SourceLine item={item} lang={lang} />
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
                    <SaveButton item={item} lang={lang} />
                    <ReportButton
                      target={{ type: productTargetType(item), id: productTargetId(item), label: item.productNameFr || item.productNameAr }}
                      lang={lang}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !loading &&
        !stale &&
        offState !== 'loading' &&
        !errorMsg && (
          <EmptyState title={tr('Aucun résultat', 'لا توجد نتائج')}>
            {tr(
              'Essayez un autre mot (« couscous », « malsouka »), un code-barres complet, ou photographiez le produit avec le scanner.',
              'جرب كلمة أخرى، رمزا شريطيا كاملا، أو صوّر المنتج بالماسح.'
            )}
          </EmptyState>
        )
      )}
    </div>
  );
}
