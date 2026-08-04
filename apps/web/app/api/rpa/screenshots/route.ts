import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();

    // Apenas admins podem ver screenshots
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const registrationId = searchParams.get('registrationId');

    const screenshotDir = path.join(
      process.cwd(),
      'public/rpa-screenshots'
    );

    if (!fs.existsSync(screenshotDir)) {
      return NextResponse.json({
        screenshots: [],
        message: 'Nenhum screenshot encontrado',
      });
    }

    let files = fs.readdirSync(screenshotDir);

    // Filtrar por registrationId se fornecido
    if (registrationId) {
      files = files.filter(f => f.startsWith(registrationId));
    }

    const screenshots = files.map(filename => ({
      filename,
      url: `/rpa-screenshots/${filename}`,
      timestamp: fs.statSync(path.join(screenshotDir, filename)).mtime,
    }));

    // Ordenar por timestamp
    screenshots.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return NextResponse.json({
      screenshots,
      total: screenshots.length,
    });
  } catch (error) {
    console.error('Erro ao listar screenshots:', error);
    return NextResponse.json(
      { error: 'Erro ao listar screenshots' },
      { status: 500 }
    );
  }
}
