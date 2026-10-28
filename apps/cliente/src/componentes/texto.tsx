import { Text, type TextProps, type TextStyle } from 'react-native';
import { cor, letra } from '../tema';

/**
 * As vozes da letra. Como no logótipo, duas: o fio (300) nos títulos de secção,
 * e o grosso (800) nos números, nos nomes e nas etiquetas.
 */
const VARIANTES = {
  /** O nome na capa do parceiro. */
  titulo: { fontFamily: letra.extra, fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  /** «Em destaque», «Parceiros», «As tuas vantagens», «Marcar», «Mais». */
  seccao: { fontFamily: letra.fina, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  subtitulo: { fontFamily: letra.extra, fontSize: 22, lineHeight: 27, letterSpacing: -0.55 },
  nomeCartao: { fontFamily: letra.extra, fontSize: 23, lineHeight: 25, letterSpacing: -0.7 },
  tituloCartao: { fontFamily: letra.extra, fontSize: 19, lineHeight: 23, letterSpacing: -0.3 },
  forte: { fontFamily: letra.forte, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  frase: { fontFamily: letra.media, fontSize: 16, lineHeight: 24 },
  corpo: { fontFamily: letra.media, fontSize: 15, lineHeight: 21 },
  legenda: { fontFamily: letra.semi, fontSize: 13, lineHeight: 18 },
  /** Filtros, separadores e botões: palavras curtas em maiúsculas. */
  rotulo: {
    fontFamily: letra.extra,
    fontSize: 13.5,
    lineHeight: 17,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  /** «Novo»: a etiqueta de preço. */
  etiqueta: {
    fontFamily: letra.extra,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type Variante = keyof typeof VARIANTES;

/** O texto da app: uma variante, a cor do texto por omissão. */
export function T({ v = 'corpo', style, ...resto }: TextProps & { v?: Variante }) {
  return <Text {...resto} style={[{ color: cor.texto }, VARIANTES[v], style]} />;
}
