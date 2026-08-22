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
  type OrgaoDoOficio,
  type DadosDoOficio,
} from './oficio-dados';

/**
 * Monta o ofício de pedido de isenção em HTML, para o corpo do e-mail.
 *
 * Um ofício por concessionária, cobrindo a frota inteira do órgão — e não um
 * e-mail por veículo. Um órgão com vinte carros dispararia vinte mensagens
 * para o mesmo destinatário, o que dificulta a análise e soa automatizado.
 *
 * Frota própria e frota locada aparecem em seções distintas porque os prazos
 * pedidos são diferentes: 12 meses contra 4.
 *
 * Dados e helpers compartilhados com o template WordML (usado para o PDF
 * anexado quando o órgão tem modelo próprio) vivem em oficio-dados.ts.
 */

export {
  PRAZO_PROPRIO_MESES,
  PRAZO_LOCADO_MESES,
  type VeiculoDoOficio,
  type OrgaoDoOficio,
  type DadosDoOficio,
};

/** Escapa o que vai para dentro do HTML — os dados vêm do cadastro do usuário. */
function esc(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function assuntoDoOficio(orgaoNome: string) {
  return `Pedido de isenção — ${orgaoNome}`;
}

export function montarOficio(dados: DadosDoOficio): { texto: string; html: string } {
  const {
    orgao,
    concessionariaNome,
    veiculos,
    anexos,
    protocolo,
    numeroOficio,
    timbreDataUri,
  } = dados;

  const proprios = veiculos.filter(v => v.type !== 'locado');
  const locados = veiculos.filter(v => v.type === 'locado');

  const razao = orgao.razaoSocial || orgao.name;
  const dataHoje = format_date(new Date());
  const cidadeFecho = orgao.cidadeEmissao || `${orgao.city}/${orgao.state}`;

  // ---------- versão em texto ----------

  const tabelaTexto = (lista: VeiculoDoOficio[]) =>
    lista
      .map(
        v =>
          `  - Placa ${v.plate} | RENAVAM ${v.renavam} | ${nomeVeiculo(v)} | ` +
          `Cor ${v.cor ?? '—'} | Ano ${anos(v)} | ${ROTULO_CATEGORIA[v.category] ?? v.category} | ` +
          `TAG ${v.tag ?? '—'}`
      )
      .join('\n');

  const blocosTexto: string[] = [];

  if (proprios.length) {
    blocosTexto.push(
      `VEÍCULOS — FROTA PRÓPRIA (prazo solicitado: ${porExtenso(PRAZO_PROPRIO_MESES)})\n${tabelaTexto(proprios)}`
    );
  }

  if (locados.length) {
    blocosTexto.push(
      `VEÍCULOS — FROTA LOCADA (prazo solicitado: ${porExtenso(PRAZO_LOCADO_MESES)})\n${tabelaTexto(locados)}`
    );
  }

  const texto = `
${orgao.cabecalhoTexto ? orgao.cabecalhoTexto + '\n' : ''}${razao}
CNPJ ${orgao.cnpj}
${enderecoCompleto(orgao)}

OFÍCIO Nº ${numeroOficio}
${cidadeFecho}, ${dataHoje}

À
${concessionariaNome}
Setor de Isenções

Assunto: Pedido de isenção de pagamento de pedágio — veículos oficiais
Interessado: ${razao} — CNPJ ${orgao.cnpj}

Senhores,

A ${razao}, pessoa jurídica de direito público interno, inscrita no CNPJ sob o
nº ${orgao.cnpj}, com sede em ${enderecoCompleto(orgao)}, vem, respeitosamente,
requerer a concessão de isenção de pagamento de tarifa de pedágio para os
veículos oficiais adiante relacionados, empregados exclusivamente em atividades
de interesse público.

${blocosTexto.join('\n\n')}

DOCUMENTAÇÃO ANEXA
${anexos.length ? anexos.map(a => `  - ${a}`).join('\n') : '  - (sem anexos)'}

Nestes termos, pede deferimento e coloca-se à disposição para prestar
esclarecimentos ou apresentar documentação complementar que se faça necessária.

Atenciosamente,

${orgao.responsibleName}
${orgao.responsibleRole || 'Responsável pela frota'} — ${razao}
${orgao.responsiblePhone} · ${orgao.responsibleEmail}

---
Ofício nº ${numeroOficio} · Protocolo ${protocolo}
Respostas a este e-mail chegam à caixa institucional do órgão e são acompanhadas pelo sistema Isenta.
`.trim();

  // ---------- versão em HTML ----------

  const linhasHtml = (lista: VeiculoDoOficio[]) =>
    lista
      .map(
        v => `
            <tr>
              <td style="padding:8px 10px;border:1px solid #d8e0db;font-family:monospace;font-weight:700;white-space:nowrap;">${esc(v.plate)}</td>
              <td style="padding:8px 10px;border:1px solid #d8e0db;white-space:nowrap;">${esc(v.renavam)}</td>
              <td style="padding:8px 10px;border:1px solid #d8e0db;">${esc(nomeVeiculo(v))}</td>
              <td style="padding:8px 10px;border:1px solid #d8e0db;">${esc(v.cor ?? '—')}</td>
              <td style="padding:8px 10px;border:1px solid #d8e0db;white-space:nowrap;">${esc(anos(v))}</td>
              <td style="padding:8px 10px;border:1px solid #d8e0db;white-space:nowrap;">${esc(ROTULO_CATEGORIA[v.category] ?? v.category)}</td>
              <td style="padding:8px 10px;border:1px solid #d8e0db;font-family:monospace;white-space:nowrap;">${esc(v.tag ?? '—')}</td>
            </tr>`
      )
      .join('');

  const tabelaHtml = (lista: VeiculoDoOficio[], titulo: string, prazo: number) => `
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2d5f2e;font-weight:700;margin:26px 0 10px;">
        ${esc(titulo)} — prazo solicitado: ${porExtenso(prazo)}
      </div>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <thead>
          <tr>
            <th style="text-align:left;background:#e8f0e8;padding:8px 10px;border:1px solid #d8e0db;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Placa</th>
            <th style="text-align:left;background:#e8f0e8;padding:8px 10px;border:1px solid #d8e0db;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">RENAVAM</th>
            <th style="text-align:left;background:#e8f0e8;padding:8px 10px;border:1px solid #d8e0db;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Marca / Modelo</th>
            <th style="text-align:left;background:#e8f0e8;padding:8px 10px;border:1px solid #d8e0db;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Cor</th>
            <th style="text-align:left;background:#e8f0e8;padding:8px 10px;border:1px solid #d8e0db;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Ano fab./mod.</th>
            <th style="text-align:left;background:#e8f0e8;padding:8px 10px;border:1px solid #d8e0db;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Categoria</th>
            <th style="text-align:left;background:#e8f0e8;padding:8px 10px;border:1px solid #d8e0db;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">TAG</th>
          </tr>
        </thead>
        <tbody>${linhasHtml(lista)}</tbody>
      </table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f5f3;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#151a17;padding:40px 44px;">

    ${
      timbreDataUri
        ? `<div style="text-align:center;margin-bottom:20px;">
      <img src="${timbreDataUri}" alt="${esc(razao)}" style="max-width:100%;max-height:130px;">
    </div>`
        : ''
    }

    <div style="border-bottom:2px solid #2d5f2e;padding-bottom:14px;margin-bottom:26px;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:bottom;">
            ${orgao.cabecalhoTexto ? `<div style="font-size:12px;color:#5c6862;">${esc(orgao.cabecalhoTexto)}</div>` : ''}
            <div style="font-family:Georgia,serif;font-size:19px;color:#151a17;">${esc(razao)}</div>
            <div style="font-size:12px;color:#8a968f;">CNPJ ${esc(orgao.cnpj)}</div>
          </td>
          <td style="vertical-align:bottom;text-align:right;font-size:12px;color:#5c6862;">
            <strong style="color:#151a17;">OFÍCIO Nº ${esc(numeroOficio)}</strong><br>
            ${esc(cidadeFecho)}, ${esc(dataHoje)}
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 14px;"><strong>À</strong><br>
    ${esc(concessionariaNome)}<br>
    Setor de Isenções</p>

    <div style="background:#e8f0e8;border-left:3px solid #2d5f2e;padding:12px 16px;margin:0 0 22px;font-size:13px;">
      <div><strong>Assunto:</strong> Pedido de isenção de pagamento de pedágio — veículos oficiais</div>
      <div><strong>Interessado:</strong> ${esc(razao)} — CNPJ ${esc(orgao.cnpj)}</div>
    </div>

    <p style="margin:0 0 14px;">Senhores,</p>

    <p style="margin:0 0 14px;">
      A <strong>${esc(razao)}</strong>, pessoa jurídica de direito público interno,
      inscrita no CNPJ sob o nº ${esc(orgao.cnpj)}, com sede em ${esc(enderecoCompleto(orgao))},
      vem, respeitosamente, requerer a <strong>concessão de isenção de pagamento de
      tarifa de pedágio</strong> para os veículos oficiais adiante relacionados,
      empregados exclusivamente em atividades de interesse público.
    </p>

    <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2d5f2e;font-weight:700;margin:26px 0 10px;">Dados do órgão</div>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13.5px;">
      <tr><td style="padding:3px 0;color:#5c6862;width:170px;">Razão social</td><td style="padding:3px 0;">${esc(razao)}</td></tr>
      <tr><td style="padding:3px 0;color:#5c6862;">CNPJ</td><td style="padding:3px 0;">${esc(orgao.cnpj)}</td></tr>
      <tr><td style="padding:3px 0;color:#5c6862;">Endereço</td><td style="padding:3px 0;">${esc(enderecoCompleto(orgao))}</td></tr>
      <tr><td style="padding:3px 0;color:#5c6862;">Responsável</td><td style="padding:3px 0;">${esc(orgao.responsibleName)}</td></tr>
      <tr><td style="padding:3px 0;color:#5c6862;">Telefone</td><td style="padding:3px 0;">${esc(orgao.responsiblePhone)}</td></tr>
      <tr><td style="padding:3px 0;color:#5c6862;">E-mail</td><td style="padding:3px 0;">${esc(orgao.responsibleEmail)}</td></tr>
    </table>

    ${proprios.length ? tabelaHtml(proprios, 'Veículos — frota própria', PRAZO_PROPRIO_MESES) : ''}
    ${locados.length ? tabelaHtml(locados, 'Veículos — frota locada', PRAZO_LOCADO_MESES) : ''}

    <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2d5f2e;font-weight:700;margin:26px 0 10px;">Documentação anexa</div>
    <ul style="margin:8px 0 0;padding-left:20px;font-size:13.5px;">
      ${anexos.length ? anexos.map(a => `<li style="margin-bottom:3px;">${esc(a)}</li>`).join('') : '<li>(sem anexos)</li>'}
    </ul>

    <p style="margin:28px 0 14px;">
      Nestes termos, pede deferimento e coloca-se à disposição para prestar
      esclarecimentos ou apresentar documentação complementar que se faça necessária.
    </p>

    <p style="margin:0 0 14px;">Atenciosamente,</p>

    <div style="margin-top:26px;padding-top:16px;border-top:1px solid #d8e0db;font-size:13.5px;">
      <div style="font-weight:700;">${esc(orgao.responsibleName)}</div>
      <div style="color:#5c6862;">${esc(orgao.responsibleRole || 'Responsável pela frota')} — ${esc(razao)}</div>
      <div style="color:#5c6862;">${esc(orgao.responsiblePhone)} · ${esc(orgao.responsibleEmail)}</div>
    </div>

    <div style="margin-top:26px;padding-top:14px;border-top:1px solid #d8e0db;font-size:11.5px;color:#8a968f;line-height:1.5;">
      Ofício nº ${esc(numeroOficio)} · Protocolo ${esc(protocolo)}<br>
      Respostas a este e-mail chegam à caixa institucional do órgão e são acompanhadas pelo sistema Isenta.
    </div>

  </div>
</body>
</html>`;

  return { texto, html };
}

/**
 * Mensagem curta de capa, usada quando o ofício sai como PDF anexado (órgão
 * com modelo próprio — ver oficio-docx.ts) em vez de HTML completo no corpo.
 * O texto integral (dados do órgão, tabela de veículos, assinatura) já está
 * no PDF; repeti-lo aqui seria redundante.
 */
export function montarMensagemCurta(dados: DadosDoOficio): { texto: string; html: string } {
  const { orgao, numeroOficio, protocolo, anexos } = dados;
  const razao = orgao.razaoSocial || orgao.name;
  // Quem chama já inclui o PDF do ofício na lista de anexos (junto com
  // CRLV/contrato) antes de montar `dados` — ver registration-orchestrator.ts.
  const listaAnexos = anexos;

  const texto = `
Prezados,

Segue em anexo o Ofício nº ${numeroOficio}, da ${razao}, solicitando isenção
de pagamento de pedágio para os veículos oficiais relacionados no documento.

Documentação anexa:
${listaAnexos.map(a => `  - ${a}`).join('\n')}

Atenciosamente,
${orgao.responsibleName}
${orgao.responsibleRole || 'Responsável pela frota'} — ${razao}

---
Ofício nº ${numeroOficio} · Protocolo ${protocolo}
Respostas a este e-mail chegam à caixa institucional do órgão e são acompanhadas pelo sistema Isenta.
`.trim();

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f2f5f3;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#151a17;padding:32px 36px;">
    <p style="margin:0 0 14px;">Prezados,</p>
    <p style="margin:0 0 14px;">
      Segue em anexo o <strong>Ofício nº ${esc(numeroOficio)}</strong>, da <strong>${esc(razao)}</strong>,
      solicitando isenção de pagamento de pedágio para os veículos oficiais relacionados no documento.
    </p>
    <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#2d5f2e;font-weight:700;margin:22px 0 8px;">Documentação anexa</div>
    <ul style="margin:8px 0 0;padding-left:20px;font-size:13.5px;">
      ${listaAnexos.map(a => `<li style="margin-bottom:3px;">${esc(a)}</li>`).join('')}
    </ul>
    <p style="margin:24px 0 14px;">Atenciosamente,</p>
    <div style="font-size:13.5px;">
      <div style="font-weight:700;">${esc(orgao.responsibleName)}</div>
      <div style="color:#5c6862;">${esc(orgao.responsibleRole || 'Responsável pela frota')} — ${esc(razao)}</div>
    </div>
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #d8e0db;font-size:11.5px;color:#8a968f;line-height:1.5;">
      Ofício nº ${esc(numeroOficio)} · Protocolo ${esc(protocolo)}<br>
      Respostas a este e-mail chegam à caixa institucional do órgão e são acompanhadas pelo sistema Isenta.
    </div>
  </div>
</body>
</html>`;

  return { texto, html };
}
