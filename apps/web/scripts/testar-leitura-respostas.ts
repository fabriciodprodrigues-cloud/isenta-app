/**
 * Testa extrairProtocolo/classificarResposta contra textos de exemplo,
 * sem depender de IMAP nem banco.
 *
 *   pnpm --filter @isenta/web testar-leitura-respostas
 */
import { extrairProtocolo, classificarResposta } from '../lib/leitura-respostas';

let falhas = 0;

function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(
    `  ${ok ? 'ok  ' : 'FALHOU'} ${nome}` +
      (ok ? '' : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`)
  );
}

console.log('extrairProtocolo:');
conferir(
  'protocolo no meio do texto',
  extrairProtocolo('Segue resposta.\n\nOfício nº 007/2026 · Protocolo ISN-2026-1JYVJ1\nAtt.'),
  'ISN-2026-1JYVJ1'
);
conferir('sem protocolo', extrairProtocolo('Recebemos sua solicitação, obrigado.'), null);
conferir(
  'protocolo minúsculo é normalizado',
  extrairProtocolo('protocolo isn-2026-abc123 confirmado'),
  'ISN-2026-ABC123'
);

console.log('\nclassificarResposta:');
conferir('aprovação simples', classificarResposta('Prezados, a solicitação foi aprovada.'), 'aprovado');
conferir('deferimento', classificarResposta('Ofício deferido conforme análise técnica.'), 'aprovado');
conferir('recusa simples', classificarResposta('A solicitação foi recusada por falta de documento.'), 'recusado');
conferir('indeferimento', classificarResposta('Pedido indeferido.'), 'recusado');
conferir(
  // "não aprovado" não é o mesmo que "recusado" (pode estar só pendente) —
  // ficar em indefinido é mais seguro que arriscar um "recusado" errado.
  'negação anula aprovação sem virar recusa',
  classificarResposta('Infelizmente o pedido não foi aprovado desta vez.'),
  'indefinido'
);
conferir(
  'negação inverte recusa',
  classificarResposta('O pedido não foi recusado, só está em análise ainda.'),
  'indefinido'
);
conferir('sem sinal nenhum', classificarResposta('Recebemos o e-mail, obrigado pelo contato.'), 'indefinido');
conferir(
  'aprovado com ressalva ainda conta como aprovado (limitação aceita)',
  classificarResposta('Aprovado, mas envie o contrato de locação atualizado.'),
  'aprovado'
);

console.log(`\n${falhas === 0 ? 'ok' : 'FALHOU'} — ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
