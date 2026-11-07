import React, { useState, useRef, useEffect } from 'react';
import { Camera, ImageUp, Video, RotateCcw, Search, ScanText, ListChecks, TriangleAlert, ScanBarcode, History } from 'lucide-react';
import { identifyProductPhoto, matchProductText, analyzeIngredients, isAiUnavailable, fetchProductByBarcode } from '../services/api';
import { resizeImage } from '../services/images';
import { readText } from '../services/ocr';
import { detectBarcode, preloadBarcodeReader } from '../services/barcode';
import { addToHistory } from '../services/history';
import { navigate, pathFor } from '../services/router';
import { t, statusKind, STATUS, StatusTile, PageHead, Notice } from './ui';
import { SourceLine, SaveButton, ReportButton, productTargetType, productTargetId } from './community';

// Phone photos are often 4–12 MB: they are shrunk before reading, and again (1280 px JPEG) before upload
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

// Below this mean word confidence (0–100), the OCR text is mostly guesswork
const MIN_OCR_CONFIDENCE = 45;

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
    hintFr: 'Visez le code-barres, ou la face avant : le code-barres est lu en premier, sinon l’IA reconnaît la marque et le produit.',
    hintAr: 'وجّه الكاميرا نحو الرمز الشريطي أو الواجهة: يُقرأ الرمز الشريطي أولا، وإلا يتعرف الذكاء الاصطناعي على العلامة والمنتج.',
  },
  ingredients: {
    icon: ListChecks,
    fr: 'Analyser les ingrédients',
    ar: 'تحليل المكونات',
    hintFr: 'Photo de la liste d’ingrédients : l’IA la lit et indique si le produit contient du gluten.',
    hintAr: 'صورة قائمة المكونات: يحدد الذكاء الاصطناعي إن كان المنتج يحتوي على الغلوتين.',
  },
};

// What a scan result is worth in the history (status, label, detail)
const INGREDIENT_STATUS = { CONTAINS_GLUTEN: 'UNSAFE', MAY_CONTAIN: 'WARNING', GLUTEN_FREE: 'WARNING', UNREADABLE: 'UNKNOWN' };

