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
import { montarDocumentoDocx, carregarModeloOficio } from './oficio-docx';
import { p, run, RUN_NEGRITO, JUSTIFICADO, ESPACO_DEPOIS, paragrafoVazio, tabelaSimples } from './word-xml';

/**
 * Declaração de Instalação de TAG -- anexo obrigatório em todo envio (ver
 * seção 4-A da especificação do módulo de modelos de documento), separado
 * do ofício/formulário da concessionária, nunca no lugar dele.
 *
 * Duas técnicas, na ordem de preferência:
 * 1. Órgão com `modeloOficioUrl` (timbre em .docx): enxerta o corpo no
 *    mesmo timbre usado no ofício e no dossiê ARTESP, via
 *    montarDocumentoDocx() -- padrão de fidelidade visual do resto do
 *    sistema (brasão/cabeçalho reais, não uma imagem solta).
 * 2. Sem modelo: monta do zero com a lib `docx`, tentando embutir
 *    `Account.timbreUrl` (imagem solta) como fallback -- só funciona se
 *    esse campo realmente apontar para uma imagem (confirmado nesta sessão
 *    que pode estar dessincronizado; por isso é só o plano B, nunca a
 *    primeira tentativa quando existe um modelo de verdade).
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

/** "07519786249 (Sem Parar)" -- mesma convenção já usada em artesp-documentos.ts pra combinar serial e operadora numa só coluna. */
function tagComOperadora(v: VeiculoParaDeclaracao): string {
  return v.tagOperadora ? `${v.tag} (${v.tagOperadora})` : v.tag;
}

// --- Técnica 1: enxerto no timbre real do órgão (WordprocessingML) ---

function cabecalhoOrgao(orgao: OrgaoDoOficio): string {
  const razao = orgao.razaoSocial || orgao.name;
  return (
    p(run(razao, RUN_NEGRITO)) +
    p(run(`CNPJ ${orgao.cnpj}`)) +
    p(run(enderecoCompleto(orgao)), ESPACO_DEPOIS(240))
  );
}

function assinaturaResponsavel(orgao: OrgaoDoOficio): string {
  return (
    p(run(orgao.responsibleName, RUN_NEGRITO), ESPACO_DEPOIS(0)) +
    p(run(orgao.responsibleRole || 'Responsável'))
  );
}

function tabelaFrota(veiculos: VeiculoParaDeclaracao[]): string {
  const cabecalho = ['Placa', 'Marca/Modelo', 'RENAVAM', 'TAG (operadora)'];
  const larguras = [1600, 3200, 2000, 2600];
  const linhas = veiculos.map(v => [
    v.plate,
    [v.marca, v.modelo].filter(Boolean).join(' ') || '—',
    v.renavam,
    tagComOperadora(v),
  ]);
  return tabelaSimples(cabecalho, larguras, linhas) + paragrafoVazio();
}

