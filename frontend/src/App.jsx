import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import VisionScanner from './components/VisionScanner';
import ProductSearch from './components/ProductSearch';
import AtmcCatalog from './components/AtmcCatalog';
import TunisiaMap from './components/TunisiaMap';
import BackofficeSpots from './components/BackofficeSpots';
import SpotModal from './components/SpotModal';
import Footer from './components/Footer';

export default function App() {
  const [activeTab, setActiveTab] = useState('atmc'); // 'atmc' | 'vision' | 'search' | 'map' | 'backoffice'
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [lang, setLang] = useState('fr');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const goTo = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  const handleSwitchToSearch = (query) => {
    setSearchInitialQuery(query);
    goTo('search');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas-paper">
        {lang === 'ar' ? 'انتقل إلى المحتوى' : 'Aller au contenu'}
      </a>

      <Navbar
        activeTab={activeTab}
        setActiveTab={goTo}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        lang={lang}
        setLang={setLang}
      />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-16">
        {activeTab === 'atmc' && <AtmcCatalog lang={lang} />}
        {activeTab === 'vision' && <VisionScanner onSwitchToSearch={handleSwitchToSearch} lang={lang} />}
        {activeTab === 'search' && <ProductSearch initialQuery={searchInitialQuery} lang={lang} />}
        {activeTab === 'map' && (
          <TunisiaMap key={mapRefreshKey} onOpenSubmitModal={() => setIsSubmitModalOpen(true)} lang={lang} />
        )}
        {activeTab === 'backoffice' && <BackofficeSpots lang={lang} />}
      </main>

      <SpotModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => setMapRefreshKey((k) => k + 1)}
        lang={lang}
      />

      <Footer lang={lang} onOpenBackoffice={() => goTo('backoffice')} />
    </div>
  );
}
