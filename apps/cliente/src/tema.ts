/**
 * A cara da app, «Rua»: o preto e o branco do logótipo do Nuno's Lab e a letra
 * Manrope, a do site deles. O branco cheio é só para o desconto (a placa) e para
 * a acção principal; a cor de cada parceiro fica na capa e nas iniciais.
 */
export const cor = {
  fundo: '#0A0A0A',
  /** O carvão: o aviso, o botão secundário premido, os blocos a carregar. */
  superficie: '#161616',
  superficieAlta: '#1F1F1F',
  linha: '#262626',
  /** A borda dos botões secundários e das acções do parceiro (3,7:1 sobre o preto). */
  contorno: '#6B6B6B',
  texto: '#FFFFFF',
  /** Moradas, categoria · localidade, a frase do parceiro (9,7:1 sobre o preto). */
  texto2: '#B3B3B3',
  texto3: '#8C8C8C',
  claro: '#FFFFFF',
  claroPremido: '#D9D9D9',
  sobreClaro: '#0A0A0A',
  /** As condições escritas na placa branca (8,9:1). */
  tintaDaPlaca: '#4A4A4A',
  /** Os botões redondos sobre a capa (Voltar, Partilhar). */
  veu: 'rgba(10,10,10,0.42)',
} as const;

export const letra = {
  /** O fio: os títulos de secção, como o nome fino do logótipo. */
  fina: 'Manrope_300Light',
  media: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  forte: 'Manrope_700Bold',
  extra: 'Manrope_800ExtraBold',
} as const;

export const raio = {
  cartao: 10,
  bilhete: 8,
  accao: 8,
  botao: 6,
  placa: 4,
  etiqueta: 3,
  pilula: 999,
} as const;

/** No computador a app fica numa coluna, como no telemóvel. */
export const LARGURA_MAXIMA = 560;
export const MARGEM = 20;
/** A barra de separadores em baixo, sem a zona segura. */
export const ALTURA_DA_BARRA = 72;
