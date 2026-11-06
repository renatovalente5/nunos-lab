import { enquadrar, projectar, type Loja } from '@nunos-lab/dominio';
import { CONTINUO, LARGURA_MAXIMA, MARGEM, T, cor, raio } from '@nunos-lab/ui';
import { useState } from 'react';
import { Image, PixelRatio, Pressable, View, useWindowDimensions } from 'react-native';
import { API } from '../dados';
const simbolo = require('../../assets/marca/simbolo.png');

/** O pino é o ícone da app em branco (o Renato escolheu o D2): o quadrado branco com o «n» preto, aro preto e uma ponta até ao sítio. */
const ICONE = 24;
const ARO = 1;
const PONTA = 5;
const ALTURA_DO_PINO = ICONE + 2 * ARO + PONTA;
const LARGURA_DO_TOQUE = 150;

/**
 * O mapa das casas: a imagem vem da API (os Mapas da Apple, pedidos pelo
 * servidor, sem os balões da Apple) e a app desenha por cima um pino por casa,
 * com o nome por baixo, que se toca. O enquadramento é o mesmo do servidor
 * (packages/dominio, mapa.ts), por isso os pinos caem no sítio certo. Se a
 * imagem não vier, não fica rectângulo nenhum.
 */
export function MapaDasCasas({ lojas, aoTocar }: { lojas: Loja[]; aoTocar: (loja: Loja) => void }) {
  const { width } = useWindowDimensions();
  const [estado, setEstado] = useState<'a-carregar' | 'pronto' | 'falhou'>('a-carregar');
  // Se a imagem falhar (rede, um soluço do servidor), tenta mais uma vez passados 2 s.
  const [tentativa, setTentativa] = useState(0);
  const comSitio = lojas.filter((l) => l.lat !== null && l.lng !== null);
  const w = Math.min(Math.round(Math.min(width, LARGURA_MAXIMA) - 2 * MARGEM), 640);
  // Ao alto: as casas estendem-se de norte a sul, e assim o mapa aproxima-se mais.
  const h = Math.min(Math.round(w * 1.05), 640);
  const e = enquadrar(comSitio as { lat: number; lng: number }[], w, h);
  if (!e || estado === 'falhou') return null;
  const escala = Math.min(3, Math.max(1, Math.round(PixelRatio.get())));
  return (
    <View
      style={{
        marginHorizontal: MARGEM,
        width: w,
        height: h,
        borderRadius: raio.grupo,
        overflow: 'hidden',
        backgroundColor: cor.superficie,
        ...CONTINUO,
      }}
    >
      <Image
        source={{
          uri: `${API}/api/mapa?w=${w}&h=${h}&s=${escala}&pinos=0${tentativa ? `&t=${tentativa}` : ''}`,
        }}
        style={{ width: w, height: h }}
        onLoad={() => setEstado('pronto')}
        onError={() => {
          if (tentativa === 0) setTimeout(() => setTentativa(1), 2000);
          else setEstado('falhou');
        }}
        accessibilityLabel="Mapa com as casas"
      />
      {estado === 'pronto' &&
        comSitio.map((l) => {
          const p = projectar({ lat: l.lat!, lng: l.lng! }, e, w, h);
          return (
            <Pressable
              key={l.id}
              onPress={() => aoTocar(l)}
              role="button"
              aria-label={l.nome}
              style={{
                position: 'absolute',
                left: p.x - LARGURA_DO_TOQUE / 2,
                top: p.y - ALTURA_DO_PINO,
                width: LARGURA_DO_TOQUE,
                alignItems: 'center',
              }}
            >
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
                    source={simbolo}
                    style={{ width: 12.4, height: 13, tintColor: cor.sobreClaro }}
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
                  {l.nome}
                </T>
              </View>
            </Pressable>
          );
        })}
    </View>
  );
}
