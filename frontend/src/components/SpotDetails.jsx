import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Navigation, ExternalLink, TriangleAlert, Users } from 'lucide-react';
import { t, Modal, Notice } from './ui';
import { useAuth } from './AuthContext';
import { ReportButton } from './community';
import { fetchMySpotFeedback, sendSpotFeedback, errorMessage } from '../services/api';
import { navigate, pathFor } from '../services/router';

const QUESTIONS = [
  { key: 'reacted', fr: 'Avez-vous eu une réaction après y avoir mangé ?', ar: 'هل أصابك عارض بعد الأكل هناك؟', summaryFr: 'Réaction après le repas', summaryAr: 'عارض بعد الأكل', bad: true },
  { key: 'dedicatedKitchen', fr: 'Cuisine ou plan de travail dédié au sans gluten ?', ar: 'مطبخ أو مساحة مخصصة لما هو بدون غلوتين؟', summaryFr: 'Cuisine dédiée', summaryAr: 'مطبخ مخصص' },
  { key: 'staffAware', fr: 'Le personnel connaissait-il la maladie cœliaque ?', ar: 'هل كان الموظفون على دراية بمرض الأبطن؟', summaryFr: 'Personnel informé', summaryAr: 'موظفون على دراية' },
];

const ANSWERS = [
  { value: true, fr: 'Oui', ar: 'نعم' },
  { value: false, fr: 'Non', ar: 'لا' },
  { value: null, fr: 'Je ne sais pas', ar: 'لا أعرف' },
];

/**
 * Yes/no answers from signed-in members about a place (one answer per account, editable).
 * Only the totals are public. No stars and no free text: harder to fake, and more useful to a celiac.
 */
