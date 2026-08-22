const { get } = require('@vercel/blob');

/**
 * Automação do Portal de Isentos da Motiva (ex-CCR).
 *
 * Cobre oito concessionárias com uma conta só: AutoBAn, MINAS SP, Pantanal,
 * PRVias, RioSP, Sorocabana, ViaCosteira e ViaSul.
 *
 * O fluxo tem quatro passos e uma solicitação por veículo — é essa repetição
 * que justifica o robô. A criação da conta fica de fora: exige código de seis
 * dígitos por e-mail e acontece uma única vez por órgão.
 *
 * Os seletores usam texto visível em vez de classes CSS. Classes de build
 * mudam a cada deploy do portal; rótulos que o usuário lê são bem mais
 * estáveis.
 */

// Os dois domínios servem o mesmo site (confirmado ao vivo), mas o app
// OAuth do login (Azure AD B2C) só tem o redirect_uri do domínio ANTIGO
// registrado — iniciar por motivapagamentos.com.br derruba o login com
// AADB2C90006 (redirect_uri_mismatch), confirmado numa execução real contra
// produção. Cadastrar o novo redirect_uri no Azure é ação de quem administra
// o portal (fora do nosso controle) — até lá, entrar sempre por este domínio.
const URL_PORTAL = 'https://isentos.ccrpagamentos.com.br';

/** Nome da concessionária no nosso banco → rótulo no seletor do portal. */
const NOME_NO_PORTAL = {
  AutoBAn: 'AutoBAn',
  'Motiva Minas SP': 'MINAS SP',
  'Motiva Pantanal': 'Pantanal',
  'Motiva Paraná (ex-PRVias)': 'PRVias',
  'RioSP (CCR RioSP)': 'RioSP',
  'ViaCosteira (CCR ViaCosteira)': 'ViaCosteira',
  ViaSul: 'ViaSul',
};

class ErroDeAutomacao extends Error {
  constructor(mensagem, { precisaDecisao = false } = {}) {
    super(mensagem);
    this.name = 'ErroDeAutomacao';
    this.precisaDecisao = precisaDecisao;
  }
}

function rotuloDaConcessionaria(nome) {
  const rotulo = NOME_NO_PORTAL[nome];
  if (!rotulo) {
    throw new ErroDeAutomacao(
      `Concessionária "${nome}" não tem correspondência conhecida no portal da Motiva.`
    );
  }
  return rotulo;
}

/** Baixa o CRLV do Blob para um arquivo temporário, para o upload do portal. */
async function baixarDocumento(pathname, destino, fs) {
  const resultado = await get(pathname, { access: 'private' });

  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    throw new ErroDeAutomacao(`Documento indisponível no armazenamento: ${pathname}`);
  }

  const buffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());
  await fs.writeFile(destino, buffer);
  return destino;
}

async function entrar(page, credencial, capturar) {
  await page.goto(URL_PORTAL, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /acessar a plataforma|entrar/i }).first().click();

  // O login é Azure AD B2C, em outro domínio.
  await page.waitForURL(/b2clogin\.com/, { timeout: 30_000 });

  // getByLabel sozinho é ambíguo nos dois campos: o de e-mail casa também
  // com o <form> ao redor ("Sign in with your e-mail"), e o de senha casa
  // também com o botão "Mostrar senha" — confirmado numa execução real
  // contra o portal. Interseção com getByRole('textbox') restringe ao
  // campo de fato em ambos os casos.
  await page.getByLabel(/e-?mail/i).and(page.getByRole('textbox')).fill(credencial.usuario);
  await page.getByLabel(/senha/i).and(page.getByRole('textbox')).fill(credencial.senha);
  await page.getByRole('button', { name: /^entrar$/i }).click();

  // Volta para o portal já autenticado. Aceita os dois domínios: confirmado
  // que isentos.ccrpagamentos.com.br (contas antigas, como a da Câmara de
  // Chapadão do Sul) e isentos.motivapagamentos.com.br servem o mesmo site,
  // e o Azure B2C pode devolver pra qualquer um dos dois conforme a conta.
  //
  // Precisa ser função de predicado sobre o HOSTNAME, não regex solta contra
  // a URL inteira: a própria URL de login carrega
  // "...&redirect_uri=https://isentos.ccrpagamentos.com.br/confirm-login" na
  // query string, e uma regex não ancorada casa com esse texto mesmo
  // enquanto a página ainda está no formulário do Azure B2C -- o código
  // seguia adiante achando que o login tinha terminado sem ter terminado.
  // Confirmado numa execução real (log mostrou "pós-login" ainda em
  // b2clogin.com).
  try {
    await page.waitForURL(
      url => /^isentos\.(ccr|motiva)pagamentos\.com\.br$/.test(new URL(url).hostname),
      { timeout: 45_000 }
    );
  } catch {
    throw new ErroDeAutomacao(
      'Login não concluiu. Verifique usuário e senha do portal, ou se a conta pede verificação adicional.'
    );
  }

  console.log('  pós-login em:', page.url());
  if (capturar) await capturar('00-pos-login');
}

