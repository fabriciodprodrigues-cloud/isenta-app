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
                isActive('/dashboard/alerts') && !isActive('/dashboard/alerts-config')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              Alertas
            </div>
          </Link>

          <div className="mt-6 mb-4">
            <p className="px-4 text-xs font-medium uppercase tracking-wide text-slate">
              Solicitações
            </p>
          </div>

          <Link href="/dashboard/documentos">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard/documentos')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              Documentos
            </div>
          </Link>

          <Link href="/dashboard/tags">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard/tags')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              TAGs
            </div>
          </Link>

          <Link href="/dashboard/concessionarias">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard/concessionarias')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              Concessionárias
            </div>
          </Link>

          <Link href="/dashboard/artesp">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard/artesp')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              ARTESP
            </div>
          </Link>

          <Link href="/dashboard/imunidade-nacional">
            <div
              className={`rounded-lg px-4 py-2 transition-colors ${
                isActive('/dashboard/imunidade-nacional')
                  ? 'bg-ink-700 text-green'
                  : 'text-slate hover:text-paper hover:bg-ink-700/50'
              }`}
            >
              Imunidade Nacional
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
              isActive('/dashboard/alerts') && !isActive('/dashboard/alerts-config')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Alertas
          </div>
        </Link>

        <Link href="/dashboard/alerts-config">
          <div
            className={`rounded-lg px-4 py-2 transition-colors text-sm ${
              isActive('/dashboard/alerts-config')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            └─ Configuração
          </div>
        </Link>

        <div className="mt-6 mb-4">
          <p className="px-4 text-xs font-medium uppercase tracking-wide text-slate">
            Solicitações
          </p>
        </div>

        {/*
          Estes itens apontam para as telas de admin, nao para as do operador.
          /dashboard/tags e /dashboard/concessionarias sao exclusivas do
          operador e redirecionam o admin de volta para /dashboard — apontar
          para elas aqui fazia o menu parecer que nao abria nada.
        */}
        <Link href="/dashboard/admin/tags">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/admin/tags')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            TAGs
          </div>
        </Link>

        <Link href="/dashboard/admin/concessionarias">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/admin/concessionarias')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Concessionárias
          </div>
        </Link>

        <Link href="/dashboard/admin/artesp">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/admin/artesp')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            ARTESP
          </div>
        </Link>

        <Link href="/dashboard/admin/cadastros">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/admin/cadastros')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Cadastros
          </div>
        </Link>

        <Link href="/dashboard/admin/orgaos">
          <div
            className={`rounded-lg px-4 py-2 transition-colors ${
              isActive('/dashboard/admin/orgaos')
                ? 'bg-ink-700 text-green'
                : 'text-slate hover:text-paper hover:bg-ink-700/50'
            }`}
          >
            Imunidade Nacional
          </div>
        </Link>
      </nav>
    </aside>
  );
}
