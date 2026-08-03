'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface FailedJob {
  id: string;
  registrationId: string;
  attempts: number;
  maxAttempts: number;
  error: string;
  failedAt: string;
}

export default function QueueMonitorPage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrySending, setRetrySending] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/queue/stats');
      const data = await response.json();
      setStats(data.queue.stats);
      setFailedJobs(data.queue.failedJobs);
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      setRetrySending(jobId);
      await fetch('/api/queue/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      loadStats();
    } catch (error) {
      console.error('Erro ao fazer retry:', error);
    } finally {
      setRetrySending(null);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-paper">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">Fila de Processamento</h1>
        <p className="text-paper-dim text-sm mt-1">
          Monitorar e gerenciar o processamento de solicitações de isenção
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-yellow-400 mb-2">
              {stats?.waiting || 0}
            </div>
            <p className="text-paper-dim text-sm">Aguardando</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-blue-400 mb-2">
              {stats?.active || 0}
            </div>
            <p className="text-paper-dim text-sm">Processando</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-green-400 mb-2">
              {stats?.completed || 0}
            </div>
            <p className="text-paper-dim text-sm">Completos</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-red-400 mb-2">
              {stats?.failed || 0}
            </div>
            <p className="text-paper-dim text-sm">Falhados</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-4xl font-bold text-purple-400 mb-2">
              {stats?.delayed || 0}
            </div>
            <p className="text-paper-dim text-sm">Agendados</p>
          </CardBody>
        </Card>
      </div>

      {/* Failed Jobs */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">Jobs Falhados</h2>
        </CardHeader>
        <CardBody>
          {failedJobs.length === 0 ? (
            <p className="text-paper-dim text-center py-4">
              Nenhum job falhado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID do Job</TableCell>
                    <TableCell>Solicitação</TableCell>
                    <TableCell>Tentativas</TableCell>
                    <TableCell>Erro</TableCell>
                    <TableCell>Falhou em</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {failedJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-sm">
                        {job.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {job.registrationId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {job.attempts}/{job.maxAttempts}
                      </TableCell>
                      <TableCell className="text-xs text-red-300 max-w-xs truncate">
                        {job.error}
                      </TableCell>
                      <TableCell className="text-xs text-paper-dim">
                        {new Date(job.failedAt).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {job.attempts < job.maxAttempts && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRetry(job.id)}
                            disabled={retrySending === job.id}
                          >
                            {retrySending === job.id ? 'Enviando...' : 'Retry'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/dashboard/admin/rpa">
          <Button>📸 Ver Execuções RPA</Button>
        </Link>
        <Link href="/dashboard/cliente">
          <Button variant="secondary">← Voltar ao Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
