import React, { useEffect, useRef, useState } from 'react';
import { WheatOff, Camera, Search, MapPin, Plus, Languages, ShoppingBag, UserRound, Store, LogOut, BadgePlus, Bookmark, Package, LayoutDashboard, LogIn, Moon, Sun, SunMoon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { BrandMark, t } from './ui';
import { pathFor } from '../services/router';
import { useSlideSelect, SegmentedSlider } from './Slider';
import { useTheme } from '../services/theme';

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
 * (a fill inside the glass, not a second pane) and by the sage tint.
 * The fill is a real slider: press anywhere on the bar and slide to another tab, it opens on release.
 */
function TabBar({ activeTab, setActiveTab, lang, placement }) {
  const tr = t(lang);
  const top = placement === 'top';
  const isActive = (tab) => tab.id === activeTab || Boolean(tab.covers?.includes(activeTab));
  const activeIndex = TABS.findIndex(isActive);
  const { trackRef, segRef, thumbStyle, dragging, current, trackProps } = useSlideSelect({
    count: TABS.length,
    // On a page outside the tabs (account, privacy…) a drag starts from the scan button
    index: activeIndex >= 0 ? activeIndex : TABS.findIndex((tab) => tab.primary),
    onSelect: (i) => setActiveTab(TABS[i].id),
    // Links: Tab moves between them, arrows are left to the browser
    keyboard: false,
  });
  // The scan button carries its own tint, so at rest the fill only marks the other tabs
  const lensShown = dragging || (activeIndex >= 0 && !TABS[activeIndex].primary);

  return (
    <div
      ref={trackRef}
      className={`slider-track slider-grab glass pointer-events-auto relative grid grid-cols-5 rounded-full p-1 ${top ? 'w-[35rem]' : 'w-full max-w-md'}`}
      {...trackProps}
    >
      <span
        aria-hidden="true"
        data-dragging={dragging}
        className="tab-lens slider-thumb rounded-full"
        style={{ ...thumbStyle, ...(lensShown ? null : { opacity: 0 }) }}
      />
      {TABS.map((tab, i) => {
        const { id, icon: Icon, fr, ar, primary } = tab;
        // While sliding, the tab under the finger is the one shown as selected
        const active = dragging ? i === current : isActive(tab);
        const ariaCurrent = activeTab === id ? 'page' : isActive(tab) ? 'true' : undefined;
        if (primary) {
          return (
            <a
              key={id}
              ref={segRef(i)}
              href={pathFor(id)}
              draggable={false}
              onClick={linkClick(setActiveTab, id)}
              aria-current={ariaCurrent}
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
                    } ${dragging && active ? 'scale-105' : ''}`}
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
            ref={segRef(i)}
            href={pathFor(id)}
            draggable={false}
            onClick={linkClick(setActiveTab, id)}
            aria-current={ariaCurrent}
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

const THEMES = [
  { id: 'auto', icon: SunMoon, fr: 'Auto', ar: 'تلقائي' },
  { id: 'light', icon: Sun, fr: 'Clair', ar: 'فاتح' },
  { id: 'dark', icon: Moon, fr: 'Sombre', ar: 'داكن' },
];

/** Appearance: follow the device, or always light, or always dark */
function ThemeSwitch({ lang }) {
  const tr = t(lang);
  const [choice, choose] = useTheme();
  return (
    <div className="px-1 pb-1 pt-1.5">
      <p aria-hidden="true" className="px-2 pb-2 text-sm font-medium text-ink-soft">
        {tr('Apparence', 'المظهر')}
      </p>
      <SegmentedSlider
        options={THEMES}
        value={choice}
        onChange={choose}
        ariaLabel={tr('Apparence', 'المظهر')}
        className="grid grid-cols-3 rounded-full bg-ink/[0.07] p-1"
        thumbClassName="rounded-full bg-canvas-paper shadow-sm dark:bg-canvas-edge"
        segmentClassName={(on) => `flex min-h-9 items-center justify-center gap-1.5 rounded-full px-2 text-sm transition-colors ${on ? 'font-medium text-ink' : 'text-ink-soft hover:text-ink'}`}
        renderOption={({ icon: Icon, fr, ar }) => (
          <>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {tr(fr, ar)}
          </>
        )}
      />
    </div>
  );
}

/**
 * The profile button and its menu: account pages when signed in, sign-in otherwise,
 * and the appearance switch for everyone.
 */
function AccountMenu({ lang, go }) {
  const tr = t(lang);
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (tab) => {
    setOpen(false);
    go(tab);
  };
  const initial = user ? (user.fullName || user.email || '?').trim().charAt(0).toUpperCase() : null;
  const [roleFr, roleAr] = (user && ROLE_LABELS[user.role]) || ROLE_LABELS.CLIENT;
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[15px] text-ink hover:bg-ink/[0.06]';
  const divider = <div className="mx-3 my-1 border-t border-ink/10" />;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={user ? tr('Mon compte', 'حسابي') : tr('Compte et apparence', 'الحساب والمظهر')}
        title={user ? undefined : tr('Compte et apparence', 'الحساب والمظهر')}
        className={`glass glass-control w-11 px-0 ${user ? 'text-base font-semibold' : ''}`}
      >
        {user ? initial : <UserRound className="h-[18px] w-[18px]" aria-hidden="true" />}
      </button>
      {open && (
        <div id="account-menu" className="glass glass-thick absolute end-0 top-[3.25rem] w-72 animate-pop-in rounded-3xl p-2">
          {user ? (
            <>
              <div className="px-3 pb-2 pt-1.5">
                <p className="truncate font-medium">{user.fullName || user.email}</p>
                <p className="truncate text-xs text-ink-soft" dir="ltr">{user.email}</p>
                <p className="mt-1.5 inline-block rounded-full bg-ink/[0.07] px-2 py-0.5 text-xs font-medium text-ink-soft">{tr(roleFr, roleAr)}</p>
              </div>
              {divider}
              {(user.role === 'ADMIN' || user.role === 'STAFF') && (
                <>
                  <button type="button" className={`${item} font-medium`} onClick={() => choose('backoffice')}>
                    <LayoutDashboard className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                    {tr('Back-office et tableau de bord', 'الإدارة ولوحة القيادة')}
                  </button>
                  {divider}
                </>
              )}
              <button type="button" className={item} onClick={() => choose('saved')}>
                <Bookmark className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                {tr('Mes produits et scans', 'منتجاتي وعمليات المسح')}
              </button>
              <button type="button" className={item} onClick={() => choose('account')}>
                <UserRound className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                {tr('Mon profil', 'ملفي الشخصي')}
              </button>
              <button type="button" className={item} onClick={() => choose('orders')}>
                <Package className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                {tr('Mes commandes', 'طلباتي')}
              </button>
              {(user.role === 'SELLER' || user.role === 'ADMIN') && (
                <button type="button" className={item} onClick={() => choose('seller')}>
                  <Store className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                  {tr('Ma boutique', 'محلي')}
                </button>
              )}
              {user.role === 'CLIENT' && (
                <button type="button" className={item} onClick={() => choose('become-seller')}>
                  <BadgePlus className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                  {tr('Devenir vendeur', 'كن بائعا')}
                </button>
              )}
            </>
          ) : (
            <button type="button" className={`${item} font-medium`} onClick={() => choose('account')}>
              <LogIn className="h-4 w-4 text-ink-soft rtl:rotate-180" aria-hidden="true" />
              {tr('Se connecter ou créer un compte', 'تسجيل الدخول أو إنشاء حساب')}
            </button>
          )}
          {divider}
          <ThemeSwitch lang={lang} />
          {user && (
            <>
              {divider}
              <button
                type="button"
                className={item}
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                }}
              >
                <LogOut className="h-4 w-4 text-ink-soft rtl:rotate-180" aria-hidden="true" />
                {tr('Se déconnecter', 'تسجيل الخروج')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
