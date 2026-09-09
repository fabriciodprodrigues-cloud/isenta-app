import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { recuperarDocumentosDeTodosOsOrgaos } from '@/lib/recuperacao-oficios';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Dispara a recuperação, melhor esforço, de ofícios enviados antes do arquivamento em Blob. Admin-only. */
export async function POST() {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const resumo = await recuperarDocumentosDeTodosOsOrgaos();
    return NextResponse.json({ success: true, ...resumo });
  } catch (error) {
    console.error('Erro ao recuperar ofícios:', error);
    return NextResponse.json({ error: 'Erro ao recuperar ofícios' }, { status: 500 });
  }
}
