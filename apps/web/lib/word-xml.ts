/**
 * Helpers de baixo nível para montar corpo de documento em WordprocessingML,
 * para enxertar em modelos .docx (ver oficio-docx.ts e artesp-documentos.ts).
 *
 * Deliberadamente sem referenciar nenhum w:style por id: só formatação
 * inline (negrito, tamanho, cor, bordas de tabela), para funcionar em
 * qualquer modelo de órgão, independente do que exista ou não no
 * styles.xml dele.
 */

/** Escapa o que vai para dentro do XML — os dados vêm do cadastro do usuário. */
export function escXml(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function p(conteudo: string, propsPar = ''): string {
  return `<w:p><w:pPr>${propsPar}</w:pPr>${conteudo}</w:p>`;
}

export function run(texto: string, propsRun = ''): string {
  return `<w:r><w:rPr>${propsRun}</w:rPr><w:t xml:space="preserve">${escXml(texto)}</w:t></w:r>`;
}

export const RUN_NEGRITO = '<w:b/>';
export const JUSTIFICADO = '<w:jc w:val="both"/>';
export const ESPACO_DEPOIS = (dxa: number) => `<w:spacing w:after="${dxa}"/>`;

export function paragrafoVazio(): string {
  return '<w:p/>';
}

/** Tabela simples com cabeçalho em negrito sobre fundo claro e bordas finas. */
export function tabelaSimples(
  cabecalho: string[],
  larguras: number[],
  linhas: string[][]
): string {
  const linhaCabecalho = `<w:tr>${cabecalho
    .map(
      (texto, i) =>
        `<w:tc><w:tcPr><w:tcW w:w="${larguras[i]}" w:type="dxa"/><w:shd w:val="clear" w:fill="E8F0E8"/></w:tcPr>${p(
          run(texto, RUN_NEGRITO)
        )}</w:tc>`
    )
    .join('')}</w:tr>`;

  const linhasDados = linhas
    .map(
      linha =>
        `<w:tr>${linha
          .map(
            (texto, i) =>
              `<w:tc><w:tcPr><w:tcW w:w="${larguras[i]}" w:type="dxa"/></w:tcPr>${p(run(texto))}</w:tc>`
          )
          .join('')}</w:tr>`
    )
    .join('');

  const largura = larguras.reduce((a, b) => a + b, 0);
  const bordas =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(lado => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="D8E0DB"/>`)
      .join('') +
    '</w:tblBorders>';

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${largura}" w:type="dxa"/>${bordas}</w:tblPr>` +
    `<w:tblGrid>${larguras.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    linhaCabecalho +
    linhasDados +
    '</w:tbl>'
  );
}
