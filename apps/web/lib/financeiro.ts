/**
 * Módulo financeiro: contratos, faturas e cobrança. Uso interno do time
 * comercial/financeiro da Isenta -- o operador (órgão) nunca acessa isto.
 *
 * Dinheiro sempre em centavos (Int), nunca Decimal -- ver comentário no
 * início do bloco financeiro em prisma/schema.prisma pro porquê.
 *
 * "Vencido"/"atrasada" nunca são lidos de um campo de status: são
 * calculados aqui a partir de dataVencimento, porque não há onde rodar um
 * job proativo hoje (ver plano). Isso é deliberado, não uma lacuna --
 * mantém o dado sempre correto sem depender de nenhuma rotina.
 */

import { prisma } from './prisma';

const ID_CONFIGURACAO = 'singleton';

function somarMeses(data: Date, meses: number): Date {
  const resultado = new Date(data);
  resultado.setMonth(resultado.getMonth() + meses);
  return resultado;
}

/** Divide um total em N parcelas inteiras que somam exatamente o total (sobra distribuída nas primeiras). */
function dividirCentavos(totalCentavos: number, partes: number): number[] {
  const base = Math.floor(totalCentavos / partes);
  const resto = totalCentavos - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}

interface CriarFaturasInput {
  contratoId: string;
  tipo: 'fechamento_inicial' | 'renovacao' | 'aditivo';
  valorTotalCentavos: number;
  formaPagamento: string;
  numeroEmpenho?: string | null;
  parcelas?: number;
}

/**
 * Cria 1..N faturas pra um evento de cobrança (fechamento, renovação ou
 * aditivo). Primeira parcela vence hoje, cada uma seguinte +1 mês --
 * simplificação razoável pro MVP; a especificação não define o
 * espaçamento exato pra modalidades com parcelamento definido em edital.
 */
async function criarFaturas(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: CriarFaturasInput
): Promise<void> {
  const parcelas = input.parcelas ?? 1;
  const valores = dividirCentavos(input.valorTotalCentavos, parcelas);
  const hoje = new Date();

  // Empenho é um processo formal que antecede a emissão em si -- as demais
  // formas de pagamento já saem "emitida" (pronta pra ser paga).
  const statusInicial = input.formaPagamento === 'empenho' ? 'aguardando_empenho' : 'emitida';

  await tx.fatura.createMany({
    data: valores.map((valorCentavos, i) => ({
      contratoId: input.contratoId,
      tipo: input.tipo,
      valorCentavos,
      formaPagamento: input.formaPagamento,
      numeroEmpenho: input.numeroEmpenho ?? null,
      parcelaNumero: parcelas > 1 ? i + 1 : null,
      parcelaTotal: parcelas > 1 ? parcelas : null,
      dataVencimento: somarMeses(hoje, i),
      status: statusInicial,
    })),
  });
}

export async function obterConfiguracaoFinanceira() {
  const existente = await prisma.configuracaoFinanceira.findUnique({ where: { id: ID_CONFIGURACAO } });
  if (existente) return existente;
  return prisma.configuracaoFinanceira.create({ data: { id: ID_CONFIGURACAO } });
}

export async function atualizarPrecoReferencia(precoReferenciaMensalCentavos: number) {
  if (precoReferenciaMensalCentavos <= 0) {
    throw new Error('Preço de referência precisa ser maior que zero');
  }
  return prisma.configuracaoFinanceira.upsert({
    where: { id: ID_CONFIGURACAO },
    update: { precoReferenciaMensalCentavos },
    create: { id: ID_CONFIGURACAO, precoReferenciaMensalCentavos },
  });
}

export interface CriarContratoInput {
  accountId: string;
  veiculoIds: string[];
  precoUnitarioMensalCentavos: number;
  dataInicio?: Date;
  modalidadeContratacao: string;
  numeroProcesso?: string | null;
  observacoes?: string | null;
  formaPagamento: string;
  numeroEmpenho?: string | null;
  parcelas?: number;
}

