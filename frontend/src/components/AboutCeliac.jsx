import React from 'react';
import { BookOpen, Camera, Check, Dna, Flame, HelpCircle, MapPin, Pill, Plus, Refrigerator, Stethoscope, Tag, TestTube, Users, Utensils, Wheat, X } from 'lucide-react';
import { t, StatusTile, PageLink } from './ui';
import { Reveal, VilliWindow, FoodArt } from './celiacArt';

/**
 * "Comprendre": what celiac disease is, where it comes from, the first steps after a diagnosis,
 * what is off the table and what to look for on a label. Written for someone who has just been
 * diagnosed, or who cooks for someone who has. Every text is a [French, Arabic] pair.
 */

const IS = [
  {
    title: ['Une maladie auto-immune', 'مرض مناعي ذاتي'],
    text: ['Le corps prend le gluten pour un ennemi et, en se défendant, abîme son propre intestin.', 'يعتبر الجسم الغلوتين عدوا، وحين يدافع عن نفسه يُتلف أمعاءه.'],
  },
  {
    title: ['Fréquente, et souvent ignorée', 'شائع، وكثيرا ما يُجهل'],
    text: ['Environ une personne sur cent est concernée, et la plupart ne le savent pas encore.', 'يصيب نحو شخص من كل مئة، وأغلبهم لا يعلمون بعد.'],
  },
  {
    title: ['Pour la vie, mais bien maîtrisée', 'مدى الحياة، لكن يمكن التحكم فيه'],
    text: ['Elle ne disparaît pas. Sans gluten, l’intestin guérit et l’on vit normalement.', 'لا يزول. لكن بدون غلوتين تُشفى الأمعاء ويعيش المريض حياة عادية.'],
  },
];

const IS_NOT = [
  {
    title: ['Une allergie au blé', 'حساسية من القمح'],
    text: ['Pas de réaction immédiate : les dégâts se font en silence, repas après repas.', 'لا رد فعل فوريا: الضرر يحدث في صمت، وجبة بعد وجبة.'],
  },
  {
    title: ['Un régime à la mode', 'حمية على الموضة'],
    text: ['« Juste un petit peu » n’existe pas : une trace de gluten suffit à relancer l’attaque.', 'لا وجود لـ«قليل فقط»: أثر من الغلوتين يكفي لتجدد الهجوم.'],
  },
  {
    title: ['Contagieuse', 'مرضا معديا'],
    text: ['On ne l’attrape pas, et on ne la transmet pas en partageant un repas.', 'لا يُلتقط، ولا ينتقل بمشاركة الطعام.'],
  },
];

const SIGNS = [
  ['Ventre ballonné', 'انتفاخ البطن'],
  ['Diarrhée ou constipation', 'إسهال أو إمساك'],
  ['Fatigue qui dure', 'تعب مستمر'],
  ['Anémie, manque de fer', 'فقر الدم ونقص الحديد'],
  ['Perte de poids', 'نقص الوزن'],
  ['Croissance ralentie chez l’enfant', 'تأخر النمو عند الطفل'],
  ['Aphtes à répétition', 'تقرحات متكررة في الفم'],
  ['Douleurs des os et des articulations', 'آلام العظام والمفاصل'],
  ['Boutons qui démangent', 'طفح جلدي مثير للحكة'],
];

const FACTORS = [
  {
    icon: Dna,
    tone: 'bg-canvas-sunk text-secondary-dark',
    title: ['Des gènes', 'جينات'],
    text: ['HLA-DQ2 ou DQ8, hérités des parents', 'HLA-DQ2 أو DQ8، موروثة عن الوالدين'],
  },
  {
    icon: Wheat,
    tone: 'bg-accent-tint text-accent-dark',
    title: ['Du gluten', 'الغلوتين'],
    text: ['la protéine du blé, de l’orge et du seigle', 'بروتين القمح والشعير والجاودار'],
  },
  {
    icon: HelpCircle,
    tone: 'bg-primary-tint text-primary-dark',
    title: ['Un déclencheur', 'عامل مُحفِّز'],
    text: ['encore mal connu : parfois une infection, une grossesse, une opération', 'ما زال غير معروف جيدا: أحيانا عدوى أو حمل أو عملية جراحية'],
  },
];

const ORIGIN_FACTS = [
  ['Près d’une personne sur trois porte ces gènes. La très grande majorité ne sera jamais malade.', 'يحمل هذه الجينات نحو شخص من كل ثلاثة، والغالبية العظمى لن تمرض أبدا.'],
  [
    'Parent, frère, sœur ou enfant d’une personne cœliaque : le risque passe à environ un sur dix. Un dépistage de la famille est conseillé.',
    'والد أو أخ أو أخت أو ابن لمريض: يرتفع الاحتمال إلى نحو واحد من عشرة. يُنصح بفحص أفراد العائلة.',
  ],
  ['Elle peut se déclarer à tout âge, du nourrisson à la personne âgée.', 'قد يظهر في أي عمر، من الرضيع إلى المسن.'],
];

