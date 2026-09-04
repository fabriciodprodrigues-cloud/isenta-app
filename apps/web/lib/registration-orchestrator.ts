import { get } from '@vercel/blob';
import { prisma } from './prisma';
import {
  enviarOficioDeIsencao,
  converterDocxParaPdf,
  type AnexoDocumento,
} from './email-service';
import type { VeiculoDoOficio, DadosDoOficio } from './oficio-isencao';
import { montarOficioDocx } from './oficio-docx';
import { avaliarIdentidadeEnvio, type Pendencia } from './identidade-envio';
import { abrir, type CredencialSmtp } from './cofre';
import { gerarDocumentoConcessionaria } from './modelo-documento';
import type { DadosParaModelo } from './modelo-documento-tipos';

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
  | { status: 'identidade_incompleta'; motivo: string; pendencias: Pendencia[] }
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
 * Carrega o papel timbrado e devolve como data URI.
 *
 * Embutido no HTML porque cliente de e-mail bloqueia imagem remota por padrão:
 * um timbre servido por URL apareceria como espaço vazio na maioria das caixas,
 * justamente no topo do documento.
 */
async function carregarTimbre(pathname: string): Promise<string | null> {
  try {
    const resultado = await get(pathname, { access: 'private' });

    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      console.error(`Timbre indisponível no Blob: ${pathname}`);
      return null;
    }

    const tipo = resultado.blob.contentType ?? 'image/png';

    // Um timbre com mimetype fora de imagem (PDF, DOCX) vira um <img src>
    // inválido e corrompe o HTML do ofício inteiro — já aconteceu por uma
    // falha na validação do upload (ver identidade/timbre/route.ts). Ignora
    // e segue sem timbre em vez de quebrar o envio.
    if (!tipo.startsWith('image/')) {
      console.error(`Timbre com mimetype inválido, ignorado: ${pathname} (${tipo})`);
      return null;
    }

    const buffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());

    return `data:${tipo};base64,${buffer.toString('base64')}`;
  } catch (erro) {
    console.error('Falha ao carregar o papel timbrado:', erro);
    return null;
  }
}

/**
 * Carrega o modelo de ofício (.docx) do órgão, como buffer bruto — sem
 * conversão nenhuma, quem usa (montarOficioDocx) é quem sabe manipular XML.
 */
