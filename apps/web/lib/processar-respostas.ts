import { prisma } from './prisma';
import { abrir, type CredencialSmtp } from './cofre';
import { extrairProtocolo, classificarResposta } from './leitura-respostas';

/**
 * Lê e classifica respostas de concessionárias a ofícios já enviados.
 *
 * Nunca aplica status em ConcesssionaireRegistration sozinho — só grava em
 * EmailRespostaRecebida, pra revisão humana (ver confirmarResposta). O
 * mesmo princípio já usado na leitura de CRLV: extração automática é
 * palpite, não decisão.
 */

const TAMANHO_RESUMO_ARMAZENADO = 3000;

interface MensagemLida {
  uid: number;
  de: string;
  assunto: string;
  data: string | null;
  corpo: string | null;
}

export interface ResumoOrgao {
  emailsNovos: number;
  emailsComProtocolo: number;
  avisoUidValidityMudou?: boolean;
}

export interface ResumoProcessamentoRespostas {
  orgaosVerificados: number;
  emailsNovos: number;
  emailsComProtocolo: number;
  erros: string[];
}

interface ContaParaLeitura {
  id: string;
  name: string;
  emailCredencialCifrada: string | null;
  imapUltimoUidLido: number | null;
  imapUidValidity: bigint | null;
}

/** Verifica todos os órgãos que têm credencial de leitura IMAP configurada. */
export async function processarRespostasDeTodosOsOrgaos(): Promise<ResumoProcessamentoRespostas> {
  const contas = await prisma.account.findMany({
    where: { emailCredencialCifrada: { not: null } },
    select: {
      id: true,
      name: true,
      emailCredencialCifrada: true,
      imapUltimoUidLido: true,
      imapUidValidity: true,
    },
  });

  const resumo: ResumoProcessamentoRespostas = {
    orgaosVerificados: 0,
    emailsNovos: 0,
    emailsComProtocolo: 0,
    erros: [],
  };

  for (const conta of contas) {
    let credencial: CredencialSmtp;
    try {
      credencial = abrir<CredencialSmtp>(conta.emailCredencialCifrada!);
    } catch {
      continue; // credencial ilegível — não é erro deste órgão travar o lote
    }

    // Sem IMAP configurado (leituraConfigurada === false): pula sem tentar
    // conectar. Um órgão que só envia ofício por e-mail não precisa disso.
    if (!credencial.imapHost) continue;

    resumo.orgaosVerificados++;

    try {
      const parcial = await processarRespostasDoOrgao(conta, credencial);
      resumo.emailsNovos += parcial.emailsNovos;
      resumo.emailsComProtocolo += parcial.emailsComProtocolo;
    } catch (erro) {
      // Um órgão com IMAP fora do ar não pode travar a verificação dos demais.
      resumo.erros.push(
        `${conta.name}: ${erro instanceof Error ? erro.message : String(erro)}`
      );
    }
  }

  return resumo;
}

