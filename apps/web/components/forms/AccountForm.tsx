'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { format_cnpj } from '@/lib/utils';

interface AccountFormProps {
  account?: {
    id: string;
    name: string;
    cnpj: string;
    responsibleName: string;
    responsibleEmail: string;
    responsiblePhone: string;
    address: string;
    city: string;
    state: string;
    status: string;
  };
}

const STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

export function AccountForm({ account }: AccountFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: account?.name || '',
    cnpj: account?.cnpj || '',
    responsibleName: account?.responsibleName || '',
    responsibleEmail: account?.responsibleEmail || '',
    responsiblePhone: account?.responsiblePhone || '',
    address: account?.address || '',
    city: account?.city || '',
    state: account?.state || '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = account
        ? `/api/accounts/${account.id}`
        : '/api/accounts';
      const method = account ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      router.push('/dashboard/accounts');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-bold text-paper">
          {account ? 'Editar Conta' : 'Nova Conta'}
        </h2>
        <p className="mt-1 text-paper-dim text-sm">
          Cadastre os dados do órgão público
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardBody className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Input
              label="Nome do Órgão"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Prefeitura de..."
              required
            />

            <Input
              label="CNPJ"
              value={formData.cnpj}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cnpj: format_cnpj(e.target.value),
                })
              }
              placeholder="00.000.000/0000-00"
              required
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Input
              label="Nome do Responsável"
              value={formData.responsibleName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  responsibleName: e.target.value,
                })
              }
              placeholder="Fulano de Tal"
              required
            />

            <Input
              label="E-mail do Responsável"
              type="email"
              value={formData.responsibleEmail}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  responsibleEmail: e.target.value,
                })
              }
              placeholder="responsavel@prefeitura.gov.br"
              required
            />
          </div>

          <Input
            label="Telefone"
            value={formData.responsiblePhone}
            onChange={(e) =>
              setFormData({
                ...formData,
                responsiblePhone: e.target.value,
              })
            }
            placeholder="(99) 99999-9999"
            required
          />

          <Input
            label="Endereço"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            placeholder="Rua, número, complemento"
            required
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Input
              label="Cidade"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              placeholder="São Paulo"
              required
            />

            <Select
              label="Estado"
              value={formData.state}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
              options={STATES}
              required
            />
          </div>
        </CardBody>

        <CardFooter>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-4 py-2 text-paper hover:bg-ink-700 transition-colors"
          >
            Cancelar
          </button>
          <Button type="submit" loading={loading}>
            {account ? 'Atualizar' : 'Criar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
