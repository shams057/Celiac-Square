import React, { useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Navbar from './components/Navbar';
import VisionScanner from './components/VisionScanner';
import ProductSearch from './components/ProductSearch';
import AtmcCatalog from './components/AtmcCatalog';
import TunisiaMap from './components/TunisiaMap';
import Marketplace from './components/Marketplace';
import AuthPanel from './components/AuthPanel';
import ResetPassword from './components/ResetPassword';
import SellerDashboard from './components/SellerDashboard';
import BecomeSeller from './components/BecomeSeller';
import Backoffice from './components/Backoffice';
import Privacy from './components/Privacy';
import SpotModal from './components/SpotModal';
import Footer from './components/Footer';
import SavedProducts from './components/SavedProducts';
import MyOrders from './components/MyOrders';
import AccountProfile from './components/AccountProfile';
import { CartProvider, CartSheet } from './components/orders';
import { SavedProvider } from './components/community';
import { WifiOff } from 'lucide-react';
import { AuthProvider, useAuth } from './components/AuthContext';
import { navigate, pathFor, useRoute } from './services/router';

// Dock tabs first, then pages reached from the account menu and the footer
const TAB_ORDER = ['atmc', 'search', 'vision', 'map', 'market', 'account', 'reset-password', 'seller', 'become-seller', 'backoffice', 'privacy', 'saved', 'orders'];

const PAGE_TITLES = {
  atmc: ['Guide ATMC', 'دليل الجمعية'],
  vision: ['Scanner un produit', 'امسح منتجا'],
  search: ['Rechercher un produit', 'ابحث عن منتج'],
  map: ['Carte des adresses', 'خريطة العناوين'],
  market: ['Marché sans gluten', 'سوق بدون غلوتين'],
  account: ['Mon compte', 'حسابي'],
  'reset-password': ['Nouveau mot de passe', 'كلمة مرور جديدة'],
  seller: ['Ma boutique', 'محلي'],
  'become-seller': ['Devenir vendeur', 'كن بائعا'],
  backoffice: ['Back-office', 'فضاء الإدارة'],
  privacy: ['Confidentialité', 'الخصوصية'],
  saved: ['Mes produits', 'منتجاتي'],
  orders: ['Mes commandes', 'طلباتي'],
};

const SITE = {
  fr: { name: 'Celiac Square', tagline: 'Manger sans gluten en Tunisie', description: 'Le guide ATMC des produits sans gluten, un scanner de produits et la carte des adresses sûres pour les cœliaques en Tunisie.' },
  ar: { name: 'Celiac Square', tagline: 'الأكل بدون غلوتين في تونس', description: 'دليل الجمعية للمنتجات بدون غلوتين، ماسح للمنتجات وخريطة العناوين الموثوقة لمرضى الأبطن في تونس.' },
};

const LANG_KEY = 'celiac-square-lang';

// The saved choice, otherwise the browser's language (Arabic or French)
const initialLang = () => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'fr' || saved === 'ar') return saved;
  } catch {
    // storage unavailable
  }
  return (navigator.languages || [navigator.language]).some((l) => String(l).toLowerCase().startsWith('ar')) ? 'ar' : 'fr';
};

const setMeta = (selector, value) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute('content', value);
};

export default function App() {
  return (
    <AuthProvider>
      <SavedProvider>
        <CartProvider>
          <AppShell />
        </CartProvider>
      </SavedProvider>
    </AuthProvider>
  );
}

