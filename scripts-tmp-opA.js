const { carregarEnv } = require('./scripts/carregar-env');
carregarEnv();

const path = require('path');
const { createRequire } = require('module');
const bcrypt = createRequire(
  path.join(__dirname, 'apps', 'web', 'package.json')
)('bcryptjs');

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const orgaoA = await p.account.findFirst({ where: { cnpj: '11.222.333/0001-81' } });

  await p.user.create({
    data: {
      email: 'operador.teste.a@exemplo.local',
      name: 'Operador A (teste)',
      password: await bcrypt.hash('teste-isolamento-9d2f-remover', 12),
      role: 'operator',
      accountId: orgaoA.id,
    },
  });

  console.log('operadorA criado no orgao', orgaoA.name);
  await p.$disconnect();
})();
