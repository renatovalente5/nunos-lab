import type { ReactNode } from 'react';
import { View } from 'react-native';
import { MARGEM, T } from '@nunos-lab/ui';

/** A linha do título dos separadores tem sempre a altura do círculo da conta, haja ou não círculo. */
const ALTURA = 40;

/**
 * O título de um separador (Cartão, Barbearias), sempre no mesmo sítio, com ou sem o círculo da conta
 * à direita: ao trocar de separador, o título e o primeiro cartão não saltam (o Renato, 8 nov).
 */
export function CabecalhoDoSeparador({
  titulo,
  children,
}: {
  titulo: string;
  /** O que fica à direita do título (o círculo da conta). */
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        paddingHorizontal: MARGEM,
        paddingTop: 10,
        minHeight: 10 + ALTURA,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <T v="titulo" role="heading" aria-level={1} style={{ flexShrink: 1 }}>
        {titulo}
      </T>
      {children}
    </View>
  );
}
