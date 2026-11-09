import { plural } from '../util';

/** As frases desta página: o português é a fonte; o inglês (britânico) tem as mesmas chaves. */
export const pt = {
  naAppPorEstaOrdem: (n: number) => `${plural(n, 'parceiro', 'parceiros')} na app, por esta ordem`,
  novoParceiro: 'Novo parceiro',
  exemplos: (n: number) =>
    `${plural(n, 'parceiro é de exemplo', 'parceiros são de exemplo')}, inventados para a demonstração.`,
  apagarOsExemplos: {
    pergunta: 'Apagar os exemplos?',
    texto:
      'Os parceiros de exemplo e as vantagens deles saem da app e do backoffice. Não se desfaz.',
    accao: 'Apagar os exemplos',
    feito: 'Exemplos apagados',
  },
  mostrar: 'Mostrar',
  filtros: {
    todos: 'Todos',
    app: 'Na app',
    sem: 'Sem vantagens',
    pausados: 'Pausados',
    exemplos: 'Exemplos',
  },
  procurar: 'Procurar',
  procurarParceiros: 'Procurar parceiros',
  nenhumAqui: 'Nenhum parceiro aqui',
  semParceiros: 'Ainda sem parceiros',
  juntarOPrimeiro: 'Juntar o primeiro',
  // Cada linha da lista.
  exemplo: 'Exemplo',
  pausado: 'Pausado',
  promocoes: (n: number) => plural(n, 'vantagem', 'vantagens'),
  naApp: 'na app',
  semPromocoes: 'Sem vantagens',
};

export const en: typeof pt = {
  naAppPorEstaOrdem: (n) => `${plural(n, 'partner', 'partners')} in the app, in this order`,
  novoParceiro: 'New partner',
  exemplos: (n) =>
    `${plural(n, 'partner is a sample', 'partners are samples')}, made up for the demo.`,
  apagarOsExemplos: {
    pergunta: 'Delete the samples?',
    texto:
      'The sample partners and their perks will be deleted from the app and the backoffice. This can’t be undone.',
    accao: 'Delete the samples',
    feito: 'Samples deleted',
  },
  mostrar: 'Show',
  filtros: {
    todos: 'All',
    app: 'In the app',
    sem: 'No perks',
    pausados: 'Paused',
    exemplos: 'Samples',
  },
  procurar: 'Search',
  procurarParceiros: 'Search partners',
  nenhumAqui: 'No matching partners',
  semParceiros: 'No partners yet',
  juntarOPrimeiro: 'Add your first partner',
  exemplo: 'Sample',
  pausado: 'Paused',
  promocoes: (n) => plural(n, 'perk', 'perks'),
  naApp: 'in the app',
  semPromocoes: 'No perks',
};
