import { Text, type TextProps, type TextStyle } from 'react-native';
import { cor, letra } from '../tema';

const VARIANTES = {
  destaque: { fontFamily: letra.extra, fontSize: 46, lineHeight: 50, letterSpacing: -1.6 },
  titulo: { fontFamily: letra.extra, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  subtitulo: { fontFamily: letra.extra, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  tituloCartao: { fontFamily: letra.forte, fontSize: 18, lineHeight: 23, letterSpacing: -0.2 },
  forte: { fontFamily: letra.forte, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  corpo: { fontFamily: letra.media, fontSize: 15, lineHeight: 21 },
  legenda: { fontFamily: letra.semi, fontSize: 13, lineHeight: 18 },
  rotulo: {
    fontFamily: letra.forte,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type Variante = keyof typeof VARIANTES;

/** O texto da app: uma variante, a cor do texto por omissão. */
export function T({ v = 'corpo', style, ...resto }: TextProps & { v?: Variante }) {
  return <Text {...resto} style={[{ color: cor.texto }, VARIANTES[v], style]} />;
}
