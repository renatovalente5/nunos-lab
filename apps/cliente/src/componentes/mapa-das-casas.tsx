import { enquadrar, projectar, semPartir, type Loja } from '@nunos-lab/dominio';
import { CONTINUO, LARGURA_MAXIMA, MARGEM, T, cor, raio } from '@nunos-lab/ui';
import { useState } from 'react';
import { Image, PixelRatio, Pressable, View, useWindowDimensions } from 'react-native';
import { API, abrir, contar } from '../dados';
// O «n» já em preto: pintar o branco com tintColor não funciona na web.
const simboloPreto = require('../../assets/marca/simbolo-preto.png');

/** O pino é o ícone da app em branco (o Renato escolheu o D2): o quadrado branco com o «n» preto, aro preto e uma ponta até ao sítio. */
const ICONE = 24;
const ARO = 1;
const PONTA = 5;
const ALTURA_DO_PINO = ICONE + 2 * ARO + PONTA;
const LARGURA_DO_TOQUE = 150;
/** O balão que abre por cima do pino tocado (o Renato escolheu o B). */
const LARGURA_DO_BALAO = 212;
const ALTURA_DO_BALAO = 118;
const SETA = 8;
const FOLGA = 8;
const FUNDO_DO_BALAO = '#1C1C1C';

/**
 * O mapa das casas: a imagem vem da API (os Mapas da Apple, pedidos pelo
 * servidor, sem os balões da Apple) e a app desenha por cima um pino por casa,
 * com o nome por baixo. Ao tocar num pino abre um balão, como nos Mapas da
 * Apple, com a morada e «Marcar» e «Ir»; tocar no mapa, ou outra vez no pino,
 * fecha-o. O enquadramento é o mesmo do servidor (packages/dominio, mapa.ts),
 * por isso os pinos caem no sítio certo. Se a imagem não vier, não fica
 * rectângulo nenhum.
 */