function montarCorpoDeclaracaoTagWordXml(
  orgao: OrgaoDoOficio,
  veiculos: VeiculoParaDeclaracao[],
  protocolo: string
): string {
  const razao = orgao.razaoSocial || orgao.name;
  const localEmissao = orgao.cidadeEmissao || orgao.city;
  const hoje = new Date().toLocaleDateString('pt-BR');

  return (
    cabecalhoOrgao(orgao) +
    p(run('DECLARAÇÃO DE INSTALAÇÃO DE TAG', RUN_NEGRITO), ESPACO_DEPOIS(240)) +
    p(
      run(
        `A ${razao}, CNPJ nº ${orgao.cnpj}, declara, para os devidos fins junto à concessionária, ` +
          `que a(s) TAG(s) relacionada(s) abaixo está(ão) corretamente instalada(s) no(s) ` +
          `respectivo(s) veículo(s), e que pertence(m) à frota oficial do órgão, para fins de ` +
          `isenção de pedágio.`
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    ) +
    tabelaFrota(veiculos) +
    p(run(`${localEmissao}, ${hoje}.`), ESPACO_DEPOIS(360)) +
    assinaturaResponsavel(orgao) +
    paragrafoVazio() +
    p(run(`Protocolo ${protocolo} — Sistema Isenta`))
  );
}

// --- Técnica 2: montada do zero (sem timbre real disponível) ---

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

function lerDimensoesImagem(buffer: Buffer, tipo: 'png' | 'jpg'): { width: number; height: number } | null {
  try {
    if (tipo === 'png') {
      if (buffer.length < 24) return null;
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marcador = buffer[offset + 1];
      const eSOF = marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
      if (eSOF) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      // Marcadores sem campo de tamanho (SOI/EOI/RST/TEM) não têm o que pular
      // por comprimento -- avança 2 bytes só, senão o parser desalinha e
      // corre risco de ler lixo como um tamanho de segmento gigante.
      if (marcador === 0xd8 || marcador === 0xd9 || (marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) {
        offset += 2;
        continue;
      }
      const tamanhoSegmento = buffer.readUInt16BE(offset + 2);
      offset += 2 + tamanhoSegmento;
    }
    return null;
  } catch {
    return null;
  }
}

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
    // Campo pode apontar pra algo que não é imagem (já confirmado acontecer
    // nesta sessão -- um timbreUrl dessincronizado apontando pra um .docx).
    // Sem isso, o resto do gerador (técnica 2) segue sem timbre, igual a
    // não ter nenhum -- nunca quebra o documento por causa disso.
    if (!tipo) {
      console.error(`timbreUrl não aponta para uma imagem válida (content-type: ${contentType || 'desconhecido'})`);
      return null;
    }

    const buffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());
    const dimensoes = lerDimensoesImagem(buffer, tipo);
    const LARGURA_ALVO = 180;
    const alturaProporcional = dimensoes ? Math.round((dimensoes.height / dimensoes.width) * LARGURA_ALVO) : 60;

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

async function gerarDeclaracaoTagDoZero(
  orgao: OrgaoDoOficio,
  veiculos: VeiculoParaDeclaracao[],
  protocolo: string,
  timbreUrl: string | null | undefined
): Promise<Buffer> {
  const nomeOrgao = orgao.razaoSocial || orgao.name;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const localEmissao = orgao.cidadeEmissao || orgao.city;
  const imagemTimbre = await carregarTimbrePraImageRun(timbreUrl);

  const linhasVeiculos = veiculos.map(
    v =>
      new TableRow({
        children: [celula(v.plate), celula([v.marca, v.modelo].filter(Boolean).join(' ') || '—'), celula(v.renavam), celula(tagComOperadora(v))],
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          ...(imagemTimbre
            ? [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun(imagemTimbre)] }),
                new Paragraph({ text: '' }),
              ]
            : []),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'DECLARAÇÃO DE INSTALAÇÃO DE TAG', bold: true, color: COR_TITULO, size: 28 })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ children: [new TextRun({ text: 'Órgão: ', bold: true }), new TextRun(`${nomeOrgao} — CNPJ ${orgao.cnpj}`)] }),
          new Paragraph({ children: [new TextRun({ text: 'Endereço: ', bold: true }), new TextRun(enderecoCompleto(orgao))] }),
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
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: orgao.responsibleName, bold: true })] }),
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

  return Packer.toBuffer(doc);
}

/**
 * Monta o documento (enxertado no timbre real se `modeloOficioUrl` existir,
 * senão do zero) e tenta convertê-lo pra PDF -- nunca lança por causa da
 * conversão, só devolve o .docx nesse caso.
 */
export async function gerarDeclaracaoTag(
  orgao: OrgaoDoOficio,
  veiculos: VeiculoParaDeclaracao[],
  protocolo: string,
  modeloOficioUrl?: string | null,
  timbreUrl?: string | null
): Promise<DocumentoGerado> {
  const nomeOrgao = orgao.razaoSocial || orgao.name;
  const nomeBase = `Declaracao TAG - ${nomeOrgao}`;

  let docxBuffer: Buffer | null = null;

  if (modeloOficioUrl) {
    const modelo = await carregarModeloOficio(modeloOficioUrl);
    if (modelo) {
      try {
        const corpo = montarCorpoDeclaracaoTagWordXml(orgao, veiculos, protocolo);
        docxBuffer = await montarDocumentoDocx(corpo, modelo);
      } catch (erro) {
        console.error(`Falha ao enxertar a declaração de TAG no timbre de ${nomeOrgao}, caindo pro modelo genérico:`, erro);
      }
    }
  }

  if (!docxBuffer) {
    docxBuffer = await gerarDeclaracaoTagDoZero(orgao, veiculos, protocolo, timbreUrl);
  }

  try {
    const pdf = await converterParaPdf(docxBuffer, 'docx');
    return { buffer: pdf, fileName: `${nomeBase}.pdf`, mimeType: 'application/pdf' };
  } catch (erro) {
    console.error('Falha ao converter a declaração de TAG para PDF, anexando .docx:', erro);
    return {
      buffer: docxBuffer,
      fileName: `${nomeBase}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
}
