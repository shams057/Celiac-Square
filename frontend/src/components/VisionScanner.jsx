import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Eye,
  SlidersHorizontal,
  Info,
  Layers,
  Search,
} from 'lucide-react';
import { identifyProductVision } from '../services/api';

// Sample Tunisian food tests with ready-to-test mock images
const SAMPLE_TESTS = [
  {
    name: 'Harissa Le Phare du Cap Bon',
    nameAr: 'هريسة كاب بون',
    category: 'Condiment',
    status: 'SAFE',
    badge: 'Sans Gluten (ATC)',
    filename: 'harissa_cap_bon.jpg',
    color: '#8BA850',
    description: 'Boîte de conserve traditionnelle au piment rouge et ail',
  },
  {
    name: 'Feuilles de Brik Traditionnelles (Malsouka)',
    nameAr: 'ورق ملسوقة بالفرينة',
    category: 'Pâtisserie',
    status: 'UNSAFE',
    badge: 'Contient du Gluten',
    filename: 'brik_malsouka.jpg',
    color: '#D9534F',
    description: 'Malsouka artisanale à la farine de blé et semoule',
  },
  {
    name: 'Couscous de Blé Dur Traditionnel',
    nameAr: 'كسكسي سميد قمح صلب',
    category: 'Céréale',
    status: 'UNSAFE',
    badge: 'Contient du Gluten',
    filename: 'couscous_smid.jpg',
    color: '#D9534F',
    description: 'Semoule de blé dur riche en gluten',
  },
  {
    name: 'Barilla Senza Glutine Spaghetti',
    nameAr: 'مقرونة باريلا بدون غلوتين',
    category: 'Pâtes',
    status: 'SAFE',
    badge: 'Certifié Sans Gluten',
    filename: 'barilla_gluten_free.jpg',
    color: '#8BA850',
    description: 'Pâtes au maïs et riz certifiées épi barré',
  },
  {
    name: 'Huile d’Olive Vierge Extra Tunisienne',
    nameAr: 'زيت زيتون بكر ممتاز',
    category: 'Huile',
    status: 'SAFE',
    badge: 'Naturellement Sans Gluten',
    filename: 'olive_oil_zitouna.jpg',
    color: '#8BA850',
    description: 'Huile d’olive pressée 100% pure',
  },
  {
    name: 'Merguez Traditionnelle Artisanale',
    nameAr: 'مرقاز تونسي عند القصاب',
    category: 'Boucherie',
    status: 'CROSS_CONTAMINATION_RISK',
    badge: 'Risque Contamination Croisée',
    filename: 'merguez_boucherie.jpg',
    color: '#FF8A41',
    description: 'Farce avec risque de chapelure ou épices non triées',
  },
];

