'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { format_date, format_plate, get_status_label } from '@/lib/utils';

interface Cadastro {
  id: string;
  status: string;
  protocol: string | null;
  createdAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  vehicle: { plate: string; account: { name: string } | null } | null;
  concessionaire: { name: string } | null;
}

const CORES: Record<string, string> = {
  rascunho: 'bg-gray-900/20 text-gray-400',
  enviado: 'bg-blue-900/20 text-blue-400',
  aguardando_resposta: 'bg-amber-900/20 text-amber-400',
  aprovado: 'bg-green-900/20 text-green-400',
  recusado: 'bg-red-900/20 text-red-400',
};

/** Ordem de exibição: o que exige ação primeiro. */
const ORDEM_STATUS = ['recusado', 'rascunho', 'enviado', 'aguardando_resposta', 'aprovado'];

export default function CentralCadastros() {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        // Sem accountId: como admin, a API devolve os cadastros de todos os
        // órgãos.
        const resposta = await fetch('/api/registrations');
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

    carregar();
  }, []);

  if (carregando) {
    return <p className="text-paper-dim">Carregando cadastros...</p>;
  }

  if (erro) {
    return (
      <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-300">
        {erro}
      </div>
    );
  }

  const contagem = cadastros.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtrados = filtroStatus
    ? cadastros.filter(c => c.status === filtroStatus)
    : [...cadastros].sort(
        (a, b) => ORDEM_STATUS.indexOf(a.status) - ORDEM_STATUS.indexOf(b.status)
      );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Central de Cadastros</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Solicitações de isenção em todas as concessionárias
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {ORDEM_STATUS.map(status => (
          <Card key={status}>
            <CardBody className="py-6 text-center">
              <div className="mb-2 text-3xl font-bold text-paper">
                {contagem[status] ?? 0}
              </div>
              <p className="text-sm text-paper-dim">{get_status_label(status)}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="rounded border border-border bg-input px-3 py-2 text-paper"
          >
            <option value="">Todos os status</option>
            {ORDEM_STATUS.map(s => (
              <option key={s} value={s}>
                {get_status_label(s)}
              </option>
            ))}
          </select>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {filtrados.length} {filtrados.length === 1 ? 'cadastro' : 'cadastros'}
          </h2>
        </CardHeader>
        <CardBody>
          {cadastros.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-paper-dim">
                Nenhuma solicitação de isenção registrada ainda.
              </p>
              <Link href="/dashboard/admin/frota">
                <Button className="mt-4">Ver frota</Button>
              </Link>
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-paper-dim">
              Nenhum cadastro com este status.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Veículo</TableCell>
                    <TableCell>Órgão</TableCell>
                    <TableCell>Concessionária</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Protocolo</TableCell>
                    <TableCell>Criado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtrados.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-bold">
                        {c.vehicle ? format_plate(c.vehicle.plate) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.vehicle?.account?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.concessionaire?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            CORES[c.status] ?? CORES.rascunho
                          }`}
                          title={c.rejectionReason ?? undefined}
                        >
                          {get_status_label(c.status)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-paper-dim">
                        {c.protocol ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-paper-dim">
                        {format_date(new Date(c.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
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