const STEPS = [
  {
    icon: TestTube,
    title: ['Confirmez avant de changer d’assiette', 'أكّد التشخيص قبل تغيير طعامك'],
    text: [
      'Continuez à manger du gluten jusqu’à la prise de sang et la biopsie : l’arrêter trop tôt fausse les résultats.',
      'واصل أكل الغلوتين إلى حين تحليل الدم والخزعة: إيقافه مبكرا يُزيّف النتائج.',
    ],
  },
  {
    icon: Stethoscope,
    title: ['Entourez-vous', 'استعن بالمختصين'],
    text: [
      'Un gastro-entérologue pour le suivi, un nutritionniste pour réapprendre à composer vos repas.',
      'طبيب أمراض الجهاز الهضمي للمتابعة، وأخصائي تغذية لتتعلم تركيب وجباتك من جديد.',
    ],
    link: { to: 'map', label: ['Trouver un médecin sur la carte', 'ابحث عن طبيب على الخريطة'] },
  },
  {
    icon: Refrigerator,
    title: ['Faites le tri dans la cuisine', 'رتّب مطبخك'],
    text: [
      'Une étagère réservée, un grille-pain, une passoire et une planche à part, vos propres pots de beurre et de confiture.',
      'رف خاص، ومحمصة خبز ومصفاة ولوح تقطيع خاصة بك، وعلب زبدة ومربى لك وحدك.',
    ],
  },
  {
    icon: Tag,
    title: ['Apprenez à lire une étiquette', 'تعلّم قراءة الملصق'],
    text: ['Blé, orge, seigle, malt : quatre mots à repérer. Pour le reste, le scanner vous aide.', 'قمح، شعير، جاودار، مالت: أربع كلمات تبحث عنها. وفي الباقي يساعدك الماسح.'],
    link: { to: 'vision', label: ['Scanner un produit', 'امسح منتجا'] },
  },
  {
    icon: Utensils,
    title: ['Repartez de ce qui est naturellement sans gluten', 'انطلق مما هو خالٍ من الغلوتين بطبيعته'],
    text: [
      'Riz, maïs, pommes de terre, légumes secs, légumes, fruits, viande, poisson, œufs, lait : l’essentiel de la cuisine tunisienne reste à vous.',
      'أرز، ذرة، بطاطا، بقول، خضر، غلال، لحم، سمك، بيض، حليب: معظم المطبخ التونسي يبقى لك.',
    ],
  },
  {
    icon: Users,
    title: ['Gardez le lien', 'حافظ على المتابعة'],
    text: [
      'Un contrôle sanguin régulier, le dépistage de vos proches, et l’ATMC pour ne pas avancer seul.',
      'تحليل دم دوري، وفحص أقاربك، والجمعية التونسية لمرضى الأبطن حتى لا تسير وحدك.',
    ],
  },
];

const HARD_NOS = [
  { art: 'bread', name: ['Pain', 'الخبز'], more: ['baguette, tabouna, mlawi', 'باقات، طابونة، ملاوي'] },
  { art: 'couscous', name: ['Couscous', 'الكسكسي'], more: ['et toute semoule de blé', 'وكل سميد القمح'] },
  { art: 'pasta', name: ['Pâtes', 'العجين'], more: ['makrouna, nouasser, hlalem', 'مقرونة، نواصر، حلالم'] },
  { art: 'brik', name: ['Brik', 'البريك'], more: ['feuilles de malsouka', 'ورق الملسوقة'] },
  { art: 'cake', name: ['Gâteaux', 'المرطبات'], more: ['pâtisseries, makroudh', 'حلويات، مقروض'] },
  { art: 'biscuits', name: ['Biscuits', 'البسكويت'], more: ['gaufrettes, cakes, céréales', 'قوفرات، كيك، حبوب الإفطار'] },
  { art: 'pizza', name: ['Pizza', 'البيتزا'], more: ['quiches, tartes, sandwichs', 'كيش، تارت، سندويتشات'] },
  { art: 'soup', name: ['Chorba frik', 'شربة فريك'], more: ['borghol, bsissa de blé ou d’orge', 'برغل، بسيسة القمح أو الشعير'] },
  { art: 'fritter', name: ['Beignets', 'الفطائر'], more: ['bambalouni, ftayer, panure', 'بمبالوني، فطاير، فتات الخبز'] },
  { art: 'beer', name: ['Bière', 'الجعة'], more: ['et boissons maltées', 'والمشروبات بالمالت'] },
];

