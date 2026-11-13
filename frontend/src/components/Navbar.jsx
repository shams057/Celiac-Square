import React, { useEffect, useRef, useState } from 'react';
import { WheatOff, Camera, Search, MapPin, Plus, Languages, ShoppingBag, UserRound, Store, LogOut, BadgePlus, Bookmark, Package, LayoutDashboard } from 'lucide-react';
import { useAuth } from './AuthContext';
import { BrandMark, t } from './ui';
import { pathFor } from '../services/router';

// Plain clicks navigate in the page; Ctrl/Cmd/middle clicks keep the browser's "open in new tab"
const linkClick = (go, tab) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  go(tab);
};

const TABS = [
  { id: 'learn', icon: WheatOff, fr: 'Comprendre', ar: 'افهم' },
  // The ATMC guide is opened from the search page, so this tab stays marked while it is open
  { id: 'search', icon: Search, fr: 'Recherche', ar: 'بحث', covers: ['atmc'] },
  // The main action sits in the middle, larger than the other tabs
  { id: 'vision', icon: Camera, fr: 'Scanner', ar: 'الماسح', primary: true },
  { id: 'map', icon: MapPin, fr: 'Carte', ar: 'الخريطة' },
  { id: 'market', icon: ShoppingBag, fr: 'Marché', ar: 'السوق' },
];

const ROLE_LABELS = {
  ADMIN: ['Administrateur', 'مدير'],
  STAFF: ['Équipe', 'الفريق'],
  SELLER: ['Vendeur', 'بائع'],
  CLIENT: ['Client', 'عميل'],
};

export default function Navbar({ activeTab, setActiveTab, onOpenSubmitModal, lang, setLang }) {
  const tr = t(lang);

  return (
    <>
      {/* Top: no bar. The brand sits on the page; the controls float above it as glass,
          and the page softens as it scrolls underneath (the scroll edge). */}
      <header className="pointer-events-none sticky top-0 z-[900]">
        <div aria-hidden="true" className="scroll-edge-top absolute inset-x-0 top-0 h-24" />
        <div className="relative mx-auto grid h-[4.5rem] max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
          <button
            type="button"
            onClick={() => setActiveTab('vision')}
            className="pointer-events-auto flex min-h-11 items-center gap-2.5 justify-self-start rounded-full"
            aria-label={tr('Celiac Square, accueil', 'Celiac Square، الصفحة الرئيسية')}
          >
            <BrandMark className="h-9 w-9" />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Celiac Square</span>
          </button>

          {/* Wide screens: the tab bar floats at the top, text only, as on iPadOS */}
          <nav className="pointer-events-auto hidden lg:block" aria-label={tr('Navigation principale', 'التنقل الرئيسي')}>
            <TabBar activeTab={activeTab} setActiveTab={setActiveTab} lang={lang} placement="top" />
          </nav>

          <div className="pointer-events-auto flex items-center gap-2 justify-self-end">
            <button
              type="button"
              onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
              className="glass glass-control"
              lang={lang === 'fr' ? 'ar' : 'fr'}
              aria-label={lang === 'fr' ? 'العربية — عرض الموقع بالعربية' : 'Français — afficher le site en français'}
            >
              <Languages className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="hidden pe-1 sm:inline" aria-hidden="true">{lang === 'fr' ? 'العربية' : 'Français'}</span>
            </button>
            {/* The one tinted control in the bar: the primary action */}
            <button
              type="button"
              onClick={onOpenSubmitModal}
              className="glass-tint glass-control w-11 px-0 text-onbright"
              aria-label={tr('Proposer une adresse', 'اقترح عنوانا')}
              title={tr('Proposer une adresse', 'اقترح عنوانا')}
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </button>
            <AccountMenu lang={lang} go={setActiveTab} />
          </div>
        </div>
      </header>

      {/* Phones and tablets: the same tab bar floats at the bottom */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-[900] lg:hidden" aria-label={tr('Navigation principale', 'التنقل الرئيسي')}>
        <div aria-hidden="true" className="scroll-edge-bottom absolute inset-x-0 bottom-0 h-28" />
        <div className="relative flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <TabBar activeTab={activeTab} setActiveTab={setActiveTab} lang={lang} placement="bottom" />
        </div>
      </nav>
    </>
  );
}

/**
 * The floating glass tab bar. The bar is monochrome; the current tab is marked by a soft fill
 * that slides to it (a fill inside the glass, not a second pane) and by the sage tint.
 */
function TabBar({ activeTab, setActiveTab, lang, placement }) {
  const tr = t(lang);
  const top = placement === 'top';
  // The scan button carries its own tint, so the sliding fill only marks the other tabs
  const isActive = (tab) => tab.id === activeTab || Boolean(tab.covers?.includes(activeTab));
  const activeIndex = TABS.findIndex((tab) => isActive(tab) && !tab.primary);

  return (
    <div className={`glass pointer-events-auto relative grid grid-cols-5 rounded-full p-1 ${top ? 'w-[35rem]' : 'w-full max-w-md'}`}>
      {/* inset-inline-start keeps the fill on the right tab in Arabic */}
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className="tab-lens absolute inset-y-1 rounded-full transition-[inset-inline-start] duration-500 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
          style={{ insetInlineStart: `calc(4px + ${activeIndex} * (100% - 8px) / ${TABS.length})`, width: `calc((100% - 8px) / ${TABS.length})` }}
        />
      )}
      {TABS.map((tab) => {
        const { id, icon: Icon, fr, ar, primary } = tab;
        const active = isActive(tab);
        if (primary) {
          return (
            <a
              key={id}
              href={pathFor(id)}
              onClick={linkClick(setActiveTab, id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center justify-center rounded-full ${
                top ? 'h-10' : `flex-col gap-0.5 pb-1.5 text-[11px] font-semibold leading-tight ${active ? 'text-primary-dark' : 'text-ink'}`
              }`}
            >
              {top ? (
                <span className={`glass-tint flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-onbright transition-transform hover:scale-[1.04] ${active ? 'ring-2 ring-ink/25 ring-offset-0' : ''}`}>
                  <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  <span className="whitespace-nowrap">{tr(fr, ar)}</span>
                </span>
              ) : (
                <>
                  <span
                    className={`glass-tint -mt-8 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full text-onbright transition-transform active:scale-95 ${
                      active ? 'ring-4 ring-primary-dark/30' : ''
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-8 w-8" strokeWidth={2.25} />
                  </span>
                  <span className="whitespace-nowrap">{tr(fr, ar)}</span>
                </>
              )}
            </a>
          );
        }
        return (
          <a
            key={id}
            href={pathFor(id)}
            onClick={linkClick(setActiveTab, id)}
            aria-current={activeTab === id ? 'page' : active ? 'true' : undefined}
            className={`relative flex items-center justify-center rounded-full transition-colors ${
              top ? 'h-10 text-[15px]' : 'flex-col gap-0.5 py-1.5 text-[11px] leading-tight'
            } ${active ? 'font-semibold text-primary-dark' : 'font-medium text-ink'}`}
          >
            {!top && <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />}
            <span className="whitespace-nowrap">{tr(fr, ar)}</span>
          </a>
        );
      })}
    </div>
  );
}

