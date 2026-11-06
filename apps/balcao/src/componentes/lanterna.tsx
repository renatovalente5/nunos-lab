import Svg, { Path } from 'react-native-svg';

/** A lanterna, com o traço dos outros ícones (a ui ainda não a tem). */
export function IconeDaLanterna({
  tamanho = 20,
  cor = '#F4F1EC',
  espessura = 2.2,
}: {
  tamanho?: number;
  cor?: string;
  espessura?: number;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden>
      {['M8 3h8v4l-2 3v10a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V10L8 7z', 'M8 7h8', 'M12 12.5v2'].map(
        (d) => (
          <Path
            key={d}
            d={d}
            stroke={cor}
            strokeWidth={espessura}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </Svg>
  );
}
