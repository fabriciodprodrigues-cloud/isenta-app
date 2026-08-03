'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    { href: '/dashboard/admin', label: 'Visão Geral', icon: '📊' },
    { href: '/dashboard/admin/orgaos', label: 'Órgãos', icon: '🏛️' },
    { href: '/dashboard/admin/frota', label: 'Frota', icon: '🚗' },
    { href: '/dashboard/admin/cadastros', label: 'Cadastros', icon: '📋' },
    { href: '/dashboard/admin/concessionarias', label: 'Concessionárias', icon: '🛣️' },
    { href: '/dashboard/admin/tags', label: 'TAGs', icon: '🏷️' },
    { href: '/dashboard/admin/relatorios', label: 'Relatórios', icon: '📈' },
    { href: '/dashboard/admin/cobranca', label: 'Cobrança', icon: '💳' },
    { href: '/dashboard/admin/configuracoes', label: 'Configurações', icon: '⚙️' },
    { href: '/dashboard/admin/fila', label: 'Fila', icon: '⏳' },
  ];

  return (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', background: '#0f172a'}}>
      {/* Sidebar */}
      <aside style={{width: '16rem', background: '#1e293b', borderRight: '1px solid #334155', overflowY: 'auto'}}>
        {/* Logo */}
        <div style={{padding: '1.5rem', borderBottom: '1px solid #334155'}}>
          <Link href="/dashboard/admin">
            <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981'}}>
              isenta
            </div>
            <p style={{fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem'}}>Admin Master</p>
          </Link>
        </div>

        {/* Menu */}
        <nav style={{padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    transition: 'colors 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    background: isActive ? '#10b981' : 'transparent',
                    color: isActive ? '#030712' : '#cbd5e1',
                    fontWeight: isActive ? '600' : 'normal',
                    fontSize: '0.875rem',
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'linear-gradient(to top, rgba(15, 23, 42, 0.8), transparent)', textAlign: 'center'}}>
          <p style={{fontSize: '0.75rem', color: '#94a3b8'}}>
            Isenta © 2026
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{flex: 1, overflowY: 'auto'}}>
        <div style={{padding: '2rem'}}>
          {children}
        </div>
      </main>
    </div>
  );
}
