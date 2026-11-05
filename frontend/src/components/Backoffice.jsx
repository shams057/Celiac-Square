import React, { useState } from 'react';
import { MapPin, Store, Lock } from 'lucide-react';
import { useAuth } from './AuthContext';
import BackofficeSpots from './BackofficeSpots';
import BackofficeSellers from './BackofficeSellers';
import { t } from './ui';

const SECTIONS = [
  { id: 'spots', icon: MapPin, fr: 'Adresses', ar: 'العناوين' },
  { id: 'sellers', icon: Store, fr: 'Vendeurs et comptes', ar: 'البائعون والحسابات' },
];

/** Admin area. Only admin accounts get in; the API checks the role again on every call. */
export default function Backoffice({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const [section, setSection] = useState('sellers');

  if (user?.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-md pt-6">
        <div className="panel p-6 sm:p-8">
          <Lock className="h-6 w-6 text-ink-soft" />
          <h1 className="mt-4 text-2xl font-semibold">{tr('Accès réservé', 'دخول محدود')}</h1>
          <p className="mt-1 text-sm text-ink-soft">{tr('Cet espace est réservé aux administrateurs.', 'هذا الفضاء مخصص للمديرين.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-full bg-canvas-sunk/60 p-1 sm:inline-flex" role="tablist" aria-label={tr('Back-office', 'الإدارة')}>
        {SECTIONS.map(({ id, icon: Icon, fr, ar }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
              section === id ? 'bg-canvas-paper font-medium text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tr(fr, ar)}
          </button>
        ))}
      </div>
      {section === 'spots' ? <BackofficeSpots lang={lang} /> : <BackofficeSellers lang={lang} />}
    </div>
  );
}
