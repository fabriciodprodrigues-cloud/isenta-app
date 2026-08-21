import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parse_estados } from '@/lib/utils';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

const TIPOS_CANAL = [
  'EMAIL',
  'PORTAL_WEB',
  'PORTAL_MAIS_ATENDIMENTO',
  'MANUAL',
] as const;

const schema = z
  .object({
    // null = canal ainda não mapeado.
    tipoCanal: z.enum(TIPOS_CANAL).nullable(),
    canalIsentos: z.string().trim().max(500).nullable(),
    observacoes: z.string().trim().max(1000).nullable().optional(),
    ativoParaCadastro: z.boolean().optional(),
    // Texto digitado ("SP, RJ"); convertido pra array JSON antes de gravar
    // (parse_estados). undefined = campo não enviado, não mexe no valor
    // salvo; string vazia = limpa o campo.
    estados: z.string().trim().max(200).optional(),
  })
  .superRefine((dados, ctx) => {
    const destino = dados.canalIsentos?.trim();

    // O formato do destino tem de casar com o tipo de canal. Um e-mail gravado
    // como portal — ou o contrário — só falharia na hora do envio, quando a
    // solicitação já foi criada e o operador acha que saiu.
    if (dados.tipoCanal === 'EMAIL') {
      if (!destino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o e-mail de isentos para o canal de e-mail.',
          path: ['canalIsentos'],
        });
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${destino}" não é um e-mail válido.`,
          path: ['canalIsentos'],
        });
      }
    }

    if (
      dados.tipoCanal === 'PORTAL_WEB' ||
      dados.tipoCanal === 'PORTAL_MAIS_ATENDIMENTO'
    ) {
      if (!destino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o endereço do portal.',
          path: ['canalIsentos'],
        });
      } else if (!/^https?:\/\/.+\..+/.test(destino)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'O portal deve começar com http:// ou https://',
          path: ['canalIsentos'],
        });
      }
    }
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = schema.parse(await request.json());

    const existe = await prisma.concessionaire.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });

    if (!existe) {
      return NextResponse.json(
        { error: 'Concessionária não encontrada' },
        { status: 404 }
      );
    }

    const atualizada = await prisma.concessionaire.update({
      where: { id: params.id },
      data: {
        tipoCanal: dados.tipoCanal,
        canalIsentos: dados.canalIsentos?.trim() || null,
        ...(dados.observacoes !== undefined
          ? { observacoes: dados.observacoes || null }
          : {}),
        ...(dados.ativoParaCadastro !== undefined
          ? { ativoParaCadastro: dados.ativoParaCadastro }
          : {}),
        ...(dados.estados !== undefined
          ? { estados: parse_estados(dados.estados) }
          : {}),
      },
      select: {
        id: true,
        name: true,
        tipoCanal: true,
        canalIsentos: true,
        observacoes: true,
        ativoParaCadastro: true,
        estados: true,
      },
    });

    console.log(
      `Canal atualizado: ${atualizada.name} -> ${atualizada.tipoCanal ?? 'não mapeado'} (${atualizada.canalIsentos ?? '—'}) por ${(session.user as any).email}`
    );

    return NextResponse.json(atualizada);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Erro ao atualizar concessionária:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar concessionária' },
      { status: 500 }
    );
  }
}
