# Isenta — documento de retomada

Para abrir uma conversa nova com o Claude e continuar de onde parou.
Atualizado em 18/08/2026, commit `7f1eed9`.

> **Não há nenhuma senha, token ou chave neste arquivo — de propósito.**
> Um documento de handoff circula: vai para o chat, para o disco, às vezes para
> outra pessoa. Segredo dentro dele vaza junto. Cada item abaixo diz **onde** o
> valor mora e como recuperá-lo.

---

## 1. O que é o projeto

Plataforma para órgãos públicos gerenciarem isenção de pedágio das suas frotas.
O órgão cadastra veículos; o sistema monta o pedido de isenção e o envia às
concessionárias — por e-mail quando elas aceitam, ou por robô quando exigem
cadastro em portal.

A regra que atravessa o sistema inteiro: **toda solicitação sai na identidade do
órgão, nunca na da Isenta.** O e-mail parte da caixa institucional do próprio
órgão, pelo SMTP dele. Isso não é estética — é o que faz a mensagem passar pelo
SPF/DKIM do domínio do órgão sem exigir mudança de DNS em cada cliente, e é o
que dá validade ao ofício.

- **Produção:** https://plataformaisenta.com
- **Admin:** fabriciodprodrigues@gmail.com
- **Repositório:** github.com/fabriciodprodrigues-cloud/isenta-app (branch `main`)

---

## 2. Leia isto antes de rodar qualquer comando

Em **18/08/2026, por volta de 01:30 UTC**, o banco de produção foi apagado e
repovoado com dados de demonstração. A causa: `prisma/seed.ts` começa com
`deleteMany()` em todas as tabelas, e oito trechos dos guias do repositório
mandavam rodar `prisma db seed` — guias escritos quando o `.env` apontava para
desenvolvimento. Depois que a produção subiu, as mesmas instruções viraram um
procedimento de destruição.

**Os dados não voltaram.** O plano Free do Neon reteve histórico só até 02:57
do mesmo dia, já depois do apagamento. Perderam-se a conta da Câmara, o usuário
admin, veículos e TAGs reais. Sobreviveram os arquivos no Vercel Blob
(armazenamento separado) e as 74 concessionárias, que vêm do código.

Desde então:

- O seed **recusa** rodar contra host que não seja local (commit `024c65a`).
  A saída de emergência exige `PERMITIR_SEED_REMOTO="sim, apagar tudo"`.
- Existe `node scripts/backup-dados.js`.

**Rode o backup antes de qualquer comando que escreva no banco** — seed,
`migrate reset`, `db push`. E não conte com restauração pontual do Neon: no
plano Free a janela é de poucas horas.

---

## 3. Stack

| Camada | Tecnologia |
|---|---|
| Frontend/backend | Next.js 14 (App Router) |
| Monorepo | pnpm workspaces + Turbo |
| Banco | PostgreSQL no Neon |
| ORM | Prisma 5.22.0 |
| Autenticação | NextAuth.js (JWT) — papéis `admin`, `operator`, `viewer` |
| Arquivos | Vercel Blob, store **privado** `isenta-documentos` |
| E-mail da plataforma | Resend |
| E-mail dos ofícios | SMTP do próprio órgão |
| Leitura de CRLV | camada de texto do PDF (grátis) → Claude Opus 5 como reserva |
| Robô de portal | Playwright, processo separado |
| Hospedagem | Vercel (site) + Railway (robô) |

---

## 4. Onde cada coisa roda

```
GitHub  fabriciodprodrigues-cloud/isenta-app   (branch: main)
   |
   +--> Vercel   projeto "isenta-app-web", org "infinity20"
   |             plataformaisenta.com
   |             deploy automático a cada push na main
   |
   +--> Railway  projeto "positive-blessing", serviço "@isenta/rpa-worker"
                 build por Dockerfile, worker sem porta exposta

        Neon     projeto "isenta", branch "production" — o mesmo banco
                 para os dois
```

**Atenção ao usuário do GitHub:** é `fabriciodprodrigues-cloud`, com **"dp"**.
Errar isso devolve "Repository not found", que parece problema de token e não é.

### Configuração do Railway (já aplicada)

