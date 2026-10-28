import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentRef, ReactNode, Ref } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALTURA_DA_BARRA, cor, letra } from './tema';
import { Icone, type NomeDoIcone } from './icone';
import { T } from './texto';

/**
 * A barra de baixo: uma cápsula a flutuar, com os dois separadores. No React
 * 19 a «ref» é uma propriedade como as outras: o TabList passa-a e ela segue.
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
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: margens.bottom + 14,
        alignItems: 'center',
      }}
    >
      <View
        ref={ref}
        {...resto}
        role="tablist"
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 6,
          height: ALTURA_DA_BARRA,
          borderRadius: 999,
          backgroundColor: cor.vidro,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

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
  const tinta = isFocused ? cor.sobreClaro : cor.texto2;
  return (
    <Pressable
      ref={ref}
      {...resto}
      role="tab"
      aria-selected={!!isFocused}
      aria-label={nome}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: ALTURA_DA_BARRA - 12,
        paddingHorizontal: 20,
        borderRadius: 999,
        backgroundColor: isFocused ? cor.claro : 'transparent',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icone nome={icone} tamanho={20} cor={tinta} espessura={2} />
      <T style={{ color: tinta, fontFamily: letra.forte, fontSize: 14, lineHeight: 18 }}>{nome}</T>
    </Pressable>
  );
}
