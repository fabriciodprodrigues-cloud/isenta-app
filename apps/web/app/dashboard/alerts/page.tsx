import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { format_plate, format_date } from '@/lib/utils';

export default async function AlertsPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const query: any = {};

  if (session.user?.role === 'operator') {
    query.accountId = session.user?.accountId;
  }

  const alerts = await prisma.alert.findMany({
    where: query,
    include: {
      vehicle: {
        include: {
          account: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const groupedAlerts = alerts.reduce(
    (acc, alert) => {
      const key = alert.type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(alert);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-paper">
          Alertas
        </h1>
        <p className="mt-1 text-paper-dim">
          Monitoramento de vencimentos e renovações
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-amber">
              {groupedAlerts['expiring_soon']?.length || 0}
            </div>
            <div className="text-sm text-paper-dim mt-1">
              Vencendo em Breve
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-red-400">
              {groupedAlerts['expired']?.length || 0}
            </div>
            <div className="text-sm text-paper-dim mt-1">Vencidos</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-blue-400">
              {groupedAlerts['renewal_needed']?.length || 0}
            </div>
            <div className="text-sm text-paper-dim mt-1">
              Renovação Necessária
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabela de Alertas */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-2xl font-bold text-paper">
            Histórico de Alertas
          </h2>
        </CardHeader>

        <CardBody>
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-paper-dim">Nenhum alerta registrado</p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell header>Placa</TableCell>
                  <TableCell header>Órgão</TableCell>
                  <TableCell header>Tipo de Alerta</TableCell>
                  <TableCell header>Dias até Vencimento</TableCell>
                  <TableCell header>Enviado em</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-mono font-bold">
                      {format_plate(alert.vehicle.plate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {alert.vehicle.account?.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          alert.type === 'expiring_soon'
                            ? 'warning'
                            : alert.type === 'expired'
                              ? 'error'
                              : 'info'
                        }
                        size="sm"
                      >
                        {alert.type === 'expiring_soon'
                          ? 'Vencendo em Breve'
                          : alert.type === 'expired'
                          ? 'Vencido'
                          : 'Renovação Necessária'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {alert.daysUntilExpiry} dias
                    </TableCell>
                    <TableCell className="text-sm text-slate">
                      {alert.sentAt
                        ? format_date(new Date(alert.sentAt))
                        : 'Pendente'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