function SpotFeedback({ spot, lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const [summary, setSummary] = useState(spot.feedback || null);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState({ reacted: null, dedicatedKitchen: null, staffAware: null });
  const [state, setState] = useState({ loading: false, sending: false, error: '', done: false });

  const start = async () => {
    if (!user) {
      navigate(pathFor('account'));
      return;
    }
    setOpen(true);
    setState({ loading: true, sending: false, error: '', done: false });
    try {
      const res = await fetchMySpotFeedback(spot._id);
      if (res?.data) setAnswers({ reacted: res.data.reacted, dedicatedKitchen: res.data.dedicatedKitchen, staffAware: res.data.staffAware });
      setState({ loading: false, sending: false, error: '', done: false });
    } catch (err) {
      setState({ loading: false, sending: false, error: errorMessage(err, tr('Le formulaire n’a pas pu être chargé.', 'تعذر تحميل الاستمارة.')), done: false });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setState((st) => ({ ...st, sending: true, error: '' }));
    try {
      const res = await sendSpotFeedback(spot._id, answers);
      setSummary(res?.data || null);
      setState({ loading: false, sending: false, error: '', done: true });
      setOpen(false);
    } catch (err) {
      setState({ loading: false, sending: false, error: errorMessage(err, tr('L’envoi a échoué. Réessayez.', 'فشل الإرسال. أعد المحاولة.')), done: false });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-canvas-line/70 bg-canvas-paper/60 p-3.5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" aria-hidden="true" />
        {tr('L’avis des membres cœliaques', 'رأي الأعضاء المصابين بالأبطن')}
      </p>
      {summary?.answers ? (
        <>
          <ul className="space-y-1 text-sm">
            {QUESTIONS.map((q) => {
              const { yes, no } = summary[q.key] || { yes: 0, no: 0 };
              if (!yes && !no) return null;
              return (
                <li key={q.key} className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-ink-soft">{tr(q.summaryFr, q.summaryAr)}</span>
                  <span className={`tabular-nums ${q.bad && yes ? 'font-medium text-status-unsafe-ink' : ''}`}>
                    {tr(`${yes} oui · ${no} non`, `${yes} نعم · ${no} لا`)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-faint">
            {tr(
              `${summary.answers} réponse${summary.answers > 1 ? 's' : ''} de membres connectés, non vérifiées par l’équipe.`,
              `${summary.answers} إجابة من أعضاء مسجلين، لم يتحقق منها الفريق.`
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-soft">{tr('Pas encore de réponse. Vous y êtes allé ? Dites-le aux autres.', 'لا توجد إجابات بعد. هل زرت المكان؟ أخبر الآخرين.')}</p>
      )}

      {state.done && <Notice tone="success">{tr('Merci, votre réponse est prise en compte.', 'شكرا، تم احتساب إجابتك.')}</Notice>}

      {open ? (
        <form onSubmit={submit} className="space-y-3">
          {state.loading ? (
            <p className="text-sm text-ink-soft">{tr('Chargement…', 'جاري التحميل…')}</p>
          ) : (
            QUESTIONS.map((q) => (
              <fieldset key={q.key}>
                <legend className="mb-1.5 text-sm">{tr(q.fr, q.ar)}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {ANSWERS.map((a) => (
                    <button
                      key={String(a.value)}
                      type="button"
                      className="chip"
                      aria-pressed={answers[q.key] === a.value}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: a.value }))}
                    >
                      {tr(a.fr, a.ar)}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))
          )}
          {state.error && <Notice tone="error">{state.error}</Notice>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={state.sending || state.loading}>
              {state.sending ? tr('Envoi…', 'جاري الإرسال…') : tr('Envoyer', 'أرسل')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {tr('Annuler', 'إلغاء')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-quiet" onClick={start}>
          {user ? tr('Donner mon avis', 'أعط رأيي') : tr('Se connecter pour répondre', 'سجّل الدخول للإجابة')}
        </button>
      )}
    </div>
  );
}

/** First picture of a spot (video poster counts), used as the card and popup thumbnail */
export const spotCover = (spot) => {
  const media = spot.media || [];
  const image = media.find((m) => m.type === 'image' && m.kind !== 'menu');
  if (image) return { src: image.src, alt: image.alt || '' };
  const video = media.find((m) => m.poster);
  return video ? { src: video.poster, alt: video.alt || '' } : null;
};

const LINK_LABELS = {
  facebook: ['Facebook', 'فيسبوك'],
  instagram: ['Instagram', 'إنستغرام'],
  website: ['Site web', 'الموقع'],
  menu: ['Menu en ligne', 'القائمة على الإنترنت'],
};

/** Orange notice for places whose gluten-free food shares a kitchen with gluten */
export function CrossContaminationBadge({ lang }) {
  const tr = t(lang);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-status-warning/20 px-2 py-0.5 text-sm font-medium text-status-warning-ink">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {tr('Risque de contamination croisée', 'خطر التلوث التبادلي')}
    </span>
  );
}

function Thumb({ item, onOpen, lang }) {
  const tr = t(lang);
  const isVideo = item.type === 'video';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-canvas-line bg-canvas-paper sm:h-28 sm:w-28"
      aria-label={isVideo ? `${tr('Lire la vidéo', 'تشغيل الفيديو')} : ${item.alt}` : `${tr('Agrandir', 'تكبير')} : ${item.alt}`}
    >
      <img src={isVideo ? item.poster : item.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      {isVideo && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/25">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas-paper/90 text-ink">
            <Play className="ms-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />
          </span>
        </span>
      )}
    </button>
  );
}

/** Full-size viewer: one picture or video at a time, with previous / next */
function Viewer({ items, index, setIndex, onClose, title, lang }) {
  const tr = t(lang);
  const item = items[index];
  const step = (d) => setIndex((index + d + items.length) % items.length);
  const onKey = (e) => {
    if (e.key === 'ArrowRight') step(lang === 'ar' ? -1 : 1);
    if (e.key === 'ArrowLeft') step(lang === 'ar' ? 1 : -1);
  };
  return (
    <Modal open onClose={onClose} lang={lang} title={title} subtitle={`${index + 1} / ${items.length} · ${item.alt}`} width="max-w-3xl">
      <div className="space-y-3" onKeyDown={onKey}>
        <div className="flex items-center justify-center overflow-hidden rounded-xl bg-ink/90">
          {item.type === 'video' ? (
            <video key={item.src} src={item.src} poster={item.poster} controls autoPlay playsInline className="max-h-[70vh] w-full">
              {item.alt}
            </video>
          ) : (
            <img key={item.src} src={item.src} alt={item.alt} className="max-h-[70vh] w-auto object-contain" />
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => step(-1)} className="btn-quiet" disabled={items.length < 2}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {tr('Précédente', 'السابق')}
          </button>
          {item.credit && <p className="text-sm text-ink-faint">{tr(`Photo : ${item.credit}`, `الصورة: ${item.credit}`)}</p>}
          <button type="button" onClick={() => step(1)} className="btn-quiet" disabled={items.length < 2}>
            {tr('Suivante', 'التالي')}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Photos, videos, menu pages and links of an open spot in the list */
export default function SpotDetails({ spot, lang }) {
  const tr = t(lang);
  const media = spot.media || [];
  const gallery = media.filter((m) => m.kind !== 'menu');
  const menu = media.filter((m) => m.kind === 'menu');
  const [viewer, setViewer] = useState(null); // { items, index }
  const [lng, lat] = spot.location?.coordinates || [];
  const credits = [...new Set(media.map((m) => m.credit).filter(Boolean))];

  const strip = (items, label) =>
    items.length > 0 && (
      <div>
        <p className="mb-2 text-sm font-medium">{label}</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {items.map((item, i) => (
            <Thumb key={item.src} item={item} lang={lang} onOpen={() => setViewer({ items, index: i })} />
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-4 border-t border-canvas-line px-4 pb-4 pt-3">
      {strip(gallery, tr('Photos et vidéos', 'صور وفيديوهات'))}
      {strip(menu, tr('Menu', 'القائمة'))}
      {credits.length > 0 && (
        <p className="text-xs text-ink-faint">{tr(`Certaines photos : ${credits.join(', ')}`, `بعض الصور: ${credits.join('، ')}`)}</p>
      )}

      <SpotFeedback spot={spot} lang={lang} />

      <div className="flex flex-wrap gap-2">
        {lat !== undefined && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="btn-quiet">
            <Navigation className="h-4 w-4" aria-hidden="true" />
            {tr('Itinéraire', 'الاتجاهات')}
          </a>
        )}
        {(spot.links || []).map((link) => {
          const [fr, ar] = LINK_LABELS[link.type] || [link.label || 'Lien', link.label || 'رابط'];
          return (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="btn-quiet">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {tr(fr, ar)}
            </a>
          );
        })}
      </div>

      <ReportButton target={{ type: 'SPOT', id: spot._id, label: `${spot.name} (${spot.city})` }} lang={lang} />

      {viewer && (
        <Viewer
          items={viewer.items}
          index={viewer.index}
          setIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
          title={spot.name}
          lang={lang}
        />
      )}
    </div>
  );
}
