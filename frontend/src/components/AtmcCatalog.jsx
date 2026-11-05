import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { Search, X } from 'lucide-react';
import { fetchAtmcProducts, fetchAtmcCategories, fetchAtmcStats } from '../services/api';
import { t, statusKind, STATUS, StatusTile, PageHead, Notice, EmptyState, FilterSheet } from './ui';

// Lowercase without accents, so "the" matches "Thé"
const fold = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const STATUS_FILTERS = [
  { id: 'ALLOWED', kind: 'safe', countKey: 'allowed', fr: 'Autorisés', ar: 'مسموح' },
  { id: 'TO_CHECK', kind: 'warning', countKey: 'toCheck', fr: 'À vérifier', ar: 'للتثبت' },
  { id: 'NOT_ALLOWED', kind: 'unsafe', countKey: 'notAllowed', fr: 'Interdits', ar: 'ممنوع' },
];

// "Brand: products" entries: the part before the first colon is set apart
const splitName = (name) => {
  const idx = name.indexOf(':');
  if (idx > 0 && idx < 60) return { head: name.slice(0, idx).trim(), rest: name.slice(idx + 1).trim() };
  return { head: '', rest: name };
};

export default function AtmcCatalog({ lang = 'fr' }) {
  const tr = t(lang);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [prodRes, catRes, statRes] = await Promise.all([
        fetchAtmcProducts({ category: 'ALL', status: 'ALL' }),
        fetchAtmcCategories(),
        fetchAtmcStats(),
      ]);
      if (prodRes?.data) setProducts(prodRes.data);
      if (catRes?.data) setCategories(catRes.data);
      if (statRes?.data) setStats(statRes.data);
    } catch (err) {
      console.error('Failed to load ATMC data:', err);
      setErrorMsg('load');
    } finally {
      setLoading(false);
    }
  };

  // Typo-tolerant search (e.g. "vitalet" finds Vitalait)
  const fuse = useMemo(
    () =>
      new Fuse(products, {
        keys: [
          { name: 'nameFr', weight: 0.4 },
          { name: 'name', weight: 0.4 },
          { name: 'brand', weight: 0.3 },
          { name: 'items', weight: 0.2 },
          { name: 'categoryFr', weight: 0.1 },
          { name: 'categoryAr', weight: 0.1 },
          { name: 'rawText', weight: 0.2 },
        ],
        threshold: 0.3,
        distance: 100,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [products]
  );

  const filteredProducts = useMemo(() => {
    let result = products;
    const q = fold(searchQuery.trim());
    if (q.length >= 2) {
      // Exact (accent-insensitive) matches first; fuzzy matching only rescues typos
      const exact = products.filter((p) => fold(`${p.nameFr} ${p.name} ${p.brand}`).includes(q));
      result = exact.length > 0 ? exact : fuse.search(searchQuery.trim()).map((r) => r.item);
    }
    if (selectedCategory !== 'ALL') result = result.filter((p) => p.categorySlug === selectedCategory);
    if (selectedStatus !== 'ALL') result = result.filter((p) => p.status === selectedStatus);
    return result;
  }, [products, searchQuery, selectedCategory, selectedStatus, fuse]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
  };

  const categoryLabel = (c) => (lang === 'ar' ? c.categoryAr : c.categoryFr);

  const categoryList = (
    <div className="flex flex-col gap-0.5">
      <CategoryButton active={selectedCategory === 'ALL'} onClick={() => setSelectedCategory('ALL')} label={tr('Tous les rayons', 'كل الأصناف')} count={loading ? null : products.length} />
      {categories.map((cat) => (
        <CategoryButton
          key={cat._id}
          active={selectedCategory === cat.categorySlug}
          onClick={() => setSelectedCategory(cat.categorySlug)}
          label={categoryLabel(cat)}
          count={cat.totalCount}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHead
        title={tr('Que puis-je manger ?', 'ماذا يمكنني أن آكل؟')}
        lede={tr(
          `${stats ? `Les ${stats.total} produits` : 'Les produits'} vendus en Tunisie classés par l’Association Tunisienne de la Maladie Cœliaque, avec Mme Zeineb Ben Ameur, nutritionniste à La Rabta. Édition de décembre 2023.`,
          `${stats ? `${stats.total} منتجا متوفرا` : 'المنتجات المتوفرة'} في تونس صنفتها الجمعية التونسية لمرضى الأبطن بالتعاون مع السيدة زينب بن عامر، أخصائية التغذية بمستشفى الرابطة. طبعة ديسمبر 2023.`
        )}
      />

      {/* Status tiles: filter and summary at once */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label={tr('Filtrer par statut', 'تصفية حسب الحالة')}>
        {STATUS_FILTERS.map((f) => {
          const active = selectedStatus === f.id;
          const meta = STATUS[f.kind];
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedStatus(active ? 'ALL' : f.id)}
              className={`flex flex-col items-start gap-3 rounded-2xl border p-3 text-start transition-colors sm:flex-row sm:items-center sm:p-4 ${
                active ? 'border-ink bg-canvas-paper' : 'border-white/50 bg-canvas-raised/60 hover:bg-canvas-paper/80'
              }`}
            >
              <StatusTile kind={f.kind} />
              <span className="min-w-0">
                <span className="block text-2xl font-semibold leading-none tabular-nums">
                  {stats ? stats[f.countKey] : '–'}
                </span>
                <span className={`mt-1 block text-sm ${meta.text}`}>{tr(f.fr, f.ar)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:gap-8">
        {/* Rayons: white card on desktop, in the filters sheet on mobile */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-white/70 bg-canvas-paper/80 backdrop-blur-sm p-2">
            <p className="px-3 pb-1 pt-2 text-sm font-medium">{tr('Rayons', 'الأصناف')}</p>
            {categoryList}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('Rechercher…', 'ابحث…')}
              aria-label={tr('Rechercher dans le guide', 'ابحث في الدليل')}
              className="field h-12 pe-10 ps-11 text-base"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-soft hover:text-ink"
                aria-label={tr('Effacer la recherche', 'مسح البحث')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <FilterSheet lang={lang} activeCount={selectedCategory !== 'ALL' ? 1 : 0} className="h-12 shrink-0">
            <p className="mb-2 text-sm font-medium">{tr('Rayons', 'الأصناف')}</p>
            {categoryList}
          </FilterSheet>
          </div>
          {selectedCategory !== 'ALL' && (
            <p className="text-sm lg:hidden">
              {tr('Rayon :', 'الصنف:')}{' '}
              <button type="button" onClick={() => setSelectedCategory('ALL')} className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
                {categoryLabel(categories.find((c) => c.categorySlug === selectedCategory) || {})}
                <X className="h-3.5 w-3.5" />
              </button>
            </p>
          )}

          <div className="flex items-center justify-between text-sm text-ink-soft">
            <span aria-live="polite">
              {loading ? tr('Chargement…', 'جاري التحميل…') : `${filteredProducts.length} ${tr(filteredProducts.length > 1 ? 'produits' : 'produit', 'منتج')}`}
            </span>
            {(searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL') && (
              <button type="button" onClick={resetFilters} className="underline underline-offset-4 hover:text-ink">
                {tr('Tout afficher', 'عرض الكل')}
              </button>
            )}
          </div>

          {loading ? (
            <ListSkeleton label={tr('Chargement du guide…', 'جاري تحميل الدليل…')} />
          ) : errorMsg ? (
            <Notice
              tone="error"
              title={tr('Le guide n’a pas pu être chargé.', 'تعذر تحميل الدليل.')}
              action={
                <button type="button" onClick={loadData} className="btn-quiet">
                  {tr('Réessayer', 'إعادة المحاولة')}
                </button>
              }
            >
              {tr('Vérifiez votre connexion, puis réessayez.', 'تحقق من الاتصال ثم أعد المحاولة.')}
            </Notice>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title={tr('Aucun produit ne correspond', 'لا يوجد منتج مطابق')}
              action={
                <button type="button" onClick={resetFilters} className="btn-quiet">
                  {tr('Tout afficher', 'عرض الكل')}
                </button>
              }
            >
              {tr(
                'Ce produit n’est peut-être pas dans le guide. Essayez la recherche Open Food Facts ou lisez l’étiquette.',
                'قد لا يكون هذا المنتج في الدليل. جرب البحث في Open Food Facts أو اقرأ الملصق.'
              )}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80 backdrop-blur-sm">
              {filteredProducts.map((item) => {
                const kind = statusKind(item.status);
                const { head, rest } = splitName(lang === 'ar' ? item.name : item.nameFr || item.name);
                return (
                  <li key={item._id} className="flex items-start gap-3.5 px-4 py-3.5">
                    <StatusTile kind={kind} size="sm" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="text-left text-[15px] leading-snug rtl:text-right">
                        {head && <span className="font-semibold">{head} : </span>}
                        <span>{rest}</span>
                      </p>
                      <p className="mt-1 text-xs text-ink-faint sm:hidden">{categoryLabel(item)}</p>
                    </div>
                    <div className="hidden shrink-0 text-end sm:block">
                      <p className={`text-sm font-medium ${STATUS[kind].text}`}>{lang === 'ar' ? STATUS[kind].ar : STATUS[kind].fr}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">{categoryLabel(item)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Grey rows in the shape of the list while it loads, instead of "0 produit" */
function ListSkeleton({ label }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-start gap-3.5 border-b border-canvas-line/40 px-4 py-4 last:border-0" aria-hidden="true">
          <span className="h-6 w-6 shrink-0 animate-pulse rounded-tile bg-canvas-sunk" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 animate-pulse rounded bg-canvas-sunk" style={{ width: `${55 + ((i * 37) % 35)}%` }} />
            <span className="block h-3 w-24 animate-pulse rounded bg-canvas-sunk/70" />
          </span>
        </div>
      ))}
    </div>
  );
}

function CategoryButton({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-closes-sheet
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${
        active ? 'bg-ink text-canvas-paper' : 'text-ink-soft hover:bg-canvas-raised hover:text-ink'
      }`}
    >
      <span>{label}</span>
      {count != null && <span className={`tabular-nums ${active ? 'text-canvas-paper/80' : 'text-ink-faint'}`}>{count}</span>}
    </button>
  );
}
