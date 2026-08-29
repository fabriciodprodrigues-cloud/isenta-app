'use client';

import { FormEvent, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarrierLogo } from '@/components/BarrierLogo';

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manterConectado, setManterConectado] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (!result?.ok) {
      setError(result?.error || 'Falha ao fazer login');
      setLoading(false);
      return;
    }

    // Fetch user session to check role
    const response = await fetch('/api/auth/session');
    const userSession = await response.json();

    if (userSession?.user?.role === 'admin') {
      router.push('/dashboard/admin');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-ink-900">
      {/* PAINEL ESQUERDO — MARCA */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-800 to-ink-900 p-14 lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 60px, rgba(255,255,255,0.02) 60px 62px)',
          }}
        />

        <div className="relative z-10 flex items-center gap-2.5 font-display text-xl font-bold">
          <BarrierLogo size="sm" />
          isenta
        </div>

        <div className="relative z-10">
          <h1 className="mb-4 max-w-[400px] font-display text-[36px] font-bold leading-[1.15] tracking-[-0.03em]">
            O painel de controle da <span className="text-green">isenção nacional.</span>
          </h1>
          <p className="max-w-[400px] text-[15px] text-paper-dim">
            Cadastro de órgãos, geração de ofícios, envio às concessionárias e monitoramento de prazos —
            tudo em um só lugar.
          </p>
        </div>

        <svg
          className="pointer-events-none absolute -right-10 bottom-[60px] z-0 opacity-35"
          width="280"
          height="280"
          viewBox="0 0 84 84"
          fill="none"
        >
          <line x1="42" y1="70" x2="72" y2="70" stroke="#7C8FA6" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
          <g transform="rotate(-40 42 70)">
            <rect x="40" y="16" width="4" height="54" rx="2" fill="#EDF1F3" opacity="0.8" />
            <rect x="40" y="16" width="4" height="9" rx="2" fill="#FFB238" />
            <rect x="40" y="33" width="4" height="9" rx="2" fill="#FFB238" />
          </g>
          <circle cx="42" cy="70" r="4.5" fill="#21C58A" />
        </svg>

        <div className="relative z-10 font-mono text-[11px] italic text-slate">
          A cancela abre sozinha. A isenção fica em dia.
        </div>
      </div>

      {/* PAINEL DIREITO — FORM */}
      <div className="flex w-full items-center justify-center overflow-y-auto p-10 lg:w-[480px]">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center justify-center gap-2.5 font-display text-xl font-bold lg:hidden">
            <BarrierLogo size="sm" />
            isenta
          </div>

          <div className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-green">Acesso ao sistema</div>
          <h2 className="mb-2 font-display text-[26px] font-semibold">Entrar</h2>
          <p className="mb-8 text-sm text-paper-dim">Acesse com suas credenciais de operador ou administrador.</p>

          <form onSubmit={handleSubmit} className="space-y-[18px]">
            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-[7px] block text-[12.5px] font-medium text-slate">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu.nome@plataformaisenta.com"
                autoComplete="username"
                className="w-full rounded-[10px] border border-white/10 bg-ink-800 px-[15px] py-[13px] text-sm text-paper placeholder-slate transition-colors focus:border-green focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-[7px] block text-[12.5px] font-medium text-slate">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                className="w-full rounded-[10px] border border-white/10 bg-ink-800 px-[15px] py-[13px] text-sm text-paper placeholder-slate transition-colors focus:border-green focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <label className="flex cursor-pointer items-center gap-2 text-paper-dim">
                <input
                  type="checkbox"
                  checked={manterConectado}
                  onChange={e => setManterConectado(e.target.checked)}
                  className="h-[15px] w-[15px] accent-green"
                />
                Manter conectado
              </label>
              <Link href="/recuperar-senha" className="text-green hover:underline">
                Esqueci a senha
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[10px] bg-green px-4 py-[14px] text-[15px] font-semibold text-ink-900 transition-all hover:bg-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar no sistema'}
            </button>
          </form>

          <div className="my-[26px] flex items-center gap-3 text-xs text-slate">
            <span className="h-px flex-1 bg-white/[0.08]" />
            perfis de acesso
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-[10px] border border-white/[0.08] bg-ink-800 p-3 text-center text-xs text-paper-dim">
              <div className="mb-1 text-base">◑</div>
              Operador
            </div>
            <div className="flex-1 rounded-[10px] border border-white/[0.08] bg-ink-800 p-3 text-center text-xs text-paper-dim">
              <div className="mb-1 text-base">◆</div>
              Admin master
            </div>
          </div>

          <div className="mt-8 text-center text-sm">
            <Link href="/" className="text-slate hover:text-paper">
              ← Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
