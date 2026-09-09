/**
 * Gera uma Declaração de Instalação de TAG de exemplo, pra inspeção visual
 * antes de confiar no gerador em produção. Usa a conversão real pra PDF
 * (relay/LibreOffice) -- precisa de EMAIL_RELAY_URL/EMAIL_RELAY_SECRET no
 * ambiente; sem eles, cai no fallback e salva o .docx mesmo assim.
 *
 *   pnpm --filter @isenta/web testar-declaracao-tag
 */
import { writeFile } from 'fs/promises';
import { gerarDeclaracaoTag } from '../lib/declaracao-tag';
import { dadosDeExemploParaModelo } from '../lib/dados-exemplo';

async function main() {
  const resultado = await gerarDeclaracaoTag(
    dadosDeExemploParaModelo.orgao,
    dadosDeExemploParaModelo.veiculos.map(v => ({
      plate: v.plate,
      renavam: v.renavam,
      marca: v.marca,
      modelo: v.modelo,
      tag: v.tag ?? '00000000000',
    })),
    dadosDeExemploParaModelo.protocolo
  );

  await writeFile(`declaracao-tag-teste.${resultado.fileName.split('.').pop()}`, resultado.buffer);
  console.log(`ok  gerado: declaracao-tag-teste.${resultado.fileName.split('.').pop()} (${resultado.buffer.length} bytes, ${resultado.mimeType})`);
}

main().catch(erro => {
  console.error('FALHOU', erro);
  process.exit(1);
});
