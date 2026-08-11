import { prisma } from './prisma';
import { enviarOficioDeIsencao, type AnexoDocumento } from './email-service';
import type { VeiculoDoOficio } from './oficio-isencao';

/**
 * Resultado do envio de um ofício.
 *
 * `nao_automatizavel` não é falha: é o caso legítimo de concessionária cujo
 * canal exige portal ou tratativa manual. Distinguir de erro importa porque só
 * o erro merece nova tentativa.
 */
export type ResultadoEnvio =
  | {
      status: 'enviado';
      canal: 'EMAIL';
      destino: string;
      veiculos: number;
      anexos: number;
    }
  | { status: 'nao_automatizavel'; motivo: string }
  | { status: 'documento_faltando'; motivo: string }
  | { status: 'ignorado'; motivo: string };

/**
 * Protocolo legível para a concessionária citar na resposta.
 *
 * Deriva do id da solicitação mais antiga do grupo, então é estável e permite
 * localizar o lote depois.
 */
function montarProtocolo(idMaisAntigo: string, criadoEm: Date) {
  return `ISN-${criadoEm.getUTCFullYear()}-${idMaisAntigo.slice(-6).toUpperCase()}`;
}

/**
 * Envia o ofício que cobre todas as solicitações pendentes do mesmo órgão para
 * a mesma concessionária.
 *
 * Recebe o id de uma solicitação e trata o grupo inteiro a que ela pertence:
 * um órgão com vinte veículos deve gerar um ofício, não vinte e-mails para o
 * mesmo destinatário.
 */
export async function processRegistration(
  registrationId: string
): Promise<ResultadoEnvio> {
  const referencia = await prisma.concesssionaireRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      concessionaireId: true,
      vehicle: { select: { accountId: true } },
    },
  });

  if (!referencia) {
    throw new Error(`Solicitação ${registrationId} não encontrada`);
  }

  if (referencia.status !== 'rascunho') {
    return {
      status: 'ignorado',
      motivo: `Solicitação já está em "${referencia.status}"`,
    };
  }

  const concessionaria = await prisma.concessionaire.findUnique({
    where: { id: referencia.concessionaireId },
    select: { id: true, name: true, canalIsentos: true, tipoCanal: true },
  });

  if (!concessionaria) {
    throw new Error('Concessionária não encontrada');
  }

  if (!concessionaria.canalIsentos) {
    return {
      status: 'nao_automatizavel',
      motivo: `${concessionaria.name} não tem canal de isentos cadastrado`,
    };
  }

  if (concessionaria.tipoCanal !== 'EMAIL') {
    return {
      status: 'nao_automatizavel',
      motivo: `${concessionaria.name} usa canal ${concessionaria.tipoCanal ?? 'não definido'}, que ainda exige tratativa manual`,
    };
  }

  // Todas as pendentes do mesmo órgão para esta concessionária.
  const grupo = await prisma.concesssionaireRegistration.findMany({
    where: {
      status: 'rascunho',
      concessionaireId: concessionaria.id,
      vehicle: { accountId: referencia.vehicle.accountId },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      vehicle: {
        select: {
          plate: true,
          renavam: true,
          type: true,
          category: true,
          marca: true,
          modelo: true,
          cor: true,
          anoFabricacao: true,
          anoModelo: true,
          account: true,
          documents: { select: { type: true, fileName: true, url: true } },
        },
      },
    },
  });

  if (grupo.length === 0) {
    return { status: 'ignorado', motivo: 'Nenhuma solicitação pendente' };
  }

  // Toda concessionária exige o CRLV, e veículo locado exige o contrato.
  // Enviar sem eles garante recusa e gasta uma ida e volta.
  const semDocumento = grupo.filter(r => {
    const docs = r.vehicle.documents;
    if (!docs.some(d => d.type === 'crlv')) return true;
    if (r.vehicle.type === 'locado' && !docs.some(d => d.type === 'contract')) return true;
    return false;
  });

  if (semDocumento.length > 0) {
    const placas = semDocumento.map(r => r.vehicle.plate).join(', ');
    return {
      status: 'documento_faltando',
      motivo:
        semDocumento.length === grupo.length
          ? `Anexe a documentação antes de solicitar: ${placas}`
          : `Falta documentação em ${semDocumento.length} de ${grupo.length} veículo(s): ${placas}`,
    };
  }

  const orgao = grupo[0].vehicle.account;
  const protocolo = montarProtocolo(grupo[0].id, grupo[0].createdAt);

  const veiculos: VeiculoDoOficio[] = grupo.map(r => ({
    plate: r.vehicle.plate,
    renavam: r.vehicle.renavam,
    type: r.vehicle.type,
    category: r.vehicle.category,
    marca: r.vehicle.marca,
    modelo: r.vehicle.modelo,
    cor: r.vehicle.cor,
    anoFabricacao: r.vehicle.anoFabricacao,
    anoModelo: r.vehicle.anoModelo,
  }));

  // Um anexo por documento relevante, nomeado com a placa para a
  // concessionária saber a qual veículo pertence.
  const anexos: AnexoDocumento[] = [];
  const nomesAnexos: string[] = [];

  for (const r of grupo) {
    for (const doc of r.vehicle.documents) {
      if (doc.type !== 'crlv' && doc.type !== 'contract') continue;

      const rotulo = doc.type === 'crlv' ? 'CRLV' : 'Contrato';
      const extensao = doc.fileName.split('.').pop() ?? 'pdf';
      const nome = `${rotulo} - ${r.vehicle.plate}.${extensao}`;

      anexos.push({ fileName: nome, url: doc.url });
      nomesAnexos.push(nome);
    }
  }

  const { anexosEnviados } = await enviarOficioDeIsencao({
    destino: concessionaria.canalIsentos,
    anexos,
    dados: {
      protocolo,
      concessionariaNome: concessionaria.name,
      veiculos,
      anexos: nomesAnexos,
      orgao: {
        name: orgao.name,
        razaoSocial: orgao.razaoSocial,
        cnpj: orgao.cnpj,
        address: orgao.address,
        bairro: orgao.bairro,
        numero: orgao.numero,
        city: orgao.city,
        state: orgao.state,
        cep: orgao.cep,
        responsibleName: orgao.responsibleName,
        responsibleEmail: orgao.responsibleEmail,
        responsiblePhone: orgao.responsiblePhone,
      },
    },
  });

  // Só depois do envio confirmado, e para o grupo inteiro — o ofício cobre
  // todos, então todos passam a "enviado" juntos.
  await prisma.concesssionaireRegistration.updateMany({
    where: { id: { in: grupo.map(r => r.id) } },
    data: { status: 'enviado', sentAt: new Date(), protocol: protocolo },
  });

  return {
    status: 'enviado',
    canal: 'EMAIL',
    destino: concessionaria.canalIsentos,
    veiculos: grupo.length,
    anexos: anexosEnviados,
  };
}

