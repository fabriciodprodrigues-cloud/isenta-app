import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { DadosParaModelo, DocumentoGerado, MapeamentoCamposDocx } from './modelo-documento-tipos';
import { enderecoCompleto } from './oficio-dados';

/**
 * Erro do template em si (tag malformada, loop não fechado etc.) -- nunca um
 * erro de dado faltando, já que tag sem valor correspondente simplesmente
 * renderiza em branco (comportamento padrão do docxtemplater), o que é o
 * certo aqui: um campo que o admin não mapeou não deve derrubar a geração
 * inteira do documento.
 */
export class ModeloDocxInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Modelo de documento (.docx) inválido: ${motivo}`);
    this.name = 'ModeloDocxInvalidoError';
  }
}

function montarValorCampo(chave: string, dados: DadosParaModelo): string {
  switch (chave) {
    case 'responsavelNome':
      return dados.orgao.responsibleName;
    case 'responsavelCpf':
      return ''; // não modelado em OrgaoDoOficio hoje -- fica em branco até existir a fonte real
    case 'orgaoNome':
      return dados.orgao.razaoSocial || dados.orgao.name;
    case 'orgaoCnpj':
      return dados.orgao.cnpj;
    case 'orgaoEndereco':
      return enderecoCompleto(dados.orgao);
    case 'orgaoTelefone':
      return dados.orgao.responsiblePhone;
    case 'orgaoEmail':
      return dados.orgao.responsibleEmail;
    case 'data':
      return dados.dataAtual.toLocaleDateString('pt-BR');
    default:
      return '';
  }
}

/**
 * Preenche o .docx-modelo da concessionária com docxtemplater. Ao contrário
 * de montarDocumentoDocx (oficio-docx.ts), que substitui o corpo inteiro de
 * um documento genérico dentro de um timbre, esta função preenche só os
 * campos marcados num formulário de layout fixo -- texto e formatação do
 * template nunca são tocados, só o que está dentro de {{tag}}.
 */
export async function gerarDocumentoDocx(
  dados: DadosParaModelo,
  modeloBuffer: Buffer,
  mapeamento: MapeamentoCamposDocx
): Promise<DocumentoGerado> {
  let zip: PizZip;
  try {
    zip = new PizZip(modeloBuffer);
  } catch (erro) {
    throw new ModeloDocxInvalidoError('arquivo não é um .docx/zip válido');
  }

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
    });
  } catch (erro) {
    throw new ModeloDocxInvalidoError(descreverErroDocxtemplater(erro));
  }

  // Achata os campos de nível-órgão mapeados pelo admin (chaveDado -> tag) num
  // objeto {tag: valor}, e adiciona a chave fixa `veiculos` para o bloco
  // repetível -- nomes de propriedade dentro do loop são convenção do
  // sistema, documentados na tela de mapeamento, não configuráveis por campo.
  // Com delimiters customizados para "{{"/"}}", o próprio marcador de loop
  // também usa chave dupla: o template precisa ter {{#veiculos}}...{{/veiculos}}
  // (não {#veiculos}...{/veiculos}, que é a sintaxe só com o delimitador
  // padrão de chave simples do docxtemplater).
  const dadosParaTags: Record<string, unknown> = {};
  for (const [chave, tag] of Object.entries(mapeamento.campos)) {
    if (!tag) continue;
    dadosParaTags[tag] = montarValorCampo(chave, dados);
  }

  dadosParaTags.veiculos = dados.veiculos.map(v => ({
    veiculo: [v.marca, v.modelo].filter(Boolean).join(' ') || v.type,
    marca: v.marca ?? '',
    modelo: v.modelo ?? '',
    ano: v.anoModelo ?? v.anoFabricacao ?? '',
    placa: v.plate,
    renavam: v.renavam,
    tipo: v.type,
    cor: v.cor ?? '',
    cnpjCpf: dados.orgao.cnpj,
    observacao: '',
  }));

  try {
    doc.render(dadosParaTags);
  } catch (erro) {
    throw new ModeloDocxInvalidoError(descreverErroDocxtemplater(erro));
  }

  const buffer = doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;

  return {
    buffer,
    fileName: `${dados.concessionariaNome} - ${dados.protocolo}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

/** Docxtemplater agrupa erros de template em `error.properties.errors` (multi-error). */
function descreverErroDocxtemplater(erro: unknown): string {
  const propriedades = (erro as { properties?: { errors?: Array<{ message?: string }> } })?.properties;
  const lista = propriedades?.errors;
  if (Array.isArray(lista) && lista.length > 0) {
    return lista.map(e => e.message ?? String(e)).join('; ');
  }
  return erro instanceof Error ? erro.message : String(erro);
}
