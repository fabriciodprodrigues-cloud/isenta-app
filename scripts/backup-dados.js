/**
 * Backup dos dados de producao para JSON.
 *
 * Existe porque a maquina nao tem pg_dump e porque um dump SQL do Neon exigiria
 * o binario casado com a versao do servidor. Prisma ja conhece o schema, entao
 * exportar por ele evita essa dependencia.
 *
 * O que sai daqui NAO e auto-suficiente: as credenciais de caixa e de portal
 * saem cifradas, e sem a ENCRYPTION_KEY correspondente elas sao bytes inuteis.
 * Guardar a chave junto do backup anularia o proposito de cifrar.
 *
 * Uso: node scripts/backup-dados.js [destino.json]
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

require('./carregar-env.js').carregarEnv();

// pnpm nao faz hoisting: o client so resolve a partir do pacote que o declara.
const exigir = createRequire(path.resolve(__dirname, '../apps/web/package.json'));
const { PrismaClient } = exigir('@prisma/client');

const prisma = new PrismaClient();

// Ordem de dependencia: quem e referenciado vem antes de quem referencia, para
// que uma restauracao possa seguir a mesma sequencia sem quebrar chave estrangeira.
const TABELAS = [
  'account',
  'user',
  'concessionaire',
  'vehicle',
  'tag',
  'document',
  'concesssionaireRegistration', // o nome do model tem 3 "s" no schema
  'alert',
  'portalCredencial',
  'termoAutorizacao',
  'passwordResetToken',
  'session',
];

async function main() {
  const destino =
    process.argv[2] ||
    path.resolve(__dirname, `../backup-isenta-${new Date().toISOString().slice(0, 10)}.json`);

  const dados = {};
  const contagem = {};

  for (const tabela of TABELAS) {
    if (!prisma[tabela]) {
      console.warn(`  ! ${tabela}: nao existe no client, pulando`);
      continue;
    }
    const registros = await prisma[tabela].findMany();
    dados[tabela] = registros;
    contagem[tabela] = registros.length;
    console.log(`  ${String(registros.length).padStart(5)}  ${tabela}`);
  }

  const saida = {
    gerado_em: new Date().toISOString(),
    origem: 'producao (Neon)',
    aviso:
      'Credenciais cifradas so abrem com a ENCRYPTION_KEY vigente na epoca do backup.',
    contagem,
    dados,
  };

  fs.writeFileSync(destino, JSON.stringify(saida, null, 2), 'utf8');
  console.log(`\nBackup em: ${destino}`);
  console.log(`Tamanho:   ${(fs.statSync(destino).size / 1024).toFixed(1)} KB`);
}

main()
  .catch((e) => {
    console.error('Falhou:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
