'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLookup, useMeta, VIEW_FK } from '@/lib/meta';
import { enumLabel, fmtINR, fmtMonth, formatCell, humanize } from '@/lib/format';
import { RESOURCES } from '@/lib/ui-config';
import Icon from '@/components/Icon';
import ResourceForm from '@/components/ResourceForm';
import ResourceTable from '@/components/ResourceTable';
import EnergyLogForm from '@/components/EnergyLogForm';
import { BarChart } from '@/components/Charts';
import { Badge, ConfirmDialog, ErrorBox, Modal, PageHeader, Spinner, useToast } from '@/components/ui';

/* ---------- related panels per resource ---------- */
const RELATED = {
  zones: [
    { title: 'Streetlights', resource: 'streetlights', filter: 'zone_id' },
    { title: 'Feeder pillars', resource: 'feeder-pillars', filter: 'zone_id' },
    { title: 'Work orders', resource: 'work-orders', filter: 'zone_id' },
  ],
  'feeder-pillars': [{ title: 'Streetlights powered', resource: 'streetlights', filter: 'cabinet_id' }],
  departments: [{ title: 'Employees', resource: 'employees', filter: 'dept_id' }],
  civilians: [{ title: 'Complaints submitted', resource: 'complaints', filter: 'citizen_id' }],
  companies: [{ title: 'Work orders executed', resource: 'work-orders', filter: 'license_no' }],
  employees: [
    { title: 'Assigned work orders', resource: 'work-orders', filter: 'emp_id' },
    { title: 'Complaints handled', resource: 'complaints', filter: 'handled_by' },
  ],
};

function Related({ meta, id, panels }) {
  const [tab, setTab] = useState(0);
  const p = panels[tab];
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="tabs">
        {panels.map((x, i) => <button key={x.title} className={`tab ${i === tab ? 'active' : ''}`} onClick={() => setTab(i)}>{x.title}</button>)}
      </div>
      <ResourceTable key={p.resource + p.filter} resource={p.resource} meta={meta[p.resource]} fixedFilters={{ [p.filter]: id }} compact />
    </div>
  );
}

