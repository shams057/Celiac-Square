import React, { useEffect, useState } from 'react';
import { UserRound, Package, ShoppingCart } from 'lucide-react';
import { updateProfile, errorMessage } from '../services/api';
import { updateUser } from '../services/session';
import { navigate, pathFor } from '../services/router';
import { useAuth } from './AuthContext';
import { t, Notice } from './ui';
import { useCart } from './orders';

/** The signed-in account: name and phone number (used to prefill orders and confirm them) */
export default function AccountProfile({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const cart = useCart();
  const [form, setForm] = useState({ fullName: user.fullName || '', phone: user.phone || '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ tone: 'info', text: '' });

  useEffect(() => setForm({ fullName: user.fullName || '', phone: user.phone || '' }), [user.fullName, user.phone]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dirty = form.fullName !== (user.fullName || '') || form.phone !== (user.phone || '');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setToast({ tone: 'info', text: '' });
    try {
      const res = await updateProfile(form);
      updateUser(res.user);
      setToast({ tone: 'success', text: res.message });
    } catch (err) {
      setToast({ tone: 'error', text: errorMessage(err, tr('L’enregistrement a échoué.', 'فشل الحفظ.')) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 pt-2">
      <div className="panel p-6 sm:p-8">
        <UserRound className="h-6 w-6 text-ink-soft" />
        <h1 className="mt-4 text-2xl font-semibold">{tr('Mon compte', 'حسابي')}</h1>
        <p className="mt-1 text-sm text-ink-soft" dir="ltr">{user.email}</p>

        {!user.phone && (
          <div className="mt-4">
            <Notice tone="warning" title={tr('Ajoutez votre numéro de téléphone', 'أضف رقم هاتفك')}>
              {tr('Il sert à confirmer vos commandes par WhatsApp ou par téléphone.', 'يُستعمل لتأكيد طلباتك عبر واتساب أو الهاتف.')}
            </Notice>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="profile-name" className="field-label">{tr('Nom complet', 'الاسم الكامل')}</label>
            <input id="profile-name" value={form.fullName} onChange={set('fullName')} autoComplete="name" required maxLength={100} className="field" />
          </div>
          <div>
            <label htmlFor="profile-phone" className="field-label">{tr('Téléphone (WhatsApp de préférence)', 'الهاتف (واتساب إن أمكن)')}</label>
            <input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set('phone')}
              autoComplete="tel-national"
              required
              maxLength={20}
              placeholder="22 123 456"
              className="field"
              dir="ltr"
            />
          </div>
          {toast.text && <Notice tone={toast.tone}>{toast.text}</Notice>}
          <button type="submit" disabled={busy || !dirty} className="btn-primary w-full">
            {busy ? tr('Un instant…', 'لحظة…') : tr('Enregistrer', 'حفظ')}
          </button>
        </form>
      </div>
      {/* What is being bought, and what was bought */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-quiet" onClick={() => cart.setOpen(true)}>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {tr('Mon panier', 'سلتي')}
          {cart.count > 0 && <span className="rounded-md bg-accent px-1.5 text-sm font-medium tabular-nums text-onbright">{cart.count}</span>}
        </button>
        <button type="button" className="btn-quiet" onClick={() => navigate(pathFor('orders'))}>
          <Package className="h-4 w-4" aria-hidden="true" />
          {tr('Mes commandes', 'طلباتي')}
        </button>
      </div>
    </div>
  );
}
