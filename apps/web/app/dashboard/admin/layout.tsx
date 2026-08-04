'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

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
      {/* Coluna em flex para o rodape ficar preso embaixo sem sobrepor o menu:
          antes ele era position:absolute e cobria os ultimos itens. */}
      <aside style={{width: '16rem', background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column'}}>
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
        <nav style={{padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto'}}>
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
        <div style={{padding: '1rem', borderTop: '1px solid #334155'}}>
          {session?.user?.email && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#cbd5e1',
                marginBottom: '0.5rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={session.user.email}
            >
              {session.user.email}
            </p>
          )}

          <button
            type="button"
            onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#cbd5e1',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Sair
          </button>

          <p style={{fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem', textAlign: 'center'}}>
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
