import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentRef, ReactNode, Ref } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALTURA_DA_BARRA, cor, LARGURA_MAXIMA } from '../tema';
import { Icone, type NomeDoIcone } from './icone';
import { T } from './texto';

/**
 * A barra de baixo: sólida, preta, a toda a largura, com os dois separadores.
 * No React 19 a «ref» é uma propriedade como as outras: o TabList passa-a e ela
 * segue.
 */
export function BarraDeBaixo({
  children,
  ref,
  ...resto
}: {
  children?: ReactNode;
  ref?: Ref<ComponentRef<typeof View>>;
}) {
  const margens = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: margens.bottom,
        backgroundColor: cor.fundo,
        borderTopWidth: 1,
        borderTopColor: cor.linha,
        alignItems: 'center',
      }}
    >
      <View
        ref={ref}
        {...resto}
        role="tablist"
        style={{
          flexDirection: 'row',
          width: '100%',
          maxWidth: LARGURA_MAXIMA,
          height: ALTURA_DA_BARRA,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Um separador: o escolhido fica branco, com um traço branco por cima. */
export function BotaoDoSeparador({
  icone,
  nome,
  isFocused,
  ref,
  ...resto
}: TabTriggerSlotProps & {
  icone: NomeDoIcone;
  nome: string;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}) {
  const tinta = isFocused ? cor.texto : cor.texto3;
  return (
    <Pressable
      ref={ref}
      {...resto}
      role="tab"
      aria-selected={!!isFocused}
      aria-label={nome}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {isFocused && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            left: '18%',
            right: '18%',
            height: 3,
            backgroundColor: cor.texto,
          }}
        />
      )}
      <Icone nome={icone} tamanho={22} cor={tinta} espessura={2} />
      <T v="rotulo" style={{ color: tinta }}>
        {nome}
      </T>
    </Pressable>
  );
}
