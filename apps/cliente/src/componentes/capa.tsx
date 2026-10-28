import type { IconeDaCategoria, ParceiroPublico } from '@nunos-lab/dominio';
import { misturar } from '@nunos-lab/dominio';
import { useId, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { urlDaImagem } from '../dados';
import { Icone } from './icone';

/**
 * A capa de um parceiro: a fotografia dele, ou, sem fotografia, a cor dele com
 * o desenho da categoria em grande. Por cima, um véu escuro em cima e em baixo
 * para o texto branco se ler sobre qualquer fotografia.
 */
export function Capa({
  parceiro,
  icone,
  altura,
  raio = 0,
  veu = true,
  children,
}: {
  parceiro: Pick<ParceiroPublico, 'cor' | 'capa'>;
  icone: IconeDaCategoria;
  altura: number;
  raio?: number;
  veu?: boolean;
  children?: ReactNode;
}) {
  const id = `v${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const escura = misturar(parceiro.cor, '#000000', 0.42);
  return (
    <View
      style={{
        height: altura,
        borderRadius: raio,
        overflow: 'hidden',
        backgroundColor: parceiro.cor,
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
                <Stop offset="0" stopColor={parceiro.cor} />
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
              <Stop offset="0" stopColor="#000000" stopOpacity={0.42} />
              <Stop offset="0.3" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#000000" stopOpacity={0.04} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.84} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}v)`} />
        </Svg>
      )}
      {children}
    </View>
  );
}
