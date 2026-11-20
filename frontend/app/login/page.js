'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { homeFor, useAuth } from '@/lib/auth';
import { resetMetaCache } from '@/lib/meta';
import AuthHero from '@/components/AuthHero';
import { ErrorBox } from '@/components/ui';

// Every seeded demo login, grouped by role (all use Password@123).
const DEMO = [
  { role: 'Admins', users: ['admin', 'nikhil.joshi'] },
  { role: 'Zone supervisors', users: ['karthik.menon', 'priya.nair', 'rahul.gowda'] },
  { role: 'Engineers', users: ['deepa.k', 'arjun.reddy'] },
  { role: 'Technicians', users: ['suresh.kumar', 'm.irfan', 'lakshmi.hegde'] },
  { role: 'Accountants', users: ['vikram.shetty', 'farah.khan'] },
  { role: 'Support agents', users: ['sneha.k', 'meera.iyer'] },
  { role: 'Contractors', users: ['lumen', 'brightpath', 'deccanpower', 'nammalights'] },
  { role: 'Citizen', users: ['rohan.desai'] },
];

function LoginForm() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (ready && user) router.replace(homeFor(user)); }, [ready, user, router]);

  const submit = async (e, u = username, p = password) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      resetMetaCache();
      const me = await login(u.trim(), p);
      router.replace(homeFor(me));
    } catch (err) {
      setError(err); setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 style={{ fontSize: 26, fontWeight: 800 }}>Sign in</h2>
      <p className="muted" style={{ marginTop: 6 }}>Employees, citizens and contractors all sign in here.</p>
      {params.get('expired') && <div className="alert alert-info">Your session expired — please sign in again.</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 20 }}>
        <ErrorBox error={error} />
        <div className="field">
          <label htmlFor="u">Username</label>
          <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" style={{ height: 42 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>Don&apos;t have an account? <Link href="/register">Sign up</Link></p>

      <div className="card" style={{ marginTop: 24, padding: 14 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>Demo accounts <span className="muted" style={{ fontWeight: 500 }}>password: Password@123</span></div>
        <div className="demo-groups">
          {DEMO.map((g) => (
            <div className="demo-group" key={g.role}>
              <span className="demo-role">{g.role}</span>
              <div className="demo-chips">
                {g.users.map((u) => (
                  <button key={u} type="button" className="btn btn-sm" disabled={busy} title={`Sign in as ${u}`}
                    onClick={() => { setUsername(u); setPassword('Password@123'); submit(null, u, 'Password@123'); }}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-wrap">
      <AuthHero />
      <div className="auth-panel"><Suspense><LoginForm /></Suspense></div>
    </div>
  );
}
