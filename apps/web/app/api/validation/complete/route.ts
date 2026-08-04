import { auth } from '@/lib/auth';
import { validateVehicleForConcessionaire, translateFieldNames } from '@/lib/validation-service';
import { NextResponse } from 'next/server';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { vehicleId, concessionaireId } = body;

    if (!vehicleId || !concessionaireId) {
      return NextResponse.json(
        { error: 'vehicleId e concessionaireId são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await validateVehicleForConcessionaire(
      vehicleId,
      concessionaireId
    );

    // Traduzir nomes de campos para português
    const translatedFields = translateFieldNames(result.missingFields);

    return NextResponse.json({
      isComplete: result.isComplete,
      missingFields: result.missingFields,
      missingFieldsTranslated: translatedFields,
      message: result.message,
    });
  } catch (error) {
    console.error('Erro ao validar veículo:', error);
    return NextResponse.json(
      { error: 'Erro ao validar veículo' },
      { status: 500 }
    );
  }
}
