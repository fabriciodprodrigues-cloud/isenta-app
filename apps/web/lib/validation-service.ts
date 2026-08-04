import { prisma } from './prisma';

interface ValidationResult {
  isComplete: boolean;
  missingFields: string[];
  message: string;
}

interface VehicleData {
  placa?: string;
  renavam?: string;
  cor?: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: number;
  anoModelo?: number;
}

interface AccountData {
  razaoSocial?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  uf?: string;
  cidade?: string;
}

// Mapeamento de campos obrigatórios por concessionaire
type RequiredFields = {
  vehicle: string[];
  account: string[];
};

const REQUIRED_FIELDS_MAP: Record<string, RequiredFields> = {
  // Motiva Paraná - requer campos completos
  'Motiva Paraná (ex-PRVias)': {
    vehicle: [
      'placa',
      'renavam',
      'cor',
      'modelo',
      'anoFabricacao',
      'anoModelo',
    ],
    account: [
      'razaoSocial',
      'cnpj',
      'telefone',
      'email',
      'cep',
      'endereco',
      'numero',
      'bairro',
      'uf',
      'cidade',
    ],
  },
  // Email - apenas placa e renavam
  default: {
    vehicle: ['placa', 'renavam'],
    account: ['razaoSocial', 'cnpj'],
  },
};

export async function validateVehicleForConcessionaire(
  vehicleId: string,
  concessionaireId: string
): Promise<ValidationResult> {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { account: true },
    });

    if (!vehicle) {
      return {
        isComplete: false,
        missingFields: ['vehicle'],
        message: 'Veículo não encontrado',
      };
    }

    const concessionaire = await prisma.concessionaire.findUnique({
      where: { id: concessionaireId },
    });

    if (!concessionaire) {
      return {
        isComplete: false,
        missingFields: ['concessionaire'],
        message: 'Concessionária não encontrada',
      };
    }

    // Se não está ativo para cadastro, retornar erro
    if (!concessionaire.ativoParaCadastro) {
      return {
        isComplete: false,
        missingFields: [],
        message: `Cadastro não está ativo para ${concessionaire.name}. Entre em contato com o administrador.`,
      };
    }

    // Se não tem canal, retornar erro
    if (!concessionaire.canalIsentos) {
      return {
        isComplete: false,
        missingFields: [],
        message: `Canal de isenção não configurado para ${concessionaire.name}. Entre em contato com o administrador.`,
      };
    }

    // Buscar campos obrigatórios da concessionária
    let requiredFields: Record<string, string[]>;

    if (concessionaire.camposObrigatorios) {
      try {
        const stored = JSON.parse(concessionaire.camposObrigatorios);
        // Campos armazenados como array simples
        requiredFields = {
          vehicle: stored.filter((f: string) =>
            [
              'placa',
              'renavam',
              'cor',
              'marca',
              'modelo',
              'anoFabricacao',
              'anoModelo',
            ].includes(f)
          ),
          account: stored.filter(
            (f: string) =>
              ![
                'placa',
                'renavam',
                'cor',
                'marca',
                'modelo',
                'anoFabricacao',
                'anoModelo',
              ].includes(f)
          ),
        };
      } catch (e) {
        requiredFields = REQUIRED_FIELDS_MAP[concessionaire.name] || REQUIRED_FIELDS_MAP.default;
      }
    } else {
      requiredFields =
        REQUIRED_FIELDS_MAP[concessionaire.name] || REQUIRED_FIELDS_MAP.default;
    }

    // Validar campos de veículo
    const missingVehicleFields = validateFields(
      vehicle,
      requiredFields.vehicle
    );

    // Validar campos de órgão
    const missingAccountFields = validateFields(
      vehicle.account,
      requiredFields.account
    );

    const allMissingFields = [
      ...missingVehicleFields,
      ...missingAccountFields,
    ];

    if (allMissingFields.length > 0) {
      return {
        isComplete: false,
        missingFields: allMissingFields,
        message: `Faltam os seguintes campos: ${allMissingFields.join(', ')}`,
      };
    }

    return {
      isComplete: true,
      missingFields: [],
      message: 'Veículo está completo para cadastro nesta concessionária',
    };
  } catch (error) {
    console.error(
      'Erro ao validar veículo para concessionária:',
      error
    );
    return {
      isComplete: false,
      missingFields: [],
      message: 'Erro ao validar. Tente novamente.',
    };
  }
}

function validateFields(
  obj: any,
  requiredFields: string[]
): string[] {
  if (!obj) return requiredFields;

  const missing: string[] = [];

  for (const field of requiredFields) {
    const value = obj[field];

    // Validar se o campo está preenchido
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      (typeof value === 'number' && value === 0)
    ) {
      missing.push(field);
    }
  }

  return missing;
}

export async function getRequiredFieldsForConcessionaire(
  concessionaireId: string
): Promise<RequiredFields | null> {
  try {
    const concessionaire = await prisma.concessionaire.findUnique({
      where: { id: concessionaireId },
    });

    if (!concessionaire) return null;

    if (concessionaire.camposObrigatorios) {
      try {
        const stored = JSON.parse(concessionaire.camposObrigatorios);
        return {
          vehicle: stored.filter((f: string) =>
            [
              'placa',
              'renavam',
              'cor',
              'marca',
              'modelo',
              'anoFabricacao',
              'anoModelo',
            ].includes(f)
          ),
          account: stored.filter(
            (f: string) =>
              ![
                'placa',
                'renavam',
                'cor',
                'marca',
                'modelo',
                'anoFabricacao',
                'anoModelo',
              ].includes(f)
          ),
        };
      } catch (e) {
        return (
          REQUIRED_FIELDS_MAP[concessionaire.name] ||
          REQUIRED_FIELDS_MAP.default
        );
      }
    }

    return (
      REQUIRED_FIELDS_MAP[concessionaire.name] ||
      REQUIRED_FIELDS_MAP.default
    );
  } catch (error) {
    console.error('Erro ao buscar campos obrigatórios:', error);
    return REQUIRED_FIELDS_MAP.default;
  }
}

// Tradução de nomes de campos para português
const FIELD_TRANSLATIONS: Record<string, string> = {
  placa: 'Placa do veículo',
  renavam: 'RENAVAM',
  cor: 'Cor do veículo',
  marca: 'Marca',
  modelo: 'Modelo',
  anoFabricacao: 'Ano de fabricação',
  anoModelo: 'Ano modelo',
  razaoSocial: 'Razão social',
  cnpj: 'CNPJ',
  telefone: 'Telefone',
  email: 'E-mail',
  cep: 'CEP',
  endereco: 'Endereço',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  uf: 'Estado',
  cidade: 'Cidade',
};

export function translateFieldNames(fields: string[]): string[] {
  return fields.map((f) => FIELD_TRANSLATIONS[f] || f);
}
