/**
 * Barcode reading in the browser. Phones with the native Barcode Detection API (Chrome on Android)
 * use it; elsewhere the ZXing WebAssembly reader is loaded on first use, served by the site itself
 * (the CSP and offline use rule out a CDN). barcode-detector and zxing-wasm are pinned together in package.json:
 * the WASM file must be the exact version the polyfill was built against (barcode-detector 3.2.2 -> zxing-wasm 3.1.3),
 * or reading fails with "Failed to allocate … in WASM memory".
 */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

let detectorPromise = null;

const createDetector = async () => {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new window.BarcodeDetector({ formats });
    } catch {
      // fall back to the WebAssembly reader
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
  return new BarcodeDetector({ formats: FORMATS });
};

const getDetector = () => {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
};

/** Start loading the reader early (e.g. when the scanner opens), without waiting for it */
export const preloadBarcodeReader = () => {
  getDetector().catch(() => {});
};

/**
 * The first product barcode (8 to 14 digits) found in an image, video frame or file, or null.
 * Never throws: a reader that cannot load just means "no barcode".
 */
export const detectBarcode = async (source) => {
  try {
    const detector = await getDetector();
    const image = source instanceof Blob ? await createImageBitmap(source) : source;
    const codes = await detector.detect(image);
    if (image !== source && typeof image.close === 'function') image.close();
    const code = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
    return code ? code.rawValue : null;
  } catch (err) {
    console.warn('[Barcode] reader unavailable:', err?.message || err);
    return null;
  }
};
