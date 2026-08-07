// Validar CNPJ
export function validate_cnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');

  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  let digits = clean.substring(size);

  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  if (result !== Number(digits.charAt(0))) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  if (result !== Number(digits.charAt(1))) return false;

  return true;
}

// Formatar CNPJ
export function format_cnpj(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

// Validar Placa
export function validate_plate(plate: string): boolean {
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // ABC1234 ou ABC1D23 (Mercosul)
  return /^[A-Z]{3}\d{4}$/.test(clean) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(clean);
}

// Formatar Placa
export function format_plate(plate: string): string {
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{3}\d{4}$/.test(clean)) {
    return clean.replace(/^([A-Z]{3})(\d{4})$/, '$1-$2');
  }
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(clean)) {
    return clean.replace(/^([A-Z]{3})(\d)([A-Z])(\d{2})$/, '$1-$2$3$4');
  }
  return clean;
}

// Validar RENAVAM
export function validate_renavam(renavam: string): boolean {
  const clean = renavam.replace(/\D/g, '');
  // Permitir qualquer RENAVAM com 11 dígitos para testes
  return clean.length === 11;
}

/*
 * Convenção de datas do sistema
 * -----------------------------
 * Vencimento é data de calendário, não instante. A convenção é gravar sempre a
 * meia-noite UTC do dia pretendido, e ler esse valor pelas partes UTC.
 *
 * O "hoje" com que se compara, porém, é o dia no calendário de Brasília — que
 * é o dia que o usuário enxerga.
 *
 * Sem isso o sistema respondia conforme o fuso de quem executava o código: o
 * servidor na Vercel roda em UTC e, entre 21h e meia-noite em Brasília, já
 * estava no dia seguinte. Um alerta de "faltam 7 dias" podia disparar na
 * véspera, e format_date chegava a exibir datas diferentes para o mesmo
 * veículo conforme a página renderizasse no servidor ou no navegador.
 */
const FUSO_BR = 'America/Sao_Paulo';

/** Número de dias inteiros desde a epoch, no calendário de Brasília. */
function dia_no_calendario_br(data: Date): number {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);

  const [ano, mes, dia] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(ano, mes - 1, dia) / 86_400_000);
}

/** Número de dias inteiros desde a epoch, lendo as partes UTC do valor. */
function dia_no_calendario_utc(data: Date): number {
  return Math.floor(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()) /
      86_400_000
  );
}

// Calcular data de vencimento
export function calculate_expiry_date(
  type: 'proprio' | 'locado',
  from_date: Date = new Date(),
): Date {
  const months = type === 'proprio' ? 12 : 4;

  // Parte do dia em Brasília e devolve meia-noite UTC, conforme a convenção.
  // Antes carregava a hora corrente, deixando o vencimento com hora arbitrária.
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(from_date);

  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1 + months, dia));
}

// Formatar data
export function format_date(date: Date | null): string {
  if (!date) return '-';

  // timeZone UTC fixo: o valor guardado ja e a data pretendida em meia-noite
  // UTC. Sem fixar, servidor e navegador exibiam dias diferentes.
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

// Calcular dias até vencimento
export function days_until_expiry(expiry_date: Date | null): number {
  if (!expiry_date) return -1;
  return dia_no_calendario_utc(expiry_date) - dia_no_calendario_br(new Date());
}

/**
 * Data de hoje em Brasília.
 *
 * Diferente de format_date, que lê o valor em UTC porque ali o dado guardado
 * já é a data pretendida. Aqui o instante é agora, e o dia que interessa é o
 * de quem está olhando a tela.
 */
export function format_data_hoje(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

// Status de veículo baseado em vencimento
export function get_vehicle_status(
  expiry_date: Date | null,
  manual_status?: string,
): 'vencido' | 'vencendo' | 'ok' | 'indefinido' {
  if (manual_status && ['aprovado', 'recusado', 'aguardando', 'enviado'].includes(manual_status)) {
    return 'indefinido';
  }

  if (!expiry_date) return 'indefinido';

  const days = days_until_expiry(expiry_date);

  if (days < 0) return 'vencido';
  if (days <= 30) return 'vencendo';
  return 'ok';
}

// Classe de cor para status
export function get_status_color(status: string): string {
  const colors: Record<string, string> = {
    aprovado: 'bg-green-dim text-green',
    aguardando: 'bg-amber-dim text-amber',
    recusado: 'bg-red-900/30 text-red-400',
    enviado: 'bg-blue-900/30 text-blue-400',
    rascunho: 'bg-slate/20 text-slate',
    vencido: 'bg-red-900/30 text-red-400',
    vencendo: 'bg-amber-dim text-amber',
    ok: 'bg-green-dim text-green',
    indefinido: 'bg-slate/20 text-slate',
  };
  return colors[status] || 'bg-slate/20 text-slate';
}

export function get_status_label(status: string): string {
  const labels: Record<string, string> = {
    rascunho: 'Rascunho',
    enviado: 'Enviado',
    aguardando: 'Aguardando',
    // Cadastros em concessionária usam este valor onde o veículo usa
    // 'aguardando'; ambos aparecem na mesma tela de detalhe.
    aguardando_resposta: 'Aguardando',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
    vencido: 'Vencido',
  };
  return labels[status] || status;
}

export function get_category_label(category: string): string {
  const labels: Record<string, string> = {
    oficial: 'Oficial',
    ambulancia: 'Ambulância',
    bombeiro: 'Bombeiro',
    outro: 'Outro',
  };
  return labels[category] || category;
}

// Concessionaire.estados é gravado ora como JSON (`["SP","RJ"]`), ora como
// lista separada por vírgula. Normaliza os dois formatos para exibição.
export function format_estados(estados: string | null): string {
  if (!estados) return '';

  const bruto = estados.trim();

  if (bruto.startsWith('[')) {
    try {
      const lista = JSON.parse(bruto);
      if (Array.isArray(lista)) return lista.join(', ');
    } catch {
      // Cai no tratamento de texto abaixo.
    }
  }

  return bruto
    .split(',')
    .map(uf => uf.replace(/["[\]\s]/g, ''))
    .filter(Boolean)
    .join(', ');
}

// As 27 unidades federativas, em ordem alfabética de nome. Fonte única para
// todos os seletores de estado — a coluna Account.state guarda a sigla.
export const ESTADOS_BR: ReadonlyArray<{ uf: string; nome: string }> = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];
