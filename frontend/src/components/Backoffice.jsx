import React, { useEffect, useState } from 'react';
import { MapPin, Store, Lock, Flag, Package, LayoutDashboard, MessagesSquare, ChartColumn } from 'lucide-react';
import { useAuth } from './AuthContext';
import BackofficeSpots from './BackofficeSpots';
import BackofficeSellers from './BackofficeSellers';
import BackofficeReports from './BackofficeReports';
import BackofficeOrders from './BackofficeOrders';
import BackofficeDashboard from './BackofficeDashboard';
import BackofficeForum from './BackofficeForum';
import BackofficeStats from './BackofficeStats';
import { fetchForumOverview } from '../services/api';
import { t } from './ui';
import { SegmentedSlider } from './Slider';

// staff: open to the team (STAFF role); the rest is for admins only
const SECTIONS = [
  { id: 'dashboard', icon: LayoutDashboard, fr: 'Tableau de bord', ar: 'لوحة القيادة', staff: true },
  { id: 'stats', icon: ChartColumn, fr: 'Statistiques', ar: 'الإحصائيات' },
  { id: 'orders', icon: Package, fr: 'Commandes', ar: 'الطلبات', staff: true },
  { id: 'forum', icon: MessagesSquare, fr: 'Forum', ar: 'المنتدى', staff: true },
  { id: 'reports', icon: Flag, fr: 'Signalements', ar: 'البلاغات' },
  { id: 'spots', icon: MapPin, fr: 'Adresses', ar: 'العناوين' },
  { id: 'sellers', icon: Store, fr: 'Vendeurs et comptes', ar: 'البائعون والحسابات' },
];

/** Back-office. Admins see everything, the team (STAFF) the orders and the forum; the API checks the role again on every call. */
export default function Backoffice({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const [section, setSection] = useState('dashboard');
  const [openReports, setOpenReports] = useState(null);
  const [newOrders, setNewOrders] = useState(null);
  const [forumReports, setForumReports] = useState(null);
  const isAdmin = user?.role === 'ADMIN';
  const isTeam = isAdmin || user?.role === 'STAFF';
  const sections = SECTIONS.filter((s) => isAdmin || s.staff);

  // The Forum tab shows how many reported posts wait, before it is opened
  useEffect(() => {
    if (!isTeam) return;
    fetchForumOverview()
      .then((res) => setForumReports(res.data.openReports))
      .catch(() => {});
  }, [isTeam]);

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
        // The bar scrolls sideways on phones, so a swipe on it scrolls; only the selected section is dragged
        <SegmentedSlider
          role="tablist"
          options={sections}
          value={section}
          onChange={setSection}
          grabAnywhere={false}
          ariaLabel={tr('Back-office', 'الإدارة')}
          className="flex gap-1 overflow-x-auto scrollbar-none rounded-full bg-canvas-sunk/60 p-1 sm:inline-flex"
          thumbClassName="rounded-full bg-canvas-paper shadow-sm dark:bg-canvas-edge"
          segmentClassName={(on) => `flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${on ? 'font-medium text-ink' : 'text-ink-soft hover:text-ink'}`}
          renderOption={({ id, icon: Icon, fr, ar }) => (
            <>
              <Icon className="h-4 w-4" />
              {tr(fr, ar)}
              {id === 'reports' && openReports > 0 && (
                <span className="rounded-full bg-status-unsafe px-1.5 text-xs font-medium tabular-nums text-white">{openReports}</span>
              )}
              {id === 'orders' && newOrders > 0 && (
                <span className="rounded-full bg-status-unsafe px-1.5 text-xs font-medium tabular-nums text-white">{newOrders}</span>
              )}
              {id === 'forum' && forumReports > 0 && (
                <span className="rounded-full bg-status-unsafe px-1.5 text-xs font-medium tabular-nums text-white">{forumReports}</span>
              )}
            </>
          )}
        />
      )}
      {section === 'dashboard' ? (
        <BackofficeDashboard lang={lang} isAdmin={isAdmin} onGo={(id) => sections.some((s) => s.id === id) && setSection(id)} />
      ) : section === 'stats' && isAdmin ? (
        <BackofficeStats lang={lang} />
      ) : section === 'forum' ? (
        <BackofficeForum lang={lang} onCountChange={setForumReports} />
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
