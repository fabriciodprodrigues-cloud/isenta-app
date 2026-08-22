/**
 * Dados e helpers compartilhados do ofício de pedido de isenção.
 *
 * Extraído de oficio-isencao.ts para ser reaproveitado tanto pelo template
 * HTML (oficio-isencao.ts, usado no corpo do e-mail) quanto pelo template
 * WordML (oficio-docx-corpo.ts, usado para gerar o PDF anexado) — mesma
 * estrutura de conteúdo, dois formatos de saída.
 */

export const PRAZO_PROPRIO_MESES = 12;
export const PRAZO_LOCADO_MESES = 4;

export interface VeiculoDoOficio {
  plate: string;
  renavam: string;
  type: string;
  category: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  /** Número de série da TAG vinculada (Tag.vehicleId) — null se não houver. */
  tag: string | null;
}

export interface OrgaoDoOficio {
  name: string;
  razaoSocial: string | null;
  cnpj: string;
  address: string;
  bairro: string | null;
  numero: string | null;
  city: string;
  state: string;
  cep: string | null;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  /** Cargo de quem assina — um ofício sem cargo não identifica a autoridade. */
  responsibleRole: string | null;
  cabecalhoTexto: string | null;
  cidadeEmissao: string | null;
}

export interface DadosDoOficio {
  /** Número do ofício no formato NNN/AAAA, sequencial por órgão. */
  numeroOficio: string;
  protocolo: string;
  orgao: OrgaoDoOficio;
  concessionariaNome: string;
  veiculos: VeiculoDoOficio[];
  anexos: string[];
  /**
   * Papel timbrado do órgão, já em data URI.
   *
   * Vai embutido porque cliente de e-mail bloqueia imagem remota por padrão —
   * um timbre por URL apareceria como espaço vazio na maioria das caixas.
   * Usado só pelo template HTML: no template WordML o timbre já vem do
   * próprio cabeçalho do modelo .docx do órgão (ver oficio-docx.ts).
   */
  timbreDataUri?: string | null;
}

export const ROTULO_CATEGORIA: Record<string, string> = {
  oficial: 'Oficial',
  ambulancia: 'Ambulância',
  bombeiro: 'Bombeiro',
  outro: 'Outro',
};

export function porExtenso(meses: number) {
  const extenso: Record<number, string> = { 4: 'quatro', 12: 'doze' };
  return `${meses} (${extenso[meses] ?? meses}) meses`;
}

export function enderecoCompleto(o: OrgaoDoOficio) {
  const linha = [o.address, o.numero, o.bairro].filter(Boolean).join(', ');
  const cidade = `${o.city}/${o.state}`;
  return [linha, cidade, o.cep].filter(Boolean).join(' — ');
}

export function nomeVeiculo(v: VeiculoDoOficio) {
  return [v.marca, v.modelo].filter(Boolean).join(' ') || '—';
}

export function anos(v: VeiculoDoOficio) {
  if (!v.anoFabricacao && !v.anoModelo) return '—';
  return `${v.anoFabricacao ?? '—'} / ${v.anoModelo ?? '—'}`;
}

export function assuntoDoOficio(orgaoNome: string) {
  return `Pedido de isenção — ${orgaoNome}`;
}
