import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AccountForm } from '@/components/forms/AccountForm';

export default async function EditAccountPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    redirect('/login');
  }

  const account = await prisma.account.findUnique({
    where: { id: params.id },
  });

  if (!account) {
    redirect('/dashboard/accounts');
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-paper">
          Editar Conta
        </h1>
        <p className="mt-1 text-paper-dim">{account.name}</p>
      </div>
      <AccountForm account={account as any} />
    </div>
  );
}
