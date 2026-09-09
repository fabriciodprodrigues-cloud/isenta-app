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
  /** true quando ainda há protocolos pendentes que não couberam nesta execução -- clicar de novo continua de onde parou. */
  restamPendentes: boolean;
}

// Cada protocolo é uma conexão IMAP nova (connect+login+search+fetch+logout),
// alguns segundos cada -- mesma lição já aprendida no disparo nacional
// (commit "Reduzir lote de processamento..."): um órgão com dezenas de
// protocolos pendentes de uma vez estoura os 60s da rota mesmo com a caixa
// respondendo rápido. Processa só um lote por clique; o que já foi
// concluído (recuperado/não encontrado/ambíguo) fica marcado e não entra
// de novo -- clicar "Buscar" outra vez continua a partir do que sobrou.
const LIMITE_GRUPOS_POR_EXECUCAO = 5;

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
  const inicioTudo = Date.now();
  const log = (msg: string) => console.log(`[recuperacao-oficios +${Date.now() - inicioTudo}ms] ${msg}`);

  log('início');
  const contas = await prisma.account.findMany({
    where: { emailCredencialCifrada: { not: null } },
    select: { id: true, name: true, emailCredencialCifrada: true },
  });
  log(`contas com credencial: ${contas.length}`);

  const resumo: ResumoRecuperacao = {
    orgaosVerificados: 0,
    gruposTentados: 0,
    recuperados: 0,
    naoEncontrados: 0,
    ambiguos: 0,
    erros: [],
    restamPendentes: false,
  };

  // Orçamento de tempo -- rede de segurança além do limite de grupos acima.
  // Pior caso por grupo: até 15s de busca + 15s de download de mensagem
  // (os dois timeouts do relay) = ~30s. Parar de iniciar grupo novo em 20s
  // deixa margem pro pior caso do grupo em andamento ainda caber nos 60s
  // (maxDuration da rota), com folga pra Prisma/overhead.
  const inicio = Date.now();
  const ORCAMENTO_MS = 20_000;

  contas: for (const conta of contas) {
    if (resumo.gruposTentados >= LIMITE_GRUPOS_POR_EXECUCAO) {
      resumo.restamPendentes = true;
      break;
    }
    if (Date.now() - inicio > ORCAMENTO_MS) {
      resumo.restamPendentes = true;
      break;
    }

    let credencial: CredencialSmtp;
    try {
      credencial = abrir<CredencialSmtp>(conta.emailCredencialCifrada!);
    } catch {
      continue; // credencial ilegível -- não é erro deste órgão travar o lote
    }
    if (!credencial.imapHost) continue; // sem leitura configurada, nada a buscar

    resumo.orgaosVerificados++;
    log(`órgão ${conta.name}: IMAP configurado, buscando pendentes`);

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
    log(`órgão ${conta.name}: ${pendentes.length} solicitações pendentes de recuperação`);

    const grupos = new Map<string, { sentAt: Date; ids: string[] }>();
    for (const r of pendentes) {
      if (!r.protocol || !r.sentAt) continue;
      const existente = grupos.get(r.protocol);
      if (existente) existente.ids.push(r.id);
      else grupos.set(r.protocol, { sentAt: r.sentAt, ids: [r.id] });
    }
    log(`órgão ${conta.name}: ${grupos.size} protocolo(s) a tentar`);

    for (const [protocolo, grupo] of grupos) {
      if (resumo.gruposTentados >= LIMITE_GRUPOS_POR_EXECUCAO) {
        resumo.restamPendentes = true;
        break contas;
      }
      if (Date.now() - inicio > ORCAMENTO_MS) {
        resumo.restamPendentes = true;
        break contas;
      }

      resumo.gruposTentados++;
      log(`protocolo ${protocolo}: chamando /find-sent-messages`);

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
        log(`protocolo ${protocolo}: /find-sent-messages respondeu (pasta=${resultadoBusca.pastaEncontrada ?? 'nenhuma'})`);
      } catch (erro) {
        log(`protocolo ${protocolo}: /find-sent-messages falhou -- ${erro instanceof Error ? erro.message : String(erro)}`);
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

  log(`fim -- resumo: ${JSON.stringify(resumo)}`);

  return resumo;
}

function marcarTentativa(ids: string[], status: 'nao_encontrado' | 'ambiguo') {
  return prisma.concesssionaireRegistration.updateMany({
    where: { id: { in: ids } },
    data: { documentoRecuperacaoStatus: status, documentoRecuperacaoTentadoEm: new Date() },
  });
}
