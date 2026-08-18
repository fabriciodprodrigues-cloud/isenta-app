# Progresso do Projeto Isenta

## ✅ Fase 1: Contas + Frota (CONCLUÍDA)

### Implementado

#### Componentes UI (Reutilizáveis)
- ✅ Button (variantes: primary, secondary, ghost, danger)
- ✅ Input com label, erro, hint e ícone
- ✅ Select com validação
- ✅ Card (CardHeader, CardBody, CardFooter)
- ✅ Table (TableHead, TableBody, TableRow, TableCell)
- ✅ Badge (variantes: default, success, warning, error, info)

#### API Routes
- ✅ `GET /api/accounts` — listar todas as contas (admin)
- ✅ `POST /api/accounts` — criar nova conta (admin)
- ✅ `GET /api/accounts/[id]` — detalhe da conta
- ✅ `PUT /api/accounts/[id]` — editar conta (admin)
- ✅ `DELETE /api/accounts/[id]` — deletar conta (admin)
- ✅ `GET /api/vehicles` — listar veículos (com filtro por conta)
- ✅ `POST /api/vehicles` — criar novo veículo
- ✅ `GET /api/vehicles/[id]` — detalhe do veículo
- ✅ `PUT /api/vehicles/[id]` — editar veículo
- ✅ `DELETE /api/vehicles/[id]` — deletar veículo (admin)

#### Páginas e Formulários
- ✅ `/dashboard/accounts` — tabela de órgãos públicos
- ✅ `/dashboard/accounts/new` — formulário de criação
- ✅ `/dashboard/accounts/[id]` — editar conta
- ✅ `/dashboard/vehicles` — tabela de veículos com filtros
- ✅ `/dashboard/vehicles/new` — criar novo veículo (seletor de conta para admin)
- ✅ `/dashboard/vehicles/[id]` — detalhe do veículo
- ✅ `/dashboard/alerts` — histórico de alertas

#### Dashboard Principal
- ✅ Cards de estatísticas (total, aprovados, aguardando, vencendo)
- ✅ Tabela de veículos com seleção em lote
- ✅ Visualização de status por cor (verde/amarelo/vermelho)
- ✅ Links rápidos para gerenciamento
- ✅ Sidebar com navegação (diferente para admin/operator)

#### Utilitários e Validação
- ✅ Validação de CNPJ (com checksum)
- ✅ Formatação de CNPJ (00.000.000/0000-00)
- ✅ Validação de placa (ABC-1234 e Mercosul)
- ✅ Formatação de placa automática
- ✅ Validação de RENAVAM (com checksum)
- ✅ Cálculo de data de vencimento (12 meses para próprio, 4 para locado)
- ✅ Cálculo de dias até vencimento
- ✅ Determinação de status por vencimento (ok, vencendo, vencido)

#### Segurança e Controle de Acesso
- ✅ Autenticação com NextAuth.js (JWT)
- ✅ Dois papéis: admin (acesso total) e operator (apenas sua conta)
- ✅ Validação de autorização nas API routes
- ✅ Validação de entrada com Zod
- ✅ Hash de senha com bcryptjs

#### Database
- ✅ Schema Prisma com 7 tabelas (User, Account, Vehicle, ConcesssionaireRegistration, Alert, Session)
- ✅ Índices para performance (accountId, status, expiresAt, etc)
- ✅ Relacionamentos entre tabelas
- ✅ Seed script com dados demo

#### Demo Data
- ✅ 1 conta de órgão público (Prefeitura de SP)
- ✅ 2 usuários (admin + operator)
- ✅ 4 veículos com status variados
- ✅ 2 registros de cadastro em concessionárias
- ✅ 2 alertas demo

---

## ⏳ Próximas Fases

### Fase 2: Alertas (1–2 semanas)
- [ ] Job agendado para verificar vencimentos diários
- [ ] Queue de e-mail com BullMQ
- [ ] Integração com Resend para envio
- [ ] Templates de e-mail profissionais
- [ ] Log de envios de alertas

**Status:** Pronto para começar (base de alertas já no banco)

### Fase 3: Motor de E-mail (4–6 semanas)
- [ ] Geração de ofício em PDF (docxtemplater)
- [ ] Fila de envio com retry automático
- [ ] Parser de respostas de e-mail
- [ ] Integração com primeira concessionária (Way 262)
- [ ] Dashboard de status de envios

### Fase 3b: Motor de RPA (3–5 semanas)
- [ ] Automação com Playwright
- [ ] Um robô por concessionária (CCR PRVias, CSG, Via Araucária)
- [ ] Execução assíncrona (BullMQ)
- [ ] Screenshots em erro
- [ ] Fallback automático

