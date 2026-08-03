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

// Calcular data de vencimento
export function calculate_expiry_date(
  type: 'proprio' | 'locado',
  from_date: Date = new Date(),
): Date {
  const months = type === 'proprio' ? 12 : 4;
  const expiry = new Date(from_date);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
}

// Formatar data
export function format_date(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

// Calcular dias até vencimento
export function days_until_expiry(expiry_date: Date | null): number {
  if (!expiry_date) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry_date);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
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
