import { extractText, getDocumentProxy } from 'unpdf';
import type { DadosCrlv } from './leitura-crlv';

/**
 * Leitura do CRLV pela camada de texto do PDF.
 *
 * O CRLV-e é gerado pelo sistema do Detran, não digitalizado: o texto está
 * dentro do arquivo. Extraí-lo não é reconhecimento de imagem — é ler o que
 * já está escrito, de graça e sem margem de erro de interpretação.
 *
 * Por isso este caminho vem antes do modelo de visão. O modelo fica para o que
 * não tiver camada de texto: foto de CRLV impresso, digitalização antiga.
 */

/** O que a extração conseguiu tirar, mais o que faltou. */
export interface LeituraTexto {
  dados: DadosCrlv;
  /** false quando o PDF não tem camada de texto — nada a extrair. */
  temTexto: boolean;
}

/**
 * A ordem em que o texto sai de um PDF não acompanha o que se vê na tela: o
 * extrator devolve os fragmentos na ordem em que foram desenhados, e num
 * formulário em colunas isso separa rótulo e valor. Daí a busca ser por
 * proximidade — acha o rótulo, pega o que vem depois — em vez de por posição.
 */
function normalizar(bruto: string): string {
  return bruto
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Remove acentos para que o rótulo case com ou sem eles. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Devolve o trecho que vem logo depois de um dos rótulos.
 *
 * `limite` corta o trecho no próximo rótulo conhecido — sem isso, um campo
 * vazio no documento faria a captura engolir o valor do campo seguinte e
 * gravá-lo no lugar errado, que é pior que não achar nada.
 */
function depoisDoRotulo(texto: string, rotulos: string[], limite = 60): string | null {
  const alvo = semAcento(texto).toUpperCase();

  for (const rotulo of rotulos) {
    const posicao = alvo.indexOf(semAcento(rotulo).toUpperCase());
    if (posicao === -1) continue;

    const trecho = texto
      .slice(posicao + rotulo.length, posicao + rotulo.length + limite)
      .replace(/^[\s:.\-–]+/, '')
      .split('\n')[0]
      .trim();

    if (trecho) return trecho;
  }

  return null;
}

/** Placa antiga (ABC1234) e Mercosul (ABC1D23), com ou sem hífen. */
const PADRAO_PLACA = /\b([A-Z]{3})[\s-]?(\d[A-Z0-9]\d{2})\b/;

function acharPlaca(texto: string): string | null {
  const proximo = depoisDoRotulo(texto, ['PLACA'], 20);
  const candidato = proximo && PADRAO_PLACA.exec(proximo.toUpperCase());
  if (candidato) return `${candidato[1]}${candidato[2]}`;

  // O rótulo pode ter saído longe do valor. Como o formato da placa é bem
  // específico, procurar no documento inteiro é seguro aqui.
  const solto = PADRAO_PLACA.exec(texto.toUpperCase());
  return solto ? `${solto[1]}${solto[2]}` : null;
}

/**
 * RENAVAM tem 11 dígitos — e CPF também. Por isso este é o único campo que
 * **não** aceita busca solta: sem o rótulo por perto, um CPF de proprietário
 * viraria RENAVAM sem ninguém perceber.
 */
function acharRenavam(texto: string): string | null {
  const proximo = depoisDoRotulo(
    texto,
    ['CODIGO RENAVAM', 'CÓDIGO RENAVAM', 'RENAVAM'],
    30
  );
  if (!proximo) return null;

  const digitos = proximo.replace(/\D/g, '');
  return digitos.length >= 9 && digitos.length <= 11 ? digitos : null;
}

/** O CRLV traz "MARCA/MODELO/VERSÃO" num campo só, separado por barra. */
function acharMarcaModelo(texto: string): { marca: string | null; modelo: string | null } {
  const bruto = depoisDoRotulo(
    texto,
    ['MARCA / MODELO / VERSAO', 'MARCA/MODELO/VERSAO', 'MARCA / MODELO', 'MARCA/MODELO'],
    60
  );

  if (!bruto) return { marca: null, modelo: null };

  const partes = bruto.split('/').map(p => p.trim()).filter(Boolean);
  if (partes.length === 0) return { marca: null, modelo: null };
  if (partes.length === 1) return { marca: null, modelo: partes[0] };

  return { marca: partes[0], modelo: partes.slice(1).join(' ') };
}

/**
 * Os dois anos aparecem ora juntos ("2020/2021"), ora em campos separados.
 * O primeiro é o de fabricação.
 */
function acharAnos(texto: string): { fabricacao: number | null; modelo: number | null } {
  const juntos = depoisDoRotulo(
    texto,
    ['ANO FABRICACAO / MODELO', 'ANO FABRICACAO/MODELO', 'ANO FAB / MOD'],
    24
  );

  const par = juntos && /(\d{4})\s*\/\s*(\d{4})/.exec(juntos);
  if (par) return { fabricacao: Number(par[1]), modelo: Number(par[2]) };

  const soFabricacao = depoisDoRotulo(texto, ['ANO FABRICACAO', 'ANO DE FABRICACAO'], 12);
  const soModelo = depoisDoRotulo(texto, ['ANO MODELO', 'ANO DO MODELO'], 12);

  const numero = (valor: string | null) => {
    const achado = valor && /\b(19|20)\d{2}\b/.exec(valor);
    return achado ? Number(achado[0]) : null;
  };

  return { fabricacao: numero(soFabricacao), modelo: numero(soModelo) };
}

/**
 * Categoria do nosso cadastro, deduzida da espécie/tipo do documento.
 *
 * O CRLV não tem o conceito de "oficial" que o Isenta usa, então isto é
 * palpite estruturado: só afirma ambulância ou bombeiro quando o próprio
 * documento diz, e deixa o resto para o operador escolher.
 */
function acharCategoria(texto: string): DadosCrlv['categoria'] {
  const alvo = semAcento(texto).toUpperCase();

  if (alvo.includes('AMBULANCIA')) return 'ambulancia';
  if (alvo.includes('BOMBEIRO') || alvo.includes('COMB INCENDIO')) return 'bombeiro';
  if (alvo.includes('OFICIAL')) return 'oficial';

  return null;
}

/** Lê o CRLV pela camada de texto. Não custa nada e não chama modelo nenhum. */
export async function lerCrlvDoTexto(arquivo: Buffer): Promise<LeituraTexto> {
  const pdf = await getDocumentProxy(new Uint8Array(arquivo));
  const { text } = await extractText(pdf, { mergePages: true });

  const texto = normalizar(Array.isArray(text) ? text.join('\n') : text);

  const vazio: DadosCrlv = {
    placa: null,
    renavam: null,
    marca: null,
    modelo: null,
    cor: null,
    anoFabricacao: null,
    anoModelo: null,
    categoria: null,
    camposIncertos: [],
  };

  // Um PDF digitalizado devolve praticamente nada aqui. O corte é generoso de
  // propósito: qualquer coisa abaixo disso não é um CRLV-e.
  if (texto.length < 80) {
    return { dados: vazio, temTexto: false };
  }

  const { marca, modelo } = acharMarcaModelo(texto);
  const anos = acharAnos(texto);

  const dados: DadosCrlv = {
    placa: acharPlaca(texto),
    renavam: acharRenavam(texto),
    marca,
    modelo,
    cor: depoisDoRotulo(texto, ['COR PREDOMINANTE', 'COR'], 24),
    anoFabricacao: anos.fabricacao,
    anoModelo: anos.modelo,
    categoria: acharCategoria(texto),
    camposIncertos: [],
  };

  // O que não saiu é reportado como incerto, do mesmo jeito que na leitura por
  // visão — a tela destaca esses campos e o operador preenche.
  dados.camposIncertos = (
    [
      ['placa', dados.placa],
      ['renavam', dados.renavam],
      ['marca', dados.marca],
      ['modelo', dados.modelo],
      ['cor', dados.cor],
      ['anoFabricacao', dados.anoFabricacao],
      ['anoModelo', dados.anoModelo],
    ] as const
  )
    .filter(([, valor]) => valor === null || valor === '')
    .map(([campo]) => campo);

  return { dados, temTexto: true };
}

/**
 * Placa e RENAVAM são o que identifica o veículo na concessionária. Sem os
 * dois, a extração por texto não serviu — é sinal de que o layout não é o
 * esperado, e vale gastar a leitura por visão em vez de entregar meio cadastro.
 */
export function extracaoFoiSuficiente(dados: DadosCrlv): boolean {
  return Boolean(dados.placa && dados.renavam);
}
