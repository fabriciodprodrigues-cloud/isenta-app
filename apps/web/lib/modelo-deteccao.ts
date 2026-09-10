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
  responsavelCargo: ['cargo ou funcao', 'cargo', 'funcao', 'cargo do responsavel'],
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
  // "tipo do veiculo" (com "do", não só "de") é a frase completa mais comum
  // em formulários reais (ex.: Rota Verde) -- sem ela, o sinônimo curto
  // "veiculo" (de dentro do campo `veiculo`, marca+modelo combinados) batia
  // por substring nessa mesma célula primeiro, roubando a coluna de `tipo`.
  tipo: ['tipo', 'tipo de veiculo', 'tipo do veiculo', 'proprio/locado'],
  cor: ['cor'],
  cnpjCpf: ['cnpj/cpf', 'cpf/cnpj', 'documento'],
  observacao: ['observacao', 'obs'],
  data: ['data'],
};

/** Remove pontuação (mantém letras/números/espaço) pra "CNPJ /CPF" e "cnpj/cpf" caírem na mesma chave de comparação. */
function chaveComparacao(normalizado: string): string {
  return normalizado.replace(/[/\-.,:;()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function correspondeCelula(sinonimos: string[], normalizado: string): 'exato' | 'parcial' | null {
  const alvo = chaveComparacao(normalizado);
  // Célula em branco não "corresponde" a nada -- sem essa guarda, o fallback
  // por substring caía numa armadilha boba: toda string (inclusive "")
  // contém a string vazia, então uma célula vazia "batia" por substring com
  // QUALQUER sinônimo, e era erroneamente tratada como se já fosse um
  // rótulo conhecido (impedindo que ela fosse escolhida como célula-valor).
  if (!alvo) return null;
  const lista = sinonimos.map(chaveComparacao);
  if (lista.includes(alvo)) return 'exato';
  if (lista.some(s => alvo.includes(s) || s.includes(alvo))) return 'parcial';
  return null;
}

interface RetanguloMesclado {
  colIni: number;
  colFim: number;
  linIni: number;
  linFim: number;
}

/** `<mergeCells>` fica como irmão de `<sheetData>`, por isso recebe o sheetXml inteiro, não só o trecho de dentro de <sheetData>. */
function extrairMesclagens(sheetXml: string): RetanguloMesclado[] {
  const secao = sheetXml.match(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/);
  if (!secao) return [];
  const refs = Array.from(secao[1].matchAll(/<mergeCell\s+ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g));
  return refs.map(([, colIniL, linIniS, colFimL, linFimS]) => ({
    colIni: indiceColuna(colIniL),
    colFim: indiceColuna(colFimL),
    linIni: Number(linIniS),
    linFim: Number(linFimS),
  }));
}

function mesclagemDaCelula(mesclagens: RetanguloMesclado[], coluna: number, linha: number): RetanguloMesclado | null {
  return mesclagens.find(m => coluna >= m.colIni && coluna <= m.colFim && linha >= m.linIni && linha <= m.linFim) ?? null;
}

function letraDeIndice(indice: number): string {
  let letra = '';
  let n = indice;
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
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
  const mesclagens = extrairMesclagens(sheetXml);
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

  // -- Tabela de veículos ---------------------------------------------------
  // Detectada ANTES dos campos de órgão de propósito: sem saber onde fica o
  // cabeçalho da tabela, um rótulo comum de coluna (ex.: "DATA", "CNPJ
  // /CPF") era confundido com um campo de nível-órgão, e o valor "adivinhado"
  // caía dentro da própria tabela (ex.: a data de hoje sendo escrita em cima
  // do cabeçalho "Placa") -- bug real encontrado no arquivo da Rota Verde.
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

  // -- Campos de nível-órgão -------------------------------------------
  // Exclui a linha de cabeçalho da tabela (e tudo dela pra baixo) da busca
  // de rótulo/valor -- sem isso, "DATA" ou "CNPJ /CPF" no cabeçalho da
  // tabela de veículos eram lidos como se fossem um campo de órgão solto,
  // e o valor "adivinhado" acabava dentro da própria tabela.
  const linhaCabecalhoVeiculos = melhorLinha?.numero ?? null;
  const celulasForaDaTabela = todasCelulas.filter(
    c => linhaCabecalhoVeiculos === null || c.linha < linhaCabecalhoVeiculos
  );

  const sugestoesCampos: Record<string, string> = {};
  for (const campo of CAMPOS_ORGAO_CONHECIDOS) {
    const sinonimos = SINONIMOS_CAMPO_ORGAO[campo];
    // Prioriza correspondência exata; só recorre a substring (confiança
    // menor, ex.: "Assinatura do responsável" batendo com o sinônimo curto
    // "responsavel") se não houve nenhuma exata -- mesma tiebreak de
    // detectarCamposDocx.
    const exatas = celulasForaDaTabela.filter(c => c.texto && correspondeCelula(sinonimos, c.normalizado) === 'exato');
    const candidatas =
      exatas.length > 0
        ? exatas
        : celulasForaDaTabela.filter(c => c.texto && correspondeCelula(sinonimos, c.normalizado) === 'parcial');
    if (candidatas.length === 0) continue;

    let rotulo = candidatas[0];
    if (candidatas.length > 1) {
      candidatas.sort((a, b) => a.linha - b.linha || indiceColuna(a.coluna) - indiceColuna(b.coluna));
      rotulo = candidatas[0];
      avisos.push(`Mais de uma célula parece ser o rótulo de "${campo}" -- usada a de menor posição (${rotulo.ref}), confira.`);
    }

    const celulasLinha = celulasPorLinha.get(rotulo.linha) ?? [];
    const colunaRotuloIdx = indiceColuna(rotulo.coluna);

    // Em vez de procurar a primeira célula com TEXTO à direita, olhamos a
    // posição logo após o rótulo -- num modelo em branco (o caso comum: um
    // formulário recém-enviado, nunca preenchido), a célula-valor não tem
    // texto nenhum ainda, então exigir texto fazia o algoritmo pular direto
    // pra célula errada, às vezes do outro lado da planilha (bug real
    // encontrado no arquivo da Rota Verde). "Logo após o rótulo" considera a
    // mesclagem do próprio rótulo (ex.: rótulo mesclado C3:D3 -> valor
    // começa em E, não em D, que é só a continuação do rótulo).
    const mesclagemRotulo = mesclagemDaCelula(mesclagens, colunaRotuloIdx, rotulo.linha);
    const colunaAposRotulo = (mesclagemRotulo?.colFim ?? colunaRotuloIdx) + 1;

    // 1) se há uma mesclagem começando bem ali, o valor é a âncora dela
    // (única célula da mesclagem que de fato guarda conteúdo).
    let valorRef: string | null = null;
    const mesclagemValor = mesclagens.find(
      m => m.colIni === colunaAposRotulo && m.linIni <= rotulo.linha && m.linFim >= rotulo.linha
    );
    if (mesclagemValor) {
      valorRef = `${letraDeIndice(mesclagemValor.colIni)}${rotulo.linha}`;
    } else {
      // 2) sem mesclagem: célula isolada logo após o rótulo, contanto que
      // não seja ela mesma outro rótulo conhecido (funciona com ou sem
      // texto -- uma célula em branco não é "conhecida", passa a valer).
      const candidata = celulasLinha.find(c => indiceColuna(c.coluna) === colunaAposRotulo);
      if (!candidata || !ehRotuloConhecido(candidata.normalizado)) {
        valorRef = `${letraDeIndice(colunaAposRotulo)}${rotulo.linha}`;
      }
    }

    // 3) por último, próxima célula abaixo na mesma coluna do rótulo (layout rótulo-em-cima) -- também sem entrar na tabela de veículos.
    if (!valorRef) {
      const abaixo = celulasForaDaTabela
        .filter(c => c.coluna === rotulo.coluna && c.linha > rotulo.linha)
        .sort((a, b) => a.linha - b.linha)
        .find(c => !ehRotuloConhecido(c.normalizado));
      if (abaixo) valorRef = abaixo.ref;
    }

    if (valorRef) {
      sugestoesCampos[campo] = valorRef;
    } else {
      avisos.push(`Rótulo de "${campo}" encontrado (${rotulo.ref}), mas nenhuma célula de valor próxima -- preencha manualmente.`);
    }
  }

  return { sugestoesCampos, sugestaoTabela, avisos };
}

function ehRotuloConhecido(normalizado: string): boolean {
  return Object.values(SINONIMOS_CAMPO_ORGAO).some(sinonimos => correspondeCelula(sinonimos, normalizado) !== null);
}
