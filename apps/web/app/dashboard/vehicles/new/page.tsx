'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { useSession } from 'next-auth/react';
import { VehicleForm } from '@/components/forms/VehicleForm';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function NewVehiclePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      if (!session) return;

      try {
        const response = await fetch('/api/accounts');
        if (response.ok) {
          const data = await response.json();
          setAccounts(data);

          if (session.user?.role === 'operator' && session.user?.accountId) {
            setSelectedAccountId(session.user.accountId);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar contas:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAccounts();
  }, [session]);

  if (loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  if (session?.user?.role === 'operator') {
    // Operador vê apenas seu próprio órgão
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-paper">
            Novo Veículo
          </h1>
          <p className="mt-1 text-paper-dim">
            Cadastre um novo veículo na sua frota
          </p>
        </div>
        {selectedAccountId && (
          <VehicleForm accountId={selectedAccountId} />
        )}
      </div>
    );
  }

  // Admin seleciona conta
  if (!selectedAccountId) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-paper">
            Novo Veículo
          </h1>
          <p className="mt-1 text-paper-dim">
            Selecione o órgão público
          </p>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-white/8 bg-ink-800 p-6 text-center">
            <p className="text-paper-dim mb-4">Nenhuma conta cadastrada</p>
            <a href="/dashboard/accounts/new">
              <Button>Criar primeira conta</Button>
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
                className="w-full p-4 rounded-lg border border-white/8 bg-ink-800 hover:bg-ink-700 hover:border-green/50 transition-all text-left"
              >
                <p className="font-medium text-paper">{account.name}</p>
                <p className="text-sm text-slate">{account.cnpj}</p>
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
        <h1 className="font-display text-3xl font-bold text-paper">
          Novo Veículo
        </h1>
        <p className="mt-1 text-paper-dim">
          Cadastre um novo veículo
        </p>
      </div>
      <VehicleForm accountId={selectedAccountId} />
    </div>
  );
}
