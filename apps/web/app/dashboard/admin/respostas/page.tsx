'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { format_date } from '@/lib/utils';

interface Resposta {
  id: string;
  orgao: string;
  remetente: string;
  assunto: string;
  recebidoEm: string | null;
  corpoResumo: string | null;
  protocoloDetectado: string | null;
  classificacaoDetectada: 'aprovado' | 'recusado' | 'indefinido';
  placas: string[];
  status: string;
  createdAt: string;
}

const BADGE_CLASSIFICACAO: Record<string, { variant: 'success' | 'error' | 'default'; label: string }> = {
  aprovado: { variant: 'success', label: 'Parece aprovado' },
  recusado: { variant: 'error', label: 'Parece recusado' },
  indefinido: { variant: 'default', label: 'Não identificado' },
};

export default function RespostasRecebidas() {
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function carregar() {
    try {
      const resposta = await fetch('/api/respostas');
      if (resposta.ok) {
        setRespostas(await resposta.json());
      } else {
        setErro('Não foi possível carregar as respostas.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function verificarAgora() {
    setVerificando(true);
    setErro('');
    setAviso('');

    try {
      const resposta = await fetch('/api/respostas/verificar-agora', { method: 'POST' });
      const corpo = await resposta.json();

      if (resposta.ok) {
        setAviso(
          `${corpo.orgaosVerificados} órgão(s) verificado(s), ${corpo.emailsNovos} e-mail(s) novo(s).`
        );
        await carregar();
      } else {
        setErro(corpo.error ?? 'Não foi possível verificar agora.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setVerificando(false);
    }
  }

  async function decidir(id: string, decisao: 'aprovado' | 'recusado' | 'ignorar') {
    setProcessando(id);
    setErro('');
    setAviso('');

    try {
      const url =
        decisao === 'ignorar' ? `/api/respostas/${id}/ignorar` : `/api/respostas/${id}/confirmar`;
      const resposta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: decisao === 'ignorar' ? undefined : JSON.stringify({ decisao }),
      });

      if (resposta.ok) {
        setRespostas(atual => atual.filter(r => r.id !== id));
      } else {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error ?? 'Não foi possível processar esta resposta.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-paper">Respostas Recebidas</h1>
          <p className="mt-1 text-sm text-paper-dim">
            E-mails lidos da caixa institucional dos órgãos, casados com o protocolo do ofício.
            Nada aqui muda o status de uma solicitação sozinho — confirme ou ignore cada linha.
          </p>
        </div>
        <Button onClick={verificarAgora} loading={verificando}>
          Verificar agora
        </Button>
      </div>

      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-300">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="rounded border border-green/40 bg-green/10 p-4 text-green">{aviso}</div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {carregando
              ? 'Carregando...'
              : `${respostas.length} ${respostas.length === 1 ? 'resposta pendente' : 'respostas pendentes'}`}
          </h2>
        </CardHeader>
        <CardBody>
          {carregando ? null : respostas.length === 0 ? (
            <p className="py-8 text-center text-paper-dim">
              Nenhuma resposta pendente de revisão.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Órgão</TableCell>
                    <TableCell>Remetente</TableCell>
                    <TableCell>Protocolo</TableCell>
                    <TableCell>Veículos</TableCell>
                    <TableCell>Detecção</TableCell>
                    <TableCell>Trecho</TableCell>
                    <TableCell>Recebido</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {respostas.map(r => {
                    const badge = BADGE_CLASSIFICACAO[r.classificacaoDetectada] ?? BADGE_CLASSIFICACAO.indefinido;
                    const semProtocolo = !r.protocoloDetectado;
                    const ocupado = processando === r.id;

                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.orgao}</TableCell>
                        <TableCell className="text-sm">{r.remetente}</TableCell>
                        <TableCell className="font-mono text-sm text-paper-dim">
                          {r.protocoloDetectado ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {r.placas.length ? r.placas.join(', ') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge size="sm" variant={badge.variant}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-paper-dim">
                          <span className="block truncate" title={r.corpoResumo ?? ''}>
                            {r.corpoResumo ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-paper-dim">
                          {r.recebidoEm ? format_date(new Date(r.recebidoEm)) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={semProtocolo || ocupado}
                              onClick={() => decidir(r.id, 'aprovado')}
                            >
                              Confirmar aprovado
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={semProtocolo || ocupado}
                              onClick={() => decidir(r.id, 'recusado')}
                            >
                              Confirmar recusado
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={ocupado}
                              onClick={() => decidir(r.id, 'ignorar')}
                            >
                              Ignorar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">Voltar</Button>
        </Link>
      </div>
    </div>
  );
}
