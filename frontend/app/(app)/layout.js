'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { homeFor, useAuth } from '@/lib/auth';
import { resetMetaCache } from '@/lib/meta';
import { initials, enumLabel } from '@/lib/format';
import { CIVILIAN_NAV, COMPANY_NAV, EMPLOYEE_NAV } from '@/lib/ui-config';
import Icon from '@/components/Icon';
import { Spinner } from '@/components/ui';

const AREA = { EMPLOYEE: ['/dashboard', '/reports', '/manage', '/users'], CIVILIAN: ['/citizen'], COMPANY: ['/contractor'] };

export default function AppLayout({ children }) {
  const { user, ready, logout, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // client-side guard: must be signed in, and only inside your own area
  const allowed = user && (pathname === '/account' || AREA[user.userType]?.some((p) => pathname.startsWith(p)));
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login');
    else if (!allowed) router.replace(homeFor(user));
  }, [ready, user, allowed, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (!ready || !user || !allowed) return <Spinner center />;

  const nav = user.userType === 'CIVILIAN' ? CIVILIAN_NAV : user.userType === 'COMPANY' ? COMPANY_NAV : EMPLOYEE_NAV;
  const roleLabel = user.userType === 'EMPLOYEE' ? enumLabel(user.role) : enumLabel(user.userType);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link href={homeFor(user)} className="brand">
          <div className="brand-mark"><Icon name="lamp" size={18} style={{ color: '#12020a' }} /></div>
          <div><div className="brand-name" style={{ color: 'var(--text)' }}>Lumina</div><div className="brand-sub">Streetlight Management</div></div>
        </Link>
        {nav.map((g) => (
          <div className="nav-group" key={g.label}>
            <div className="nav-label">{g.label}</div>
            {g.items.filter((i) => !i.adminOnly || isAdmin).map((i) => (
              <Link key={i.href} href={i.href} className={`nav-link ${pathname === i.href || pathname.startsWith(`${i.href}/`) ? 'active' : ''}`}>
                <Icon name={i.icon} />{i.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{initials(user.displayName)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{roleLabel}</div>
            </div>
            <button className="btn btn-ghost btn-icon" title="Sign out" aria-label="Sign out"
              onClick={() => { logout(); resetMetaCache(); router.replace('/login'); }}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="mobile-bar">
          <button className="btn btn-icon" onClick={() => setOpen((o) => !o)} aria-label="Menu"><Icon name="menu" /></button>
          <strong>Lumina</strong>
        </div>
        {children}
      </main>
    </div>
  );
}
