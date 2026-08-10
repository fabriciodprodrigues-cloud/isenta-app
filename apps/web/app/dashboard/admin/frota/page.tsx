'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { format_plate, get_status_label } from '@/lib/utils';

interface Registro {
  id: string;
  status: string;
  concessionaire?: { name: string } | null;
}

interface Veiculo {
  id: string;
  plate: string;
  type: string;
  marca: string | null;
  modelo: string | null;
  account: { name: string } | null;
  registrations: Registro[];
}

const CORES_STATUS: Record<string, string> = {
  aprovado: 'bg-green-900/20 text-green-400',
  aguardando_resposta: 'bg-blue-900/20 text-blue-400',
  enviado: 'bg-blue-900/20 text-blue-400',
  recusado: 'bg-red-900/20 text-red-400',
  rascunho: 'bg-gray-900/20 text-gray-400',
};

export default function GestaoFrota() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const resposta = await fetch('/api/vehicles');
        if (resposta.ok) {
          setVeiculos(await resposta.json());
        } else {
          setErro('Não foi possível carregar a frota.');
        }
      } catch {
        setErro('Falha de conexão ao carregar a frota.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  if (carregando) {
    return <p className="text-paper-dim">Carregando frota...</p>;
  }

  if (erro) {
    return (
      <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-300">
        {erro}
      </div>
    );
  }

  const busca = filtro.trim().toLowerCase();
  const veiculosFiltrados = veiculos.filter(v => {
    const casaBusca =
      !busca ||
      v.plate.toLowerCase().includes(busca) ||
      (v.account?.name ?? '').toLowerCase().includes(busca);

    const casaStatus =
      !filtroStatus || v.registrations.some(r => r.status === filtroStatus);

    return casaBusca && casaStatus;
  });

  const comAprovado = veiculos.filter(v =>
    v.registrations.some(r => r.status === 'aprovado')
  ).length;

  const comPendente = veiculos.filter(v =>
    v.registrations.some(r =>
      ['rascunho', 'enviado', 'aguardando_resposta'].includes(r.status)
    )
  ).length;

  const semCadastro = veiculos.filter(v => v.registrations.length === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Gestão da Frota</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Visualizar todos os veículos e status de cadastro por concessionária
        </p>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por placa ou órgão..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              className="flex-1 rounded border border-border bg-input px-3 py-2 text-paper placeholder:text-paper-dim"
            />
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="rounded border border-border bg-input px-3 py-2 text-paper"
            >
              <option value="">Filtrar por status</option>
              <option value="aprovado">Aprovado</option>
              <option value="aguardando_resposta">Aguardando resposta</option>
              <option value="enviado">Enviado</option>
              <option value="rascunho">Não enviado</option>
              <option value="recusado">Recusado</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {veiculosFiltrados.length}{' '}
            {veiculosFiltrados.length === 1 ? 'veículo' : 'veículos'}
          </h2>
        </CardHeader>
        <CardBody>
          {veiculos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-paper-dim">Nenhum veículo cadastrado ainda.</p>
              <Link href="/dashboard/vehicles/new">
                <Button className="mt-4">Cadastrar primeiro veículo</Button>
              </Link>
            </div>
          ) : veiculosFiltrados.length === 0 ? (
            <p className="py-8 text-center text-paper-dim">
              Nenhum veículo corresponde ao filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Placa</TableCell>
                    <TableCell>Órgão</TableCell>
                    <TableCell>Marca/Modelo</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Concessionárias</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {veiculosFiltrados.map(veiculo => (
                    <TableRow key={veiculo.id}>
                      <TableCell className="font-mono font-bold">
                        {format_plate(veiculo.plate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {veiculo.account?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {[veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {veiculo.type === 'locado' ? 'Locado' : 'Próprio'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {veiculo.registrations.length === 0 ? (
                            <span className="text-xs text-paper-dim">Nenhuma</span>
                          ) : (
                            veiculo.registrations.map(r => (
                              <span
                                key={r.id}
                                title={get_status_label(r.status)}
                                className={`rounded px-2 py-1 text-xs ${
                                  CORES_STATUS[r.status] ?? CORES_STATUS.rascunho
                                }`}
                              >
                                {r.concessionaire?.name ?? 'Concessionária'}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* A rota /dashboard/admin/frota/[id] nunca existiu; o
                            detalhe do veículo mora em /dashboard/vehicles/[id]. */}
                        <Link href={`/dashboard/vehicles/${veiculo.id}`}>
                          <Button size="sm" variant="secondary">
                            Ver
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        {[
          { rotulo: 'Total de Veículos', valor: veiculos.length, cor: 'text-accent' },
          { rotulo: 'Com Cadastro Aprovado', valor: comAprovado, cor: 'text-green-400' },
          { rotulo: 'Cadastros Pendentes', valor: comPendente, cor: 'text-amber-400' },
          { rotulo: 'Sem Cadastro', valor: semCadastro, cor: 'text-paper-dim' },
        ].map(item => (
          <Card key={item.rotulo}>
            <CardBody className="py-6 text-center">
              <div className={`mb-2 text-3xl font-bold ${item.cor}`}>{item.valor}</div>
              <p className="text-sm text-paper-dim">{item.rotulo}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
