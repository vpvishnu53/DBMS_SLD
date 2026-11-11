'use client';
/**
 * Server-paged, sortable, searchable, filterable table for any resource.
 * Paging/sort/filter run in Oracle (ROWNUM pagination) -- not in the browser.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useApi } from '@/lib/api';
import { useLookup, VIEW_ENUMS, VIEW_FK } from '@/lib/meta';
import { enumLabel, formatCell, humanize } from '@/lib/format';
import { RESOURCES } from '@/lib/ui-config';
import Icon from './Icon';
import ResourceForm from './ResourceForm';
import { Badge, ConfirmDialog, ErrorBox, useToast } from './ui';

function FilterSelect({ name, meta, value, onChange }) {
  const field = meta.fields.find((f) => f.name === name);
  const fkResource = field?.references?.resource || VIEW_FK[name];
  const enumValues = field?.enum || VIEW_ENUMS[name];
  const lookup = useLookup(!enumValues ? fkResource : null);
  const options = enumValues ? enumValues.map((v) => ({ value: v, label: enumLabel(v) })) : lookup || [];
  const label = humanize(name.replace(/_id$/, ''));
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={`Filter by ${label}`}>
      <option value="">All {label.toLowerCase()}s</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function ResourceTable({ resource, meta, fixedFilters = {}, compact = false }) {
  const cfg = RESOURCES[resource] || {};
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState({ key: '', order: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [deleting, setDeleting] = useState(null);
  const pageSize = compact ? 8 : 15;

  useEffect(() => { const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const path = useMemo(() => {
    const p = new URLSearchParams({ page, pageSize });
    if (debouncedQ) p.set('q', debouncedQ);
    if (sort.key) { p.set('sort', sort.key); p.set('order', sort.order); }
    for (const [k, v] of Object.entries({ ...filters, ...fixedFilters })) if (v !== '' && v != null) p.set(k, v);
    return `/${resource}?${p}`;
  }, [resource, page, pageSize, debouncedQ, sort, filters, fixedFilters]);

  const { data, error, loading, reload } = useApi(path);

  const columns = cfg.columns || meta.columns.slice(0, 8).map((c) => c.name);
  const colType = Object.fromEntries(meta.columns.map((c) => [c.name, c.type]));
  const pk = meta.pk;
  const canWrite = meta.canWrite && !meta.readOnly;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  const toggleSort = (key) =>
    setSort((s) => (s.key !== key ? { key, order: 'asc' } : s.order === 'asc' ? { key, order: 'desc' } : { key: '', order: '' }));

  const renderCell = (row, key) => {
    const v = row[key];
    if (key === cfg.status) return <Badge value={v} />;
    if (key === pk) return <span className="mono pink">{v}</span>;
    if (key === 'budget_variance' && typeof v === 'number')
      return <span style={{ color: v < 0 ? '#ff8c8c' : 'var(--text)' }}>{v < 0 ? '▼ ' : ''}{formatCell(key, v)}</span>;
    if (key === 'load_percent' && typeof v === 'number')
      return <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="meter" style={{ width: 60 }}><span style={{ width: `${Math.min(100, v)}%` }} /></span>{v}%</span>;
    return formatCell(key, v, colType[key]);
  };

  return (
    <div>
      {!compact && (
        <div className="toolbar">
          <div className="search">
            <Icon name="search" />
            <input className="input" placeholder={`Search ${humanize(resource).toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {(cfg.filters || []).filter((f) => !(f in fixedFilters)).map((f) => (
            <FilterSelect key={f} name={f} meta={meta} value={filters[f]}
              onChange={(v) => { setFilters((s) => ({ ...s, [f]: v })); setPage(1); }} />
          ))}
          <span className="spacer" />
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" />New {meta.title}</button>
          )}
        </div>
      )}

      <ErrorBox error={error} onRetry={reload} />

      <div className="table-wrap" style={{ opacity: loading && data ? 0.6 : 1, transition: 'opacity .15s' }}>
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => {
                const numeric = colType[c] === 'number' && c !== pk && !/_id$/.test(c);
                return (
                  <th key={c} className={`sortable ${numeric ? 'num' : ''} ${sort.key === c ? 'sorted' : ''}`} onClick={() => toggleSort(c)}
                    aria-sort={sort.key === c ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {humanize(c)}{sort.key === c && <Icon name={sort.order === 'asc' ? 'arrowUp' : 'arrowDown'} size={11} style={{ marginLeft: 4, verticalAlign: -1 }} />}
                  </th>
                );
              })}
              {canWrite && pk && <th className="actions" />}
            </tr>
          </thead>
          <tbody>
            {data?.data.map((row, i) => (
              <tr key={pk ? row[pk] : i} className={pk ? 'clickable' : ''}
                onClick={() => pk && router.push(`/manage/${resource}/${encodeURIComponent(row[pk])}`)}>
                {columns.map((c) => {
                  const numeric = colType[c] === 'number' && c !== pk && !/_id$/.test(c);
                  return <td key={c} className={numeric ? 'num' : ''} title={typeof row[c] === 'string' ? row[c] : undefined}>{renderCell(row, c)}</td>;
                })}
                {canWrite && pk && (
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => setEditing(row[pk])}><Icon name="edit" size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Delete" onClick={() => setDeleting(row[pk])}><Icon name="trash" size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.data.length && <div className="empty">No records match.</div>}
        {!data && loading && <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>}
      </div>

      {data && data.total > pageSize && (
        <div className="pager">
          <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} of {data.total}</span>
          <div className="row">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevronL" size={14} />Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next<Icon name="chevronR" size={14} /></button>
          </div>
        </div>
      )}
      {data && compact && data.total > pageSize && <div className="pager"><span /></div>}

      {editing != null && (
        <ResourceForm resource={resource} meta={meta} id={editing === 'new' ? null : editing} defaults={fixedFilters}
          onClose={() => setEditing(null)}
          onSaved={(row) => { setEditing(null); reload(); toast(`${meta.title} ${row?.[pk] ?? ''} saved`); }} />
      )}
      {deleting != null && (
        <ConfirmDialog title={`Delete ${meta.title} ${deleting}?`}
          message="This cannot be undone. Oracle will refuse if other records still reference it."
          onConfirm={async () => { await api(`/${resource}/${encodeURIComponent(deleting)}`, { method: 'DELETE' }); reload(); toast(`${meta.title} ${deleting} deleted`); }}
          onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}
