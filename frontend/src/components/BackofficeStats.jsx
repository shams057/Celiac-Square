import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, MoveRight, Eye, Users, UserPlus, MessageCircleQuestion, MessagesSquare, ShoppingBag, Package, PackagePlus } from 'lucide-react';
import { fetchSiteStats, errorMessage } from '../services/api';
import { t, Notice, Spinner } from './ui';
import { DailyChart, BarList, ChartCard, DataTable, Legend, SERIES, compact, dayLabel, useMinuteTick } from './charts';

const PERIODS = [7, 30, 90];

// Timestamps compared as dates (the database writes "+00:00" where the API writes "Z")
const after = (a, b) => new Date(a).getTime() >= new Date(b).getTime();

const dateLabel = (iso, lang) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Tunis' });

/**
 * Back-office statistics (admins): how the site grows. Visits, new accounts, the forum and the marketplace,
 * each on its own chart (their sizes differ too much to share an axis), over 7, 30 or 90 days, each figure
 * compared with the period just before. Figures: GET /api/admin/stats (backend services/stats.js).
 */
export default function BackofficeStats({ lang }) {
  const tr = t(lang);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: true, error: '', unavailable: false });
  useMinuteTick();

  const load = useCallback(async () => {
    setState({ loading: true, error: '', unavailable: false });
    try {
      const res = await fetchSiteStats(days);
      setData(res.data);
      setState({ loading: false, error: '', unavailable: false });
    } catch (err) {
      const unavailable = err?.response?.data?.code === 'FEATURE_UNAVAILABLE';
      setState({ loading: false, unavailable, error: unavailable ? '' : errorMessage(err, tr('Les statistiques n’ont pas pu être chargées.', 'تعذر تحميل الإحصائيات.')) });
    }
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const minutesAgo = data ? Math.max(0, Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 60000)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-semibold">{tr('Statistiques', 'الإحصائيات')}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {data
              ? tr(
                  `${days} derniers jours, comparés aux ${days} jours d’avant · mis à jour ${minutesAgo ? `il y a ${minutesAgo} min` : 'à l’instant'}`,
                  `آخر ${days} يوما مقارنة بالـ${days} يوما السابقة · حُدّث ${minutesAgo ? `منذ ${minutesAgo} دقيقة` : 'الآن'}`
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

      {state.unavailable && (
        <Notice tone="warning" title={tr('Statistiques pas encore disponibles', 'الإحصائيات غير متاحة بعد')}>
          {tr(
            'La base de données n’a pas encore reçu la mise à jour des statistiques (supabase/migrations/20261122100000_site_stats.sql).',
            'لم تتلق قاعدة البيانات تحديث الإحصائيات بعد.'
          )}
        </Notice>
      )}
      {state.error && <Notice tone="error" action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>}>{state.error}</Notice>}
      {!data && state.loading && <Spinner label={tr('Calcul des chiffres…', 'جاري حساب الأرقام…')} />}
      {data && <Stats lang={lang} data={data} />}
    </div>
  );
}

