import React, { useState } from 'react';
import { UserRound } from 'lucide-react';
import { logIn, signUp, requestPasswordReset, errorMessage } from '../services/api';
import { useAuth } from './AuthContext';
import { t, Notice } from './ui';

/** Same rule as the API (backend/src/routes/authRoutes.js): 10+ characters, a letter and a digit */
export const passwordHint = (password, tr) => {
  if (password.length < 10) return tr('10 caractères au minimum, avec au moins une lettre et un chiffre.', '10 أحرف على الأقل، مع حرف ورقم على الأقل.');
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return tr('Ajoutez au moins une lettre et un chiffre.', 'أضف حرفا ورقما على الأقل.');
  return '';
};

/**
 * Sign in / create an account. `title` and `lede` explain why it is shown
 * (e.g. the marketplace is for members); onDone runs once signed in.
 */
export default function AuthPanel({ lang, title, lede, onDone }) {
  const tr = t(lang);
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'forgot') {
        const res = await requestPasswordReset(form.email);
        setInfo(res.message);
        return;
      }
      if (mode === 'signup' && passwordHint(form.password, tr)) {
        setError(passwordHint(form.password, tr));
        return;
      }
      const res = mode === 'login' ? await logIn(form) : await signUp(form);
      if (res.needsConfirmation) {
        setInfo(tr('Vérifiez votre boîte mail : ouvrez le lien reçu, puis connectez-vous.', 'تحقق من بريدك: افتح الرابط الذي وصلك ثم سجّل الدخول.'));
        setMode('login');
      } else if (res.session) {
        signIn(res);
        onDone?.(res.user);
      }
    } catch (err) {
      setError(errorMessage(err, tr('Le serveur ne répond pas. Réessayez.', 'الخادم لا يستجيب. أعد المحاولة.')));
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (next) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  return (
    <div className="mx-auto max-w-md pt-2">
      <div className="panel p-6 sm:p-8">
        <UserRound className="h-6 w-6 text-ink-soft" />
        <h1 className="mt-4 text-2xl font-semibold">
          {mode === 'forgot'
            ? tr('Mot de passe oublié', 'نسيت كلمة المرور')
            : title || (mode === 'login' ? tr('Se connecter', 'تسجيل الدخول') : tr('Créer un compte', 'إنشاء حساب'))}
        </h1>
        {lede && <p className="mt-1 text-sm text-ink-soft">{lede}</p>}

        {mode === 'forgot' ? (
          <p className="mt-2 text-sm text-ink-soft">{tr('Indiquez votre e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.', 'أدخل بريدك الإلكتروني: سيصلك رابط لاختيار كلمة مرور جديدة.')}</p>
        ) : (
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-canvas-sunk/60 p-1" role="tablist">
          {[
            ['login', tr('Connexion', 'الدخول')],
            ['signup', tr('Nouveau compte', 'حساب جديد')],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => switchTo(id)}
              className={`rounded-full py-2 text-sm transition-colors ${mode === id ? 'bg-canvas-paper font-medium text-ink shadow-sm dark:bg-canvas-edge' : 'text-ink-soft hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="field-label">{tr('Nom complet', 'الاسم الكامل')}</label>
              <input id="auth-name" value={form.fullName} onChange={set('fullName')} autoComplete="name" required maxLength={100} className="field" />
            </div>
          )}
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-phone" className="field-label">{tr('Téléphone (WhatsApp de préférence)', 'الهاتف (واتساب إن أمكن)')}</label>
              <input
                id="auth-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={set('phone')}
                autoComplete="tel-national"
                required
                maxLength={20}
                placeholder="22 123 456"
                aria-describedby="auth-phone-hint"
                className="field"
                dir="ltr"
              />
              <p id="auth-phone-hint" className="mt-1.5 text-xs text-ink-faint">
                {tr('Pour confirmer vos commandes par WhatsApp ou par téléphone.', 'لتأكيد طلباتك عبر واتساب أو الهاتف.')}
              </p>
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="field-label">{tr('E-mail', 'البريد الإلكتروني')}</label>
            <input id="auth-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required maxLength={254} className="field" dir="ltr" />
          </div>
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="auth-password" className="field-label">{tr('Mot de passe', 'كلمة المرور')}</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => switchTo('forgot')} className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
                    {tr('Mot de passe oublié ?', 'نسيت كلمة المرور؟')}
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'signup' ? 10 : undefined}
                maxLength={72}
                required
                aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
                className="field"
                dir="ltr"
              />
              {mode === 'signup' && (
                <p id="auth-password-hint" className="mt-1.5 text-xs text-ink-faint">
                  {tr('10 caractères au minimum, avec au moins une lettre et un chiffre.', '10 أحرف على الأقل، مع حرف ورقم على الأقل.')}
                </p>
              )}
            </div>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="success">{info}</Notice>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy
              ? tr('Un instant…', 'لحظة…')
              : mode === 'forgot'
              ? tr('Envoyer le lien', 'أرسل الرابط')
              : mode === 'login'
              ? tr('Se connecter', 'تسجيل الدخول')
              : tr('Créer mon compte', 'إنشاء حسابي')}
          </button>
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchTo('login')} className="btn-ghost w-full">
              {tr('Retour à la connexion', 'العودة إلى تسجيل الدخول')}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
