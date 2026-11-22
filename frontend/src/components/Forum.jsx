import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  MessagesSquare,
  MessageCircle,
  MessageCirclePlus,
  Bookmark,
  BookmarkCheck,
  ThumbsUp,
  Hand,
  CircleCheckBig,
  Pin,
  PinOff,
  Lock,
  LockOpen,
  Eye,
  Pencil,
  Trash2,
  SendHorizontal,
  ChevronLeft,
  Share2,
  Search,
  X,
  Check,
  CornerDownRight,
  Reply,
  Stethoscope,
  ShoppingBasket,
  MapPin,
  ChefHat,
  House,
  Baby,
  Plane,
  CircleHelp,
  LogIn,
  LoaderCircle,
  ShieldCheck,
  Ban,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  fetchForumThreads,
  fetchForumThread,
  createForumThread,
  updateForumThread,
  deleteForumThread,
  createForumReply,
  updateForumReply,
  deleteForumReply,
  acceptForumReply,
  setForumMark,
  errorMessage,
} from '../services/api';
import { navigate, pathFor } from '../services/router';
import { t, BrandMark, PageHead, PageLink, Modal, Notice, EmptyState, Spinner } from './ui';
import { ReportButton } from './community';

/**
 * The forum: questions asked by members, answered by the others.
 *  - the list (/forum): search, sections, three orders, "saved" and "my questions"
 *  - a question (/forum/question/<id>): the answers, the accepted one first
 * Reading is open to everyone; asking, answering, "same question", "helpful" and saving need an account.
 */

// Same limits as the API (backend/src/routes/forumRoutes.js)
const LIMITS = { titleMin: 8, title: 160, body: 5000, replyMin: 2, reply: 3000 };

// `slug` is what the address bar shows (?rubrique=produits)
export const FORUM_CATEGORIES = [
  { id: 'DIAGNOSIS', slug: 'sante', icon: Stethoscope, fr: 'Diagnostic et santé', ar: 'التشخيص والصحة' },
  { id: 'PRODUCTS', slug: 'produits', icon: ShoppingBasket, fr: 'Produits', ar: 'المنتجات' },
  { id: 'PLACES', slug: 'adresses', icon: MapPin, fr: 'Restaurants et adresses', ar: 'مطاعم وعناوين' },
  { id: 'RECIPES', slug: 'recettes', icon: ChefHat, fr: 'Recettes', ar: 'وصفات' },
  { id: 'DAILY_LIFE', slug: 'quotidien', icon: House, fr: 'Vie quotidienne', ar: 'الحياة اليومية' },
  { id: 'CHILDREN', slug: 'enfants', icon: Baby, fr: 'Enfants', ar: 'الأطفال' },
  { id: 'TRAVEL', slug: 'voyage', icon: Plane, fr: 'Voyage', ar: 'السفر' },
  { id: 'OTHER', slug: 'autre', icon: CircleHelp, fr: 'Autre', ar: 'أخرى' },
];
const categoryOf = (id) => FORUM_CATEGORIES.find((c) => c.id === id) || FORUM_CATEGORIES[FORUM_CATEGORIES.length - 1];

const VIEWS = [
  { id: 'all', slug: '', icon: MessagesSquare, fr: 'Toutes', ar: 'الكل' },
  { id: 'saved', slug: 'enregistrees', icon: Bookmark, fr: 'Enregistrées', ar: 'المحفوظة' },
  // short: the label on phones, where four tabs share the width
  { id: 'mine', slug: 'miennes', icon: MessageCircle, fr: 'Mes questions', frShort: 'Questions', ar: 'أسئلتي' },
  // The questions the member answered
  { id: 'answered', slug: 'reponses', icon: Reply, fr: 'Mes réponses', frShort: 'Réponses', ar: 'ردودي' },
];

const SORTS = [
  { id: 'recent', slug: '', fr: 'Récentes', ar: 'الأحدث' },
  { id: 'popular', slug: 'populaires', fr: 'Populaires', ar: 'الأكثر تفاعلا' },
  { id: 'unanswered', slug: 'sans-reponse', fr: 'Sans réponse', ar: 'بلا رد' },
];

/** { view, sort, category, q } from the address (?vue=&tri=&rubrique=&q=) */
const filtersOf = (query = {}) => ({
  view: VIEWS.find((v) => v.slug && v.slug === query.vue)?.id || 'all',
  sort: SORTS.find((s) => s.slug && s.slug === query.tri)?.id || 'recent',
  category: FORUM_CATEGORIES.find((c) => c.slug === query.rubrique)?.id || 'ALL',
  q: (query.q || '').slice(0, 100),
});

/** The address for these filters; defaults are left out */
const queryOf = ({ view, sort, category, q }) => {
  const out = {};
  const vue = VIEWS.find((v) => v.id === view)?.slug;
  const tri = SORTS.find((s) => s.id === sort)?.slug;
  const rubrique = FORUM_CATEGORIES.find((c) => c.id === category)?.slug;
  if (vue) out.vue = vue;
  if (tri) out.tri = tri;
  if (rubrique) out.rubrique = rubrique;
  if (q) out.q = q;
  return out;
};

// The last list shown, so going back from a question is instant and lands on the same filters
const listCache = new Map();
// The last copy of each question opened (with its answers), so going back to one shows it at once
const threadCache = new Map();
let lastListQuery = {};

const timeAgo = (iso, lang) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return lang === 'ar' ? 'الآن' : 'à l’instant';
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'fr', { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour');
  if (s < 86400 * 30) return rtf.format(-Math.floor(s / 86400), 'day');
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fullDate = (iso, lang) =>
  new Date(iso).toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const repliesLabel = (n, lang) => (lang === 'ar' ? (n === 0 ? 'لا ردود' : n === 1 ? 'رد واحد' : n === 2 ? 'ردان' : `${n} ردود`) : n === 0 ? 'Aucune réponse' : `${n} réponse${n > 1 ? 's' : ''}`);

const unavailable = (err) => err?.response?.data?.code === 'FEATURE_UNAVAILABLE';

export default function Forum({ lang, threadId, query, onOpenThread, onNavigate }) {
  const [prompt, setPrompt] = useState(null); // why signing in is asked: 'ask' | 'reply' | 'like' | 'save'
  return (
    <>
      {threadId ? (
        <ThreadPage key={threadId} lang={lang} threadId={threadId} onOpenThread={onOpenThread} askSignIn={setPrompt} />
      ) : (
        <ThreadList lang={lang} query={query} onOpenThread={onOpenThread} onNavigate={onNavigate} askSignIn={setPrompt} />
      )}
      <SignInPrompt reason={prompt} lang={lang} onClose={() => setPrompt(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------------------------

const PROMPTS = {
  ask: ['Connectez-vous pour poser votre question', 'سجّل الدخول لطرح سؤالك'],
  reply: ['Connectez-vous pour répondre', 'سجّل الدخول للرد'],
  like: ['Connectez-vous pour réagir', 'سجّل الدخول للتفاعل'],
  save: ['Connectez-vous pour enregistrer cette discussion', 'سجّل الدخول لحفظ هذا النقاش'],
};

/** Shown when a signed-out visitor tries to take part */
function SignInPrompt({ reason, lang, onClose }) {
  const tr = t(lang);
  if (!reason) return null;
  return (
    <Modal open onClose={onClose} lang={lang} title={tr(...(PROMPTS[reason] || PROMPTS.ask))} width="max-w-md">
      <p className="text-[15px] text-ink-soft">
        {tr(
          'Tout le monde peut lire le forum. Un compte gratuit suffit pour poser une question, répondre, et retrouver les discussions que vous enregistrez sur tous vos appareils.',
          'يمكن للجميع قراءة المنتدى. يكفي حساب مجاني لطرح سؤال أو الرد، وللعثور على النقاشات التي تحفظها على كل أجهزتك.'
        )}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            onClose();
            navigate(pathFor('account'));
          }}
        >
          <LogIn className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {tr('Se connecter ou créer un compte', 'تسجيل الدخول أو إنشاء حساب')}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          {tr('Plus tard', 'لاحقا')}
        </button>
      </div>
    </Modal>
  );
}

const AVATAR_TONES = ['bg-primary-tint text-primary-dark', 'bg-accent-tint text-accent-dark', 'bg-canvas-sunk text-ink-soft', 'bg-secondary/20 text-secondary-dark'];

/** The author's initial on a quiet tint; the team's posts carry the app's mark */
function Avatar({ author, size = 'h-9 w-9 text-[15px]' }) {
  if (author?.badge === 'TEAM') return <BrandMark className={`${size} shrink-0 rounded-full`} />;
  const name = author?.name || '';
  const tone = AVATAR_TONES[[...name].reduce((sum, ch) => sum + ch.codePointAt(0), 0) % AVATAR_TONES.length];
  return (
    <span aria-hidden="true" className={`${size} ${tone} inline-flex shrink-0 items-center justify-center rounded-full font-semibold`}>
      {name ? name.charAt(0).toUpperCase() : '?'}
    </span>
  );
}

function AuthorName({ author, lang, byAsker = false }) {
  const tr = t(lang);
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span dir="auto" className="truncate font-medium text-ink">
        {author?.name || tr('Membre', 'عضو')}
      </span>
      {author?.badge === 'TEAM' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-dark">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {tr('Équipe Celiac Square', 'فريق Celiac Square')}
        </span>
      )}
      {author?.badge === 'SELLER' && <span className="rounded-full bg-ink/[0.07] px-2 py-0.5 text-xs font-medium text-ink-soft">{tr('Vendeur', 'بائع')}</span>}
      {byAsker && <span className="rounded-full bg-accent-tint px-2 py-0.5 text-xs font-medium text-accent-dark">{tr('Auteur de la question', 'صاحب السؤال')}</span>}
    </span>
  );
}

function CategoryTag({ id, lang }) {
  const tr = t(lang);
  const { icon: Icon, fr, ar } = categoryOf(id);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-medium text-ink-soft">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {tr(fr, ar)}
    </span>
  );
}

