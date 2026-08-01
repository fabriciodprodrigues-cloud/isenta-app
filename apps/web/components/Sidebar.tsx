'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (path: string) => pathname.startsWith(path);

  if (session?.user?.role === 'operator') {
    return (
      <aside className="w-64 border-r border-white/8 bg-ink-800 py-8">
        <nav className="space-y-1 px-4">
          <Link href="/dashboard">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard') && !isActive('/dashboard/accounts') && !isActive('/dashboard/vehicles')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              Dashboard
            </div>
          </Link>

          <Link href="/dashboard/vehicles">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard/vehicles')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              Meus Veículos
            </div>
          </Link>

          <Link href="/dashboard/alerts">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard/alerts')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              Alertas
            </div>
          </Link>
        </nav>
      </aside>
    );
  }

  // Admin sidebar
  return (
    <aside className="w-64 border-r border-white/8 bg-ink-800 py-8">
      <nav className="space-y-1 px-4">
        <Link href="/dashboard">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              pathname === '/dashboard'
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Dashboard
          </div>
        </Link>

        <div className="mt-6 mb-4">
          <p className="px-4 text-xs font-medium uppercase tracking-wide text-slate">
            Gerenciamento
          </p>
        </div>

        <Link href="/dashboard/accounts">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/accounts')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Órgãos Públicos
          </div>
        </Link>

        <Link href="/dashboard/vehicles">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/vehicles')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Frota
          </div>
        </Link>

        <Link href="/dashboard/alerts">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/alerts')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Alertas
          </div>
        </Link>
      </nav>
    </aside>
  );
}
