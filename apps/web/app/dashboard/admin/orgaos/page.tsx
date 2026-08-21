'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { ESTADOS_BR } from '@/lib/utils';

interface Account {
  id: string;
  // razaoSocial, email e telefone sao opcionais no schema (String?), entao a
  // API pode devolver null em contas antigas ou importadas.
  razaoSocial: string | null;
  cnpj: string;
  name: string;
  email: string | null;
  telefone: string | null;
  city: string;
  state: string;
  operadores: number;
  veiculos: number;
  cadastrosAtivos: number;
  cadastrosPendentes: number;
  saude: string;
  status: string; // Adicionado campo status
}

export default function GestaoOrgaos() {
  const [orgaos, setOrgaos] = useState<Account[]>([]);
  const [orgaoSelecionado, setOrgaoSelecionado] = useState<Account | null>(null);
  const [modalAberto, setModalAberto] = useState<'editar' | 'excluir' | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    razaoSocial: '',
    cnpj: '',
    responsibleName: '',
    responsibleEmail: '',
    responsiblePhone: '',
    address: '',
    city: '',
    state: ''
  });
  const [orgaoSelecionado, setOrgaoSelecionado] = useState<Account | null>(null);
  const [modalAberto, setModalAberto] = useState<'editar' | 'congelar' | 'excluir' | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    razaoSocial: '',
    cnpj: '',
    responsibleName: '',
    responsibleEmail: '',
    responsiblePhone: '',
    address: '',
    city: '',
    state: ''
  });
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSaude, setFiltroSaude] = useState('');

  useEffect(() => {
    loadOrgaos();
  }, []);

  function abrirModalEdicao(orgao: Account) {
    setOrgaoSelecionado(orgao);
    setFormData({
      name: orgao.name,
      razaoSocial: orgao.razaoSocial ?? '',
      cnpj: orgao.cnpj,
      responsibleName: orgao.responsibleName,
      responsibleEmail: orgao.responsibleEmail,
      responsiblePhone: orgao.responsiblePhone,
      address: orgao.address,
      city: orgao.city,
      state: orgao.state
    });
    setModalAberto('editar');
  }

  function abrirModalCongelar(orgao: Account) {
    setOrgaoSelecionado(orgao);
    setModalAberto('congelar');
  }

  function abrirModalExcluir(orgao: Account) {
    setOrgaoSelecionado(orgao);
    setModalAberto('excluir');
  }

  function fecharModal() {
    setModalAberto(null);
    setOrgaoSelecionado(null);
  }

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

  const handleSalvarEdicao = async () => {
    if (!orgaoSelecionado) return;

    try {
      const response = await fetch(`/api/accounts/${orgaoSelecionado.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadOrgaos();
        fecharModal();
      } else {
        console.error('Erro ao salvar edição');
      }
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
    }
  };

  const handleCongelarAtivar = async () => {
    if (!orgaoSelecionado) return;

    try {
      const novoStatus = orgaoSelecionado.status === 'active' ? 'inactive' : 'active';
      const response = await fetch(`/api/accounts/${orgaoSelecionado.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: novoStatus }),
      });

      if (response.ok) {
        await loadOrgaos();
        fecharModal();
      } else {
        console.error('Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleExcluirOrgao = async () => {
    if (!orgaoSelecionado) return;

    try {
      const response = await fetch(`/api/accounts/${orgaoSelecionado.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadOrgaos();
        fecharModal();
      } else {
        console.error('Erro ao excluir órgão');
      }
    } catch (error) {
      console.error('Erro ao excluir órgão:', error);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!orgaoSelecionado) return;

    try {
      const response = await fetch(`/api/accounts/${orgaoSelecionado.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadOrgaos();
        fecharModal();
      } else {
        console.error('Erro ao salvar edição');
      }
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
    }
  };

  const orgaosFiltrados = orgaos.filter(o => {
    const busca = filtro.toLowerCase();
    const matchNome =
      (o.razaoSocial ?? '').toLowerCase().includes(busca) ||
      (o.name ?? '').toLowerCase().includes(busca) ||
      o.cnpj.includes(filtro);
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
            {ESTADOS_BR.map(estado => (
              <option key={estado.uf} value={estado.uf}>
                {estado.nome}
              </option>
            ))}
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
                        {orgao.razaoSocial ?? orgao.name}
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
                        <div className="flex justify-end gap-2">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="sm" variant="secondary">
        Ações
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem asChild>
        <Link href={`/dashboard/admin/orgaos/${orgao.id}/onboarding`}>
          <span>Identidade</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={`/dashboard/admin/orgaos/${orgao.id}/usuarios`}>
          <span>Usuários</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => abrirModalEdicao(orgao)}>
        Editar
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => abrirModalCongelar(orgao)}>
        {orgao.status === 'active' ? 'Congelar' : 'Ativar'}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => abrirModalExcluir(orgao)} className="text-red-500">
        Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal de Edição */}
      <Dialog open={modalAberto === 'editar'} onOpenChange={(open) => !open && fecharModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Órgão</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Razão Social</Label>
              <Input
                id="razaoSocial"
                value={formData.razaoSocial}
                onChange={(e) => setFormData({...formData, razaoSocial: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsibleName">Responsável</Label>
              <Input
                id="responsibleName"
                value={formData.responsibleName}
                onChange={(e) => setFormData({...formData, responsibleName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsibleEmail">E-mail</Label>
              <Input
                id="responsibleEmail"
                type="email"
                value={formData.responsibleEmail}
                onChange={(e) => setFormData({...formData, responsibleEmail: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsiblePhone">Telefone</Label>
              <Input
                id="responsiblePhone"
                value={formData.responsiblePhone}
                onChange={(e) => setFormData({...formData, responsiblePhone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <select
                id="state"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
              >
                {ESTADOS_BR.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={handleSalvarEdicao}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Congelar/Ativar */}
      <Dialog open={modalAberto === 'congelar'} onOpenChange={(open) => !open && fecharModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{orgaoSelecionado?.status === 'active' ? 'Congelar Órgão' : 'Ativar Órgão'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Você está prestes a {orgaoSelecionado?.status === 'active' ? 'congelar' : 'ativar'} o órgão:</p>
            <p className="font-bold">{orgaoSelecionado?.name}</p>
            <p className="mt-2">Isso irá {orgaoSelecionado?.status === 'active' ? 'impedir' : 'permitir'} o envio de solicitações.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={handleCongelarAtivar}>
              {orgaoSelecionado?.status === 'active' ? 'Congelar' : 'Ativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <Dialog open={modalAberto === 'excluir'} onOpenChange={(open) => !open && fecharModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Órgão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Você está prestes a excluir o órgão:</p>
            <p className="font-bold">{orgaoSelecionado?.name}</p>
            <p className="mt-2 text-red-500">Esta ação não pode ser desfeita.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluirOrgao}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

    {/* Modal de Edição */}
    <Dialog open={modalAberto === 'editar'} onOpenChange={(open) => !open && fecharModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Órgão</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="razaoSocial">Razão Social</Label>
            <Input
              id="razaoSocial"
              value={formData.razaoSocial}
              onChange={(e) => setFormData({...formData, razaoSocial: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsibleName">Responsável</Label>
            <Input
              id="responsibleName"
              value={formData.responsibleName}
              onChange={(e) => setFormData({...formData, responsibleName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsibleEmail">E-mail</Label>
            <Input
              id="responsibleEmail"
              type="email"
              value={formData.responsibleEmail}
              onChange={(e) => setFormData({...formData, responsibleEmail: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsiblePhone">Telefone</Label>
            <Input
              id="responsiblePhone"
              value={formData.responsiblePhone}
              onChange={(e) => setFormData({...formData, responsiblePhone: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <select
              id="state"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.state}
              onChange={(e) => setFormData({...formData, state: e.target.value})}
            >
              {ESTADOS_BR.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
          <Button onClick={handleSalvarEdicao}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal de Exclusão */}
    <Dialog open={modalAberto === 'excluir'} onOpenChange={(open) => !open && fecharModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir Órgão</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Você está prestes a excluir o órgão:</p>
          <p className="font-bold">{orgaoSelecionado?.name}</p>
          <p className="mt-2 text-red-500">Esta ação não pode ser desfeita.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
          <Button variant="destructive" onClick={handleExcluirOrgao}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal de Edição */}
    <Dialog open={modalAberto === 'editar'} onOpenChange={(open) => !open && fecharModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Órgão</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="razaoSocial">Razão Social</Label>
            <Input
              id="razaoSocial"
              value={formData.razaoSocial}
              onChange={(e) => setFormData({...formData, razaoSocial: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsibleName">Responsável</Label>
            <Input
              id="responsibleName"
              value={formData.responsibleName}
              onChange={(e) => setFormData({...formData, responsibleName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsibleEmail">E-mail</Label>
            <Input
              id="responsibleEmail"
              type="email"
              value={formData.responsibleEmail}
              onChange={(e) => setFormData({...formData, responsibleEmail: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsiblePhone">Telefone</Label>
            <Input
              id="responsiblePhone"
              value={formData.responsiblePhone}
              onChange={(e) => setFormData({...formData, responsiblePhone: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <select
              id="state"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.state}
              onChange={(e) => setFormData({...formData, state: e.target.value})}
            >
              {ESTADOS_BR.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
          <Button onClick={handleSalvarEdicao}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
