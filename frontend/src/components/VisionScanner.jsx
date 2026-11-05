import React, { useState, useRef, useEffect } from 'react';
import { Camera, ImageUp, Video, RotateCcw, Search, ScanText, ListChecks, TriangleAlert } from 'lucide-react';
import { matchProductText, analyzeIngredients } from '../services/api';
import { preloadOcr, readText } from '../services/ocr';
import { t, statusKind, STATUS, StatusTile, PageHead, Notice } from './ui';

// Phone photos are often 4–12 MB; the API accepts at most 4.5 MB, and smaller images read faster
const MAX_SIDE = 1600;
const shrinkImage = async (file) => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file; // formats the browser cannot decode are sent as they are
  }
};

const VERDICT_BLOCK = {
  safe: 'bg-status-safe text-ink',
  warning: 'bg-status-warning text-ink',
  unsafe: 'bg-status-unsafe text-white',
  unknown: 'bg-canvas-sunk text-ink',
};

const MODES = {
  product: {
    icon: ScanText,
    fr: 'Reconnaître le produit',
    ar: 'التعرف على المنتج',
    hintFr: 'Photo de l’emballage : la marque et le nom sont lus puis cherchés dans le guide.',
    hintAr: 'صورة العلبة: تُقرأ العلامة والاسم ثم يُبحث عنهما في الدليل.',
  },
  ingredients: {
    icon: ListChecks,
    fr: 'Analyser les ingrédients',
    ar: 'تحليل المكونات',
    hintFr: 'Photo de la liste d’ingrédients : le texte est lu puis l’IA indique si le produit contient du gluten.',
    hintAr: 'صورة قائمة المكونات: يحدد الذكاء الاصطناعي إن كان المنتج يحتوي على الغلوتين.',
  },
};

