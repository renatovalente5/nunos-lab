/**
 * A cara da app: o preto e o papel quente da marca do Nuno's Lab, e a letra
 * Manrope, a mesma do site deles. A cor aparece nos parceiros, não na moldura.
 */
export const cor = {
  fundo: '#0A0A0A',
  superficie: '#141414',
  superficieAlta: '#1D1D1D',
  linha: '#262626',
  texto: '#F4F1EC',
  texto2: '#ABA69E',
  texto3: '#7C776F',
  claro: '#F4F1EC',
  sobreClaro: '#0A0A0A',
} as const;

export const letra = {
  media: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  forte: 'Manrope_700Bold',
  extra: 'Manrope_800ExtraBold',
} as const;

export const raio = { cartao: 24, grupo: 20, botao: 16, pilula: 999 } as const;

/** No computador a app fica numa coluna, como no telemóvel. */
export const LARGURA_MAXIMA = 560;
export const MARGEM = 20;
