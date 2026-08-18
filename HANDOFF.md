# Isenta — documento de retomada

Para abrir uma conversa nova com o Claude e continuar de onde parou.
Gerado em 18/08/2026.

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
- **Em produção com dados reais desde 05/08/2026.** Não existem mais contas de
  demonstração — qualquer teste destrutivo atinge dado de órgão real.

---

## 2. Stack

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
| Robô | Playwright, processo separado |
| Hospedagem | Vercel (site) + Railway (robô) |

---

## 3. Onde cada coisa roda

```
GitHub  fabriciodprodrigues-cloud/isenta-app   (branch: main)
   |
   +--> Vercel   projeto "isenta-app-web", org "infinity20"
   |             plataformaisenta.com
   |             deploy automático a cada push na main
   |
   +--> Railway  projeto "positive-blessing", serviço "@isenta/rpa-worker"
                 build por Dockerfile, worker sem porta exposta

        Neon     PostgreSQL — o mesmo banco para os dois
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
`prisma/schema.prisma`, que fica na raiz do repositório. Com o root apontando
para a pasta do worker, o arquivo fica fora do contexto de build e o
`prisma generate` falha.

---

## 4. Variáveis de ambiente

### Site (Vercel)

| Variável | Para quê | Onde está o valor |
|---|---|---|
| `DATABASE_URL` | Postgres do Neon | `.env` local, ou console do Neon |
| `NEXTAUTH_SECRET` | assinatura do JWT | Vercel (marcada Sensitive) |
| `NEXTAUTH_URL` | `https://plataformaisenta.com` | — |
| `ENCRYPTION_KEY` | cofre AES-256-GCM | Vercel — **tem que ser igual à do Railway** |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | painel do store, Quickstart, aba `.env.local` |
| `EMAIL_FROM` | remetente da plataforma | domínio **raiz** `@plataformaisenta.com` |
| `EMAIL_REPLY_TO` | resposta | — |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `SMTP_SECURE` | Resend | Vercel |
| `CRON_SECRET` | protege `/api/cron/alertas` | Vercel |
| `WEBHOOK_SECRET` | protege o webhook de resposta | Vercel |

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

Variáveis marcadas **Sensitive** na Vercel são gravação-apenas: nem você
consegue lê-las de volta. Para recuperar um valor perdido, vá à origem (Neon,
painel do Blob) ou gere um novo e atualize os dois lados.

---

## 5. Rodando local

```bash
pnpm install
```

```bash
pnpm --filter @isenta/web dev
```

Sobe em http://localhost:3000. O `.env` da raiz precisa de `DATABASE_URL`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL` e `ENCRYPTION_KEY`. **`NODE_ENV` não pode
estar no `.env`** — quebra o `next build`.

Robô, uma rodada só, com navegador visível:

```bash
cd apps/rpa-worker && RPA_VISIVEL=true node src/index.js --uma-vez
```

Scripts utilitários em `scripts/`: `criar-admin.js`, `limpar-dados-demo.js`,
`mapear-canais.js`, `backup-dados.js`. Todos usam `carregar-env.js`, porque o
`@prisma/client` não lê `.env` sozinho — isso é comportamento da CLI do Prisma,
não do client.

---

## 6. Backup dos dados

```bash
node scripts/backup-dados.js
```

Gera `backup-isenta-AAAA-MM-DD.json` na raiz com todas as tabelas, na ordem de
dependência (quem é referenciado antes de quem referencia), para que uma
restauração possa seguir a mesma sequência.

**O backup não é auto-suficiente.** As credenciais de caixa e de portal saem
cifradas; sem a `ENCRYPTION_KEY` vigente na época, são bytes inúteis. Guardar a
chave junto anularia o motivo de cifrar — guarde-a separada.

O arquivo gerado contém dados reais de órgão público. Ele está no `.gitignore`;
não versione.

---

## 7. Mapa do código

