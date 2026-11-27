import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Film, Link2, X, ChevronUp, ChevronDown, Play, Plus } from 'lucide-react';
import { uploadSpotMedia, errorMessage } from '../services/api';
import { resizeImage, dataUrlToBlob, videoPoster } from '../services/images';
import { t, Notice } from './ui';

const MAX_MEDIA = 30;
const MAX_LINKS = 10;
const MAX_VIDEO_MB = 50;

export const LINK_TYPES = [
  { value: 'website', fr: 'Site web', ar: 'الموقع' },
  { value: 'facebook', fr: 'Facebook', ar: 'فيسبوك' },
  { value: 'instagram', fr: 'Instagram', ar: 'إنستغرام' },
  { value: 'menu', fr: 'Menu en ligne', ar: 'القائمة على الإنترنت' },
  { value: 'other', fr: 'Autre lien', ar: 'رابط آخر' },
];

/**
 * Photos, menu pages, videos and links of a map spot, edited in the back-office.
 * Files are uploaded as soon as they are picked (straight to Storage); the spot keeps
 * only their URLs, saved with the rest of the form. `onBusyChange(true)` while an upload runs.
 * onMediaChange receives the new list or an updater function (uploads finish one after another).
 */
export default function SpotMediaEditor({ lang, media, onMediaChange, links, onLinksChange, onBusyChange }) {
  const tr = t(lang);
  const photoRef = useRef(null);
  const videoRef = useRef(null);
  const [uploads, setUploads] = useState([]); // [{ id, name, progress }]
  const [error, setError] = useState('');

  useEffect(() => {
    onBusyChange?.(uploads.length > 0);
  }, [uploads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = MAX_MEDIA - media.length - uploads.length;

  const track = (name) => {
    const id = `${Date.now()}-${Math.random()}`;
    setUploads((u) => [...u, { id, name, progress: 0 }]);
    return {
      progress: (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))),
      done: () => setUploads((u) => u.filter((x) => x.id !== id)),
    };
  };

  const add = (item) => onMediaChange((list) => [...list, item]);

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])].slice(0, Math.max(0, room));
    e.target.value = '';
    setError('');
    await Promise.all(
      files.map(async (file) => {
        const job = track(file.name);
        try {
          const blob = dataUrlToBlob(await resizeImage(file, 1600, 0.85));
          const { publicUrl } = await uploadSpotMedia(blob, job.progress);
          add({ type: 'image', src: publicUrl, alt: '', credit: '' });
        } catch (err) {
          setError(
            err?.message === 'not-an-image' || err?.message === 'unreadable'
              ? tr(`« ${file.name} » n’a pas pu être lue.`, `تعذرت قراءة «${file.name}».`)
              : errorMessage(err, tr(`L’envoi de « ${file.name} » a échoué.`, `فشل إرسال «${file.name}».`))
          );
        } finally {
          job.done();
        }
      })
    );
  };

  const addVideo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || room < 1) return;
    setError('');
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(tr(`La vidéo dépasse ${MAX_VIDEO_MB} Mo : raccourcissez-la ou compressez-la.`, `الفيديو يتجاوز ${MAX_VIDEO_MB} ميغابايت.`));
      return;
    }
    const job = track(file.name);
    try {
      // The poster (still shown before playing and as the card thumbnail) is taken from the video itself
      const still = await videoPoster(file);
      const poster = still ? (await uploadSpotMedia(still)).publicUrl : undefined;
      const { publicUrl } = await uploadSpotMedia(file, job.progress);
      add({ type: 'video', src: publicUrl, ...(poster ? { poster } : {}), alt: '', credit: '' });
    } catch (err) {
      setError(errorMessage(err, tr(`L’envoi de « ${file.name} » a échoué.`, `فشل إرسال «${file.name}».`)));
    } finally {
      job.done();
    }
  };

  const update = (i, patch) => onMediaChange(media.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const remove = (i) => onMediaChange(media.filter((_, j) => j !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= media.length) return;
    const next = [...media];
    [next[i], next[j]] = [next[j], next[i]];
    onMediaChange(next);
  };

  // The picture the map shows for the place (see spotThumbnail in SpotDetails.jsx)
  const photoIndex = media.findIndex((m) => m.type === 'image' && m.kind !== 'menu');
  const thumbIndex = photoIndex >= 0 ? photoIndex : media.findIndex((m) => m.type === 'video' && m.poster);

  const updateLink = (i, patch) => onLinksChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-4">
      <fieldset className="rounded-lg border border-canvas-line p-4">
        <legend className="px-1 text-sm font-medium">
          {tr('Photos et vidéos', 'صور وفيديوهات')} <span className="font-normal text-ink-faint">({media.length}/{MAX_MEDIA})</span>
        </legend>
        <p className="mb-3 text-sm text-ink-soft">
          {tr(
            'La première photo sert de vignette sur la carte. Cochez « Page de menu » pour les pages de carte ou de menu : elles s’affichent à part.',
            'الصورة الأولى تظهر كصورة مصغرة على الخريطة. اختر «القائمة» لصفحات القائمة: تظهر على حدة.'
          )}
        </p>

        {media.length > 0 && (
          <ul className="mb-3 space-y-2">
            {media.map((item, i) => (
              <li key={item.src} className="flex gap-3 rounded-xl border border-canvas-line/70 bg-canvas-paper/80 p-2">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-canvas-sunk">
                  {item.type === 'video' && !item.poster ? (
                    <video src={item.src} muted preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <img src={item.type === 'video' ? item.poster : item.src} alt="" className="h-full w-full object-cover" />
                  )}
                  {item.type === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play className="h-5 w-5 text-white" fill="currentColor" aria-hidden="true" />
                    </span>
                  )}
                  {i === thumbIndex && <span className="absolute bottom-1 start-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] text-white">{tr('Vignette', 'مصغرة')}</span>}
                </div>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <input
                    value={item.alt || ''}
                    onChange={(e) => update(i, { alt: e.target.value })}
                    maxLength={200}
                    placeholder={tr('Description (pour l’accessibilité)', 'وصف (لإمكانية الوصول)')}
                    aria-label={tr(`Description du média ${i + 1}`, `وصف الوسيط ${i + 1}`)}
                    className="field py-2 text-sm sm:col-span-2"
                  />
                  <input
                    value={item.credit || ''}
                    onChange={(e) => update(i, { credit: e.target.value })}
                    maxLength={100}
                    placeholder={tr('Crédit (ex. Google Maps)', 'المصدر')}
                    aria-label={tr(`Crédit du média ${i + 1}`, `مصدر الوسيط ${i + 1}`)}
                    className="field py-2 text-sm"
                  />
                  {item.type === 'image' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.kind === 'menu'}
                        onChange={(e) => update(i, { kind: e.target.checked ? 'menu' : undefined })}
                        className="h-4 w-4 accent-[#4F6B1C]"
                      />
                      {tr('Page de menu', 'صفحة قائمة')}
                    </label>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <button type="button" className="btn-ghost p-1.5" onClick={() => move(i, -1)} disabled={i === 0} aria-label={tr('Monter', 'إلى الأعلى')}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost p-1.5 hover:text-status-unsafe-ink" onClick={() => remove(i)} aria-label={tr('Retirer', 'إزالة')}>
                    <X className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost p-1.5" onClick={() => move(i, 1)} disabled={i === media.length - 1} aria-label={tr('Descendre', 'إلى الأسفل')}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {uploads.length > 0 && (
          <ul className="mb-3 space-y-1.5" aria-live="polite">
            {uploads.map((u) => (
              <li key={u.id} className="text-sm text-ink-soft">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{u.name}</span>
                  <span className="tabular-nums">{Math.round(u.progress * 100)} %</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas-sunk">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(4, u.progress * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="mb-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-quiet" onClick={() => photoRef.current?.click()} disabled={room < 1}>
            <ImagePlus className="h-4 w-4" />
            {tr('Ajouter des photos', 'أضف صورا')}
          </button>
          <button type="button" className="btn-quiet" onClick={() => videoRef.current?.click()} disabled={room < 1}>
            <Film className="h-4 w-4" />
            {tr('Ajouter une vidéo', 'أضف فيديو')}
          </button>
          <span className="self-center text-xs text-ink-faint">{tr(`Vidéo : MP4, WebM ou MOV, ${MAX_VIDEO_MB} Mo max.`, `فيديو: MP4 أو WebM أو MOV، ${MAX_VIDEO_MB} ميغابايت كحد أقصى.`)}</span>
        </div>
        <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} aria-label={tr('Photos du lieu', 'صور المكان')} />
        <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={addVideo} aria-label={tr('Vidéo du lieu', 'فيديو المكان')} />
      </fieldset>

      <fieldset className="rounded-lg border border-canvas-line p-4">
        <legend className="px-1 text-sm font-medium">{tr('Liens', 'الروابط')}</legend>
        {links.length > 0 && (
          <ul className="mb-3 space-y-2">
            {links.map((link, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <select
                  value={link.type}
                  onChange={(e) => updateLink(i, { type: e.target.value })}
                  aria-label={tr(`Type du lien ${i + 1}`, `نوع الرابط ${i + 1}`)}
                  className="field w-full py-2 text-sm sm:w-40"
                >
                  {LINK_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>{tr(lt.fr, lt.ar)}</option>
                  ))}
                </select>
                <input
                  type="url"
                  required
                  dir="ltr"
                  value={link.url}
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                  placeholder="https://…"
                  aria-label={tr(`Adresse du lien ${i + 1}`, `عنوان الرابط ${i + 1}`)}
                  className="field min-w-0 flex-1 py-2 text-sm"
                />
                {link.type === 'other' && (
                  <input
                    value={link.label || ''}
                    onChange={(e) => updateLink(i, { label: e.target.value })}
                    maxLength={60}
                    placeholder={tr('Texte du bouton', 'نص الزر')}
                    aria-label={tr(`Texte du lien ${i + 1}`, `نص الرابط ${i + 1}`)}
                    className="field w-full py-2 text-sm sm:w-36"
                  />
                )}
                <button type="button" className="btn-ghost p-1.5 hover:text-status-unsafe-ink" onClick={() => onLinksChange(links.filter((_, j) => j !== i))} aria-label={tr('Retirer le lien', 'إزالة الرابط')}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn-quiet"
          onClick={() => onLinksChange([...links, { type: links.some((l) => l.type === 'website') ? 'instagram' : 'website', url: '' }])}
          disabled={links.length >= MAX_LINKS}
        >
          {links.length ? <Plus className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {tr('Ajouter un lien', 'أضف رابطا')}
        </button>
      </fieldset>
    </div>
  );
}
