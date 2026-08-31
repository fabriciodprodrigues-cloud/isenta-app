/**
 * Cálculo do status de "imunidade nacional" de um órgão -- ver
 * isenta-conceito-imunidade-nacional.md seção 5 (a regra de ouro: só é
 * imune com 100% confirmado, nunca sinalizar imunidade com pendência).
 *
 * Escopo do MVP: só concessionárias ativas com tipoCanal='EMAIL' entram no
 * cálculo (ver plano -- disparo nacional cobre EMAIL_OFICIO por enquanto,
 * PORTAL_RPA fica de fora por decisão explícita da especificação). As
 * demais ativas contam à parte, como "sem suporte automatizado ainda" --
 * informativo, nunca como pendência do órgão (não são pedidas por ninguém
 * ainda, então não é honesto tratá-las como risco dele).
 *
 * Exclusão à parte: concessionárias com regulador='ARTESP' NUNCA entram
 * aqui, nem como EMAIL nem como "sem canal" -- a ARTESP centraliza num
 * único e-mail (isencao@artesp.sp.gov.br) o pedido de isenção pra TODAS
 * as concessionárias sob sua responsabilidade de uma vez só (confirmado:
 * 19 das 22 concessionárias reguladas por ela compartilham esse mesmo
 * endereço). Se o disparo nacional as tratasse como itens EMAIL comuns,
 * mandaria um e-mail redundante por concessionária pra ARTESP -- exatamente
 * o problema que o módulo ARTESP dedicado (ver artesp-*.ts) já resolve com
 * um dossiê único. A cobertura delas é rastreada só por lá, não aqui.
 *
 * A verdade de cobertura vem sempre do status atual de
 * ConcesssionaireRegistration (reaproveitado, não duplicado) -- o
 * SolicitacaoIsencaoItem mais recente de cada concessionária só entra pra
 * dar o motivo/erro amigável na tela, nunca decide a cobertura sozinho.
 */

import { prisma } from './prisma';

/** Nunca entram no universo do disparo nacional -- ver comentário acima. */
const FORA_DO_ESCOPO_NACIONAL = { regulador: { not: 'ARTESP' } } as const;

export type StatusImunidade = 'IMUNE' | 'PARCIAL' | 'COM_RISCO';

export interface ConcessionariaImunidade {
  id: string;
  nome: string;
  status: string; // status do item mais recente, ou 'nunca_disparado'
  motivo: string | null;
}

export interface ImunidadeResumo {
  status: StatusImunidade;
  totalConcessionariasEmail: number;
  confirmadas: number;
  comProblema: number;
  emAndamento: number;
  concessionariasComProblema: ConcessionariaImunidade[];
  concessionariasPendentes: ConcessionariaImunidade[];
  /** Ativas mas fora do escopo MVP (sem canal, ou canal não-EMAIL) -- informativo. */
  concessionariasSemCanal: number;
}

interface RegistrationLeve {
  vehicleId: string;
  concessionaireId: string;
  status: string;
}

interface ItemRecenteLeve {
  concessionariaId: string;
  status: string;
  ultimoErro: string | null;
  createdAt: Date;
}

/**
 * Rótulo do que está acontecendo com essa concessionária pra esse órgão,
 * priorizando o status real das ConcesssionaireRegistration (que reflete
 * inclusive o botão manual do operador, sem passar por nenhum lote) sobre
 * o status do item do disparo nacional -- é assim que o admin master vê
 * "o operador já mandou isso manualmente" mesmo sem ter disparado nada
 * pela Imunidade Nacional.
 */
function statusDescritivo(statusPorVeiculo: (string | null)[], item?: ItemRecenteLeve): string {
  if (statusPorVeiculo.some(s => s === 'enviado' || s === 'aguardando_resposta')) {
    return 'enviado_aguardando_confirmacao';
  }
  if (item) return item.status;
  if (statusPorVeiculo.some(s => s === 'rascunho')) return 'rascunho_nao_enviado';
  return 'nunca_disparado';
}

