import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// Override with GEMINI_MODEL in .env
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
// Stay under the frontend's 30s request timeout so the fallback can still answer
const GEMINI_TIMEOUT_MS = 20000;

/**
 * Knowledge base of common Tunisian food items for intelligent fallback & heuristics
 */
const TUNISIAN_FOOD_PATTERNS = [
  {
    keywords: ['brik', 'malsouka', 'melsouka', 'feuille', 'borek'],
    name: 'Feuilles de Brik Traditionnelles (Malsouka)',
    confidence: 0.88,
    descriptors: ['thin circular pastry sheets', 'crispy pastry base', 'fried pastry wrapper'],
    candidates: ['Feuilles de Brik Traditionnelles', 'Malsouka Sans Gluten (Riz)', 'Feuille de filo'],
  },
  {
    keywords: ['couscous', 'smid', 'semoule', 'couscousi', 'kouskous'],
    name: 'Couscous de Blé Dur Traditionnel',
    confidence: 0.91,
    descriptors: ['fine yellow grains', 'durum wheat semolina', 'steamed semolina'],
    candidates: ['Couscous de Blé Dur', 'Couscous de Maïs Sans Gluten', 'Semoule d’orge (Malthouth)'],
  },
  {
    keywords: ['harissa', 'cap bon', 'piment', 'chili'],
    name: 'Harissa Le Phare du Cap Bon',
    confidence: 0.94,
    descriptors: ['red chili paste', 'tunisian spice tin', 'garlic and caraway paste'],
    candidates: ['Harissa Le Phare du Cap Bon', 'Harissa Berbère artisanale', 'Pâte de piment rouge'],
  },
  {
    keywords: ['oil', 'olive', 'zit', 'zitouna', 'chemlali'],
    name: 'Huile d’Olive Vierge Extra Tunisienne',
    confidence: 0.92,
    descriptors: ['golden-green oil bottle', 'pressed olive oil', 'glass container'],
    candidates: ['Huile d’Olive Vierge Extra', 'Huile de tournesol', 'Huile de maïs'],
  },
  {
    keywords: ['barilla', 'gluten free', 'senza glutine', 'spaghetti', 'penne'],
    name: 'Barilla Senza Glutine (Pâtes Sans Gluten)',
    confidence: 0.95,
    descriptors: ['blue packaging', 'certified gluten free emblem', 'corn and rice pasta'],
    candidates: ['Barilla Senza Glutine', 'Pâtes de blé standard', 'Pâtes Randa sans gluten'],
  },
  {
    keywords: ['schar', 'schär', 'pan blanco', 'pain sans gluten', 'crackers'],
    name: 'Schär Pain / Biscuits Sans Gluten',
    confidence: 0.96,
    descriptors: ['yellow and red logo', 'certified crossed grain logo', 'packaged dietary loaf'],
    candidates: ['Schär Pain Sans Gluten', 'Pain complet artisanal', 'Baguette tunisienne'],
  },
  {
    keywords: ['makroudh', 'makroudh kairouan', 'dates', 'dattes'],
    name: 'Makroudh Traditionnel de Kairouan',
    confidence: 0.85,
    descriptors: ['semolina diamond cut', 'date paste filling', 'honey and sesame glaze'],
    candidates: ['Makroudh Traditionnel au Blé', 'Makroudh Sans Gluten à la farine de riz', 'Baklawa'],
  },
  {
    keywords: ['merguez', 'sausage', 'artisanal meat'],
    name: 'Merguez Traditionnelle Tunisienne',
    confidence: 0.82,
    descriptors: ['spiced red lamb sausage', 'caraway and chili meat casing'],
    candidates: ['Merguez Artisanale avec épices', 'Saucisse de bœuf certifiée', 'Viande hachée pure'],
  },
  {
    keywords: ['zgougou', 'pin alep', 'assida'],
    name: 'Graines de Zgougou (Pin d’Alep)',
    confidence: 0.86,
    descriptors: ['dark gray fine seeds', 'tunisian mawlid assida base'],
    candidates: ['Graines de Zgougou pures', 'Crème Assida préparée', 'Farine de sorgho (Drou3)'],
  },
  {
    keywords: ['delice', 'danone', 'yaourt', 'lait', 'dairy'],
    name: 'Délice Danone Yaourt Nature',
    confidence: 0.89,
    descriptors: ['dairy cup', 'white fermented milk product', 'blue seal'],
    candidates: ['Délice Danone Yaourt Nature', 'Yaourt aux céréales/biscuit', 'Crème dessert'],
  },
];

// Capped below the 70% threshold so the UI always asks the user to confirm
const FILENAME_MATCH_CONFIDENCE = 0.5;

/**
 * Fallback used when no vision AI is available. It does NOT analyse the image pixels:
 * it can only suggest candidates when the file name contains a known keyword
 * (e.g. the sample buttons). Otherwise it reports the product as unidentified.
 */
export const identifyLocally = (file) => {
  const originalName = (file.originalname || '').toLowerCase();

  const item = TUNISIAN_FOOD_PATTERNS.find((p) => p.keywords.some((k) => originalName.includes(k)));
  if (item) {
    return {
      identifiedProduct: item.name,
      confidence: FILENAME_MATCH_CONFIDENCE,
      visualDescriptors: [],
      candidateNames: item.candidates,
      isFallback: true,
      aiAvailable: false,
      engine: "Correspondance par nom de fichier (aucune analyse d'image)",
    };
  }

  return {
    identifiedProduct: null,
    confidence: 0,
    visualDescriptors: [],
    candidateNames: [],
    isFallback: true,
    aiAvailable: false,
    engine: 'Aucun moteur de vision IA disponible',
  };
};

/**
 * Main Visual Identification Handler
 * Uses Gemini Vision when GEMINI_API_KEY is set, otherwise the local fallback
 */
export const identifyProductFromImage = async (file) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  if (geminiKey && geminiKey.trim() !== '') {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { timeout: GEMINI_TIMEOUT_MS } });

      const imageBuffer = fs.readFileSync(file.path);
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: file.mimetype || 'image/jpeg',
        },
      };

      const prompt = `
You are an expert food safety computer vision model tailored for the Tunisian market and celiac disease.
Analyze this food product, dish, ingredient, or packaging image.
Identify:
1. The exact or most probable food product name (As shown in the image if present).
2. Confidence score between 0.0 and 1.0.
3. 2-4 key visual descriptors.
4. Top 3 candidate names if ambiguous.

Return STRICTLY valid JSON with no markdown formatting:
{
  "identifiedProduct": "string",
  "confidence": number,
  "visualDescriptors": ["string", "string"],
  "candidateNames": ["string", "string", "string"]
}
`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
        config: { responseMimeType: 'application/json' },
      });
      const text = (response.text || '').trim();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        identifiedProduct: parsed.identifiedProduct || 'Aliment identifié',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
        visualDescriptors: Array.isArray(parsed.visualDescriptors) ? parsed.visualDescriptors : [],
        candidateNames: Array.isArray(parsed.candidateNames) ? parsed.candidateNames : [parsed.identifiedProduct],
        isFallback: false,
        aiAvailable: true,
        engine: `Google Gemini Vision (${modelName})`,
      };
    } catch (err) {
      console.warn(`[Vision Service] Gemini API call failed: ${err.message}. Falling back to local classifier.`);
    }
  }

  // Fallback to local intelligent vision heuristics
  return identifyLocally(file);
};