function SolvedTag({ lang }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary-dark">
      <CircleCheckBig className="h-3.5 w-3.5" aria-hidden="true" />
      {t(lang)('Résolue', 'تم الحل')}
    </span>
  );
}

/** A quiet capsule under a post: an icon, a label, sometimes a count; `on` is the pressed state */
function ActionButton({ icon: Icon, label, count, on, onClick, disabled, tone = 'sage', title, fill = false, hideLabel = false }) {
  const onTone = tone === 'orange' ? 'bg-accent-tint text-accent-dark' : 'bg-primary-tint text-primary-dark';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on === undefined ? undefined : on}
      aria-label={hideLabel ? label : undefined}
      title={title || (hideLabel ? label : undefined)}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? `${onTone} font-medium` : 'text-ink-soft hover:bg-ink/[0.06] hover:text-ink'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" fill={on && fill ? 'currentColor' : 'none'} />
      {!hideLabel && <span>{label}</span>}
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

/** Bookmark toggle for a question. Signed out: explains that saving needs an account. */
export function SaveThreadButton({ thread, lang, onChange, askSignIn, iconOnly = false }) {
  const tr = t(lang);
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const label = thread.saved ? tr('Retirer de mes discussions enregistrées', 'إزالة من نقاشاتي المحفوظة') : tr('Enregistrer cette discussion', 'احفظ هذا النقاش');

  const toggle = async (e) => {
    e.stopPropagation();
    if (!user) {
      askSignIn?.('save');
      return;
    }
    const next = !thread.saved;
    setBusy(true);
    onChange({ saved: next }); // at once; undone if the request fails
    try {
      await setForumMark('threads', thread._id, 'save', next);
    } catch {
      onChange({ saved: !next });
    } finally {
      setBusy(false);
    }
  };

  const Icon = thread.saved ? BookmarkCheck : Bookmark;
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={thread.saved}
        aria-label={`${label} : ${thread.title}`}
        title={label}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ink/[0.06] active:scale-95 ${
          thread.saved ? 'text-primary-dark' : 'text-ink-faint hover:text-ink'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" fill={thread.saved ? 'currentColor' : 'none'} fillOpacity={0.25} />
      </button>
    );
  }
  return <ActionButton icon={Icon} label={thread.saved ? tr('Enregistrée', 'محفوظ') : tr('Enregistrer', 'احفظ')} on={thread.saved} onClick={toggle} disabled={busy} title={label} />;
}

