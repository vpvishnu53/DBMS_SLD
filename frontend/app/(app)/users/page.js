'use client';
/**
 * HOMEPAGE logins (ADMIN). Each employee, citizen and company owns exactly one
 * login (1:1, total participation in logs_into / registers_on / accesses), so
 * logins are created with their owner and deleted with it. Here an admin can
 * create an account for any role (staff, contractor, citizen), see who owns
 * each login, enable/disable it and reset its password.
 */
import { useState } from 'react';
import Link from 'next/link';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMeta } from '@/lib/meta';
import { enumLabel, fmtDateTime } from '@/lib/format';
import Icon from '@/components/Icon';
import ResourceForm from '@/components/ResourceForm';
import { Badge, ErrorBox, Modal, PageHeader, Spinner, useToast } from '@/components/ui';

const TYPES = ['EMPLOYEE', 'CIVILIAN', 'COMPANY'];

// What the admin can create. Staff roles pre-fill the role and a matching department.
const ACCOUNT_KINDS = [
  { key: 'ADMIN', label: 'Admin', resource: 'employees', deptType: 'ADMINISTRATION' },
  { key: 'ZONE_SUPERVISOR', label: 'Zone supervisor', resource: 'employees', deptType: 'OPERATIONS' },
  { key: 'ENGINEER', label: 'Engineer', resource: 'employees', deptType: 'MAINTENANCE' },
  { key: 'TECHNICIAN', label: 'Technician', resource: 'employees', deptType: 'MAINTENANCE' },
  { key: 'ACCOUNTANT', label: 'Accountant', resource: 'employees', deptType: 'FINANCE' },
  { key: 'SUPPORT_AGENT', label: 'Support agent', resource: 'employees', deptType: 'CUSTOMER_SERVICE' },
  { key: 'COMPANY', label: 'Contractor company', resource: 'companies' },
  { key: 'CIVILIAN', label: 'Citizen', resource: 'civilians' },
];

/** Step 1: pick the kind of account. Step 2: the normal create form (with its Login block). */
function NewAccount({ onClose, onSaved }) {
  const { meta, error } = useMeta();
  const { data: depts } = useApi('/departments?pageSize=100');
  const [kind, setKind] = useState(null);

  if (kind && meta) {
    const isStaff = kind.resource === 'employees';
    const dept = isStaff ? depts?.data.find((d) => d.dept_type === kind.deptType) : null;
    return (
      <ResourceForm resource={kind.resource} meta={meta[kind.resource]}
        title={`New ${kind.label.toLowerCase()} account`}
        defaults={isStaff ? { role: kind.key, ...(dept ? { dept_id: dept.dept_id } : {}) } : {}}
        onClose={onClose} onSaved={onSaved} />
    );
  }
  return (
    <Modal title="New account" size="sm" onClose={onClose}>
      <ErrorBox error={error} />
      <p className="muted" style={{ marginTop: 0 }}>What kind of account?</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ACCOUNT_KINDS.map((k) => (
          <button key={k.key} type="button" className="btn" style={{ justifyContent: 'flex-start' }}
            disabled={!meta} onClick={() => setKind(k)}>
            {k.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
const ownerLink = (u) =>
  u.emp_id ? `/manage/employees/${u.emp_id}`
    : u.citizen_id ? `/manage/civilians/${u.citizen_id}`
      : u.license_no ? `/manage/companies/${encodeURIComponent(u.license_no)}` : null;

function ResetPassword({ username, onClose, onDone }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try { await api(`/users/${username}`, { method: 'PATCH', body: { password: pw } }); onDone(); }
    catch (err) { setError(err); }
  };
  return (
    <Modal title={`Reset password · ${username}`} size="sm" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form="rp">Set password</button>
    </>}>
      <form id="rp" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <ErrorBox error={error} />
        <div className="field"><label htmlFor="rp_pw">New password<span className="req">*</span></label>
          <input id="rp_pw" className="input" type="password" required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <span className="hint">8+ characters with a letter and a digit. Stored as a bcrypt hash.</span></div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('');
  const { data, error, loading, reload } = useApi(`/users?pageSize=200${type ? `&user_type=${type}` : ''}`);
  const [resetting, setResetting] = useState(null);
  const [creating, setCreating] = useState(false);

  const toggle = async (u) => {
    try {
      await api(`/users/${u.username}`, { method: 'PATCH', body: { is_active: u.is_active === 'Y' ? 'N' : 'Y' } });
      reload(); toast(`${u.username} ${u.is_active === 'Y' ? 'disabled' : 'enabled'}`);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader title="Logins" sub="Create accounts for any role. Every employee, citizen and company owns exactly one login (HOMEPAGE), created and deleted together with it.">
        <select className="select" style={{ width: 170 }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by account type">
          <option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" />New account</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner center /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Username</th><th>Type</th><th>Owner</th><th>Role</th><th>Status</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {data?.data.map((u) => (
                <tr key={u.username}>
                  <td className="mono pink">{u.username}</td>
                  <td>{enumLabel(u.user_type)}</td>
                  <td>{ownerLink(u) ? <Link href={ownerLink(u)}>{u.display_name}</Link> : <span className="muted">—</span>}</td>
                  <td className="muted">{u.employee_role ? enumLabel(u.employee_role) : '—'}</td>
                  <td><Badge value={u.is_active === 'Y' ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td className="muted">{fmtDateTime(u.last_login_at)}</td>
                  <td className="actions">
                    <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                      <button className="btn btn-sm" onClick={() => setResetting(u.username)}>Reset password</button>
                      {u.username !== user.username && (
                        <button className="btn btn-sm" onClick={() => toggle(u)}>{u.is_active === 'Y' ? 'Disable' : 'Enable'}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <NewAccount onClose={() => setCreating(false)}
          onSaved={(row) => { setCreating(false); reload(); toast(`Account ${row?.username || ''} created`); }} />
      )}
      {resetting && (
        <ResetPassword username={resetting} onClose={() => setResetting(null)}
          onDone={() => { toast(`Password reset for ${resetting}`); setResetting(null); }} />
      )}
    </>
  );
}
