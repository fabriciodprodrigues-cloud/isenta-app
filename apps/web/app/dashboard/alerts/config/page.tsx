import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AlertsConfigRedirect() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user?.role !== 'admin') {
    redirect('/dashboard/alerts');
  }

  redirect('/dashboard/alerts-config');
}
