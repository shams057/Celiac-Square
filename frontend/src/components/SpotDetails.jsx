import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Navigation, ExternalLink, TriangleAlert } from 'lucide-react';
import { t, Modal } from './ui';

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
