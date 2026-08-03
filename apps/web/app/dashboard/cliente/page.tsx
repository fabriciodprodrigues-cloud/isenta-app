'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface DashboardStats {
  totalVehicles: number;
  approvedVehicles: number;
  draftVehicles: number;
  pendingDocuments: number;
  availableTags: number;
  expiringIn30Days: number;
}

export default function ClienteDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    approvedVehicles: 0,
    draftVehicles: 0,
    pendingDocuments: 0,
    availableTags: 0,
    expiringIn30Days: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!session?.user?.accountId) return;

      try {
        const response = await fetch(`/api/accounts/${session.user.accountId}/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [session]);

  if (loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">
          Dashboard - {session?.user?.name}
        </h1>
        <p className="text-paper-dim text-sm mt-1">
          Visão geral da sua frota e pendências
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-accent mb-2">
              {stats.totalVehicles}
            </div>
            <p className="text-paper-dim text-sm">Veículos Totais</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-green-400 mb-2">
              {stats.approvedVehicles}
            </div>
            <p className="text-paper-dim text-sm">Aprovados</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-yellow-400 mb-2">
              {stats.expiringIn30Days}
            </div>
            <p className="text-paper-dim text-sm">Vencendo em 30 dias</p>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">Documentos Pendentes</h3>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-bold text-paper mb-4">
              {stats.pendingDocuments}
            </div>
            <Link href="/dashboard/documentos">
              <Button className="w-full">Gerenciar Documentos</Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">TAGs Disponíveis</h3>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-bold text-paper mb-4">
              {stats.availableTags}
            </div>
            <Link href="/dashboard/tags">
              <Button className="w-full">Gerenciar TAGs</Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      {/* Navigation */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">🚗 Frota</h3>
          </CardHeader>
          <CardBody>
            <p className="text-paper-dim text-sm mb-4">
              Gerenciar veículos e status
            </p>
            <Link href="/dashboard/vehicles">
              <Button variant="secondary" className="w-full">
                Ver Frota
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">⚠️ Alertas</h3>
          </CardHeader>
          <CardBody>
            <p className="text-paper-dim text-sm mb-4">
              Acompanhar vencimentos e renovações
            </p>
            <Link href="/dashboard/alerts">
              <Button variant="secondary" className="w-full">
                Ver Alertas
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">📄 Documentos</h3>
          </CardHeader>
          <CardBody>
            <p className="text-paper-dim text-sm mb-4">
              Upload de CRLV e contratos
            </p>
            <Link href="/dashboard/documentos">
              <Button variant="secondary" className="w-full">
                Ir para Documentos
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-paper">🏛️ Concessionárias</h3>
          </CardHeader>
          <CardBody>
            <p className="text-paper-dim text-sm mb-4">
              Status de registrações
            </p>
            <Link href="/dashboard/concessionarias">
              <Button variant="secondary" className="w-full">
                Ver Concessionárias
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
