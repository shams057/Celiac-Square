import React, { useState } from 'react';
import { MapPin, Store, Lock, Flag, Package, LayoutDashboard } from 'lucide-react';
import { useAuth } from './AuthContext';
import BackofficeSpots from './BackofficeSpots';
import BackofficeSellers from './BackofficeSellers';
import BackofficeReports from './BackofficeReports';
import BackofficeOrders from './BackofficeOrders';
import BackofficeDashboard from './BackofficeDashboard';
import { t } from './ui';

// staff: open to the team (STAFF role); the rest is for admins only
const SECTIONS = [
  { id: 'dashboard', icon: LayoutDashboard, fr: 'Tableau de bord', ar: 'لوحة القيادة', staff: true },
  { id: 'orders', icon: Package, fr: 'Commandes', ar: 'الطلبات', staff: true },
  { id: 'reports', icon: Flag, fr: 'Signalements', ar: 'البلاغات' },
  { id: 'spots', icon: MapPin, fr: 'Adresses', ar: 'العناوين' },
  { id: 'sellers', icon: Store, fr: 'Vendeurs et comptes', ar: 'البائعون والحسابات' },
];

/** Back-office. Admins see everything, the team (STAFF) only the orders; the API checks the role again on every call. */
export default function Backoffice({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const [section, setSection] = useState('dashboard');
  const [openReports, setOpenReports] = useState(null);
  const [newOrders, setNewOrders] = useState(null);
  const isAdmin = user?.role === 'ADMIN';
  const sections = SECTIONS.filter((s) => isAdmin || s.staff);

  if (!isAdmin && user?.role !== 'STAFF') {
    return (
      <div className="mx-auto max-w-md pt-6">
        <div className="panel p-6 sm:p-8">
          <Lock className="h-6 w-6 text-ink-soft" />
          <h1 className="mt-4 text-2xl font-semibold">{tr('Accès réservé', 'دخول محدود')}</h1>
          <p className="mt-1 text-sm text-ink-soft">{tr('Cet espace est réservé à l’équipe Celiac Square.', 'هذا الفضاء مخصص لفريق Celiac Square.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.length > 1 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none rounded-full bg-canvas-sunk/60 p-1 sm:inline-flex" role="tablist" aria-label={tr('Back-office', 'الإدارة')}>
          {sections.map(({ id, icon: Icon, fr, ar }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                section === id ? 'bg-canvas-paper font-medium text-ink shadow-sm dark:bg-canvas-edge' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tr(fr, ar)}
              {id === 'reports' && openReports > 0 && (
                <span className="rounded-full bg-status-unsafe px-1.5 text-xs font-medium tabular-nums text-white">{openReports}</span>
              )}
              {id === 'orders' && newOrders > 0 && (
                <span className="rounded-full bg-status-unsafe px-1.5 text-xs font-medium tabular-nums text-white">{newOrders}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {section === 'dashboard' ? (
        <BackofficeDashboard lang={lang} isAdmin={isAdmin} onGo={(id) => sections.some((s) => s.id === id) && setSection(id)} />
      ) : section === 'orders' || !isAdmin ? (
        <BackofficeOrders lang={lang} onCountChange={setNewOrders} />
      ) : section === 'reports' ? (
        <BackofficeReports lang={lang} onCountChange={setOpenReports} />
      ) : section === 'spots' ? (
        <BackofficeSpots lang={lang} />
      ) : (
        <BackofficeSellers lang={lang} />
      )}
    </div>
  );
}
