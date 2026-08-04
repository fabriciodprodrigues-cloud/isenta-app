import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  format_plate,
  format_date,
  days_until_expiry,
  get_status_label,
  get_category_label,
} from '@/lib/utils';

export default async function VehicleDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: {
      account: true,
      registrations: true,
      alerts: true,
    },
  });

  if (!vehicle) {
    redirect('/dashboard/vehicles');
  }

  const daysLeft = days_until_expiry(vehicle.expiresAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-paper">
            {format_plate(vehicle.plate)}
          </h1>
          <p className="mt-1 text-paper-dim">
            {vehicle.account?.name}
          </p>
        </div>
        <Link href="/dashboard/vehicles">
          <Button variant="secondary">Voltar</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informações do Veículo */}
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-paper">
              Informações do Veículo
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="text-sm text-slate">Placa</p>
              <p className="font-mono font-bold text-paper">
                {format_plate(vehicle.plate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate">RENAVAM</p>
              <p className="font-mono font-bold text-paper">
                {vehicle.renavam}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate">Tipo</p>
                <Badge size="sm" variant="default">
                  {vehicle.type === 'proprio' ? 'Próprio' : 'Locado'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate">Categoria</p>
                <Badge size="sm" variant="default">
                  {get_category_label(vehicle.category)}
                </Badge>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Status de Cadastro */}
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-paper">
              Status de Cadastro
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="text-sm text-slate">Status Atual</p>
              <Badge
                variant={
                  vehicle.status === 'aprovado' ? 'success' :
                  vehicle.status === 'aguardando' ? 'warning' :
                  vehicle.status === 'recusado' ? 'error' : 'default'
                }
              >
                {get_status_label(vehicle.status)}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-slate">Vencimento</p>
              <p className="text-paper">
                {format_date(vehicle.expiresAt)}
              </p>
              <p className={`text-sm font-mono mt-1 ${
                daysLeft < 0 ? 'text-red-400' :
                daysLeft <= 30 ? 'text-amber' :
                'text-green'
              }`}>
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)} dias vencido`
                  : `${daysLeft} dias`
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-slate">TAG Sem Parar</p>
              <p className="font-mono text-paper">
                {vehicle.tagSerialNumber || 'Não vinculada'}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-lg font-bold text-paper">
            Documentos
          </h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-ink-700/50">
              <div>
                <p className="text-paper font-medium">CRLV</p>
                <p className="text-sm text-slate">
                  {vehicle.crlvUrl ? 'Enviado' : 'Pendente'}
                </p>
              </div>
              <Badge variant={vehicle.crlvUrl ? 'success' : 'default'} size="sm">
                {vehicle.crlvUrl ? '✓' : 'Necessário'}
              </Badge>
            </div>

            {vehicle.type === 'locado' && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-ink-700/50">
                <div>
                  <p className="text-paper font-medium">Contrato de Locação</p>
                  <p className="text-sm text-slate">
                    {vehicle.contractUrl ? 'Enviado' : 'Pendente'}
                  </p>
                </div>
                <Badge variant={vehicle.contractUrl ? 'success' : 'default'} size="sm">
                  {vehicle.contractUrl ? '✓' : 'Necessário'}
                </Badge>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Registros em Concessionárias */}
      {vehicle.registrations.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-paper">
              Cadastros em Concessionárias
            </h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {vehicle.registrations.map((reg: any) => (
                <div key={reg.id} className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-ink-700/50">
                  <div>
                    <p className="text-paper font-medium">{reg.concessionnaire}</p>
                    <p className="text-sm text-slate">
                      {reg.protocol && `Protocolo: ${reg.protocol}`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      reg.status === 'aprovado' ? 'success' :
                      reg.status === 'aguardando_resposta' ? 'warning' :
                      reg.status === 'recusado' ? 'error' : 'default'
                    }
                    size="sm"
                  >
                    {get_status_label(reg.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
