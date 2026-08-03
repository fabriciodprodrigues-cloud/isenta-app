#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando deployment da plataforma Isenta...${NC}"

# 1. Validar variáveis de ambiente
echo -e "${YELLOW}1️⃣  Verificando variáveis de ambiente...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo -e "${YELLOW}Criando .env a partir de .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  IMPORTANTE: Configure as variáveis no arquivo .env antes de continuar!${NC}"
    exit 1
fi

# 2. Verificar Docker
echo -e "${YELLOW}2️⃣  Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker encontrado${NC}"

# 3. Build e start dos containers
echo -e "${YELLOW}3️⃣  Construindo e iniciando containers...${NC}"
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Containers iniciados com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar containers${NC}"
    exit 1
fi

# 4. Aguardar serviços ficarem prontos
echo -e "${YELLOW}4️⃣  Aguardando serviços ficarem prontos...${NC}"
sleep 10

# 5. Executar migrations
echo -e "${YELLOW}5️⃣  Executando migrations do Prisma...${NC}"
docker-compose exec -T web pnpm exec prisma migrate deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations executadas com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao executar migrations${NC}"
    exit 1
fi

# 6. Seed do banco de dados
echo -e "${YELLOW}6️⃣  Populando banco de dados...${NC}"
docker-compose exec -T web pnpm exec prisma db seed

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Banco de dados populado com sucesso${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso ao popular banco de dados (pode já existir dados)${NC}"
fi

# 7. Status dos containers
echo -e "${YELLOW}7️⃣  Status dos containers:${NC}"
docker-compose ps

echo -e "${GREEN}
╔════════════════════════════════════════════════════════════╗
║  ✅ Deployment concluído com sucesso!                      ║
║                                                            ║
║  Acesse a aplicação em:                                   ║
║  🌐 http://localhost:3000                                 ║
║                                                            ║
║  Credenciais de teste:                                    ║
║  📧 Email: admin@isenta.local                             ║
║  🔑 Senha: admin123                                       ║
║                                                            ║
║  ou                                                        ║
║                                                            ║
║  📧 Email: operador@prefeitura.sp.gov.br                 ║
║  🔑 Senha: operador123                                    ║
║                                                            ║
║  Logs:                                                     ║
║  📋 docker-compose logs -f web                            ║
║                                                            ║
║  Parar containers:                                         ║
║  🛑 docker-compose down                                    ║
╚════════════════════════════════════════════════════════════╝
${NC}"
