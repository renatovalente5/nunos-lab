/**
 * A cara da app: o preto e o branco do logótipo do Nuno's Lab, um papel quente
 * para o texto, e a letra Manrope, a do site deles. A cor vem só dos parceiros.
 * Cantos generosos e contínuos, como no iOS: a app vai ser nativa.
 */
import type { ViewStyle } from 'react-native';

export const cor = {
  fundo: '#0A0A0A',
  superficie: '#161616',
  superficieAlta: '#222222',
  linha: '#2A2A2A',
  texto: '#F4F1EC',
  texto2: '#A9A49C',
  texto3: '#7C776F',
  claro: '#F4F1EC',
  claroPremido: '#DDD9D2',
  sobreClaro: '#0A0A0A',
  /** Os botões redondos sobre uma capa (Voltar, Partilhar). */
  veu: 'rgba(10,10,10,0.45)',
  /** A cápsula da barra de baixo. */
  vidro: 'rgba(24,24,24,0.94)',
} as const;

export const letra = {
  media: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  forte: 'Manrope_700Bold',
  extra: 'Manrope_800ExtraBold',
} as const;

export const raio = { cartao: 28, grupo: 22, botao: 16, pilula: 999 } as const;

/** Cantos contínuos (o «squircle» do iOS); na web não faz nada. */
export const CONTINUO: ViewStyle = { borderCurve: 'continuous' };

/** No computador a app fica numa coluna, como no telemóvel. */
export const LARGURA_MAXIMA = 560;
export const MARGEM = 20;
/** A cápsula da barra de baixo, sem a zona segura. */
export const ALTURA_DA_BARRA = 58;
