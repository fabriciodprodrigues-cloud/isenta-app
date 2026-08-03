# 🚀 Quick Start - Deploy Isenta em 5 Minutos

## Opção 1: Deploy Local (Desenvolvimento)

```bash
# 1. Clone o repositório
git clone <seu-repositorio> isenta
cd isenta

# 2. Execute o script de deploy
chmod +x deploy.sh
./deploy.sh

# Pronto! Acesse http://localhost:3000
```

**Credenciais de teste:**
- 👨‍💼 Admin: `admin@isenta.local` / `admin123`
- 👤 Operador: `operador@prefeitura.sp.gov.br` / `operador123`

---

## Opção 2: Deploy na Vercel (Recomendado - 2 minutos)

1. **Acesse** https://vercel.com
2. **Clique** em "New Project"
3. **Selecione** seu repositório GitHub
4. **Configure variáveis de ambiente:**
   ```
   DATABASE_URL=postgresql://seu-database-url
   REDIS_URL=redis://seu-redis-url
   NEXTAUTH_SECRET=gere-com-openssl-rand-base64-32
   NEXTAUTH_URL=https://seu-dominio.vercel.app
   SMTP_HOST=smtp.seu-provider.com
   SMTP_PORT=587
   SMTP_USER=seu-email@dominio.com
   SMTP_PASSWORD=sua-senha
   ```
5. **Clique** em "Deploy"

Pronto! Vercel vai fazer deploy automático a cada push.

---

## Opção 3: Deploy em VPS/Servidor Próprio

```bash
# 1. No seu servidor
git clone <seu-repositorio> isenta
cd isenta

# 2. Configure .env
cp .env.example .env
# Edite e configure

# 3. Inicie com Docker Compose
docker-compose up -d

# Pronto! Aplicação em http://seu-ip:3000
```

---

## Verificar Status do Deployment

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f web

# Testar API
curl http://localhost:3000/api/health

# Acessar Prisma Studio (banco de dados)
docker-compose exec web pnpm exec prisma studio
```

---

## Comandos Úteis

| Comando | Ação |
|---------|------|
| `docker-compose up -d` | Iniciar containers |
| `docker-compose down` | Parar containers |
| `docker-compose restart` | Reiniciar containers |
| `docker-compose logs -f web` | Ver logs em tempo real |
| `docker-compose exec web pnpm exec prisma studio` | Abrir Prisma Studio |
| `docker-compose exec web pnpm exec prisma db seed` | Popular banco de dados |
| `docker-compose exec postgres pg_dump -U isenta isenta_db > backup.sql` | Fazer backup |

---

## Troubleshooting Rápido

### ❌ "port 3000 already in use"
```bash
# Mate o processo na porta 3000
lsof -i :3000
kill -9 <PID>

# Ou use outra porta
docker-compose up -d -p 8000:3000
```

### ❌ "DATABASE_URL not set"
```bash
# Certifique-se que .env existe e tem DATABASE_URL configurado
cat .env | grep DATABASE_URL

# Ou configure manualmente
export DATABASE_URL="postgresql://user:pass@localhost:5432/isenta_db"
```

### ❌ "Connection refused"
```bash
# Aguarde 10 segundos para containers iniciarem
sleep 10
docker-compose ps  # Verificar status

# Se ainda não funcionar, reinicie
docker-compose down
docker-compose up -d
```

---

## Próximos Passos

1. ✅ Acesse http://localhost:3000
2. ✅ Faça login com admin / admin123
3. ✅ Crie um novo órgão público
4. ✅ Crie um novo operador
5. ✅ Cadastre veículos
6. ✅ Configure TAGs
7. ✅ Configure alertas

---

## Suporte

- 📖 [Documentação Completa](DEPLOYMENT.md)
- ✅ [Checklist](DEPLOYMENT_CHECKLIST.md)
- 🐛 [Issues](https://github.com/seu-usuario/isenta/issues)
- 💬 [Slack](https://seu-workspace.slack.com)

---

**Precisa de ajuda?** Acesse https://seu-dominio.com/docs
