import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { DadosDoOficio, OrgaoDoOficio, VeiculoDoOficio } from '@/lib/oficio-isencao';
import { gerarOficioGenerico } from '@/lib/oficio-generico';
import { gerarDeclaracaoTag } from '@/lib/declaracao-tag';
import { gerarDocumentoConcessionaria } from '@/lib/modelo-documento';
import { carregarModeloOficio } from '@/lib/oficio-docx';

// Usa auth() (le cookies/headers), portanto nunca pode ser pre-renderizada.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  accountId: z.string().min(1),
  tipo: z.enum(['GENERICO', 'DECLARACAO_TAG', 'CONCESSIONARIA']),
  concessionariaId: z.string().optional(),
  veiculoIds: z.array(z.string()).min(1, 'Selecione ao menos um veículo'),
});

/**
 * Gerador avulso de documentos (seção 8-A da especificação): mesmos
 * geradores do envio real, mas sem enviar nada nem gravar status --
 * geração pura, pra conferência/download.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const dados = schema.parse(await request.json());
    const papel = (session.user as any)?.role;

    // Mesma regra de api/registrations/route.ts: operador só gera pro
    // próprio órgão, admin gera pra qualquer um.
    if (papel === 'operator' && dados.accountId !== (session.user as any)?.accountId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const conta = await prisma.account.findUnique({ where: { id: dados.accountId } });
    if (!conta) {
      return NextResponse.json({ error: 'Órgão não encontrado' }, { status: 404 });
    }

    const veiculosDb = await prisma.vehicle.findMany({
      where: { accountId: dados.accountId, id: { in: dados.veiculoIds } },
      include: { tags: { select: { serialNumber: true, operadora: true } } },
    });
    if (veiculosDb.length === 0) {
      return NextResponse.json({ error: 'Nenhum veículo válido selecionado' }, { status: 400 });
    }

    const orgao: OrgaoDoOficio = {
      name: conta.name,
      razaoSocial: conta.razaoSocial,
      cnpj: conta.cnpj,
      address: conta.address,
      bairro: conta.bairro,
      numero: conta.numero,
      city: conta.city,
      state: conta.state,
      cep: conta.cep,
      responsibleName: conta.responsibleName,
      responsibleEmail: conta.responsibleEmail,
      responsiblePhone: conta.responsiblePhone,
      emailIsencao: conta.emailIsencao ?? conta.responsibleEmail,
      responsibleRole: conta.responsibleRole,
      cabecalhoTexto: conta.cabecalhoTexto,
      cidadeEmissao: conta.cidadeEmissao,
    };

    const protocolo = 'AVULSO';
    const numeroOficio = `AVULSO/${new Date().getFullYear()}`;

    if (dados.tipo === 'DECLARACAO_TAG') {
      // Mesmo pré-requisito do envio real: sem TAG vinculada, não se
      // declara instalação de TAG inexistente.
      const semTag = veiculosDb.filter(v => !v.tags[0]?.serialNumber);
      if (semTag.length > 0) {
        return NextResponse.json(
          { error: `Vincule uma TAG antes de gerar: ${semTag.map(v => v.plate).join(', ')}` },
          { status: 428 }
        );
      }

      const documento = await gerarDeclaracaoTag(
        orgao,
        veiculosDb.map(v => ({
          plate: v.plate,
          renavam: v.renavam,
          marca: v.marca,
          modelo: v.modelo,
          tag: v.tags[0]!.serialNumber,
          tagOperadora: v.tags[0]!.operadora,
        })),
        protocolo,
        conta.timbreUrl
      );
      return devolverArquivo(documento.buffer, documento.fileName, documento.mimeType);
    }

    const veiculos: VeiculoDoOficio[] = veiculosDb.map(v => ({
      plate: v.plate,
      renavam: v.renavam,
      type: v.type,
      category: v.category,
      marca: v.marca,
      modelo: v.modelo,
      cor: v.cor,
      anoFabricacao: v.anoFabricacao,
      anoModelo: v.anoModelo,
      tag: v.tags[0]?.serialNumber ?? null,
    }));

    if (dados.tipo === 'CONCESSIONARIA') {
      if (!dados.concessionariaId) {
        return NextResponse.json({ error: 'Escolha a concessionária' }, { status: 400 });
      }

      const concessionaria = await prisma.concessionaire.findUnique({
        where: { id: dados.concessionariaId },
        select: {
          name: true,
          modeloDocumento: {
            where: { ativo: true },
            select: { tipo: true, arquivoUrl: true, mapeamentoCampos: true, formatoSaida: true },
          },
        },
      });

      if (!concessionaria?.modeloDocumento?.arquivoUrl) {
        return NextResponse.json(
          { error: 'Esta concessionária não tem um modelo específico ativo' },
          { status: 404 }
        );
      }

      const arquivoBuffer = await carregarModeloOficio(concessionaria.modeloDocumento.arquivoUrl);
      if (!arquivoBuffer) {
        return NextResponse.json({ error: 'Modelo da concessionária indisponível' }, { status: 502 });
      }

      const documento = await gerarDocumentoConcessionaria(
        {
          orgao,
          concessionariaNome: concessionaria.name,
          numeroOficio,
          protocolo,
          veiculos,
          dataAtual: new Date(),
        },
        { ...concessionaria.modeloDocumento, arquivoBuffer }
      );
      return devolverArquivo(documento.buffer, documento.fileName, documento.mimeType);
    }

    // GENERICO
    const dadosDoOficio: DadosDoOficio = {
      numeroOficio,
      protocolo,
      concessionariaNome: 'Avulso',
      veiculos,
      anexos: [],
      orgao,
    };
    const oficio = await gerarOficioGenerico(dadosDoOficio, conta.modeloOficioUrl, numeroOficio, orgao.name);

    if (oficio.kind === 'pdf') {
      return devolverArquivo(oficio.buffer, oficio.fileName, 'application/pdf');
    }
    return devolverArquivo(
      Buffer.from(oficio.html, 'utf8'),
      `Oficio - ${orgao.name}.html`,
      'text/html'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Erro ao gerar documento avulso:', error);
    return NextResponse.json({ error: 'Erro ao gerar documento' }, { status: 500 });
  }
}

function devolverArquivo(buffer: Buffer, fileName: string, mimeType: string): NextResponse {
  return new NextResponse(Uint8Array.from(buffer), {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