/** Fluxo 1: fechamento de novo contrato (principal ou independente). */
export async function criarContrato(input: CriarContratoInput) {
  if (input.veiculoIds.length === 0) {
    throw new Error('Selecione ao menos um veículo');
  }
  if (input.precoUnitarioMensalCentavos <= 0) {
    throw new Error('Preço por veículo precisa ser maior que zero');
  }

  const dataInicio = input.dataInicio ?? new Date();
  const dataVencimento = somarMeses(dataInicio, 12);
  const qtdVeiculos = input.veiculoIds.length;
  const valorTotalPeriodoCentavos = input.precoUnitarioMensalCentavos * 12 * qtdVeiculos;

  return prisma.$transaction(async tx => {
    const contrato = await tx.contrato.create({
      data: {
        accountId: input.accountId,
        precoUnitarioMensalCentavos: input.precoUnitarioMensalCentavos,
        qtdVeiculos,
        valorTotalPeriodoCentavos,
        dataInicio,
        dataVencimento,
        modalidadeContratacao: input.modalidadeContratacao,
        numeroProcesso: input.numeroProcesso ?? null,
        observacoes: input.observacoes ?? null,
        status: 'ativo',
      },
    });

    await tx.contratoVeiculo.createMany({
      data: input.veiculoIds.map(vehicleId => ({ contratoId: contrato.id, vehicleId })),
    });

    await criarFaturas(tx, {
      contratoId: contrato.id,
      tipo: 'fechamento_inicial',
      valorTotalCentavos: valorTotalPeriodoCentavos,
      formaPagamento: input.formaPagamento,
      numeroEmpenho: input.numeroEmpenho,
      parcelas: input.parcelas,
    });

    return tx.contrato.findUniqueOrThrow({
      where: { id: contrato.id },
      include: { veiculos: true, faturas: true },
    });
  });
}

export interface AdicionarVeiculosInput {
  accountId: string;
  veiculoIds: string[];
  precoUnitarioMensalCentavos?: number;
  formaPagamento: string;
  numeroEmpenho?: string | null;
  parcelas?: number;
}

/** Fluxo 2: adição de veículo no meio do contrato -- cria um mini-contrato. */
export async function adicionarVeiculosAoOrgao(input: AdicionarVeiculosInput) {
  if (input.veiculoIds.length === 0) {
    throw new Error('Selecione ao menos um veículo');
  }

  const contratoRaiz = await prisma.contrato.findFirst({
    where: { accountId: input.accountId, contratoPaiId: null, status: { not: 'cancelado' } },
    orderBy: { createdAt: 'asc' },
  });
  if (!contratoRaiz) {
    throw new Error('Órgão não tem contrato principal ativo -- feche o contrato principal primeiro');
  }

  const precoUnitarioMensalCentavos =
    input.precoUnitarioMensalCentavos ?? contratoRaiz.precoUnitarioMensalCentavos;
  if (precoUnitarioMensalCentavos <= 0) {
    throw new Error('Preço por veículo precisa ser maior que zero');
  }

  const qtdVeiculos = input.veiculoIds.length;
  const dataInicio = new Date();
  const dataVencimento = somarMeses(dataInicio, 12);
  const valorTotalPeriodoCentavos = precoUnitarioMensalCentavos * 12 * qtdVeiculos;

  return prisma.$transaction(async tx => {
    const contrato = await tx.contrato.create({
      data: {
        accountId: input.accountId,
        contratoPaiId: contratoRaiz.id,
        precoUnitarioMensalCentavos,
        qtdVeiculos,
        valorTotalPeriodoCentavos,
        dataInicio,
        dataVencimento,
        modalidadeContratacao: contratoRaiz.modalidadeContratacao,
        status: 'ativo',
      },
    });

    await tx.contratoVeiculo.createMany({
      data: input.veiculoIds.map(vehicleId => ({ contratoId: contrato.id, vehicleId })),
    });

    await criarFaturas(tx, {
      contratoId: contrato.id,
      tipo: 'aditivo',
      valorTotalCentavos: valorTotalPeriodoCentavos,
      formaPagamento: input.formaPagamento,
      numeroEmpenho: input.numeroEmpenho,
      parcelas: input.parcelas,
    });

    return tx.contrato.findUniqueOrThrow({
      where: { id: contrato.id },
      include: { veiculos: true, faturas: true },
    });
  });
}

/**
 * Fluxo 3: remoção de veículo -- sem estorno nem crédito (decisão
 * confirmada). Idempotente: remover de novo um já-removido não é erro.
 */
