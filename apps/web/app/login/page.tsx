'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BarrierLogo } from '@/components/BarrierLogo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-ink-900">
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="repeating-linear-gradient absolute inset-0 opacity-5"></div>
      </div>

      <div className="relative flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-12 text-center">
            <div className="flex justify-center mb-6">
              <BarrierLogo size="lg" animated />
            </div>
            <h1 className="font-display text-4xl font-bold text-paper mb-2">
              isenta<span className="text-green">.</span>
            </h1>
            <p className="text-paper-dim">
              Isenção de pedágio, sempre em dia
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-paper mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-white/10 bg-ink-800 px-4 py-3 text-paper placeholder-slate transition-colors hover:border-white/20 focus:border-green focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-paper mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-ink-800 px-4 py-3 text-paper placeholder-slate transition-colors hover:border-white/20 focus:border-green focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green px-4 py-3 font-medium text-ink-900 transition-all hover:bg-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 rounded-lg border border-amber-dim bg-amber-dim/10 p-4">
            <p className="text-xs font-medium text-amber mb-2">Demo (em desenvolvimento):</p>
            <p className="text-xs text-slate font-mono">
              Email: admin@isenta.local<br />
              Senha: admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
