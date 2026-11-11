'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { enumLabel, fmtDateTime, timeAgo } from '@/lib/format';
import Icon from '@/components/Icon';
import { Badge, ErrorBox, Modal, PageHeader, Spinner, useToast } from '@/components/ui';

const STEPS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

function Progress({ status }) {
  if (['REJECTED', 'CLOSED'].includes(status)) return <Badge value={status} />;
  const idx = STEPS.indexOf(status);
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }} aria-label={`Status: ${enumLabel(status)}`}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ flex: 1, minWidth: 54 }}>
          <div style={{ height: 4, borderRadius: 4, background: i <= idx ? 'var(--pink)' : 'var(--surface-3)' }} />
          <div style={{ fontSize: 10.5, marginTop: 4, color: i <= idx ? 'var(--text)' : 'var(--muted)' }}>{enumLabel(s)}</div>
        </div>
      ))}
    </div>
  );
}

function NewComplaint({ onClose, onSaved }) {
  const { data: zones } = useApi('/portal/zones');
  const { data: opts } = useApi('/portal/citizen/complaint-options');
  const [zone, setZone] = useState('');
  const { data: poles } = useApi(zone ? `/portal/streetlights?zone_id=${zone}` : null);
  const [v, setV] = useState({ pole_id: '', issue_category: '', description: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { onSaved(await api('/portal/citizen/complaints', { method: 'POST', body: v })); }
    catch (err) { setError(err); setBusy(false); }
  };

  return (
    <Modal title="Report a streetlight problem" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form="nc" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button>
    </>}>
      <form id="nc" onSubmit={submit} className="form-grid">
        <div className="full"><ErrorBox error={error} /></div>
        <div className="field"><label>Area / zone<span className="req">*</span></label>
          <select className="select" required value={zone} onChange={(e) => { setZone(e.target.value); setV((s) => ({ ...s, pole_id: '' })); }}>
            <option value="">Select your area…</option>
            {(zones || []).map((z) => <option key={z.zone_id} value={z.zone_id}>{z.zone_name} — {z.city_region}</option>)}
          </select></div>
        <div className="field"><label>Pole number<span className="req">*</span></label>
          <select className="select" required disabled={!zone} value={v.pole_id} onChange={(e) => setV((s) => ({ ...s, pole_id: e.target.value }))}>
            <option value="">{zone ? 'Select the pole…' : 'Pick a zone first'}</option>
            {(poles || []).map((p) => (
              <option key={p.pole_id} value={p.pole_id}>
                Pole {p.pole_id} · {enumLabel(p.lamp_type)}{p.open_complaints ? ` · ${p.open_complaints} open report(s)` : ''}
              </option>
            ))}
          </select>
          <span className="hint">The pole number is painted on the pole, about 2 m up.</span></div>
        <div className="field full"><label>What is wrong?<span className="req">*</span></label>
          <div className="row">
            {(opts?.categories || []).map((c) => (
              <button type="button" key={c} className={`btn btn-sm ${v.issue_category === c ? 'btn-primary' : ''}`} onClick={() => setV((s) => ({ ...s, issue_category: c }))}>
                {enumLabel(c)}
              </button>
            ))}
          </div></div>
        <div className="field full"><label>Describe the problem<span className="req">*</span></label>
          <textarea className="textarea" required minLength={10} maxLength={1000} value={v.description}
            onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} placeholder="e.g. Light has been off for 3 nights near the bus stop." /></div>
      </form>
    </Modal>
  );
}

export default function CitizenPortal() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi('/portal/citizen/complaints');
  const [open, setOpen] = useState(false);
  const active = (data || []).filter((c) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(c.ticket_status)).length;

  return (
    <>
      <PageHeader title={<>Hi <span className="accent">{user.displayName.split(' ')[0]}</span></>}
        sub={data ? `${data.length} complaint(s) filed · ${active} being worked on` : 'Your streetlight reports'}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" />Report a problem</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner center /> : (
        <div className="grid grid-2">
          {data?.map((c) => (
            <div className="card" key={c.complaint_id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>#{c.complaint_id} · {enumLabel(c.issue_category)}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{timeAgo(c.reported_timestamp)}</span>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Pole {c.pole_id} · {c.zone_name} · filed {fmtDateTime(c.reported_timestamp)}</div>
              <p style={{ color: 'var(--text-2)', margin: '10px 0 14px' }}>{c.description}</p>
              <Progress status={c.ticket_status} />
              {c.resolution_notes && c.ticket_status === 'RESOLVED' && (
                <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
                  <strong>Fixed:</strong> {c.resolution_notes}{c.completion_timestamp && <span className="muted"> · {fmtDateTime(c.completion_timestamp)}</span>}
                </div>
              )}
            </div>
          ))}
          {data && !data.length && <div className="card empty span-2">No complaints yet. Spotted a dark street? Report it!</div>}
        </div>
      )}
      {open && <NewComplaint onClose={() => setOpen(false)} onSaved={(c) => { setOpen(false); reload(); toast(`Complaint #${c.complaint_id} submitted — thank you!`); }} />}
    </>
  );
}
