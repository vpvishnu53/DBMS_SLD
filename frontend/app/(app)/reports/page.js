'use client';
import { useMemo, useState } from 'react';
import { useApi } from '@/lib/api';
import { formatCell, humanize } from '@/lib/format';
import { Badge, ErrorBox, PageHeader, Spinner } from '@/components/ui';

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export default function ReportsPage() {
  const { data: list } = useApi('/reports');
  const [active, setActive] = useState('zone-energy');
  const { data, error, loading, reload } = useApi(`/reports/${active}`);
  const cols = useMemo(() => (data?.rows?.[0] ? Object.keys(data.rows[0]) : []), [data]);

  const download = () => {
    const blob = new Blob([toCsv(data.rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${active}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHeader title="Reports" sub="Analytical SQL (GROUP BY, joins, PL/SQL functions) run live against Oracle.">
        {data?.rows?.length > 0 && <button className="btn" onClick={download}>Export CSV</button>}
      </PageHeader>
      <div className="tabs">
        {(list || []).map((r) => (
          <button key={r.id} className={`tab ${active === r.id ? 'active' : ''}`} onClick={() => setActive(r.id)}>{r.title}</button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner center /> : data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{cols.map((c) => <th key={c} className={typeof data.rows[0][c] === 'number' && !/_id$/.test(c) ? 'num' : ''}>{humanize(c)}</th>)}</tr></thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c} className={typeof r[c] === 'number' && !/_id$/.test(c) ? 'num' : ''}>
                      {c === 'verdict' ? <Badge value={r[c]} /> : formatCell(c, r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!data.rows.length && <div className="empty">No rows.</div>}
        </div>
      )}
    </>
  );
}
