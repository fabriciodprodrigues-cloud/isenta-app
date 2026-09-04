import type { ModeloDocumentoConcessionaria } from '@prisma/client';
import type { DadosParaModelo, DocumentoGerado, MapeamentoCamposDocx, MapeamentoCamposXlsx } from './modelo-documento-tipos';
import { gerarDocumentoDocx } from './modelo-docx';
import { gerarDocumentoXlsx } from './modelo-xlsx';
import { converterParaPdf } from './email-service';

/**
 * Dispatcher único: tanto processRegistration() (envio real) quanto a rota
 * de pré-visualização chamam esta mesma função, com os mesmos dados de
 * entrada -- a garantia de "preview == envio real" pedida na especificação
 * vem de reuso de código, não de um modo especial dentro dos geradores.
 */
export async function gerarDocumentoConcessionaria(
  dados: DadosParaModelo,
  modelo: Pick<ModeloDocumentoConcessionaria, 'tipo' | 'mapeamentoCampos' | 'formatoSaida'> & {
    arquivoBuffer: Buffer;
  }
): Promise<DocumentoGerado> {
  let documento: DocumentoGerado;

  if (modelo.tipo === 'DOCX') {
    documento = await gerarDocumentoDocx(
      dados,
      modelo.arquivoBuffer,
      (modelo.mapeamentoCampos as unknown as MapeamentoCamposDocx) ?? { campos: {} }
    );
  } else if (modelo.tipo === 'XLSX') {
    documento = await gerarDocumentoXlsx(
      dados,
      modelo.arquivoBuffer,
      (modelo.mapeamentoCampos as unknown as MapeamentoCamposXlsx) ?? {
        campos: {},
        tabelaVeiculos: { linhaInicial: 1, colunas: {} },
      }
    );
  } else {
    // Guarda defensiva: quem chama (registration-orchestrator.ts) só invoca
    // este dispatcher depois de confirmar que existe um modelo ativo
    // DOCX/XLSX -- GENERICO nunca deveria chegar aqui. Detectar cedo em vez
    // de gerar um documento vazio silenciosamente.
    throw new Error('gerarDocumentoConcessionaria chamado com tipo GENERICO -- use o caminho de ofício genérico existente');
  }

  if (modelo.formatoSaida === 'MANTER_ORIGINAL') {
    return documento;
  }

  const extensaoOrigem = modelo.tipo === 'DOCX' ? 'docx' : 'xlsx';
  const pdf = await converterParaPdf(documento.buffer, extensaoOrigem);
  const nomeSemExtensao = documento.fileName.replace(/\.(docx|xlsx)$/i, '');

  return {
    buffer: pdf,
    fileName: `${nomeSemExtensao}.pdf`,
    mimeType: 'application/pdf',
  };
}