function computar(
  veiculoIds: string[],
  concessionariasEmail: { id: string; name: string }[],
  registrations: RegistrationLeve[],
  itensDaConta: ItemRecenteLeve[],
  concessionariasSemCanal: number
): ImunidadeResumo {
  if (veiculoIds.length === 0 || concessionariasEmail.length === 0) {
    return {
      status: 'PARCIAL',
      totalConcessionariasEmail: concessionariasEmail.length,
      confirmadas: 0,
      comProblema: 0,
      emAndamento: concessionariasEmail.length,
      concessionariasComProblema: [],
      concessionariasPendentes: concessionariasEmail.map(c => ({
        id: c.id,
        nome: c.name,
        status: 'nunca_disparado',
        motivo: null,
      })),
      concessionariasSemCanal,
    };
  }

  // item mais recente por concessionária, pra motivo/status amigável.
  const itemMaisRecente = new Map<string, ItemRecenteLeve>();
  for (const item of itensDaConta) {
    const atual = itemMaisRecente.get(item.concessionariaId);
    if (!atual || item.createdAt > atual.createdAt) {
      itemMaisRecente.set(item.concessionariaId, item);
    }
  }

  let confirmadas = 0;
  let comProblema = 0;
  const concessionariasComProblema: ConcessionariaImunidade[] = [];
  const concessionariasPendentes: ConcessionariaImunidade[] = [];

  for (const c of concessionariasEmail) {
    const statusPorVeiculo = veiculoIds.map(
      vid => registrations.find(r => r.vehicleId === vid && r.concessionaireId === c.id)?.status ?? null
    );
    const todosAprovados = statusPorVeiculo.every(s => s === 'aprovado');
    const algumRecusado = statusPorVeiculo.some(s => s === 'recusado');
    const item = itemMaisRecente.get(c.id);

    if (todosAprovados) {
      confirmadas++;
      continue;
    }

    if (algumRecusado || item?.status === 'COM_PROBLEMA') {
      comProblema++;
      concessionariasComProblema.push({
        id: c.id,
        nome: c.name,
        status: item?.status ?? 'COM_PROBLEMA',
        motivo: item?.ultimoErro ?? null,
      });
      continue;
    }

    concessionariasPendentes.push({
      id: c.id,
      nome: c.name,
      status: statusDescritivo(statusPorVeiculo, item),
      motivo: item?.ultimoErro ?? null,
    });
  }

  const status: StatusImunidade =
    confirmadas === concessionariasEmail.length ? 'IMUNE' : comProblema > 0 ? 'COM_RISCO' : 'PARCIAL';

  return {
    status,
    totalConcessionariasEmail: concessionariasEmail.length,
    confirmadas,
    comProblema,
    emAndamento: concessionariasPendentes.length,
    concessionariasComProblema,
    concessionariasPendentes,
    concessionariasSemCanal,
  };
}

/** Imunidade de um único órgão (tela de detalhe). */
export async function calcularImunidade(accountId: string): Promise<ImunidadeResumo> {
  const [veiculos, concessionariasEmail, concessionariasSemCanal, itensDaConta] = await Promise.all([
    prisma.vehicle.findMany({ where: { accountId }, select: { id: true } }),
    prisma.concessionaire.findMany({
      where: { situacao: 'ATIVO', ativoParaCadastro: true, tipoCanal: 'EMAIL', ...FORA_DO_ESCOPO_NACIONAL },
      select: { id: true, name: true },
    }),
    prisma.concessionaire.count({
      where: { situacao: 'ATIVO', ativoParaCadastro: true, ...FORA_DO_ESCOPO_NACIONAL, OR: [{ tipoCanal: { not: 'EMAIL' } }, { tipoCanal: null }] },
    }),
    prisma.solicitacaoIsencaoItem.findMany({
      where: { lote: { accountId } },
      select: { concessionariaId: true, status: true, ultimoErro: true, createdAt: true },
    }),
  ]);

  const veiculoIds = veiculos.map(v => v.id);
  const registrations = await prisma.concesssionaireRegistration.findMany({
    where: {
      vehicleId: { in: veiculoIds },
      concessionaireId: { in: concessionariasEmail.map(c => c.id) },
    },
    select: { vehicleId: true, concessionaireId: true, status: true },
  });

  return computar(veiculoIds, concessionariasEmail, registrations, itensDaConta, concessionariasSemCanal);
}

/**
 * Imunidade de vários órgãos de uma vez (listagem do admin) -- evita N+1
 * fazendo as consultas pesadas uma vez só e agrupando em memória.
 */
export async function calcularImunidadeEmLote(
  accountIds: string[]
): Promise<Map<string, ImunidadeResumo>> {
  const resultado = new Map<string, ImunidadeResumo>();
  if (accountIds.length === 0) return resultado;

  const [veiculos, concessionariasEmail, concessionariasSemCanal, itens] = await Promise.all([
    prisma.vehicle.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true, accountId: true },
    }),
    prisma.concessionaire.findMany({
      where: { situacao: 'ATIVO', ativoParaCadastro: true, tipoCanal: 'EMAIL', ...FORA_DO_ESCOPO_NACIONAL },
      select: { id: true, name: true },
    }),
    prisma.concessionaire.count({
      where: { situacao: 'ATIVO', ativoParaCadastro: true, ...FORA_DO_ESCOPO_NACIONAL, OR: [{ tipoCanal: { not: 'EMAIL' } }, { tipoCanal: null }] },
    }),
    prisma.solicitacaoIsencaoItem.findMany({
      where: { lote: { accountId: { in: accountIds } } },
      select: {
        concessionariaId: true,
        status: true,
        ultimoErro: true,
        createdAt: true,
        lote: { select: { accountId: true } },
      },
    }),
  ]);

  const veiculoIds = veiculos.map(v => v.id);
  const registrations = await prisma.concesssionaireRegistration.findMany({
    where: {
      vehicleId: { in: veiculoIds },
      concessionaireId: { in: concessionariasEmail.map(c => c.id) },
    },
    select: { vehicleId: true, concessionaireId: true, status: true },
  });

  for (const accountId of accountIds) {
    const veiculoIdsDaConta = veiculos.filter(v => v.accountId === accountId).map(v => v.id);
    const itensDaConta = itens.filter(i => i.lote.accountId === accountId);
    resultado.set(
      accountId,
      computar(veiculoIdsDaConta, concessionariasEmail, registrations, itensDaConta, concessionariasSemCanal)
    );
  }

  return resultado;
}
