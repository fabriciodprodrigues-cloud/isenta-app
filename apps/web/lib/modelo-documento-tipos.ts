/**
 * Tipos compartilhados entre o dispatcher (modelo-documento.ts) e os dois
 * geradores (modelo-docx.ts, modelo-xlsx.ts) -- extraídos para um arquivo à
 * parte para evitar import circular entre eles.
 */

import type { OrgaoDoOficio, VeiculoDoOficio } from './oficio-dados';

/**
 * Subconjunto deliberado de DadosDoOficio: sem `anexos`/`timbreDataUri`, que
 * não fazem sentido aqui -- o timbre já está embutido no modelo da própria
 * concessionária, e a lista de nomes de anexo é responsabilidade de quem
 * chama (registration-orchestrator.ts), não do gerador.
 */
export interface DadosParaModelo {
  orgao: OrgaoDoOficio;
  concessionariaNome: string;
  numeroOficio: string;
  protocolo: string;
  veiculos: VeiculoDoOficio[];
  dataAtual: Date;
}

export interface DocumentoGerado {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface MapeamentoCamposDocx {
  /** chaveDado (ver CAMPOS_ORGAO_CONHECIDOS) -> tag placeholder usada no .docx, ex.: "representante". */
  campos: Record<string, string>;
}

export interface MapeamentoCamposXlsx {
  /** chaveDado -> referência de célula, ex.: { orgaoNome: "B3" }. */
  campos: Record<string, string>;
  tabelaVeiculos: {
    linhaInicial: number;
    /** chaveVeiculo -> letra da coluna, ex.: { placa: "B" }. */
    colunas: Record<string, string>;
  };
}

/**
 * Vocabulário fixo de campos de nível-órgão que a UI de mapeamento oferece
 * para configurar (o admin escolhe a tag/célula de destino para cada um) --
 * mesmo conjunto para DOCX e XLSX, só muda o que se mapeia (tag vs célula).
 */
export const CAMPOS_ORGAO_CONHECIDOS = [
  'responsavelNome',
  'responsavelCpf',
  'orgaoNome',
  'orgaoCnpj',
  'orgaoEndereco',
  'orgaoTelefone',
  'orgaoEmail',
  'data',
] as const;

/**
 * Vocabulário fixo de campos por veículo -- nomes de propriedade dentro do
 * loop `{#veiculos}...{/veiculos}` (DOCX) ou de coluna (XLSX). Não são
 * configuráveis por concessionária: são a interface fixa do sistema com o
 * template, documentada na tela de mapeamento.
 */
export const CAMPOS_VEICULO_CONHECIDOS = [
  'veiculo',
  'marca',
  'modelo',
  'ano',
  'placa',
  'renavam',
  'tipo',
  'cor',
  'cnpjCpf',
  'observacao',
] as const;
