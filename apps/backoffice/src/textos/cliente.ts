/** As frases desta página: o português é a fonte; o inglês (britânico) tem as mesmas chaves. */
export const pt = {
  semNome: 'Sem nome',
  /** O título da ficha de uma conta que já foi apagada. */
  contaApagada: 'Conta apagada',
  apagada: 'Apagada',
  exemplo: 'Exemplo',
  editar: 'Editar',
  apagarAConta: 'Apagar a conta',
  // Os campos: na ficha e na folha de editar.
  nome: 'Nome',
  email: 'Email',
  aniversario: 'Aniversário',
  casa: 'Barbearia',
  semCasa: 'Sem barbearia',
  desde: 'Desde',
  cortes: 'Cortes',
  cartoesCompletos: 'Cartões completos',
  entraCom: 'Entra com',
  cartoes: {
    titulo: 'Cartões',
    cartao: (n: number) => `Cartão ${n}`,
    carimbosDe: (carimbos: number, objectivo: number) => `${carimbos} de ${objectivo}`,
    desde: (dia: string) => `desde ${dia}`,
    completoA: (dia: string) => `completo a ${dia}`,
    usadoA: (dia: string, casa: string | null, pessoa: string | null) =>
      `usado a ${dia}${casa ? ` em ${casa}` : ''}${pessoa ? ` por ${pessoa}` : ''}`,
    usado: 'Usado',
    porUsar: 'Por usar',
    emCurso: 'Em curso',
    vazio: 'Ainda sem cartão',
  },
  historico: {
    titulo: 'Carimbos',
    anulado: (pessoa: string | null) => `Anulado${pessoa ? ` por ${pessoa}` : ''}`,
    repetido: 'Repetido',
    semLeitura: 'Sem leitura',
    anular: 'Anular',
    vazio: 'Ainda sem carimbos',
    resumo: (n: number, ultimo: string) =>
      `${n} ${n === 1 ? 'carimbo' : 'carimbos'} · último ${ultimo}`,
  },
  apagar: {
    pergunta: (nome: string) =>
      nome ? `Apagar a conta de ${nome}?` : 'Apagar a conta deste cliente?',
    texto:
      'Perde o cartão, os carimbos e as recompensas. Se voltar a entrar na app, começa do zero. Os carimbos já dados continuam a contar no Resumo, sem nome. Não se desfaz.',
    accao: 'Apagar',
    feito: 'Conta apagada',
  },
  anular: {
    pergunta: (dia: string, hora: string) => `Anular o carimbo de ${dia} às ${hora}?`,
    texto:
      'O cliente fica com menos um carimbo. Se este completou o cartão, o cartão volta a ficar por completar.',
    accao: 'Anular',
    feito: 'Carimbo anulado',
  },
  edicao: {
    titulo: 'Editar cliente',
    guardar: 'Guardar',
    guardado: 'Guardado',
    exemploDeEmail: 'nome@gmail.com',
    ajudaDoEmail: 'Quem entrar na app com este email fica com este cartão.',
    aniversarioErrado: 'Aniversário: dia e mês, como «25/06».',
    diaEMes: 'Dia e mês, como «25/06».',
    ajudaDoAniversario: 'Vazio: sem prenda de anos.',
  },
};

export const en: typeof pt = {
  semNome: 'No name',
  contaApagada: 'Deleted account',
  apagada: 'Deleted',
  exemplo: 'Sample',
  editar: 'Edit',
  apagarAConta: 'Delete account',
  nome: 'Name',
  email: 'Email',
  aniversario: 'Birthday',
  casa: 'Barbershop',
  semCasa: 'No barbershop',
  desde: 'Client since',
  cortes: 'Haircuts',
  cartoesCompletos: 'Completed cards',
  entraCom: 'Signs in with',
  cartoes: {
    titulo: 'Cards',
    cartao: (n) => `Card ${n}`,
    carimbosDe: (carimbos, objectivo) => `${carimbos} of ${objectivo}`,
    desde: (dia) => `started ${dia}`,
    completoA: (dia) => `completed ${dia}`,
    usadoA: (dia, casa, pessoa) =>
      `used ${dia}${casa ? ` at ${casa}` : ''}${pessoa ? ` by ${pessoa}` : ''}`,
    usado: 'Reward used',
    porUsar: 'Reward ready',
    emCurso: 'In progress',
    vazio: 'No card yet',
  },
  historico: {
    titulo: 'Stamp history',
    anulado: (pessoa) => `Undone${pessoa ? ` by ${pessoa}` : ''}`,
    repetido: 'Repeat',
    semLeitura: 'Not scanned',
    anular: 'Undo',
    vazio: 'No stamps yet',
    resumo: (n, ultimo) => `${n} ${n === 1 ? 'stamp' : 'stamps'} · last ${ultimo}`,
  },
  apagar: {
    pergunta: (nome) => (nome ? `Delete ${nome}'s account?` : "Delete this client's account?"),
    texto:
      "They lose their card, stamps and rewards. If they sign in to the app again, they start from zero. Stamps already given still count in the Summary, without a name. This can't be undone.",
    accao: 'Delete',
    feito: 'Account deleted',
  },
  anular: {
    pergunta: (dia, hora) => `Undo the stamp from ${dia} at ${hora}?`,
    texto:
      'The client loses one stamp. If this stamp completed a card, that card is no longer complete.',
    accao: 'Undo',
    feito: 'Stamp undone',
  },
  edicao: {
    titulo: 'Edit client',
    guardar: 'Save',
    guardado: 'Saved',
    exemploDeEmail: 'name@gmail.com',
    ajudaDoEmail: 'Whoever signs in to the app with this email gets this card.',
    aniversarioErrado: 'Birthday: day and month, like “25/06”.',
    diaEMes: 'Day and month, like “25/06”.',
    ajudaDoAniversario: 'Leave blank for no birthday gift.',
  },
};
