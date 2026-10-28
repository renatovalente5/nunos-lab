import { DESENHOS_DAS_CATEGORIAS, type IconeDaCategoria } from '@nunos-lab/dominio';
import Svg, { Path } from 'react-native-svg';

/** Desenhos de linha, 24×24, traço redondo. Feitos aqui, sem biblioteca de ícones. */
const DESENHOS = {
  voltar: ['M15 5l-7 7 7 7'],
  seguinte: ['M9 5l7 7-7 7'],
  mapa: [
    'M12 21s-7-6.1-7-11.4a7 7 0 0 1 14 0C19 14.9 12 21 12 21z',
    'M12 12a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  ],
  ligar: [
    'M5.2 3.5h3.1l1.9 4.8-2.4 1.5a11.5 11.5 0 0 0 6.4 6.4l1.5-2.4 4.8 1.9v3.1a2 2 0 0 1-2.2 2A17 17 0 0 1 3.2 5.7a2 2 0 0 1 2-2.2z',
  ],
  instagram: [
    'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3z',
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M17.3 6.7h.01',
  ],
  site: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M3.6 9h16.8',
    'M3.6 15h16.8',
    'M12 3c2.3 2.5 3.4 5.5 3.4 9s-1.1 6.5-3.4 9c-2.3-2.5-3.4-5.5-3.4-9s1.1-6.5 3.4-9z',
  ],
  relogio: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3.2 2'],
  etiqueta: [
    'M3.5 12.4V4.5a1 1 0 0 1 1-1h7.9l8.6 8.6a1.4 1.4 0 0 1 0 2l-6.4 6.4a1.4 1.4 0 0 1-2 0z',
    'M8 8h.01',
  ],
  tesoura: [
    'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M8.4 7.6L20 18.5',
    'M8.4 16.4L20 5.5',
  ],
  calendario: [
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    'M3 10h18',
    'M8 3v4',
    'M16 3v4',
  ],
  conversa: ['M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z'],
  partilhar: ['M12 3v12', 'M7.5 7.5L12 3l4.5 4.5', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'],
  aviso: [
    'M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z',
    'M16 8.5a5 5 0 0 1 0 7',
    'M18.8 6a8.5 8.5 0 0 1 0 12',
  ],
  escudo: ['M12 21s7-3.2 7-9.5V5.5L12 3 5 5.5v6c0 6.3 7 9.5 7 9.5z'],
  ...DESENHOS_DAS_CATEGORIAS,
} satisfies Record<string, readonly string[]> & Record<IconeDaCategoria, readonly string[]>;

export type NomeDoIcone = keyof typeof DESENHOS;

export function Icone({
  nome,
  tamanho = 22,
  cor = '#FFFFFF',
  espessura = 1.8,
  opacidade = 1,
}: {
  nome: NomeDoIcone;
  tamanho?: number;
  cor?: string;
  espessura?: number;
  opacidade?: number;
}) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      opacity={opacidade}
      aria-hidden
    >
      {DESENHOS[nome].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
