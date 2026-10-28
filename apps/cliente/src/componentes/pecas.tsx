import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALTURA_DA_BARRA, cor, LARGURA_MAXIMA, MARGEM, raio } from '../tema';
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
          paddingTop: semTopo ? 0 : margens.top + 18,
          paddingBottom: margens.bottom + (comBarra ? ALTURA_DA_BARRA + 32 : 40),
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: LARGURA_MAXIMA }}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** O título de uma secção, no fio da letra (300), como o nome fino do logótipo. */
export function Rotulo({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ paddingHorizontal: MARGEM, marginTop: 40, marginBottom: 16 }, style]}>
      <T v="seccao" role="heading" aria-level={2}>
        {children}
      </T>
    </View>
  );
}

/** Linhas umas por baixo das outras, entre dois traços, sem caixa à volta. */
export function Grupo({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          marginHorizontal: MARGEM,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: cor.linha,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Separador({ recuo = 0 }: { recuo?: number }) {
  return <View style={{ height: 1, backgroundColor: cor.linha, marginLeft: recuo }} />;
}

/**
 * A etiqueta dos parceiros inventados para a demonstração: sobre a capa, com
 * contorno; na lista, só a palavra, em cinzento, para não competir com a placa.
 */
export function EtiquetaExemplo({ sobreFoto = false }: { sobreFoto?: boolean }) {
  if (!sobreFoto)
    return (
      <T v="legenda" style={{ fontSize: 12, lineHeight: 16, color: cor.texto3 }}>
        Exemplo
      </T>
    );
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: raio.etiqueta,
        borderWidth: 1,
        borderColor: '#FFFFFF',
      }}
    >
      <T style={{ fontFamily: 'Manrope_700Bold', fontSize: 12, lineHeight: 16, color: '#FFFFFF' }}>
        Exemplo
      </T>
    </View>
  );
}

/** «Novo»: uma etiqueta branca, como a de preço numa loja de ténis. */
export function EtiquetaNovo() {
  return (
    <View
      style={{
        backgroundColor: cor.claro,
        borderRadius: raio.etiqueta,
        paddingHorizontal: 6,
        paddingVertical: 3,
      }}
    >
      <T v="etiqueta" style={{ color: cor.sobreClaro }}>
        Novo
      </T>
    </View>
  );
}

/** Uma acção do parceiro (Ir, Ligar, Instagram, Site): um quadrado de contorno. */
export function BotaoDeAccao({
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
        width: 80,
        height: 70,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: raio.accao,
        borderWidth: 1.5,
        borderColor: cor.contorno,
        backgroundColor: pressed ? cor.superficie : 'transparent',
      })}
    >
      <Icone nome={icone} tamanho={22} espessura={2} />
      <T
        v="rotulo"
        style={{ fontSize: 11.5, lineHeight: 14, letterSpacing: 0.6 }}
        numberOfLines={1}
      >
        {nome}
      </T>
    </Pressable>
  );
}

/**
 * O botão: o principal é branco (a acção que importa, como «Marcar»); o
 * secundário é um contorno. O nome em maiúsculas, curto.
 */
export function Botao({
  nome,
  onPress,
  icone,
  secundario = false,
  largo = false,
  rotulo,
}: {
  nome: string;
  onPress: () => void;
  icone?: NomeDoIcone;
  secundario?: boolean;
  largo?: boolean;
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
        gap: 10,
        height: 48,
        paddingHorizontal: 20,
        borderRadius: raio.botao,
        ...(largo ? { flexGrow: 1, flexBasis: 0 } : null),
        ...(secundario
          ? {
              borderWidth: 1.5,
              borderColor: cor.contorno,
              backgroundColor: pressed ? cor.superficie : 'transparent',
            }
          : { backgroundColor: pressed ? cor.claroPremido : cor.claro }),
      })}
    >
      {icone && <Icone nome={icone} tamanho={20} cor={tinta} espessura={2} />}
      <T v="rotulo" style={{ color: tinta }}>
        {nome}
      </T>
    </Pressable>
  );
}
