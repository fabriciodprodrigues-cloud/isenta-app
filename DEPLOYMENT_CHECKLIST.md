# ✅ Checklist de Deployment - Plataforma Isenta

## Antes de fazer Deploy para Produção

### 🔐 Segurança
- [ ] `.env` não está commitado no git
- [ ] `NEXTAUTH_SECRET` é uma string aleatória forte (mínimo 32 caracteres)
- [ ] HTTPS está habilitado em produção
- [ ] Credenciais SMTP foram alteradas para valores de produção
- [ ] Database URL aponta para banco de produção
- [ ] Redis URL aponta para servidor de produção

### 📦 Código
- [ ] Todas as branches foram mergeadas
- [ ] Não há console.log() no código de produção
- [ ] Não há TODO ou FIXME não resolvidos
- [ ] Typescript não tem erros (`pnpm type-check`)
- [ ] Linting passou (`pnpm lint`)

### 🗄️ Banco de Dados
- [ ] Backup do banco de dados foi feito
- [ ] Todas as migrations foram testadas localmente
- [ ] Schema do banco está atualizado
- [ ] Índices de banco de dados estão criados
- [ ] Replicação/backups automáticos estão configurados

### 🚀 Deployment
- [ ] Dockerfile build passou sem erros
- [ ] Docker image foi testado localmente
- [ ] docker-compose.yml foi revisado
- [ ] Variáveis de ambiente foram configuradas corretamente
- [ ] Health check está funcionando
- [ ] Logs estão sendo coletados

### 📊 Monitoramento
- [ ] Alertas foram configurados (uptime, errors, performance)
- [ ] Dashboard de monitoramento está pronto
- [ ] Logs centralizados estão configurados
- [ ] Backup automático está agendado

### 📝 Documentação
- [ ] README.md foi atualizado
- [ ] DEPLOYMENT.md foi revisado
- [ ] API documentation está atualizada
- [ ] Troubleshooting guide foi escrito

### 🧪 Testes
- [ ] Testes unitários passaram
- [ ] Testes de integração passaram
- [ ] Testes de API foram executados
- [ ] Login (admin e operador) foi testado
- [ ] Fluxo principal (cadastro de veículo, TAG, concessionária) foi testado

### 📱 Frontend
- [ ] Responsive design foi testado em mobile
- [ ] Dark mode está funcionando
- [ ] Todos os forms validam corretamente
- [ ] Mensagens de erro são claras
- [ ] Loading states estão implementados

### 🔄 Performance
- [ ] Bundle size foi verificado
- [ ] Next.js build foi otimizado
- [ ] Database queries estão otimizadas
- [ ] Cache está configurado
- [ ] CDN está configurado para static assets

### 🚨 Rollback Plan
- [ ] Plano de rollback foi documentado
- [ ] Previous version pode ser deployado em menos de 5 minutos
- [ ] Backup do database pode ser restaurado
- [ ] DNS pode ser revertido se necessário

---

## Durante o Deployment

### Pré-deployment
- [ ] Notificar team sobre manutenção (se necessário)
- [ ] Criar maintenance page (se necessário)
- [ ] Fazer backup final do database
- [ ] Revisar logs de staging

### Deployment
- [ ] Executar deploy em staging primeiro
- [ ] Testar staging por 15 minutos
- [ ] Executar health checks
- [ ] Monitorar logs em tempo real

### Pós-deployment
- [ ] Verificar health checks
- [ ] Testar fluxo crítico
- [ ] Monitorar erro rates nos próximos 30 minutos
- [ ] Verificar performance
- [ ] Fazer announcement na Slack/email

---

## Depois do Deployment

### Validação
- [ ] Aplicação está respondendo corretamente
- [ ] Database está acessível
- [ ] Redis está funcionando
- [ ] Emails estão sendo enviados
- [ ] Logs estão sendo coletados
- [ ] Backups estão sendo criados

### Monitoramento (24 horas)
- [ ] Taxa de erro permanece baixa
- [ ] Performance está dentro dos limites
- [ ] Usuários não relataram problemas
- [ ] Banco de dados está estável
- [ ] Não há memory leaks

### Comunicação
- [ ] Release notes foram publicados
- [ ] Documentação foi atualizada
- [ ] Team foi notificado
- [ ] Changelog foi atualizado

---

## Problemas Comuns & Soluções

### Problema: Migrations falhando
**Solução:**
```bash
# Verificar status das migrations
prisma migrate status

# Resolver conflitos
prisma migrate resolve

# Reset (últimora
prisma migrate reset --force
```

### Problema: Database connection timeout
**Solução:**
- Verificar connection string
- Aumentar connection pool size
- Verificar firewall/security groups

### Problema: Memory leak
**Solução:**
- Verificar logs para patterns
- Usar memory profiler
- Considerar restart automático

### Problema: High CPU usage
**Solução:**
- Verificar queries lentas
- Otimizar database indexes
- Escalar verticalmente

---

## Post-Deployment Automation

Configure automaticamente após deployment:

```bash
# 1. Health checks
curl https://seu-dominio.com/api/health

# 2. Smoke tests
pnpm test:smoke

# 3. Backup automático
0 2 * * * pg_dump -U $DB_USER $DB_NAME | gzip > backup-$(date +\%Y\%m\%d).sql.gz

# 4. Log rotation
/etc/logrotate.d/isenta
```

---

## Contato em Caso de Problema

- **On-call**: +55 (11) XXXXX-XXXX
- **Slack**: #isenta-deployment
- **Email**: ops@isenta.local
- **Jira**: ISENTA project

---

**Versão**: 1.0
**Data**: 03/08/2026
**Responsável**: DevOps Team
