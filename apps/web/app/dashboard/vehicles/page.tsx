import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { format_plate, format_date, days_until_expiry, get_vehicle_status } from '@/lib/utils';

export default async function VehiclesPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const query: any = {};

  if (session.user?.role === 'operator') {
    query.accountId = session.user?.accountId;
  }

  const vehicles = await prisma.vehicle.findMany({
    where: query,
    include: {
      account: true,
      registrations: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-paper">
            Veículos
          </h1>
          <p className="mt-1 text-paper-dim">
            Gerencie a frota de veículos
          </p>
        </div>
        <Link href="/dashboard/vehicles/new">
          <Button>+ Novo Veículo</Button>
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-lg border border-white/8 bg-ink-800 p-12 text-center">
          <p className="text-paper-dim mb-4">Nenhum veículo cadastrado</p>
          <Link href="/dashboard/vehicles/new">
            <Button variant="secondary">Cadastrar primeiro veículo</Button>
          </Link>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header>Placa</TableCell>
              <TableCell header>Tipo</TableCell>
              <TableCell header>Status</TableCell>
              <TableCell header>Vencimento</TableCell>
              <TableCell header align="center">Órgão</TableCell>
              <TableCell header align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vehicles.map((vehicle: any) => {
              const status = get_vehicle_status(vehicle.expiresAt, vehicle.status);
              const daysLeft = days_until_expiry(vehicle.expiresAt);

              return (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-mono font-medium">
                    {format_plate(vehicle.plate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" size="sm">
                      {vehicle.type === 'proprio' ? 'Próprio' : 'Locado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        vehicle.status === 'aprovado' ? 'success' :
                        vehicle.status === 'aguardando' ? 'warning' :
                        vehicle.status === 'recusado' ? 'error' : 'default'
                      }
                      size="sm"
                    >
                      {vehicle.status === 'rascunho' && 'Rascunho'}
                      {vehicle.status === 'enviado' && 'Enviado'}
                      {vehicle.status === 'aguardando' && 'Aguardando'}
                      {vehicle.status === 'aprovado' && 'Aprovado'}
                      {vehicle.status === 'recusado' && 'Recusado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-paper">
                        {format_date(vehicle.expiresAt)}
                      </span>
                      {vehicle.expiresAt && (
                        <span className={`text-xs font-mono ${
                          daysLeft < 0 ? 'text-red-400' :
                          daysLeft <= 30 ? 'text-amber' :
                          'text-green'
                        }`}>
                          {daysLeft < 0
                            ? `${Math.abs(daysLeft)} dias vencido`
                            : `${daysLeft} dias`
                          }
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell align="center" className="text-sm">
                    {vehicle.account?.name}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/dashboard/vehicles/${vehicle.id}`}>
                        <button className="px-3 py-1 text-sm text-green hover:bg-green-dim/20 rounded transition-colors">
                          Ver
                        </button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