/* ---------- streetlight drill-down (sensors, energy, complaints, work orders) ---------- */
function StreetlightPanels({ id }) {
  const [tab, setTab] = useState('energy-logs');
  const { data, loading, reload } = useApi(`/streetlights/${id}/${tab}`);
  const tabs = [['energy-logs', 'Energy'], ['sensors', 'Sensors'], ['complaints', 'Complaints'], ['work-orders', 'Work orders']];
  const COLS = {
    'energy-logs': ['log_number', 'reading_date', 'units_consumed', 'cost_inr'],
    sensors: ['sensor_id', 'sensor_type', 'status', 'manufacturer', 'last_reading_value', 'last_reading_time'],
    complaints: ['complaint_id', 'issue_category', 'ticket_status', 'citizen_name', 'reported_timestamp'],
    'work-orders': ['work_order_id', 'work_type', 'status', 'employee_name', 'company_name', 'created_timestamp', 'resolution_hours'],
  };
  const link = { complaints: 'complaints', 'work-orders': 'work-orders', sensors: 'sensors' }[tab];
  const pkCol = COLS[tab][0];
  const series = tab === 'energy-logs' && data ? [...data].reverse().map((r) => ({ label: fmtMonth(r.reading_date.slice(0, 7)), value: r.units_consumed, sub: fmtINR(r.cost_inr) })) : null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="tabs">
        {tabs.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        <span className="spacer" />
        {tab === 'energy-logs' && <div style={{ padding: '4px 0' }}><EnergyLogForm poleId={id} onSaved={reload} /></div>}
      </div>
      {loading && !data ? <Spinner center /> : (
        <>
          {series && series.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="card-title">Units consumed per reading (kWh)</div>
              <BarChart data={series} height={180} format={(v) => Math.round(v)} ariaLabel="Energy consumption per reading" />
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{COLS[tab].map((c) => <th key={c}>{humanize(c)}</th>)}</tr></thead>
              <tbody>
                {(data || []).map((r, i) => (
                  <tr key={i}>
                    {COLS[tab].map((c) => (
                      <td key={c}>
                        {c === pkCol && link ? <Link href={`/manage/${link}/${r[c]}`} className="mono">{r[c]}</Link>
                          : /status/.test(c) ? <Badge value={r[c]} /> : formatCell(c, r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data && !data.length && <div className="empty">Nothing recorded.</div>}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- work order: parts used (M:N) + status workflow ---------- */
const NEXT_STATUS = { PENDING: ['ASSIGNED', 'CANCELLED'], ASSIGNED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'] };
const OPS = ['ADMIN', 'ZONE_SUPERVISOR', 'ENGINEER', 'TECHNICIAN'];

function WorkOrderPanels({ id, row, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: parts, reload } = useApi(`/work-orders/${id}/parts`);
  const partOptions = useLookup('spare-parts');
  const [add, setAdd] = useState({ part_id: '', quantity_used: 1 });
  const [error, setError] = useState(null);
  const canEdit = OPS.includes(user.role) && !['COMPLETED', 'CANCELLED'].includes(row.status);

  const addPart = async (e) => {
    e.preventDefault(); setError(null);
    try { await api(`/work-orders/${id}/parts`, { method: 'POST', body: add }); reload(); onChange(); setAdd({ part_id: '', quantity_used: 1 }); toast('Part added — stock debited by trigger'); }
    catch (err) { setError(err); }
  };
  const removePart = async (pid) => {
    try { await api(`/work-orders/${id}/parts/${pid}`, { method: 'DELETE' }); reload(); onChange(); toast('Part removed — stock restored'); }
    catch (err) { setError(err); }
  };
  const move = async (status) => {
    setError(null);
    try { await api(`/work-orders/${id}`, { method: 'PATCH', body: { status } }); onChange(); toast(`Work order → ${enumLabel(status)}`); }
    catch (err) { setError(err); }
  };
  const total = (parts || []).reduce((s, p) => s + p.line_cost, 0);

  return (
    <div className="grid grid-3" style={{ marginTop: 16 }}>
      <div className="card span-2">
        <div className="card-title">Spare parts used <span>{fmtINR(total)}</span></div>
        <ErrorBox error={error} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Part</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Line cost</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {(parts || []).map((p) => (
                <tr key={p.part_id}>
                  <td>{p.part_name}</td><td className="num">{p.quantity_used}</td>
                  <td className="num">{fmtINR(p.unit_price)}</td><td className="num">{fmtINR(p.line_cost)}</td>
                  {canEdit && <td className="actions"><button className="btn btn-ghost btn-icon btn-sm" onClick={() => removePart(p.part_id)} title="Remove"><Icon name="trash" size={14} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {parts && !parts.length && <div className="empty">No parts used.</div>}
        </div>
        {canEdit && (
          <form className="row" style={{ marginTop: 12 }} onSubmit={addPart}>
            <select className="select" style={{ flex: '1 1 220px', width: 'auto' }} required value={add.part_id} onChange={(e) => setAdd((s) => ({ ...s, part_id: e.target.value }))}>
              <option value="">Select part…</option>
              {(partOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input className="input" type="number" min="1" style={{ width: 90 }} value={add.quantity_used} onChange={(e) => setAdd((s) => ({ ...s, quantity_used: e.target.value }))} />
            <button className="btn btn-primary"><Icon name="plus" />Add part</button>
          </form>
        )}
      </div>
      <div className="card">
        <div className="card-title">Workflow</div>
        <div style={{ marginBottom: 12 }}><Badge value={row.status} /></div>
        {OPS.includes(user.role) && (NEXT_STATUS[row.status] || []).map((s) => (
          <button key={s} className={`btn ${s === 'CANCELLED' ? 'btn-danger' : 'btn-primary'}`} style={{ width: '100%', marginBottom: 8 }} onClick={() => move(s)}>
            Move to {enumLabel(s)}
          </button>
        ))}
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Status changes fire <span className="mono">trg_work_order_aiu</span>: the streetlight and the linked complaint update automatically.
        </p>
        {row.billing_id && <Link className="btn btn-sm" href={`/manage/billing/${row.billing_id}`}>View bill BILL-{row.billing_id}</Link>}
      </div>
    </div>
  );
}

/* ---------- complaint: dispatch a work order (sp_complaint_to_work_order) ---------- */
function DispatchButton({ complaint, meta, onDone }) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ work_type: 'REPAIR', emp_id: '', license_no: '' });
  const [error, setError] = useState(null);
  const employees = useLookup(open ? 'employees' : null);
  const companies = useLookup(open ? 'companies' : null);
  const types = meta['work-orders'].fields.find((f) => f.name === 'work_type')?.enum || [];
  if (!['ADMIN', 'SUPPORT_AGENT', 'ZONE_SUPERVISOR', 'ENGINEER'].includes(user.role)) return null;
  if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(complaint.ticket_status)) return null;

  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      const wo = await api(`/complaints/${complaint.complaint_id}/work-order`, { method: 'POST', body: v });
      onDone?.(); router.push(`/manage/work-orders/${wo.work_order_id}`);
    } catch (err) { setError(err); }
  };
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="wrench" />Dispatch work order</button>
      {open && (
        <Modal title={`Dispatch for complaint #${complaint.complaint_id}`} size="sm" onClose={() => setOpen(false)} footer={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" form="dispatch">Create work order</button>
        </>}>
          <form id="dispatch" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            <ErrorBox error={error} />
            <div className="field"><label>Work type</label>
              <select className="select" value={v.work_type} onChange={(e) => setV((s) => ({ ...s, work_type: e.target.value }))}>
                {types.map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
              </select></div>
            <div className="field"><label>Assign employee</label>
              <select className="select" value={v.emp_id} onChange={(e) => setV((s) => ({ ...s, emp_id: e.target.value }))}>
                <option value="">— none —</option>{(employees || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
            <div className="field"><label>Contractor company</label>
              <select className="select" value={v.license_no} onChange={(e) => setV((s) => ({ ...s, license_no: e.target.value }))}>
                <option value="">— in-house —</option>{(companies || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Runs PL/SQL <span className="mono">sp_complaint_to_work_order</span> atomically.</p>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------- page ---------- */
export default function DetailPage() {
  const { resource, id: rawId } = useParams();
  const id = decodeURIComponent(rawId);
  const router = useRouter();
  const toast = useToast();
  const { meta, error: metaError } = useMeta();
  const { data: row, error, loading, reload } = useApi(meta?.[resource]?.pk ? `/${resource}/${encodeURIComponent(id)}` : null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (metaError) return <ErrorBox error={metaError} />;
  if (!meta || (loading && !row)) return <Spinner center />;
  const m = meta[resource];
  if (!m) return <ErrorBox error={{ message: 'Unknown section' }} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!row) return null;

  const cfg = RESOURCES[resource] || {};
  const colType = Object.fromEntries(m.columns.map((c) => [c.name, c.type]));
  const fkOf = (k) => m.fields.find((f) => f.name === k)?.references?.resource || (k !== m.pk && VIEW_FK[k]);
  const title = row.full_name || row.zone_name && resource === 'zones' && row.zone_name || row.company_name && resource === 'companies' && row.company_name
    || row.part_name || row.dept_name && resource === 'departments' && row.dept_name || `${m.title} ${id}`;

  return (
    <>
      <PageHeader title={title}
        crumbs={<><Link href={`/manage/${resource}`}>{humanize(resource.replace(/-/g, '_'))}</Link> / {id}</>}
        sub={cfg.status ? <span style={{ display: 'inline-block', marginTop: 4 }}><Badge value={row[cfg.status]} /></span> : cfg.blurb}>
        {resource === 'complaints' && <DispatchButton complaint={row} meta={meta} onDone={reload} />}
        {m.canWrite && <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" />Edit</button>}
        {m.canWrite && <button className="btn btn-danger" onClick={() => setDeleting(true)}><Icon name="trash" />Delete</button>}
      </PageHeader>

      <div className="card">
        <dl className="kv" style={{ margin: 0 }}>
          {Object.entries(row).filter(([k]) => !['emails', 'phones'].includes(k) || !Array.isArray(row[k])).map(([k, v]) => {
            const fk = fkOf(k);
            return (
              <div key={k}>
                <dt>{humanize(k)}</dt>
                <dd>
                  {fk && v != null ? <Link href={`/manage/${fk}/${encodeURIComponent(v)}`}>{v}</Link>
                    : /status|stock_level/.test(k) && typeof v === 'string' ? <Badge value={v} />
                    : k === 'description' || k === 'resolution_notes' ? <span style={{ whiteSpace: 'pre-wrap' }}>{v || '—'}</span>
                    : typeof v === 'string' && /^[A-Z_]+$/.test(v) && v.length > 1 ? enumLabel(v)
                    : formatCell(k, v, colType[k])}
                </dd>
              </div>
            );
          })}
          {['emails', 'phones'].filter((k) => Array.isArray(row[k])).map((k) => (
            <div key={k}><dt>{humanize(k)} (multivalued)</dt><dd>{row[k].length ? row[k].map((x) => <span key={x} className="tag">{x}</span>) : '—'}</dd></div>
          ))}
          {resource === 'streetlights' && (
            <div><dt>Map</dt><dd><a href={`https://www.openstreetmap.org/?mlat=${row.latitude}&mlon=${row.longitude}#map=18/${row.latitude}/${row.longitude}`} target="_blank" rel="noreferrer">
              <Icon name="pin" size={13} style={{ verticalAlign: -2 }} /> Open location</a></dd></div>
          )}
        </dl>
      </div>

      {resource === 'streetlights' && <StreetlightPanels id={id} />}
      {resource === 'work-orders' && <WorkOrderPanels id={id} row={row} onChange={reload} />}
      {RELATED[resource] && <Related meta={meta} id={id} panels={RELATED[resource]} />}

      {editing && (
        <ResourceForm resource={resource} meta={m} id={id} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); reload(); toast('Saved'); }} />
      )}
      {deleting && (
        <ConfirmDialog title={`Delete ${m.title} ${id}?`} message="This cannot be undone. Oracle will refuse if other records still reference it."
          onConfirm={async () => { await api(`/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' }); toast(`${m.title} deleted`); router.push(`/manage/${resource}`); }}
          onClose={() => setDeleting(false)} />
      )}
    </>
  );
}
