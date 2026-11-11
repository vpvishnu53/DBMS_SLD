'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLookup } from '@/lib/meta';
import { enumLabel, fmtDateTime } from '@/lib/format';
import Icon from '@/components/Icon';
import { Badge, ConfirmDialog, ErrorBox, Modal, PageHeader, Spinner, useToast } from '@/components/ui';

const LINK = { EMPLOYEE: ['emp_id', 'employees'], CIVILIAN: ['citizen_id', 'civilians'], COMPANY: ['license_no', 'companies'] };

function NewUser({ onClose, onSaved }) {
  const [v, setV] = useState({ user_type: 'EMPLOYEE', username: '', password: '' });
  const [error, setError] = useState(null);
  const [linkKey, linkRes] = LINK[v.user_type];
  const options = useLookup(linkRes);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try { onSaved(await api('/users', { method: 'POST', body: v })); } catch (err) { setError(err); }
  };
  return (
    <Modal title="New login account" size="sm" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form="nu">Create</button>
    </>}>
      <form id="nu" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <ErrorBox error={error} />
        <div className="field"><label>Account type</label>
          <select className="select" value={v.user_type} onChange={(e) => setV({ user_type: e.target.value, username: v.username, password: v.password })}>
            {Object.keys(LINK).map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
          </select></div>
        <div className="field"><label>Linked {enumLabel(v.user_type).toLowerCase()}<span className="req">*</span></label>
          <select className="select" required value={v[linkKey] || ''} onChange={(e) => setV((s) => ({ ...s, [linkKey]: e.target.value }))}>
            <option value="">Select…</option>{(options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="hint">HOMEPAGE is 1:0..1 with each person/company (unique FK).</span></div>
        <div className="field"><label>Username<span className="req">*</span></label>
          <input className="input" required value={v.username} onChange={(e) => setV((s) => ({ ...s, username: e.target.value.toLowerCase() }))} /></div>
        <div className="field"><label>Password<span className="req">*</span></label>
          <input className="input" type="password" required value={v.password} onChange={(e) => setV((s) => ({ ...s, password: e.target.value }))} />
          <span className="hint">Stored as a bcrypt hash.</span></div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('');
  const { data, error, loading, reload } = useApi(`/users?pageSize=200${type ? `&user_type=${type}` : ''}`);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const toggle = async (u) => {
    try {
      await api(`/users/${u.username}`, { method: 'PATCH', body: { is_active: u.is_active === 'Y' ? 'N' : 'Y' } });
      reload(); toast(`${u.username} ${u.is_active === 'Y' ? 'disabled' : 'enabled'}`);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader title="User accounts" sub="HOMEPAGE entity — logins for employees, citizens and contractors.">
        <select className="select" style={{ width: 170 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>{Object.keys(LINK).map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" />New account</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner center /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Username</th><th>Type</th><th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {data?.data.map((u) => (
                <tr key={u.username}>
                  <td className="mono pink">{u.username}</td>
                  <td>{enumLabel(u.user_type)}</td>
                  <td>{u.display_name}</td>
                  <td className="muted">{u.employee_role ? enumLabel(u.employee_role) : '—'}</td>
                  <td><Badge value={u.is_active === 'Y' ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td className="muted">{fmtDateTime(u.last_login_at)}</td>
                  <td className="actions">
                    {u.username !== user.username && (
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => toggle(u)}>{u.is_active === 'Y' ? 'Disable' : 'Enable'}</button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleting(u.username)} title="Delete"><Icon name="trash" size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <NewUser onClose={() => setCreating(false)} onSaved={(u) => { setCreating(false); reload(); toast(`Account ${u.username} created`); }} />}
      {deleting && (
        <ConfirmDialog title={`Delete login ${deleting}?`} message="The person/company record stays; only the login is removed."
          onConfirm={async () => { await api(`/users/${deleting}`, { method: 'DELETE' }); reload(); toast('Account deleted'); }}
          onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