export async function carregarModeloOficio(pathname: string): Promise<Buffer | null> {
  try {
    const resultado = await get(pathname, { access: 'private' });

    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      console.error(`Modelo de ofício indisponível no Blob: ${pathname}`);
      return null;
    }

    return Buffer.from(await new Response(resultado.stream).arrayBuffer());
  } catch (erro) {
    console.error('Falha ao carregar o modelo de ofício:', erro);
    return null;
  }
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

  // Antes de qualquer coisa: o órgão precisa ter identidade própria de envio.
  // Nenhuma solicitação sai em nome da Isenta — a checagem vem aqui, e não na
  // interface, para que a regra valha por construção e não por disciplina.
  const orgaoIdentidade = await prisma.account.findUnique({
    where: { id: referencia.vehicle.accountId },
    select: {
      name: true,
      emailIsencao: true,
      metodoAcessoEmail: true,
      emailVerificado: true,
      emailCredencialCifrada: true,
      timbreUrl: true,
      metodoAssinatura: true,
      responsibleName: true,
      responsibleRole: true,
      cidadeEmissao: true,
      autorizacao: { select: { ativo: true, validoAte: true } },
    },
  });

  if (!orgaoIdentidade) {
    throw new Error('Órgão não encontrado');
  }

  const identidade = avaliarIdentidadeEnvio(orgaoIdentidade);

  if (!identidade.completa) {
    return {
      status: 'identidade_incompleta',
      motivo:
        `${orgaoIdentidade.name} ainda não pode enviar solicitações: ` +
        identidade.pendencias.map(p => p.descricao).join('; '),
      pendencias: identidade.pendencias,
    };
  }

  const concessionaria = await prisma.concessionaire.findUnique({
    where: { id: referencia.concessionaireId },
    select: {
      id: true, name: true, canalIsentos: true, tipoCanal: true,
      // Filtrado por ativo:true -- um modelo em rascunho/desativado nunca
      // deve afetar um envio real, só a pré-visualização (que consulta a
      // linha diretamente, sem esse filtro).
      modeloDocumento: {
        where: { ativo: true },
        select: { tipo: true, arquivoUrl: true, mapeamentoCampos: true, formatoSaida: true },
      },
    },
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
          tags: { select: { serialNumber: true } },
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

  // Reserva o número do ofício de forma atômica. Um increment do Prisma evita
  // que dois envios simultâneos do mesmo órgão recebam o mesmo número.
  const { proximoNumeroOficio } = await prisma.account.update({
    where: { id: orgao.id },
    data: { proximoNumeroOficio: { increment: 1 } },
    select: { proximoNumeroOficio: true },
  });

  const sequencial = proximoNumeroOficio - 1;
  const numeroOficio = `${String(sequencial).padStart(3, '0')}/${new Date().getUTCFullYear()}`;

  const timbreDataUri = orgao.timbreUrl
    ? await carregarTimbre(orgao.timbreUrl)
    : null;

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
    tag: r.vehicle.tags[0]?.serialNumber ?? null,
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

  // Credencial da caixa do órgão. Sem ela o envio falha: nada sai em nome da
  // Isenta, e não existe caminho alternativo.
  let remetente: CredencialSmtp | null = null;
  if (orgaoIdentidade.emailCredencialCifrada) {
    try {
      remetente = abrir<CredencialSmtp>(orgaoIdentidade.emailCredencialCifrada);
    } catch (erro) {
      console.error('Credencial do órgão ilegível:', erro);
    }
  }

  if (!remetente) {
    return {
      status: 'identidade_incompleta',
      motivo:
        `${orgaoIdentidade.name} não tem a credencial da caixa institucional ` +
        'configurada, e nenhuma solicitação sai em nome da Isenta.',
      pendencias: [
        {
          campo: 'emailCredencialCifrada',
          descricao: 'Credencial SMTP da caixa de isenção não configurada',
          passo: 3,
        },
      ],
    };
  }

  const dadosDoOficio: DadosDoOficio = {
    numeroOficio,
    protocolo,
    concessionariaNome: concessionaria.name,
    veiculos,
    anexos: nomesAnexos,
    timbreDataUri,
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
      emailIsencao: orgao.emailIsencao!,
      responsiblePhone: orgao.responsiblePhone,
      responsibleRole: orgao.responsibleRole,
      cabecalhoTexto: orgao.cabecalhoTexto,
      cidadeEmissao: orgao.cidadeEmissao,
    },
  };

  // Concessionária com modelo próprio (Word/Excel específico dela) tem
  // prioridade total: é um documento completamente diferente, com o próprio
  // timbre já embutido, então o ramo de modeloOficioUrl do ÓRGÃO abaixo nem
  // deve rodar quando este existir. Falha aqui (modelo quebrado, tag/célula
  // não bate) nunca bloqueia o envio -- cai pro caminho antigo, mesma
  // filosofia já usada pro modeloOficioUrl do órgão.
  let anexoDocumentoEspecifico: AnexoDocumento | null = null;

  if (concessionaria.modeloDocumento?.arquivoUrl) {
    const modeloBuffer = await carregarModeloOficio(concessionaria.modeloDocumento.arquivoUrl);
    if (modeloBuffer) {
      try {
        const dadosParaModelo: DadosParaModelo = {
          orgao: dadosDoOficio.orgao,
          concessionariaNome: concessionaria.name,
          numeroOficio,
          protocolo,
          veiculos,
          dataAtual: new Date(),
        };
        const documento = await gerarDocumentoConcessionaria(dadosParaModelo, {
          tipo: concessionaria.modeloDocumento.tipo,
          mapeamentoCampos: concessionaria.modeloDocumento.mapeamentoCampos,
          formatoSaida: concessionaria.modeloDocumento.formatoSaida,
          arquivoBuffer: modeloBuffer,
        });
        anexoDocumentoEspecifico = { fileName: documento.fileName, content: documento.buffer };
        nomesAnexos.unshift(documento.fileName);
      } catch (erro) {
        console.error(`Falha ao gerar documento específico de ${concessionaria.name}:`, erro);
      }
    }
  }

  // Órgão com modelo próprio: gera o PDF do ofício (corpo programático
  // enxertado no cabeçalho/timbre do modelo) e anexa, em vez de mandar o
  // texto completo no corpo do e-mail. Modelo quebrado ou conversão
  // indisponível caem de volta pro HTML de sempre — nunca bloqueiam o envio
  // por causa disso.
  let anexoOficioPdf: AnexoDocumento | null = null;

  if (!anexoDocumentoEspecifico && orgao.modeloOficioUrl) {
    const modelo = await carregarModeloOficio(orgao.modeloOficioUrl);
    if (modelo) {
      try {
        const docx = await montarOficioDocx(dadosDoOficio, modelo);
        const pdf = await converterDocxParaPdf(docx);
        const nomeArquivo = `Oficio ${numeroOficio.replace('/', '-')} - ${orgao.name}.pdf`;
        anexoOficioPdf = { fileName: nomeArquivo, content: pdf };
        // Entra na lista só agora — o corpo do PDF (montado acima) não deve
        // se listar como o próprio anexo.
        nomesAnexos.unshift(nomeArquivo);
      } catch (erro) {
        console.error(`Falha ao gerar PDF do ofício para ${orgao.name}:`, erro);
      }
    }
  }

  if (anexoDocumentoEspecifico) anexos.unshift(anexoDocumentoEspecifico);
  else if (anexoOficioPdf) anexos.unshift(anexoOficioPdf);

  const { anexosEnviados } = await enviarOficioDeIsencao({
    destino: concessionaria.canalIsentos,
    remetente,
    anexos,
    usarMensagemCurta: Boolean(anexoDocumentoEspecifico) || Boolean(anexoOficioPdf),
    dados: dadosDoOficio,
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
  identidadeIncompleta: number;
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
    identidadeIncompleta: 0,
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
      } else if (resultado.status === 'identidade_incompleta') {
        resumo.identidadeIncompleta++;
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

// --- Imunidade Nacional: processamento dos itens de um lote ---
//
// A cobertura de verdade é sempre lida do status atual de
// ConcesssionaireRegistration (reaproveitado, ver processRegistration
// acima) -- estas funções só mantêm o SolicitacaoIsencaoItem sincronizado
// com isso, nunca decidem cobertura por conta própria.

/** Está coberto (todo veículo da frota atual aprovado nessa concessionária)? Algum recusado? */
async function statusDoPar(
  accountId: string,
  concessionariaId: string
): Promise<{ completo: boolean; algumRecusado: boolean }> {
  const veiculos = await prisma.vehicle.findMany({ where: { accountId }, select: { id: true } });
  if (veiculos.length === 0) return { completo: false, algumRecusado: false };

  const registrations = await prisma.concesssionaireRegistration.findMany({
    where: { vehicleId: { in: veiculos.map(v => v.id) }, concessionaireId: concessionariaId },
    select: { vehicleId: true, status: true },
  });

  const completo = veiculos.every(
    v => registrations.find(r => r.vehicleId === v.id)?.status === 'aprovado'
  );
  const algumRecusado = registrations.some(r => r.status === 'recusado');

  return { completo, algumRecusado };
}

async function sincronizarStatusDoLote(loteId: string): Promise<void> {
  const itens = await prisma.solicitacaoIsencaoItem.findMany({
    where: { loteId },
    select: { status: true },
  });
  if (itens.length === 0) return;

  const TERMINAIS = ['CONFIRMADA', 'COM_PROBLEMA', 'CANCELADA'];
  const todosTerminais = itens.every(i => TERMINAIS.includes(i.status));
  if (!todosTerminais) return;

  const status = itens.every(i => i.status === 'CONFIRMADA') ? 'CONCLUIDO_TOTAL' : 'CONCLUIDO_PARCIAL';
  await prisma.solicitacaoIsencaoLote.update({ where: { id: loteId }, data: { status } });
}

/**
 * Reavalia um item a partir do status atual das ConcesssionaireRegistration
 * da frota. Chamado depois de um envio bem-sucedido perder o rastro (ex.:
 * já não sobrava linha "rascunho" pra reenviar) e, principalmente, depois
 * de confirmarResposta() aprovar/recusar por leitura de e-mail revisada.
 */
export async function sincronizarItemDoLote(itemId: string): Promise<void> {
  const item = await prisma.solicitacaoIsencaoItem.findUnique({
    where: { id: itemId },
    select: { id: true, concessionariaId: true, lote: { select: { id: true, accountId: true } } },
  });
  if (!item) return;

  const { completo, algumRecusado } = await statusDoPar(item.lote.accountId, item.concessionariaId);

  if (completo) {
    await prisma.solicitacaoIsencaoItem.update({
      where: { id: item.id },
      data: { status: 'CONFIRMADA', dataConfirmacao: new Date() },
    });
  } else if (algumRecusado) {
    await prisma.solicitacaoIsencaoItem.update({
      where: { id: item.id },
      data: { status: 'COM_PROBLEMA', ultimoErro: 'Recusado pela concessionária' },
    });
  }

  await sincronizarStatusDoLote(item.lote.id);
}

export interface ResumoProcessamentoLote {
  processados: number;
  enviados: number;
  pendentes: number;
  comProblema: number;
  loteStatus: string;
}

/**
 * Varredura dos itens de um lote de imunidade nacional -- mesmo padrão de
 * processPendingRegistrations (sequencial, dentro do maxDuration=60 da
 * rota que chama), só que escopado a um lote e mapeando o resultado pro
 * status do SolicitacaoIsencaoItem em vez de só contar.
 *
 * Não distingue PENDENTE_PRE_REQUISITO de NA_FILA como dois passos
 * separados: processRegistration já faz a própria checagem de
 * pré-requisito no momento do envio, então tentar de novo é o próprio
 * jeito de saber se o pré-requisito foi satisfeito -- uma checagem prévia
 * duplicaria essa lógica.
 *
 * Limite baixo de propósito: cada item pode envolver timbre, geração de
 * docx, conversão pra PDF no relay da VPS e envio SMTP -- 30 itens numa
 * chamada só estourou o Vercel Runtime Timeout de 60s em produção (órgão
 * com 35 concessionárias elegíveis). O admin clica "Processar pendências"
 * de novo pra continuar o lote -- mesmo padrão já usado em
 * processPendingRegistrations.
 */
export async function processarItensDoLote(
  loteId: string,
  limite = 8
): Promise<ResumoProcessamentoLote> {
  const itens = await prisma.solicitacaoIsencaoItem.findMany({
    where: { loteId, status: { in: ['PENDENTE_PRE_REQUISITO', 'NA_FILA'] } },
    take: limite,
    orderBy: { createdAt: 'asc' },
    select: { id: true, concessionariaId: true, lote: { select: { accountId: true } } },
  });

  const resumo: ResumoProcessamentoLote = {
    processados: 0,
    enviados: 0,
    pendentes: 0,
    comProblema: 0,
    loteStatus: '',
  };

  for (const item of itens) {
    resumo.processados++;

    const candidata = await prisma.concesssionaireRegistration.findFirst({
      where: {
        status: 'rascunho',
        concessionaireId: item.concessionariaId,
        vehicle: { accountId: item.lote.accountId },
      },
      select: { id: true },
    });

    if (!candidata) {
      await sincronizarItemDoLote(item.id);
      resumo.pendentes++;
      continue;
    }

    try {
      const resultado = await processRegistration(candidata.id);

      if (resultado.status === 'enviado') {
        const enviado = await prisma.concesssionaireRegistration.findFirst({
          where: {
            concessionaireId: item.concessionariaId,
            vehicle: { accountId: item.lote.accountId },
            status: 'enviado',
          },
          orderBy: { sentAt: 'desc' },
          select: { protocol: true, sentAt: true },
        });
        await prisma.solicitacaoIsencaoItem.update({
          where: { id: item.id },
          data: {
            status: 'ENVIADA',
            dataEnvio: enviado?.sentAt ?? new Date(),
            protocolo: enviado?.protocol ?? null,
          },
        });
        resumo.enviados++;
      } else if (resultado.status === 'ignorado') {
        await sincronizarItemDoLote(item.id);
        resumo.pendentes++;
      } else {
        // documento_faltando | identidade_incompleta | nao_automatizavel
        await prisma.solicitacaoIsencaoItem.update({
          where: { id: item.id },
          data: { status: 'PENDENTE_PRE_REQUISITO', ultimoErro: resultado.motivo },
        });
        resumo.pendentes++;
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      await prisma.solicitacaoIsencaoItem.update({
        where: { id: item.id },
        data: { status: 'COM_PROBLEMA', ultimoErro: mensagem, tentativas: { increment: 1 } },
      });
      resumo.comProblema++;
    }
  }

  await sincronizarStatusDoLote(loteId);
  const lote = await prisma.solicitacaoIsencaoLote.findUnique({
    where: { id: loteId },
    select: { status: true },
  });
  resumo.loteStatus = lote?.status ?? 'EM_ANDAMENTO';

  return resumo;
}
