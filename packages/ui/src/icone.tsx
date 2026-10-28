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
  certo: ['M5 12.5l4.5 4.5L19 7'],
  fechar: ['M6 6l12 12', 'M18 6L6 18'],
  presente: [
    'M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8',
    'M3 7h18v5H3z',
    'M12 22V7',
    'M12 7H7.6a2.3 2.3 0 1 1 0-4.6C10.8 2.4 12 7 12 7z',
    'M12 7h4.4a2.3 2.3 0 1 0 0-4.6C13.2 2.4 12 7 12 7z',
  ],
  pessoa: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  camara: [
    'M3 9V6.5A2.5 2.5 0 0 1 5.5 4H8',
    'M16 4h2.5A2.5 2.5 0 0 1 21 6.5V9',
    'M21 15v2.5a2.5 2.5 0 0 1-2.5 2.5H16',
    'M8 20H5.5A2.5 2.5 0 0 1 3 17.5V15',
    'M7 12h10',
  ],
  cartao: [
    'M3.5 6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z',
    'M3.5 10h17',
  ],
  sair: ['M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4', 'M15 16l4-4-4-4', 'M19 12H9'],
  mais: ['M12 5v14', 'M5 12h14'],
  lapis: ['M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z', 'M13.5 7.5l3 3'],
  lixo: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  email: ['M3.5 6.5h17v11h-17z', 'M3.5 7l8.5 6 8.5-6'],
  bolo: [
    'M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z',
    'M4 15.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0',
    'M8 11V8',
    'M12 11V7',
    'M16 11V8',
    'M12 4v1',
  ],
  loja: ['M3 10l9-6 9 6', 'M5 9v11h14V9', 'M10 20v-6h4v6'],
  estrela: ['M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.7 20l1.1-6L3.4 9.8l6-.8z'],
  lista: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  teclado: ['M3 7h18v10H3z', 'M7 10.5h.01', 'M11 10.5h.01', 'M15 10.5h.01', 'M7 14h10'],
  procurar: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  aparelho: ['M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M11 18h2'],
  grafico: ['M4 20V10', 'M10 20V4', 'M16 20v-8', 'M22 20H2'],
  seta: ['M5 12h14', 'M13 6l6 6-6 6'],
  ...DESENHOS_DAS_CATEGORIAS,
} satisfies Record<string, readonly string[]> & Record<IconeDaCategoria, readonly string[]>;

export type NomeDoIcone = keyof typeof DESENHOS;

export function Icone({
  nome,
  tamanho = 22,
  cor = '#F4F1EC',
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
