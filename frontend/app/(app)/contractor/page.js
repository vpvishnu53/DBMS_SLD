'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { enumLabel, fmtDateTime, fmtINR } from '@/lib/format';
import { Badge, ErrorBox, Modal, PageHeader, Spinner, useToast } from '@/components/ui';

function CompleteJob({ wo, onClose, onSaved }) {
  const [notes, setNotes] = useState(wo.resolution_notes || '');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try { onSaved(await api(`/portal/company/work-orders/${wo.work_order_id}`, { method: 'PATCH', body: { status: 'COMPLETED', resolution_notes: notes } })); }
    catch (err) { setError(err); }
  };
  return (
    <Modal title={`Complete WO-${wo.work_order_id}`} size="sm" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form="cj">Mark completed</button>
    </>}>
      <form id="cj" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <ErrorBox error={error} />
        <div className="field"><label>Resolution notes<span className="req">*</span></label>
          <textarea className="textarea" required value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done, parts replaced, tests performed…" /></div>
      </form>
    </Modal>
  );
}

export default function ContractorPortal() {
  const toast = useToast();
  const [tab, setTab] = useState('jobs');
  const { data: profile } = useApi('/portal/company/profile');
  const jobs = useApi('/portal/company/work-orders');
  const bills = useApi(tab === 'billing' ? '/portal/company/billing' : null);
  const [completing, setCompleting] = useState(null);

  const start = async (wo) => {
    try { await api(`/portal/company/work-orders/${wo.work_order_id}`, { method: 'PATCH', body: { status: 'IN_PROGRESS' } }); jobs.reload(); toast(`WO-${wo.work_order_id} started`); }
    catch (e) { toast(e.message, 'error'); }
  };
  const open = (jobs.data || []).filter((w) => !['COMPLETED', 'CANCELLED'].includes(w.status));

  return (
    <>
      <PageHeader title={profile?.company_name || 'Contractor portal'}
        sub={profile ? `Licence ${profile.license_no} · ${enumLabel(profile.class_rating)} · GST ${profile.gst_no}` : ''} />
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="stat-label">Open jobs</div><div className="stat-value">{open.length}</div></div>
        <div className="card stat"><div className="stat-label">Completed</div><div className="stat-value">{(jobs.data || []).filter((w) => w.status === 'COMPLETED').length}</div></div>
        <div className="card stat"><div className="stat-label">Avg. resolution</div>
          <div className="stat-value">{(() => { const h = (jobs.data || []).filter((w) => w.resolution_hours != null); return h.length ? `${(h.reduce((s, w) => s + w.resolution_hours, 0) / h.length).toFixed(1)} h` : '—'; })()}</div></div>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab('jobs')}>Work orders</button>
        <button className={`tab ${tab === 'billing' ? 'active' : ''}`} onClick={() => setTab('billing')}>Billing</button>
      </div>

      {tab === 'jobs' && (
        <>
          <ErrorBox error={jobs.error} onRetry={jobs.reload} />
          {jobs.loading && !jobs.data ? <Spinner center /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>WO</th><th>Type</th><th>Status</th><th>Zone</th><th>Pole</th><th>Created</th><th className="num">Hours</th><th /></tr></thead>
                <tbody>
                  {jobs.data?.map((w) => (
                    <tr key={w.work_order_id}>
                      <td className="mono pink">WO-{w.work_order_id}</td>
                      <td>{enumLabel(w.work_type)}</td>
                      <td><Badge value={w.status} /></td>
                      <td>{w.zone_name}</td>
                      <td>{w.pole_id || '—'}</td>
                      <td className="muted">{fmtDateTime(w.created_timestamp)}</td>
                      <td className="num">{w.resolution_hours ?? '—'}</td>
                      <td className="actions">
                        {['PENDING', 'ASSIGNED'].includes(w.status) && <button className="btn btn-sm" onClick={() => start(w)}>Start job</button>}
                        {w.status === 'IN_PROGRESS' && <button className="btn btn-primary btn-sm" onClick={() => setCompleting(w)}>Complete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {jobs.data && !jobs.data.length && <div className="empty">No work orders assigned yet.</div>}
            </div>
          )}
        </>
      )}

      {tab === 'billing' && (
        bills.loading && !bills.data ? <Spinner center /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Bill</th><th>WO</th><th>Payment</th><th>Receipt</th><th className="num">Sanctioned</th><th className="num">Spent</th><th className="num">Billed</th><th className="num">Variance</th></tr></thead>
              <tbody>
                {bills.data?.map((b) => (
                  <tr key={b.billing_id}>
                    <td className="mono pink">BILL-{b.billing_id}</td><td>WO-{b.work_order_id}</td>
                    <td>{enumLabel(b.payment_type)}{b.payment_id ? <span className="muted"> · {b.payment_id}</span> : ''}</td>
                    <td>{b.receipt_no || <Badge value="PENDING" />}</td>
                    <td className="num">{fmtINR(b.budget_sanctioned)}</td><td className="num">{fmtINR(b.actually_spent)}</td>
                    <td className="num">{fmtINR(b.billing_amount)}</td>
                    <td className="num" style={{ color: b.budget_variance < 0 ? '#ff8c8c' : undefined }}>{fmtINR(b.budget_variance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bills.data && !bills.data.length && <div className="empty">No bills yet.</div>}
          </div>
        )
      )}
      {completing && <CompleteJob wo={completing} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); jobs.reload(); toast('Job completed — streetlight & complaint updated'); }} />}
    </>
  );
}
