/**
 * Testa os dois geradores (DOCX via docxtemplater, XLSX via JSZip/XML cru)
 * contra fixtures sintéticas geradas em memória -- não temos os arquivos
 * reais da Rota dos Grãos/Rota Verde neste momento, então isto valida só a
 * MECÂNICA de preenchimento (tags batem, loop de veículos gera N repetições,
 * células XML são substituídas sem corromper o zip), não a conformidade
 * real contra um formulário de verdade. A validação final acontece no
 * primeiro upload real feito pelo admin, via pré-visualização antes de ativar.
 *
 *   pnpm --filter @isenta/web testar-modelo-documento
 */
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { writeFile } from 'fs/promises';
import { gerarDocumentoDocx } from '../lib/modelo-docx';
import { gerarDocumentoXlsx } from '../lib/modelo-xlsx';
import { dadosDeExemploParaModelo } from '../lib/dados-exemplo';
import type { MapeamentoCamposDocx, MapeamentoCamposXlsx } from '../lib/modelo-documento-tipos';

async function criarDocxFixture(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun('Requerimento de isenção -- texto fixo, nunca alterado.')] }),
          new Paragraph({ children: [new TextRun('Responsável: {{representante}}')] }),
          new Paragraph({ children: [new TextRun('CNPJ: {{cnpj}}')] }),
          new Paragraph({ children: [new TextRun('Data: {{data}}')] }),
          new Paragraph({ children: [new TextRun('{{#veiculos}}')] }),
          new Paragraph({ children: [new TextRun('Veículo: {{placa}} -- RENAVAM {{renavam}}')] }),
          new Paragraph({ children: [new TextRun('{{/veiculos}}')] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** .xlsx mínimo, montado à mão (partes OOXML essenciais), com uma linha-molde de veículo e uma linha abaixo dela para testar o deslocamento. */
async function criarXlsxFixture(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Formulario" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:C7"/>
  <sheetData>
    <row r="3"><c r="B3" t="inlineStr"><is><t>x</t></is></c></row>
    <row r="4"><c r="B4" t="inlineStr"><is><t>x</t></is></c></row>
    <row r="6"><c r="A6" t="inlineStr"><is><t>x</t></is></c><c r="B6" t="inlineStr"><is><t>x</t></is></c></row>
    <row r="7"><c r="A7" t="inlineStr"><is><t>Assinatura do responsável</t></is></c></row>
  </sheetData>
</worksheet>`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}

async function main() {
  console.log('== Gerando fixtures sintéticas ==');
  const docxBuffer = await criarDocxFixture();
  const xlsxBuffer = await criarXlsxFixture();

  console.log('\n== Testando gerador DOCX ==');
  const mapeamentoDocx: MapeamentoCamposDocx = {
    campos: { orgaoNome: 'representante', orgaoCnpj: 'cnpj', data: 'data' },
  };
  const resultadoDocx = await gerarDocumentoDocx(dadosDeExemploParaModelo, docxBuffer, mapeamentoDocx);
  await writeFile('modelo-teste-gerado.docx', resultadoDocx.buffer);
  console.log(`ok  .docx gerado: modelo-teste-gerado.docx (${resultadoDocx.buffer.length} bytes)`);

  console.log('\n== Testando gerador XLSX ==');
  const mapeamentoXlsx: MapeamentoCamposXlsx = {
    campos: { orgaoNome: 'B3', orgaoCnpj: 'B4' },
    tabelaVeiculos: { linhaInicial: 6, colunas: { placa: 'A', renavam: 'B' } },
  };
  const resultadoXlsx = await gerarDocumentoXlsx(dadosDeExemploParaModelo, xlsxBuffer, mapeamentoXlsx);
  await writeFile('modelo-teste-gerado.xlsx', resultadoXlsx.buffer);
  console.log(`ok  .xlsx gerado: modelo-teste-gerado.xlsx (${resultadoXlsx.buffer.length} bytes)`);

  // Confere mecanicamente que a linha "Assinatura" (originalmente r=7) foi
  // deslocada para r=8 -- dadosDeExemploParaModelo tem 2 veículos, então a
  // linha-molde (6) virou 2 linhas (6 e 7), empurrando o que vinha depois.
  const zipVerificacao = await JSZip.loadAsync(resultadoXlsx.buffer);
  const sheetFinal = await zipVerificacao.file('xl/worksheets/sheet1.xml')!.async('string');
  const linhaAssinaturaDeslocada = sheetFinal.includes('<row r="8"><c r="A8"');
  const duasLinhasDeVeiculo = sheetFinal.includes('r="A6"') && sheetFinal.includes('r="A7"');

  console.log(`\n${duasLinhasDeVeiculo ? 'ok ' : 'FALHOU '} tabela de veículos gerou uma linha por veículo (2 esperadas)`);
  console.log(`${linhaAssinaturaDeslocada ? 'ok ' : 'FALHOU '} linha abaixo da tabela foi deslocada corretamente`);

  if (!duasLinhasDeVeiculo || !linhaAssinaturaDeslocada) {
    process.exit(1);
  }

  console.log('\nTudo certo -- inspecione os arquivos gerados manualmente (abrir no Word/Excel) para conferir visualmente.');
}

main().catch(erro => {
  console.error('FALHOU', erro);
  process.exit(1);
});
