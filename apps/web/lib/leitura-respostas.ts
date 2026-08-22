/**
 * Extração e classificação de respostas da concessionária a um ofício.
 *
 * Isto é um palpite, não uma decisão: quem chama (lib/processar-respostas.ts)
 * nunca aplica o resultado direto em ConcesssionaireRegistration.status — só
 * pré-preenche a fila de revisão, e um humano confirma. O mesmo princípio já
 * usado na leitura de CRLV (lib/leitura-crlv-texto.ts).
 */

export type Classificacao = 'aprovado' | 'recusado' | 'indefinido';

const REGEX_PROTOCOLO = /ISN-\d{4}-[A-Z0-9]{6}/i;

/** Busca o protocolo (formato ISN-AAAA-XXXXXX) no assunto ou corpo do e-mail. */
export function extrairProtocolo(texto: string): string | null {
  const m = REGEX_PROTOCOLO.exec(texto);
  return m ? m[0].toUpperCase() : null;
}

const SINAIS_APROVADO = ['aprovad', 'deferid', 'concedid', 'autorizad'];
const SINAIS_RECUSADO = ['recusad', 'indeferid', 'negad', 'rejeitad'];
const NEGACOES = ['nao ', 'não ', 'sem ', 'ainda nao', 'ainda não'];

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Conta sinais de aprovação/recusa no texto, invertendo o sinal quando há
 * negação nos ~15 caracteres antes da palavra-chave (ex.: "não foi
 * aprovado" não pode contar como aprovação).
 *
 * Não tenta cobrir todo caso de linguagem natural — só reduzir cliques no
 * caso comum. Casos ambíguos ("aprovado, mas só depois de enviar tal
 * documento") ficam por conta da revisão humana, que sempre vê o texto
 * completo antes de confirmar.
 */
export function classificarResposta(texto: string): Classificacao {
  const alvo = semAcento(texto.toLowerCase());
  let pontosAprovado = 0;
  let pontosRecusado = 0;

  const grupos: Array<[string[], 'aprovado' | 'recusado']> = [
    [SINAIS_APROVADO, 'aprovado'],
    [SINAIS_RECUSADO, 'recusado'],
  ];

  for (const [sinais, tipo] of grupos) {
    for (const sinal of sinais) {
      // (?<![a-z]) evita casar "deferid" dentro de "indeferido" — sem
      // fronteira de palavra, o sinal de aprovação "deferid" bate como
      // substring do sinal de recusa "indeferid", empatando os dois.
      const regexSinal = new RegExp(`(?<![a-z])${sinal}`, 'g');
      for (const ocorrencia of alvo.matchAll(regexSinal)) {
        const pos = ocorrencia.index ?? 0;
        const janela = alvo.slice(Math.max(0, pos - 15), pos);
        const negado = NEGACOES.some(n => janela.includes(n));
        const soma = negado ? -1 : 1;
        if (tipo === 'aprovado') pontosAprovado += soma;
        else pontosRecusado += soma;
      }
    }
  }

  if (pontosAprovado > pontosRecusado && pontosAprovado > 0) return 'aprovado';
  if (pontosRecusado > pontosAprovado && pontosRecusado > 0) return 'recusado';
  return 'indefinido';
}
