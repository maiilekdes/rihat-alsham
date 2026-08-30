'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/orders', label: 'Live Orders' },
  { href: '/menu', label: 'Menu' },
  { href: '/analytics', label: 'Analytics' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { staffUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !staffUser) router.replace('/login');
  }, [loading, staffUser, router]);

  if (loading || !staffUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, borderRight: '1px solid var(--border)', padding: 20, background: 'white' }}>
        <h2 style={{ fontSize: 18, margin: '0 0 24px' }}>ريحة الشام</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                background: pathname?.startsWith(item.href) ? 'var(--bg)' : 'transparent',
                color: pathname?.startsWith(item.href) ? 'var(--brand-red)' : 'var(--ink)',
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{ marginTop: 40, fontSize: 13, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 8 }}>{staffUser.email}</p>
          <button className="btn btn-outline" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 28 }}>{children}</main>
    </div>
  );
}
