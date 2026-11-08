import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, TriangleAlert, Flag, MapPin, Store, MessageCircle, Clock } from 'lucide-react';
import { fetchDashboard, errorMessage } from '../services/api';
import { t, Notice, Spinner, formatPrice } from './ui';
import { ORDER_STATUS } from './orders';
import { DailyChart, BarList, ChartCard, DataTable, StatTile, Legend, SERIES, compact, dayLabel, useMinuteTick } from './charts';

const PERIODS = [7, 30, 90];

const STAGES = [
  { id: 'NEW', fr: 'À appeler', ar: 'للاتصال' },
  { id: 'WAITING', fr: 'Attente WhatsApp', ar: 'انتظار واتساب' },
  { id: 'CONFIRMED', fr: 'À transmettre', ar: 'للإرسال' },
  { id: 'PREPARING', fr: 'Chez l’artisan', ar: 'عند الحرفي' },
  { id: 'READY', fr: 'Prêtes à expédier', ar: 'جاهزة للشحن' },
  { id: 'SHIPPED', fr: 'En livraison', ar: 'قيد التوصيل' },
];

/** 5 h, 2,5 j */
const duration = (hours, lang) => {
  if (hours == null) return '—';
  const ar = lang === 'ar';
  if (hours < 48) return `${compact(Math.round(hours * 10) / 10, lang)} ${ar ? 'س' : 'h'}`;
  return `${compact(Math.round((hours / 24) * 10) / 10, lang)} ${ar ? 'ي' : 'j'}`;
};
const pct = (v, lang) => (v == null ? '—' : `${compact(v, lang)} %`);

/**
 * Back-office dashboard. Everyone in the team sees the orders figures; admins also see the
 * marketplace, the inbox and the accounts. onGo(section) opens another back-office section.
 */
export default function BackofficeDashboard({ lang, isAdmin, onGo }) {
  const tr = t(lang);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });
  useMinuteTick();

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const res = await fetchDashboard(days);
      setData(res.data);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, tr('Le tableau de bord n’a pas pu être chargé.', 'تعذر تحميل لوحة القيادة.')) });
    }
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Fresh figures every 5 minutes while the page stays open
  useEffect(() => {
    const id = setInterval(load, 5 * 60000);
    return () => clearInterval(id);
  }, [load]);

  const money = (v) => (v == null ? '—' : formatPrice(v, lang));
  const minutesAgo = data ? Math.max(0, Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 60000)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-semibold">{tr('Tableau de bord', 'لوحة القيادة')}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {data
              ? tr(
                  `Commandes passées sur les ${days} derniers jours · mis à jour ${minutesAgo ? `il y a ${minutesAgo} min` : 'à l’instant'}`,
                  `الطلبات خلال آخر ${days} يوما · حُدّث ${minutesAgo ? `منذ ${minutesAgo} دقيقة` : 'الآن'}`
                )
              : tr('Chargement…', 'جاري التحميل…')}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={tr('Période', 'الفترة')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={days === p} onClick={() => setDays(p)}>
              {tr(`${p} jours`, `${p} يوما`)}
            </button>
          ))}
          <button type="button" className="btn-ghost p-2" onClick={load} disabled={state.loading} aria-label={tr('Actualiser', 'تحديث')}>
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {state.error && <Notice tone="error" action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>}>{state.error}</Notice>}
      {!data && state.loading && <Spinner label={tr('Calcul des chiffres…', 'جاري حساب الأرقام…')} />}
      {data && <Dashboard lang={lang} data={data} isAdmin={isAdmin} onGo={onGo} money={money} />}
    </div>
  );
}

