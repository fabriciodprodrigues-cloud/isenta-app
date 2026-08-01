'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useSession } from 'next-auth/react';

interface AlertStat {
  vehicleId: string;
  plate: string;
  email: string;
  subject: string;
}

export default function AlertsConfigPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [sentAlerts, setSentAlerts] = useState<AlertStat[]>([]);
  const [result, setResult] = useState('');

  async function handleSendAlerts() {
    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: session?.user?.role === 'operator'
            ? session?.user?.accountId
            : undefined,
        }),
      });

      if (!response.ok) throw new Error('Erro ao enviar alertas');

      const data = await response.json();
      setSentAlerts(data.details || []);
      setResult(data.message);
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : 'Erro ao enviar alertas',
      );
    } finally {
      setLoading(false);
    }
  }

  if (session?.user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-paper-dim">Apenas admins podem configurar alertas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-paper">
          Configuração de Alertas
        </h1>
        <p className="mt-1 text-paper-dim">
          Gerencie o envio automático de alertas de vencimento
        </p>
      </div>

      {/* Configurações */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-lg font-bold text-paper">
            Alertas Automáticos
          </h2>
          <p className="text-sm text-paper-dim mt-2">
            Envie alertas para veículos que vençam em 60, 30 ou 7 dias
          </p>
        </CardHeader>

        <CardBody className="space-y-6">
          <div className="rounded-lg bg-ink-700/50 border border-white/8 p-4">
            <p className="text-paper text-sm mb-3">
              <strong>Como funciona:</strong>
            </p>
            <ul className="text-paper-dim text-sm space-y-2">
              <li>✓ Sistema verifica vencimentos diários</li>
              <li>✓ Envia alertas em 60, 30 e 7 dias antes do vencimento</li>
              <li>✓ E-mails com instruções de renovação</li>
              <li>✓ Um alerta por período (não repete no mesmo dia)</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-paper">Status:</p>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-ink-700/30">
                <span className="text-paper">Próxima verificação</span>
                <Badge variant="default">Agora (manual)</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-ink-700/30">
                <span className="text-paper">Frequência automática</span>
                <Badge variant="default">Diária (00:00 UTC)</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-ink-700/30">
                <span className="text-paper">Provedor de e-mail</span>
                <Badge variant="info">Simulado (dev)</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-dim/50 bg-amber-dim/10 p-4">
            <p className="text-amber text-sm">
              <strong>Nota:</strong> Em desenvolvimento, os e-mails são
              simulados. Na produção, usar Resend ou SendGrid.
            </p>
          </div>
        </CardBody>

        <CardFooter>
          <Button
            onClick={handleSendAlerts}
            loading={loading}
            variant="primary"
          >
            {loading ? 'Processando...' : 'Enviar Alertas Agora'}
          </Button>
        </CardFooter>
      </Card>

      {/* Resultado */}
      {result && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-paper">
              Resultado
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div
              className={`rounded-lg p-4 ${
                sentAlerts.length > 0
                  ? 'bg-green-dim/20 border border-green/50'
                  : 'bg-slate/10 border border-white/8'
              }`}
            >
              <p
                className={`font-medium ${
                  sentAlerts.length > 0 ? 'text-green' : 'text-slate'
                }`}
              >
                {result}
              </p>
            </div>

            {sentAlerts.length > 0 && (
              <div>
                <p className="text-sm font-medium text-paper mb-3">
                  Alertas Enviados:
                </p>
                <div className="space-y-2">
                  {sentAlerts.map((alert) => (
                    <div
                      key={alert.vehicleId}
                      className="p-3 rounded-lg bg-ink-700/50 border border-white/8"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-green">
                            {alert.plate}
                          </p>
                          <p className="text-xs text-slate mt-1">
                            {alert.email}
                          </p>
                        </div>
                        <Badge variant="success" size="sm">
                          Enviado
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Info sobre job agendado */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-lg font-bold text-paper">
            Job Agendado
          </h2>
        </CardHeader>
        <CardBody className="space-y-4 text-sm text-paper-dim">
          <p>
            Em produção, um job agendado (cron) roda diariamente para:
          </p>
          <ul className="space-y-2 pl-4">
            <li>
              1. Verificar todos os veículos com status "aprovado"
            </li>
            <li>
              2. Calcular dias até vencimento
            </li>
            <li>
              3. Enviar e-mail se for 60, 30 ou 7 dias
            </li>
            <li>
              4. Registrar alerta no banco de dados
            </li>
          </ul>
          <p className="mt-4">
            <strong>Próxima implementação:</strong> Integração com Resend e
            BullMQ para fila de jobs (Fase 2).
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
