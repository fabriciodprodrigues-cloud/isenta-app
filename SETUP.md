# Setup do Ambiente de Desenvolvimento

Guia passo a passo para configurar o Isenta localmente.

## ✅ Pré-requisitos

Verificar se você tem instalado:

- **Node.js 18+** — `node --version`
- **pnpm 8+** — `pnpm --version` (ou instalar com `npm i -g pnpm`)
- **PostgreSQL 14+** — `psql --version`
- **Redis 7+** — `redis-cli --version`

Se algum estiver faltando, instale:

### Windows

```powershell
# Node.js + pnpm
winget install OpenJS.NodeJS
npm install -g pnpm

# PostgreSQL (via Installer ou WSL)
winget install PostgreSQL

# Redis (via WSL ou Docker)
wsl
sudo apt update
sudo apt install redis-server
redis-server

# Ou via Docker
docker run -d -p 6379:6379 redis:7
```

### macOS

```bash
brew install node@18 pnpm postgresql redis
brew services start postgresql
brew services start redis
```

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs
npm install -g pnpm
sudo apt install postgresql redis-server
sudo systemctl start postgresql
sudo systemctl start redis-server
```

## 🚀 Setup Inicial

### 1. Instalar Dependências

```bash
cd C:\Aplicativos\Isenta
pnpm install
```

Isso instala todas as dependências do monorepo (apps/web, apps/worker, packages/shared).

### 2. Configurar Banco de Dados

Criar arquivo `.env.local` na raiz:

```bash
cp .env.example .env.local
```

Editar `.env.local` com suas credenciais PostgreSQL:

```env
DATABASE_URL="postgresql://seu_usuario:sua_senha@localhost:5432/isenta"
NEXTAUTH_SECRET="gere-um-string-aleatorio-aqui" # pnpm exec openssl rand -base64 32
REDIS_URL="redis://localhost:6379"
```

### 3. Criar Banco de Dados PostgreSQL

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Dentro do psql:
CREATE DATABASE isenta;
CREATE USER isenta_user WITH PASSWORD 'sua_senha';
ALTER ROLE isenta_user WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE isenta TO isenta_user;
\q
```

Ou via SQL diretamente:

```bash
psql -U postgres -c "CREATE DATABASE isenta;"
psql -U postgres -c "CREATE USER isenta_user WITH PASSWORD 'sua_senha';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE isenta TO isenta_user;"
```

### 4. Executar Migrations

```bash
pnpm exec prisma migrate dev
```

Isso:
- Cria as tabelas no banco
- Gera o cliente Prisma
- Oferece opção de seed (demo data)

### 5. Seed com Dados Demo (Opcional)

Criar usuário admin para teste:

```bash
# Usar o Prisma Studio para inserir dados
pnpm exec prisma studio
```

Ou via SQL:

```bash
psql -U isenta_user -d isenta -c "
  INSERT INTO \"User\" (id, email, password, name, role)
  VALUES (
    'user_admin_demo',
    'admin@isenta.local',
    '\$2a\$10\$fake_bcrypt_hash_here', -- usar bcrypt real em produção
    'Admin Demo',
    'admin'
  );
"
```

**Nota:** Para teste rápido, use a senha `admin123` (hash será gerado no seed)

## ▶️ Rodar o Projeto

### Modo Desenvolvimento

```bash
pnpm dev
```

Isso inicia:
- **Web:** http://localhost:3000
- **Worker:** logs no terminal

### Parar o Servidor

Pressione `Ctrl+C` no terminal.

## 🔗 URLs Locais

| Serviço | URL | Descrição |
|---------|-----|----------|
| Painel Web | http://localhost:3000 | Aplicação Next.js |
| API | http://localhost:3000/api | API routes |
| Prisma Studio | http://localhost:5555 | Gerenciador de banco (quando rodando) |
| Redis | localhost:6379 | Fila de jobs |
| PostgreSQL | localhost:5432 | Banco de dados |

## 🧪 Testar Login

1. Abrir http://localhost:3000/login
2. Usar credenciais demo:
   - **Email:** `admin@isenta.local`
   - **Senha:** `admin123`
3. Você será redirecionado para `/dashboard`

## 📦 Estrutura de Pastas

```
isenta/
├── apps/
│   ├── web/               ← Painel Next.js (porta 3000)
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   └── worker/            ← Worker de jobs
│       └── src/
├── packages/
│   └── shared/            ← Tipos e constantes
├── prisma/
│   └── schema.prisma      ← Schema do banco
├── .env.local             ← Variáveis de ambiente
└── README.md
```

## 🐛 Troubleshooting

### ❌ "Cannot find module 'next'"

```bash
# Limpar e reinstalar
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### ❌ "Database connection refused"

```bash
# Verificar se PostgreSQL está rodando
psql -U postgres -c "SELECT version();"

# Se não estiver:
# Windows: Services → PostgreSQL → Start
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

### ❌ "Redis connection refused"

```bash
# Verificar se Redis está rodando
redis-cli ping  # Deve retornar "PONG"

# Se não estiver:
# Windows: docker run -d -p 6379:6379 redis:7
# macOS: brew services start redis
# Linux: sudo systemctl start redis-server
```

### ❌ "EACCES: permission denied"

No Linux/macOS, pode precisar de sudo:

```bash
sudo pnpm install
# Ou configurar permissões
sudo chown -R $USER:$USER .
```

## 📝 Comandos Úteis

```bash
# Desenvolvimento
pnpm dev                      # Iniciar tudo
pnpm build                    # Build para produção
pnpm type-check              # Verificar tipos

# Banco de Dados
pnpm exec prisma migrate dev  # Criar/aplicar migrations
pnpm exec prisma studio      # GUI do banco
pnpm exec prisma reset       # Resetar banco (DELETE ALL DATA!)

# Linting
pnpm lint                     # Verificar estilo

# Limpeza
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## ✨ Próximos Passos

1. ✅ **Setup local concluído**
2. 📖 Ler [DEVELOPMENT.md](DEVELOPMENT.md) para convenções de código
3. 🏗️ Ler [README.md](README.md) para entender a arquitetura
4. 💻 Começar a codificar! (ver seção "Fases de Desenvolvimento" em DEVELOPMENT.md)

## 🆘 Precisa de Ajuda?

- Revisar os logs de erro
- Verificar `.env.local` está correto
- Tentar `pnpm install` novamente
- Resetar banco: `pnpm exec prisma reset`
- Abrir uma issue com o erro completo

---

**Bora codar!** 🚀
