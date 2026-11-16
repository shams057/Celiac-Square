import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Check, CircleCheckBig, ExternalLink, Flag, LoaderCircle, Lock, LockOpen, MessageCircle, MessagesSquare, Pin, PinOff, RotateCcw, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import {
  fetchForumOverview,
  fetchForumReports,
  setForumReportStatus,
  fetchAdminForumThreads,
  fetchAdminForumReplies,
  fetchForumMembers,
  blockForumMember,
  unblockForumMember,
  deleteForumMemberPosts,
  updateForumThread,
  deleteForumThread,
  deleteForumReply,
  errorMessage,
} from '../services/api';
import { useAuth } from './AuthContext';
import { navigate, pathFor } from '../services/router';
import { t, PageHead, Spinner, Notice, EmptyState, Modal } from './ui';
import { FORUM_CATEGORIES } from './Forum';

/**
 * Back-office, forum moderation (team and admins):
 *  - Signalements: the posts members reported, to delete, to dismiss, or to block their author
 *  - Questions and Réponses: everything published, with who wrote it
 *  - Membres: stop someone from posting (for a time or until lifted), lift it, remove everything they wrote
 * A blocked member still reads, likes and saves; the API refuses their questions, answers and edits.
 */

const VIEWS = [
  { id: 'reports', icon: Flag, fr: 'Signalements', ar: 'البلاغات' },
  { id: 'threads', icon: MessagesSquare, fr: 'Questions', ar: 'الأسئلة' },
  { id: 'replies', icon: MessageCircle, fr: 'Réponses', ar: 'الردود' },
  { id: 'members', icon: Users, fr: 'Membres', ar: 'الأعضاء' },
];

const REPORT_FILTERS = [
  { id: 'OPEN', fr: 'À traiter', ar: 'للمعالجة' },
  { id: 'RESOLVED', fr: 'Traités', ar: 'تمت معالجتها' },
  { id: 'DISMISSED', fr: 'Classés', ar: 'مؤرشفة' },
];

const THREAD_FILTERS = [
  { id: 'all', fr: 'Toutes', ar: 'الكل' },
  { id: 'unanswered', fr: 'Sans réponse', ar: 'بلا رد' },
  { id: 'pinned', fr: 'Épinglées', ar: 'المثبّتة' },
  { id: 'locked', fr: 'Fermées', ar: 'المغلقة' },
];

const REASONS = {
  DANGEROUS_ADVICE: ['Conseil dangereux', 'نصيحة خطيرة'],
  SPAM: ['Publicité / hors sujet', 'إعلان / خارج الموضوع'],
  ABUSE: ['Propos irrespectueux', 'كلام مسيء'],
  OTHER: ['Autre', 'أخرى'],
};

const ROLES = { ADMIN: ['Administrateur', 'مدير'], STAFF: ['Équipe', 'الفريق'], SELLER: ['Vendeur', 'بائع'], CLIENT: ['Client', 'عميل'] };

// Same choices as the API (backend/src/routes/forumAdminRoutes.js); null lasts until the block is lifted
const DURATIONS = [
  { days: 1, fr: '1 jour', ar: 'يوم واحد' },
  { days: 7, fr: '7 jours', ar: '7 أيام' },
  { days: 30, fr: '30 jours', ar: '30 يوما' },
  { days: null, fr: 'Jusqu’à nouvel ordre', ar: 'حتى إشعار آخر' },
];

const when = (iso, lang) =>
  new Date(iso).toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const day = (iso, lang) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const unavailable = (err) => err?.response?.data?.code === 'FEATURE_UNAVAILABLE';

const openThread = (threadId) => navigate(pathFor('forum', { threadId }));