/**
 * Preenche uma solicitação. Recebe já resolvido o que veio do banco.
 */
async function criarSolicitacao(page, dados, capturar) {
  const { concessionariaRotulo, veiculo, orgao, temTagNoSistema, arquivoCrlv } = dados;

  console.log('  página pós-login:', page.url());

  // Navegar direto pra /solicitacao (hard goto) causava EXISTING_DRAFT_ERROR
  // ao chegar no passo de documento, mesmo reiniciando o rascunho -- só
  // reproduzível pelo robô, não manualmente. Confirmado pelo usuário: clicar
  // no botão "Nova solicitação" da lista (navegação da própria SPA, sem
  // reload de página) e depois "Continuar" no modal de rascunho funciona
  // normalmente. Faz exatamente esse caminho em vez do goto direto.
  await page.getByRole('button', { name: /nova solicita[çc][ãa]o/i }).click();
  await capturar('01-inicio');

  // Uma tentativa anterior interrompida no meio do preenchimento deixa um
  // rascunho salvo no portal: o clique em "Nova solicitação" mostra um
  // modal perguntando se quer continuar de onde parou ou reiniciar, em vez
  // de ir direto pro formulário.
  const modalRascunho = page.getByText(/seja bem.?vindo/i);
  if (await modalRascunho.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('button', { name: /^continuar$/i }).click();
  }

  // O rascunho pode retomar em qualquer um dos 4 passos, não só "passo 1
  // limpo" ou "passo 3 documento". Uma checagem baseada em "achou algum
  // combobox" quebrava quando o resumo caía no Passo 4 (que também tem um
  // combobox -- o seletor de UF), fazendo o código tentar o Passo 1 à toa
  // numa página que já estava no Passo 4. Confirmado numa execução real
  // (screenshot do "erro" mostrava o dropdown de UF aberto, não a lista de
  // concessionárias). Lê o número direto do cabeçalho "Passo X de 4" e só
  // executa os passos que realmente faltam.
  const cabecalhoPasso = page.getByText(/passo \d de 4/i);
  await cabecalhoPasso.waitFor({ timeout: 15_000 }).catch(() => {});
  const textoPasso = await cabecalhoPasso.textContent().catch(() => null);
  const passo = Number(textoPasso?.match(/passo (\d) de 4/i)?.[1]) || 1;
  console.log('  passo atual do rascunho:', passo, textoPasso ? `(${textoPasso.trim()})` : '(não identificado)');

  if (passo <= 1) {
    // ---- Passo 1: concessionária ----
    await page.getByRole('combobox').first().click();
    await page.getByText(concessionariaRotulo, { exact: true }).click();
    await capturar('02-concessionaria');
    await page.getByRole('button', { name: /continuar/i }).click();
  }

  if (passo <= 2) {
    // ---- Passo 2: tipo de isenção ----
    // O portal separa em Veículo Oficial e Veículo Locado, que é exatamente
    // a distinção que já guardamos em Vehicle.type.
    const rotuloTipo =
      veiculo.type === 'locado' ? /ve[íi]culo locado/i : /ve[íi]culo oficial/i;
    await page.getByText(rotuloTipo).first().click();
    await capturar('03-tipo');
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForTimeout(2_000);
    await capturar('03b-apos-continuar');
  }

  if (passo <= 3) {
    // ---- Passo 3: documento ----
    // O card "Documento do Veículo" (com o campo de upload) só aparece
    // depois de uma chamada assíncrona que roda após a navegação -- tentar
    // o upload direto encontrava 0 inputs, confirmado numa execução real.
    // Espera o card renderizar antes de mexer no input.
    await page.getByText('Documento do Veículo', { exact: true }).waitFor({ timeout: 60_000 });

    const totalInputsArquivo = await page.locator('input[type="file"]').count();
    console.log('  inputs[type=file] após o card aparecer:', totalInputsArquivo);
    if (totalInputsArquivo === 0) {
      const botoes = await page.locator('button').evaluateAll(els =>
        els.map(el => ({
          texto: el.textContent?.trim().slice(0, 60),
          ariaLabel: el.getAttribute('aria-label'),
          title: el.getAttribute('title'),
        }))
      );
      console.log('  botões na página:', JSON.stringify(botoes));
    }

    await page.setInputFiles('input[type="file"]', arquivoCrlv);
    // Espera a confirmação visual de "1 de 1" antes de seguir; sem isso o
    // Continuar pode ser clicado enquanto o upload ainda corre.
    await page.getByText(/\(1 de 1\)/).waitFor({ timeout: 60_000 });
    await capturar('04-documento');
    await page.getByRole('button', { name: /continuar/i }).click();
  }

  // ---- Passo 4: dados ----
  // Dados pessoais já vêm da conta e ficam bloqueados; preenchemos o endereço
  // e o veículo. Os campos não têm <label> associado (nem por, nem por
  // aria-label) -- getByLabel nunca ia funcionar aqui. Usa os atributos
  // `name` reais do formulário, obtidos via diagnóstico numa execução real.
  // UF não é um <select> nativo, é um componente react-select (combobox com
  // busca) -- selectOption() não se aplica; abre clicando no placeholder
  // "Selecione" e escolhe digitando a sigla + Enter.
  await page.locator('input[name="applicantAddressPostalCode"]').fill(soDigitos(orgao.cep));
  await page.locator('input[name="applicantAddressStreet"]').fill(orgao.address ?? '');
  await page.locator('input[name="applicantAddressNumber"]').fill(orgao.numero ?? 'S/N');
  if (orgao.complemento) {
    await page.locator('input[name="applicantAddressComplement"]').fill(orgao.complemento);
  }
  await page.locator('input[name="applicantAddressNeighbourhood"]').fill(orgao.bairro ?? '');

  await page.getByText('Selecione', { exact: true }).click();
  await page.keyboard.type(orgao.state);
  await page.keyboard.press('Enter');

  await page.locator('input[name="applicantAddressCity"]').fill(orgao.city);

  await page.locator('input[name="plate"]').fill(veiculo.plate);

  // Ao digitar a placa, o portal consulta bases externas e pode encontrar uma
  // TAG Sem Parar. A pergunta só aparece nesse caso.
  await page.waitForTimeout(3_000);

  const blocoTag = page.getByText(/encontramos uma tag/i);
  if (await blocoTag.isVisible().catch(() => false)) {
    const resposta = temTagNoSistema
      ? /SIM, meu ve[íi]culo possui esta tag/i
      : /N[ÃA]O, meu ve[íi]culo não possui esta tag/i;

    await page.getByText(resposta).click();
    await capturar('05-tag');
  }

  await preencherSeVazio(page.locator('input[name="renavamCode"]'), veiculo.renavam);
  await preencherSeVazio(page.locator('input[name="color"]'), veiculo.cor);
  await preencherSeVazio(page.locator('input[name="vehicleBrand"]'), veiculo.marca);
  await preencherSeVazio(page.locator('input[name="vehicleModel"]'), veiculo.modelo);
  // Ano Fabricação/Modelo não têm atributo `name` (confirmado no diagnóstico
  // do Passo 4) -- localiza pelo texto do rótulo e pega o input logo depois
  // dele no DOM.
  await preencherSeVazio(
    page.getByText(/ano fabrica[çc][ãa]o/i).locator('xpath=following::input[1]'),
    veiculo.anoFabricacao
  );
  await preencherSeVazio(
    page.getByText(/ano modelo/i).locator('xpath=following::input[1]'),
    veiculo.anoModelo
  );

  await capturar('06-dados');
  await page.getByRole('button', { name: /continuar/i }).click();

  // ---- Revisão ----
  await page.getByText(/detalhes da solicita[çc][ãa]o/i).waitFor({ timeout: 30_000 });
  await capturar('07-revisao');

  await page.getByRole('button', { name: /enviar solicita[çc][ãa]o/i }).click();
  await page.waitForTimeout(5_000);
  await capturar('08-enviado');
}

function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Só preenche se o campo estiver vazio.
 *
 * O portal preenche vários campos sozinho a partir da consulta pela placa, e
 * sobrescrever o que ele trouxe seria trocar o dado da base oficial pelo
 * nosso, que pode estar desatualizado.
 */
async function preencherSeVazio(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return;

  const atual = await campo.inputValue().catch(() => '');

  if (!atual) await campo.fill(String(valor));
}

module.exports = {
  URL_PORTAL,
  ErroDeAutomacao,
  rotuloDaConcessionaria,
  baixarDocumento,
  entrar,
  criarSolicitacao,
};
