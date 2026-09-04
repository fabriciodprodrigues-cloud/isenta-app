import JSZip from 'jszip';
import type { DadosParaModelo, DocumentoGerado, MapeamentoCamposXlsx } from './modelo-documento-tipos';
import { enderecoCompleto } from './oficio-dados';

/**
 * Preenchimento de .xlsx via manipulação direta do XML interno (mesma
 * filosofia de oficio-docx.ts para .docx), em vez de uma lib como exceljs.
 *
 * Motivo: o formulário real que motivou este gerador (Rota Verde, FOR.CCA.02)
 * está em OOXML *strict* conformance, que várias libs JS de alto nível não
 * leem corretamente (assumem só o perfil *transitional*, muito mais comum).
 * Manipular o XML bruto via JSZip não depende de nenhuma lib entender o
 * arquivo inteiro -- só precisa achar <row>/<c> por regex, que é estável
 * entre os dois perfis (a diferença strict/transitional está em namespaces e
 * elementos que este código nunca toca).
 *
 * Usa inline strings (`t="inlineStr"`) em vez de sharedStrings.xml: evita
 * gerenciar a tabela de strings compartilhadas à mão, ao custo de um xlsx
 * ligeiramente maior -- irrelevante para um formulário de poucas páginas.
 */
export class ModeloXlsxInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Modelo de documento (.xlsx) inválido: ${motivo}`);
    this.name = 'ModeloXlsxInvalidoError';
  }
}

interface LinhaXml {
  numero: number;
  xml: string;
}

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extrairLinhas(sheetDataXml: string): LinhaXml[] {
  const linhas: LinhaXml[] = [];
  const regexLinha = /<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g;
  let m: RegExpExecArray | null;
  while ((m = regexLinha.exec(sheetDataXml)) !== null) {
    linhas.push({ numero: Number(m[1]), xml: m[0] });
  }
  return linhas;
}

/** Troca o r="N" da tag <row> e de cada <c r="COLn"> dentro dela para novoNumero. */
function renumerarLinha(xml: string, novoNumero: number): string {
  const comLinhaNova = xml.replace(/(<row\b[^>]*\br=")\d+(")/, `$1${novoNumero}$2`);
  return comLinhaNova.replace(/(<c\b[^>]*\br=")([A-Z]+)\d+(")/g, `$1$2${novoNumero}$3`);
}

/**
 * Substitui (ou insere, se ausente) o conteúdo da célula `coluna+numeroLinha`
 * dentro do XML de uma linha, preservando o atributo de estilo (s=) se a
 * célula já existia -- é o que mantém borda/fonte/formato do template.
 */
function definirCelula(linhaXml: string, coluna: string, numeroLinha: number, valor: string): string {
  const ref = `${coluna}${numeroLinha}`;
  const regexCelula = new RegExp(
    `<c\\b[^>]*\\br="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`
  );
  const existente = linhaXml.match(regexCelula);
  const valorEscapado = escaparXml(valor);

  if (existente) {
    const matchEstilo = existente[0].match(/\bs="(\d+)"/);
    const atributoEstilo = matchEstilo ? ` s="${matchEstilo[1]}"` : '';
    const novaCelula = `<c r="${ref}"${atributoEstilo} t="inlineStr"><is><t xml:space="preserve">${valorEscapado}</t></is></c>`;
    return linhaXml.replace(regexCelula, novaCelula);
  }

  // Célula ausente na linha (form esparso): insere antes do fechamento
  // </row>. Não respeita ordem de coluna estritamente, mas Excel/LibreOffice
  // toleram leitura fora de ordem -- só a gravação nativa costuma manter.
  const novaCelula = `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${valorEscapado}</t></is></c>`;
  if (linhaXml.endsWith('/>')) {
    // <row .../> auto-fechada, sem células -- vira <row ...>conteúdo</row>.
    return linhaXml.replace(/\/>$/, `>${novaCelula}</row>`);
  }
  return linhaXml.replace(/<\/row>$/, `${novaCelula}</row>`);
}

function montarValorCampo(chave: string, dados: DadosParaModelo): string {
  switch (chave) {
    case 'responsavelNome':
      return dados.orgao.responsibleName;
    case 'responsavelCpf':
      return '';
    case 'orgaoNome':
      return dados.orgao.razaoSocial || dados.orgao.name;
    case 'orgaoCnpj':
      return dados.orgao.cnpj;
    case 'orgaoEndereco':
      return enderecoCompleto(dados.orgao);
    case 'orgaoTelefone':
      return dados.orgao.responsiblePhone;
    case 'orgaoEmail':
      return dados.orgao.responsibleEmail;
    case 'data':
      return dados.dataAtual.toLocaleDateString('pt-BR');
    default:
      return '';
  }
}

