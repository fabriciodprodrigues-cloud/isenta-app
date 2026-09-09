import { put } from '@vercel/blob';
import { prisma } from './prisma';
import { abrir, type CredencialSmtp } from './cofre';
import { extrairProtocolo } from './leitura-respostas';

/**
 * Recuperação, melhor esforço, de ofícios enviados antes de esta sessão
 * começar a arquivar no Blob (ver processRegistration em
 * registration-orchestrator.ts). Busca a cópia que a feature "cópia em
 * Enviados" gravou na caixa IMAP do próprio órgão -- só existe pra envios
 * feitos DEPOIS que essa feature foi ao ar, e só pra órgão com IMAP
 * configurado. Não é garantido achar nada; é normal não achar.
 */

export interface ResumoRecuperacao {
  orgaosVerificados: number;
  gruposTentados: number;
  recuperados: number;
  naoEncontrados: number;
  ambiguos: number;
  erros: string[];
}

interface MensagemEncontrada {
  uid: number;
  de: string;
  assunto: string;
  data: string | null;
  corpo: string | null;
}

async function buscarNaCaixaDoOrgao(
  credencial: CredencialSmtp,
  desde: Date,
  ate: Date
): Promise<{ pastaEncontrada: string | null; mensagens: MensagemEncontrada[] }> {
  const relayUrl = process.env.EMAIL_RELAY_URL;
  const relaySecret = process.env.EMAIL_RELAY_SECRET;
  if (!relayUrl || !relaySecret) {
    throw new Error('Relay de e-mail não configurado (EMAIL_RELAY_URL/EMAIL_RELAY_SECRET).');
  }

  const resposta = await fetch(`${relayUrl}/find-sent-messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': relaySecret },
    body: JSON.stringify({
      host: credencial.imapHost,
      port: credencial.imapPort,
      secure: credencial.imapSeguro,
      user: credencial.user,
      password: credencial.pass,
      desde: desde.toISOString(),
      ate: ate.toISOString(),
    }),
    // Mais curto que o timeout usado na leitura de respostas (45s): aquele
    // fluxo importa de verdade e vale esperar; este é melhor-esforço em
    // segundo plano, então falhar rápido é melhor UX (e essencial pra caber
    // dentro do maxDuration=60 da rota mesmo com mais de um órgão na fila --
    // ver o orçamento de tempo em recuperarDocumentosDeTodosOsOrgaos()).
    signal: AbortSignal.timeout(15_000),
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(corpo?.detalhe || corpo?.erro || `Relay respondeu HTTP ${resposta.status}`);
  }

  return resposta.json();
}

async function baixarMensagem(
  credencial: CredencialSmtp,
  pasta: string,
  uid: number
): Promise<{ anexos: Array<{ filename: string; contentBase64: string; contentType: string }>; corpoHtml?: string }> {
  const relayUrl = process.env.EMAIL_RELAY_URL;
  const relaySecret = process.env.EMAIL_RELAY_SECRET;
  if (!relayUrl || !relaySecret) {
    throw new Error('Relay de e-mail não configurado (EMAIL_RELAY_URL/EMAIL_RELAY_SECRET).');
  }

  const resposta = await fetch(`${relayUrl}/fetch-sent-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': relaySecret },
    body: JSON.stringify({
      host: credencial.imapHost,
      port: credencial.imapPort,
      secure: credencial.imapSeguro,
      user: credencial.user,
      password: credencial.pass,
      pasta,
      uid,
    }),
    // Mais curto que o timeout usado na leitura de respostas (45s): aquele
    // fluxo importa de verdade e vale esperar; este é melhor-esforço em
    // segundo plano, então falhar rápido é melhor UX (e essencial pra caber
    // dentro do maxDuration=60 da rota mesmo com mais de um órgão na fila --
    // ver o orçamento de tempo em recuperarDocumentosDeTodosOsOrgaos()).
    signal: AbortSignal.timeout(15_000),
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(corpo?.detalhe || corpo?.erro || `Relay respondeu HTTP ${resposta.status}`);
  }

  return resposta.json();
}