/** Sign-in button, or the signed-in account's menu */
function AccountMenu({ lang, go }) {
  const tr = t(lang);
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button type="button" onClick={() => go('account')} className="glass glass-control w-11 px-0" aria-label={tr('Se connecter', 'تسجيل الدخول')} title={tr('Se connecter', 'تسجيل الدخول')}>
        <UserRound className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    );
  }

  const choose = (tab) => {
    setOpen(false);
    go(tab);
  };
  const initial = (user.fullName || user.email || '?').trim().charAt(0).toUpperCase();
  const [roleFr, roleAr] = ROLE_LABELS[user.role] || ROLE_LABELS.CLIENT;
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[15px] text-ink hover:bg-ink/[0.06]';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tr('Mon compte', 'حسابي')}
        className="glass glass-control w-11 px-0 text-base font-semibold"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="glass glass-thick absolute end-0 top-[3.25rem] w-64 animate-pop-in rounded-3xl p-2">
          <div className="px-3 pb-2 pt-1.5">
            <p className="truncate font-medium">{user.fullName || user.email}</p>
            <p className="truncate text-xs text-ink-soft" dir="ltr">{user.email}</p>
            <p className="mt-1.5 inline-block rounded-full bg-ink/[0.07] px-2 py-0.5 text-xs font-medium text-ink-soft">{tr(roleFr, roleAr)}</p>
          </div>
          <div className="mx-3 my-1 border-t border-ink/10" />
          {(user.role === 'ADMIN' || user.role === 'STAFF') && (
            <>
              <button type="button" role="menuitem" className={`${item} font-medium`} onClick={() => choose('backoffice')}>
                <LayoutDashboard className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                {tr('Back-office et tableau de bord', 'الإدارة ولوحة القيادة')}
              </button>
              <div className="mx-3 my-1 border-t border-ink/10" />
            </>
          )}
          <button type="button" role="menuitem" className={item} onClick={() => choose('saved')}>
            <Bookmark className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            {tr('Mes produits et scans', 'منتجاتي وعمليات المسح')}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => choose('account')}>
            <UserRound className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            {tr('Mon profil', 'ملفي الشخصي')}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => choose('orders')}>
            <Package className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            {tr('Mes commandes', 'طلباتي')}
          </button>
          {(user.role === 'SELLER' || user.role === 'ADMIN') && (
            <button type="button" role="menuitem" className={item} onClick={() => choose('seller')}>
              <Store className="h-4 w-4 text-ink-soft" aria-hidden="true" />
              {tr('Ma boutique', 'محلي')}
            </button>
          )}
          {user.role === 'CLIENT' && (
            <button type="button" role="menuitem" className={item} onClick={() => choose('become-seller')}>
              <BadgePlus className="h-4 w-4 text-ink-soft" aria-hidden="true" />
              {tr('Devenir vendeur', 'كن بائعا')}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
          >
            <LogOut className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            {tr('Se déconnecter', 'تسجيل الخروج')}
          </button>
        </div>
      )}
    </div>
  );
}
