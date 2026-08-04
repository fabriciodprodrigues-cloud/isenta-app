'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

interface Tag {
  id: string;
  serialNumber: string;
  status: string;
  vehicleId: string | null;
  vehicle?: { plate: string } | null;
  expiresAt: string | null;
}

interface Vehicle {
  id: string;
  plate: string;
  accountId: string;
}

export default function GestaoTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    serialNumber: '',
    vehicleId: '',
    expiresAt: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [tagsRes, vehiclesRes] = await Promise.all([
        fetch('/api/tags'),
        fetch('/api/vehicles'),
      ]);

      if (tagsRes.ok) {
        setTags(await tagsRes.json());
      }

      if (vehiclesRes.ok) {
        setVehicles(await vehiclesRes.json());
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          vehicleId: formData.vehicleId || null,
        }),
      });

      if (response.ok) {
        await loadData();
        setFormData({ serialNumber: '', vehicleId: '', expiresAt: '' });
        setShowForm(false);
      } else {
        alert('Erro ao criar TAG');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao criar TAG');
    }
  }

  async function handleVincular(tagId: string, vehicleId: string) {
    try {
      const response = await fetch('/api/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId, vehicleId: vehicleId || null }),
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Erro ao vincular TAG');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao vincular TAG');
    }
  }

  const availableTags = tags.filter(t => t.status === 'available');
  const assignedTags = tags.filter(t => t.status === 'assigned');

  if (loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-paper">Gestão de TAGs</h1>
          <p className="text-paper-dim text-sm mt-1">
            Cadastrar, gerenciar e vincular TAGs aos veículos
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancelar' : '+ Nova TAG'}
        </Button>
      </div>

      {/* Formulário de Nova TAG */}
      {showForm && (
        <Card>
          <CardHeader>Cadastrar Nova TAG</CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-paper mb-1">Serial Number</label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="ex: TAG-2024-001"
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-paper mb-1">Veículo (opcional)</label>
                <select
                  value={formData.vehicleId}
                  onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                >
                  <option value="">Sem veículo (adicionar depois)</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-paper mb-1">Validade (opcional)</label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Criar TAG</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-green-400 mb-2">
              {availableTags.length}
            </div>
            <p className="text-paper-dim text-sm">Disponíveis</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-blue-400 mb-2">
              {assignedTags.length}
            </div>
            <p className="text-paper-dim text-sm">Vinculadas</p>
          </CardBody>
        </Card>
      </div>

      {/* Tabela de TAGs */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {tags.length} TAG{tags.length !== 1 ? 's' : ''}
          </h2>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Serial</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Veículo</TableCell>
                  <TableCell>Validade</TableCell>
                  <TableCell>Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-mono font-semibold text-accent">
                      {tag.serialNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tag.status === 'available' ? 'success' : 'info'}>
                        {tag.status === 'available' ? '✓ Disponível' : '→ Vinculada'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tag.vehicle ? (
                        <span className="font-mono">{tag.vehicle.plate}</span>
                      ) : (
                        <span className="text-paper-dim">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {tag.expiresAt
                        ? new Date(tag.expiresAt).toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {!tag.vehicle ? (
                        <select
                          onChange={e => handleVincular(tag.id, e.target.value)}
                          className="text-xs px-2 py-1 bg-ink-700 border border-white/10 rounded text-paper"
                          defaultValue=""
                        >
                          <option value="">Vincular...</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.plate}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-paper-dim text-xs">Vinculada</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Voltar</Button>
        </Link>
      </div>
    </div>
  );
}
