# Isenta

Plataforma SaaS para gerenciar isenções de pedágio de frotas públicas.

## 📋 Sobre

O **Isenta** centraliza o cadastro, renovação e documentação necessária para que veículos oficiais e frotas públicas mantenham sua isenção de pedágio ativa em todas as concessionárias por onde circulam.

- ✅ **Sem planilhas** — tudo em um painel único
- ✅ **Sem prazos esquecidos** — alertas automáticos em 60/30/7 dias
- ✅ **Sem multas** — renovação automática antes do vencimento
- ✅ **TAG incluída** — Sem Parar já vem no pacote

## 🏗️ Arquitetura

Monorepo com pnpm workspaces:

```
isenta/
├── apps/
│   ├── web/       → Next.js (painel web)
│   └── worker/    → Node.js + BullMQ (jobs assíncrono)
├── packages/
│   └── shared/    → Tipos, constantes, utilitários
└── prisma/        → Schema do banco de dados
```

## 🚀 Começando

### Pré-requisitos

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Redis 7+ (para filas de jobs)

### Setup Local

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local

# 3. Configurar banco de dados
# Edite DATABASE_URL em .env.local com suas credenciais PostgreSQL
pnpm exec prisma migrate dev

# 4. Seed do banco com usuário demo (opcional)
pnpm exec prisma db seed
# ATENCAO: o seed APAGA TODAS AS TABELAS. So rode contra banco local.
# Contra o banco de producao ele destroi os dados reais — ja aconteceu em 18/08/2026.

# 5. Iniciar dev server
pnpm dev
```

Painel estará em `http://localhost:3000`

**Demo credentials** (após seed):
- Email: `admin@isenta.local`
- Senha: `admin123`

## 📦 Stack Técnica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React + Next.js 14 (App Router) |
| **Backend** | Next.js API Routes + TypeScript |
| **Banco de Dados** | PostgreSQL + Prisma |
| **Fila de Jobs** | Redis + BullMQ |
| **Autenticação** | NextAuth.js (JWT) |
| **E-mail** | Resend |
| **Upload** | Cloudflare R2 (S3-compatible) |
| **Estilo** | Tailwind CSS |
| **Deploy** | Vercel (web) + Railway/Fly.io (worker) |

## 🎨 Identidade Visual

Paleta de cores e tipografia conforme especificação:

- **Cores:** Ink (fundo escuro), Paper (texto claro), Slate (neutro), Green (aprovado), Amber (atenção)
- **Fontes:** Space Grotesk (títulos), IBM Plex Sans (corpo), IBM Plex Mono (dados)
- **Logo:** Cancela de pedágio animada

Veja [`isenta-identidade-visual.html`](../downloads/isenta-identidade-visual.html) para o especime completo.

## 📍 Roadmap

| Fase | Escopo | Status |
|------|--------|--------|
| **1** | Contas + Frota | 🔄 Em progresso |
| **2** | Alertas | ⏳ Próximo |
| **3** | Motor de E-mail + RPA | 📅 Planejado |
| **3b** | Motor de RPA avançado | 📅 Planejado |
| **4** | Relatórios | 📅 Planejado |
| **5** | Expansão de concessionárias | 📅 Contínuo |
| **6** | Integração TAG Sem Parar | 📅 Planejado |
| **7** | Cobrança SaaS | 📅 Planejado |

## 🛠️ Scripts

```bash
# Desenvolvimento
pnpm dev              # Iniciar todos os apps em modo dev

# Build e produção
pnpm build            # Build para produção
pnpm start            # Iniciar em produção
pnpm type-check       # Verificar tipos TypeScript

# Banco de dados
pnpm exec prisma migrate dev
pnpm exec prisma db seed
# ATENCAO: o seed APAGA TODAS AS TABELAS. So rode contra banco local.
# Contra o banco de producao ele destroi os dados reais — ja aconteceu em 18/08/2026.
pnpm exec prisma studio

# Lint
pnpm lint
```

## 📁 Estrutura de Pacotes

### `apps/web`

Painel web com autenticação, CRUD de contas/frota, alertas e relatórios.

- `app/` — Next.js App Router pages e layouts
- `components/` — React components reutilizáveis
- `lib/` — Utilitários: auth, prisma, helpers
- `public/` — Assets estáticos

### `apps/worker`

Worker de background jobs para:
- Envio de e-mails transacionais
- Automação com RPA (Playwright)
- Verificação de vencimentos e alertas

### `packages/shared`

Tipos, constantes e utilitários compartilhados entre todos os apps.

- `types/` — Definições de tipos TypeScript
- `constants/` — Configurações globais (cores, ciclos, etc)

## 🗄️ Banco de Dados

Tabelas principais:

- `User` — Usuários (admin, operador)
- `Account` — Órgãos públicos (contas SaaS)
- `Vehicle` — Veículos (placa, RENAVAM, status)
- `ConcesssionaireRegistration` — Status de cadastro por concessionária
- `Alert` — Alertas de vencimento
- `Session` — Sessões JWT

Veja `prisma/schema.prisma` para o schema completo.

## 🔐 Segurança

- Senhas com bcrypt
- Autenticação JWT (NextAuth.js)
- Variáveis de ambiente para secrets
- Validação com Zod
- HTTPS obrigatório em produção

## 📝 Documentação

- [`isenta-especificacao-claude-code.md`](../downloads/isenta-especificacao-claude-code.md) — Especificação completa
- [`isenta-identidade-visual.html`](../downloads/isenta-identidade-visual.html) — Guia de design

## 🤝 Contribuindo

Checklist antes de commitar:

- [ ] `pnpm type-check` passando
- [ ] `pnpm lint` passando
- [ ] Commit message descritivo
- [ ] Mudanças no Prisma schema: incluir migration

## 📞 Contato

Desenvolvido para Isenta. Perguntas? Abra uma issue.

---

**Status:** MVP em desenvolvimento (Fases 1–2)  
**Última atualização:** agosto/2026
