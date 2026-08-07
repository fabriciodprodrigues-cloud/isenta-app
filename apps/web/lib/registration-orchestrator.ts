import { prisma } from './prisma';
import { sendExemptionRequestEmail } from './email-service';

/**
 * Resultado do processamento de uma solicitacao.
 *
 * `nao_automatizavel` nao e falha: e o caso legitimo de concessionaria cujo
 * canal exige portal ou tratativa manual. Distinguir isso de erro importa
 * porque so o erro merece nova tentativa.
 */
export type ResultadoEnvio =
  | { status: 'enviado'; canal: 'EMAIL'; destino: string; anexos: number }
  | { status: 'nao_automatizavel'; motivo: string }
  | { status: 'documento_faltando'; motivo: string }
  | { status: 'ignorado'; motivo: string };

export async function processRegistration(
  registrationId: string
): Promise<ResultadoEnvio> {
  const registration = await prisma.concesssionaireRegistration.findUnique({
    where: { id: registrationId },
    include: {
      vehicle: {
        include: {
          account: true,
          documents: { select: { type: true, fileName: true, url: true } },
        },
      },
      concessionaire: true,
    },
  });

  if (!registration) {
    throw new Error(`Solicitação ${registrationId} não encontrada`);
  }

  if (registration.status !== 'rascunho') {
    return {
      status: 'ignorado',
      motivo: `Solicitação já está em "${registration.status}"`,
    };
  }

  const { concessionaire, vehicle } = registration;

  // O canal vem do banco (canalIsentos/tipoCanal), que e o dado curado
  // manualmente. Antes isto vinha de um mapa fixo em concessionaire-config.ts
  // cujos ids eram placeholders ("eco050-id") ou cuids de um banco anterior —
  // nenhum casava, entao o orquestrador nunca encontrava configuracao e
  // desistia em silencio.
  if (!concessionaire.canalIsentos) {
    return {
      status: 'nao_automatizavel',
      motivo: `${concessionaire.name} não tem canal de isentos cadastrado`,
    };
  }

  if (concessionaire.tipoCanal !== 'EMAIL') {
    return {
      status: 'nao_automatizavel',
      motivo: `${concessionaire.name} usa canal ${concessionaire.tipoCanal ?? 'não definido'}, que ainda exige tratativa manual`,
    };
  }

  // Toda concessionaria exige o CRLV, e veiculo locado exige tambem o
  // contrato. Enviar sem eles garante recusa e gasta uma ida e volta com a
  // concessionaria — melhor barrar aqui e avisar quem opera.
  const documentos = vehicle.documents;
  const temCrlv = documentos.some(d => d.type === 'crlv');

  if (!temCrlv) {
    return {
      status: 'documento_faltando',
      motivo: `Anexe o CRLV do veículo ${vehicle.plate} antes de solicitar a isenção`,
    };
  }

  if (vehicle.type === 'locado' && !documentos.some(d => d.type === 'contract')) {
    return {
      status: 'documento_faltando',
      motivo: `O veículo ${vehicle.plate} é locado: anexe o contrato de locação antes de solicitar a isenção`,
    };
  }

  const anexos = documentos
    .filter(d => d.type === 'crlv' || d.type === 'contract')
    .map(d => ({ fileName: d.fileName, url: d.url }));

  await sendExemptionRequestEmail({
    registrationId,
    vehiclePlate: vehicle.plate,
    concessionaireEmail: concessionaire.canalIsentos,
    concessionaireName: concessionaire.name,
    accountName: vehicle.account.name,
    cnpj: vehicle.account.cnpj,
    renavam: vehicle.renavam,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    cor: vehicle.cor,
    anoFabricacao: vehicle.anoFabricacao,
    anoModelo: vehicle.anoModelo,
    anexos,
  });

  return {
    status: 'enviado',
    canal: 'EMAIL',
    destino: concessionaire.canalIsentos,
    anexos: anexos.length,
  };
}

export interface ResumoLote {
  enviados: number;
  naoAutomatizaveis: number;
  documentosFaltando: number;
  ignorados: number;
  erros: number;
  detalhes: string[];
}

export async function processPendingRegistrations(
  limite = 50
): Promise<ResumoLote> {
  // Só faz sentido tentar quem tem canal de e-mail; o resto sairia como
  // nao_automatizavel a cada execucao, poluindo o resumo.
  const pendentes = await prisma.concesssionaireRegistration.findMany({
    where: {
      status: 'rascunho',
      concessionaire: { tipoCanal: 'EMAIL', NOT: { canalIsentos: null } },
    },
    take: limite,
    select: { id: true },
  });

  const resumo: ResumoLote = {
    enviados: 0,
    naoAutomatizaveis: 0,
    documentosFaltando: 0,
    ignorados: 0,
    erros: 0,
    detalhes: [],
  };

  for (const pendente of pendentes) {
    try {
      const resultado = await processRegistration(pendente.id);

      if (resultado.status === 'enviado') resumo.enviados++;
      else if (resultado.status === 'nao_automatizavel') {
        resumo.naoAutomatizaveis++;
        resumo.detalhes.push(resultado.motivo);
      } else if (resultado.status === 'documento_faltando') {
        resumo.documentosFaltando++;
        resumo.detalhes.push(resultado.motivo);
      } else resumo.ignorados++;
    } catch (error) {
      resumo.erros++;
      const mensagem = error instanceof Error ? error.message : String(error);
      resumo.detalhes.push(`${pendente.id}: ${mensagem}`);
      console.error(`Erro na solicitação ${pendente.id}:`, error);
    }
  }

  return resumo;
}
