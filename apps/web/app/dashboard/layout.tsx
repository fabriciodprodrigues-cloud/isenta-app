import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <>
      <div className="min-h-screen bg-ink-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 px-8 py-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
