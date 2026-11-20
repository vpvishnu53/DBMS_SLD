'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AuthHero from '@/components/AuthHero';
import { ErrorBox } from '@/components/ui';

const FIELDS = [
  ['first_name', 'First name', true], ['last_name', 'Last name', true],
  ['username', 'Username', true], ['email', 'Email', false, 'email'],
  ['password', 'Password', true, 'password'], ['phone', 'Phone', false, 'tel'],
  ['street', 'Street', false], ['city', 'City', false],
  ['state', 'State', false], ['pincode', 'Pincode', false],
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [v, setV] = useState({ city: 'Bengaluru', state: 'Karnataka' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await register(v); router.replace('/citizen'); } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <AuthHero />
      <div className="auth-panel">
        <div className="auth-card" style={{ width: 'min(520px, 100%)' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>Citizen sign-up</h2>
          <p className="muted" style={{ marginTop: 6 }}>Report dark or damaged streetlights and track the fix.</p>
          <form onSubmit={submit} style={{ marginTop: 20 }}>
            <ErrorBox error={error} />
            <div className="form-grid">
              {FIELDS.map(([name, label, req, type]) => (
                <div className="field" key={name}>
                  <label htmlFor={name}>{label}{req && <span className="req">*</span>}</label>
                  <input id={name} className="input" type={type || 'text'} required={req} value={v[name] || ''}
                    onChange={(e) => setV((s) => ({ ...s, [name]: e.target.value }))}
                    placeholder={name === 'username' ? 'lowercase, e.g. asha.k' : name === 'phone' ? '+919876543210' : name === 'password' ? '8+ chars, letter & digit' : ''} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ height: 42, width: '100%', marginTop: 18 }} disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 16 }}>Already registered? <Link href="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
