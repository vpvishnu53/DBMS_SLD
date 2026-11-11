'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { enumLabel, fmtDateTime } from '@/lib/format';
import { ErrorBox, PageHeader, useToast } from '@/components/ui';

export default function AccountPage() {
  const toast = useToast();
  const { data } = useApi('/auth/me');
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault(); setError(null);
    if (v.newPassword !== v.confirm) { setError({ message: 'New passwords do not match.' }); return; }
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: v.currentPassword, newPassword: v.newPassword } });
      setV({ currentPassword: '', newPassword: '', confirm: '' }); toast('Password updated');
    } catch (err) { setError(err); }
  };
  const acc = data?.account;

  return (
    <>
      <PageHeader title="Account" sub="Your login (HOMEPAGE record)" />
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Profile</div>
          {acc && (
            <dl className="kv" style={{ margin: 0 }}>
              <div><dt>Username</dt><dd className="mono">{acc.username}</dd></div>
              <div><dt>Name</dt><dd>{acc.display_name}</dd></div>
              <div><dt>Account type</dt><dd>{enumLabel(acc.user_type)}</dd></div>
              {acc.employee_role && <div><dt>Role</dt><dd>{enumLabel(acc.employee_role)}</dd></div>}
              <div><dt>Member since</dt><dd>{fmtDateTime(acc.created_at)}</dd></div>
              <div><dt>Last login</dt><dd>{fmtDateTime(acc.last_login_at)}</dd></div>
            </dl>
          )}
        </div>
        <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Change password</div>
          <ErrorBox error={error} />
          {[['currentPassword', 'Current password'], ['newPassword', 'New password'], ['confirm', 'Confirm new password']].map(([k, l]) => (
            <div className="field" key={k}><label>{l}</label>
              <input className="input" type="password" required value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} /></div>
          ))}
          <button className="btn btn-primary" style={{ justifySelf: 'start' }}>Update password</button>
        </form>
      </div>
    </>
  );
}
