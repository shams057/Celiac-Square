import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Seed data for Celiac Square: map spots, association products and the ATMC 2023 guide.
 * Rows are returned in the database's snake_case shape (see supabase/migrations).
 */

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../Data');

export const spotsSeed = [
  // --- DOCTORS ---
  {
    name: 'Dr. Sofiene Ben Khelil (Gastro-entérologue)',
    category: 'DOCTOR',
    location: {
      type: 'Point',
      coordinates: [10.1815, 36.8065], // [lng, lat] Tunis Centre
    },
    city: 'Tunis',
    address: 'Centre Urbain Nord, Clinique Alyssa, 1082 Tunis',
    phone: '+216 71 820 400',
    speciality: 'Gastro-entérologie adulte & Maladie Cœliaque',
    hours: 'Lun-Ven: 08:30 - 16:30, Sam: 08:30 - 12:30',
    isVerified: true,
    notes: 'Référent de l’Association Tunisienne de la Cœliaque. Prise en charge des biopsies duodénales et suivi diététique.',
  },
  {
    name: 'Dr. Amel Trabelsi (Pédiatre Spécialiste Cœliaque)',
    category: 'DOCTOR',
    location: {
      type: 'Point',
      coordinates: [10.1972, 36.8522], // Ariana
    },
    city: 'Ariana',
    address: 'Avenue Habib Bourguiba, Immeuble El Hana, Ariana',
    phone: '+216 71 700 890',
    speciality: 'Pédiatrie & Nutrition Infantile Sans Gluten',
    hours: 'Lun-Sam: 09:00 - 17:00',
    isVerified: true,
    notes: 'Dépistage précoce chez l’enfant et protocole d’exclusion stricte du gluten sans carences.',
  },
  {
    name: 'Dr. Karim Jlassi (Gastro-entérologue & Hépatologue)',
    category: 'DOCTOR',
    location: {
      type: 'Point',
      coordinates: [10.6369, 35.8256], // Sousse
    },
    city: 'Sousse',
    address: 'Boulevard 14 Janvier, Centre Médical La Corniche, Sousse',
    phone: '+216 73 228 110',
    speciality: 'Gastro-entérologie & Endoscopie digestive',
    hours: 'Lun-Ven: 08:30 - 16:00',
    isVerified: true,
    notes: 'Diagnostics sérologiques cœliaques (Anti-transglutaminase IgA) et endoscopies digestives.',
  },
  {
    name: 'Dr. Monia Charfi (Nutritionniste Diététicienne)',
    category: 'DOCTOR',
    location: {
      type: 'Point',
      coordinates: [10.7602, 34.7405], // Sfax
    },
    city: 'Sfax',
    address: 'Route de Téniour Km 1.5, Immeuble Ibn Sina, Sfax',
    phone: '+216 74 405 550',
    speciality: 'Diététique clinique & Régime sans gluten',
    hours: 'Lun-Sam: 09:00 - 15:00',
    isVerified: true,
    notes: 'Plans de rééquilibrage nutritionnel et accompagnement pour les cœliaques nouvellement diagnostiqués.',
  },
  {
    name: 'Dr. Riadh Bouzidi (Gastro-entérologue)',
    category: 'DOCTOR',
    location: {
      type: 'Point',
      coordinates: [9.8739, 37.2744], // Bizerte
    },
    city: 'Bizerte',
    address: 'Rue Habib Thameur, Centre Médical du Nord, Bizerte',
    phone: '+216 72 431 220',
    speciality: 'Pathologies digestives & Intolérances alimentaires',
    hours: 'Lun-Ven: 09:00 - 16:00',
    isVerified: true,
    notes: 'Suivi régulier et bilan annuel pour les patients atteints de maladie cœliaque.',
  },

  // --- GLUTEN-FREE PLACES ---
  // Addresses, hours and phones from each place's Google Maps listing (November 2026).
  // Media lives in frontend/public/spots/<slug>/. "Google Maps" credit = photos posted there by visitors.
  {
    name: 'Tik Tak Family',
    category: 'RESTAURANT',
    location: { type: 'Point', coordinates: [10.3262902, 36.8790052] },
    city: 'La Marsa',
    address: 'Rue Tahar Ben Achour, 2078 La Marsa (côté site archéologique de Carthage)',
    phone: '+216 50 934 906',
    speciality: 'Crêpes salées et sucrées, pizzas, sandwichs, pain saj',
    hours: 'Lun–jeu 12 h–22 h · ven–sam 12 h–23 h · dim 17 h–22 h',
    isVerified: true,
    notes: 'Restaurant familial 100 % sans gluten : toute la carte (crêpes, pizzas, sandwichs, pain) est préparée sans gluten.',
    links: [{ type: 'facebook', url: 'https://www.facebook.com/TikaTakFamily' }],
    media: [
      { type: 'video', src: '/spots/tiktak-family/video.mp4', poster: '/spots/tiktak-family/video-poster.jpg', alt: 'Visite de Tik Tak Family en vidéo' },
      { type: 'image', src: '/spots/tiktak-family/storefront.webp', alt: 'Terrasse et devanture de Tik Tak Family' },
      { type: 'image', src: '/spots/tiktak-family/img-9187.webp', alt: 'Crêpe salée garnie de viande hachée et de légumes' },
      { type: 'image', src: '/spots/tiktak-family/img-9190.webp', alt: 'Crêpe pliée, garnie et dorée' },
      { type: 'image', src: '/spots/tiktak-family/img-9146.webp', alt: 'Garniture flambée sur la plaque' },
      { type: 'image', src: '/spots/tiktak-family/img-9194.webp', alt: 'Garniture d’une crêpe aux olives et tomates' },
      { type: 'image', src: '/spots/tiktak-family/img-9162.webp', alt: 'Crêpe en préparation sur la plaque' },
      { type: 'image', src: '/spots/tiktak-family/img-9167.webp', alt: 'Crêpe au fromage fondu' },
      { type: 'image', src: '/spots/tiktak-family/img-9202.webp', alt: 'Pâte sans gluten abaissée à la main' },
      { type: 'image', src: '/spots/tiktak-family/img-9217.webp', alt: 'Crêpe garnie de salade et de fromage' },
      { type: 'image', src: '/spots/tiktak-family/g-crepe-poulet.webp', alt: 'Crêpe au poulet', credit: 'Google Maps' },
      { type: 'image', src: '/spots/tiktak-family/g-crepe-viande.webp', alt: 'Crêpe à la viande et au fromage', credit: 'Google Maps' },
      { type: 'image', src: '/spots/tiktak-family/g-crepe-sucree.webp', alt: 'Crêpe sucrée au chocolat et aux fruits', credit: 'Google Maps' },
    ],
  },
  {
    name: 'La Seine — La Marsa',
    category: 'CAFE',
    location: { type: 'Point', coordinates: [10.329816, 36.8842791] },
    city: 'La Marsa',
    address: 'Résidence Hannibal, rue Abdelhafidh El Mekki, 2070 La Marsa',
    phone: '+216 90 680 335',
    speciality: 'Pâtisserie et boulangerie sans gluten, sans sucre ajouté',
    hours: 'Tous les jours 8 h 30–20 h',
    isVerified: true,
    notes: 'Pâtisserie sans gluten et sans sucre ajouté. Les produits sans gluten sont fabriqués dans un atelier dédié, séparé de celui des recettes avec gluten. Demandez confirmation pour chaque produit.',
    links: [{ type: 'facebook', url: 'https://www.facebook.com/laseine.tn/' }],
    media: [
      { type: 'image', src: '/spots/la-seine-la-marsa/facade.webp', alt: 'Devanture de la pâtisserie La Seine à La Marsa', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-la-marsa/vitrine.webp', alt: 'Vitrine de gâteaux et biscuits', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-la-marsa/eclairs.webp', alt: 'Éclairs et tartelettes en vitrine', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-la-marsa/entremets.webp', alt: 'Part d’entremets aux fruits rouges', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-la-marsa/entree.webp', alt: 'Entrée et terrasse de La Seine', credit: 'Google Maps' },
    ],
  },
  {
    name: 'La Seine — El Menzah 6',
    category: 'CAFE',
    location: { type: 'Point', coordinates: [10.1646779, 36.8455049] },
    city: 'El Menzah',
    address: '2 rue Tahar Memmi, El Menzah 6, 2091 Ariana',
    phone: '+216 56 836 630',
    speciality: 'Salon de thé, pâtisserie et pain sans gluten, sans sucre ajouté',
    hours: 'Tous les jours 8 h 30–22 h (lundi dès 8 h)',
    isVerified: true,
    notes: 'Salon de thé et pâtisserie sans gluten et sans sucre ajouté (baguettes, cakes, entremets, brunch). Les produits sans gluten sont fabriqués dans un atelier dédié. Demandez confirmation pour chaque produit.',
    links: [{ type: 'facebook', url: 'https://www.facebook.com/laseine.tn/' }],
    media: [
      { type: 'image', src: '/spots/la-seine-menzah-6/facade.webp', alt: 'Devanture de La Seine à El Menzah 6', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-menzah-6/salle.webp', alt: 'Salle et comptoir du salon de thé', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-menzah-6/vitrine.webp', alt: 'Vitrine de gâteaux', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-menzah-6/baguettes.webp', alt: 'Baguettes sans gluten', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-menzah-6/cake.webp', alt: 'Cake tranché', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-menzah-6/brunch.webp', alt: 'Brunch : quiche, gâteaux et jus', credit: 'Google Maps' },
      { type: 'image', src: '/spots/la-seine-menzah-6/noisettine.webp', alt: 'Gâteau Noisettine', credit: 'Google Maps' },
    ],
  },
  {
    name: 'Lily Delights',
    category: 'CAFE',
    location: { type: 'Point', coordinates: [10.5790589, 36.4049319] },
    city: 'Hammamet',
    address: 'Rue Dag Hammarskjöld, 8050 Hammamet',
    phone: '+216 54 291 103',
    speciality: 'Pâtisserie sans gluten et salon de thé',
    hours: 'Mar–dim 10 h–19 h · fermé le lundi',
    isVerified: true,
    notes: 'Pâtisserie diététique entièrement sans gluten, avec salon de thé sur place.',
    links: [],
    media: [
      { type: 'image', src: '/spots/lily-delights/salle.webp', alt: 'Salon de thé et comptoir de Lily Delights', credit: 'Google Maps' },
      { type: 'image', src: '/spots/lily-delights/facade.webp', alt: 'Entrée rose « Pâtisserie sans gluten »', credit: 'Google Maps' },
      { type: 'image', src: '/spots/lily-delights/patisseries.webp', alt: 'Assortiment de pâtisseries et café', credit: 'Google Maps' },
      { type: 'image', src: '/spots/lily-delights/vitrine.webp', alt: 'Vitrine de gâteaux', credit: 'Google Maps' },
      { type: 'image', src: '/spots/lily-delights/vitrine-2.webp', alt: 'Vitrine de biscuits et tartes', credit: 'Google Maps' },
      { type: 'image', src: '/spots/lily-delights/boite.webp', alt: 'Boîte de pâtisseries orientales', credit: 'Google Maps' },
    ],
  },
  {
    name: 'Graines et Saveurs',
    category: 'ARTISAN',
    location: { type: 'Point', coordinates: [10.3327475, 36.8824426] },
    city: 'La Marsa',
    address: 'Rue Imam Abou Hanifa, 2080 La Marsa',
    phone: '+216 52 336 097',
    speciality: 'Gourmandises sans gluten et sans sucre : gâteaux, biscuits, chocolats',
    hours: 'Lun–sam 9 h–21 h · dim 9 h–20 h',
    isVerified: true,
    notes: 'Boulangerie-pâtisserie de gourmandises sans gluten et sans sucre, à base d’ingrédients naturels.',
    links: [],
    media: [
      { type: 'image', src: '/spots/graines-et-saveurs/facade.webp', alt: 'Devanture de Graines et Saveurs', credit: 'Google Maps' },
      { type: 'image', src: '/spots/graines-et-saveurs/vitrine.webp', alt: 'Comptoir et vitrine de gâteaux', credit: 'Google Maps' },
      { type: 'image', src: '/spots/graines-et-saveurs/boutique.webp', alt: 'Intérieur de la boutique', credit: 'Google Maps' },
      { type: 'image', src: '/spots/graines-et-saveurs/coffrets.webp', alt: 'Coffrets de chocolats et de douceurs', credit: 'Google Maps' },
    ],
  },
  {
    name: 'Swan on the Cake',
    category: 'RESTAURANT',
    location: { type: 'Point', coordinates: [10.1782162, 36.8407708] },
    city: 'El Menzah',
    address: '31 bis rue Habib Achour, El Menzah 1, Tunis',
    phone: '+216 71 236 405',
    speciality: 'Pizzas, plats et sandwichs, avec option pâte et pain sans gluten',
    hours: 'Tous les jours 11 h 30–23 h',
    isVerified: true,
    crossContaminationRisk: true,
    notes: 'Restaurant classique, non dédié au sans gluten : il propose une pâte à pizza et un pain sans gluten, préparés dans la même cuisine que les plats avec gluten. Risque de contamination croisée : prévenez de votre maladie cœliaque en commandant.',
    links: [{ type: 'facebook', url: 'https://www.facebook.com/p/Swan-On-the-cake-au-31-Bis-100063780870226/' }],
    media: [
      { type: 'image', src: '/spots/swan-on-the-cake/facade.webp', alt: 'Devanture jaune de Swan on the Cake', credit: 'Google Maps' },
      { type: 'image', src: '/spots/swan-on-the-cake/pizza-legumes.webp', alt: 'Pizza aux légumes', credit: 'Google Maps' },
      { type: 'image', src: '/spots/swan-on-the-cake/pizza-champignons.webp', alt: 'Pizza aux champignons et oignons rouges', credit: 'Google Maps' },
      { type: 'image', src: '/spots/swan-on-the-cake/pizza-thon.webp', alt: 'Pizza au thon', credit: 'Google Maps' },
      { type: 'image', src: '/spots/swan-on-the-cake/lasagnes.webp', alt: 'Lasagnes gratinées', credit: 'Google Maps' },
      { type: 'image', src: '/spots/swan-on-the-cake/plat.webp', alt: 'Escalope panée, frites et salade', credit: 'Google Maps' },
      { type: 'image', kind: 'menu', src: '/spots/swan-on-the-cake/menu-1.webp', alt: 'Menu : couverture', credit: 'Google Maps' },
      { type: 'image', kind: 'menu', src: '/spots/swan-on-the-cake/menu-2.webp', alt: 'Menu : plats chauds, makloubs et baguettes farcies', credit: 'Google Maps' },
      { type: 'image', kind: 'menu', src: '/spots/swan-on-the-cake/menu-3.webp', alt: 'Menu : pizzas, salades, pâtes et lasagnes', credit: 'Google Maps' },
    ],
  },
  {
    name: 'Gluten Free Serenity',
    category: 'SUPERMARKET',
    location: { type: 'Point', coordinates: [10.3055539, 36.7474218] },
    city: 'Ezzahra',
    address: '17 rue Hassen Ibn Noôman, 2034 Ezzahra',
    phone: '+216 27 219 740',
    speciality: 'Épicerie sans gluten, produits bio, crêperie et lokma',
    hours: 'Lun–sam 9 h–18 h · fermé le dimanche',
    isVerified: true,
    notes: 'Épicerie spécialisée sans gluten : farines, pâtes, biscuits, produits importés et douceurs maison (lokma, baklawa).',
    links: [],
    media: [
      { type: 'video', src: '/spots/gluten-free-serenity/video.mp4', poster: '/spots/gluten-free-serenity/video-poster.jpg', alt: 'Visite de l’épicerie Gluten Free Serenity en vidéo' },
      { type: 'image', src: '/spots/gluten-free-serenity/facade.webp', alt: 'Devanture de Gluten Free Serenity', credit: 'Google Maps' },
      { type: 'image', src: '/spots/gluten-free-serenity/rayon-1.webp', alt: 'Rayon de farines et préparations sans gluten', credit: 'Google Maps' },
      { type: 'image', src: '/spots/gluten-free-serenity/rayon-2.webp', alt: 'Rayon de pâtes et biscuits sans gluten', credit: 'Google Maps' },
      { type: 'image', src: '/spots/gluten-free-serenity/rayon-3.webp', alt: 'Rayon de produits importés sans gluten', credit: 'Google Maps' },
      { type: 'image', src: '/spots/gluten-free-serenity/douceurs.webp', alt: 'Douceurs maison', credit: 'Google Maps' },
      { type: 'image', src: '/spots/gluten-free-serenity/baklawa.webp', alt: 'Baklawa sans gluten', credit: 'Google Maps' },
    ],
  },
  {
    name: 'Les Cinq Saveurs Kammoun',
    category: 'SUPERMARKET',
    location: { type: 'Point', coordinates: [10.2650063, 36.862147] },
    city: 'L’Aouina',
    address: 'Rue Cheikh Mohamed Ennaifer, L’Aouina, 2045 Tunis',
    phone: '+216 24 157 261',
    speciality: 'Épicerie fine avec rayon de produits sans gluten',
    hours: 'Lun–sam 8 h–21 h · dim 9 h–21 h',
    isVerified: true,
    notes: 'Épicerie fine qui vend des produits sans gluten à côté d’autres produits : vérifiez la mention sans gluten sur chaque emballage.',
    links: [],
    media: [
      { type: 'image', src: '/spots/les-cinq-saveurs-kammoun/facade.webp', alt: 'Devanture des Cinq Saveurs Kammoun', credit: 'Google Maps' },
      { type: 'image', src: '/spots/les-cinq-saveurs-kammoun/boutique.webp', alt: 'Rayons et comptoir de l’épicerie', credit: 'Google Maps' },
    ],
  },
];

export const associationProductsSeed = [
  // --- GRAINS & FLOURS ---
  {
    productNameFr: 'Couscous de Blé Dur Traditionnel',
    productNameAr: 'كسكسي دياري بالقمح الصلب',
    category: 'GRAINS',
    isGlutenFree: false,
    status: 'UNSAFE',
    brand: 'Artisanal / Vrac / Marques locales',
    barcode: '6191000100011',
    notes: 'STRICTEMENT INTERDIT pour les malades cœliaques. Élaboré à partir de semoule de blé dur riche en gluten. Ne jamais consommer même lavé ou rincé.',
    notesAr: 'ممنوع قطعا لمرضى حساسية القمح والسلياك. مصنوع من سميد القمح الصلب الغني بالغلوتين.',
    officialDocReference: 'Guide ATC - Chapitre Céréales Majeures',
    keywords: ['couscous', 'smid', 'semoule', 'ble', 'wheat', 'كسكسي', 'سميد'],
  },
  {
    productNameFr: 'Couscous de Maïs Sans Gluten Certifié',
    productNameAr: 'كسكسي بالذرة خالٍ من الغلوتين معتمد',
    category: 'GRAINS',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Diététique Agréée',
    barcode: '6192000200022',
    notes: 'AUTORISÉ SANS RESTRICTION. Fabriqué à 100% avec de la farine de maïs sur des lignes strictement certifiées sans gluten par l’ATC.',
    notesAr: 'مرخص ومسموح به. مصنوع 100% من الذرة في خطوط إنتاج معزولة وخالية من التلوث.',
    officialDocReference: 'Guide ATC - Liste Blanche Céréales Alternatives',
    keywords: ['couscous mais', 'corn couscous', 'sans gluten', 'ذرة', 'خال من الغلوتين'],
  },
  {
    productNameFr: 'Semoule d’Orge Traditionnelle (Malthouth)',
    productNameAr: 'شعير مفروم / ملثوث شعير',
    category: 'GRAINS',
    isGlutenFree: false,
    status: 'UNSAFE',
    brand: 'Artisanal / Vrac',
    barcode: '',
    notes: 'STRICTEMENT INTERDIT. L’orge contient de la hordéine, une forme de gluten hautement toxique pour la muqueuse intestinale des personnes cœliaques.',
    notesAr: 'ممنوع كليا. الشعير يحتوي على الغلوتين ولا يناسب مرضى السلياك نهائيا.',
    officialDocReference: 'Guide ATC - Chapitre Céréales Toxiques',
    keywords: ['orge', 'malthouth', 'barley', 'شعير', 'ملثوث'],
  },
  {
    productNameFr: 'Farine de Sorgho Pure (Drou3 Nature)',
    productNameAr: 'درع تونسي خالص / طحين السورغو',
    category: 'GRAINS',
    isGlutenFree: true,
    status: 'CROSS_CONTAMINATION_RISK',
    brand: 'Moulins traditionnels',
    barcode: '',
    notes: 'ATTENTION RISQUE ÉLEVÉ. La graine de sorgho est naturellement sans gluten, mais les moulins traditionnels en Tunisie broient également du blé et de l’orge. N’acheter que le Drou3 certifié en paquet scellé portant le logo sans gluten.',
    notesAr: 'تنبيه: حبة الدرع خالية طبيعيا من الغلوتين لكن طحنها في المطاحن الشعبية المشتركة يسبب تلوثا خطيرا. اشتري فقط المعلب المعتمد.',
    officialDocReference: 'Alerte ATC - Moulins et Contamination Croisée',
    keywords: ['drou3', 'droua', 'sorgho', 'sorghum', 'درع', 'سحلب'],
  },
  {
    productNameFr: 'Farine de Riz Blanc Pure',
    productNameAr: 'فرينة الأرز الأبيض الخالص',
    category: 'GRAINS',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Certifiée Sans Gluten',
    barcode: '6193000300033',
    notes: 'AUTORISÉ. Idéal pour la pâtisserie, la préparation des crêpes et l’épaississement des sauces. Vérifier l’emballage pour la mention sans gluten.',
    notesAr: 'مرخص ومسموح. ممتاز لصنع الحلويات والخبز الخالي من الغلوتين.',
    officialDocReference: 'Guide ATC - Liste des Farines Pures',
    keywords: ['farine de riz', 'rice flour', 'ارز', 'فرينة رز'],
  },

  // --- PASTRY & TRADITIONAL PREPARATIONS ---
  {
    productNameFr: 'Feuilles de Brik Traditionnelles (Malsouka)',
    productNameAr: 'ورقة ملسوقة دياري بالفرينة والسميد',
    category: 'PASTRY',
    isGlutenFree: false,
    status: 'UNSAFE',
    brand: 'Artisanal / Marché',
    barcode: '',
    notes: 'STRICTEMENT INTERDIT. Préparée traditionnellement avec de la farine de blé blanche et de la semoule. Ne pas consommer le brik à l’œuf classique.',
    notesAr: 'ممنوع منعا باتا. ورقة الملسوقة التقليدية مصنوعة من السميد والفرينة (القمح).',
    officialDocReference: 'Guide ATC - Produits du Ramadan',
    keywords: ['malsouka', 'brik', 'feuille brik', 'borek', 'ملسوقة', 'بريك'],
  },
  {
    productNameFr: 'Feuilles de Malsouka Sans Gluten (Farine de Riz)',
    productNameAr: 'ورق ملسوقة خال من الغلوتين (بالأرز والنشا)',
    category: 'PASTRY',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Ateliers Spécialisés ATC',
    barcode: '6194000400044',
    notes: 'AUTORISÉ. Confectionné artisanalement dans un atelier dédié à base de farine de riz et fécule de tapioca. Parfait pour les briks tunisiens sécurisés.',
    notesAr: 'مرخص ومناسب للبريك التونسي. مصنوع في ورشة معزولة بالأرز ودقيق التابيوكا.',
    officialDocReference: 'Guide ATC - Substituts Festifs',
    keywords: ['malsouka sans gluten', 'brik sans gluten', 'ملسوقة خالية من الغلوتين'],
  },
  {
    productNameFr: 'Makroudh Traditionnel de Kairouan',
    productNameAr: 'مقروض القيروان التقليدي الأصلي',
    category: 'PASTRY',
    isGlutenFree: false,
    status: 'UNSAFE',
    brand: 'Pâtisseries Kairouanaises',
    barcode: '',
    notes: 'STRICTEMENT INTERDIT. La pâte est principalement composée de semoule de blé dur et frite dans des huiles parfois partagées. Consommer uniquement la version artisanale dédiée certifiée.',
    notesAr: 'ممنوع كليا. عجين المقروض بالسميد القمحي.',
    officialDocReference: 'Guide ATC - Pâtisseries Orientales',
    keywords: ['makroudh', 'makroud', 'kairouan', 'dates', 'مقروض', 'حلويات'],
  },
  {
    productNameFr: 'Bsissa Traditionnelle au Blé et Orge',
    productNameAr: 'بسيسة قمح وشعير تقليدية',
    category: 'GRAINS',
    isGlutenFree: false,
    status: 'UNSAFE',
    brand: 'Épiceries & Souk',
    barcode: '',
    notes: 'STRICTEMENT INTERDIT. Composée de blé et orge torréfiés moulus avec épices. Danger extrême pour les cœliaques.',
    notesAr: 'ممنوع بشدة. مزيج حبوب القمح والشعير المحمصة المطحونة.',
    officialDocReference: 'Guide ATC - Produits du Terroir',
    keywords: ['bsissa', 'bsisa', 'orge', 'ble', 'بسيسة'],
  },
  {
    productNameFr: 'Bsissa Sans Gluten aux Légumineuses (Pois chiches & Drou3 certifié)',
    productNameAr: 'بسيسة بدون غلوتين (حمص ودرع معتمد)',
    category: 'GRAINS',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Marques Terroir Agréées ATC',
    barcode: '6195000500055',
    notes: 'AUTORISÉ. Préparée exclusivement avec des pois chiches torréfiés, sorgho garanti et graines de fenouil nettoyées avec soin.',
    notesAr: 'مرخص ومسموح. تركيبة صحية خالية من القمح من الحمص والبهارات النقية.',
    officialDocReference: 'Guide ATC - Recettes Sécurisées',
    keywords: ['bsissa sans gluten', 'chickpea bsissa', 'بسيسة خالية من الغلوتين'],
  },

  // --- OILS & CONDIMENTS ---
  {
    productNameFr: 'Huile d’Olive Vierge Extra Tunisienne',
    productNameAr: 'زيت زيتون بكر ممتاز تونسي',
    category: 'OILS',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Toutes marques locales & Huileries',
    barcode: '6196000600066',
    notes: 'NATURELLEMENT SANS GLUTEN. Les huiles pures (olive, tournesol, maïs) 100% végétales sans arômes ajoutés ne contiennent aucun gluten.',
    notesAr: 'خالٍ من الغلوتين بطبيعته. زيت الزيتون الصافي مسموح به ولا يحمل أي مخاطر.',
    officialDocReference: 'Guide ATC - Huiles et Matières Grasses Pures',
    keywords: ['huile d olive', 'olive oil', 'zit', 'zitouna', 'chemlali', 'زيت زيتون'],
  },
  {
    productNameFr: 'Harissa Le Phare du Cap Bon (Boîte de conserve)',
    productNameAr: 'هريسة منارة كاب بون المعلبة',
    category: 'SPICES',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Le Phare du Cap Bon (SCAPCB)',
    barcode: '6191500700101',
    notes: 'AUTORISÉ. Composition : Piments rouges, ail, sel, coriandre et carvi. Ne contient ni additif ni farine de liaison.',
    notesAr: 'مرخص ومسموح. مكونات نقية من الفلفل والثوم والبهارات الطبيعية دون إضافات.',
    officialDocReference: 'Liste Officielle Produits Conditionnés ATC',
    keywords: ['harissa', 'cap bon', 'scapcb', 'piment', 'هريسة', 'كاب بون'],
  },
  {
    productNameFr: 'Harissa Artisanale en Vrac des Marchés',
    productNameAr: 'هريسة عربي صبة / أسواق شعبية',
    category: 'SPICES',
    isGlutenFree: false,
    status: 'CROSS_CONTAMINATION_RISK',
    brand: 'Vrac / Souk',
    barcode: '',
    notes: 'RISQUE DE CONTAMINATION. Les cuillères de service peuvent toucher du pain ou le matériel de broyage peut être partagé avec du blé. Préférer les bocaux scellés.',
    notesAr: 'خطر تلوث متبادل في الأسواق الشعبية بالخبز وأواني الغرف المشتركة.',
    officialDocReference: 'Recommandation Sécurité Marchés ATC',
    keywords: ['harissa arbi', 'vrac', 'souk', 'هريسة عربي'],
  },
  {
    productNameFr: 'Épices en Vrac du Souk (Coriandre, Cumin, Carvi)',
    productNameAr: 'توابل صبة من السوق (تابل، كروية، كمون)',
    category: 'SPICES',
    isGlutenFree: false,
    status: 'CROSS_CONTAMINATION_RISK',
    brand: 'Vrac / Épiciers',
    barcode: '',
    notes: 'VIGILANCE INDISPENSABLE. Les graines d’épices vendues en sacs ouverts au souk sont fréquemment mélangées avec des grains de blé lors des récoltes et du stockage. L’ATC conseille : Acheter en graines entières, trier minutieusement grain par grain, laver et sécher avant de moudre chez soi dans un moulin propre.',
    notesAr: 'تحذير شديد: بهارات الأسواق تختلط بحبوب القمح. يجب اقتناء الحبوب كاملة وغربلتها حبة بحبة وغسلها ثم طحنها منزليا.',
    officialDocReference: 'Guide Hygiène Épices ATC',
    keywords: ['epices', 'tebel', 'karouia', 'tabel', 'spices', 'توابل', 'بهارات', 'كروية'],
  },

  // --- MEATS & CHARCUTERIE ---
  {
    productNameFr: 'Viande Fraîche de Bœuf et d’Agneau Découpée',
    productNameAr: 'لحم بقري وعلوش طازج غير متبل',
    category: 'MEAT',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Boucheries Tunisiennes',
    barcode: '',
    notes: 'NATURELLEMENT SANS GLUTEN. La viande crue pure ne contient aucun gluten. Attention toutefois à la planche à découper du boucher si celui-ci prépare du merguez ou des escalopes panées.',
    notesAr: 'خالٍ من الغلوتين بطبيعته. اللحوم الطازجة غير المتبلة آمنة تماما.',
    officialDocReference: 'Guide Boucherie Sécurisée ATC',
    keywords: ['viande', 'boeuf', 'agneau', 'meat', 'لحم', 'قصاب'],
  },
  {
    productNameFr: 'Merguez Traditionnelle Artisanale de Boucherie',
    productNameAr: 'مرقاز تونسي تقليدي عند القصاب',
    category: 'MEAT',
    isGlutenFree: false,
    status: 'CROSS_CONTAMINATION_RISK',
    brand: 'Bouchers locaux',
    barcode: '',
    notes: 'RISQUE MAJEUR. De nombreux bouchers ajoutent de la chapelure de pain ou de la semoule pour lier la farce, ou utilisent des mélanges d’épices contaminés. Ne consommer que des merguez certifiées 100% viande et épices garanties sans gluten.',
    notesAr: 'خطر تلوث كبير: يستعمل بعض القصابين فتات الخبز (شابلور) أو سميد وتوابل ملوثة.',
    officialDocReference: 'Alerte Charcuterie & Merguez ATC',
    keywords: ['merguez', 'sausage', 'saucisse', 'مرقاز'],
  },

  // --- TRADITIONAL SPECIALTIES ---
  {
    productNameFr: 'Graines de Zgougou Entières (Pin d’Alep)',
    productNameAr: 'حبوب الزقوقو الخالصة (صنوبر حلبي)',
    category: 'FRUITS_VEG',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Forêts Tunisiennes / Vrac pur',
    barcode: '6197000700077',
    notes: 'AUTORISÉ AVEC PRÉCAUTION. La graine de pin d’Alep est sans gluten. Pour préparer l’Assida du Mouled en toute sécurité, utiliser de la farine d’amidon de maïs (Maïzena) ou farine de riz, et NE JAMAIS utiliser la farine de blé conventionnelle.',
    notesAr: 'مسموح وطبيعي. لكن يجب استعمال النشا أو فرينة الأرز في إعداد العصيدة وتجنب فرينة القمح.',
    officialDocReference: 'Guide Mouled & Assida ATC',
    keywords: ['zgougou', 'pin alep', 'assida', 'زقوقو', 'عصيدة'],
  },

  // --- CERTIFIED PACKAGED BRANDS POPULAR IN TUNISIA ---
  {
    productNameFr: 'Barilla Senza Glutine Spaghetti N.5 (400g)',
    productNameAr: 'سباغيتي باريلا بدون غلوتين نمرة 5',
    category: 'PROCESSED',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Barilla',
    barcode: '8076809545440',
    notes: 'PRODUIT CERTIFIÉ ÉPI BARRÉ. Formulé à base de maïs blanc, maïs jaune et riz. Très répandu dans les supermarchés tunisiens (Carrefour, Géant, Monoprix).',
    notesAr: 'منتج معتمد عالميا ومحليا. مصنوع من الذرة والأرز.',
    officialDocReference: 'Base Produits Certifiés ATC / AFDIAG',
    keywords: ['barilla', 'spaghetti', 'senza glutine', 'pates', 'باريلا', 'مقرونة'],
  },
  {
    productNameFr: 'Schär Pan Blanco Pain de Mie Sans Gluten (250g)',
    productNameAr: 'خبز توست شار الخالي من الغلوتين',
    category: 'PROCESSED',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Dr. Schär',
    barcode: '8008698002018',
    notes: 'LABEL INTERNATIONAL SANS GLUTEN. Pain de mie blanc garanti sans gluten et sans blé, enrichi en fibres.',
    notesAr: 'خبز توست آمن 100% ومطابق لأعلى معايير السلامة لمرضى السلياك.',
    officialDocReference: 'Base Produits Certifiés ATC',
    keywords: ['schar', 'pain blanc', 'pan blanco', 'toast', 'شار', 'خبز'],
  },
  {
    productNameFr: 'Délice Danone Yaourt Brassé Nature (Pot 110g)',
    productNameAr: 'ياغورت ديليس دانون طبيعي بدون سكر',
    category: 'DAIRY',
    isGlutenFree: true,
    status: 'SAFE',
    brand: 'Délice Danone',
    barcode: '6194001900123',
    notes: 'AUTORISÉ. Ingrédients : Lait frais pasteurisé, ferments lactiques vivants. Aucun épaississant ni amidon modifié de blé.',
    notesAr: 'مسموح وآمن. حليب مبستر مع خمائر اللبن دون أي نشا مضاف.',
    officialDocReference: 'Guide Produits Laitiers Simples ATC',
    keywords: ['delice', 'danone', 'yaourt', 'lait', 'ديليس', 'ياغورت'],
  },
];

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// French translations of the Arabic entries, keyed by original text
export function loadAtmcTranslations(dataFilePath) {
  const frPath = path.join(path.dirname(dataFilePath), 'ATMC2023.fr.json');
  if (!fs.existsSync(frPath)) return {};
  return JSON.parse(fs.readFileSync(frPath, 'utf8')).translations || {};
}

export function parseEntry(text) {
  let brand = '';
  let items = [];
  const colonIdx = text.indexOf(':');
  if (colonIdx > -1) {
    brand = text.substring(0, colonIdx).trim();
    const rest = text.substring(colonIdx + 1).trim();
    items = rest.split(/[,;\-\/]+/).map((s) => s.trim()).filter(Boolean);
  } else {
    items = text.split(/[,;\-\/]+/).map((s) => s.trim()).filter(Boolean);
  }
  return { brand, items };
}


const ATMC_STATUSES = [
  { key: 'allowed', status: 'ALLOWED', labelFr: 'Sans Gluten (Autorisé ATMC)', labelAr: 'خالٍ من الغلوتين (مرخص ATMC)' },
  { key: 'to_check', status: 'TO_CHECK', labelFr: 'À vérifier (Attention / Risque)', labelAr: 'للتثبت (حذر / قيد التحقق)' },
  { key: 'not_allowed', status: 'NOT_ALLOWED', labelFr: 'Contient du Gluten (Interdit ATMC)', labelAr: 'يحتوي على الغلوتين (ممنوع ATMC)' },
];

export function buildAtmcRows(dataDir = DATA_DIR) {
  const dataFile = path.join(dataDir, 'ATMC2023.json');
  const atmcData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const translations = loadAtmcTranslations(dataFile);
  const source = `${atmcData.organization || 'ATMC'} - ${atmcData.document_title || 'Guide'} (${atmcData.publication_date || '2023'})`;
  const rows = [];
  for (const cat of atmcData.categories || []) {
    for (const mapping of ATMC_STATUSES) {
      for (const rawText of cat[mapping.key] || []) {
        const { brand, items } = parseEntry(rawText);
        rows.push({
          category_fr: cat.category_fr,
          category_ar: cat.category_ar,
          category_slug: slugify(cat.category_fr),
          status: mapping.status,
          status_label_fr: mapping.labelFr,
          status_label_ar: mapping.labelAr,
          name: rawText,
          name_fr: translations[rawText] || rawText,
          brand: brand || '',
          items,
          raw_text: rawText,
          source,
        });
      }
    }
  }
  return rows;
}

export const spotRows = () =>
  spotsSeed.map((s) => ({
    name: s.name,
    category: s.category,
    lng: s.location.coordinates[0],
    lat: s.location.coordinates[1],
    city: s.city,
    address: s.address,
    phone: s.phone || '',
    is_verified: s.isVerified ?? false,
    speciality: s.speciality || '',
    hours: s.hours || '',
    // No ratings: there is no review system, and invented ones would mislead people
    notes: s.notes || '',
    submitted_by: s.submittedBy || 'Community / Admin',
    cross_contamination_risk: s.crossContaminationRisk ?? false,
    media: s.media || [],
    links: s.links || [],
  }));

export const associationProductRows = () =>
  associationProductsSeed.map((p) => ({
    product_name_fr: p.productNameFr,
    product_name_ar: p.productNameAr,
    category: p.category,
    is_gluten_free: p.isGlutenFree,
    status: p.status || 'SAFE',
    brand: p.brand || 'Staple / Local Produce',
    barcode: p.barcode || '',
    notes: p.notes,
    notes_ar: p.notesAr || '',
    official_doc_reference: p.officialDocReference || "Guide Officiel de l'Association Tunisienne de la Cœliaque (ATC)",
    keywords: p.keywords || [],
  }));
