/**
 * Gera um ofício .docx de exemplo a partir de um modelo real (papel
 * timbrado do órgão) e salva o resultado para inspeção visual.
 *
 * Não converte para PDF — isso só roda no VPS (LibreOffice headless, ver
 * apps/email-service). Este script serve para validar localmente que o
 * enxerto do corpo no modelo produz um .docx válido (abre no Word/
 * LibreOffice) antes de depender do VPS para o resto do pipeline.
 *
 *   pnpm --filter @isenta/web testar-oficio-docx <caminho-do-modelo.docx> [caminho-de-saida.docx]
 */
import { readFile, writeFile } from 'fs/promises';
import { montarOficioDocx } from '../lib/oficio-docx';
import type { DadosDoOficio } from '../lib/oficio-dados';

const dadosDeExemplo: DadosDoOficio = {
  numeroOficio: '007/2026',
  protocolo: 'ISN-2026-TESTE1',
  concessionariaNome: 'Concessionária Teste',
  orgao: {
    name: 'Câmara Municipal de Chapadão do Sul',
    razaoSocial: 'Câmara Municipal de Chapadão do Sul',
    cnpj: '01.234.567/0001-89',
    address: 'Rua Antônio João, 1200',
    bairro: 'Centro',
    numero: '1200',
    city: 'Chapadão do Sul',
    state: 'MS',
    cep: '79560-000',
    responsibleName: 'José da Silva',
    responsibleEmail: 'isencao@camarachapadaodosul.ms.gov.br',
    responsiblePhone: '(67) 3562-1234',
    responsibleRole: 'Presidente da Câmara',
    cabecalhoTexto: null,
    cidadeEmissao: 'Chapadão do Sul/MS',
  },
  veiculos: [
    {
      plate: 'SMF-6F91',
      renavam: '01234567890',
      type: 'proprio',
      category: 'oficial',
      marca: 'Fiat',
      modelo: 'Strada',
      cor: 'Branco',
      anoFabricacao: 2022,
      anoModelo: 2023,
    },
    {
      plate: 'NRL-9H10',
      renavam: '09876543210',
      type: 'locado',
      category: 'ambulancia',
      marca: 'Renault',
      modelo: 'Master',
      cor: 'Branco',
      anoFabricacao: 2021,
      anoModelo: 2021,
    },
  ],
  anexos: ['CRLV - SMF-6F91.pdf', 'CRLV - NRL-9H10.pdf', 'Contrato - NRL-9H10.pdf'],
};

async function main() {
  const [caminhoModelo, caminhoSaida] = process.argv.slice(2);

  if (!caminhoModelo) {
    console.error('Uso: pnpm --filter @isenta/web testar-oficio-docx <modelo.docx> [saida.docx]');
    process.exit(1);
  }

  const modeloBuffer = await readFile(caminhoModelo);
  const resultado = await montarOficioDocx(dadosDeExemplo, modeloBuffer);

  const saida = caminhoSaida || 'oficio-teste-gerado.docx';
  await writeFile(saida, resultado);

  console.log(`ok  .docx gerado com sucesso: ${saida} (${resultado.length} bytes)`);
}

main().catch(erro => {
  console.error('FALHOU', erro);
  process.exit(1);
});
