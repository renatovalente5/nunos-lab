import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTINUO, cor, LARGURA_MAXIMA, MARGEM, raio } from './tema';
import { Icone } from './icone';
import { T } from './texto';

/** Uma folha que sobe de baixo, como no iOS: um título, o fechar, e o que lá vai dentro. */
export function Folha({
  aberta,
  fechar,
  titulo,
  children,
}: {
  aberta: boolean;
  fechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const margens = useSafeAreaInsets();
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={fechar}>
      <Pressable
        onPress={fechar}
        aria-label="Fechar"
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => {}}
          role="dialog"
          aria-modal
          aria-label={titulo}
          style={{
            width: '100%',
            maxWidth: LARGURA_MAXIMA,
            backgroundColor: cor.superficie,
            borderTopLeftRadius: raio.cartao,
            borderTopRightRadius: raio.cartao,
            paddingBottom: margens.bottom + 16,
            ...CONTINUO,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 5,
              borderRadius: 3,
              backgroundColor: cor.linha,
              marginTop: 8,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: MARGEM,
              paddingTop: 14,
              paddingBottom: 8,
            }}
          >
            <T v="seccao">{titulo}</T>
            <Pressable
              onPress={fechar}
              role="button"
              aria-label="Fechar"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed ? cor.linha : cor.superficieAlta,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Icone nome="fechar" tamanho={18} espessura={2.2} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Uma opção da folha: o nome e, se for a escolhida, o certo. */
export function OpcaoDaFolha({
  nome,
  escolhida,
  onPress,
  separador = false,
}: {
  nome: string;
  escolhida: boolean;
  onPress: () => void;
  separador?: boolean;
}) {
  return (
    <View>
      {separador && <View style={{ height: 1, backgroundColor: cor.linha, marginLeft: MARGEM }} />}
      <Pressable
        onPress={onPress}
        role="radio"
        aria-checked={escolhida}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 56,
          paddingHorizontal: MARGEM,
          backgroundColor: pressed ? cor.superficieAlta : 'transparent',
        })}
      >
        <T
          v="forte"
          style={{ flex: 1, fontFamily: escolhida ? 'Manrope_800ExtraBold' : undefined }}
        >
          {nome}
        </T>
        {escolhida && <Icone nome="certo" tamanho={22} espessura={2.4} />}
      </Pressable>
    </View>
  );
}
