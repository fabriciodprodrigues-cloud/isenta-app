import { format_date } from './utils';

/**
 * Monta o ofício de pedido de isenção.
 *
 * Um ofício por concessionária, cobrindo a frota inteira do órgão — e não um
 * e-mail por veículo. Um órgão com vinte carros dispararia vinte mensagens
 * para o mesmo destinatário, o que dificulta a análise e soa automatizado.
 *
 * Frota própria e frota locada aparecem em seções distintas porque os prazos
 * pedidos são diferentes: 12 meses contra 4.
 */

export const PRAZO_PROPRIO_MESES = 12;
export const PRAZO_LOCADO_MESES = 4;

export interface VeiculoDoOficio {
  plate: string;
  renavam: string;
  type: string;
  category: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
}

export interface OrgaoDoOficio {
  name: string;
  razaoSocial: string | null;
  cnpj: string;
  address: string;
  bairro: string | null;
  numero: string | null;
  city: string;
  state: string;
  cep: string | null;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
}

export interface DadosDoOficio {
  protocolo: string;
  orgao: OrgaoDoOficio;
  concessionariaNome: string;
  veiculos: VeiculoDoOficio[];
  anexos: string[];
}

const ROTULO_CATEGORIA: Record<string, string> = {
  oficial: 'Oficial',
  ambulancia: 'Ambulância',
  bombeiro: 'Bombeiro',
  outro: 'Outro',
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

function porExtenso(meses: number) {
  const extenso: Record<number, string> = { 4: 'quatro', 12: 'doze' };
  return `${meses} (${extenso[meses] ?? meses}) meses`;
}

function enderecoCompleto(o: OrgaoDoOficio) {
  const linha = [o.address, o.numero, o.bairro].filter(Boolean).join(', ');
  const cidade = `${o.city}/${o.state}`;
  return [linha, cidade, o.cep].filter(Boolean).join(' — ');
}

function nomeVeiculo(v: VeiculoDoOficio) {
  return [v.marca, v.modelo].filter(Boolean).join(' ') || '—';
}

function anos(v: VeiculoDoOficio) {
  if (!v.anoFabricacao && !v.anoModelo) return '—';
  return `${v.anoFabricacao ?? '—'} / ${v.anoModelo ?? '—'}`;
}

export function assuntoDoOficio(orgaoNome: string) {
  return `Pedido de isenção — ${orgaoNome}`;
}

export function montarOficio(dados: DadosDoOficio): { texto: string; html: string } {
  const { orgao, concessionariaNome, veiculos, anexos, protocolo } = dados;

  const proprios = veiculos.filter(v => v.type !== 'locado');
  const locados = veiculos.filter(v => v.type === 'locado');

  const razao = orgao.razaoSocial || orgao.name;
  const dataHoje = format_date(new Date());

  // ---------- versão em texto ----------

  const tabelaTexto = (lista: VeiculoDoOficio[]) =>
    lista
      .map(
        v =>
          `  - Placa ${v.plate} | RENAVAM ${v.renavam} | ${nomeVeiculo(v)} | ` +
          `Cor ${v.cor ?? '—'} | Ano ${anos(v)} | ${ROTULO_CATEGORIA[v.category] ?? v.category}`
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
${razao}
CNPJ ${orgao.cnpj}
${enderecoCompleto(orgao)}

Protocolo ${protocolo}
${orgao.city}/${orgao.state}, ${dataHoje}

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
Responsável pela frota — ${razao}
${orgao.responsiblePhone} · ${orgao.responsibleEmail}

---
Mensagem encaminhada pela plataforma Isenta em nome do órgão interessado.
Respostas a este e-mail são recebidas pelo responsável indicado acima.
Para referência futura, utilize o protocolo ${protocolo}.
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
          </tr>
        </thead>
        <tbody>${linhasHtml(lista)}</tbody>
      </table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f5f3;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#151a17;padding:40px 44px;">

    <div style="border-bottom:2px solid #2d5f2e;padding-bottom:14px;margin-bottom:26px;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:bottom;">
            <div style="font-family:Georgia,serif;font-size:21px;color:#2d5f2e;">isenta</div>
            <div style="font-size:12px;color:#8a968f;">Gestão de Isenções de Pedágio</div>
          </td>
          <td style="vertical-align:bottom;text-align:right;font-size:12px;color:#5c6862;">
            Protocolo ${esc(protocolo)}<br>
            ${esc(orgao.city)}/${esc(orgao.state)}, ${esc(dataHoje)}
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
      <div style="color:#5c6862;">Responsável pela frota — ${esc(razao)}</div>
      <div style="color:#5c6862;">${esc(orgao.responsiblePhone)} · ${esc(orgao.responsibleEmail)}</div>
    </div>

    <div style="margin-top:26px;padding-top:14px;border-top:1px solid #d8e0db;font-size:11.5px;color:#8a968f;line-height:1.5;">
      Mensagem encaminhada pela plataforma Isenta em nome do órgão interessado.
      Respostas a este e-mail são recebidas pelo responsável indicado acima.
      Para referência futura, utilize o protocolo ${esc(protocolo)}.
    </div>

  </div>
</body>
</html>`;

  return { texto, html };
}