/** Verifica um único órgão — usado pelo laço acima e pelo botão manual por órgão. */
export async function processarRespostasDoOrgao(
  conta: ContaParaLeitura,
  credencial: CredencialSmtp
): Promise<ResumoOrgao> {
  const relayUrl = process.env.EMAIL_RELAY_URL;
  const relaySecret = process.env.EMAIL_RELAY_SECRET;
  if (!relayUrl || !relaySecret) {
    throw new Error('Relay de e-mail não configurado (EMAIL_RELAY_URL/EMAIL_RELAY_SECRET).');
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${relayUrl}/check-emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': relaySecret },
      body: JSON.stringify({
        host: credencial.imapHost,
        port: credencial.imapPort,
        secure: credencial.imapSeguro,
        user: credencial.user,
        password: credencial.pass,
        uidInicial: conta.imapUltimoUidLido ?? undefined,
        limite: 20,
      }),
      // 15s não bastava para uma conexão IMAP real (mesma lição do envio
      // por SMTP: a primeira conexão a um provedor institucional pode
      // demorar bem mais que o esperado). Cabe folgado no maxDuration de
      // 60s das rotas que chamam isto, mesmo com poucos órgãos configurados.
      signal: AbortSignal.timeout(45_000),
    });
  } catch (erro) {
    throw new Error(
      `Falha ao chamar o relay de e-mail: ${erro instanceof Error ? erro.message : String(erro)}`
    );
  }

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(corpo?.detalhe || corpo?.erro || `Relay respondeu HTTP ${resposta.status}`);
  }

  const dados = (await resposta.json()) as {
    mensagens: MensagemLida[];
    uidValidity: string;
    uidMaisAlto: number | null;
  };
  const uidValidityRecebido = BigInt(dados.uidValidity);

  // UIDVALIDITY mudou desde a última leitura: os UIDs que tínhamos podem já
  // não corresponder às mesmas mensagens. Descarta o resultado deste ciclo
  // e zera o cursor — a PRÓXIMA chamada recomeça do zero. Mais simples e
  // mais seguro que tentar decidir on-the-fly se o range ainda é confiável.
  if (
    conta.imapUltimoUidLido !== null &&
    conta.imapUidValidity !== null &&
    uidValidityRecebido !== conta.imapUidValidity
  ) {
    await prisma.account.update({
      where: { id: conta.id },
      data: { imapUltimoUidLido: null, imapUidValidity: uidValidityRecebido },
    });
    return { emailsNovos: 0, emailsComProtocolo: 0, avisoUidValidityMudou: true };
  }

  let emailsComProtocolo = 0;

  for (const msg of dados.mensagens) {
    const textoParaAnalise = `${msg.assunto}\n${msg.corpo ?? ''}`;
    const protocolo = extrairProtocolo(textoParaAnalise);
    const classificacao = classificarResposta(textoParaAnalise);
    if (protocolo) emailsComProtocolo++;

    const registrations = protocolo
      ? await prisma.concesssionaireRegistration.findMany({
          where: { protocol: protocolo },
          select: { id: true },
        })
      : [];

    await prisma.emailRespostaRecebida.upsert({
      where: { accountId_imapUid: { accountId: conta.id, imapUid: msg.uid } },
      create: {
        accountId: conta.id,
        imapUid: msg.uid,
        remetente: msg.de,
        assunto: msg.assunto,
        recebidoEm: msg.data ? new Date(msg.data) : null,
        corpoResumo: msg.corpo?.slice(0, TAMANHO_RESUMO_ARMAZENADO) ?? null,
        protocoloDetectado: protocolo,
        classificacaoDetectada: classificacao,
        registrationIds: registrations.map(r => r.id),
      },
      // Já existe (re-leitura do mesmo UID) — não sobrescreve uma decisão
      // humana que já tenha sido tomada sobre esta linha.
      update: {},
    });
  }

  await prisma.account.update({
    where: { id: conta.id },
    data: {
      imapUltimoUidLido: dados.uidMaisAlto ?? conta.imapUltimoUidLido,
      imapUidValidity: uidValidityRecebido,
    },
  });

  return { emailsNovos: dados.mensagens.length, emailsComProtocolo };
}

export class RespostaJaTratadaError extends Error {
  constructor() {
    super('Esta resposta já foi tratada.');
    this.name = 'RespostaJaTratadaError';
  }
}

/**
 * Confirma a leitura de um humano sobre uma resposta detectada — o único
 * caminho que de fato altera ConcesssionaireRegistration.status a partir de
 * uma leitura automática.
 *
 * updateMany (não update): o protocolo cobre o lote inteiro enviado junto
 * no mesmo ofício, e só avança quem ainda está enviado/aguardando resposta
 * — não pisa em status já decidido por outro caminho (ex.: o webhook
 * manual) enquanto esta confirmação estava pendente.
 */
export async function confirmarResposta(
  respostaId: string,
  decisao: 'aprovado' | 'recusado',
  confirmadoPor: string
): Promise<void> {
  const resposta = await prisma.emailRespostaRecebida.findUniqueOrThrow({
    where: { id: respostaId },
  });

  if (resposta.status !== 'pendente') {
    throw new RespostaJaTratadaError();
  }

  const dadosAtualizacao =
    decisao === 'aprovado'
      ? { status: 'aprovado', approvedAt: new Date() }
      : {
          status: 'recusado',
          rejectionReason: `Detectado por leitura automática de e-mail (${resposta.remetente})`,
        };

  await prisma.concesssionaireRegistration.updateMany({
    where: {
      id: { in: resposta.registrationIds },
      status: { in: ['enviado', 'aguardando_resposta'] },
    },
    data: dadosAtualizacao,
  });

  await prisma.emailRespostaRecebida.update({
    where: { id: respostaId },
    data: {
      status: 'confirmado',
      confirmadoComo: decisao,
      confirmadoPor,
      confirmadoEm: new Date(),
    },
  });
}

export async function ignorarResposta(respostaId: string, confirmadoPor: string): Promise<void> {
  const resposta = await prisma.emailRespostaRecebida.findUniqueOrThrow({
    where: { id: respostaId },
  });

  if (resposta.status !== 'pendente') {
    throw new RespostaJaTratadaError();
  }

  await prisma.emailRespostaRecebida.update({
    where: { id: respostaId },
    data: { status: 'ignorado', confirmadoPor, confirmadoEm: new Date() },
  });
}
