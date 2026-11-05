import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, MapPin, Phone, Store, ShoppingBag } from 'lucide-react';
import { fetchStores, fetchMarketProducts, fetchStore } from '../services/api';
import { useAuth } from './AuthContext';
import AuthPanel from './AuthPanel';
import { t, PageHead, Spinner, Notice, EmptyState, Modal, STORE_TYPES, storeType, formatPrice, StoreLogo } from './ui';

/**
 * Gluten-free marketplace: every store's products at once, grouped by store,
 * or one store's menu. Members only.
 */
export default function Marketplace({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();

  if (!user) {
    return (
      <AuthPanel
        lang={lang}
        title={tr('Le marché est réservé aux membres', 'السوق مخصص للأعضاء')}
        lede={tr(
          'Connectez-vous ou créez un compte gratuit pour voir les produits sans gluten des restaurants, boulangeries, cafés et artisans.',
          'سجّل الدخول أو أنشئ حسابا مجانيا لترى المنتجات بدون غلوتين من المطاعم والمخابز والمقاهي والحرفيين.'
        )}
      />
    );
  }
  return <MarketBrowser lang={lang} />;
}

function MarketBrowser({ lang }) {
  const tr = t(lang);
  const [type, setType] = useState('ALL');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [storeId, setStoreId] = useState(null);
  const [openProduct, setOpenProduct] = useState(null);

  // Search as the user types, without a request per keystroke
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [storeRes, productRes] = await Promise.all([fetchStores(type), fetchMarketProducts({ type, q: search })]);
      // A store with nothing to sell yet stays out of the rail
      setStores((storeRes.data || []).filter((s) => s.productCount > 0));
      setProducts(productRes.data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [type, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stores in the rail's order, each with its products; stores with nothing to show are left out
  const sections = useMemo(() => {
    const byStore = new Map();
    products.forEach((p) => {
      if (!byStore.has(p.storeId)) byStore.set(p.storeId, []);
      byStore.get(p.storeId).push(p);
    });
    return stores.filter((s) => byStore.has(s._id)).map((s) => ({ store: s, products: byStore.get(s._id) }));
  }, [stores, products]);

  const openStore = (id) => {
    setOpenProduct(null);
    setStoreId(id);
    window.scrollTo({ top: 0 });
  };

  if (storeId) {
    return (
      <>
        <StoreMenu lang={lang} storeId={storeId} onBack={() => setStoreId(null)} onOpenProduct={setOpenProduct} />
        <ProductSheet lang={lang} product={openProduct} onClose={() => setOpenProduct(null)} />
      </>
    );
  }

  return (
    <div className="space-y-7">
      <PageHead
        title={tr('Le marché sans gluten', 'سوق بدون غلوتين')}
        lede={tr(
          'Plats, pains, douceurs et créations préparés sans gluten par des restaurants, boulangeries, cafés et artisans tunisiens.',
          'أطباق وخبز وحلويات ومنتجات حرفية بدون غلوتين من مطاعم ومخابز ومقاهٍ وحرفيين تونسيين.'
        )}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr('Chercher un produit : pain, pizza, gâteau…', 'ابحث عن منتج: خبز، بيتزا، كعكة…')}
          aria-label={tr('Chercher un produit', 'ابحث عن منتج')}
          className="field h-12 rounded-full ps-12 text-base"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0" role="group" aria-label={tr('Type de boutique', 'نوع المحل')}>
        <button type="button" className="chip" aria-pressed={type === 'ALL'} onClick={() => setType('ALL')}>
          <ShoppingBag className="h-4 w-4" />
          {tr('Tout', 'الكل')}
        </button>
        {STORE_TYPES.map(({ value, frPlural, arPlural, icon: Icon }) => (
          <button key={value} type="button" className="chip" aria-pressed={type === value} onClick={() => setType(value)}>
            <Icon className="h-4 w-4" />
            {tr(frPlural, arPlural)}
          </button>
        ))}
      </div>

      {stores.length > 0 && (
        <section aria-labelledby="stores-heading">
          <h2 id="stores-heading" className="text-lg font-semibold">{tr('Boutiques', 'المحلات')}</h2>
          <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
            {stores.map((store) => (
              <li key={store._id} className="snap-start">
                <button
                  type="button"
                  onClick={() => openStore(store._id)}
                  className="panel flex w-40 flex-col items-center gap-2 px-3 py-4 text-center transition-transform hover:-translate-y-0.5 sm:w-44"
                >
                  <StoreLogo store={store} className="h-14 w-14" />
                  <span className="line-clamp-1 text-sm font-medium">{store.name}</span>
                  <span className="text-xs text-ink-soft">
                    {tr(storeType(store.type).fr, storeType(store.type).ar)}
                    {store.productCount ? ` · ${store.productCount}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading && products.length === 0 ? (
        <Spinner label={tr('Chargement du marché…', 'جاري تحميل السوق…')} />
      ) : error ? (
        <Notice
          tone="error"
          title={tr('Le marché n’a pas pu être chargé.', 'تعذر تحميل السوق.')}
          action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>}
        />
      ) : search ? (
        <section aria-live="polite">
          <p className="text-sm text-ink-soft">
            {tr(`${products.length} produit${products.length > 1 ? 's' : ''} pour « ${search} »`, `${products.length} منتج لـ «${search}»`)}
          </p>
          {products.length === 0 ? (
            <div className="mt-4">
              <EmptyState title={tr('Aucun produit ne correspond', 'لا يوجد منتج مطابق')}>
                {tr('Essayez un autre mot, ou une autre catégorie.', 'جرّب كلمة أخرى أو صنفا آخر.')}
              </EmptyState>
            </div>
          ) : (
            <ProductGrid lang={lang} products={products} showStore onOpen={setOpenProduct} />
          )}
        </section>
      ) : sections.length === 0 ? (
        <EmptyState title={tr('Rien en vitrine pour le moment', 'لا شيء معروض حاليا')}>
          {tr('Les boutiques ajoutent leurs produits : revenez bientôt.', 'المحلات تضيف منتجاتها: عد قريبا.')}
        </EmptyState>
      ) : (
        <div className="space-y-9">
          {sections.map(({ store, products: items }) => (
            <section key={store._id} aria-labelledby={`store-${store._id}`}>
              <div className="flex items-center gap-3">
                <StoreLogo store={store} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <h2 id={`store-${store._id}`} className="truncate text-lg font-semibold">{store.name}</h2>
                  <p className="truncate text-xs text-ink-soft">
                    {tr(storeType(store.type).fr, storeType(store.type).ar)}
                    {store.city ? ` · ${store.city}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => openStore(store._id)} className="btn-ghost shrink-0 px-3">
                  {tr('Voir tout', 'عرض الكل')}
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
              <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
                {items.map((product) => (
                  <li key={product._id} className="w-44 shrink-0 snap-start sm:w-52">
                    <ProductCard lang={lang} product={product} onOpen={setOpenProduct} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ProductSheet lang={lang} product={openProduct} onClose={() => setOpenProduct(null)} onOpenStore={openStore} />
    </div>
  );
}

/** One store's menu, with a search inside it */
function StoreMenu({ lang, storeId, onBack, onOpenProduct }) {
  const tr = t(lang);
  const [store, setStore] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchStore(storeId)
      .then((res) => {
        if (cancelled) return;
        // Give each product its store, as in the all-stores list (placeholder icon, sheet subtitle)
        const { products: items, ...info } = res.data;
        setStore({ ...info, products: items.map((p) => ({ ...p, store: info })) });
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = store?.products || [];
    return q ? items.filter((p) => `${p.title} ${p.description}`.toLowerCase().includes(q)) : items;
  }, [store, query]);

  const back = (
    <button type="button" onClick={onBack} className="btn-ghost -ms-3 px-3">
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      {tr('Toutes les boutiques', 'كل المحلات')}
    </button>
  );

  if (error) return <div className="space-y-4">{back}<Notice tone="error" title={tr('Cette boutique n’est pas disponible.', 'هذا المحل غير متاح.')} /></div>;
  if (!store) return <div className="space-y-4">{back}<Spinner label={tr('Chargement de la boutique…', 'جاري تحميل المحل…')} /></div>;

  const type = storeType(store.type);
  return (
    <div className="space-y-6">
      {back}
      <header className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <StoreLogo store={store} className="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: type.color }}>{tr(type.fr, type.ar)}</p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{store.name}</h1>
          {store.description && <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">{store.description}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            {(store.address || store.city) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {[store.address, store.city].filter(Boolean).join(', ')}
              </span>
            )}
            {store.phone && (
              <a href={`tel:${store.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink" dir="ltr">
                <Phone className="h-4 w-4" />
                {store.phone}
              </a>
            )}
          </div>
        </div>
      </header>

      {store.products.length > 4 && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(`Chercher chez ${store.name}`, `ابحث في ${store.name}`)}
            className="field ps-10"
          />
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState title={store.products.length ? tr('Aucun produit ne correspond', 'لا يوجد منتج مطابق') : tr('Pas encore de produits', 'لا منتجات بعد')} />
      ) : (
        <ProductGrid lang={lang} products={products} onOpen={onOpenProduct} />
      )}
    </div>
  );
}

function ProductGrid({ lang, products, showStore = false, onOpen }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p._id}>
          <ProductCard lang={lang} product={p} showStore={showStore} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function ProductImage({ product, className = '' }) {
  const type = storeType(product.store?.type);
  const Icon = type.icon;
  if (product.images?.[0]) {
    return <img src={product.images[0]} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <span className={`flex h-full w-full items-center justify-center bg-canvas-sunk/70 text-ink-faint ${className}`} aria-hidden="true">
      {product.store ? <Icon className="h-8 w-8" strokeWidth={1.5} /> : <Store className="h-8 w-8" strokeWidth={1.5} />}
    </span>
  );
}

function ProductCard({ lang, product, showStore = false, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-canvas-paper/80 text-start shadow-[0_1px_2px_rgba(47,38,29,0.05)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-14px_rgba(47,38,29,0.4)]"
    >
      <div className="aspect-[4/3] w-full overflow-hidden">
        <ProductImage product={product} className="transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.title}</p>
        {showStore && product.store && <p className="truncate text-xs text-ink-soft">{product.store.name}</p>}
        {product.price != null && <p className="mt-auto pt-1 text-sm font-semibold tabular-nums">{formatPrice(product.price, lang)}</p>}
      </div>
    </button>
  );
}

/** Product details: photos, description, price and its store */
function ProductSheet({ lang, product, onClose, onOpenStore }) {
  const tr = t(lang);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [product]);
  if (!product) return null;

  const images = product.images || [];
  return (
    <Modal open={Boolean(product)} onClose={onClose} lang={lang} title={product.title} subtitle={product.store?.name} width="max-w-2xl">
      <div className="space-y-5">
        {images.length > 0 && (
          <div>
            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-canvas-sunk">
              <img src={images[index]} alt={product.title} className="h-full w-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-none">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={tr(`Photo ${i + 1}`, `الصورة ${i + 1}`)}
                    aria-pressed={i === index}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${i === index ? 'ring-accent' : 'ring-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {product.price != null && <p className="text-2xl font-semibold tabular-nums">{formatPrice(product.price, lang)}</p>}
        {product.description ? (
          <p className="whitespace-pre-line text-[15px] text-ink-soft">{product.description}</p>
        ) : (
          <p className="text-sm text-ink-faint">{tr('Pas de description.', 'لا يوجد وصف.')}</p>
        )}

        {product.store && onOpenStore && (
          <button type="button" onClick={() => onOpenStore(product.store._id)} className="btn-quiet w-full justify-start">
            <StoreLogo store={product.store} className="h-8 w-8" />
            <span className="flex-1 text-start">{tr(`Voir la boutique ${product.store.name}`, `زيارة محل ${product.store.name}`)}</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        )}
      </div>
    </Modal>
  );
}
