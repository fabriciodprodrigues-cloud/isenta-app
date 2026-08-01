import Link from 'next/link';

export async function VehicleList() {
  return (
    <div className="rounded-lg border border-white/8 bg-ink-800 overflow-hidden">
      <div className="border-b border-white/8 px-6 py-4">
        <p className="text-slate">Nenhum veículo cadastrado</p>
      </div>
      <div className="px-6 py-8 text-center">
        <p className="mb-4 text-paper-dim">
          Comece cadastrando um veículo para sua frota
        </p>
        <Link
          href="/vehicles/new"
          className="inline-block rounded-lg bg-green px-6 py-2 font-medium text-ink-900 transition-colors hover:bg-green/90"
        >
          Cadastrar Veículo
        </Link>
      </div>
    </div>
  );
}
