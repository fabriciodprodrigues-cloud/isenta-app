import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Le headers para autenticar, entao nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const resposta_schema = z.object({
  // Nosso identificador, enviado a concessionaria como "Protocolo de
  // Referencia" no corpo do e-mail.
  registrationId: z.string().min(1, 'registrationId é obrigatório'),

  status: z.enum(['approved', 'rejected', 'pending']),

  // Numero de protocolo gerado pela concessionaria (ex.: ECO050-2024-001).
  // A versao anterior gravava o nosso proprio id nesta coluna, sobrescrevendo
  // justamente o dado que a tela exibe como "Protocolo".
  concessionaireProtocol: z.string().min(1).optional(),

  approvalDate: z.string().datetime().optional(),
  rejectionReason: z.string().min(1).optional(),
});

const STATUS_INTERNO = {
  approved: 'aprovado',
  rejected: 'recusado',
  pending: 'aguardando_resposta',
} as const;

export async function POST(request: NextRequest) {
  // Esta rota altera o status de aprovacao de solicitacoes. Sem segredo
  // configurado ela fica fechada — antes nao havia autenticacao alguma, e como
  // o identificador vai impresso em todo e-mail enviado as concessionarias,
  // qualquer destinatario podia marcar qualquer solicitacao como aprovada.
  const segredo = process.env.WEBHOOK_SECRET;

  if (!segredo) {
    console.error('WEBHOOK_SECRET não configurado: webhook desativado.');
    return NextResponse.json(
      { error: 'Webhook não configurado no servidor' },
      { status: 503 }
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = resposta_schema.parse(await request.json());

    const registro = await prisma.concesssionaireRegistration.findUnique({
      where: { id: dados.registrationId },
      select: { id: true, status: true },
    });

    if (!registro) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }

    const novoStatus = STATUS_INTERNO[dados.status];

    const atualizacao: {
      status: string;
      protocol?: string;
      approvedAt?: Date;
      rejectionReason?: string;
    } = { status: novoStatus };

    if (dados.concessionaireProtocol) {
      atualizacao.protocol = dados.concessionaireProtocol;
    }

    if (dados.status === 'approved') {
      atualizacao.approvedAt = dados.approvalDate
        ? new Date(dados.approvalDate)
        : new Date();
    }

    if (dados.status === 'rejected') {
      atualizacao.rejectionReason = dados.rejectionReason ?? 'Não especificado';
    }

    const atualizado = await prisma.concesssionaireRegistration.update({
      where: { id: dados.registrationId },
      data: atualizacao,
      include: {
        vehicle: { select: { plate: true } },
        concessionaire: { select: { name: true } },
      },
    });

    console.log(
      `Resposta registrada: ${atualizado.vehicle.plate} em ${atualizado.concessionaire.name} -> ${novoStatus}`
    );

    return NextResponse.json({
      success: true,
      message: `Solicitação atualizada para ${novoStatus}`,
      registration: {
        id: atualizado.id,
        status: atualizado.status,
        protocol: atualizado.protocol,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Erro ao processar webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}

/** Health check. Não revela dado algum e por isso dispensa autenticação. */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    configurado: Boolean(process.env.WEBHOOK_SECRET),
  });
}