export default function BackofficeForum({ lang, onCountChange }) {
  const tr = t(lang);
  const [view, setView] = useState('reports');
  const [overview, setOverview] = useState(null);
  const [missing, setMissing] = useState(false);
  // Bumped after every action, so each list reloads with the new state (a deleted post, a blocked author)
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState(null);
  const [blocking, setBlocking] = useState(null); // the member in the "block" dialog
  const [confirm, setConfirm] = useState(null); // { title, text, action, run }
  const [busy, setBusy] = useState(false);
  // "This member's posts": set from the Membres list, shown in Questions and Réponses
  const [author, setAuthor] = useState(null);

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let cancelled = false;
    fetchForumOverview()
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data);
        setMissing(false);
        onCountChange?.(res.data.openReports);
      })
      .catch((err) => !cancelled && setMissing(unavailable(err)));
    return () => {
      cancelled = true;
    };
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = (message) => {
    if (message) showToast(message);
    setVersion((v) => v + 1);
  };
  const failed = (err, fallback) => showToast(errorMessage(err, fallback || tr('L’action a échoué. Réessayez.', 'فشلت العملية. أعد المحاولة.')), 'error');

  /** Runs the action of the confirmation dialog, then closes it */
  const runConfirm = async () => {
    setBusy(true);
    try {
      changed(await confirm.run());
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const unblock = async (member) => {
    try {
      const res = await unblockForumMember(member._id);
      changed(res.message);
    } catch (err) {
      failed(err);
    }
  };

  const askDeleteThread = (thread) =>
    setConfirm({
      title: tr('Supprimer cette question ?', 'حذف هذا السؤال؟'),
      text: tr(
        `« ${thread.title} » et ${thread.replyCount > 0 ? `ses ${thread.replyCount} réponse${thread.replyCount > 1 ? 's' : ''}` : 'tout ce qui s’y rattache'} seront supprimés pour tout le monde. C’est définitif.`,
        `سيُحذف «${thread.title}» وكل ردوده لدى الجميع. هذا نهائي.`
      ),
      action: tr('Supprimer la question', 'احذف السؤال'),
      run: async () => (await deleteForumThread(thread._id)).message,
    });

  const askDeleteReply = (reply) =>
    setConfirm({
      title: tr('Supprimer cette réponse ?', 'حذف هذا الرد؟'),
      text: tr(`« ${reply.excerpt.slice(0, 140)} » sera supprimée pour tout le monde. C’est définitif.`, 'سيُحذف هذا الرد لدى الجميع. هذا نهائي.'),
      action: tr('Supprimer la réponse', 'احذف الرد'),
      run: async () => (await deleteForumReply(reply._id)).message,
    });

  const askPurge = (member) =>
    setConfirm({
      title: tr('Supprimer tous ses messages ?', 'حذف كل رسائله؟'),
      text: tr(
        `Toutes les questions et réponses de ${member.name || member.email} seront supprimées, avec les réponses données à ses questions. C’est définitif.`,
        `ستُحذف كل أسئلة وردود ${member.name || member.email}، مع الردود على أسئلته. هذا نهائي.`
      ),
      action: tr('Tout supprimer', 'احذف الكل'),
      run: async () => (await deleteForumMemberPosts(member._id)).message,
    });

  const showPostsOf = (member) => {
    setAuthor(member);
    setView('threads');
  };

  // What every list needs to act on a post or its author
  const tools = { lang, version, changed, failed, block: setBlocking, unblock, askDeleteThread, askDeleteReply, askPurge, showPostsOf, author, clearAuthor: () => setAuthor(null) };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-28 left-1/2 z-[1100] -translate-x-1/2 animate-fade-in rounded-full px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === 'error' ? 'bg-status-unsafe text-white' : 'bg-ink text-canvas-paper'
          }`}
        >
          {toast.message}
        </div>
      )}

      <PageHead
        title={tr('Forum', 'المنتدى')}
        lede={tr(
          'Traitez les messages signalés, supprimez ce qui n’a pas sa place et empêchez un membre de publier, pour un temps ou jusqu’à nouvel ordre. Chaque action est notée dans le journal.',
          'عالج الرسائل المبلّغ عنها، احذف ما لا مكان له وامنع عضوا من النشر مؤقتا أو حتى إشعار آخر. كل إجراء يُسجَّل في السجل.'
        )}
        action={
          <button type="button" className="btn-quiet" onClick={() => navigate(pathFor('forum'))}>
            <ExternalLink className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            {tr('Ouvrir le forum', 'افتح المنتدى')}
          </button>
        }
      />

      {missing ? (
        <Notice tone="warning" title={tr('Tables du forum absentes', 'جداول المنتدى غير موجودة')}>
          {tr('Appliquez les migrations supabase/migrations/20261116100000_forum.sql et 20261116130000_forum_moderation.sql.', 'طبّق ترحيلي قاعدة البيانات الخاصين بالمنتدى.')}
        </Notice>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={tr('Signalements à traiter', 'بلاغات للمعالجة')} value={overview?.openReports} alert={overview?.openReports > 0} />
            <Stat label={tr('Questions', 'الأسئلة')} value={overview?.threads} note={overview ? tr(`+${overview.threadsWeek} en 7 jours`, `+${overview.threadsWeek} خلال 7 أيام`) : ''} />
            <Stat label={tr('Réponses', 'الردود')} value={overview?.replies} note={overview ? tr(`+${overview.repliesWeek} en 7 jours`, `+${overview.repliesWeek} خلال 7 أيام`) : ''} />
            <Stat label={tr('Membres bloqués', 'أعضاء محظورون')} value={overview?.blocked} />
          </dl>

          <div className="flex flex-wrap gap-2" role="group" aria-label={tr('Afficher', 'عرض')}>
            {VIEWS.map(({ id, icon: Icon, fr, ar }) => (
              <button key={id} type="button" className="chip" aria-pressed={view === id} onClick={() => setView(id)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tr(fr, ar)}
                {id === 'reports' && overview?.openReports > 0 && <span className="rounded-full bg-status-unsafe px-1.5 text-xs font-medium tabular-nums text-white">{overview.openReports}</span>}
              </button>
            ))}
          </div>

          {view === 'reports' ? <Reports {...tools} /> : view === 'threads' ? <Threads {...tools} /> : view === 'replies' ? <Replies {...tools} /> : <Members {...tools} />}
        </>
      )}

      {blocking && (
        <BlockDialog
          member={blocking}
          lang={lang}
          onClose={() => setBlocking(null)}
          onDone={(message) => {
            setBlocking(null);
            changed(message);
          }}
        />
      )}

      {confirm && (
        <Modal open onClose={() => (busy ? null : setConfirm(null))} lang={lang} width="max-w-md" title={confirm.title}>
          <p dir="auto" className="text-start text-[15px] text-ink-soft">
            {confirm.text}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-danger" onClick={runConfirm} disabled={busy}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {confirm.action}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>
              {tr('Annuler', 'إلغاء')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, note, alert = false }) {
  return (
    <div className="panel px-4 py-3.5">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={`mt-0.5 text-[1.75rem] font-semibold leading-tight tabular-nums tracking-[-0.02em] ${alert ? 'text-status-unsafe-ink' : ''}`}>{value ?? '–'}</dd>
      {note && <dd className="text-xs text-ink-faint">{note}</dd>}
    </div>
  );
}

/** A list fetched from the API, reloaded when `deps` change: { items, meta, state, reload, more } */
function useList(fetcher, deps) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ count: 0, page: 1, hasMore: false });
  const [state, setState] = useState({ loading: true, error: '', more: false });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: s.loading || items.length === 0, error: '' }));
    try {
      const res = await fetcher(1);
      setItems(res.data || []);
      setMeta({ count: res.count || 0, page: 1, hasMore: Boolean(res.hasMore) });
      setState({ loading: false, error: '', more: false });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, 'error'), more: false });
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const more = async () => {
    setState((s) => ({ ...s, more: true }));
    try {
      const res = await fetcher(meta.page + 1);
      setItems((list) => [...list, ...(res.data || [])]);
      setMeta({ count: res.count || 0, page: meta.page + 1, hasMore: Boolean(res.hasMore) });
    } catch {
      // The button stays: another tap retries
    } finally {
      setState((s) => ({ ...s, more: false }));
    }
  };

  return { items, meta, state, reload: load, more };
}

/** Loading, error and empty states shared by the four lists; `children` is the list itself */
function ListBody({ list, lang, empty, children }) {
  const tr = t(lang);
  if (list.state.loading) return <Spinner label={tr('Chargement…', 'جاري التحميل…')} />;
  if (list.state.error) {
    return (
      <Notice
        tone="error"
        title={tr('Le chargement a échoué.', 'فشل التحميل.')}
        action={
          <button type="button" className="btn-quiet" onClick={list.reload}>
            {tr('Réessayer', 'إعادة المحاولة')}
          </button>
        }
      />
    );
  }
  if (list.items.length === 0) return empty;
  return (
    <>
      {children}
      {list.meta.hasMore && (
        <div className="flex justify-center">
          <button type="button" className="btn-quiet" onClick={list.more} disabled={list.state.more}>
            {list.state.more && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {tr('Voir plus', 'عرض المزيد')}
          </button>
        </div>
      )}
    </>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  // Typing searches after a pause, so each word does not cost a request
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text.trim() === value) return undefined;
    const timer = setTimeout(() => onChange(text.trim()), 350);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative max-w-md flex-1">
      <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      <input type="search" dir="auto" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} className="field rounded-full ps-11" placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

/** Who wrote a post, as the team sees them: full name, e-mail, role, and whether they are blocked */
function MemberLine({ member, lang }) {
  const tr = t(lang);
  if (!member) return <span className="text-sm text-ink-faint">{tr('Compte supprimé', 'حساب محذوف')}</span>;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span dir="auto" className="font-medium text-ink">
        {member.name || member.publicName || tr('Sans nom', 'بلا اسم')}
      </span>
      <span dir="ltr" className="truncate text-ink-faint">
        {member.email}
      </span>
      {member.role !== 'CLIENT' && <span className="rounded-full bg-ink/[0.07] px-2 py-0.5 text-xs font-medium text-ink-soft">{tr(...(ROLES[member.role] || ROLES.CLIENT))}</span>}
      {member.block && <BlockTag block={member.block} lang={lang} />}
    </span>
  );
}

function BlockTag({ block, lang }) {
  const tr = t(lang);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-status-unsafe/15 px-2 py-0.5 text-xs font-medium text-status-unsafe-ink">
      <Ban className="h-3 w-3" aria-hidden="true" />
      {block.until ? tr(`Bloqué jusqu’au ${day(block.until, lang)}`, `محظور حتى ${day(block.until, lang)}`) : tr('Bloqué', 'محظور')}
    </span>
  );
}

const rowButton = 'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50';
const dangerButton = 'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-status-unsafe-ink transition-colors hover:bg-status-unsafe/10 disabled:cursor-not-allowed disabled:opacity-50';

/** "Bloquer l'auteur" / "Débloquer", for anyone who is not on the team */
function BlockButton({ member, lang, block, unblock }) {
  const tr = t(lang);
  const { user } = useAuth();
  if (!member || member.role === 'ADMIN' || member.role === 'STAFF' || member._id === user?._id) return null;
  return member.block ? (
    <button type="button" className={rowButton} onClick={() => unblock(member)}>
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      {tr('Débloquer', 'إلغاء الحظر')}
    </button>
  ) : (
    <button type="button" className={dangerButton} onClick={() => block(member)}>
      <Ban className="h-4 w-4" aria-hidden="true" />
      {tr('Bloquer l’auteur', 'احظر الكاتب')}
    </button>
  );
}

/** "Messages de <member>" with a way out, above Questions and Réponses */
function AuthorFilter({ author, clearAuthor, lang }) {
  const tr = t(lang);
  if (!author) return null;
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-canvas-paper">
      {tr(`Messages de ${author.name || author.email}`, `رسائل ${author.name || author.email}`)}
      <button type="button" onClick={clearAuthor} className="-me-1.5 flex h-7 w-7 items-center justify-center rounded-full hover:bg-canvas-paper/20" aria-label={tr('Voir tous les messages', 'عرض كل الرسائل')}>
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------

function Reports({ lang, version, changed, failed, block, unblock }) {
  const tr = t(lang);
  const [status, setStatus] = useState('OPEN');
  const [busyId, setBusyId] = useState(null);
  const list = useList(() => fetchForumReports(status), [status, version]);

  const setReport = async (report, next) => {
    setBusyId(report._id);
    try {
      const res = await setForumReportStatus(report._id, next);
      changed(res.message);
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  // Deleting the reported post settles the report
  const removePost = async (report) => {
    setBusyId(report._id);
    try {
      if (report.kind === 'reply') await deleteForumReply(report.post._id);
      else await deleteForumThread(report.post._id);
      await setForumReportStatus(report._id, 'RESOLVED');
      changed(tr('Message supprimé, signalement traité.', 'حُذفت الرسالة وعولج البلاغ.'));
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4" aria-label={tr('Signalements', 'البلاغات')}>
      <div className="flex flex-wrap gap-1" role="group" aria-label={tr('Filtrer', 'تصفية')}>
        {REPORT_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={status === f.id}
            onClick={() => setStatus(f.id)}
            className={`min-h-10 rounded-full px-3.5 text-sm transition-colors ${status === f.id ? 'bg-ink/[0.08] font-medium text-ink' : 'text-ink-soft hover:text-ink'}`}
          >
            {tr(f.fr, f.ar)}
          </button>
        ))}
      </div>
      <ListBody
        list={list}
        lang={lang}
        empty={
          <EmptyState title={status === 'OPEN' ? tr('Aucun message signalé à traiter', 'لا توجد رسائل مبلّغ عنها للمعالجة') : tr('Aucun signalement', 'لا توجد بلاغات')}>
            {status === 'OPEN' ? tr('Les membres signalent un message avec le drapeau placé dessous.', 'يبلّغ الأعضاء عن رسالة بالعلم الموجود تحتها.') : ''}
          </EmptyState>
        }
      >
        <ul className="space-y-3">
          {list.items.map((r) => {
            const urgent = r.reason === 'DANGEROUS_ADVICE' && r.status === 'OPEN';
            const disabled = busyId === r._id;
            return (
              <li key={r._id} className={`panel space-y-3 p-4 sm:p-5 ${urgent ? 'ring-1 ring-status-unsafe/50' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-md px-2 py-0.5 font-medium ${urgent ? 'bg-status-unsafe/15 text-status-unsafe-ink' : 'bg-canvas-sunk text-ink'}`}>{tr(...(REASONS[r.reason] || REASONS.OTHER))}</span>
                  <span className="text-ink-soft">{r.kind === 'reply' ? tr('Réponse', 'رد') : tr('Question', 'سؤال')}</span>
                  <span className="ms-auto text-xs text-ink-faint">{when(r.createdAt, lang)}</span>
                </div>

                {r.post ? (
                  <div className="space-y-2 rounded-xl bg-ink/[0.04] px-3.5 py-3">
                    <MemberLine member={r.post.author} lang={lang} />
                    <p dir="auto" className="whitespace-pre-line break-words text-start text-[15px]">
                      {r.post.text}
                    </p>
                    {r.kind === 'reply' && r.threadTitle && (
                      <p dir="auto" className="text-start text-xs text-ink-faint">
                        {tr('Dans : ', 'في: ')}
                        {r.threadTitle}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl bg-ink/[0.04] px-3.5 py-3 text-sm text-ink-soft">
                    {tr('Ce message a déjà été supprimé.', 'هذه الرسالة حُذفت من قبل.')}
                    {r.label && (
                      <span dir="auto" className="mt-1 block text-ink-faint">
                        {r.label}
                      </span>
                    )}
                  </p>
                )}

                {r.message && (
                  <p dir="auto" className="whitespace-pre-line border-s-2 border-canvas-line ps-3 text-start text-sm">
                    {r.message}
                  </p>
                )}
                <p className="text-xs text-ink-faint">
                  {r.reporter ? tr(`Signalé par ${r.reporter.fullName || r.reporter.email} (${r.reporter.email})`, `بلّغ عنه ${r.reporter.fullName || r.reporter.email}`) : tr('Signalé par un visiteur non connecté', 'بلّغ عنه زائر غير مسجل')}
                  {r.resolvedAt && ` · ${tr('clos le', 'أُغلق في')} ${when(r.resolvedAt, lang)}`}
                </p>

                <div className="-mx-2 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-ink/10 pt-2">
                  {r.threadId && (
                    <button type="button" className={rowButton} onClick={() => openThread(r.threadId)}>
                      <ExternalLink className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                      {tr('Voir', 'عرض')}
                    </button>
                  )}
                  {r.post && (
                    <button type="button" className={dangerButton} disabled={disabled} onClick={() => removePost(r)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {tr('Supprimer le message', 'احذف الرسالة')}
                    </button>
                  )}
                  {r.post && <BlockButton member={r.post.author} lang={lang} block={block} unblock={unblock} />}
                  <span className="ms-auto flex flex-wrap gap-1">
                    {r.status === 'OPEN' ? (
                      <>
                        <button type="button" className={rowButton} disabled={disabled} onClick={() => setReport(r, 'DISMISSED')}>
                          <X className="h-4 w-4" aria-hidden="true" />
                          {tr('Classer sans suite', 'أرشفة')}
                        </button>
                        <button type="button" className={`${rowButton} font-medium text-ink`} disabled={disabled} onClick={() => setReport(r, 'RESOLVED')}>
                          <Check className="h-4 w-4" aria-hidden="true" />
                          {tr('Traité', 'تمت المعالجة')}
                        </button>
                      </>
                    ) : (
                      <button type="button" className={rowButton} disabled={disabled} onClick={() => setReport(r, 'OPEN')}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        {tr('Rouvrir', 'إعادة الفتح')}
                      </button>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </ListBody>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------

function Threads({ lang, version, changed, failed, block, unblock, askDeleteThread, author, clearAuthor }) {
  const tr = t(lang);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const list = useList((page) => fetchAdminForumThreads({ q, filter, author: author?._id, page }), [q, filter, author?._id, version]);

  const setFlag = async (thread, changes, message) => {
    setBusyId(thread._id);
    try {
      await updateForumThread(thread._id, changes);
      changed(message);
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4" aria-label={tr('Questions', 'الأسئلة')}>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder={tr('Chercher dans les questions', 'ابحث في الأسئلة')} />
        <div className="flex flex-wrap gap-1" role="group" aria-label={tr('Filtrer', 'تصفية')}>
          {THREAD_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-10 rounded-full px-3.5 text-sm transition-colors ${filter === f.id ? 'bg-ink/[0.08] font-medium text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {tr(f.fr, f.ar)}
            </button>
          ))}
        </div>
      </div>
      <AuthorFilter author={author} clearAuthor={clearAuthor} lang={lang} />
      <ListBody list={list} lang={lang} empty={<EmptyState title={q || filter !== 'all' || author ? tr('Aucune question ne correspond', 'لا يوجد سؤال مطابق') : tr('Aucune question pour le moment', 'لا توجد أسئلة حاليا')} />}>
        <p className="text-sm text-ink-faint" role="status">
          {tr(`${list.meta.count} question${list.meta.count > 1 ? 's' : ''}`, `${list.meta.count} سؤال`)}
        </p>
        <ul className="space-y-3">
          {list.items.map((th) => {
            const category = FORUM_CATEGORIES.find((c) => c.id === th.category);
            const disabled = busyId === th._id;
            return (
              <li key={th._id} className="panel space-y-2.5 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                  {th.isPinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-accent-dark">
                      <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                      {tr('Épinglée', 'مثبّت')}
                    </span>
                  )}
                  {category && <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-ink-soft">{tr(category.fr, category.ar)}</span>}
                  {th.solved && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-primary-dark">
                      <CircleCheckBig className="h-3.5 w-3.5" aria-hidden="true" />
                      {tr('Résolue', 'تم الحل')}
                    </span>
                  )}
                  {th.isLocked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1 text-ink-soft">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      {tr('Fermée', 'مغلق')}
                    </span>
                  )}
                  <span className="ms-auto font-normal text-ink-faint">{when(th.createdAt, lang)}</span>
                </div>
                <h3 dir="auto" className="text-start text-[17px] font-semibold leading-snug">
                  {th.title}
                </h3>
                {th.excerpt && (
                  <p dir="auto" className="line-clamp-2 text-start text-[15px] text-ink-soft">
                    {th.excerpt}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <MemberLine member={th.author} lang={lang} />
                  <span className="text-sm tabular-nums text-ink-faint">
                    {tr(`${th.replyCount} réponse${th.replyCount > 1 ? 's' : ''} · ${th.viewCount} lecture${th.viewCount > 1 ? 's' : ''}`, `${th.replyCount} رد · ${th.viewCount} قراءة`)}
                  </span>
                </div>
                <div className="-mx-2 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-ink/10 pt-2">
                  <button type="button" className={rowButton} onClick={() => openThread(th._id)}>
                    <ExternalLink className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                    {tr('Voir', 'عرض')}
                  </button>
                  <button
                    type="button"
                    className={rowButton}
                    disabled={disabled}
                    onClick={() => setFlag(th, { isPinned: !th.isPinned }, th.isPinned ? tr('Question désépinglée.', 'أُلغي التثبيت.') : tr('Question épinglée en haut du forum.', 'ثُبّت السؤال أعلى المنتدى.'))}
                  >
                    {th.isPinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
                    {th.isPinned ? tr('Désépingler', 'إلغاء التثبيت') : tr('Épingler', 'تثبيت')}
                  </button>
                  <button
                    type="button"
                    className={rowButton}
                    disabled={disabled}
                    onClick={() => setFlag(th, { isLocked: !th.isLocked }, th.isLocked ? tr('Discussion rouverte.', 'أُعيد فتح النقاش.') : tr('Discussion fermée aux réponses.', 'أُغلق النقاش أمام الردود.'))}
                  >
                    {th.isLocked ? <LockOpen className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                    {th.isLocked ? tr('Rouvrir', 'إعادة الفتح') : tr('Fermer aux réponses', 'إغلاق الردود')}
                  </button>
                  <button type="button" className={dangerButton} onClick={() => askDeleteThread(th)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {tr('Supprimer', 'حذف')}
                  </button>
                  <BlockButton member={th.author} lang={lang} block={block} unblock={unblock} />
                </div>
              </li>
            );
          })}
        </ul>
      </ListBody>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------------------------

function Replies({ lang, version, block, unblock, askDeleteReply, author, clearAuthor }) {
  const tr = t(lang);
  const [q, setQ] = useState('');
  const list = useList((page) => fetchAdminForumReplies({ q, author: author?._id, page }), [q, author?._id, version]);

  return (
    <section className="space-y-4" aria-label={tr('Réponses', 'الردود')}>
      <SearchBox value={q} onChange={setQ} placeholder={tr('Chercher dans les réponses', 'ابحث في الردود')} />
      <AuthorFilter author={author} clearAuthor={clearAuthor} lang={lang} />
      <ListBody list={list} lang={lang} empty={<EmptyState title={q || author ? tr('Aucune réponse ne correspond', 'لا يوجد رد مطابق') : tr('Aucune réponse pour le moment', 'لا توجد ردود حاليا')} />}>
        <p className="text-sm text-ink-faint" role="status">
          {tr(`${list.meta.count} réponse${list.meta.count > 1 ? 's' : ''}`, `${list.meta.count} رد`)}
        </p>
        <ul className="space-y-3">
          {list.items.map((rp) => (
            <li key={rp._id} className="panel space-y-2.5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <MemberLine member={rp.author} lang={lang} />
                <span className="ms-auto text-xs text-ink-faint">{when(rp.createdAt, lang)}</span>
              </div>
              <p dir="auto" className="whitespace-pre-line break-words text-start text-[15px]">
                {rp.excerpt}
              </p>
              <p dir="auto" className="text-start text-xs text-ink-faint">
                {tr('Dans : ', 'في: ')}
                {rp.threadTitle}
              </p>
              <div className="-mx-2 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-ink/10 pt-2">
                <button type="button" className={rowButton} onClick={() => openThread(rp.threadId)}>
                  <ExternalLink className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                  {tr('Voir', 'عرض')}
                </button>
                <button type="button" className={dangerButton} onClick={() => askDeleteReply(rp)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {tr('Supprimer', 'حذف')}
                </button>
                <BlockButton member={rp.author} lang={lang} block={block} unblock={unblock} />
              </div>
            </li>
          ))}
        </ul>
      </ListBody>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------------------------

function Members({ lang, version, block, unblock, askPurge, showPostsOf }) {
  const tr = t(lang);
  const [q, setQ] = useState('');
  const list = useList(() => fetchForumMembers(q), [q, version]);

  return (
    <section className="space-y-4" aria-label={tr('Membres', 'الأعضاء')}>
      <SearchBox value={q} onChange={setQ} placeholder={tr('Chercher un compte : nom ou e-mail', 'ابحث عن حساب: الاسم أو البريد')} />
      <h2 className="text-[15px] font-semibold">{q ? tr('Comptes trouvés', 'الحسابات المطابقة') : tr('Membres bloqués', 'الأعضاء المحظورون')}</h2>
      <ListBody
        list={list}
        lang={lang}
        empty={
          <EmptyState title={q ? tr('Aucun compte ne correspond', 'لا يوجد حساب مطابق') : tr('Personne n’est bloqué', 'لا أحد محظور')}>
            {q ? '' : tr('Pour bloquer quelqu’un, cherchez son compte ci-dessus ou utilisez « Bloquer l’auteur » sous l’un de ses messages.', 'لحظر شخص ما، ابحث عن حسابه أعلاه أو استعمل «احظر الكاتب» تحت إحدى رسائله.')}
          </EmptyState>
        }
      >
        <ul className="space-y-3">
          {list.items.map((m) => (
            <li key={m._id} className="panel space-y-2.5 p-4 sm:p-5">
              <MemberLine member={m} lang={lang} />
              {m.block?.reason && (
                <p dir="auto" className="border-s-2 border-status-unsafe/50 ps-3 text-start text-sm">
                  <span className="text-ink-faint">{tr('Motif : ', 'السبب: ')}</span>
                  {m.block.reason}
                </p>
              )}
              <p className="text-sm tabular-nums text-ink-faint">
                {tr(`${m.threadCount} question${m.threadCount > 1 ? 's' : ''} · ${m.replyCount} réponse${m.replyCount > 1 ? 's' : ''}`, `${m.threadCount} سؤال · ${m.replyCount} رد`)}
                {m.block?.since && ` · ${tr('bloqué le', 'حُظر في')} ${day(m.block.since, lang)}`}
              </p>
              <div className="-mx-2 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-ink/10 pt-2">
                {m.threadCount + m.replyCount > 0 && (
                  <button type="button" className={rowButton} onClick={() => showPostsOf(m)}>
                    <MessagesSquare className="h-4 w-4" aria-hidden="true" />
                    {tr('Voir ses messages', 'عرض رسائله')}
                  </button>
                )}
                <BlockButton member={m} lang={lang} block={block} unblock={unblock} />
                {m.threadCount + m.replyCount > 0 && m.role !== 'ADMIN' && m.role !== 'STAFF' && (
                  <button type="button" className={dangerButton} onClick={() => askPurge(m)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {tr('Supprimer tous ses messages', 'احذف كل رسائله')}
                  </button>
                )}
                {(m.role === 'ADMIN' || m.role === 'STAFF') && (
                  <span className="inline-flex items-center gap-1.5 px-3 text-sm text-ink-faint">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {tr('Membre de l’équipe : ne peut pas être bloqué', 'عضو في الفريق: لا يمكن حظره')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </ListBody>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Blocking a member
// ---------------------------------------------------------------------------------------------

function BlockDialog({ member, lang, onClose, onDone }) {
  const tr = t(lang);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [purge, setPurge] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const res = await blockForumMember(member._id, { reason: reason.trim(), days });
      let message = res.message;
      if (purge) message = `${message} ${(await deleteForumMemberPosts(member._id)).message}`;
      onDone(message);
    } catch (err) {
      setState({
        busy: false,
        error: unavailable(err)
          ? tr('Le blocage n’est pas encore activé : appliquez la migration supabase/migrations/20261116130000_forum_moderation.sql.', 'الحظر غير مفعّل بعد: طبّق ترحيل قاعدة البيانات 20261116130000_forum_moderation.sql.')
          : errorMessage(err, tr('Le blocage a échoué. Réessayez.', 'فشل الحظر. أعد المحاولة.')),
      });
    }
  };

  return (
    <Modal open onClose={() => (state.busy ? null : onClose())} lang={lang} width="max-w-lg" title={tr('Empêcher ce membre de publier', 'منع هذا العضو من النشر')} subtitle={`${member.name || member.publicName || ''} · ${member.email}`}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm text-ink-soft">
          {tr(
            'Il pourra toujours lire le forum, mais plus poser de question, répondre ni modifier ses messages. Ses messages déjà publiés restent en place, sauf si vous cochez la case ci-dessous.',
            'سيبقى قادرا على قراءة المنتدى، لكن لن يستطيع طرح سؤال أو الرد أو تعديل رسائله. تبقى رسائله المنشورة إلا إذا اخترت الخانة أدناه.'
          )}
        </p>

        <fieldset>
          <legend className="field-label">{tr('Durée', 'المدة')}</legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <label key={String(d.days)} className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:font-medium has-[:checked]:text-canvas-paper has-[:checked]:shadow-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
                <input type="radio" name="block-days" checked={days === d.days} onChange={() => setDays(d.days)} className="sr-only" />
                {tr(d.fr, d.ar)}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="block-reason" className="field-label">
            {tr('Motif (montré au membre)', 'السبب (يُعرض على العضو)')}
          </label>
          <textarea
            id="block-reason"
            dir="auto"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            className="field"
            placeholder={tr('Ex. : publicités répétées malgré un avertissement.', 'مثال: إعلانات متكررة رغم التنبيه.')}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-canvas-line/70 bg-canvas-paper/70 px-3.5 py-3 text-[15px] has-[:checked]:border-status-unsafe/60">
          <input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} className="mt-1 accent-[#C9423D]" />
          <span>
            {tr('Supprimer aussi tous ses messages', 'احذف أيضا كل رسائله')}
            <span className="block text-sm text-ink-soft">{tr('Ses questions (avec leurs réponses) et ses réponses. C’est définitif.', 'أسئلته (مع ردودها) وردوده. هذا نهائي.')}</span>
          </span>
        </label>

        {state.error && <Notice tone="error">{state.error}</Notice>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-danger" disabled={state.busy}>
            {state.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}
            {purge ? tr('Bloquer et tout supprimer', 'احظر واحذف الكل') : tr('Bloquer', 'احظر')}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={state.busy}>
            {tr('Annuler', 'إلغاء')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