function valorColunaVeiculo(chave: string, veiculo: DadosParaModelo['veiculos'][number], dados: DadosParaModelo): string {
  switch (chave) {
    case 'veiculo':
      return [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || veiculo.type;
    case 'marca':
      return veiculo.marca ?? '';
    case 'modelo':
      return veiculo.modelo ?? '';
    case 'ano':
      return String(veiculo.anoModelo ?? veiculo.anoFabricacao ?? '');
    case 'placa':
      return veiculo.plate;
    case 'renavam':
      return veiculo.renavam;
    case 'tipo':
      return veiculo.type;
    case 'cor':
      return veiculo.cor ?? '';
    case 'cnpjCpf':
      return dados.orgao.cnpj;
    case 'observacao':
      return '';
    default:
      return '';
  }
}

export async function gerarDocumentoXlsx(
  dados: DadosParaModelo,
  modeloBuffer: Buffer,
  mapeamento: MapeamentoCamposXlsx
): Promise<DocumentoGerado> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(modeloBuffer);
  } catch {
    throw new ModeloXlsxInvalidoError('arquivo não é um .xlsx/zip válido');
  }

  const caminhoSheet = 'xl/worksheets/sheet1.xml';
  const arquivoSheet = zip.file(caminhoSheet);
  if (!arquivoSheet) {
    throw new ModeloXlsxInvalidoError(`${caminhoSheet} não encontrado -- verifique se é a planilha certa`);
  }

  const sheetXmlOriginal = await arquivoSheet.async('string');

  const inicioSheetData = sheetXmlOriginal.indexOf('<sheetData>');
  const fimSheetData = sheetXmlOriginal.indexOf('</sheetData>');
  if (inicioSheetData === -1 || fimSheetData === -1) {
    throw new ModeloXlsxInvalidoError('<sheetData> não encontrado no XML da planilha');
  }

  const antes = sheetXmlOriginal.slice(0, inicioSheetData + '<sheetData>'.length);
  const sheetDataXml = sheetXmlOriginal.slice(inicioSheetData + '<sheetData>'.length, fimSheetData);
  const depois = sheetXmlOriginal.slice(fimSheetData);

  const linhas = extrairLinhas(sheetDataXml);
  if (linhas.length === 0) {
    throw new ModeloXlsxInvalidoError('nenhuma <row> encontrada em <sheetData> -- planilha vazia ou formato inesperado');
  }

  // 1) Campos de nível-órgão: um valor por célula, sem afetar outras linhas.
  for (const [chave, celula] of Object.entries(mapeamento.campos)) {
    if (!celula) continue;
    const referencia = celula.match(/^([A-Z]+)(\d+)$/);
    if (!referencia) {
      throw new ModeloXlsxInvalidoError(`referência de célula inválida para "${chave}": "${celula}"`);
    }
    const [, coluna, numeroStr] = referencia;
    const numero = Number(numeroStr);
    const linha = linhas.find(l => l.numero === numero);
    if (!linha) {
      throw new ModeloXlsxInvalidoError(`linha ${numero} (célula ${celula}, campo "${chave}") não existe na planilha-modelo`);
    }
    linha.xml = definirCelula(linha.xml, coluna, numero, montarValorCampo(chave, dados));
  }

  // 2) Tabela de veículos: clona a linha-molde (linhaInicial) uma vez por
  // veículo, e desloca todas as linhas abaixo dela em (nVeiculos - 1).
  const { linhaInicial, colunas } = mapeamento.tabelaVeiculos;
  const indiceLinhaModelo = linhas.findIndex(l => l.numero === linhaInicial);
  if (indiceLinhaModelo === -1) {
    throw new ModeloXlsxInvalidoError(`linha inicial da tabela de veículos (${linhaInicial}) não existe na planilha-modelo`);
  }

  const linhaModelo = linhas[indiceLinhaModelo];
  const deslocamento = dados.veiculos.length - 1;

  const linhasVeiculos: LinhaXml[] = dados.veiculos.map((veiculo, indice) => {
    const numeroNovaLinha = linhaInicial + indice;
    let xml = renumerarLinha(linhaModelo.xml, numeroNovaLinha);
    for (const [chave, coluna] of Object.entries(colunas)) {
      if (!coluna) continue;
      xml = definirCelula(xml, coluna, numeroNovaLinha, valorColunaVeiculo(chave, veiculo, dados));
    }
    return { numero: numeroNovaLinha, xml };
  });

  const linhasFinais: LinhaXml[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (i === indiceLinhaModelo) {
      linhasFinais.push(...linhasVeiculos);
    } else if (linhas[i].numero > linhaInicial) {
      linhasFinais.push({
        numero: linhas[i].numero + deslocamento,
        xml: deslocamento === 0 ? linhas[i].xml : renumerarLinha(linhas[i].xml, linhas[i].numero + deslocamento),
      });
    } else {
      linhasFinais.push(linhas[i]);
    }
  }

  const sheetDataFinal = linhasFinais.map(l => l.xml).join('');

  let sheetXmlFinal = antes + sheetDataFinal + depois;

  // <dimension ref="A1:H20"> -- ajusta a última linha da referência se
  // presente, para a planilha não aparecer "cortada" em alguns leitores.
  if (deslocamento !== 0) {
    sheetXmlFinal = sheetXmlFinal.replace(
      /(<dimension\s+ref="[A-Z]+\d+:[A-Z]+)(\d+)(")/,
      (match, prefixo, numeroStr, sufixo) => `${prefixo}${Number(numeroStr) + deslocamento}${sufixo}`
    );
  }

  zip.file(caminhoSheet, sheetXmlFinal);

  const buffer = (await zip.generateAsync({ type: 'nodebuffer' })) as Buffer;

  return {
    buffer,
    fileName: `${dados.concessionariaNome} - ${dados.protocolo}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
