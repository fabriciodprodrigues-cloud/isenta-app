'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setEnviando(true);

    try {
      const resposta = await fetch('/api/auth/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível enviar o link.');
        return;
      }

      setMensagem(corpo?.message ?? 'Link enviado.');
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-paper">
            isenta<span className="text-green">.</span>
          </h1>
          <p className="mt-1 text-sm text-paper-dim">Recuperar acesso</p>
        </div>

        {mensagem ? (
          <div className="rounded-lg border border-green/40 bg-green/10 p-4 text-sm text-paper">
            {mensagem}
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <p className="text-sm text-paper-dim">
              Informe o e-mail da sua conta. Enviaremos um link para você
              escolher uma nova senha.
            </p>

            {erro && (
              <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                {erro}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm text-paper">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-green px-4 py-3 font-medium text-ink-900 transition-all hover:bg-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-slate hover:text-paper">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
