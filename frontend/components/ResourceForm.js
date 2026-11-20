'use client';
/**
 * Create/edit form rendered entirely from Oracle-introspected metadata:
 * CHECK ... IN (...) -> select, FK -> lookup select, DATE -> date picker,
 * TIMESTAMP -> datetime picker, NOT NULL -> required, multivalued attr -> list input.
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { invalidateLookup, useLookup } from '@/lib/meta';
import { enumLabel, humanize } from '@/lib/format';
import { RESOURCES } from '@/lib/ui-config';
import { ErrorBox, Modal, Spinner } from './ui';

function LookupSelect({ resource, value, onChange, required, id }) {
  const options = useLookup(resource);
  return (
    <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{options ? (required ? 'Select…' : '— none —') : 'Loading…'}</option>
      {(options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function FieldInput({ field, value, onChange, readOnly }) {
  const id = `f_${field.name}`;
  if (field.references?.resource && !readOnly)
    return <LookupSelect id={id} resource={field.references.resource} value={value} onChange={onChange} required={field.required} />;
  if (field.enum && !readOnly) {
    const yn = field.enum.length === 2 && field.enum.includes('Y') && field.enum.includes('N');
    return (
      <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required}>
        {(!field.required || value == null || value === '') && <option value="">{field.required ? 'Select…' : '— none —'}</option>}
        {field.enum.map((v) => <option key={v} value={v}>{yn ? (v === 'Y' ? 'Yes' : 'No') : enumLabel(v)}</option>)}
      </select>
    );
  }
  if (field.type === 'string' && field.maxLength > 200)
    return <textarea id={id} className="textarea" value={value ?? ''} maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} required={field.required} />;

  const type = field.type === 'date' ? 'date' : field.type === 'timestamp' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text';
  const v = value == null ? '' : field.type === 'timestamp' ? String(value).slice(0, 16) : field.type === 'date' ? String(value).slice(0, 10) : value;
  return (
    <input id={id} className="input" type={type} value={v} onChange={(e) => onChange(e.target.value)} readOnly={readOnly}
      required={field.required} maxLength={field.type === 'string' ? field.maxLength : undefined}
      step={field.type === 'number' ? (field.scale ? 'any' : '1') : undefined}
      min={field.type === 'number' ? field.min : undefined} max={field.type === 'number' ? field.max : undefined} />
  );
}

export default function ResourceForm({ resource, meta, id, defaults, title: titleOverride, onClose, onSaved }) {
  const editing = id != null;
  const cfg = RESOURCES[resource] || {};
  const [values, setValues] = useState(defaults || {});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) return;
    api(`/${resource}/${encodeURIComponent(id)}`)
      .then((row) => { setValues(row); setLoading(false); })
      .catch((e) => { setError(e); setLoading(false); });
  }, [editing, resource, id]);

  const fields = useMemo(() => {
    const all = meta.fields.filter((f) => !f.generated && !(cfg.hidden || []).includes(f.name));
    const multi = Object.entries(meta.multi || {}).map(([name, m]) => ({ name, type: 'multi', maxLength: m.maxLength }));
    const list = [...all, ...multi];
    const order = cfg.form || [];
    return list.sort((a, b) => {
      const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }, [meta, cfg]);

  const set = (name) => (v) => setValues((s) => ({ ...s, [name]: v }));
  // employees / civilians / companies own exactly one login (1:1, total participation):
  // it is created with the record and cannot be changed here afterwards
  const needsLogin = !editing && !!meta.login;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const body = {};
    if (needsLogin) { body.username = (values.username || '').trim().toLowerCase(); body.password = values.password || ''; }
    for (const f of fields) {
      if (editing && f.pk) continue;
      let v = values[f.name];
      if (f.type === 'multi') {
        v = Array.isArray(v) ? v : String(v ?? '').split(',');
        body[f.name] = v.map((x) => String(x).trim()).filter(Boolean);
        continue;
      }
      if (v === '' || v === undefined) v = null;
      if (!editing && v === null) continue;
      body[f.name] = v;
    }
    try {
      const saved = editing
        ? await api(`/${resource}/${encodeURIComponent(id)}`, { method: 'PUT', body })
        : await api(`/${resource}`, { method: 'POST', body });
      invalidateLookup(resource);
      onSaved?.(saved);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const errField = error?.message?.split(/[ :]/)[0];
  const title = titleOverride || `${editing ? 'Edit' : 'New'} ${meta.title || humanize(resource)}${editing ? ` · ${id}` : ''}`;

  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button type="submit" form="resource-form" className="btn btn-primary" disabled={saving || loading}>
        {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
      </button>
    </>}>
      {loading ? <Spinner center /> : (
        <form id="resource-form" onSubmit={submit} noValidate={false}>
          <ErrorBox error={error} />
          {needsLogin && (
            <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--surface-2)' }}>
              <div className="card-title" style={{ marginBottom: 10 }}>
                Login <span className="muted" style={{ fontWeight: 500 }}>every {meta.title.toLowerCase()} has exactly one</span>
              </div>
              <div className="form-grid">
                <div className={`field ${/username/i.test(error?.message || '') ? 'has-error' : ''}`}>
                  <label htmlFor="f_username">Username<span className="req">*</span></label>
                  <input id="f_username" className="input" required autoComplete="off" value={values.username || ''}
                    onChange={(e) => set('username')(e.target.value.toLowerCase())} placeholder="e.g. asha.k" />
                  <span className="hint">3–40 chars: lowercase letters, digits, dot, underscore</span>
                </div>
                <div className={`field ${/password/i.test(error?.message || '') ? 'has-error' : ''}`}>
                  <label htmlFor="f_password">Password<span className="req">*</span></label>
                  <input id="f_password" className="input" type="password" required autoComplete="new-password"
                    value={values.password || ''} onChange={(e) => set('password')(e.target.value)} />
                  <span className="hint">8+ characters with a letter and a digit</span>
                </div>
              </div>
            </div>
          )}
          <div className="form-grid">
            {fields.map((f) => {
              const wide = f.type === 'multi' || (f.type === 'string' && f.maxLength > 200);
              const label = f.references?.resource ? humanize(f.name.replace(/_id$|_no$/, '')) : humanize(f.name);
              return (
                <div key={f.name} className={`field ${wide ? 'full' : ''} ${errField === f.name ? 'has-error' : ''}`}>
                  <label htmlFor={`f_${f.name}`}>{label}{f.required && <span className="req">*</span>}</label>
                  {f.type === 'multi' ? (
                    <input id={`f_${f.name}`} className="input"
                      value={Array.isArray(values[f.name]) ? values[f.name].join(', ') : values[f.name] ?? ''}
                      onChange={(e) => set(f.name)(e.target.value)} placeholder="Separate multiple values with commas" />
                  ) : (
                    <FieldInput field={f} value={values[f.name]} onChange={set(f.name)} readOnly={editing && f.pk} />
                  )}
                  {f.type === 'multi' && <span className="hint">Multivalued attribute — stored in its own table</span>}
                  {f.min !== undefined && f.type === 'number' && (
                    <span className="hint">{f.max !== undefined ? `${f.min} – ${f.max}` : `${f.exclusiveMin ? '>' : '≥'} ${f.min}`}</span>
                  )}
                </div>
              );
            })}
          </div>
        </form>
      )}
    </Modal>
  );
}
