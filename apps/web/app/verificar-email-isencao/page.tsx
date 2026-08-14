'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function Confirmacao() {
  const parametros = useSearchParams();
  const token = parametros.get('token') ?? '';
  const accountId = parametros.get('orgao') ?? '';

  const [estado, setEstado] = useState<'verificando' | 'ok' | 'erro'>('verificando');
  const [mensagem, setMensagem] = useState('');
  const [orgao, setOrgao] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    async function confirmar() {
      try {
        const resposta = await fetch('/api/identidade/confirmar-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, accountId }),
        });

        const corpo = await resposta.json().catch(() => null);

        if (resposta.ok && corpo?.success) {
          setOrgao(corpo.orgao ?? '');
          setEmail(corpo.email ?? '');
          setEstado('ok');
        } else {
          setMensagem(corpo?.error ?? 'Não foi possível confirmar.');
          setEstado('erro');
        }
      } catch {
        setMensagem('Falha de conexão.');
        setEstado('erro');
      }
    }

    confirmar();
  }, [token, accountId]);

  if (estado === 'verificando') {
    return <p className="text-center text-sm text-paper-dim">Confirmando...</p>;
  }

  if (estado === 'erro') {
    return (
      <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
        {mensagem}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green/40 bg-green/10 p-5 text-sm text-paper">
      <p className="mb-2 font-medium">Caixa confirmada.</p>
      <p className="text-paper-dim">
        O endereço <strong className="text-paper">{email}</strong> está registrado como
        canal oficial de isenção de pedágio de <strong className="text-paper">{orgao}</strong>.
      </p>
      <p className="mt-3 text-paper-dim">
        Você pode fechar esta página.
      </p>
    </div>
  );
}

export default function VerificarEmailIsencaoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-paper">
            isenta<span className="text-green">.</span>
          </h1>
          <p className="mt-1 text-sm text-paper-dim">Confirmação da caixa de isenção</p>
        </div>

        {/* useSearchParams exige Suspense em componente de cliente no App Router. */}
        <Suspense
          fallback={<p className="text-center text-sm text-paper-dim">Carregando...</p>}
        >
          <Confirmacao />
        </Suspense>
      </div>
    </div>
  );
}
