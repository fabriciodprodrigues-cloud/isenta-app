const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { chromium } = require('playwright');
const { put } = require('@vercel/blob');
const { PrismaClient } = require('@prisma/client');

const { abrir } = require('./cofre');
const motiva = require('./motiva');

/**
 * Robô de cadastro em portais de concessionária.
 *
 * Roda fora da Vercel porque precisa de um navegador de verdade — funções
 * serverless não sustentam isso. Conversa com o mesmo banco Neon da aplicação,
 * então não há fila nem serviço intermediário: o worker consulta as
 * solicitações pendentes direto e escreve o resultado de volta.
 *
 * Uso:
 *   node src/index.js            processa continuamente
 *   node src/index.js --uma-vez  processa uma rodada e sai
 */

const prisma = new PrismaClient();

const INTERVALO_MS = Number(process.env.RPA_INTERVALO_MS ?? 5 * 60_000);
const MAX_TENTATIVAS = Number(process.env.RPA_MAX_TENTATIVAS ?? 3);
const LOTE = Number(process.env.RPA_LOTE ?? 10);
const MODO_VISIVEL = process.env.RPA_VISIVEL === 'true';
// Só pra rodar local em Windows sem o Chromium que o Playwright baixa
// (encontrado um problema de resolução de manifesto SxS específico da
// máquina) — usa o Edge do sistema em vez disso. Produção (Linux, Railway)
// não define isto e continua usando o Chromium normal do Playwright.
const CANAL_NAVEGADOR = process.env.RPA_BROWSER_CHANNEL || undefined;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

/**
 * Solicitações que o robô deve tentar.
 *
 * Só entram as de portal Motiva cujo órgão já tem credencial do portal e cujo
 * veículo tem CRLV anexado — sem qualquer um dos dois a tentativa falharia de
 * saída, e falha registrada polui o histórico sem informar nada novo.
 */
async function buscarPendentes() {
  return prisma.concesssionaireRegistration.findMany({
    where: {
      status: 'rascunho',
      rpaTentativas: { lt: MAX_TENTATIVAS },
      rpaAguardando: null,
      concessionaire: {
        // CCR renomeou pra Motiva; o domínio do portal mudou junto (ver
        // "Motiva Paraná (ex-PRVias)" no seed, motiva.js::URL_PORTAL).
        canalIsentos: { contains: 'isentos.motivapagamentos.com.br' },
      },
      vehicle: {
        documents: { some: { type: 'crlv' } },
        account: { portais: { some: { portal: 'CCR_MOTIVA' } } },
      },
    },
    take: LOTE,
    orderBy: { createdAt: 'asc' },
    include: {
      concessionaire: { select: { name: true } },
      vehicle: {
        include: {
          account: { include: { portais: { where: { portal: 'CCR_MOTIVA' } } } },
          documents: { where: { type: 'crlv' }, take: 1 },
          tags: { select: { id: true }, take: 1 },
        },
      },
    },
  });
}

async function enviarCaptura(page, registrationId, etapa) {
  try {
    const imagem = await page.screenshot({ fullPage: false });
    const blob = await put(
      `rpa/${registrationId}/${etapa}.png`,
      imagem,
      { access: 'private', addRandomSuffix: true, contentType: 'image/png' }
    );
    return blob.pathname;
  } catch (erro) {
    // Falhar a captura não pode derrubar a execução: ela é evidência, não o
    // trabalho em si.
    log('  aviso: não foi possível guardar a captura', etapa, erro.message);
    return null;
  }
}

