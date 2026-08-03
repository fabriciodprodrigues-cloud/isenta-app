'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';

interface Account {
  id: string;
  razaoSocial: string;
  cnpj: string;
  name: string;
  email: string;
  telefone: string;
  city: string;
  state: string;
  operadores: number;
  veiculos: number;
  cadastrosAtivos: number;
  cadastrosPendentes: number;
  saude: string;
}

export default function GestaoOrgaos() {
  const [orgaos, setOrgaos] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSaude, setFiltroSaude] = useState('');

  useEffect(() => {
    loadOrgaos();
  }, []);

  async function loadOrgaos() {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        setOrgaos(await response.json());
      }
    } catch (error) {
      console.error('Erro ao carregar órgãos:', error);
    } finally {
      setLoading(false);
    }
  }

  const orgaosFiltrados = orgaos.filter(o => {
    const matchNome = o.razaoSocial.toLowerCase().includes(filtro.toLowerCase()) || o.cnpj.includes(filtro);
    const matchEstado = !filtroEstado || o.state === filtroEstado;
    const matchSaude = !filtroSaude || o.saude === filtroSaude;
    return matchNome && matchEstado && matchSaude;
  });

  const getSaudeColor = (saude: string) => {
    if (saude === 'verde') return 'text-green-400';
    if (saude === 'amarelo') return 'text-amber-400';
    return 'text-red-400';
  };

  const getSaudeLabel = (saude: string) => {
    if (saude === 'verde') return '✅ Saudável';
    if (saude === 'amarelo') return '⚠️ Atenção';
    return '❌ Crítico';
  };

  if (loading) {
    return <div className="text-paper">Carregando órgãos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-paper">Gestão de Órgãos</h1>
          <p className="text-paper-dim text-sm mt-1">
            Gerenciar órgãos públicos cadastrados no sistema
          </p>
        </div>
        <Link href="/dashboard/admin/orgaos/novo">
          <Button>+ Novo Órgão</Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card>
        <CardBody className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="flex-1 px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper placeholder:text-paper-dim"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
          >
            <option value="">Filtrar por estado</option>
            <option value="SP">São Paulo</option>
            <option value="RJ">Rio de Janeiro</option>
            <option value="MG">Minas Gerais</option>
            <option value="BA">Bahia</option>
            <option value="PR">Paraná</option>
          </select>
          <select
            value={filtroSaude}
            onChange={(e) => setFiltroSaude(e.target.value)}
            className="px-3 py-2 bg-ink-700 border border-white/10 rounded text-paper"
          >
            <option value="">Filtrar por saúde</option>
            <option value="verde">Saudável</option>
            <option value="amarelo">Atenção</option>
            <option value="vermelho">Crítico</option>
          </select>
        </CardBody>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {orgaosFiltrados.length} Órgão{orgaosFiltrados.length !== 1 ? 's' : ''}
          </h2>
        </CardHeader>
        <CardBody>
          {orgaosFiltrados.length === 0 ? (
            <p className="text-paper-dim text-center py-8">
              Nenhum órgão encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Razão Social</TableCell>
                    <TableCell>CNPJ</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Operadores</TableCell>
                    <TableCell>Veículos</TableCell>
                    <TableCell>Cadastros</TableCell>
                    <TableCell>Saúde</TableCell>
                    <TableCell>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orgaosFiltrados.map((orgao) => (
                    <TableRow key={orgao.id}>
                      <TableCell className="font-medium">
                        {orgao.razaoSocial}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {orgao.cnpj}
                      </TableCell>
                      <TableCell>{orgao.state}</TableCell>
                      <TableCell className="text-center">
                        {orgao.operadores}
                      </TableCell>
                      <TableCell className="text-center">
                        {orgao.veiculos}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-green-400">
                            {orgao.cadastrosAtivos}
                          </span>
                          <span className="text-paper-dim"> / </span>
                          <span className="text-amber-400">
                            {orgao.cadastrosPendentes}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={getSaudeColor(orgao.saude)}>
                          {getSaudeLabel(orgao.saude)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/admin/orgaos/${orgao.id}`}>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-accent mb-2">
              {orgaos.length}
            </div>
            <p className="text-paper-dim text-sm">Órgãos Cadastrados</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-green-400 mb-2">
              {orgaos.reduce((sum, o) => sum + o.cadastrosAtivos, 0)}
            </div>
            <p className="text-paper-dim text-sm">Cadastros Ativos</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-6">
            <div className="text-3xl font-bold text-amber-400 mb-2">
              {orgaos.reduce((sum, o) => sum + o.cadastrosPendentes, 0)}
            </div>
            <p className="text-paper-dim text-sm">Cadastros Pendentes</p>
          </CardBody>
        </Card>
      </div>

      {/* Links de Navegação */}
      <div className="flex gap-3">
        <Link href="/dashboard/admin">
          <Button variant="secondary">← Voltar</Button>
        </Link>
        <Link href="/dashboard/admin/frota">
          <Button variant="secondary">→ Gestão de Frota</Button>
        </Link>
      </div>
    </div>
  );
}
