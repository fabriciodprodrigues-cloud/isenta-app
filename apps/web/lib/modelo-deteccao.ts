import JSZip from 'jszip';
import { ModeloDocxInvalidoError } from './modelo-docx';
import { ModeloXlsxInvalidoError, extrairLinhas } from './modelo-xlsx';
import { CAMPOS_ORGAO_CONHECIDOS, CAMPOS_VEICULO_CONHECIDOS } from './modelo-documento-tipos';

/**
 * Detecção automática dos campos de um modelo já enviado pela concessionária,
 * pra pré-preencher a tela de mapeamento -- sempre sugestão revisável, nunca
 * grava nada sozinha (mesma filosofia da extração de CRLV: palpite, não
 * decisão). Usa a mesma técnica de manipular o XML/zip cru em vez de libs de
 * alto nível, pelo mesmo motivo de oficio-docx.ts/modelo-xlsx.ts (OOXML
 * strict do Rota Verde).
 */

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function decodificarEntidadesXml(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

export interface DeteccaoDocx {
  tagsEncontradas: string[];
  temLoopVeiculos: boolean;
  sugestoesCampos: Record<string, string>;
}

export async function detectarCamposDocx(buffer: Buffer): Promise<DeteccaoDocx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ModeloDocxInvalidoError('arquivo não é um .docx/zip válido');
  }

  const arquivoDocumento = zip.file('word/document.xml');
  if (!arquivoDocumento) {
    throw new ModeloDocxInvalidoError('word/document.xml não encontrado -- verifique se é um .docx válido');
  }
  const documentoXml = await arquivoDocumento.async('string');

  // Word costuma quebrar um mesmo trecho de texto em múltiplos <w:t>
  // (autocorreção/revisão): concatenar todo texto na ordem do documento, sem
  // separador, reconstitui tags partidas entre runs -- regexar o XML bruto
  // direto falha nesse caso.
  const textoConcatenado = Array.from(documentoXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
    .map(m => decodificarEntidadesXml(m[1]))
    .join('');

  const tagsBrutas = Array.from(textoConcatenado.matchAll(/\{\{\s*(#?\/?[a-zA-Z0-9_]+)\s*\}\}/g)).map(m => m[1]);

  const tagsEncontradas = Array.from(
    new Set(tagsBrutas.filter(t => !t.startsWith('#') && !t.startsWith('/')))
  );
  const temLoopVeiculos = tagsBrutas.includes('#veiculos') && tagsBrutas.includes('/veiculos');

  const sugestoesCampos: Record<string, string> = {};
  for (const campo of CAMPOS_ORGAO_CONHECIDOS) {
    const sinonimos = SINONIMOS_CAMPO_ORGAO[campo].concat(normalizar(campo));
    const exatas = tagsEncontradas.filter(tag => correspondeCelula(sinonimos, normalizar(tag.replace(/[_-]/g, ' '))) === 'exato');
    // Prioriza correspondência exata; só recorre a substring (confiança
    // menor) se não houve nenhuma exata -- em ambos os casos, só assume o
    // palpite se for candidata única (ambíguo fica de fora, nunca um chute).
    const candidatas =
      exatas.length > 0
        ? exatas
        : tagsEncontradas.filter(tag => correspondeCelula(sinonimos, normalizar(tag.replace(/[_-]/g, ' '))) === 'parcial');
    if (candidatas.length === 1) {
      sugestoesCampos[campo] = candidatas[0];
    }
  }

  return { tagsEncontradas, temLoopVeiculos, sugestoesCampos };
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

export interface DeteccaoXlsx {
  sugestoesCampos: Record<string, string>;
  sugestaoTabela: { linhaInicial: number; colunas: Record<string, string> } | null;
  avisos: string[];
}

interface CelulaLida {
  ref: string;
  linha: number;
  coluna: string;
  texto: string | null;
  normalizado: string;
}

function letraColuna(ref: string): string {
  return ref.match(/^([A-Z]+)\d+$/)?.[1] ?? '';
}

function indiceColuna(letra: string): number {
  let indice = 0;
  for (const char of letra) {
    indice = indice * 26 + (char.charCodeAt(0) - 64);
  }
  return indice;
}

async function extrairSharedStrings(zip: JSZip): Promise<string[]> {
  const arquivo = zip.file('xl/sharedStrings.xml');
  if (!arquivo) return [];
  const xml = await arquivo.async('string');
  const itens = Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g));
  return itens.map(([, conteudoSi]) => {
    // Cobre rich-text (múltiplos <r><t>...</t></r>) e <t> simples.
    const textos = Array.from(conteudoSi.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(m => decodificarEntidadesXml(m[1]));
    return textos.join('');
  });
}

function lerCelulasDaLinha(linhaXml: string, sharedStrings: string[]): CelulaLida[] {
  const celulas: CelulaLida[] = [];
  // Captura os atributos da tag <c> à parte do conteúdo, e resolve r=/t=
  // dentro deles com regexes independentes -- uma tentativa anterior tentava
  // casar r="..." e t="..." na ordem em que costumam aparecer com um só
  // regex, mas como t= vem depois de r= e é opcional, o motor de regex
  // aceitava um match sem nunca tentar preencher o grupo de t= (o
  // quantificador guloso seguinte engolia o atributo inteiro sem capturá-lo).
  const regexCelula = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = regexCelula.exec(linhaXml)) !== null) {
    const [, atributos, conteudoInterno] = m;
    const ref = atributos.match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!ref) continue;
    const tipo = atributos.match(/\bt="([^"]*)"/)?.[1];
    const linha = Number(ref.match(/\d+$/)![0]);
    const coluna = letraColuna(ref);
    let texto: string | null = null;

    if (tipo === 's') {
      const indice = conteudoInterno?.match(/<v>(\d+)<\/v>/)?.[1];
      if (indice !== undefined) texto = sharedStrings[Number(indice)] ?? null;
    } else if (tipo === 'inlineStr' || tipo === 'str') {
      const textos = Array.from((conteudoInterno ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(t =>
        decodificarEntidadesXml(t[1])
      );
      texto = textos.length > 0 ? textos.join('') : null;
    } else if (tipo === 'b') {
      texto = null;
    } else {
      // sem t= (numérico) ou t="n" -- não é candidato a rótulo.
      texto = null;
    }

    celulas.push({ ref, linha, coluna, texto, normalizado: texto ? normalizar(texto) : '' });
  }
  return celulas;
}

const SINONIMOS_CAMPO_ORGAO: Record<(typeof CAMPOS_ORGAO_CONHECIDOS)[number], string[]> = {
  responsavelNome: ['nome do responsavel', 'responsavel', 'representante legal', 'representante'],
  responsavelCpf: ['cpf do responsavel', 'cpf'],
  orgaoNome: ['nome do orgao', 'orgao', 'instituicao', 'razao social', 'empresa'],
  orgaoCnpj: ['cnpj do orgao', 'cnpj'],
  orgaoEndereco: ['endereco', 'endereco completo', 'endereco fisico', 'logradouro'],
  orgaoTelefone: ['telefone', 'telefone de contato', 'contato', 'fone'],
  orgaoEmail: ['email', 'e-mail', 'endereco eletronico', 'correio eletronico'],
  data: ['data', 'data da solicitacao', 'data do pedido', 'data de emissao'],
};

const SINONIMOS_CAMPO_VEICULO: Record<(typeof CAMPOS_VEICULO_CONHECIDOS)[number], string[]> = {
  veiculo: ['veiculo', 'descricao do veiculo', 'marca/modelo'],
  marca: ['marca'],
  modelo: ['modelo'],
  ano: ['ano', 'ano modelo', 'ano fabricacao'],
  placa: ['placa'],
  renavam: ['renavam', 'codigo renavam'],
  tipo: ['tipo', 'tipo de veiculo', 'proprio/locado'],
  cor: ['cor'],
  cnpjCpf: ['cnpj/cpf', 'cpf/cnpj', 'documento'],
  observacao: ['observacao', 'obs'],
};

function correspondeCelula(sinonimos: string[], normalizado: string): 'exato' | 'parcial' | null {
  if (sinonimos.includes(normalizado)) return 'exato';
  if (sinonimos.some(s => normalizado.includes(s) || s.includes(normalizado))) return 'parcial';
  return null;
}

export async function detectarCamposXlsx(buffer: Buffer): Promise<DeteccaoXlsx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ModeloXlsxInvalidoError('arquivo não é um .xlsx/zip válido');
  }

  const caminhoSheet = 'xl/worksheets/sheet1.xml';
  const arquivoSheet = zip.file(caminhoSheet);
  if (!arquivoSheet) {
    throw new ModeloXlsxInvalidoError(`${caminhoSheet} não encontrado -- verifique se é a planilha certa`);
  }

  const sheetXml = await arquivoSheet.async('string');
  const inicioSheetData = sheetXml.indexOf('<sheetData>');
  const fimSheetData = sheetXml.indexOf('</sheetData>');
  if (inicioSheetData === -1 || fimSheetData === -1) {
    throw new ModeloXlsxInvalidoError('<sheetData> não encontrado no XML da planilha');
  }
  const sheetDataXml = sheetXml.slice(inicioSheetData + '<sheetData>'.length, fimSheetData);

  const sharedStrings = await extrairSharedStrings(zip);
  const linhas = extrairLinhas(sheetDataXml);
  if (linhas.length === 0) {
    throw new ModeloXlsxInvalidoError('nenhuma <row> encontrada em <sheetData> -- planilha vazia ou formato inesperado');
  }

  const celulasPorLinha = new Map<number, CelulaLida[]>();
  const todasCelulas: CelulaLida[] = [];
  for (const linha of linhas) {
    const celulas = lerCelulasDaLinha(linha.xml, sharedStrings);
    celulasPorLinha.set(linha.numero, celulas);
    todasCelulas.push(...celulas);
  }

  const avisos: string[] = [];

  // -- Campos de nível-órgão --------------------------------------------
  const sugestoesCampos: Record<string, string> = {};
  for (const campo of CAMPOS_ORGAO_CONHECIDOS) {
    const sinonimos = SINONIMOS_CAMPO_ORGAO[campo];
    // Prioriza correspondência exata; só recorre a substring (confiança
    // menor, ex.: "Assinatura do responsável" batendo com o sinônimo curto
    // "responsavel") se não houve nenhuma exata -- mesma tiebreak de
    // detectarCamposDocx.
    const exatas = todasCelulas.filter(c => c.texto && correspondeCelula(sinonimos, c.normalizado) === 'exato');
    const candidatas =
      exatas.length > 0 ? exatas : todasCelulas.filter(c => c.texto && correspondeCelula(sinonimos, c.normalizado) === 'parcial');
    if (candidatas.length === 0) continue;

    let rotulo = candidatas[0];
    if (candidatas.length > 1) {
      candidatas.sort((a, b) => a.linha - b.linha || indiceColuna(a.coluna) - indiceColuna(b.coluna));
      rotulo = candidatas[0];
      avisos.push(`Mais de uma célula parece ser o rótulo de "${campo}" -- usada a de menor posição (${rotulo.ref}), confira.`);
    }

    const celulasLinha = (celulasPorLinha.get(rotulo.linha) ?? []).sort(
      (a, b) => indiceColuna(a.coluna) - indiceColuna(b.coluna)
    );
    const indiceRotulo = celulasLinha.findIndex(c => c.ref === rotulo.ref);

    // 1) próxima célula ocupada na mesma linha à direita, se não for outro rótulo conhecido.
    let valor = celulasLinha
      .slice(indiceRotulo + 1)
      .find(c => c.texto && !correspondeCelula(sinonimos, c.normalizado) && !ehRotuloConhecido(c.normalizado));

    // 2) senão, próxima célula ocupada abaixo, mesma coluna.
    if (!valor) {
      const colunaRotulo = rotulo.coluna;
      valor = todasCelulas
        .filter(c => c.coluna === colunaRotulo && c.linha > rotulo.linha && c.texto)
        .sort((a, b) => a.linha - b.linha)[0];
    }

    if (valor) {
      sugestoesCampos[campo] = valor.ref;
    } else {
      avisos.push(`Rótulo de "${campo}" encontrado (${rotulo.ref}), mas nenhuma célula de valor próxima -- preencha manualmente.`);
    }
  }

  // -- Tabela de veículos --------------------------------------------------
  let melhorLinha: { numero: number; matches: Record<string, string> } | null = null;
  for (const linha of linhas) {
    const celulas = celulasPorLinha.get(linha.numero) ?? [];
    const matches: Record<string, string> = {};
    for (const celula of celulas) {
      if (!celula.texto) continue;
      // Cada célula reivindica no máximo um campo -- prioriza exata (ex.:
      // "Marca" -> marca) para não também bater por substring num sinônimo
      // composto de outro campo (ex.: "marca/modelo" de veiculo), o que
      // inflaria a contagem de colunas reconhecidas com falsos positivos.
      let candidato = CAMPOS_VEICULO_CONHECIDOS.find(
        campo => !matches[campo] && correspondeCelula(SINONIMOS_CAMPO_VEICULO[campo], celula.normalizado) === 'exato'
      );
      if (!candidato) {
        candidato = CAMPOS_VEICULO_CONHECIDOS.find(
          campo => !matches[campo] && correspondeCelula(SINONIMOS_CAMPO_VEICULO[campo], celula.normalizado) === 'parcial'
        );
      }
      if (candidato) matches[candidato] = celula.coluna;
    }
    const total = Object.keys(matches).length;
    if (total < 2) continue;
    if (!melhorLinha || total > Object.keys(melhorLinha.matches).length) {
      melhorLinha = { numero: linha.numero, matches };
    }
  }

  let sugestaoTabela: DeteccaoXlsx['sugestaoTabela'] = null;
  if (melhorLinha) {
    sugestaoTabela = { linhaInicial: melhorLinha.numero + 1, colunas: melhorLinha.matches };
    const totalCampos = CAMPOS_VEICULO_CONHECIDOS.length;
    const totalMatches = Object.keys(melhorLinha.matches).length;
    if (totalMatches < 5) {
      avisos.push(`Só ${totalMatches} de ${totalCampos} colunas de veículo foram reconhecidas -- confira as demais manualmente.`);
    }
  } else {
    avisos.push('Não foi possível identificar automaticamente o cabeçalho da tabela de veículos -- preencha manualmente.');
  }

  return { sugestoesCampos, sugestaoTabela, avisos };
}

function ehRotuloConhecido(normalizado: string): boolean {
  return Object.values(SINONIMOS_CAMPO_ORGAO).some(sinonimos => correspondeCelula(sinonimos, normalizado) !== null);
}
