import { get } from '@vercel/blob';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import type { OrgaoDoOficio } from './oficio-dados';
import { enderecoCompleto } from './oficio-dados';
import { converterParaPdf } from './email-service';

/**
 * Declaração de Instalação de TAG -- anexo obrigatório em todo envio (ver
 * seção 4-A da especificação do módulo de modelos de documento), separado
 * do ofício/formulário da concessionária, nunca no lugar dele.
 *
 * Diferente dos outros documentos gerados no sistema (que enxertam um
 * corpo dentro do .docx de timbre de terceiro, via JSZip/WordprocessingML
 * cru -- ver oficio-docx.ts, artesp-documentos.ts): esta é montada do zero
 * com a lib `docx`, e usa o timbre do órgão (Account.timbreUrl, a mesma
 * imagem usada no HTML do ofício genérico) como uma imagem no topo, em vez
 * de enxertar num .docx de terceiro -- funciona mesmo pra órgão sem
 * modeloOficioUrl (a maioria), que é a maior parte dos casos.
 */

export interface VeiculoParaDeclaracao {
  plate: string;
  renavam: string;
  marca: string | null;
  modelo: string | null;
  /** Não-nula por construção: quem chama já garantiu que todo veículo tem TAG antes de gerar. */
  tag: string;
  /** Marca/operadora da TAG (Sem Parar, ConectCar, Veloe...) -- opcional, nem toda TAG tem isso preenchido. */
  tagOperadora: string | null;
}

export interface DocumentoGerado {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

const COR_TITULO = '1B4332';
const COR_LINHA = '2D6A4F';

function celula(texto: string, cabecalho = false): TableCell {
  return new TableCell({
    width: { size: 20, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text: texto, bold: cabecalho, color: cabecalho ? 'FFFFFF' : undefined })],
      }),
    ],
    shading: cabecalho ? { fill: COR_LINHA } : undefined,
  });
}

/** "07519786249 (Sem Parar)" -- mesma convenção já usada em artesp-documentos.ts pra combinar serial e operadora numa só coluna. */
function tagComOperadora(v: VeiculoParaDeclaracao): string {
  return v.tagOperadora ? `${v.tag} (${v.tagOperadora})` : v.tag;
}

/** Lê largura/altura de um PNG ou JPEG sem depender de nenhuma lib -- os dois formatos aceitos no upload do timbre (ver identidade/timbre/route.ts). */
function lerDimensoesImagem(buffer: Buffer, tipo: 'png' | 'jpg'): { width: number; height: number } | null {
  try {
    if (tipo === 'png') {
      // Assinatura PNG (8 bytes) + chunk IHDR: 4 bytes de tamanho + "IHDR" + largura(4) + altura(4).
      if (buffer.length < 24) return null;
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    // JPEG: percorre os marcadores até achar um SOFn (início de frame), que
    // guarda altura/largura logo após precisão (1 byte) no início do segmento.
    let offset = 2; // pula o marcador SOI (0xFFD8)
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marcador = buffer[offset + 1];
      const eSOF =
        marcador >= 0xc0 &&
        marcador <= 0xcf &&
        marcador !== 0xc4 &&
        marcador !== 0xc8 &&
        marcador !== 0xcc;

      if (eSOF) {
        const altura = buffer.readUInt16BE(offset + 5);
        const largura = buffer.readUInt16BE(offset + 7);
        return { width: largura, height: altura };
      }

      const tamanhoSegmento = buffer.readUInt16BE(offset + 2);
      offset += 2 + tamanhoSegmento;
    }
    return null;
  } catch {
    return null;
  }
}

