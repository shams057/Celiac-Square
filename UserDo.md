# 📋 User Action Guide (UserDo.md)

Ce document répertorie toutes les tâches, configurations et clés d'API requises que l'utilisateur doit effectuer pour finaliser et personnaliser la plateforme **Celiac Square Tunisia**.

---

## 📑 Sommaire
1. [🔑 Clés d'API à générer et configurer](#1--clés-dapi-à-générer-et-configurer)
2. [👁️ Modèle de Reconnaissance d'Image (Vision IA)](#2-️-modèle-de-reconnaissance-dimage-vision-ia)
3. [🗄️ Base de données MongoDB (Gestion & Démarrage automatique)](#3-️-base-de-données-mongodb-gestion--démarrage-automatique)
4. [🧹 Remplacement des Placeholders & Données Locales](#4--remplacement-des-placeholders--données-locales)
5. [🌐 Déploiement & Configuration Réseau](#5--déploiement--configuration-réseau)
6. [📚 Mise à jour des Données ATMC](#6--mise-à-jour-des-données-atmc)

---

## 1. 🔑 Clés d'API à générer et configurer

Le fichier de configuration de l'environnement se trouve dans :
`celiac-square/app/backend/.env`

### A. Google Gemini Vision API (`GEMINI_API_KEY`)
* **Utilité** : Utilisé par le scanner vision pour analyser en direct les photos de produits alimentaires tunisiens, extraire le texte des étiquettes (OCR) et identifier la composition sans gluten.
* **Comment l'obtenir** :
  1. Rendez-vous sur [Google AI Studio](https://aistudio.google.com/).
  2. Connectez-vous avec votre compte Google et cliquez sur **"Create API Key"** (gratuit avec quotas généreux).
  3. Copiez la clé générée.
  4. Ouvrez `backend/.env` et collez la clé :
     ```env
     GEMINI_API_KEY=AIzaSy...
     ```
  5. Redémarrez le serveur backend (`npm run server`). Dès que la clé est présente, le scanner passera automatiquement du classifieur heuristique local à l'intelligence artificielle Gemini 1.5 Flash.

### B. OpenAI Vision API (`OPENAI_API_KEY`) - Optionnel
* **Utilité** : Modèle de secours alternatif si vous préférez utiliser GPT-4o ou GPT-4o-mini.
* **Comment l'obtenir** :
  1. Rendez-vous sur [OpenAI Developer Platform](https://platform.openai.com/).
  2. Créez une clé d'API secrète et renseignez-la dans `backend/.env` :
     ```env
     OPENAI_API_KEY=sk-...
     ```

---

## 2. 👁️ Modèle de Reconnaissance d'Image (Vision IA)

### État actuel du code :
Le moteur de vision se trouve dans :
`celiac-square/app/backend/src/services/visionService.js`

* **Si `GEMINI_API_KEY` est configuré** : Les images uploadées par l'utilisateur sont directement envoyées à `gemini-1.5-flash` qui retourne un objet JSON structuré (nom du produit, confiance, descripteurs visuels, candidats).
* **Si aucune clé n'est configurée** : Le code bascule automatiquement sur `identifyLocally(file)` qui contient des motifs heuristiques pour des produits phares tunisiens (Malsouka, Couscous, Harissa, Pâtes sans gluten, Schär, Makroudh, etc.).

### Tâches recommandées si vous entraînez votre propre modèle :
1. **Entraînement d'un modèle Computer Vision personnalisé** (ex: YOLOv8, MobileNetV3 ou Roboflow) sur un dataset d'emballages tunisiens (Délice, Sicam, Randa, Spiga, Land'or, etc.).
2. **Déploiement du modèle** :
   * Soit via un microservice Python FastAPI/Flask avec PyTorch ou ONNX Runtime.
   * Soit via TensorFlow.js directement dans Node.js.
3. **Intégration** : Remplacez la fonction `identifyLocally` dans `backend/src/services/visionService.js` par un appel HTTP vers votre modèle d'inférence local :
   ```javascript
   const response = await axios.post('http://localhost:8000/predict', formData);
   ```

---

## 3. 🗄️ Base de données MongoDB (Gestion & Démarrage automatique)

### Particularité noyau Linux moderne (Kernel ≥ 6.19) :
Sur les distributions récentes avec Linux Kernel 6.19+, MongoDB 8.0 rencontre un conflit connu avec TCMalloc (`SERVER-121912`). Pour cette raison, MongoDB doit être exécuté avec la variable d'environnement :
```bash
GLIBC_TUNABLES=glibc.pthread.rseq=1
```

### Commandes intégrées :
Nous avons configuré des scripts npm pour vous faciliter la vie :
* **Démarrer MongoDB** :
  ```bash
  npm run db:start
  ```
  *(Démarre mongod en arrière-plan avec les données stockées dans `backend/data/db`)*
* **Vérifier l'état de MongoDB** :
  ```bash
  npm run db:status
  ```
  *(Retourne `{ ok: 1 }` si le serveur répond)*
* **Ré-initialiser et injecter toutes les données** :
  ```bash
  npm run seed
  ```
  *(Vide et peuple la base avec les 16 adresses de Tunisie, les 20 produits initiaux et les **241 produits officiels du Guide ATMC 2023**)*

### (Optionnel) Activer le service au démarrage système via Systemd :
Si vous disposez des droits `sudo`, vous pouvez rendre ce comportement permanent pour le démon mongod :
```bash
sudo systemctl edit mongod
```
Ajoutez :
```ini
[Service]
Environment="GLIBC_TUNABLES=glibc.pthread.rseq=1"
```
Puis :
```bash
sudo systemctl daemon-reload
sudo systemctl restart mongod
sudo systemctl enable mongod
```

---

## 4. 🧹 Remplacement des Placeholders & Données Locales

Les actions suivantes ont déjà été appliquées ou restent à ajuster selon vos besoins :

| Fichier | Ce qui a été fait / Ce qu'il reste à faire |
| :--- | :--- |
| `backend/src/routes/mapRoutes.js` | **Fait** : Les listes de villes en dur ont été supprimées. Elles sont désormais extraites dynamiquement depuis MongoDB via `Spot.distinct('city')`. |
| `backend/src/models/AtmcProduct.js` | **Fait** : Modèle Mongoose créé avec indexation textuelle et catégorielle. |
| `backend/src/routes/atmcRoutes.js` | **Fait** : API avec calcul de similarité Levenshtein pour la tolérance aux fautes de frappe. |
| `frontend/src/components/AtmcCatalog.jsx` | **Fait** : Nouvelle page/onglet du guide ATMC 2023 avec recherche floue (Fuse.js), filtres par catégories et filtres de sécurité. |
| `frontend/src/components/BackofficeSpots.jsx` | **Fait** : Backoffice Web complet permettant d'ajouter, modifier tous les détails, basculer le statut vérifié et supprimer n'importe quel lieu directement dans MongoDB. |
| `backend/src/routes/mapRoutes.js` | **Fait** : Endpoints CRUD complets (`GET`, `POST`, `PUT`, `DELETE`, `PATCH /verify`) connectés directement à MongoDB. |
| `backend/src/server.js` | **À ajuster pour la production** : Actuellement `cors({ origin: '*' })`. Remplacer `*` par votre nom de domaine réel avant mise en ligne. |
| `backend/src/services/openFoodFactsService.js` | **Recommandé** : Ajouter un `User-Agent` personnalisé avec l'email du projet selon les recommandations de l'API Open Food Facts. |

---

## 5. 🛠️ Utilisation du Web Backoffice (Gestion des Lieux)

Le web backoffice est accessible directement depuis la barre de navigation supérieure via l'onglet **"Backoffice DB"** :
* **Ajouter un lieu** : Cliquez sur "Ajouter un Nouveau Lieu" et renseignez tous les champs (Nom, Catégorie, Ville, Adresse, Coordonnées GPS avec préréglages, Téléphone, Horaires, Notes, Statut de vérification).
* **Modifier un lieu** : Cliquez sur le bouton "Modifier" d'une carte pour ouvrir le formulaire pré-rempli et modifier **n'importe quel détail**. La modification est immédiatement enregistrée dans MongoDB.
* **Statut Vérifié rapide** : Cliquez sur le badge "Vérifié / En attente" pour basculer le statut en 1 clic.
* **Supprimer un lieu** : Cliquez sur "Supprimer" et confirmez pour retirer définitivement le point de la base de données.

---

## 5. 🌐 Déploiement & Configuration Réseau

### Variables d'environnement pour la production :
Dans `celiac-square/app/backend/.env` :
```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb://127.0.0.1:27017/celiac-square
GEMINI_API_KEY=votre_cle_ici
```

### Lancement de l'application en développement :
À la racine de `celiac-square/app` :
```bash
# 1. Démarrer la base de données
npm run db:start

# 2. Lancer le frontend et le backend simultanément
npm run dev
```
* **Frontend** : `http://localhost:5173`
* **Backend API** : `http://localhost:5000`

---

## 6. 📚 Mise à jour des Données ATMC

Lorsque l'Association Tunisienne de la Maladie Cœliaque (ATMC) publie une nouvelle édition ou des errata :
1. Modifiez ou remplacez le fichier JSON dans `celiac-square/app/Data/ATMC2023.json`.
2. Lancez simplement :
   ```bash
   npm run seed
   ```
3. La base de données MongoDB sera automatiquement rafraîchie sans interruption du code.
