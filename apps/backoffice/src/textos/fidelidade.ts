/** As frases desta página: o português é a fonte; o inglês (britânico) tem as mesmas chaves. */
export const pt = {
  camposPorCorrigir: 'Há campos por corrigir.',
  carimbos: (n: number) => `${n} ${n === 1 ? 'carimbo' : 'carimbos'}`,
  objectivo: 'Carimbos para a recompensa',
  objectivoAjuda: 'Os cartões já começados completam-se com o número com que começaram.',
  recompensa: 'Recompensa',
  /** Os exemplos dos campos em português são conteúdo em português; os dos campos em inglês, em inglês. */
  recompensaExemplo: 'ex.: 50% de desconto',
  recompensaExemploEn: 'ex.: 50% off',
  recompensaAjuda: 'Vale também para os cartões em curso.',
  porDia: 'Carimbos por dia',
  porDiaAjuda: 'Por cliente. Acima disto, a app for partners avisa.',
  aniversario: 'Prenda de anos',
  aniversarioExemplo: 'ex.: Barba grátis',
  aniversarioExemploEn: 'ex.: Free beard trim',
  aniversarioAjuda: 'Vazio: sem prenda de anos.',
};

export const en: typeof pt = {
  camposPorCorrigir: 'Some fields need fixing.',
  carimbos: (n) => `${n} ${n === 1 ? 'stamp' : 'stamps'}`,
  objectivo: 'Stamps needed for the reward',
  objectivoAjuda: 'Cards already started keep the number they started with.',
  recompensa: 'Reward',
  recompensaExemplo: 'e.g. 50% de desconto',
  recompensaExemploEn: 'e.g. 50% off',
  recompensaAjuda: 'Also applies to cards in progress.',
  porDia: 'Stamps per day',
  porDiaAjuda: 'Per client. Beyond this, the partner app shows a warning.',
  aniversario: 'Birthday gift',
  aniversarioExemplo: 'e.g. Barba grátis',
  aniversarioExemploEn: 'e.g. Free beard trim',
  aniversarioAjuda: 'Leave blank for no birthday gift.',
};
