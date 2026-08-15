import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  avaliarIdentidadeEnvio,
  METODOS_ACESSO_EMAIL,
  METODOS_ASSINATURA,
} from '@/lib/identidade-envio';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';

/**
 * Todos os campos são opcionais: o wizard salva um passo por vez, e exigir o
 * conjunto completo impediria salvar progresso parcial.
 */
const schema = z.object({
  emailIsencao: z.string().email('E-mail de isenção inválido').nullable().optional(),
  metodoAcessoEmail: z.enum(METODOS_ACESSO_EMAIL).nullable().optional(),
  timbreUrl: z.string().nullable().optional(),
  cabecalhoTexto: z.string().max(200).nullable().optional(),
  cidadeEmissao: z.string().max(120).nullable().optional(),
  metodoAssinatura: z.enum(METODOS_ASSINATURA).nullable().optional(),
  // responsibleName é obrigatório no schema: pode ser alterado, nunca apagado.
  responsibleName: z.string().min(3).optional(),
  responsibleRole: z.string().min(2).max(120).nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const orgao = await prisma.account.findUnique({
    where: { id: params.accountId },
    select: {
      id: true,
      name: true,
      razaoSocial: true,
      cnpj: true,
      address: true,
      numero: true,
      bairro: true,
      city: true,
      state: true,
      cep: true,
      telefone: true,
      email: true,
      responsibleName: true,
      responsibleEmail: true,
      responsiblePhone: true,
      responsibleRole: true,
      emailIsencao: true,
      metodoAcessoEmail: true,
      emailVerificado: true,
      // Só a presença importa aqui; o conteúdo cifrado nunca sai desta rota.
      emailCredencialCifrada: true,
      timbreUrl: true,
      cabecalhoTexto: true,
      cidadeEmissao: true,
      metodoAssinatura: true,
      proximoNumeroOficio: true,
      autorizacao: {
        select: {
          id: true,
          arquivoUrl: true,
          poderes: true,
          assinadoEm: true,
          validoAte: true,
          ativo: true,
        },
      },
    },
  });

  if (!orgao) {
    return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
  }

  // O texto cifrado alimenta a checagem mas não vai para o navegador: mesmo
  // cifrado, é material de segredo e não tem uso na tela — a situação da
  // credencial vem por /identidade/credencial, que devolve só o resumo.
  const { emailCredencialCifrada, ...orgaoParaCliente } = orgao;

  return NextResponse.json({
    orgao: {
      ...orgaoParaCliente,
      credencialConfigurada: Boolean(emailCredencialCifrada),
    },
    identidade: avaliarIdentidadeEnvio(orgao),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const session = await auth();

  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = schema.parse(await request.json());

    const atual = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, emailIsencao: true },
    });

    if (!atual) {
      return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
    }

    // Trocar o e-mail de isenção derruba a verificação: o endereço novo ainda
    // não provou nada. Sem isso, bastaria verificar um endereço qualquer e
    // depois apontar para outro.
    const trocouEmail =
      dados.emailIsencao !== undefined && dados.emailIsencao !== atual.emailIsencao;

    const atualizado = await prisma.account.update({
      where: { id: params.accountId },
      data: {
        ...dados,
        ...(trocouEmail
          ? { emailVerificado: false, emailVerifHash: null, emailVerifExpira: null }
          : {}),
      },
      select: {
        emailIsencao: true,
        metodoAcessoEmail: true,
        emailVerificado: true,
        emailCredencialCifrada: true,
        timbreUrl: true,
        cabecalhoTexto: true,
        cidadeEmissao: true,
        metodoAssinatura: true,
        responsibleName: true,
        responsibleRole: true,
        autorizacao: { select: { ativo: true, validoAte: true } },
      },
    });

    const { emailCredencialCifrada, ...orgaoParaCliente } = atualizado;

    return NextResponse.json({
      orgao: {
        ...orgaoParaCliente,
        credencialConfigurada: Boolean(emailCredencialCifrada),
      },
      identidade: avaliarIdentidadeEnvio(atualizado),
      avisoEmailReverificar: trocouEmail,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Erro ao salvar identidade do órgão:', error);
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  }
}
