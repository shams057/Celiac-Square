import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import {
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
  Tag,
  Check,
} from 'lucide-react';
import { fetchAtmcProducts, fetchAtmcCategories, fetchAtmcStats } from '../services/api';

export default function AtmcCatalog({ lang = 'fr' }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'ALLOWED' | 'TO_CHECK' | 'NOT_ALLOWED'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');

  // Load initial data
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

      if (prodRes && prodRes.data) {
        setProducts(prodRes.data);
      }
      if (catRes && catRes.data) {
        setCategories(catRes.data);
      }
      if (statRes && statRes.data) {
        setStats(statRes.data);
      }
    } catch (err) {
      console.error('Failed to load ATMC data:', err);
      setErrorMsg(
        lang === 'fr'
          ? 'Impossible de charger la base ATMC depuis le serveur.'
          : 'تعذر تحميل بيانات الجمعية من الخادم.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Configure Fuse.js for client-side typo-tolerant fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'brand', weight: 0.3 },
        { name: 'items', weight: 0.2 },
        { name: 'categoryFr', weight: 0.1 },
        { name: 'categoryAr', weight: 0.1 },
        { name: 'rawText', weight: 0.2 },
      ],
      threshold: 0.42, // Allows noticeable typos (e.g. vitalet -> vitalait, presidant -> président)
      distance: 100,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [products]);

  // Extract top popular brands for quick filter chips
  const popularBrands = useMemo(() => {
    const brandsSet = new Set();
    products.forEach((p) => {
      if (p.brand && p.brand.trim().length > 1 && p.brand.length < 25) {
        // Clean brand name
        const cleanBrand = p.brand.split(/[:\s(]/)[0].trim();
        if (cleanBrand.length >= 3) {
          brandsSet.add(cleanBrand);
        }
      }
    });
    return Array.from(brandsSet).slice(0, 10);
  }, [products]);

  // Filter and fuzzy search
  const filteredProducts = useMemo(() => {
    let result = products;

    // 1. Fuzzy search with typo tolerance if query is present
    if (searchQuery.trim().length >= 2) {
      const fuseResults = fuse.search(searchQuery.trim());
      result = fuseResults.map((r) => ({
        ...r.item,
        similarityScore: Math.round((1 - r.score) * 100),
      }));
    }

    // 2. Filter by Category
    if (selectedCategory !== 'ALL') {
      result = result.filter((p) => p.categorySlug === selectedCategory);
    }

    // 3. Filter by Status
    if (selectedStatus !== 'ALL') {
      result = result.filter((p) => p.status === selectedStatus);
    }

    // 4. Filter by Brand
    if (selectedBrand !== 'ALL') {
      result = result.filter(
        (p) =>
          (p.brand && p.brand.toLowerCase().includes(selectedBrand.toLowerCase())) ||
          p.name.toLowerCase().includes(selectedBrand.toLowerCase())
      );
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedStatus, selectedBrand, fuse]);

  // Color & Badge helpers
  const getStatusBadge = (status) => {
    if (status === 'ALLOWED') {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badge: 'bg-emerald-600 text-white',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        textFr: 'Sans Gluten / Autorisé',
        textAr: 'خالٍ من الغلوتين / مسموح',
        border: 'border-l-4 border-l-emerald-500',
      };
    }
    if (status === 'TO_CHECK') {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        badge: 'bg-amber-500 text-white',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        textFr: 'À Vérifier / Chakk',
        textAr: 'للتثبت / حذر',
        border: 'border-l-4 border-l-amber-500',
      };
    }
    return {
      bg: 'bg-red-50 text-red-800 border-red-200',
      badge: 'bg-red-600 text-white',
      icon: <XCircle className="w-4 h-4 text-red-600" />,
      textFr: 'Contient du Gluten / Interdit',
      textAr: 'يحتوي على الغلوتين / ممنوع',
      border: 'border-l-4 border-l-red-500',
    };
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-[#FAF8F2] via-white to-canvas-border/20 rounded-3xl p-6 sm:p-8 border border-canvas-border shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 text-accent-dark rounded-full text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Guide Officiel ATMC 2023' : 'الدليل الرسمي للجمعية التونسية لمرضى القمح'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-secondary-dark tracking-tight">
              {lang === 'fr' ? 'Catalogue National des Produits de Tunisie' : 'الدليل الوطني للمنتجات التونسية'}
            </h1>
            <p className="text-secondary text-sm sm:text-base leading-relaxed">
              {lang === 'fr'
                ? "Consultez l'ensemble des produits alimentaires disponibles en Tunisie répertoriés par l'Association Tunisienne de la Maladie Cœliaque (ATMC) avec la collaboration de Mme Zeineb Ben Ameur (Nutritionniste, Hôpital La Rabta)."
                : 'اطلع على جميع المواد والمنتجات الغذائية المتوفرة في تونس والمصنفة من طرف الجمعية التونسية لمرض القمح (ATMC) بالتعاون مع أخصائية التغذية بمستشفى الرابطة السيدة زينب بن عامر.'}
            </p>
          </div>

          {/* Stats Summary Cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full md:w-auto shrink-0">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                <span className="text-xl sm:text-2xl font-black text-emerald-700">{stats.allowed}</span>
                <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-tight">
                  {lang === 'fr' ? 'Autorisés' : 'مسموح'}
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                <span className="text-xl sm:text-2xl font-black text-amber-700">{stats.toCheck}</span>
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-tight">
                  {lang === 'fr' ? 'À vérifier' : 'للتثبت'}
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                <span className="text-xl sm:text-2xl font-black text-red-700">{stats.notAllowed}</span>
                <p className="text-[11px] font-bold text-red-800 uppercase tracking-tight">
                  {lang === 'fr' ? 'Interdits' : 'ممنوع'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-canvas-border shadow-sm space-y-4">
        {/* Typo-Tolerant Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'fr'
                ? "Rechercher un produit, une marque, un ingrédient (ex: Vitalait, Délice, Sicam, Makroudh... tolérance aux fautes de frappe)"
                : 'ابحث عن منتج، علامة تجارية، مكون (مثال: ديليس، سيكام، زبدة، طماطم... يدعم الأخطاء الإملائية)'
            }
            className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-canvas-border bg-canvas/30 text-secondary-dark placeholder-secondary/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm sm:text-base font-medium transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-secondary hover:text-secondary-dark text-sm font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Popular Brand Chips */}
        {popularBrands.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-secondary font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              {lang === 'fr' ? 'Marques populaires :' : 'علامات شائعة:'}
            </span>
            <button
              onClick={() => setSelectedBrand('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                selectedBrand === 'ALL'
                  ? 'bg-secondary-dark text-white'
                  : 'bg-canvas text-secondary hover:bg-canvas-border'
              }`}
            >
              {lang === 'fr' ? 'Toutes' : 'الكل'}
            </button>
            {popularBrands.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(selectedBrand === brand ? 'ALL' : brand)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedBrand === brand
                    ? 'bg-accent text-white font-bold'
                    : 'bg-canvas text-secondary-dark hover:bg-canvas-border'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        )}

        {/* Status Filters & Counter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-canvas-border/50">
          {/* Status Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Statut:
            </span>
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStatus === 'ALL'
                  ? 'bg-secondary-dark text-white shadow-sm'
                  : 'bg-canvas text-secondary-dark hover:bg-canvas-border/60'
              }`}
            >
              {lang === 'fr' ? 'Tous' : 'الكل'} ({products.length})
            </button>
            <button
              onClick={() => setSelectedStatus('ALLOWED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStatus === 'ALLOWED'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Sans Gluten (Autorisé)' : 'خالٍ من الغلوتين (مسموح)'}</span>
            </button>
            <button
              onClick={() => setSelectedStatus('TO_CHECK')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStatus === 'TO_CHECK'
                  ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'À vérifier (Chakk)' : 'للتثبت (حذر)'}</span>
            </button>
            <button
              onClick={() => setSelectedStatus('NOT_ALLOWED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStatus === 'NOT_ALLOWED'
                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300'
                  : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Interdit' : 'ممنوع'}</span>
            </button>
          </div>

          {/* Results count */}
          <div className="text-xs text-secondary font-medium">
            <span className="font-extrabold text-secondary-dark">{filteredProducts.length}</span>{' '}
            {lang === 'fr' ? 'produits affichés' : 'منتج معروض'}
          </div>
        </div>

        {/* Category Pills Navigation */}
        <div className="pt-2 border-t border-canvas-border/40">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-primary text-white shadow-sm scale-105'
                  : 'bg-canvas text-secondary-dark hover:bg-canvas-border/60'
              }`}
            >
              {lang === 'fr' ? 'Toutes Catégories' : 'جميع الأصناف'}
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setSelectedCategory(cat.categorySlug)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat.categorySlug
                    ? 'bg-primary text-white shadow-sm scale-105'
                    : 'bg-canvas text-secondary-dark hover:bg-canvas-border/60'
                }`}
              >
                <span>{lang === 'fr' ? cat.categoryFr : cat.categoryAr}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedCategory === cat.categorySlug
                      ? 'bg-white/20 text-white'
                      : 'bg-canvas-border text-secondary'
                  }`}
                >
                  {cat.totalCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Products Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="font-semibold text-sm">
            {lang === 'fr' ? 'Chargement des produits ATMC...' : 'جاري تحميل دليل المنتجات...'}
          </p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-800">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-bold">{errorMsg}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700"
          >
            {lang === 'fr' ? 'Réessayer' : 'إعادة المحاولة'}
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-canvas-border">
          <Info className="w-10 h-10 text-secondary/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-secondary-dark mb-1">
            {lang === 'fr' ? 'Aucun produit trouvé' : 'لم يتم العثور على أي منتج'}
          </h3>
          <p className="text-sm text-secondary max-w-md mx-auto mb-4">
            {lang === 'fr'
              ? 'Essayez de modifier votre recherche ou de réinitialiser les filtres de catégorie et de statut.'
              : 'يرجى تجربة كلمة بحث أخرى أو إعادة تعيين عوامل التصفية.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
              setSelectedStatus('ALL');
              setSelectedBrand('ALL');
            }}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow hover:bg-primary-dark"
          >
            {lang === 'fr' ? 'Réinitialiser tous les filtres' : 'إعادة تعيين الكل'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((item) => {
            const badge = getStatusBadge(item.status);
            return (
              <div
                key={item._id}
                className={`bg-white rounded-2xl p-5 border border-canvas-border/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${badge.border}`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Category & Similarity Match */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-secondary px-2.5 py-0.5 bg-canvas rounded-lg truncate">
                      {lang === 'fr' ? item.categoryFr : item.categoryAr}
                    </span>

                    {/* Typo similarity badge if present */}
                    {item.similarityScore && item.similarityScore < 100 && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent-dark font-extrabold text-[11px] flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {item.similarityScore}% {lang === 'fr' ? 'similarité' : 'تطابق'}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold ${badge.bg}`}>
                      {badge.icon}
                      <span>{lang === 'fr' ? badge.textFr : badge.textAr}</span>
                    </div>
                  </div>

                  {/* Product Title / Brand */}
                  <div>
                    {item.brand && (
                      <span className="text-xs font-black text-primary uppercase tracking-wide block mb-0.5">
                        {item.brand}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-secondary-dark leading-snug">
                      {item.name}
                    </h3>
                  </div>

                  {/* Sub-items / Chips if extracted */}
                  {item.items && item.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.items.map((subItem, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-canvas text-secondary-dark text-[11px] font-medium border border-canvas-border/60"
                        >
                          {subItem}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Reference */}
                <div className="pt-4 mt-3 border-t border-canvas-border/40 flex items-center justify-between text-[11px] text-secondary">
                  <span>{item.source || 'ATMC 2023'}</span>
                  <span className="font-bold text-secondary-dark/70">
                    {lang === 'fr' ? item.categoryFr : item.categoryAr}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
