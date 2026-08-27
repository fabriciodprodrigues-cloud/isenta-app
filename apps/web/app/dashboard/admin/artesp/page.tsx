'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { format_date } from '@/lib/utils';

interface Cadastro {
  id: string;
  tipoEntidade: string;
  status: string;
  protocolo: string | null;
  protocoladoEm: string | null;
  createdAt: string;
  account: { name: string; razaoSocial: string | null };
  veiculos: unknown[];
  documentos: { status: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  documentos_gerados: 'Documentos gerados',
  protocolado: 'Protocolado',
  deferido: 'Deferido',
  indeferido: 'Indeferido',
  exigencia: 'Em exigência',
};

const CORES: Record<string, string> = {
  rascunho: 'bg-gray-900/20 text-gray-400',
  documentos_gerados: 'bg-blue-900/20 text-blue-400',
  protocolado: 'bg-amber-900/20 text-amber-400',
  deferido: 'bg-green-900/20 text-green-400',
  indeferido: 'bg-red-900/20 text-red-400',
  exigencia: 'bg-amber-900/20 text-amber-400',
};

export default function AdminArtesp() {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  async function carregar() {
    try {
      const resposta = await fetch('/api/artesp/cadastro');
      if (resposta.ok) {
        setCadastros(await resposta.json());
      } else {
        setErro('Não foi possível carregar os cadastros.');
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

  async function registrarDecisao(id: string, decisao: 'deferido' | 'indeferido') {
    setProcessandoId(id);
    try {
      const resposta = await fetch(`/api/artesp/cadastro/${id}/decisao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao }),
      });
      if (resposta.ok) {
        await carregar();
      } else {
        const corpo = await resposta.json().catch(() => null);
        alert(corpo?.error || 'Erro ao registrar a decisão');
      }
    } finally {
      setProcessandoId(null);
    }
  }

  if (carregando) {
    return <div className="text-paper">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Cadastros ARTESP</h1>
        <p className="text-paper-dim text-sm mt-1">
          Acompanhamento dos cadastros de frota junto à ARTESP (Portaria nº 56/2025)
        </p>
      </div>

      {erro && (
        <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300 text-sm">{erro}</div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">{cadastros.length} cadastro{cadastros.length !== 1 ? 's' : ''}</h2>
        </CardHeader>
        <CardBody>
          {cadastros.length === 0 ? (
            <p className="text-paper-dim text-center py-4">Nenhum cadastro ARTESP ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Órgão</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Veículos</TableCell>
                    <TableCell>Documentos assinados</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Protocolo</TableCell>
                    <TableCell>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cadastros.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.account.razaoSocial ?? c.account.name}</TableCell>
                      <TableCell>{c.tipoEntidade}</TableCell>
                      <TableCell className="text-center">{c.veiculos.length}</TableCell>
                      <TableCell className="text-center">
                        {c.documentos.filter(d => d.status === 'assinado').length}/5
                      </TableCell>
                      <TableCell>
                        <div className={`inline-block rounded-full px-2 py-1 text-xs font-mono ${CORES[c.status] ?? CORES.rascunho}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {c.protocolo || '—'}
                        {c.protocoladoEm && (
                          <div className="text-xs text-paper-dim">{format_date(new Date(c.protocoladoEm))}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.status === 'protocolado' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={processandoId === c.id}
                              onClick={() => registrarDecisao(c.id, 'deferido')}
                            >
                              Deferido
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={processandoId === c.id}
                              onClick={() => registrarDecisao(c.id, 'indeferido')}
                            >
                              Indeferido
                            </Button>
                          </div>
                        )}
                        {c.status !== 'protocolado' && <span className="text-paper-dim text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <Link href="/dashboard/admin">
        <Button variant="secondary">← Voltar</Button>
      </Link>
    </div>
  );
}
