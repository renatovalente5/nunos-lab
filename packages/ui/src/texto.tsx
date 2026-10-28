import { Text, type TextProps, type TextStyle } from 'react-native';
import { cor, letra } from './tema';

/** As vozes da letra: títulos e números a cheio, texto corrido leve, etiquetas pequenas. */
const VARIANTES = {
  destaque: { fontFamily: letra.extra, fontSize: 44, lineHeight: 48, letterSpacing: -1.5 },
  titulo: { fontFamily: letra.extra, fontSize: 30, lineHeight: 36, letterSpacing: -0.9 },
  /** «Em destaque», «Parceiros», «As tuas vantagens»: a cheio, como no iOS. */
  seccao: { fontFamily: letra.forte, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  subtitulo: { fontFamily: letra.extra, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
  tituloCartao: { fontFamily: letra.forte, fontSize: 18, lineHeight: 23, letterSpacing: -0.25 },
  forte: { fontFamily: letra.forte, fontSize: 16, lineHeight: 21, letterSpacing: -0.15 },
  corpo: { fontFamily: letra.media, fontSize: 15, lineHeight: 21 },
  legenda: { fontFamily: letra.semi, fontSize: 13, lineHeight: 18 },
  /** Só nas etiquetas («Exemplo», «Novo»). */
  rotulo: {
    fontFamily: letra.forte,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type Variante = keyof typeof VARIANTES;

/** O texto da app: uma variante, a cor do texto por omissão. */
export function T({ v = 'corpo', style, ...resto }: TextProps & { v?: Variante }) {
  return <Text {...resto} style={[{ color: cor.texto }, VARIANTES[v], style]} />;
}
