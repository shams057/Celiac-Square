/**
 * Text recognition in the browser (Tesseract.js): free, no API key, and the photo never leaves the device.
 * The engine and the French + Arabic language data (cached by the browser afterwards) are loaded on demand,
 * once, and the worker is reused for every scan. Tunisian packaging is often printed in both languages.
 */
let workerPromise = null;
let listener = null;

const getWorker = () => {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker(['fra', 'ara'], 1, { logger: (m) => listener?.(m) }))
      .catch((err) => {
        workerPromise = null; // allow a retry, e.g. after a network error
        throw err;
      });
  }
  return workerPromise;
};

/** Start downloading the engine early, e.g. when the scanner opens */
export const preloadOcr = () => {
  getWorker().catch(() => {});
};

/**
 * Read the text on an image. onProgress receives { phase: 'loading' | 'reading', progress: 0..1 }.
 * Returns { text, confidence } where confidence (0–100) is Tesseract's mean word confidence.
 */
export const readText = async (image, onProgress) => {
  listener = (m) => {
    if (!onProgress || typeof m.progress !== 'number') return;
    onProgress({ phase: m.status === 'recognizing text' ? 'reading' : 'loading', progress: m.progress });
  };
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return { text: data.text || '', confidence: Number.isFinite(data.confidence) ? data.confidence : 0 };
  } finally {
    listener = null;
  }
};
