/**
 * Os tamanhos máximos de cada campo. A API recusa acima disto, e o backoffice
 * usa os mesmos números nos campos (maxLength), para nunca se escrever o que
 * depois não se grava.
 */
export const LIMITES = {
  nome: 60,
  localidade: 40,
  morada: 140,
  telefone: 20,
  instagram: 30,
  site: 200,
  horario: 140,
  descricao: 240,
  destaque: 12,
  titulo: 70,
  detalhe: 400,
  categoria: 30,
  loja: 50,
  aviso: 140,
  pessoa: 40,
} as const;

/** Os desenhos que uma categoria pode ter (o backoffice escolhe; a app desenha). */
export const ICONES_DAS_CATEGORIAS = [
  'comer',
  'cafe',
  'carro',
  'treino',
  'beleza',
  'saude',
  'compras',
  'casa',
  'lazer',
  'outro',
] as const;
export type IconeDaCategoria = (typeof ICONES_DAS_CATEGORIAS)[number];

export function eIconeDaCategoria(valor: string): valor is IconeDaCategoria {
  return (ICONES_DAS_CATEGORIAS as readonly string[]).includes(valor);
}

/** A paleta proposta para a cor de um parceiro (aceita-se qualquer #RRGGBB). */
export const CORES_DOS_PARCEIROS = [
  '#B4532A',
  '#B42333',
  '#9D2B6B',
  '#6D3FC0',
  '#2456B8',
  '#0F6E80',
  '#16714E',
  '#4F7A1E',
  '#9A6A12',
  '#5C544C',
  '#26303D',
] as const;

/** Atalhos para o texto grande de uma promoção. */
export const SUGESTOES_DE_DESTAQUE = ['−10%', '−15%', '−20%', '2×1', 'Grátis', 'Oferta'] as const;

/** Um parceiro conta como «novo» na app durante estes dias. */
export const DIAS_DE_NOVO = 14;

/** Uma promoção «está a acabar» no backoffice quando faltam estes dias ou menos. */
export const DIAS_A_ACABAR = 7;

/** Quanto tempo vale uma ligação de acesso ao backoffice, e quanto dura uma sessão parada. */
export const DIAS_DA_LIGACAO = 7;
export const DIAS_DA_SESSAO = 90;

/** O tamanho máximo de uma imagem já reduzida no browser (o D1 aceita até 2 MB por valor). */
export const BYTES_DA_IMAGEM = 1_500_000;
