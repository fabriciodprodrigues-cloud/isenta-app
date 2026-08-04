import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { format_cnpj, format_date } from '@/lib/utils';

export default async function AccountsPage() {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    redirect('/login');
  }

  const accounts = await prisma.account.findMany({
    include: {
      _count: {
        select: { users: true, vehicles: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-paper">
            Contas
          </h1>
          <p className="mt-1 text-paper-dim">
            Gerencie os órgãos públicos cadastrados
          </p>
        </div>
        <Link href="/dashboard/accounts/new">
          <Button>+ Novo Órgão</Button>
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-white/8 bg-ink-800 p-12 text-center">
          <p className="text-paper-dim mb-4">Nenhuma conta cadastrada</p>
          <Link href="/dashboard/accounts/new">
            <Button variant="secondary">Criar primeira conta</Button>
          </Link>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header>Nome</TableCell>
              <TableCell header>CNPJ</TableCell>
              <TableCell header>Status</TableCell>
              <TableCell header align="center">Veículos</TableCell>
              <TableCell header align="center">Usuários</TableCell>
              <TableCell header>Criada em</TableCell>
              <TableCell header align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account: any) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-paper">{account.name}</p>
                    <p className="text-sm text-slate">
                      {account.responsibleName}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {format_cnpj(account.cnpj)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      account.status === 'active'
                        ? 'success'
                        : account.status === 'pending'
                          ? 'warning'
                          : 'default'
                    }
                  >
                    {account.status === 'active'
                      ? 'Ativa'
                      : account.status === 'pending'
                        ? 'Pendente'
                        : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell align="center" className="font-mono">
                  {account._count.vehicles}
                </TableCell>
                <TableCell align="center" className="font-mono">
                  {account._count.users}
                </TableCell>
                <TableCell className="text-sm text-slate">
                  {format_date(account.createdAt)}
                </TableCell>
                <TableCell align="right">
                  <div className="flex gap-2 justify-end">
                    <Link href={`/dashboard/accounts/${account.id}`}>
                      <button className="px-3 py-1 text-sm text-green hover:bg-green-dim/20 rounded transition-colors">
                        Editar
                      </button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