/** A textarea that grows with what is typed */
function GrowingTextarea({ value, onChange, minRows = 3, maxHeight = 420, inputRef, ...rest }) {
  const own = useRef(null);
  const ref = inputRef || own;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, maxHeight)}px`;
  }, [value, maxHeight, ref]);
  return <textarea ref={ref} value={value} onChange={onChange} rows={minRows} dir="auto" className="field resize-none leading-relaxed" {...rest} />;
}

function Counter({ value, max }) {
  const left = max - value.length;
  if (left > max * 0.15) return null;
  return <span className={`text-xs tabular-nums ${left < 0 ? 'font-medium text-status-unsafe-ink' : 'text-ink-faint'}`}>{left}</span>;
}

/** Shown in place of the forms to a member the team has stopped from posting. posting: { blocked, reason, until } */
function BlockedNotice({ posting, lang }) {
  const tr = t(lang);
  const until = posting?.until ? new Date(posting.until).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-status-unsafe/40 bg-status-unsafe/10 px-4 py-3.5 text-sm" role="status">
      <Ban className="mt-0.5 h-4 w-4 shrink-0 text-status-unsafe-ink" aria-hidden="true" />
      <div>
        <p className="font-medium">
          {until ? tr(`Vous ne pouvez plus publier sur le forum jusqu’au ${until}.`, `لا يمكنك النشر في المنتدى حتى ${until}.`) : tr('Vous ne pouvez plus publier sur le forum.', 'لم يعد بإمكانك النشر في المنتدى.')}
        </p>
        {posting?.reason && (
          <p dir="auto" className="mt-0.5 text-start text-ink-soft">
            {tr('Motif donné par l’équipe : ', 'السبب الذي قدمه الفريق: ')}
            {posting.reason}
          </p>
        )}
        <p className="mt-0.5 text-ink-soft">{tr('Vous pouvez toujours lire, réagir et enregistrer des discussions.', 'ما زال بإمكانك القراءة والتفاعل وحفظ النقاشات.')}</p>
      </div>
    </div>
  );
}

const RULES = [
  ['Racontez votre expérience : ce qui a marché pour vous, où, et quand.', 'شارك تجربتك: ما الذي نجح معك، وأين ومتى.'],
  ['Une recette change : donnez la marque, et vérifiez toujours l’étiquette.', 'الوصفات تتغير: اذكر العلامة وتحقق دائما من الملصق.'],
  ['Le forum ne remplace pas un médecin. Aucun « petit écart » n’est sans risque.', 'المنتدى لا يعوّض الطبيب. لا توجد «مخالفة صغيرة» بلا خطر.'],
  ['Restez bienveillant, et ne publiez pas d’informations personnelles.', 'كن لطيفا ولا تنشر معلومات شخصية.'],
];

function Rules({ lang }) {
  const tr = t(lang);
  return (
    <ul className="space-y-2 text-sm text-ink-soft">
      {RULES.map(([fr, ar]) => (
        <li key={fr} className="flex gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-dark" aria-hidden="true" />
          <span>{tr(fr, ar)}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Asking (and editing) a question
// ---------------------------------------------------------------------------------------------

/** thread: the question being edited, or null for a new one. onDone(thread) receives the saved question. */
function QuestionForm({ lang, thread = null, defaultCategory = '', onDone, onCancel }) {
  const tr = t(lang);
  const [title, setTitle] = useState(thread?.title || '');
  const [body, setBody] = useState(thread?.body || '');
  const [category, setCategory] = useState(thread?.category || defaultCategory);
  const [state, setState] = useState({ busy: false, error: '' });
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim().replace(/\s+/g, ' ');
    if (cleanTitle.length < LIMITS.titleMin) return setState({ busy: false, error: tr('Écrivez votre question en quelques mots.', 'اكتب سؤالك في بضع كلمات.') });
    if (!category) return setState({ busy: false, error: tr('Choisissez une rubrique.', 'اختر قسما.') });
    setState({ busy: true, error: '' });
    try {
      const payload = { title: cleanTitle, body, category };
      const res = thread ? await updateForumThread(thread._id, payload) : await createForumThread({ ...payload, lang });
      return onDone(res.data);
    } catch (err) {
      return setState({
        busy: false,
        error: unavailable(err)
          ? tr('Le forum ouvre bientôt. Réessayez un peu plus tard.', 'سيفتح المنتدى قريبا. أعد المحاولة لاحقا.')
          : errorMessage(err, tr('La publication a échoué. Vérifiez votre connexion puis réessayez.', 'فشل النشر. تحقق من الاتصال ثم أعد المحاولة.')),
      });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="forum-title" className="field-label">
            {tr('Votre question', 'سؤالك')}
          </label>
          <Counter value={title} max={LIMITS.title} />
        </div>
        <input
          id="forum-title"
          ref={titleRef}
          type="text"
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={LIMITS.title}
          required
          className="field"
          placeholder={tr('Ex. : Quelle farine sans gluten pour le pain tabouna ?', 'مثال: أي دقيق بدون غلوتين يصلح لخبز الطابونة؟')}
        />
      </div>

      <fieldset>
        <legend className="field-label">{tr('Rubrique', 'القسم')}</legend>
        <div className="flex flex-wrap gap-2">
          {FORUM_CATEGORIES.map(({ id, icon: Icon, fr, ar }) => (
            <label key={id} className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:font-medium has-[:checked]:text-canvas-paper has-[:checked]:shadow-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
              <input type="radio" name="forum-category" value={id} checked={category === id} onChange={() => setCategory(id)} className="sr-only" />
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tr(fr, ar)}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="forum-body" className="field-label">
            {tr('Détails (facultatif)', 'التفاصيل (اختياري)')}
          </label>
          <Counter value={body} max={LIMITS.body} />
        </div>
        <GrowingTextarea
          id="forum-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={LIMITS.body}
          minRows={4}
          maxHeight={280}
          placeholder={tr('Ce que vous avez déjà essayé, la marque, la ville… Tout ce qui aide à vous répondre.', 'ما الذي جربته، العلامة، المدينة… كل ما يساعد على إجابتك.')}
        />
      </div>

      {!thread && (
        <div className="rounded-xl bg-ink/[0.04] px-4 py-3">
          <Rules lang={lang} />
        </div>
      )}

      {state.error && <Notice tone="error">{state.error}</Notice>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={state.busy}>
          {state.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />}
          {thread ? tr('Enregistrer les modifications', 'احفظ التعديلات') : tr('Publier la question', 'انشر السؤال')}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={state.busy}>
          {tr('Annuler', 'إلغاء')}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
// Swipeable tabs
// ---------------------------------------------------------------------------------------------

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

// Past the first or last page the content gives a little, then stops
const rubber = (d) => (d * 0.35) / (1 + d * 0.9);

// Spring towards the page the swipe lands on: a little bounce, no wobble
const SPRING = { stiffness: 360, damping: 0.86 };

/**
 * Pages side by side, tied to a tab bar, as in Material top tabs: a horizontal swipe moves the pages
 * with the finger and the pill under the tabs follows the exact fractional position
 * (pill.translateX(virtualIndex * tabWidth)); on release, both spring onto the nearest page,
 * or the next one when the swipe was a flick. A tap on a tab springs there the same way.
 *
 * The position lives in a ref and is painted straight onto the DOM each frame (no React render per frame).
 * The row is laid out left to right in both languages, like the app's tab bar.
 */
function usePager({ count, index, onChange }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const pillRef = useRef(null);
  const tabs = useRef([]);
  const pages = useRef([]);
  const pos = useRef(index); // virtual index: 1.4 = 40% of the way from the second page to the third
  const goal = useRef(index);
  const frame = useRef(0);
  const gesture = useRef(null);
  const suppressClickUntil = useRef(0);
  const [current, setCurrent] = useState(index);

  const paint = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const p = pos.current;
    track.style.transform = `translate3d(${-p * viewport.clientWidth}px, 0, 0)`;

    // The pill: on equal tabs this is virtualIndex * tabWidth; measured, so it also holds when widths differ
    const pill = pillRef.current;
    const els = tabs.current;
    if (pill && els[0] && els[count - 1]) {
      const i = clamp(Math.floor(p), 0, count - 2);
      const f = p - i; // below 0 or above 1 past the ends: the pill follows the rubber band
      const a = els[i];
      const b = els[i + 1];
      const left = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f;
      const fw = clamp(f, 0, 1);
      pill.style.width = `${a.offsetWidth + (b.offsetWidth - a.offsetWidth) * fw}px`;
      pill.style.transform = `translate3d(${left}px, 0, 0)`;
      // Each label brightens as the pill reaches it
      els.forEach((el, k) => el.style.setProperty('--on', String(Math.max(0, 1 - Math.abs(p - k)))));
    }

    // Height: the page shown; between two pages, the taller one, so neither is cut while it slides
    const near = Math.round(p);
    const settled = Math.abs(p - near) < 0.02;
    const k1 = clamp(settled ? near : Math.floor(p), 0, count - 1);
    const k2 = clamp(settled ? near : Math.ceil(p), 0, count - 1);
    const h = Math.max(pages.current[k1]?.offsetHeight || 0, pages.current[k2]?.offsetHeight || 0);
    if (h) viewport.style.height = `${h}px`;
  }, [count]);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  /** Springs the position to `target`, starting with velocity v0 (pages per second) */
  const springTo = useCallback(
    (target, v0 = 0) => {
      stop();
      goal.current = target;
      const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        pos.current = target;
        paint();
        return;
      }
      const k = SPRING.stiffness;
      const c = 2 * Math.sqrt(k) * SPRING.damping;
      let x = pos.current;
      let v = v0;
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(0.064, (now - last) / 1000);
        last = now;
        // Small fixed steps keep the spring stable whatever the frame rate
        const n = Math.max(1, Math.ceil(dt / 0.004));
        const h = dt / n;
        for (let s = 0; s < n; s += 1) {
          v += (-k * (x - target) - c * v) * h;
          x += v * h;
        }
        if (Math.abs(x - target) < 0.0005 && Math.abs(v) < 0.01) {
          pos.current = target;
          paint();
          frame.current = 0;
          return;
        }
        pos.current = x;
        paint();
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [paint]
  );

  const select = (i, v0 = 0) => {
    const target = clamp(i, 0, count - 1);
    springTo(target, v0);
    setCurrent(target);
    if (target !== index) onChange(target);
  };

  // The address changed on its own (Back, a link to ?vue=…): go there
  useEffect(() => {
    if (index === goal.current) return;
    springTo(index);
    setCurrent(index);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // First paint, and again whenever a page, the tabs or the window change size (lists loading, fonts, rotation)
  useLayoutEffect(() => {
    paint();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => paint());
    [viewportRef.current, ...pages.current, ...tabs.current].forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => stop, []);

  // Pointer position, recent samples kept for the release velocity
  const sample = (g, e) => {
    g.samples.push({ x: e.clientX, t: e.timeStamp });
    if (g.samples.length > 6) g.samples.shift();
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Rows that scroll sideways, and fields, keep their own horizontal gestures
    if (e.target.closest('[data-no-swipe], input, textarea, select')) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: pos.current, from: goal.current, decided: false, horizontal: false, samples: [] };
    sample(gesture.current, e);
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.decided = true;
      g.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!g.horizontal) {
        gesture.current = null; // a vertical swipe: the page scrolls
        return;
      }
      // Caught mid-flight: the pages stop under the finger
      stop();
      g.start = pos.current;
      g.x = e.clientX;
      try {
        viewportRef.current.setPointerCapture(e.pointerId);
      } catch {
        // the pointer is already gone
      }
      viewportRef.current.dataset.dragging = 'true';
    }
    sample(g, e);
    let p = g.start - (e.clientX - g.x) / viewportRef.current.clientWidth;
    if (p < 0) p = -rubber(-p);
    if (p > count - 1) p = count - 1 + rubber(p - (count - 1));
    pos.current = p;
    paint();
  };

  const endDrag = (e, commit) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.horizontal) return;
    delete viewportRef.current.dataset.dragging;
    // The click that ends a drag must not open the card it ends on
    suppressClickUntil.current = performance.now() + 350;
    const w = viewportRef.current.clientWidth;
    // Velocity over the last ~100 ms, in pages per second (a swipe to the left moves forward)
    const last = g.samples[g.samples.length - 1];
    const first = g.samples.find((s) => last.t - s.t <= 100) || g.samples[0];
    const vx = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    const v = commit ? (-vx * 1000) / w : 0;
    // Where the motion would carry the pages, kept within one page of where the swipe started
    const from = Math.round(g.from);
    const target = commit ? clamp(Math.round(pos.current + v * 0.2), Math.max(0, from - 1), Math.min(count - 1, from + 1)) : from;
    select(target, v);
  };

  const onClickCapture = (e) => {
    if (performance.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Tabs: arrow keys move between them (left to right, as laid out), Home and End jump to the ends
  const onTabKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (step) next = clamp(current + step, 0, count - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  };

  return {
    current,
    select,
    viewportRef,
    trackRef,
    pillRef,
    tabRef: (i) => (el) => {
      tabs.current[i] = el;
    },
    pageRef: (i) => (el) => {
      pages.current[i] = el;
    },
    onTabKeyDown,
    viewportProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e) => endDrag(e, true),
      onPointerCancel: (e) => endDrag(e, false),
      onLostPointerCapture: (e) => gesture.current?.horizontal && endDrag(e, true),
      onClickCapture,
      onDragStart: (e) => e.preventDefault(),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------------------------

function ThreadList({ lang, query, onOpenThread, onNavigate, askSignIn }) {
  const tr = t(lang);
  const { user } = useAuth();
  const filters = useMemo(() => filtersOf(query), [query?.vue, query?.tri, query?.rubrique, query?.q]); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState(filters.q);
  const [asking, setAsking] = useState(false);
  const [posting, setPosting] = useState(null);
  const blocked = Boolean(user && posting?.blocked);
  const tabsRef = useRef(null);

  const go = (changes, options) => onNavigate(queryOf({ ...filters, ...changes }), options);

  const viewIndex = Math.max(0, VIEWS.findIndex((v) => v.id === filters.view));
  // Switching tabs replaces the address rather than adding to the history, as tabs do
  const pager = usePager({ count: VIEWS.length, index: viewIndex, onChange: (i) => go({ view: VIEWS[i].id }, { replace: true }) });

  // Lists load when their page is shown or next to it, so a swipe reveals a list that is already there
  const [visited, setVisited] = useState(() => new Set([viewIndex]));
  useEffect(() => {
    setVisited((s) => (s.has(pager.current) ? s : new Set([...s, pager.current])));
    // A list scrolled far down: bring the tabs back into view on the new page
    const top = tabsRef.current ? tabsRef.current.getBoundingClientRect().top + window.scrollY - 88 : 0;
    if (window.scrollY > top) window.scrollTo({ top });
  }, [pager.current]);

  // Remembered for the "back" link of a question
  useEffect(() => {
    lastListQuery = queryOf(filters);
  }, [filters]);

  // The address follows typing after a pause; the search box follows the address (Back/Forward),
  // except for the change the typing itself just made, which must not overwrite what was typed since
  const typed = useRef(null);
  useEffect(() => {
    if (typed.current === filters.q) return;
    typed.current = null;
    setSearch(filters.q);
  }, [filters.q]);
  useEffect(() => {
    const q = search.trim();
    if (q === filters.q) return undefined;
    const timer = setTimeout(() => {
      typed.current = q;
      go({ q }, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = () => (user ? setAsking(true) : askSignIn('ask'));

  const askButton = (
    <button type="button" className="btn-primary w-full sm:w-auto" onClick={ask}>
      <MessageCirclePlus className="h-[18px] w-[18px]" aria-hidden="true" />
      {tr('Poser une question', 'اطرح سؤالا')}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHead
        title={tr('Forum', 'المنتدى')}
        lede={tr(
          'Posez vos questions sur la vie sans gluten en Tunisie. Ceux qui sont passés par là vous répondent.',
          'اطرح أسئلتك عن الحياة بدون غلوتين في تونس، ويجيبك من مرّوا بالتجربة نفسها.'
        )}
        action={askButton}
      />

      {blocked && <BlockedNotice posting={posting} lang={lang} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-8">
        <div className="min-w-0 space-y-4">
          {/* Whose questions: tabs, with a pill that follows the pages as they are swiped */}
          <div
            ref={tabsRef}
            dir="ltr"
            role="tablist"
            aria-label={tr('Discussions affichées', 'النقاشات المعروضة')}
            onKeyDown={pager.onTabKeyDown}
            className="relative grid grid-cols-4 rounded-2xl bg-canvas-sunk/70 p-1"
          >
            <span ref={pager.pillRef} aria-hidden="true" className="absolute bottom-1 left-0 top-1 rounded-xl bg-canvas-paper shadow-sm will-change-transform dark:bg-canvas-edge" />
            {VIEWS.map(({ id, icon: Icon, fr, frShort, ar }, i) => {
              const on = pager.current === i;
              return (
                <button
                  key={id}
                  ref={pager.tabRef(i)}
                  id={`forum-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`forum-page-${id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => pager.select(i)}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  // --on goes from 0 to 1 as the pill reaches the tab (set while it moves)
                  style={{ opacity: 'calc(0.7 + var(--on, 0) * 0.3)' }}
                  className={`relative z-[1] flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[12px] leading-tight text-ink sm:min-h-11 sm:flex-row sm:gap-1.5 sm:text-sm ${on ? 'font-semibold' : 'font-medium'}`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                  {frShort && lang !== 'ar' ? (
                    <>
                      <span className="whitespace-nowrap sm:hidden">{frShort}</span>
                      <span className="hidden whitespace-nowrap sm:inline">{fr}</span>
                    </>
                  ) : (
                    <span className="whitespace-nowrap">{tr(fr, ar)}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* The pages, side by side; only the one shown can be reached with the keyboard or a screen reader */}
          <div ref={pager.viewportRef} dir="ltr" className="forum-pager -mx-1 overflow-clip" {...pager.viewportProps}>
            <div ref={pager.trackRef} className="flex items-start will-change-transform">
              {VIEWS.map((v, i) => {
                const shown = pager.current === i;
                return (
                  <div
                    key={v.id}
                    ref={pager.pageRef(i)}
                    id={`forum-page-${v.id}`}
                    role="tabpanel"
                    aria-labelledby={`forum-tab-${v.id}`}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full shrink-0"
                    {...(shown ? {} : { inert: '', 'aria-hidden': 'true' })}
                  >
                    <ViewPage
                      view={v.id}
                      lang={lang}
                      filters={filters}
                      go={go}
                      search={search}
                      setSearch={setSearch}
                      shown={shown}
                      enabled={visited.has(i) || Math.abs(i - pager.current) <= 1}
                      onPosting={setPosting}
                      onOpenThread={onOpenThread}
                      askSignIn={askSignIn}
                      askButton={askButton}
                      onShowAll={() => pager.select(0)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side: sections (wide screens) and how the forum works */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <nav className="panel hidden p-2 lg:block" aria-label={tr('Rubriques', 'الأقسام')}>
            <p className="px-3 pb-1.5 pt-2 text-sm font-medium text-ink-soft">{tr('Rubriques', 'الأقسام')}</p>
            {[{ id: 'ALL', icon: MessagesSquare, fr: 'Toutes les rubriques', ar: 'كل الأقسام' }, ...FORUM_CATEGORIES].map(({ id, icon: Icon, fr, ar }) => {
              const on = filters.category === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => go({ category: id })}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-[15px] transition-colors ${on ? 'bg-ink/[0.07] font-medium text-ink' : 'text-ink-soft hover:bg-ink/[0.04] hover:text-ink'}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-primary-dark' : ''}`} aria-hidden="true" />
                  {tr(fr, ar)}
                </button>
              );
            })}
          </nav>
          <section className="panel p-5" aria-labelledby="forum-rules">
            <h2 id="forum-rules" className="mb-3 text-[15px] font-semibold">
              {tr('Pour de bonnes réponses', 'من أجل إجابات جيدة')}
            </h2>
            <Rules lang={lang} />
          </section>
        </aside>
      </div>

      {asking && (
        <Modal open onClose={() => setAsking(false)} lang={lang} title={tr('Poser une question', 'اطرح سؤالا')} subtitle={blocked ? undefined : tr('Elle sera visible par tous, avec votre prénom.', 'سيراه الجميع مع اسمك الأول.')}>
          {blocked ? (
            <BlockedNotice posting={posting} lang={lang} />
          ) : (
            <QuestionForm
              lang={lang}
              defaultCategory={filters.category === 'ALL' ? '' : filters.category}
              onCancel={() => setAsking(false)}
              onDone={(thread) => {
                listCache.clear();
                setAsking(false);
                onOpenThread(thread._id);
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

const SIGN_IN_TITLES = {
  saved: ['Retrouvez ici les discussions que vous enregistrez', 'تجد هنا النقاشات التي تحفظها'],
  mine: ['Retrouvez ici vos questions', 'تجد هنا أسئلتك'],
  answered: ['Retrouvez ici les discussions où vous avez répondu', 'تجد هنا النقاشات التي رددت فيها'],
};

/**
 * One tab's page: search, sections, order, and the list for that view.
 * The search, the section and the order are shared by every tab; each tab keeps its own list.
 * `enabled`: load (the page is shown or next to it). `shown`: the page on screen, refreshed each time it comes back.
 */
function ViewPage({ view, lang, filters, go, search, setSearch, shown, enabled, onPosting, onOpenThread, askSignIn, askButton, onShowAll }) {
  const tr = t(lang);
  const { user } = useAuth();
  const own = useMemo(() => ({ ...filters, view }), [filters, view]);
  const cacheKey = `${user?._id || ''}|${JSON.stringify(own)}`;
  const cached = listCache.get(cacheKey);
  const needsAccount = view !== 'all' && !user;

  const [threads, setThreads] = useState(cached?.threads || []);
  const [meta, setMeta] = useState(cached?.meta || { count: 0, page: 1, hasMore: false });
  const [state, setState] = useState({ loading: !cached && !needsAccount, error: '', unavailable: false, more: false });
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    if (needsAccount) {
      setThreads([]);
      setState({ loading: false, error: '', unavailable: false, more: false });
      return;
    }
    const known = listCache.get(cacheKey);
    setThreads(known?.threads || []);
    setMeta(known?.meta || { count: 0, page: 1, hasMore: false });
    setState({ loading: !known, error: '', unavailable: false, more: false });
    try {
      const res = await fetchForumThreads({ ...own, page: 1 });
      const next = { threads: res.data || [], meta: { count: res.count || 0, page: 1, hasMore: Boolean(res.hasMore) }, posting: res.posting || null };
      listCache.set(cacheKey, next);
      setThreads(next.threads);
      setMeta(next.meta);
      if (res.posting !== undefined) onPosting(res.posting);
      setState({ loading: false, error: '', unavailable: false, more: false });
    } catch (err) {
      setState({
        loading: false,
        more: false,
        unavailable: unavailable(err),
        error: unavailable(err) || known ? '' : errorMessage(err, tr('Les discussions n’ont pas pu être chargées.', 'تعذر تحميل النقاشات.')),
      });
    }
  }, [cacheKey, needsAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) load();
  }, [load, enabled]);

  // Back on screen: refresh quietly (a question saved on another tab now belongs in "Enregistrées")
  const wasShown = useRef(shown);
  useEffect(() => {
    if (shown && !wasShown.current && enabled && Date.now() - lastLoad.current > 1000) load();
    wasShown.current = shown;
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    setState((s) => ({ ...s, more: true }));
    try {
      const res = await fetchForumThreads({ ...own, page: meta.page + 1 });
      const seen = new Set(threads.map((th) => th._id));
      const next = { threads: [...threads, ...(res.data || []).filter((th) => !seen.has(th._id))], meta: { count: res.count || 0, page: meta.page + 1, hasMore: Boolean(res.hasMore) } };
      listCache.set(cacheKey, next);
      setThreads(next.threads);
      setMeta(next.meta);
    } catch {
      // The button stays: another tap retries
    } finally {
      setState((s) => ({ ...s, more: false }));
    }
  };

  const patchThread = (id, changes) => {
    setThreads((list) => {
      const next = list.map((th) => (th._id === id ? { ...th, ...changes } : th));
      const known = listCache.get(cacheKey);
      if (known) listCache.set(cacheKey, { ...known, threads: next });
      return next;
    });
  };

  const filtered = filters.category !== 'ALL' || filters.q || filters.sort !== 'recent';

  let body;
  if (needsAccount) {
    body = (
      <EmptyState
        title={tr(...SIGN_IN_TITLES[view])}
        action={
          <button type="button" className="btn-primary" onClick={() => navigate(pathFor('account'))}>
            <LogIn className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {tr('Se connecter', 'تسجيل الدخول')}
          </button>
        }
      >
        {tr('Connectez-vous : votre liste vous suit sur tous vos appareils.', 'سجّل الدخول: تتبعك قائمتك على كل أجهزتك.')}
      </EmptyState>
    );
  } else if (state.loading || !enabled) {
    body = <Spinner label={tr('Chargement des discussions…', 'جاري تحميل النقاشات…')} />;
  } else if (state.unavailable) {
    body = <EmptyState title={tr('Le forum ouvre bientôt', 'سيفتح المنتدى قريبا')}>{tr('Revenez dans quelques jours pour poser vos questions.', 'عد بعد أيام قليلة لطرح أسئلتك.')}</EmptyState>;
  } else if (state.error) {
    body = (
      <Notice
        tone="error"
        title={state.error}
        action={
          <button type="button" className="btn-quiet" onClick={load}>
            {tr('Réessayer', 'إعادة المحاولة')}
          </button>
        }
      />
    );
  } else if (threads.length === 0) {
    const browse = filtered ? null : (
      <button type="button" className="btn-quiet" onClick={onShowAll}>
        {tr('Parcourir le forum', 'تصفح المنتدى')}
      </button>
    );
    body =
      view === 'saved' ? (
        <EmptyState title={tr('Aucune discussion enregistrée', 'لا توجد نقاشات محفوظة')} action={browse}>
          {tr('Touchez le signet d’une discussion pour la retrouver ici, même des mois plus tard.', 'المس علامة الحفظ في أي نقاش لتجده هنا، حتى بعد أشهر.')}
        </EmptyState>
      ) : view === 'mine' ? (
        <EmptyState title={tr('Vous n’avez pas encore posé de question', 'لم تطرح أي سؤال بعد')} action={askButton}>
          {tr('Une marque, un restaurant, un doute sur une étiquette : demandez.', 'علامة تجارية، مطعم، شك في ملصق: اسأل.')}
        </EmptyState>
      ) : view === 'answered' ? (
        <EmptyState title={tr('Vous n’avez pas encore répondu', 'لم ترد بعد على أي سؤال')} action={browse}>
          {tr('Les discussions où vous avez laissé une réponse apparaissent ici, pour suivre la suite.', 'تظهر هنا النقاشات التي تركت فيها ردا، لتتابع ما يأتي بعده.')}
        </EmptyState>
      ) : filtered ? (
        <EmptyState
          title={filters.q ? tr(`Aucune discussion pour « ${filters.q} »`, `لا يوجد نقاش عن «${filters.q}»`) : tr('Aucune discussion ici pour le moment', 'لا توجد نقاشات هنا حاليا')}
          action={askButton}
        >
          {tr('Personne n’a encore posé cette question : soyez le premier.', 'لم يطرح أحد هذا السؤال بعد: كن الأول.')}
        </EmptyState>
      ) : (
        <EmptyState title={tr('Le forum vient d’ouvrir', 'المنتدى فُتح للتو')} action={askButton}>
          {tr('Aucune question pour l’instant. Lancez la première discussion : votre question aidera aussi les suivants.', 'لا توجد أسئلة حاليا. ابدأ أول نقاش: سؤالك سيفيد من يأتي بعدك.')}
        </EmptyState>
      );
  } else {
    body = (
      <>
        <ul className="space-y-3">
          {threads.map((thread) => (
            <ThreadCard key={thread._id} thread={thread} lang={lang} onOpen={onOpenThread} onChange={(changes) => patchThread(thread._id, changes)} askSignIn={askSignIn} />
          ))}
        </ul>
        {meta.hasMore && (
          <div className="flex justify-center pt-2">
            <button type="button" className="btn-quiet" onClick={loadMore} disabled={state.more}>
              {state.more && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {tr('Voir plus de discussions', 'عرض نقاشات أخرى')}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    // A little room on every side, so card shadows and focus rings are not cut by the sliding frame
    <div className="space-y-4 p-1">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input
          type="search"
          dir="auto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
          className="field rounded-full ps-11 pe-11"
          placeholder={tr('Chercher dans le forum', 'ابحث في المنتدى')}
          aria-label={tr('Chercher dans le forum', 'ابحث في المنتدى')}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute end-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint hover:bg-ink/[0.06] hover:text-ink"
            aria-label={tr('Effacer la recherche', 'مسح البحث')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Sections, on phones and tablets (wide screens list them on the side). It scrolls sideways: no page swipe here */}
      <div data-no-swipe="" className="scrollbar-none flex gap-2 overflow-x-auto py-0.5 lg:hidden" role="group" aria-label={tr('Rubriques', 'الأقسام')}>
        <button type="button" className="chip" aria-pressed={filters.category === 'ALL'} onClick={() => go({ category: 'ALL' })}>
          {tr('Toutes les rubriques', 'كل الأقسام')}
        </button>
        {FORUM_CATEGORIES.map(({ id, icon: Icon, fr, ar }) => (
          <button key={id} type="button" className="chip" aria-pressed={filters.category === id} onClick={() => go({ category: filters.category === id ? 'ALL' : id })}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tr(fr, ar)}
          </button>
        ))}
      </div>

      {/* Order */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex gap-1" role="group" aria-label={tr('Trier', 'ترتيب')}>
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={filters.sort === s.id}
              onClick={() => go({ sort: s.id })}
              className={`min-h-10 rounded-full px-3.5 text-sm transition-colors ${filters.sort === s.id ? 'bg-ink/[0.08] font-medium text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {tr(s.fr, s.ar)}
            </button>
          ))}
        </div>
        {!state.loading && enabled && !needsAccount && !state.error && !state.unavailable && threads.length > 0 && (
          <p className="text-sm text-ink-faint" role={shown ? 'status' : undefined}>
            {tr(`${meta.count} discussion${meta.count > 1 ? 's' : ''}`, `${meta.count} نقاش`)}
          </p>
        )}
      </div>

      {body}
    </div>
  );
}

function ThreadCard({ thread, lang, onOpen, onChange, askSignIn }) {
  const tr = t(lang);
  const href = pathFor('forum', { threadId: thread._id });
  const open = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(thread._id);
  };
  return (
    <li className="panel relative transition-shadow hover:shadow-md">
      <a href={href} onClick={open} className="block rounded-2xl p-4 pe-14 sm:p-5 sm:pe-16">
        <div className="flex flex-wrap items-center gap-1.5">
          {thread.isPinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-dark">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              {tr('Épinglée', 'مثبّت')}
            </span>
          )}
          <CategoryTag id={thread.category} lang={lang} />
          {thread.solved && <SolvedTag lang={lang} />}
          {thread.isLocked && <Lock className="h-3.5 w-3.5 text-ink-faint" aria-label={tr('Discussion fermée', 'نقاش مغلق')} />}
        </div>
        <h2 dir="auto" className="mt-2.5 text-start text-[17px] font-semibold leading-snug tracking-[-0.01em]">
          {thread.title}
        </h2>
        {thread.excerpt && (
          <p dir="auto" className="mt-1 line-clamp-2 text-start text-[15px] text-ink-soft">
            {thread.excerpt}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-faint">
          <span className="inline-flex min-w-0 items-center gap-2">
            <Avatar author={thread.author} size="h-6 w-6 text-xs" />
            <span className="inline-flex min-w-0 items-baseline gap-1.5">
              <span dir="auto" className="truncate font-medium text-ink-soft">
                {thread.author?.name || tr('Membre', 'عضو')}
              </span>
              <span aria-hidden="true">·</span>
              <time dateTime={thread.lastActivityAt} className="whitespace-nowrap">
                {timeAgo(thread.lastActivityAt, lang)}
              </time>
            </span>
          </span>
          <span className="ms-auto inline-flex items-center gap-3.5">
            <span className={`inline-flex items-center gap-1.5 ${thread.replyCount > 0 ? 'font-medium text-ink-soft' : ''}`} title={repliesLabel(thread.replyCount, lang)}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span className="tabular-nums">{thread.replyCount}</span>
              <span className="sr-only">{repliesLabel(thread.replyCount, lang)}</span>
            </span>
            {thread.likeCount > 0 && (
              <span className="inline-flex items-center gap-1.5" title={tr('Ont la même question', 'لديهم السؤال نفسه')}>
                <Hand className="h-4 w-4" aria-hidden="true" />
                <span className="tabular-nums">{thread.likeCount}</span>
                <span className="sr-only">{tr('ont la même question', 'لديهم السؤال نفسه')}</span>
              </span>
            )}
          </span>
        </div>
      </a>
      <div className="absolute end-2 top-2 sm:end-3 sm:top-3">
        <SaveThreadButton thread={thread} lang={lang} onChange={onChange} askSignIn={askSignIn} iconOnly />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// One question
// ---------------------------------------------------------------------------------------------

function ThreadPage({ lang, threadId, onOpenThread, askSignIn }) {
  const tr = t(lang);
  const { user } = useAuth();
  // A question opened before (by this account) shows at once, then refreshes quietly
  const cacheKey = `${user?._id || ''}|${threadId}`;
  const [thread, setThread] = useState(() => threadCache.get(cacheKey) || null);
  const [state, setState] = useState(() => ({ loading: !threadCache.has(cacheKey), error: '', missing: false, unavailable: false }));
  useEffect(() => {
    if (thread?._id === threadId) threadCache.set(cacheKey, thread);
  }, [thread, cacheKey, threadId]);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'thread' } | { kind: 'reply', reply }
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState('');
  const [order, setOrder] = useState('oldest'); // 'oldest' | 'helpful'
  const [replyTo, setReplyTo] = useState(null);
  const [editingReply, setEditingReply] = useState(null);
  const composerRef = useRef(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: !thread || thread._id !== threadId, error: '' }));
    try {
      const res = await fetchForumThread(threadId);
      setThread(res.data);
      setState({ loading: false, error: '', missing: false, unavailable: false });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) threadCache.delete(cacheKey);
      // Offline or a server error with a copy at hand: the copy stays on screen
      const shown = status !== 404 && thread?._id === threadId;
      setState({
        loading: false,
        missing: status === 404,
        unavailable: unavailable(err),
        error: status === 404 || unavailable(err) || shown ? '' : errorMessage(err, tr('La discussion n’a pas pu être chargée.', 'تعذر تحميل النقاش.')),
      });
    }
  }, [threadId, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // The browser tab (and a bookmark) carries the question rather than "Forum"
  const title = thread?.title;
  useEffect(() => {
    if (title) document.title = `${title} · Celiac Square`;
  }, [title, lang]);

  // A short confirmation ("link copied"), then it clears itself
  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(''), 2600);
    return () => clearTimeout(timer);
  }, [flash]);

  const patch = (changes) => {
    listCache.clear();
    setThread((th) => (th ? { ...th, ...changes } : th));
  };
  const patchReply = (id, changes) => setThread((th) => (th ? { ...th, replies: th.replies.map((r) => (r._id === id ? { ...r, ...changes } : r)) } : th));

  const backLink = (
    <PageLink to="forum" options={{ query: lastListQuery }} className="-ms-1.5 inline-flex min-h-11 items-center gap-0.5 rounded-full pe-3 text-[15px] font-medium text-primary-dark">
      <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
      {tr('Forum', 'المنتدى')}
    </PageLink>
  );

  if (state.loading) {
    return (
      <div className="space-y-4">
        {backLink}
        <Spinner label={tr('Chargement de la discussion…', 'جاري تحميل النقاش…')} />
      </div>
    );
  }
  if (!thread || state.missing || state.unavailable || state.error) {
    return (
      <div className="space-y-4">
        {backLink}
        {state.error ? (
          <Notice
            tone="error"
            title={state.error}
            action={
              <button type="button" className="btn-quiet" onClick={load}>
                {tr('Réessayer', 'إعادة المحاولة')}
              </button>
            }
          />
        ) : (
          <EmptyState
            title={state.unavailable ? tr('Le forum ouvre bientôt', 'سيفتح المنتدى قريبا') : tr('Cette discussion n’existe plus', 'هذا النقاش لم يعد موجودا')}
            action={
              <PageLink to="forum" className="btn-quiet">
                {tr('Voir le forum', 'عرض المنتدى')}
              </PageLink>
            }
          >
            {state.unavailable ? '' : tr('Elle a peut-être été supprimée par son auteur.', 'ربما حذفه صاحبه.')}
          </EmptyState>
        )}
      </div>
    );
  }

  const blocked = Boolean(user && thread.posting?.blocked);
  // A blocked member can still delete what they wrote, not change it
  const canEdit = (thread.mine && !blocked) || thread.canModerate;
  const canDelete = thread.mine || thread.canModerate;
  const canAccept = thread.mine || thread.canModerate;
  const closed = thread.isLocked && !thread.canModerate;

  const toggleLike = async () => {
    if (!user) return askSignIn('like');
    const next = !thread.liked;
    patch({ liked: next, likeCount: Math.max(0, thread.likeCount + (next ? 1 : -1)) });
    try {
      const res = await setForumMark('threads', thread._id, 'like', next);
      return patch({ liked: next, likeCount: res.data.likeCount });
    } catch (err) {
      setFlash(errorMessage(err, tr('Échec, réessayez.', 'فشل، أعد المحاولة.')));
      return patch({ liked: !next, likeCount: thread.likeCount });
    }
  };

  const toggleReplyLike = async (reply) => {
    if (!user) return askSignIn('like');
    const next = !reply.liked;
    patchReply(reply._id, { liked: next, likeCount: Math.max(0, reply.likeCount + (next ? 1 : -1)) });
    try {
      const res = await setForumMark('replies', reply._id, 'like', next);
      return patchReply(reply._id, { liked: next, likeCount: res.data.likeCount });
    } catch (err) {
      setFlash(errorMessage(err, tr('Échec, réessayez.', 'فشل، أعد المحاولة.')));
      return patchReply(reply._id, { liked: !next, likeCount: reply.likeCount });
    }
  };

  const share = async () => {
    const url = window.location.origin + pathFor('forum', { threadId: thread._id });
    try {
      if (navigator.share) await navigator.share({ title: thread.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setFlash(tr('Lien copié.', 'تم نسخ الرابط.'));
      }
    } catch {
      // Sharing cancelled, or the clipboard is not available
    }
  };

  const moderate = async (changes) => {
    setBusy('moderate');
    try {
      const res = await updateForumThread(thread._id, changes);
      patch({ isPinned: res.data.isPinned, isLocked: res.data.isLocked });
    } catch (err) {
      setFlash(errorMessage(err, tr('La mise à jour a échoué.', 'فشل التحديث.')));
    } finally {
      setBusy('');
    }
  };

  const accept = async (reply) => {
    const replyId = thread.acceptedReplyId === reply._id ? null : reply._id;
    setBusy(`accept:${reply._id}`);
    try {
      await acceptForumReply(thread._id, replyId);
      patch({ acceptedReplyId: replyId, solved: Boolean(replyId) });
    } catch (err) {
      setFlash(errorMessage(err, tr('La mise à jour a échoué.', 'فشل التحديث.')));
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    const target = confirm;
    setBusy('delete');
    try {
      if (target.kind === 'thread') {
        await deleteForumThread(thread._id);
        threadCache.delete(cacheKey);
        listCache.clear();
        setConfirm(null);
        navigate(pathFor('forum', { query: lastListQuery }), { replace: true });
        return;
      }
      await deleteForumReply(target.reply._id);
      listCache.clear();
      setThread((th) => ({
        ...th,
        replyCount: Math.max(0, th.replyCount - 1),
        acceptedReplyId: th.acceptedReplyId === target.reply._id ? null : th.acceptedReplyId,
        solved: th.acceptedReplyId === target.reply._id ? false : th.solved,
        replies: th.replies.filter((r) => r._id !== target.reply._id).map((r) => (r.parentId === target.reply._id ? { ...r, parentId: null } : r)),
      }));
      setConfirm(null);
    } catch (err) {
      setFlash(errorMessage(err, tr('La suppression a échoué.', 'فشل الحذف.')));
      setConfirm(null);
    } finally {
      setBusy('');
    }
  };

  const startReply = (reply) => {
    if (!user) return askSignIn('reply');
    setReplyTo(reply);
    return requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      composerRef.current?.focus({ preventScroll: true });
    });
  };

  const byId = new Map(thread.replies.map((r) => [r._id, r]));
  const accepted = thread.acceptedReplyId ? byId.get(thread.acceptedReplyId) : null;
  const others = thread.replies.filter((r) => r._id !== accepted?._id);
  if (order === 'helpful') others.sort((a, b) => b.likeCount - a.likeCount || new Date(a.createdAt) - new Date(b.createdAt));
  const ordered = accepted ? [accepted, ...others] : others;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {backLink}

      {/* The question */}
      <article className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-1.5">
          {thread.isPinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-dark">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              {tr('Épinglée', 'مثبّت')}
            </span>
          )}
          <CategoryTag id={thread.category} lang={lang} />
          {thread.solved && <SolvedTag lang={lang} />}
          {thread.isLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-medium text-ink-soft">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              {tr('Fermée', 'مغلق')}
            </span>
          )}
        </div>

        <h1 dir="auto" className="mt-3 text-start text-[1.6rem] font-bold leading-[1.2] tracking-[-0.02em] sm:text-[2rem] rtl:leading-[1.45] rtl:tracking-normal">
          {thread.title}
        </h1>

        <div className="mt-4 flex items-center gap-3">
          <Avatar author={thread.author} />
          <div className="min-w-0 text-sm">
            <AuthorName author={thread.author} lang={lang} />
            <p className="text-ink-faint">
              <time dateTime={thread.createdAt} title={fullDate(thread.createdAt, lang)}>
                {timeAgo(thread.createdAt, lang)}
              </time>
              {thread.editedAt && ` · ${tr('modifiée', 'معدّل')}`}
              <span className="inline-flex items-center gap-1 ps-2">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="tabular-nums">{thread.viewCount}</span>
                <span className="sr-only">{tr('lectures', 'قراءات')}</span>
              </span>
            </p>
          </div>
        </div>

        {thread.body && (
          <p dir="auto" className="mt-5 whitespace-pre-wrap break-words text-start text-[16.5px] leading-relaxed">
            {thread.body}
          </p>
        )}

        <div className="-mx-2 mt-5 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-ink/10 pt-3">
          <ActionButton
            icon={Hand}
            tone="orange"
            label={tr('Même question', 'لدي السؤال نفسه')}
            count={thread.likeCount}
            on={thread.liked}
            onClick={toggleLike}
            disabled={thread.mine}
            title={thread.mine ? tr('C’est votre question', 'هذا سؤالك') : tr('Je me pose la même question', 'أتساءل عن الشيء نفسه')}
          />
          <SaveThreadButton thread={thread} lang={lang} onChange={patch} askSignIn={askSignIn} />
          <ActionButton icon={Share2} label={tr('Partager', 'مشاركة')} onClick={share} />
          {canEdit && <ActionButton icon={Pencil} label={tr('Modifier', 'تعديل')} onClick={() => setEditing(true)} />}
          {canDelete && <ActionButton icon={Trash2} label={tr('Supprimer', 'حذف')} onClick={() => setConfirm({ kind: 'thread' })} />}
          {!thread.mine && (
            <span className="ms-auto px-2">
              <ReportButton target={{ type: 'FORUM_THREAD', id: thread._id, label: thread.title }} lang={lang} />
            </span>
          )}
        </div>

        {thread.canModerate && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink-soft">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {tr('Modération', 'الإشراف')}
            </span>
            <ActionButton icon={thread.isPinned ? PinOff : Pin} label={thread.isPinned ? tr('Désépingler', 'إلغاء التثبيت') : tr('Épingler', 'تثبيت')} onClick={() => moderate({ isPinned: !thread.isPinned })} disabled={busy === 'moderate'} />
            <ActionButton icon={thread.isLocked ? LockOpen : Lock} label={thread.isLocked ? tr('Rouvrir', 'إعادة الفتح') : tr('Fermer aux réponses', 'إغلاق الردود')} onClick={() => moderate({ isLocked: !thread.isLocked })} disabled={busy === 'moderate'} />
          </div>
        )}
      </article>

      {flash && (
        <p role="status" className="rounded-full bg-ink px-4 py-2 text-center text-sm text-canvas-paper">
          {flash}
        </p>
      )}

      {/* The answers */}
      <section aria-labelledby="forum-replies" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="forum-replies" className="text-xl font-semibold tracking-[-0.01em]">
            {repliesLabel(thread.replies.length, lang)}
          </h2>
          {thread.replies.length > 2 && (
            <div className="flex gap-1" role="group" aria-label={tr('Trier les réponses', 'ترتيب الردود')}>
              {[
                ['oldest', 'Dans l’ordre', 'بالترتيب'],
                ['helpful', 'Les plus utiles', 'الأكثر إفادة'],
              ].map(([id, fr, ar]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={order === id}
                  onClick={() => setOrder(id)}
                  className={`min-h-10 rounded-full px-3.5 text-sm transition-colors ${order === id ? 'bg-ink/[0.08] font-medium text-ink' : 'text-ink-soft hover:text-ink'}`}
                >
                  {tr(fr, ar)}
                </button>
              ))}
            </div>
          )}
        </div>

        {thread.replies.length === 0 && (
          <div className="panel px-5 py-8 text-center">
            <p className="font-medium">{closed ? tr('Cette discussion est fermée', 'هذا النقاش مغلق') : tr('Pas encore de réponse', 'لا يوجد رد بعد')}</p>
            {!closed && <p className="mx-auto mt-1 max-w-[44ch] text-sm text-ink-soft">{thread.mine ? tr('Les autres membres verront votre question dans le forum.', 'سيرى الأعضاء الآخرون سؤالك في المنتدى.') : tr('Vous connaissez la réponse, ou vous avez vécu la même chose ? Partagez-la.', 'تعرف الإجابة أو مررت بالتجربة نفسها؟ شاركها.')}</p>}
          </div>
        )}

        <ul className="space-y-3">
          {ordered.map((reply) => (
            <ReplyCard
              key={reply._id}
              reply={reply}
              parent={reply.parentId ? byId.get(reply.parentId) : null}
              thread={thread}
              lang={lang}
              blocked={blocked}
              accepted={reply._id === thread.acceptedReplyId}
              canAccept={canAccept}
              busy={busy}
              editing={editingReply === reply._id}
              onEdit={() => setEditingReply(reply._id)}
              onEdited={(updated) => {
                patchReply(reply._id, updated);
                setEditingReply(null);
              }}
              onCancelEdit={() => setEditingReply(null)}
              onLike={() => toggleReplyLike(reply)}
              onReply={() => startReply(reply)}
              onAccept={() => accept(reply)}
              onDelete={() => setConfirm({ kind: 'reply', reply })}
            />
          ))}
        </ul>
      </section>

      {/* Answering */}
      {closed ? (
        <Notice tone="info" title={tr('Cette discussion est fermée', 'هذا النقاش مغلق')}>
          {tr('Elle n’accepte plus de réponses. Vous pouvez poser une nouvelle question.', 'لم يعد يقبل ردودا. يمكنك طرح سؤال جديد.')}
        </Notice>
      ) : blocked ? (
        <BlockedNotice posting={thread.posting} lang={lang} />
      ) : user ? (
        <ReplyComposer
          lang={lang}
          thread={thread}
          replyTo={replyTo}
          inputRef={composerRef}
          onCancelReplyTo={() => setReplyTo(null)}
          onSent={(reply) => {
            listCache.clear();
            setReplyTo(null);
            setThread((th) => ({ ...th, replyCount: th.replyCount + 1, replies: [...th.replies, reply] }));
          }}
        />
      ) : (
        <div className="panel flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{tr('Vous avez une réponse ?', 'لديك إجابة؟')}</p>
            <p className="text-sm text-ink-soft">{tr('Connectez-vous pour répondre et aider.', 'سجّل الدخول للرد والمساعدة.')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => navigate(pathFor('account'))}>
            <LogIn className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {tr('Se connecter', 'تسجيل الدخول')}
          </button>
        </div>
      )}

      <p className="text-sm text-ink-faint">
        {tr(
          'Les réponses sont écrites par les membres et reflètent leur expérience : elles ne remplacent pas l’avis de votre médecin. En cas de doute sur un produit, l’étiquette fait foi.',
          'الردود يكتبها الأعضاء وتعكس تجاربهم: لا تعوّض رأي طبيبك. عند الشك في منتج، الملصق هو المرجع.'
        )}
      </p>

      {editing && (
        <Modal open onClose={() => setEditing(false)} lang={lang} title={tr('Modifier la question', 'تعديل السؤال')}>
          <QuestionForm
            lang={lang}
            thread={thread}
            onCancel={() => setEditing(false)}
            onDone={(updated) => {
              patch({ title: updated.title, body: updated.body, category: updated.category, editedAt: updated.editedAt });
              setEditing(false);
            }}
          />
        </Modal>
      )}

      {confirm && (
        <Modal
          open
          onClose={() => (busy === 'delete' ? null : setConfirm(null))}
          lang={lang}
          width="max-w-md"
          title={confirm.kind === 'thread' ? tr('Supprimer cette question ?', 'حذف هذا السؤال؟') : tr('Supprimer cette réponse ?', 'حذف هذا الرد؟')}
        >
          <p className="text-[15px] text-ink-soft">
            {confirm.kind === 'thread'
              ? tr(
                  thread.replies.length === 0
                    ? 'La question sera supprimée pour tout le monde. C’est définitif.'
                    : thread.replies.length === 1
                      ? 'La question et sa réponse seront supprimées pour tout le monde. C’est définitif.'
                      : `La question et ses ${thread.replies.length} réponses seront supprimées pour tout le monde. C’est définitif.`,
                  'سيُحذف السؤال وكل ردوده لدى الجميع. هذا نهائي.'
                )
              : tr('La réponse sera supprimée pour tout le monde. C’est définitif.', 'سيُحذف الرد لدى الجميع. هذا نهائي.')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-danger" onClick={remove} disabled={busy === 'delete'}>
              {busy === 'delete' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {tr('Supprimer', 'حذف')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy === 'delete'}>
              {tr('Annuler', 'إلغاء')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReplyCard({ reply, parent, thread, lang, blocked, accepted, canAccept, busy, editing, onEdit, onEdited, onCancelEdit, onLike, onReply, onAccept, onDelete }) {
  const tr = t(lang);
  const canEdit = (reply.mine && !blocked) || thread.canModerate;
  const canDelete = reply.mine || thread.canModerate;
  const closed = thread.isLocked && !thread.canModerate;
  return (
    <li id={`reponse-${reply._id}`} className={`panel p-4 sm:p-5 ${accepted ? 'ring-2 ring-primary/70' : ''}`}>
      {accepted && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-sm font-medium text-primary-dark">
          <CircleCheckBig className="h-4 w-4" aria-hidden="true" />
          {tr('Réponse retenue par l’auteur de la question', 'الرد الذي اختاره صاحب السؤال')}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Avatar author={reply.author} />
        <div className="min-w-0 text-sm">
          <AuthorName author={reply.author} lang={lang} byAsker={reply.byAsker} />
          <p className="text-ink-faint">
            <time dateTime={reply.createdAt} title={fullDate(reply.createdAt, lang)}>
              {timeAgo(reply.createdAt, lang)}
            </time>
            {reply.editedAt && ` · ${tr('modifiée', 'معدّل')}`}
          </p>
        </div>
      </div>

      {parent && !editing && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-sm text-ink-soft">
          <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-medium">{tr(`En réponse à ${parent.author?.name || 'un membre'}`, `ردا على ${parent.author?.name || 'عضو'}`)}</span>
            <span dir="auto" className="line-clamp-2 text-start">
              {parent.body}
            </span>
          </span>
        </p>
      )}

      {editing ? (
        <ReplyEditor reply={reply} lang={lang} onDone={onEdited} onCancel={onCancelEdit} />
      ) : (
        <p dir="auto" className="mt-3 whitespace-pre-wrap break-words text-start text-[16px] leading-relaxed">
          {reply.body}
        </p>
      )}

      {!editing && (
        <div className="-mx-2 mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
          <ActionButton
            icon={ThumbsUp}
            label={tr('Utile', 'مفيد')}
            count={reply.likeCount}
            on={reply.liked}
            fill
            onClick={onLike}
            disabled={reply.mine}
            title={reply.mine ? tr('C’est votre réponse', 'هذا ردك') : tr('Cette réponse m’a aidé', 'هذا الرد أفادني')}
          />
          {!closed && !blocked && <ActionButton icon={Reply} label={tr('Répondre', 'رد')} onClick={onReply} />}
          {canAccept && (
            <ActionButton
              icon={CircleCheckBig}
              label={accepted ? tr('Retirer la solution', 'إلغاء الحل') : tr('C’est la solution', 'هذا هو الحل')}
              on={accepted}
              onClick={onAccept}
              disabled={busy === `accept:${reply._id}`}
            />
          )}
          {canEdit && <ActionButton icon={Pencil} label={tr('Modifier', 'تعديل')} onClick={onEdit} hideLabel />}
          {canDelete && <ActionButton icon={Trash2} label={tr('Supprimer', 'حذف')} onClick={onDelete} hideLabel />}
          {!reply.mine && (
            <span className="ms-auto">
              <ReportButton
                iconOnly
                lang={lang}
                target={{ type: 'FORUM_REPLY', id: `${thread._id}:${reply._id}`, label: `${reply.author?.name || 'Membre'} : ${reply.body.replace(/\s+/g, ' ').slice(0, 160)}` }}
              />
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function ReplyEditor({ reply, lang, onDone, onCancel }) {
  const tr = t(lang);
  const [body, setBody] = useState(reply.body);
  const [state, setState] = useState({ busy: false, error: '' });
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (body.trim().length < LIMITS.replyMin) return;
    setState({ busy: true, error: '' });
    try {
      const res = await updateForumReply(reply._id, body);
      onDone({ body: res.data.body, editedAt: res.data.editedAt });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, tr('La modification a échoué.', 'فشل التعديل.')) });
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <GrowingTextarea inputRef={ref} value={body} onChange={(e) => setBody(e.target.value)} maxLength={LIMITS.reply} aria-label={tr('Votre réponse', 'ردك')} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={state.busy || body.trim().length < LIMITS.replyMin}>
          {tr('Enregistrer', 'احفظ')}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={state.busy}>
          {tr('Annuler', 'إلغاء')}
        </button>
      </div>
    </form>
  );
}

function ReplyComposer({ lang, thread, replyTo, inputRef, onCancelReplyTo, onSent }) {
  const tr = t(lang);
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  const ready = body.trim().length >= LIMITS.replyMin && body.length <= LIMITS.reply;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setState({ busy: true, error: '' });
    try {
      const res = await createForumReply(thread._id, body, replyTo?._id || null);
      setBody('');
      setState({ busy: false, error: '' });
      onSent(res.data);
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, tr('L’envoi a échoué. Vérifiez votre connexion puis réessayez.', 'فشل الإرسال. تحقق من الاتصال ثم أعد المحاولة.')) });
    }
  };

  return (
    <form onSubmit={submit} className="panel space-y-3 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Avatar author={{ name: (user?.fullName || user?.email || '').trim(), badge: user?.role === 'ADMIN' || user?.role === 'STAFF' ? 'TEAM' : null }} />
        <label htmlFor="forum-reply" className="font-medium">
          {thread.mine ? tr('Ajouter une précision', 'أضف توضيحا') : tr('Votre réponse', 'ردك')}
        </label>
        <span className="ms-auto">
          <Counter value={body} max={LIMITS.reply} />
        </span>
      </div>

      {replyTo && (
        <p className="flex items-start gap-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-sm text-ink-soft">
          <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{tr(`En réponse à ${replyTo.author?.name || 'un membre'}`, `ردا على ${replyTo.author?.name || 'عضو'}`)}</span>
            <span dir="auto" className="line-clamp-1 text-start">
              {replyTo.body}
            </span>
          </span>
          <button type="button" onClick={onCancelReplyTo} className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-ink/[0.08]" aria-label={tr('Ne plus répondre à ce message', 'إلغاء الرد على هذه الرسالة')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </p>
      )}

      <GrowingTextarea
        id="forum-reply"
        inputRef={inputRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={LIMITS.reply}
        placeholder={tr('Partagez votre expérience : la marque, l’adresse, ce qui a marché pour vous…', 'شارك تجربتك: العلامة، العنوان، ما الذي نجح معك…')}
      />

      {state.error && <Notice tone="error">{state.error}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">{tr('Publié avec votre prénom. Restez bienveillant.', 'يُنشر مع اسمك الأول. كن لطيفا.')}</p>
        <button type="submit" className="btn-primary" disabled={state.busy || !ready}>
          {state.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />}
          {tr('Publier la réponse', 'انشر الرد')}
        </button>
      </div>
    </form>
  );
}
