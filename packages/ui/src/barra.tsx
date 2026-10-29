import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Children, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AFASTAMENTO_DA_BARRA, ALTURA_DA_BARRA, cor } from './tema';
import { Icone, type NomeDoIcone } from './icone';

/**
 * A barra de baixo, à imagem da do iPhone (iOS 26): uma cápsula a flutuar ao
 * fundo, ao meio, de largura FIXA — não estica com a janela — e só com os
 * desenhos; o nome fica para o leitor de ecrã. O separador actual é uma
 * pastilha clara, a cor do logótipo, com o desenho a preto.
 *
 * As medidas seguem as da barra do iPhone: a pastilha é mais larga do que o
 * passo entre separadores e passa um pouco por cima dos vizinhos. A 1.ª versão
 * (pastilhas com o nome ao lado, esticadas) media 410 num ecrã de 393: saía
 * pelos dois lados («o menu está gigante», 29 out 2026).
 */
const FIO = 1;
const ALTURA_DA_PASTILHA = 52;
const LARGURA_DA_PASTILHA = 92;
const PASSO = 84;
/** Do fio da cápsula à pastilha, em cima e em baixo. */
const FOLGA = (ALTURA_DA_BARRA - 2 * FIO - ALTURA_DA_PASTILHA) / 2;
/** Quanto a pastilha passa do seu passo, para cada lado. */
const SOBRA = (LARGURA_DA_PASTILHA - PASSO) / 2;
/** Na web o vidro deixa adivinhar o que passa por baixo (desfocado); no telemóvel, sem desfoque, é quase opaco. */
const VIDRO_NA_WEB = 'rgba(24,24,24,0.8)';

export function BarraDeBaixo({
  children,
  ref,
  ...resto
}: {
  children?: ReactNode;
  ref?: Ref<ComponentRef<typeof View>>;
}) {
  const margens = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  const largura = 2 * (FIO + FOLGA + SOBRA) + Children.count(children) * PASSO;
  return (
    <View
      pointerEvents="box-none"
      style={{
        // Na web, presa à janela: o Safari esconde e mostra a barra dele ao rolar, e
        // uma barra «absolute» dentro da página ficava a meio do ecrã.
        position: web ? ('fixed' as 'absolute') : 'absolute',
        left: 0,
        right: 0,
        bottom: margens.bottom + AFASTAMENTO_DA_BARRA,
        alignItems: 'center',
      }}
    >
      <View
        ref={ref}
        {...resto}
        role="tablist"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: largura,
          maxWidth: '92%',
          height: ALTURA_DA_BARRA,
          paddingVertical: FOLGA,
          // A sobra da pastilha do primeiro e do último cabe aqui.
          paddingHorizontal: FOLGA + SOBRA,
          borderRadius: 999,
          backgroundColor: web ? VIDRO_NA_WEB : cor.vidro,
          borderWidth: FIO,
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.35)',
          ...(web
            ? ({
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              } as object)
            : {}),
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
  const actual = !!isFocused;
  return (
    <Pressable
      ref={ref}
      {...resto}
      role="tab"
      aria-selected={actual}
      aria-label={nome}
      style={({ pressed }) => ({
        flexGrow: 0,
        flexShrink: 1,
        flexBasis: LARGURA_DA_PASTILHA,
        minWidth: 0,
        marginHorizontal: -SOBRA,
        height: ALTURA_DA_PASTILHA,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: actual
          ? pressed
            ? cor.claroPremido
            : cor.claro
          : pressed
            ? 'rgba(255,255,255,0.06)'
            : 'transparent',
      })}
    >
      <Icone
        nome={icone}
        tamanho={26}
        cor={actual ? cor.sobreClaro : cor.texto2}
        espessura={actual ? 2.2 : 1.8}
      />
    </Pressable>
  );
}
