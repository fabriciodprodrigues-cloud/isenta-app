import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespCadastro } from '@/lib/artesp-acesso';
import { carregarModeloOficio } from '@/lib/registration-orchestrator';
import { montarDocumentoDocx } from '@/lib/oficio-docx';
import { converterDocxParaPdf, ConversaoDocxFalhouError } from '@/lib/email-service';
import { montarCorpoArtespWordXml } from '@/lib/artesp-documentos';
import { TIPOS_DOCUMENTO_ARTESP, ABRANGENCIA_PADRAO, type DadosArtesp } from '@/lib/artesp-dados';

export const dynamic = 'force-dynamic';
// 5 conversões DOCX->PDF em paralelo; cada uma usa um perfil isolado do
// LibreOffice no relay da VPS (ver apps/email-service). Rodar em paralelo em
// vez de sequencial é o que mantém isso dentro do limite de 60s do Hobby.
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const permissao = await podeAcessarArtespCadastro(session.user as any, params.id);
  if (!permissao.ok) {
    return NextResponse.json({ error: permissao.erro }, { status: permissao.status });
  }

  const cadastro = await prisma.artespCadastro.findUnique({
    where: { id: params.id },
    include: {
      account: true,
      veiculos: {
        include: {
          vehicle: { include: { tags: { select: { serialNumber: true, operadora: true }, take: 1 } } },
        },
      },
    },
  });

  if (!cadastro) {
    return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  }

  if (cadastro.veiculos.length === 0) {
    return NextResponse.json({ error: 'Inclua os veículos antes de gerar os documentos' }, { status: 400 });
  }

  const orgao = cadastro.account;

  if (!orgao.modeloOficioUrl) {
    return NextResponse.json(
      {
        error:
          'Este órgão ainda não tem um modelo de ofício (papel timbrado em .docx) cadastrado. ' +
          'Faça o upload na tela de Identidade do órgão antes de gerar os documentos da ARTESP.',
      },
      { status: 428 }
    );
  }

  const modeloBuffer = await carregarModeloOficio(orgao.modeloOficioUrl);
  if (!modeloBuffer) {
    return NextResponse.json(
      { error: 'Não foi possível carregar o modelo de ofício do órgão.' },
      { status: 502 }
    );
  }

  const dados: DadosArtesp = {
    tipoEntidade: cadastro.tipoEntidade,
    abrangencia: cadastro.abrangencia ?? ABRANGENCIA_PADRAO[cadastro.tipoEntidade] ?? '',
    orgao: {
      name: orgao.name,
      razaoSocial: orgao.razaoSocial,
      cnpj: orgao.cnpj,
      address: orgao.address,
      bairro: orgao.bairro,
      numero: orgao.numero,
      city: orgao.city,
      state: orgao.state,
      cep: orgao.cep,
      responsibleName: orgao.responsibleName,
      responsibleEmail: orgao.responsibleEmail,
      responsiblePhone: orgao.responsiblePhone,
      emailIsencao: orgao.emailIsencao ?? orgao.responsibleEmail,
      responsibleRole: orgao.responsibleRole,
      cabecalhoTexto: orgao.cabecalhoTexto,
      cidadeEmissao: orgao.cidadeEmissao,
    },
    responsavelFrotaNome: cadastro.responsavelFrotaNome ?? orgao.responsibleName,
    responsavelFrotaTelefone: cadastro.responsavelFrotaTelefone ?? orgao.responsiblePhone,
    responsavelFrotaEmail: cadastro.responsavelFrotaEmail ?? orgao.responsibleEmail,
    veiculos: cadastro.veiculos.map(av => ({
      plate: av.vehicle.plate,
      renavam: av.vehicle.renavam,
      type: av.vehicle.type,
      category: av.vehicle.category,
      marca: av.vehicle.marca,
      modelo: av.vehicle.modelo,
      cor: av.vehicle.cor,
      anoFabricacao: av.vehicle.anoFabricacao,
      anoModelo: av.vehicle.anoModelo,
      registroPatrimonial: av.registroPatrimonial,
      prefixo: av.prefixo,
      tag: av.vehicle.tags[0]?.serialNumber ?? null,
      operadoraTag: av.vehicle.tags[0]?.operadora ?? null,
    })),
    dataEmissao: new Date(),
  };

  try {
    const resultados = await Promise.all(
      TIPOS_DOCUMENTO_ARTESP.map(async tipo => {
        const corpo = montarCorpoArtespWordXml(tipo, dados);
        const docx = await montarDocumentoDocx(corpo, modeloBuffer);
        const pdf = await converterDocxParaPdf(docx);
        const caminho = `artesp/${cadastro.accountId}/${cadastro.id}/${tipo}.pdf`;
        const blob = await put(caminho, pdf, {
          access: 'private',
          addRandomSuffix: true,
          contentType: 'application/pdf',
        });
        return { tipo, url: blob.pathname };
      })
    );

    await prisma.$transaction([
      ...resultados.map(r =>
        prisma.artespDocumento.upsert({
          where: { artespCadastroId_tipo: { artespCadastroId: cadastro.id, tipo: r.tipo } },
          update: { urlGerado: r.url, status: 'gerado', geradoEm: new Date(), urlAssinado: null, assinadoEm: null },
          create: { artespCadastroId: cadastro.id, tipo: r.tipo, urlGerado: r.url, status: 'gerado', geradoEm: new Date() },
        })
      ),
      prisma.artespCadastro.update({
        where: { id: cadastro.id },
        data: { status: 'documentos_gerados' },
      }),
    ]);

    const atualizado = await prisma.artespCadastro.findUnique({
      where: { id: cadastro.id },
      include: { documentos: true },
    });

    return NextResponse.json(atualizado);
  } catch (erro) {
    if (erro instanceof ConversaoDocxFalhouError) {
      console.error('Falha ao converter documento ARTESP para PDF:', erro.message);
      return NextResponse.json(
        { error: 'Falha ao converter um dos documentos para PDF. Tente novamente em instantes.' },
        { status: 502 }
      );
    }
    console.error('Erro ao gerar documentos ARTESP:', erro);
    return NextResponse.json({ error: 'Erro ao gerar documentos' }, { status: 500 });
  }
}
