/** «a, b e c» / «a, b and c». */
const juntar = (coisas: string[], e: string) =>
  coisas.length < 2 ? (coisas[0] ?? '') : `${coisas.slice(0, -1).join(', ')} ${e} ${coisas.at(-1)}`;

/** As frases desta página: o português é a fonte; o inglês (britânico) tem as mesmas chaves. */
export const pt = {
  intervalo: (de: string, ate: string) => `De ${de} a ${ate}`,
  periodo: 'Período',
  dias: (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`,
  meses: (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`,
  casa: 'Barbearia',
  todasAsCasas: 'Todas as barbearias',
  vsAnterior: 'vs. período anterior',
  igualAoAnterior: 'igual ao período anterior',
  /** Com espaço fixo antes do «%», como se escreve em português. */
  percentagem: (p: string) => `${p}\u00A0%`,
  carimbos: 'Carimbos',
  recompensasGanhas: 'Recompensas ganhas',
  entregues: (n: number) => `${n} ${n === 1 ? 'entregue' : 'entregues'}`,
  porEntregar: (n: number) => `${n} por entregar`,
  clientesNovos: 'Clientes novos',
  quemCarimbou: 'Quem carimbou',
  entregou: (n: number) => `entregou ${n} ${n === 1 ? 'recompensa' : 'recompensas'}`,
  porCasa: 'Por barbearia',
  // O gráfico dos carimbos.
  carimbosN: (n: string, um: boolean) => `${n} ${um ? 'carimbo' : 'carimbos'}`,
  semanaDe: (dia: string) => `Semana de ${dia}`,
  grafico: (total: string) => `Carimbos no período: ${total}. Usa as setas para ver cada coluna.`,
  tabela: 'Carimbos em cada dia, semana ou mês',
  // O que falta fazer (o Renato, 9 nov).
  porFazer: 'Por fazer',
  tudoEmDia: 'Tudo em dia',
  semQuemValide: 'não tem quem valide as promoções',
  naoEntrou: (parceiro: string) => `(${parceiro}) ainda não entrou na app for partners`,
  foraDaApp: 'não aparece na app: não tem promoções ligadas',
  aAcabar: (parceiro: string, dias: number, dia: string) =>
    `(${parceiro}) acaba ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `a ${dia}`}`,
  falta: (coisas: string[]) => `falta ${juntar(coisas, 'e')}`,
  nomes: (nomes: string[]) => juntar(nomes, 'e'),
  faltaNoParceiro: { morada: 'a morada', logotipo: 'o logótipo' },
  faltaNaBarbearia: {
    telefone: 'o telefone',
    marcacao: 'a ligação de marcação',
    localizacao: 'a localização no mapa',
  },
};

export const en: typeof pt = {
  intervalo: (de, ate) => `From ${de} to ${ate}`,
  periodo: 'Period',
  dias: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
  meses: (n) => `${n} ${n === 1 ? 'month' : 'months'}`,
  casa: 'Barbershop',
  todasAsCasas: 'All barbershops',
  vsAnterior: 'vs previous period',
  igualAoAnterior: 'no change vs previous period',
  percentagem: (p) => `${p}%`,
  carimbos: 'Stamps',
  recompensasGanhas: 'Rewards earned',
  entregues: (n) => `${n} redeemed`,
  porEntregar: (n) => `${n} to give out`,
  clientesNovos: 'New clients',
  quemCarimbou: 'Who stamped',
  entregou: (n) => `redeemed ${n} ${n === 1 ? 'reward' : 'rewards'}`,
  porCasa: 'By barbershop',
  carimbosN: (n, um) => `${n} ${um ? 'stamp' : 'stamps'}`,
  semanaDe: (dia) => `Week of ${dia}`,
  grafico: (total) => `Stamps in this period: ${total}. Use the arrow keys to see each bar.`,
  tabela: 'Stamps per day, week or month',
  porFazer: 'To do',
  tudoEmDia: 'All up to date',
  semQuemValide: 'has no one to validate perks',
  naoEntrou: (parceiro) => `(${parceiro}) hasn’t signed in to the partners app yet`,
  foraDaApp: 'isn’t in the app: no perks switched on',
  aAcabar: (parceiro, dias, dia) =>
    `(${parceiro}) ends ${dias === 0 ? 'today' : dias === 1 ? 'tomorrow' : `on ${dia}`}`,
  falta: (coisas) => `missing ${juntar(coisas, 'and')}`,
  nomes: (nomes) => juntar(nomes, 'and'),
  faltaNoParceiro: { morada: 'the address', logotipo: 'the logo' },
  faltaNaBarbearia: {
    telefone: 'the phone number',
    marcacao: 'the booking link',
    localizacao: 'the map location',
  },
};
