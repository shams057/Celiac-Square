import React from 'react';
import { BrandMark, t } from './ui';

export default function Footer({ lang, onBecomeSeller, onOpenPrivacy }) {
  const tr = t(lang);

  return (
    <footer className="border-t border-ink/10 pb-28 lg:pb-2">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-6 w-6" />
            <span className="font-semibold tracking-[-0.02em]">Celiac Square</span>
          </div>
          <p className="mt-3 max-w-[48ch] text-sm text-ink-soft">
            {tr(
              'Savoir ce que l’on peut manger sans gluten en Tunisie : le guide de l’ATMC, un scanner de produits et une carte des bonnes adresses.',
              'دليلك للأكل بدون غلوتين في تونس: دليل الجمعية، ماسح للمنتجات وخريطة للعناوين الموثوقة.'
            )}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <button type="button" onClick={onBecomeSeller} className="font-medium text-primary-dark underline-offset-4 hover:underline">
                {tr('Devenir vendeur sur le marché', 'كن بائعا في السوق')}
              </button>
            </li>
            <li>
              <button type="button" onClick={onOpenPrivacy} className="text-ink-soft underline decoration-ink/20 underline-offset-4 hover:text-ink">
                {tr('Confidentialité et conditions', 'الخصوصية والشروط')}
              </button>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-medium">{tr('Sources', 'المصادر')}</p>
          <ul className="mt-3 space-y-2 text-ink-soft">
            <li>{tr('Guide du régime sans gluten, ATMC, décembre 2023', 'دليل الحمية بدون غلوتين، الجمعية، ديسمبر 2023')}</li>
            <li>
              <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="underline decoration-ink/20 underline-offset-4 hover:text-ink">
                Open Food Facts
              </a>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-medium">{tr('Avertissement médical', 'تنبيه طبي')}</p>
          <p className="mt-3 text-ink-soft">
            {tr(
              'Ces informations sont indicatives. En cas de doute, lisez l’étiquette et demandez l’avis de votre gastro-entérologue ou nutritionniste.',
              'هذه المعلومات للاسترشاد فقط. عند الشك، اقرأ الملصق واستشر طبيبك المختص أو أخصائي التغذية.'
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
