/**
 * Aplica o levantamento de canais de isencao as concessionarias do banco.
 *
 * Regras seguidas:
 *
 * - So grava canal quando a fonte e explicita. Entradas marcadas "a confirmar"
 *   ou "NAO ENCONTRADO" ficam sem canal, com o motivo em observacoes: campo
 *   vazio sinaliza tratativa manual, enquanto um endereco errado produz
 *   solicitacao perdida em silencio.
 * - Os nomes aqui sao os do banco, nao os do documento de origem — varios
 *   divergem ("Triunfo Concebra" no doc e "CONCEBRA (Triunfo Concebra)" no
 *   banco). O script reporta o que nao casar em vez de ignorar.
 * - Nada de inferir por grupo economico. O documento diz que o grupo CCR/Motiva
 *   inteiro usa o mesmo portal, mas so aplico as que ele nomeia.
 *
 * Uso:  node scripts/mapear-canais.js
 */
const { carregarEnv } = require('./carregar-env');
carregarEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PORTAL_CCR = 'https://isentos.ccrpagamentos.com.br';
const PORTAL_EPR_PR = 'https://isencaopr.com.br';

const NOTA_ARTESP =
  'Cadastro centralizado no GCTI/SIGEF do Estado de SP, com solicitação à ARTESP. Não há portal por concessionária.';

/** name no banco -> canal a gravar. */
const CANAIS = {
  // ---- E-mail (automatizavel hoje) ----
  'CONCEBRA (Triunfo Concebra)': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'concebra.protocolo@triunfoconcebra.com.br',
    observacoes: 'Também aceita formulário em triunfoconcebra.com.br/cadastro-isento',
  },
  Transbrasiliana: {
    tipoCanal: 'EMAIL',
    canalIsentos: 'gestaoregulatorio@triunfotransbrasiliana.com.br',
  },
  CONCER: { tipoCanal: 'EMAIL', canalIsentos: 'isencao@concer.com.br' },
  'Ecovias Minas Goiás (Eco050)': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'isentos@eco050.com.br',
  },
  'Ecovias Cerrado': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'isentos@ecoviasdocerrado.com.br',
  },
  'Ecovias Araguaia': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'isentos.araguaia@ecovias.com.br',
  },
  'Ecovias Capixaba': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'isencao@eco101.com.br',
    observacoes: 'Alternativo: eco101@eco101.com.br',
  },
  'Ecovias Rio Minas': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'correspondencia.riominas@ecovias.com.br',
  },
  'Rodovia do Aço': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'ouvidoria@rodoviadoaco.com.br',
  },
  'Way-262': { tipoCanal: 'EMAIL', canalIsentos: 'isento@way262.com.br' },
  'Way-153 (Rota Sertaneja)': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'isento@way153.com.br',
  },
  'EPR Litoral Pioneiro': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'protocolo@eprlpioneiro.com.br',
    observacoes:
      'Substitui o portal antes cadastrado, cuja URL estava com erro de digitação.',
  },
  'EPR Iguaçu': { tipoCanal: 'EMAIL', canalIsentos: 'ouvidoria@epriguacu.com.br' },
  'EPR Paraná': { tipoCanal: 'EMAIL', canalIsentos: 'ouvidoria@eprparana.com.br' },
  'CSG (Caminhos da Serra Gaúcha)': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'cadastroisentos@csg.com.br',
    observacoes:
      'Também: formulário csg.com.br/veiculos-isentos e 0800 122 0240 (opção 2).',
  },
  'EGR (Empresa Gaúcha de Rodovias)': {
    tipoCanal: 'EMAIL',
    canalIsentos: 'ouvidoria@egr.rs.gov.br',
    observacoes:
      'Alternativo: operacional@egr.rs.gov.br. Formulário em egr.rs.gov.br/conteudo/5129.',
  },

  // ---- Portal web ----
  'RioSP (CCR RioSP)': { tipoCanal: 'PORTAL_WEB', canalIsentos: PORTAL_CCR },
  ViaSul: { tipoCanal: 'PORTAL_WEB', canalIsentos: PORTAL_CCR },
  'Motiva Paraná (ex-PRVias)': { tipoCanal: 'PORTAL_WEB', canalIsentos: PORTAL_CCR },
  'Via Araucária': { tipoCanal: 'PORTAL_WEB', canalIsentos: PORTAL_EPR_PR },
  'Via Campo': { tipoCanal: 'PORTAL_WEB', canalIsentos: PORTAL_EPR_PR },
  'Via Cristais': {
    tipoCanal: 'PORTAL_WEB',
    canalIsentos: 'https://viacristais.com.br/isentos',
  },
  'VIA 040': {
    tipoCanal: 'PORTAL_WEB',
    canalIsentos: 'https://via040.com.br/pages/cadastro-de-isento',
  },
  'Way-306': {
    tipoCanal: 'PORTAL_WEB',
    canalIsentos: 'https://way306.com.br/servicos',
  },
  'Way-112': {
    tipoCanal: 'PORTAL_WEB',
    canalIsentos: 'https://way112.com.br/servicos',
  },

  // ---- Sem canal digital: telefone, correio ou nao localizado ----
  'Autopista Régis Bittencourt': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Somente telefone: 0800 709 0116.',
  },
  'Autopista Litoral Sul': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Somente telefone: 0800 725 1771.',
  },
  'Autopista Planalto Sul': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Somente telefone: 0800 642 0116.',
  },
  'Autopista Fluminense': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Somente telefone: 0800 282 0101.',
  },
  'Ecovias Sul (Ecosul)': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Correio ou sede. E-mail a confirmar.',
  },
  'Ecovias Ponte (Ecoponte)': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Ofício na sede, em Niterói. E-mail a confirmar.',
  },
  'EPR Via Mineira': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Formulário no site; e-mail a confirmar.',
  },
  'ViaCosteira (CCR ViaCosteira)': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: `Provável portal do grupo CCR (${PORTAL_CCR}), pendente de confirmação.`,
  },
  'Nova Rota do Oeste': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Canal de isentos não localizado.',
  },
  'Rota dos Grãos': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Canal de isentos não localizado.',
  },
  'Via Brasil 246': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Canal de isentos não localizado.',
  },
  LAMSA: {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Canal de isentos não localizado.',
  },
  'Via Transolímpica': {
    tipoCanal: 'MANUAL',
    canalIsentos: null,
    observacoes: 'Canal de isentos não localizado.',
  },
};

