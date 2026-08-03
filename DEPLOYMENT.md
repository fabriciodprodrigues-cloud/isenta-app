# 🚀 Guia de Deployment - Plataforma Isenta

## Requisitos

- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Git**
- Mínimo 2GB RAM
- Mínimo 10GB espaço em disco

## Opções de Deployment

### 1️⃣ Deployment Local com Docker Compose (Desenvolvimento/Teste)

#### Pré-requisitos
- Docker e Docker Compose instalados

#### Passos

1. **Clone o repositório**
```bash
git clone <seu-repositorio> isenta
cd isenta
```

2. **Configure o arquivo .env**
```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure:
- `DATABASE_URL`: URL do banco de dados (PostgreSQL recomendado para produção)
- `REDIS_URL`: URL do Redis
- `NEXTAUTH_SECRET`: Gere um valor aleatório com: `openssl rand -base64 32`
- `NEXTAUTH_URL`: URL de acesso da aplicação
- Credenciais SMTP para envio de emails

3. **Inicie o deployment**
```bash
chmod +x deploy.sh
./deploy.sh
```

Ou manualmente:
```bash
docker-compose up -d
```

4. **Execute as migrations**
```bash
docker-compose exec web pnpm exec prisma migrate deploy
```

5. **Popule o banco de dados (opcional)**
```bash
docker-compose exec web pnpm exec prisma db seed
```

6. **Acesse a aplicação**
- URL: http://localhost:3000
- Admin: admin@isenta.local / admin123
- Operador: operador@prefeitura.sp.gov.br / operador123

---

### 2️⃣ Deployment em Produção (AWS, Azure, Google Cloud)

#### Opção A: Vercel (Recomendado para Next.js)

1. **Conecte seu repositório no Vercel**
   - Acesse https://vercel.com
   - Clique em "New Project"
   - Selecione o repositório

2. **Configure variáveis de ambiente**
   - Vá para Settings > Environment Variables
   - Adicione todas as variáveis do `.env.example`
   - **IMPORTANTE**: Use URLs de produção

3. **Configure o banco de dados**
   - Recomendado: Vercel Postgres ou Neon (PostgreSQL)
   - Configure `DATABASE_URL` apontando para o banco

4. **Deploy automático**
   - Cada push para `main` fará deploy automático
   - Ou clique em "Deploy" manualmente

#### Opção B: Railway

1. **Conecte seu repositório no Railway**
   - Acesse https://railway.app
   - Clique em "New Project"
   - Selecione "Deploy from GitHub"

2. **Adicione serviços**
   - PostgreSQL (banco de dados)
   - Redis (fila)
   - Web App (Next.js)

3. **Configure variáveis de ambiente**
   - Adicione todas as variáveis necessárias
   - Use URLs dos serviços internos do Railway

4. **Deploy**
   - Railway fará deploy automaticamente

#### Opção C: Docker (Self-hosted / VPS)

1. **Construa a imagem**
```bash
docker build -t isenta:latest .
```

2. **Faça push para Docker Registry**
```bash
docker tag isenta:latest seu-registry/isenta:latest
docker push seu-registry/isenta:latest
```

3. **Implemente em seu servidor**
```bash
# No servidor VPS/Docker host
docker-compose up -d
```

---

### 3️⃣ Deployment Manual (Sem Docker)

#### Pré-requisitos
- Node.js 18+
- pnpm
- PostgreSQL 14+
- Redis

#### Passos

1. **Clone e instale dependências**
```bash
git clone <seu-repositorio> isenta
cd isenta
pnpm install
```

2. **Configure banco de dados**
```bash
# Crie banco PostgreSQL
createdb isenta_db

# Configure DATABASE_URL em .env
DATABASE_URL="postgresql://user:password@localhost:5432/isenta_db"
```

3. **Execute migrations**
```bash
cd apps/web
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

4. **Build da aplicação**
```bash
cd ../..
pnpm build
```

5. **Inicie o serviço**
```bash
cd apps/web
pnpm start
```

A aplicação estará disponível em http://localhost:3000

---

## Configuração de Variáveis de Ambiente

### Produção
```env
# Database (usar PostgreSQL em produção)
DATABASE_URL="postgresql://user:pass@host:5432/isenta_db"

# NextAuth
NEXTAUTH_URL="https://seu-dominio.com.br"
NEXTAUTH_SECRET="gerar-com-openssl-rand-base64-32"

# Email (usar serviço SMTP real)
SMTP_HOST="smtp.seu-email-provider.com"
SMTP_PORT="587"
SMTP_USER="seu-email@dominio.com"
SMTP_PASSWORD="sua-senha-smtp"

# Redis
REDIS_URL="redis://seu-redis-host:6379"

# Node
NODE_ENV="production"
```

---

## Monitoramento

### Logs
```bash
# Ver logs em tempo real
docker-compose logs -f web

# Ver logs de um serviço específico
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Health Check
```bash
# Verificar status dos containers
docker-compose ps

# Verificar health da API
curl http://localhost:3000/api/health
```

### Backup do Banco de Dados
```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U isenta isenta_db > backup.sql

# Restore
docker-compose exec -T postgres psql -U isenta isenta_db < backup.sql
```

---

## Troubleshooting

### Erro: "DATABASE_URL not set"
- Verifique se o arquivo `.env` existe
- Certifique-se que `DATABASE_URL` está configurado
- Para Docker Compose, verifique o `docker-compose.yml`

### Erro: "Connection refused" no banco de dados
- Verifique se o container PostgreSQL está rodando: `docker-compose ps`
- Aguarde alguns segundos para o banco inicializar
- Verifique credenciais em `.env`

### Erro: "Redis connection refused"
- Verifique se Redis está rodando: `docker-compose ps`
- Confirme `REDIS_URL` está correto

### Erro: Migrations falhando
```bash
# Reset do banco (cuidado: apaga dados!)
docker-compose exec web pnpm exec prisma migrate reset

# Ou manualmente
docker-compose exec web pnpm exec prisma db push --force-reset
```

---

## Segurança em Produção

1. **HTTPS Obrigatório**
   - Configure certificado SSL/TLS
   - Redirecione HTTP para HTTPS

2. **Variáveis de Ambiente Seguras**
   - Nunca commite `.env` no git
   - Use secrets manager (AWS Secrets, Azure Key Vault, etc)

3. **Firewall**
   - Bloqueie acesso direto ao banco de dados
   - Use security groups/firewalls
   - Apenas apps podem acessar banco

4. **Backups Regulares**
   - Configure backups automáticos diários
   - Teste restore periodicamente

5. **Monitoramento**
   - Configure alertas para downtime
   - Monitore uso de recursos (CPU, RAM, disco)
   - Configure logs centralizados

---

## Rollback

Se algo der errado após o deploy:

### Com Docker Compose
```bash
# Reverta para versão anterior
docker-compose down
git checkout <commit-anterior>
docker-compose up -d --build
```

### Com Vercel/Railway
- Use a interface web para reverter para deployment anterior
- Automático em caso de erro

---

## Performance

### Otimizações
- Habilitar caching do Next.js
- Usar CDN para static assets
- Comprimir responses (gzip)
- Database connection pooling
- Redis para cache

### Monitoramento
- Monitore First Contentful Paint (FCP)
- Monitore Largest Contentful Paint (LCP)
- Monitore Time to Interactive (TTI)

---

## Contato & Suporte

Para dúvidas sobre deployment:
- Documentação: [README.md](README.md)
- Issues: [GitHub Issues](https://github.com/seu-usuario/isenta/issues)
- Email: support@isenta.local

---

**Última atualização**: 03/08/2026
**Versão**: 0.1.0
