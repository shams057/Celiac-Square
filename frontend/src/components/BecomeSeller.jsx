import React, { useEffect, useState } from 'react';
import { Clock, BadgeCheck, X } from 'lucide-react';
import { fetchMyApplications, submitSellerApplication, errorMessage } from '../services/api';
import { useAuth } from './AuthContext';
import AuthPanel from './AuthPanel';
import { t, PageHead, Spinner, Notice, STORE_TYPES } from './ui';

const EMPTY_FORM = { businessName: '', type: 'RESTAURANT', city: '', address: '', phone: '', description: '' };

/** A client asks to sell on the marketplace; the team approves it in the backoffice */
export default function BecomeSeller({ lang, onOpenShop }) {
  const tr = t(lang);
  const { user } = useAuth();

  if (!user) {
    return (
      <AuthPanel
        lang={lang}
        title={tr('Vendre sur Celiac Square', 'بِع على Celiac Square')}
        lede={tr('Connectez-vous ou créez un compte, puis envoyez votre demande.', 'سجّل الدخول أو أنشئ حسابا، ثم أرسل طلبك.')}
      />
    );
  }

  if (user.role !== 'CLIENT') {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHead title={tr('Vendre sur Celiac Square', 'بِع على Celiac Square')} />
        <Notice
          tone="success"
          title={user.role === 'SELLER' ? tr('Votre compte vendeur est actif.', 'حساب البائع الخاص بك مفعل.') : tr('Votre compte administrateur peut déjà gérer une boutique.', 'حساب المدير يمكنه إدارة محل.')}
          action={<button type="button" className="btn-primary" onClick={onOpenShop}>{tr('Ouvrir ma boutique', 'افتح محلي')}</button>}
        />
      </div>
    );
  }

  return <ApplicationForm lang={lang} />;
}

function ApplicationForm({ lang }) {
  const tr = t(lang);
  const [applications, setApplications] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyApplications()
      .then((res) => setApplications(res.data || []))
      .catch(() => setApplications([]));
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await submitSellerApplication(form);
      setApplications((a) => [res.data, ...(a || [])]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(errorMessage(err, tr('La demande n’a pas été envoyée.', 'لم يتم إرسال الطلب.')));
    } finally {
      setBusy(false);
    }
  };

  if (applications === null) return <Spinner label={tr('Chargement…', 'جاري التحميل…')} />;

  const pending = applications.find((a) => a.status === 'PENDING');
  const lastRejected = !pending && applications[0]?.status === 'REJECTED' ? applications[0] : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHead
        title={tr('Devenir vendeur', 'كن بائعا')}
        lede={tr(
          'Restaurants, boulangeries, cafés et artisans : proposez vos produits sans gluten aux membres de Celiac Square. L’équipe vérifie chaque demande.',
          'مطاعم ومخابز ومقاهٍ وحرفيون: اعرضوا منتجاتكم بدون غلوتين على أعضاء Celiac Square. يراجع الفريق كل طلب.'
        )}
      />

      {pending ? (
        <div className="panel flex gap-4 p-5 sm:p-6">
          <Clock className="mt-0.5 h-6 w-6 shrink-0 text-accent-dark" />
          <div>
            <p className="font-medium">{tr('Demande en cours d’examen', 'الطلب قيد المراجعة')}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {tr(
                `« ${pending.businessName} », envoyée le ${new Date(pending.createdAt).toLocaleDateString('fr-FR')}. Votre espace vendeur s’ouvrira dès qu’elle sera acceptée.`,
                `«${pending.businessName}»، أرسل في ${new Date(pending.createdAt).toLocaleDateString('ar-TN')}. سيفتح فضاء البائع بمجرد قبوله.`
              )}
            </p>
          </div>
        </div>
      ) : (
        <>
          {lastRejected && (
            <Notice tone="warning" title={tr('Votre dernière demande n’a pas été retenue.', 'لم يتم قبول طلبك الأخير.')}>
              {tr('Vous pouvez en envoyer une nouvelle avec plus de détails.', 'يمكنك إرسال طلب جديد بتفاصيل أكثر.')}
            </Notice>
          )}
          <form onSubmit={submit} className="panel space-y-4 p-5 sm:p-6">
            <div>
              <label htmlFor="app-name" className="field-label">{tr('Nom de l’établissement', 'اسم المحل')}</label>
              <input id="app-name" value={form.businessName} onChange={set('businessName')} required maxLength={120} className="field" />
            </div>
            <div>
              <p className="field-label">{tr('Type', 'النوع')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={tr('Type d’établissement', 'نوع المحل')}>
                {STORE_TYPES.map(({ value, fr, ar, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.type === value}
                    onClick={() => setForm({ ...form, type: value })}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm transition-colors ${
                      form.type === value ? 'border-ink bg-ink text-canvas-paper' : 'border-canvas-line/70 bg-canvas-paper/70 text-ink-soft hover:text-ink'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {tr(fr, ar)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="app-city" className="field-label">{tr('Ville', 'المدينة')}</label>
                <input id="app-city" value={form.city} onChange={set('city')} required maxLength={80} className="field" />
              </div>
              <div>
                <label htmlFor="app-phone" className="field-label">{tr('Téléphone', 'الهاتف')}</label>
                <input id="app-phone" type="tel" value={form.phone} onChange={set('phone')} required maxLength={30} className="field" dir="ltr" />
              </div>
            </div>
            <div>
              <label htmlFor="app-address" className="field-label">{tr('Adresse', 'العنوان')} <span className="font-normal text-ink-faint">{tr('facultatif', 'اختياري')}</span></label>
              <input id="app-address" value={form.address} onChange={set('address')} maxLength={200} className="field" />
            </div>
            <div>
              <label htmlFor="app-description" className="field-label">{tr('Vos produits sans gluten', 'منتجاتك بدون غلوتين')}</label>
              <textarea
                id="app-description"
                value={form.description}
                onChange={set('description')}
                rows={4}
                maxLength={2000}
                placeholder={tr('Ce que vous préparez, et comment vous évitez la contamination croisée.', 'ما تحضّره، وكيف تتجنب التلوث بالغلوتين.')}
                className="field"
              />
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? tr('Envoi…', 'جاري الإرسال…') : tr('Envoyer ma demande', 'أرسل طلبي')}
            </button>
          </form>
        </>
      )}

      {applications.some((a) => a.status !== 'PENDING') && (
        <section>
          <h2 className="text-sm font-medium text-ink-soft">{tr('Demandes précédentes', 'الطلبات السابقة')}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {applications.filter((a) => a.status !== 'PENDING').map((a) => (
              <li key={a._id} className="flex items-center gap-2">
                {a.status === 'APPROVED' ? <BadgeCheck className="h-4 w-4 text-status-safe-ink" /> : <X className="h-4 w-4 text-status-unsafe-ink" />}
                {a.businessName} · {new Date(a.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
