'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { format_estados } from '@/lib/utils';

interface Concessionaria {
  id: string;
  name: string;
  regulador: string;
  estados: string | null;
  situacao: string;
  canalIsentos: string | null;
  tipoCanal: string | null;
  ativoParaCadastro: boolean;
}

const ROTULO_CANAL: Record<string, string> = {
  EMAIL: 'E-mail',
  PORTAL_WEB: 'Portal web',
  PORTAL_MAIS_ATENDIMENTO: 'Portal +Atendimento',
  MANUAL: 'Manual',
};

const COR_CANAL: Record<string, string> = {
  EMAIL: 'bg-green-900/20 text-green-400',
  PORTAL_WEB: 'bg-blue-900/20 text-blue-400',
  PORTAL_MAIS_ATENDIMENTO: 'bg-blue-900/20 text-blue-400',
  MANUAL: 'bg-amber-900/20 text-amber-400',
};

export default function GestaoConcessionarias() {
  const [lista, setLista] = useState<Concessionaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const resposta = await fetch('/api/concessionaires');
        if (resposta.ok) {
          setLista(await resposta.json());
        } else {
          setErro('Não foi possível carregar as concessionárias.');
        }
      } catch {
        setErro('Falha de conexão.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  const contagens = useMemo(() => {
    const porCanal = lista.reduce<Record<string, number>>((acc, c) => {
      const chave = c.tipoCanal ?? 'SEM_CANAL';
      acc[chave] = (acc[chave] ?? 0) + 1;
      return acc;
    }, {});
    return porCanal;
  }, [lista]);

  if (carregando) {
    return <p className="text-paper-dim">Carregando concessionárias...</p>;
  }

  if (erro) {
    return (
      <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-300">
        {erro}
      </div>
    );
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = lista.filter(c => {
    const casaBusca =
      !termo ||
      c.name.toLowerCase().includes(termo) ||
      (c.regulador ?? '').toLowerCase().includes(termo) ||
      format_estados(c.estados).toLowerCase().includes(termo);

    const casaCanal =
      !filtroCanal ||
      (filtroCanal === 'SEM_CANAL' ? !c.tipoCanal : c.tipoCanal === filtroCanal);

    return casaBusca && casaCanal;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Gestão de Concessionárias</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Canais de isenção mapeados e situação de cada concessionária
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            rotulo: 'Automatizáveis por e-mail',
            valor: contagens.EMAIL ?? 0,
            cor: 'text-green-400',
          },
          {
            rotulo: 'Via portal',
            valor: (contagens.PORTAL_WEB ?? 0) + (contagens.PORTAL_MAIS_ATENDIMENTO ?? 0),
            cor: 'text-blue-400',
          },
          {
            rotulo: 'Tratativa manual',
            valor: contagens.MANUAL ?? 0,
            cor: 'text-amber-400',
          },
          {
            rotulo: 'Canal não mapeado',
            valor: contagens.SEM_CANAL ?? 0,
            cor: 'text-paper-dim',
          },
        ].map(item => (
          <Card key={item.rotulo}>
            <CardBody className="py-6 text-center">
              <div className={`mb-2 text-3xl font-bold ${item.cor}`}>{item.valor}</div>
              <p className="text-sm text-paper-dim">{item.rotulo}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por nome, regulador ou estado..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="flex-1 rounded border border-border bg-input px-3 py-2 text-paper placeholder:text-paper-dim"
            />
            <select
              value={filtroCanal}
              onChange={e => setFiltroCanal(e.target.value)}
              className="rounded border border-border bg-input px-3 py-2 text-paper"
            >
              <option value="">Todos os canais</option>
              <option value="EMAIL">E-mail</option>
              <option value="PORTAL_WEB">Portal web</option>
              <option value="PORTAL_MAIS_ATENDIMENTO">Portal +Atendimento</option>
              <option value="MANUAL">Manual</option>
              <option value="SEM_CANAL">Não mapeado</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {filtradas.length} de {lista.length}
          </h2>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Concessionária</TableCell>
                  <TableCell>Regulador</TableCell>
                  <TableCell>Estados</TableCell>
                  <TableCell>Canal</TableCell>
                  <TableCell>Destino</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtradas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-paper-dim">
                      {c.regulador}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format_estados(c.estados) || '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          COR_CANAL[c.tipoCanal ?? ''] ?? 'bg-gray-900/20 text-gray-400'
                        }`}
                      >
                        {ROTULO_CANAL[c.tipoCanal ?? ''] ?? 'Não mapeado'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-paper-dim">
                      {c.canalIsentos ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
