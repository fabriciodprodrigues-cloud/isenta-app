export type ConcessionaireChannel = 'email' | 'rpa' | 'portal';

export interface ConcessionaireConfig {
  id: string;
  name: string;
  channel: ConcessionaireChannel;
  portalUrl?: string;
  email?: string;
  rpaScript?: string;
  description: string;
}

export const CONCESSIONAIRE_CHANNELS: Record<string, ConcessionaireConfig> = {
  'CSG': {
    id: 'cmsaonwlm000dz911l7pbrgid',
    name: 'CSG (rodovias gaúchas)',
    channel: 'email',
    email: 'isentos@csg.com.br',
    description: 'Envia solicitações por e-mail com documentação anexada',
  },
  'CCR PRVias': {
    id: 'cmsaonwl9000cz911ybc9d7p0',
    name: 'CCR PRVias',
    channel: 'portal',
    portalUrl: 'isentos.ccrpagamentos.com.br',
    description: 'Integração futura via portal web/RPA',
  },
  'Way 262': {
    id: 'way-262-id',
    name: 'Way 262',
    channel: 'email',
    email: 'isento@way262.com.br',
    description: 'Solicitações por e-mail',
  },
  'Ecovias Araguaia': {
    id: 'ecovias-araguaia-id',
    name: 'Ecovias Araguaia',
    channel: 'email',
    email: 'isentos.araguaia@ecovias.com.br',
    description: 'Solicitações por e-mail com anexos',
  },
  'Eco050 / Fernão Dias': {
    id: 'eco050-id',
    name: 'Eco050 / Fernão Dias (Arteris)',
    channel: 'email',
    email: 'isentos@eco050.com.br',
    description: 'Solicitações por e-mail',
  },
  'Motiva Paraná': {
    id: 'motiva-parana-id',
    name: 'Motiva Paraná',
    channel: 'portal',
    portalUrl: 'https://portal.motiva.com.br',
    description: 'Integração via RPA no portal Motiva',
  },
  'CCR MOVe': {
    id: 'ccr-move-id',
    name: 'CCR MOVe',
    channel: 'portal',
    portalUrl: 'https://isentos.ccrmove.com.br',
    description: 'Integração via RPA no portal CCR',
  },
};

export function getConcessionaireConfig(id: string): ConcessionaireConfig | undefined {
  return Object.values(CONCESSIONAIRE_CHANNELS).find(c => c.id === id);
}

export function getConcessionaireConfigByEmail(email: string): ConcessionaireConfig | undefined {
  return Object.values(CONCESSIONAIRE_CHANNELS).find(c => c.email === email);
}
