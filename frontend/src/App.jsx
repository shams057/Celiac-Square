import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Navbar from './components/Navbar';
import VisionScanner from './components/VisionScanner';
import ProductSearch from './components/ProductSearch';
import AtmcCatalog from './components/AtmcCatalog';
import AboutCeliac from './components/AboutCeliac';
import TunisiaMap from './components/TunisiaMap';
import Marketplace from './components/Marketplace';
import Forum from './components/Forum';
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
import { useFilmSwipe } from './components/filmSwipe';

// Dock tabs first, in the order of the bar (search and the guide sit behind the scanner), then pages reached from the account menu and the footer
const TAB_ORDER = ['learn', 'map', 'vision', 'search', 'atmc', 'forum', 'market', 'account', 'reset-password', 'seller', 'become-seller', 'backoffice', 'privacy', 'saved', 'orders'];

// The tab bar's pages, in its order (left to right in both languages): on a phone they sit side by side like a
// film roll (see components/filmSwipe.js). Search and the ATMC guide are reached from the scanner, so they roll as it does.
const BAR_TABS = ['learn', 'map', 'vision', 'forum', 'market'];
const BAR_COVERS = { search: 'vision', atmc: 'vision' };

const PAGE_TITLES = {
  learn: ['Comprendre la maladie cœliaque', 'افهم مرض الأبطن'],
  atmc: ['Guide ATMC', 'دليل الجمعية'],
  vision: ['Scanner un produit', 'امسح منتجا'],
  search: ['Rechercher un produit', 'ابحث عن منتج'],
  map: ['Carte des adresses', 'خريطة العناوين'],
  market: ['Marché sans gluten', 'سوق بدون غلوتين'],
  forum: ['Forum', 'المنتدى'],
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

/**
 * A page the film rolls past on its way (Comprendre → Marché passes Carte, Scanner, Forum): seen for a few
 * hundredths of a second, blurred, so its title and the shape of a page stand in for it.
 */
function PassingFrame({ title }) {
  return (
    <div className="space-y-6">
      <p className="page-title">{title}</p>
      <div className="h-5 w-4/5 rounded-full bg-ink/[0.07]" />
      <div className="h-12 rounded-full bg-ink/[0.06]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="panel h-36" />
      ))}
    </div>
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
  const previousTab = useRef(activeTab);
  const firstRender = useRef(true);
  const mainRef = useRef(null);
  const stripRef = useRef(null);
  const blurRef = useRef(null);
  // Set when the film roll has just brought the new page in: it is already in place, so no slide-in
  const filmLanded = useRef(false);

  // The tab bar's pages stay alive once opened (hidden while another page is shown), so going back to one
  // finds it as it was: its data, its filters, the map where it was left, the scroll position.
  // Each remembers its last address (the forum's tab and search, an open store) and scroll position.
  const alive = useRef(new Set());
  const lastRoute = useRef({});
  const scrollMemory = useRef({});
  const shown = useRef({ tab: activeTab, sub: '' });
  if (BAR_TABS.includes(activeTab)) {
    alive.current.add(activeTab);
    const { storeId, threadId } = route.params;
    lastRoute.current[activeTab] = { params: route.params, query: route.query, path: pathFor(activeTab, { storeId, threadId, query: route.query }) };
  }
  const routeOf = (tab) => (tab === activeTab ? route : lastRoute.current[tab] || { params: {}, query: {} });
  const lastPath = (tab) => lastRoute.current[tab]?.path || pathFor(tab);

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

  const goTo = (tab, options) => navigate(pathFor(tab, options));

  const film = useFilmSwipe({
    stripRef,
    frameRef: mainRef,
    blurRef,
    index: BAR_TABS.indexOf(BAR_COVERS[activeTab] || activeTab),
    count: BAR_TABS.length,
    onCommit: (i) => {
      filmLanded.current = true;
      navigate(lastPath(BAR_TABS[i]));
    },
  });

  // On every change of page, before the browser paints: the page left keeps its scroll position, the tab bar's
  // pages get theirs back, anything else opens at its top. After the roll, the frame shown is now the page:
  // the strip goes back to rest in the same frame, so nothing moves on screen.
  useLayoutEffect(() => {
    const prev = shown.current;
    const sub = route.params.threadId || route.params.storeId || '';
    if (prev.tab === activeTab && prev.sub === sub) return;
    if (BAR_TABS.includes(prev.tab)) scrollMemory.current[prev.tab] = window.scrollY;
    shown.current = { tab: activeTab, sub };
    const back = prev.tab !== activeTab && BAR_TABS.includes(activeTab);
    window.scrollTo({ top: back ? scrollMemory.current[activeTab] || 0 : 0 });
    // After the scroll, so a swipe that goes on around the new page lines its frames up with it
    if (filmLanded.current) film.reset();
  }, [activeTab, route.params.threadId, route.params.storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slide direction follows the tab order; focus moves to the new page's heading for screen readers.
  // Before the browser paints, so the new page never shows in place for a frame before it slides
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Played on the element rather than by a class: the tab bar's pages stay mounted, and a class already on
    // them would not play again
    if (previousTab.current !== activeTab) {
      const page = mainRef.current?.querySelector('[data-page-current]');
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (page && !filmLanded.current && !reduce) {
        const from = TAB_ORDER.indexOf(activeTab) > TAB_ORDER.indexOf(previousTab.current) ? 24 : -24;
        page.animate(
          [
            { opacity: 0, transform: `translateX(${from}px)` },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      }
      filmLanded.current = false;
      previousTab.current = activeTab;
    }
    requestAnimationFrame(() => {
      const heading = mainRef.current?.querySelector('[data-page-current] h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    });
  }, [activeTab, route.params.storeId, route.params.threadId]);

  const handleSwitchToSearch = (query) => goTo('search', { query: query ? { q: query } : undefined });

  // A page of the app, with its address's details (a store, a question, a search): the current address for the
  // page shown, the last one it had for a tab bar page kept behind it.
  const renderPage = (tab) => {
    const { params, query } = routeOf(tab);
    switch (tab) {
      case 'vision':
        return <VisionScanner onSwitchToSearch={handleSwitchToSearch} lang={lang} active={tab === activeTab} />;
      case 'learn':
        return <AboutCeliac lang={lang} />;
      case 'atmc':
        return <AtmcCatalog lang={lang} />;
      case 'search':
        return <ProductSearch initialQuery={query.q || ''} lang={lang} />;
      case 'map':
        return <TunisiaMap onOpenSubmitModal={() => setIsSubmitModalOpen(true)} lang={lang} />;
      case 'market':
        return (
          <Marketplace
            lang={lang}
            storeId={params.storeId || null}
            onOpenStore={(id) => goTo('market', { storeId: id })}
            onCloseStore={() => goTo('market')}
          />
        );
      case 'forum':
        return (
          <Forum
            lang={lang}
            threadId={params.threadId || null}
            query={query}
            onOpenThread={(id) => goTo('forum', { threadId: id })}
            onNavigate={(query, options) => navigate(pathFor('forum', { query }), options)}
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
        return <VisionScanner onSwitchToSearch={handleSwitchToSearch} lang={lang} />;
    }
  };

  // Tab bar (and logo): a tab opens where it was left (the film rolls there). The tab already shown
  // goes back to its start, or to the top when it is there. Anything else navigates as usual.
  const goFromBar = (tab, options) => {
    if (options || !BAR_TABS.includes(tab)) {
      goTo(tab, options);
      return;
    }
    if (tab === activeTab || BAR_COVERS[activeTab] === tab) {
      if (window.location.pathname + window.location.search === pathFor(tab)) window.scrollTo({ top: 0, behavior: 'smooth' });
      else goTo(tab);
      return;
    }
    if (film.go(BAR_TABS.indexOf(tab))) return;
    navigate(lastPath(tab));
  };
  // The real frames the roll is moving (tab → its place in the roll, in frames); they stay alive afterwards
  const frameTabs = new Map((film.film?.frames || []).filter((f) => f.real).map((f) => [BAR_TABS[f.index], f.slot]));
  frameTabs.forEach((_, tab) => alive.current.add(tab));
  // While the roll heads to a page, the tab bar already shows it
  const barTab = film.pending >= 0 ? BAR_TABS[film.pending] : activeTab;

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[2000] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas-paper">
        {lang === 'ar' ? 'انتقل إلى المحتوى' : 'Aller au contenu'}
      </a>

      <Navbar activeTab={barTab} setActiveTab={goFromBar} lang={lang} setLang={setLang} />

      {/* The roll's motion blur: horizontal only (its strength is set while the roll moves) */}
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id="film-blur" x="-5%" y="0" width="110%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur ref={blurRef} stdDeviation="0 0" />
        </filter>
      </svg>

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

      <main id="main" ref={mainRef} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-3 sm:px-6 sm:pt-6 lg:pb-20">
        {/* The film strip: the page, and while the roll moves, the frames beside it. They run past the page's
            column to the window's edge, where the app's outer box clips them.
            Pages are keyed by page, so when the roll lands the frame shown simply stays: it is not drawn again. */}
        <div ref={stripRef} className="relative">
          {BAR_TABS.filter((tab) => alive.current.has(tab) || frameTabs.has(tab)).map((tab) => {
            if (tab === activeTab) {
              return (
                <div key={tab} data-page-current="">
                  {renderPage(tab)}
                </div>
              );
            }
            const slot = frameTabs.get(tab);
            return slot === undefined ? (
              // Kept alive, out of sight
              <div key={tab} hidden>
                {renderPage(tab)}
              </div>
            ) : (
              // In the roll: one frame to the side per page (gutters included), lined up so that it lands
              // at its own scroll position
              <div
                key={tab}
                inert=""
                aria-hidden="true"
                className="absolute w-full"
                style={{ top: film.film.top - (scrollMemory.current[tab] || 0), left: slot * film.film.offset }}
              >
                {renderPage(tab)}
              </div>
            );
          })}
          {!BAR_TABS.includes(activeTab) && (
            <div key={`${activeTab}:${route.params.threadId || route.params.storeId || ''}`} data-page-current="">
              {renderPage(activeTab)}
            </div>
          )}
          {film.film?.frames
            .filter((f) => !f.real)
            .map(({ index, slot }) => {
              const tab = BAR_TABS[index];
              return (
                <div key={`pass:${tab}`} aria-hidden="true" className="absolute w-full" style={{ top: film.film.top, left: slot * film.film.offset }}>
                  <PassingFrame title={(PAGE_TITLES[tab] || PAGE_TITLES.vision)[lang === 'ar' ? 1 : 0]} />
                </div>
              );
            })}
        </div>
      </main>

      <CartSheet lang={lang} />

      <SpotModal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} lang={lang} />

      <Footer
        lang={lang}
        onBecomeSeller={() => goTo('become-seller')}
        onSuggestAddress={() => setIsSubmitModalOpen(true)}
        onOpenPrivacy={() => goTo('privacy')}
      />
      {/* Explicit mode: auto-detection picks the debug script from va.vercel-scripts.com when NODE_ENV
          is not "production" at build time, and the Content-Security-Policy blocks that host.
          In production mode the script is served by the site itself (/_vercel/insights). */}
      <Analytics mode={import.meta.env.PROD ? 'production' : 'development'} />
    </div>
  );
}