| Campo | Valor |
|---|---|
| Root Directory | **vazio** |
| Builder | Dockerfile |
| Dockerfile Path | `apps/rpa-worker/Dockerfile` |
| Start Command | `node src/index.js` |
| Watch Paths | `/apps/rpa-worker/**` e `/prisma/**` |

O Root Directory **precisa** ficar vazio: o Dockerfile copia
`prisma/schema.prisma`, que está na raiz do repositório. Com o root apontando
para a pasta do worker, o arquivo fica fora do contexto de build e o
`prisma generate` falha.

---

## 5. Variáveis de ambiente

### Site (Vercel)

| Variável | Para quê | Onde está o valor |
|---|---|---|
| `DATABASE_URL` | Postgres do Neon | `.env` local, ou console do Neon |
| `NEXTAUTH_SECRET` | assinatura do JWT | Vercel (marcada Sensitive) |
| `NEXTAUTH_URL` | `https://plataformaisenta.com` | — |
| `ENCRYPTION_KEY` | cofre AES-256-GCM | Vercel — **tem que ser igual à do Railway** |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | painel do store → Quickstart → aba `.env.local` |
| `ANTHROPIC_API_KEY` | leitura de CRLV por imagem | console.anthropic.com → API Keys — **opcional** |
| `EMAIL_FROM` | remetente da plataforma | domínio **raiz** `@plataformaisenta.com` |
| `EMAIL_REPLY_TO` | resposta | — |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `SMTP_SECURE` | Resend | Vercel |
| `CRON_SECRET` | protege `/api/cron/alertas` | Vercel |
| `WEBHOOK_SECRET` | protege o webhook de resposta | Vercel |

`ANTHROPIC_API_KEY` é opcional de propósito: a leitura pela camada de texto do
PDF não usa modelo nenhum. Sem a chave, um CRLV digitalizado (foto) apenas não
preenche o formulário — nada quebra.

### Robô (Railway)

| Variável | Observação |
|---|---|
| `DATABASE_URL` | o mesmo banco |
| `ENCRYPTION_KEY` | **idêntica à da Vercel**, caractere por caractere |
| `BLOB_READ_WRITE_TOKEN` | baixar CRLV, guardar capturas de tela |

Opcionais: `RPA_INTERVALO_MS` (padrão 300000), `RPA_MAX_TENTATIVAS` (3),
`RPA_LOTE` (10), `RPA_VISIVEL=true` para ver o navegador em teste local.

> **A `ENCRYPTION_KEY` divergente é a falha mais cara possível aqui.** A
> aplicação cifra as senhas de caixa e de portal; o robô decifra. Se as duas
> diferirem, tudo salva sem erro e o robô falha na decifragem — e o sintoma
> aparece como problema do portal.

### O que a Vercel não devolve

Variáveis marcadas **Sensitive** são gravação-apenas: nem você consegue lê-las
de volta. Para recuperar um valor perdido, vá à origem (Neon, painel do Blob)
ou gere um novo e atualize os dois lados.

---

## 6. Rodando local

```bash
pnpm install
```

```bash
pnpm --filter @isenta/web dev
```

Sobe em http://localhost:3000. O `.env` da raiz precisa de `DATABASE_URL`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL` e `ENCRYPTION_KEY`. **`NODE_ENV` não pode
estar no `.env`** — quebra o `next build`.

**Use pnpm 9.15.9.** Rodar `pnpm install` com a v11 já deixou o cliente do
Prisma sem tipos gerados (dezenas de erros `implicitly has an 'any' type` e
`PrismaClientKnownRequestError does not exist`). O conserto é:

```bash
pnpm --filter @isenta/web exec prisma generate
```

Testar o parser de CRLV depois de mexer nele:

```bash
pnpm --filter @isenta/web testar-crlv
```

Robô, uma rodada só, com navegador visível:

```bash
cd apps/rpa-worker && RPA_VISIVEL=true node src/index.js --uma-vez
```

Scripts em `scripts/`: `criar-admin.js`, `limpar-dados-demo.js`,
`mapear-canais.js`, `backup-dados.js`. Todos usam `carregar-env.js`, porque o
`@prisma/client` não lê `.env` sozinho — isso é comportamento da CLI do Prisma,
não do client.

---

## 7. Backup