const ALLOWED = [
  ['Riz', 'أرز'],
  ['Maïs', 'ذرة'],
  ['Pommes de terre', 'بطاطا'],
  ['Pois chiches, lentilles, fèves', 'حمص، عدس، فول'],
  ['Légumes et fruits', 'خضر وغلال'],
  ['Viande, poisson, œufs', 'لحم، سمك، بيض'],
  ['Lait et yaourt nature', 'حليب وياغرت طبيعي'],
  ['Huile d’olive', 'زيت الزيتون'],
  ['Dattes', 'تمر'],
  ['Sarrasin, quinoa, millet', 'حنطة سوداء، كينوا، دخن'],
];

// Modified starches: the "E14xx" family
const E14 = ['E1404', 'E1410', 'E1412', 'E1413', 'E1414', 'E1420', 'E1422', 'E1440', 'E1442', 'E1450', 'E1451'];

const WORDS = {
  unsafe: [
    ['Malt, extrait de malt, sirop de malt d’orge', 'المالت، مستخلص المالت، شراب مالت الشعير'],
    ['Gluten de blé, protéines de blé, seitan', 'غلوتين القمح، بروتينات القمح، السيتان'],
    ['Amidon de blé, sauf produit étiqueté sans gluten', 'نشا القمح، إلا في منتج مكتوب عليه «بدون غلوتين»'],
    ['Levure de bière', 'خميرة الجعة'],
    ['Chapelure, son et germe de blé', 'فتات الخبز، نخالة القمح وجنينه'],
  ],
  warning: [
    ['« Amidon », « farine » ou « épaississant » sans céréale précisée', '«نشا» أو «دقيق» أو «مُكثّف» دون ذكر نوع الحبوب'],
    ['Protéines végétales, sans origine', 'بروتينات نباتية دون ذكر المصدر'],
    ['« Peut contenir des traces de gluten »', '«قد يحتوي على آثار الغلوتين»'],
  ],
  safe: [
    ['Maltodextrine, dextrose, sirop de glucose : purifiés, même tirés du blé', 'مالتودكسترين، دكستروز، شراب الغلوكوز: مُنقّاة حتى لو استُخرجت من القمح'],
    ['E150, les caramels', 'E150، الكراميل'],
    ['E965 maltitol, E953 isomalt', 'E965 مالتيتول، E953 إيزومالت'],
    ['E621, le glutamate : le nom ressemble, rien de plus', 'E621 الغلوتامات: تشابه في الاسم لا غير'],
    ['Sarrasin, dit « blé noir » : ce n’est pas du blé', 'الحنطة السوداء: ليست قمحا'],
    ['Amidon de maïs, fécule de pomme de terre', 'نشا الذرة، نشا البطاطا'],
  ],
};

const jumpTo = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const textLink = 'font-medium text-primary-dark underline decoration-primary-dark/30 underline-offset-4 hover:decoration-primary-dark';

