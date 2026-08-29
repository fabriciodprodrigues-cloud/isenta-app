import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processarItensDoLote } from '@/lib/registration-orchestrator';

export const dynamic = 'force-dynamic';
// Cria os itens do lote (rápido) e já processa o quanto couber no mesmo
// request -- mesmo motivo do maxDuration=60 de process-pending/route.ts.
export const maxDuration = 60;

// Status que significam "já tem um pedido em curso ou resolvido nessa
// concessionária" -- inclui o que o operador manda pelo botão manual
// (RequestExemptionModal), não só o que o disparo nacional já enviou. O
// disparo nacional lê esse status de verdade antes de criar item novo,
// pra nunca duplicar um pedido que o operador (ou um disparo anterior) já
// fez -- só 'rascunho' (nunca enviado) e 'recusado' (precisa de pedido
// novo) deixam a concessionária elegível pra um novo disparo.
const JA_EM_CURSO_OU_RESOLVIDO = new Set(['enviado', 'aguardando_resposta', 'aprovado']);

/**
 * Dispara a isenção nacional: cria um SolicitacaoIsencaoLote com um item
 * por concessionária ativa de canal EMAIL que ainda não está 100% coberta
 * pra frota atual do órgão, gera as ConcesssionaireRegistration que
 * faltarem (reaproveita processRegistration pra enviar -- nada de SMTP/docx
 * novo aqui), e processa o quanto couber no orçamento desta mesma
 * requisição. Admin-only -- o órgão nunca dispara (ver conceito seção 2).
 *
 * Exclui concessionárias com regulador='ARTESP': a ARTESP centraliza o
 * pedido de todas as concessionárias sob sua responsabilidade num único
 * e-mail (protocolo@artesp.sp.gov.br) -- tratá-las como itens EMAIL comuns
 * mandaria um e-mail redundante por concessionária pra ela. Essas usam o
 * módulo ARTESP dedicado (ver artesp-*.ts), não este disparo. Mesma
 * exclusão de lib/imunidade.ts, que faz o cálculo de cobertura.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const accountId = params.accountId;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
  }

  const [veiculos, concessionariasEmail] = await Promise.all([
    prisma.vehicle.findMany({ where: { accountId }, select: { id: true } }),
    prisma.concessionaire.findMany({
      where: { situacao: 'ATIVO', ativoParaCadastro: true, tipoCanal: 'EMAIL', regulador: { not: 'ARTESP' } },
      select: { id: true },
    }),
  ]);

  if (veiculos.length === 0) {
    return NextResponse.json({ error: 'Órgão não tem veículos cadastrados' }, { status: 400 });
  }
  if (concessionariasEmail.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma concessionária ativa com canal de e-mail configurado' },
      { status: 400 }
    );
  }

  const veiculoIds = veiculos.map(v => v.id);

  // Cobertura atual, buscada uma vez só (não uma query por concessionária).
  const registrationsExistentes = await prisma.concesssionaireRegistration.findMany({
    where: {
      vehicleId: { in: veiculoIds },
      concessionaireId: { in: concessionariasEmail.map(c => c.id) },
    },
    select: { vehicleId: true, concessionaireId: true, status: true },
  });

  const lote = await prisma.solicitacaoIsencaoLote.create({
    data: {
      accountId,
      disparadaPor: (session.user as any)?.email ?? 'desconhecido',
    },
  });

  let itensCriados = 0;
  let itensJaCobertos = 0;

  for (const concessionaria of concessionariasEmail) {
    // Toda a frota já tem pedido em curso ou resolvido nessa concessionária
    // -- inclusive o que o operador mandou pelo botão manual, sem passar
    // por nenhum lote. Pula: disparar de novo duplicaria o pedido.
    const jaEmCurso = veiculoIds.every(vid => {
      const status = registrationsExistentes.find(
        r => r.vehicleId === vid && r.concessionaireId === concessionaria.id
      )?.status;
      return status ? JA_EM_CURSO_OU_RESOLVIDO.has(status) : false;
    });
    if (jaEmCurso) {
      itensJaCobertos++;
      continue;
    }

    const item = await prisma.solicitacaoIsencaoItem.create({
      data: { loteId: lote.id, concessionariaId: concessionaria.id },
    });
    itensCriados++;

    await prisma.concesssionaireRegistration.createMany({
      data: veiculoIds.map(vehicleId => ({
        vehicleId,
        concessionaireId: concessionaria.id,
        loteItemId: item.id,
      })),
      skipDuplicates: true,
    });
  }

  if (itensCriados === 0) {
    // Nada pra fazer -- frota já coberta em tudo que o escopo do MVP alcança.
    return NextResponse.json({
      lote: await prisma.solicitacaoIsencaoLote.findUnique({
        where: { id: lote.id },
        include: { itens: { include: { concessionaria: { select: { name: true } } } } },
      }),
      resumoProcessamento: null,
      mensagem: `Frota já coberta em todas as ${itensJaCobertos} concessionárias com canal de e-mail.`,
    });
  }

  const resumoProcessamento = await processarItensDoLote(lote.id);

  const loteCompleto = await prisma.solicitacaoIsencaoLote.findUnique({
    where: { id: lote.id },
    include: {
      itens: {
        include: { concessionaria: { select: { name: true } } },
        orderBy: { concessionaria: { name: 'asc' } },
      },
    },
  });

  return NextResponse.json({ lote: loteCompleto, resumoProcessamento }, { status: 201 });
}
