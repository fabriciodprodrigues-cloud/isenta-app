'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { format_plate, format_date, days_until_expiry } from '@/lib/utils';

interface Vehicle {
  id: string;
  plate: string;
  type: string;
  status: string;
  expiresAt: Date | null;
  accountId: string;
  account: { name: string };
}

interface Stats {
  total: number;
  aprovado: number;
  aguardando: number;
  vencendo: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    aprovado: 0,
    aguardando: 0,
    vencendo: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    async function loadVehicles() {
      try {
        const response = await fetch('/api/vehicles');
        if (response.ok) {
          const data = await response.json();
          setVehicles(data);

          // Calcular estatísticas
          const stats: Stats = {
            total: data.length,
            aprovado: data.filter((v: Vehicle) => v.status === 'aprovado')
              .length,
            aguardando: data.filter((v: Vehicle) => v.status === 'aguardando')
              .length,
            vencendo: data.filter(
              (v: Vehicle) =>
                v.expiresAt &&
                days_until_expiry(new Date(v.expiresAt)) <= 30 &&
                days_until_expiry(new Date(v.expiresAt)) >= 0,
            ).length,
          };
          setStats(stats);
        }
      } catch (error) {
        console.error('Erro ao carregar veículos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadVehicles();
  }, []);

  const toggleVehicle = (id: string) => {
    const newSelected = new Set(selectedVehicles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVehicles(newSelected);
  };

  const toggleAll = () => {
    if (selectedVehicles.size === vehicles.length) {
      setSelectedVehicles(new Set());
    } else {
      setSelectedVehicles(new Set(vehicles.map((v) => v.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-paper-dim">Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold text-paper">
          Dashboard
        </h1>
        <p className="mt-1 text-paper-dim">
          {session?.user?.role === 'admin'
            ? 'Visão geral do sistema'
            : 'Gerencie a isenção de pedágio de sua frota'}
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-paper">
              {stats.total}
            </div>
            <div className="text-sm text-paper-dim mt-1">
              Total de Veículos
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-green">
              {stats.aprovado}
            </div>
            <div className="text-sm text-paper-dim mt-1">Aprovados</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-amber">
              {stats.aguardando}
            </div>
            <div className="text-sm text-paper-dim mt-1">
              Aguardando Resposta
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-amber">
              {stats.vencendo}
            </div>
            <div className="text-sm text-paper-dim mt-1">
              Vencendo em 30 dias
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabela de Veículos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-paper">
              Veículos
            </h2>
            {selectedVehicles.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-paper-dim">
                  {selectedVehicles.size} selecionado(s)
                </span>
                <Button variant="secondary" size="sm">
                  Cadastrar Selecionados
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardBody>
          {vehicles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-paper-dim mb-4">Nenhum veículo cadastrado</p>
              <Link href="/dashboard/vehicles/new">
                <Button>Cadastrar Primeiro Veículo</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell header className="w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedVehicles.size === vehicles.length &&
                        vehicles.length > 0
                      }
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border border-white/20 bg-ink-700"
                    />
                  </TableCell>
                  <TableCell header>Placa</TableCell>
                  <TableCell header>Órgão</TableCell>
                  <TableCell header>Tipo</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>Vencimento</TableCell>
                  <TableCell header align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicles.map((vehicle) => {
                  const daysLeft = vehicle.expiresAt
                    ? days_until_expiry(new Date(vehicle.expiresAt))
                    : -1;

                  return (
                    <TableRow key={vehicle.id}>
                      <TableCell className="w-8">
                        <input
                          type="checkbox"
                          checked={selectedVehicles.has(vehicle.id)}
                          onChange={() => toggleVehicle(vehicle.id)}
                          className="w-4 h-4 rounded border border-white/20 bg-ink-700"
                        />
                      </TableCell>
                      <TableCell className="font-mono font-bold">
                        {format_plate(vehicle.plate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {vehicle.account.name}
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" variant="default">
                          {vehicle.type === 'proprio'
                            ? 'Próprio'
                            : 'Locado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          size="sm"
                          variant={
                            vehicle.status === 'aprovado'
                              ? 'success'
                              : vehicle.status === 'aguardando'
                                ? 'warning'
                                : vehicle.status === 'recusado'
                                  ? 'error'
                                  : 'default'
                          }
                        >
                          {vehicle.status === 'rascunho' && 'Rascunho'}
                          {vehicle.status === 'enviado' && 'Enviado'}
                          {vehicle.status === 'aguardando' && 'Aguardando'}
                          {vehicle.status === 'aprovado' && 'Aprovado'}
                          {vehicle.status === 'recusado' && 'Recusado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {vehicle.expiresAt && (
                          <div className="flex flex-col">
                            <span className="text-paper">
                              {format_date(new Date(vehicle.expiresAt))}
                            </span>
                            <span
                              className={`text-xs font-mono ${
                                daysLeft < 0
                                  ? 'text-red-400'
                                  : daysLeft <= 30
                                    ? 'text-amber'
                                    : 'text-green'
                              }`}
                            >
                              {daysLeft < 0
                                ? `${Math.abs(daysLeft)}d vencido`
                                : `${daysLeft}d`}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Link href={`/dashboard/vehicles/${vehicle.id}`}>
                          <button className="px-3 py-1 text-sm text-green hover:bg-green-dim/20 rounded transition-colors">
                            Ver
                          </button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Links Rápidos */}
      {session?.user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-paper">
              Gerenciamento
            </h2>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/dashboard/accounts">
                <button className="w-full p-3 rounded-lg border border-white/8 bg-ink-700 hover:bg-ink-600 transition-colors text-left">
                  <p className="font-medium text-paper">Órgãos Públicos</p>
                  <p className="text-sm text-slate">Gerenciar contas</p>
                </button>
              </Link>
              <Link href="/dashboard/vehicles">
                <button className="w-full p-3 rounded-lg border border-white/8 bg-ink-700 hover:bg-ink-600 transition-colors text-left">
                  <p className="font-medium text-paper">Frota</p>
                  <p className="text-sm text-slate">Gerenciar veículos</p>
                </button>
              </Link>
              <Link href="/dashboard/alerts">
                <button className="w-full p-3 rounded-lg border border-white/8 bg-ink-700 hover:bg-ink-600 transition-colors text-left">
                  <p className="font-medium text-paper">Alertas</p>
                  <p className="text-sm text-slate">Ver alertas de vencimento</p>
                </button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
