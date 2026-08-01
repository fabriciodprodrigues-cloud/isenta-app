'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { BarrierLogo } from './BarrierLogo';

export function Header() {
  return (
    <header className="border-b border-white/6 bg-ink-800">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <BarrierLogo size="sm" />
          <span className="font-display text-xl font-bold text-paper">
            isenta<span className="text-green">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
            className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-600"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
