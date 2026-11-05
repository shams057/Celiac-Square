import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { resetPassword, errorMessage } from '../services/api';
import { passwordHint } from './AuthPanel';
import { t, Notice } from './ui';

/**
 * Landing page of the password-reset e-mail. Supabase puts a short-lived access token
 * in the URL fragment (#access_token=…&type=recovery); it is read once, then removed
 * from the address bar so it does not stay in the history.
 */
export default function ResetPassword({ lang, onDone }) {
  const tr = t(lang);
  const [token] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return params.get('type') === 'recovery' ? params.get('access_token') || '' : '';
  });
  const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const hint = passwordHint(password, tr);
    if (hint) return setError(hint);
    if (password !== confirm) return setError(tr('Les deux mots de passe ne sont pas identiques.', 'كلمتا المرور غير متطابقتين.'));
    setBusy(true);
    try {
      const res = await resetPassword({ accessToken: token, password });
      setDone(res.message);
    } catch (err) {
      setError(errorMessage(err, tr('Le mot de passe n’a pas pu être changé. Réessayez.', 'تعذر تغيير كلمة المرور. أعد المحاولة.')));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="mx-auto max-w-md pt-2">
      <div className="panel p-6 sm:p-8">
        <KeyRound className="h-6 w-6 text-ink-soft" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">{tr('Nouveau mot de passe', 'كلمة مرور جديدة')}</h1>
        {done ? (
          <div className="mt-5 space-y-4">
            <Notice tone="success">{done}</Notice>
            <button type="button" className="btn-primary w-full" onClick={onDone}>{tr('Se connecter', 'تسجيل الدخول')}</button>
          </div>
        ) : !token ? (
          <div className="mt-5 space-y-4">
            <Notice tone="error" title={tr('Ce lien n’est pas valide ou a expiré.', 'هذا الرابط غير صالح أو منتهي الصلاحية.')}>
              {linkError || tr('Demandez un nouvel e-mail depuis « Mot de passe oublié ».', 'اطلب رسالة جديدة من «نسيت كلمة المرور».')}
            </Notice>
            <button type="button" className="btn-quiet w-full" onClick={onDone}>{tr('Retour à la connexion', 'العودة إلى تسجيل الدخول')}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="reset-password" className="field-label">{tr('Nouveau mot de passe', 'كلمة المرور الجديدة')}</label>
              <input id="reset-password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="reset-hint" className="field" dir="ltr" />
              <p id="reset-hint" className="mt-1.5 text-xs text-ink-faint">{tr('10 caractères au minimum, avec au moins une lettre et un chiffre.', '10 أحرف على الأقل، مع حرف ورقم على الأقل.')}</p>
            </div>
            <div>
              <label htmlFor="reset-confirm" className="field-label">{tr('Confirmer', 'تأكيد')}</label>
              <input id="reset-confirm" type="password" autoComplete="new-password" required maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field" dir="ltr" />
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? tr('Un instant…', 'لحظة…') : tr('Changer le mot de passe', 'غيّر كلمة المرور')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
