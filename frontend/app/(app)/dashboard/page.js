'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtCompactINR, fmtINR, fmtMonth, fmtNum, timeAgo, enumLabel } from '@/lib/format';
import { BarChart, HBarList, Ring } from '@/components/Charts';
import { Badge, ErrorBox, PageHeader, Spinner } from '@/components/ui';

function Stat({ label, value, foot, href }) {
  const body = (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ color: 'inherit' }}>{body}</Link> : body;
}

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload } = useApi('/dashboard');

  if (loading && !data) return <Spinner center />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { kpi, lightStatus, complaintStatus, categories, energy, zones, recent, feeders, lowStock } = data;
  const lastMonth = energy[energy.length - 1];

  return (
    <>
      <PageHeader title={<>Good to see you, <span className="accent">{user.displayName.split(' ')[0]}</span></>}
        sub="Network health across all zones, live from Oracle." />

      <div className="grid grid-4">
        <div className="card"><Ring value={kpi.functional_lights} total={kpi.active_lights} label="Lights functional" /></div>
        <Stat label="Open complaints" value={kpi.open_complaints} foot={`${kpi.faulty_lights} lights currently faulty`} href="/manage/complaints" />
        <Stat label="Open work orders" value={kpi.open_work_orders}
          foot={kpi.avg_resolution_hours != null ? `Avg. resolution ${kpi.avg_resolution_hours} h (90 days)` : 'No completions yet'} href="/manage/work-orders" />
        <Stat label={`Energy · ${lastMonth ? fmtMonth(lastMonth.month) : '—'}`} value={lastMonth ? fmtCompactINR(lastMonth.cost) : '—'}
          foot={lastMonth ? `${fmtNum(lastMonth.units)} kWh · ${kpi.active_sensors}/${kpi.total_sensors} sensors online` : ''} href="/reports" />
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card span-2">
          <div className="card-title">Monthly energy cost <span className="muted" style={{ fontWeight: 500 }}>₹, all zones</span></div>
          <BarChart ariaLabel="Monthly energy cost in rupees" format={fmtCompactINR}
            data={energy.map((e) => ({ label: fmtMonth(e.month), value: e.cost, sub: `${fmtNum(e.units)} kWh` }))} />
        </div>
        <div className="card">
          <div className="card-title">Streetlight status</div>
          <HBarList status data={lightStatus} />
          <div className="card-title" style={{ marginTop: 18 }}>Complaints by category</div>
          <HBarList data={categories} />
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card span-2">
          <div className="card-title">Zone health <Link href="/manage/zones" className="btn btn-ghost btn-sm">All zones</Link></div>
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="table">
              <thead><tr><th>Zone</th><th>Supervisor</th><th className="num">Lights</th><th className="num">Faulty</th><th style={{ width: '32%' }}>Functional</th></tr></thead>
              <tbody>
                {zones.map((z) => {
                  const pct = z.total_lights ? Math.round((z.functional_lights / z.total_lights) * 100) : 0;
                  return (
                    <tr key={z.zone_id} className="clickable" onClick={() => router.push(`/manage/zones/${z.zone_id}`)}>
                      <td style={{ fontWeight: 600 }}>{z.zone_name}</td>
                      <td className="muted">{z.supervisor_name || '—'}</td>
                      <td className="num">{z.total_lights}</td>
                      <td className="num">{z.faulty_lights || <span className="muted">0</span>}</td>
                      <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="meter" style={{ flex: 1 }}><span style={{ width: `${pct}%` }} /></div><span style={{ width: 38, textAlign: 'right' }}>{pct}%</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Ticket pipeline</div>
          <HBarList status data={complaintStatus} />
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title">Latest complaints <Link href="/manage/complaints" className="btn btn-ghost btn-sm">View all</Link></div>
          <ul className="timeline">
            {recent.map((c) => (
              <li key={c.complaint_id}>
                <Link href={`/manage/complaints/${c.complaint_id}`} style={{ color: 'var(--text)', fontWeight: 600 }}>
                  #{c.complaint_id} · {enumLabel(c.issue_category)}
                </Link>
                <div className="muted" style={{ fontSize: 12 }}>Pole {c.pole_id} · {c.zone_name} · {timeAgo(c.reported_timestamp)}</div>
                <div style={{ marginTop: 4 }}><Badge value={c.ticket_status} /></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="card-title">Feeder load (top 5)</div>
          {feeders.map((f) => (
            <div key={f.cabinet_id} style={{ padding: '6px 0' }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
                <Link href={`/manage/feeder-pillars/${f.cabinet_id}`}>FP-{f.cabinet_id} · {f.zone_name}</Link>
                <span>{f.load_percent}%</span>
              </div>
              <div className="meter" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, f.load_percent)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Inventory alerts <Link href="/manage/spare-parts" className="btn btn-ghost btn-sm">Parts</Link></div>
          {lowStock.length ? lowStock.map((p) => (
            <div key={p.part_id} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{p.part_name}</span>
              <span className="row" style={{ gap: 8 }}><strong>{p.quantity_in_stock}</strong><Badge value={p.stock_level} /></span>
            </div>
          )) : <div className="muted">All parts sufficiently stocked.</div>}
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Last month energy bill: {lastMonth ? fmtINR(lastMonth.cost) : '—'}</div>
        </div>
      </div>
    </>
  );
}
