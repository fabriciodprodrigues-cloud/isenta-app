import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processRegistration } from '@/lib/registration-orchestrator';
import { EmailNaoConfiguradoError } from '@/lib/email-service';
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
    const { registrationId } = body;

    if (!registrationId) {
      return NextResponse.json(
        { error: 'ID da solicitação é obrigatório' },
        { status: 400 }
      );
    }

    // Operador só envia solicitação da própria conta.
    const papel = (session.user as any)?.role;
    if (papel === 'operator') {
      const registro = await prisma.concesssionaireRegistration.findUnique({
        where: { id: registrationId },
        select: { vehicle: { select: { accountId: true } } },
      });

      if (!registro) {
        return NextResponse.json(
          { error: 'Solicitação não encontrada' },
          { status: 404 }
        );
      }

      if (registro.vehicle.accountId !== (session.user as any)?.accountId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    // Envio sincrono. Antes isto ia para uma fila Bull/Redis que nao existe em
    // producao — a solicitacao ficava em rascunho para sempre, sem erro
    // visivel. Para o canal de e-mail o envio e rapido o bastante para caber na
    // requisicao; portal e RPA continuam exigindo infraestrutura propria.
    const resultado = await processRegistration(registrationId);

    if (resultado.status === 'enviado') {
      return NextResponse.json({
        success: true,
        message:
          `Solicitação enviada para ${resultado.destino}` +
          (resultado.anexos > 0 ? ` com ${resultado.anexos} documento(s) anexado(s)` : ''),
        canal: resultado.canal,
      });
    }

    // 428: a requisição está correta, mas falta uma pré-condição do lado do
    // usuário — anexar o documento. Distinguir de 422 ajuda a interface a
    // orientar em vez de apenas informar falha.
    if (resultado.status === 'documento_faltando') {
      return NextResponse.json(
        { success: false, error: resultado.motivo },
        { status: 428 }
      );
    }

    if (resultado.status === 'nao_automatizavel') {
      return NextResponse.json(
        { success: false, error: resultado.motivo },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { success: false, error: resultado.motivo },
      { status: 409 }
    );
  } catch (error) {
    if (error instanceof EmailNaoConfiguradoError) {
      console.error('Envio bloqueado: SMTP ausente.', error.message);
      return NextResponse.json(
        {
          error:
            'O envio de e-mail ainda não está configurado no servidor. A solicitação continua pendente e pode ser reenviada depois.',
        },
        { status: 503 }
      );
    }

    console.error('Erro ao enviar solicitação:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar solicitação' },
      { status: 500 }
    );
  }
}
