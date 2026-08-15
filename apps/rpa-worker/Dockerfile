# Imagem oficial do Playwright: já traz Chromium e as bibliotecas de sistema
# que ele exige. Instalar isso numa imagem Node comum é possível, mas exige
# dezenas de pacotes do apt e quebra a cada atualização do navegador.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

# O schema do Prisma vive na raiz do repositório, fora da pasta do worker.
# O contexto do build é a raiz justamente para alcançá-lo.
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY apps/rpa-worker/package.json ./package.json

# --omit=dev porque o worker não roda testes nem build em produção; e
# --ignore-scripts para pular o postinstall do Playwright, cujo navegador esta
# imagem já traz instalado.
RUN npm install --omit=dev --ignore-scripts

# Gera o client a partir do schema copiado acima.
RUN npx --yes prisma@5.22.0 generate --schema=./prisma/schema.prisma

COPY apps/rpa-worker/src ./src

# Roda como usuário não-root, que a imagem já provê. Navegador executando como
# root amplia o estrago de qualquer falha de sandbox.
USER pwuser

CMD ["node", "src/index.js"]
