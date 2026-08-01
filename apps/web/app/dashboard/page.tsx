import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { VehicleList } from '@/components/VehicleList';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-ink-900">
      <Header />
      <main className="mx-auto max-w-7xl px-8 py-16">
        <section className="mb-12">
          <h1 className="mb-2 font-display text-4xl font-bold leading-tight text-paper">
            Dashboard
          </h1>
          <p className="text-paper-dim">
            Gerencie a isenção de pedágio de sua frota
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-white/8 bg-ink-800 p-6">
            <div className="text-sm uppercase tracking-widest text-slate">
              Total de Veículos
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-paper">
              0
            </div>
          </div>
          <div className="rounded-lg border border-white/8 bg-ink-800 p-6">
            <div className="text-sm uppercase tracking-widest text-slate">
              Aprovados
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-green">
              0
            </div>
          </div>
          <div className="rounded-lg border border-white/8 bg-ink-800 p-6">
            <div className="text-sm uppercase tracking-widest text-slate">
              Aguardando
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-amber">
              0
            </div>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="mb-6 font-display text-2xl font-bold text-paper">
            Veículos
          </h2>
          <VehicleList />
        </section>
      </main>
    </div>
  );
}
