/**
 * Massa de dados fictícia usada tanto pela pré-visualização de modelo de
 * documento (POST .../modelo/preview) quanto pelo script de teste local
 * (scripts/testar-modelo-documento.ts) -- um lugar só para não duplicar
 * entre a rota e o CLI. Mesmo órgão/veículos de scripts/testar-oficio-docx.ts,
 * reaproveitado para consistência entre os dois testes manuais.
 */
import type { DadosParaModelo } from './modelo-documento-tipos';

export const dadosDeExemploParaModelo: DadosParaModelo = {
  numeroOficio: '007/2026',
  protocolo: 'ISN-2026-TESTE1',
  concessionariaNome: 'Concessionária Teste',
  dataAtual: new Date(),
  orgao: {
    name: 'Câmara Municipal de Chapadão do Sul',
    razaoSocial: 'Câmara Municipal de Chapadão do Sul',
    cnpj: '01.234.567/0001-89',
    address: 'Rua Antônio João, 1200',
    bairro: 'Centro',
    numero: '1200',
    city: 'Chapadão do Sul',
    state: 'MS',
    cep: '79560-000',
    responsibleName: 'José da Silva',
    responsibleEmail: 'isencao@camarachapadaodosul.ms.gov.br',
    emailIsencao: 'isencao@camarachapadaodosul.ms.gov.br',
    responsiblePhone: '(67) 3562-1234',
    responsibleRole: 'Presidente da Câmara',
    cabecalhoTexto: null,
    cidadeEmissao: 'Chapadão do Sul/MS',
  },
  veiculos: [
    {
      plate: 'SMF-6F91',
      renavam: '01234567890',
      type: 'proprio',
      category: 'oficial',
      marca: 'Fiat',
      modelo: 'Strada',
      cor: 'Branco',
      anoFabricacao: 2022,
      anoModelo: 2023,
      tag: '07519786249',
    },
    {
      plate: 'NRL-9H10',
      renavam: '09876543210',
      type: 'locado',
      category: 'ambulancia',
      marca: 'Renault',
      modelo: 'Master',
      cor: 'Branco',
      anoFabricacao: 2021,
      anoModelo: 2021,
      tag: null,
    },
  ],
};
