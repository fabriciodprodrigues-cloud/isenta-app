import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

/**
 * Leitura do CRLV para preencher o cadastro de veículo.
 *
 * O operador sobe o documento e os campos vêm preenchidos, em vez de serem
 * digitados um a um a partir de um PDF aberto ao lado.
 *
 * **O resultado nunca cadastra sozinho.** Ele preenche o formulário e o
 * operador confirma. Uma placa lida errado não erra só um registro: o pedido
 * de isenção sai por ofício, na identidade do órgão, para uma concessionária —
 * e o erro chega ao destinatário com a assinatura de uma câmara municipal.
 * Revisão humana antes do envio é barata; retratação depois não é.
 */

const MODELO = 'claude-opus-5';

/**
 * Limite do que aceitamos enviar. A API aceita requisições até 32 MB, e o
 * base64 infla o arquivo em cerca de um terço — 20 MB de PDF chegam perto de
 * 27 MB. O corte em 15 MB deixa margem e evita que um scan gigante estoure o
 * tempo da função serverless.
 */
export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024;

const TIPOS_ACEITOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** Campos que o formulário de veículo espera. */
export const crlvSchema = z.object({
  placa: z.string().nullable(),
  renavam: z.string().nullable(),
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  cor: z.string().nullable(),
  anoFabricacao: z.number().int().nullable(),
  anoModelo: z.number().int().nullable(),
  categoria: z.enum(['oficial', 'ambulancia', 'bombeiro', 'outro']).nullable(),
  // O modelo lista aqui o que não conseguiu ler com segurança. A tela destaca
  // esses campos: um palpite silencioso é pior que um campo em branco, porque
  // parece conferido.
  camposIncertos: z.array(z.string()),
});

export type DadosCrlv = z.infer<typeof crlvSchema>;

/**
 * Schema enviado à API. Escrito à mão em vez de derivado do Zod porque
 * `output_config.format` recusa construções que o Zod gera por padrão
 * (`additionalProperties` ausente, por exemplo).
 */
const SCHEMA_SAIDA = {
  type: 'object',
  properties: {
    placa: {
      type: ['string', 'null'],
      description: 'Placa no formato ABC1D23 ou ABC-1234, sem espaços.',
    },
    renavam: {
      type: ['string', 'null'],
      description: 'RENAVAM, apenas dígitos, com os zeros à esquerda que aparecerem.',
    },
    marca: {
      type: ['string', 'null'],
      description:
        'Só a marca. O CRLV traz MARCA/MODELO junto, como "VW/GOL 1.0" — aqui vai apenas "VW".',
    },
    modelo: {
      type: ['string', 'null'],
      description: 'Só o modelo, sem a marca. De "VW/GOL 1.0", vai "GOL 1.0".',
    },
    cor: { type: ['string', 'null'], description: 'Cor predominante.' },
    anoFabricacao: { type: ['integer', 'null'] },
    anoModelo: { type: ['integer', 'null'] },
    categoria: {
      type: ['string', 'null'],
      enum: ['oficial', 'ambulancia', 'bombeiro', 'outro', null],
      description:
        'Deduzida da espécie e da carroceria: ambulância quando o documento indicar; bombeiro em viaturas de combate a incêndio; oficial no restante da frota pública; outro quando não der para dizer.',
    },
    camposIncertos: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Nomes dos campos acima que você não conseguiu ler com clareza — borrão, corte, rasura. Liste o campo aqui mesmo que tenha arriscado um valor.',
    },
  },
  required: [
    'placa',
    'renavam',
    'marca',
    'modelo',
    'cor',
    'anoFabricacao',
    'anoModelo',
    'categoria',
    'camposIncertos',
  ],
  additionalProperties: false,
} as const;

const INSTRUCAO = `Você extrai dados de CRLV (Certificado de Registro e Licenciamento de Veículo) brasileiro.

Transcreva o que está no documento. Não complete, corrija nem infira valor que não esteja legível: campo ilegível vai como null e o nome dele entra em camposIncertos.

Atenção a três confusões comuns neste documento:
- ANO FABRICAÇÃO e ANO MODELO ficam lado a lado e costumam diferir em um ano.
- MARCA/MODELO/VERSÃO vem num campo só, separado por barra; devolva marca e modelo separados.
- CÓDIGO RENAVAM tem 11 dígitos e pode ter zero à esquerda — preserve.`;

export class DocumentoGrandeDemaisError extends Error {
  constructor(bytes: number) {
    super(
      `O arquivo tem ${(bytes / 1024 / 1024).toFixed(1)} MB e o limite de leitura é ${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB.`
    );
    this.name = 'DocumentoGrandeDemaisError';
  }
}

export class LeituraRecusadaError extends Error {
  constructor(categoria: string | null) {
    super(
      `A leitura foi recusada por classificação de segurança${categoria ? ` (${categoria})` : ''}. Preencha o cadastro manualmente.`
    );
    this.name = 'LeituraRecusadaError';
  }
}

function blocoDoDocumento(arquivo: Buffer, tipo: string) {
  const data = arquivo.toString('base64');

  if (tipo === 'application/pdf') {
    return {
      type: 'document' as const,
      source: { type: 'base64' as const, media_type: 'application/pdf' as const, data },
    };
  }

  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: tipo as 'image/jpeg' | 'image/png' | 'image/webp',
      data,
    },
  };
}

/** Lê o CRLV e devolve os campos do formulário. */
export async function lerCrlv(arquivo: Buffer, tipo: string): Promise<DadosCrlv> {
  if (!TIPOS_ACEITOS.includes(tipo as (typeof TIPOS_ACEITOS)[number])) {
    throw new Error(`Formato não suportado para leitura: ${tipo}`);
  }

  if (arquivo.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new DocumentoGrandeDemaisError(arquivo.byteLength);
  }

  const client = new Anthropic();

  const resposta = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 4096,
    // O fallback do servidor reexecuta a requisição em outro modelo se a
    // classificação de segurança recusar. Um CRLV não deveria acionar nada
    // disso, mas falso positivo em documento de órgão público custa caro e a
    // alternativa é o operador digitar tudo à mão.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      // Transcrição não é raciocínio: esforço alto aqui gasta tempo do
      // operador que está esperando a tela preencher, sem ler melhor.
      effort: 'low',
      format: { type: 'json_schema', schema: SCHEMA_SAIDA },
    },
    messages: [
      {
        role: 'user',
        content: [
          blocoDoDocumento(arquivo, tipo),
          { type: 'text', text: INSTRUCAO },
        ],
      },
    ],
  } as any);

  if (resposta.stop_reason === 'refusal') {
    throw new LeituraRecusadaError(resposta.stop_details?.category ?? null);
  }

  const texto = resposta.content.find(
    (bloco: any) => bloco.type === 'text'
  ) as { text: string } | undefined;

  if (!texto) {
    throw new Error('A leitura não retornou dados.');
  }

  // .parse() e não .safeParse(): um retorno fora do schema é defeito nosso, e
  // preencher o formulário com dado malformado é pior que falhar aqui.
  return crlvSchema.parse(JSON.parse(texto.text));
}
