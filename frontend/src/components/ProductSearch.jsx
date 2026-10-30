import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Barcode,
  Layers,
  Filter,
  RefreshCw,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { searchProducts } from '../services/api';

export default function ProductSearch({ initialQuery = '', lang }) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ layerA: [], layerB: [], combined: [] });
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'ATC' | 'OFF' | 'SAFE' | 'UNSAFE' | 'RISK'
  const [errorMsg, setErrorMsg] = useState('');

  // Handle external initial query changes
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setDebouncedQuery(initialQuery);
    }
  }, [initialQuery]);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search whenever debouncedQuery changes
  useEffect(() => {
    const doSearch = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await searchProducts(debouncedQuery);
        if (res && res.success) {
          setData(res);
        } else {
          setErrorMsg('Impossible de charger les données produits.');
        }
      } catch (err) {
        console.error('Search error:', err);
        setErrorMsg('Erreur de connexion. Vérifiez votre réseau ou le serveur.');
      } finally {
        setLoading(false);
      }
    };

    doSearch();
  }, [debouncedQuery]);

  // Filter items
  const allItems = data.combined || [...(data.layerB || []), ...(data.layerA || [])];

  const filteredItems = allItems.filter((item) => {
    if (activeFilter === 'ATC') return item.source === 'Association Tunisienne de la Cœliaque';
    if (activeFilter === 'OFF') return item.source === 'Open Food Facts';
    if (activeFilter === 'SAFE') return item.status === 'SAFE';
    if (activeFilter === 'UNSAFE') return item.status === 'UNSAFE';
    if (activeFilter === 'RISK') return item.status === 'CROSS_CONTAMINATION_RISK' || item.status === 'WARNING';
    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-canvas-card via-[#FAF8F2] to-canvas/60 rounded-3xl p-6 sm:p-8 border border-canvas-border shadow-sm">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 text-primary-dark text-xs font-extrabold mb-3">
            <Layers className="w-4 h-4 text-primary" />
            <span>DOUBLE COUCHE DE VÉRIFICATION : ATC + OPEN FOOD FACTS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-secondary-dark tracking-tight leading-tight">
            Recherche Hybride & Vérification des Étiquettes
          </h1>
          <p className="mt-2 text-base text-secondary/90 leading-relaxed">
            Interrogez d'un seul geste la base locale de l'<strong>Association Tunisienne de la Cœliaque</strong> (viandes, épices du souk, huiles, graines, farines locales) et la base mondiale <strong>Open Food Facts</strong> (produits emballés, codes-barres).
          </p>
        </div>
      </div>

      {/* Unified Search Input */}
      <div className="bg-[#FAF8F2] rounded-3xl p-6 border border-canvas-border shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-secondary/60" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un aliment, une marque ou un code-barres (ex: couscous, harissa, drou3, Barilla, 8076809545440)..."
            className="w-full pl-13 pr-12 py-4 rounded-2xl bg-white border border-canvas-border text-secondary-dark font-medium placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base shadow-sm"
          />
          {loading && (
            <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-accent animate-spin" />
          )}
        </div>

        {/* Filters & Tags */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-canvas-border/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-secondary flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filtres :
            </span>

            {[
              { id: 'ALL', label: 'Tous les résultats', count: allItems.length },
              { id: 'ATC', label: 'Guide ATC Tunisie', count: (data.layerB || []).length },
              { id: 'OFF', label: 'Open Food Facts', count: (data.layerA || []).length },
              { id: 'SAFE', label: 'Sans Gluten', color: 'text-primary' },
              { id: 'RISK', label: 'Risque Contamination', color: 'text-accent' },
              { id: 'UNSAFE', label: 'Contient Gluten', color: 'text-status-unsafe' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeFilter === f.id
                    ? 'bg-secondary text-white shadow-sm'
                    : 'bg-canvas/50 text-secondary-dark hover:bg-white border border-canvas-border/60'
                }`}
              >
                {f.label} {f.count !== undefined ? `(${f.count})` : ''}
              </button>
            ))}
          </div>

          <div className="text-xs text-secondary/80 font-medium">
            {filteredItems.length} produit{filteredItems.length > 1 ? 's' : ''} trouvé{filteredItems.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-status-unsafe/10 border border-status-unsafe/30 text-status-unsafe text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Results Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, idx) => {
            const isSafe = item.status === 'SAFE';
            const isUnsafe = item.status === 'UNSAFE';
            const isRisk = item.status === 'CROSS_CONTAMINATION_RISK' || item.status === 'WARNING';

            const badgeBg = isSafe
              ? 'bg-primary/15 text-primary-dark border-primary/30'
              : isUnsafe
              ? 'bg-status-unsafe/15 text-status-unsafe border-status-unsafe/30'
              : 'bg-accent/15 text-accent-dark border-accent/30';

            const sourceIsATC = item.source === 'Association Tunisienne de la Cœliaque';

            return (
              <div
                key={item.id || idx}
                className="bg-[#FAF8F2] rounded-3xl p-6 border border-canvas-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Layer & Source Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${badgeBg} flex items-center gap-1.5`}
                    >
                      {isSafe ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      ) : isUnsafe ? (
                        <XCircle className="w-3.5 h-3.5 text-status-unsafe" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-accent" />
                      )}
                      <span>{item.badgeText || (isSafe ? 'Sans Gluten' : isUnsafe ? 'Contient du Gluten' : 'Risque Contamination')}</span>
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sourceIsATC
                          ? 'bg-primary/10 text-primary-dark border-primary/20'
                          : 'bg-secondary/10 text-secondary-dark border-secondary/20'
                      }`}
                    >
                      {sourceIsATC ? 'ATC Tunisie 🇹🇳' : 'Open Food Facts 🌐'}
                    </span>
                  </div>

                  {/* Product Title */}
                  <h3 className="text-xl font-extrabold text-secondary-dark group-hover:text-primary transition-colors leading-snug">
                    {item.productNameFr}
                  </h3>

                  {item.productNameAr && (
                    <p className="text-base font-bold text-secondary font-arabic mt-1">
                      {item.productNameAr}
                    </p>
                  )}

                  {/* Brand & Barcode */}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-secondary/80">
                    <span className="font-semibold">{item.brand}</span>
                    {item.barcode && (
                      <span className="flex items-center gap-1 bg-canvas/60 px-2 py-0.5 rounded font-mono text-[11px]">
                        <Barcode className="w-3.5 h-3.5" />
                        {item.barcode}
                      </span>
                    )}
                  </div>

                  {/* Guidance & Health Notes */}
                  <div className="mt-4 p-3.5 rounded-2xl bg-canvas/40 border border-canvas-border/50 text-xs text-secondary-dark leading-relaxed">
                    <p>{item.notes}</p>
                    {item.notesAr && (
                      <p className="mt-2 text-secondary-dark/90 font-arabic border-t border-canvas-border/40 pt-2">
                        {item.notesAr}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Attribution Reference */}
                <div className="mt-5 pt-3 border-t border-canvas-border/50 flex items-center justify-between text-[11px] text-secondary/70">
                  <span className="truncate max-w-[220px]" title={item.officialDocReference}>
                    {item.officialDocReference || item.source}
                  </span>
                  {sourceIsATC ? (
                    <span className="font-bold text-primary flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Fiche ATC
                    </span>
                  ) : (
                    <span className="font-bold text-secondary flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Base OFF
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="bg-[#FAF8F2] rounded-3xl p-12 text-center border border-canvas-border">
            <Search className="w-12 h-12 text-secondary/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-secondary-dark">Aucun produit trouvé</h3>
            <p className="text-xs text-secondary max-w-md mx-auto mt-1">
              Essayez une autre recherche (ex: "couscous", "harissa", "malsouka", "barilla") ou utilisez notre scanner visuel par caméra.
            </p>
          </div>
        )
      )}
    </div>
  );
}
