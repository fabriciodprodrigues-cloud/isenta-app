'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';

export default function GestaoFrota() {
  const [filtro, setFiltro] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);

  // Mock data
  const veiculos = [
    {
      id: '1',
      placa: 'SAO1000',
      orgao: 'Prefeitura SP',
      tipo: 'Próprio',
      categoria: 'Oficial',
      renavam: '12345678901',
      cor: 'Branco',
      marca: 'Toyota',
      modelo: 'Hiace',
      anoFab: 2023,
      concessionarias: [
        { nome: 'Eco050', status: 'aprovado' },
        { nome: 'CSG', status: 'pendente' },
      ],
    },
    {
      id: '2',
      placa: 'AMB1001',
      orgao: 'Prefeitura SP',
      tipo: 'Próprio',
      categoria: 'Ambulância',
      renavam: '98765432101',
      cor: 'Branco',
      marca: 'Mercedes',
      modelo: 'Sprinter',
      anoFab: 2022,
      concessionarias: [
        { nome: 'CSG', status: 'aguardando' },
      ],
    },
    {
      id: '3',
      placa: 'CBM1002',
      orgao: 'Prefeitura SP',
      tipo: 'Locado',
      categoria: 'Bombeiro',
      renavam: '11122233344',
      cor: 'Vermelho',
      marca: 'Scania',
      modelo: 'P 360',
      anoFab: 2021,
      concessionarias: [
        { nome: 'Eco050', status: 'rascunho' },
      ],
    },
    {
      id: '4',
      placa: 'OTR1003',
      orgao: 'Prefeitura SP',
      tipo: 'Próprio',
      categoria: 'Outro',
      renavam: '55566677788',
      cor: 'Preto',
      marca: 'Volkswagen',
      modelo: 'Delivery',
      anoFab: 2023,
      concessionarias: [],
    },
  ];

  const veiculosFiltrados = veiculos.filter(
    (v) =>
      v.placa.includes(filtro.toUpperCase()) ||
      v.orgao.toLowerCase().includes(filtro.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    if (status === 'aprovado') return 'bg-green-900/20 text-green-400';
    if (status === 'pendente') return 'bg-amber-900/20 text-amber-400';
    if (status === 'aguardando') return 'bg-blue-900/20 text-blue-400';
    return 'bg-gray-900/20 text-gray-400';
  };

  const toggleVeiculo = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (selecionados.length === veiculosFiltrados.length) {
      setSelecionados([]);
    } else {
      setSelecionados(veiculosFiltrados.map((v) => v.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-paper">Gestão da Frota</h1>
        <p className="text-paper-dim text-sm mt-1">
          Visualizar todos os veículos e status de cadastro por concessionária
        </p>
      </div>

      {/* Filtros e Ações */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Buscar por placa ou órgão..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="flex-1 px-3 py-2 bg-input border border-border rounded text-paper placeholder:text-paper-dim"
            />
            <select className="px-3 py-2 bg-input border border-border rounded text-paper">
              <option value="">Filtrar por status</option>
              <option value="aprovado">Aprovado</option>
              <option value="pendente">Pendente</option>
              <option value="rascunho">Rascunho</option>
            </select>
          </div>

          {selecionados.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent rounded">
              <p className="text-sm text-paper">
                {selecionados.length} veículo(s) selecionado(s)
              </p>
              <div className="flex gap-2">
                <Button size="sm">Cadastrar Selecionados</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelecionados([])}
                >
                  Limpar
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {veiculosFiltrados.length} Veículos
          </h2>
        </CardHeader>
        <CardBody>
          {veiculosFiltrados.length === 0 ? (
            <p className="text-paper-dim text-center py-8">
              Nenhum veículo encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell className="w-12">
                      <input
                        type="checkbox"
                        checked={
                          selecionados.length === veiculosFiltrados.length &&
                          veiculosFiltrados.length > 0
                        }
                        onChange={toggleTodos}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>Placa</TableCell>
                    <TableCell>Órgão</TableCell>
                    <TableCell>Marca/Modelo</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Concessionárias</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {veiculosFiltrados.map((veiculo) => (
                    <TableRow key={veiculo.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selecionados.includes(veiculo.id)}
                          onChange={() => toggleVeiculo(veiculo.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-mono font-bold">
                        {veiculo.placa}
                      </TableCell>
                      <TableCell className="text-sm">
                        {veiculo.orgao}
                      </TableCell>
                      <TableCell className="text-sm">
                        {veiculo.marca} {veiculo.modelo}
                      </TableCell>
                      <TableCell className="text-sm">
                        {veiculo.tipo === 'Próprio' ? '🚗' : '🚗'}{' '}
                        {veiculo.tipo}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {veiculo.concessionarias.length === 0 ? (
                            <span className="text-xs text-paper-dim">
                              Nenhuma
                            </span>
                          ) : (
                            veiculo.concessionarias.map((c) => (
                              <span
                                key={c.nome}
                                className={`text-xs px-2 py-1 rounded ${getStatusColor(
                                  c.status
                                )}`}
                              >
                                {c.nome}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/admin/frota/${veiculo.id}`}>
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-accent mb-2">
              {veiculos.length}
            </div>
            <p className="text-paper-dim text-sm">Total de Veículos</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-green-400 mb-2">
              {veiculos.filter((v) =>
                v.concessionarias.some((c) => c.status === 'aprovado')
              ).length}
            </div>
            <p className="text-paper-dim text-sm">Com Cadastro Aprovado</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-amber-400 mb-2">
              {veiculos.filter((v) =>
                v.concessionarias.some(
                  (c) => c.status === 'pendente' || c.status === 'aguardando'
                )
              ).length}
            </div>
            <p className="text-paper-dim text-sm">Cadastros Pendentes</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-gray-400 mb-2">
              {veiculos.filter((v) => v.concessionarias.length === 0).length}
            </div>
            <p className="text-paper-dim text-sm">Sem Cadastro</p>
          </CardBody>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Visão Geral</Button>
        </Link>
        <Link href="/dashboard/admin/cadastros">
          <Button variant="secondary">→ Central de Cadastros</Button>
        </Link>
      </div>
    </div>
  );
}
