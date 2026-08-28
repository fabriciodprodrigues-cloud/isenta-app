import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { podeAcessarArtespCadastro } from '@/lib/artesp-acesso';
import { avaliarCompletudeArtesp } from '@/lib/artesp-documentos';
import { TIPOS_DOCUMENTO_ARTESP, NOME_DOCUMENTO_ARTESP } from '@/lib/artesp-dados';
import { abrir, type CredencialSmtp } from '@/lib/cofre';
import {
  enviarEmailComAnexos,
  RelayDeEmailNaoConfiguradoError,
  RelayDeEmailFalhouError,
  type AnexoDocumento,
} from '@/lib/email-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Endereço confirmado pelo usuário para protocolo por e-mail junto à
// SUROD/ARTESP (ver seção 11, pendência 2, da especificação do módulo --
// não havia canal automatizado antes disso ser confirmado).
const DESTINO_ARTESP = 'protocolo@artesp.sp.gov.br';

class RemetenteDoOrgaoAusenteArtespError extends Error {
  constructor(orgao: string) {
    super(
      `${orgao} não tem a credencial da caixa institucional configurada. ` +
        'Nenhuma solicitação sai em nome da Isenta.'
    );
    this.name = 'RemetenteDoOrgaoAusenteArtespError';
  }
}

