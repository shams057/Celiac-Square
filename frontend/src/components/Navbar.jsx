import React from 'react';
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

  return (
    <>
      <header className="sticky top-0 z-[900] border-b border-canvas-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('vision')}
            className="flex shrink-0 items-center gap-2.5 rounded-lg"
            aria-label="Celiac Square"
          >
            <BrandMark className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-[-0.01em]">Celiac Square</span>
          </button>

          {/* Desktop tabs */}
          <nav className="ms-4 hidden items-center gap-1 lg:flex" aria-label={tr('Navigation principale', 'التنقل الرئيسي')}>
            {TABS.map(({ id, fr, ar }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative rounded-md px-3 py-2 text-[15px] transition-colors ${
                    active ? 'font-medium text-ink' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {tr(fr, ar)}
                  {active && <span className="absolute inset-x-3 -bottom-[13px] h-[3px] rounded-full bg-accent" />}
                </button>
              );
            })}
          </nav>

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

      {/* Mobile and tablet bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[900] border-t border-canvas-line bg-canvas-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={tr('Navigation principale', 'التنقل الرئيسي')}
      >
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map(({ id, icon: Icon, fr, ar }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs ${active ? 'font-medium text-ink' : 'text-ink-soft'}`}
              >
                <span className={`flex h-8 w-12 items-center justify-center rounded-md ${active ? 'bg-accent' : ''}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {tr(fr, ar)}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
