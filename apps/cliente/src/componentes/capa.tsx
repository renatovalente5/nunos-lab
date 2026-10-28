import type { IconeDaCategoria, ParceiroPublico } from '@nunos-lab/dominio';
import { corParaBranco, misturar } from '@nunos-lab/dominio';
import { useId, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { urlDaImagem } from '../dados';
import { CONTINUO, Icone } from '@nunos-lab/ui';

/**
 * A capa de um parceiro: a fotografia dele, ou, sem fotografia, a cor dele em
 * gradiente com o desenho da categoria em grande. Por cima, um véu escuro em
 * cima e em baixo, para o texto branco se ler sobre qualquer fotografia. A cor
 * vem escurecida se for clara, para o branco passar 4,5:1.
 */
export function Capa({
  parceiro,
  icone,
  altura,
  raio = 0,
  raioBaixo,
  veu = true,
  borda = false,
  children,
}: {
  parceiro: Pick<ParceiroPublico, 'cor' | 'capa'>;
  icone: IconeDaCategoria;
  altura: number;
  raio?: number;
  /** Só os cantos de baixo redondos (a capa da página do parceiro). */
  raioBaixo?: number;
  veu?: boolean;
  /** Um fio claro à volta, para o cartão se destacar do preto. */
  borda?: boolean;
  children?: ReactNode;
}) {
  const id = `v${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const base = corParaBranco(parceiro.cor);
  const escura = misturar(base, '#000000', 0.45);
  return (
    <View
      style={{
        height: altura,
        borderTopLeftRadius: raio,
        borderTopRightRadius: raio,
        borderBottomLeftRadius: raioBaixo ?? raio,
        borderBottomRightRadius: raioBaixo ?? raio,
        overflow: 'hidden',
        backgroundColor: base,
        ...CONTINUO,
        ...(borda ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' } : null),
      }}
    >
      {parceiro.capa ? (
        <Image
          source={{ uri: urlDaImagem(parceiro.capa) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <>
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden
          >
            <Defs>
              <LinearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={base} />
                <Stop offset="1" stopColor={escura} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}f)`} />
          </Svg>
          <View
            style={{
              position: 'absolute',
              right: -altura * 0.12,
              bottom: -altura * 0.1,
              transform: [{ rotate: '-12deg' }],
            }}
            aria-hidden
          >
            <Icone
              nome={icone}
              tamanho={altura * 0.95}
              cor="#FFFFFF"
              espessura={1.1}
              opacidade={0.13}
            />
          </View>
        </>
      )}
      {veu && (
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-hidden
        >
          <Defs>
            <LinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.45} />
              <Stop offset="0.3" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#000000" stopOpacity={0.05} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.86} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}v)`} />
        </Svg>
      )}
      {children}
    </View>
  );
}