/** navigator.onLine, kept up to date */
function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function AppShell() {
  const { user } = useAuth();
  const online = useOnline();
  const route = useRoute();
  const activeTab = route.tab;
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [lang, setLangState] = useState(initialLang);
  const [slide, setSlide] = useState('');
  const previousTab = useRef(activeTab);
  const firstRender = useRef(true);
  const mainRef = useRef(null);

  const setLang = (next) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // storage unavailable
    }
  };

  // Document language, direction, title and description follow the page and the language
  useEffect(() => {
    const site = SITE[lang];
    const [fr, ar] = PAGE_TITLES[activeTab] || PAGE_TITLES.vision;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = activeTab === 'vision' ? `${site.name} — ${site.tagline}` : `${lang === 'ar' ? ar : fr} · ${site.name}`;
    setMeta('meta[name="description"]', site.description);
    setMeta('meta[property="og:title"]', `${site.name} — ${site.tagline}`);
    setMeta('meta[property="og:description"]', site.description);
    setMeta('meta[property="og:locale"]', lang === 'ar' ? 'ar_TN' : 'fr_TN');
  }, [lang, activeTab]);

  // Slide direction follows the tab order; focus moves to the new page's heading for screen readers
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (previousTab.current !== activeTab) {
      setSlide(TAB_ORDER.indexOf(activeTab) > TAB_ORDER.indexOf(previousTab.current) ? 'animate-page-from-end' : 'animate-page-from-start');
      previousTab.current = activeTab;
    }
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => {
      const heading = mainRef.current?.querySelector('h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    });
  }, [activeTab, route.params.storeId]);

  const goTo = (tab, options) => navigate(pathFor(tab, options));

  const handleSwitchToSearch = (query) => goTo('search', { query: query ? { q: query } : undefined });

  const page = (() => {
    switch (activeTab) {
      case 'vision':
        return <VisionScanner onSwitchToSearch={handleSwitchToSearch} lang={lang} />;
      case 'search':
        return <ProductSearch initialQuery={route.query.q || ''} lang={lang} />;
      case 'map':
        return <TunisiaMap onOpenSubmitModal={() => setIsSubmitModalOpen(true)} lang={lang} />;
      case 'market':
        return (
          <Marketplace
            lang={lang}
            storeId={route.params.storeId || null}
            onOpenStore={(id) => goTo('market', { storeId: id })}
            onCloseStore={() => goTo('market')}
          />
        );
      case 'account':
        return user ? <AccountProfile lang={lang} /> : <AuthPanel lang={lang} onDone={() => goTo('market')} />;
      case 'reset-password':
        return <ResetPassword lang={lang} onDone={() => goTo('account')} />;
      case 'seller':
        return user ? <SellerDashboard lang={lang} /> : <AuthPanel lang={lang} />;
      case 'become-seller':
        return <BecomeSeller lang={lang} onOpenShop={() => goTo('seller')} />;
      case 'backoffice':
        return <Backoffice lang={lang} />;
      case 'privacy':
        return <Privacy lang={lang} />;
      case 'saved':
        return <SavedProducts lang={lang} />;
      case 'orders':
        return <MyOrders lang={lang} />;
      default:
        return <AtmcCatalog lang={lang} />;
    }
  })();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[2000] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas-paper">
        {lang === 'ar' ? 'انتقل إلى المحتوى' : 'Aller au contenu'}
      </a>

      <Navbar activeTab={activeTab} setActiveTab={goTo} onOpenSubmitModal={() => setIsSubmitModalOpen(true)} lang={lang} setLang={setLang} />

      {!online && (
        <div role="status" className="mx-auto mt-1 flex w-[calc(100%-2rem)] max-w-6xl items-start gap-2.5 rounded-2xl bg-status-warning/20 px-4 py-3 text-sm">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {lang === 'ar'
              ? 'أنت غير متصل. دليل الجمعية والعناوين المحفوظة متاحة؛ البحث والماسح يحتاجان إلى الإنترنت.'
              : 'Vous êtes hors ligne. Le guide ATMC et les adresses déjà consultées restent disponibles ; la recherche et le scanner ont besoin d’internet.'}
          </span>
        </div>
      )}

      <main id="main" ref={mainRef} className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-4 pb-32 pt-3 sm:px-6 sm:pt-6 lg:pb-20">
        <div key={activeTab} className={slide}>
          {page}
        </div>
      </main>

      <CartSheet lang={lang} />

      <SpotModal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} lang={lang} />

      <Footer
        lang={lang}
        onBecomeSeller={() => goTo('become-seller')}
        onOpenPrivacy={() => goTo('privacy')}
      />
      {/* Explicit mode: auto-detection picks the debug script from va.vercel-scripts.com when NODE_ENV
          is not "production" at build time, and the Content-Security-Policy blocks that host.
          In production mode the script is served by the site itself (/_vercel/insights). */}
      <Analytics mode={import.meta.env.PROD ? 'production' : 'development'} />
    </div>
  );
}
