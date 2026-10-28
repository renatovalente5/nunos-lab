import type { ParceiroPublico } from '@nunos-lab/dominio';
import { corParaBranco } from '@nunos-lab/dominio';
import { useId, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { urlDaImagem } from '../dados';

/**
 * A capa de um parceiro: a fotografia dele, ou a cor dele, lisa (escurecida se
 * for clara, para o texto branco passar 4,5:1). Com fotografia, um véu escuro de
 * 85 % por baixo do texto, do lado onde ele está: em cima no cartão em destaque,
 * em baixo na página do parceiro.
 */
export function Capa({
  parceiro,
  altura,
  raio = 0,
  veu = 'baixo',
  children,
}: {
  parceiro: Pick<ParceiroPublico, 'cor' | 'capa'>;
  altura: number;
  raio?: number;
  veu?: 'cima' | 'baixo';
  children?: ReactNode;
}) {
  const id = `v${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const paragens =
    veu === 'cima'
      ? [
          [0, 0.85],
          [0.3, 0.85],
          [0.62, 0],
        ]
      : [
          [0.22, 0],
          [0.52, 0.85],
          [1, 0.85],
        ];
  return (
    <View
      style={{
        height: altura,
        borderRadius: raio,
        overflow: 'hidden',
        backgroundColor: corParaBranco(parceiro.cor),
      }}
    >
      {parceiro.capa && (
        <>
          <Image
            source={{ uri: urlDaImagem(parceiro.capa) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden
          >
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                {paragens.map(([onde, quanto]) => (
                  <Stop key={onde} offset={onde} stopColor="#000000" stopOpacity={quanto} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
          </Svg>
        </>
      )}
      {children}
    </View>
  );
}
