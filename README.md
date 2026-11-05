# Celiac Square

Plateforme web et mobile pour manger sans gluten en Tunisie : le guide officiel de l’Association Tunisienne de la Maladie Cœliaque (ATMC), un scanner de produits par photo, une recherche hybride (guides tunisiens + Open Food Facts) et une carte des adresses sûres.

**Production :** https://celiac-square.vercel.app

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Prérequis](#prérequis)
4. [Installation pas à pas](#installation-pas-à-pas)
5. [Lancer en développement](#lancer-en-développement)
6. [Déployer sur Vercel](#déployer-sur-vercel)
7. [Application mobile](#application-mobile)
8. [Référence](#référence)
9. [Dépannage](#dépannage)

---

## Fonctionnalités

| Écran | Description |
| --- | --- |
| **Guide ATMC** | Les 241 produits du guide 2023 (autorisés, à vérifier, interdits), en français et en arabe, avec recherche tolérante aux fautes et filtres par rayon. |
| **Scanner** | Deux modes. *Reconnaître le produit* : le texte de l’emballage est lu sur l’appareil (OCR Tesseract, gratuit) puis cherché dans les guides tunisiens. *Analyser les ingrédients* : la liste est lue sur l’appareil (OCR), puis seul le texte est envoyé à Google Gemini, qui renvoie le statut probable, un pourcentage de confiance et une courte explication. |
| **Recherche** | Nom, marque ou code-barres. Résultats locaux instantanés, Open Food Facts ensuite. Insensible aux accents. |
| **Carte** | Médecins, boulangeries, restaurants, cafés et épiceries sans gluten, filtrables par type et par ville. |
| **Propositions** | Les visiteurs proposent des adresses ; elles arrivent dans une boîte de réception administrateur avant publication. |
| **Marché** | Produits sans gluten des restaurants, boulangeries, cafés et artisans : tout voir d’un coup (rangé par boutique, comme un menu) ou boutique par boutique, recherche par produit, filtres par type. Réservé aux membres connectés. |
| **Comptes** | Inscription et connexion (Supabase Auth). Trois rôles : *client* (par défaut), *vendeur*, *administrateur*. La connexion n’est obligatoire que pour le marché. |
| **Espace vendeur** | Le vendeur présente sa boutique (logo, type, ville, présentation) et publie ses produits : titre, description, prix facultatif, jusqu’à 5 photos. |
| **Devenir vendeur** | Lien en bas de page : un client envoie une demande, examinée dans le back-office. |
| **Back-office** | Visible uniquement par les administrateurs. *Adresses* : ajout, modification, vérification et suppression des adresses, validation des propositions. *Vendeurs et comptes* : demandes de vendeur, suspension des boutiques, rôles des comptes. |

Interface bilingue français / arabe (mise en page de droite à gauche en arabe), pensée d’abord pour le téléphone.

---

## Architecture

```
app/
├── api/index.js            # Point d’entrée serverless Vercel (sert l’API Express)
├── backend/                # API Express (Node.js, ES modules)
│   └── src/
│       ├── app.js          # Application Express (sans écoute réseau)
│       ├── server.js       # Serveur local (port 5000)
│       ├── config/db.js    # Client Supabase côté serveur
│       ├── routes/         # /api/map, /api/products, /api/atmc, /api/vision, /api/auth, /api/market, /api/admin
│       ├── services/       # Open Food Facts, vision (Gemini), photos du marché (Storage)
│       ├── middleware/     # Comptes connectés, rôles, accès administrateur
│       ├── seed/           # Données initiales et script de seed
│       └── scripts/        # set-role : donner un rôle à un compte
├── frontend/               # React 18 + Vite + Tailwind CSS + Leaflet
├── mobile/                 # Application Expo (Android / iOS) qui affiche le site
├── supabase/migrations/    # Schéma Postgres (tables, RLS, recherche)
├── Data/                   # Guide ATMC 2023 (JSON) et traductions françaises
└── vercel.json             # Build, routage /api et fonctions
```

- **Base de données :** Supabase (Postgres) avec Row Level Security. L’API utilise la clé secrète côté serveur ; le navigateur ne parle jamais directement à la base.
- **Hébergement :** Vercel. Le frontend est servi en statique, l’API tourne dans une fonction serverless.
- **Monorepo :** npm workspaces (`backend`, `frontend`). L’application `mobile/` est volontairement hors workspaces, pour ne pas être installée par Vercel.

---

## Prérequis

| Outil | Version | Pour |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 20 ou plus | Tout le projet |
| npm | 10 ou plus | Installation |
| Compte [Supabase](https://supabase.com) | Plan gratuit | Base de données |
| Clé [Google AI Studio](https://aistudio.google.com) | Facultatif | Reconnaissance d’image du scanner |
| Compte [Vercel](https://vercel.com) | Plan gratuit | Déploiement |
| Android SDK + JDK 17 | Facultatif | Build Android local |

---

## Installation pas à pas

### 1. Cloner le dépôt

```bash
git clone https://github.com/shams057/Celiac-Square.git
cd Celiac-Square
```

### 2. Installer les dépendances

Une seule commande à la racine installe le backend et le frontend :

```bash
npm install
```

### 3. Créer la base Supabase

1. Créez un projet sur [supabase.com](https://supabase.com) (région conseillée : Francfort, `eu-central-1`).
2. Ouvrez **SQL Editor** et exécutez, dans l’ordre, le contenu des fichiers de `supabase/migrations/` :
   - `20261103210000_initial_schema.sql` : tables `atmc_products`, `association_products`, `spots` et `spot_proposals`, recherche insensible aux accents, règles de sécurité ;
   - `20261105120000_marketplace.sql` : comptes (`profiles`, avec le rôle), `stores`, `market_products`, `seller_applications` et le bucket Storage public `marketplace` pour les photos.
   Sur une base existante, n’exécutez que la seconde.
   Dans **Authentication → Sign In / Providers → Email**, choisissez si les nouveaux comptes doivent confirmer leur adresse e-mail (*Confirm email*). L’application gère les deux cas.
3. Dans **Project Settings → API Keys**, notez :
   - l’URL du projet (`https://<project-ref>.supabase.co`) ;
   - la **clé secrète** (`sb_secret_…`). Elle donne un accès complet à la base : ne la publiez jamais et ne l’utilisez jamais dans le frontend.

### 4. Configurer les variables d’environnement

```bash
cp backend/.env.example backend/.env
```

Puis complétez `backend/.env` :

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Oui | URL du projet Supabase |
| `SUPABASE_SECRET_KEY` | Oui | Clé secrète Supabase (serveur uniquement) |
| `ADMIN_TOKEN` | Non | Jeton pour appeler les routes administrateur depuis un script. Le back-office, lui, utilise les comptes administrateurs. Générez-le avec `openssl rand -hex 24` |
| `GEMINI_API_KEY` | Non | Active l’analyse des ingrédients. La reconnaissance de produit (OCR) fonctionne sans |
| `GEMINI_MODEL` | Non | Modèle Gemini (par défaut `gemini-3.5-flash-lite`, avec repli sur `gemini-flash-lite-latest`) |
| `OFF_USER_AGENT` | Non | Identifiant envoyé à Open Food Facts, par exemple `CeliacSquare/1.0 (contact@exemple.com)` |
| `PORT` | Non | Port de l’API locale (par défaut `5000`) |

### 5. Remplir la base

```bash
npm run seed
```

Charge 241 produits du guide ATMC (avec leurs noms français), 20 produits de l’association et 16 adresses.

> ⚠️ Le seed **vide** d’abord les adresses et les propositions. Ne le relancez pas sur une base de production qui contient de vraies données.

---

## Lancer en développement

```bash
npm run dev
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| API | http://localhost:5000/api |
| État de l’API | http://localhost:5000/api/health |

Vite redirige `/api` vers le port 5000 : le frontend appelle toujours des chemins relatifs. Pour lancer les deux séparément : `npm run server` et `npm run client`.

**Vérifier l’installation :** `/api/health` doit répondre `"database": "connected"` avec `supabaseUrl`, `supabaseSecretKey` et `adminToken` à `true`.

**Premier administrateur :** créez un compte sur le site (bouton *Se connecter*, puis *Nouveau compte*), puis donnez-lui le rôle administrateur :

```bash
npm run set-role -- vous@exemple.com ADMIN
```

Reconnectez-vous : le lien *Back-office* apparaît en bas de page. Ensuite, les rôles se changent depuis *Back-office → Vendeurs et comptes → Comptes*. (Ou, dans le SQL Editor de Supabase : `update profiles set role = 'ADMIN' where email = 'vous@exemple.com';`)

---

## Déployer sur Vercel

1. Poussez le dépôt sur GitHub.
2. Sur [vercel.com](https://vercel.com), **Add New → Project**, importez le dépôt.
   - **Root Directory :** la racine du dépôt (là où se trouve `vercel.json`).
   - **Framework Preset :** *Other*. Les commandes viennent de `vercel.json`.
3. Dans **Settings → Environment Variables**, ajoutez pour *Production* (et *Preview* si besoin) les mêmes variables que `backend/.env`. Marquez `SUPABASE_SECRET_KEY`, `ADMIN_TOKEN` et `GEMINI_API_KEY` comme **Sensitive**, et utilisez un `ADMIN_TOKEN` différent de celui du développement.
4. Déployez. Chaque `git push` sur `main` redéploie automatiquement.
5. Vérifiez `https://<votre-domaine>/api/health`.

Une variable modifiée n’est prise en compte qu’après un redéploiement (**Deployments → ⋯ → Redeploy**).

---

## Application mobile

L’application Expo de `mobile/` affiche le site en plein écran, avec le bouton retour Android, l’accès à l’appareil photo pour le scanner et un écran hors connexion. Chaque mise à jour du site apparaît dans l’application sans nouveau build. L’adresse du site se règle dans `mobile/app.json` (`expo.extra.siteUrl`).

```bash
cd mobile
npm install
```

### Android (téléphone branché en USB)

1. Activez le **débogage USB** sur le téléphone et vérifiez qu’il est détecté : `adb devices`.
2. Construisez et installez la version release :

   ```bash
   npm run android:release
   ```

Les dossiers `android/` et `ios/` sont générés à partir de `app.json` et ne sont pas versionnés.

### iOS (sans Mac)

- **Tester tout de suite :** installez *Expo Go* sur l’iPhone, lancez `npx expo start --tunnel` dans `mobile/` et scannez le QR code.
- **Application installable / App Store :** utilisez [EAS Build](https://docs.expo.dev/build/introduction/), qui compile sur les Mac d’Expo. Il faut un compte Expo et un compte Apple Developer.

### Publication

L’APK local est signé avec la clé de débogage : il convient pour vos appareils mais pas pour le Play Store. Pour publier, utilisez EAS Build, qui gère les clés de signature Android et les certificats iOS.

---

## Référence

### Scripts (racine)

| Commande | Effet |
| --- | --- |
| `npm run dev` | API + frontend en développement |
| `npm run server` | API seule (redémarre à chaque modification) |
| `npm run client` | Frontend seul |
| `npm run build` | Build de production du frontend (`frontend/dist`) |
| `npm run seed` | Réinitialise et remplit la base Supabase |
| `npm run set-role -- <email> <ADMIN\|SELLER\|CLIENT>` | Change le rôle d’un compte existant (pour créer le premier administrateur) |

### API

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | État de la base et de la configuration (jamais les valeurs) |
| GET | `/api/atmc/products` | Public | Guide ATMC (`category`, `status`, `q`) |
| GET | `/api/atmc/categories` | Public | Rayons et nombre de produits par statut |
| GET | `/api/atmc/stats` | Public | Totaux autorisés / à vérifier / interdits |
| GET | `/api/products/search` | Public | Recherche (`q`, `sources=local\|off\|all`) |
| GET | `/api/products/barcode/:code` | Public | Recherche par code-barres |
| POST | `/api/vision/match` | Public | Trouve le produit à partir du texte lu sur l’emballage (`{ "text": "…" }`) |
| POST | `/api/vision/ingredients` | Public | Estime si un produit contient du gluten à partir du texte de ses ingrédients (`{ "text": "…" }`) |
| GET | `/api/map/spots` | Public | Adresses (`category`, `city`, `isVerified`, `q`) |
| GET | `/api/map/cities` | Public | Villes présentes sur la carte |
| POST | `/api/map/proposals` | Public | Proposer une adresse |
| GET | `/api/map/proposals` | Admin | Boîte de réception (`status`) |
| POST | `/api/map/proposals/:id/approve` | Admin | Valider et publier une proposition |
| POST | `/api/map/proposals/:id/reject` | Admin | Refuser une proposition |
| POST / PUT / DELETE | `/api/map/spots[/:id]` | Admin | Gérer les adresses |
| PATCH | `/api/map/spots/:id/verify` | Admin | Changer le statut vérifié |
| POST | `/api/auth/signup` | Public | Créer un compte client (`{ email, password, fullName }`) |
| POST | `/api/auth/login` | Public | Se connecter : renvoie la session et le profil |
| POST | `/api/auth/refresh` | Public | Renouveler la session (`{ refreshToken }`) |
| GET | `/api/auth/me` | Membre | Le compte connecté et son rôle |
| POST | `/api/auth/logout` | Membre | Fermer la session sur cet appareil |
| GET | `/api/market/stores` | Membre | Boutiques actives (`type`) avec leur nombre de produits |
| GET | `/api/market/stores/:id` | Membre | Une boutique et ses produits |
| GET | `/api/market/products` | Membre | Produits de toutes les boutiques (`q`, `type`, `store`) |
| GET / PUT | `/api/market/me/store` | Vendeur | Sa boutique (le premier `PUT` la crée) |
| POST / PUT / DELETE | `/api/market/me/products[/:id]` | Vendeur | Ses produits ; `images` : URL déjà enregistrées ou nouvelles photos en data URL |
| GET | `/api/market/applications/mine` | Membre | Ses demandes de vendeur |
| POST | `/api/market/applications` | Client | Demander à devenir vendeur |
| GET | `/api/admin/seller-applications` | Admin | Demandes de vendeur (`status`) |
| POST | `/api/admin/seller-applications/:id/approve` | Admin | Accepter : ouvre la boutique, le compte devient vendeur |
| POST | `/api/admin/seller-applications/:id/reject` | Admin | Refuser |
| GET / PATCH | `/api/admin/stores[/:id]` | Admin | Boutiques ; `{ isActive }` suspend ou réactive |
| GET | `/api/admin/users` | Admin | Comptes (`q`, `role`) |
| PATCH | `/api/admin/users/:id/role` | Admin | Changer le rôle (`{ role }`), sauf le sien |

Les routes *Membre*, *Client*, *Vendeur* et *Admin* exigent l’en-tête `Authorization: Bearer <jeton d’accès>` d’un compte qui a le rôle voulu. Les routes *Admin* acceptent aussi `Bearer <ADMIN_TOKEN>`, pratique pour les scripts.

### Données

- `Data/ATMC2023.json` : guide ATMC 2023, source du seed.
- `Data/ATMC2023.fr.json` : traductions françaises des entrées rédigées en arabe. Corrigez une traduction ici puis relancez le seed (sur une base de développement).
- `atmc-guide-2023.json` : transcription brute du PDF de l’ATMC, conservée comme référence.

### Charte graphique

| Rôle | Couleur |
| --- | --- |
| Primaire (sans gluten) | `#8BA850` |
| Secondaire | `#756452` |
| Accent (actions, à vérifier) | `#FF8A41` |
| Fond | `#DBD5BF` |
| Contient du gluten | `#D9534F` |

---

## Dépannage

| Symptôme | Cause probable et solution |
| --- | --- |
| Le guide affiche « 0 produit » ou une erreur | Ouvrez `/api/health`. `not_configured` : variables Supabase manquantes. `unreachable` : URL ou clé incorrecte. |
| `/api/health` indique `supabaseSecretKey: false` sur Vercel | La variable n’existe pas pour l’environnement *Production*, ou aucun redéploiement n’a suivi son ajout. |
| La base est vide | Lancez `npm run seed` avec le bon `backend/.env`. |
| « Open Food Facts ne répond pas » | Le service limite le nombre de recherches. Les résultats locaux restent affichés ; réessayez après une minute. |
| « L’analyse des ingrédients n’est pas configurée » | `GEMINI_API_KEY` absente. La reconnaissance de produit, elle, n’en a pas besoin. |
| La reconnaissance de produit reste sur « Préparation de la lecture… » | Le moteur OCR (~3 Mo) se télécharge à la première utilisation ; il faut une connexion internet, ensuite il est en cache. |
| Pas de lien *Back-office* en bas de page | Le compte n’est pas administrateur : `npm run set-role -- <email> ADMIN`, puis déconnexion et reconnexion. |
| « Confirmez d’abord votre adresse e-mail » | L’option *Confirm email* est active dans Supabase : ouvrez le lien reçu, ou désactivez l’option. |
| Les photos des produits ne s’enregistrent pas | La migration `20261105120000_marketplace.sql` n’a pas été exécutée (bucket `marketplace` absent). |
| Android : écran rouge « development server returned 500 » | Une version *debug* est installée. Installez la version release avec `npm run android:release`. |
| Android : l’installation reste bloquée | Une ancienne version signée différemment est installée : désinstallez-la puis relancez. |

---

## Avertissement médical

Les informations de Celiac Square sont fournies à titre indicatif. En cas de doute, lisez l’étiquette du produit et demandez l’avis d’un gastro-entérologue ou d’un nutritionniste.
