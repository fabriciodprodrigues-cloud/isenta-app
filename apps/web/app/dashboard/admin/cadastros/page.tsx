'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';

export default function CentralCadastros() {
  // Mock data
  const statusGroups = {
    rascunho: [
      {
        id: '1',
        veiculo: 'OTR-1003',
        orgao: 'Prefeitura SP',
        concessionaria: 'Motiva Paraná',
        canal: 'RPA',
        data: '2026-08-01',
      },
    ],
    enviado: [
      {
        id: '2',
        veiculo: 'SAO1000',
        orgao: 'Prefeitura SP',
        concessionaria: 'Eco050',
        canal: 'Email',
        data: '2026-07-30',
      },
    ],
    aguardando: [
      {
        id: '3',
        veiculo: 'AMB1001',
        orgao: 'Prefeitura SP',
        concessionaria: 'CSG',
        canal: 'Email',
        data: '2026-07-26',
      },
    ],
    aprovado: [
      {
        id: '4',
        veiculo: 'CBM1002',
        orgao: 'Prefeitura SP',
        concessionaria: 'Eco050',
        canal: 'Email',
        data: '2026-06-15',
        protocolo: 'ECO050-2024-001',
      },
    ],
    recusado: [],
  };

  const fallbackManual = [
    {
      id: '1',
      veiculo: 'OTR-1003',
      concessionaria: 'Motiva Paraná',
      motivo: 'RPA falhou 2x - Motiva detectou padrão de robô',
      tentativas: 2,
      ultimaTentativa: '2026-08-02 14:32',
    },
  ];

  const statusColors = {
    rascunho: 'bg-gray-900/20 text-gray-400',
    enviado: 'bg-blue-900/20 text-blue-400',
    aguardando: 'bg-amber-900/20 text-amber-400',
    aprovado: 'bg-green-900/20 text-green-400',
    recusado: 'bg-red-900/20 text-red-400',
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      rascunho: '📝 Rascunho',
      enviado: '📤 Enviado',
      aguardando: '⏳ Aguardando',
      aprovado: '✅ Aprovado',
      recusado: '❌ Recusado',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">Central de Cadastros</h1>
        <p className="text-paper-dim text-sm mt-1">
          Monitorar, gerenciar e auditar o fluxo de cadastros de isenção
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(statusGroups).map(([status, registros]) => (
          <Card
            key={status}
            className={`${
              statusColors[status as keyof typeof statusColors]
            } border`}
          >
            <CardBody className="text-center py-6">
              <div className="text-3xl font-bold mb-2">
                {registros.length}
              </div>
              <p className="text-sm">
                {getStatusLabel(status)}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Kanban View */}
      <div>
        <h2 className="text-sm font-semibold text-paper-dim uppercase tracking-wider mb-4">
          📋 Fluxo de Cadastros
        </h2>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(statusGroups).map(([status, registros]) => (
            <Card key={status} className="min-h-96">
              <CardHeader>
                <h3 className="font-semibold text-sm">
                  {getStatusLabel(status)} ({registros.length})
                </h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {registros.length === 0 ? (
                  <p className="text-paper-dim text-xs text-center py-8">
                    Vazio
                  </p>
                ) : (
                  registros.map((reg: any) => (
                    <div
                      key={reg.id}
                      className="p-3 bg-ink-700 rounded border border-border hover:border-accent/50 transition-colors cursor-pointer"
                    >
                      <p className="font-mono font-bold text-sm">
                        {reg.veiculo}
                      </p>
                      <p className="text-xs text-paper-dim mt-1">
                        {reg.concessionaria}
                      </p>
                      <p className="text-xs text-paper-dim">
                        {reg.canal}
                      </p>
                      {reg.protocolo && (
                        <p className="text-xs text-green-400 mt-2 font-mono">
                          {reg.protocolo}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Fila de Fallback Manual */}
      {fallbackManual.length > 0 && (
        <Card className="border-2 border-amber-800">
          <CardHeader>
            <h2 className="font-semibold text-amber-400">
              ⚠️ Fila de Fallback Manual ({fallbackManual.length})
            </h2>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Veículo</TableCell>
                    <TableCell>Concessionária</TableCell>
                    <TableCell>Motivo</TableCell>
                    <TableCell>Tentativas</TableCell>
                    <TableCell>Última Tentativa</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fallbackManual.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-bold">
                        {item.veiculo}
                      </TableCell>
                      <TableCell>{item.concessionaria}</TableCell>
                      <TableCell className="text-sm max-w-xs">
                        {item.motivo}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.tentativas}
                      </TableCell>
                      <TableCell className="text-sm text-paper-dim">
                        {item.ultimaTentativa}
                      </TableCell>
                      <TableCell>
                        <Button size="sm">Resolver</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Recusados */}
      {statusGroups.recusado.length > 0 && (
        <Card className="border-2 border-red-800">
          <CardHeader>
            <h2 className="font-semibold text-red-400">
              ❌ Cadastros Recusados ({statusGroups.recusado.length})
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-paper-dim text-center py-8">
              Nenhum cadastro recusado no momento
            </p>
          </CardBody>
        </Card>
      )}

      {/* Auditoria */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">📜 Log de Auditoria</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <div className="p-3 bg-ink-700 rounded text-sm border-l-2 border-green-400">
              <p className="text-paper">
                <span className="font-mono">SAO1000</span> → Eco050:
                <span className="text-green-400 ml-2">Aprovado</span>
              </p>
              <p className="text-xs text-paper-dim mt-1">
                2026-07-30 16:42 • Email • Protocolo: ECO050-2024-001
              </p>
            </div>
            <div className="p-3 bg-ink-700 rounded text-sm border-l-2 border-amber-400">
              <p className="text-paper">
                <span className="font-mono">AMB1001</span> → CSG:
                <span className="text-amber-400 ml-2">Aguardando</span>
              </p>
              <p className="text-xs text-paper-dim mt-1">
                2026-07-26 10:15 • Email • Enviado com sucesso
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Visão Geral</Button>
        </Link>
        <Link href="/dashboard/admin/fila">
          <Button variant="secondary">→ Fila de Processamento</Button>
        </Link>
      </div>
    </div>
  );
}
