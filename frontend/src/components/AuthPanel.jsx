import React, { useState } from 'react';
import { UserRound } from 'lucide-react';
import { logIn, signUp } from '../services/api';
import { useAuth } from './AuthContext';
import { t, Notice } from './ui';

/**
 * Sign in / create an account. `title` and `lede` explain why it is shown
 * (e.g. the marketplace is for members); onDone runs once signed in.
 */
export default function AuthPanel({ lang, title, lede, onDone }) {
  const tr = t(lang);
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
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
      const res = mode === 'login' ? await logIn(form) : await signUp(form);
      if (res.needsConfirmation) {
        setInfo(tr('Compte créé. Ouvrez le lien reçu par e-mail, puis connectez-vous.', 'تم إنشاء الحساب. افتح الرابط الذي وصلك بالبريد ثم سجّل الدخول.'));
        setMode('login');
      } else if (res.session) {
        signIn(res);
        onDone?.(res.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || tr('Le serveur ne répond pas. Réessayez.', 'الخادم لا يستجيب. أعد المحاولة.'));
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (next) => {
    setMode(next);
    setError('');
  };

  return (
    <div className="mx-auto max-w-md pt-2">
      <div className="panel p-6 sm:p-8">
        <UserRound className="h-6 w-6 text-ink-soft" />
        <h1 className="mt-4 text-2xl font-semibold">{title || (mode === 'login' ? tr('Se connecter', 'تسجيل الدخول') : tr('Créer un compte', 'إنشاء حساب'))}</h1>
        {lede && <p className="mt-1 text-sm text-ink-soft">{lede}</p>}

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
              className={`rounded-full py-2 text-sm transition-colors ${mode === id ? 'bg-canvas-paper font-medium text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="field-label">{tr('Nom complet', 'الاسم الكامل')}</label>
              <input id="auth-name" value={form.fullName} onChange={set('fullName')} autoComplete="name" required className="field" />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="field-label">{tr('E-mail', 'البريد الإلكتروني')}</label>
            <input id="auth-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required className="field" dir="ltr" />
          </div>
          <div>
            <label htmlFor="auth-password" className="field-label">{tr('Mot de passe', 'كلمة المرور')}</label>
            <input
              id="auth-password"
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
              className="field"
              dir="ltr"
            />
            {mode === 'signup' && <p className="mt-1.5 text-xs text-ink-faint">{tr('8 caractères au minimum.', '8 أحرف على الأقل.')}</p>}
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="success">{info}</Notice>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy
              ? tr('Un instant…', 'لحظة…')
              : mode === 'login'
              ? tr('Se connecter', 'تسجيل الدخول')
              : tr('Créer mon compte', 'إنشاء حسابي')}
          </button>
        </form>
      </div>
    </div>
  );
}