/** A headline figure: its value over the period, and how it moved from the period before */
function Kpi({ lang, icon: Icon, label, kpi, days, hint }) {
  const tr = t(lang);
  const c = kpi.change;
  const Trend = c > 0 ? TrendingUp : c < 0 ? TrendingDown : MoveRight;
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{compact(kpi.value, lang)}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
        {c != null && (
          <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${c > 0 ? 'text-status-safe-ink' : c < 0 ? 'text-status-unsafe-ink' : 'text-ink-soft'}`}>
            <Trend className="h-3.5 w-3.5" aria-hidden="true" />
            <span dir="ltr">{c > 0 ? '+' : ''}{compact(c, lang)} %</span>
          </span>
        )}
        <span className="text-ink-faint">{tr(`${compact(kpi.previous, lang)} les ${days} j d’avant`, `${compact(kpi.previous, lang)} في الـ${days} يوما السابقة`)}</span>
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** The table behind a daily chart (the "Tableau" view): most recent day first */
const dailyTable = (lang, daily, series) => (
  <DataTable
    emptyText="—"
    maxHeight={240}
    columns={[{ key: 'day', label: t(lang)('Jour', 'اليوم'), render: (r) => dayLabel(r.day, lang, true) }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))]}
    rows={[...daily].reverse().map((d) => ({ ...d, key: d.day }))}
  />
);

function Stats({ lang, data }) {
  const tr = t(lang);
  const { kpis: k, daily, totals, days } = data;
  const sum = (key) => daily.reduce((s, d) => s + d[key], 0);

  const label = {
    visits: tr('Visites', 'الزيارات'),
    visitors: tr('Visiteurs', 'الزوار'),
    accounts: tr('Nouveaux comptes', 'حسابات جديدة'),
    questions: tr('Questions', 'الأسئلة'),
    answers: tr('Réponses', 'الردود'),
    items: tr('Articles achetés', 'قطع مشتراة'),
    orders: tr('Commandes', 'الطلبات'),
    products: tr('Nouveaux produits', 'منتجات جديدة'),
  };

  // Visits are counted from the version that added them: say so while the period starts earlier
  const visitsNote = !data.visitsSince
    ? tr('Aucune visite comptée pour l’instant : le comptage commence avec cette version du site (en production uniquement).', 'لم تُحتسب أي زيارة بعد: يبدأ العدّ مع هذه النسخة من الموقع.')
    : after(data.visitsSince, data.from) && data.visitsSince !== data.from
      ? tr(`Visites comptées depuis le ${dateLabel(data.visitsSince, lang)} : avant, les jours sont à 0.`, `الزيارات محتسبة منذ ${dateLabel(data.visitsSince, lang)}.`)
      : '';

  const answersPerQuestion = k.questions.value ? Math.round((k.answers.value / k.questions.value) * 10) / 10 : null;

  return (
    <>
      {/* Headline figures */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi lang={lang} days={days} icon={Eye} label={label.visits} kpi={k.visits} />
        <Kpi lang={lang} days={days} icon={Users} label={tr('Visiteurs uniques', 'زوار فريدون')} kpi={k.visitors} />
        <Kpi lang={lang} days={days} icon={UserPlus} label={label.accounts} kpi={k.accounts} hint={totals.accounts != null ? tr(`${compact(totals.accounts, lang)} comptes en tout`, `${compact(totals.accounts, lang)} حساب في المجموع`) : null} />
        <Kpi lang={lang} days={days} icon={MessageCircleQuestion} label={tr('Questions du forum', 'أسئلة المنتدى')} kpi={k.questions} hint={totals.questions != null ? tr(`${compact(totals.questions, lang)} en tout`, `${compact(totals.questions, lang)} في المجموع`) : null} />
        <Kpi lang={lang} days={days} icon={MessagesSquare} label={tr('Réponses du forum', 'ردود المنتدى')} kpi={k.answers} hint={totals.answers != null ? tr(`${compact(totals.answers, lang)} en tout`, `${compact(totals.answers, lang)} في المجموع`) : null} />
        <Kpi lang={lang} days={days} icon={Package} label={tr('Commandes du marché', 'طلبات السوق')} kpi={k.orders} hint={tr('hors annulées', 'دون الملغاة')} />
        <Kpi lang={lang} days={days} icon={ShoppingBag} label={label.items} kpi={k.items} hint={tr('exemplaires, hors annulées', 'قطع، دون الملغاة')} />
        <Kpi lang={lang} days={days} icon={PackagePlus} label={tr('Nouveaux produits', 'منتجات جديدة')} kpi={k.products} hint={totals.listedProducts != null ? tr(`${compact(totals.listedProducts, lang)} en vente`, `${compact(totals.listedProducts, lang)} معروضة`) : null} />
      </section>

      {/* Audience */}
      <section className="space-y-3">
        <h2 className="pt-2 text-lg font-semibold">{tr('Audience', 'الجمهور')}</h2>
        {visitsNote && <p className="text-sm text-ink-soft">{visitsNote}</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            lang={lang}
            title={tr('Visites par jour', 'الزيارات يوميا')}
            subtitle={tr('Visites (barres) et visiteurs différents ce jour-là (ligne). Une visite s’arrête après 30 min d’absence.', 'الزيارات (أعمدة) والزوار المختلفون (خط).')}
            legend={<Legend items={[{ label: label.visits, color: SERIES[0] }, { label: label.visitors, color: SERIES[1], kind: 'line' }]} />}
            table={dailyTable(lang, daily, [{ key: 'visits', label: label.visits }, { key: 'visitors', label: label.visitors }])}
          >
            <DailyChart
              lang={lang}
              data={daily}
              bar={{ key: 'visits', label: label.visits }}
              line={{ key: 'visitors', label: label.visitors }}
              ariaLabel={tr(`Visites par jour : ${k.visits.value} visites sur la période`, 'الزيارات يوميا')}
            />
          </ChartCard>
          <ChartCard
            lang={lang}
            title={tr('Nouveaux comptes par jour', 'الحسابات الجديدة يوميا')}
            subtitle={tr(`${compact(sum('accounts'), lang)} inscription(s) sur la période`, `${compact(sum('accounts'), lang)} تسجيل في الفترة`)}
            table={dailyTable(lang, daily, [{ key: 'accounts', label: label.accounts }])}
          >
            <DailyChart lang={lang} data={daily} bar={{ key: 'accounts', label: label.accounts }} ariaLabel={tr(`Nouveaux comptes par jour : ${k.accounts.value} sur la période`, 'الحسابات الجديدة يوميا')} />
          </ChartCard>
        </div>
      </section>

      {/* Forum */}
      <section className="space-y-3">
        <h2 className="pt-2 text-lg font-semibold">{tr('Forum', 'المنتدى')}</h2>
        <ChartCard
          lang={lang}
          title={tr('Questions et réponses par jour', 'الأسئلة والردود يوميا')}
          subtitle={
            answersPerQuestion == null
              ? tr('Questions publiées (barres) et réponses (ligne)', 'الأسئلة (أعمدة) والردود (خط)')
              : tr(`Questions publiées (barres) et réponses (ligne) · ${compact(answersPerQuestion, lang)} réponse(s) par question sur la période`, `الأسئلة (أعمدة) والردود (خط) · ${compact(answersPerQuestion, lang)} رد لكل سؤال`)
          }
          legend={<Legend items={[{ label: label.questions, color: SERIES[0] }, { label: label.answers, color: SERIES[1], kind: 'line' }]} />}
          table={dailyTable(lang, daily, [{ key: 'questions', label: label.questions }, { key: 'answers', label: label.answers }])}
        >
          <DailyChart
            lang={lang}
            data={daily}
            bar={{ key: 'questions', label: label.questions }}
            line={{ key: 'answers', label: label.answers }}
            ariaLabel={tr(`Forum : ${k.questions.value} questions et ${k.answers.value} réponses sur la période`, 'المنتدى يوميا')}
          />
        </ChartCard>
      </section>

      {/* Marketplace: its own charts */}
      <section className="space-y-3">
        <h2 className="pt-2 text-lg font-semibold">{tr('Marché', 'السوق')}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            lang={lang}
            title={tr('Achats par jour', 'المشتريات يوميا')}
            subtitle={tr('Articles achetés (barres) et commandes (ligne), hors commandes annulées', 'القطع المشتراة (أعمدة) والطلبات (خط)، دون الملغاة')}
            legend={<Legend items={[{ label: label.items, color: SERIES[0] }, { label: label.orders, color: SERIES[1], kind: 'line' }]} />}
            table={dailyTable(lang, daily, [{ key: 'items', label: label.items }, { key: 'orders', label: label.orders }])}
          >
            <DailyChart
              lang={lang}
              data={daily}
              bar={{ key: 'items', label: label.items }}
              line={{ key: 'orders', label: label.orders }}
              ariaLabel={tr(`Achats par jour : ${k.items.value} articles dans ${k.orders.value} commandes`, 'المشتريات يوميا')}
            />
          </ChartCard>
          <ChartCard
            lang={lang}
            title={tr('Nouveaux produits par jour', 'المنتجات الجديدة يوميا')}
            subtitle={tr(
              `Produits mis en vente par les vendeurs${totals.activeStores != null ? ` · ${compact(totals.activeStores, lang)} boutique(s) visible(s)` : ''}`,
              `منتجات أضافها البائعون${totals.activeStores != null ? ` · ${compact(totals.activeStores, lang)} محل ظاهر` : ''}`
            )}
            table={dailyTable(lang, daily, [{ key: 'products', label: label.products }])}
          >
            <DailyChart lang={lang} data={daily} bar={{ key: 'products', label: label.products }} ariaLabel={tr(`Nouveaux produits par jour : ${k.products.value} sur la période`, 'المنتجات الجديدة يوميا')} />
          </ChartCard>
          <ChartCard lang={lang} title={tr('Meilleures ventes', 'الأكثر مبيعا')} subtitle={tr('Articles achetés sur la période, hors commandes annulées', 'القطع المشتراة في الفترة، دون الملغاة')}>
            <BarList
              lang={lang}
              stacked
              emptyText={tr('Aucun achat sur la période', 'لا مشتريات في هذه الفترة')}
              rows={data.topProducts.map((p, i) => ({
                key: `${p.id || p.name}-${i}`,
                label: p.storeName ? `${p.name} · ${p.storeName}` : p.name,
                value: p.units,
                note: <span className="text-ink-faint">{tr(`${p.orders} commande${p.orders > 1 ? 's' : ''}`, `${p.orders} طلب`)}</span>,
              }))}
            />
          </ChartCard>
          <ChartCard
            lang={lang}
            title={tr('Ventes les plus faibles', 'الأقل مبيعا')}
            subtitle={tr('Produits en vente dans les boutiques visibles, les moins achetés sur la période (0 = aucun achat). « Nouveau » : mis en vente pendant la période.', 'منتجات معروضة في المحلات الظاهرة، الأقل شراء في الفترة. «جديد»: عُرض خلال الفترة.')}
          >
            <BarList
              lang={lang}
              stacked
              emptyText={tr('Aucun produit en vente', 'لا منتجات معروضة')}
              rows={data.leastProducts.map((p, i) => ({
                key: `${p.id || p.name}-${i}`,
                label: p.storeName ? `${p.name} · ${p.storeName}` : p.name,
                value: p.units,
                // A product put on sale during the period has had less time to sell
                note:
                  p.listedAt && after(p.listedAt, data.from) ? (
                    <span className="rounded-full bg-ink/[0.07] px-1.5 py-px text-ink-soft" title={tr(`En vente depuis le ${dateLabel(p.listedAt, lang)}`, `معروض منذ ${dateLabel(p.listedAt, lang)}`)}>
                      {tr('nouveau', 'جديد')}
                    </span>
                  ) : null,
              }))}
            />
          </ChartCard>
        </div>
      </section>
    </>
  );
}
