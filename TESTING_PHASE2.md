# Guia de Teste - Fase 2: Alertas

## 🎯 Como Acessar

### 1. Painel está rodando em:
```
http://localhost:3000
```

### 2. Credenciais Demo
**Admin** (acesso total):
- Email: `admin@isenta.local`
- Senha: `admin123`

**Operador** (apenas sua frota):
- Email: `operador@prefeitura.sp.gov.br`
- Senha: `operador123`

---

## 📋 Fluxos de Teste da Fase 2

### A. Visualizar Alertas (Todos os usuários)

1. **Login** como admin ou operador
2. **Menu** → Dashboard → **Alertas**
3. Ver tabela com:
   - ✓ Cards de estatísticas (3 tipos de alertas)
   - ✓ Histórico completo
   - ✓ Filtros por tipo
   - ✓ Datas de envio

**Esperado:** 2 alertas demo já criados no seed

---

### B. Configurar e Enviar Alertas (Admin apenas)

1. **Login** como admin
2. **Menu** → Alertas → **Configuração** (novo link)
3. Você verá:
   - ℹ️ Informações sobre funcionamento
   - 📊 Status dos alertas automáticos
   - 🔘 Botão "Enviar Alertas Agora"

4. **Clique em "Enviar Alertas Agora"**
   - O sistema verifica todos os veículos
   - Se algum vencer em 60, 30 ou 7 dias → cria alerta
   - Mostra resultado com veículos processados

**Esperado:** Vê lista de alertas "Enviados" com placas e e-mails

---

### C. Entender o Fluxo de Alertas

**Quando um veículo é criado:**
```
1. Status: "rascunho"
2. Vencimento: calculado automaticamente (12 ou 4 meses)
3. Nenhum alerta por enquanto
```

**Quando é aprovado na concessionária:**
```
1. Status: "aprovado" ✓
2. Sistema começa a monitorar vencimento
3. 60 dias antes → alerta "Vencendo em Breve"
4. 30 dias antes → segundo alerta
5. 7 dias antes → alerta final "Urgente"
```

**Dados demo (seed):**
- Veículo AMB1001: vence em ~2 meses → gera alerta
- Veículo SAO1000: vence em ~8 meses → sem alerta ainda
- Veículo CBM1002: status "aguardando" → não monitora

---

## 📧 Templates de E-mail (Vistos no código)

Quando um alerta é enviado, o e-mail tem:

```
📧 Assunto: ⚠️ Alerta: Isenção de [PLACA] vence [DATA]

Body:
- Logo e cabeçalho da marca
- Nome do responsável
- Informações do veículo (placa, órgão)
- Data de vencimento
- Botão "Renovar Agora"
- Link direto para o painel (veículo específico)
- Rodapé com aviso de e-mail automático
```

**Cores no e-mail:**
- Verde: sucesso/confirmação
- Amarelo/Âmbar: atenção (vencimento próximo)
- Vermelho: urgência (vencido)

---

## 🔄 Fluxo Completo em Ação

### Cenário de Teste Real

1. **Criar novo veículo** (já feito com seed)
   - Placa: AMB1001
   - Tipo: Próprio
   - Categoria: Ambulância
   - Vencimento: ~2 meses (automático)

2. **Ir para Alertas → Configuração** (admin)
   - Ver informações sobre a automação
   - Clicar "Enviar Alertas Agora"

3. **Sistema processa:**
   - Encontra AMB1001 com status "aprovado"
   - Calcula: ~2 meses = alerta em 30 dias
   - Cria registro de alerta
   - Simula envio de e-mail

4. **Ver resultado:**
   - Card mostra "1 alerta enviado"
   - Tabela mostra: AMB1001 | Ambulância | Email | ✓ Enviado

5. **Voltar em Alertas**
   - Ver novo alerta no histórico
   - Status: "Aguardando Resposta" (amarelo)

---

## 🧪 Testes Específicos da Fase 2

### ✅ Teste 1: Alertas aparecem na listagem
- [ ] Ir para /dashboard/alerts
- [ ] Ver tabela com pelo menos 2 alertas (do seed)
- [ ] Filtrar por tipo: "Vencendo em Breve" → mostra alertas

### ✅ Teste 2: Envio manual funciona
- [ ] Admin acessa /dashboard/alerts-config
- [ ] Clica "Enviar Alertas Agora"
- [ ] Vê resultado com "X alertas enviados"
- [ ] Volta em /dashboard/alerts → novo alerta aparece

### ✅ Teste 3: Apenas admin vê configuração
- [ ] Operador não vê link "Configuração" no menu
- [ ] Admin vê e pode acessar

### ✅ Teste 4: E-mail template é válido
- [ ] Código está em `apps/web/lib/email-templates.ts`
- [ ] HTML está bem-formado (check no navegador)
- [ ] Fallback text/plain existe

### ✅ Teste 5: Integração com Veículos
- [ ] Veículos com status "rascunho" → não geram alerta
- [ ] Veículos com status "aprovado" → monitora vencimento
- [ ] Link de renovação no e-mail leva ao painel do veículo

---

## 🐛 Troubleshooting

### Nenhum alerta aparece
```
1. Verificar se há veículos com status "aprovado"
   → Dashboard/Frota → procurar status verde
2. Verificar datas de vencimento
   → Veículo/[id] → data está correta?
3. Limpar seed e recriar
   → pnpm exec prisma reset
   → pnpm exec prisma db seed
```

### E-mail não aparece na simulação
```
1. Verificar console do servidor (pnpm dev)
   → deve mostrar "📧 Enviado para..."
2. Verificar API response em /api/alerts/send
   → call manual: curl -X POST http://localhost:3000/api/alerts/send
```

### Alerta duplicado
```
O sistema evita alertas duplicados no mesmo dia.
Se vencimento é em 30 dias:
- 1º envio: alerta criado
- 2º envio (mesmo dia): não duplica
- Próximo dia: pode enviar novamente
```

---

## 📊 Próximas Etapas (Fase 2 Completa)

- [ ] **Resend Integration** — substituir simulação por envio real
- [ ] **BullMQ Queue** — fila de jobs assíncrono
- [ ] **Cron Job** — executar diariamente (00:00 UTC)
- [ ] **Webhook** — receber confirmação de entrega
- [ ] **Dashboard Metrics** — gráficos de taxa de entrega

---

## 📱 URLs Úteis

| URL | Descrição |
|-----|-----------|
| `/dashboard` | Painel principal |
| `/dashboard/vehicles` | Frota com status |
| `/dashboard/alerts` | Histórico de alertas |
| `/dashboard/alerts-config` | Configuração (admin) |
| `/api/health` | Health check do banco |
| `/api/alerts` | Listar alertas (JSON) |
| `/api/alerts/send` | Enviar alertas (POST) |

---

## 💡 Dicas de Teste

1. **Testar com seed real:**
   ```bash
   pnpm exec prisma reset
   pnpm exec prisma db seed
   # ATENCAO: o seed APAGA TODAS AS TABELAS. So rode contra banco local.
   # Contra o banco de producao ele destroi os dados reais — ja aconteceu em 18/08/2026.
   ```

2. **Ver console do servidor:**
   ```bash
   pnpm dev
   # Procurar por: "📧 Enviado para..."
   ```

3. **Verificar banco via Prisma Studio:**
   ```bash
   pnpm exec prisma studio
   # Ver tabelas: Alert, Vehicle, Account
   ```

4. **Testar API direto:**
   ```bash
   curl http://localhost:3000/api/alerts
   curl -X POST http://localhost:3000/api/alerts/send
   ```

---

**Status:** Fase 2 PRONTA PARA TESTE! 🚀
