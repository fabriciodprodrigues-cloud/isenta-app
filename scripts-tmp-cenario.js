/**
 * Cenario de teste do upload de documentos.
 *
 * Cria DOIS orgaos para provar o isolamento: o operador do orgao B nao pode
 * ver documento do veiculo do orgao A. Cria tambem uma concessionaria de teste
 * cujo canal aponta para o proprio usuario, para que o envio com anexo nao
 * atinja nenhuma empresa real.
 */
const { carregarEnv } = require('./scripts/carregar-env');
carregarEnv();

const path = require('path');
const { createRequire } = require('module');
const requireDoWeb = createRequire(
  path.join(__dirname, 'apps', 'web', 'package.json')
);
const bcrypt = requireDoWeb('bcryptjs');

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const EMAIL_USUARIO = 'fabriciodprodrigues@gmail.com';
const SENHA_OPERADOR_B = 'teste-isolamento-9d2f-remover';

(async () => {
  const orgaoA = await p.account.create({
    data: {
      name: 'TESTE A - remover', razaoSocial: 'TESTE A - remover',
      cnpj: '11.222.333/0001-81', status: 'active',
      responsibleName: 'Responsavel A', responsibleEmail: EMAIL_USUARIO,
      responsiblePhone: '(19) 99999-0001',
      address: 'Rua A, 1', city: 'Campinas', state: 'SP',
    },
  });

  const orgaoB = await p.account.create({
    data: {
      name: 'TESTE B - remover', razaoSocial: 'TESTE B - remover',
      cnpj: '11.444.777/0001-61', status: 'active',
      responsibleName: 'Responsavel B', responsibleEmail: EMAIL_USUARIO,
      responsiblePhone: '(19) 99999-0002',
      address: 'Rua B, 2', city: 'Campinas', state: 'SP',
    },
  });

  const veiculoA = await p.vehicle.create({
    data: {
      accountId: orgaoA.id, plate: 'TSA-1A11', renavam: '11111111111',
      type: 'proprio', category: 'oficial', status: 'rascunho',
      marca: 'Fiat', modelo: 'Ducato', cor: 'Branco',
      anoFabricacao: 2023, anoModelo: 2024,
    },
  });

  await p.user.create({
    data: {
      email: 'operador.teste.b@exemplo.local',
      name: 'Operador B (teste)',
      password: await bcrypt.hash(SENHA_OPERADOR_B, 12),
      role: 'operator',
      accountId: orgaoB.id,
    },
  });

  // Concessionaria de teste: o canal aponta para o proprio usuario, entao
  // nenhum e-mail chega a empresa real.
  const conc = await p.concessionaire.create({
    data: {
      name: 'TESTE Concessionaria - remover',
      esfera: 'FEDERAL', regulador: 'TESTE',
      situacao: 'ATIVO', ativoParaCadastro: true,
      canalIsentos: EMAIL_USUARIO, tipoCanal: 'EMAIL',
      estados: '["SP"]',
    },
  });

  const cadastro = await p.concesssionaireRegistration.create({
    data: { vehicleId: veiculoA.id, concessionaireId: conc.id, status: 'rascunho' },
  });

  console.log('orgaoA .........', orgaoA.id);
  console.log('veiculoA .......', veiculoA.id, veiculoA.plate);
  console.log('orgaoB .........', orgaoB.id);
  console.log('operadorB ......', 'operador.teste.b@exemplo.local');
  console.log('concessionaria .', conc.id);
  console.log('cadastro .......', cadastro.id);

  await p.$disconnect();
})();
