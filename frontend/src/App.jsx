import React, { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Navbar from './components/Navbar';
import VisionScanner from './components/VisionScanner';
import ProductSearch from './components/ProductSearch';
import AtmcCatalog from './components/AtmcCatalog';
import TunisiaMap from './components/TunisiaMap';
import Marketplace from './components/Marketplace';
import AuthPanel from './components/AuthPanel';
import SellerDashboard from './components/SellerDashboard';
import BecomeSeller from './components/BecomeSeller';
import Backoffice from './components/Backoffice';
import SpotModal from './components/SpotModal';
import Footer from './components/Footer';
import { AuthProvider, useAuth } from './components/AuthContext';

// Dock tabs first, then pages reached from the account menu and the footer
const TAB_ORDER = ['atmc', 'vision', 'search', 'map', 'market', 'account', 'seller', 'become-seller', 'backoffice'];

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('atmc');
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [lang, setLang] = useState('fr');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Slide direction follows the tab order: a tab further along slides in from the end side
  const [slide, setSlide] = useState('');
  const goTo = (tab) => {
    if (tab === activeTab) return;
    setSlide(TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(activeTab) ? 'animate-page-from-end' : 'animate-page-from-start');
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

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-4 pb-32 pt-6 sm:px-6 sm:pt-10">
        <div key={activeTab} className={slide}>
        {activeTab === 'atmc' && <AtmcCatalog lang={lang} />}
        {activeTab === 'vision' && <VisionScanner onSwitchToSearch={handleSwitchToSearch} lang={lang} />}
        {activeTab === 'search' && <ProductSearch initialQuery={searchInitialQuery} lang={lang} />}
        {activeTab === 'map' && (
          <TunisiaMap key={mapRefreshKey} onOpenSubmitModal={() => setIsSubmitModalOpen(true)} lang={lang} />
        )}
        {activeTab === 'market' && <Marketplace lang={lang} />}
        {activeTab === 'account' && <AuthPanel lang={lang} onDone={() => goTo('market')} />}
        {activeTab === 'seller' && (user ? <SellerDashboard lang={lang} /> : <AuthPanel lang={lang} />)}
        {activeTab === 'become-seller' && <BecomeSeller lang={lang} onOpenShop={() => goTo('seller')} />}
        {activeTab === 'backoffice' && <Backoffice lang={lang} />}
        </div>
      </main>

      <SpotModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => setMapRefreshKey((k) => k + 1)}
        lang={lang}
      />

      <Footer
        lang={lang}
        isAdmin={user?.role === 'ADMIN'}
        onOpenBackoffice={() => goTo('backoffice')}
        onBecomeSeller={() => goTo('become-seller')}
      />
      <Analytics />
    </div>
  );
}
