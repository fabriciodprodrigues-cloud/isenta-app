import { format_date } from './utils';
import {
  PRAZO_PROPRIO_MESES,
  PRAZO_LOCADO_MESES,
  ROTULO_CATEGORIA,
  porExtenso,
  enderecoCompleto,
  nomeVeiculo,
  anos,
  type VeiculoDoOficio,
  type DadosDoOficio,
} from './oficio-dados';
import { p, run, RUN_NEGRITO, JUSTIFICADO, ESPACO_DEPOIS, paragrafoVazio } from './word-xml';

/**
 * Corpo do ofício em WordprocessingML, para enxertar no modelo .docx do
 * órgão (ver oficio-docx.ts) e gerar o PDF anexado ao e-mail.
 *
 * Mesma estrutura de conteúdo que montarOficio() já produz em HTML — só o
 * formato de saída muda. Os helpers de baixo nível (p/run/escXml etc.)
 * ficam em word-xml.ts, compartilhados com os documentos da ARTESP.
 */

function tabelaVeiculos(lista: VeiculoDoOficio[], titulo: string, prazo: number): string {
  const cabecalho = ['Placa', 'RENAVAM', 'Marca/Modelo', 'Cor', 'Ano fab./mod.', 'Categoria', 'TAG'];
  const larguras = [1300, 1500, 2100, 1200, 1400, 1000, 900]; // DXA, soma ~9400

  const linhaCabecalho = `<w:tr>${cabecalho
    .map(
      (texto, i) =>
        `<w:tc><w:tcPr><w:tcW w:w="${larguras[i]}" w:type="dxa"/><w:shd w:val="clear" w:fill="E8F0E8"/></w:tcPr>${p(
          run(texto, RUN_NEGRITO)
        )}</w:tc>`
    )
    .join('')}</w:tr>`;

  const linhasVeiculos = lista
    .map(v => {
      const celulas = [
        v.plate,
        v.renavam,
        nomeVeiculo(v),
        v.cor ?? '—',
        anos(v),
        ROTULO_CATEGORIA[v.category] ?? v.category,
        v.tag ?? '—',
      ];
      return `<w:tr>${celulas
        .map(
          (texto, i) =>
            `<w:tc><w:tcPr><w:tcW w:w="${larguras[i]}" w:type="dxa"/></w:tcPr>${p(run(texto))}</w:tc>`
        )
        .join('')}</w:tr>`;
    })
    .join('');

  const bordas =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(lado => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="D8E0DB"/>`)
      .join('') +
    '</w:tblBorders>';

  return (
    p(run(`${titulo} — prazo solicitado: ${porExtenso(prazo)}`, RUN_NEGRITO), ESPACO_DEPOIS(120)) +
    `<w:tbl><w:tblPr><w:tblW w:w="9400" w:type="dxa"/>${bordas}</w:tblPr>` +
    `<w:tblGrid>${larguras.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    linhaCabecalho +
    linhasVeiculos +
    '</w:tbl>' +
    paragrafoVazio()
  );
}

export function montarCorpoOficioWordXml(dados: DadosDoOficio): string {
  const { orgao, concessionariaNome, veiculos, anexos, protocolo, numeroOficio } = dados;

  const proprios = veiculos.filter(v => v.type !== 'locado');
  const locados = veiculos.filter(v => v.type === 'locado');

  const razao = orgao.razaoSocial || orgao.name;
  const dataHoje = format_date(new Date());
  const cidadeFecho = orgao.cidadeEmissao || `${orgao.city}/${orgao.state}`;

  const partes: string[] = [];

  if (orgao.cabecalhoTexto) {
    partes.push(p(run(orgao.cabecalhoTexto)));
  }
  partes.push(p(run(razao, RUN_NEGRITO)));
  partes.push(p(run(`CNPJ ${orgao.cnpj}`)));
  partes.push(p(run(enderecoCompleto(orgao)), ESPACO_DEPOIS(240)));

  partes.push(p(run(`OFÍCIO Nº ${numeroOficio}`, RUN_NEGRITO)));
  partes.push(p(run(`${cidadeFecho}, ${dataHoje}`), ESPACO_DEPOIS(240)));

  partes.push(p(run('À', RUN_NEGRITO)));
  partes.push(p(run(concessionariaNome)));
  partes.push(p(run('Setor de Isenções'), ESPACO_DEPOIS(240)));

  partes.push(
    p(run('Assunto: ', RUN_NEGRITO) + run('Pedido de isenção de pagamento de pedágio — veículos oficiais'))
  );
  partes.push(
    p(run('Interessado: ', RUN_NEGRITO) + run(`${razao} — CNPJ ${orgao.cnpj}`), ESPACO_DEPOIS(240))
  );

  partes.push(p(run('Senhores,'), ESPACO_DEPOIS(120)));

  partes.push(
    p(
      run(
        `A ${razao}, pessoa jurídica de direito público interno, inscrita no CNPJ sob o ` +
          `nº ${orgao.cnpj}, com sede em ${enderecoCompleto(orgao)}, vem, respeitosamente, ` +
          `requerer a concessão de isenção de pagamento de tarifa de pedágio para os ` +
          `veículos oficiais adiante relacionados, empregados exclusivamente em atividades ` +
          `de interesse público.`
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    )
  );

  if (proprios.length) {
    partes.push(tabelaVeiculos(proprios, 'Veículos — frota própria', PRAZO_PROPRIO_MESES));
  }
  if (locados.length) {
    partes.push(tabelaVeiculos(locados, 'Veículos — frota locada', PRAZO_LOCADO_MESES));
  }

  partes.push(p(run('Documentação anexa', RUN_NEGRITO), ESPACO_DEPOIS(120)));
  if (anexos.length) {
    for (const a of anexos) {
      partes.push(p(run(`- ${a}`)));
    }
  } else {
    partes.push(p(run('(sem anexos)')));
  }
  partes.push(paragrafoVazio());

  partes.push(
    p(
      run(
        'Nestes termos, pede deferimento e coloca-se à disposição para prestar ' +
          'esclarecimentos ou apresentar documentação complementar que se faça necessária.'
      ),
      JUSTIFICADO + ESPACO_DEPOIS(240)
    )
  );

  partes.push(p(run('Atenciosamente,'), ESPACO_DEPOIS(360)));

  partes.push(p(run(orgao.responsibleName, RUN_NEGRITO)));
  partes.push(p(run(`${orgao.responsibleRole || 'Responsável pela frota'} — ${razao}`)));
  partes.push(p(run(`${orgao.responsiblePhone} · ${orgao.responsibleEmail}`), ESPACO_DEPOIS(360)));

  partes.push(p(run(`Ofício nº ${numeroOficio} · Protocolo ${protocolo}`)));

  return partes.join('');
}