```bash
node scripts/backup-dados.js
```

Gera `backup-isenta-AAAA-MM-DD.json` na raiz com as doze tabelas, na ordem de
dependência (quem é referenciado antes de quem referencia), para que a
restauração possa repetir a sequência sem quebrar chave estrangeira.

**O backup não é auto-suficiente.** As credenciais de caixa e de portal saem
cifradas; sem a `ENCRYPTION_KEY` vigente na época, são bytes inúteis. Guarde a
chave separada. O JSON está no `.gitignore` — tem dado real de órgão público.

---

## 8. Mapa do código

```
apps/web/
  app/api/…                        40 rotas
  app/dashboard/…                  telas de admin e operador
  lib/
    cofre.ts                       AES-256-GCM; credencial de caixa e portal
    caixa-entrada.ts               teste de leitura IMAP
    leitura-crlv-texto.ts          extrai CRLV da camada de texto (grátis)
    leitura-crlv.ts                extrai CRLV por visão (Claude) — reserva
    identidade-envio.ts            decide se o órgão PODE enviar
    oficio-isencao.ts              monta o ofício
    email-service.ts               envia pelo SMTP do órgão
    registration-orchestrator.ts   agrupa a frota e dispara
    portais.ts                     catálogo de portais
    document-access.ts             autorização de acesso a arquivo
    utils.ts                       datas em America/Sao_Paulo
  components/LeitorCrlv.tsx        botão "Preencher pelo CRLV"
  scripts/testar-leitura-crlv.ts   testes do parser

apps/rpa-worker/                   robô (Railway)
  src/index.js                     laço: consulta o banco, sem fila nem Redis
  src/motiva.js                    fluxo de 4 passos do portal
  src/caixa.js                     lê código/link no e-mail (não ligado ainda)
  src/cofre.js                     espelho só-leitura do cofre
  Dockerfile                       imagem oficial do Playwright

apps/worker/                       MORTO — scaffold BullMQ/Redis, substituído
prisma/schema.prisma               12 models
```

`apps/worker` não é usado e **não deve ser publicado** — depende de um Redis
que não existe. Foi substituído pelo `rpa-worker`, que consulta o banco direto.

### Modelos

`User` `Account` `Vehicle` `Concessionaire` `Tag` `Document`
`ConcesssionaireRegistration` `Alert` `PortalCredencial` `TermoAutorizacao`
`PasswordResetToken` `Session`

`ConcesssionaireRegistration` tem três "s" no schema. É erro de digitação
original; renomear exigiria migração e toca muito código.

---

## 9. Armadilhas conhecidas

Cada uma custou tempo real.

**O seed apaga a produção.** Coberto na seção 2. Há trava no código desde
`024c65a`, mas os guias antigos do repositório ainda existem.

**Zod descarta campo em silêncio.** `.parse()` remove chave não declarada no
schema e a rota devolve 200 com dado pela metade. Foram três bugs assim. Use
`.strict()` — as rotas novas já usam.

**O store do Blob é privado.** Buscar `blob.url` com `fetch` falha; use
`get(pathname, { access: 'private' })`. Isso derrubou a leitura de CRLV inteira
até o commit `7f1eed9`.

**Tradução do Chrome corrompe configuração.** Nos painéis Vercel/Railway ela
traduz nomes de variáveis *dentro dos blocos de código*: copiar o snippet
`.env.local` com a tradução ligada gravou `ID_DO_ARMAZENAMENTO_BLOB` no lugar de
`BLOB_STORE_ID`. Também renomeia botões — "Quickstart" vira "Início rápido",
"Raw Editor" vira "Editor Bruto". Desligue antes de copiar qualquer coisa.

**Aspas no `.env`.** Os valores estão entre aspas. Copiar a partir do `=` traz
a aspa junto, e o Prisma recusa com "the URL must start with the protocol
postgresql://".

**Lockfile dessincronizado derruba a Vercel.** Mexer em `package.json` sem
rodar `pnpm install` quebra o build, porque a Vercel instala com
`--frozen-lockfile`. Isso já deixou a produção sete horas no ar com versão
velha sem ninguém perceber.

**pnpm v11 quebra os tipos do Prisma.** Ver seção 6.

