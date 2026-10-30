import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALTURA_DA_BARRA, CONTINUO, cor, LARGURA_MAXIMA, MARGEM, raio } from './tema';
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
          paddingTop: semTopo ? 0 : margens.top + 16,
          paddingBottom: margens.bottom + (comBarra ? ALTURA_DA_BARRA + 48 : 40),
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: LARGURA_MAXIMA }}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** O título de uma secção, a cheio, como no iOS. */
export function Rotulo({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ paddingHorizontal: MARGEM, marginTop: 32, marginBottom: 14 }, style]}>
      <T v="seccao" role="heading" aria-level={2}>
        {children}
      </T>
    </View>
  );
}

/** Um grupo de linhas sobre a superfície, com cantos redondos (a lista agrupada do iOS). */
export function Grupo({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          marginHorizontal: MARGEM,
          backgroundColor: cor.superficie,
          borderRadius: raio.grupo,
          overflow: 'hidden',
          ...CONTINUO,
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

function Pilula({ children, fundo, tinta }: { children: ReactNode; fundo: string; tinta: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: raio.pilula,
        backgroundColor: fundo,
      }}
    >
      <T v="rotulo" style={{ fontSize: 10, lineHeight: 12, letterSpacing: 1, color: tinta }}>
        {children}
      </T>
    </View>
  );
}

/** A etiqueta dos parceiros inventados para a demonstração. */
export function EtiquetaExemplo({ sobreFoto = false }: { sobreFoto?: boolean }) {
  return (
    <Pilula
      fundo={sobreFoto ? 'rgba(0,0,0,0.42)' : cor.superficieAlta}
      tinta={sobreFoto ? '#FFFFFF' : cor.texto2}
    >
      Exemplo
    </Pilula>
  );
}

/** «Novo»: um parceiro que entrou há pouco. */
export function EtiquetaNovo() {
  return (
    <Pilula fundo={cor.claro} tinta={cor.sobreClaro}>
      Novo
    </Pilula>
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
      style={({ pressed }) => ({
        alignItems: 'center',
        width: 76,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: cor.superficieAlta,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone nome={icone} tamanho={22} espessura={2} />
      </View>
      <T v="legenda" style={{ marginTop: 8, color: cor.texto2 }} numberOfLines={1}>
        {nome}
      </T>
    </Pressable>
  );
}

/** O botão principal: o papel claro com a tinta preta. O secundário é da superfície. */
export function Botao({
  nome,
  onPress,
  icone,
  secundario = false,
  largo = false,
  rotulo,
  ocupado = false,
}: {
  nome: string;
  onPress: () => void;
  icone?: NomeDoIcone;
  secundario?: boolean;
  largo?: boolean;
  rotulo?: string;
  /** A enviar: ignora os toques (sem `disabled`, que na web perde o foco e o aria-disabled). */
  ocupado?: boolean;
}) {
  const tinta = secundario ? cor.texto : cor.sobreClaro;
  return (
    <Pressable
      onPress={ocupado ? undefined : onPress}
      role="button"
      aria-label={rotulo ?? nome}
      aria-busy={ocupado}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        paddingHorizontal: 20,
        borderRadius: raio.pilula,
        backgroundColor: secundario
          ? pressed
            ? cor.superficie
            : cor.superficieAlta
          : pressed
            ? cor.claroPremido
            : cor.claro,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...(largo ? { flexGrow: 1, flexBasis: 0 } : null),
      })}
    >
      {icone && <Icone nome={icone} tamanho={19} cor={tinta} espessura={2} />}
      <T v="forte" style={{ color: tinta, fontSize: 15 }}>
        {nome}
      </T>
    </Pressable>
  );
}
