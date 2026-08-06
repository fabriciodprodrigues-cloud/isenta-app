/**
 * Le o .env da raiz do projeto e popula process.env.
 *
 * O @prisma/client nao carrega .env sozinho — isso e comportamento da CLI do
 * Prisma, nao do client. Sem este passo os scripts falham com "Environment
 * variable not found: DATABASE_URL".
 *
 * Escrito sem dependencia externa porque dotenv nao esta instalado no projeto.
 */
const fs = require('fs');
const path = require('path');

function carregarEnv() {
  const caminho = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(caminho)) {
    throw new Error(
      `.env nao encontrado em ${caminho}. Rode os scripts a partir da pasta do projeto.`
    );
  }

  const conteudo = fs.readFileSync(caminho, 'utf8');

  conteudo.split(/\r?\n/).forEach(linha => {
    const texto = linha.trim();
    if (!texto || texto.startsWith('#')) return;

    const separador = texto.indexOf('=');
    if (separador === -1) return;

    const chave = texto.slice(0, separador).trim();
    let valor = texto.slice(separador + 1).trim();

    // Remove aspas simples ou duplas em volta do valor.
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    // Nao sobrescreve o que ja veio do ambiente real.
    if (process.env[chave] === undefined) {
      process.env[chave] = valor;
    }
  });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL nao encontrada no .env.');
  }
}

module.exports = { carregarEnv };