**Quebra do `next build`:** `NODE_ENV` no `.env`; conexão de banco no escopo de
módulo; rota com `auth()` sem `export const dynamic = 'force-dynamic'`.

**Estado duplicado.** Já houve `Tag.vehicleId` contra `Vehicle.tagSerialNumber`
e `Document` contra `crlvUrl`, com o caminho de leitura usando o campo que
ninguém escrevia. Ao ver dois lugares guardando o mesmo fato, desconfie.

**PowerShell e mensagem de commit.** Here-string com aspas quebra — o commit
sai como pathspec inválido. Escreva a mensagem num arquivo e use
`git commit -F`.

**Limite de 4,5 MB na Vercel.** Upload passa direto do navegador para o Blob
(`handleUpload`), o que exige `BLOB_READ_WRITE_TOKEN` explícito — a Vercel
passou a usar OIDC por padrão e isso quebra o fluxo.

---

## 10. Estado atual

### Funciona

- Cadastro de órgão, veículo, TAG, documento (CRLV no Blob privado)
- **Preenchimento do cadastro lendo o CRLV** — extrai da camada de texto do PDF,
  custo zero; cai para leitura por imagem só em documento digitalizado
- Cálculo de vencimento em `America/Sao_Paulo`
- Criação de operador e recuperação de senha
- Onboarding de identidade do órgão, 7 passos
- Ofício por e-mail: um por concessionária, cobrindo a frota toda, com CRLV
  anexado — 12 meses para frota própria, 4 para locada
- Numeração de ofício por órgão, reservada de forma atômica
- Robô publicado no Railway, online, varrendo a cada 5 minutos
- Trava do seed contra banco remoto

### Não funciona / não existe

- **O robô nunca rodou contra o portal real.** O código segue os passos das
  telas que o usuário percorreu à mão, mas automação de portal só se prova
  rodando.
- **A leitura de CRLV nunca rodou contra um CRLV real.** As expressões
  regulares foram escritas a partir do layout esperado do CRLV-e, não de um
  documento de verdade. Se o layout diferir, placa e RENAVAM ficam vazios e o
  sistema cai para a leitura por imagem — não entrega dado torto, mas passa a
  custar ~US$ 0,04 por leitura.
- **`caixa.js` não está ligado ao fluxo da Motiva.** Falta saber o domínio
  remetente e o formato da mensagem do portal — só se descobre com um cadastro
  real.
- Delegação OAuth (`DELEGACAO`) não implementada — `gmail.send` exigiria
  verificação de app no Google.
- Termos de Uso do portal da Motiva nunca lidos.
- Telas de admin Relatórios, Cobrança e Configurações são esqueleto.

### O que está no banco agora

| | |
|---|---|
| Usuários | `fabriciodprodrigues@gmail.com` (admin), `agenciainfinitycontato1@gmail.com` (operador), **+ 2 de demonstração** |
| Órgãos | Câmara Chapadão do Sul, **+ Prefeitura de São Paulo (demonstração)** |
| Veículos | 8 (parte reais, parte do seed) |
| Concessionárias | 74 |
| Credenciais de portal | 0 |
| Contas com SMTP configurado | 0 |

Os registros de demonstração são resíduo do seed acidental. Limpe com:

```bash
node scripts/limpar-dados-demo.js
```

---

## 11. O que falta para finalizar a plataforma

Em ordem de dependência — cada bloco destrava o seguinte.

### A. Limpeza e verificação (agora)

1. Rodar `node scripts/backup-dados.js` e guardar o arquivo fora do projeto.
2. Rodar `node scripts/limpar-dados-demo.js` para tirar a Prefeitura de São
   Paulo e os dois usuários de demonstração.
3. Testar a leitura de CRLV com um documento real. Se placa e RENAVAM vierem
   preenchidos, a via gratuita está funcionando; se vierem vazios, ajustar os
   rótulos em `apps/web/lib/leitura-crlv-texto.ts`.

### B. Envio por e-mail — o caminho que já existe

4. Obter as credenciais **SMTP** da Câmara Municipal de Chapadão do Sul com o
   TI deles, mais uma **caixa dedicada à isenção** (não a institucional
   principal).
