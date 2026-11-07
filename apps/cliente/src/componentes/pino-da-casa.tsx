import { CONTINUO, T, cor } from '@nunos-lab/ui';
import { Image, View } from 'react-native';
// O «n» já em preto: pintar o branco com tintColor não funciona na web.
const simboloPreto = require('../../assets/marca/simbolo-preto.png');

/** O pino é o ícone da app em branco (o Renato escolheu o D2): o quadrado branco com o «n» preto, aro preto e uma ponta até ao sítio. */
const ICONE = 24;
const ARO = 1;
const PONTA = 5;
export const ALTURA_DO_PINO = ICONE + 2 * ARO + PONTA;
/** A largura do pino com o nome, que é também a do toque. */
export const LARGURA_DO_PINO = 150;

/**
 * Um pino com o nome por baixo, numa caixa com a ponta a meio da altura: os mapas vivos põem o
 * meio da caixa no sítio, e na imagem a caixa sobe metade (ALTURA_DO_PINO). O escolhido ganha um
 * aro creme (o Renato escolheu o 5).
 */
export function PinoDaCasa({ nome, escolhido }: { nome: string; escolhido: boolean }) {
  return (
    <View style={{ width: LARGURA_DO_PINO, height: 2 * ALTURA_DO_PINO, alignItems: 'center' }}>
      {escolhido && (
        <View
          style={{
            position: 'absolute',
            top: -5,
            width: ICONE + 2 * ARO + 10,
            height: ALTURA_DO_PINO + 4,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: cor.claro,
            ...CONTINUO,
          }}
        />
      )}
      <View
        style={{
          width: ICONE + 2 * ARO,
          height: ICONE + 2 * ARO,
          borderRadius: 7,
          backgroundColor: cor.sobreClaro,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(0,0,0,0.55)',
          ...CONTINUO,
        }}
      >
        <View
          style={{
            width: ICONE,
            height: ICONE,
            borderRadius: 6,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            ...CONTINUO,
          }}
        >
          <Image
            source={simboloPreto}
            style={{ width: 12.4, height: 13 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 4,
          borderRightWidth: 4,
          borderTopWidth: PONTA + 1,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: cor.sobreClaro,
        }}
      />
      {/* O nome numa pastilha escura, para se ler por cima das etiquetas do mapa. */}
      <View
        style={{
          marginTop: 3,
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: 'rgba(10,10,10,0.78)',
        }}
      >
        <T v="legenda" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
          {nome}
        </T>
      </View>
    </View>
  );
}
