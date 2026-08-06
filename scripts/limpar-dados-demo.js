/**
 * Remove os dados ficticios de demonstracao, preparando o sistema para uso
 * real.
 *
 * PRESERVA:
 *   - Concessionarias (dado real, curado manualmente)
 *   - Administradores reais
 *
 * APAGA:
 *   - Alertas, documentos, cadastros em concessionaria, TAGs, veiculos
 *   - Orgaos (contas)
 *   - Usuarios que nao sao admin
 *   - As contas de demonstracao do seed, INCLUSIVE o admin@isenta.local: ele
 *     tem role 'admin' e sobreviveria a uma limpeza que so olhasse o papel,
 *     mantendo em producao um acesso com senha que esteve publicada na tela
 *     de login.
 *   - Sessoes
 *
 * A ordem respeita as chaves estrangeiras: filhos antes dos pais.
 *
 * Uso:  node scripts/limpar-dados-demo.js
 */
const readline = require('readline');
const { carregarEnv } = require('./carregar-env');

carregarEnv();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function perguntar(texto) {
  return new Promise(resolve => rl.question(texto, resolve));
}

// Contas criadas pelo seed de demonstracao. Precisam sair mesmo sendo admin.
const CONTAS_DEMO = ['admin@isenta.local', 'operador@prefeitura.sp.gov.br'];

(async () => {
  try {
    const antes = {
      alertas: await prisma.alert.count(),
      documentos: await prisma.document.count(),
      cadastros: await prisma.concesssionaireRegistration.count(),
      tags: await prisma.tag.count(),
      veiculos: await prisma.vehicle.count(),
      orgaos: await prisma.account.count(),
      sessoes: await prisma.session.count(),
    };

    const usuariosParaApagar = await prisma.user.findMany({
      where: {
        OR: [{ NOT: { role: 'admin' } }, { email: { in: CONTAS_DEMO } }],
      },
      select: { email: true, role: true },
    });

    const adminsPreservados = await prisma.user.findMany({
      where: { role: 'admin', NOT: { email: { in: CONTAS_DEMO } } },
      select: { email: true },
    });

    const concessionarias = await prisma.concessionaire.count();

    console.log('\n=== SERA APAGADO ===');
    Object.entries(antes).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${v}`));
    console.log(`  usuarios           ${usuariosParaApagar.length}`);
    usuariosParaApagar.forEach(u =>
      console.log(`      - ${u.email}  (${u.role})`)
    );

    console.log('\n=== SERA PRESERVADO ===');
    console.log(`  concessionarias    ${concessionarias}`);
    console.log(`  administradores    ${adminsPreservados.length}`);
    adminsPreservados.forEach(a => console.log(`      - ${a.email}`));

    if (adminsPreservados.length === 0) {
      throw new Error(
        'Nenhum administrador real encontrado (fora as contas de demonstracao). ' +
          'Rode scripts/criar-admin.js ANTES, senao voce ficara sem acesso ao sistema.'
      );
    }

    console.log('\nEsta operacao NAO pode ser desfeita.');
    const resposta = await perguntar('Digite APAGAR para confirmar: ');

    if (resposta.trim() !== 'APAGAR') {
      console.log('\nCancelado. Nada foi alterado.\n');
      return;
    }

    console.log('\nApagando...');

    // Filhos primeiro, para nao violar as chaves estrangeiras.
    console.log(`  alertas ............ ${(await prisma.alert.deleteMany({})).count}`);
    console.log(`  documentos ......... ${(await prisma.document.deleteMany({})).count}`);
    console.log(`  cadastros .......... ${(await prisma.concesssionaireRegistration.deleteMany({})).count}`);
    console.log(`  tags ............... ${(await prisma.tag.deleteMany({})).count}`);
    console.log(`  veiculos ........... ${(await prisma.vehicle.deleteMany({})).count}`);
    console.log(`  sessoes ............ ${(await prisma.session.deleteMany({})).count}`);

    // Usuarios antes dos orgaos: User.accountId usa onDelete SetNull, mas
    // apagar o usuario primeiro evita deixar orfaos num estado intermediario.
    const usuariosApagados = await prisma.user.deleteMany({
      where: {
        OR: [{ NOT: { role: 'admin' } }, { email: { in: CONTAS_DEMO } }],
      },
    });
    console.log(`  usuarios ........... ${usuariosApagados.count}`);
    console.log(`  orgaos ............. ${(await prisma.account.deleteMany({})).count}`);

    const adminsRestantes = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { email: true },
    });

    const restou = {
      concessionarias: await prisma.concessionaire.count(),
      administradores: adminsRestantes.length,
      orgaos: await prisma.account.count(),
      veiculos: await prisma.vehicle.count(),
    };

    console.log('\n=== ESTADO FINAL ===');
    Object.entries(restou).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${v}`));
    adminsRestantes.forEach(a => console.log(`      admin: ${a.email}`));
    console.log('\nSistema pronto para uso real.\n');
  } catch (erro) {
    console.error(`\nERRO: ${erro.message}\n`);
    process.exitCode = 1;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
})();
