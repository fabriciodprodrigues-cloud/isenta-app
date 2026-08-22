import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { VehicleForm } from '@/components/forms/VehicleForm';

export default async function EditVehiclePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
  });

  if (!vehicle) {
    redirect('/dashboard/vehicles');
  }

  return (
    <div className="max-w-2xl">
      <VehicleForm
        accountId={vehicle.accountId}
        vehicle={{
          id: vehicle.id,
          plate: vehicle.plate,
          renavam: vehicle.renavam,
          type: vehicle.type,
          category: vehicle.category,
          status: vehicle.status,
          marca: vehicle.marca ?? undefined,
          modelo: vehicle.modelo ?? undefined,
          cor: vehicle.cor ?? undefined,
          anoFabricacao: vehicle.anoFabricacao ?? undefined,
          anoModelo: vehicle.anoModelo ?? undefined,
        }}
      />
    </div>
  );
}
