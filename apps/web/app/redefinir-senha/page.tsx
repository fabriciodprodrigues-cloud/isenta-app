'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function Formulario() {
  const parametros = useSearchParams();
  const router = useRouter();
  const token = parametros.get('token') ?? '';

  const [verificando, setVerificando] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [motivo, setMotivo] = useState('');

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);

  // Confere o link antes de mostrar o formulario: pedir a senha nova para
  // depois dizer que o link expirou seria trabalho jogado fora.
  useEffect(() => {
    async function conferir() {
      try {
        const resposta = await fetch(
          `/api/auth/redefinir-senha?token=${encodeURIComponent(token)}`
        );
        const corpo = await resposta.json().catch(() => null);

        if (resposta.ok && corpo?.valido) {
          setTokenValido(true);
        } else {
          setMotivo(corpo?.motivo ?? 'Link inválido.');
        }
      } catch {
        setMotivo('Não foi possível validar o link.');
      } finally {
        setVerificando(false);
      }
    }

    conferir();
  }, [token]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (senha !== confirmacao) {
      setErro('As senhas não conferem.');
      return;
    }

    setSalvando(true);

    try {
      const resposta = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível redefinir a senha.');
        return;
      }

      setPronto(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (verificando) {
    return <p className="text-center text-sm text-paper-dim">Validando link...</p>;
  }

  if (pronto) {
    return (
      <div className="rounded-lg border border-green/40 bg-green/10 p-4 text-sm text-paper">
        Senha redefinida. Levando você para o login...
      </div>
    );
  }

  if (!tokenValido) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {motivo}
        </div>
        <Link
          href="/recuperar-senha"
          className="block rounded-lg bg-green px-4 py-3 text-center font-medium text-ink-900 hover:bg-green/90"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-paper">Nova senha</label>
        <input
          type="password"
          required
          minLength={12}
          value={senha}
          onChange={e => setSenha(e.target.value)}
          className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
        />
        <p className="mt-1 text-xs text-slate">Mínimo de 12 caracteres.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-paper">Repita a senha</label>
        <input
          type="password"
          required
          minLength={12}
          value={confirmacao}
          onChange={e => setConfirmacao(e.target.value)}
          className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
        />
      </div>

      <button
        type="submit"
        disabled={salvando}
        className="w-full rounded-lg bg-green px-4 py-3 font-medium text-ink-900 transition-all hover:bg-green/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Redefinir senha'}
      </button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-paper">
            isenta<span className="text-green">.</span>
          </h1>
          {/* Neutro: a mesma tela atende a redefinição e o primeiro acesso de
              um operador convidado, para quem não existe senha "nova". */}
          <p className="mt-1 text-sm text-paper-dim">Definir senha</p>
        </div>

        {/* useSearchParams exige Suspense em componente de cliente no App Router. */}
        <Suspense
          fallback={<p className="text-center text-sm text-paper-dim">Carregando...</p>}
        >
          <Formulario />
        </Suspense>
      </div>
    </div>
  );
}
