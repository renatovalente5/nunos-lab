import { numero, plural } from '../util';

/** As frases desta página: o português é a fonte; o inglês (britânico) tem as mesmas chaves. */
export const pt = {
  subtitulo: 'Quem tem cartão.',
  exportarCsv: 'Exportar CSV',
  exemplos: (n: number) =>
    `${plural(n, 'cliente é de exemplo', 'clientes são de exemplo')}, inventados para a demonstração.`,
  apagarOsExemplos: {
    pergunta: 'Apagar os exemplos?',
    texto: 'Os clientes de exemplo saem com os cartões e os carimbos deles. Não se desfaz.',
    accao: 'Apagar os exemplos',
    feito: 'Exemplos apagados',
  },
  estado: 'Estado',
  estados: {
    todos: 'Todos',
    novos: 'Novos',
    activos: 'Activos',
    emRisco: 'Em risco',
    perdidos: 'Perdidos',
    semApp: 'Sem app',
  },
  casa: 'Casa',
  todasAsCasas: 'Todas as casas',
  pistaDaProcura: 'Nome, email ou código',
  procurarClientes: 'Procurar clientes',
  semClientes: 'Ainda sem clientes',
  nenhumAqui: 'Nenhum cliente aqui',
  colunas: {
    nome: 'Nome',
    email: 'Email',
    cortes: 'Cortes',
    ultimo: 'Último',
    cartao: 'Cartão',
    recompensas: 'Recompensas',
    entraCom: 'Entra com',
  },
  exemplo: 'Exemplo',
  /** A palavra depois do número de cortes, no telemóvel: «1 corte», «3 cortes». */
  sufixoDosCortes: (n: number): string => (n === 1 ? 'corte' : 'cortes'),
  carimbosDe: (carimbos: number, objectivo: number) => `${carimbos} de ${objectivo}`,
  porUsar: (n: number) => `${n} por usar`,
  aMostrar: (n: number) => `A mostrar os ${numero(n)} mais recentes: afina a procura.`,
};

export const en: typeof pt = {
  subtitulo: 'Everyone with a card.',
  exportarCsv: 'Export CSV',
  exemplos: (n) =>
    `${plural(n, 'client is a sample', 'clients are samples')}, made up for the demo.`,
  apagarOsExemplos: {
    pergunta: 'Delete the samples?',
    texto: "The sample clients are removed with their cards and stamps. This can't be undone.",
    accao: 'Delete the samples',
    feito: 'Samples deleted',
  },
  estado: 'Status',
  estados: {
    todos: 'All',
    novos: 'New',
    activos: 'Active',
    emRisco: 'At risk',
    perdidos: 'Lost',
    semApp: 'No app',
  },
  casa: 'Shop',
  todasAsCasas: 'All shops',
  pistaDaProcura: 'Name, email or code',
  procurarClientes: 'Search clients',
  semClientes: 'No clients yet',
  nenhumAqui: 'No clients here',
  colunas: {
    nome: 'Name',
    email: 'Email',
    cortes: 'Haircuts',
    ultimo: 'Last visit',
    cartao: 'Card',
    recompensas: 'Rewards',
    entraCom: 'Signs in with',
  },
  exemplo: 'Sample',
  sufixoDosCortes: (n) => (n === 1 ? 'haircut' : 'haircuts'),
  carimbosDe: (carimbos, objectivo) => `${carimbos} of ${objectivo}`,
  porUsar: (n) => `${n} unused`,
  aMostrar: (n) => `Showing the ${numero(n)} most recent: narrow your search.`,
};
