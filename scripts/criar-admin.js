/**
 * Cria (ou atualiza) o usuario administrador oficial.
 *
 * A senha e digitada aqui no terminal e so existe em memoria ate virar hash
 * bcrypt. Nao passa por chat, nao fica em arquivo, nao entra no historico do
 * shell.
 *
 * Uso:  node scripts/criar-admin.js
 */
const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');
const { createRequire } = require('module');
const { carregarEnv } = require('./carregar-env');

carregarEnv();

// O pnpm nao faz hoisting: bcryptjs so existe em apps/web/node_modules, entao
// um require() comum a partir da raiz falha. Ancorar a resolucao no
// package.json do app web faz o modulo ser encontrado do mesmo jeito que a
// aplicacao o encontra — garantindo inclusive a mesma versao de bcrypt que
// valida a senha no login.
const requireDoWeb = createRequire(
  path.join(__dirname, '..', 'apps', 'web', 'package.json')
);
const bcrypt = requireDoWeb('bcryptjs');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Stream que engole os caracteres da senha para nao aparecerem na tela.
const saidaMascarada = new Writable({
  write(chunk, encoding, callback) {
    if (!saidaMascarada.mudo) process.stdout.write(chunk, encoding);
    callback();
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: saidaMascarada,
  terminal: true,
});

function perguntar(texto) {
  return new Promise(resolve => rl.question(texto, resolve));
}

function perguntarSenha(texto) {
  return new Promise(resolve => {
    process.stdout.write(texto);
    saidaMascarada.mudo = true;
    rl.question('', valor => {
      saidaMascarada.mudo = false;
      process.stdout.write('\n');
      resolve(valor);
    });
  });
}

(async () => {
  try {
    console.log('\n=== Criar administrador oficial do Isenta ===\n');

    const email = (await perguntar('E-mail: ')).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error('E-mail invalido.');
    }

    const nome = (await perguntar('Nome completo: ')).trim();
    if (nome.length < 3) {
      throw new Error('Nome muito curto.');
    }

    const senha = await perguntarSenha('Senha (minimo 12 caracteres): ');
    if (senha.length < 12) {
      throw new Error('Senha muito curta. Use ao menos 12 caracteres.');
    }

    const confirmacao = await perguntarSenha('Repita a senha: ');
    if (senha !== confirmacao) {
      throw new Error('As senhas nao conferem.');
    }

    const hash = await bcrypt.hash(senha, 12);

    const existente = await prisma.user.findUnique({ where: { email } });

    if (existente) {
      await prisma.user.update({
        where: { email },
        data: { password: hash, name: nome, role: 'admin', accountId: null },
      });
      console.log(`\nSenha e dados atualizados para o admin existente: ${email}`);
    } else {
      await prisma.user.create({
        data: { email, name: nome, password: hash, role: 'admin', accountId: null },
      });
      console.log(`\nAdministrador criado: ${email}`);
    }

    const totalAdmins = await prisma.user.count({ where: { role: 'admin' } });
    console.log(`Total de administradores no sistema: ${totalAdmins}\n`);
  } catch (erro) {
    console.error(`\nERRO: ${erro.message}\n`);
    process.exitCode = 1;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
})();