const remember = (result, lang) => {
  const tr = t(lang);
  if (!result) return;
  const { mode, data } = result;
  if (mode === 'barcode') {
    const p = data.product;
    addToHistory({
      mode,
      label: p ? `${p.productNameFr}${p.brand && !/non spécifiée/.test(p.brand) ? ` — ${p.brand}` : ''}` : tr(`Code-barres ${data.barcode}`, `الرمز الشريطي ${data.barcode}`),
      status: p ? p.status : 'UNKNOWN',
      detail: p ? p.badgeText : tr('Introuvable', 'غير موجود'),
      query: data.barcode,
    });
  } else if (mode === 'product') {
    const label = data.productLabel || data.identifiedProduct;
    if (!label) return;
    addToHistory({ mode, label, status: data.matchedProduct ? (data.matchType === 'category' ? 'WARNING' : data.glutenStatus) : 'UNKNOWN', query: data.searchQuery || data.identifiedProduct || '' });
  } else if (mode === 'ingredients' && data.verdict !== 'UNREADABLE') {
    const text = (data.ingredientsText || '').trim().replace(/\s+/g, ' ');
    addToHistory({
      mode,
      label: text ? `${tr('Ingrédients', 'المكونات')} : ${text.slice(0, 70)}${text.length > 70 ? '…' : ''}` : tr('Liste d’ingrédients', 'قائمة المكونات'),
      status: INGREDIENT_STATUS[data.verdict] || 'UNKNOWN',
      detail: tr(INGREDIENT_VERDICTS[data.verdict]?.fr, INGREDIENT_VERDICTS[data.verdict]?.ar),
    });
  }
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

  // The barcode reader is loaded while the user frames the photo
  useEffect(() => {
    preloadBarcodeReader();
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

  // Live viewfinder in product mode: a barcode in view is read without pressing the shutter
  useEffect(() => {
    if (!liveCamera || !streamActive || mode !== 'product') return undefined;
    let stopped = false;
    let timer;
    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video || video.readyState < 2) {
        if (!stopped) timer = setTimeout(tick, 400);
        return;
      }
      const code = await detectBarcode(video);
      if (stopped) return;
      if (code) {
        captureSnapshot(code);
        return;
      }
      timer = setTimeout(tick, 350);
    };
    timer = setTimeout(tick, 400);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [liveCamera, streamActive, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // The photo as sent to the server: about 100–300 kB
  const toUpload = (image) => resizeImage(image, 1280, 0.85);

  // Fallback when the AI cannot answer: the text is read on the device (Tesseract) and matched by words
  const identifyByOcr = async (image) => {
    setBusy({ label: tr('Lecture de l’emballage sur l’appareil…', 'جاري قراءة العلبة على الجهاز…'), progress: 0 });
    const { text } = await readText(image, ({ phase, progress }) =>
      setBusy({
        label: phase === 'loading' ? tr('Préparation de la lecture…', 'جاري التحضير…') : tr('Lecture de l’emballage sur l’appareil…', 'جاري قراءة العلبة على الجهاز…'),
        progress,
      })
    );
    if (!text.trim()) return { identifiedProduct: null, noText: true, keywords: [], candidates: [], engine: 'OCR' };
    setBusy({ label: tr('Recherche dans le guide…', 'جاري البحث في الدليل…') });
    const res = await matchProductText(text);
    if (!res?.success) throw new Error(res?.message || 'failed');
    return res.data;
  };

  /**
   * Barcode lookup (the association's list, then Open Food Facts).
   * Returns a 'barcode' result, or null when the code is in neither (the photo then goes to the AI).
   */
  const lookUpBarcode = async (code) => {
    setBusy({ label: tr(`Code-barres ${code} : recherche…`, `الرمز الشريطي ${code}: جاري البحث…`) });
    try {
      const res = await fetchProductByBarcode(code);
      return res?.success && res.data ? { mode: 'barcode', data: { barcode: code, product: res.data } } : null;
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  };

  const identifyProduct = async (image, knownBarcode) => {
    // 1. A barcode is the most reliable way to name the product
    setBusy({ label: tr('Recherche d’un code-barres…', 'جاري البحث عن رمز شريطي…') });
    const code = knownBarcode || (await detectBarcode(image));
    if (code) {
      const found = await lookUpBarcode(code);
      if (found) return found;
    }
    // 2. Otherwise the AI recognises the package
    setBusy({ label: tr('Reconnaissance du produit…', 'جاري التعرف على المنتج…') });
    const unknownBarcode = code ? { unknownBarcode: code } : {};
    try {
      const res = await identifyProductPhoto(await toUpload(image));
      if (!res?.success) throw new Error(res?.message || 'failed');
      return { mode: 'product', data: { ...res.data, ...unknownBarcode } };
    } catch (err) {
      if (!isAiUnavailable(err) && err.response?.data?.code !== 'AI_NOT_CONFIGURED') throw err;
      return { mode: 'product', data: { ...(await identifyByOcr(image)), aiUnavailable: true, ...unknownBarcode } };
    }
  };

  const checkIngredientsByOcr = async (image) => {
    const { text, confidence } = await readText(image, ({ phase, progress }) =>
      setBusy({
        label: phase === 'loading' ? tr('Préparation de la lecture…', 'جاري التحضير…') : tr('Lecture des ingrédients sur l’appareil…', 'جاري قراءة المكونات على الجهاز…'),
        progress,
      })
    );
    // Nothing legible, or text too garbled to trust: no need to ask the AI, which could guess wrong
    if (text.trim().length < 8 || confidence < MIN_OCR_CONFIDENCE) {
      return { verdict: 'UNREADABLE', confidence: 0, glutenIngredients: [], traces: [], ingredientsText: text };
    }
    setBusy({ label: tr('Analyse des ingrédients…', 'جاري تحليل المكونات…') });
    const res = await analyzeIngredients({ text });
    if (!res?.success) throw new Error(res?.message || 'failed');
    return res.data;
  };

  const checkIngredients = async (image) => {
    setBusy({ label: tr('Lecture et analyse des ingrédients…', 'جاري قراءة المكونات وتحليلها…') });
    try {
      const res = await analyzeIngredients({ image: await toUpload(image) });
      if (!res?.success) throw new Error(res?.message || 'failed');
      return { mode: 'ingredients', data: res.data };
    } catch (err) {
      // The photo could not be analysed: read the list on the device and send only the text
      if (!isAiUnavailable(err)) throw err;
      return { mode: 'ingredients', data: { ...(await checkIngredientsByOcr(image)), aiUnavailable: true } };
    }
  };

  const analyze = async (file, scanMode = mode, knownBarcode = null) => {
    setLiveCamera(false);
    setErrorMsg('');
    setResult(null);
    try {
      const image = await shrinkImage(file);
      setPhoto(image);
      const next = scanMode === 'product' ? await identifyProduct(image, knownBarcode) : await checkIngredients(image);
      setResult(next);
      remember(next, lang);
    } catch (err) {
      console.error('Scan error:', err);
      const status = err.response?.status;
      setErrorMsg(status && status < 500 && err.response?.data?.message ? err.response.data.message : status ? tr('Le service d’analyse ne répond pas pour le moment. Réessayez dans un instant.', 'خدمة التحليل لا تستجيب حاليا. أعد المحاولة بعد لحظة.') : 'network');
    } finally {
      setBusy(null);
    }
  };

  const startWith = (file, knownBarcode = null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(tr('Ce fichier n’est pas une image.', 'هذا الملف ليس صورة.'));
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    analyze(file, mode, knownBarcode);
  };

  // knownBarcode: set when the live viewfinder already read a barcode in this frame
  const captureSnapshot = (knownBarcode = null) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => blob && startWith(new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' }), typeof knownBarcode === 'string' ? knownBarcode : null),
      'image/jpeg',
      0.9
    );
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

  // The barcode matched the wrong product: ask the AI about the same photo, ignoring the barcode
  const identifySamePhotoWithAi = async () => {
    if (!photo) return;
    setErrorMsg('');
    setResult(null);
    try {
      setBusy({ label: tr('Reconnaissance du produit…', 'جاري التعرف على المنتج…') });
      let next;
      try {
        const res = await identifyProductPhoto(await toUpload(photo));
        next = { mode: 'product', data: res.data };
      } catch (err) {
        if (!isAiUnavailable(err) && err.response?.data?.code !== 'AI_NOT_CONFIGURED') throw err;
        next = { mode: 'product', data: { ...(await identifyByOcr(photo)), aiUnavailable: true } };
      }
      setResult(next);
      remember(next, lang);
    } catch {
      setErrorMsg(tr('Le service d’analyse ne répond pas pour le moment. Réessayez dans un instant.', 'خدمة التحليل لا تستجيب حاليا. أعد المحاولة بعد لحظة.'));
    } finally {
      setBusy(null);
    }
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
                {mode === 'product' && streamActive && (
                  <p className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-ink/70 px-3 py-1 text-xs text-canvas-paper">
                    <ScanBarcode className="me-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
                    {tr('Code-barres lu automatiquement', 'يُقرأ الرمز الشريطي تلقائيا')}
                  </p>
                )}
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => captureSnapshot()}
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

          <a
            href={pathFor('saved')}
            onClick={(e) => {
              e.preventDefault();
              navigate(pathFor('saved'));
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            {tr('Mes derniers scans', 'آخر عمليات المسح')}
          </a>

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
          ) : result?.mode === 'barcode' ? (
            <BarcodeVerdict result={result.data} lang={lang} onSearch={onSwitchToSearch} onUseAi={identifySamePhotoWithAi} />
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

/** Shown when the photo could not be analysed by the AI and the device read the text instead */
function FallbackNotice({ lang }) {
  const tr = t(lang);
  return (
    <Notice tone="warning" title={tr('Analyse par IA indisponible pour le moment', 'التحليل بالذكاء الاصطناعي غير متاح حاليا')}>
      {tr(
        'Le texte a été lu sur votre appareil, ce qui est moins fiable sur les logos. Réessayez dans un instant pour un meilleur résultat.',
        'قُرئ النص على جهازك، وهذا أقل دقة مع الشعارات. أعد المحاولة بعد لحظة لنتيجة أفضل.'
      )}
    </Notice>
  );
}

/** Product found from its barcode: the association's list or Open Food Facts */
function BarcodeVerdict({ result, lang, onSearch, onUseAi }) {
  const tr = t(lang);
  const p = result.product;
  const kind = statusKind(p.status);
  const meta = STATUS[kind];
  const Icon = meta.icon;
  const isOff = p.source === 'Open Food Facts';
  const label = lang === 'ar' ? p.badgeTextAr || meta.ar : p.badgeText || meta.fr;
  const notes = lang === 'ar' ? p.notesAr || p.notes : p.notes;
  const name = lang === 'ar' && p.productNameAr ? p.productNameAr : p.productNameFr;

  return (
    <div className="space-y-4">
      <div className={`animate-verdict rounded-xl p-6 ${VERDICT_BLOCK[kind]}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-tile bg-ink/10">
          <Icon className="h-8 w-8" strokeWidth={2.5} />
        </span>
        <p className="mt-6 text-[2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">{label}</p>
        <p dir="auto" className="mt-3 text-left text-lg rtl:text-right">
          {name}
          {p.brand && !/non spécifiée/.test(p.brand) ? ` — ${p.brand}` : ''}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums opacity-80">
          <ScanBarcode className="h-4 w-4" aria-hidden="true" />
          {tr(`Code-barres ${result.barcode}`, `الرمز الشريطي ${result.barcode}`)}
        </p>
      </div>

      {isOff && (
        <Notice tone="warning" title={tr('Fiche Open Food Facts : vérifiez l’étiquette', 'بطاقة Open Food Facts: تحقق من الملصق')}>
          {tr(
            'Ces fiches sont remplies par des bénévoles et notre lecture des ingrédients est automatique. Seul l’emballage fait foi.',
            'يملأ هذه البطاقات متطوعون وقراءتنا للمكونات آلية. العلبة وحدها هي المرجع.'
          )}
        </Notice>
      )}

      {(notes || p.ingredientsText) && (
        <div className="panel space-y-2 p-4 text-sm">
          {notes && <p dir="auto" className="text-left rtl:text-right">{notes}</p>}
          {p.ingredientsText && (
            <details>
              <summary className="cursor-pointer font-medium">{tr('Ingrédients (Open Food Facts)', 'المكونات (Open Food Facts)')}</summary>
              <p dir="auto" className="mt-2 text-left leading-relaxed text-ink-soft rtl:text-right">{p.ingredientsText}</p>
            </details>
          )}
          <p className="text-xs text-ink-faint">
            <SourceLine item={p} lang={lang} />
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <SaveButton item={p} lang={lang} />
        <ReportButton target={{ type: productTargetType(p), id: productTargetId(p) || result.barcode, label: `${p.productNameFr} (${result.barcode})` }} lang={lang} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onUseAi} className="btn-quiet flex-1">
          <ScanText className="h-4 w-4" />
          {tr('Pas le bon produit ? Reconnaître la photo', 'ليس المنتج الصحيح؟ تعرّف على الصورة')}
        </button>
        <button type="button" onClick={() => onSearch?.(p.productNameFr)} className="btn-quiet flex-1">
          <Search className="h-4 w-4" />
          {tr('Chercher dans les guides', 'ابحث في الأدلة')}
        </button>
      </div>
    </div>
  );
}

function ProductVerdict({ result, lang, onSearch, onAnalyzeIngredients }) {
  const tr = t(lang);
  const match = result.matchedProduct;
  const kind = match ? statusKind(result.glutenStatus) : 'unknown';
  const meta = STATUS[kind];
  const Icon = meta.icon;
  const notes = lang === 'ar' ? match?.notesAr || match?.notes : match?.notes;
  const isAi = result.engine === 'AI';
  const category = result.matchType === 'category';
  // What the photo shows, as recognised by the AI (brand, name, variant)
  const recognised = result.productLabel;

  const headline = match
    ? category
      ? tr('À vérifier', 'للتثبت')
      : tr(meta.fr, meta.ar)
    : result.noProduct
    ? tr('Aucun produit reconnu', 'لم يُتعرف على أي منتج')
    : tr('Produit non trouvé', 'المنتج غير موجود');

  const detail = match
    ? category
      ? tr(
          `${recognised || 'Ce produit'} n’a pas de fiche à son nom. Règle du guide pour ce type de produit : « ${result.identifiedProduct} ».`,
          `${recognised || 'هذا المنتج'} ليست له بطاقة باسمه. قاعدة الدليل لهذا النوع: «${result.identifiedProduct}».`
        )
      : result.identifiedProduct
    : result.noText
    ? tr('Aucun texte lisible sur la photo.', 'لا يوجد نص مقروء في الصورة.')
    : result.noProduct
    ? tr('Photographiez la face avant d’un produit alimentaire, marque et nom bien visibles.', 'صوّر الواجهة الأمامية لمنتج غذائي مع إظهار العلامة والاسم.')
    : recognised
    ? tr(`${recognised} n’est pas dans les guides tunisiens.`, `${recognised} غير موجود في الأدلة التونسية.`)
    : tr('Ce produit n’est pas dans les guides tunisiens.', 'هذا المنتج غير موجود في الأدلة التونسية.');

  const searchQuery = result.searchQuery || (match ? result.identifiedProduct : (result.keywords || []).join(' '));

  return (
    <div className="space-y-4">
      {result.aiUnavailable && <FallbackNotice lang={lang} />}
      {result.unknownBarcode && (
        <Notice tone="info" title={tr(`Code-barres ${result.unknownBarcode} inconnu`, `الرمز الشريطي ${result.unknownBarcode} غير معروف`)}>
          {tr('Il n’est ni dans les guides tunisiens ni dans Open Food Facts : le produit a été reconnu sur la photo.', 'غير موجود في الأدلة التونسية ولا في Open Food Facts: تم التعرف على المنتج من الصورة.')}
        </Notice>
      )}
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
        <p className="mt-6 text-[2.25rem] font-semibold leading-none tracking-[-0.02em] sm:text-[2.75rem]">{headline}</p>
        <p dir="auto" className="mt-3 text-left text-lg rtl:text-right">{detail}</p>
        {isAi && recognised && match && !category && (
          <p dir="auto" className="mt-1 text-left text-sm opacity-80 rtl:text-right">
            {tr(`Produit reconnu : ${recognised}`, `المنتج المتعرَّف عليه: ${recognised}`)}
          </p>
        )}
        {(match || (isAi && recognised)) && result.confidencePercentage > 0 && (
          <p className="mt-1 text-sm opacity-80">
            {isAi
              ? tr(`Reconnaissance : ${result.confidencePercentage} %`, `نسبة التعرف: ${result.confidencePercentage}٪`)
              : tr(`Correspondance : ${result.confidencePercentage} %`, `نسبة التطابق: ${result.confidencePercentage}٪`)}
          </p>
        )}
      </div>

      {notes && (
        <div className="panel space-y-2 p-4 text-sm">
          <p dir="auto" className="text-left rtl:text-right">{notes}</p>
          <p className="text-xs text-ink-faint">
            <SourceLine item={match} lang={lang} />
          </p>
        </div>
      )}

      {match && !category && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <SaveButton item={match} lang={lang} />
          <ReportButton target={{ type: productTargetType(match), id: productTargetId(match), label: match.productNameFr }} lang={lang} />
        </div>
      )}
      {(!match || category) && (recognised || result.identifiedProduct) && (
        <ReportButton
          target={{ type: 'SCAN', label: `${tr('Scan produit', 'مسح منتج')} : ${recognised || result.identifiedProduct}` }}
          lang={lang}
        />
      )}

      {result.requiresFallback && result.candidates?.length > 0 && (
        <div className="panel p-4">
          <p className="font-medium">{match ? tr('Ce n’est pas la bonne fiche ?', 'ليست هذه البطاقة؟') : tr('Fiches proches dans le guide', 'بطاقات قريبة في الدليل')}</p>
          <p className="text-sm text-ink-soft">{tr('Choisissez celle qui correspond pour voir le détail.', 'اختر البطاقة المطابقة لعرض التفاصيل.')}</p>
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

      {!match && !isAi && result.keywords?.length > 0 && (
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

      {searchQuery && !result.noProduct && (
        <button type="button" onClick={() => onSearch?.(searchQuery)} className="btn-quiet w-full">
          <Search className="h-4 w-4" />
          {match && !category
            ? tr('Voir tous les résultats pour ce produit', 'عرض كل النتائج لهذا المنتج')
            : tr(`Chercher « ${searchQuery} » dans Open Food Facts`, `ابحث عن «${searchQuery}» في Open Food Facts`)}
        </button>
      )}
    </div>
  );
}

const INGREDIENT_VERDICTS = {
  CONTAINS_GLUTEN: { kind: 'unsafe', fr: 'Contient du gluten', ar: 'يحتوي على الغلوتين' },
  MAY_CONTAIN: { kind: 'warning', fr: 'Risque de gluten', ar: 'خطر الغلوتين' },
  // Never green: an ingredients list read from a photo cannot vouch for a product (traces, misread words,
  // recipe changes). Green is kept for the guides' own verdicts.
  GLUTEN_FREE: { kind: 'warning', fr: 'Gluten non détecté', ar: 'لم يُكتشف الغلوتين' },
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
      {result.aiUnavailable && <FallbackNotice lang={lang} />}
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

      {result.adjusted && (
        <Notice tone="warning" title={tr('Verdict rendu plus strict par nos règles', 'حكم أشد بفضل قواعدنا')}>
          {tr(
            'L’IA était plus confiante, mais notre vérification de la liste a trouvé un ingrédient à risque.',
            'كان الذكاء الاصطناعي أكثر تفاؤلا، لكن مراجعتنا للقائمة وجدت مكوّنا محفوفا بالخطر.'
          )}
        </Notice>
      )}

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

      {result.verdict === 'GLUTEN_FREE' && (
        <p className="text-sm text-ink-soft">
          {tr(
            'Aucun ingrédient contenant du gluten n’a été trouvé dans la liste. Ce n’est pas une certification : vérifiez la mention « sans gluten » et l’absence de traces sur l’emballage.',
            'لم يُعثر على أي مكوّن يحتوي على الغلوتين في القائمة. هذا ليس شهادة: تحقق من عبارة «بدون غلوتين» وغياب الآثار على العلبة.'
          )}
        </p>
      )}

      {readable && (
        <ReportButton
          target={{ type: 'SCAN', label: `${tr('Analyse des ingrédients', 'تحليل المكونات')} : ${tr(v.fr, v.ar)}${result.ingredientsText ? ` — ${result.ingredientsText.trim().slice(0, 200)}` : ''}` }}
          lang={lang}
        />
      )}

      {result.ingredientsText?.trim() && (
        <details className="panel p-4 text-sm">
          <summary className="cursor-pointer font-medium">{tr('Ingrédients lus sur la photo', 'المكونات المقروءة من الصورة')}</summary>
          <p dir="auto" className="mt-2 whitespace-pre-line text-left leading-relaxed text-ink-soft rtl:text-right">
            {result.ingredientsText.trim()}
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
          tr('Photographiez le code-barres ou la face avant. Un code-barres est cherché d’abord dans les fiches de l’association, puis dans Open Food Facts.', 'صوّر الرمز الشريطي أو الواجهة. يُبحث عن الرمز أولا في بطاقات الجمعية ثم في Open Food Facts.'),
          tr('Sans code-barres connu, la photo, réduite, est envoyée à une IA (Gemma, via Ollama Cloud) qui reconnaît la marque et le produit, même sur un logo.', 'إن لم يُعرف الرمز الشريطي، تُرسل الصورة مصغّرة إلى ذكاء اصطناعي (Gemma عبر Ollama Cloud) يتعرف على العلامة والمنتج حتى من الشعار.'),
          tr('L’IA désigne la fiche du guide de l’ATMC ou de l’association qui le concerne ; le statut vient toujours du guide.', 'يحدد الذكاء الاصطناعي بطاقة الدليل المعنية، والحالة تأتي دائما من الدليل.'),
        ]
      : [
          tr('Photographiez toute la liste d’ingrédients, nette et bien éclairée.', 'صوّر قائمة المكونات كاملة وبوضوح وإضاءة جيدة.'),
          tr('La photo, réduite, est envoyée à une IA (Gemma, via Ollama Cloud) qui lit la liste et y repère blé, orge, seigle, avoine, malt et traces. Nos propres règles relisent la liste : elles peuvent rendre le verdict plus strict, jamais plus permissif.', 'تُرسل الصورة مصغّرة إلى ذكاء اصطناعي (Gemma عبر Ollama Cloud) يقرأ القائمة ويكشف القمح والشعير والشوفان والمالط والآثار. ثم تراجعها قواعدنا: قد تجعل الحكم أشد، ولا تجعله أبدا أكثر تساهلا.'),
          tr('Vous obtenez un verdict avec sa probabilité. L’IA ne dit jamais « sans gluten » : au mieux « gluten non détecté ». Vérifiez toujours l’étiquette.', 'تحصل على حكم مع احتماله. لا يقول الذكاء الاصطناعي أبدا «بدون غلوتين»، بل في أحسن الأحوال «لم يُكتشف الغلوتين». تحقق دائما من الملصق.'),
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
