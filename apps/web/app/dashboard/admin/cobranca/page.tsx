'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';

interface ContratoResumoLinha {
  id: string;
  orgao: string;
  dataVencimento: string;
  valorTotalPeriodoCentavos: number;
}

interface Resumo {
  receitaTotalContratadaCentavos: number;
  mrrCentavos: number;
  veiculosAtivos: number;
  ticketMedioPorOrgaoCentavos: number;
  contratosAVencer: Array<ContratoResumoLinha & { diasRestantes: number }>;
  contratosVencidos: Array<ContratoResumoLinha & { diasVencido: number }>;
  faturasAtrasadas: Array<{ id: string; orgao: string; valorCentavos: number; dataVencimento: string; diasAtraso: number }>;
  descontosConcedidos: Array<{ contratoId: string; orgao: string; precoUnitarioMensalCentavos: number; diferencaCentavos: number }>;
  porModalidade: Array<{ modalidade: string; contratos: number; receitaCentavos: number }>;
}

const MODALIDADE_LABEL: Record<string, string> = {
  licitacao_pregao: 'Licitação / Pregão',
  dispensa_valor: 'Dispensa por valor',
  inexigibilidade: 'Inexigibilidade',
  adesao_ata: 'Adesão a ata',
  compra_direta: 'Compra direta',
  outro: 'Outro',
};