export function MapaDasCasas({ lojas, aoIr }: { lojas: Loja[]; aoIr: (loja: Loja) => void }) {
  const { width } = useWindowDimensions();
  const [estado, setEstado] = useState<'a-carregar' | 'pronto' | 'falhou'>('a-carregar');
  // Se a imagem falhar (rede, um soluço do servidor), tenta mais uma vez passados 2 s.
  const [tentativa, setTentativa] = useState(0);
  const [aberta, setAberta] = useState<number | null>(null);
  const comSitio = lojas.filter((l) => l.lat !== null && l.lng !== null);
  const w = Math.min(Math.round(Math.min(width, LARGURA_MAXIMA) - 2 * MARGEM), 640);
  // Ao alto: as casas estendem-se de norte a sul, e assim o mapa aproxima-se mais.
  const h = Math.min(Math.round(w * 1.05), 640);
  const e = enquadrar(comSitio as { lat: number; lng: number }[], w, h);
  if (!e || estado === 'falhou') return null;
  const escala = Math.min(3, Math.max(1, Math.round(PixelRatio.get())));
  const posicoes = comSitio.map((l) => ({
    loja: l,
    ...projectar({ lat: l.lat!, lng: l.lng! }, e, w, h),
  }));
  const escolhida = posicoes.find((p) => p.loja.id === aberta) ?? null;
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
      <Pressable onPress={() => setAberta(null)} disabled={aberta === null} aria-hidden>
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
      </Pressable>
      {estado === 'pronto' &&
        posicoes.map(({ loja: l, x, y }) => (
          <Pressable
            key={l.id}
            onPress={() => setAberta(aberta === l.id ? null : l.id)}
            role="button"
            aria-label={l.nome}
            aria-expanded={aberta === l.id}
            style={{
              position: 'absolute',
              left: x - LARGURA_DO_TOQUE / 2,
              top: y - ALTURA_DO_PINO,
              width: LARGURA_DO_TOQUE,
              alignItems: 'center',
            }}
          >
            {/* O pino com o balão aberto ganha um aro creme (o Renato escolheu o 5). */}
            {aberta === l.id && (
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
                {l.nome}
              </T>
            </View>
          </Pressable>
        ))}
      {escolhida && (
        <Balao
          loja={escolhida.loja}
          x={escolhida.x}
          y={escolhida.y}
          largura={w}
          altura={h}
          fechar={() => setAberta(null)}
          aoIr={() => {
            setAberta(null);
            aoIr(escolhida.loja);
          }}
        />
      )}
    </View>
  );
}

/**
 * O balão: por cima do pino, com a seta a apontar-lhe; encostado às bordas do
 * mapa quando o pino está perto delas, e por baixo do nome quando não cabe em cima.
 */
function Balao({
  loja,
  x,
  y,
  largura,
  altura,
  fechar,
  aoIr,
}: {
  loja: Loja;
  x: number;
  y: number;
  largura: number;
  altura: number;
  fechar: () => void;
  aoIr: () => void;
}) {
  const esquerda = Math.min(
    Math.max(FOLGA, x - LARGURA_DO_BALAO / 2),
    largura - FOLGA - LARGURA_DO_BALAO,
  );
  // A seta fica sobre o pino, mas nunca a sair do balão.
  const seta = Math.min(Math.max(20, x - esquerda), LARGURA_DO_BALAO - 20);
  const cabeEmCima = y - ALTURA_DO_PINO - SETA - ALTURA_DO_BALAO >= FOLGA;
  const triangulo = (paraBaixo: boolean) => (
    <View
      style={{
        marginLeft: seta - SETA,
        width: 0,
        height: 0,
        borderLeftWidth: SETA,
        borderRightWidth: SETA,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(paraBaixo
          ? { marginTop: -1, borderTopWidth: SETA, borderTopColor: FUNDO_DO_BALAO }
          : { marginBottom: -1, borderBottomWidth: SETA, borderBottomColor: FUNDO_DO_BALAO }),
      }}
    />
  );
  return (
    <View
      role="dialog"
      aria-label={loja.nome}
      style={{
        position: 'absolute',
        left: esquerda,
        // Em cima: o fundo do balão (com a seta) encosta ao topo do pino. Em baixo: debaixo do nome.
        ...(cabeEmCima ? { bottom: altura - (y - ALTURA_DO_PINO - 4) } : { top: y + 30 }),
      }}
    >
      {!cabeEmCima && triangulo(false)}
      <View
        style={{
          width: LARGURA_DO_BALAO,
          padding: 14,
          gap: 4,
          borderRadius: 16,
          backgroundColor: FUNDO_DO_BALAO,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          ...CONTINUO,
        }}
      >
        <T v="forte" numberOfLines={1}>
          {loja.nome}
        </T>
        {!!loja.morada && (
          <T v="legenda" numberOfLines={2} style={{ color: cor.texto2 }}>
            {semPartir(loja.morada)}
          </T>
        )}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!!loja.marcar && (
            <Pilula
              nome="Marcar"
              rotulo={`Marcar em ${loja.nome}`}
              principal
              onPress={() => {
                contar('marcar', loja.id);
                fechar();
                abrir(loja.marcar);
              }}
            />
          )}
          {!!loja.morada && <Pilula nome="Ir" rotulo={`Ir a ${loja.nome}`} onPress={aoIr} />}
        </View>
      </View>
      {cabeEmCima && triangulo(true)}
    </View>
  );
}

function Pilula({
  nome,
  rotulo,
  principal = false,
  onPress,
}: {
  nome: string;
  rotulo: string;
  principal?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={rotulo}
      style={({ pressed }) => ({
        paddingHorizontal: 18,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        backgroundColor: principal
          ? pressed
            ? cor.claroPremido
            : cor.claro
          : pressed
            ? cor.linha
            : cor.superficieAlta,
      })}
    >
      <T v="forte" style={{ fontSize: 14, color: principal ? cor.sobreClaro : cor.texto }}>
        {nome}
      </T>
    </Pressable>
  );
}
