'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Icon from './Icon';
import { ErrorBox, Modal, useToast } from './ui';
import { FieldInput } from './ResourceForm';

const CAN = ['ADMIN', 'ZONE_SUPERVISOR', 'ENGINEER', 'TECHNICIAN'];

/** Records a reading via sp_record_energy (allocates the weak-entity log_number). */
export default function EnergyLogForm({ poleId, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ pole_id: poleId ?? '', reading_date: new Date().toISOString().slice(0, 10), units_consumed: '', tariff_inr: '7.5' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!CAN.includes(user?.role)) return null;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const row = await api('/energy-logs', { method: 'POST', body: v });
      toast(`Logged reading #${row.log_number} for pole ${row.pole_id}`);
      setOpen(false); setBusy(false); onSaved?.(row);
    } catch (err) { setError(err); setBusy(false); }
  };
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" />Record reading</button>
      {open && (
        <Modal title="Record energy reading" size="sm" onClose={() => setOpen(false)} footer={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" form="energy-form" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>}>
          <form id="energy-form" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            <ErrorBox error={error} />
            <div className="field"><label>Streetlight<span className="req">*</span></label>
              {poleId ? <input className="input" readOnly value={`Pole ${poleId}`} />
                : <FieldInput field={{ name: 'pole_id', required: true, references: { resource: 'streetlights' } }} value={v.pole_id} onChange={set('pole_id')} />}
            </div>
            <div className="field"><label>Reading date<span className="req">*</span></label><input className="input" type="date" required value={v.reading_date} onChange={(e) => set('reading_date')(e.target.value)} /></div>
            <div className="field"><label>Units consumed (kWh)<span className="req">*</span></label><input className="input" type="number" step="any" min="0" required value={v.units_consumed} onChange={(e) => set('units_consumed')(e.target.value)} /></div>
            <div className="field"><label>Tariff (₹/kWh)</label><input className="input" type="number" step="any" min="0" value={v.tariff_inr} onChange={(e) => set('tariff_inr')(e.target.value)} />
              <span className="hint">Cost is computed in PL/SQL: units × tariff</span></div>
          </form>
        </Modal>
      )}
    </>
  );
}
