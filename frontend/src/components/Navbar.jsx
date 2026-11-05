import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Camera, Search, MapPin, Plus, Languages, ShoppingBag, UserRound, Store, LogOut, BadgePlus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { BrandMark, t } from './ui';

const TABS = [
  { id: 'atmc', icon: BookOpen, fr: 'Guide ATMC', ar: 'دليل الجمعية' },
  { id: 'vision', icon: Camera, fr: 'Scanner', ar: 'الماسح' },
  { id: 'search', icon: Search, fr: 'Recherche', ar: 'بحث' },
  { id: 'map', icon: MapPin, fr: 'Carte', ar: 'الخريطة' },
  { id: 'market', icon: ShoppingBag, fr: 'Marché', ar: 'السوق' },
];

const ROLE_LABELS = {
  ADMIN: ['Administrateur', 'مدير'],
  SELLER: ['Vendeur', 'بائع'],
  CLIENT: ['Client', 'عميل'],
};

export default function Navbar({ activeTab, setActiveTab, onOpenSubmitModal, lang, setLang }) {
  const tr = t(lang);
  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab);

  // The top bar turns to glass once the page scrolls under it
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className={`sticky top-0 z-[900] transition-[background-color,box-shadow,backdrop-filter] duration-300 ${scrolled ? 'glass-bar' : ''}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('vision')}
            className="flex shrink-0 items-center gap-2.5 rounded-full"
            aria-label="Celiac Square"
          >
            <BrandMark className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-[-0.02em]">Celiac Square</span>
          </button>

          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
              className="btn-ghost px-3"
              lang={lang === 'fr' ? 'ar' : 'fr'}
            >
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'fr' ? 'العربية' : 'Français'}</span>
            </button>
            <button type="button" onClick={onOpenSubmitModal} className="btn-primary px-3 sm:px-4" aria-label={tr('Proposer une adresse', 'اقترح عنوانا')}>
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">{tr('Proposer une adresse', 'اقترح عنوانا')}</span>
            </button>
            <AccountMenu lang={lang} go={setActiveTab} />
          </div>
        </div>
      </header>

      {/* Floating glass dock, on every screen size */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[900] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]"
        aria-label={tr('Navigation principale', 'التنقل الرئيسي')}
      >
        <div className="glass pointer-events-auto relative grid w-full max-w-md grid-cols-5 rounded-full p-1.5 lg:max-w-2xl">
          {/* The lens slides under the active tab; inset-inline-start keeps it right in Arabic */}
          {activeIndex >= 0 && (
            <span
              aria-hidden="true"
              className="glass-lens absolute inset-y-1.5 rounded-full transition-[inset-inline-start] duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)]"
              style={{ insetInlineStart: `calc(6px + ${activeIndex} * (100% - 12px) / ${TABS.length})`, width: `calc((100% - 12px) / ${TABS.length})` }}
            />
          )}
          {TABS.map(({ id, icon: Icon, fr, ar }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[11px] transition-colors lg:flex-row lg:gap-2 lg:py-2.5 lg:text-sm ${
                  active ? 'font-medium text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-300 lg:h-4 lg:w-4 ${active ? 'scale-110 lg:scale-100' : ''}`} strokeWidth={active ? 2.25 : 1.75} />
                <span className="whitespace-nowrap">{tr(fr, ar)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
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
      <button type="button" onClick={() => go('account')} className="btn-quiet px-3" aria-label={tr('Se connecter', 'تسجيل الدخول')}>
        <UserRound className="h-4 w-4" />
        <span className="hidden sm:inline">{tr('Se connecter', 'تسجيل الدخول')}</span>
      </button>
    );
  }

  const choose = (tab) => {
    setOpen(false);
    go(tab);
  };
  const initial = (user.fullName || user.email || '?').trim().charAt(0).toUpperCase();
  const [roleFr, roleAr] = ROLE_LABELS[user.role] || ROLE_LABELS.CLIENT;
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm text-ink hover:bg-canvas-paper/80';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tr('Mon compte', 'حسابي')}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-semibold text-canvas-paper ring-2 ring-white/70 transition-transform active:scale-95"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="glass absolute end-0 top-12 w-64 animate-pop-in rounded-2xl p-2">
          <div className="px-3 pb-2 pt-1.5">
            <p className="truncate font-medium">{user.fullName || user.email}</p>
            <p className="truncate text-xs text-ink-soft" dir="ltr">{user.email}</p>
            <p className="mt-1.5 inline-block rounded-md bg-canvas-sunk/80 px-1.5 py-0.5 text-xs text-ink-soft">{tr(roleFr, roleAr)}</p>
          </div>
          <div className="my-1 border-t border-canvas-line/70" />
          {(user.role === 'SELLER' || user.role === 'ADMIN') && (
            <button type="button" role="menuitem" className={item} onClick={() => choose('seller')}>
              <Store className="h-4 w-4 text-ink-soft" />
              {tr('Ma boutique', 'محلي')}
            </button>
          )}
          {user.role === 'CLIENT' && (
            <button type="button" role="menuitem" className={item} onClick={() => choose('become-seller')}>
              <BadgePlus className="h-4 w-4 text-ink-soft" />
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
            <LogOut className="h-4 w-4 text-ink-soft" />
            {tr('Se déconnecter', 'تسجيل الخروج')}
          </button>
        </div>
      )}
    </div>
  );
}
