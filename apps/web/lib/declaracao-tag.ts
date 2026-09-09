import {
  Document,
  Packer,
  Paragraph,
  TextRun,
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
 * cru -- ver oficio-docx.ts, artesp-documentos.ts): esta é uma peça
 * própria da Isenta, sem template de terceiro a preservar, e precisa
 * existir mesmo para órgão sem timbre próprio cadastrado (a maioria). Por
 * isso é montada do zero com a lib `docx`, em vez do padrão de enxerto.
 */

export interface VeiculoParaDeclaracao {
  plate: string;
  renavam: string;
  marca: string | null;
  modelo: string | null;
  /** Não-nula por construção: quem chama já garantiu que todo veículo tem TAG antes de gerar. */
  tag: string;
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

/** Monta o .docx e tenta convertê-lo pra PDF -- nunca lança por causa da conversão, só devolve o .docx nesse caso. */
export async function gerarDeclaracaoTag(
  orgao: OrgaoDoOficio,
  veiculos: VeiculoParaDeclaracao[],
  protocolo: string
): Promise<DocumentoGerado> {
  const nomeOrgao = orgao.razaoSocial || orgao.name;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const localEmissao = orgao.cidadeEmissao || orgao.city;

  const linhasVeiculos = veiculos.map(
    v =>
      new TableRow({
        children: [
          celula(v.plate),
          celula([v.marca, v.modelo].filter(Boolean).join(' ') || '—'),
          celula(v.renavam),
          celula(v.tag),
        ],
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
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
                children: [celula('Placa', true), celula('Marca/Modelo', true), celula('RENAVAM', true), celula('TAG', true)],
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
