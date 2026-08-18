/**
 * Verifica o parser do CRLV contra layouts sinteticos.
 *
 * Existe porque a extracao por texto casa rotulos com expressao regular, e
 * isso quebra em silencio quando o layout muda: o cadastro sai pela metade ou,
 * pior, com o valor do campo vizinho. Rodar isto depois de mexer no parser
 * custa segundos.
 *
 * Nao substitui teste com CRLV de verdade — os casos aqui foram escritos a
 * partir do layout esperado, nao de um documento real.
 *
 *   pnpm --filter @isenta/web testar-crlv
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { lerCrlvDoTexto, extracaoFoiSuficiente } from '../lib/leitura-crlv-texto';

/** Rotulo numa linha, valor na seguinte — a estrutura do CRLV-e. */
async function pdfDeTexto(linhas: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595, 842]);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const linha of linhas) {
    pagina.drawText(linha, { x: 40, y, size: 9, font: fonte });
    y -= 14;
  }
  return Buffer.from(await doc.save());
}

let falhas = 0;

function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(
    `  ${ok ? 'ok  ' : 'FALHOU'} ${nome}` +
      (ok ? '' : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`)
  );
}

async function main() {
  console.log('\nMercosul, anos em campos separados');
  {
    const { dados } = await lerCrlvDoTexto(
      await pdfDeTexto([
        'CODIGO RENAVAM', '00987654321',
        'PLACA', 'ABC1D23',
        'MARCA / MODELO / VERSAO', 'VW/GOL 1.0 FLEX',
        'ANO FABRICACAO', '2020',
        'ANO MODELO', '2021',
        'COR PREDOMINANTE', 'BRANCA',
        'CPF/CNPJ', '12345678000199',
      ])
    );
    conferir('placa', dados.placa, 'ABC1D23');
    conferir('renavam', dados.renavam, '00987654321');
    conferir('marca', dados.marca, 'VW');
    conferir('modelo', dados.modelo, 'GOL 1.0 FLEX');
    conferir('anos', [dados.anoFabricacao, dados.anoModelo], [2020, 2021]);
    conferir('nada incerto', dados.camposIncertos, []);
  }

  console.log('\nPlaca antiga, anos no mesmo campo, ambulancia');
  {
    const { dados } = await lerCrlvDoTexto(
      await pdfDeTexto([
        'PLACA', 'ABC-1234',
        'CODIGO RENAVAM', '12345678901',
        'MARCA/MODELO/VERSAO', 'FIAT/DUCATO AMBULANCIA',
        'ANO FABRICACAO / MODELO', '2019/2019',
        'COR', 'BRANCA',
      ])
    );
    conferir('placa sem hifen', dados.placa, 'ABC1234');
    conferir('anos juntos', [dados.anoFabricacao, dados.anoModelo], [2019, 2019]);
    conferir('categoria', dados.categoria, 'ambulancia');
  }

  console.log('\nPDF sem camada de texto cai para a leitura por visao');
  {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const { dados, temTexto } = await lerCrlvDoTexto(Buffer.from(await doc.save()));
    conferir('temTexto', temTexto, false);
    conferir('insuficiente', extracaoFoiSuficiente(dados), false);
  }

  console.log('\nCPF nao pode virar RENAVAM');
  {
    const { dados } = await lerCrlvDoTexto(
      await pdfDeTexto([
        'PLACA', 'XYZ9K88',
        'CPF', '11122233344',
        'MARCA / MODELO / VERSAO', 'GM/ONIX',
        'COR PREDOMINANTE', 'PRATA',
      ])
    );
    conferir('renavam vazio', dados.renavam, null);
    conferir('cai para visao', extracaoFoiSuficiente(dados), false);
  }

  console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} verificacao(oes) falharam.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
