'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { ESTADOS_BR } from '@/lib/utils';

interface Account {
  id: string;
  name: string;
  razaoSocial: string | null;
  cnpj: string;
  city: string;
  state: string;
  operadores: number;
  veiculos: number;
  cadastrosAtivos: number;
  cadastrosPendentes: number;
  saude: string;
  status: string;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  address: string;
  cep: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
}

const emptyForm = {
  name: '',
  razaoSocial: '',
  cnpj: '',
  responsibleName: '',
  responsibleEmail: '',
  responsiblePhone: '',
  address: '',
  city: '',
  state: '',
  cep: '',
  numero: '',
  complemento: '',
  bairro: '',
};

export default function GestaoOrgaos() {
  const [orgaos, setOrgaos] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSaude, setFiltroSaude] = useState('');
  const [modalAberto, setModalAberto] = useState<null | 'editar' | 'congelar' | 'excluir'>(null);
  const [orgaoSelecionado, setOrgaoSelecionado] = useState<Account | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    void loadOrgaos();
  }, []);

  async function loadOrgaos() {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setOrgaos(data);
      }
    } catch (error) {
      console.error('Erro ao carregar órgãos:', error);
    } finally {
      setLoading(false);
    }
  }

  function abrirModalEdicao(orgao: Account) {
    setOrgaoSelecionado(orgao);
    setFormData({
      name: orgao.name,
      razaoSocial: orgao.razaoSocial ?? '',
      cnpj: orgao.cnpj,
      responsibleName: orgao.responsibleName ?? '',
      responsibleEmail: orgao.responsibleEmail ?? '',
      responsiblePhone: orgao.responsiblePhone ?? '',
      address: orgao.address ?? '',
      city: orgao.city ?? '',
      state: orgao.state ?? '',
      cep: orgao.cep ?? '',
      numero: orgao.numero ?? '',
      complemento: orgao.complemento ?? '',
      bairro: orgao.bairro ?? '',
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
    setFormData(emptyForm);
  }

  async function handleSalvarEdicao() {
    if (!orgaoSelecionado) return;

    const response = await fetch(`/api/accounts/${orgaoSelecionado.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      await loadOrgaos();
      fecharModal();
    }
  }

  async function handleCongelarAtivar() {
    if (!orgaoSelecionado) return;

    const novoStatus = orgaoSelecionado.status === 'active' ? 'inactive' : 'active';

    const response = await fetch(`/api/accounts/${orgaoSelecionado.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    });

    if (response.ok) {
      await loadOrgaos();
      fecharModal();
    }
  }

  async function handleExcluirOrgao() {
    if (!orgaoSelecionado) return;

    const response = await fetch(`/api/accounts/${orgaoSelecionado.id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      await loadOrgaos();
      fecharModal();
    }
  }

  const orgaosFiltrados = orgaos.filter((orgao) => {
    const busca = filtro.toLowerCase();
    const matchTexto =
      orgao.name.toLowerCase().includes(busca) ||
      (orgao.razaoSocial ?? '').toLowerCase().includes(busca) ||
      orgao.cnpj.includes(filtro);
    const matchEstado = !filtroEstado || orgao.state === filtroEstado;
    const matchSaude = !filtroSaude || orgao.saude === filtroSaude;
    return matchTexto && matchEstado && matchSaude;
  });

  if (loading) {
    return <div className="text-paper">Carregando órgãos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-paper">Gestão de Órgãos</h1>
          <p className="text-paper-dim text-sm mt-1">Gerenciar órgãos públicos cadastrados no sistema</p>
        </div>
        <Link href="/dashboard/admin/orgaos/novo">
          <Button>+ Novo Órgão</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="flex gap-3 items-center">
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="flex-1"
          />
          <Select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            options={ESTADOS_BR.map((estado) => ({ value: estado.uf, label: estado.nome }))}
          />
          <Select
            value={filtroSaude}
            onChange={(e) => setFiltroSaude(e.target.value)}
            options={[
              { value: 'verde', label: 'Saudável' },
              { value: 'amarelo', label: 'Atenção' },
              { value: 'vermelho', label: 'Crítico' },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">{orgaosFiltrados.length} Órgão{orgaosFiltrados.length !== 1 ? 's' : ''}</h2>
        </CardHeader>
        <CardBody>
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
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orgaosFiltrados.map((orgao) => (
                  <TableRow key={orgao.id}>
                    <TableCell className="font-medium">{orgao.razaoSocial ?? orgao.name}</TableCell>
                    <TableCell className="font-mono text-sm">{orgao.cnpj}</TableCell>
                    <TableCell>{orgao.state}</TableCell>
                    <TableCell className="text-center">{orgao.operadores}</TableCell>
                    <TableCell className="text-center">{orgao.veiculos}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-green-400">{orgao.cadastrosAtivos}</span>
                        <span className="text-paper-dim"> / </span>
                        <span className="text-amber-400">{orgao.cadastrosPendentes}</span>
                      </div>
                    </TableCell>
                    <TableCell>{orgao.saude}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/dashboard/admin/orgaos/${orgao.id}/onboarding`}>
                          <Button size="sm" variant="secondary">Identidade</Button>
                        </Link>
                        <Link href={`/dashboard/admin/orgaos/${orgao.id}/usuarios`}>
                          <Button size="sm" variant="secondary">Usuários</Button>
                        </Link>
                        <Button size="sm" variant="secondary" onClick={() => abrirModalEdicao(orgao)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => abrirModalCongelar(orgao)}>
                          {orgao.status === 'active' ? 'Congelar' : 'Ativar'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => abrirModalExcluir(orgao)}>
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardBody className="text-center py-6"><div className="text-3xl font-bold text-accent mb-2">{orgaos.length}</div><p className="text-paper-dim text-sm">Órgãos Cadastrados</p></CardBody></Card>
        <Card><CardBody className="text-center py-6"><div className="text-3xl font-bold text-green-400 mb-2">{orgaos.reduce((sum, o) => sum + o.cadastrosAtivos, 0)}</div><p className="text-paper-dim text-sm">Cadastros Ativos</p></CardBody></Card>
        <Card><CardBody className="text-center py-6"><div className="text-3xl font-bold text-amber-400 mb-2">{orgaos.reduce((sum, o) => sum + o.cadastrosPendentes, 0)}</div><p className="text-paper-dim text-sm">Cadastros Pendentes</p></CardBody></Card>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/admin"><Button variant="secondary">← Voltar</Button></Link>
        <Link href="/dashboard/admin/frota"><Button variant="secondary">→ Gestão de Frota</Button></Link>
      </div>

      {modalAberto === 'editar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-white/10 bg-ink-900 p-6 text-paper">
            <h3 className="text-xl font-semibold mb-4">Editar Órgão</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome" />
              <Input value={formData.razaoSocial} onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })} placeholder="Razão Social" />
              <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder="CNPJ" />
              <Input value={formData.responsibleName} onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })} placeholder="Responsável" />
              <Input value={formData.responsibleEmail} onChange={(e) => setFormData({ ...formData, responsibleEmail: e.target.value })} placeholder="E-mail" />
              <Input value={formData.responsiblePhone} onChange={(e) => setFormData({ ...formData, responsiblePhone: e.target.value })} placeholder="Telefone" />
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Endereço" />
              <Input value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} placeholder="Número" />
              <Input value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} placeholder="Complemento" />
              <Input value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} placeholder="Bairro" />
              <Input value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} placeholder="CEP" />
              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Cidade" />
              <Select value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} options={ESTADOS_BR.map((estado) => ({ value: estado.uf, label: estado.nome }))} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={fecharModal}>Cancelar</Button>
              <Button onClick={handleSalvarEdicao}>Salvar</Button>
            </div>
          </div>
        </div>
      )}

      {modalAberto === 'congelar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/10 bg-ink-900 p-6 text-paper">
            <h3 className="text-xl font-semibold mb-4">
              {orgaoSelecionado?.status === 'active' ? 'Congelar Órgão' : 'Ativar Órgão'}
            </h3>
            <p>
              Você está prestes a {orgaoSelecionado?.status === 'active' ? 'congelar' : 'ativar'} o órgão:
            </p>
            <p className="font-bold mt-2">{orgaoSelecionado?.name}</p>
            <p className="mt-2 text-paper-dim">
              Isso vai {orgaoSelecionado?.status === 'active' ? 'impedir' : 'permitir'} o envio de novas
              solicitações de isenção por este órgão.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={fecharModal}>Cancelar</Button>
              <Button onClick={handleCongelarAtivar}>
                {orgaoSelecionado?.status === 'active' ? 'Congelar' : 'Ativar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalAberto === 'excluir' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/10 bg-ink-900 p-6 text-paper">
            <h3 className="text-xl font-semibold mb-4">Excluir Órgão</h3>
            <p>Você está prestes a excluir o órgão:</p>
            <p className="font-bold mt-2">{orgaoSelecionado?.name}</p>
            <p className="mt-2 text-red-400">Esta ação não pode ser desfeita.</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={fecharModal}>Cancelar</Button>
              <Button variant="danger" onClick={handleExcluirOrgao}>Excluir</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
