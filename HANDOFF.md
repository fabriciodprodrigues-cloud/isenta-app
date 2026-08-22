# Isenta — documento de retomada

Para abrir uma conversa nova com o Claude e continuar de onde parou.
Atualizado em 21/08/2026, commit `06b404e`.

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

### O segundo incidente: build quebrado por 8 horas sem ninguém notar

Em **21/08/2026**, o commit `0097213` ("Adicionar opções de editar, congelar
e excluir órgãos") introduziu um erro de sintaxe real — estado duplicado no
mesmo escopo, um bloco JSX inteiro colado duas vezes fora do `return()`, uma
`<div>` nunca fechada. **Todo deploy a partir daquele commit falhou** —
`pnpm run build` retornava erro de compilação — e a produção continuou
servindo a última build boa, sem nenhuma das mudanças das 8 horas seguintes.
Ninguém percebeu, porque nada aqui monitora deploy falho.

**Verifique isto sempre que retomar o projeto:** abra
`vercel.com/infinity20/isenta-app-web/deployments` e confira se o deployment
mais recente está `Ready` (verde) — não só se o `git push` foi aceito. Um
push aceito não significa que o site mudou.

O commit quebrado também importava `Dialog`, `DropdownMenu` e `Label` de
`@/components/ui/`, que **nunca foram criados** — só compilava por acidente
antes da duplicação virar erro fatal (TypeScript não confere imports
inexistentes até o arquivo ser processado no build). Antes de importar um
componente de UI, confira que o arquivo existe em `apps/web/components/ui/`.

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
| Relay de e-mail (SMTP/IMAP) | Node/Express num VPS com IP fixo (ver seção 4) |
| Hospedagem | Vercel (site) + Railway (robô) + VPS Hostinger (relay de e-mail) |

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
   |             build por Dockerfile, worker sem porta exposta
   |
   +--> VPS      Hostinger, srv1920691.hstgr.cloud, IP 187.127.62.116
                 apps/email-service — deploy manual, não automático (ver abaixo)

        Neon     projeto "isenta", branch "production" — o mesmo banco
                 para os três
```

**Atenção ao usuário do GitHub:** é `fabriciodprodrigues-cloud`, com **"dp"**.
Errar isso devolve "Repository not found", que parece problema de token e não é.

### VPS de e-mail (`apps/email-service`)

**Por quê existe:** a caixa da Câmara é hospedada na UOL Host, que exige
autorizar o IP de origem para aceitar SMTP/IMAP. A Vercel não oferece IP de
saída fixo em funções normais — então SMTP/IMAP não podem falar direto com a
UOL a partir do site. O VPS existe só para isso: um IP fixo autorizável,
rodando um relay HTTP em frente ao SMTP/IMAP real.

**Desenho:** sem estado. O relay não guarda nenhuma credencial de órgão — a
aplicação web já decifra a credencial da conta via `lib/cofre.ts` (um blob só,
cobrindo SMTP e IMAP); ela chega pronta a cada chamada HTTP, é usada uma vez e
descartada. Isso evita duplicar a `ENCRYPTION_KEY` numa terceira máquina.

```
Vercel (decifra a credencial da conta)
   |  HTTPS + header x-internal-secret
   v
nginx (srv1920691.hstgr.cloud, TLS via Let's Encrypt)  — porta 443, pública
   |  proxy_pass
   v
Node/Express (127.0.0.1:3000 — só loopback, nunca exposto direto)
   |
   +--> POST /send-email             -> nodemailer -> SMTP do órgão
   +--> POST /convert-docx-to-pdf    -> soffice (LibreOffice headless)
   +--> POST /check-emails           -> imapflow   -> IMAP do órgão
   +--> GET  /health
```

| Peça | Onde | Observação |
|---|---|---|
| Domínio | `srv1920691.hstgr.cloud` | hostname público que a Hostinger já atribui a cada VPS — resolve de verdade via DNS público, não precisou comprar domínio |
| Certificado | Let's Encrypt, expira 19/11/2026 | renovação automática já configurada pelo certbot (`certbot.timer`) |
| Processo | PM2, nome `isenta-email` | `pm2 save` + `systemctl enable pm2-root` — sobrevive a reboot |
| Autenticação | header `x-internal-secret`, comparado a `INTERNAL_SECRET` no `.env` do VPS | sem IP fixo do lado da Vercel para checar a origem, este segredo é a única defesa |
| Firewall | UFW: só 22 (SSH), 80, 443 | 80 só existe para redirecionar a 443 e para o desafio do certbot |

**Deploy é manual, não automático.** Não há CI/CD para este serviço. Para
atualizar depois de um push:

```bash
# no terminal do VPS (painel Hostinger → VPS → gerenciar → botão "terminal")
cd ~
curl -fsSL -o src/index.ts https://raw.githubusercontent.com/fabriciodprodrigues-cloud/isenta-app/main/apps/email-service/src/index.ts
curl -fsSL -o package.json https://raw.githubusercontent.com/fabriciodprodrigues-cloud/isenta-app/main/apps/email-service/package.json
npm install && npm run build
pm2 restart isenta-email
```

O código-fonte vive em `apps/email-service/` no repositório (fonte de
verdade); o `.gitignore` da raiz já cobre `node_modules/` e `dist/`, então só
`src/`, `package.json` e `tsconfig.json` são versionados. O `.env` do VPS
**não** é versionado — vive só no servidor.

**LibreOffice headless (`/convert-docx-to-pdf`).** Órgão com modelo de ofício
próprio (`Account.modeloOficioUrl`) tem o ofício gerado como PDF — corpo
programático enxertado no `.docx` do órgão (ver `lib/oficio-docx.ts`),
convertido para PDF por este endpoint e anexado ao e-mail. **Requer
`libreoffice-writer` instalado no VPS** — não fazia parte da imagem original
(ver "Servidor 'novo' pode não ser novo" abaixo) e **ainda não foi
confirmado/instalado neste servidor**. Provisionar com:

```bash
apt-get update && apt-get install -y libreoffice-writer
```

Depois de instalar, testar direto (sem depender do relay) com um `.docx`
qualquer:

```bash
soffice --headless --norestore -env:UserInstallation=file:///tmp/lo-teste --convert-to pdf --outdir /tmp algum-arquivo.docx
```

Se faltar algum filtro de conversão, o metapacote completo (`apt-get install
-y libreoffice`) resolve, ao custo de instalar Calc/Impress/Base junto.
Sem LibreOffice instalado, o endpoint responde 502 — o envio não quebra: o
orquestrador cai de volta para o ofício em HTML de sempre quando a conversão
falha (`registration-orchestrator.ts`, bloco `try/catch` em volta de
`montarOficioDocx`/`converterDocxParaPdf`).

**Testar do próprio VPS**, sem nunca expor a senha na tela (usa os nomes das
variáveis do `.env`, não os valores):

```bash
set -a; source .env; set +a
node -e "const s=process.env; fetch('https://srv1920691.hstgr.cloud/check-emails',{method:'POST',headers:{'Content-Type':'application/json','x-internal-secret':s.INTERNAL_SECRET},body:JSON.stringify({host:s.IMAP_HOST,port:Number(s.IMAP_PORT),user:s.IMAP_USER,password:s.IMAP_PASSWORD,limite:5})}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

**Ligado.** Desde o commit `1e73d3b` (21/08), `enviarOficioDeIsencao()` em
`lib/email-service.ts` chama `POST {EMAIL_RELAY_URL}/send-email` em vez de
abrir SMTP direto — o `INTERNAL_SECRET` do VPS está configurado na Vercel
como `EMAIL_RELAY_SECRET` (mesmo valor, nome diferente dos dois lados de
propósito — evita colar a variável errada por engano). O relay ganhou suporte
a anexo (base64) e `replyTo` no mesmo commit; sem isso o ofício sairia sem o
CRLV, que é o próprio motivo do e-mail. `check-emails` (para quando `caixa.js`
for ligado ao fluxo da Motiva) ainda não é chamado pela aplicação web — só o
envio está integrado, a leitura da caixa continua um passo futuro (bloco D da
seção 11).

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
| `EMAIL_RELAY_URL` | endpoint do relay de e-mail (VPS) | `https://srv1920691.hstgr.cloud` — Vercel, configurada em 21/08 |
| `EMAIL_RELAY_SECRET` | autentica a Vercel perante o relay | **tem que ser igual à `INTERNAL_SECRET` do `.env` do VPS** — Vercel (Sensitive) |

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

### Relay de e-mail (VPS)

| Variável | Para quê |
|---|---|
| `PORT` | porta interna do Express (3000) — só loopback, o nginx é quem fica público |
| `INTERNAL_SECRET` | autentica as chamadas da Vercel; gerado com `openssl rand -hex 32` direto no servidor. Mesmo valor está na Vercel como `EMAIL_RELAY_SECRET` (seção 5) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` | só para os testes manuais acima — a rota em si recebe essas credenciais no corpo de cada chamada, não lê do ambiente |
| `IMAP_HOST` `IMAP_PORT` `IMAP_USER` `IMAP_PASSWORD` | idem, só para teste manual |

**Se o `INTERNAL_SECRET` precisar ser rotacionado** (vazamento, rotina de
segurança): gerar um novo no VPS (`openssl rand -hex 32`), sobrescrever a
linha no `.env`, reiniciar (`pm2 restart isenta-email`), e atualizar
`EMAIL_RELAY_SECRET` na Vercel com o mesmo valor — os dois lados têm que
bater exatamente, senão todo envio de ofício por e-mail passa a falhar com
401 do relay.

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

apps/email-service/                relay SMTP/IMAP (VPS, deploy manual — seção 4)
  src/index.ts                     Express, duas rotas + /health, sem estado

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

**A tradução do Chrome também mexe no terminal web do VPS**, não só nos
painéis. Traduz até rótulo digitado na hora (`echo "dependencies-en:..."`
virou `"dependências-en:..."` na tela) — é só exibição, o arquivo real no
disco fica intacto, mas não dá para confiar no que a tela mostra para nada que
exija precisão (nome de campo, chave JSON). Confirme por comando (`grep -c`,
`md5sum`), não por leitura visual.

**`client.fetch()` do ImapFlow devolve um gerador assíncrono, não um array.**
Atribuir direto a uma variável e devolver por JSON serializa vazio — é preciso
`for await (const msg of client.fetch(...))`. Um rascunho anterior do
`email-service` tinha esse bug (corrigido no commit `f07f2a3`).

**`certbot --nginx` pode falhar por bloco conflitante, mesmo com o domínio
resolvendo certo.** No VPS de e-mail, havia dois blocos `server` escutando 80
— o desafio HTTP-01 caiu no bloco errado e voltou 404. `certbot certonly
--standalone` (parando o nginx por um instante) contornou; a configuração TLS
foi então escrita à mão (`apps/email-service/deploy/nginx.conf`).

**Servidor "novo" pode não ser novo.** O VPS de e-mail veio de uma sessão
anterior com Node, PM2, Docker e nginx já instalados, e até um `email-service`
parcial já rodando — sem estar versionado no Git e com bugs reais (sem
`express.json()`, sem autenticação, `package.json` apontando para um arquivo
que não existia). Antes de seguir um roteiro de "instalar do zero", vale
conferir o que já está lá.

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
- **Relay de e-mail no ar e ligado à aplicação web** (VPS Hostinger,
  `srv1920691.hstgr.cloud`), testado de ponta a ponta em 21/08: SMTP enviou
  de verdade pela UOL, IMAP leu a caixa real da Câmara, e o envio de ofício
  já passa por ele em produção. Ver seção 4.
- **Editar, congelar/ativar e excluir órgão**, na listagem de admin — corrigido
  em 21/08 depois de ficar quebrado por 8 horas (ver seção 2). Reaproveita a
  rota `PUT /api/accounts/[id]` que já aceita `status`.

### O que a leitura da caixa já revelou

Ao testar o IMAP contra a caixa real (`isenta@camarachapadaodosul.ms.gov.br`),
apareceram e-mails reais do portal da Motiva — ofícios já foram enviados antes
e o portal está respondendo:

- Remetente: `no-reply-isentos@motiva.com.br`
- Assunto: `[Portal de Isentos] Nova atualização! Processo #0000042681`
  (um número de processo por e-mail)

Isso ainda não fecha o item D abaixo (falta ler o **corpo** da mensagem para
achar o link de confirmação), mas já elimina a maior incógnita: o remetente e
o padrão de assunto para filtrar.

### Não funciona / não existe

- **O robô nunca rodou contra o portal real.** O código segue os passos das
  telas que o usuário percorreu à mão, mas automação de portal só se prova
  rodando.
- **A leitura de CRLV nunca rodou contra um CRLV real.** As expressões
  regulares foram escritas a partir do layout esperado do CRLV-e, não de um
  documento de verdade. Se o layout diferir, placa e RENAVAM ficam vazios e o
  sistema cai para a leitura por imagem — não entrega dado torto, mas passa a
  custar ~US$ 0,04 por leitura.
- **`caixa.js` não está ligado ao fluxo da Motiva.** Já se sabe o remetente e
  o formato do assunto (acima); falta o corpo da mensagem (onde deve estar o
  link de confirmação) e a integração de fato.
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

### Há um `git stash` pendente

Ao corrigir o build quebrado (seção 2), uma reescrita antiga e não commitada
de `orgaos/page.tsx` foi guardada em vez de descartada — ela reescrevia a
página sem depender de `Dialog`/`DropdownMenu`/`Label` (que nunca existiram),
mas removia a ação de congelar/ativar por completo. A correção final preservou
essa funcionalidade por outro caminho (seção 2), então esse stash não deveria
mais ser necessário. Confirme e descarte:

```bash
git stash list
git stash drop   # depois de confirmar que não há nada ali que você queira
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

4. ~~Obter as credenciais SMTP da Câmara~~ — **feito.** A caixa
   `isenta@camarachapadaodosul.ms.gov.br` existe (UOL Host, SMTP
   `smtp.suite.uol` porta 587 STARTTLS, IMAP `imap.suite.uol` porta 993
   SSL/TLS) e foi testada de verdade em 21/08 via o relay do VPS (seção 4).
5. ~~Ligar a aplicação web ao relay~~ — **feito** (commit `1e73d3b`,
   21/08). `enviarOficioDeIsencao()` chama o relay em vez de nodemailer
   direto.
6. **Cadastrar a caixa no onboarding do órgão**, passo de e-mail. A tela testa
   a conexão antes de guardar — mas hoje esse teste (`caixa-entrada.ts`)
   ainda conecta direto na UOL, não passa pelo relay, então pode falhar por
   IP mesmo com o relay funcionando. Vale conferir isso antes de usar em
   produção: se travar aqui, o teste de conexão do onboarding é o próximo
   ponto a ligar ao relay, não o envio em si. Este é o próximo passo real
   deste bloco.
7. Subir o **timbre** e preencher cidade de emissão, cargo do responsável e
   método de assinatura — sem isso o envio fica bloqueado por desenho.
8. Enviar o primeiro ofício real para uma concessionária de canal por e-mail e
   acompanhar a resposta.

Concluído este bloco, a plataforma entrega valor sem depender do robô.

### C. Robô de portal

9. Criar a conta do órgão em `isentos.ccrpagamentos.com.br` — manual, opção
   "Para sua empresa", CNPJ do órgão. O código de seis dígitos chega por e-mail.
10. Guardar essa conta no passo 7 do onboarding (Portais).
11. Cadastrar um veículo numa concessionária do grupo Motiva (AutoBAn, MINAS
    SP, Pantanal, PRVias, RioSP, Sorocabana, ViaCosteira, ViaSul — as oito são
    cobertas por uma conta só).
12. Acompanhar a primeira execução pelas capturas de tela que o robô grava.
    Esperar que algo quebre: é a primeira vez contra o portal real.

### D. Leitura da caixa (IMAP)

13. Com a caixa já criada (item 4), preencher também os campos de IMAP no
    onboarding do órgão — o relay do VPS já está pronto para essas chamadas.
14. ~~Descobrir o domínio remetente do portal~~ — **parcialmente feito.** É
    `no-reply-isentos@motiva.com.br`, assunto
    `[Portal de Isentos] Nova atualização! Processo #NNNNNNNNNN` (visto em
    21/08, lendo a caixa real via o relay). Falta olhar o **corpo** da
    mensagem — hoje `check-emails` só traz remetente/assunto/data (envelope),
    não o corpo. Com o formato do corpo em mãos, ligar
    `apps/rpa-worker/src/caixa.js` ao fluxo da Motiva — o módulo existe e foi
    testado, mas não é chamado.
15. Fechar o critério 6 da especificação: ler o link de confirmação que a
    concessionária envia após o ofício.

### E. Para operar de verdade

16. Telas de **Relatórios** e **Configurações** (hoje esqueleto).
17. Rotina de backup automática — hoje `backup-dados.js` é manual, e foi
    justamente a ausência disso que tornou o apagamento irreversível.
18. Alertas de vencimento por e-mail rodando pelo cron (`/api/cron/alertas`
    existe; confirmar se o agendamento está ativo na Vercel).
19. **Cobrança** — se a plataforma for cobrar dos órgãos, nada disso existe.

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

**No VPS de e-mail:** `npm audit` reportou 1 vulnerabilidade de gravidade alta
em `apps/email-service` em 21/08 — não investigada ainda, não rodei
`audit fix --force` (troca versão major sem revisar, risco desnecessário sem
necessidade imediata). Rever antes de considerar o relay definitivamente
fechado. Acesso root ao VPS é só por senha/painel da Hostinger (não há chave
SSH própria configurada) — se isso mudar, documentar aqui.

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