```
apps/web/
  app/api/...                  38 rotas
  app/dashboard/...            telas de admin e operador
  lib/
    cofre.ts                   AES-256-GCM; guarda credencial de caixa
    caixa-entrada.ts           teste de leitura IMAP
    identidade-envio.ts        decide se o órgão PODE enviar
    oficio-isencao.ts          monta o ofício
    email-service.ts           envia pelo SMTP do órgão
    registration-orchestrator  agrupa frota e dispara
    portais.ts                 catálogo de portais
    document-access.ts         autorização de acesso a arquivo
    utils.ts                   datas em America/Sao_Paulo

apps/rpa-worker/               robô (Railway)
  src/index.js                 laço: consulta banco, sem fila nem Redis
  src/motiva.js                fluxo de 4 passos do portal
  src/caixa.js                 lê código/link no e-mail
  src/cofre.js                 espelho só-leitura do cofre

apps/worker/                   MORTO — scaffold BullMQ/Redis, substituído
prisma/schema.prisma           12 models
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

## 8. Armadilhas conhecidas

Cada uma custou tempo real. Estão aqui para não custarem de novo.

**Zod descarta campo em silêncio.** `.parse()` remove chave não declarada no
schema e a rota devolve 200 com dado pela metade. Foram três bugs assim. Use
`.strict()` — a rota de credencial já usa.

**Tradução do Chrome corrompe configuração.** Nos painéis Vercel/Railway ela
traduz nomes de variáveis *dentro dos blocos de código*: copiar o snippet
`.env.local` com a tradução ligada gravou `ID_DO_ARMAZENAMENTO_BLOB` no lugar de
`BLOB_STORE_ID`. Também renomeia botões — "Quickstart" vira "Início rápido",
"Raw Editor" vira "Editor Bruto". Desligue antes de copiar qualquer coisa.

**Aspas no `.env`.** Os valores estão entre aspas no arquivo. Copiar a partir do
`=` traz a aspa junto, e o Prisma recusa com "the URL must start with the
protocol postgresql://".

**Lockfile dessincronizado derruba a Vercel.** Mexer em qualquer `package.json`
sem rodar `pnpm install` quebra o build do site, porque a Vercel instala com
`--frozen-lockfile`. Isso já deixou a produção sete horas no ar com versão velha
sem ninguém perceber.

**Quebra do `next build`:** `NODE_ENV` no `.env`; conexão de banco no escopo de
módulo; rota com `auth()` sem `export const dynamic = 'force-dynamic'`.

**Estado duplicado.** Já houve `Tag.vehicleId` contra `Vehicle.tagSerialNumber`
e `Document` contra `crlvUrl`, com o caminho de leitura usando o campo que
ninguém escrevia. Ao ver dois lugares guardando o mesmo fato, desconfie.

**PowerShell e mensagem de commit.** Here-string com aspas quebra. Escreva a
mensagem num arquivo e use `git commit -F`.

**Limite de 4,5 MB na Vercel.** Upload passa direto do navegador para o Blob
(`handleUpload`), o que exige `BLOB_READ_WRITE_TOKEN` explícito — a Vercel
passou a usar OIDC por padrão e isso quebra o fluxo.

---

## 9. Estado atual

### Funciona

- Cadastro de órgão, veículo, TAG, documento (CRLV no Blob privado)
- Cálculo de vencimento em `America/Sao_Paulo`
- Criação de operador e recuperação de senha
- Onboarding de identidade do órgão, 7 passos
- Ofício por e-mail: um por concessionária, cobrindo a frota toda, com CRLV
  anexado — 12 meses para frota própria, 4 para locada
- Numeração de ofício por órgão, reservada de forma atômica
- Robô publicado no Railway, online, varrendo a cada 5 minutos

### Não funciona / não existe

- **O robô nunca rodou contra o portal real.** O código segue os passos das
  telas que o usuário percorreu à mão, mas automação de portal só se prova
  rodando.
- **`caixa.js` não está ligado ao fluxo da Motiva.** Falta saber o domínio
  remetente e o formato da mensagem do portal — só se descobre com um cadastro
  real. Inventar remetente e expressão regular daria código com cara de pronto
  que falha calado.
- Delegação OAuth (`DELEGACAO`) não implementada — `gmail.send` exigiria
  verificação de app no Google.
- Termos de Uso do portal da Motiva nunca lidos; o usuário optou por seguir.
- Telas de admin Relatórios, Cobrança e Configurações são esqueleto.

### Próximos passos

1. Criar a conta do órgão em `isentos.ccrpagamentos.com.br` — manual, opção
   "Para sua empresa", CNPJ do órgão. O código de seis dígitos chega por e-mail.
2. Guardar essa conta no passo 7 do onboarding.
3. Cadastrar um veículo numa concessionária do grupo Motiva (AutoBAn, MINAS SP,
   Pantanal, PRVias, RioSP, Sorocabana, ViaCosteira, ViaSul — as oito são
   cobertas por uma conta só).
4. Acompanhar a primeira execução do robô pelas capturas de tela que ele grava.
5. Obter as credenciais SMTP da Câmara Municipal de Chapadão do Sul com o TI
   deles, mais uma caixa **dedicada à isenção** para o IMAP.

---

## 10. Segurança — pendências abertas

Levantadas várias vezes e ainda não resolvidas:

- **Revogar os dois tokens do GitHub** em https://github.com/settings/tokens
  (`isenta-deploy` e `isenta-deploy-v2`). Ambos foram colados em texto puro em
  conversa.
- **Rotacionar a senha do Neon.** Apareceu em texto puro mais de uma vez.

Sobre a caixa do órgão: credencial de SMTP permite **enviar**; credencial de
IMAP permite **ler tudo** o que estiver na conta. Numa câmara municipal isso
alcançaria ofícios, dados de servidores e processos administrativos. O projeto
assume uma caixa criada só para isenção — não a institucional principal.

---

## 11. Convenções

- **Idioma:** responder sempre em português. Código e comentários em português.
- **Concessionárias:** nunca cadastrar se `canalIsentos` for nulo ou
  `ativoParaCadastro` for falso.
- **Datas:** dias corridos comparando calendário em `America/Sao_Paulo` contra
  data armazenada em UTC. Ver `utils.ts`.
- **Mensagem de commit:** título curto no imperativo, corpo explicando **por
  quê**, não o quê.

---

## 12. Como começar a conversa nova

Cole isto:

> Estou retomando o projeto Isenta, em `C:\Aplicativos\Isenta`.
> Leia `HANDOFF.md` na raiz do repositório antes de qualquer coisa — ele tem a
> arquitetura, o estado atual e as armadilhas já conhecidas.
> Responda sempre em português.

O Claude não tem acesso a segredo nenhum por padrão. Quando um valor for
necessário, ele vai pedir — e você decide se cola no chat ou aplica você mesmo
no painel. Preferir a segunda opção evita que a credencial fique registrada na
conversa.
