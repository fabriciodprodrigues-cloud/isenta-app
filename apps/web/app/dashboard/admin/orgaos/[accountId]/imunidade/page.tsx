'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';

interface ConcessionariaImunidade {
  id: string;
  nome: string;
  status: string;
  motivo: string | null;
}

interface Resumo {
  status: 'IMUNE' | 'PARCIAL' | 'COM_RISCO';
  totalConcessionariasEmail: number;
  confirmadas: number;
  comProblema: number;
  emAndamento: number;
  concessionariasComProblema: ConcessionariaImunidade[];
  concessionariasPendentes: ConcessionariaImunidade[];
  concessionariasSemCanal: number;
}

interface ItemLote {
  id: string;
  status: string;
  protocolo: string | null;
  ultimoErro: string | null;
  concessionaria: { name: string };
}

interface Lote {
  id: string;
  status: string;
  dataDisparo: string;
  disparadaPor: string;
  itens: ItemLote[];
}

interface Dados {
  account: { id: string; name: string; razaoSocial: string | null };
  resumo: Resumo;
  lote: Lote | null;
}

const SELO: Record<string, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  IMUNE: { label: 'Imune', variant: 'success' },
  PARCIAL: { label: 'Parcial', variant: 'warning' },
  COM_RISCO: { label: 'Com risco', variant: 'error' },
};

const STATUS_ITEM: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  PENDENTE_PRE_REQUISITO: { label: 'Pendente', variant: 'warning' },
  NA_FILA: { label: 'Na fila', variant: 'info' },
  ENVIADA: { label: 'Enviada', variant: 'info' },
  CONFIRMADA: { label: 'Confirmada', variant: 'success' },
  COM_PROBLEMA: { label: 'Com problema', variant: 'error' },
  CANCELADA: { label: 'Cancelada', variant: 'default' },
};

export default function ImunidadeNacionalAdmin() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function carregar() {
    try {
      const resposta = await fetch(`/api/imunidade/${accountId}`);
      if (resposta.ok) {
        setDados(await resposta.json());
      } else {
        setErro('Não foi possível carregar a imunidade deste órgão.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (accountId) void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function disparar() {
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch(`/api/imunidade/${accountId}/disparar`, { method: 'POST' });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao disparar a isenção nacional');
        return;
      }
      if (corpo?.mensagem) setMensagem(corpo.mensagem);
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setProcessando(false);
    }
  }

  async function processarPendencias() {
    if (!dados?.lote) return;
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch(`/api/imunidade/${accountId}/lotes/${dados.lote.id}/processar`, {
        method: 'POST',
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error || 'Erro ao processar pendências');
        return;
      }
      setMensagem(
        `${corpo.enviados} enviada(s), ${corpo.pendentes} pendente(s), ${corpo.comProblema} com problema.`
      );
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setProcessando(false);
    }
  }

  async function reenfileirar(itemId: string) {
    if (!dados?.lote) return;
    setErro('');
    setProcessando(true);
    try {
      const resposta = await fetch(
        `/api/imunidade/${accountId}/lotes/${dados.lote.id}/itens/${itemId}/reenfileirar`,
        { method: 'POST' }
      );
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error || 'Erro ao reenfileirar item');
        return;
      }
      await carregar();
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) {
    return <div className="text-paper">Carregando...</div>;
  }

  if (!dados) {
    return <div className="text-paper">{erro || 'Órgão não encontrado.'}</div>;
  }

  const { account, resumo, lote } = dados;
  const selo = SELO[resumo.status];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Imunidade Nacional</h1>
        <p className="text-paper-dim text-sm mt-1">{account.razaoSocial ?? account.name}</p>
      </div>

      {erro && <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300 text-sm">{erro}</div>}
      {mensagem && (
        <div className="bg-green-500/10 border border-green-500/40 rounded p-3 text-green-300 text-sm">
          {mensagem}
        </div>
      )}

      <Card>
        <CardBody className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Badge variant={selo.variant} size="md">{selo.label}</Badge>
            <div>
              <p className="text-paper font-semibold">
                {resumo.confirmadas} de {resumo.totalConcessionariasEmail} concessionárias confirmadas
              </p>
              {resumo.concessionariasSemCanal > 0 && (
                <p className="text-paper-dim text-xs mt-1">
                  +{resumo.concessionariasSemCanal} concessionária(s) ativa(s) ainda sem suporte
                  automatizado (fora do escopo atual, não conta como pendência do órgão)
                </p>
              )}
            </div>
          </div>
          <Button onClick={disparar} disabled={processando}>
            {processando ? 'Disparando...' : resumo.status === 'IMUNE' ? 'Verificar cobertura de novo' : 'Disparar isenção nacional'}
          </Button>
        </CardBody>
      </Card>

      {resumo.concessionariasComProblema.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-red-400">Com risco</h2></CardHeader>
          <CardBody className="space-y-2">
            {resumo.concessionariasComProblema.map(c => (
              <div key={c.id} className="text-sm text-paper-dim">
                <span className="text-paper">{c.nome}</span>
                {c.motivo && <span> — {c.motivo}</span>}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {resumo.concessionariasPendentes.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-amber-400">Em andamento</h2></CardHeader>
          <CardBody className="space-y-2">
            {resumo.concessionariasPendentes.map(c => (
              <div key={c.id} className="text-sm text-paper-dim">
                <span className="text-paper">{c.nome}</span>
                <span> — {c.status === 'nunca_disparado' ? 'ainda não disparada' : c.status}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {lote && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-paper">
              Último disparo — {new Date(lote.dataDisparo).toLocaleString('pt-BR')}
            </h2>
            <Button size="sm" variant="secondary" onClick={processarPendencias} disabled={processando}>
              {processando ? 'Processando...' : 'Processar pendências'}
            </Button>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Concessionária</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Protocolo</TableCell>
                    <TableCell>Erro</TableCell>
                    <TableCell>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lote.itens.map(item => {
                    const s = STATUS_ITEM[item.status] ?? { label: item.status, variant: 'default' as const };
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.concessionaria.name}</TableCell>
                        <TableCell><Badge size="sm" variant={s.variant}>{s.label}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{item.protocolo ?? '—'}</TableCell>
                        <TableCell className="text-xs text-paper-dim max-w-xs">{item.ultimoErro ?? '—'}</TableCell>
                        <TableCell>
                          {item.status === 'COM_PROBLEMA' && (
                            <Button size="sm" variant="secondary" onClick={() => reenfileirar(item.id)} disabled={processando}>
                              Reenfileirar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      <Link href="/dashboard/admin/orgaos">
        <Button variant="secondary">← Voltar</Button>
      </Link>
    </div>
  );
}
