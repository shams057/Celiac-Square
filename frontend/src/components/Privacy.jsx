import React from 'react';
import { t, PageHead } from './ui';

// Address people can write to about their data. Fill it in before publishing; the paragraph is hidden while empty.
export const CONTACT_EMAIL = '';

const SECTIONS = [
  {
    fr: ['Ce que nous collectons', [
      'Compte : votre nom, votre adresse e-mail et votre rôle (client, vendeur, administrateur). Le mot de passe est géré par notre fournisseur d’authentification (Supabase) et n’est jamais visible par l’équipe.',
      'Vendeurs : les informations de la boutique et des produits que vous publiez (nom, ville, adresse, téléphone, description, photos). Elles sont publiques sur le marché.',
      'Adresses proposées : le contenu du formulaire et, si vous l’indiquez, votre nom. Elles sont lues par l’équipe avant toute publication.',
    ]],
    ar: ['ما نجمعه', [
      'الحساب: اسمك وبريدك الإلكتروني ودورك (عميل، بائع، مدير). كلمة المرور يديرها مزود المصادقة (Supabase) ولا يطّلع عليها الفريق.',
      'البائعون: معلومات المحل والمنتجات المنشورة (الاسم، المدينة، العنوان، الهاتف، الوصف، الصور). هذه المعلومات علنية في السوق.',
      'العناوين المقترحة: محتوى الاستمارة واسمك إن أدخلته. يقرؤها الفريق قبل أي نشر.',
    ]],
  },
  {
    fr: ['Le scanner', [
      'La photo est réduite sur votre appareil, puis envoyée à notre serveur puis à Ollama Cloud (modèle Gemma ; en secours, Google Gemini), qui reconnaît le produit ou lit sa liste d’ingrédients. N’y photographiez rien de personnel.',
      'Elle n’est pas conservée : nous gardons seulement le résultat en mémoire, quelques heures, pour répondre plus vite si la même photo revient.',
      'Si l’IA ne répond pas, le texte est lu sur votre appareil et seul ce texte est envoyé.',
    ]],
    ar: ['الماسح', [
      'تُصغَّر الصورة على جهازك ثم تُرسل إلى خادمنا ثم إلى Ollama Cloud (نموذج Gemma، واحتياطيا Google Gemini) للتعرف على المنتج أو قراءة مكوناته. لا تصوّر أي معلومات شخصية.',
      'لا تُحفظ الصورة: نحتفظ بالنتيجة فقط في الذاكرة لبضع ساعات للرد بسرعة إن أُرسلت الصورة نفسها مجددا.',
      'إن لم يستجب الذكاء الاصطناعي، يُقرأ النص على جهازك ويُرسل النص وحده.',
    ]],
  },
  {
    fr: ['Cookies et stockage', [
      'Un cookie de session (httpOnly) vous garde connecté. Il ne sert à rien d’autre et disparaît à la déconnexion.',
      'Votre navigateur retient la langue choisie et le nom du compte connecté, pour l’affichage.',
      'Les statistiques de visite (Vercel Analytics) sont agrégées et ne déposent pas de cookie.',
    ]],
    ar: ['ملفات تعريف الارتباط والتخزين', [
      'ملف جلسة (httpOnly) يبقيك متصلا، ولا يُستعمل لغير ذلك ويُحذف عند تسجيل الخروج.',
      'يحفظ متصفحك اللغة المختارة واسم الحساب المتصل للعرض فقط.',
      'إحصائيات الزيارات (Vercel Analytics) مجمّعة ولا تستعمل ملفات تعريف الارتباط.',
    ]],
  },
  {
    fr: ['Vos droits', [
      'Conformément à la loi organique n° 2004-63 sur la protection des données à caractère personnel, vous pouvez demander l’accès à vos données, leur correction ou la suppression de votre compte.',
      'Les données sont hébergées par Supabase et Vercel. Elles ne sont ni vendues ni utilisées pour de la publicité.',
    ]],
    ar: ['حقوقك', [
      'وفقا للقانون الأساسي عدد 63 لسنة 2004 المتعلق بحماية المعطيات الشخصية، يمكنك طلب الاطلاع على معطياتك أو تصحيحها أو حذف حسابك.',
      'تُستضاف المعطيات لدى Supabase وVercel، ولا تُباع ولا تُستعمل للإشهار.',
    ]],
  },
  {
    fr: ['Conditions d’utilisation', [
      'Les informations du site sont indicatives et ne remplacent pas l’avis d’un médecin ou d’un nutritionniste. Lisez toujours l’étiquette : les recettes changent.',
      'Les verdicts du scanner et d’Open Food Facts sont des estimations automatiques qui peuvent se tromper.',
      'Les vendeurs du marché sont seuls responsables de leurs produits et de leurs précautions contre la contamination croisée. Aucun paiement ne passe par Celiac Square.',
    ]],
    ar: ['شروط الاستعمال', [
      'معلومات الموقع للاسترشاد ولا تعوّض رأي الطبيب أو أخصائي التغذية. اقرأ الملصق دائما: الوصفات تتغير.',
      'أحكام الماسح وOpen Food Facts تقديرات آلية قد تخطئ.',
      'البائعون في السوق مسؤولون وحدهم عن منتجاتهم واحتياطاتهم ضد التلوث. لا يمر أي دفع عبر Celiac Square.',
    ]],
  },
];

export default function Privacy({ lang }) {
  const tr = t(lang);
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <PageHead
        title={tr('Confidentialité et conditions', 'الخصوصية والشروط')}
        lede={tr('Ce que Celiac Square fait de vos données, en clair.', 'ما يفعله Celiac Square بمعطياتك، بوضوح.')}
      />
      {SECTIONS.map((section) => {
        const [heading, items] = lang === 'ar' ? section.ar : section.fr;
        return (
          <section key={section.fr[0]} className="panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{heading}</h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-[15px] text-ink-soft">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        );
      })}
      {CONTACT_EMAIL && (
        <p className="text-sm text-ink-soft">
          {tr('Pour toute demande :', 'لأي طلب:')}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4" dir="ltr">{CONTACT_EMAIL}</a>
        </p>
      )}
    </article>
  );
}
