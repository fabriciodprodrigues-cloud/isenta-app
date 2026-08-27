/**
 * Conteúdo dos 5 documentos exigidos pela Portaria ARTESP nº 56/2025 (ver
 * seção 5 do documento de especificação do módulo).
 *
 * IMPORTANTE: o texto abaixo foi redigido com base na descrição da Portaria
 * fornecida pelo usuário, não a partir de um modelo oficial da ARTESP — a
 * própria especificação lista isso como pendência (obter os templates
 * oficiais, se a ARTESP disponibilizar). Revisar com jurídico/ARTESP antes
 * do primeiro protocolo real.
 *
 * Cada função devolve um corpo WordML (para enxertar no timbre do órgão via
 * montarDocumentoDocx, ver oficio-docx.ts) — mesma técnica do ofício comum,
 * helpers de baixo nível compartilhados via word-xml.ts.
 */

import { format_date } from './utils';
import { enderecoCompleto } from './oficio-dados';
import {
  p,
  run,
  RUN_NEGRITO,
  JUSTIFICADO,
  ESPACO_DEPOIS,
  paragrafoVazio,
  tabelaSimples,
} from './word-xml';
import {
  TIPO_ENTIDADE_LABEL,
  NOME_DOCUMENTO_ARTESP,
  TIPOS_DOCUMENTO_ARTESP,
  nomeVeiculoArtesp,
  anosArtesp,
  type DadosArtesp,
  type TipoDocumentoArtesp,
  type VeiculoArtesp,
} from './artesp-dados';

function cabecalhoOrgao(dados: DadosArtesp): string {
  const razao = dados.orgao.razaoSocial || dados.orgao.name;
  return (
    p(run(razao, RUN_NEGRITO)) +
    p(run(`CNPJ ${dados.orgao.cnpj}`)) +
    p(run(enderecoCompleto(dados.orgao)), ESPACO_DEPOIS(240))
  );
}

function assinaturaResponsavel(dados: DadosArtesp): string {
  const razao = dados.orgao.razaoSocial || dados.orgao.name;
  return (
    p(run('Atenciosamente,'), ESPACO_DEPOIS(360)) +
    p(run(dados.orgao.responsibleName, RUN_NEGRITO)) +
    p(run(`${dados.orgao.responsibleRole || 'Responsável'} — ${razao}`)) +
    p(run(`${dados.orgao.responsiblePhone} · ${dados.orgao.responsibleEmail}`))
  );
}

/** "07519786249 (Sem Parar)" -- combina serial e operadora numa só coluna pra caber na página. */
function tagComOperadora(v: VeiculoArtesp): string {
  if (!v.tag) return '—';
  return v.operadoraTag ? `${v.tag} (${v.operadoraTag})` : v.tag;
}

function tabelaFrota(dados: DadosArtesp): string {
  const cabecalho = ['Placa', 'Prefixo', 'Reg. patrimonial', 'Marca/Modelo', 'Cor', 'Ano fab./mod.', 'TAG (operadora)'];
  // Placa em 1200 DXA quebrava "SMF-6F91" no meio, confirmado numa geração
  // real -- 1400 dá folga pra placa de 7-8 caracteres sem quebrar.
  const larguras = [1400, 1000, 1300, 2000, 1000, 1300, 1700];
  const linhas = dados.veiculos.map(v => [
    v.plate,
    v.prefixo ?? '—',
    v.registroPatrimonial ?? '—',
    nomeVeiculoArtesp(v),
    v.cor ?? '—',
    anosArtesp(v),
    tagComOperadora(v),
  ]);
  return tabelaSimples(cabecalho, larguras, linhas) + paragrafoVazio();
}

