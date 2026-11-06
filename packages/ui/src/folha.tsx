import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTINUO, cor, LARGURA_MAXIMA, MARGEM, raio } from './tema';
import { Icone } from './icone';
import { T } from './texto';

/** Na web não há módulo nativo de animações: aí o Animated corre em JavaScript. */
const NATIVO = Platform.OS !== 'web';
/** A curva das folhas do iOS: arranca depressa e assenta devagar. */
const CURVA = Easing.bezier(0.32, 0.72, 0, 1);
const MS_A_ABRIR = 450;
const MS_A_FECHAR = 300;

/**
 * Uma folha que sobe de baixo, como no iOS: um título, o fechar, e o que lá vai dentro.
 *
 * A sombra acende-se no sítio enquanto a folha sobe, as duas no mesmo passo, e apagam-se
 * juntas ao fechar. (Com o «slide» do próprio Modal, a sombra subia agarrada à folha, como
 * um rectângulo escuro a varrer o ecrã.) Ao fechar, a folha fica montada até descer, com o
 * último título e conteúdo que teve aberta: quem a usa pode limpar os dados logo ao fechar.
 */
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
  const { height: alturaDoEcra } = useWindowDimensions();
  // 0: em baixo e sem sombra; 1: aberta e com a sombra toda.
  const [progresso] = useState(() => new Animated.Value(0));
  // A altura da folha, medida quando aparece: sobe daí. Antes de a medir, fica fora do ecrã.
  const [altura, setAltura] = useState(0);
  const [antes, setAntes] = useState(aberta);
  const [aFechar, setAFechar] = useState(false);
  const [ultima, setUltima] = useState({ titulo, children });
  if (aberta !== antes) {
    setAntes(aberta);
    setAFechar(!aberta);
  }
  if (aberta && (ultima.titulo !== titulo || ultima.children !== children)) {
    setUltima({ titulo, children });
  }
  const mostrada = aberta ? { titulo, children } : ultima;

  useEffect(() => {
    if (aberta) {
      if (!altura) return;
      const subir = Animated.timing(progresso, {
        toValue: 1,
        duration: MS_A_ABRIR,
        easing: CURVA,
        useNativeDriver: NATIVO,
      });
      subir.start();
      return () => subir.stop();
    }
    if (!aFechar) return;
    Keyboard.dismiss();
    const descer = Animated.timing(progresso, {
      toValue: 0,
      duration: MS_A_FECHAR,
      easing: CURVA,
      useNativeDriver: NATIVO,
    });
    descer.start(({ finished }) => {
      if (finished) setAFechar(false);
    });
    return () => descer.stop();
  }, [aberta, aFechar, altura, progresso]);

  const deslocamento = useMemo(
    () =>
      progresso.interpolate({
        inputRange: [0, 1],
        outputRange: [altura || alturaDoEcra, 0],
      }),
    [progresso, altura, alturaDoEcra],
  );

  return (
    <Modal visible={aberta || aFechar} transparent animationType="none" onRequestClose={fechar}>
      {/* Com o teclado aberto (o campo do código), a folha sobe com ele. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
            // A descer já não responde: um segundo toque não faz nada de novo.
            pointerEvents: aberta ? 'auto' : 'none',
          }}
        >
          {/* O fundo escuro fecha ao toque. É irmão da folha, não pai: no iPhone um ScrollView
              não rola enquanto um antepassado for o «responder» de JavaScript, e um Pressable à
              volta do conteúdo travava as rodas do aniversário. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.6)', opacity: progresso },
            ]}
          >
            <Pressable onPress={fechar} aria-label="Fechar" style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View
            role="dialog"
            aria-modal
            aria-label={mostrada.titulo}
            onLayout={(e) => setAltura(Math.ceil(e.nativeEvent.layout.height))}
            style={{
              width: '100%',
              maxWidth: LARGURA_MAXIMA,
              backgroundColor: cor.superficie,
              borderTopLeftRadius: raio.cartao,
              borderTopRightRadius: raio.cartao,
              paddingBottom: margens.bottom + 16,
              ...CONTINUO,
              transform: [{ translateY: deslocamento }],
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
              <T v="seccao">{mostrada.titulo}</T>
              <Pressable
                onPress={fechar}
                role="button"
                aria-label="Fechar"
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: pressed ? cor.linha : cor.superficieAlta,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <Icone nome="fechar" tamanho={18} espessura={2.2} />
              </Pressable>
            </View>
            {mostrada.children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
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
