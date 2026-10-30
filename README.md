# Celiac Square Tunisie 🇹🇳

Plateforme web d'assistance et de sécurité alimentaire dédiée exclusivement au marché tunisien pour accompagner les personnes atteintes de la **maladie cœliaque** et d'**intolérances au gluten**.

---

## 🎨 Charte Graphique & Palette de Couleurs

Le design applique strictement les tokens d'interface spécifiés :

- **Primaire :** `#8BA850` *(Sage Olive Green — santé, alimentation saine et sûre)*
- **Secondaire :** `#756452` *(Earthy Brown — céréales, chaleur naturelle)*
- **Accent / Tertiaire :** `#FF8A41` *(Vibrant Orange — alertes, CTA interactifs)*
- **Arrière-plan :** `#DBD5BF` *(Soft Sand/Beige — canvas doux anti-reflets)*
- **Indicateurs de Statut :**
  - **Sûr / Sans Gluten :** `#8BA850`
  - **Avertissement / Risque de contamination :** `#FF8A41`
  - **Non Sûr / Contient du Gluten :** `#D9534F`

---

## 🚀 Fonctionnalités Principales

### 1. 👁️ Moteur d'Identification Visuelle par IA (Feature Majeure)
- Remplace le lecteur de code-barres traditionnel par la capture photographique directe (caméra d'appareil ou téléversement d'image).
- Détecte aussi bien les produits manufacturés que les aliments traditionnels non étiquetés (feuilles de malsouka/brik, couscous, bsissa, harissa, zgougou, viandes de boucherie).
- Interroge les modèles multimodaux de vision (Google Gemini 1.5 Flash Vision / OpenAI GPT-4o Vision) ou le classifieur heuristique tunisien embarqué.
- **Mécanisme de repli (Fallback) :** Lorsque la confiance de détection est inférieure à 70%, l'interface propose les 3 candidats visuels les plus probables pour vérification immédiate.
- Boutons d'échantillons en 1 clic pour tester instantanément sans avoir besoin d'une caméra physique.

### 2. 🔍 Recherche Hybride Double-Couche & Vérification des Étiquettes
- **Couche A (Open Food Facts API) :** Analyse en temps réel des codes-barres mondiaux, de la hiérarchie d'allergènes (`en:gluten`), des traces et des labels d'ingrédients.
- **Couche B (Base Officielle de l'Association Tunisienne de la Cœliaque - ATC) :** Répertoire des produits de base locaux (huiles, viandes, épices en vrac du souk, drou3/sorgho, produits festifs du Ramadan et du Mouled) avec les consignes officielles de l'association.
- Recherche unifiée et debouncée par mot-clé, marque ou code-barres.
- Badges visuels explicites et attribution officielle de la source.
- Bilingue : support complet en Français et en Arabe (العربية).

### 3. 🗺️ Répertoire Cartographique Interactif de Tunisie
- Carte Leaflet centrée sur la Tunisie avec marqueurs distincts par catégorie :
  - 🩺 **Médecins Spécialistes Cœliaque :** Gastro-entérologues, pédiatres et nutritionnistes à Tunis, Ariana, Sousse, Sfax, Bizerte, Nabeul, etc.
  - 🥐 **Artisans & Boulangeries 100% Sans Gluten :** Ateliers dédiés sans contamination croisée.
  - 🍽️ **Restaurants & Cafés Certifiés :** Établissements avec cuisines ou fours séparés.
  - 🛒 **Supermarchés & Rayons Dédiés :** Carrefour, Géant, Monoprix (rayons sans gluten).
- Filtres dynamiques par catégorie, ville et statut de vérification ATC.
- **Formulaire de proposition communautaire :** Permet aux utilisateurs de soumettre de nouveaux lieux (soumis à validation).

---

## 🛠️ Architecture Technique

```
app/
├── backend/
│   ├── src/
│   │   ├── config/db.js             # Connexion MongoDB
│   │   ├── models/                  # Schémas Spot & AssociationProduct
│   │   ├── routes/                  # /api/map, /api/products, /api/vision
│   │   ├── services/
│   │   │   ├── openFoodFactsService.js # Requêtes & analyse d'allergènes OFF
│   │   │   └── visionService.js        # Moteur vision Gemini + fallback local
│   │   ├── seed/seedData.js         # Données initiales certifiées Tunisie
│   │   └── server.js                # Serveur Express.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/              # Navbar, VisionScanner, ProductSearch, TunisiaMap, SpotModal, Footer
│   │   ├── services/api.js          # Client Axios vers l'API
│   │   ├── App.jsx
│   │   └── index.css                # Styles Tailwind & Leaflet
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
└── package.json                     # Scripts unifiés à la racine
```

---

## 💻 Instructions de Lancement

### 1. Prérequis
- **Node.js** >= v18
- **MongoDB** (exécuté localement sur `mongodb://127.0.0.1:27017`)

### 2. Initialisation de la Base de Données
Peuple la base de données avec les adresses répertoriées en Tunisie et le guide alimentaire de l'ATC :
```bash
npm run seed
```

### 3. Démarrage en Mode Développement
Pour lancer simultanément le backend (port 5000) et le frontend (port 3000) :
```bash
# Lancement de l'ensemble (backend + frontend)
npm run dev
```

Ou individuellement dans deux terminaux séparés :
```bash
# Terminal 1 : Backend Express
npm run server

# Terminal 2 : Frontend Vite React
npm run client
```

Ouvrez ensuite votre navigateur sur **http://localhost:3000**.
L'API backend est accessible sur **http://localhost:5000/api**.

---

## 🔑 Variables d'Environnement (Facultatif)
Dans `backend/.env` :
- `PORT=5000`
- `MONGO_URI=mongodb://127.0.0.1:27017/celiac-square`
- `GEMINI_API_KEY=` *(optionnel : pour activer les requêtes en direct vers Google Gemini Vision)*
- `OPENAI_API_KEY=` *(optionnel)*

> **Note :** Si aucune clé d'API d'IA n'est configurée, l'application fonctionne immédiatement avec son moteur d'analyse visuelle et ses classifieurs alimentaires tunisiens locaux intégrés.