5. Cadastrar no onboarding do órgão, passo de e-mail. A tela testa a conexão
   antes de guardar.
6. Subir o **timbre** e preencher cidade de emissão, cargo do responsável e
   método de assinatura — sem isso o envio fica bloqueado por desenho.
7. Enviar o primeiro ofício real para uma concessionária de canal por e-mail e
   acompanhar a resposta.

Concluído este bloco, a plataforma entrega valor sem depender do robô.

### C. Robô de portal

8. Criar a conta do órgão em `isentos.ccrpagamentos.com.br` — manual, opção
   "Para sua empresa", CNPJ do órgão. O código de seis dígitos chega por e-mail.
9. Guardar essa conta no passo 7 do onboarding (Portais).
10. Cadastrar um veículo numa concessionária do grupo Motiva (AutoBAn, MINAS
    SP, Pantanal, PRVias, RioSP, Sorocabana, ViaCosteira, ViaSul — as oito são
    cobertas por uma conta só).
11. Acompanhar a primeira execução pelas capturas de tela que o robô grava.
    Esperar que algo quebre: é a primeira vez contra o portal real.

### D. Leitura da caixa (IMAP)

12. Com a caixa dedicada criada no passo 4, preencher também os campos de IMAP
    no mesmo passo do onboarding.
13. Descobrir, no e-mail do passo 8, **qual o domínio remetente do portal e como
    o código aparece na mensagem**. Com isso, ligar `apps/rpa-worker/src/caixa.js`
    ao fluxo da Motiva — hoje o módulo existe e está testado, mas não é chamado.
14. Fechar o critério 6 da especificação: ler o link de confirmação que a
    concessionária envia após o ofício.

### E. Para operar de verdade

15. Telas de **Relatórios** e **Configurações** (hoje esqueleto).
16. Rotina de backup automática — hoje `backup-dados.js` é manual, e foi
    justamente a ausência disso que tornou o apagamento irreversível.
17. Alertas de vencimento por e-mail rodando pelo cron (`/api/cron/alertas`
    existe; confirmar se o agendamento está ativo na Vercel).
18. **Cobrança** — se a plataforma for cobrar dos órgãos, nada disso existe.

---

## 12. Segurança — pendências abertas

Levantadas várias vezes e ainda não resolvidas:

- **Revogar os dois tokens do GitHub** em https://github.com/settings/tokens
  (`isenta-deploy` e `isenta-deploy-v2`). Ambos foram colados em texto puro em
  conversa.
- **Rotacionar a senha do Neon.** Apareceu em texto puro mais de uma vez, e
  circulou de novo entre painéis em 18/08.

Sobre a caixa do órgão: credencial de SMTP permite **enviar**; credencial de
IMAP permite **ler tudo** o que estiver na conta. Numa câmara municipal isso
alcançaria ofícios, dados de servidores e processos administrativos. O projeto
assume uma caixa criada só para isenção.

---

## 13. Convenções

- **Idioma:** responder sempre em português. Código e comentários em português.
- **Concessionárias:** nunca cadastrar se `canalIsentos` for nulo ou
  `ativoParaCadastro` for falso.
- **Datas:** dias corridos comparando calendário em `America/Sao_Paulo` contra
  data armazenada em UTC. Ver `utils.ts`.
- **Leitura de CRLV:** preenche o formulário, nunca cadastra sozinha. Uma placa
  errada vira ofício assinado pelo órgão para uma concessionária.
- **Mensagem de commit:** título curto no imperativo, corpo explicando **por
  quê**, não o quê.

---

## 14. Como começar a conversa nova

Cole isto:

> Estou retomando o projeto Isenta, em `C:\Aplicativos\Isenta`.
> Leia `HANDOFF.md` na raiz do repositório antes de qualquer coisa — ele tem a
> arquitetura, o estado atual, o que falta e as armadilhas já conhecidas.
> Preste atenção especial à seção 2: o banco de produção já foi apagado uma vez
> por um comando que a própria documentação mandava rodar.
> Responda sempre em português.

O Claude não tem acesso a segredo nenhum por padrão. Quando um valor for
necessário, ele vai pedir — e você decide se cola no chat ou aplica você mesmo
no painel. Preferir a segunda opção evita que a credencial fique registrada na
conversa.