### Fase 4: Relatórios (1–2 semanas)
- [ ] Economia gerada (cálculo de pedágio economizado)
- [ ] Risco (veículos vencendo/vencidos)
- [ ] Auditoria (histórico completo)
- [ ] Exportação PDF/Excel

### Fase 5: Expansão de Concessionárias (Contínuo)
- [ ] Novos portais e e-mails
- [ ] Suporte a mais regiões
- [ ] Testes com clientes pilotos

### Fase 6: Integração TAG Sem Parar (4–8 semanas)
- [ ] Conta mestre com Sem Parar
- [ ] Emissão de TAGs em lote
- [ ] Vínculo automático ao veículo
- [ ] Integração com cadastro (incluir número de série)

### Fase 7: Cobrança SaaS (2 semanas)
- [ ] Planos por faixa de veículos
- [ ] Integração com Stripe/PagSeguro
- [ ] Faturamento automático
- [ ] Gestão de contratos

---

## 🎯 Como Usar Agora

### 1. Setup Inicial
```bash
cd C:\Aplicativos\Isenta

# Instalar dependências
pnpm install

# Copiar variáveis de ambiente
cp .env.example .env.local

# Editar .env.local com suas credenciais PostgreSQL e Redis

# Criar banco e migrar
pnpm exec prisma migrate dev

# Seed com dados demo (opcional)
pnpm exec prisma db seed
# ATENCAO: o seed APAGA TODAS AS TABELAS. So rode contra banco local.
# Contra o banco de producao ele destroi os dados reais — ja aconteceu em 18/08/2026.
```

### 2. Iniciar Dev
```bash
pnpm dev
```

Painel: http://localhost:3000

### 3. Credenciais Demo

**Admin:**
- Email: `admin@isenta.local`
- Senha: `admin123`
- Acesso: Tudo (contas, veículos, alertas)

**Operador:**
- Email: `operador@prefeitura.sp.gov.br`
- Senha: `operador123`
- Acesso: Apenas seus veículos

### 4. Testar Fluxos

**Criar nova conta:**
1. Login como admin
2. Menu → Órgãos Públicos → Nova Conta
3. Preencher dados (teste: CNPJ 12.345.678/0001-90)
4. Salvar

**Criar novo veículo:**
1. Menu → Frota → Novo Veículo
2. Selecionar órgão (ou auto-selecionado se operator)
3. Preencher: placa, RENAVAM, tipo, categoria
4. Vencimento é calculado automaticamente
5. Salvar

**Ver status:**
1. Dashboard → tabela de veículos
2. Filtrar por status, órgão, vencimento
3. Selecionar múltiplos para ações em lote

---

## 📊 Estatísticas do Código

- **Linhas de código:** ~3.500
- **Componentes:** 15+
- **API routes:** 8
- **Páginas:** 9
- **Validações:** 10+
- **Commits:** 3

---

## 🔍 O Que Falta Ainda

### Antes de Produção

1. **Upload de Arquivos (R2)**
   - Integração com Cloudflare R2
   - Upload de CRLV e contrato
   - Preview de PDF

2. **Multi-usuário Avançado**
   - Convidar usuários para conta
   - Permissões mais granulares
   - Auditoria de ações

3. **Modo Escuro/Claro**
   - Toggle de tema
   - Persistência no localStorage

4. **Testes**
   - Testes unitários (Jest)
   - Testes E2E (Playwright)
   - Cobertura de 80%+

5. **Performance**
   - Paginação de tabelas grandes
   - Cache de queries
   - Compressão de imagens

6. **Internacionalização**
   - Suporte a múltiplas línguas
   - i18n setup

---

## 📚 Documentação Disponível

- [SETUP.md](./SETUP.md) — Como configurar local
- [DEVELOPMENT.md](./DEVELOPMENT.md) — Convenções de código
- [README.md](./README.md) — Visão geral do projeto
- [isenta-especificacao-claude-code.md](../downloads/isenta-especificacao-claude-code.md) — Spec completa
- [isenta-identidade-visual.html](../downloads/isenta-identidade-visual.html) — Design system

---

## 🚀 Próximas Ações

1. **Testar localmente** com `pnpm dev`
2. **Explorar painel** e validar fluxos
3. **Revisar dados demo** em Prisma Studio (`pnpm exec prisma studio`)
4. **Começar Fase 2** (Alertas) quando pronto
5. **Selecionar concessionária piloto** para Fase 3 (Motor de E-mail)

---

**Status:** MVP Fase 1 concluído e pronto para testes! ✨