function montarEmailArtesp(dados: {
  orgaoNome: string;
  cnpj: string;
  quantidadeVeiculos: number;
  responsavelNome: string | null;
  responsavelTelefone: string | null;
  responsavelEmail: string | null;
}) {
  const assunto = `Cadastro de frota para isenção de pedágio — Portaria ARTESP nº 56/2025 — ${dados.orgaoNome}`;

  const linhasDocumentos = TIPOS_DOCUMENTO_ARTESP.map(tipo => `- ${NOME_DOCUMENTO_ARTESP[tipo]}`).join('\n');
  const assinatura = [dados.responsavelNome, dados.orgaoNome].filter(Boolean).join('\n');

  const texto =
    `Prezados,\n\n` +
    `A ${dados.orgaoNome}, CNPJ ${dados.cnpj}, solicita o cadastro de sua frota para isenção de ` +
    `pagamento de tarifa de pedágio nas rodovias sob concessão fiscalizada pela ARTESP, nos termos ` +
    `da Portaria ARTESP nº 56, de 29 de maio de 2025.\n\n` +
    `Seguem em anexo:\n${linhasDocumentos}\n- CRLV e, quando aplicável, contrato de locação de cada veículo da frota\n\n` +
    `Frota: ${dados.quantidadeVeiculos} veículo(s).\n\n` +
    `Permanecemos à disposição para eventuais esclarecimentos.\n\n` +
    `Atenciosamente,\n${assinatura}` +
    (dados.responsavelTelefone || dados.responsavelEmail
      ? `\n${[dados.responsavelTelefone, dados.responsavelEmail].filter(Boolean).join(' · ')}`
      : '');

  const html = texto
    .split('\n\n')
    .map(paragrafo => `<p>${paragrafo.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return { assunto, texto, html };
}

/**
 * Disparo único: envia num só e-mail os 5 documentos ARTESP assinados
 * (ou o dossiê único, se foi essa a via usada) mais o CRLV/contrato de
 * cada veículo, diretamente para o canal de protocolo da ARTESP.
 *
 * Já marca o cadastro como "protocolado" -- decisão do usuário, que optou
 * por não depender de um número de protocolo separado nesse fluxo (ver
 * emailArtespEnviadoPara para saber que o envio aconteceu e quando).
 */
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
      veiculos: { include: { vehicle: { include: { documents: true } } } },
      documentos: true,
    },
  });

  if (!cadastro) {
    return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  }

  const completude = avaliarCompletudeArtesp({
    tipoEntidade: cadastro.tipoEntidade,
    veiculos: cadastro.veiculos,
    documentos: cadastro.documentos,
    temModeloOficio: Boolean(cadastro.account.modeloOficioUrl),
  });

  if (!completude.completa) {
    return NextResponse.json(
      { error: 'Cadastro incompleto — não é possível enviar ainda.', pendencias: completude.pendencias },
      { status: 428 }
    );
  }

  const orgao = cadastro.account;

  try {
    if (!orgao.emailCredencialCifrada) {
      throw new RemetenteDoOrgaoAusenteArtespError(orgao.name);
    }
    const remetente = abrir<CredencialSmtp>(orgao.emailCredencialCifrada);

    // Documentos assinados: se todos apontam pro mesmo arquivo (dossiê
    // único enviado via upload-dossie-assinado), anexa uma vez só.
    const caminhosAssinados = TIPOS_DOCUMENTO_ARTESP.map(tipo => {
      const doc = cadastro.documentos.find(d => d.tipo === tipo);
      return { tipo, url: doc?.urlAssinado ?? doc?.urlGerado ?? null };
    });
    const anexos: AnexoDocumento[] = [];
    const todosIguais =
      caminhosAssinados.every(d => d.url) &&
      new Set(caminhosAssinados.map(d => d.url)).size === 1;

    if (todosIguais) {
      anexos.push({ fileName: `Dossiê ARTESP - ${orgao.name}.pdf`, url: caminhosAssinados[0].url! });
    } else {
      for (const { tipo, url } of caminhosAssinados) {
        if (!url) continue;
        anexos.push({ fileName: `${NOME_DOCUMENTO_ARTESP[tipo]}.pdf`, url });
      }
    }

    // CRLV e contrato de locação de cada veículo da frota incluída.
    for (const av of cadastro.veiculos) {
      for (const doc of av.vehicle.documents) {
        if (doc.type !== 'crlv' && doc.type !== 'contract') continue;
        const rotulo = doc.type === 'crlv' ? 'CRLV' : 'Contrato';
        const extensao = doc.fileName.split('.').pop() ?? 'pdf';
        anexos.push({ fileName: `${rotulo} - ${av.vehicle.plate}.${extensao}`, url: doc.url });
      }
    }

    const { assunto, texto, html } = montarEmailArtesp({
      orgaoNome: orgao.razaoSocial || orgao.name,
      cnpj: orgao.cnpj,
      quantidadeVeiculos: cadastro.veiculos.length,
      responsavelNome: cadastro.responsavelFrotaNome ?? orgao.responsibleName,
      responsavelTelefone: cadastro.responsavelFrotaTelefone ?? orgao.responsiblePhone,
      responsavelEmail: cadastro.responsavelFrotaEmail ?? orgao.responsibleEmail,
    });

    await enviarEmailComAnexos({
      destino: DESTINO_ARTESP,
      remetente,
      remetenteNome: orgao.razaoSocial || orgao.name,
      replyTo: orgao.emailIsencao ?? orgao.responsibleEmail,
      assunto,
      texto,
      html,
      anexos,
    });

    const atualizado = await prisma.artespCadastro.update({
      where: { id: cadastro.id },
      data: {
        status: 'protocolado',
        protocoladoEm: new Date(),
        protocoladoPor: (session.user as any)?.email ?? null,
        emailArtespEnviadoPara: DESTINO_ARTESP,
      },
    });

    return NextResponse.json(atualizado);
  } catch (erro) {
    if (erro instanceof RemetenteDoOrgaoAusenteArtespError) {
      return NextResponse.json({ error: erro.message }, { status: 428 });
    }
    if (erro instanceof RelayDeEmailNaoConfiguradoError) {
      console.error('Envio ARTESP bloqueado: relay de e-mail ausente.', erro.message);
      return NextResponse.json(
        { error: 'O relay de e-mail ainda não está configurado no servidor.' },
        { status: 503 }
      );
    }
    if (erro instanceof RelayDeEmailFalhouError) {
      console.error('Envio ARTESP falhou no relay de e-mail:', erro.message);
      return NextResponse.json(
        { error: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' },
        { status: 502 }
      );
    }
    console.error('Erro ao enviar dossiê ARTESP:', erro);
    return NextResponse.json({ error: 'Erro ao enviar o dossiê' }, { status: 500 });
  }
}
