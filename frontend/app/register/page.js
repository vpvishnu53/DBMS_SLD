'use client';
/**
 * Citizen sign-up with email verification (OTP):
 *   1. enter email -> "Send code"  (POST /api/auth/otp/request)
 *   2. enter the 6-digit code + details -> "Create account" (POST /api/auth/register)
 * The server only creates the account if the code matches, so complaints come
 * from people who control a real email address.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AuthHero from '@/components/AuthHero';
import { ErrorBox } from '@/components/ui';

const DETAILS = [
  ['first_name', 'First name', true], ['last_name', 'Last name', true],
  ['username', 'Username', true], ['password', 'Password', true, 'password'],
  ['phone', 'Phone', false, 'tel'], ['street', 'Street', false],
  ['city', 'City', false], ['state', 'State', false],
  ['pincode', 'Pincode', false],
];
const HINTS = { username: 'lowercase, e.g. asha.k', phone: '+919876543210', password: '8+ chars, letter & digit' };

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [v, setV] = useState({ city: 'Bengaluru', state: 'Karnataka' });
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(null);      // response of /otp/request
  const [cooldown, setCooldown] = useState(0);  // seconds until "Resend" is allowed
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [delivery, setDelivery] = useState(null); // 'email' | 'dev' | 'off' (from the API)

  useEffect(() => {
    api('/auth/otp/config').then((c) => setDelivery(c.delivery)).catch(() => setDelivery(null));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setSending(true); setError(null);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { email } });
      setSent(r); setOtp(''); setCooldown(r.resendAfterSeconds || 60);
    } catch (err) {
      setError(err);
      const wait = /wait (\d+)/.exec(err.message || '');
      if (wait) setCooldown(Number(wait[1]));
    } finally { setSending(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await register({ ...v, email, otp }); router.replace('/citizen'); }
    catch (err) { setError(err); setBusy(false); }
  };

  const verified = !!sent && /^\d{6}$/.test(otp);

  return (
    <div className="auth-wrap">
      <AuthHero />
      <div className="auth-panel">
        <div className="auth-card" style={{ width: 'min(540px, 100%)' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>Citizen sign-up</h2>
          <p className="muted" style={{ marginTop: 6 }}>Report dark or damaged streetlights and track the fix.</p>
          <form onSubmit={submit} style={{ marginTop: 20 }}>
            <ErrorBox error={error} />

            <div className="card" style={{ padding: 16, marginBottom: 18, background: 'var(--surface-2)' }}>
              <div className="card-title" style={{ marginBottom: 10 }}>
                1 · Verify your email
              </div>
              <div className="field">
                <label htmlFor="email">Email<span className="req">*</span></label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input id="email" className="input" type="email" required value={email} autoComplete="email"
                    onChange={(e) => { setEmail(e.target.value); setSent(null); setOtp(''); }} placeholder="you@example.com" />
                  <button type="button" className="btn" style={{ height: 38 }} onClick={sendCode}
                    disabled={sending || cooldown > 0 || delivery === 'off' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}>
                    {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : sent ? 'Resend code' : 'Send code'}
                  </button>
                </div>
              </div>

              {delivery === 'off' && (
                <div className="alert alert-error" style={{ margin: '10px 0 0' }}>
                  Sign-up emails aren&apos;t set up on the server yet, so verification codes can&apos;t be sent.
                </div>
              )}

              {sent && (
                <>
                  <p className="muted" style={{ fontSize: 12.5, margin: '10px 0' }}>
                    {sent.delivery === 'email'
                      ? <>We emailed a 6-digit code to <strong style={{ color: 'var(--text)' }}>{sent.email}</strong>. Check your inbox (and the spam folder). It expires in {sent.expiresInMinutes} minutes.</>
                      : <>Dev mode: no email was sent. The code for <strong style={{ color: 'var(--text)' }}>{sent.email}</strong> is printed in the API terminal.</>}
                  </p>
                  <div className="field" style={{ maxWidth: 220 }}>
                    <label htmlFor="otp">Verification code<span className="req">*</span></label>
                    <input id="otp" className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6 digits" style={{ letterSpacing: 4, fontSize: 16 }} />
                  </div>
                </>
              )}
            </div>

            <div className="card-title" style={{ marginBottom: 10 }}>2 · Your details</div>
            <div className="form-grid">
              {DETAILS.map(([name, label, req, type]) => (
                <div className="field" key={name}>
                  <label htmlFor={name}>{label}{req && <span className="req">*</span>}</label>
                  <input id={name} className="input" type={type || 'text'} required={req} value={v[name] || ''}
                    autoComplete={name === 'password' ? 'new-password' : 'off'}
                    onChange={(e) => setV((s) => ({ ...s, [name]: e.target.value }))} placeholder={HINTS[name] || ''} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ height: 42, width: '100%', marginTop: 18 }} disabled={busy || !verified}
              title={verified ? '' : 'Verify your email first'}>
              {busy ? 'Creating account…' : verified ? 'Verify & create account' : 'Enter the email code to continue'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 16 }}>Already registered? <Link href="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
