import Icon from './Icon';

export default function AuthHero() {
  return (
    <div className="auth-hero">
      <div className="brand" style={{ padding: 0 }}>
        <div className="brand-mark"><Icon name="lamp" size={18} style={{ color: '#12020a' }} /></div>
        <div><div className="brand-name">Lumina</div><div className="brand-sub">Smart Streetlight Management</div></div>
      </div>
      <div>
        <h1>Keep the city <span>lit</span>, one pole at a time.</h1>
        <p style={{ marginTop: 16 }}>
          Track every streetlight, feeder pillar and sensor. Route citizen complaints to crews and
          contractors, watch energy spend, and close the loop — all on Oracle.
        </p>
      </div>
      <svg className="poles" viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="glow"><stop offset="0" stopColor="#ff4fa3" stopOpacity=".55" /><stop offset="1" stopColor="#ff4fa3" stopOpacity="0" /></radialGradient>
        </defs>
        {[60, 220, 380, 540, 700].map((x) => (
          <g key={x}>
            <ellipse cx={x + 24} cy="70" rx="70" ry="60" fill="url(#glow)" />
            <path d={`M${x} 180 V40 Q${x} 26 ${x + 14} 26 H${x + 30}`} stroke="#3a3a46" strokeWidth="4" fill="none" />
            <rect x={x + 22} y="24" width="18" height="7" rx="3" fill="#ff4fa3" />
          </g>
        ))}
      </svg>
      <div className="muted" style={{ fontSize: 12, position: 'relative' }}>DBMS Lab · Next.js · Express · Oracle 11g XE</div>
    </div>
  );
}
