import React, { useState } from 'react';
import Navbar from './components/Navbar';
import VisionScanner from './components/VisionScanner';
import ProductSearch from './components/ProductSearch';
import TunisiaMap from './components/TunisiaMap';
import SpotModal from './components/SpotModal';
import Footer from './components/Footer';

export default function App() {
  const [activeTab, setActiveTab] = useState('vision'); // 'vision' | 'search' | 'map'
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [lang, setLang] = useState('fr');

  const handleSwitchToSearch = (query) => {
    setSearchInitialQuery(query);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`min-h-screen flex flex-col bg-canvas text-secondary-dark ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'vision' && (
          <VisionScanner onSwitchToSearch={handleSwitchToSearch} lang={lang} />
        )}

        {activeTab === 'search' && (
          <ProductSearch initialQuery={searchInitialQuery} lang={lang} />
        )}

        {activeTab === 'map' && (
          <TunisiaMap onOpenSubmitModal={() => setIsSubmitModalOpen(true)} lang={lang} />
        )}
      </main>

      {/* Community Spot Submission Modal */}
      <SpotModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => {
          // If on map tab, user will see the reload
        }}
      />

      {/* Site Footer */}
      <Footer lang={lang} />
    </div>
  );
}