/** Baixa o timbre do órgão (mesma imagem do ofício genérico) e devolve pronto pra embutir no docx, já redimensionado. */
async function carregarTimbrePraImageRun(
  timbreUrl: string | null | undefined
): Promise<{ data: Buffer; type: 'png' | 'jpg'; transformation: { width: number; height: number } } | null> {
  if (!timbreUrl) return null;

  try {
    const resultado = await get(timbreUrl, { access: 'private' });
    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) return null;

    const contentType = resultado.blob.contentType ?? '';
    const tipo: 'png' | 'jpg' | null = contentType.includes('png')
      ? 'png'
      : contentType.includes('jpeg') || contentType.includes('jpg')
        ? 'jpg'
        : null;
    if (!tipo) return null;

    const buffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());
    const dimensoes = lerDimensoesImagem(buffer, tipo);

    // Sem conseguir ler as dimensões reais, cai pra uma caixa fixa razoável
    // em vez de não mostrar o timbre -- pode distorcer levemente, mas é
    // melhor que omitir a identidade visual do órgão.
    const LARGURA_ALVO = 180;
    const alturaProporcional = dimensoes
      ? Math.round((dimensoes.height / dimensoes.width) * LARGURA_ALVO)
      : 60;

    return {
      data: buffer,
      type: tipo,
      transformation: { width: LARGURA_ALVO, height: Math.min(alturaProporcional, 110) },
    };
  } catch (erro) {
    console.error('Falha ao carregar o timbre para a declaração de TAG:', erro);
    return null;
  }
}

/** Monta o .docx e tenta convertê-lo pra PDF -- nunca lança por causa da conversão, só devolve o .docx nesse caso. */
export async function gerarDeclaracaoTag(
  orgao: OrgaoDoOficio,
  veiculos: VeiculoParaDeclaracao[],
  protocolo: string,
  timbreUrl?: string | null
): Promise<DocumentoGerado> {
  const nomeOrgao = orgao.razaoSocial || orgao.name;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const localEmissao = orgao.cidadeEmissao || orgao.city;
  const imagemTimbre = await carregarTimbrePraImageRun(timbreUrl);

  const linhasVeiculos = veiculos.map(
    v =>
      new TableRow({
        children: [
          celula(v.plate),
          celula([v.marca, v.modelo].filter(Boolean).join(' ') || '—'),
          celula(v.renavam),
          celula(tagComOperadora(v)),
        ],
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          ...(imagemTimbre
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new ImageRun(imagemTimbre)],
                }),
                new Paragraph({ text: '' }),
              ]
            : []),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'DECLARAÇÃO DE INSTALAÇÃO DE TAG', bold: true, color: COR_TITULO, size: 28 })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Órgão: ', bold: true }),
              new TextRun(`${nomeOrgao} — CNPJ ${orgao.cnpj}`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Endereço: ', bold: true }),
              new TextRun(enderecoCompleto(orgao)),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Responsável: ', bold: true }),
              new TextRun(`${orgao.responsibleName}${orgao.responsibleRole ? ` — ${orgao.responsibleRole}` : ''}`),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun(
                `Declaro, para os devidos fins junto à concessionária, que a(s) TAG(s) relacionada(s) ` +
                  `abaixo está(ão) corretamente instalada(s) no(s) respectivo(s) veículo(s), e que ` +
                  `pertence(m) à frota oficial de ${nomeOrgao}, para fins de isenção de pedágio.`
              ),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            rows: [
              new TableRow({
                children: [celula('Placa', true), celula('Marca/Modelo', true), celula('RENAVAM', true), celula('TAG (operadora)', true)],
              }),
              ...linhasVeiculos,
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: `${localEmissao}, ${hoje}.` }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('_'.repeat(40))] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: orgao.responsibleName, bold: true })],
          }),
          ...(orgao.responsibleRole
            ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(orgao.responsibleRole)] })]
            : []),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Protocolo ${protocolo} — Sistema Isenta`, size: 16, color: '888888' })],
          }),
        ],
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const nomeBase = `Declaracao TAG - ${nomeOrgao}`;

  try {
    const pdf = await converterParaPdf(docxBuffer, 'docx');
    return { buffer: pdf, fileName: `${nomeBase}.pdf`, mimeType: 'application/pdf' };
  } catch (erro) {
    // Falha de rede/relay não pode travar um envio real -- devolve o .docx,
    // que já é um documento válido e assinável, em vez do PDF.
    console.error('Falha ao converter a declaração de TAG para PDF, anexando .docx:', erro);
    return {
      buffer: docxBuffer,
      fileName: `${nomeBase}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
}
