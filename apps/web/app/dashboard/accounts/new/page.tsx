import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AccountForm } from '@/components/forms/AccountForm';

export default async function NewAccountPage() {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    redirect('/login');
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-paper">
          Nova Conta
        </h1>
        <p className="mt-1 text-paper-dim">
          Cadastre um novo órgão público
        </p>
      </div>
      <AccountForm />
    </div>
  );
}