async function processar(registro, navegador) {
  const { vehicle: veiculo, concessionaire: concessionaria } = registro;
  const orgao = veiculo.account;
  const credencialPortal = orgao.portais[0];

  log(`> ${veiculo.plate} → ${concessionaria.name}`);

  const rotulo = motiva.rotuloDaConcessionaria(concessionaria.name);
  const senha = abrir(credencialPortal.senhaCifrada);

  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
  });
  const page = await contexto.newPage();

  const capturas = [];
  const capturar = async etapa => {
    const caminho = await enviarCaptura(page, registro.id, etapa);
    if (caminho) capturas.push(caminho);
  };

  const pastaTemp = await fs.mkdtemp(path.join(os.tmpdir(), 'isenta-rpa-'));
  const arquivoCrlv = path.join(pastaTemp, 'crlv.pdf');

  try {
    await motiva.baixarDocumento(veiculo.documents[0].url, arquivoCrlv, fs);

    await motiva.entrar(page, {
      usuario: credencialPortal.usuario,
      senha,
    });

    await motiva.criarSolicitacao(page, {
      concessionariaRotulo: rotulo,
      veiculo,
      orgao,
      // Decisão do produto: responde SIM quando o veículo tem TAG cadastrada
      // no Isenta.
      temTagNoSistema: veiculo.tags.length > 0,
      arquivoCrlv,
    });

    await prisma.concesssionaireRegistration.update({
      where: { id: registro.id },
      data: {
        status: 'enviado',
        sentAt: new Date(),
        rpaTentativas: { increment: 1 },
        rpaExecutadoEm: new Date(),
        rpaUltimoErro: null,
        rpaCapturas: capturas,
      },
    });

    log(`  enviado (${capturas.length} capturas)`);
    return 'enviado';
  } catch (erro) {
    await capturar('99-erro');

    const tentativas = registro.rpaTentativas + 1;
    const desistiu = tentativas >= MAX_TENTATIVAS;

    await prisma.concesssionaireRegistration.update({
      where: { id: registro.id },
      data: {
        rpaTentativas: tentativas,
        rpaExecutadoEm: new Date(),
        rpaUltimoErro: erro.message?.slice(0, 500) ?? String(erro),
        rpaCapturas: capturas,
        // Esgotadas as tentativas, para de tentar e pede olhar humano. Repetir
        // contra um portal que mudou só consome tempo e arrisca a conta.
        rpaAguardando: desistiu
          ? 'Robô não concluiu após várias tentativas. Verifique as capturas e conclua manualmente.'
          : erro.precisaDecisao
            ? erro.message
            : null,
      },
    });

    log(`  falhou (tentativa ${tentativas}/${MAX_TENTATIVAS}): ${erro.message}`);
    return 'falhou';
  } finally {
    await contexto.close().catch(() => {});
    await fs.rm(pastaTemp, { recursive: true, force: true }).catch(() => {});
  }
}

async function rodada() {
  const pendentes = await buscarPendentes();

  if (pendentes.length === 0) {
    log('nada pendente');
    return { enviados: 0, falhas: 0 };
  }

  log(`${pendentes.length} solicitação(ões) para processar`);

  const navegador = await chromium.launch({
    headless: !MODO_VISIVEL,
    channel: CANAL_NAVEGADOR,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let enviados = 0;
  let falhas = 0;

  try {
    for (const registro of pendentes) {
      const resultado = await processar(registro, navegador);
      if (resultado === 'enviado') enviados++;
      else falhas++;

      // Intervalo entre solicitações: uma sequência sem pausa contra o mesmo
      // portal é o padrão que mais chama atenção de proteção anti-abuso.
      await new Promise(r => setTimeout(r, 4_000));
    }
  } finally {
    await navegador.close().catch(() => {});
  }

  log(`rodada concluída: ${enviados} enviada(s), ${falhas} com falha`);
  return { enviados, falhas };
}

async function main() {
  const umaVez = process.argv.includes('--uma-vez');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente.');
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY ausente: sem ela não é possível ler as credenciais.');
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN ausente: documentos e capturas não funcionam.');
    process.exit(1);
  }

  log(`robô iniciado (${umaVez ? 'uma rodada' : `a cada ${INTERVALO_MS / 1000}s`})`);

  if (umaVez) {
    await rodada();
    await prisma.$disconnect();
    return;
  }

  let parando = false;
  process.on('SIGTERM', () => {
    log('encerrando após a rodada atual...');
    parando = true;
  });

  while (!parando) {
    try {
      await rodada();
    } catch (erro) {
      // Uma rodada com erro não pode derrubar o processo: o worker precisa
      // sobreviver a instabilidade de rede ou banco.
      log('erro na rodada:', erro.message);
    }

    if (parando) break;
    await new Promise(r => setTimeout(r, INTERVALO_MS));
  }

  await prisma.$disconnect();
  log('encerrado');
}

main().catch(async erro => {
  console.error('falha fatal:', erro);
  await prisma.$disconnect();
  process.exit(1);
});