/** Concessionarias de SP: todas passam pelo mesmo caminho. */
const REGULADOR_ARTESP = 'ARTESP';

/** Entradas do documento que nao tem correspondente claro no banco. */
const SEM_CORRESPONDENCIA = [
  'Autopista Fernão Dias — em transição para a Motiva; o documento alerta para não usar o e-mail @arteris',
  'ViaRio (RJ municipal)',
  'Rota do Pará',
  'Morro da Mesa (MT)',
  'Via Brasil MT-320 / MT-100 / Via Norte Sul — nomes do banco usam a nomenclatura de lote, correspondência ambígua',
];

(async () => {
  try {
    const existentes = await prisma.concessionaire.findMany({
      select: { id: true, name: true, regulador: true },
    });
    const porNome = new Map(existentes.map(c => [c.name, c]));

    let aplicados = 0;
    const naoEncontrados = [];

    for (const [nome, dados] of Object.entries(CANAIS)) {
      const alvo = porNome.get(nome);
      if (!alvo) {
        naoEncontrados.push(nome);
        continue;
      }

      await prisma.concessionaire.update({
        where: { id: alvo.id },
        data: {
          tipoCanal: dados.tipoCanal,
          canalIsentos: dados.canalIsentos ?? null,
          ...(dados.observacoes ? { observacoes: dados.observacoes } : {}),
        },
      });
      aplicados++;
    }

    const artesp = await prisma.concessionaire.updateMany({
      where: { regulador: REGULADOR_ARTESP },
      data: { tipoCanal: 'MANUAL', canalIsentos: null, observacoes: NOTA_ARTESP },
    });

    console.log(`\nCanais aplicados individualmente: ${aplicados}`);
    console.log(`Concessionárias de SP marcadas como ARTESP/GCTI: ${artesp.count}`);

    if (naoEncontrados.length) {
      console.log('\nNomes do mapa que NÃO existem no banco:');
      naoEncontrados.forEach(n => console.log(`  - ${n}`));
    }

    const semCanal = await prisma.concessionaire.findMany({
      where: { canalIsentos: null, NOT: { regulador: REGULADOR_ARTESP } },
      select: { name: true, regulador: true, observacoes: true },
      orderBy: { name: 'asc' },
    });

    console.log(`\nSem canal digital e fora de SP: ${semCanal.length}`);
    semCanal.forEach(c =>
      console.log(`  - ${c.name} (${c.regulador})${c.observacoes ? ' :: ' + c.observacoes : ' :: SEM NOTA'}`)
    );

    const porTipo = await prisma.concessionaire.groupBy({
      by: ['tipoCanal'],
      _count: true,
    });
    console.log('\nDistribuição final por tipo de canal:');
    porTipo.forEach(t => console.log(`  ${t.tipoCanal ?? '(sem tipo)'}: ${t._count}`));

    console.log('\nEntradas do documento sem correspondente no banco:');
    SEM_CORRESPONDENCIA.forEach(s => console.log(`  - ${s}`));
    console.log('');
  } catch (erro) {
    console.error('ERRO:', erro.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
