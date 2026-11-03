import React, { useState } from 'react';
import { submitSpot } from '../services/api';
import { t, Modal, Notice, SPOT_CATEGORIES } from './ui';

const CITY_COORDINATES = {
  Tunis: [10.1815, 36.8065],
  Ariana: [10.1972, 36.8522],
  'La Marsa': [10.3236, 36.8781],
  Sousse: [10.6369, 35.8256],
  Sfax: [10.7602, 34.7405],
  Bizerte: [9.8739, 37.2744],
  Nabeul: [10.7329, 36.4561],
  Monastir: [10.8261, 35.7779],
  Djerba: [10.8573, 33.875],
  Kairouan: [10.0963, 35.6781],
  Gabès: [10.1005, 33.8815],
};

const EMPTY_FORM = {
  name: '',
  category: 'ARTISAN',
  city: 'Tunis',
  address: '',
  phone: '',
  speciality: '',
  hours: '',
  notes: '',
  submittedBy: '',
};

export default function SpotModal({ isOpen, onClose, onSuccess, lang }) {
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
      // Without a map picker, place the spot near its city centre
      const [lng, lat] = CITY_COORDINATES[formData.city] || CITY_COORDINATES.Tunis;
      const res = await submitSpot({
        ...formData,
        coordinates: [lng + (Math.random() - 0.5) * 0.02, lat + (Math.random() - 0.5) * 0.02],
      });
      if (res?.success) {
        setSent(true);
        onSuccess?.();
      } else {
        setErrorMsg(res?.message || tr('L’adresse n’a pas été envoyée.', 'لم يتم إرسال العنوان.'));
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || tr('L’adresse n’a pas été envoyée. Vérifiez votre connexion.', 'لم يتم إرسال العنوان. تحقق من الاتصال.'));
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
              <input id="spot-name" required value={formData.name} onChange={set('name')} placeholder={tr('Boulangerie Épi d’Or', 'مخبزة السنبلة')} className="field" />
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
              <select id="spot-city" value={formData.city} onChange={set('city')} className="field">
                {Object.keys(CITY_COORDINATES).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="spot-phone" className="field-label">{tr('Téléphone (facultatif)', 'الهاتف (اختياري)')}</label>
              <input id="spot-phone" type="tel" dir="ltr" value={formData.phone} onChange={set('phone')} placeholder="+216 71 000 000" className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="spot-address" className="field-label">{tr('Adresse', 'العنوان')}</label>
            <input id="spot-address" required value={formData.address} onChange={set('address')} placeholder={tr('12 rue Habib Bourguiba, La Marsa', '12 نهج الحبيب بورقيبة، المرسى')} className="field" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="spot-speciality" className="field-label">{tr('Ce qu’on y trouve (facultatif)', 'ماذا يوجد هناك (اختياري)')}</label>
              <input id="spot-speciality" value={formData.speciality} onChange={set('speciality')} placeholder={tr('Pain, malsouka, pizzas', 'خبز، ملسوقة، بيتزا')} className="field" />
            </div>
            <div>
              <label htmlFor="spot-hours" className="field-label">{tr('Horaires (facultatif)', 'التوقيت (اختياري)')}</label>
              <input id="spot-hours" value={formData.hours} onChange={set('hours')} placeholder={tr('Lun–sam, 8 h–19 h 30', 'الاثنين–السبت، 8–19:30')} className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="spot-notes" className="field-label">{tr('Précautions contre la contamination (facultatif)', 'احتياطات ضد التلوث (اختياري)')}</label>
            <textarea id="spot-notes" rows="3" value={formData.notes} onChange={set('notes')} placeholder={tr('Four dédié, cuisine séparée…', 'فرن مخصص، مطبخ منفصل…')} className="field" />
          </div>

          <div>
            <label htmlFor="spot-author" className="field-label">{tr('Votre prénom (facultatif)', 'اسمك (اختياري)')}</label>
            <input id="spot-author" value={formData.submittedBy} onChange={set('submittedBy')} className="field" />
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