export default function AboutCeliac({ lang }) {
  const tr = t(lang);
  const p = ([fr, ar]) => tr(fr, ar);

  return (
    <div className="space-y-24 pb-6 pt-2 sm:space-y-28 lg:space-y-36">
      {/* Opening: the page starts inside the intestine, where the disease happens */}
      <section className="grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div className="lg:pt-10">
          <h1 className="page-title max-w-[14ch]">{tr('Comprendre la maladie cœliaque', 'افهم مرض الأبطن')}</h1>
          <p className="page-lede max-w-[46ch]">
            {tr(
              'Ce n’est ni une mode ni une allergie : c’est une maladie auto-immune, qui touche environ une personne sur cent. Elle se soigne sans médicament, en retirant le gluten de l’assiette, pour de bon.',
              'ليس موضة ولا حساسية: هو مرض مناعي ذاتي يصيب نحو شخص من كل مئة. علاجه ليس دواء، بل إزالة الغلوتين من الطعام نهائيا.'
            )}
          </p>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-ink-soft">
            {tr('Si le diagnostic vient de tomber, cette page est pour vous : l’essentiel, sans jargon.', 'إذا شُخّص المرض لديك حديثا فهذه الصفحة لك: الأهم، بكلمات بسيطة.')}
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <button type="button" className="btn-primary" onClick={jumpTo('premiers-pas')}>
              {tr('Les premiers pas', 'الخطوات الأولى')}
            </button>
            <button type="button" className="btn-quiet" onClick={jumpTo('interdits')}>
              {tr('Ce qu’il faut éviter', 'ما يجب تجنبه')}
            </button>
          </div>
        </div>
        <VilliWindow lang={lang} />
      </section>

      {/* What it is, what it is not */}
      <section aria-labelledby="about-is">
        <Reveal>
          <h2 id="about-is" className="section-title mx-auto max-w-[20ch] text-center">
            {tr('Ce qu’elle est, et ce qu’elle n’est pas', 'حقيقة المرض، وما يُظن خطأً')}
          </h2>
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2 md:gap-6">
          <Reveal kind="start" className="rounded-3xl bg-primary-tint p-6 sm:p-7">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">{tr('C’est', 'هو')}</h3>
            <FactList items={IS} kind="safe" p={p} />
          </Reveal>
          <Reveal kind="end" delay={120} className="panel rounded-3xl p-6 sm:p-7 md:mt-12">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">{tr('Ce n’est pas', 'ليس')}</h3>
            <FactList items={IS_NOT} kind="unsafe" p={p} />
          </Reveal>
        </div>

        <div className="mx-auto mt-16 max-w-3xl text-center">
          <Reveal>
            <h3 className="text-xl font-semibold tracking-[-0.01em]">{tr('Les signes qui mettent sur la piste', 'علامات تدل عليه')}</h3>
          </Reveal>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {SIGNS.map((sign, i) => (
              <Reveal as="li" kind="pop" delay={i * 45} key={sign[0]} className="rounded-full bg-canvas-paper px-4 py-2 text-[15px] shadow-[inset_0_0_0_1px_var(--chip-line)]">
                {p(sign)}
              </Reveal>
            ))}
            <Reveal as="li" kind="pop" delay={SIGNS.length * 45 + 120} className="rounded-full bg-ink px-4 py-2 text-[15px] font-medium text-canvas-paper">
              {tr('Parfois, aucun signe', 'أحيانا، لا علامة إطلاقا')}
            </Reveal>
          </ul>
          <p className="mx-auto mt-5 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
            {tr(
              'Ces signes ne suffisent pas à conclure. Seule une prise de sang, le plus souvent suivie d’une biopsie, confirme la maladie.',
              'هذه العلامات لا تكفي للحكم. تحليل الدم، المتبوع غالبا بخزعة، هو وحده ما يؤكد المرض.'
            )}
          </p>
        </div>
      </section>

      {/* Where it comes from: the three things that have to meet */}
      <section aria-labelledby="about-origin" className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="lg:order-2">
          <Reveal kind="end">
            <h2 id="about-origin" className="section-title">
              {tr('D’où vient-elle ?', 'من أين يأتي؟')}
            </h2>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-ink-soft">
              {tr(
                'Ce n’est la faute de personne : ni de ce que vous avez mangé, ni de la façon dont vous avez nourri votre enfant. La maladie apparaît quand trois choses se rencontrent.',
                'ليس ذنب أحد: لا بسبب ما أكلت، ولا بسبب طريقة تغذيتك لطفلك. يظهر المرض حين تجتمع ثلاثة أمور.'
              )}
            </p>
          </Reveal>
          <ul className="mt-6 max-w-[54ch] space-y-3.5">
            {ORIGIN_FACTS.map((fact, i) => (
              <Reveal as="li" kind="end" delay={100 + i * 90} key={fact[0]} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="mt-[0.55em] h-2 w-2 shrink-0 rounded-[3px] bg-primary" aria-hidden="true" />
                <span>{p(fact)}</span>
              </Reveal>
            ))}
          </ul>
        </div>

        {/* The formula steps across the column, one factor at a time */}
        <div className="lg:order-1" role="group" aria-label={tr('Gènes, gluten et déclencheur : la maladie se déclare', 'جينات وغلوتين وعامل محفز: يظهر المرض')}>
          {FACTORS.map(({ icon: Icon, tone, title, text }, i) => (
            <React.Fragment key={title[0]}>
              {i > 0 && (
                <Reveal kind="pop" delay={i * 260 - 120} className={`my-1.5 flex h-8 w-20 items-center justify-center text-ink-faint sm:w-24 ${['', 'ms-[8%]', 'ms-[20%]'][i]}`} aria-hidden="true">
                  <Plus className="h-6 w-6" strokeWidth={2.5} />
                </Reveal>
              )}
              <Reveal kind="pop" delay={i * 260} className={`flex items-center gap-4 ${['', 'ms-[12%]', 'ms-[24%]'][i]}`}>
                <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full sm:h-24 sm:w-24 ${tone}`}>
                  <Icon className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold tracking-[-0.01em]">{p(title)}</span>
                  <span className="block max-w-[26ch] text-[15px] leading-snug text-ink-soft">{p(text)}</span>
                </span>
              </Reveal>
            </React.Fragment>
          ))}
          <Reveal kind="pop" delay={FACTORS.length * 260 + 80} className="ms-[20%] mt-5 flex items-center gap-3 sm:ms-[36%]">
            <span className="text-3xl font-light leading-none text-ink-faint" aria-hidden="true">
              =
            </span>
            <span className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-semibold text-canvas-paper">{tr('La maladie se déclare', 'يظهر المرض')}</span>
          </Reveal>
        </div>
      </section>

      {/* First steps: a real sequence, so it is numbered and runs down a line */}
      <section id="premiers-pas" aria-labelledby="about-steps" className="scroll-mt-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 id="about-steps" className="section-title">
            {tr('Les premiers pas après le diagnostic', 'الخطوات الأولى بعد التشخيص')}
          </h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">
            {tr('Six étapes, dans l’ordre. Personne ne les réussit toutes dès le premier jour.', 'ست خطوات بالترتيب. لا أحد يُتقنها كلها من اليوم الأول.')}
          </p>
        </Reveal>

        <ol className="relative mx-auto mt-12 max-w-4xl space-y-8 lg:space-y-2">
          <span aria-hidden="true" className="absolute bottom-3 start-[19px] top-3 w-0.5 rounded-full bg-canvas-edge lg:start-1/2 lg:-translate-x-1/2 lg:rtl:translate-x-1/2" />
          {STEPS.map(({ icon: Icon, title, text, link }, i) => {
            const onEnd = i % 2 === 1;
            return (
              <li key={title[0]} className="relative grid ps-14 lg:grid-cols-2 lg:gap-x-20 lg:ps-0">
                <span className="absolute start-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-base font-semibold tabular-nums text-canvas-paper lg:start-1/2 lg:-translate-x-1/2 lg:rtl:translate-x-1/2">
                  {i + 1}
                </span>
                <Reveal kind={onEnd ? 'end' : 'start'} className={onEnd ? 'lg:col-start-2' : 'lg:text-end'}>
                  <div className={`flex items-center gap-2.5 ${onEnd ? '' : 'lg:flex-row-reverse'}`}>
                    <Icon className="h-5 w-5 shrink-0 text-primary-dark" strokeWidth={2} aria-hidden="true" />
                    <h3 className="text-lg font-semibold leading-snug tracking-[-0.01em]">{p(title)}</h3>
                  </div>
                  <p className={`mt-1.5 max-w-[44ch] text-[15px] leading-relaxed text-ink-soft ${onEnd ? '' : 'lg:ms-auto'}`}>{p(text)}</p>
                  {link && (
                    <p className="mt-2 text-[15px]">
                      <PageLink to={link.to} className={textLink}>
                        {p(link.label)}
                      </PageLink>
                    </p>
                  )}
                </Reveal>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The hard NOs */}
      <section id="interdits" aria-labelledby="about-nos" className="scroll-mt-28">
        <Reveal className="ms-auto max-w-xl text-end">
          <h2 id="about-nos" className="section-title">
            {tr('Les non, sans discussion', 'ممنوعات لا نقاش فيها')}
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            {tr('Tout ce qui est fait de blé, d’orge ou de seigle, même en petite quantité.', 'كل ما يُصنع من القمح أو الشعير أو الجاودار، ولو بكمية قليلة.')}
          </p>
        </Reveal>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {HARD_NOS.map(({ art, name, more }, i) => (
            <Reveal as="li" kind="pop" delay={(i % 5) * 70} key={art} className="panel relative p-2.5 pb-3.5 even:mt-6">
              <div className="flex aspect-[4/3] items-center justify-center rounded-[15px] bg-accent-tint/70">
                <FoodArt name={art} className="h-[78%]" />
              </div>
              <span className="stamp absolute end-1 top-1">
                <StatusTile kind="unsafe" size="sm" className="shadow-[0_0_0_3px_rgb(var(--c-paper))]" />
              </span>
              <p className="mt-3 px-1.5 text-base font-semibold leading-tight">{p(name)}</p>
              <p className="mt-0.5 px-1.5 text-sm leading-snug text-ink-soft">{p(more)}</p>
            </Reveal>
          ))}
        </ul>

        {/* …and the long list of what stays on the table */}
        <Reveal className="mt-14 rounded-3xl bg-primary-tint px-5 py-8 text-center sm:px-10 sm:py-10">
          <h3 className="text-[1.375rem] font-semibold tracking-[-0.015em] sm:text-2xl">{tr('Et tout ceci reste permis', 'وكل هذا يبقى مسموحا')}</h3>
          <p className="mx-auto mt-1.5 max-w-[50ch] text-[15px] text-ink-soft">
            {tr('Tant que c’est nature : ni pané, ni fariné, ni dans une sauce inconnue.', 'ما دام طبيعيا: غير مغلف بفتات الخبز، ولا بالدقيق، ولا في صلصة مجهولة.')}
          </p>
          <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
            {ALLOWED.map((food) => (
              <li key={food[0]} className="inline-flex items-center gap-2 rounded-full bg-canvas-paper py-1.5 pe-4 ps-1.5 text-[15px]">
                <StatusTile kind="safe" size="sm" className="rounded-full" />
                {p(food)}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Hidden gluten, and how to read a label */}
      <section aria-labelledby="about-label">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
          <Reveal kind="start">
            <h2 id="about-label" className="section-title">
              {tr('Le gluten qui ne dit pas son nom', 'الغلوتين المتخفّي')}
            </h2>
            <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-ink-soft">
              {tr(
                'Il sert à épaissir, à lier, à donner du goût, et se glisse là où on ne l’attend pas : sauce soja, bouillon en cube, soupes en sachet, mélanges d’épices, charcuterie, surimi, chips aromatisées, bonbons, chocolat aux céréales.',
                'يُستعمل للتكثيف والربط وإضافة النكهة، ويتسلل إلى حيث لا نتوقعه: صلصة الصويا، مكعبات المرق، الشوربة الجاهزة، خلطات التوابل، اللحوم المصنعة، السوريمي، الشيبس المنكّه، الحلوى، الشوكولاتة بالحبوب.'
              )}
            </p>
            <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-ink-soft">
              {tr(
                '« Sans blé » ne veut pas dire « sans gluten » : l’orge et le seigle en contiennent aussi. Cherchez la mention « sans gluten » ou l’épi barré.',
                '«بدون قمح» لا تعني «بدون غلوتين»: الشعير والجاودار يحتويان عليه أيضا. ابحث عن عبارة «بدون غلوتين» أو رمز السنبلة المشطوبة.'
              )}
            </p>
          </Reveal>

          <Reveal kind="pop" className="mx-auto w-full max-w-md">
            <IngredientLabel lang={lang} />
          </Reveal>
        </div>

        <Reveal className="mt-16">
          <h3 className="text-center text-[1.375rem] font-semibold tracking-[-0.015em] sm:text-2xl">{tr('Additifs et mots à surveiller', 'مضافات وكلمات تستحق الانتباه')}</h3>
        </Reveal>
        <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_1.25fr_1fr] lg:items-start">
          <Reveal kind="rise" className="panel p-5 lg:mt-10">
            <WordsHead kind="unsafe" label={tr('À éviter', 'تجنّبها')} />
            <WordList items={WORDS.unsafe} p={p} />
          </Reveal>

          <Reveal kind="rise" delay={110} className="rounded-3xl bg-accent-tint p-5 sm:p-6">
            <WordsHead kind="warning" label={tr('À vérifier', 'تثبّت منها')} />
            <p className="mt-4 text-[3.25rem] font-bold leading-none tracking-[-0.03em] text-accent-dark sm:text-6xl" dir="ltr">
              E14<span className="opacity-45">xx</span>
            </p>
            <p className="mt-2 font-semibold">{tr('Les amidons modifiés, de E1404 à E1451', 'النشويات المعدّلة، من E1404 إلى E1451')}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
              {tr(
                'Sans gluten quand ils viennent du maïs, de la pomme de terre ou du manioc. Si la céréale n’est pas écrite, le doute reste.',
                'خالية من الغلوتين إذا كان مصدرها الذرة أو البطاطا أو المنيهوت. إذا لم يُذكر المصدر يبقى الشك.'
              )}
            </p>
            <ul className="mt-3.5 flex flex-wrap gap-1.5" dir="ltr" aria-label={tr('Codes des amidons modifiés', 'رموز النشويات المعدّلة')}>
              {E14.map((code) => (
                <li key={code} className="rounded-md bg-canvas-paper/80 px-2 py-0.5 text-sm font-medium tabular-nums">
                  {code}
                </li>
              ))}
            </ul>
            <WordList items={WORDS.warning} p={p} className="mt-5 border-t border-ink/10 pt-4" />
          </Reveal>

          <Reveal kind="rise" delay={220} className="panel p-5 lg:mt-20">
            <WordsHead kind="safe" label={tr('Fausses alertes', 'إنذارات كاذبة')} />
            <WordList items={WORDS.safe} p={p} />
          </Reveal>
        </div>
        <p className="mx-auto mt-8 max-w-[62ch] text-center text-[15px] leading-relaxed text-ink-soft">
          {tr(
            'En Tunisie, l’origine d’un amidon n’est pas toujours indiquée. Au moindre doute, cherchez le produit dans le guide de l’ATMC.',
            'في تونس لا يُذكر مصدر النشا دائما. عند أي شك، ابحث عن المنتج في دليل الجمعية.'
          )}{' '}
          <PageLink to="atmc" className={textLink}>
            {tr('Parcourir le guide ATMC', 'تصفح دليل الجمعية')}
          </PageLink>
        </p>
      </section>

      {/* Everyday habits */}
      <section aria-labelledby="about-tips">
        <Reveal>
          <h2 id="about-tips" className="section-title max-w-[18ch]">
            {tr('Cinq réflexes pour tous les jours', 'خمس عادات لكل يوم')}
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-6">
          <Reveal kind="start" className="panel flex flex-col gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8 lg:col-span-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-2xl font-semibold tracking-[-0.02em]">{tr('Une miette compte', 'الفتات يُحسب')}</h3>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-ink-soft">
                {tr(
                  'Le seuil « sans gluten » est de 20 mg de gluten par kilo d’aliment. Une cuillère en bois, un grille-pain ou un couteau à beurre partagés suffisent à contaminer un repas.',
                  'حدّ «بدون غلوتين» هو 20 مغ من الغلوتين في كل كيلوغرام من الطعام. ملعقة خشبية أو محمصة أو سكين زبدة مشتركة تكفي لتلويث وجبة.'
                )}
              </p>
            </div>
            {/* 20 mg next to a kilo, to scale as far as a screen allows */}
            <div className="flex shrink-0 items-end gap-4" aria-hidden="true">
              <div className="text-center">
                <span className="flex h-28 w-28 items-center justify-center rounded-[1.75rem] bg-canvas-sunk">
                  <FoodArt name="bread" className="h-20" />
                </span>
                <span className="mt-2 block text-sm font-medium">{tr('1 kg', '1 كغ')}</span>
              </div>
              <div className="text-center">
                <span className="flex h-28 w-10 items-end justify-center pb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-unsafe" />
                </span>
                <span className="mt-2 block whitespace-nowrap text-sm font-medium text-status-unsafe-ink">{tr('20 mg', '20 مغ')}</span>
              </div>
            </div>
          </Reveal>

          <Tip
            className="bg-accent-tint lg:col-span-2"
            kind="end"
            icon={Flame}
            title={tr('Friture et four : chacun le sien', 'القلي والفرن: لكل طعامه')}
            text={tr(
              'Une huile qui a frit des bricks ou des beignets contamine les frites. Même chose pour une plaque farinée.',
              'الزيت الذي قُلي فيه البريك أو الفطائر يلوث البطاطا المقلية. وكذلك صينية عليها دقيق.'
            )}
          />
          <Tip
            className="bg-primary-tint lg:col-span-2 lg:-mt-2"
            delay={0}
            icon={Utensils}
            title={tr('À table chez les autres', 'على مائدة الآخرين')}
            text={tr(
              'Prévenez avant, demandez comment c’est préparé, et sans réponse claire, abstenez-vous. Ce n’est pas impoli : c’est votre traitement.',
              'أخبرهم مسبقا، واسأل عن طريقة التحضير، وإن لم تجد جوابا واضحا فامتنع. ليس ذلك قلة ذوق، بل هو علاجك.'
            )}
          >
            <PageLink to="map" className={textLink}>
              {tr('Voir les adresses sûres', 'اطّلع على العناوين الموثوقة')}
            </PageLink>
          </Tip>
          <Tip
            className="panel lg:col-span-2 lg:mt-6"
            delay={110}
            icon={Pill}
            title={tr('Médicaments : demandez au pharmacien', 'الأدوية: اسأل الصيدلي')}
            text={tr('Certains comprimés et sirops utilisent de l’amidon de blé comme excipient.', 'بعض الأقراص والأشربة تستعمل نشا القمح كمادة مضافة.')}
          />
          <Tip
            className="bg-canvas-sunk lg:col-span-2 lg:-mt-2"
            delay={220}
            icon={Wheat}
            title={tr('Avoine : pas tout de suite', 'الشوفان: ليس الآن')}
            text={tr('Seulement étiquetée sans gluten, et avec l’accord de votre médecin.', 'فقط إذا كان مكتوبا عليه «بدون غلوتين»، وبموافقة طبيبك.')}
          />
        </div>
      </section>

      {/* Where to go next */}
      <Reveal as="section" kind="pop" aria-labelledby="about-next" className="rounded-[2.25rem] bg-primary-tint px-5 py-12 text-center sm:px-10 sm:py-16">
        <h2 id="about-next" className="section-title">
          {tr('Un doute devant un produit ?', 'شكّ أمام منتج؟')}
        </h2>
        <p className="mx-auto mt-3 max-w-[44ch] text-[17px] leading-relaxed text-ink-soft">
          {tr('Photographiez-le, ou cherchez-le dans le guide de l’ATMC.', 'صوّره، أو ابحث عنه في دليل الجمعية.')}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <PageLink to="vision" className="btn-primary">
            <Camera className="h-[18px] w-[18px]" aria-hidden="true" />
            {tr('Scanner un produit', 'امسح منتجا')}
          </PageLink>
          <PageLink to="atmc" className="btn bg-canvas-paper text-ink hover:brightness-[0.97]">
            <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
            {tr('Parcourir le guide ATMC', 'تصفح دليل الجمعية')}
          </PageLink>
          <PageLink to="map" className="btn bg-canvas-paper text-ink hover:brightness-[0.97]">
            <MapPin className="h-[18px] w-[18px]" aria-hidden="true" />
            {tr('Trouver un médecin', 'ابحث عن طبيب')}
          </PageLink>
        </div>
        <p className="mx-auto mt-9 max-w-[58ch] text-sm leading-relaxed text-ink-soft">
          {tr(
            'Cette page informe, elle ne remplace pas une consultation. Votre gastro-entérologue et votre nutritionniste restent vos références.',
            'هذه الصفحة للتوعية ولا تعوّض الاستشارة الطبية. طبيبك المختص وأخصائي التغذية هما مرجعك.'
          )}
        </p>
      </Reveal>
    </div>
  );
}

function FactList({ items, kind, p }) {
  const Icon = kind === 'safe' ? Check : X;
  return (
    <ul className="mt-5 space-y-5">
      {items.map(({ title, text }) => (
        <li key={title[0]} className="flex gap-3.5">
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-tile ${kind === 'safe' ? 'bg-status-safe text-onbright' : 'bg-status-unsafe text-white'}`} aria-hidden="true">
            <Icon className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span>
            <span className="block font-semibold leading-snug">{p(title)}</span>
            <span className="mt-1 block text-[15px] leading-relaxed text-ink-soft">{p(text)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function WordsHead({ kind, label }) {
  return (
    <p className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em]">
      <StatusTile kind={kind} size="sm" />
      {label}
    </p>
  );
}

function WordList({ items, p, className = 'mt-4' }) {
  return (
    <ul className={`space-y-2.5 text-[15px] leading-snug ${className}`}>
      {items.map((item) => (
        <li key={item[0]}>{p(item)}</li>
      ))}
    </ul>
  );
}

function Tip({ icon: Icon, title, text, children, className = '', kind = 'rise', delay = 0 }) {
  return (
    <Reveal kind={kind} delay={delay} className={`rounded-3xl p-6 ${className}`}>
      <Icon className="h-6 w-6 text-ink-soft" strokeWidth={1.75} aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold leading-snug tracking-[-0.01em]">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{text}</p>
      {children && <p className="mt-3 text-[15px]">{children}</p>}
    </Reveal>
  );
}

/** A made-up ingredient list, marked up the way a celiac learns to read one */
function IngredientLabel({ lang }) {
  const tr = t(lang);
  const no = 'box-decoration-clone rounded-[5px] bg-status-unsafe/15 px-1 font-medium shadow-[inset_0_-2px_0_#C9423D]';
  const check = 'box-decoration-clone rounded-[5px] bg-status-warning/20 px-1 font-medium shadow-[inset_0_-2px_0_#FF8A41]';
  const fine = 'box-decoration-clone rounded-[5px] bg-status-safe/20 px-1 shadow-[inset_0_-2px_0_#8BA850]';

  return (
    <div className="relative -rotate-2 rounded-[1.75rem] bg-canvas-paper p-6 shadow-[0_0_0_1px_var(--hairline),0_18px_40px_-18px_rgba(0,0,0,0.3)] rtl:rotate-2 sm:p-7">
      <span aria-hidden="true" className="absolute start-1/2 top-3 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-canvas-sunk rtl:translate-x-1/2" />
      <p className="mt-2 text-sm font-semibold text-ink-soft">{tr('Ingrédients', 'المكونات')}</p>
      {lang === 'ar' ? (
        <p className="mt-2 text-[17px] leading-[2.1]">
          سكر، <span className={no}>دقيق القمح</span>، زيت نباتي، <span className={fine}>شراب الغلوكوز</span>، <span className={no}>مستخلص مالت الشعير</span>،{' '}
          <span className={check}>
            نشا معدّل (<span dir="ltr">E1422</span>)
          </span>
          ، كاكاو، ملح، منكهات. <span className={check}>قد يحتوي على آثار الغلوتين.</span>
        </p>
      ) : (
        <p className="mt-2 text-[17px] leading-[1.95]">
          Sucre, <span className={no}>farine de blé</span>, huile végétale, <span className={fine}>sirop de glucose</span>, <span className={no}>extrait de malt d’orge</span>,{' '}
          <span className={check}>amidon modifié (E1422)</span>, cacao, sel, arômes. <span className={check}>Peut contenir des traces de gluten.</span>
        </p>
      )}
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-dashed border-canvas-edge pt-4 text-sm">
        {[
          ['unsafe', 'Contient du gluten', 'يحتوي على الغلوتين'],
          ['warning', 'À vérifier', 'للتثبت'],
          ['safe', 'Sans danger', 'لا خطر'],
        ].map(([kind, fr, ar]) => (
          <li key={kind} className="inline-flex items-center gap-2">
            <StatusTile kind={kind} size="xs" />
            {tr(fr, ar)}
          </li>
        ))}
      </ul>
    </div>
  );
}
