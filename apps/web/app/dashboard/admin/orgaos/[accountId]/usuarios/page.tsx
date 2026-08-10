'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { format_date } from '@/lib/utils';

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  convitePendenteAte: string | null;
}

const ROTULO_PAPEL: Record<string, string> = {
  operator: 'Operador',
  viewer: 'Consulta',
  admin: 'Administrador',
};

export default function UsuariosDoOrgao() {
  const params = useParams();
  const accountId = String(params.accountId);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [orgao, setOrgao] = useState<string>('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState('operator');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      const [respUsuarios, respOrgao] = await Promise.all([
        fetch(`/api/accounts/${accountId}/users`),
        fetch(`/api/accounts/${accountId}`),
      ]);

      if (respUsuarios.ok) setUsuarios(await respUsuarios.json());
      else setErro('Não foi possível carregar os usuários.');

      if (respOrgao.ok) {
        const dados = await respOrgao.json();
        setOrgao(dados?.name ?? '');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setAviso('');
    setSalvando(true);

    try {
      const resposta = await fetch(`/api/accounts/${accountId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, email, role: papel }),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        setErro(corpo?.error ?? 'Não foi possível criar o usuário.');
        return;
      }

      setAviso(corpo?.aviso ?? corpo?.message ?? 'Usuário criado.');
      setNome('');
      setEmail('');
      await carregar();
    } catch {
      setErro('Falha de conexão ao criar o usuário.');
    } finally {
      setSalvando(false);
    }
  }

  async function reenviar(userId: string) {
    setErro('');
    setAviso('');

    const resposta = await fetch(`/api/accounts/${accountId}/users/${userId}`, {
      method: 'POST',
    });
    const corpo = await resposta.json().catch(() => null);

    if (resposta.ok) {
      setAviso(corpo?.message ?? 'Convite reenviado.');
      await carregar();
    } else {
      setErro(corpo?.error ?? 'Não foi possível reenviar o convite.');
    }
  }

  async function remover(userId: string, nomeUsuario: string) {
    if (!confirm(`Remover o acesso de ${nomeUsuario}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setErro('');
    setAviso('');

    const resposta = await fetch(`/api/accounts/${accountId}/users/${userId}`, {
      method: 'DELETE',
    });
    const corpo = await resposta.json().catch(() => null);

    if (resposta.ok) {
      setAviso('Usuário removido.');
      await carregar();
    } else {
      setErro(corpo?.error ?? 'Não foi possível remover o usuário.');
    }
  }

  if (carregando) {
    return <p className="text-paper-dim">Carregando usuários...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-paper">Usuários do Órgão</h1>
        <p className="mt-1 text-sm text-paper-dim">
          {orgao || 'Órgão'} — quem pode acessar o sistema por este órgão
        </p>
      </div>

      {erro && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      {aviso && (
        <div className="rounded border border-green/40 bg-green/10 p-3 text-sm text-paper">
          {aviso}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">Convidar usuário</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={criar} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm text-paper">Nome completo</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="ex: Maria Souza"
                  className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-paper">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="maria@orgao.gov.br"
                  className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-paper">Perfil</label>
                <select
                  value={papel}
                  onChange={e => setPapel(e.target.value)}
                  className="w-full rounded border border-white/10 bg-ink-700 px-3 py-2 text-paper"
                >
                  <option value="operator">Operador — cadastra e solicita</option>
                  <option value="viewer">Consulta — apenas visualiza</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate">
                A pessoa recebe um e-mail para definir a própria senha. Você não
                precisa criar nem enviar senha alguma.
              </p>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-paper">
            {usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}
          </h2>
        </CardHeader>
        <CardBody>
          {usuarios.length === 0 ? (
            <p className="py-8 text-center text-paper-dim">
              Nenhum usuário neste órgão ainda. Convide o primeiro acima.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>Perfil</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell>Desde</TableCell>
                    <TableCell>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usuarios.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm text-paper-dim">{u.email}</TableCell>
                      <TableCell className="text-sm">
                        {ROTULO_PAPEL[u.role] ?? u.role}
                      </TableCell>
                      <TableCell>
                        {u.convitePendenteAte ? (
                          <Badge variant="default" size="sm">
                            Aguardando definir senha
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-paper-dim">
                        {format_date(new Date(u.createdAt))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => reenviar(u.id)}
                            className="rounded px-2 py-1 text-sm text-green hover:bg-green/10"
                          >
                            Reenviar convite
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(u.id, u.name)}
                            className="rounded px-2 py-1 text-sm text-slate hover:bg-ink-700"
                          >
                            Remover
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <Link href="/dashboard/admin/orgaos">
        <Button variant="secondary">Voltar para Órgãos</Button>
      </Link>
    </div>
  );
}
