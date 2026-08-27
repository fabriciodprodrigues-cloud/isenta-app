/**
 * Dados e helpers compartilhados dos 5 documentos do módulo ARTESP.
 *
 * Mesmo espírito de oficio-dados.ts: um shape de dados por trás, vários
 * documentos gerados a partir dele.
 */

import type { OrgaoDoOficio } from './oficio-dados';

export const TIPO_ENTIDADE_LABEL: Record<string, string> = {
  A: 'Entidade Estadual de São Paulo (via GCTI/SIGEF)',
  B: 'Outra Entidade da Federação (município ou outro estado)',
};

/**
 * Texto de abrangência conforme a classificação (Portaria Art. 2º, §1º/§2º).
 * Tipo B é o caso mais comum dos clientes da Isenta (câmaras/prefeituras
 * municipais) — pode ficar restrito à 1ª Fase do Programa de Concessões
 * dependendo do enquadramento, por isso o texto não é uma promessa de
 * abrangência irrestrita.
 */
export const ABRANGENCIA_PADRAO: Record<string, string> = {
  A: 'Isenção irrestrita nas rodovias concedidas do Estado de São Paulo.',
  B:
    'Isenção nas rodovias concedidas do Estado de São Paulo, podendo ficar ' +
    'restrita à 1ª Fase do Programa de Concessões (Autoban, Intervias, ' +
    'Renovias, Colinas, SPvias, Ecovias) conforme o enquadramento da entidade.',
};

export const TIPOS_DOCUMENTO_ARTESP = [
  'requerimento',
  'declaracao_tag',
  'anexo_veiculos',
  'declaracao_concordancia',
  'solicitacao_cobranca',
] as const;

export type TipoDocumentoArtesp = (typeof TIPOS_DOCUMENTO_ARTESP)[number];

export const NOME_DOCUMENTO_ARTESP: Record<TipoDocumentoArtesp, string> = {
  requerimento: 'Requerimento à Diretora Geral da ARTESP',
  declaracao_tag: 'Declaração de correta instalação da TAG',
  anexo_veiculos: 'Anexo ao termo de adesão — relação de veículos',
  declaracao_concordancia: 'Declaração de concordância',
  solicitacao_cobranca: 'Solicitação de cobrança automática',
};

export interface VeiculoArtesp {
  plate: string;
  renavam: string;
  type: string; // proprio | locado
  category: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  registroPatrimonial: string | null;
  prefixo: string | null;
  /** Número de série da TAG vinculada (Tag.vehicleId) — null se não houver. */
  tag: string | null;
  /**
   * Marca/operadora que emitiu essa TAG (Tag.operadora) — null se não
   * informada. Cada veículo pode ter uma operadora diferente (nem toda TAG
   * cadastrada é ConectCar), então isso é por veículo, não um valor único
   * pro cadastro inteiro.
   */
  operadoraTag: string | null;
}

export interface DadosArtesp {
  tipoEntidade: string; // A | B
  abrangencia: string;
  orgao: OrgaoDoOficio;
  responsavelFrotaNome: string;
  responsavelFrotaTelefone: string;
  responsavelFrotaEmail: string;
  veiculos: VeiculoArtesp[];
  dataEmissao: Date;
}

export function nomeVeiculoArtesp(v: VeiculoArtesp) {
  return [v.marca, v.modelo].filter(Boolean).join(' ') || '—';
}

export function anosArtesp(v: VeiculoArtesp) {
  if (!v.anoFabricacao && !v.anoModelo) return '—';
  return `${v.anoFabricacao ?? '—'} / ${v.anoModelo ?? '—'}`;
}
