'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function AdminDashboard() {
  // Mock data - será substituído por dados reais
  const stats = {
    orgaosAtivos: 12,
    veiculosGerenciados: 347,
    cadastrosAtivos: 298,
    cadastrosVencendo: 24,
    cadastrosVencidos: 3,
    tagsEstoque: 145,
    tagsAtivadas: 89,
  };

  const alertas = [
    {
      tipo: 'recusado',
      mensagem: '5 cadastros recusados precisam de correção',
      cor: 'text-red-400',
      bg: 'bg-red-900/20',
    },
    {
      tipo: 'rpa',
      mensagem: 'RPA falhou em 2 execuções nas últimas 24h',
      cor: 'text-amber-400',
      bg: 'bg-amber-900/20',
    },
    {
      tipo: 'vencendo',
      mensagem: '24 cadastros vencendo em 7 dias',
      cor: 'text-amber-400',
      bg: 'bg-amber-900/20',
    },
  ];

  const acoesDoDia = [
    {
      id: 1,
      tipo: 'fallback',
      descricao: 'Veículo OTR-1003 (Prefeitura SP) - RPA falhou 2x, aguarda fallback manual',
      concessionaria: 'Motiva Paraná',
      acao: 'Resolver',
    },
    {
      id: 2,
      tipo: 'confirmacao',
      descricao: 'Protocolo ECO050-2024-001 recebido, aguarda validação',
      concessionaria: 'Ecovias Eco050',
      acao: 'Confirmar',
    },
    {
      id: 3,
      tipo: 'documento',
      descricao: 'CSG solicita contrato de locação para veículo AMB-1001',
      concessionaria: 'CSG (RS)',
      acao: 'Anexar Doc',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-paper">Visão Geral</h1>
        <p className="text-paper-dim mt-2">
          Dashboard central de operação — {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* Alertas Críticos */}
      {alertas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-paper-dim uppercase tracking-wider">
            ⚠️ Alertas Críticos
          </h2>
          <div className="grid gap-3">
            {alertas.map((alerta) => (
              <div
                key={alerta.tipo}
                className={`${alerta.bg} border border-${alerta.cor.split('-')[1]}-800 rounded-lg p-4 flex items-center justify-between`}
              >
                <p className={`${alerta.cor} text-sm font-medium`}>
                  {alerta.mensagem}
                </p>
                <Button size="sm" variant="secondary">
                  Ver Detalhes
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-paper-dim uppercase tracking-wider mb-4">
          📊 Indicadores-Chave
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardBody className="text-center py-6">
              <div className="text-3xl font-bold text-accent mb-2">
                {stats.orgaosAtivos}
              </div>
              <p className="text-paper-dim text-sm">Órgãos Ativos</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center py-6">
              <div className="text-3xl font-bold text-accent mb-2">
                {stats.veiculosGerenciados}
              </div>
              <p className="text-paper-dim text-sm">Veículos Gerenciados</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center py-6">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {stats.cadastrosAtivos}
              </div>
              <p className="text-paper-dim text-sm">Cadastros Ativos</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center py-6">
              <div className="text-3xl font-bold text-amber-400 mb-2">
                {stats.cadastrosVencendo}
              </div>
              <p className="text-paper-dim text-sm">Vencendo em 7 dias</p>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <Card>
            <CardBody className="text-center py-6">
              <div className="text-2xl font-bold text-red-400 mb-2">
                {stats.cadastrosVencidos}
              </div>
              <p className="text-paper-dim text-sm">Vencidos</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center py-6">
              <div className="text-2xl font-bold text-green-400 mb-2">
                {stats.tagsAtivadas}
              </div>
              <p className="text-paper-dim text-sm">TAGs Ativadas</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-center py-6">
              <div className="text-2xl font-bold text-amber-400 mb-2">
                {stats.tagsEstoque}
              </div>
              <p className="text-paper-dim text-sm">TAGs em Estoque</p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Fila de Ação do Dia */}
      <div>
        <h2 className="text-sm font-semibold text-paper-dim uppercase tracking-wider mb-4">
          📋 Fila de Ação do Dia
        </h2>
        <Card>
          <CardBody>
            {acoesDoDia.length === 0 ? (
              <p className="text-paper-dim text-center py-8">
                Nenhuma ação pendente — parabéns! 🎉
              </p>
            ) : (
              <div className="space-y-4">
                {acoesDoDia.map((acao) => (
                  <div
                    key={acao.id}
                    className="flex items-center justify-between p-4 bg-ink-700 rounded-lg border border-border hover:border-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-paper font-medium text-sm">
                        {acao.descricao}
                      </p>
                      <p className="text-paper-dim text-xs mt-1">
                        Concessionária: {acao.concessionaria}
                      </p>
                    </div>
                    <Button size="sm" className="ml-4">
                      {acao.acao}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4 pt-4">
        <Link href="/dashboard/admin/orgaos">
          <Button variant="secondary" className="w-full">
            → Gerenciar Órgãos
          </Button>
        </Link>
        <Link href="/dashboard/admin/cadastros">
          <Button variant="secondary" className="w-full">
            → Central de Cadastros
          </Button>
        </Link>
      </div>
    </div>
  );
}