function montarCorpoRequerimentoWordXml(dados: DadosArtesp): string {
  const razao = dados.orgao.razaoSocial || dados.orgao.name;
  const dataHoje = format_date(dados.dataEmissao);

  return (
    cabecalhoOrgao(dados) +
    p(run(dataHoje), ESPACO_DEPOIS(240)) +
    p(run('À Diretora Geral da', RUN_NEGRITO)) +
    p(run('Agência de Transporte do Estado de São Paulo — ARTESP'), ESPACO_DEPOIS(240)) +
    p(
      run('Assunto: ', RUN_NEGRITO) +
        run('Requerimento de cadastro de frota para isenção de pedágio — Portaria ARTESP nº 56/2025')
    ) +
    p(run('Interessado: ', RUN_NEGRITO) + run(`${razao} — CNPJ ${dados.orgao.cnpj}`), ESPACO_DEPOIS(240)) +
    p(run('Senhora Diretora Geral,'), ESPACO_DEPOIS(120)) +
    p(
      run(
        `A ${razao}, pessoa jurídica de direito público interno, inscrita no CNPJ sob o ` +
          `nº ${dados.orgao.cnpj}, com sede em ${enderecoCompleto(dados.orgao)}, enquadrada como ` +
          `${TIPO_ENTIDADE_LABEL[dados.tipoEntidade] ?? dados.tipoEntidade}, vem, respeitosamente, ` +
          `requerer o cadastro de sua frota para isenção de pagamento de tarifa de pedágio nas ` +
          `rodovias sob concessão fiscalizada pela ARTESP, nos termos da Portaria ARTESP nº ` +
          `56, de 29 de maio de 2025, relacionando a seguir os veículos oficiais empregados ` +
          `exclusivamente em atividades de interesse público.`
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    ) +
    p(run(`Abrangência solicitada: ${dados.abrangencia}`, RUN_NEGRITO), ESPACO_DEPOIS(240)) +
    p(run('Relação de veículos', RUN_NEGRITO), ESPACO_DEPOIS(120)) +
    tabelaFrota(dados) +
    p(
      run(
        'Seguem anexos os documentos exigidos pelo art. 6º da Portaria ARTESP nº 56/2025: ' +
          'CRLV de cada veículo, contrato de locação (quando aplicável), declaração de correta ' +
          'instalação da TAG, anexo ao termo de adesão junto à operadora de sistema automático, ' +
          'declaração de concordância e solicitação de cobrança automática.'
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    ) +
    p(
      run(
        'Nestes termos, pede deferimento e coloca-se à disposição para prestar esclarecimentos ' +
          'ou apresentar documentação complementar que se faça necessária.'
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    ) +
    assinaturaResponsavel(dados)
  );
}

function montarCorpoDeclaracaoTagWordXml(dados: DadosArtesp): string {
  const razao = dados.orgao.razaoSocial || dados.orgao.name;
  const dataHoje = format_date(dados.dataEmissao);

  return (
    cabecalhoOrgao(dados) +
    p(run('DECLARAÇÃO DE CORRETA INSTALAÇÃO DA TAG', RUN_NEGRITO), ESPACO_DEPOIS(240)) +
    p(
      run(
        `A ${razao}, CNPJ nº ${dados.orgao.cnpj}, declara, para os fins do art. 4º da Portaria ` +
          `ARTESP nº 56/2025, que os dispositivos eletrônicos de identificação veicular (TAG) ` +
          `relacionados a seguir foram corretamente instalados nos respectivos veículos oficiais ` +
          `da frota, adquiridos junto à(s) operadora(s) de sistema automático (OSA) autorizada(s) ` +
          `pela ARTESP indicada(s) na tabela abaixo.`
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    ) +
    tabelaFrota(dados) +
    p(run(dataHoje), ESPACO_DEPOIS(360)) +
    assinaturaResponsavel(dados)
  );
}

function montarCorpoAnexoVeiculosWordXml(dados: DadosArtesp): string {
  const razao = dados.orgao.razaoSocial || dados.orgao.name;

  return (
    cabecalhoOrgao(dados) +
    p(run('ANEXO AO TERMO DE ADESÃO', RUN_NEGRITO)) +
    p(run('Relação de veículos ativos junto à(s) operadora(s) de sistema automático (OSA)'), ESPACO_DEPOIS(240)) +
    p(
      run(
        `Órgão: ${razao} — CNPJ ${dados.orgao.cnpj}`
      ),
      ESPACO_DEPOIS(240)
    ) +
    tabelaFrota(dados)
  );
}

function montarCorpoDeclaracaoConcordanciaWordXml(dados: DadosArtesp): string {
  const razao = dados.orgao.razaoSocial || dados.orgao.name;
  const dataHoje = format_date(dados.dataEmissao);

  return (
    cabecalhoOrgao(dados) +
    p(run('DECLARAÇÃO DE CONCORDÂNCIA', RUN_NEGRITO), ESPACO_DEPOIS(240)) +
    p(
      run(
        `A ${razao}, CNPJ nº ${dados.orgao.cnpj}, declara estar ciente e de acordo com os ` +
          `termos, condições e obrigações estabelecidos pela Portaria ARTESP nº 56, de 29 de ` +
          `maio de 2025, para a concessão de isenção de pagamento de tarifa de pedágio à frota ` +
          `oficial relacionada no requerimento que acompanha esta declaração, comprometendo-se ` +
          `a comunicar de imediato à ARTESP qualquer alteração na frota, extravio ou substituição ` +
          `de TAG, encerramento de contrato de locação, ou outro evento previsto no art. 9º da ` +
          `referida Portaria que implique cancelamento do benefício.`
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    ) +
    p(run(dataHoje), ESPACO_DEPOIS(360)) +
    assinaturaResponsavel(dados)
  );
}

function montarCorpoSolicitacaoCobrancaWordXml(dados: DadosArtesp): string {
  const razao = dados.orgao.razaoSocial || dados.orgao.name;
  const dataHoje = format_date(dados.dataEmissao);

  return (
    cabecalhoOrgao(dados) +
    p(run('SOLICITAÇÃO DE COBRANÇA AUTOMÁTICA', RUN_NEGRITO), ESPACO_DEPOIS(240)) +
    p(
      run(
        `A ${razao}, CNPJ nº ${dados.orgao.cnpj}, solicita o processamento eletrônico automático ` +
          `das passagens da frota oficial relacionada nos anexos, via TAG vinculada à(s) ` +
          `operadora(s) indicada(s) no anexo de veículos, nos termos da Portaria ARTESP nº 56/2025.`
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    ) +
    p(run(dataHoje), ESPACO_DEPOIS(360)) +
    assinaturaResponsavel(dados)
  );
}

const MONTADORES: Record<TipoDocumentoArtesp, (dados: DadosArtesp) => string> = {
  requerimento: montarCorpoRequerimentoWordXml,
  declaracao_tag: montarCorpoDeclaracaoTagWordXml,
  anexo_veiculos: montarCorpoAnexoVeiculosWordXml,
  declaracao_concordancia: montarCorpoDeclaracaoConcordanciaWordXml,
  solicitacao_cobranca: montarCorpoSolicitacaoCobrancaWordXml,
};

export function montarCorpoArtespWordXml(tipo: TipoDocumentoArtesp, dados: DadosArtesp): string {
  return MONTADORES[tipo](dados);
}

// --- Completude (Art. 11 — sem estorno por cadastro incorreto/incompleto) ---

export interface PendenciaArtesp {
  campo: string;
  descricao: string;
}

export interface ResultadoCompletudeArtesp {
  completa: boolean;
  pendencias: PendenciaArtesp[];
}

interface CadastroParaChecagem {
  tipoEntidade: string | null;
  veiculos: { vehicleId: string }[];
  documentos: { tipo: string; status: string }[];
  temModeloOficio: boolean;
}

/**
 * Avalia se o cadastro ARTESP pode ser protocolado. Sempre lista todas as
 * pendências, não só a primeira — mesmo espírito de avaliarIdentidadeEnvio
 * (identidade-envio.ts): quem está resolvendo precisa ver o trabalho
 * inteiro de uma vez.
 */
export function avaliarCompletudeArtesp(cadastro: CadastroParaChecagem): ResultadoCompletudeArtesp {
  const pendencias: PendenciaArtesp[] = [];

  if (!cadastro.tipoEntidade) {
    pendencias.push({ campo: 'tipoEntidade', descricao: 'Classificação da entidade (Tipo A/B) não definida' });
  }

  if (!cadastro.temModeloOficio) {
    pendencias.push({
      campo: 'modeloOficioUrl',
      descricao: 'Modelo de ofício (papel timbrado em .docx) não cadastrado — necessário para gerar os documentos',
    });
  }

  if (cadastro.veiculos.length === 0) {
    pendencias.push({ campo: 'veiculos', descricao: 'Nenhum veículo incluído no cadastro' });
  }

  for (const tipo of TIPOS_DOCUMENTO_ARTESP) {
    const doc = cadastro.documentos.find(d => d.tipo === tipo);
    if (!doc) {
      pendencias.push({
        campo: `documento:${tipo}`,
        descricao: `${NOME_DOCUMENTO_ARTESP[tipo]} ainda não foi gerado`,
      });
    } else if (doc.status !== 'assinado') {
      pendencias.push({
        campo: `documento:${tipo}`,
        descricao: `${NOME_DOCUMENTO_ARTESP[tipo]} gerado, mas ainda não assinado`,
      });
    }
  }

  return { completa: pendencias.length === 0, pendencias };
}
