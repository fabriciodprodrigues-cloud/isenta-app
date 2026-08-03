import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface ConcessionaireResponse {
  protocol: string; // registrationId
  status: 'approved' | 'rejected' | 'pending';
  message?: string;
  approvalDate?: string;
  rejectionReason?: string;
}

export async function POST(request: Request) {
  try {
    const body: ConcessionaireResponse = await request.json();

    console.log(`📨 Webhook recebido: ${body.protocol} - ${body.status}`);

    // Validar protocolo
    if (!body.protocol) {
      return NextResponse.json(
        { error: 'Protocolo é obrigatório' },
        { status: 400 }
      );
    }

    // Encontrar registração
    const registration = await prisma.concesssionaireRegistration.findUnique({
      where: { id: body.protocol },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar status baseado na resposta
    let newStatus = 'aguardando_resposta';
    let updateData: any = { protocol: body.protocol };

    if (body.status === 'approved') {
      newStatus = 'aprovado';
      updateData.approvedAt = new Date(body.approvalDate || new Date());
      console.log(`✅ Solicitação ${body.protocol} APROVADA`);
    } else if (body.status === 'rejected') {
      newStatus = 'recusado';
      updateData.rejectionReason = body.rejectionReason || 'Não especificado';
      console.log(`❌ Solicitação ${body.protocol} RECUSADA: ${updateData.rejectionReason}`);
    } else {
      console.log(`⏳ Solicitação ${body.protocol} em análise`);
    }

    // Atualizar registração
    const updated = await prisma.concesssionaireRegistration.update({
      where: { id: body.protocol },
      data: {
        status: newStatus,
        ...updateData,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Solicitação ${body.protocol} atualizada para ${newStatus}`,
      registration: updated,
    });
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}

// GET para health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook de respostas de concessionárias ativo',
  });
}