/** Verifica todos os órgãos com IMAP configurado, tentando recuperar documentos de solicitações já enviadas sem arquivo. */
export async function recuperarDocumentosDeTodosOsOrgaos(): Promise<ResumoRecuperacao> {
  const contas = await prisma.account.findMany({
    where: { emailCredencialCifrada: { not: null } },
    select: { id: true, name: true, emailCredencialCifrada: true },
  });

  const resumo: ResumoRecuperacao = {
    orgaosVerificados: 0,
    gruposTentados: 0,
    recuperados: 0,
    naoEncontrados: 0,
    ambiguos: 0,
    erros: [],
  };

  // Orçamento de tempo: a rota que chama isto tem maxDuration=60. Cada
  // tentativa de conexão já tem seu próprio timeout curto (15s), mas com
  // vários órgãos configurados a SOMA ainda podia estourar -- pára de
  // começar órgãos novos perto do limite, deixando os restantes pra próxima
  // vez que o admin clicar (não perde progresso, só não tenta tudo de uma vez).
  const inicio = Date.now();
  const ORCAMENTO_MS = 45_000;

  for (const conta of contas) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;

    let credencial: CredencialSmtp;
    try {
      credencial = abrir<CredencialSmtp>(conta.emailCredencialCifrada!);
    } catch {
      continue; // credencial ilegível -- não é erro deste órgão travar o lote
    }
    if (!credencial.imapHost) continue; // sem leitura configurada, nada a buscar

    resumo.orgaosVerificados++;

    // Pendentes: já enviadas (protocol/sentAt preenchidos), sem documento
    // arquivado, e nunca tentadas antes -- uma tentativa concluída (achou
    // ou não achou) não é repetida automaticamente.
    const pendentes = await prisma.concesssionaireRegistration.findMany({
      where: {
        vehicle: { accountId: conta.id },
        protocol: { not: null },
        sentAt: { not: null },
        documentoUrl: null,
        documentoRecuperacaoStatus: null,
      },
      select: { id: true, protocol: true, sentAt: true },
    });

    const grupos = new Map<string, { sentAt: Date; ids: string[] }>();
    for (const r of pendentes) {
      if (!r.protocol || !r.sentAt) continue;
      const existente = grupos.get(r.protocol);
      if (existente) existente.ids.push(r.id);
      else grupos.set(r.protocol, { sentAt: r.sentAt, ids: [r.id] });
    }

    for (const [protocolo, grupo] of grupos) {
      resumo.gruposTentados++;

      // A busca em si (conexão IMAP) é isolada do resto: uma falha aqui
      // quase certo significa que a mesma caixa vai falhar pra TODO grupo
      // seguinte deste órgão -- sem o break, um órgão com dezenas de
      // protocolos pendentes e a caixa fora do ar tentava a mesma conexão
      // quebrada uma vez por protocolo (até 45s cada), estourando os 60s de
      // limite da função na Vercel e derrubando a requisição inteira com
      // timeout ("Falha de conexão" genérico na tela, sem nenhum resumo).
      let resultadoBusca: { pastaEncontrada: string | null; mensagens: Awaited<ReturnType<typeof buscarNaCaixaDoOrgao>>['mensagens'] };
      try {
        const desde = new Date(grupo.sentAt.getTime() - 24 * 60 * 60 * 1000);
        const ate = new Date(grupo.sentAt.getTime() + 3 * 24 * 60 * 60 * 1000);
        resultadoBusca = await buscarNaCaixaDoOrgao(credencial, desde, ate);
      } catch (erro) {
        resumo.erros.push(
          `${conta.name}: ${erro instanceof Error ? erro.message : String(erro)}`
        );
        break; // não adianta tentar os próximos grupos deste mesmo órgão
      }

      try {
        const { pastaEncontrada, mensagens } = resultadoBusca;

        if (!pastaEncontrada) {
          await marcarTentativa(grupo.ids, 'nao_encontrado');
          resumo.naoEncontrados++;
          continue;
        }

        const compativeis = mensagens.filter(m => extrairProtocolo(`${m.assunto}\n${m.corpo ?? ''}`) === protocolo);

        if (compativeis.length === 0) {
          await marcarTentativa(grupo.ids, 'nao_encontrado');
          resumo.naoEncontrados++;
          continue;
        }
        if (compativeis.length > 1) {
          await marcarTentativa(grupo.ids, 'ambiguo');
          resumo.ambiguos++;
          continue;
        }

        const [encontrada] = compativeis;
        const { anexos, corpoHtml } = await baixarMensagem(credencial, pastaEncontrada, encontrada.uid);

        let documentoParaGravar: { url: string; tipo: string } | null = null;

        if (anexos.length > 0) {
          const [anexo] = anexos;
          const blob = await put(
            `oficios-recuperados/${conta.id}/${protocolo}-${anexo.filename}`,
            Buffer.from(anexo.contentBase64, 'base64'),
            { access: 'private', addRandomSuffix: true, contentType: anexo.contentType }
          );
          documentoParaGravar = { url: blob.pathname, tipo: anexo.contentType };
        } else if (corpoHtml) {
          const blob = await put(
            `oficios-recuperados/${conta.id}/${protocolo}.html`,
            Buffer.from(corpoHtml, 'utf8'),
            { access: 'private', addRandomSuffix: true, contentType: 'text/html' }
          );
          documentoParaGravar = { url: blob.pathname, tipo: 'text/html' };
        }

        if (!documentoParaGravar) {
          await marcarTentativa(grupo.ids, 'nao_encontrado');
          resumo.naoEncontrados++;
          continue;
        }

        await prisma.concesssionaireRegistration.updateMany({
          where: { id: { in: grupo.ids } },
          data: {
            documentoUrl: documentoParaGravar.url,
            documentoTipo: documentoParaGravar.tipo,
            documentoOrigem: 'recuperado_imap',
            documentoGeradoEm: new Date(),
            documentoRecuperacaoStatus: 'recuperado',
            documentoRecuperacaoTentadoEm: new Date(),
          },
        });
        resumo.recuperados++;
      } catch (erro) {
        // Falha depois da busca (baixar a mensagem, gravar no Blob) -- fica
        // elegível pra nova tentativa, nunca vira "não encontrado" por engano.
        resumo.erros.push(
          `${conta.name} (protocolo ${protocolo}): ${erro instanceof Error ? erro.message : String(erro)}`
        );
      }
    }
  }

  return resumo;
}

function marcarTentativa(ids: string[], status: 'nao_encontrado' | 'ambiguo') {
  return prisma.concesssionaireRegistration.updateMany({
    where: { id: { in: ids } },
    data: { documentoRecuperacaoStatus: status, documentoRecuperacaoTentadoEm: new Date() },
  });
}
