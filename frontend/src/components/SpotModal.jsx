import React, { useState } from 'react';
import { submitSpot, errorMessage } from '../services/api';
import { t, Modal, Notice, SPOT_CATEGORIES } from './ui';

// Suggestions only: any town can be typed. The team sets the exact map position before publishing.
const CITY_SUGGESTIONS = ['Tunis', 'Ariana', 'Ben Arous', 'La Marsa', 'Sousse', 'Sfax', 'Bizerte', 'Nabeul', 'Hammamet', 'Monastir', 'Mahdia', 'Djerba', 'Kairouan', 'Gabès', 'Gafsa', 'Tozeur', 'Béja', 'Jendouba', 'Le Kef', 'Médenine'];

const EMPTY_FORM = {
  name: '',
  category: 'ARTISAN',
  city: '',
  address: '',
  phone: '',
  speciality: '',
  hours: '',
  notes: '',
  submittedBy: '',
  website: '', // honeypot: hidden from people, filled in by bots
};

export default function SpotModal({ isOpen, onClose, lang }) {
  const tr = t(lang);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  const close = () => {
    if (sent) {
      setFormData(EMPTY_FORM);
      setSent(false);
    }
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      // No coordinates are sent: the team places the spot on the map when it checks the address
      const res = await submitSpot(formData);
      if (res?.success) {
        setSent(true);
      } else {
        setErrorMsg(res?.message || tr('L’adresse n’a pas été envoyée.', 'لم يتم إرسال العنوان.'));
      }
    } catch (err) {
      setErrorMsg(errorMessage(err, tr('L’adresse n’a pas été envoyée. Vérifiez votre connexion.', 'لم يتم إرسال العنوان. تحقق من الاتصال.')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={close}
      lang={lang}
      title={tr('Proposer une adresse', 'اقترح عنوانا')}
      subtitle={tr('Elle apparaîtra sur la carte une fois vérifiée par l’équipe.', 'سيظهر على الخريطة بعد أن يتحقق منه الفريق.')}
    >
      {sent ? (
        <div className="space-y-5">
          <Notice tone="success" title={tr('Adresse envoyée', 'تم إرسال العنوان')}>
            {tr(`Merci. « ${formData.name} » sera publiée après vérification.`, `شكرا. سيُنشر «${formData.name}» بعد التحقق.`)}
          </Notice>
          <div className="flex justify-end">
            <button type="button" onClick={close} className="btn-primary">
              {tr('Fermer', 'إغلاق')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && <Notice tone="error">{errorMsg}</Notice>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="spot-name" className="field-label">{tr('Nom du lieu ou du médecin', 'اسم المكان أو الطبيب')}</label>
              <input id="spot-name" required maxLength={120} value={formData.name} onChange={set('name')} placeholder={tr('Boulangerie Épi d’Or', 'مخبزة السنبلة')} className="field" />
            </div>
            <div>
              <label htmlFor="spot-category" className="field-label">{tr('Type de lieu', 'نوع المكان')}</label>
              <select id="spot-category" value={formData.category} onChange={set('category')} className="field">
                {SPOT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {tr(c.fr, c.ar)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="spot-city" className="field-label">{tr('Ville', 'المدينة')}</label>
              <input id="spot-city" required list="spot-city-suggestions" value={formData.city} onChange={set('city')} maxLength={80} autoComplete="address-level2" className="field" />
              <datalist id="spot-city-suggestions">
                {CITY_SUGGESTIONS.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="spot-phone" className="field-label">{tr('Téléphone (facultatif)', 'الهاتف (اختياري)')}</label>
              <input id="spot-phone" type="tel" dir="ltr" maxLength={30} value={formData.phone} onChange={set('phone')} placeholder="+216 71 000 000" className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="spot-address" className="field-label">{tr('Adresse', 'العنوان')}</label>
            <input id="spot-address" required maxLength={200} autoComplete="street-address" value={formData.address} onChange={set('address')} placeholder={tr('12 rue Habib Bourguiba, La Marsa', '12 نهج الحبيب بورقيبة، المرسى')} className="field" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="spot-speciality" className="field-label">{tr('Ce qu’on y trouve (facultatif)', 'ماذا يوجد هناك (اختياري)')}</label>
              <input id="spot-speciality" maxLength={120} value={formData.speciality} onChange={set('speciality')} placeholder={tr('Pain, malsouka, pizzas', 'خبز، ملسوقة، بيتزا')} className="field" />
            </div>
            <div>
              <label htmlFor="spot-hours" className="field-label">{tr('Horaires (facultatif)', 'التوقيت (اختياري)')}</label>
              <input id="spot-hours" maxLength={120} value={formData.hours} onChange={set('hours')} placeholder={tr('Lun–sam, 8 h–19 h 30', 'الاثنين–السبت، 8–19:30')} className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="spot-notes" className="field-label">{tr('Précautions contre la contamination (facultatif)', 'احتياطات ضد التلوث (اختياري)')}</label>
            <textarea id="spot-notes" rows="3" maxLength={1000} value={formData.notes} onChange={set('notes')} placeholder={tr('Four dédié, cuisine séparée…', 'فرن مخصص، مطبخ منفصل…')} className="field" />
          </div>

          <div>
            <label htmlFor="spot-author" className="field-label">{tr('Votre prénom (facultatif)', 'اسمك (اختياري)')}</label>
            <input id="spot-author" maxLength={80} value={formData.submittedBy} onChange={set('submittedBy')} autoComplete="given-name" className="field" />
          </div>

          <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="spot-website">Website</label>
            <input id="spot-website" tabIndex={-1} autoComplete="off" value={formData.website} onChange={set('website')} />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-canvas-line pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="btn-ghost">
              {tr('Annuler', 'إلغاء')}
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? tr('Envoi…', 'جاري الإرسال…') : tr('Envoyer l’adresse', 'أرسل العنوان')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