export async function removerVeiculo(contratoVeiculoId: string) {
  const atual = await prisma.contratoVeiculo.findUnique({ where: { id: contratoVeiculoId } });
  if (!atual) {
    throw new Error('Vínculo de veículo não encontrado');
  }
  if (!atual.ativo) return atual;

  return prisma.contratoVeiculo.update({
    where: { id: contratoVeiculoId },
    data: { ativo: false, dataExclusao: new Date() },
  });
}

export interface RenovarContratoInput {
  contratoId: string;
  novoPrecoUnitarioMensalCentavos?: number;
  motivoAlteracaoPreco?: string | null;
  formaPagamento: string;
  numeroEmpenho?: string | null;
  parcelas?: number;
}

/**
 * Fluxo 4: renovação -- atualiza o contrato existente (não cria linha
 * nova). Recalcula a quantidade pela contagem atual de veículos ativos,
 * não pelo qtdVeiculos histórico do fechamento original.
 */
export async function renovarContrato(input: RenovarContratoInput) {
  const contrato = await prisma.contrato.findUnique({
    where: { id: input.contratoId },
    include: { veiculos: { where: { ativo: true } } },
  });
  if (!contrato) {
    throw new Error('Contrato não encontrado');
  }
  if (contrato.status === 'cancelado') {
    throw new Error('Contrato cancelado não pode ser renovado');
  }

  const qtdVeiculosAtiva = contrato.veiculos.length;
  if (qtdVeiculosAtiva === 0) {
    throw new Error('Contrato não tem veículos ativos -- nada para renovar');
  }

  const precoUnitarioMensalCentavos =
    input.novoPrecoUnitarioMensalCentavos ?? contrato.precoUnitarioMensalCentavos;
  if (precoUnitarioMensalCentavos <= 0) {
    throw new Error('Preço por veículo precisa ser maior que zero');
  }

  const dataInicio = new Date();
  const dataVencimento = somarMeses(dataInicio, 12);
  const valorTotalPeriodoCentavos = precoUnitarioMensalCentavos * 12 * qtdVeiculosAtiva;
  const precoMudou = precoUnitarioMensalCentavos !== contrato.precoUnitarioMensalCentavos;

  return prisma.$transaction(async tx => {
    if (precoMudou) {
      await tx.historicoPrecoContrato.create({
        data: {
          contratoId: contrato.id,
          precoAnteriorCentavos: contrato.precoUnitarioMensalCentavos,
          precoNovoCentavos: precoUnitarioMensalCentavos,
          motivo: input.motivoAlteracaoPreco ?? null,
        },
      });
    }

    await tx.contrato.update({
      where: { id: contrato.id },
      data: {
        precoUnitarioMensalCentavos,
        qtdVeiculos: qtdVeiculosAtiva,
        valorTotalPeriodoCentavos,
        dataInicio,
        dataVencimento,
        status: 'ativo',
      },
    });

    await criarFaturas(tx, {
      contratoId: contrato.id,
      tipo: 'renovacao',
      valorTotalCentavos: valorTotalPeriodoCentavos,
      formaPagamento: input.formaPagamento,
      numeroEmpenho: input.numeroEmpenho,
      parcelas: input.parcelas,
    });

    return tx.contrato.findUniqueOrThrow({
      where: { id: contrato.id },
      include: { veiculos: true, faturas: true, historicoPrecos: true },
    });
  });
}

export interface ContratoResumoLinha {
  id: string;
  orgao: string;
  dataVencimento: Date;
  valorTotalPeriodoCentavos: number;
}

export interface ResumoFinanceiro {
  receitaTotalContratadaCentavos: number;
  mrrCentavos: number;
  veiculosAtivos: number;
  ticketMedioPorOrgaoCentavos: number;
  contratosAVencer: Array<ContratoResumoLinha & { diasRestantes: number }>;
  contratosVencidos: Array<ContratoResumoLinha & { diasVencido: number }>;
  faturasAtrasadas: Array<{
    id: string;
    orgao: string;
    valorCentavos: number;
    dataVencimento: Date;
    diasAtraso: number;
  }>;
  descontosConcedidos: Array<{
    contratoId: string;
    orgao: string;
    precoUnitarioMensalCentavos: number;
    diferencaCentavos: number;
  }>;
  porModalidade: Array<{ modalidade: string; contratos: number; receitaCentavos: number }>;
}

