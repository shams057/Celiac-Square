import React, { useEffect, useState } from 'react';
import { BookOpen, Camera, Search, MapPin, Plus, Languages } from 'lucide-react';
import { BrandMark, t } from './ui';

const TABS = [
  { id: 'atmc', icon: BookOpen, fr: 'Guide ATMC', ar: 'دليل الجمعية' },
  { id: 'vision', icon: Camera, fr: 'Scanner', ar: 'الماسح' },
  { id: 'search', icon: Search, fr: 'Recherche', ar: 'بحث' },
  { id: 'map', icon: MapPin, fr: 'Carte', ar: 'الخريطة' },
];

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
              <span>{lang === 'fr' ? 'العربية' : 'Français'}</span>
            </button>
            <button type="button" onClick={onOpenSubmitModal} className="btn-primary px-3 sm:px-4">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{tr('Proposer une adresse', 'اقترح عنوانا')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating glass dock, on every screen size */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[900] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]"
        aria-label={tr('Navigation principale', 'التنقل الرئيسي')}
      >
        <div className="glass pointer-events-auto relative grid w-full max-w-md grid-cols-4 rounded-full p-1.5 lg:max-w-xl">
          {/* The lens slides under the active tab; inset-inline-start keeps it right in Arabic */}
          {activeIndex >= 0 && (
            <span
              aria-hidden="true"
              className="glass-lens absolute inset-y-1.5 rounded-full transition-[inset-inline-start] duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)]"
              style={{ insetInlineStart: `calc(6px + ${activeIndex} * (100% - 12px) / 4)`, width: 'calc((100% - 12px) / 4)' }}
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
