'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { VehicleForm } from '@/components/forms/VehicleForm';
import { Button } from '@/components/ui/Button';

interface Conta {
  id: string;
  name: string;
  cnpj: string;
}

export default function NewVehiclePage() {
  const { data: session, status } = useSession();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);

  const papel = (session?.user as any)?.role;
  const contaDoOperador = (session?.user as any)?.accountId as string | undefined;

  useEffect(() => {
    if (status === 'loading') return;

    // O operador já traz o próprio accountId na sessão e não tem permissão de
    // listar contas — /api/accounts responde 401 para ele. A versão anterior
    // dependia dessa chamada para preencher o accountId, então o formulário
    // simplesmente não renderizava: a tela abria com título e nada abaixo.
    if (papel !== 'admin') {
      setLoading(false);
      return;
    }

    async function carregarContas() {
      try {
        const resposta = await fetch('/api/accounts');
        if (resposta.ok) setAccounts(await resposta.json());
      } catch (erro) {
        console.error('Erro ao carregar órgãos:', erro);
      } finally {
        setLoading(false);
      }
    }

    carregarContas();
  }, [status, papel]);

  if (status === 'loading' || loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  if (papel !== 'admin') {
    if (!contaDoOperador) {
      return (
        <div className="max-w-2xl rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-paper">
          Seu usuário não está vinculado a nenhum órgão. Peça ao administrador
          para corrigir o vínculo antes de cadastrar veículos.
        </div>
      );
    }

    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-paper">Novo Veículo</h1>
          <p className="mt-1 text-paper-dim">Cadastre um novo veículo na sua frota</p>
        </div>
        <VehicleForm accountId={contaDoOperador} />
      </div>
    );
  }

  if (!selectedAccountId) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-paper">Novo Veículo</h1>
          <p className="mt-1 text-paper-dim">Selecione o órgão público</p>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-white/8 bg-ink-800 p-6 text-center">
            <p className="mb-4 text-paper-dim">Nenhum órgão cadastrado</p>
            {/* Antes apontava para /dashboard/accounts/new, rota inexistente. */}
            <Link href="/dashboard/admin/orgaos/novo">
              <Button>Cadastrar primeiro órgão</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map(conta => (
              <button
                key={conta.id}
                onClick={() => setSelectedAccountId(conta.id)}
                className="w-full rounded-lg border border-white/8 bg-ink-800 p-4 text-left transition-all hover:border-green/50 hover:bg-ink-700"
              >
                <p className="font-medium text-paper">{conta.name}</p>
                <p className="text-sm text-slate">{conta.cnpj}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-paper">Novo Veículo</h1>
        <p className="mt-1 text-paper-dim">
          {accounts.find(c => c.id === selectedAccountId)?.name ?? 'Cadastre um novo veículo'}
        </p>
      </div>
      <VehicleForm accountId={selectedAccountId} />
    </div>
  );
}