function Dashboard({ lang, data, isAdmin, onGo, money }) {
  const tr = t(lang);
  const o = data.orders;
  const k = o.kpis;
  const placedLabel = tr('Commandes passées', 'طلبات جديدة');
  const deliveredLabel = tr('Livrées', 'مسلّمة');

  return (
    <>
      {data.truncated && <Notice tone="warning">{tr('Plus de 5 000 commandes sur la période : les chiffres sont partiels. Choisissez une période plus courte.', 'أكثر من 5000 طلب: الأرقام جزئية. اختر فترة أقصر.')}</Notice>}

      {/* What needs doing now */}
      {k.lateCount > 0 ? (
        <section className="rounded-2xl border border-status-unsafe/40 bg-status-unsafe/10 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-status-unsafe-ink" aria-hidden="true" />
            <h2 className="flex-1 font-semibold">{tr(`${k.lateCount} commande(s) en retard`, `${k.lateCount} طلب متأخر`)}</h2>
            <button type="button" className="btn-quiet" onClick={() => onGo('orders')}>
              {tr('Ouvrir les commandes', 'فتح الطلبات')}
            </button>
          </div>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {o.late.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <span className="shrink-0 whitespace-nowrap font-medium tabular-nums" dir="ltr">{l.reference}</span>
                <span className="min-w-0 truncate text-ink-soft">
                  {tr(ORDER_STATUS[l.status]?.staffFr, ORDER_STATUS[l.status]?.staffAr)} · {l.storeName}
                </span>
                <span className="ms-auto shrink-0 text-xs font-medium text-status-unsafe-ink">+{duration(l.hoursLate, lang)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            {tr(
              'En retard : à appeler depuis plus de 24 h (après les 3 jours d’attente WhatsApp), à transmettre depuis 24 h, chez l’artisan depuis 48 h, prête depuis 24 h, en livraison depuis 5 jours.',
              'متأخر: للاتصال منذ أكثر من 24 س، للإرسال منذ 24 س، عند الحرفي منذ 48 س، جاهز منذ 24 س، قيد التوصيل منذ 5 أيام.'
            )}
          </p>
        </section>
      ) : (
        <Notice tone="success" title={tr('Aucune commande en retard', 'لا توجد طلبات متأخرة')} />
      )}

      {/* Headline */}
      <section className="grid gap-3 lg:grid-cols-[1.3fr_2fr]">
        <div className="panel flex flex-col justify-between p-5">
          <p className="text-sm text-ink-soft">{tr('Encaissé (commandes livrées)', 'المحصّل (طلبات مسلّمة)')}</p>
          <p className="mt-2 text-5xl font-semibold tracking-[-0.02em]">{money(k.revenue)}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {tr(`${k.delivered} livraison(s) · panier moyen ${money(k.averageBasket)}`, `${k.delivered} تسليم · معدل السلة ${money(k.averageBasket)}`)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {tr(`En cours : ${money(k.activeValue)} à encaisser`, `قيد المعالجة: ${money(k.activeValue)}`)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label={placedLabel} value={compact(k.placed, lang)} hint={tr(`${k.confirmed} confirmée(s)`, `${k.confirmed} مؤكدة`)} />
          <StatTile label={tr('Taux de confirmation', 'نسبة التأكيد')} value={pct(k.confirmationRate, lang)} hint={tr('des commandes traitées', 'من الطلبات المعالجة')} />
          <StatTile label={tr('Annulations', 'الإلغاءات')} value={pct(k.cancellationRate, lang)} hint={tr(`${k.cancelled} commande(s)`, `${k.cancelled} طلب`)} tone={k.cancellationRate >= 20 ? 'bad' : undefined} />
          <StatTile label={tr('Délai de confirmation', 'مدة التأكيد')} value={duration(k.medianConfirmHours, lang)} hint={tr('médiane, commande → confirmée', 'الوسيط')} />
          <StatTile label={tr('Préparation artisan', 'تحضير الحرفي')} value={duration(k.medianPrepHours, lang)} hint={tr('médiane, transmise → prête', 'الوسيط')} />
          <StatTile label={tr('Commande → livraison', 'من الطلب إلى التسليم')} value={duration(k.medianLeadHours, lang)} hint={tr(`dont transport ${duration(k.medianShippingHours, lang)}`, `منها النقل ${duration(k.medianShippingHours, lang)}`)} />
        </div>
      </section>

      {/* Over time */}
      <section className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={tr('Commandes par jour', 'الطلبات يوميا')}
          subtitle={tr('Passées (barres) et livrées (ligne), même échelle', 'الجديدة (أعمدة) والمسلّمة (خط)')}
          legend={<Legend items={[{ label: placedLabel, color: SERIES[0] }, { label: deliveredLabel, color: SERIES[1], kind: 'line' }]} />}
          table={
            <DataTable
              emptyText="—"
              maxHeight={240}
              columns={[
                { key: 'day', label: tr('Jour', 'اليوم'), render: (r) => dayLabel(r.day, lang, true) },
                { key: 'placed', label: placedLabel, numeric: true },
                { key: 'delivered', label: deliveredLabel, numeric: true },
              ]}
              rows={[...o.daily].reverse().map((d) => ({ ...d, key: d.day }))}
            />
          }
        >
          <DailyChart
            lang={lang}
            data={o.daily}
            bar={{ key: 'placed', label: placedLabel }}
            line={{ key: 'delivered', label: deliveredLabel }}
            ariaLabel={tr(`Commandes par jour : ${k.placed} passées, ${k.delivered} livrées`, `الطلبات يوميا`)}
          />
        </ChartCard>
        <ChartCard
          lang={lang}
          title={tr('Encaissé par jour', 'المحصّل يوميا')}
          subtitle={tr('Montant des commandes livrées ce jour-là', 'مبلغ الطلبات المسلّمة في ذلك اليوم')}
          table={
            <DataTable
              emptyText="—"
              maxHeight={240}
              columns={[
                { key: 'day', label: tr('Jour', 'اليوم'), render: (r) => dayLabel(r.day, lang, true) },
                { key: 'revenue', label: tr('Encaissé', 'المحصّل'), numeric: true, render: (r) => money(r.revenue) },
              ]}
              rows={[...o.daily].reverse().map((d) => ({ ...d, key: d.day }))}
            />
          }
        >
          <DailyChart lang={lang} data={o.daily} bar={{ key: 'revenue', label: tr('Encaissé', 'المحصّل'), format: money }} ariaLabel={tr(`Encaissé par jour, total ${money(k.revenue)}`, 'المحصّل يوميا')} />
        </ChartCard>
      </section>

      {/* Pipeline and WhatsApp */}
      <section className="grid gap-3 lg:grid-cols-2">
        <ChartCard lang={lang} title={tr('Commandes en cours, par étape', 'الطلبات الجارية حسب المرحلة')} subtitle={tr('Maintenant, toutes dates confondues', 'الآن، كل التواريخ')}>
          <BarList
            lang={lang}
            emptyText={tr('Aucune commande en cours', 'لا توجد طلبات جارية')}
            rows={STAGES.map((s) => ({
              key: s.id,
              label: tr(s.fr, s.ar),
              value: o.pipeline[s.id]?.count || 0,
              note:
                o.pipeline[s.id]?.late > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-status-unsafe-ink">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {tr(`${o.pipeline[s.id].late} en retard`, `${o.pipeline[s.id].late} متأخر`)}
                  </span>
                ) : null,
            }))}
          />
          <button type="button" className="btn-ghost -ms-3 text-sm" onClick={() => onGo('orders')}>
            {tr('Traiter les commandes', 'معالجة الطلبات')}
          </button>
        </ChartCard>
        <ChartCard lang={lang} title={tr('Confirmation par WhatsApp', 'التأكيد عبر واتساب')} subtitle={tr('Commandes de la période', 'طلبات الفترة')}>
          <WhatsAppFunnel lang={lang} w={o.whatsapp} share={k.whatsappConfirmShare} />
        </ChartCard>
      </section>

      {/* Artisans */}
      <ChartCard lang={lang} title={tr('Par artisan', 'حسب الحرفي')} subtitle={tr('Commandes passées sur la période et ce qu’elles sont devenues', 'طلبات الفترة ومآلها')}>
        <DataTable
          emptyText={tr('Aucune commande sur la période', 'لا توجد طلبات في هذه الفترة')}
          columns={[
            { key: 'name', label: tr('Boutique', 'المحل') },
            { key: 'count', label: tr('Commandes', 'الطلبات'), numeric: true },
            { key: 'delivered', label: deliveredLabel, numeric: true },
            { key: 'cancelled', label: tr('Annulées', 'ملغاة'), numeric: true },
            { key: 'revenue', label: tr('Encaissé', 'المحصّل'), numeric: true, render: (r) => money(r.revenue) },
            { key: 'medianPrepHours', label: tr('Préparation', 'التحضير'), numeric: true, render: (r) => duration(r.medianPrepHours, lang) },
          ]}
          rows={o.byStore.map((s) => ({ ...s, key: s.storeId || s.name }))}
        />
      </ChartCard>

      <section className="grid gap-3 lg:grid-cols-2">
        <ChartCard lang={lang} title={tr('Produits les plus commandés', 'المنتجات الأكثر طلبا')} subtitle={tr('Exemplaires, hors commandes annulées', 'عدد القطع، دون الملغاة')}>
          <BarList lang={lang} emptyText={tr('Aucune commande sur la période', 'لا توجد طلبات')} rows={o.topProducts.map((p, i) => ({ key: `${p.name}-${i}`, label: `${p.name} · ${p.storeName}`, value: p.count }))} />
        </ChartCard>
        <ChartCard lang={lang} title={tr('Villes de livraison', 'مدن التوصيل')} subtitle={tr('Commandes passées sur la période', 'طلبات الفترة')}>
          <BarList lang={lang} emptyText={tr('Aucune commande sur la période', 'لا توجد طلبات')} rows={o.byCity.map((c) => ({ key: c.name, label: c.name, value: c.count }))} />
        </ChartCard>
        <ChartCard lang={lang} title={tr('Transporteurs', 'شركات التوصيل')} subtitle={tr('Livraisons de la période et durée médiane du transport', 'تسليمات الفترة ومدة النقل')}>
          <DataTable
            emptyText={tr('Aucune livraison sur la période', 'لا توجد تسليمات')}
            columns={[
              { key: 'name', label: tr('Transporteur', 'الناقل') },
              { key: 'count', label: deliveredLabel, numeric: true },
              { key: 'medianHours', label: tr('Transport', 'النقل'), numeric: true, render: (r) => duration(r.medianHours, lang) },
            ]}
            rows={o.byCarrier.map((c) => ({ ...c, key: c.name }))}
          />
        </ChartCard>
        <ChartCard lang={lang} title={tr('Raisons d’annulation', 'أسباب الإلغاء')} subtitle={tr('Commandes annulées sur la période', 'طلبات ملغاة في الفترة')}>
          <BarList lang={lang} emptyText={tr('Aucune annulation', 'لا توجد إلغاءات')} rows={o.cancelReasons.map((c) => ({ key: c.name, label: c.name, value: c.count }))} />
        </ChartCard>
      </section>

      <ChartCard lang={lang} title={tr('Activité de l’équipe', 'نشاط الفريق')} subtitle={tr('Actions sur les commandes pendant la période', 'الإجراءات على الطلبات خلال الفترة')}>
        <DataTable
          emptyText={tr('Aucune action sur la période', 'لا توجد إجراءات')}
          columns={[
            { key: 'name', label: tr('Compte', 'الحساب'), render: (r) => <span dir="ltr">{r.name}</span> },
            { key: 'steps', label: tr('Étapes', 'مراحل'), numeric: true },
            { key: 'calls', label: tr('Appels', 'مكالمات'), numeric: true },
            { key: 'edits', label: tr('Modifications', 'تعديلات'), numeric: true },
            { key: 'notes', label: tr('Notes', 'ملاحظات'), numeric: true },
            { key: 'count', label: tr('Total', 'المجموع'), numeric: true },
          ]}
          rows={o.team.map((m) => ({ ...m, key: m.name }))}
        />
      </ChartCard>

      {isAdmin && data.platform && <Platform lang={lang} p={data.platform} days={data.days} onGo={onGo} />}
    </>
  );
}

/** Where the WhatsApp requests of the period ended up */
function WhatsAppFunnel({ lang, w, share }) {
  const tr = t(lang);
  const rows = [
    { key: 'sent', label: tr('Demandes envoyées', 'طلبات مرسلة'), value: w.sent },
    { key: 'confirmed', label: tr('Confirmées par OUI', 'مؤكدة بـ OUI'), value: w.confirmed },
    { key: 'waiting', label: tr('En attente de réponse', 'في انتظار الرد'), value: w.waiting },
    { key: 'expired', label: tr('Sans réponse après 3 jours', 'دون رد بعد 3 أيام'), value: w.expired },
    { key: 'replied', label: tr('Autre réponse', 'رد آخر'), value: w.replied },
    { key: 'failed', label: tr('Envoi échoué', 'فشل الإرسال'), value: w.failed },
  ];
  return (
    <div className="space-y-3">
      <BarList lang={lang} rows={rows} emptyText="—" />
      <p className="flex items-start gap-2 text-xs text-ink-soft">
        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {tr(
          `${w.asked} client(s) ont choisi WhatsApp, ${w.askedPhone} un appel. ${share == null ? '' : `${compact(share, lang)} % des confirmations sont venues de WhatsApp.`} Sans prix ou frais de livraison connus, aucune demande n’est envoyée.`,
          `${w.asked} اختاروا واتساب، ${w.askedPhone} مكالمة.`
        )}
      </p>
    </div>
  );
}

/** Admin only: marketplace, inbox, accounts */
function Platform({ lang, p, days, onGo }) {
  const tr = t(lang);
  const priced = p.products.total ? Math.round(((p.products.total - p.products.withoutPrice) / p.products.total) * 100) : null;
  return (
    <section className="space-y-3">
      <h2 className="pt-2 text-lg font-semibold">{tr('Plateforme', 'المنصة')}</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="panel space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            <h3 className="flex-1 font-semibold">{tr('Marché', 'السوق')}</h3>
            <button type="button" className="text-xs text-ink-soft underline underline-offset-4 hover:text-ink" onClick={() => onGo('sellers')}>
              {tr('Gérer', 'إدارة')}
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-soft">{tr('Boutiques visibles', 'محلات ظاهرة')}</dt>
            <dd className="text-end font-medium tabular-nums">{p.stores.active} / {p.stores.total}</dd>
            <dt className="text-ink-soft">{tr('Sans compte vendeur', 'دون حساب بائع')}</dt>
            <dd className="text-end font-medium tabular-nums">{p.stores.unclaimed}</dd>
            <dt className="text-ink-soft">{tr('Produits en vitrine', 'منتجات معروضة')}</dt>
            <dd className="text-end font-medium tabular-nums">{p.products.onActiveStores}</dd>
            <dt className="text-ink-soft">{tr('Produits avec prix', 'منتجات بسعر')}</dt>
            <dd className={`text-end font-medium tabular-nums ${priced != null && priced < 50 ? 'text-status-unsafe-ink' : ''}`}>{priced == null ? '—' : `${priced} %`}</dd>
          </dl>
          {p.products.withoutPrice > 0 && (
            <p className="text-xs text-ink-soft">
              {tr(
                `${p.products.withoutPrice} produit(s) sans prix : leurs commandes ne peuvent pas être confirmées par WhatsApp, l’équipe doit appeler.`,
                `${p.products.withoutPrice} منتج دون سعر: لا يمكن تأكيد طلباتها عبر واتساب.`
              )}
            </p>
          )}
        </div>

        <div className="panel space-y-3 p-4 sm:p-5">
          <h3 className="font-semibold">{tr('À traiter', 'للمعالجة')}</h3>
          <ul className="space-y-2 text-sm">
            {[
              { id: 'reports', icon: Flag, label: tr('Signalements ouverts', 'بلاغات مفتوحة'), value: p.inbox.openReports },
              { id: 'spots', icon: MapPin, label: tr('Adresses proposées', 'عناوين مقترحة'), value: p.inbox.pendingProposals },
              { id: 'sellers', icon: Store, label: tr('Demandes de vendeur', 'طلبات بائع'), value: p.inbox.pendingApplications },
            ].map(({ id, icon: Icon, label, value }) => (
              <li key={id}>
                <button type="button" onClick={() => onGo(id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-start hover:bg-canvas-paper/70">
                  <Icon className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <span className={`rounded-md px-1.5 font-medium tabular-nums ${value > 0 ? 'bg-status-unsafe text-white' : 'text-ink-soft'}`}>{value ?? '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel space-y-3 p-4 sm:p-5">
          <h3 className="font-semibold">{tr('Comptes', 'الحسابات')}</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-soft">{tr('Total', 'المجموع')}</dt>
            <dd className="text-end font-medium tabular-nums">{p.accounts.total}</dd>
            <dt className="text-ink-soft">{tr(`Nouveaux (${days} j)`, `جدد (${days} يوما)`)}</dt>
            <dd className="text-end font-medium tabular-nums">{p.accounts.newInPeriod}</dd>
            <dt className="text-ink-soft">{tr('Avec téléphone', 'برقم هاتف')}</dt>
            <dd className="text-end font-medium tabular-nums">{p.accounts.withPhone} / {p.accounts.total}</dd>
            <dt className="text-ink-soft">{tr('Clients · vendeurs', 'عملاء · بائعون')}</dt>
            <dd className="text-end font-medium tabular-nums">{p.accounts.roles.CLIENT} · {p.accounts.roles.SELLER}</dd>
            <dt className="text-ink-soft">{tr('Équipe · admins', 'الفريق · المديرون')}</dt>
            <dd className="text-end font-medium tabular-nums">{p.accounts.roles.STAFF} · {p.accounts.roles.ADMIN}</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
