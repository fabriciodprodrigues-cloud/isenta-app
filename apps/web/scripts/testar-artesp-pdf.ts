/**
 * Gera os 5 documentos ARTESP de um órgão real (busca pelo nome), convertendo
 * para PDF de verdade (via relay da VPS) e subindo no Blob -- valida o
 * pipeline completo (montarDocumentoDocx -> converterDocxParaPdf -> Blob).
 *
 * Precisa de DATABASE_URL, BLOB_READ_WRITE_TOKEN, EMAIL_RELAY_URL e
 * EMAIL_RELAY_SECRET no ambiente. Não grava nada no banco (não cria
 * ArtespCadastro nem ArtespDocumento) -- só gera os PDFs e salva localmente
 * pra inspeção visual.
 *
 *   pnpm --filter @isenta/web testar-artesp-pdf "<parte do nome do órgão>"
 */
import { writeFile } from 'fs/promises';
import { get } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import { montarDocumentoDocx } from '../lib/oficio-docx';
import { converterDocxParaPdf } from '../lib/email-service';
import { montarCorpoArtespWordXml } from '../lib/artesp-documentos';
import { TIPOS_DOCUMENTO_ARTESP, ABRANGENCIA_PADRAO, type DadosArtesp } from '../lib/artesp-dados';

const prisma = new PrismaClient();

async function carregarModelo(pathname: string): Promise<Buffer> {
  const resultado = await get(pathname, { access: 'private' });
  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    throw new Error(`modelo indisponível no Blob: ${pathname}`);
  }
  return Buffer.from(await new Response(resultado.stream).arrayBuffer());
}

async function main() {
  const busca = process.argv[2];
  if (!busca) {
    console.error('Uso: pnpm --filter @isenta/web testar-artesp-pdf "<parte do nome do órgão>"');
    process.exit(1);
  }

  const orgao = await prisma.account.findFirst({
    where: { name: { contains: busca } },
    include: { vehicles: { include: { tags: { select: { serialNumber: true, operadora: true }, take: 1 } }, take: 1 } },
  });

  if (!orgao) throw new Error(`nenhum órgão encontrado contendo "${busca}"`);
  if (!orgao.modeloOficioUrl) throw new Error(`${orgao.name} não tem modeloOficioUrl cadastrado`);

  const veiculo = orgao.vehicles[0];
  if (!veiculo) throw new Error(`${orgao.name} não tem veículo pra testar`);

  console.log(`órgão: ${orgao.name} | veículo: ${veiculo.plate}`);

  const dados: DadosArtesp = {
    tipoEntidade: 'B',
    abrangencia: ABRANGENCIA_PADRAO.B,
    orgao: {
      name: orgao.name,
      razaoSocial: orgao.razaoSocial,
      cnpj: orgao.cnpj,
      address: orgao.address,
      bairro: orgao.bairro,
      numero: orgao.numero,
      city: orgao.city,
      state: orgao.state,
      cep: orgao.cep,
      responsibleName: orgao.responsibleName,
      responsibleEmail: orgao.responsibleEmail,
      responsiblePhone: orgao.responsiblePhone,
      emailIsencao: orgao.emailIsencao ?? orgao.responsibleEmail,
      responsibleRole: orgao.responsibleRole,
      cabecalhoTexto: orgao.cabecalhoTexto,
      cidadeEmissao: orgao.cidadeEmissao,
    },
    responsavelFrotaNome: orgao.responsibleName,
    responsavelFrotaTelefone: orgao.responsiblePhone,
    responsavelFrotaEmail: orgao.responsibleEmail,
    veiculos: [
      {
        plate: veiculo.plate,
        renavam: veiculo.renavam,
        type: veiculo.type,
        category: veiculo.category,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        cor: veiculo.cor,
        anoFabricacao: veiculo.anoFabricacao,
        anoModelo: veiculo.anoModelo,
        registroPatrimonial: 'PAT-0001',
        prefixo: 'PREF-01',
        tag: veiculo.tags[0]?.serialNumber ?? null,
        operadoraTag: veiculo.tags[0]?.operadora ?? null,
      },
    ],
    dataEmissao: new Date(),
  };

  const modeloBuffer = await carregarModelo(orgao.modeloOficioUrl);
  console.log(`modelo carregado: ${modeloBuffer.length} bytes`);

  for (const tipo of TIPOS_DOCUMENTO_ARTESP) {
    process.stdout.write(`gerando ${tipo}... `);
    const corpo = montarCorpoArtespWordXml(tipo, dados);
    const docx = await montarDocumentoDocx(corpo, modeloBuffer);
    const pdf = await converterDocxParaPdf(docx);
    const saida = `artesp-teste-${tipo}.pdf`;
    await writeFile(saida, pdf);
    console.log(`ok (${pdf.length} bytes) -> ${saida}`);
  }

  console.log('\nPDFs salvos na pasta atual pra inspeção visual.');
}

main()
  .catch(erro => {
    console.error('FALHOU', erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
