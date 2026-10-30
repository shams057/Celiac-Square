import React from 'react';
import { ShieldCheck, MapPin, Search, Camera, PlusCircle, Globe, Heart } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenSubmitModal, lang, setLang }) {
  return (
    <header className="sticky top-0 z-50 bg-[#FAF8F2] border-b border-canvas-border/60 shadow-sm backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <div 
            onClick={() => setActiveTab('vision')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/30 group-hover:scale-105 transition-transform duration-300">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-secondary-dark">
                  Celiac<span className="text-accent">Square</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary-dark px-2 py-0.5 rounded-full border border-primary/20">
                  Tunisie 🇹🇳
                </span>
              </div>
              <p className="text-xs text-secondary/80 font-medium">
                {lang === 'fr' ? 'Plateforme Cœliaque & Sans Gluten' : 'المنصة التونسية لمرضى حساسية الغلوتين'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-canvas/40 p-1.5 rounded-2xl border border-canvas-border/40">
            <button
              onClick={() => setActiveTab('vision')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'vision'
                  ? 'bg-accent text-white shadow-md shadow-accent/25 scale-[1.02]'
                  : 'text-secondary-dark hover:bg-white/80'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Scanner Vision IA' : 'الماسح الذكي'}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${activeTab === 'vision' ? 'bg-white/30 text-white' : 'bg-accent/20 text-accent-dark'}`}>
                Principal
              </span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'search'
                  ? 'bg-primary text-white shadow-md shadow-primary/25 scale-[1.02]'
                  : 'text-secondary-dark hover:bg-white/80'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Recherche Hybride' : 'دليل المنتجات'}</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'map'
                  ? 'bg-secondary text-white shadow-md shadow-secondary/25 scale-[1.02]'
                  : 'text-secondary-dark hover:bg-white/80'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Carte de Tunisie' : 'خريطة تونس'}</span>
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-canvas-border/70 hover:bg-white transition-colors text-secondary-dark"
              title="Changer de langue"
            >
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span>{lang === 'fr' ? 'العربية' : 'Français'}</span>
            </button>

            {/* Propose a spot modal trigger */}
            <button
              onClick={onOpenSubmitModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold shadow hover:bg-primary-dark transition-all duration-200 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">
                {lang === 'fr' ? 'Proposer une Adresse' : 'إضافة عنوان'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2.5 border-t border-canvas-border/40 text-xs">
          <button
            onClick={() => setActiveTab('vision')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg font-semibold ${
              activeTab === 'vision' ? 'text-accent font-bold' : 'text-secondary'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span>Vision IA</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg font-semibold ${
              activeTab === 'search' ? 'text-primary font-bold' : 'text-secondary'
            }`}
          >
            <Search className="w-5 h-5" />
            <span>Recherche</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg font-semibold ${
              activeTab === 'map' ? 'text-secondary-dark font-bold' : 'text-secondary'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span>Carte</span>
          </button>
        </div>
      </div>
    </header>
  );
}
