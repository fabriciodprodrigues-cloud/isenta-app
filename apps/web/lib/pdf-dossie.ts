/**
 * Mescla os 5 documentos ARTESP num único PDF ("Dossiê ARTESP"), com uma
 * página inicial de sumário e numeração de página contínua (ver seção 5.1
 * da especificação do módulo) -- evita que o órgão precise protocolar 5
 * arquivos separados.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { format_date } from './utils';

export interface DocumentoParaDossie {
  nome: string;
  buffer: Buffer;
}

export interface MetaDossie {
  orgaoNome: string;
  cnpj: string;
  quantidadeVeiculos: number;
  dataEmissao: Date;
}

export async function montarDossieArtesp(
  documentos: DocumentoParaDossie[],
  meta: MetaDossie
): Promise<Buffer> {
  const dossie = await PDFDocument.create();
  const negrito = await dossie.embedFont(StandardFonts.HelveticaBold);
  const normal = await dossie.embedFont(StandardFonts.Helvetica);

  const capa = dossie.addPage([595.28, 841.89]); // A4
  let y = 760;

  capa.drawText('DOSSIÊ ARTESP', { x: 50, y, size: 20, font: negrito });
  y -= 26;
  capa.drawText('Cadastro de frota para isenção de pedágio — Portaria ARTESP nº 56/2025', {
    x: 50,
    y,
    size: 10,
    font: normal,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 40;
  capa.drawText(meta.orgaoNome, { x: 50, y, size: 12, font: negrito });
  y -= 16;
  capa.drawText(`CNPJ ${meta.cnpj}`, { x: 50, y, size: 10, font: normal });
  y -= 16;
  capa.drawText(
    `Emitido em ${format_date(meta.dataEmissao)} — ${meta.quantidadeVeiculos} veículo(s) na frota`,
    { x: 50, y, size: 10, font: normal }
  );
  y -= 40;
  capa.drawText('Documentos incluídos neste dossiê:', { x: 50, y, size: 11, font: negrito });
  y -= 22;

  for (const [indice, documento] of documentos.entries()) {
    capa.drawText(`${indice + 1}. ${documento.nome}`, { x: 60, y, size: 10, font: normal });
    y -= 18;
  }

  for (const documento of documentos) {
    const origem = await PDFDocument.load(documento.buffer);
    const paginas = await dossie.copyPages(origem, origem.getPageIndices());
    for (const pagina of paginas) dossie.addPage(pagina);
  }

  const todasAsPaginas = dossie.getPages();
  const total = todasAsPaginas.length;
  todasAsPaginas.forEach((pagina, indice) => {
    const tamanho = pagina.getSize();
    pagina.drawText(`Página ${indice + 1} de ${total}`, {
      x: tamanho.width - 110,
      y: 24,
      size: 8,
      font: normal,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return Buffer.from(await dossie.save());
}