export default function VisionScanner({ onSwitchToSearch, lang }) {
  const [mode, setMode] = useState('camera'); // 'camera' | 'upload'
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize camera stream
  const startCamera = async () => {
    setCameraError('');
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err) {
      console.warn('Camera access error:', err.message);
      setCameraError(
        lang === 'fr'
          ? "Accès caméra non disponible ou refusé. Vous pouvez téléverser une image ou tester l'un de nos exemples tunisiens ci-dessous."
          : 'تعذر تشغيل الكاميرا. يمكنك تحميل صورة أو تجربة أحد النماذج التونسية أدناه.'
      );
      setStreamActive(false);
      setMode('upload');
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mode]);

  // Capture frame from camera
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedImage(file);
        setPreviewUrl(URL.createObjectURL(blob));
        analyzeImageFile(file);
      }
    }, 'image/jpeg', 0.9);
  };

  // Handle uploaded file
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      analyzeImageFile(file);
    }
  };

  // Test with predefined sample item
  const handleTestSample = (sample) => {
    // Generate an image canvas representing the sample food item
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = sample.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative graphics
    ctx.fillStyle = '#FAF8F2';
    ctx.roundRect(30, 30, 540, 340, 16);
    ctx.fill();

    ctx.fillStyle = '#756452';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('CELIAC SQUARE TUNISIA', 50, 70);

    ctx.fillStyle = '#3f352c';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(sample.name, 50, 140);

    ctx.fillStyle = '#8BA850';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(sample.nameAr, 50, 180);

    ctx.fillStyle = '#756452';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Catégorie : ${sample.category}`, 50, 230);
    ctx.fillText(sample.description, 50, 260);

    ctx.fillStyle = sample.color;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Statut ATC : ${sample.badge}`, 50, 310);

    canvas.toBlob((blob) => {
      const file = new File([blob], sample.filename, { type: 'image/jpeg' });
      setSelectedImage(file);
      setPreviewUrl(canvas.toDataURL());
      analyzeImageFile(file);
    }, 'image/jpeg', 0.9);
  };

  // Send image to backend
  const analyzeImageFile = async (file) => {
    setLoading(true);
    setErrorMsg('');
    setResult(null);

    try {
      const data = await identifyProductVision(file);
      if (data && data.success) {
        setResult(data.data);
      } else {
        setErrorMsg(data.message || 'Échec de l’identification.');
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
      setErrorMsg(
        err.response?.data?.message ||
          'Erreur lors de la communication avec le moteur d’intelligence visuelle.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle manual selection from candidate fallback list
  const handleSelectCandidate = (candidateName) => {
    if (onSwitchToSearch) {
      onSwitchToSearch(candidateName);
    }
  };

  // Reset scanner
  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    setResult(null);
    setErrorMsg('');
    if (mode === 'camera') {
      startCamera();
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-canvas-card via-[#FAF8F2] to-canvas/60 rounded-3xl p-6 sm:p-8 border border-canvas-border shadow-sm">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 text-accent-dark text-xs font-extrabold mb-3">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>MOTEUR VISION MULTIMODAL POUR LE MARCHÉ TUNISIEN</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-secondary-dark tracking-tight leading-tight">
            Scanner Visuel de Produits Sans Gluten
          </h1>
          <p className="mt-2 text-base text-secondary/90 leading-relaxed">
            Photographiez directement un aliment, un plat traditionnel (brik, couscous, bsissa) ou un produit d'épicerie. Notre système identifie visuellement l'article et vérifie instantanément son innocuité auprès de l'<strong>Association Tunisienne de la Cœliaque</strong> et d'<strong>Open Food Facts</strong>.
          </p>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Visual Capture / Viewfinder (7 cols) */}
        <div className="lg:col-span-7 bg-[#FAF8F2] rounded-3xl p-6 border border-canvas-border shadow-sm">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between pb-4 border-b border-canvas-border/60 mb-5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMode('camera');
                  handleReset();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  mode === 'camera'
                    ? 'bg-accent text-white shadow'
                    : 'text-secondary-dark hover:bg-canvas/50'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Caméra Directe</span>
              </button>

              <button
                onClick={() => {
                  setMode('upload');
                  handleReset();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  mode === 'upload'
                    ? 'bg-accent text-white shadow'
                    : 'text-secondary-dark hover:bg-canvas/50'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Téléverser Photo</span>
              </button>
            </div>

            {previewUrl && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-accent transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>

          {/* Viewfinder / Capture Box */}
          <div className="relative aspect-video sm:aspect-[4/3] bg-secondary-dark/10 rounded-2xl overflow-hidden border-2 border-dashed border-canvas-border flex items-center justify-center">
            {/* Case 1: Image Captured / Uploaded Preview */}
            {previewUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={previewUrl}
                  alt="Aperçu produit analysé"
                  className="w-full h-full object-contain bg-black/5"
                />
                {loading && (
                  <div className="absolute inset-0 bg-secondary-dark/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
                    {/* Laser Scanner Animation */}
                    <div className="w-full max-w-xs h-1 bg-accent shadow-[0_0_15px_#FF8A41] animate-bounce mb-6"></div>
                    <RefreshCw className="w-10 h-10 animate-spin text-accent mb-3" />
                    <p className="font-bold text-lg">Analyse visuelle en cours...</p>
                    <p className="text-xs text-white/80 mt-1 max-w-sm">
                      Interrogation du modèle de vision et croisement avec le Guide Officiel de l’Association Tunisienne de la Cœliaque.
                    </p>
                  </div>
                )}
              </div>
            ) : mode === 'camera' ? (
              /* Case 2: Live Camera Viewfinder */
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Target Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                  <div className="w-64 h-64 border-2 border-white/60 rounded-3xl relative">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-accent rounded-tl-xl"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-accent rounded-tr-xl"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-accent rounded-bl-xl"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-accent rounded-br-xl"></div>
                  </div>
                </div>

                {/* Shutter Button Overlay */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                  <button
                    onClick={captureSnapshot}
                    disabled={!streamActive}
                    className="w-16 h-16 rounded-full bg-white p-1 shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    title="Prendre la photo"
                  >
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white">
                      <Camera className="w-6 h-6" />
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* Case 3: File Upload Drop Area */
              <div
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-canvas/30 transition-colors w-full h-full"
              >
                <div className="w-16 h-16 rounded-2xl bg-canvas flex items-center justify-center text-accent mb-4 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-secondary-dark text-base">
                  Cliquez ou glissez une photo ici
                </h3>
                <p className="text-xs text-secondary mt-1">
                  Formats JPEG, PNG, WEBP acceptés (Max 10 Mo)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>

          {/* Camera Error Alert */}
          {cameraError && (
            <div className="mt-4 p-4 rounded-2xl bg-accent/10 border border-accent/30 text-secondary-dark text-xs flex items-start gap-3">
              <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-accent-dark">Note sur la caméra :</p>
                <p className="mt-0.5 text-secondary/90">{cameraError}</p>
              </div>
            </div>
          )}

          {/* 1-Click Interactive Test Samples */}
          <div className="mt-6 pt-5 border-t border-canvas-border/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                🧪 Tester avec 1 Clic (Échantillons Tunisiens) :
              </span>
              <span className="text-[11px] text-accent font-semibold">Prêt à tester</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SAMPLE_TESTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTestSample(sample)}
                  className="text-left p-2.5 rounded-xl border border-canvas-border/70 hover:border-accent hover:bg-white transition-all group flex flex-col justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-secondary-dark group-hover:text-accent line-clamp-1">
                      {sample.name}
                    </p>
                    <p className="text-[11px] text-secondary/70 font-arabic line-clamp-1">
                      {sample.nameAr}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${sample.color}20`,
                        color: sample.color === '#8BA850' ? '#5a732a' : sample.color === '#FF8A41' ? '#c45a16' : '#a92a27',
                      }}
                    >
                      {sample.status === 'SAFE' ? 'Sans Gluten' : sample.status === 'UNSAFE' ? 'Contient Gluten' : 'Risque'}
                    </span>
                    <ArrowRight className="w-3 h-3 text-secondary/40 group-hover:text-accent group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Identification & Safety Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {result ? (
            <div className="bg-[#FAF8F2] rounded-3xl p-6 border border-canvas-border shadow-sm space-y-5 animate-fadeIn">
              {/* Product Header */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary/70">
                    Produit Identifié par Vision
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-canvas text-secondary-dark">
                    Confiance : {result.confidencePercentage}%
                  </span>
                </div>
                <h2 className="text-2xl font-black text-secondary-dark tracking-tight">
                  {result.identifiedProduct}
                </h2>
                {result.matchedProduct?.productNameAr && (
                  <p className="text-lg font-bold text-primary-dark font-arabic mt-0.5">
                    {result.matchedProduct.productNameAr}
                  </p>
                )}
              </div>

              {/* Confidence Progress Bar */}
              <div>
                <div className="w-full bg-canvas rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.confidence >= 0.7 ? 'bg-primary' : 'bg-accent'
                    }`}
                    style={{ width: `${result.confidencePercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Status Badge & Safety Diagnosis */}
              <div
                className={`p-5 rounded-2xl border-2 flex items-start gap-4 ${
                  result.glutenStatus === 'SAFE'
                    ? 'bg-primary/10 border-primary/40 text-primary-dark'
                    : result.glutenStatus === 'UNSAFE'
                    ? 'bg-status-unsafe/10 border-status-unsafe/40 text-status-unsafe'
                    : 'bg-accent/10 border-accent/40 text-accent-dark'
                }`}
              >
                {result.glutenStatus === 'SAFE' ? (
                  <CheckCircle2 className="w-8 h-8 text-primary shrink-0 mt-0.5" />
                ) : result.glutenStatus === 'UNSAFE' ? (
                  <XCircle className="w-8 h-8 text-status-unsafe shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-accent shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-lg font-black tracking-tight">{result.safetyBadge}</h4>
                  <p className="text-sm font-arabic font-bold mt-0.5 opacity-90">
                    {result.safetyBadgeAr}
                  </p>
                  <p className="text-xs text-secondary-dark mt-2 leading-relaxed">
                    {result.matchedProduct?.notes ||
                      "Article analysé. Vérifiez l'étiquetage physique et l'absence de blé, orge ou seigle."}
                  </p>
                  {result.matchedProduct?.notesAr && (
                    <p className="text-xs text-secondary-dark/80 font-arabic mt-1 leading-relaxed">
                      {result.matchedProduct.notesAr}
                    </p>
                  )}
                </div>
              </div>

              {/* Source Attribution */}
              <div className="bg-canvas/40 p-4 rounded-xl border border-canvas-border/50 text-xs text-secondary flex items-start gap-3">
                <Layers className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-secondary-dark">Attribution Officielle : </span>
                  <span>
                    {result.matchedProduct?.source === 'Association Tunisienne de la Cœliaque'
                      ? 'Guide Officiel de l’Association Tunisienne de la Cœliaque (ATC)'
                      : result.matchedProduct?.officialDocReference ||
                        'Base Internationale Open Food Facts'}
                  </span>
                </div>
              </div>

              {/* Visual Descriptors Tags */}
              {result.visualDescriptors && result.visualDescriptors.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                    Indices Visuels Détectés :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.visualDescriptors.map((desc, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-canvas/60 text-secondary-dark px-2.5 py-1 rounded-lg border border-canvas-border/60"
                      >
                        {desc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback Mechanism (Section 4, Feature 3: If confidence < 70%) */}
              {result.requiresFallback && (
                <div className="p-4 rounded-2xl bg-accent/10 border border-accent/40 space-y-3">
                  <div className="flex items-center gap-2 text-accent-dark">
                    <HelpCircle className="w-5 h-5 text-accent shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      Précision &lt; 70% : Choisissez parmi les candidats visuels
                    </span>
                  </div>
                  <p className="text-xs text-secondary-dark leading-relaxed">
                    L'image présente une légère ambiguïté. Veuillez sélectionner le produit correspondant pour charger sa fiche de sécurité garantie :
                  </p>
                  <div className="space-y-1.5">
                    {result.candidates && result.candidates.length > 0 ? (
                      result.candidates.map((cand, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectCandidate(cand.candidateName)}
                          className="w-full text-left p-2.5 rounded-xl bg-white border border-accent/30 hover:border-accent hover:bg-accent/5 transition-colors flex items-center justify-between text-xs font-bold text-secondary-dark"
                        >
                          <span>{cand.candidateName}</span>
                          <span className="text-[10px] text-accent flex items-center gap-1 font-semibold">
                            Consulter la fiche <ArrowRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))
                    ) : (
                      <button
                        onClick={() => handleSelectCandidate(result.identifiedProduct)}
                        className="w-full text-left p-2.5 rounded-xl bg-white border border-accent/30 hover:border-accent text-xs font-bold text-secondary-dark"
                      >
                        Rechercher manuellement "{result.identifiedProduct}"
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => handleSelectCandidate(result.identifiedProduct)}
                className="w-full py-3 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-secondary-dark transition-colors flex items-center justify-center gap-2 shadow"
              >
                <Search className="w-4 h-4" />
                <span>Rechercher ce produit dans la base complète</span>
              </button>
            </div>
          ) : (
            /* Empty State / How it works Guide */
            <div className="bg-[#FAF8F2] rounded-3xl p-6 border border-canvas-border shadow-sm space-y-4">
              <h3 className="font-extrabold text-secondary-dark text-lg">
                Comment fonctionne l'identification visuelle ?
              </h3>

              <div className="space-y-3 text-xs text-secondary leading-relaxed">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-canvas/30 border border-canvas-border/50">
                  <div className="w-6 h-6 rounded-full bg-accent text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <p>
                    <strong>Capture Instantanée :</strong> Visez avec votre caméra ou déposez la photo d'un produit alimentaire tunisien (vrac, épices, emballé, ou pâtisserie).
                  </p>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-canvas/30 border border-canvas-border/50">
                  <div className="w-6 h-6 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <p>
                    <strong>Extraction Visuelle :</strong> L'algorithme extrait les descripteurs (texture, emballage, étiquette) et propose le nom du produit.
                  </p>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-canvas/30 border border-canvas-border/50">
                  <div className="w-6 h-6 rounded-full bg-secondary text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <p>
                    <strong>Croisement Double Couche :</strong> Interrogation du Guide Officiel de l’Association Tunisienne de la Cœliaque (ATC) et de la base Open Food Facts avec affichage clair du risque d'allergène.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary-dark">
                <p className="font-bold">🌿 Recommandation Santé :</p>
                <p className="mt-1 leading-relaxed">
                  Pour les personnes atteintes de la maladie cœliaque, une vigilance particulière s'impose pour les épices en vrac, les merguez traditionnelles et les farines de sorgho (drou3) moulues dans les moulins partagés.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-status-unsafe/10 border border-status-unsafe/30 text-status-unsafe text-xs flex items-center gap-3">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
