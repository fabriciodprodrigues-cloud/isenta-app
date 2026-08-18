import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CONCESSIONARIAS_COMPLETAS } from './concessionarias-completas-v2';

const prisma = new PrismaClient();

/**
 * Impede que o seed rode contra um banco que não seja local.
 *
 * Este arquivo começa apagando TODAS as tabelas. Enquanto o projeto era só
 * desenvolvimento isso era inofensivo, e oito guias do repositório passaram a
 * mandar rodar `prisma db seed`. Depois que a produção subiu, o .env passou a
 * apontar para o banco real e esses mesmos guias viraram instruções para
 * destruí-lo — foi exatamente o que aconteceu em 18/08/2026.
 *
 * A trava fica aqui, e não na documentação, porque documentação não é executada.
 */
function exigirBancoLocal() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL ausente: nada a semear.');
  }

  const host = new URL(url).hostname.toLowerCase();
  const ehLocal =
    host === 'localhost' || host === '127.0.0.1' || host === 'db' || host === 'postgres';

  if (ehLocal) return;

  // A saída de emergência existe para o caso legítimo de repovoar um ambiente
  // de teste remoto. Ela é explícita de propósito: ninguém a digita por engano.
  if (process.env.PERMITIR_SEED_REMOTO === 'sim, apagar tudo') {
    console.warn(`\n⚠️  Semeando banco REMOTO em ${host} — apagando tudo.\n`);
    return;
  }

  throw new Error(
    `\nO seed apaga TODAS as tabelas e o DATABASE_URL aponta para ${host}, que não é local.\n` +
      `Se este for o banco de produção, rodar isto destrói os dados reais.\n\n` +
      `Para semear mesmo assim, defina:\n` +
      `  PERMITIR_SEED_REMOTO="sim, apagar tudo"\n`
  );
}

async function main() {
  exigirBancoLocal();

  console.log('🌱 Seeding database...');

  // Limpar dados existentes
  await prisma.alert.deleteMany();
  await prisma.document.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.concesssionaireRegistration.deleteMany();
  await prisma.concessionaire.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();

  // Criar conta demo
  const account = await prisma.account.create({
    data: {
      name: 'Prefeitura de São Paulo',
      razaoSocial: 'Município de São Paulo',
      cnpj: '34.028.316/0001-08',
      status: 'active',
      responsibleName: 'João Silva',
      responsibleEmail: 'joao@prefeitura.sp.gov.br',
      responsiblePhone: '(11) 98765-4321',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      telefone: '(11) 3231-3000',
      email: 'isentos@prefeitura.sp.gov.br',
      cep: '01311-100',
      numero: '1000',
      complemento: 'Andar 10',
      bairro: 'Bela Vista',
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
      cor: 'Branco',
      marca: 'Toyota',
      modelo: 'Hiace',
      anoFabricacao: 2023,
      anoModelo: 2023,
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 8)),
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
      cor: 'Branco',
      marca: 'Mercedes-Benz',
      modelo: 'Sprinter',
      anoFabricacao: 2022,
      anoModelo: 2022,
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 2)),
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
      cor: 'Vermelho',
      marca: 'Scania',
      modelo: 'P 360',
      anoFabricacao: 2021,
      anoModelo: 2021,
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 10)),
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
      cor: 'Preto',
      marca: 'Volkswagen',
      modelo: 'Delivery',
      anoFabricacao: 2023,
      anoModelo: 2023,
      expiresAt: null,
    },
  });

  console.log('✓ Vehicles created: 4');

  // Criar todas as concessonárias (~73 registros)
  const concessionaireMap = new Map();
  let createdCount = 0;
  let errorCount = 0;

  for (const data of CONCESSIONARIAS_COMPLETAS) {
    try {
      // Gerar CNPJ sequencial se não houver
      const cnpjNumber = createdCount + 1;
      const cnpj = `00.000.${String(cnpjNumber).padStart(3, '0')}/0001-00`;

      const concessionaire = await prisma.concessionaire.create({
        data: {
          name: data.nome,
          grupo: data.grupo || null,
          esfera: data.esfera,
          regulador: data.regulador,
          cidade: data.cidade || null,
          estados: data.estados,
          rodovias: data.rodovias || null,
          extensaoKm: data.extensaoKm || null,
          situacao: data.situacao,
          canalIsentos: data.canalIsentos || null,
          tipoCanal: data.tipoCanal || null,
          prazoRenovMeses: data.prazoRenovMeses || null,
          observacoes: data.observacoes || null,
          ativoParaCadastro: data.ativoParaCadastro || false,
          camposObrigatorios: data.camposObrigatorios || null,
          cnpj: cnpj,
        },
      });

      concessionaireMap.set(`${data.nome}`, concessionaire);
      createdCount++;
    } catch (error: any) {
      errorCount++;
      console.error(`  ✗ ${data.nome}: ${error.message}`);
    }
  }

  console.log(`✓ Concessionaires created: ${createdCount}/${CONCESSIONARIAS_COMPLETAS.length} (erros: ${errorCount})`);

  // Get demo concessionaires for registrations
  const concessionaire1 = concessionaireMap.get('Ecovias Minas Goiás (Eco050)');
  const concessionaire2 = concessionaireMap.get('CSG (Caminhos da Serra Gaúcha)');

  if (concessionaire1 && concessionaire2) {
    // Criar registros de cadastro em concessionárias
    await prisma.concesssionaireRegistration.create({
      data: {
        vehicleId: vehicle1.id,
        concessionaireId: concessionaire1.id,
        status: 'aprovado',
        protocol: 'ECO050-2024-001',
        approvedAt: new Date(),
        sentAt: new Date(new Date().setDate(new Date().getDate() - 30)),
      },
    });

    await prisma.concesssionaireRegistration.create({
      data: {
        vehicleId: vehicle2.id,
        concessionaireId: concessionaire2.id,
        status: 'aguardando_resposta',
        protocol: 'CSG-2024-015',
        sentAt: new Date(new Date().setDate(new Date().getDate() - 5)),
      },
    });

    console.log('✓ Registrations created: 2');

    // Criar TAGs demo
    await prisma.tag.create({
      data: {
        serialNumber: 'TAG-2024-001',
        vehicleId: vehicle1.id,
        status: 'assigned',
        assignedAt: new Date(),
        expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      },
    });

    await prisma.tag.create({
      data: {
        serialNumber: 'TAG-2024-002',
        status: 'available',
      },
    });

    console.log('✓ Tags created: 2');
  } else {
    console.log('⚠ Demo concessionaires not found - skipping registrations and tags');
  }

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
