/**
 * Identidade de envio do órgão.
 *
 * Regra inviolável do produto: nenhuma solicitação sai em nome da Isenta. Ou o
 * órgão tem identidade própria configurada e válida, ou o envio não acontece.
 *
 * Este módulo concentra a checagem para que ela seja garantida por construção,
 * e não por disciplina de quem opera — qualquer caminho de envio passa por
 * aqui antes de despachar qualquer coisa.
 */

export const METODOS_ACESSO_EMAIL = [
  'DELEGACAO',
  'CREDENCIAL',
  'ENCAMINHAMENTO',
] as const;

export const METODOS_ASSINATURA = ['GOVBR_ICP', 'ELETRONICA_INTERNA'] as const;

export const PODERES = [
  'ENVIAR_EMAIL_NOME_ORGAO',
  'OPERAR_PORTAIS_NOME_ORGAO',
] as const;

export const ROTULO_METODO_EMAIL: Record<string, string> = {
  DELEGACAO: 'Delegação ("enviar como")',
  CREDENCIAL: 'Credencial da caixa',
  ENCAMINHAMENTO: 'Encaminhamento',
};

export const ROTULO_ASSINATURA: Record<string, string> = {
  GOVBR_ICP: 'gov.br / ICP-Brasil',
  ELETRONICA_INTERNA: 'Eletrônica interna',
};

export const ROTULO_PODER: Record<string, string> = {
  ENVIAR_EMAIL_NOME_ORGAO: 'Enviar e-mail em nome do órgão',
  OPERAR_PORTAIS_NOME_ORGAO: 'Operar portais em nome do órgão',
};

/** O que a checagem precisa saber. Aceita o registro do Prisma direto. */
export interface OrgaoParaChecagem {
  emailIsencao: string | null;
  metodoAcessoEmail: string | null;
  emailVerificado: boolean;
  timbreUrl: string | null;
  metodoAssinatura: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  cidadeEmissao: string | null;
  autorizacao?: { ativo: boolean; validoAte: Date | null } | null;
}

export interface Pendencia {
  campo: string;
  /** Texto para o operador, dizendo o que falta em vez de nomear a coluna. */
  descricao: string;
  /** Passo do onboarding onde se resolve. */
  passo: number;
}

export interface ResultadoIdentidade {
  completa: boolean;
  pendencias: Pendencia[];
}

/**
 * Avalia a identidade do órgão e devolve o que falta.
 *
 * Sempre lista todas as pendências, não só a primeira: quem está configurando
 * precisa ver o trabalho inteiro de uma vez, não descobrir um item por vez a
 * cada tentativa.
 */
export function avaliarIdentidadeEnvio(
  orgao: OrgaoParaChecagem
): ResultadoIdentidade {
  const pendencias: Pendencia[] = [];

  if (!orgao.emailIsencao) {
    pendencias.push({
      campo: 'emailIsencao',
      descricao: 'E-mail institucional de isenção não informado',
      passo: 3,
    });
  }

  if (!orgao.metodoAcessoEmail) {
    pendencias.push({
      campo: 'metodoAcessoEmail',
      descricao: 'Método de acesso à caixa do órgão não definido',
      passo: 3,
    });
  }

  if (!orgao.emailVerificado) {
    pendencias.push({
      campo: 'emailVerificado',
      descricao: 'E-mail de isenção ainda não verificado por envio real',
      passo: 3,
    });
  }

  if (!orgao.timbreUrl) {
    pendencias.push({
      campo: 'timbreUrl',
      descricao: 'Papel timbrado não enviado',
      passo: 4,
    });
  }

  if (!orgao.cidadeEmissao) {
    pendencias.push({
      campo: 'cidadeEmissao',
      descricao: 'Cidade de emissão do ofício não informada',
      passo: 4,
    });
  }

  if (!orgao.metodoAssinatura) {
    pendencias.push({
      campo: 'metodoAssinatura',
      descricao: 'Método de assinatura não definido',
      passo: 5,
    });
  }

  if (!orgao.responsibleName) {
    pendencias.push({
      campo: 'responsibleName',
      descricao: 'Responsável que assina o ofício não informado',
      passo: 5,
    });
  }

  if (!orgao.responsibleRole) {
    pendencias.push({
      campo: 'responsibleRole',
      descricao: 'Cargo do responsável não informado',
      passo: 5,
    });
  }

  if (!orgao.autorizacao?.ativo) {
    pendencias.push({
      campo: 'autorizacao',
      descricao: 'Termo de autorização não assinado ou inativo',
      passo: 6,
    });
  } else if (
    orgao.autorizacao.validoAte &&
    orgao.autorizacao.validoAte < new Date()
  ) {
    // Um termo vencido não autoriza nada. Tratar como pendência em vez de
    // deixar passar evita operar sem respaldo por esquecimento de renovação.
    pendencias.push({
      campo: 'autorizacao',
      descricao: `Termo de autorização venceu em ${orgao.autorizacao.validoAte.toLocaleDateString('pt-BR')}`,
      passo: 6,
    });
  }

  return { completa: pendencias.length === 0, pendencias };
}

/** Atalho para os pontos que só precisam do sim/não. */
export function identidadeEnvioCompleta(orgao: OrgaoParaChecagem): boolean {
  return avaliarIdentidadeEnvio(orgao).completa;
}

/** Campos que o Prisma precisa trazer para a checagem funcionar. */
export const SELECT_IDENTIDADE = {
  emailIsencao: true,
  metodoAcessoEmail: true,
  emailVerificado: true,
  timbreUrl: true,
  metodoAssinatura: true,
  responsibleName: true,
  responsibleRole: true,
  cidadeEmissao: true,
  autorizacao: { select: { ativo: true, validoAte: true } },
} as const;
