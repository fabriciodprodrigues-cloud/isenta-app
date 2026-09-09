import { montarOficio } from './oficio-isencao';
import type { DadosDoOficio } from './oficio-isencao';
import { montarOficioDocx, carregarModeloOficio } from './oficio-docx';
import { converterDocxParaPdf } from './email-service';

/**
 * Ofício genérico da Isenta -- extraído de processRegistration() pra ser
 * reaproveitado também pelo gerador avulso de documentos (seção 8-A da
 * especificação), sem duplicar a lógica de decisão entre PDF-com-timbre
 * e HTML-de-sempre. Comportamento idêntico ao que já existia inline: só
 * mudou de lugar.
 */
export type OficioGerado =
  | { kind: 'pdf'; buffer: Buffer; fileName: string }
  | { kind: 'html'; html: string };

export async function gerarOficioGenerico(
  dadosDoOficio: DadosDoOficio,
  modeloOficioUrl: string | null,
  numeroOficio: string,
  nomeOrgao: string
): Promise<OficioGerado> {
  if (modeloOficioUrl) {
    const modelo = await carregarModeloOficio(modeloOficioUrl);
    if (modelo) {
      try {
        const docx = await montarOficioDocx(dadosDoOficio, modelo);
        const pdf = await converterDocxParaPdf(docx);
        const fileName = `Oficio ${numeroOficio.replace('/', '-')} - ${nomeOrgao}.pdf`;
        return { kind: 'pdf', buffer: pdf, fileName };
      } catch (erro) {
        console.error(`Falha ao gerar PDF do ofício para ${nomeOrgao}:`, erro);
      }
    }
  }

  return { kind: 'html', html: montarOficio(dadosDoOficio).html };
}
