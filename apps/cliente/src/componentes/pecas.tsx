import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cor, LARGURA_MAXIMA, MARGEM, raio } from '../tema';
import { Icone, type NomeDoIcone } from './icone';
import { T } from './texto';

/** Um ecrã que rola, numa coluna com a largura de um telemóvel. */
export function Ecra({
  children,
  comBarra = true,
  semTopo = false,
}: {
  children: ReactNode;
  comBarra?: boolean;
  semTopo?: boolean;
}) {
  const margens = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: semTopo ? 0 : margens.top + 14,
          paddingBottom: margens.bottom + (comBarra ? 116 : 40),
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: LARGURA_MAXIMA }}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** O rótulo de uma secção, em maiúsculas pequenas, como o «LEAVE THE MARK» da marca. */
export function Rotulo({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ paddingHorizontal: MARGEM, marginTop: 30, marginBottom: 12 }, style]}>
      <T v="rotulo" style={{ color: cor.texto3 }} role="heading" aria-level={2}>
        {children}
      </T>
    </View>
  );
}

/** Um grupo de linhas sobre a superfície, com cantos redondos. */
export function Grupo({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          marginHorizontal: MARGEM,
          backgroundColor: cor.superficie,
          borderRadius: raio.grupo,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Separador({ recuo = 16 }: { recuo?: number }) {
  return <View style={{ height: 1, backgroundColor: cor.linha, marginLeft: recuo }} />;
}

/** A etiqueta dos parceiros inventados para a demonstração. */
export function EtiquetaExemplo({ sobreFoto = false }: { sobreFoto?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: sobreFoto ? 'rgba(0,0,0,0.38)' : cor.superficieAlta,
      }}
    >
      <T
        v="rotulo"
        style={{
          fontSize: 9.5,
          lineHeight: 12,
          letterSpacing: 1,
          color: sobreFoto ? '#FFFFFF' : cor.texto2,
        }}
      >
        Exemplo
      </T>
    </View>
  );
}

/** Um botão redondo com o nome por baixo (Ir, Ligar, Instagram, Site). */
export function BotaoRedondo({
  icone,
  nome,
  rotulo,
  onPress,
}: {
  icone: NomeDoIcone;
  nome: string;
  rotulo?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="link"
      aria-label={rotulo ?? nome}
      style={({ pressed }) => ({ alignItems: 'center', width: 72, opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: cor.superficieAlta,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone nome={icone} tamanho={22} />
      </View>
      <T v="legenda" style={{ marginTop: 7, color: cor.texto2 }} numberOfLines={1}>
        {nome}
      </T>
    </Pressable>
  );
}

/** O botão principal: o papel claro da marca com a tinta preta. */
export function Botao({
  nome,
  onPress,
  icone,
  secundario = false,
  rotulo,
}: {
  nome: string;
  onPress: () => void;
  icone?: NomeDoIcone;
  secundario?: boolean;
  rotulo?: string;
}) {
  const tinta = secundario ? cor.texto : cor.sobreClaro;
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={rotulo ?? nome}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 46,
        paddingHorizontal: 18,
        borderRadius: raio.pilula,
        backgroundColor: secundario ? cor.superficieAlta : cor.claro,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icone && <Icone nome={icone} tamanho={18} cor={tinta} espessura={2} />}
      <T v="forte" style={{ color: tinta, fontSize: 15 }}>
        {nome}
      </T>
    </Pressable>
  );
}