export default function VisionScanner({ onSwitchToSearch, lang }) {
  const tr = t(lang);
  const [mode, setMode] = useState('product');
  const [liveCamera, setLiveCamera] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [photo, setPhoto] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(null); // null | { label, progress? }
  const [result, setResult] = useState(null); // { mode, data }
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Download the text reader while the user frames the photo
  useEffect(() => {
    preloadOcr();
  }, []);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreamActive(false);
  };

  // The camera only starts when the user asks for the live viewfinder
  useEffect(() => {
    if (!liveCamera) return undefined;
    let cancelled = false;
    (async () => {
      setCameraError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamActive(true);
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            tr(
              'La caméra n’est pas accessible. Autorisez-la dans votre navigateur, ou choisissez une photo.',
              'الكاميرا غير متاحة. اسمح بها في المتصفح أو اختر صورة.'
            )
          );
          setLiveCamera(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [liveCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const identifyProduct = async (image) => {
    setBusy({ label: tr('Lecture de l’emballage…', 'جاري قراءة العلبة…'), progress: 0 });
    const text = await readText(image, ({ phase, progress }) =>
      setBusy({
        label: phase === 'loading' ? tr('Préparation de la lecture…', 'جاري التحضير…') : tr('Lecture de l’emballage…', 'جاري قراءة العلبة…'),
        progress,
      })
    );
    if (!text.trim()) return { mode: 'product', data: { identifiedProduct: null, noText: true, keywords: [], candidates: [] } };
    setBusy({ label: tr('Recherche dans le guide…', 'جاري البحث في الدليل…') });
    const res = await matchProductText(text);
    if (!res?.success) throw new Error(res?.message || 'failed');
    return { mode: 'product', data: res.data };
  };

  const checkIngredients = async (image) => {
    const text = await readText(image, ({ phase, progress }) =>
      setBusy({
        label: phase === 'loading' ? tr('Préparation de la lecture…', 'جاري التحضير…') : tr('Lecture des ingrédients…', 'جاري قراءة المكونات…'),
        progress,
      })
    );
    // Nothing legible: no need to ask the AI
    if (text.trim().length < 8) {
      return { mode: 'ingredients', data: { verdict: 'UNREADABLE', confidence: 0, glutenIngredients: [], traces: [], text } };
    }
    setBusy({ label: tr('Analyse des ingrédients…', 'جاري تحليل المكونات…') });
    const res = await analyzeIngredients(text);
    if (!res?.success) throw new Error(res?.message || 'failed');
    return { mode: 'ingredients', data: { ...res.data, text } };
  };

  const analyze = async (file, scanMode = mode) => {
    setLiveCamera(false);
    setErrorMsg('');
    setResult(null);
    try {
      const image = await shrinkImage(file);
      setPhoto(image);
      setResult(scanMode === 'product' ? await identifyProduct(image) : await checkIngredients(image));
    } catch (err) {
      console.error('Scan error:', err);
      setErrorMsg(err.response?.data?.message || (err.message && err.message !== 'failed' ? err.message : 'network'));
    } finally {
      setBusy(null);
    }
  };

  const startWith = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(tr('Ce fichier n’est pas une image.', 'هذا الملف ليس صورة.'));
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    analyze(file);
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && startWith(new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    startWith(e.dataTransfer.files?.[0]);
  };

  const handleReset = () => {
    setPreviewUrl('');
    setPhoto(null);
    setResult(null);
    setErrorMsg('');
  };

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    handleReset();
  };

  // The product photo turned out to be an ingredients list: analyse the same photo
  const analyzeSamePhotoAsIngredients = () => {
    setMode('ingredients');
    if (photo) analyze(photo, 'ingredients');
  };

  const current = MODES[mode];

  return (
    <div className="space-y-8">
      <PageHead
        title={tr('Scanner un produit', 'امسح منتجا')}
        lede={tr(
          'Photographiez l’emballage pour retrouver le produit dans le guide, ou la liste d’ingrédients pour savoir s’il contient du gluten.',
          'صوّر العلبة للعثور على المنتج في الدليل، أو قائمة المكونات لمعرفة إن كان يحتوي على الغلوتين.'
        )}
      />

      {/* Mode switch */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/50 bg-canvas-raised/60 p-1" role="tablist" aria-label={tr('Type de scan', 'نوع المسح')}>
        {Object.entries(MODES).map(([id, m]) => {
          const Icon = m.icon;
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(id)}
              disabled={Boolean(busy)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors sm:text-[15px] ${
                active ? 'bg-ink font-medium text-canvas-paper shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tr(m.fr, m.ar)}
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
        {/* Capture */}
        <section className="space-y-4" aria-label={tr('Photo', 'الصورة')}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 ${
              dragOver ? 'border-ink bg-canvas-paper' : previewUrl || liveCamera ? 'border-ink bg-ink' : 'border-dashed border-canvas-line bg-canvas-raised'
            }`}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt={tr('Photo analysée', 'الصورة المحللة')} className="h-full w-full object-contain" />
                {busy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink/75 px-8 text-canvas-paper" role="status">
                    <p className="font-medium">{busy.label}</p>
                    <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-canvas-paper/25">
                      {typeof busy.progress === 'number' ? (
                        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
                      ) : (
                        <div className="h-full w-1/3 animate-indeterminate rounded-full bg-accent" />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : liveCamera ? (
              <>
                <video ref={videoRef} playsInline autoPlay muted className="h-full w-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="pointer-events-none absolute inset-[12%] rounded-lg border-2 border-canvas-paper/70" />
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <button
                    type="button"
                    onClick={captureSnapshot}
                    disabled={!streamActive}
                    className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-canvas-paper bg-accent text-ink disabled:opacity-50"
                    aria-label={tr('Prendre la photo', 'التقط الصورة')}
                  >
                    <Camera className="h-6 w-6" />
                  </button>
                </div>
              </>
            ) : (
              <div key={mode} className="flex h-full animate-fade-in flex-col items-center justify-center gap-4 p-6 text-center">
                <current.icon className="h-8 w-8 text-ink-faint" />
                <p className="max-w-[32ch] text-ink-soft">{tr(current.hintFr, current.hintAr)}</p>
                <p className="hidden text-sm text-ink-faint sm:block">{tr('Vous pouvez aussi déposer une image ici.', 'يمكنك أيضا سحب صورة إلى هنا.')}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {previewUrl ? (
              <button type="button" onClick={handleReset} className="btn-primary" disabled={Boolean(busy)}>
                <RotateCcw className="h-4 w-4" />
                {tr('Nouvelle photo', 'صورة جديدة')}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => captureInputRef.current?.click()} className="btn-primary sm:hidden">
                  <Camera className="h-4 w-4" />
                  {tr('Prendre une photo', 'التقط صورة')}
                </button>
                <button type="button" onClick={() => setLiveCamera((v) => !v)} className={`hidden sm:inline-flex ${liveCamera ? 'btn-quiet' : 'btn-primary'}`}>
                  <Video className="h-4 w-4" />
                  {liveCamera ? tr('Arrêter la caméra', 'أوقف الكاميرا') : tr('Utiliser la caméra', 'استعمل الكاميرا')}
                </button>
                <button type="button" onClick={() => galleryInputRef.current?.click()} className="btn-quiet">
                  <ImageUp className="h-4 w-4" />
                  {tr('Choisir une image', 'اختر صورة')}
                </button>
              </>
            )}
            <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => startWith(e.target.files?.[0])} />
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => startWith(e.target.files?.[0])} />
          </div>

          {cameraError && <Notice tone="warning">{cameraError}</Notice>}

          <p className="text-sm text-ink-soft">
            {tr('Pas de photo possible ?', 'لا يمكنك التصوير؟')}{' '}
            <button type="button" onClick={() => onSwitchToSearch?.('')} className="font-medium text-ink underline underline-offset-4">
              {tr('Rechercher le produit par son nom ou son code-barres', 'ابحث عن المنتج باسمه أو برمزه الشريطي')}
            </button>
          </p>
        </section>

        {/* Result */}
        <section aria-live="polite" aria-label={tr('Résultat', 'النتيجة')}>
          {errorMsg && !busy ? (
            <Notice tone="error" title={tr('L’analyse n’a pas abouti.', 'تعذر التحليل.')}>
              {errorMsg === 'network'
                ? tr('Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.', 'الخادم لا يستجيب. تحقق من الاتصال ثم أعد المحاولة.')
                : errorMsg}
            </Notice>
          ) : result?.mode === 'product' ? (
            <ProductVerdict result={result.data} lang={lang} onSearch={onSwitchToSearch} onAnalyzeIngredients={analyzeSamePhotoAsIngredients} />
          ) : result?.mode === 'ingredients' ? (
            <IngredientsVerdict result={result.data} lang={lang} />
          ) : (
            <HowItWorks mode={mode} lang={lang} />
          )}
        </section>
      </div>
    </div>
  );
}

function ProductVerdict({ result, lang, onSearch, onAnalyzeIngredients }) {
  const tr = t(lang);
  const kind = result.matchedProduct ? statusKind(result.glutenStatus) : 'unknown';
  const meta = STATUS[kind];
  const Icon = meta.icon;
  const match = result.matchedProduct;
  const notes = lang === 'ar' ? match?.notesAr || match?.notes : match?.notes;

  return (
    <div className="space-y-4">
      {result.looksLikeIngredients && (
        <Notice
          tone="info"
          title={tr('Cette photo montre une liste d’ingrédients', 'هذه الصورة تُظهر قائمة مكونات')}
          action={
            <button type="button" onClick={onAnalyzeIngredients} className="btn-primary">
              <ListChecks className="h-4 w-4" />
              {tr('Analyser ces ingrédients', 'حلّل هذه المكونات')}
            </button>
          }
        >
          {tr('L’analyse des ingrédients dira si le produit contient du gluten.', 'تحليل المكونات سيبيّن إن كان المنتج يحتوي على الغلوتين.')}
        </Notice>
      )}

      <div className={`animate-verdict rounded-xl p-6 ${VERDICT_BLOCK[kind]}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-tile bg-ink/10">
          <Icon className="h-8 w-8" strokeWidth={2.5} />
        </span>
        <p className="mt-6 text-[2.25rem] font-semibold leading-none tracking-[-0.02em] sm:text-[2.75rem]">
          {match ? (lang === 'ar' ? meta.ar : meta.fr) : tr('Produit non trouvé', 'المنتج غير موجود')}
        </p>
        <p dir="auto" className="mt-3 text-left text-lg rtl:text-right">
          {match
            ? result.identifiedProduct
            : result.noText
            ? tr('Aucun texte lisible sur la photo.', 'لا يوجد نص مقروء في الصورة.')
            : tr('Ce produit n’est pas dans les guides tunisiens.', 'هذا المنتج غير موجود في الأدلة التونسية.')}
        </p>
        {match && (
          <p className="mt-1 text-sm opacity-80">
            {tr(`Correspondance : ${result.confidencePercentage} %`, `نسبة التطابق: ${result.confidencePercentage}٪`)}
          </p>
        )}
      </div>

      {notes && (
        <div className="panel space-y-2 p-4 text-sm">
          <p dir="auto" className="text-left rtl:text-right">{notes}</p>
          <p className="text-ink-soft">{tr('Source :', 'المصدر:')} {match.source}</p>
        </div>
      )}

      {result.requiresFallback && result.candidates?.length > 0 && (
        <div className="panel p-4">
          <p className="font-medium">{match ? tr('Ce n’est pas le bon produit ?', 'ليس هذا المنتج؟') : tr('Produits proches', 'منتجات قريبة')}</p>
          <p className="text-sm text-ink-soft">{tr('Choisissez celui qui correspond pour voir sa fiche.', 'اختر المنتج المطابق لعرض بطاقته.')}</p>
          <ul className="mt-3 space-y-1.5">
            {result.candidates.map((cand) => (
              <li key={cand.candidateName}>
                <button
                  type="button"
                  onClick={() => onSearch?.(cand.candidateName)}
                  className="flex w-full items-center gap-3 rounded-lg border border-canvas-line bg-white px-3 py-2.5 text-start text-sm hover:border-ink"
                >
                  <StatusTile kind={cand.matchedProduct ? statusKind(cand.matchedProduct.status) : 'unknown'} size="xs" />
                  <span dir="auto">{cand.candidateName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!match && result.keywords?.length > 0 && (
        <div className="panel p-4">
          <p className="font-medium">{tr('Mots lus sur l’emballage', 'كلمات مقروءة على العلبة')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.keywords.map((k) => (
              <button key={k} type="button" className="chip" onClick={() => onSearch?.(k)}>
                <Search className="h-3.5 w-3.5" />
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={() => onSearch?.(match ? result.identifiedProduct : (result.keywords || []).join(' '))} className="btn-quiet w-full">
        <Search className="h-4 w-4" />
        {match ? tr('Voir tous les résultats pour ce produit', 'عرض كل النتائج لهذا المنتج') : tr('Chercher dans Open Food Facts', 'ابحث في Open Food Facts')}
      </button>
    </div>
  );
}

const INGREDIENT_VERDICTS = {
  CONTAINS_GLUTEN: { kind: 'unsafe', fr: 'Contient du gluten', ar: 'يحتوي على الغلوتين' },
  MAY_CONTAIN: { kind: 'warning', fr: 'Risque de gluten', ar: 'خطر الغلوتين' },
  GLUTEN_FREE: { kind: 'safe', fr: 'Sans gluten d’après les ingrédients', ar: 'بدون غلوتين حسب المكونات' },
  UNREADABLE: { kind: 'unknown', fr: 'Liste illisible', ar: 'القائمة غير مقروءة' },
};

function IngredientsVerdict({ result, lang }) {
  const tr = t(lang);
  const v = INGREDIENT_VERDICTS[result.verdict] || INGREDIENT_VERDICTS.UNREADABLE;
  const Icon = STATUS[v.kind].icon;
  const pct = Math.round(result.confidence * 100);
  const readable = result.verdict !== 'UNREADABLE';
  const explanation =
    (lang === 'ar' ? result.explanationAr || result.explanationFr : result.explanationFr) ||
    (!readable ? tr('Aucune liste d’ingrédients lisible sur la photo. Reprenez-la de plus près, bien éclairée.', 'لا توجد قائمة مكونات مقروءة. أعد التصوير عن قرب وبإضاءة جيدة.') : '');

  return (
    <div className="space-y-4">
      <div className={`animate-verdict rounded-xl p-6 ${VERDICT_BLOCK[v.kind]}`}>
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tile bg-ink/10">
            <Icon className="h-7 w-7" strokeWidth={2.5} />
          </span>
          {readable && (
            <span className="text-end">
              <span className="block text-[2rem] font-semibold leading-none tabular-nums">{pct} %</span>
              <span className="text-sm opacity-85">{tr('de confiance', 'نسبة الثقة')}</span>
            </span>
          )}
        </div>
        <p className="mt-5 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem]">{tr(v.fr, v.ar)}</p>
        {readable && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/15" aria-hidden="true">
            <div className="h-full origin-left animate-grow-x rounded-full bg-current opacity-70 rtl:origin-right" style={{ width: `${pct}%` }} />
          </div>
        )}
        {explanation && (
          <p dir="auto" className="mt-3 text-left text-[15px] leading-snug opacity-95 rtl:text-right">
            {explanation}
          </p>
        )}
      </div>

      {(result.glutenIngredients.length > 0 || result.traces.length > 0) && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          {result.glutenIngredients.map((g) => (
            <span key={`g-${g}`} dir="auto" className="rounded-md bg-status-unsafe/15 px-2 py-1 font-medium text-status-unsafe-ink">
              {g}
            </span>
          ))}
          {result.traces.map((g) => (
            <span key={`t-${g}`} dir="auto" className="rounded-md bg-status-warning/20 px-2 py-1 text-status-warning-ink">
              {tr('Traces :', 'آثار:')} {g}
            </span>
          ))}
        </div>
      )}

      <p className="flex gap-2 text-sm text-ink-soft">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-warning-ink" />
        <span>
          {readable && result.confidence < 0.8
            ? tr('Résultat incertain : relisez l’étiquette vous-même avant de consommer.', 'نتيجة غير مؤكدة: اقرأ الملصق بنفسك قبل الاستهلاك.')
            : tr('Estimation par IA, elle peut se tromper. Vérifiez toujours l’étiquette.', 'تقدير بالذكاء الاصطناعي وقد يخطئ. تحقق دائما من الملصق.')}
        </span>
      </p>

      {result.text?.trim() && (
        <details className="panel p-4 text-sm">
          <summary className="cursor-pointer font-medium">{tr('Texte lu sur la photo', 'النص المقروء من الصورة')}</summary>
          <p dir="auto" className="mt-2 whitespace-pre-line text-left leading-relaxed text-ink-soft rtl:text-right">
            {result.text.trim()}
          </p>
        </details>
      )}
    </div>
  );
}

function HowItWorks({ mode, lang }) {
  const tr = t(lang);
  const steps =
    mode === 'product'
      ? [
          tr('Photographiez la face avant : marque et nom du produit bien visibles.', 'صوّر الواجهة الأمامية مع إظهار العلامة واسم المنتج.'),
          tr('Le texte est lu directement sur votre appareil, sans envoyer la photo.', 'يُقرأ النص على جهازك مباشرة دون إرسال الصورة.'),
          tr('Le produit est cherché dans le guide de l’ATMC et les produits de l’association.', 'يُبحث عن المنتج في دليل الجمعية ومنتجاتها.'),
        ]
      : [
          tr('Photographiez toute la liste d’ingrédients, nette et bien éclairée.', 'صوّر قائمة المكونات كاملة وبوضوح وإضاءة جيدة.'),
          tr('Le texte est lu sur votre appareil, puis l’IA y repère blé, orge, seigle, avoine, malt et traces.', 'يُقرأ النص على جهازك ثم يكشف الذكاء الاصطناعي القمح والشعير والشوفان والمالط والآثار.'),
          tr('Vous obtenez un verdict avec sa probabilité. Vérifiez toujours l’étiquette.', 'تحصل على حكم مع احتماله. تحقق دائما من الملصق.'),
        ];
  return (
    <div key={mode} className="panel animate-fade-in p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{tr('Comment ça marche', 'كيف يعمل')}</h2>
      <ol className="mt-4 space-y-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-tile bg-ink text-xs font-medium text-canvas-paper">{i + 1}</span>
            <span className="text-[15px]">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-canvas-line pt-4 text-sm text-ink-soft">
        {tr(
          'Restez prudent avec les épices en vrac, les merguez et la farine de sorgho (drou3) moulue dans un moulin partagé : le risque de contamination y est élevé.',
          'احذر من التوابل السائبة والمرقاز ودقيق الدرع المطحون في مطاحن مشتركة: خطر التلوث مرتفع.'
        )}
      </p>
    </div>
  );
}