export interface ResumoLote {
  oficios: number;
  veiculos: number;
  naoAutomatizaveis: number;
  documentosFaltando: number;
  ignorados: number;
  erros: number;
  detalhes: string[];
}

/**
 * Processa as pendências em lote, um ofício por par órgão + concessionária.
 */
export async function processPendingRegistrations(
  limite = 50
): Promise<ResumoLote> {
  const pendentes = await prisma.concesssionaireRegistration.findMany({
    where: {
      status: 'rascunho',
      concessionaire: { tipoCanal: 'EMAIL', NOT: { canalIsentos: null } },
    },
    take: limite,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      concessionaireId: true,
      vehicle: { select: { accountId: true } },
    },
  });

  const resumo: ResumoLote = {
    oficios: 0,
    veiculos: 0,
    naoAutomatizaveis: 0,
    documentosFaltando: 0,
    ignorados: 0,
    erros: 0,
    detalhes: [],
  };

  // Uma solicitação por par: processRegistration já cobre o grupo inteiro, e
  // repetir o par enviaria o mesmo ofício de novo.
  const paresVistos = new Set<string>();

  for (const pendente of pendentes) {
    const par = `${pendente.vehicle.accountId}::${pendente.concessionaireId}`;
    if (paresVistos.has(par)) continue;
    paresVistos.add(par);

    try {
      const resultado = await processRegistration(pendente.id);

      if (resultado.status === 'enviado') {
        resumo.oficios++;
        resumo.veiculos += resultado.veiculos;
      } else if (resultado.status === 'nao_automatizavel') {
        resumo.naoAutomatizaveis++;
        resumo.detalhes.push(resultado.motivo);
      } else if (resultado.status === 'documento_faltando') {
        resumo.documentosFaltando++;
        resumo.detalhes.push(resultado.motivo);
      } else {
        resumo.ignorados++;
      }
    } catch (error) {
      resumo.erros++;
      const mensagem = error instanceof Error ? error.message : String(error);
      resumo.detalhes.push(`${pendente.id}: ${mensagem}`);
      console.error(`Erro na solicitação ${pendente.id}:`, error);
    }
  }

  return resumo;
}
