/**
 * Testa a detecção automática de campos (modelo-deteccao.ts) contra fixtures
 * sintéticas -- mesma ressalva de testar-modelo-documento.ts: sem os
 * arquivos reais da Rota Verde/Rota dos Grãos, isto valida a MECÂNICA
 * (concatenação de runs quebrados no Word, leitura de sharedStrings.xml,
 * heurística de rótulo->valor, caminho de ambiguidade), não a robustez
 * contra a formatação real de um arquivo de verdade.
 *
 *   pnpm --filter @isenta/web testar-modelo-deteccao
 */
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { detectarCamposDocx, detectarCamposXlsx } from '../lib/modelo-deteccao';

async function criarDocxFixture(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun('Requerimento de isenção -- texto fixo, nunca alterado.')] }),
          new Paragraph({ children: [new TextRun('Responsável: {{representante}}')] }),
          // Tag deliberadamente quebrada em dois <w:t> -- prova que a
          // concatenação por ordem de documento resolve o que um regex
          // direto no XML bruto não resolveria (cada run isolado não bate
          // com o padrão {{...}}).
          new Paragraph({
            children: [new TextRun('CNPJ: {{cn'), new TextRun('pj}}')],
          }),
          new Paragraph({ children: [new TextRun('Data: {{data}}')] }),
          new Paragraph({ children: [new TextRun('{{#veiculos}}')] }),
          new Paragraph({ children: [new TextRun('Placa: {{placa}}')] }),
          new Paragraph({ children: [new TextRun('{{/veiculos}}')] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/**
 * .xlsx mínimo com xl/sharedStrings.xml de verdade (rótulos via t="s", não
 * inlineStr como o gerador escreve) -- cobre o caso real de um arquivo
 * autorado no Excel. Inclui um rótulo duplicado ("CNPJ" em A3 e A4) para
 * testar o caminho de ambiguidade, e um cabeçalho de veículos com só 4 das
 * 10 colunas conhecidas, para testar o aviso de poucas colunas reconhecidas.
 */
async function criarXlsxFixtureComSharedStrings(): Promise<Buffer> {
  const zip = new JSZip();

  const sharedStrings = [
    'Nome do Responsável', // 0
    'João da Silva', // 1
    'CNPJ', // 2
    '12.345.678/0001-99', // 3
    'Placa', // 4
    'Marca', // 5
    'Modelo', // 6
    'Renavam', // 7
  ];

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
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
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`
  );
  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(texto => `  <si><t>${texto}</t></si>`).join('\n')}
</sst>`
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A2:D9"/>
  <sheetData>
    <row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c></row>
    <row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" t="s"><v>3</v></c></row>
    <row r="4"><c r="A4" t="s"><v>2</v></c></row>
    <row r="6"><c r="A6" t="s"><v>4</v></c><c r="B6" t="s"><v>5</v></c><c r="C6" t="s"><v>6</v></c><c r="D6" t="s"><v>7</v></c></row>
    <row r="9"><c r="A9" t="inlineStr"><is><t>Assinatura do responsável</t></is></c></row>
  </sheetData>
</worksheet>`
  );

  return (await zip.generateAsync({ type: 'nodebuffer' })) as Buffer;
}

let falhas = 0;
function checar(condicao: boolean, descricao: string) {
  console.log(`${condicao ? 'ok ' : 'FALHOU '} ${descricao}`);
  if (!condicao) falhas++;
}

async function main() {
  console.log('== Detecção DOCX ==');
  const docxBuffer = await criarDocxFixture();
  const deteccaoDocx = await detectarCamposDocx(docxBuffer);
  console.log(JSON.stringify(deteccaoDocx, null, 2));

  checar(deteccaoDocx.tagsEncontradas.includes('representante'), 'achou a tag "representante"');
  checar(
    deteccaoDocx.tagsEncontradas.includes('cnpj'),
    'reconstituiu "cnpj" a partir de uma tag quebrada em dois <w:t> (prova a concatenação por ordem de documento)'
  );
  checar(deteccaoDocx.tagsEncontradas.includes('data'), 'achou a tag "data"');
  checar(deteccaoDocx.tagsEncontradas.includes('placa'), 'achou a tag "placa" dentro do loop');
  checar(deteccaoDocx.temLoopVeiculos, 'detectou o loop {{#veiculos}}...{{/veiculos}}');
  checar(deteccaoDocx.sugestoesCampos.responsavelNome === 'representante', 'sugeriu responsavelNome -> representante');
  checar(deteccaoDocx.sugestoesCampos.orgaoCnpj === 'cnpj', 'sugeriu orgaoCnpj -> cnpj (tag reconstituída)');
  checar(deteccaoDocx.sugestoesCampos.data === 'data', 'sugeriu data -> data');

  console.log('\n== Detecção XLSX ==');
  const xlsxBuffer = await criarXlsxFixtureComSharedStrings();
  const deteccaoXlsx = await detectarCamposXlsx(xlsxBuffer);
  console.log(JSON.stringify(deteccaoXlsx, null, 2));

  checar(deteccaoXlsx.sugestoesCampos.responsavelNome === 'B2', 'leu rótulo+valor via shared strings (responsavelNome -> B2)');
  checar(deteccaoXlsx.sugestoesCampos.orgaoCnpj === 'B3', 'em rótulo duplicado ("CNPJ" em A3 e A4), escolheu a de menor posição (A3 -> valor B3)');
  checar(
    deteccaoXlsx.avisos.some(a => a.toLowerCase().includes('orgaocnpj')),
    'avisou sobre a ambiguidade do rótulo duplicado de orgaoCnpj'
  );
  checar(deteccaoXlsx.sugestaoTabela !== null, 'identificou a tabela de veículos');
  checar(deteccaoXlsx.sugestaoTabela?.linhaInicial === 7, 'linha inicial da tabela = linha do cabeçalho (6) + 1');
  checar(
    deteccaoXlsx.sugestaoTabela?.colunas.placa === 'A' &&
      deteccaoXlsx.sugestaoTabela?.colunas.marca === 'B' &&
      deteccaoXlsx.sugestaoTabela?.colunas.modelo === 'C' &&
      deteccaoXlsx.sugestaoTabela?.colunas.renavam === 'D',
    'mapeou as 4 colunas de veículo reconhecidas nas letras certas'
  );
  checar(
    deteccaoXlsx.avisos.some(a => a.includes('4 de 10')),
    'avisou que só 4 de 10 colunas de veículo foram reconhecidas'
  );

  console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} verificação(ões) falharam.`);
  if (falhas > 0) process.exit(1);
}

main().catch(erro => {
  console.error('FALHOU', erro);
  process.exit(1);
});
