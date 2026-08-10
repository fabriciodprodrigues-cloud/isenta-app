'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { format_data_hoje } from '@/lib/utils';

interface Pendencia {
  id: string;
  placa: string;
  orgao: string;
  concessionaria: string;
  motivo?: string;
}

interface Resumo {
  orgaosAtivos: number;
  veiculosGerenciados: number;
  cadastrosAtivos: number;
  cadastrosAguardando: number;
  cadastrosRascunho: number;
  cadastrosRecusados: number;
  cadastrosVencendo: number;
  cadastrosVencidos: number;
  tagsEstoque: number;
  tagsAtivadas: number;
  pendencias: {
    recusados: Pendencia[];
    semDocumento: Pendencia[];
  };
}

export default function AdminDashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const resposta = await fetch('/api/admin/resumo');
        if (resposta.ok) {
          setResumo(await resposta.json());
        } else {
          setErro('Não foi possível carregar os indicadores.');
        }
      } catch {
        setErro('Falha de conexão ao carregar os indicadores.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  if (carregando) {
    return <p className="text-paper-dim">Carregando indicadores...</p>;
  }

  if (erro || !resumo) {
    return (
      <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-300">
        {erro || 'Indicadores indisponíveis.'}
      </div>
    );
  }

  // Alertas derivados do estado real. Antes eram três frases fixas no código
  // ("5 cadastros recusados", "RPA falhou 2x") que apareciam mesmo com o banco
  // vazio, dando a impressão de um sistema em operação.
  const alertas: Array<{ chave: string; mensagem: string; destino: string }> = [];

  if (resumo.cadastrosRecusados > 0) {
    alertas.push({
      chave: 'recusados',
      mensagem: `${resumo.cadastrosRecusados} cadastro(s) recusado(s) precisam de correção`,
      destino: '/dashboard/admin/cadastros',
    });
  }

  if (resumo.pendencias.semDocumento.length > 0) {
    alertas.push({
      chave: 'documento',
      mensagem: `${resumo.pendencias.semDocumento.length} solicitação(ões) aguardando CRLV para poder ser enviada(s)`,
      destino: '/dashboard/admin/frota',
    });
  }

  if (resumo.cadastrosVencidos > 0) {
    alertas.push({
      chave: 'vencidos',
      mensagem: `${resumo.cadastrosVencidos} veículo(s) com isenção vencida`,
      destino: '/dashboard/admin/frota',
    });
  }

  if (resumo.cadastrosVencendo > 0) {
    alertas.push({
      chave: 'vencendo',
      mensagem: `${resumo.cadastrosVencendo} veículo(s) vencendo em até 7 dias`,
      destino: '/dashboard/admin/frota',
    });
  }

  const filaDoDia = [
    ...resumo.pendencias.semDocumento.map(p => ({
      id: `doc-${p.id}`,
      descricao: `${p.placa} (${p.orgao}) — falta anexar o CRLV`,
      concessionaria: p.concessionaria,
    })),
    ...resumo.pendencias.recusados.map(p => ({
      id: `rec-${p.id}`,
      descricao: `${p.placa} (${p.orgao}) — recusado: ${p.motivo}`,
      concessionaria: p.concessionaria,
    })),
  ];

  const indicadores = [
    { rotulo: 'Órgãos Ativos', valor: resumo.orgaosAtivos, cor: 'text-accent' },
    { rotulo: 'Veículos', valor: resumo.veiculosGerenciados, cor: 'text-accent' },
    { rotulo: 'Cadastros Aprovados', valor: resumo.cadastrosAtivos, cor: 'text-green-400' },
    { rotulo: 'Aguardando Resposta', valor: resumo.cadastrosAguardando, cor: 'text-amber-400' },
  ];

  const secundarios = [
    { rotulo: 'Não enviados', valor: resumo.cadastrosRascunho, cor: 'text-paper' },
    { rotulo: 'Vencendo em 7 dias', valor: resumo.cadastrosVencendo, cor: 'text-amber-400' },
    { rotulo: 'Vencidos', valor: resumo.cadastrosVencidos, cor: 'text-red-400' },
    { rotulo: 'TAGs Vinculadas', valor: resumo.tagsAtivadas, cor: 'text-green-400' },
    { rotulo: 'TAGs em Estoque', valor: resumo.tagsEstoque, cor: 'text-amber-400' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-paper">Visão Geral</h1>
        <p className="text-paper-dim mt-2">
          Dashboard central de operação — {format_data_hoje()}
        </p>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-paper-dim uppercase tracking-wider">
            Alertas
          </h2>
          <div className="grid gap-3">
            {alertas.map(alerta => (
              <div
                key={alerta.chave}
                className="flex items-center justify-between rounded-lg border border-amber-800 bg-amber-900/20 p-4"
              >
                <p className="text-sm font-medium text-amber-400">{alerta.mensagem}</p>
                <Link href={alerta.destino}>
                  <Button size="sm" variant="secondary">
                    Ver Detalhes
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-paper-dim">
          Indicadores-Chave
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {indicadores.map(i => (
            <Card key={i.rotulo}>
              <CardBody className="py-6 text-center">
                <div className={`mb-2 text-3xl font-bold ${i.cor}`}>{i.valor}</div>
                <p className="text-sm text-paper-dim">{i.rotulo}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-5 gap-4">
          {secundarios.map(i => (
            <Card key={i.rotulo}>
              <CardBody className="py-6 text-center">
                <div className={`mb-2 text-2xl font-bold ${i.cor}`}>{i.valor}</div>
                <p className="text-sm text-paper-dim">{i.rotulo}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-paper-dim">
          Fila de Ação do Dia
        </h2>
        <Card>
          <CardBody>
            {filaDoDia.length === 0 ? (
              <p className="py-8 text-center text-paper-dim">
                Nenhuma pendência no momento.
              </p>
            ) : (
              <div className="space-y-4">
                {filaDoDia.map(acao => (
                  <div
                    key={acao.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-ink-700 p-4"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-paper">{acao.descricao}</p>
                      <p className="mt-1 text-xs text-paper-dim">
                        Concessionária: {acao.concessionaria}
                      </p>
                    </div>
                    <Link href="/dashboard/admin/frota">
                      <Button size="sm" className="ml-4">
                        Resolver
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4">
        <Link href="/dashboard/admin/orgaos">
          <Button variant="secondary" className="w-full">
            Gerenciar Órgãos
          </Button>
        </Link>
        <Link href="/dashboard/admin/cadastros">
          <Button variant="secondary" className="w-full">
            Central de Cadastros
          </Button>
        </Link>
      </div>
    </div>
  );
}
