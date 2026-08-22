import JSZip from 'jszip';
import { montarCorpoOficioWordXml } from './oficio-docx-corpo';
import type { DadosDoOficio } from './oficio-dados';

/**
 * Gera o .docx final do ofício, enxertando o corpo gerado programaticamente
 * dentro do modelo (.docx) que o órgão enviou.
 *
 * O modelo do órgão normalmente é só papel timbrado: cabeçalho com a logo,
 * corpo em branco (ver comentário em cima de montarCorpoOficioWordXml). Em
 * vez de gerar o documento inteiro do zero e tentar recriar esse cabeçalho —
 * o que exigiria decodificar a imagem do órgão em JavaScript, e o formato
 * real observado (EMF) não é suportado pelas libs de geração de docx —, esta
 * função usa o .docx do órgão como base e substitui só o <w:body>,
 * preservando o <w:sectPr> final (page setup + referência ao cabeçalho)
 * intacto. O LibreOffice, na conversão para PDF, é quem lê o cabeçalho —
 * nunca precisamos entender o formato da imagem aqui.
 */
export class ModeloOficioInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Modelo de ofício inválido: ${motivo}`);
    this.name = 'ModeloOficioInvalidoError';
  }
}

export async function montarOficioDocx(
  dados: DadosDoOficio,
  modeloBuffer: Buffer
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(modeloBuffer);

  const arquivoDocument = zip.file('word/document.xml');
  if (!arquivoDocument) {
    throw new ModeloOficioInvalidoError('word/document.xml não encontrado no .docx');
  }

  const xmlOriginal = await arquivoDocument.async('string');

  const inicioBody = xmlOriginal.indexOf('<w:body>');
  const fimBody = xmlOriginal.lastIndexOf('</w:body>');
  if (inicioBody === -1 || fimBody === -1) {
    throw new ModeloOficioInvalidoError('tag <w:body> não encontrada');
  }

  // O sectPr final (fora de qualquer <w:p>) carrega o page setup e as
  // referências de cabeçalho/rodapé do documento — precisa sobreviver
  // intacto para o cabeçalho do órgão continuar aparecendo.
  const miolo = xmlOriginal.slice(inicioBody + '<w:body>'.length, fimBody);
  const indiceSectPr = miolo.lastIndexOf('<w:sectPr');
  const sectPrFinal = indiceSectPr !== -1 ? miolo.slice(indiceSectPr) : '';

  const corpoNovo = montarCorpoOficioWordXml(dados);

  const xmlFinal =
    xmlOriginal.slice(0, inicioBody) +
    '<w:body>' +
    corpoNovo +
    sectPrFinal +
    '</w:body>' +
    xmlOriginal.slice(fimBody + '</w:body>'.length);

  zip.file('word/document.xml', xmlFinal);

  const resultado = await zip.generateAsync({ type: 'nodebuffer' });
  return resultado;
}