function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Cobranca() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [precoReferencia, setPrecoReferencia] = useState('99,90');
  const [salvandoPreco, setSalvandoPreco] = useState(false);

  async function carregar() {
    try {
      const [resumoRes, configRes] = await Promise.all([
        fetch('/api/financeiro/resumo'),
        fetch('/api/financeiro/configuracao'),
      ]);
      if (resumoRes.ok) setResumo(await resumoRes.json());
      else setErro('Não foi possível carregar os indicadores financeiros.');
      if (configRes.ok) {
        const config = await configRes.json();
        setPrecoReferencia((config.precoReferenciaMensalCentavos / 100).toFixed(2).replace('.', ','));
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvarPrecoReferencia() {
    setSalvandoPreco(true);
    try {
      const centavos = Math.round(parseFloat(precoReferencia.replace(/\./g, '').replace(',', '.')) * 100);
      const resposta = await fetch('/api/financeiro/configuracao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precoReferenciaMensalCentavos: centavos }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error || 'Erro ao salvar preço de referência');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setSalvandoPreco(false);
    }
  }

  if (carregando) {
    return <div className="text-paper">Carregando...</div>;
  }

  if (erro && !resumo) {
    return <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300 text-sm">{erro}</div>;
  }

  if (!resumo) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Cobrança e Contratos</h1>
        <p className="text-paper-dim text-sm mt-1">
          Faturamento, contratos e cobrança dos órgãos públicos
        </p>
      </div>

      {erro && <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300 text-sm">{erro}</div>}

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-2xl font-bold text-accent">{formatarCentavos(resumo.receitaTotalContratadaCentavos)}</div>
            <p className="text-paper-dim text-sm mt-1">Receita contratada</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-2xl font-bold text-green-400">{formatarCentavos(resumo.mrrCentavos)}</div>
            <p className="text-paper-dim text-sm mt-1">MRR equivalente</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-2xl font-bold text-paper">{resumo.veiculosAtivos}</div>
            <p className="text-paper-dim text-sm mt-1">Veículos ativos</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-2xl font-bold text-paper">{formatarCentavos(resumo.ticketMedioPorOrgaoCentavos)}</div>
            <p className="text-paper-dim text-sm mt-1">Ticket médio/órgão</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold text-paper">Preço de referência</h2></CardHeader>
        <CardBody className="flex items-center gap-3">
          <Input
            value={precoReferencia}
            onChange={e => setPrecoReferencia(e.target.value)}
            className="w-32"
          />
          <Button size="sm" onClick={salvarPrecoReferencia} disabled={salvandoPreco}>
            {salvandoPreco ? 'Salvando...' : 'Salvar'}
          </Button>
          <p className="text-xs text-paper-dim">
            Só pré-preenche o formulário de novo contrato — não afeta contratos já fechados.
          </p>
        </CardBody>
      </Card>

      {resumo.contratosVencidos.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-red-400">Contratos vencidos ({resumo.contratosVencidos.length})</h2></CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow><TableCell>Órgão</TableCell><TableCell>Venceu em</TableCell><TableCell>Dias vencido</TableCell><TableCell>Valor do período</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {resumo.contratosVencidos.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.orgao}</TableCell>
                      <TableCell className="text-sm">{formatarData(c.dataVencimento)}</TableCell>
                      <TableCell><Badge size="sm" variant="error">{`${c.diasVencido}d`}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{formatarCentavos(c.valorTotalPeriodoCentavos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold text-paper">Contratos a vencer (90 dias)</h2></CardHeader>
        <CardBody>
          {resumo.contratosAVencer.length === 0 ? (
            <p className="text-paper-dim text-sm text-center py-4">Nenhum contrato vencendo nos próximos 90 dias.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow><TableCell>Órgão</TableCell><TableCell>Vencimento</TableCell><TableCell>Dias restantes</TableCell><TableCell>Valor do período</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {resumo.contratosAVencer.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.orgao}</TableCell>
                      <TableCell className="text-sm">{formatarData(c.dataVencimento)}</TableCell>
                      <TableCell>
                        <Badge size="sm" variant={c.diasRestantes <= 30 ? 'warning' : 'info'}>{`${c.diasRestantes}d`}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatarCentavos(c.valorTotalPeriodoCentavos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-paper">Faturas em atraso ({resumo.faturasAtrasadas.length})</h2></CardHeader>
        <CardBody>
          {resumo.faturasAtrasadas.length === 0 ? (
            <p className="text-paper-dim text-sm text-center py-4">Nenhuma fatura em atraso.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow><TableCell>Órgão</TableCell><TableCell>Valor</TableCell><TableCell>Venceu em</TableCell><TableCell>Dias de atraso</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {resumo.faturasAtrasadas.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.orgao}</TableCell>
                      <TableCell className="font-mono text-sm">{formatarCentavos(f.valorCentavos)}</TableCell>
                      <TableCell className="text-sm">{formatarData(f.dataVencimento)}</TableCell>
                      <TableCell><Badge size="sm" variant="error">{`${f.diasAtraso}d`}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><h2 className="font-semibold text-paper">Por modalidade de contratação</h2></CardHeader>
          <CardBody className="space-y-2">
            {resumo.porModalidade.length === 0 ? (
              <p className="text-paper-dim text-sm">Nenhum contrato ativo ainda.</p>
            ) : (
              resumo.porModalidade.map(m => (
                <div key={m.modalidade} className="flex items-center justify-between text-sm p-2 rounded bg-ink-700">
                  <span className="text-paper">{MODALIDADE_LABEL[m.modalidade] ?? m.modalidade}</span>
                  <span className="text-paper-dim">{m.contratos} contrato(s)</span>
                  <span className="font-mono text-accent">{formatarCentavos(m.receitaCentavos)}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold text-paper">Descontos concedidos</h2></CardHeader>
          <CardBody className="space-y-2">
            {resumo.descontosConcedidos.length === 0 ? (
              <p className="text-paper-dim text-sm">Nenhum contrato com preço diferente do de referência.</p>
            ) : (
              resumo.descontosConcedidos.map(d => (
                <div key={d.contratoId} className="flex items-center justify-between text-sm p-2 rounded bg-ink-700">
                  <span className="text-paper">{d.orgao}</span>
                  <span className="font-mono">{formatarCentavos(d.precoUnitarioMensalCentavos)}</span>
                  <span className={`font-mono ${d.diferencaCentavos > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                    {d.diferencaCentavos > 0 ? '-' : '+'}{formatarCentavos(Math.abs(d.diferencaCentavos))}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/admin"><Button variant="secondary">← Voltar</Button></Link>
        <Link href="/dashboard/admin/orgaos"><Button variant="secondary">→ Gestão de Órgãos</Button></Link>
      </div>
    </div>
  );
}
