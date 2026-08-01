import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Limpar dados existentes
  await prisma.alert.deleteMany();
  await prisma.concesssionaireRegistration.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();

  // Criar conta demo
  const account = await prisma.account.create({
    data: {
      name: 'Prefeitura de São Paulo',
      cnpj: '34.028.316/0001-08',
      status: 'active',
      responsibleName: 'João Silva',
      responsibleEmail: 'joao@prefeitura.sp.gov.br',
      responsiblePhone: '(11) 98765-4321',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
    },
  });

  console.log('✓ Account created:', account.id);

  // Criar usuário admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@isenta.local',
      password: adminPassword,
      name: 'Admin Demo',
      role: 'admin',
    },
  });

  console.log('✓ Admin user created:', adminUser.id);

  // Criar usuário operador
  const operatorPassword = await bcrypt.hash('operador123', 10);
  const operatorUser = await prisma.user.create({
    data: {
      email: 'operador@prefeitura.sp.gov.br',
      password: operatorPassword,
      name: 'Operador Demo',
      role: 'operator',
      accountId: account.id,
    },
  });

  console.log('✓ Operator user created:', operatorUser.id);

  // Criar veículos demo
  const vehicle1 = await prisma.vehicle.create({
    data: {
      accountId: account.id,
      plate: 'SAO1000',
      renavam: '12345678901',
      type: 'proprio',
      category: 'oficial',
      status: 'aprovado',
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 8)), // 8 meses
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      accountId: account.id,
      plate: 'AMB1001',
      renavam: '98765432101',
      type: 'proprio',
      category: 'ambulancia',
      status: 'aprovado',
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 2)), // 2 meses (vencendo em breve)
    },
  });

  const vehicle3 = await prisma.vehicle.create({
    data: {
      accountId: account.id,
      plate: 'CBM1002',
      renavam: '11122233344',
      type: 'locado',
      category: 'bombeiro',
      status: 'aguardando',
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 10)), // 10 meses
    },
  });

  const vehicle4 = await prisma.vehicle.create({
    data: {
      accountId: account.id,
      plate: 'OTR1003',
      renavam: '55566677788',
      type: 'proprio',
      category: 'outro',
      status: 'rascunho',
      expiresAt: null,
    },
  });

  console.log('✓ Vehicles created: 4');

  // Criar registros de cadastro em concessionárias
  await prisma.concesssionaireRegistration.create({
    data: {
      vehicleId: vehicle1.id,
      concessionnaire: 'CCR PRVias',
      status: 'aprovado',
      protocol: 'CCRF-2024-001',
      approvedAt: new Date(),
      sentAt: new Date(new Date().setDate(new Date().getDate() - 30)),
    },
  });

  await prisma.concesssionaireRegistration.create({
    data: {
      vehicleId: vehicle2.id,
      concessionnaire: 'CSG',
      status: 'aguardando_resposta',
      protocol: 'CSG-2024-015',
      sentAt: new Date(new Date().setDate(new Date().getDate() - 5)),
    },
  });

  console.log('✓ Registrations created: 2');

  // Criar alertas demo
  await prisma.alert.create({
    data: {
      accountId: account.id,
      vehicleId: vehicle2.id,
      type: 'expiring_soon',
      daysUntilExpiry: 60,
    },
  });

  await prisma.alert.create({
    data: {
      accountId: account.id,
      vehicleId: vehicle2.id,
      type: 'expiring_soon',
      daysUntilExpiry: 30,
    },
  });

  console.log('✓ Alerts created: 2');

  console.log('\n✅ Seed completed!');
  console.log('\nDemo credentials:');
  console.log('  Email: admin@isenta.local');
  console.log('  Senha: admin123');
  console.log('\nOperator credentials:');
  console.log('  Email: operador@prefeitura.sp.gov.br');
  console.log('  Senha: operador123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
