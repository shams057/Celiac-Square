import React, { useState, useRef, useEffect } from 'react';
import { Camera, ImageUp, Video, RotateCcw, LoaderCircle, Search } from 'lucide-react';
import { identifyProductVision } from '../services/api';
import { t, statusKind, STATUS, StatusTile, PageHead, Notice } from './ui';

const VERDICT_BLOCK = {
  safe: 'bg-status-safe text-ink',
  warning: 'bg-status-warning text-ink',
  unsafe: 'bg-status-unsafe text-white',
  unknown: 'bg-canvas-sunk text-ink',
};

export default function VisionScanner({ onSwitchToSearch, lang }) {
  const tr = t(lang);
  const [liveCamera, setLiveCamera] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureInputRef = useRef(null);
  const galleryInputRef = useRef(null);

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

  const analyzeImageFile = async (file, url) => {
    setPreviewUrl(url || URL.createObjectURL(file));
    setLiveCamera(false);
    setLoading(true);
    setErrorMsg('');
    setResult(null);
    try {
      const data = await identifyProductVision(file);
      if (data?.success) setResult(data.data);
      else setErrorMsg(data?.message || 'failed');
    } catch (err) {
      console.error('Vision analysis error:', err);
      setErrorMsg(err.response?.data?.message || 'network');
    } finally {
      setLoading(false);
    }
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => blob && analyzeImageFile(new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })),
      'image/jpeg',
      0.9
    );
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(tr('Ce fichier n’est pas une image.', 'هذا الملف ليس صورة.'));
      return;
    }
    analyzeImageFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleReset = () => {
    setPreviewUrl('');
    setResult(null);
    setErrorMsg('');
  };

  return (
    <div className="space-y-8">
      <PageHead
        title={tr('Scanner un produit', 'امسح منتجا')}
        lede={tr(
          'Photographiez un emballage, un aliment en vrac ou un plat. Le produit reconnu est vérifié dans le guide de l’ATMC et dans Open Food Facts.',
          'صوّر علبة أو منتجا سائبا أو طبقا. يتم التحقق من المنتج في دليل الجمعية وفي Open Food Facts.'
        )}
      />

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
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 text-canvas-paper" role="status">
                    <LoaderCircle className="h-8 w-8 animate-spin" />
                    <p className="font-medium">{tr('Analyse de la photo…', 'جاري تحليل الصورة…')}</p>
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
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-[30ch] text-ink-soft">
                  {tr('Cadrez l’étiquette ou le produit de près, sous une bonne lumière.', 'قرّب الكاميرا من الملصق أو المنتج في إضاءة جيدة.')}
                </p>
                <p className="hidden text-sm text-ink-faint sm:block">{tr('Vous pouvez aussi déposer une image ici.', 'يمكنك أيضا سحب صورة إلى هنا.')}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {previewUrl ? (
              <button type="button" onClick={handleReset} className="btn-primary" disabled={loading}>
                <RotateCcw className="h-4 w-4" />
                {tr('Scanner un autre produit', 'امسح منتجا آخر')}
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
            <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          {cameraError && <Notice tone="warning">{cameraError}</Notice>}

          <p className="text-sm text-ink-soft">
            {tr('Pas de photo possible ?', 'لا يمكنك التصوير؟')}{' '}
            <button type="button" onClick={() => onSwitchToSearch?.('')} className="font-medium text-ink underline underline-offset-4">
              {tr('Rechercher le produit par son nom ou son code-barres', 'ابحث عن المنتج باسمه أو برمزه الشريطي')}
            </button>
          </p>
        </section>

        {/* Verdict */}
        <section aria-live="polite" aria-label={tr('Résultat', 'النتيجة')}>
          {errorMsg && !loading ? (
            <Notice tone="error" title={tr('L’analyse n’a pas abouti.', 'تعذر التحليل.')}>
              {errorMsg === 'network' || errorMsg === 'failed'
                ? tr('Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.', 'الخادم لا يستجيب. تحقق من الاتصال ثم أعد المحاولة.')
                : errorMsg}
            </Notice>
          ) : result ? (
            <Verdict result={result} lang={lang} onSearch={onSwitchToSearch} />
          ) : (
            <HowItWorks lang={lang} />
          )}
        </section>
      </div>
    </div>
  );
}

function Verdict({ result, lang, onSearch }) {
  const tr = t(lang);
  const kind = result.matchedProduct ? statusKind(result.glutenStatus) : 'unknown';
  const meta = STATUS[kind];
  const Icon = meta.icon;
  const match = result.matchedProduct;
  const notes = lang === 'ar' ? match?.notesAr || match?.notes : match?.notes;
  const sourceName =
    match?.source === 'Open Food Facts' ? 'Open Food Facts' : match ? tr('Guide de l’association tunisienne', 'دليل الجمعية التونسية') : null;

  return (
    <div className="space-y-4">
      <div className={`animate-verdict rounded-xl p-6 ${VERDICT_BLOCK[kind]}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-tile bg-ink/10">
          <Icon className="h-8 w-8" strokeWidth={2.5} />
        </span>
        <p className="mt-6 text-[2.25rem] font-semibold leading-none tracking-[-0.02em] sm:text-[2.75rem]">
          {lang === 'ar' ? meta.ar : meta.fr}
        </p>
        <p dir="auto" className="mt-3 text-lg text-left rtl:text-right">
          {result.identifiedProduct || tr('Produit non reconnu', 'منتج غير معروف')}
        </p>
        {result.identifiedProduct && (
          <p className="mt-1 text-sm opacity-80">
            {tr(`Reconnu avec ${result.confidencePercentage} % de confiance`, `نسبة الثقة ${result.confidencePercentage}٪`)}
          </p>
        )}
      </div>

      {!result.aiAvailable && (
        <Notice tone="warning" title={tr('Photo non analysée par l’IA', 'لم يتم تحليل الصورة بالذكاء الاصطناعي')}>
          {tr(
            'Le service de reconnaissance d’image est indisponible ou non configuré. Vérifiez le produit avec la recherche.',
            'خدمة التعرف على الصور غير متاحة أو غير مفعلة. تحقق من المنتج عبر البحث.'
          )}
        </Notice>
      )}

      {(notes || sourceName) && (
        <div className="panel space-y-2 p-4 text-sm">
          {notes && <p dir="auto" className="text-left rtl:text-right">{notes}</p>}
          {sourceName && <p className="text-ink-soft">{tr('Source :', 'المصدر:')} {sourceName}</p>}
        </div>
      )}

      {result.requiresFallback && result.candidates?.length > 0 && (
        <div className="panel p-4">
          <p className="font-medium">{tr('Ce n’est pas le bon produit ?', 'ليس هذا المنتج؟')}</p>
          <p className="text-sm text-ink-soft">{tr('Choisissez celui qui correspond pour voir sa fiche.', 'اختر المنتج المطابق لعرض بطاقته.')}</p>
          <ul className="mt-3 space-y-1.5">
            {result.candidates.map((cand) => (
              <li key={cand.candidateName}>
                <button
                  type="button"
                  onClick={() => onSearch?.(cand.candidateName)}
                  className="flex w-full items-center gap-3 rounded-lg border border-canvas-line bg-canvas-paper px-3 py-2.5 text-start text-sm hover:border-ink"
                >
                  <StatusTile kind={cand.matchedProduct ? statusKind(cand.matchedProduct.status) : 'unknown'} size="xs" />
                  <span dir="auto">{cand.candidateName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={() => onSearch?.(result.identifiedProduct || '')} className="btn-quiet w-full">
        <Search className="h-4 w-4" />
        {result.identifiedProduct ? tr('Voir tous les résultats pour ce produit', 'عرض كل النتائج لهذا المنتج') : tr('Chercher le produit par son nom', 'ابحث عن المنتج باسمه')}
      </button>
    </div>
  );
}

function HowItWorks({ lang }) {
  const tr = t(lang);
  const steps = [
    tr('Prenez le produit en photo, étiquette visible si possible.', 'صوّر المنتج مع إظهار الملصق إن أمكن.'),
    tr('L’image est analysée pour reconnaître le produit.', 'تُحلل الصورة للتعرف على المنتج.'),
    tr('Le produit est vérifié dans le guide de l’ATMC puis dans Open Food Facts.', 'يتم التحقق من المنتج في دليل الجمعية ثم في Open Food Facts.'),
  ];
  return (
    <div className="panel p-5 sm:p-6">
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
