# Robô de cadastro em portais

Preenche as solicitações de isenção nos portais das concessionárias que não
aceitam e-mail. Hoje cobre o Portal de Isentos da Motiva (ex-CCR), que atende
oito concessionárias com uma conta só.

## Por que é um processo separado

Playwright precisa de um navegador de verdade. Funções serverless da Vercel não
sustentam isso — daí o worker rodar em outro lugar. Ele conversa com o mesmo
banco Neon da aplicação, então não há fila nem serviço intermediário: consulta
as solicitações pendentes direto e escreve o resultado de volta.

## O que ele faz e o que não faz

**Faz:** login no portal, os quatro passos da solicitação, anexo do CRLV,
envio, e captura de tela de cada etapa.

**Não faz:** criar a conta no portal. O cadastro exige um código de seis
dígitos enviado por e-mail, e acontece uma vez por órgão — automatizar não
compensa. Crie manualmente em isentos.ccrpagamentos.com.br, opção
"Para sua empresa", com o CNPJ do órgão.

## Variáveis necessárias

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | mesmo banco da aplicação |
| `ENCRYPTION_KEY` | **a mesma** da aplicação, senão as credenciais não abrem |
| `BLOB_READ_WRITE_TOKEN` | baixar CRLV e guardar as capturas |

Opcionais: `RPA_INTERVALO_MS` (padrão 5 min), `RPA_MAX_TENTATIVAS` (3),
`RPA_LOTE` (10), `RPA_VISIVEL=true` para acompanhar o navegador durante testes.

## Rodando

```bash
pnpm install
node src/index.js --uma-vez   # uma rodada, para testar
node src/index.js             # contínuo
```

## Publicando no Railway

1. Novo projeto → Deploy from GitHub → este repositório
2. Root Directory: `apps/rpa-worker`
3. Start Command: `node src/index.js`
4. Adicionar as três variáveis acima

O `postinstall` baixa o Chromium com as dependências de sistema.

## Quando algo falha

Cada tentativa registra o erro e as capturas em
`ConcesssionaireRegistration.rpaUltimoErro` e `rpaCapturas`. Esgotadas as
tentativas, `rpaAguardando` é preenchido e o robô para de tentar aquela
solicitação — repetir contra um portal que mudou só consome tempo e arrisca a
conta do órgão.

As capturas são a única forma de auditar o que o robô viu. Elas ficam no Blob
privado, acessíveis pela aplicação.

## Fragilidade esperada

Os seletores usam texto visível em vez de classes CSS, porque classes de build
mudam a cada deploy do portal. Ainda assim, uma reforma na interface quebra o
robô — é da natureza deste tipo de automação. Quando isso acontecer, as
capturas mostram exatamente onde parou.
