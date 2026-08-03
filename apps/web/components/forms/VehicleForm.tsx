'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { format_plate } from '@/lib/utils';

interface VehicleFormProps {
  accountId: string;
  vehicle?: {
    id: string;
    plate: string;
    renavam: string;
    type: string;
    category: string;
    status: string;
    marca?: string;
    modelo?: string;
    cor?: string;
    anoFabricacao?: number;
    anoModelo?: number;
  };
}

export function VehicleForm({ accountId, vehicle }: VehicleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    plate: vehicle?.plate || '',
    renavam: vehicle?.renavam || '',
    type: vehicle?.type || 'proprio',
    category: vehicle?.category || 'oficial',
    marca: vehicle?.marca || '',
    modelo: vehicle?.modelo || '',
    cor: vehicle?.cor || '',
    anoFabricacao: vehicle?.anoFabricacao?.toString() || new Date().getFullYear().toString(),
    anoModelo: vehicle?.anoModelo?.toString() || new Date().getFullYear().toString(),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = vehicle
        ? `/api/vehicles/${vehicle.id}`
        : '/api/vehicles';
      const method = vehicle ? 'PUT' : 'POST';

      const payload = vehicle
        ? {
            ...formData,
            anoFabricacao: parseInt(formData.anoFabricacao),
            anoModelo: parseInt(formData.anoModelo),
          }
        : {
            ...formData,
            accountId,
            anoFabricacao: parseInt(formData.anoFabricacao),
            anoModelo: parseInt(formData.anoModelo),
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      const saved = await response.json();
      router.push(`/dashboard/vehicles/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - i);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-bold text-paper">
          {vehicle ? 'Editar Veículo' : 'Novo Veículo'}
        </h2>
        <p className="mt-1 text-paper-dim text-sm">
          Cadastre os dados completos do veículo
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardBody className="space-y-8">
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Identificação */}
          <div>
            <h3 className="text-sm font-semibold text-paper mb-4">Identificação</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <Input
                label="Placa"
                value={formData.plate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    plate: format_plate(e.target.value.toUpperCase()),
                  })
                }
                placeholder="ABC-1234"
                required
              />

              <Input
                label="RENAVAM"
                value={formData.renavam}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    renavam: e.target.value.replace(/\D/g, ''),
                  })
                }
                placeholder="00000000000"
                required
              />
            </div>
          </div>

          {/* Especificações */}
          <div>
            <h3 className="text-sm font-semibold text-paper mb-4">Especificações do Veículo</h3>
            <div className="grid gap-6 md:grid-cols-3">
              <Input
                label="Marca"
                value={formData.marca}
                onChange={(e) =>
                  setFormData({ ...formData, marca: e.target.value })
                }
                placeholder="Toyota, Volkswagen, etc"
                required
              />

              <Input
                label="Modelo"
                value={formData.modelo}
                onChange={(e) =>
                  setFormData({ ...formData, modelo: e.target.value })
                }
                placeholder="Corolla, Gol, etc"
                required
              />

              <Input
                label="Cor"
                value={formData.cor}
                onChange={(e) =>
                  setFormData({ ...formData, cor: e.target.value })
                }
                placeholder="Branco, Preto, etc"
                required
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <Select
                label="Ano de Fabricação"
                value={formData.anoFabricacao}
                onChange={(e) =>
                  setFormData({ ...formData, anoFabricacao: e.target.value })
                }
                options={years.map((year) => ({
                  value: year.toString(),
                  label: year.toString(),
                }))}
                required
              />

              <Select
                label="Ano Modelo"
                value={formData.anoModelo}
                onChange={(e) =>
                  setFormData({ ...formData, anoModelo: e.target.value })
                }
                options={years.map((year) => ({
                  value: year.toString(),
                  label: year.toString(),
                }))}
                required
              />
            </div>
          </div>

          {/* Classificação */}
          <div>
            <h3 className="text-sm font-semibold text-paper mb-4">Classificação</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <Select
                label="Tipo de Veículo"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                options={[
                  { value: 'proprio', label: 'Próprio (12 meses)' },
                  { value: 'locado', label: 'Locado (4 meses)' },
                ]}
                required
              />

              <Select
                label="Categoria"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                options={[
                  { value: 'oficial', label: 'Oficial' },
                  { value: 'ambulancia', label: 'Ambulância' },
                  { value: 'bombeiro', label: 'Bombeiro' },
                  { value: 'outro', label: 'Outro' },
                ]}
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/8 bg-ink-700/50 p-4">
            <p className="text-sm text-paper-dim">
              <span className="font-medium text-paper">Próximas etapas:</span>
              <br />
              Após criar o veículo, você poderá fazer upload de documentos
              (CRLV, contrato de locação) e enviar para as concessionárias.
            </p>
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
            {vehicle ? 'Atualizar' : 'Criar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
