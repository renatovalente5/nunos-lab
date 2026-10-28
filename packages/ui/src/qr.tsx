import { encode } from 'uqr';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Um QR desenhado em SVG (uma só forma com todos os módulos escuros), num
 * quadrado branco com cantos redondos. Sem dependência nativa: serve na web e
 * na app igual.
 */
export function QR({
  texto,
  tamanho,
  margem = 14,
  raio = 18,
  rotulo,
}: {
  texto: string;
  tamanho: number;
  margem?: number;
  raio?: number;
  rotulo?: string;
}) {
  const { caminho, n } = useMemo(() => {
    const q = encode(texto, { ecc: 'M', border: 0 });
    let d = '';
    q.data.forEach((linha, y) =>
      linha.forEach((escuro, x) => {
        if (escuro) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { caminho: d, n: q.size };
  }, [texto]);
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        padding: margem,
        borderRadius: raio,
        backgroundColor: '#FFFFFF',
        borderCurve: 'continuous',
      }}
      role="img"
      aria-label={rotulo ?? 'Código QR'}
    >
      <Svg
        width={tamanho - margem * 2}
        height={tamanho - margem * 2}
        viewBox={`0 0 ${n} ${n}`}
        // shape-rendering: crispEdges, para os módulos não ficarem desfocados.
        // @ts-expect-error — a propriedade existe no SVG da web.
        shapeRendering="crispEdges"
      >
        <Path d={caminho} fill="#000000" />
      </Svg>
    </View>
  );
}
