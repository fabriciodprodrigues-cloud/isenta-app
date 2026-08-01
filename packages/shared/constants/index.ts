// Ciclos de renovação (em meses)
export const RENEWAL_CYCLES = {
  PROPRIO: 12,
  LOCADO: 4,
} as const;

// Dias para alertas de vencimento
export const ALERT_DAYS = [60, 30, 7] as const;

// Concessionárias (base para futuro)
export const CONCESSIONARIES = [
  {
    id: 'ccr_prvias',
    name: 'CCR PRVias',
    channel: 'portal',
    url: 'isentos.ccrpagamentos.com.br',
  },
  {
    id: 'csg_gaucha',
    name: 'CSG (Rodovias Gaúchas)',
    channel: 'portal',
    url: 'csg.com.br/isentos',
  },
  {
    id: 'via_araucaria',
    name: 'Via Araucária',
    channel: 'portal',
    url: 'via-araucaria.com.br',
  },
  {
    id: 'way_262',
    name: 'Way 262',
    channel: 'email',
    email: 'isento@way262.com.br',
  },
  {
    id: 'ecovias_araguaia',
    name: 'Ecovias Araguaia',
    channel: 'email',
    email: 'isentos.araguaia@ecovias.com.br',
  },
] as const;

// Cores da identidade visual
export const COLORS = {
  ink900: '#0B1622',
  ink800: '#122238',
  ink700: '#1A3050',
  paper: '#EDF1F3',
  paperDim: '#B9C6D1',
  slate: '#7C8FA6',
  green: '#21C58A',
  greenDim: '#173B30',
  amber: '#FFB238',
  amberDim: '#4A3311',
} as const;
