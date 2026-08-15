/**
 * Portais de concessionária que o robô sabe operar.
 *
 * A chave é o portal, não a concessionária: um mesmo portal atende várias.
 * O da Motiva, por exemplo, cobre oito concessionárias com uma conta só — o
 * órgão cadastra a credencial uma vez e ela vale para todas.
 */

export interface DefinicaoPortal {
  chave: string;
  nome: string;
  url: string;
  /** Concessionárias atendidas, pelo nome como aparece no seletor do portal. */
  concessionarias: string[];
  /** Se o robô já sabe operá-lo. */
  automatizado: boolean;
  instrucaoConta: string;
}

export const PORTAIS: Record<string, DefinicaoPortal> = {
  CCR_MOTIVA: {
    chave: 'CCR_MOTIVA',
    nome: 'Motiva (ex-CCR) — Portal de Isentos',
    url: 'https://isentos.ccrpagamentos.com.br',
    concessionarias: [
      'AutoBAn',
      'MINAS SP',
      'Pantanal',
      'PRVias',
      'RioSP',
      'Sorocabana',
      'ViaCosteira',
      'ViaSul',
    ],
    automatizado: true,
    instrucaoConta:
      'Crie a conta em isentos.ccrpagamentos.com.br escolhendo "Para sua empresa", com o CNPJ do órgão. O portal envia um código de 6 dígitos por e-mail para confirmar — por isso esta etapa é manual e feita uma única vez.',
  },
  EPR_PR: {
    chave: 'EPR_PR',
    nome: 'EPR Paraná — isencaopr.com.br',
    url: 'https://isencaopr.com.br',
    concessionarias: ['Via Araucária', 'Via Campo'],
    automatizado: false,
    instrucaoConta: 'Fluxo ainda não mapeado.',
  },
};

/** Portal responsável por uma concessionária, pelo endereço do canal dela. */
export function portalDoCanal(canalIsentos: string | null): DefinicaoPortal | null {
  if (!canalIsentos) return null;

  const endereco = canalIsentos.toLowerCase();

  for (const portal of Object.values(PORTAIS)) {
    const dominio = portal.url.replace(/^https?:\/\//, '').toLowerCase();
    if (endereco.includes(dominio)) return portal;
  }

  return null;
}