/** Alimenta o dashboard financeiro (app/dashboard/admin/cobranca). */
export async function calcularResumoFinanceiro(): Promise<ResumoFinanceiro> {
  const hoje = new Date();
  const [contratosAtivos, config, faturasAtrasadasRaw] = await Promise.all([
    prisma.contrato.findMany({
      where: { status: 'ativo' },
      include: {
        account: { select: { name: true, razaoSocial: true } },
        veiculos: { where: { ativo: true } },
      },
    }),
    obterConfiguracaoFinanceira(),
    prisma.fatura.findMany({
      where: { dataVencimento: { lt: hoje }, status: { in: ['emitida', 'aguardando_empenho'] } },
      include: { contrato: { include: { account: { select: { name: true, razaoSocial: true } } } } },
      orderBy: { dataVencimento: 'asc' },
    }),
  ]);

  let receitaTotalContratadaCentavos = 0;
  let mrrCentavos = 0;
  let veiculosAtivos = 0;
  const receitaPorOrgao = new Map<string, number>();
  const contratosAVencer: ResumoFinanceiro['contratosAVencer'] = [];
  const contratosVencidos: ResumoFinanceiro['contratosVencidos'] = [];
  const descontosConcedidos: ResumoFinanceiro['descontosConcedidos'] = [];
  const porModalidadeMap = new Map<string, { contratos: number; receitaCentavos: number }>();

  for (const c of contratosAtivos) {
    receitaTotalContratadaCentavos += c.valorTotalPeriodoCentavos;
    const qtdAtiva = c.veiculos.length;
    mrrCentavos += c.precoUnitarioMensalCentavos * qtdAtiva;
    veiculosAtivos += qtdAtiva;

    const nomeOrgao = c.account.razaoSocial || c.account.name;
    receitaPorOrgao.set(c.accountId, (receitaPorOrgao.get(c.accountId) ?? 0) + c.valorTotalPeriodoCentavos);

    const diasRestantes = Math.ceil((c.dataVencimento.getTime() - hoje.getTime()) / 86_400_000);
    const linha = { id: c.id, orgao: nomeOrgao, dataVencimento: c.dataVencimento, valorTotalPeriodoCentavos: c.valorTotalPeriodoCentavos };
    if (c.dataVencimento < hoje) {
      contratosVencidos.push({ ...linha, diasVencido: -diasRestantes });
    } else if (diasRestantes <= 90) {
      contratosAVencer.push({ ...linha, diasRestantes });
    }

    if (c.precoUnitarioMensalCentavos !== config.precoReferenciaMensalCentavos) {
      descontosConcedidos.push({
        contratoId: c.id,
        orgao: nomeOrgao,
        precoUnitarioMensalCentavos: c.precoUnitarioMensalCentavos,
        diferencaCentavos: config.precoReferenciaMensalCentavos - c.precoUnitarioMensalCentavos,
      });
    }

    const modAtual = porModalidadeMap.get(c.modalidadeContratacao) ?? { contratos: 0, receitaCentavos: 0 };
    modAtual.contratos += 1;
    modAtual.receitaCentavos += c.valorTotalPeriodoCentavos;
    porModalidadeMap.set(c.modalidadeContratacao, modAtual);
  }

  return {
    receitaTotalContratadaCentavos,
    mrrCentavos,
    veiculosAtivos,
    ticketMedioPorOrgaoCentavos:
      receitaPorOrgao.size > 0 ? Math.round(receitaTotalContratadaCentavos / receitaPorOrgao.size) : 0,
    contratosAVencer: contratosAVencer.sort((a, b) => a.diasRestantes - b.diasRestantes),
    contratosVencidos: contratosVencidos.sort((a, b) => b.diasVencido - a.diasVencido),
    faturasAtrasadas: faturasAtrasadasRaw.map(f => ({
      id: f.id,
      orgao: f.contrato.account.razaoSocial || f.contrato.account.name,
      valorCentavos: f.valorCentavos,
      dataVencimento: f.dataVencimento,
      diasAtraso: Math.floor((hoje.getTime() - f.dataVencimento.getTime()) / 86_400_000),
    })),
    descontosConcedidos,
    porModalidade: [...porModalidadeMap.entries()].map(([modalidade, v]) => ({ modalidade, ...v })),
  };
}
